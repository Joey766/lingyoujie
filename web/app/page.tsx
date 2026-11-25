import Link from "next/link";
import type { Metadata } from "next";
import { Empty, FeedList, Nav, Status } from "@/components/ui";
import { feed, sorts, topics } from "@/lib/community";
import { origin, session } from "@/lib/auth";
import { editorialPreviewEnabled } from "@/lib/editorial-preview";
import { indexingEnabled } from "@/lib/indexing";

type Params = Promise<Record<string,string|string[]|undefined>>;
const first = (x: string|string[]|undefined) => typeof x==="string"?x:"";

export async function generateMetadata({searchParams}: {searchParams:Params}): Promise<Metadata> {
  const params=await searchParams;
  if (!indexingEnabled() || params.q || params.page || params.status) return {};
  const candidate=first(params.topic);
  const topic=(await topics()).find(t=>t.slug===candidate);
  return {
    robots:{index:true,follow:true},
    alternates:{canonical:origin()+"/"+(topic?"?topic="+topic.slug:"")},
  };
}

export default async function Page({searchParams}: {searchParams:Params}) {
  const [params,user,categories]=await Promise.all([searchParams,session(),topics()]);
  const q=first(params.q).trim().slice(0,80);
  const topic=categories.find(t=>t.slug===first(params.topic));
  const selected=first(params.sort);
  const sort=Object.hasOwn(sorts,selected)?selected as keyof typeof sorts:"recommended";
  const page=Math.max(1,Math.min(200,Number.parseInt(first(params.page),10)||1));
  function href(sortKey: string, pageNumber: number) {
    const filters=new URLSearchParams();
    if (topic) filters.set("topic",topic.slug);
    if (q) filters.set("q",q);
    if (sortKey!=="recommended") filters.set("sort",sortKey);
    if (pageNumber>1) filters.set("page",String(pageNumber));
    return filters.size?"?"+filters.toString():"/";
  }
  const posts=await feed(user?.user.id??null,{topic:topic?.slug??"",q,sort,page});
  const here=href(sort,page);
  return <section>
    <div className="heading"><h1>{q?"搜索「"+q+"」":topic?.name||"社区广场"}</h1>
      <Nav label="帖子排序" items={Object.entries(sorts).map(([key,label])=>({href:href(key,1),label,selected:sort===key}))}/></div>
    <Status value={first(params.status)}/>
    {editorialPreviewEnabled() && !q ? <p className="status">
      <Link href={topic ? "/editorial?topic="+topic.slug : "/editorial"}>审阅开站内容 →</Link>
    </p> : null}
    {posts.length?<FeedList posts={posts.slice(0,30)} topics={categories} returnTo={here.startsWith("?")?"/"+here:here}/>:
      <Empty title={q?"没有找到匹配的帖子":"这里还没有帖子"}><Link href={q||topic?"/":"/write"}>{q||topic?"返回广场":"写第一帖"}</Link></Empty>}
    {page>1||posts.length>30?<div className="actions" style={{marginTop:".7rem"}}>
      {page>1?<Link className="btn" href={href(sort,page-1)}>上一页</Link>:null}
      {posts.length>30&&page<200?<Link className="btn" href={href(sort,page+1)}>下一页</Link>:null}
    </div>:null}
  </section>;
}
