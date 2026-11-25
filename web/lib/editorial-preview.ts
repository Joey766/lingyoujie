import "server-only";
import { origin } from "@/lib/auth";

export function editorialPreviewEnabled() {
  return process.env.REGISTRATION_MODE === "local" && new URL(origin()).hostname === "127.0.0.1";
}
