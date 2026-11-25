import Link from "next/link";
import type { ReactNode } from "react";
import { interaction } from "@/app/actions/community";
import { type Post, type Topic } from "@/lib/community";

export const dates = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
});
export function Time({value,example=false}: {value: Date;example?:boolean}) {
  return <time dateTime={value.toISOString()}>{example?"示例日期 · ":""}{dates.format(value)}</time>;
}

const statuses: Record<string, string> = {
  invalid: "请检查必填信息和长度。", invite: "注册仅向受邀邮箱开放。", username: "这个用户名已经有人使用。",
  "auth-error": "操作暂未完成，请检查输入后重试。", "login-error": "邮箱或密码不正确。",
  "verify-first": "请先打开验证邮件里的链接。", slow: "操作过于频繁，请稍后再试。",
  "check-email": "请打开邮箱里的验证链接，再回来登录。", verified: "邮箱已验证。现在可以登录。",
  "verify-sent": "若该邮箱仍待验证，验证链接已发出。",
  "reset-sent": "如果这个邮箱可以接收重置邮件，链接已发出。", "reset-done": "密码已重置，请用新密码登录。",
  expired: "链接无效或已过期，请重新申请。", "profile-saved": "昵称已保存。",
  denied: "你没有操作权限，或内容已不可用。", "save-error": "暂时无法保存，请稍后重试。",
  saved: "内容已更新。", deleted: "内容已删除。", reviewed: "举报已处理。", reported: "已收到举报。",
  unavailable: "该通知关联的内容已经不可用。",
};
export function Status({value}: {value?: string}) {
  return typeof value==="string" && Object.hasOwn(statuses,value) ? <p className="status" role="status">{statuses[value]}</p> : null;
}

export function Empty({title, children}: {title:string; children?:ReactNode}) {
  return <div className="panel empty"><h2>{title}</h2>{children}</div>;
}

export function Nav({items, label}: {items: {href:string;label:string;selected?:boolean}[];label:string}) {
  return <nav aria-label={label} className="tabs">{items.map(i=><Link key={i.href} href={i.href} aria-current={i.selected?"page":undefined}>{i.label}</Link>)}</nav>;
}

export function Icon({kind}: {kind: "comment" | "resonate" | "save"}) {
  return <span aria-hidden="true" className={"icon icon-"+kind}>{kind==="resonate"?"✧":kind==="save"?"♧":""}</span>;
}

export function PostMeta({post, topic}: {post:Post;topic?:Topic}) {
  return <div className="meta">
    <span className="byline">{post.author}</span><span aria-hidden="true">·</span>
    <Link href={"/?topic="+post.topic}>{topic?.name || post.topic}</Link><span aria-hidden="true">·</span>
    <Time value={post.created_at} example={post.author==="另有解编辑部"}/>{post.edited_at?<span>· 已编辑</span>:null}
  </div>;
}

export function Tools({post, returnTo}: {post:Post;returnTo:string}) {
  return <div className="tools">
    <Link className="quiet-link" href={"/p/"+post.id+"#discussion"}><Icon kind="comment"/>{post.comment_count} 条评论</Link>
    {(["resonate","save"] as const).map(kind=>{
      const active=kind==="save"?post.saved:post.resonated;
      return <form key={kind} action={interaction}>
        <input type="hidden" name="post" value={post.id}/><input type="hidden" name="returnTo" value={returnTo}/>
        <input type="hidden" name="kind" value={kind}/><input type="hidden" name="enabled" value={String(!active)}/>
        <button type="submit" className="quiet-link" aria-pressed={active}><Icon kind={kind}/>{kind==="save"?(active?"已收藏":"收藏"):(active?"已共鸣":"共鸣")}</button>
      </form>;
    })}
  </div>;
}

export function FeedList({posts, topics, returnTo}: {posts:Post[];topics:Topic[];returnTo:string}) {
  return <div className="feed">{posts.map(post=><article key={post.id} className="feed-row">
    <h2><Link href={"/p/"+post.id}>{post.title}</Link></h2>
    <p className="excerpt">{post.body}</p>
    <PostMeta post={post} topic={topics.find(t=>t.slug===post.topic)}/>
    <Tools post={post} returnTo={returnTo}/>
  </article>)}</div>;
}
