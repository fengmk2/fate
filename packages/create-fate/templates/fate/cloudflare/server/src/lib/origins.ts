const localDevOriginPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;

export const clientOrigin = 'http://localhost:6001';

export const resolveCorsOrigin = (origin: string | null) => {
  if (!origin) {
    return null;
  }

  if (origin === clientOrigin || localDevOriginPattern.test(origin)) {
    return origin;
  }

  return null;
};

export const trustedOrigins = [clientOrigin, 'http://localhost:*', 'http://127.0.0.1:*'];
