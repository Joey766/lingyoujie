import { redirect } from "next/navigation";
import { login } from "@/app/actions/auth";
import { AuthPanel, EmailField, LoginLinks, PasswordField, type Search } from "@/components/auth-forms";
import { session } from "@/lib/auth";
import { safeReturn } from "@/lib/links";

export default async function LoginPage({searchParams}: {searchParams:Search}) {
  const {status,next,error}=await searchParams;
  const destination=safeReturn(next??"/");
  if (await session()) redirect(destination);
  return <AuthPanel title="登录" status={error?"expired":status}>
    <form className="stack" action={login}>
      <input type="hidden" name="next" value={destination}/>
      <EmailField/><PasswordField existing/>
      <label className="check"><input type="checkbox" name="remember" defaultChecked/>保持登录</label>
      <div><button className="btn primary">登录</button></div>
    </form>
    <LoginLinks/>
  </AuthPanel>;
}
