// Two Drizzle clients for Neon (works on the Vercel Node runtime and locally):
//  - `db`:   neon-http, one HTTP request per query. Stateless and ideal for serverless.
//  - `dbTx`: Pool over WebSockets, used ONLY where we need transactions or binary
//            (bytea) values: signup, saving an analysis + screenshots, storing a test,
//            submitting a test, and scripts.
// Use the Neon *pooled* connection string (host contains "-pooler") in DATABASE_URL.
import { neon, neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle as drizzleHttp, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePool, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema';

neonConfig.webSocketConstructor = ws;

function url() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing.');
  return process.env.DATABASE_URL;
}

// Caching the clients per server instance is only an optimisation (connection reuse);
// nothing the app needs is stored here.
const g = globalThis as unknown as { __ksHttp?: NeonHttpDatabase<typeof schema>; __ksPoolDb?: NeonDatabase<typeof schema>; __ksPool?: Pool };

export const db: NeonHttpDatabase<typeof schema> = g.__ksHttp ?? (g.__ksHttp = drizzleHttp(neon(url()), { schema }));

/** Pool-backed client for transactions / bytea. Created lazily. */
export function dbTx(): NeonDatabase<typeof schema> {
  if (!g.__ksPoolDb) {
    g.__ksPool = new Pool({ connectionString: url(), max: 5, idleTimeoutMillis: 10_000 });
    g.__ksPoolDb = drizzlePool(g.__ksPool, { schema });
  }
  return g.__ksPoolDb;
}

export { schema };

/** Close the pool (scripts only). */
export async function closeDb() {
  await g.__ksPool?.end();
  g.__ksPool = undefined;
  g.__ksPoolDb = undefined;
}
