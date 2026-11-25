import "server-only";
import { isIP } from "node:net";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { cache } from "react";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { authPool } from "./db";
import { deliver, smtpConfigured } from "./mail";

export const usernamePattern = /^[a-z0-9_]{3,24}$/;
export function origin() {
  const deploymentHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const fallback = deploymentHost ? `https://${deploymentHost}` : "http://127.0.0.1:3000";
  const value = new URL(process.env.APP_URL || fallback);
  if (value.protocol !== "https:" && value.hostname !== "127.0.0.1") {
    throw new Error("APP_URL must be HTTPS outside the local loopback");
  }
  return value.origin;
}

export function registrationAllowed(email: string) {
  if (process.env.REGISTRATION_MODE === "local" && new URL(origin()).hostname === "127.0.0.1") {
    return email.endsWith("@local.test");
  }
  if (process.env.REGISTRATION_MODE === "public") return smtpConfigured();
  if (process.env.REGISTRATION_MODE !== "invite") return false;
  return (process.env.REGISTRATION_EMAILS || "").split(",").map(value => value.trim().toLowerCase()).includes(email);
}

export function ingressHeaders(input: Headers) {
  const result = new Headers(input);
  const name = process.env.TRUSTED_IP_HEADER || (process.env.VERCEL === "1" ? "x-vercel-forwarded-for" : undefined);
  const candidate = name ? input.get(name)?.split(",")[0]?.trim() ?? "" : "";
  // With no trusted proxy, enforce a shared bucket rather than trust spoofable headers.
  result.set("x-lyj-rate-ip", isIP(candidate) ? candidate : "127.0.0.1");
  return result;
}

export const authHeaders = async () => ingressHeaders(new Headers(await headers()));

const authLimits: Record<string,{seconds:number;max:number}> = {
  "/sign-in/email": {seconds:60,max:8},
  "/sign-up/email": {seconds:600,max:5},
  "/request-password-reset": {seconds:600,max:5},
  "/send-verification-email": {seconds:600,max:5},
};

async function limitAttempt(path:string, supplied?:Headers) {
  const limit=authLimits[path];
  if (!limit) return;
  const ip=supplied?.get("x-lyj-rate-ip") || "127.0.0.1";
  const key=createHash("sha256").update(path+":"+ip).digest("hex");
  const result=await authPool().query<{hits:number}>(
    "insert into public.auth_attempt(key,hits,expires_at) values($1,1,now()+$2*interval '1 second') " +
    "on conflict (key) do update set hits=case when auth_attempt.expires_at<=now() then 1 else least(auth_attempt.hits+1,1000) end, " +
    "expires_at=case when auth_attempt.expires_at<=now() then excluded.expires_at else auth_attempt.expires_at end returning hits", [key,limit.seconds]);
  if (result.rows[0].hits>limit.max) throw new APIError("TOO_MANY_REQUESTS",{message:"Too many attempts"});
}

function createAuth() {
  const baseURL = origin();
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("BETTER_AUTH_SECRET must be at least 32 characters");
  return betterAuth({
    appName: "另有解", baseURL, secret, trustedOrigins: [baseURL],
    database: authPool(),
    user: { additionalFields: { username: { type: "string", required: true, input: true, unique: true } } },
    emailAndPassword: {
      enabled: true, requireEmailVerification: true, minPasswordLength: 12, maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 1800, revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({ user, url }) => deliver("reset", user.email, url),
    },
    emailVerification: {
      sendOnSignUp: true, autoSignInAfterVerification: false, expiresIn: 3600,
      sendVerificationEmail: ({ user, url }) => deliver("verify", user.email, url),
    },
    session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    rateLimit: {
      enabled: true, storage: "database", window: 60, max: 80,
      customRules: {
        "/sign-in/email": { window: 60, max: 8 },
        "/sign-up/email": { window: 600, max: 5 },
        "/request-password-reset": { window: 600, max: 5 },
        "/send-verification-email": { window: 600, max: 5 },
      },
    },
    advanced: { useSecureCookies: baseURL.startsWith("https:"), ipAddress: { ipAddressHeaders: ["x-lyj-rate-ip"] } },
    hooks: {
      before: createAuthMiddleware(async ctx => {
        await limitAttempt(ctx.path,ctx.headers);
        if (ctx.path === "/sign-up/email") {
          const { email, username, name } = ctx.body ?? {};
          if (typeof email !== "string" || !registrationAllowed(email.trim().toLowerCase())) {
            throw new APIError("FORBIDDEN", { message: "Registration is invitation only" });
          }
          if (typeof username !== "string" || !usernamePattern.test(username) || typeof name !== "string" || name.trim().length < 1 || name.length > 32) {
            throw new APIError("BAD_REQUEST", { message: "Invalid username or display name" });
          }
          const result = await authPool().query('select 1 from public."user" where username=$1', [username]);
          if (result.rowCount) throw new APIError("CONFLICT", { message: "USERNAME_TAKEN" });
        }
        if (ctx.path === "/update-user") {
          if (ctx.body?.username !== undefined) throw new APIError("FORBIDDEN", { message: "Username is immutable" });
          if (ctx.body?.name !== undefined && (typeof ctx.body.name !== "string" || !ctx.body.name.trim() || ctx.body.name.length > 32)) {
            throw new APIError("BAD_REQUEST", { message: "Invalid display name" });
          }
        }
      }),
    },
    plugins: [nextCookies()],
  });
}

let instance: ReturnType<typeof createAuth> | undefined;
export const auth = () => instance ??= createAuth();
export const session = cache(async () => {
  const value = await auth().api.getSession({ headers: await authHeaders() });
  return value?.user.emailVerified ? value : null;
});
