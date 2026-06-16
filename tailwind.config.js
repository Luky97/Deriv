/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          900: '#050816',
          800: '#0B1020',
          700: '#1a1f3a',
          600: '#252d47',
        },
        neon: {
          blue: '#00D9FF',
          cyan: '#00F0FF',
          green: '#00FF9F',
          purple: '#B847FF',
          pink: '#FF006E',
          orange: '#FFA500',
          red: '#FF0055',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      boxShadow: {
        'neon-blue': '0 0 20px rgba(0, 217, 255, 0.5), 0 0 40px rgba(0, 217, 255, 0.3)',
        'neon-green': '0 0 20px rgba(0, 255, 159, 0.5), 0 0 40px rgba(0, 255, 159, 0.3)',
        'neon-purple': '0 0 20px rgba(184, 71, 255, 0.5), 0 0 40px rgba(184, 71, 255, 0.3)',
        'glow-blue': '0 0 30px rgba(0, 217, 255, 0.8)',
        'glow-green': '0 0 30px rgba(0, 255, 159, 0.8)',
        'glow-red': '0 0 30px rgba(255, 0, 85, 0.8)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'neon-flicker': 'neon-flicker 3s infinite',
        'slide-in': 'slide-in 0.3s ease-out',
        'float': 'float 3s ease-in-out infinite',
        'border-pulse': 'border-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', textShadow: '0 0 10px rgba(0, 217, 255, 0.8)' },
          '50%': { opacity: '0.5', textShadow: '0 0 20px rgba(0, 217, 255, 0.4)' },
        },
        'neon-flicker': {
          '0%, 19%, 21%, 23%, 25%, 54%, 56%, 100%': { opacity: '1' },
          '20%, 24%, 55%': { opacity: '0.5' },
        },
        'slide-in': {
          'from': { opacity: '0', transform: 'translateY(10px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'border-pulse': {
          '0%, 100%': { borderColor: 'rgba(0, 217, 255, 0.5)' },
          '50%': { borderColor: 'rgba(0, 217, 255, 0.1)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
