import { AsyncLocalStorage } from 'node:async_hooks';
import {
  createFateFetchHandler,
  createLiveEventBus,
  type FateServer,
  type LiveConnectionEventType,
  type LiveConnectionSourceEvent,
  type LiveEventBus,
  type LiveEventType,
  type LiveSourceEvent,
} from '@nkzw/fate/server';
import { defineHandler } from 'void';

type VoidEnv = Record<string, unknown>;
type MaybePromiseLike = PromiseLike<unknown>;

type FateLiveContext = {
  env: VoidEnv;
  origin: string;
  pending: Array<Promise<void>>;
};

type PublishMessage =
  | {
      event: LiveSourceEvent;
      kind: 'entity';
      type: string;
    }
  | {
      args?: Record<string, unknown>;
      event: LiveConnectionSourceEvent;
      kind: 'connection';
      procedure: string;
    };

export type VoidFateLiveOptions = {
  devInternalToken?: string;
  internalHeader?: string;
  livePath?: string;
  publishHeader?: string;
};

export type VoidFateRouteOptions = {
  origin?: (request: Request) => string;
};

export type VoidFateLive = Readonly<{
  handlePublish: (request: Request, env: VoidEnv) => Promise<Response | null>;
  live: LiveEventBus;
  withContext: <T>(context: Omit<FateLiveContext, 'pending'>, callback: () => T) => T;
}>;

export const defaultVoidFateRpcPath = '/fate';
export const defaultVoidFateLivePath = '/fate-live';

const defaultDevInternalToken = 'fate-live-dev';
const defaultInternalHeader = 'x-void-internal';
const defaultPublishHeader = 'x-fate-live-publish';

const isPromiseLike = (value: unknown): value is MaybePromiseLike =>
  (typeof value === 'object' || typeof value === 'function') &&
  value !== null &&
  typeof (value as { then?: unknown }).then === 'function';

const isLocalOrigin = (origin: string) => {
  const hostname = new URL(origin).hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
};

const defaultOrigin = (request: Request): string => new URL(request.url).origin;

export function createVoidFateLive({
  devInternalToken = defaultDevInternalToken,
  internalHeader = defaultInternalHeader,
  livePath = defaultVoidFateLivePath,
  publishHeader = defaultPublishHeader,
}: VoidFateLiveOptions = {}): VoidFateLive {
  const contextStore = new AsyncLocalStorage<FateLiveContext>();
  const localLive = createLiveEventBus();

  const getInternalToken = (env: VoidEnv, origin: string) => {
    const token = env.__VOID_PROXY_TOKEN;
    if (typeof token === 'string') {
      return token;
    }

    return isLocalOrigin(origin) ? devInternalToken : null;
  };

  const publishToLiveRoute = async (message: PublishMessage, context: FateLiveContext) => {
    const token = getInternalToken(context.env, context.origin);
    if (!token) {
      throw new Error('Fate live publish requires __VOID_PROXY_TOKEN outside local dev.');
    }

    const response = await fetch(new URL(livePath, context.origin), {
      body: JSON.stringify(message),
      headers: {
        'content-type': 'application/json',
        [internalHeader]: token,
        [publishHeader]: '1',
      },
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Fate live publish failed with HTTP ${response.status}.`);
    }
  };

  const publish = (message: PublishMessage) => {
    const context = contextStore.getStore();
    if (!context) {
      return false;
    }

    if (!getInternalToken(context.env, context.origin)) {
      return false;
    }

    context.pending.push(publishToLiveRoute(message, context));
    return true;
  };

  const publishEntity = (
    type: string,
    id: string | number,
    options: { data?: unknown; eventId?: string; type?: LiveEventType } = {},
  ) => {
    const event = {
      data: options.data,
      eventId: options.eventId,
      id,
      type: options.type ?? 'update',
    } satisfies LiveSourceEvent;

    if (!publish({ event, kind: 'entity', type })) {
      localLive.emit(type, id, options);
    }
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
    const event = {
      cursor: options.cursor,
      eventId: options.eventId,
      id: options.id,
      node: options.node,
      nodeType: options.nodeType,
      targetCursor: options.targetCursor,
      type,
    } satisfies LiveConnectionSourceEvent;

    if (!publish({ args, event, kind: 'connection', procedure })) {
      localLive.connection(procedure, args).emit(type, options);
    }
  };

  const withContext: VoidFateLive['withContext'] = (context, callback) =>
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

  const handlePublish: VoidFateLive['handlePublish'] = async (request, env) => {
    if (request.headers.get(publishHeader) !== '1') {
      return null;
    }

    const token = getInternalToken(env, new URL(request.url).origin);
    if (!token || request.headers.get(internalHeader) !== token) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    const message = (await request.json()) as PublishMessage;
    if (message.kind === 'entity') {
      localLive.emit(message.type, message.event.id, {
        data: message.event.data,
        eventId: message.event.eventId,
        type: message.event.type,
      });
    } else {
      localLive.connection(message.procedure, message.args).emit(message.event.type, {
        cursor: message.event.cursor,
        eventId: message.event.eventId,
        id: message.event.id,
        node: message.event.node,
        nodeType: message.event.nodeType,
        targetCursor: message.event.targetCursor,
      });
    }

    return Response.json({ ok: true });
  };

  return {
    handlePublish,
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
      listen: localLive.listen,
      listenConnection: localLive.listenConnection,
      subscribe: localLive.subscribe,
      subscribeConnection: localLive.subscribeConnection,
      update(type, id, options) {
        publishEntity(type, id, { ...options, type: 'update' });
      },
    },
    withContext,
  };
}

export function defineVoidFateRoute<AdapterContext>(
  server: FateServer<unknown, AdapterContext>,
  live: VoidFateLive,
  { origin = defaultOrigin }: VoidFateRouteOptions = {},
) {
  const handleFate = createFateFetchHandler(server);
  const handle = (context: { env: VoidEnv; req: { raw: Request } }) =>
    live.withContext(
      {
        env: context.env,
        origin: origin(context.req.raw),
      },
      () => handleFate(context.req.raw, context as AdapterContext),
    );

  return {
    GET: defineHandler(handle),
    POST: defineHandler(handle),
  };
}

export function defineVoidFateLiveRoute<AdapterContext>(
  server: FateServer<unknown, AdapterContext>,
  live: VoidFateLive,
  { origin = defaultOrigin }: VoidFateRouteOptions = {},
) {
  const handle = async (context: { env: VoidEnv; req: { raw: Request } }) => {
    const publishResponse = await live.handlePublish(context.req.raw, context.env);
    if (publishResponse) {
      return publishResponse;
    }

    return live.withContext(
      {
        env: context.env,
        origin: origin(context.req.raw),
      },
      () => server.handleLiveRequest(context.req.raw, context as AdapterContext),
    );
  };

  return {
    GET: defineHandler(handle),
    POST: defineHandler(handle),
  };
}
