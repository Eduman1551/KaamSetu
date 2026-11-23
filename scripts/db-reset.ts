// pnpm db:reset --yes
// Empties EVERY table in the database from DATABASE_URL (the schema is kept).
// Refuses to run without --yes.
import { sql } from 'drizzle-orm';
import { closeDb, db } from '../lib/server/db';

async function main() {
  if (!process.argv.includes('--yes')) {
    console.error('Refusing to reset: this deletes ALL rows in ALL tables.\nRun again with: pnpm db:reset --yes');
    process.exit(1);
  }
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? '').hostname;
    } catch {
      return '(unknown host)';
    }
  })();
  const res = await db.execute(sql`select tablename from pg_tables where schemaname = 'public' order by tablename`);
  const tables = res.rows.map((r) => String((r as { tablename: string }).tablename));
  if (tables.length === 0) {
    console.log('No tables found. Run pnpm db:push first.');
    return closeDb();
  }
  const counts: string[] = [];
  for (const t of tables) {
    const c = await db.execute(sql.raw(`select count(*)::int as n from "${t}"`));
    counts.push(`${t}: ${(c.rows[0] as { n: number }).n}`);
  }
  await db.execute(sql.raw(`TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`));
  console.log(`Reset database on ${host.replace(/^[^.]+/, '***')}: truncated ${tables.length} tables (schema kept).`);
  console.log(`Rows removed per table: ${counts.join(', ')}`);
  await closeDb();
}

main().catch(async (e) => {
  console.error('Reset failed:', e instanceof Error ? e.message : e);
  await closeDb();
  process.exit(1);
});
