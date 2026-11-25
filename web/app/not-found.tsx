import Link from "next/link";
import { Empty } from "@/components/ui";

export default function NotFound() {
  return <Empty title="找不到这个页面"><Link href="/">返回社区广场</Link></Empty>;
}
