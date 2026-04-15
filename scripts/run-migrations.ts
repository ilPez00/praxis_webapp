/**
 * Migrations runner.
 *
 * Reads .sql files from /migrations in alphabetical order and applies each one
 * that hasn't been recorded in a `schema_migrations` tracking table. Each file
 * runs inside a transaction; on error the transaction rolls back and the
 * runner exits non-zero.
 *
 * Usage:
 *   npm run migrate            # apply all pending migrations
 *   npm run migrate:status     # list applied / pending, apply nothing
 *
 * Requires DATABASE_URL env var (Supabase → Settings → Database → Connection
 * String, "Transaction" pooler or direct). Never pass the service-role JWT here —
 * this is a plain Postgres connection string.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');
const statusOnly = process.argv.includes('--status');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[migrate] FATAL: DATABASE_URL is not set.');
    console.error('          Get it from Supabase dashboard → Settings → Database → Connection string.');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();
  console.log('[migrate] connected');

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checksum TEXT
    );
  `);

  const appliedRes = await client.query('SELECT filename FROM schema_migrations ORDER BY filename');
  const applied = new Set<string>(appliedRes.rows.map(r => r.filename));

  const allFiles = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const pending = allFiles.filter(f => !applied.has(f));

  if (statusOnly) {
    console.log(`\n[migrate] applied: ${applied.size}`);
    Array.from(applied).slice(-10).forEach(f => console.log(`  ✓ ${f}`));
    if (applied.size > 10) console.log(`  … (${applied.size - 10} earlier)`);
    console.log(`\n[migrate] pending: ${pending.length}`);
    pending.forEach(f => console.log(`  · ${f}`));
    await client.end();
    return;
  }

  if (pending.length === 0) {
    console.log('[migrate] nothing to do — database is up to date.');
    await client.end();
    return;
  }

  console.log(`[migrate] applying ${pending.length} pending migration(s)\n`);

  for (const file of pending) {
    const fullPath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(fullPath, 'utf8');
    process.stdout.write(`  · ${file} … `);

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log('✓');
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      console.log('✗');
      console.error(`\n[migrate] FAILED on ${file}:`);
      console.error(err.message || err);
      await client.end();
      process.exit(1);
    }
  }

  console.log(`\n[migrate] done — ${pending.length} migration(s) applied.`);
  await client.end();
}

main().catch(err => {
  console.error('[migrate] unexpected error:', err);
  process.exit(1);
});
