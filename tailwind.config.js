/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./Public/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        'cream': '#fbf1e3', 
        'cream-dark': '#e9decb', 
        'cream-darker': '#d1c5b4',
        'border-muted': '#d1c5b4',
        'primary': '#007aff',
        'primary-hover': '#005ecb',
        'text-primary': '#1c1c1e',
        'text-secondary': '#636366',
        'surface': '#ffffff',
        'winner-bg': '#e5f2ff',
        'winner-border': '#007aff',
        'winner-badge': '#007aff',
        'status-success': '#28a745',
        'status-running': '#6c757d',
        'status-error': '#dc3545',
        'amazon-orange': '#FF9900',
        'amazon-dark': '#000000',
        'flipkart-yellow': '#F8D706',
        'flipkart-blue': '#1F74BA',
      },
      fontFamily: {
        'serif': ['Georgia', 'Times New Roman', 'serif'],
        'sans': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0, transform: 'translateY(10px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
      }
    },
  },
  plugins: [],
}