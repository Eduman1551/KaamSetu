import { defineConfig } from 'drizzle-kit';

// drizzle-kit doesn't read .env.local on its own.
try {
  process.loadEnvFile('.env.local');
} catch {
  /* fall back to the real environment */
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/server/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
