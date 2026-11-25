import { redirect } from "next/navigation";
import { Compose } from "@/components/compose";
import type { Search } from "@/components/auth-forms";
import { session } from "@/lib/auth";
import { topics } from "@/lib/community";

export default async function WritePage({searchParams}: {searchParams:Search}) {
  const {topic,status}=await searchParams;
  if (!await session()) redirect("/login?next="+encodeURIComponent(topic?"/write?topic="+encodeURIComponent(topic):"/write"));
  const categories=await topics();
  return <Compose categories={categories} selected={categories.find(t=>t.slug===topic)?.slug} status={status}/>;
}
