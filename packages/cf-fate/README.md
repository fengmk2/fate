# cf-fate

Cloudflare adapter for [fate](https://github.com/nkzw-tech/fate).

`cf-fate` provides a Durable Object-backed Server-Sent Events transport for Fate
live views in plain Cloudflare Workers projects.

## New Project

For a new Cloudflare Workers app, start from the Cloudflare template:

```sh
vp create fate my-app --template cloudflare
```

Use Vue instead of React with:

```sh
vp create fate my-app --template cloudflare --framework vue
```

## Existing Project

For an existing Cloudflare Workers project, add the packages directly:

```sh
pnpm add @nkzw/fate react-fate cf-fate
```

For Vue clients, replace `react-fate` with `vue-fate`.

## Wrangler

Export the live Durable Object class from your Worker entry and bind it in
`wrangler.jsonc`.

```ts
import { createCloudflareFateLiveDurableObject } from 'cf-fate/server';

export const FateLiveDurableObject = createCloudflareFateLiveDurableObject({
  binding: 'FATE_LIVE',
});
```

```jsonc
{
  "compatibility_flags": ["nodejs_compat"],
  "durable_objects": {
    "bindings": [
      {
        "name": "FATE_LIVE",
        "class_name": "FateLiveDurableObject",
      },
    ],
  },
  "migrations": [
    {
      "tag": "fate-live-v1",
      "new_sqlite_classes": ["FateLiveDurableObject"],
    },
  ],
}
```

## Server

```ts
import { createFateServer } from '@nkzw/fate/server';
import { createCloudflareFateLive, defineCloudflareFateLiveStream } from 'cf-fate/server';

export const fateStream = defineCloudflareFateLiveStream({
  allowAnonymousControl: true,
  binding: 'FATE_LIVE',
  id: 'fate',
});

export const fateLive = createCloudflareFateLive();
export const { live } = fateLive;

export const fateServer = createFateServer({
  live,
  // context,
  // roots,
  // sources,
});
```

```ts
import { defineCloudflareFateLiveRoute, defineCloudflareFateRoute } from 'cf-fate/server';
import { fateStream, fateLive, fateServer } from './fate/server';

const fateRoute = defineCloudflareFateRoute(fateServer, fateLive, { stream: fateStream });
const fateLiveRoute = defineCloudflareFateLiveRoute(fateStream);

export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/fate') {
      return fateRoute.fetch(request, env, ctx);
    }
    if (url.pathname === '/fate-live') {
      return fateLiveRoute.fetch(request, env, ctx);
    }
    return new Response('Not Found', { status: 404 });
  },
};
```

## Client

Use the Fate Vite plugin with the Cloudflare transport:

```ts
fate({
  module: './src/fate/server.ts',
  transport: 'cloudflare',
});
```

Then create the generated client with your Worker endpoints:

```ts
createFateClient({
  liveUrl: 'http://localhost:8787/fate-live',
  url: 'http://localhost:8787/fate',
});
```

`cf-fate` uses Server-Sent Events for live updates and Durable Objects for
cross-request topic fanout. Delivery is live and at-most-once; applications that
need lossless replay should persist events or refetch authoritative data after a
reconnect.
