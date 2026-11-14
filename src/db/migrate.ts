import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config';
import { pool, withTransaction } from './pool';

const MIGRATION_LOCK_ID = 727001;

/** Applies each migrations/*.sql file exactly once, in filename order. Safe to run from several instances. */
export async function runMigrations(): Promise<void> {
  await withTransaction(async (tx) => {
    // Only one instance migrates at a time; the others wait, then find nothing left to do.
    await tx.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_ID]);
    await tx.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    const { rows } = await tx.query<{ name: string }>('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.name));

    const files = fs.readdirSync(config.migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      await tx.query(fs.readFileSync(path.join(config.migrationsDir, file), 'utf8'));
      await tx.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      console.log(`applied migration ${file}`);
    }
  });
}

export async function closePool(): Promise<void> {
  await pool.end();
}
