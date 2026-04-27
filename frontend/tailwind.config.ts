import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0f1117',
        accent: '#FFC107',
        'accent-light': '#FFEB3B',
        'accent-dark': '#FF8F00',
        secondary: '#1A1A1A',
        success: '#00C853',
        warning: '#FF6F00',
        danger: '#EF4444',
        'page-bg': '#f5f6fa',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 10px 25px -5px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04)',
        'yellow': '0 10px 30px -5px rgba(255, 193, 7, 0.3)',
        'yellow-lg': '0 20px 40px -10px rgba(255, 193, 7, 0.4)',
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        'slide-up': 'slide-up 0.5s ease-out both',
        'scale-in': 'scale-in 0.3s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
