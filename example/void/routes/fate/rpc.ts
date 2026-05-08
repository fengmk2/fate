import { createFateFetchHandler } from '@nkzw/fate/server';
import { defineHandler } from 'void';
import { withFateLiveContext } from '../../src/fate/live.ts';
import { fateServer } from '../../src/fate/server.ts';

const handleFate = createFateFetchHandler(fateServer);

export const GET = defineHandler((context) =>
  withFateLiveContext(
    {
      env: context.env,
      origin: new URL(context.req.url).origin,
    },
    () => handleFate(context.req.raw, context),
  ),
);

export const POST = defineHandler((context) =>
  withFateLiveContext(
    {
      env: context.env,
      origin: new URL(context.req.url).origin,
    },
    () => handleFate(context.req.raw, context),
  ),
);
