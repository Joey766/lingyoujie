import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { session } from "@/lib/auth";
import { adminStatus, topics, unread } from "@/lib/community";
import "./globals.css";

export const metadata: Metadata = { title: { default:"另有解 · 社区广场", template:"%s · 另有解" }, description:"所谓失败，谁说了算？", robots:{index:false,follow:false} };
export const dynamic = "force-dynamic";

export default async function RootLayout({children}: {children:ReactNode}) {
  const [current,categories]=await Promise.all([session(),topics()]);
  const id=current?.user.id;
  const [total,admin]=id?await Promise.all([unread(id),adminStatus(id)]):[0,false];
  const badge=total>0?<span className="badge" aria-label={total+" 条未读"}>{total>99?"99+":total}</span>:null;
  return <html lang="zh-CN"><body>
    <header className="topbar"><div className="wrap">
      <Link href="/" className="logo"><span className="logo-mark" aria-hidden="true"/><span><span className="logo-name">另有解</span><span className="logo-caption">所谓失败，谁说了算？</span></span></Link>
      <form className="search" action="/" role="search">
        <input name="q" type="search" maxLength={80} aria-label="搜索帖子" placeholder="搜索帖子"/>
        <button type="submit" className="quiet-link">搜索</button>
      </form>
      <div className="actions top-actions">
        <Link href="/notice" className="quiet-link desktop">消息 {badge}</Link><Link href="/write" className="btn primary desktop">＋ 发帖</Link>
        {current?<Link href="/me" className="quiet-link account-name">{current.user.name}</Link>:<Link href="/login" className="btn">登录</Link>}
      </div>
    </div></header>
    <div className="wrap layout">
      <aside className="left"><nav aria-label="主题与社区">
        <Link href="/">社区广场</Link>
        {categories.map(t=><Link key={t.slug} href={"/?topic="+t.slug}><span aria-hidden="true">{t.mark}</span>{t.name}</Link>)}
        <Link href="/rules">社区约定</Link>{admin?<Link href="/admin">管理队列</Link>:null}
      </nav></aside>
      <main className="main">{children}</main>
    </div>
    <nav className="mobile-nav" aria-label="移动导航"><Link href="/">广场</Link><Link href="/topics">主题</Link><Link href="/write">发帖</Link><Link href="/notice">消息 {badge}</Link><Link href="/me">我的</Link></nav>
  </body></html>;
}
