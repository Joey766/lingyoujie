import Link from "next/link";
import type { ReactNode } from "react";
import { Status } from "./ui";

export type Search = Promise<Record<string, string | undefined>>;

export function AuthPanel({title,status,children}: {title:string;status?:string;children:ReactNode}) {
  return <section className="panel auth-panel stack"><h1>{title}</h1><Status value={status}/>{children}</section>;
}

export function EmailField() {
  return <label className="field"><span>邮箱</span><input type="email" name="email" autoComplete="email" maxLength={254} required/></label>;
}

export function PasswordField({existing=false}: {existing?:boolean}) {
  return <label className="field"><span>{existing?"密码":"新密码"}</span><input type="password" name="password" autoComplete={existing?"current-password":"new-password"} minLength={existing?undefined:12} maxLength={128} required/></label>;
}

export function LoginLinks() {
  return <div className="actions"><Link href="/register">注册账号</Link><Link href="/forgot">忘记密码？</Link><Link href="/verify">重新发送验证邮件</Link></div>;
}
