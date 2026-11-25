import Link from "next/link";
import { requestReset } from "@/app/actions/auth";
import { AuthPanel, EmailField, type Search } from "@/components/auth-forms";

export default async function ForgotPage({searchParams}: {searchParams:Search}) {
  return <AuthPanel title="找回密码" status={(await searchParams).status}>
    <form action={requestReset} className="stack"><EmailField/><button className="btn primary">发送重置链接</button></form>
    <Link href="/login">返回登录</Link>
  </AuthPanel>;
}
