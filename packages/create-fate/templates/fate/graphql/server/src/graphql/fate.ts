import { graphqlMutation } from '@nkzw/fate';
import { createLiveEventBus } from '@nkzw/fate/server';
import { createPrismaSourceAdapter } from '@nkzw/fate/server/prisma';
import type { AppContext } from './context.tsx';
import {
  categoryDataView,
  commentDataView,
  eventAttendeeDataView,
  eventDataView,
  postDataView,
  Root,
  tagDataView,
  userDataView,
  type Comment,
  type Post,
  type User,
} from './views.ts';

type FateMutationInput<Input extends Record<string, unknown>> = Input & {
  args?: Record<string, unknown>;
};

export type PostAddInput = FateMutationInput<{
  content: string;
  title: string;
}>;
export type PostLikeInput = FateMutationInput<{
  error?: 'boundary' | 'callSite';
  id: string;
  slow?: boolean;
}>;
export type PostUnlikeInput = FateMutationInput<{
  id: string;
}>;
export type CommentAddInput = FateMutationInput<{
  content: string;
  postId: string;
}>;
export type CommentDeleteInput = FateMutationInput<{
  id: string;
}>;
export type UserUpdateInput = FateMutationInput<{
  name: string;
}>;

export const live = createLiveEventBus();

export const fate = createPrismaSourceAdapter<AppContext>({
  views: Root,
});

export const viewsByType = {
  Category: categoryDataView,
  Comment: commentDataView,
  Event: eventDataView,
  EventAttendee: eventAttendeeDataView,
  Post: postDataView,
  Tag: tagDataView,
  User: userDataView,
} as const;

export const fateGraphQL = {
  mutations: {
    'comment.add': graphqlMutation<Comment, CommentAddInput, Comment>('Comment', {
      field: 'commentAdd',
    }),
    'comment.delete': graphqlMutation<Comment, CommentDeleteInput, Comment>('Comment', {
      field: 'commentDelete',
    }),
    'post.add': graphqlMutation<Post, PostAddInput, Post>('Post', {
      field: 'postAdd',
    }),
    'post.like': graphqlMutation<Post, PostLikeInput, Post>('Post', {
      field: 'postLike',
    }),
    'post.unlike': graphqlMutation<Post, PostUnlikeInput, Post>('Post', {
      field: 'postUnlike',
    }),
    'user.update': graphqlMutation<User, UserUpdateInput, User>('User', {
      field: 'userUpdate',
    }),
  },
} as const;

export * from './views.ts';
