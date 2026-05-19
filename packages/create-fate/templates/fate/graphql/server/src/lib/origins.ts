import env from './env.tsx';

const localDevOriginPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;

const isDevelopment = process.env.NODE_ENV === 'development' || process.env.DEV;

export const clientOrigin = env('CLIENT_DOMAIN');

export const trustedOrigins = [
  clientOrigin,
  ...(isDevelopment ? ['http://localhost:*', 'http://127.0.0.1:*'] : []),
];

export const resolveCorsOrigin = (origin: string) => {
  if (origin === clientOrigin || (isDevelopment && localDevOriginPattern.test(origin))) {
    return origin;
  }
};
