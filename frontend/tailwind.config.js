/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        editor: {
          bg: '#0f0f0f',
          panel: '#1a1a1a',
          border: '#2a2a2a',
          hover: '#333333',
          accent: '#6366f1',
          'accent-hover': '#4f46e5',
          success: '#22c55e',
          warning: '#f59e0b',
          error: '#ef4444',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
