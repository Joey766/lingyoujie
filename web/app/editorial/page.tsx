import Link from "next/link";
import { Icon, Nav } from "@/components/ui";
import { topics } from "@/lib/community";
import { editorialDrafts } from "@/lib/editorial-data";

export default async function EditorialPage({ searchParams }: {
  searchParams: Promise<{ topic?: string | string[] }>;
}) {
  const [categories, params] = await Promise.all([topics(), searchParams]);
  const groups = categories.flatMap(topic => {
    const drafts = editorialDrafts[topic.slug];
    return drafts?.length ? [{ topic, drafts }] : [];
  });
  const selected = groups.find(group => group.topic.slug === params.topic);
  const count = groups.reduce((total, group) => total + group.drafts.length, 0);

  return <div className="reading stack">
    <Link href="/" className="quiet-link">‹ 社区广场</Link>
    <header className="panel stack">
      <h1>开站内容预览</h1>
      <p className="muted">{groups.length} 个主题 · {count} 篇候选帖</p>
      <p>编辑部备稿。帖子和评论中的情境为示例，供开站前审阅。</p>
    </header>
    <Nav label="预览主题" items={[
      { href: "/editorial", label: "全部", selected: !selected },
      ...groups.map(({ topic }) => ({
        href: "/editorial?topic=" + topic.slug,
        label: topic.name,
        selected: selected?.topic.slug === topic.slug,
      })),
    ]} />
    {(selected ? [selected] : groups).map(({ topic, drafts }) => <section className="stack" key={topic.slug} aria-labelledby={"preview-" + topic.slug}>
      <div className="heading">
        <h2 id={"preview-" + topic.slug}>{topic.name}</h2>
        <span className="muted">{drafts.length} 篇</span>
      </div>
      <div className="feed">{drafts.map(draft => {
        const href = "/editorial/" + topic.slug + "/" + draft.slug;
        return <article key={draft.slug} className="feed-row">
          <h3><Link href={href}>{draft.title}</Link></h3>
          <p className="excerpt">{draft.body}</p>
          <div className="tools">
            <Link className="quiet-link" href={href + "#sample-comments"}>
              <Icon kind="comment" /> {draft.comments.length} 条示例评论
            </Link>
          </div>
        </article>;
      })}</div>
    </section>)}
  </div>;
}
