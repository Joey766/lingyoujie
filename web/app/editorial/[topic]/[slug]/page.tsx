import Link from "next/link";
import { notFound } from "next/navigation";
import { topics } from "@/lib/community";
import { editorialDrafts } from "@/lib/editorial-data";

export default async function EditorialPostPage({ params }: {
  params: Promise<{ topic: string; slug: string }>;
}) {
  const { topic: topicSlug, slug } = await params;
  if (!Object.hasOwn(editorialDrafts, topicSlug)) notFound();
  const draft = editorialDrafts[topicSlug].find(item => item.slug === slug);
  if (!draft) notFound();
  const topic = (await topics()).find(item => item.slug === topicSlug);
  if (!topic) notFound();

  return <div className="reading stack">
    <div className="actions">
      <Link className="quiet-link" href="/editorial">‹ 全部预览</Link>
      <Link className="quiet-link" href={"/editorial?topic=" + topic.slug}>{topic.name}</Link>
    </div>
    <article className="panel stack">
      <p className="meta">编辑部备稿 · 情境示例</p>
      <h1>{draft.title}</h1>
      <p className="prose">{draft.body}</p>
    </article>
    <section className="panel stack" id="sample-comments" aria-labelledby="sample-comments-heading">
      <h2 id="sample-comments-heading">示例评论</h2>
      <p className="muted">编辑部为这篇稿子试写的两种回应。</p>
      <ol>{draft.comments.map((comment, index) => <li className="comment" key={comment}>
        <p className="meta">示例评论 {index + 1}</p>
        <p className="prose">{comment}</p>
      </li>)}</ol>
    </section>
  </div>;
}
