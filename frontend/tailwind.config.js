/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        terminal: {
          bg: '#090b0e',
          panel: '#0e1217',
          subpanel: '#131820',
          border: '#1c232d',
          borderLight: '#2a3443',
          muted: '#64748b',
          dim: '#475569',
          text: '#e2e8f0',
          bright: '#f8fafc',
        }
      }
    },
  },
  plugins: [],
}
