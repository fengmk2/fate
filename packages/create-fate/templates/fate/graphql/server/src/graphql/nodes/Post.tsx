import prisma from '../../prisma/prisma.tsx';
import builder from '../builder.tsx';

const Post = builder.prismaNode('Post', {
  fields: (t) => ({
    author: t.relation('author', { nullable: false }),
    category: t.relation('category'),
    commentCount: t.int({
      nullable: false,
      resolve: ({ id }) => prisma.comment.count({ where: { postId: id } }),
    }),
    comments: t.relatedConnection('comments', {
      cursor: 'id',
      nullable: false,
      query: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    }),
    content: t.exposeString('content', { nullable: false }),
    likes: t.exposeInt('likes', { nullable: false }),
    tags: t.relatedConnection('tags', {
      cursor: 'id',
      nullable: false,
      query: {
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      },
    }),
    title: t.exposeString('title', { nullable: false }),
  }),
  id: { field: 'id' },
});

builder.queryFields((t) => ({
  posts: t.prismaConnection({
    cursor: 'id',
    resolve: (query) =>
      prisma.post.findMany({
        ...query,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    type: 'Post',
  }),
}));

export default Post;
