import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#0F1F3D",
        green: "#00C48C",
      },
      boxShadow: {
        soft: "0 24px 60px -24px rgba(15, 31, 61, 0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
