import { type ReactNode, useMemo } from 'react';
import { FateClient } from 'react-fate';
import { createFateClient } from 'react-fate/client';

export type VoidFateClientProps = {
  children: ReactNode;
  fetch?: typeof fetch;
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  livePath?: string;
  liveRetryMs?: number;
  liveUrl?: string | URL;
  onLiveError?: (error: unknown) => void;
  origin?: string | URL;
  rpcPath?: string;
  url?: string | URL;
  userId?: null | string;
};

export function VoidFateClient({
  children,
  fetch,
  headers,
  livePath,
  liveRetryMs,
  liveUrl,
  onLiveError,
  origin,
  rpcPath,
  url,
  userId,
}: VoidFateClientProps) {
  const fate = useMemo(
    () =>
      createFateClient({
        fetch,
        headers,
        livePath,
        liveRetryMs,
        liveUrl,
        onLiveError,
        origin,
        rpcPath,
        url,
        userId,
      }),
    [fetch, headers, livePath, liveRetryMs, liveUrl, onLiveError, origin, rpcPath, url, userId],
  );

  return (
    <FateClient client={fate} key={userId ?? undefined}>
      {children}
    </FateClient>
  );
}
