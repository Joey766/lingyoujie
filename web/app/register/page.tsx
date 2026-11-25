import Link from "next/link";
import { register } from "@/app/actions/auth";
import { AuthPanel, EmailField, PasswordField, type Search } from "@/components/auth-forms";
import { smtpConfigured } from "@/lib/mail";

export default async function RegisterPage({searchParams}: {searchParams:Search}) {
  const {status}=await searchParams;
  const local=process.env.REGISTRATION_MODE==="local";
  const open=process.env.REGISTRATION_MODE==="public" && smtpConfigured();
  if (!local && !open && process.env.REGISTRATION_MODE !== "invite") {
    return <AuthPanel title="注册暂未开放">
      <p>公测第一阶段可以阅读帖子和评论。</p>
      <Link href="/">返回社区广场</Link>
    </AuthPanel>;
  }
  return <AuthPanel title="注册账号" status={status}>
    <p className="muted">{local?"本地测试请使用 @local.test 邮箱。验证邮件写入本地测试收件箱。":open?"完成邮箱验证后即可发帖和评论。":"注册面向受邀邮箱。邮箱仅用于账号登录与验证。"}</p>
    <form className="stack" action={register}>
      <label className="field"><span>用户名</span><input name="username" autoComplete="username" pattern="[a-z0-9_]{3,24}" maxLength={24} aria-describedby="username-hint" required/></label>
      <p id="username-hint" className="muted">3–24 位小写字母、数字或下划线。注册后固定。</p>
      <label className="field"><span>公开昵称</span><input name="name" autoComplete="nickname" required maxLength={32}/></label>
      <EmailField/><PasswordField/>
      <p className="muted">请使用至少 12 个字符的密码。发帖和评论时可选择匿名。</p>
      <button className="btn primary">注册并验证邮箱</button>
    </form>
    <Link href="/login">已有账号？去登录</Link>
  </AuthPanel>;
}
