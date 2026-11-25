import type { MetadataRoute } from "next";
import { origin } from "@/lib/auth";
import { query } from "@/lib/db";
import { indexingEnabled } from "@/lib/indexing";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!indexingEnabled()) return [];
  const base=origin();
  const posts=await query<{id:string; updated:Date|null}>(null,
    "select id,case when author='另有解编辑部' then edited_at else coalesce(edited_at,created_at) end updated " +
    "from community.post_feed order by created_at desc limit 5000");
  return [
    {url:base+"/"},
    ...posts.map(post=>({url:base+"/p/"+post.id,lastModified:post.updated??undefined})),
  ];
}
