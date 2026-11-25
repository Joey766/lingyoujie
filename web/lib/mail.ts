import "server-only";
import { createHmac } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import nodemailer from "nodemailer";
import { authPool } from "./db";

export function smtpConfigured() {
  return process.env.MAIL_MODE === "smtp" && ["SMTP_HOST","SMTP_USER","SMTP_PASSWORD","MAIL_FROM"]
    .every(key=>Boolean(process.env[key]?.trim()));
}

async function reserveDelivery(to: string) {
  const secret=process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("Email sending requires the authentication secret");
  const count=Number(process.env.MAIL_DAILY_LIMIT ?? "100");
  const dailyLimit=Number.isSafeInteger(count) && count>0 ? count : 100;
  const recipient=createHmac("sha256",secret).update(to.trim().toLowerCase()).digest("hex");
  const limits: [string,number,number][]=[
    ["smtp:recipient:"+recipient,60,1],
    ["smtp:global",86400,dailyLimit],
  ];
  const client=await authPool().connect();
  try {
    await client.query("begin");
    for (const [key,seconds,limit] of limits) {
      const allowed=await client.query(
        "insert into public.auth_attempt (key,hits,expires_at) values ($1,1,now()+$2*interval '1 second') " +
        "on conflict (key) do update set hits=case when auth_attempt.expires_at<=now() then 1 else auth_attempt.hits+1 end, " +
        "expires_at=case when auth_attempt.expires_at<=now() then excluded.expires_at else auth_attempt.expires_at end " +
        "where auth_attempt.expires_at<=now() or auth_attempt.hits<$3 returning hits",[key,seconds,limit]);
      if (!allowed.rowCount) throw new Error("Email sending is temporarily rate limited");
    }
    await client.query("commit");
  } catch(error) {
    await client.query("rollback").catch(()=>{});
    throw error;
  } finally {
    client.release();
  }
}

export async function deliver(kind: "verify" | "reset", to: string, url: string) {
  const origin = new URL(process.env.APP_URL || "http://127.0.0.1:3000");
  if (process.env.MAIL_MODE === "local" && origin.hostname === "127.0.0.1") {
    await mkdir(".local", { recursive: true });
    await appendFile(".local/mail.ndjson", JSON.stringify({ kind, to, url, time: Date.now() }) + "\n", { mode: 0o600 });
    return;
  }
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM } = process.env;
  if (process.env.MAIL_MODE !== "smtp" || !SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !MAIL_FROM) {
    throw new Error("Email transport is not configured");
  }
  await reserveDelivery(to);
  const port = Number(SMTP_PORT || 587);
  const mailer = nodemailer.createTransport({
    host: SMTP_HOST, port, secure: port === 465, requireTLS: port !== 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
  await mailer.sendMail({
    from: MAIL_FROM, to,
    subject: kind === "verify" ? "验证你的另有解邮箱" : "重置你的另有解密码",
    text: (kind === "verify" ? "请打开链接验证邮箱。" : "请打开链接重置密码。") + "\n\n" + url + "\n\n如未发起请求，请忽略此邮件。",
  });
}
