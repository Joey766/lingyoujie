import { auth, ingressHeaders } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function handler(request: Request) {
  return auth().handler(new Request(request, { headers: ingressHeaders(request.headers) }));
}

export { handler as GET, handler as POST };
