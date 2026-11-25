"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth, authHeaders, origin, registrationAllowed, session, usernamePattern } from "@/lib/auth";
import { safeReturn, withStatus } from "@/lib/links";

function field(form: FormData, key: string) { return String(form.get(key) ?? ""); }
function passwordOK(password: string) { return password.length >= 12 && password.length <= 128; }
function authStatus(error: unknown, fallback: string) {
  if (typeof error !== "object" || !error || !("body" in error)) return fallback;
  const body = error.body as { code?: string; message?: string } | undefined;
  if (body?.message === "USERNAME_TAKEN") return "username";
  if (body?.code === "EMAIL_NOT_VERIFIED") return "verify-first";
  if ("statusCode" in error && error.statusCode === 429) return "slow";
  return fallback;
}

export async function register(form: FormData) {
  const email = field(form, "email").trim().toLowerCase();
  const name = field(form, "name").trim();
  const username = field(form, "username").trim().toLowerCase();
  const password = field(form, "password");
  if (!usernamePattern.test(username) || !name || name.length > 32 || email.length > 254 || !passwordOK(password)) redirect("/register?status=invalid");
  if (!registrationAllowed(email)) redirect("/register?status=invite");
  try {
    await auth().api.signUpEmail({
      headers: await authHeaders(),
      body: { email, password, name, username, callbackURL: origin()+"/login?status=verified" },
    });
  } catch (error) {
    redirect("/register?status=" + authStatus(error,"auth-error"));
  }
  redirect("/login?status=check-email");
}

export async function login(form: FormData) {
  const next = safeReturn(field(form,"next"));
  const failure = "/login?next=" + encodeURIComponent(next);
  const email = field(form,"email").trim().toLowerCase();
  const password = field(form,"password");
  if (!email || email.length > 254 || !password || password.length > 128) redirect(withStatus(failure,"login-error"));
  try {
    await auth().api.signInEmail({
      headers: await authHeaders(),
      body: { email, password, rememberMe: form.get("remember")==="on", callbackURL: origin()+next },
    });
  } catch (error) {
    redirect(withStatus(failure,authStatus(error,"login-error")));
  }
  redirect(next);
}

export async function logout() {
  await auth().api.signOut({ headers: await authHeaders() });
  redirect("/");
}

export async function resendVerification(form: FormData) {
  const email=field(form,"email").trim().toLowerCase();
  if (!email || email.length>254) redirect("/verify?status=invalid");
  try {
    await auth().api.sendVerificationEmail({headers:await authHeaders(),body:{email,callbackURL:origin()+"/login?status=verified"}});
  } catch (error) {
    if (authStatus(error,"verify-sent")==="slow") redirect("/verify?status=slow");
  }
  redirect("/verify?status=verify-sent");
}

export async function requestReset(form: FormData) {
  const email = field(form,"email").trim().toLowerCase();
  if (email && email.length <= 254) {
    try {
      await auth().api.requestPasswordReset({ headers: await authHeaders(), body: { email, redirectTo: origin()+"/reset" } });
    } catch (error) {
      if (authStatus(error,"reset-sent")==="slow") redirect("/forgot?status=slow");
    }
  }
  redirect("/forgot?status=reset-sent");
}

export async function reset(form: FormData) {
  const token = field(form,"token");
  const password = field(form,"password");
  if (!token || token.length > 512) redirect("/forgot?status=expired");
  if (!passwordOK(password)) redirect("/reset?status=invalid&token="+encodeURIComponent(token));
  try {
    await auth().api.resetPassword({ headers: await authHeaders(), body: { token, newPassword: password } });
  } catch {
    redirect("/forgot?status=expired");
  }
  redirect("/login?status=reset-done");
}

export async function changeName(form: FormData) {
  if (!await session()) redirect("/login?next=%2Fme");
  const name=field(form,"name").trim();
  if (!name || name.length>32) redirect("/me?tab=settings&status=invalid");
  try {
    await auth().api.updateUser({ headers: await authHeaders(), body: { name } });
  } catch {
    redirect("/me?tab=settings&status=auth-error");
  }
  revalidatePath("/", "layout");
  redirect("/me?tab=settings&status=profile-saved");
}
