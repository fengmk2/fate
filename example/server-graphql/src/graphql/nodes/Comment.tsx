import prisma from '../../prisma/prisma.tsx';
import builder from '../builder.tsx';

const isDevelopment = process.env.NODE_ENV === 'development' || Boolean(process.env.DEV);

const Comment = builder.prismaNode('Comment', {
  fields: (t) => ({
    author: t.relation('author'),
    content: t.exposeString('content', { nullable: false }),
    post: t.relation('post', { nullable: false }),
  }),
  id: { field: 'id' },
});

builder.queryFields((t) => ({
  commentSearch: t.prismaConnection({
    args: {
      query: t.arg.string({ required: true }),
    },
    cursor: 'id',
    resolve: async (query, _, { query: searchQuery }) => {
      const value = searchQuery.trim();
      if (!value.length) {
        return [];
      }

      if (isDevelopment && value.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      return prisma.comment.findMany({
        ...query,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        where: {
          content: {
            contains: value,
            mode: 'insensitive',
          },
        },
      });
    },
    type: 'Comment',
  }),
}));

export default Comment;
