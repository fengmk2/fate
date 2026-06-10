import { expect, test, vi } from 'vite-plus/test';
import { connectCloudflareFateStream } from '../client.ts';

type Listener = (event: Event) => void;

const waitFor = async (predicate: () => boolean) => {
  for (let i = 0; i < 20; i++) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Timed out waiting for condition.');
};

test('drops local subscriptions before waiting for unsubscribe control acknowledgement', async () => {
  let currentSource: TestEventSource | null = null;

  class TestEventSource {
    close = vi.fn();
    listeners = new Map<string, Set<Listener>>();

    constructor() {
      currentSource = this;
    }

    addEventListener(type: string, listener: Listener): void {
      const listeners = this.listeners.get(type) ?? new Set<Listener>();
      listeners.add(listener);
      this.listeners.set(type, listeners);
    }

    emit(type: string, event: Event): void {
      for (const listener of this.listeners.get(type) ?? []) {
        listener(event);
      }
    }

    removeEventListener(type: string, listener: Listener): void {
      this.listeners.get(type)?.delete(listener);
    }
  }

  let resolveUnsubscribe: ((response: Response) => void) | undefined;
  const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as {
      connectionId: string;
      operations: Array<{ id: string; kind: 'subscribe' | 'unsubscribe'; topic?: string }>;
    };
    const [operation] = body.operations;
    if (!operation) {
      throw new Error('Missing control operation.');
    }

    if (operation.kind === 'unsubscribe') {
      return new Promise<Response>((resolve) => {
        resolveUnsubscribe = resolve;
      });
    }

    return Promise.resolve(
      Response.json({
        accepted: true,
        connectionId: body.connectionId,
        results: [
          {
            id: operation.id,
            kind: operation.kind,
            ok: true,
            topic: operation.topic,
          },
        ],
      }),
    );
  });
  const onEvent = vi.fn();
  const client = connectCloudflareFateStream('https://example.com/fate-live', {
    eventSource: TestEventSource as never,
    fetch: fetchImpl as typeof fetch,
  });
  const subscribe = client.subscribe({
    id: 'post-card',
    onEvent,
    topic: 'post:1',
  });

  await waitFor(() => currentSource != null);
  currentSource!.emit('open', new Event('open'));
  const unsubscribe = await subscribe;
  const unsubscribed = unsubscribe();
  await waitFor(() => Boolean(resolveUnsubscribe));

  currentSource!.emit('message', {
    data: JSON.stringify({
      data: { id: '1', title: 'Stale' },
      subscriptionId: 'post-card',
      topic: 'post:1',
    }),
  } as MessageEvent);

  expect(onEvent).not.toHaveBeenCalled();

  resolveUnsubscribe!(
    Response.json({
      accepted: true,
      connectionId: client.connectionId,
      results: [{ id: 'post-card', kind: 'unsubscribe', ok: true }],
    }),
  );
  await unsubscribed;
});
