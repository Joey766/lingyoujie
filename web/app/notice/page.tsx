import { redirect } from "next/navigation";
import { markNotice } from "@/app/actions/community";
import type { Search } from "@/components/auth-forms";
import { Empty, Status, Time } from "@/components/ui";
import { session } from "@/lib/auth";
import { notices } from "@/lib/community";

export default async function NoticePage({searchParams}: {searchParams:Search}) {
  const [current,{status}]=await Promise.all([session(),searchParams]);
  if (!current) redirect("/login?next=%2Fnotice");
  const rows=await notices(current.user.id);
  return <section className="reading stack">
    <div className="heading"><h1>站内通知</h1>{rows.some(item=>!item.read_at)?<form action={markNotice}><button className="btn">全部标为已读</button></form>:null}</div>
    <Status value={status}/>
    {rows.length?<div className="panel">{rows.map(item=><form key={item.id} action={markNotice} className="row">
      <input type="hidden" name="notice" value={item.id}/>
      <button className={"notice"+(item.read_at?"":" unread")}>
        <strong>{item.kind==="reply"?"有人回复了你的评论":"你的帖子收到新评论"}</strong>
        <span className="meta"><span>{item.available?item.title:"内容已不可用"}</span><Time value={item.created_at}/>{item.read_at?null:<span>未读</span>}</span>
      </button>
    </form>)}</div>:<Empty title="还没有通知"/>}
  </section>;
}
