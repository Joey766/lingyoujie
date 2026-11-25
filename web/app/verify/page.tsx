import Link from "next/link";
import { resendVerification } from "@/app/actions/auth";
import { AuthPanel, EmailField, type Search } from "@/components/auth-forms";

export default async function VerifyPage({searchParams}: {searchParams:Search}) {
  return <AuthPanel title="重新发送验证邮件" status={(await searchParams).status}>
    <form action={resendVerification} className="stack"><EmailField/><button className="btn primary">发送验证链接</button></form>
    <Link href="/login">返回登录</Link>
  </AuthPanel>;
}
