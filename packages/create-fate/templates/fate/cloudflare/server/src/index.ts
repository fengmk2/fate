import {
  createCloudflareFateLiveDurableObject,
  defineCloudflareFateLiveRoute,
  defineCloudflareFateRoute,
} from 'cf-fate/server';
import { withDatabase, type D1Binding } from '../db/db.ts';
import { fateStream } from './fate/live.ts';
import { fateLive, fateServer } from './fate/server.ts';
import { createAuth } from './lib/auth.ts';
import { clientOrigin, resolveCorsOrigin } from './lib/origins.ts';

type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type Env = Record<string, unknown> & {
  BETTER_AUTH_SECRET?: string;
  DB: D1Binding;
  FATE_LIVE: unknown;
};

const fateRoute = defineCloudflareFateRoute(fateServer, fateLive, { stream: fateStream });
const fateLiveRoute = defineCloudflareFateLiveRoute(fateStream);

export const FateLiveDurableObject = createCloudflareFateLiveDurableObject({
  binding: 'FATE_LIVE',
});

const corsHeaders = (request: Request): Headers => {
  const origin = resolveCorsOrigin(request.headers.get('origin'));
  const headers = new Headers();
  if (origin) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-credentials', 'true');
    headers.set('vary', 'Origin');
  }
  return headers;
};

const withCors = (request: Request, response: Response): Response => {
  const headers = new Headers(response.headers);
  corsHeaders(request).forEach((value, key) => headers.set(key, value));
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};

const optionsResponse = (request: Request) => {
  const headers = corsHeaders(request);
  headers.set('access-control-allow-headers', 'content-type, authorization');
  headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
  headers.set('access-control-max-age', '86400');
  return new Response(null, { headers, status: 204 });
};

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return withDatabase(env.DB, async () => {
      if (request.method === 'OPTIONS') {
        return optionsResponse(request);
      }

      const url = new URL(request.url);
      let response: Response;
      if (url.pathname === '/fate' || url.pathname.startsWith('/fate/')) {
        response = await fateRoute.fetch(request, env, ctx);
      } else if (url.pathname === '/fate-live' || url.pathname.startsWith('/fate-live/')) {
        response = await fateLiveRoute.fetch(request, env, ctx);
      } else if (url.pathname.startsWith('/api/auth/')) {
        response = await createAuth(url.origin, env.BETTER_AUTH_SECRET).handler(request);
      } else {
        response = Response.redirect(clientOrigin, 302);
      }

      return withCors(request, response);
    });
  },
};
