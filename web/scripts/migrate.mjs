import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

export async function migrate(url) {
  if (!url) throw new Error('DATABASE_URL is required.');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("select pg_advisory_lock(78096831)");
    await client.query("create table if not exists public.lyj_migrations (name text primary key, applied_at timestamptz not null default now())");
    const dir = new URL('../migrations/', import.meta.url);
    const files = (await readdir(dir)).filter(name => /^\d+_.*\.sql$/.test(name)).sort();
    for (const name of files) {
      const result = await client.query('select 1 from public.lyj_migrations where name=$1', [name]);
      if (result.rowCount) continue;
      await client.query('begin');
      try {
        await client.query(await readFile(new URL(name, dir), 'utf8'));
        await client.query('insert into public.lyj_migrations(name) values ($1)', [name]);
        await client.query('commit');
        console.log('Applied', name);
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await migrate(process.env.DATABASE_URL);
}
