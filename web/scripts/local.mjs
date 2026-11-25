import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';
import { tmpdir } from 'node:os';
import EmbeddedPostgres from 'embedded-postgres';
import { migrate } from './migrate.mjs';
import { publishEditorial } from './publish-editorial.mjs';
import { windowsPostgres } from './windows-pg.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.LOCAL_WEB_PORT || 3000);
const dbPort = Number(process.env.LOCAL_DB_PORT || 55432);
const projectKey = createHash('sha256').update(process.cwd()).digest('hex').slice(0,12);
// Win32 initdb cannot initialize a UTF-8 cluster in every Windows code page.
const dbDir = resolve(process.env.LOCAL_PG_DIR || (process.platform === 'win32'
  ? resolve(tmpdir(), 'lyj-pg-local-' + projectKey) : '.local/postgres'));
const envFile = resolve('.local/runtime.env');
mkdirSync(dirname(envFile), { recursive: true });
if (!existsSync(envFile)) {
  const password = randomBytes(24).toString('hex');
  writeFileSync(envFile, [
    'LOCAL_POSTGRES_PASSWORD=' + password,
    'BETTER_AUTH_SECRET=' + randomBytes(32).toString('hex'),
    '',
  ].join('\n'), { flag: 'wx', mode: 0o600 });
}
loadEnvFile(envFile);
Object.assign(process.env, {
  DATABASE_URL: 'postgresql://lyj_owner:' + process.env.LOCAL_POSTGRES_PASSWORD + '@127.0.0.1:' + dbPort + '/postgres',
  AUTH_DATABASE_URL: '',
  COMMUNITY_DATABASE_URL: '',
  APP_URL: 'http://127.0.0.1:' + port,
  REGISTRATION_MODE: 'local',
  TRUSTED_IP_HEADER: '',
  MAIL_MODE: 'local',
  NEXT_TELEMETRY_DISABLED: '1'
});
mkdirSync('.local', { recursive: true });
const db = process.platform === 'win32' ? await windowsPostgres({
  directory: dbDir, port: dbPort, password: process.env.LOCAL_POSTGRES_PASSWORD,
}) : new EmbeddedPostgres({
  databaseDir: dbDir, user: 'lyj_owner', password: process.env.LOCAL_POSTGRES_PASSWORD, port: dbPort,
  persistent: true, postgresFlags: ['-h', '127.0.0.1'], initdbFlags: ['--encoding=UTF8','--locale=C','--auth=scram-sha-256'],
  onLog: () => {}, onError: error => console.error(String(error).trim()),
});
let ready = false;
let child;
let stopping = false;
const testing = process.argv.includes('--test');
function execute(script, args) {
  return new Promise((resolve, reject) => {
    const program = spawn(process.execPath, [script, ...args], { stdio: 'inherit' });
    program.once('error', reject);
    program.once('exit', code => resolve(code ?? 1));
  });
}
async function waitForWeb() {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (child.exitCode !== null) throw new Error('Web server exited before startup');
    try {
      const response = await fetch(process.env.APP_URL, {signal:AbortSignal.timeout(5000)});
      if (response.ok) return;
    } catch { /* Startup and initial compilation may take a few seconds. */ }
    await new Promise(resolve => setTimeout(resolve,1000));
  }
  throw new Error('The local web server did not become ready');
}
async function stop() {
  if (stopping) return;
  stopping = true;
  if (child && child.exitCode === null) child.kill();
  if (ready) await db.stop();
}
process.once('SIGINT', () => { stop().catch(console.error); });
process.once('SIGTERM', () => { stop().catch(console.error); });
try {
  if (!existsSync(resolve(dbDir,'PG_VERSION'))) await db.initialise();
  await db.start(); ready = true;
  await migrate(process.env.DATABASE_URL);
  if (process.argv.includes('--publish-editorial')) await publishEditorial(process.env.DATABASE_URL);
  if (process.argv.includes('--db-only')) {
    console.log('PostgreSQL ready on localhost port ' + dbPort);
    await new Promise(resolve => {
      process.once('SIGINT',resolve);
      process.once('SIGTERM',resolve);
    });
  } else {
    if (testing && await execute('--test',['tests/permissions.test.mjs'])) throw new Error('Database tests failed');
    child = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), process.argv.includes('--built') ? 'start' : 'dev', '--hostname', '127.0.0.1', '--port', String(port)], { stdio: 'inherit' });
    const exited = new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code)=>resolve(code??0));});
    const result = testing ? await (async () => {
      await waitForWeb();
      return execute(resolve('node_modules/@playwright/test/cli.js'),['test']);
    })() : await exited;
    if (result) process.exitCode = result;
  }
} finally {
  await stop();
}
