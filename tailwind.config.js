/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#2563eb",
          hover: "#1d4ed8",
          muted: "#dbeafe",
        },
        surface: {
          DEFAULT: "#ffffff",
          secondary: "#f9fafb",
          tertiary: "#f3f4f6",
          inverted: "#111827",
        },
        border: {
          DEFAULT: "#e5e7eb",
          focus: "#2563eb",
        },
        reader: {
          bg: "#faf9f7",
          "text-primary": "#1a1a1a",
          "text-secondary": "#6b6b6b",
          link: "#2563eb",
          "blockquote-border": "#2563eb",
          "code-bg": "#f3f4f6",
        },
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "-apple-system", "sans-serif"],
        serif: ['"Merriweather"', "Georgia", "serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
      },
    },
  },
  plugins: [],
};
