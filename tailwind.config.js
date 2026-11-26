/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          800: '#161b26',
          900: '#0d1117',
          950: '#080b10',
        },
      },
    },
  },
  plugins: [],
};
