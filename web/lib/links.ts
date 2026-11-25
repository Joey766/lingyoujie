export function safeReturn(value: unknown, fallback = "/") {
  if (typeof value!=="string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const url = new URL(value, "https://lyj.invalid");
    if (url.origin !== "https://lyj.invalid") return fallback;
    if (!/^\/(?:p\/[0-9a-f-]+(?:\/edit)?|me|notice|admin|write)?$/i.test(url.pathname)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

export function withStatus(path: string, value: string) {
  const url = new URL(path, "https://lyj.invalid");
  url.searchParams.set("status", value);
  return url.pathname + url.search + url.hash;
}
