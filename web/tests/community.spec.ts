import { expect, test, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

type Member={email:string;name:string;handle:string};
const password="Example-password-4Q-testing";
const nextPassword="Updated-password-8K-testing";

async function mail(email:string,kind:"verify"|"reset") {
  let url="";
  await expect.poll(async () => {
    const messages=await readFile(".local/mail.ndjson","utf8").catch(()=>"");
    for (const line of messages.trim().split("\n").reverse()) {
      try {
        const item=JSON.parse(line) as {to:string;kind:string;url:string};
        if (item.to===email && item.kind===kind) {
          url=item.url;
          return true;
        }
      } catch { /* A concurrent write can leave the final line unfinished. */ }
    }
    return false;
  }).toBe(true);
  return url;
}

async function signup(page:Page,member:Member) {
  await page.goto("/register");
  await page.getByLabel("用户名").fill(member.handle);
  await page.getByLabel("公开昵称").fill(member.name);
  await page.getByLabel("邮箱",{exact:true}).fill(member.email);
  await page.getByLabel("新密码").fill(password);
  await page.getByRole("button",{name:"注册并验证邮箱"}).click();
}

async function signIn(page:Page,email:string,value=password,remember=true) {
  await page.goto("/login");
  await page.getByLabel("邮箱",{exact:true}).fill(email);
  await page.getByLabel("密码",{exact:true}).fill(value);
  await page.getByLabel("保持登录").setChecked(remember);
  await page.getByRole("button",{name:"登录",exact:true}).click();
}

async function publish(page:Page,title:string,body:string,anonymous=false) {
  await page.goto("/write");
  await page.getByLabel("主题",{exact:true}).selectOption("work");
  await page.getByLabel("标题").fill(title);
  await page.getByLabel("正文").fill(body);
  if (anonymous) await page.getByLabel("匿名发布").check();
  await page.getByRole("button",{name:"发布帖子"}).click();
  await expect(page.getByRole("heading",{name:title})).toBeVisible();
  return new URL(page.url()).pathname;
}

async function noOverflow(page:Page) {
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
}

test("本地邮箱、双账号同步、匿名、权限、管理、密码重置以及响应式布局", async ({browser,baseURL},info) => {
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  const key=randomBytes(5).toString("hex");
  const memberA={email:"a"+key+"@local.test",handle:"a_"+key,name:"甲昵称"+key};
  const memberB={email:"b"+key+"@local.test",handle:"b_"+key,name:"乙昵称"+key};
  const ctxA=await browser.newContext({baseURL,viewport:{width:1440,height:900}});
  const ctxB=await browser.newContext({baseURL,viewport:{width:390,height:844}});
  const guest=await browser.newContext({baseURL,viewport:{width:390,height:844}});
  const a=await ctxA.newPage(), b=await ctxB.newPage(), visitor=await guest.newPage();

  await signup(a,memberA);
  await expect(a.getByRole("status")).toContainText("验证链接");
  await signIn(a,memberA.email);
  await expect(a.getByRole("status")).toContainText("先打开验证邮件");
  await a.goto(await mail(memberA.email,"verify"));
  await expect(a.getByRole("status")).toContainText("邮箱已验证");
  await signIn(a,memberA.email);
  await expect(a.getByRole("link",{name:memberA.name,exact:true})).toBeVisible();
  const cookieA=(await ctxA.cookies()).find(c=>c.name.includes("session_token"));
  expect(cookieA?.httpOnly).toBe(true);
  expect(cookieA?.expires).toBeGreaterThan(Date.now()/1000);

  await signup(b,{...memberB,handle:memberA.handle});
  await expect(b.getByRole("status")).toContainText("用户名已经有人使用");
  await signup(b,memberB);
  await expect(b.getByRole("status")).toContainText("验证链接");
  await b.goto(await mail(memberB.email,"verify"));
  await expect(b.getByRole("status")).toContainText("邮箱已验证");
  await signIn(b,memberB.email,password,false);
  await expect(b.getByRole("link",{name:memberB.name,exact:true})).toBeVisible();
  expect((await ctxB.cookies()).find(c=>c.name.includes("session_token"))?.expires).toBe(-1);

  const title="预览验收 "+key+"：刚工作一年，想换一把尺子";
  const edited="预览验收 "+key+"：工作一年后我的新想法";
  const post=await publish(a,title,"这里是本地双账号验收用的文本内容。",true);
  await noOverflow(a);
  await visitor.goto(post);
  await expect(visitor.getByText("匿名楼主",{exact:true})).toBeVisible();
  const html=(await (await visitor.request.get(post)).text());
  expect(html).not.toContain(memberA.email);
  expect(html).not.toContain(memberA.handle);
  expect(html).not.toContain(memberA.name);
  await noOverflow(visitor);
  await b.goto("/?topic=work&q="+key+"&sort=latest");
  await expect(b.getByRole("link",{name:title})).toBeVisible();
  await noOverflow(b);
  await b.screenshot({path:info.outputPath("mobile-feed.png"),caret:"initial"});
  await a.goto("/?topic=work&q="+key+"&sort=latest");
  await expect(a.getByRole("link",{name:title})).toBeVisible();
  await noOverflow(a);
  await a.screenshot({path:info.outputPath("desktop-feed.png"),caret:"initial"});
  await b.getByRole("link",{name:title}).click();
  await expect(b.getByRole("link",{name:"编辑帖子"})).toHaveCount(0);
  await b.getByLabel("参与讨论",{exact:true}).fill("这条匿名评论来自另一个独立账号。");
  await b.getByLabel("匿名评论",{exact:true}).check();
  await b.getByRole("button",{name:"发表评论"}).click();
  await expect(b.getByText("匿名用户 1",{exact:true})).toBeVisible();
  await noOverflow(b);
  await b.screenshot({path:info.outputPath("mobile-discussion.png"),caret:"initial"});
  await b.getByRole("button",{name:"收藏",exact:true}).click();
  await expect(b.getByRole("button",{name:"已收藏",exact:true})).toBeVisible();
  await b.getByRole("button",{name:"共鸣",exact:true}).click();
  await expect(b.getByRole("button",{name:"已共鸣",exact:true})).toBeVisible();
  await b.reload();
  await expect(b.getByRole("paragraph").filter({hasText:"这条匿名评论来自另一个独立账号。"})).toBeVisible();
  await expect(b.getByRole("button",{name:"已收藏",exact:true})).toHaveAttribute("aria-pressed","true");
  await b.goto("/me?tab=saved");
  await expect(b.getByRole("link",{name:title})).toBeVisible();

  await a.goto("/notice");
  await a.getByRole("button",{name:/你的帖子收到新评论/}).first().click();
  await expect(a).toHaveURL(/#c-/);
  const root=a.locator("article.comment").filter({hasText:"这条匿名评论来自另一个独立账号。"});
  await root.getByText("回复",{exact:true}).click();
  await root.getByLabel("回复内容").fill("来自匿名楼主的楼中楼回复。");
  await root.getByRole("button",{name:"发送回复"}).click();
  await expect(a.locator(".nested")).toContainText("来自匿名楼主的楼中楼回复。");
  await a.getByRole("link",{name:"编辑帖子"}).click();
  await a.getByLabel("标题").fill(edited);
  await a.getByRole("button",{name:"保存修改"}).click();
  await expect(a.getByRole("heading",{name:edited})).toBeVisible();

  const ownB=await publish(b,"预览验收 "+key+"：乙的公开帖子","公开作者仅显示昵称。");
  await expect(b.locator("article").getByText(memberB.name,{exact:true})).toBeVisible();
  await b.goto(ownB+"/edit");
  await b.locator('input[name="post"]').evaluate((field,value)=>{ (field as HTMLInputElement).value=value; },post.split("/").pop()!);
  await b.getByLabel("标题").fill("试图越权修改");
  await b.getByRole("button",{name:"保存修改"}).click();
  await expect(b.getByText("找不到这个页面")).toBeVisible();
  await visitor.goto(post);
  await expect(visitor.getByRole("heading",{name:edited})).toBeVisible();
  await expect(visitor.locator(".nested")).toContainText("来自匿名楼主的楼中楼回复。");

  await b.goto("/admin");
  await expect(b.getByText("找不到这个页面")).toBeVisible();
  await b.goto(post);
  const postReport=b.locator("article.panel");
  await postReport.getByText("举报帖子",{exact:true}).click();
  await postReport.getByLabel("举报原因").selectOption("other");
  await postReport.getByRole("button",{name:"提交举报"}).click();
  await expect(b.getByRole("status")).toContainText("已收到举报");

  await promisify(execFile)(process.execPath,["scripts/admin.mjs","--local",memberA.email]);
  await a.goto("/admin");
  await expect(a.getByRole("heading",{name:"举报审核"})).toBeVisible();
  await a.getByRole("button",{name:"隐藏帖子",exact:true}).click();
  await expect(a.getByRole("status")).toContainText("举报已处理");
  await visitor.goto(post);
  await expect(visitor.getByText("找不到这个页面")).toBeVisible();
  await b.goto(ownB);
  await b.getByText("删除帖子",{exact:true}).click();
  await b.getByRole("button",{name:"确认删除帖子"}).click();
  await expect(b.getByRole("status")).toContainText("内容已删除");
  await visitor.goto(ownB);
  await expect(visitor.getByText("找不到这个页面")).toBeVisible();

  await b.goto("/me?tab=settings");
  await b.getByRole("button",{name:"退出登录"}).click();
  await expect(b.getByRole("link",{name:"登录",exact:true})).toBeVisible();
  expect((await ctxB.cookies()).some(c=>c.name.includes("session_token"))).toBe(false);
  await a.goto("/forgot");
  await a.getByLabel("邮箱",{exact:true}).fill(memberA.email);
  await a.getByRole("button",{name:"发送重置链接"}).click();
  await expect(a.getByRole("status")).toContainText("重置邮件");
  await a.goto(await mail(memberA.email,"reset"));
  await a.getByLabel("新密码").fill(nextPassword);
  await a.getByRole("button",{name:"保存新密码"}).click();
  await expect(a.getByRole("status")).toContainText("密码已重置");
  await signIn(a,memberA.email,password);
  await expect(a.getByRole("status")).toContainText("邮箱或密码不正确");
  await signIn(a,memberA.email,nextPassword);
  await expect(a.getByRole("link",{name:memberA.name,exact:true})).toBeVisible();
  await visitor.goto("/");
  await noOverflow(visitor);
  await expect(visitor.getByRole("navigation",{name:"移动导航"})).toBeVisible();

  const statuses:number[]=[];
  for (let attempt=0;attempt<9;attempt++) {
    const response=await visitor.request.post("/api/auth/sign-in/email",{
      headers:{origin:baseURL!},data:{email:memberB.email,password:"A wrong test password"},
    });
    statuses.push(response.status());
    if (response.status()===429) break;
  }
  expect(statuses[0]).toBe(401);
  expect(statuses).toContain(429);

  await Promise.all([ctxA.close(),ctxB.close(),guest.close()]);
});
