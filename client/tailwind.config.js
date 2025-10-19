/** @type {import('tailwindcss').Config} */
export default {
  content: ['./public/index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        main: '#FFDAB3', // Main Bg
        accent: '#574964', // Primary accent (dark for text/nav)
        accentAlt: '#9F8383', // Secondary accent
        complementary: '#C8AAAA' // Complementary
      },
      boxShadow: {
        glass: '0 10px 30px rgba(0,0,0,0.10)'
      }
    },
  },
  plugins: [],
};


