import daisyui from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#090d16',
        surface: '#0f172a',
        border: '#1e293b',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        dark: {
          "primary": "#8b5cf6",
          "secondary": "#10b981",
          "accent": "#06b6d4",
          "neutral": "#1e293b",
          "base-100": "#0b0f19",
          "base-200": "#111827",
          "base-300": "#1f2937",
          "info": "#38bdf8",
          "success": "#34d399",
          "warning": "#fbbf24",
          "error": "#f43f5e",
        },
      },
    ],
  },
}
