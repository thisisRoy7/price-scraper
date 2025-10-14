/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  // 👇 THIS IS THE CORRECTED LINE
  content: ["./public/**/*.{html,js}"],

  safelist: [
    'border-amazon',
    'border-flipkart',
    'hover:border-amazon',
    'hover:border-flipkart',
    'group-hover:text-amazon',
    'group-hover:text-flipkart'
  ],
  theme: {
    extend: {
      fontFamily: {
        'serif': ['"Playfair Display"', ...defaultTheme.fontFamily.serif],
      },
      colors: {
        'surface': '#f8fafc',
        'container': '#e3e7e9',
        'primary': '#6b7c85',
        'primary-hover': '#0f172a',
        'accent': '#334152',
        'text-primary': '#353e43',
        'text-secondary': '#6b7c85',
        'border-light': '#cbd5e1',
        'border-muted': '#94a3b8',
        'amazon': '#FF9900',
        'flipkart': '#2874F0',
        'success': '#16a34a',
        'danger': '#dc2626',
        'warning': '#f59e0b',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out forwards',
      }
    },
  },
  plugins: [],
}