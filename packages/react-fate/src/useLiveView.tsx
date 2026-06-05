import {
  Deferred,
  DeferredSnapshot,
  View,
  ViewData,
  ViewEntity,
  ViewEntityName,
  ViewRef,
  ViewSelection,
} from '@nkzw/fate';
import { use, useEffect, useEffectEvent } from 'react';
import { useFateClient } from './context.tsx';
import { isDeferredValue } from './deferred.ts';
import { useView } from './useView.tsx';

type ViewEntityWithTypename<V extends View<any, any>> = ViewEntity<V> & {
  __typename: ViewEntityName<V>;
};

/**
 * Resolves a reference against a view and subscribes to live server updates for
 * that selection.
 *
 * @example
 * const post = useLiveView(PostView, postRef);
 */
export function useLiveView<V extends View<any, any>, R extends ViewRef<ViewEntityName<V>> | null>(
  view: V,
  ref: R,
): R extends null ? null : ViewData<ViewEntityWithTypename<V>, ViewSelection<V>>;
export function useLiveView<
  V extends View<any, any>,
  R extends Deferred<ViewRef<ViewEntityName<V>>> | null,
>(view: V, ref: R): R extends null ? null : ViewData<ViewEntityWithTypename<V>, ViewSelection<V>>;
export function useLiveView<V extends View<any, any>>(
  view: V,
  ref: Deferred<ViewRef<ViewEntityName<V>>> | ViewRef<ViewEntityName<V>> | null,
): ViewData<ViewEntityWithTypename<V>, ViewSelection<V>> | null {
  const client = useFateClient();
  const resolvedRef = isDeferredValue(ref)
    ? (use(client.readDeferred(ref)) as DeferredSnapshot<ViewRef<ViewEntityName<V>> | null>).data
    : ref;
  const liveRef = resolvedRef ? client.ref(resolvedRef.__typename, resolvedRef.id, view) : null;
  const liveId = liveRef?.id;
  const liveType = liveRef?.__typename;

  const subscribeLiveView = useEffectEvent(() => {
    if (liveRef === null) {
      return;
    }

    client.assertLiveViewSupport();
    return client.subscribeLiveView(view, liveRef);
  });

  useEffect(() => subscribeLiveView(), [client, view, liveId, liveType]);

  return useView(
    view,
    ref as Deferred<ViewRef<ViewEntityName<V>>> | ViewRef<ViewEntityName<V>> | null,
  );
}
