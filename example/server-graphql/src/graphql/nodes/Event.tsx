import prisma from '../../prisma/prisma.tsx';
import builder, { DateTimeScalar } from '../builder.tsx';

const EventAttendee = builder.prismaNode('EventAttendee', {
  fields: (t) => ({
    notes: t.exposeString('notes'),
    status: t.string({
      nullable: false,
      resolve: ({ status }) => status,
    }),
    user: t.relation('user', { nullable: false }),
  }),
  id: { field: 'id' },
});

const Event = builder.prismaNode('Event', {
  fields: (t) => ({
    attendees: t.relatedConnection('attendees', {
      cursor: 'id',
      nullable: false,
      query: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    }),
    attendingCount: t.int({
      nullable: false,
      resolve: ({ id }) => prisma.eventAttendee.count({ where: { eventId: id, status: 'GOING' } }),
    }),
    capacity: t.exposeInt('capacity', { nullable: false }),
    description: t.exposeString('description', { nullable: false }),
    endAt: t.field({
      nullable: false,
      resolve: ({ endAt }) => endAt,
      type: DateTimeScalar,
    }),
    host: t.relation('host', { nullable: false }),
    livestreamUrl: t.exposeString('livestreamUrl'),
    location: t.exposeString('location', { nullable: false }),
    name: t.exposeString('name', { nullable: false }),
    startAt: t.field({
      nullable: false,
      resolve: ({ startAt }) => startAt,
      type: DateTimeScalar,
    }),
    topics: t.field({
      nullable: false,
      resolve: ({ topics }) => topics,
      type: ['String'],
    }),
    type: t.string({
      nullable: false,
      resolve: ({ type }) => type,
    }),
  }),
  id: { field: 'id' },
});

builder.queryFields((t) => ({
  events: t.prismaConnection({
    cursor: 'id',
    resolve: (query) =>
      prisma.event.findMany({
        ...query,
        orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
      }),
    type: 'Event',
  }),
}));

export { EventAttendee };
export default Event;
