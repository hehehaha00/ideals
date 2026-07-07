// 这个文件配置 Vite、React 插件和 Vitest 测试环境。
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "server/**/*.test.ts"],
    setupFiles: "./src/test/setup.ts",
  },
});
