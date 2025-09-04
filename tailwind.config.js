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
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Monaco', 'Menlo', 'monospace'],
      },
      colors: {
        // CSS variables for dynamic theming
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        edge: 'var(--edge)',
        accent: 'var(--accent)',
        accent2: 'var(--accent2)',
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        danger: 'var(--danger)',
        // Legacy colors for compatibility
        'asm-blue': '#3b82f6',
        'asm-green': '#10b981',
        'asm-purple': '#8b5cf6',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'neon': '0 0 20px var(--accent)',
        'neon-sm': '0 0 10px var(--accent)',
        'neon-lg': '0 0 40px var(--accent)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
      backdropBlur: {
        'xs': '2px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'grid-move': 'grid-move 20s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px var(--accent)' },
          '100%': { boxShadow: '0 0 40px var(--accent), 0 0 60px var(--accent)' },
        },
        'grid-move': {
          '0%': { transform: 'translate(0, 0)' },
          '100%': { transform: 'translate(40px, 40px)' },
        },
      },
    },
  },
  plugins: [],
}