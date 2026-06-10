import { createAuth } from '../lib/auth.ts';
import { toSessionUser } from '../user/SessionUser.tsx';

export const createContext = async ({ request, secret }: { request: Request; secret?: string }) => {
  const session = await createAuth(new URL(request.url).origin, secret).api.getSession({
    headers: request.headers,
  });

  return {
    headers: request.headers,
    sessionUser: session?.user ? toSessionUser(session.user) : null,
  };
};

export type AppContext = Awaited<ReturnType<typeof createContext>>;
