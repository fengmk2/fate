import { defineCloudflareFateLiveStream } from 'cf-fate/server';

export const fateStream = defineCloudflareFateLiveStream({
  allowAnonymousControl: true,
  binding: 'FATE_LIVE',
  id: 'fate',
});
