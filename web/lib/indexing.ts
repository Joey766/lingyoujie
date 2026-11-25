import "server-only";

export function indexingEnabled() {
  return process.env.VERCEL_ENV === "production" && process.env.PUBLIC_INDEXING === "1";
}
