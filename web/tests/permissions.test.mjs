import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

test('PostgreSQL owner, anonymous views, private state and moderation', async () => {
  const url = new URL(process.env.DATABASE_URL || 'postgresql://invalid@127.0.0.1:1/postgres');
  assert.equal(process.env.REGISTRATION_MODE, 'local', 'Run against the dedicated local test database');
  assert.equal(url.hostname, '127.0.0.1');
  const db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  const [a,b,unverified] = Array.from({length:3}, () => randomUUID());
  const select = async (sql, values=[]) => (await db.query(sql, values)).rows;
  async function viewer(id='') {
    await db.query('SET LOCAL ROLE lyj_runtime');
    await db.query("select set_config('lyj.user_id',$1,true)",[id]);
  }
  async function denied(sql,values=[]) {
    await db.query('SAVEPOINT restricted');
    try {
      await assert.rejects(db.query(sql,values), {code:'42501'});
    } finally {
      await db.query('ROLLBACK TO SAVEPOINT restricted');
      await db.query('RELEASE SAVEPOINT restricted');
    }
  }
  const subjects = await db.query('select current_user as connection');
  assert.equal(subjects.rows[0].connection,'lyj_owner');
  try {
    await db.query('BEGIN');
    for (const [id,name,verified] of [[a,'A private name',true],[b,'B private name',true],[unverified,'No verified email',false]]) {
      await db.query('insert into public."user"(id,name,email,username,"emailVerified") values($1,$2,$3,$4,$5)',[id,name,id+'@local.test','u'+id.slice(0,8),verified]);
    }
    await viewer();
    await denied('select * from public."user"');
    await denied('select * from public.session');
    await denied('select * from community.posts');
    await denied('select * from community.thread_identities');
    await denied('select community.publish_post($1,$2,$3,$4,$5)', ['guest','denied','work','story',false]);
    await viewer(unverified);
    await denied("select community.publish_post('unverified','denied','work','story',false)");
    await viewer(a);
    const [{id:post}]=await select('select community.publish_post($1,$2,$3,$4,$5) id',['test post','test body','work','story',true]);
    const [{id:another}]=await select('select community.publish_post($1,$2,$3,$4,$5) id',['other post','test body','work','story',false]);
    await viewer(b);
    const [row]=await select('select * from community.post_feed where id=$1',[post]);
    assert.equal(row.author,'匿名楼主');
    assert.equal(row.owned,false);
    for (const field of ['email','author_id','username','user_id']) assert.equal(Object.hasOwn(row,field),false);
    await denied("select community.edit_post($1,'forged','forged','work','story')",[post]);
    await denied('select community.delete_post($1)',[post]);
    await denied("update community.posts set title='forged' where id=$1",[post]);
    await denied('insert into community.admins values($1)',[b]);
    await denied('select * from community.review_queue()');
    const [{id:root}]=await select("select community.add_comment($1,null,'anonymous comment',true) id",[post]);
    await denied("select community.add_comment($1,$2,'cross-post',false)",[another,root]);
    await select('select community.set_bookmark($1,true), community.set_reaction($1,true)',[post]);
    assert.equal((await select('select count(*)::int as n from community.bookmarks where post_id=$1',[post]))[0].n,1);
    assert.equal((await select('select resonated from community.post_feed where id=$1',[post]))[0].resonated,true);
    await select("select community.report($1,null,'spam')",[post]);
    await viewer(a);
    assert.equal((await select('select count(*)::int as n from community.bookmarks where post_id=$1',[post]))[0].n,0);
    assert.equal((await select('select comment_id from community.my_notices where post_id=$1',[post]))[0].comment_id,root);
    await denied("select community.edit_comment($1,'forged')",[root]);
    const [{id:reply}]=await select("select community.add_comment($1,$2,'author reply',false) id",[post,root]);
    await select("select community.edit_post($1,'changed','works','work','story')",[post]);
    await viewer(b);
    const [comment]=await select('select * from community.comment_feed where id=$1',[root]);
    assert.equal(comment.author,'匿名用户 1');
    assert.equal(Object.hasOwn(comment,'author_id'),false);
    const [{id:reply2}]=await select("select community.add_comment($1,$2,'reply to reply',false) id",[post,reply]);
    const [thread]=await select('select root_id,reply_to,author from community.comment_feed where id=$1',[reply2]);
    assert.deepEqual(thread,{root_id:root,reply_to:reply,author:'匿名用户 1'});
    assert.equal((await select('select comment_id from community.my_notices where post_id=$1',[post]))[0].comment_id,reply);
    await db.query('RESET ROLE');
    await db.query('insert into community.admins values($1)',[a]);
    await viewer(a);
    const [report]=await select('select * from community.review_queue() where post_id=$1',[post]);
    await viewer(b);
    await denied("select community.review($1,'hidden')",[report.id]);
    await viewer(a);
    await select("select community.review($1,'hidden')",[report.id]);
    assert.equal((await select('select * from community.post_feed where id=$1',[post])).length,0);
    assert.equal((await select('select visibility from community.my_posts where id=$1',[post]))[0].visibility,'hidden');
    await db.query('RESET ROLE');
    assert.equal((await select('select decision from community.moderation_log where report_id=$1',[report.id]))[0].decision,'hidden');
  } finally {
    await db.query('ROLLBACK');
    await db.end();
  }
});
