import Link from "next/link";
import { topics } from "@/lib/community";

export default async function Page() {
  return <section className="reading stack"><h1>主题</h1><div className="topic-list">
    {(await topics()).map(topic=><Link key={topic.slug} className="panel" href={"/?topic="+topic.slug}>{topic.name}</Link>)}
  </div></section>;
}
