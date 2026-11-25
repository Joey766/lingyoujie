import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const author = 'lyj-editorial';

function contentId(key) {
  const hash = createHash('sha256').update('lyj-editorial/' + key).digest('hex');
  return [hash.slice(0, 8), hash.slice(8, 12), '8' + hash.slice(13, 16),
    'a' + hash.slice(17, 20), hash.slice(20, 32)].join('-');
}

function validText(value, limit) {
  return typeof value === 'string' && value.trim().length > 0 && Array.from(value).length <= limit;
}

function exampleDates(draft, key) {
  if (draft.exampleDates === undefined) return {post:null, comments:[]};
  const {post,comments}=draft.exampleDates;
  const validDate=value=>typeof value==='string' && /T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value)) && Date.parse(value)<=Date.now();
  if (!validDate(post) || !Array.isArray(comments) || comments.length!==draft.comments.length ||
      comments.some((date,index)=>!validDate(date) || Date.parse(date)<=Date.parse(index?comments[index-1]:post))) {
    throw new Error('Invalid sample chronology: '+key);
  }
  return {post,comments};
}

export async function publishEditorial(url, {syncExampleDates=false}={}) {
  if (!url) throw new Error('DATABASE_URL must point to the intended database owner connection.');
  const content = JSON.parse(await readFile(new URL('../content/editorial.json', import.meta.url), 'utf8'));
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  let posts = 0, comments = 0;

  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(78096832)');
    const topics = new Set((await client.query('select slug from community.topics')).rows.map(row => row.slug));
    const seen = new Set();
    await client.query(
      'insert into public."user"(id,name,email,username) values($1,$2,$3,$4) on conflict(id) do nothing',
      [author, '另有解编辑部', 'editorial@lingyoujie.invalid', 'lyj_editorial'],
    );
    const identity = await client.query(
      'select 1 from public."user" u where id=$1 and username=$2 and not "emailVerified" and not exists (select 1 from public.account a where a."userId"=u.id)',
      [author, 'lyj_editorial'],
    );
    if (identity.rowCount !== 1) throw new Error('The editorial identity must be reserved and unable to sign in.');

    for (const [topic, drafts] of Object.entries(content)) {
      if (!topics.has(topic) || !Array.isArray(drafts)) throw new Error('Invalid editorial topic: ' + topic);
      for (const [index, draft] of drafts.entries()) {
        const { slug, title, body } = draft;
        const key = topic + '/' + slug;
        const postBody = '【编辑部讨论稿 · 情境示例】\n\n' + body;
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || seen.has(key) ||
            !validText(title, 68) || !validText(body, 3900) || !Array.isArray(draft.comments)) {
          throw new Error('Invalid or duplicate editorial draft: ' + key);
        }
        seen.add(key);
        const dates=exampleDates(draft,key);
        const id = contentId(key);
        const written = await client.query(
          `insert into community.posts(id,author_id,topic,kind,title,body,featured,created_at)
           values($1,$2,$3,'question',$4,$5,$6,coalesce($8::timestamptz,now()-$7*interval '1 second'))
           on conflict(id) do update set
             edited_at=case when (posts.title,posts.body) is distinct from (excluded.title,excluded.body) then now() else posts.edited_at end,
             created_at=case when $9::boolean and $8::timestamptz is not null then excluded.created_at else posts.created_at end,
             title=excluded.title,body=excluded.body
           where posts.author_id=excluded.author_id and posts.topic=excluded.topic
           returning created_at`,
          [id, author, topic, title, postBody, index === 0, posts, dates.post, syncExampleDates],
        );
        if (written.rowCount !== 1) throw new Error('Editorial post conflicts with existing content: ' + key);
        posts += 1;

        for (const [position, text] of draft.comments.entries()) {
          if (!validText(text, 750)) throw new Error('Invalid sample reply: ' + key);
          const reply = await client.query(
            `insert into community.comments(id,post_id,author_id,body,created_at)
             values($1,$2,$3,$4,coalesce($7::timestamptz,$5::timestamptz+$6*interval '1 millisecond'))
             on conflict(id) do update set
               edited_at=case when comments.body is distinct from excluded.body then now() else comments.edited_at end,
               created_at=case when $8::boolean and $7::timestamptz is not null then excluded.created_at else comments.created_at end,
               body=excluded.body
             where comments.author_id=excluded.author_id and comments.post_id=excluded.post_id`,
            [contentId(key + '/reply/' + position), id, author, '【编辑部示例评论】\n\n' + text, written.rows[0].created_at, position + 1, dates.comments[position]??null, syncExampleDates],
          );
          if (reply.rowCount !== 1) throw new Error('Sample reply conflicts with existing content: ' + key);
          comments += 1;
        }
      }
    }
    await client.query('commit');
    console.log('Editorial sync complete:', posts, 'posts and', comments, 'sample comments.');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options={syncExampleDates:process.argv.includes('--sync-example-dates')};
  if (process.argv.includes('--hosted')) {
    const url=new URL(process.env.LYJ_SETUP_DATABASE_URL_UNPOOLED);
    if (!url.hostname.endsWith('.neon.tech') || url.hostname.includes('-pooler')) {
      throw new Error('A direct Neon connection for 另有解 is required.');
    }
    url.searchParams.set('sslmode','verify-full');
    await publishEditorial(String(url),options);
  } else {
    await publishEditorial(process.env.DATABASE_URL,options);
  }
}
