import type { FateServer } from '@nkzw/fate/server';
import { expect, test, vi } from 'vite-plus/test';
import { createVoidFateLive, defineVoidFateLiveRoute, type VoidFateLive } from '../server.ts';

test('does not fail requests when live publishing is unavailable', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  const { live, withContext } = createVoidFateLive();

  await expect(
    withContext({ env: {}, origin: 'https://example.com' }, async () => {
      live.update('Post', 'post-1');
      return 'ok';
    }),
  ).resolves.toBe('ok');

  expect(fetch).not.toHaveBeenCalled();
  fetch.mockRestore();
});

test('does not fail requests when live publishing rejects', async () => {
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(null, { status: 500 }));
  const { live, withContext } = createVoidFateLive();

  await expect(
    withContext(
      { env: { __VOID_PROXY_TOKEN: 'token' }, origin: 'https://example.com' },
      async () => {
        live.update('Post', 'post-1');
        return 'ok';
      },
    ),
  ).resolves.toBe('ok');

  expect(fetch).toHaveBeenCalledOnce();
  fetch.mockRestore();
});

test('routes live endpoint requests to the live handler', async () => {
  const handleLiveRequest = vi.fn(() => Promise.resolve(new Response('live')));
  const handleRequest = vi.fn(() => Promise.resolve(new Response('rpc')));
  const route = defineVoidFateLiveRoute(
    {
      handleLiveRequest,
      handleRequest,
    } as unknown as FateServer<unknown, unknown>,
    {
      handlePublish: () => Promise.resolve(null),
      live: {} as VoidFateLive['live'],
      withContext: <T>(_context: Parameters<VoidFateLive['withContext']>[0], callback: () => T) =>
        callback(),
    } as VoidFateLive,
  );

  const response = (await route.GET({
    env: {},
    req: { raw: new Request('https://example.com/fate-live') },
  } as Parameters<typeof route.GET>[0])) as Response;

  expect(await response.text()).toBe('live');
  expect(handleLiveRequest).toHaveBeenCalledOnce();
  expect(handleRequest).not.toHaveBeenCalled();
});
