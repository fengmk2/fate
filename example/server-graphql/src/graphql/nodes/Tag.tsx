import builder from '../builder.tsx';

const Tag = builder.prismaNode('Tag', {
  fields: (t) => ({
    description: t.exposeString('description'),
    name: t.exposeString('name', { nullable: false }),
  }),
  id: { field: 'id' },
});

export default Tag;
