import "server-only";
import { query } from "./db";

export const kinds = { story: "分享经历", question: "提个问题", thought: "聊个观点", review: "做次复盘", daily: "随手一帖" };
export const reasons = { privacy: "泄露个人信息", harassment: "骚扰或人身攻击", spam: "垃圾广告", other: "其他规则问题" };
export const sorts = { recommended: "精选", latest: "最新", active: "近期讨论" };
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type Topic = { slug: string; name: string; mark: string };
export type Post = {
  id: string; topic: string; kind: keyof typeof kinds; title: string; body: string; anonymous: boolean;
  author: string; created_at: Date; edited_at: Date | null; comment_count: number; owned: boolean; saved: boolean; resonated: boolean;
};
export type Comment = { id: string; post_id: string; root_id: string | null; reply_to: string | null; body: string | null; author: string; owned: boolean; is_op: boolean; created_at: Date; edited_at: Date | null };
export type Notice = { id: string; post_id: string; comment_id: string; kind: "reply" | "comment"; title: string | null; available: boolean; created_at: Date; read_at: Date | null };
export type Report = {id: string; post_id: string; comment_id: string | null; title: string; body: string; reason: keyof typeof reasons; state: string; created_at: Date};
export type MyPost = Pick<Post, "id" | "title" | "topic" | "created_at" | "anonymous"> & {visibility: "public" | "hidden"};

const ordering = { recommended: "featured DESC, created_at DESC", latest: "created_at DESC", active: "activity DESC, created_at DESC" };
export const topics = () => query<Topic>(null, "select slug,name,mark from community.topics order by position");
export const adminStatus = async (id: string) => (await query<{ allowed: boolean }>(id, "select community.is_admin() as allowed"))[0]?.allowed ?? false;
export const unread = async (id: string) => (await query<{ total: number }>(id, "select count(*)::int as total from community.my_notices where read_at is null"))[0]?.total ?? 0;
export const postById = async (id: string | null, post: string) => (await query<Post>(id, "select * from community.post_feed where id=$1", [post]))[0];
export const commentsFor = (id: string | null, post: string, reversed: boolean) => query<Comment>(id,
  "select * from community.comment_feed where post_id=$1 order by created_at " + (reversed ? "desc" : "asc") + ",id", [post]);
export const myThreadIdentity=async (id:string,post:string)=>(await query<{anonymous:boolean|null}>(id,
  "select community.my_thread_identity($1) as anonymous",[post]))[0]?.anonymous ?? null;

export function feed(id: string | null, filter: { topic: string; q: string; sort: keyof typeof sorts; page: number }) {
  return query<Post>(id, "select * from community.post_feed where ($1='' or topic=$1) and "
    + "($2='' or strpos(lower(title),lower($2))>0 or strpos(lower(body),lower($2))>0) order by "
    + ordering[filter.sort] + ", id limit 31 offset $3", [filter.topic, filter.q, (filter.page - 1) * 30]);
}

export const myPosts = (id: string) => query<MyPost>(id, "select * from community.my_posts order by created_at desc limit 100");
export const myComments = (id: string) => query<Comment & { title: string }>(id,
  "select c.*,p.title from community.comment_feed c join community.post_feed p on p.id=c.post_id where c.owned order by c.created_at desc limit 100");
export const myBookmarks = (id: string) => query<Post>(id,
  "select p.* from community.bookmarks b join community.post_feed p on p.id=b.post_id order by b.created_at desc limit 100");
export const notices = (id: string) => query<Notice>(id, "select * from community.my_notices order by created_at desc limit 100");
export const reviewQueue = (id: string) => query<Report>(id, "select * from community.review_queue()");
