import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { review } from "@/app/actions/community";
import type { Search } from "@/components/auth-forms";
import { Empty, Status, Time } from "@/components/ui";
import { session } from "@/lib/auth";
import { adminStatus, reasons, reviewQueue } from "@/lib/community";

export default async function AdminPage({searchParams}: {searchParams:Search}) {
  const [current,{status}]=await Promise.all([session(),searchParams]);
  if (!current) redirect("/login?next=%2Fadmin");
  if (!await adminStatus(current.user.id)) notFound();
  const rows=await reviewQueue(current.user.id);
  return <section className="reading stack">
    <div className="heading"><h1>举报审核</h1><Link href="/rules">社区约定</Link></div><Status value={status}/>
    {rows.length?<div className="panel">{rows.map(item=><article className="row stack" key={item.id}>
      <h2><Link href={"/p/"+item.post_id+(item.comment_id?"#c-"+item.comment_id:"")}>{item.title}</Link></h2>
      <div className="meta"><span>{reasons[item.reason]}</span><Time value={item.created_at}/></div>
      <p className="prose">{item.body}</p>
      {item.state==="open"?<form className="actions" action={review}><input type="hidden" name="report" value={item.id}/>
        <button className="btn" name="decision" value="dismissed">驳回举报</button><button className="btn danger" name="decision" value="hidden">隐藏{item.comment_id?"评论":"帖子"}</button>
      </form>:<p className="muted">{item.state==="hidden"?"内容已隐藏":"举报已驳回"}</p>}
    </article>)}</div>:<Empty title="暂无待处理举报"/>}
  </section>;
}
