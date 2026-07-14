// 这个文件配置 Vite、React 插件和 Vitest 测试环境。
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const apiPort = process.env.IDEA_API_PORT ?? "8787";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}", "server/**/*.test.ts"],
    setupFiles: "./src/test/setup.ts",
  },
});
