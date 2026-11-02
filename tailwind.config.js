/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mudra: {
          bg: '#050810',
          card: '#0d1117',
          border: '#1f2937',
          green: '#10b981',
          red: '#ef4444',
          gold: '#f59e0b',
          accent: '#6366f1',
          text: '#e2e8f0',
          muted: '#94a3b8',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'ticker': 'ticker 30s linear infinite',
        'pulse-green': 'pulse-green 1s ease-in-out',
        'pulse-red': 'pulse-red 1s ease-in-out',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        'pulse-green': {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'rgba(16,185,129,0.2)' },
        },
        'pulse-red': {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'rgba(239,68,68,0.2)' },
        },
      }
    },
  },
  plugins: [],
}
