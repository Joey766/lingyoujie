import Link from "next/link";
import { reset } from "@/app/actions/auth";
import { AuthPanel, PasswordField, type Search } from "@/components/auth-forms";

export default async function ResetPage({searchParams}: {searchParams:Search}) {
  const {status,token}=await searchParams;
  const valid=typeof token==="string" && token.length>0 && token.length<=512;
  return <AuthPanel title="重置密码" status={valid?status:"expired"}>
    {valid?<form action={reset} className="stack">
      <input type="hidden" name="token" value={token}/><PasswordField/>
      <p className="muted">密码重置后，现有登录会话将退出。</p>
      <button className="btn primary">保存新密码</button>
    </form>:<Link href="/forgot">重新申请链接</Link>}
  </AuthPanel>;
}
