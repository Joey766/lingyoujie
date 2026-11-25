import { notFound, redirect } from "next/navigation";
import { Compose } from "@/components/compose";
import type { Search } from "@/components/auth-forms";
import { session } from "@/lib/auth";
import { postById, topics, uuid } from "@/lib/community";

export default async function EditPage({params,searchParams}: {params:Promise<{id:string}>;searchParams:Search}) {
  const {id}=await params;
  if (!uuid.test(id)) notFound();
  const current=await session();
  if (!current) redirect("/login?next="+encodeURIComponent("/p/"+id+"/edit"));
  const [post,categories,{status}]=await Promise.all([postById(current.user.id,id),topics(),searchParams]);
  if (!post?.owned) notFound();
  return <Compose categories={categories} post={post} status={status}/>;
}
