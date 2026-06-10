import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, username } from 'better-auth/plugins';
import schema from './schema.ts';

const seedAuthURL = 'http://localhost:6001';

export const createSeedAuth = (database: Parameters<typeof drizzleAdapter>[0]) => {
  const defaults: BetterAuthOptions = {
    basePath: '/api/auth',
    baseURL: seedAuthURL,
    database: drizzleAdapter(database, {
      provider: 'sqlite',
      schema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    secret: process.env.BETTER_AUTH_SECRET ?? 'fate-void-example-development-secret',
    trustedOrigins: [seedAuthURL],
  };

  return betterAuth({
    ...defaults,
    emailAndPassword: {
      ...defaults.emailAndPassword,
      autoSignIn: true,
      enabled: true,
      maxPasswordLength: 128,
      minPasswordLength: 8,
    },
    plugins: [admin(), username()],
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 15 * 24 * 60 * 60,
      },
    },
    telemetry: { enabled: false },
  });
};
