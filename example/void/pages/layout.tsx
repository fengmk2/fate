import '../src/App.css';
import Stack from '@nkzw/stack';
import { useShared } from '@void/react';
import { ReactNode, Suspense, useMemo } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { FateClient } from 'react-fate';
import { createFateClient } from 'react-fate/client';
import type { SharedData } from '../src/lib/shared.ts';
import Card from '../src/ui/Card.tsx';
import Error from '../src/ui/Error.tsx';
import Header from '../src/ui/Header.tsx';
import Section from '../src/ui/Section.tsx';

const Thinking = () => (
  <Section>
    <Stack center className="animate-pulse text-gray-500 italic" verticalPadding={48}>
      Thinking...
    </Stack>
  </Section>
);

let serverFateFetchPromise: Promise<(request: Request) => Promise<Response>> | null = null;

const getServerFateFetch = async () => {
  serverFateFetchPromise ??= Promise.all([
    import('@nkzw/fate/server'),
    import('../src/fate/server.ts'),
  ]).then(([{ createFateFetchHandler }, { fateServer }]) => createFateFetchHandler(fateServer));

  return serverFateFetchPromise;
};

export default function Layout({ children }: { children: ReactNode }) {
  const shared = useShared<SharedData>();
  const userId = shared.auth.user?.id;
  const origin = typeof window === 'undefined' ? shared.origin : window.location.origin;

  const fate = useMemo(
    () =>
      createFateClient({
        fetch: import.meta.env.SSR
          ? async (input, init) => (await getServerFateFetch())(new Request(input, init))
          : (input, init) =>
              fetch(input, {
                ...init,
                credentials: userId ? 'include' : init?.credentials,
              }),
        liveUrl: new URL('/fate/live', origin),
        url: new URL('/fate/rpc', origin),
      }),
    [origin, userId],
  );

  return (
    <FateClient client={fate} key={userId}>
      <div className="min-h-screen bg-background text-foreground">
        <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.08),transparent_35%),radial-gradient(circle_at_80%_0,rgba(99,102,241,0.08),transparent_28%)]">
          <Header />
          <ErrorBoundary
            fallbackRender={({ error }) => (
              <Section>
                <Card>
                  <Error error={error} />
                </Card>
              </Section>
            )}
          >
            <Suspense fallback={<Thinking />}>{children}</Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </FateClient>
  );
}
