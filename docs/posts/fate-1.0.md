<h1 style="font-weight: 500; color: var(--vp-post-headline);">
  <picture class="fate-logo">
    <source media="(prefers-color-scheme: dark)" srcset="/fate-logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="/fate-logo.svg">
    <img alt="fate" src="/fate-logo.svg" style="display: inline; height: 40px; vertical-align: middle;">
  </picture>
  1.0
  <div style="display: none">

# fate 1.0

  </div>
</h1>

<span style="color: var(--vp-c-text-2);">

_May 14<sup>th</sup> 2026 by [<img src="https://gravatar.com/avatar/77a332a7da779ef594cb6db9970c7b2f?s=128" style="border-radius: 32px; corner-shape: squircle; width: 20px; height: 20px; display: inline; vertical-align: text-bottom;" /> Christoph Nakazawa](https://x.com/cnakazawa)_

</span>

**_fate_** 1.0 is now ready for production use. _fate_ combines view composition, normalized caching, data masking, and Async React features. The 1.0 release includes live views through Server-Sent Events (SSE), Drizzle support, garbage collection, and more.

## Why _fate_

React data fetching is still largely centered around requests. Components fetch independently, requests happen at every level of the component tree, and keeping client state consistent often requires imperative cache invalidation, defensive refetching, or detailed mutation patching logic. As coding agents write more and more of our code, reducing imperative cache management and request-centric state handling becomes more important, not less. _fate_ is designed to make those patterns unnecessary and fix it at the framework level.

_fate_ takes a different approach: Instead of caching requests, _fate_ caches normalized objects, shifts thinking to what data is required, and composes declarative view requirements into a single request at the application root. This enables precise optimistic updates, efficient live subscriptions, predictable cache behavior, and deep integration with modern Async React features through a minimal, composable API.

Check out the [initial announcement](/posts/introducing-fate#a-modern-data-client-for-react-trpc) if you'd like to learn more about why _fate_ exists!

## New Features

### Live Views & Lists

_fate_ initially shipped with static `useView` and `useListView` hooks to select and render data, but modern applications often need to update users in real time. 1.0 introduces two new hooks, `useLiveView` and `useLiveListView`, which efficiently subscribe to live backend updates through Server-Sent Events (SSE) with zero configuration. For example, to listen to changes on a `Post`, all you have to do is replace the hook:

```diff [client/PostCard.tsx]
- const post = useView(PostView, postRef);
+ const post = useLiveView(PostView, postRef);
```

On the server, you publish updates like this:

```tsx [server/post.tsx]
live.update('Post', input.id);
```

This example updates all subscribed post data for all clients. If you know the exact data that has changed, you can specify which fields changed to minimize the data sent to all subscribed clients:

```tsx [server/post.tsx]
live.update('Post', input.id, { changed: ['likes'] });
```

Similarly, you can replace `useListView` with `useLiveListView` to automatically receive updates for new or removed items in a list.

_fate_ was built with this use case in mind from the beginning, and it naturally works well because of the normalized cache. It efficiently subscribes to changes for specific objects or lists, and only updates the components where data has changed. This system uses the mutations pipeline, so adding the live features was mostly about adding support for SSE and keeping the API and setup to a minimum instead of changing the core of _fate_.

You can try out an example at [fate-void-example.void.app](https://fate-void-example.void.app/). Open two tabs, and like a post or add a comment to see the updates live.

### Drizzle & Native HTTP support

_fate_ started out with support for tRPC and Prisma. 1.0 ships with [Drizzle](https://orm.drizzle.team/) support and no longer requires tRPC through the "native" HTTP transport. This makes it easier to adopt _fate_ in codebases that don't use tRPC, and allows the community to contribute support for other protocols.

Along with this change, `@nkzw/fate/server` was expanded with generic handlers for data and connection management, which makes it easier to build new database and protocol integrations.

### Vite Plugin instead of Codegen

The initial version of _fate_ required manually running a code generator every time the server API types changed. With 1.0, there is now a Vite plugin that does this automatically:

```tsx
import { fate } from 'react-fate/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    fate({
      module: '@your-org/server/trpc/router.ts',
    }),
  ],
});
```

Codegen through the CLI remains available for CI or custom workflows.

### Cache Lifetime and Garbage Collection

Inspired by [Relay](https://relay.dev/), _fate_ now includes garbage collection for data in the client cache and list state. Mounted components retain the data they are currently using, and when the components are unmounted, _fate_ will eventually release them for garbage collection. By default, this keeps data from the last 10 released requests (usually 10 page transitions with fresh data), which makes normal back-and-forth navigation feel instant while still allowing older or unreachable data to be removed from memory.

### App Scaffolding with `create-fate`

You can now get started using [`create-fate`](https://www.npmjs.com/package/create-fate), which simplifies scaffolding of new projects. We recommend using it with [Vite+](https://viteplus.dev/):

```bash
vp create fate my-app
```

The interactive CLI allows you to choose from one of four templates. You can also use it directly:

```bash
vp create fate my-app --template drizzle # drizzle + trpc
vp create fate my-app --template http # drizzle + http
vp create fate my-app --template prisma # prisma + trpc
```

These templates let you start with the stack that best matches your preferences.

### Fixes

Besides all the features above, there are also many fixes that went into this release:

- Improved ordering of optimistic and committed list updates with respect to pagination.
- Improved request promise and lifetime handling, so completed request data is no longer retained unnecessarily.
- Added stable view refs to reduce transient ref allocation and avoid unnecessary re-renders.
- Fixed removal of invalid optimistic updates.
- Fixed list cache scoping for arguments, cursors, and nested node views.
- Improved large-list update performance.

## Stepping Into the Void

After shipping the first Async React data framework with _fate_ at the end of last year, [I was excited to also build an Async React Router](https://x.com/cnakazawa/status/1998500764281651495). [VoidZero](https://voidzero.dev) is currently building [void.cloud](https://void.cloud), which comes with a companion metaframework that includes a router. I spent the past two months working on Void, where I had the opportunity to help build a router designed specifically for Async React.

I swapped out React Router for the new Void Router, and built a new example and template that can be used to build apps for [void.cloud](https://void.cloud), making _fate_ + Void the first metaframework designed for Async React.

## Next

Async React provides primitives for building responsive, interruptible, transition-driven user interfaces, but it also fundamentally changes how React applications are architected and what they are optimized for.

_fate_ is my attempt to explore what a data framework designed for Async React from the ground up can look like, where declarative data models define application behavior and naturally enable scalable, interruptible, responsive user experiences through elegant APIs and framework primitives.

Please try out _fate_ and share your feedback. I'm excited to hear what you think and how it works for you.

_Thank you for reading._
