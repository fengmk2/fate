# Cloudflare Integration

`cf-fate` is the first-class Cloudflare Workers adapter for Fate native HTTP transport and live views.

Use it when your backend runs directly on Cloudflare Workers and you want fate live views without adopting the Void platform.

## Install

```sh
pnpm add @nkzw/fate react-fate cf-fate drizzle-orm
pnpm add -D wrangler
```

## Server Setup

Create a Cloudflare live stream and pass its Fate live facade to `createFateServer`.

```ts
// src/fate/live.ts
import { defineCloudflareFateLiveStream } from 'cf-fate/server';

export const fateStream = defineCloudflareFateLiveStream({
  allowAnonymousControl: true,
  binding: 'FATE_LIVE',
  id: 'fate',
});
```

```ts
// src/fate/server.ts
import { createFateServer } from '@nkzw/fate/server';
import { createCloudflareFateLive } from 'cf-fate/server';

export const fateLive = createCloudflareFateLive();
export const { live } = fateLive;

export const fateServer = createFateServer({
  live,
  // context,
  // roots,
  // sources,
});
```

Publish from mutations through the normal Fate live bus:

```ts
live.update('Post', postId, { changed: ['likes'] });
live.connection('Post.comments', { id: postId }).appendNode('Comment', commentId);
```

## Worker Routes

Expose one route for Fate RPC and one route for the SSE live stream.

```ts
import {
  createCloudflareFateLiveDurableObject,
  defineCloudflareFateLiveRoute,
  defineCloudflareFateRoute,
} from 'cf-fate/server';
import { fateStream } from './fate/live';
import { fateLive, fateServer } from './fate/server';

const fateRoute = defineCloudflareFateRoute(fateServer, fateLive, { stream: fateStream });
const fateLiveRoute = defineCloudflareFateLiveRoute(fateStream);

export const FateLiveDurableObject = createCloudflareFateLiveDurableObject({
  binding: 'FATE_LIVE',
});

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

## Wrangler

Add a Durable Object binding and migration. `cf-fate` uses `node:async_hooks`, so the Worker must enable Node compatibility.

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

## Client

Use the Cloudflare transport in the Fate Vite plugin:

```ts
import { fate } from 'react-fate/vite';

fate({
  module: './src/fate/server.ts',
  transport: 'cloudflare',
});
```

Then point the generated client at the Worker endpoints:

```tsx
import { FateClient } from 'react-fate';
import { createFateClient } from 'react-fate/client';

const fate = createFateClient({
  liveUrl: 'http://localhost:8787/fate-live',
  url: 'http://localhost:8787/fate',
});

export function App({ children }) {
  return <FateClient client={fate}>{children}</FateClient>;
}
```

## Semantics

`cf-fate` uses one browser `EventSource` per Fate client and multiplexes entity and connection topics over that stream. Durable Objects keep connection and topic subscription state so later requests, mutations, scheduled handlers, and queue consumers can publish to already-connected clients.

Delivery is at-most-once. Events are ordered within one topic, but events are not durably replayed after a disconnect. Use authoritative refetching or application-owned replay storage if missed events must be recovered.
