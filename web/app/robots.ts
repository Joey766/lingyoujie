import type { MetadataRoute } from "next";
import { origin } from "@/lib/auth";
import { indexingEnabled } from "@/lib/indexing";

export default function robots(): MetadataRoute.Robots {
  if (!indexingEnabled()) return {rules: {userAgent: "*", disallow: "/"}};
  return {rules: {userAgent: "*", allow: "/", disallow: ["/api/", "/editorial"]}, sitemap: origin() + "/sitemap.xml"};
}
