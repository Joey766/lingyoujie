import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { deletePost } from "@/app/actions/community";
import { CommentForm, ReportForm, Threads } from "@/components/discussion";
import type { Search } from "@/components/auth-forms";
import { Nav, PostMeta, Status, Tools } from "@/components/ui";
import { origin, session } from "@/lib/auth";
import { indexingEnabled } from "@/lib/indexing";
import { commentsFor, kinds, myThreadIdentity, postById, topics, uuid } from "@/lib/community";

export async function generateMetadata({params}: {params:Promise<{id:string}>}): Promise<Metadata> {
  const {id}=await params;
  if (!indexingEnabled() || !uuid.test(id)) return {};
  const post=await postById(null,id);
  if (!post) return {};
  return {title:post.title,description:post.body.replace(/\s+/g," ").slice(0,150),
    robots:{index:true,follow:true},alternates:{canonical:origin()+"/p/"+id}};
}

export default async function PostPage({params,searchParams}: {params:Promise<{id:string}>;searchParams:Search}) {
  const [{id},{status,comments:order},current]=await Promise.all([params,searchParams,session()]);
  if (!uuid.test(id)) notFound();
  const actor=current?.user.id??null;
  const [post,categories]=await Promise.all([postById(actor,id),topics()]);
  if (!post) notFound();
  const [comments,identity]=await Promise.all([commentsFor(actor,id,order==="new"),actor?myThreadIdentity(actor,id):null]);
  const base="/p/"+id;
  const topic=categories.find(item=>item.slug===post.topic);
  return <div className="reading stack">
    <div className="actions"><Link className="quiet-link" href="/">‹ 社区广场</Link><Link className="quiet-link" href={"/?topic="+post.topic}>{topic?.name}</Link></div>
    <Status value={status}/>
    <article className="panel stack">
      <p className="muted">{kinds[post.kind]}</p><h1>{post.title}</h1><PostMeta post={post} topic={topic}/>
      <div className="prose">{post.body}</div>
      <Tools post={post} returnTo={base}/>
      {post.owned?<div className="actions"><Link className="btn" href={base+"/edit"}>编辑帖子</Link><details className="report"><summary>删除帖子</summary>
        <form className="stack" action={deletePost}><input type="hidden" name="post" value={id}/><button className="btn danger">确认删除帖子</button></form>
      </details></div>:<ReportForm post={id} member={Boolean(actor)}/>}
    </article>
    <section className="panel stack" id="discussion" aria-labelledby="discussion-title">
      <div className="heading"><h2 id="discussion-title">讨论 · {post.comment_count}</h2>
        <Nav label="评论排序" items={[{href:base+"#discussion",label:"最早",selected:order!=="new"},{href:base+"?comments=new#discussion",label:"最新",selected:order==="new"}]}/>
      </div>
      {actor?<CommentForm post={id} identity={identity}/>:<Link className="btn" href={"/login?next="+encodeURIComponent(base+"#discussion")}>登录后参与讨论</Link>}
      {comments.length?<Threads items={comments} member={Boolean(actor)} identity={identity}/>:<p className="muted">还没有评论。</p>}
    </section>
  </div>;
}
