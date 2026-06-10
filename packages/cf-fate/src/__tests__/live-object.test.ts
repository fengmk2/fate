/* eslint-disable @nkzw/no-instanceof */

import { expect, test } from 'vite-plus/test';
import { createCloudflareFateLiveDurableObject } from '../runtime/live-server.ts';
import { defineCloudflareFateLiveStream } from '../runtime/live.ts';

type StorageValue = unknown;

const jsonRequest = (url: string, body: unknown) =>
  new Request(`https://cf-fate.test${url}`, {
    body: JSON.stringify(body),
    method: 'POST',
  });

const createState = () => {
  const storage = new Map<string, StorageValue>();
  return {
    storage: {
      async delete(key: string | Array<string>) {
        if (Array.isArray(key)) {
          let count = 0;
          for (const entry of key) {
            if (storage.delete(entry)) {
              count++;
            }
          }
          return count;
        }
        return storage.delete(key);
      },
      async get<T>(key: string) {
        return storage.get(key) as T | undefined;
      },
      async list<T>({ prefix }: { prefix?: string } = {}) {
        const entries = [...storage.entries()].filter(([key]) => !prefix || key.startsWith(prefix));
        return new Map(entries) as Map<string, T>;
      },
      async put(key: string, value: unknown) {
        storage.set(key, value);
      },
      async setAlarm() {},
    },
  };
};

const createHarness = () => {
  const LiveDurableObject = createCloudflareFateLiveDurableObject({ binding: 'TEST_LIVE' });
  const env: Record<string, unknown> = {};
  const instances = new Map<string, { fetch(request: Request): Promise<Response> }>();
  const namespace = {
    get(id: string) {
      let instance = instances.get(id);
      if (!instance) {
        instance = new LiveDurableObject(createState() as never, env);
        instances.set(id, instance);
      }
      return {
        fetch(input: RequestInfo | URL, init?: RequestInit) {
          return instance.fetch(input instanceof Request ? input : new Request(input, init));
        },
      };
    },
    idFromName(name: string) {
      return name;
    },
  };
  env.TEST_LIVE = namespace;
  return { env };
};

const readFrame = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
  const decoder = new TextDecoder();
  let text = '';
  while (!text.includes('\n\n')) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text;
};

const parseData = (frame: string) => {
  const line = frame
    .split('\n')
    .find((entry) => entry.startsWith('data: '))
    ?.slice('data: '.length);
  return line ? JSON.parse(line) : null;
};

test('delivers published topic events over a Cloudflare Durable Object SSE stream', async () => {
  const { env } = createHarness();
  const stream = defineCloudflareFateLiveStream({
    allowAnonymousControl: true,
    binding: 'TEST_LIVE',
    id: `test-${crypto.randomUUID()}`,
  });
  const connectionId = 'connection-live-test-1';
  const response = await stream.connect({
    env,
    request: new Request(`https://example.com/fate-live?connectionId=${connectionId}`),
  });
  const reader = response.body!.getReader();
  await readFrame(reader);

  const control = await stream.control({
    env,
    request: jsonRequest('/fate-live', {
      connectionId,
      operations: [{ id: 'post-card', kind: 'subscribe', topic: 'post:1' }],
    }),
  });

  expect(control.ok).toBe(true);

  await stream.withEnv(env).publish('post:1', { id: '1', title: 'Updated' }, { type: 'update' });

  expect(parseData(await readFrame(reader))).toMatchObject({
    data: { id: '1', title: 'Updated' },
    subscriptionId: 'post-card',
    topic: 'post:1',
    type: 'update',
  });

  await reader.cancel();
});
