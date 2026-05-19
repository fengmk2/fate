import { auth } from '../lib/auth.tsx';
import prisma from '../prisma/prisma.tsx';
import { toSessionUser, type SessionUser } from '../user/SessionUser.tsx';

type CreateContextOptions = {
  headers?: Headers;
};

export const createContext = async (options?: CreateContextOptions) => {
  const session = options?.headers ? await auth.api.getSession({ headers: options.headers }) : null;

  return {
    headers: options?.headers ?? new Headers(),
    prisma,
    sessionUser: session?.user ? toSessionUser(session.user) : null,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
export type AppContext = Context & {
  sessionUser: SessionUser | null;
};
