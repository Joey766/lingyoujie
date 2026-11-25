import { loadEnvFile } from 'node:process';
import pg from 'pg';

const [option,localEmail] = process.argv.slice(2);
const isLocal = option === '--local';
const email = (isLocal ? localEmail : option)?.trim().toLowerCase();
if (!email || (isLocal && !email.endsWith('@local.test'))) {
  throw new Error('Provide the verified email to grant administrator access.');
}
if (isLocal) loadEnvFile('.local/runtime.env');
const url = isLocal
  ? 'postgresql://lyj_owner:' + process.env.LOCAL_POSTGRES_PASSWORD + '@127.0.0.1:' + (process.env.LOCAL_DB_PORT || '55432') + '/postgres'
  : process.env.DATABASE_URL;
if (!url) throw new Error('Provide an explicit database owner connection.');
const client = new pg.Client({ connectionString:url });
await client.connect();
try {
  const result=await client.query(
    'insert into community.admins(user_id) select id from public."user" where email=$1 and "emailVerified" on conflict do nothing', [email]
  );
  console.log(result.rowCount === 1 ? 'Administrator access granted.' : 'No change. Check that the account exists and is verified.');
} finally {
  await client.end();
}
