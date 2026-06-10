import { expect, test, vi } from 'vite-plus/test';
import {
  createCloudflareFateLive,
  defineCloudflareFateLiveRoute,
  type CloudflareFateLiveStream,
} from '../server.ts';

const createTestStream = (publish = vi.fn(() => Promise.resolve())) =>
  ({
    connect: vi.fn(() => Promise.resolve(new Response('live'))),
    control: vi.fn(() => Promise.resolve(new Response('control'))),
    withEnv: vi.fn(() => ({ publish })),
  }) satisfies CloudflareFateLiveStream;

test('creates publish facades without defining a live stream', () => {
  expect(() => {
    createCloudflareFateLive();
    createCloudflareFateLive();
  }).not.toThrow();
});

test('does not fail requests when live publishing is unavailable', async () => {
  const stream = createTestStream(vi.fn(() => Promise.reject(new Error('unavailable'))));
  const { live, withContext } = createCloudflareFateLive();

  await expect(
    withContext({ env: {}, stream }, async () => {
      live.update('Post', 'post-1');
      return 'ok';
    }),
  ).resolves.toBe('ok');
});

test('publishes changed paths with entity live events', async () => {
  const publish = vi.fn(() => Promise.resolve());
  const stream = createTestStream(publish);
  const { live, withContext } = createCloudflareFateLive();

  await withContext({ env: {}, stream }, async () => {
    live.update('Post', 'post-1', { changed: ['likes'], eventId: 'event-1' });
  });

  expect(publish).toHaveBeenCalledWith(
    'entity:Post:post-1',
    { changed: ['likes'], data: undefined, id: 'post-1' },
    { eventId: 'event-1', type: 'update' },
  );
});

test('publishes connection events through the live facade without failing requests', async () => {
  const publish = vi.fn(() => Promise.resolve());
  const stream = createTestStream(publish);
  const { live, withContext } = createCloudflareFateLive();

  await expect(
    withContext({ env: {}, stream }, async () => {
      live.connection('posts').prependNode('Post', 'post-1');
      return 'ok';
    }),
  ).resolves.toBe('ok');
  expect(publish).toHaveBeenCalledOnce();
});

test('routes live endpoint requests to Cloudflare live handlers', async () => {
  const connect = vi.fn(() => Promise.resolve(new Response('live')));
  const control = vi.fn(() => Promise.resolve(new Response('control')));
  const route = defineCloudflareFateLiveRoute({
    connect,
    control,
    withEnv: vi.fn(() => ({ publish: vi.fn(() => Promise.resolve()) })),
  });

  const response = await route.GET(new Request('https://example.com/fate-live'), {});

  expect(await response.text()).toBe('live');
  expect(connect).toHaveBeenCalledOnce();
  expect(control).not.toHaveBeenCalled();
});
