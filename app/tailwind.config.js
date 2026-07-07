// 这个文件定义 MVP 使用的 Tailwind 扫描范围和设计 token。
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          500: "#6B7280",
          700: "#374151",
          900: "#111827",
        },
        paper: {
          0: "#FFFFFF",
          50: "#F9F8F4",
          100: "#F6F6F1",
        },
        line: {
          100: "#E9E5DA",
        },
        spark: {
          500: "#FF5701",
          600: "#E64D00",
        },
        rose: {
          100: "#F2D9DC",
        },
        mint: {
          100: "#D9F2D8",
        },
        sky: {
          100: "#DCEBFF",
        },
        violet: {
          100: "#E9DDFB",
        },
        yellow: {
          100: "#FFF1C2",
        },
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans SC", "Microsoft YaHei", "system-ui", "sans-serif"],
        serif: ["Noto Serif SC", "Source Han Serif SC", "serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        soft: "0 18px 45px rgba(17, 24, 39, 0.08)",
      },
    },
  },
  plugins: [],
};
