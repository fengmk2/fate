# Fate GraphQL Example

This server mirrors `example/server-prisma` with a Pothos GraphQL API instead of tRPC.
It exposes Relay `node`/`nodes`, Relay connections for Fate list fields, GraphQL mutations
for the existing Fate mutations, and GraphQL SSE subscriptions for Fate live updates.

Run it from this directory:

```sh
vp run dev:setup
vp run prisma migrate dev
vp run dev
```

The server defaults to `http://localhost:9021/graphql`.

To generate the Fate client against this server, point the Vite plugin at:

```ts
fate({
  module: '@nkzw/fate-server-graphql/src/graphql/fate.ts',
  transport: 'graphql',
});
```

The generated client keeps the same Fate roots, views, mutations, store, and cache behavior;
only the transport and server module change.
