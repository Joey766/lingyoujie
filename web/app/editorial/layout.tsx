import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { editorialPreviewEnabled } from "@/lib/editorial-preview";

export const metadata: Metadata = { title: "开站内容预览" };

export default function EditorialLayout({ children }: { children: ReactNode }) {
  if (!editorialPreviewEnabled()) notFound();
  return children;
}
