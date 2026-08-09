import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#4F7CFF", dark: "#3B5FCC" },
        brand: { DEFAULT: "#FF9F43", soft: "#FFF3E3" },
        accent: { blue: "#5B9CFF", purple: "#8B7CF6", green: "#34C77B", yellow: "#FFD66B" },
        ink: { DEFAULT: "#2B2D42", secondary: "#6B7194", tertiary: "#A3A8C3" },
        surface: { DEFAULT: "#FFFFFF", raised: "#F4F5FB" },
        bubble: { child: "#EAF0FF", guide: "#FFFFFF" },
        border: { DEFAULT: "#E3E6F2" },
      },
      backgroundColor: { page: "#FAF9F6" },
      borderRadius: { card: "20px", bubble: "20px", btn: "14px" },
      fontSize: {
        "body-2xl": ["1.5rem", { lineHeight: "1.4" }],
        "body-xl": ["1.25rem", { lineHeight: "1.5" }],
        "body-lg": ["1.125rem", { lineHeight: "1.65" }],
        body: ["1rem", { lineHeight: "1.65" }],
        "body-sm": ["0.875rem", { lineHeight: "1.6" }],
        "body-xs": ["0.75rem", { lineHeight: "1rem", fontWeight: "400" }],
        caption: ["0.75rem", { lineHeight: "1.5" }],
      },
      fontFamily: {
        base: ['"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', '-apple-system', 'sans-serif'],
        rounded: ['"Baloo 2"', '"PingFang SC"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
