import { execFile } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

const run = promisify(execFile);

export async function windowsPostgres({ directory, password, port }) {
  const pkg = resolve('node_modules/@embedded-postgres/windows-x64');
  const { version } = JSON.parse(await readFile(resolve(pkg,'package.json'),'utf8'));
  const binary = resolve(tmpdir(),'lyj-pg-bin-' + version);
  await mkdir(dirname(directory), { recursive: true });
  if (!existsSync(resolve(binary,'bin','postgres.exe'))) {
    await cp(resolve(pkg,'native'),binary,{recursive:true});
  }
  const call = (exe, args) => run(resolve(binary,'bin',exe+'.exe'), args, {
    cwd:dirname(directory), windowsHide:true, timeout:45_000,
    env:{...process.env,LANG:'C',LC_ALL:'C',LC_MESSAGES:'C',PGCLIENTENCODING:'UTF8'},
  });
  return {
    async initialise() {
      const pw = directory+'.pw';
      await writeFile(pw,password+'\n',{flag:'wx',mode:0o600});
      try {
        await call('initdb',['-D',directory,'-U','lyj_owner','--pwfile='+pw,'--encoding=UTF8','--locale=C','--auth=scram-sha-256']);
      } finally {
        await rm(pw,{force:true});
      }
    },
    async start() {
      await call('pg_ctl',['-D',directory,'-l',directory+'.log','-o','-h 127.0.0.1 -p '+port,'-w','start']);
    },
    async stop() {
      await call('pg_ctl',['-D',directory,'-m','fast','-w','stop']);
    }
  };
}
