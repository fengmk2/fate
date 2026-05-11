import { defineVoidFateLiveRoute } from 'void-fate/server';
import { fateLive, fateServer } from '../src/fate/server.ts';

export const { GET, POST } = defineVoidFateLiveRoute(fateServer, fateLive);
