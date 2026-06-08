# Deferred Views

Use `defer` when a field should not block the parent view. The parent view receives a deferred handle immediately after the eager fields are available, and the component that reads that handle with `useView`, `useListView`, or `useLiveListView` decides which `Suspense` boundary handles the loading state.

```tsx
import { Suspense } from 'react';
import { defer, useListView, useView, view, Deferred, ViewRef } from 'react-fate';

const CommentView = view<Comment>()({
  content: true,
  id: true,
});

const CommentConnectionView = {
  args: { first: 3 },
  items: { node: CommentView },
};

const PostView = view<Post>()({
  comments: defer(CommentConnectionView),
  content: true,
  id: true,
  title: true,
});

function PostCard({ post: postRef }: { post: ViewRef<'Post'> }) {
  const post = useView(PostView, postRef);

  return (
    <article>
      <h2>{post.title}</h2>
      <p>{post.content}</p>
      <Suspense fallback={<CommentsSkeleton />}>
        <PostComments comments={post.comments} />
      </Suspense>
    </article>
  );
}

function PostComments({
  comments,
}: {
  comments: Deferred<{ items: ReadonlyArray<{ node: ViewRef<'Comment'> }> }>;
}) {
  const [items, loadNext] = useListView(CommentConnectionView, comments);

  return (
    <section>
      {items.map(({ node }) => (
        <CommentCard comment={node} key={node.id} />
      ))}
      {loadNext ? <button onClick={loadNext}>Load more</button> : null}
    </section>
  );
}
```

Deferred fields are not optional data. They are explicit handles that existing view APIs can read. If the deferred selection is missing from the normalized cache, fate fetches only that missing selection and suspends the component that tried to resolve it.

This keeps parent components simple: eager fields like `title` and `content` are available when `useView(PostView, postRef)` returns, while slower or secondary fields such as `comments` can load under their own boundary.

GraphQL transports use the same client semantics today. The deferred field is omitted from the eager request and fetched when the deferred handle is resolved. GraphQL `@defer` is the natural transport representation for this feature, but consuming incremental multipart patches requires additional transport support before fate can safely normalize streamed patches from a single GraphQL response.
