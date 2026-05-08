import { createFateFetchHandler } from '@nkzw/fate/server';
import { defineWebSocket } from 'void/ws';
import { z } from 'zod';
import { handleFateLivePublish, withFateLiveContext } from '../../src/fate/live.ts';
import { fateServer } from '../../src/fate/server.ts';

const handleFate = createFateFetchHandler(fateServer);

export default defineWebSocket({
  messages: {
    client: z.unknown(),
    server: z.unknown(),
  },
  async onRequest(context) {
    const publishResponse = await handleFateLivePublish(context.request, context.env);
    if (publishResponse) {
      return publishResponse;
    }

    return withFateLiveContext(
      { env: context.env, origin: new URL(context.request.url).origin },
      () => handleFate(context.request, context),
    );
  },
});
