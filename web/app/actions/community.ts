"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { session } from "@/lib/auth";
import { kinds, reasons, uuid, type Notice } from "@/lib/community";
import { query } from "@/lib/db";
import { safeReturn, withStatus } from "@/lib/links";

const str = (form: FormData, name: string) => String(form.get(name) ?? "");
const uuidOr = (value: string, path: string) => uuid.test(value) ? value : redirect(withStatus(path,"invalid"));
const requireUser = async (next: string) => (await session())?.user.id || redirect("/login?next="+encodeURIComponent(next));

async function mutate<T>(work: () => Promise<T>, back: string) {
  let result: T;
  try { result = await work(); } catch (error) {
    const pgError=error as {code?:string;message?:string};
    const status = pgError.code==="42501" ? "denied" :
      pgError.message==="rate_limited" ? "slow" :
      ["23514","23503","22P02"].includes(pgError.code||"") ? "invalid" : "save-error";
    if (status==="save-error") console.error("Community write failed",pgError.code ?? "unknown");
    redirect(withStatus(back,status));
  }
  // The activity counts and unread badge are shared by routes. Force the
  // client router to read fresh data even on same-page comment redirects.
  revalidatePath("/", "layout");
  return result;
}

function postFields(form: FormData, back: string) {
  const title=str(form,"title").trim(), body=str(form,"body").trim(), topic=str(form,"topic"), kind=str(form,"kind");
  if (!title || title.length>68 || !body || body.length>4000 || !/^[a-z]{1,15}$/.test(topic) || !Object.hasOwn(kinds,kind)) redirect(withStatus(back,"invalid"));
  return [title,body,topic,kind];
}

export async function publish(form: FormData) {
  const back="/write";
  const actor=await requireUser(back);
  const values=postFields(form,back);
  const [post]=await mutate(()=>query<{id:string}>(actor,"select community.publish_post($1,$2,$3,$4,$5) as id",[...values,form.get("anonymous")==="on"]),back);
  redirect("/p/"+post.id);
}

export async function editPost(form: FormData) {
  const id=uuidOr(str(form,"post"),"/me");
  const back="/p/"+id+"/edit";
  const actor=await requireUser(back);
  const values=postFields(form,back);
  await mutate(()=>query(actor,"select community.edit_post($1,$2,$3,$4,$5)",[id,...values]),back);
  redirect("/p/"+id+"?status=saved");
}

export async function deletePost(form: FormData) {
  const id=uuidOr(str(form,"post"),"/me");
  const actor=await requireUser("/me");
  await mutate(()=>query(actor,"select community.delete_post($1)",[id]),"/me");
  redirect("/me?status=deleted");
}

export async function comment(form: FormData) {
  const post=uuidOr(str(form,"post"),"/");
  const back="/p/"+post+"#discussion";
  const actor=await requireUser(back);
  const parent=str(form,"parent"), body=str(form,"body").trim();
  if (!body || body.length>800 || (parent&&!uuid.test(parent))) redirect(withStatus(back,"invalid"));
  const [row]=await mutate(()=>query<{id:string}>(actor,"select community.add_comment($1,$2,$3,$4) as id",[post,parent||null,body,form.get("anonymous")==="on"]),back);
  redirect("/p/"+post+"#c-"+row.id);
}

export async function changeComment(form: FormData) {
  const post=uuidOr(str(form,"post"),"/");
  const target=uuidOr(str(form,"target"),"/p/"+post);
  const back="/p/"+post+"#c-"+target;
  const actor=await requireUser(back);
  if (form.get("decision")==="delete") {
    await mutate(()=>query(actor,"select community.delete_comment($1)",[target]),back);
    redirect("/p/"+post+"?status=deleted#discussion");
  }
  const body=str(form,"body").trim();
  if (!body || body.length>800) redirect(withStatus(back,"invalid"));
  await mutate(()=>query(actor,"select community.edit_comment($1,$2)",[target,body]),back);
  redirect(withStatus(back,"saved"));
}

export async function interaction(form: FormData) {
  const back=safeReturn(str(form,"returnTo"));
  const post=uuidOr(str(form,"post"),back);
  const actor=await requireUser(back);
  const sql=form.get("kind")==="save" ? "select community.set_bookmark($1,$2)" : "select community.set_reaction($1,$2)";
  await mutate(()=>query(actor,sql,[post,form.get("enabled")==="true"]),back);
  redirect(back);
}

export async function report(form: FormData) {
  const post=uuidOr(str(form,"post"),"/");
  const back="/p/"+post;
  const actor=await requireUser(back);
  const target=str(form,"target"), cause=str(form,"reason");
  if (!Object.hasOwn(reasons,cause) || (target&&!uuid.test(target))) redirect(withStatus(back,"invalid"));
  await mutate(()=>query(actor,"select community.report($1,$2,$3)",[post,target||null,cause]),back);
  redirect(withStatus(back,"reported"));
}

export async function markNotice(form: FormData) {
  const actor=await requireUser("/notice");
  const id=str(form,"notice");
  if (!id) {
    await mutate(()=>query(actor,"select community.mark_notice(null)"),"/notice");
    redirect("/notice");
  }
  if (!uuid.test(id)) redirect("/notice?status=invalid");
  const [item]=await query<Notice>(actor,"select * from community.my_notices where id=$1",[id]);
  if (!item) redirect("/notice?status=denied");
  await mutate(()=>query(actor,"select community.mark_notice($1)",[id]),"/notice");
  redirect(item.available ? "/p/"+item.post_id+"#c-"+item.comment_id : "/notice?status=unavailable");
}

export async function review(form: FormData) {
  const actor=await requireUser("/admin");
  const id=uuidOr(str(form,"report"),"/admin");
  const decision=str(form,"decision");
  if (!["dismissed","hidden"].includes(decision)) redirect("/admin?status=invalid");
  await mutate(()=>query(actor,"select community.review($1,$2)",[id,decision]),"/admin");
  redirect("/admin?status=reviewed");
}
