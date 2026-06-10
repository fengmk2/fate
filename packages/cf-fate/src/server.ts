import { AsyncLocalStorage } from 'node:async_hooks';
import {
  createFateFetchHandler,
  type FateServer,
  type LiveConnectionEventType,
  type LiveEventBus,
  type LiveEventType,
  liveConnectionTopic,
  liveEntityTopic,
  liveGlobalConnectionTopic,
} from '@nkzw/fate/server';
import {
  createCloudflareFateLiveDurableObject,
  type CreateLiveDurableObjectOptions,
  type LiveDurableObjectClass,
  type LiveDurableObjectInstance,
} from './runtime/live-server.ts';
import {
  defineCloudflareFateLiveStream,
  type CloudflareFateLiveContext,
  type LivePublishOptions,
  type LiveStream,
  type LiveStreamOptions,
} from './runtime/live.ts';

type ExecutionContext = {
  waitUntil?(promise: Promise<unknown>): void;
};
type CloudflareEnv = Record<string, unknown>;
type MaybePromiseLike = PromiseLike<unknown>;

export type CloudflareFateHandler<Env extends CloudflareEnv = CloudflareEnv> = (
  request: Request,
  env: Env,
  ctx?: ExecutionContext,
) => Promise<Response>;

export type CloudflareFateLiveStream<Env extends CloudflareEnv = CloudflareEnv> = LiveStream<Env>;

type FateLiveContext<Env extends CloudflareEnv = CloudflareEnv> = {
  env: Env;
  pending: Array<Promise<void>>;
  stream: CloudflareFateLiveStream<Env>;
};

type EntityPayload = Readonly<{
  changed?: ReadonlyArray<string>;
  data?: unknown;
  id: string | number;
}>;

type ConnectionPayload = Readonly<{
  cursor?: string;
  id?: string | number;
  node?: unknown;
  nodeType?: string;
  targetCursor?: string;
}>;

export type CloudflareFateLiveOptions = Record<never, never>;

export type CloudflareFateRouteOptions<Env extends CloudflareEnv = CloudflareEnv> = {
  stream: CloudflareFateLiveStream<Env>;
};

export type CloudflareFateLive<Env extends CloudflareEnv = CloudflareEnv> = Readonly<{
  live: LiveEventBus;
  withContext: <T>(context: Omit<FateLiveContext<Env>, 'pending'>, callback: () => T) => T;
}>;

export const defaultCloudflareFateRpcPath = '/fate';
export const defaultCloudflareFateLivePath = '/fate-live';

const isPromiseLike = (value: unknown): value is MaybePromiseLike =>
  (typeof value === 'object' || typeof value === 'function') &&
  value !== null &&
  typeof (value as { then?: unknown }).then === 'function';

export function createCloudflareFateLive<Env extends CloudflareEnv = CloudflareEnv>(
  _options: CloudflareFateLiveOptions = {},
): CloudflareFateLive<Env> {
  const contextStore = new AsyncLocalStorage<FateLiveContext<Env>>();

  const publish = (
    topic: string,
    data: EntityPayload | ConnectionPayload,
    options: { eventId?: string; type: LiveConnectionEventType | LiveEventType },
  ) => {
    const context = contextStore.getStore();
    if (!context) {
      return;
    }

    const publishOptions = {
      eventId: options.eventId,
      type: options.type,
    } satisfies LivePublishOptions;
    const promise = context.stream
      .withEnv(context.env)
      .publish(topic, data, publishOptions)
      .catch(() => undefined);

    context.pending.push(promise);
  };

  const publishEntity = (
    type: string,
    id: string | number,
    options: {
      changed?: ReadonlyArray<string>;
      data?: unknown;
      eventId?: string;
      type?: LiveEventType;
    } = {},
  ) => {
    publish(
      liveEntityTopic(type, id),
      {
        changed: options.changed,
        data: options.data,
        id,
      },
      {
        eventId: options.eventId,
        type: options.type ?? 'update',
      },
    );
  };

  const publishConnection = (
    procedure: string,
    args: Record<string, unknown> | undefined,
    type: LiveConnectionEventType,
    options: {
      cursor?: string;
      eventId?: string;
      id?: string | number;
      node?: unknown;
      nodeType?: string;
      targetCursor?: string;
    } = {},
  ) => {
    const topic = args
      ? liveConnectionTopic(procedure, args)
      : liveGlobalConnectionTopic(procedure);

    publish(
      topic,
      {
        cursor: options.cursor,
        id: options.id,
        node: options.node,
        nodeType: options.nodeType,
        targetCursor: options.targetCursor,
      },
      { eventId: options.eventId, type },
    );
  };

  const withContext: CloudflareFateLive<Env>['withContext'] = (context, callback) =>
    contextStore.run({ ...context, pending: [] }, () => {
      const liveContext = contextStore.getStore()!;
      const result = callback();

      if (isPromiseLike(result) || liveContext.pending.length > 0) {
        return Promise.resolve(result).then(async (value) => {
          if (liveContext.pending.length > 0) {
            await Promise.allSettled(liveContext.pending);
          }
          return value;
        }) as ReturnType<typeof callback>;
      }

      return result;
    });

  const live: CloudflareFateLive<Env> = {
    live: {
      connection(procedure, args) {
        return {
          appendEdge(nodeType, id, options) {
            publishConnection(procedure, args, 'appendEdge', { ...options, id, nodeType });
          },
          appendNode(nodeType, id, options) {
            publishConnection(procedure, args, 'appendNode', { ...options, id, nodeType });
          },
          deleteEdge(nodeType, id, options) {
            publishConnection(procedure, args, 'deleteEdge', { ...options, id, nodeType });
          },
          emit(type, options) {
            publishConnection(procedure, args, type, options);
          },
          insertEdgeAfter(nodeType, id, targetCursor, options) {
            publishConnection(procedure, args, 'insertEdgeAfter', {
              ...options,
              id,
              nodeType,
              targetCursor,
            });
          },
          insertEdgeBefore(nodeType, id, targetCursor, options) {
            publishConnection(procedure, args, 'insertEdgeBefore', {
              ...options,
              id,
              nodeType,
              targetCursor,
            });
          },
          invalidate(options) {
            publishConnection(procedure, args, 'invalidate', options);
          },
          prependEdge(nodeType, id, options) {
            publishConnection(procedure, args, 'prependEdge', { ...options, id, nodeType });
          },
          prependNode(nodeType, id, options) {
            publishConnection(procedure, args, 'prependNode', { ...options, id, nodeType });
          },
        };
      },
      delete(type, id, options) {
        publishEntity(type, id, { ...options, type: 'delete' });
      },
      emit: publishEntity,
      subscribe() {
        throw new Error('cf-fate: direct live subscriptions are handled by cf-fate/client.');
      },
      subscribeConnection() {
        throw new Error('cf-fate: direct live subscriptions are handled by cf-fate/client.');
      },
      update(type, id, options) {
        publishEntity(type, id, { ...options, type: 'update' });
      },
    },
    withContext,
  };

  return live;
}

export function defineCloudflareFateRoute<Env extends CloudflareEnv, AdapterContext>(
  server: FateServer<unknown, AdapterContext>,
  live: CloudflareFateLive<Env>,
  options: CloudflareFateRouteOptions<Env>,
) {
  const handleFate = createFateFetchHandler(server);
  const handle: CloudflareFateHandler<Env> = (request, env, ctx) =>
    live.withContext({ env, stream: options.stream }, () =>
      handleFate(request, { ctx, env, request } as AdapterContext),
    );

  return {
    fetch: handle,
    GET: handle,
    handle,
    POST: handle,
  };
}

export function defineCloudflareFateLiveRoute<Env extends CloudflareEnv>(
  stream: CloudflareFateLiveStream<Env>,
) {
  const GET: CloudflareFateHandler<Env> = (request, env, ctx) =>
    stream.connect({ ctx, env, request } satisfies CloudflareFateLiveContext<Env>);
  const POST: CloudflareFateHandler<Env> = (request, env, ctx) =>
    stream.control({ ctx, env, request } satisfies CloudflareFateLiveContext<Env>);
  const handle: CloudflareFateHandler<Env> = (request, env, ctx) => {
    if (request.method === 'GET') {
      return GET(request, env, ctx);
    }
    if (request.method === 'POST') {
      return POST(request, env, ctx);
    }
    return Promise.resolve(new Response('Method Not Allowed', { status: 405 }));
  };

  return {
    fetch: handle,
    GET,
    handle,
    POST,
  };
}

export { defineCloudflareFateLiveStream, createCloudflareFateLiveDurableObject };
export type {
  CreateLiveDurableObjectOptions,
  LiveDurableObjectClass,
  LiveDurableObjectInstance,
  LiveStreamOptions as CloudflareFateLiveStreamOptions,
};
