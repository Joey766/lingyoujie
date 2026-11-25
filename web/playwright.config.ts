import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(".local/browsers")) {
  process.env.PLAYWRIGHT_BROWSERS_PATH=resolve(".local/browsers");
}
export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.ts",
  workers: 1,
  timeout: 120_000,
  expect: {timeout:12_000},
  use: {baseURL:process.env.APP_URL || "http://127.0.0.1:3000", actionTimeout:12_000, trace:"off", screenshot:"off"},
});
