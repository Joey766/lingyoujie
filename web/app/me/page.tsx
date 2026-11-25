import Link from "next/link";
import { redirect } from "next/navigation";
import { changeName, logout } from "@/app/actions/auth";
import { deletePost } from "@/app/actions/community";
import type { Search } from "@/components/auth-forms";
import { Empty, FeedList, Nav, Status, Time } from "@/components/ui";
import { session } from "@/lib/auth";
import { adminStatus, myBookmarks, myComments, myPosts, topics } from "@/lib/community";

const tabs = {posts:"帖子",comments:"评论",saved:"收藏",settings:"账号设置"};

export default async function ProfilePage({searchParams}: {searchParams:Search}) {
  const [{status,tab},current]=await Promise.all([searchParams,session()]);
  if (!current) redirect("/login?next=%2Fme");
  const active=tab && Object.hasOwn(tabs,tab)?tab:"posts";
  const id=current.user.id;
  return <div className="reading stack">
    <div className="heading"><h1>个人中心</h1><Link className="btn primary" href="/write">发帖</Link></div>
    <Nav label="个人中心" items={Object.entries(tabs).map(([value,label])=>({label,href:"/me?tab="+value,selected:value===active}))}/>
    <Status value={status}/>
    {active==="posts"?<Posts id={id}/>:active==="comments"?<Comments id={id}/>:active==="saved"?<Saved id={id}/>:<Settings id={id} user={current.user}/>}
  </div>;
}

async function Posts({id}: {id:string}) {
  const rows=await myPosts(id);
  return rows.length?<div className="panel">{rows.map(p=><article className="row" key={p.id}>
    <h2>{p.visibility==="public"?<Link href={"/p/"+p.id}>{p.title}</Link>:p.title}</h2>
    <div className="meta"><span>{p.anonymous?"匿名":"公开昵称"}</span><Time value={p.created_at}/>{p.visibility==="hidden"?<span>已被管理员隐藏</span>:null}</div>
    {p.visibility==="hidden"?<details className="report"><summary>删除帖子</summary><form action={deletePost}><input type="hidden" name="post" value={p.id}/><button className="btn danger">确认删除</button></form></details>:null}
  </article>)}</div>:<Empty title="还没有发帖"><Link href="/write">写第一篇帖子</Link></Empty>;
}

async function Comments({id}: {id:string}) {
  const rows=await myComments(id);
  return rows.length?<div className="panel">{rows.map(c=><article className="row" key={c.id}>
    <h2><Link href={"/p/"+c.post_id+"#c-"+c.id}>{c.title}</Link></h2><p className="excerpt">{c.body}</p><div className="meta"><span>{c.author}</span><Time value={c.created_at}/></div>
  </article>)}</div>:<Empty title="还没有评论"/>;
}

async function Saved({id}: {id:string}) {
  const [posts,categories]=await Promise.all([myBookmarks(id),topics()]);
  return posts.length?<FeedList posts={posts} topics={categories} returnTo="/me?tab=saved"/>:<Empty title="还没有收藏"><Link href="/">逛逛社区广场</Link></Empty>;
}

async function Settings({id,user}: {id:string;user:{name:string;username:string;email:string}}) {
  const admin=await adminStatus(id);
  return <div className="panel stack">
    <div><h2>账号资料</h2><p className="muted">用户名：{user.username}</p><p className="muted">验证邮箱（仅自己可见）：{user.email}</p></div>
    <form action={changeName} className="stack"><label className="field"><span>公开昵称</span><input name="name" maxLength={32} defaultValue={user.name} required/></label><button className="btn">保存昵称</button></form>
    <div className="actions">{admin?<Link className="btn" href="/admin">举报审核</Link>:null}<form action={logout}><button className="btn">退出登录</button></form></div>
  </div>;
}
