import { DeferredTag, type Deferred, type FateThenable } from '@nkzw/fate';

export type FulfilledThenable<T> = FateThenable<T> & {
  status: 'fulfilled';
  value: T;
};

export const isDeferredValue = (value: unknown): value is Deferred<unknown> =>
  typeof value === 'object' && value !== null && DeferredTag in value;

export const isFulfilledThenable = <T>(value: PromiseLike<T>): value is FulfilledThenable<T> =>
  'status' in value && (value as { status?: unknown }).status === 'fulfilled' && 'value' in value;

export const fulfilledThenable = <T>(value: T): FulfilledThenable<T> =>
  ({
    status: 'fulfilled',
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return Promise.resolve(value).then(onfulfilled, onrejected);
    },
    value,
  }) satisfies FulfilledThenable<T>;
