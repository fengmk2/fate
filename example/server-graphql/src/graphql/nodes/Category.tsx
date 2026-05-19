import prisma from '../../prisma/prisma.tsx';
import builder from '../builder.tsx';

const Category = builder.prismaNode('Category', {
  fields: (t) => ({
    description: t.exposeString('description'),
    name: t.exposeString('name', { nullable: false }),
    postCount: t.int({
      nullable: false,
      resolve: ({ id }) => prisma.post.count({ where: { categoryId: id } }),
    }),
    posts: t.relatedConnection('posts', {
      cursor: 'id',
      nullable: false,
      query: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      },
    }),
  }),
  id: { field: 'id' },
});

builder.queryFields((t) => ({
  categories: t.prismaConnection({
    cursor: 'id',
    resolve: (query) =>
      prisma.category.findMany({
        ...query,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    type: 'Category',
  }),
}));

export default Category;
