// Drizzle client over Neon's serverless Pool (WebSockets), stored on globalThis
// so dev hot reloads don't open new pools.
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema';

neonConfig.webSocketConstructor = ws;

type DB = NeonDatabase<typeof schema>;
const g = globalThis as unknown as { __ksDb?: DB; __ksPool?: Pool };

function create(): DB {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing in .env.local.');
  g.__ksPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
  return drizzle(g.__ksPool, { schema });
}

export const db: DB = g.__ksDb ?? (g.__ksDb = create());
export { schema };

/** Close the pool (scripts only). */
export async function closeDb() {
  await g.__ksPool?.end();
}
