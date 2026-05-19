import { beforeEach, expect, test, vi } from 'vite-plus/test';
import { createGraphQLTransport } from '../graphqlTransport.ts';

const graphQLSSE = vi.hoisted(() => ({
  createClient: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock('graphql-sse', () => ({
  createClient: graphQLSSE.createClient,
}));

const jsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json' },
  });

const getRequestBody = (fetch: ReturnType<typeof vi.fn>) => {
  const init = fetch.mock.calls[0]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body ?? '{}')) as { query: string };
};

beforeEach(() => {
  graphQLSSE.createClient.mockReset();
  graphQLSSE.subscribe.mockReset();
  graphQLSSE.createClient.mockReturnValue({ subscribe: graphQLSSE.subscribe });
  graphQLSSE.subscribe.mockReturnValue(vi.fn());
});

test('fetches nodes through the Relay nodes field and decodes global ids', async () => {
  const fetch = vi.fn(async () =>
    jsonResponse({
      data: {
        f1: [
          {
            __typename: 'Post',
            author: { __typename: 'User', id: 'User-u1', name: 'Ada' },
            id: 'Post-p1',
            title: 'One',
          },
        ],
      },
    }),
  );
  const transport = createGraphQLTransport({
    fetch,
    types: [
      {
        fields: {
          author: { type: 'User' },
        },
        type: 'Post',
      },
      { type: 'User' },
    ],
    url: '/graphql',
  });

  await expect(
    transport.fetchById('Post', ['p1'], new Set(['id', 'title', 'author.id', 'author.name'])),
  ).resolves.toEqual([
    {
      __typename: 'Post',
      author: { __typename: 'User', id: 'u1', name: 'Ada' },
      id: 'p1',
      title: 'One',
    },
  ]);

  expect(fetch).toHaveBeenCalledTimes(1);
  const body = getRequestBody(fetch);
  expect(body.query).toContain('nodes(ids: ["Post-p1"])');
  expect(body.query).toContain('... on Post');
  expect(body.query).toContain('author { __typename id name }');
});

test('maps Relay connections to Fate list payloads', async () => {
  const fetch = vi.fn(async () =>
    jsonResponse({
      data: {
        f1: {
          edges: [
            {
              cursor: 'cursor-1',
              node: { __typename: 'Post', id: 'Post-p1', title: 'One' },
            },
          ],
          pageInfo: {
            endCursor: 'cursor-1',
            hasNextPage: true,
            hasPreviousPage: false,
            startCursor: 'cursor-1',
          },
        },
      },
    }),
  );
  const transport = createGraphQLTransport({
    fetch,
    roots: {
      posts: { type: 'Post' },
    },
    types: [{ type: 'Post' }],
    url: '/graphql',
  });

  await expect(
    transport.fetchList?.('posts', new Set(['id', 'title']), { first: 1 }),
  ).resolves.toEqual({
    items: [
      {
        cursor: 'cursor-1',
        node: { __typename: 'Post', id: 'p1', title: 'One' },
      },
    ],
    pagination: {
      hasNext: true,
      hasPrevious: false,
      nextCursor: 'cursor-1',
      previousCursor: 'cursor-1',
    },
  });

  const body = getRequestBody(fetch);
  expect(body.query).toContain('posts(first: 1)');
  expect(body.query).toContain('edges { cursor node');
  expect(body.query).toContain('pageInfo { endCursor hasNextPage hasPreviousPage startCursor }');
});

test('keeps nested selection args off root GraphQL fields', async () => {
  const fetch = vi.fn(async () =>
    jsonResponse({
      data: {
        f1: {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
      },
    }),
  );
  const transport = createGraphQLTransport({
    fetch,
    roots: {
      posts: { type: 'Post' },
    },
    types: [
      {
        fields: {
          comments: { listOf: 'Comment' },
        },
        type: 'Post',
      },
      { type: 'Comment' },
    ],
    url: '/graphql',
  });

  await transport.fetchList?.('posts', new Set(['id', 'comments.id']), {
    comments: { first: 3 },
    first: 10,
  });

  const body = getRequestBody(fetch);
  expect(body.query).toContain('posts(first: 10)');
  expect(body.query).not.toContain('posts(first: 10, comments:');
  expect(body.query).toContain('comments(first: 3)');
});

test('omits empty GraphQL argument lists after filtering undefined values', async () => {
  const fetch = vi.fn(async () =>
    jsonResponse({
      data: {
        f1: {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
      },
    }),
  );
  const transport = createGraphQLTransport({
    fetch,
    roots: {
      posts: { type: 'Post' },
    },
    types: [
      {
        fields: {
          comments: { listOf: 'Comment' },
        },
        type: 'Post',
      },
      { type: 'Comment' },
    ],
    url: '/graphql',
  });

  await transport.fetchList?.('posts', new Set(['id', 'comments.id']), {
    comments: { first: undefined },
    first: undefined,
  });

  const body = getRequestBody(fetch);
  expect(body.query).toContain('posts {');
  expect(body.query).toContain('comments {');
  expect(body.query).not.toContain('posts()');
  expect(body.query).not.toContain('comments()');
});

test('rejects only operations matching aliased GraphQL errors', async () => {
  const fetch = vi.fn(async () =>
    jsonResponse({
      data: {
        f1: { __typename: 'User', id: 'User-u1', name: 'Ada' },
        f2: null,
      },
      errors: [{ message: 'Viewer failed', path: ['f2'] }],
    }),
  );
  const transport = createGraphQLTransport({
    fetch,
    roots: {
      brokenViewer: { field: 'viewer', type: 'User' },
      viewer: { type: 'User' },
    },
    types: [{ type: 'User' }],
    url: '/graphql',
  });

  const viewer = transport.fetchQuery!('viewer', new Set(['id', 'name']));
  const brokenViewer = transport.fetchQuery!('brokenViewer', new Set(['id', 'name']));

  await expect(viewer).resolves.toEqual({ __typename: 'User', id: 'u1', name: 'Ada' });
  await expect(brokenViewer).rejects.toThrow('Viewer failed');

  expect(fetch).toHaveBeenCalledTimes(1);
});

test('multiplexes live GraphQL subscriptions over one SSE client', async () => {
  const sinks: Array<{
    next(result: { data?: Record<string, unknown> }): void;
  }> = [];
  const unsubscribeNode = vi.fn();
  const unsubscribeConnection = vi.fn();
  graphQLSSE.subscribe
    .mockImplementationOnce((_request, sink) => {
      sinks.push(sink);
      return unsubscribeNode;
    })
    .mockImplementationOnce((_request, sink) => {
      sinks.push(sink);
      return unsubscribeConnection;
    });

  const transport = createGraphQLTransport({
    types: [{ type: 'Post' }],
    url: 'http://local/graphql',
  });
  const onData = vi.fn();
  const onEvent = vi.fn();
  const unsubscribeNodeResult = transport.subscribeById?.(
    'Post',
    'p1',
    new Set(['id', 'title']),
    undefined,
    {
      onData,
    },
  );
  const unsubscribeConnectionResult = transport.subscribeConnection?.(
    'posts',
    'Post',
    undefined,
    new Set(['id', 'title']),
    undefined,
    {
      onEvent,
    },
  );

  await vi.waitFor(() => expect(graphQLSSE.subscribe).toHaveBeenCalledTimes(2));

  expect(graphQLSSE.createClient).toHaveBeenCalledTimes(1);
  expect(graphQLSSE.createClient).toHaveBeenCalledWith(
    expect.objectContaining({
      credentials: 'include',
      lazy: true,
      singleConnection: true,
      url: 'http://local/graphql/stream',
    }),
  );
  expect(graphQLSSE.subscribe.mock.calls[0]?.[0].query).toContain('subscription FateLiveNode');
  expect(graphQLSSE.subscribe.mock.calls[1]?.[0].query).toContain(
    'subscription FateLiveConnection',
  );

  sinks[0]?.next({
    data: {
      fateLiveNode: {
        data: { __typename: 'Post', id: 'Post-p1', title: 'Updated' },
        select: ['title'],
      },
    },
  });

  expect(onData).toHaveBeenCalledWith({ __typename: 'Post', id: 'p1', title: 'Updated' }, [
    'title',
  ]);

  sinks[1]?.next({
    data: {
      fateLiveConnection: {
        cursor: 'cursor-2',
        node: { __typename: 'Post', id: 'Post-p2', title: 'Second' },
        nodeType: 'Post',
        type: 'appendEdge',
      },
    },
  });

  expect(onEvent).toHaveBeenCalledWith({
    edge: {
      cursor: 'cursor-2',
      node: { __typename: 'Post', id: 'p2', title: 'Second' },
    },
    nodeType: 'Post',
    targetCursor: undefined,
    type: 'appendEdge',
  });

  unsubscribeNodeResult?.();
  unsubscribeConnectionResult?.();
  expect(unsubscribeNode).toHaveBeenCalledTimes(1);
  expect(unsubscribeConnection).toHaveBeenCalledTimes(1);
});
