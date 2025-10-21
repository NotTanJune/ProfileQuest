/** @type {import('tailwindcss').Config} */
export default {
  content: ['./public/index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Fraunces', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif']
      },
      colors: {
        main: '#FFDAB3', // Main Bg
        mainSoft: '#FFE6C9',
        mainMuted: '#F5CDA6',
        mainStrong: '#FFC38A',
        accent: '#574964', // Primary accent (dark for text/nav)
        accentLight: '#766A84',
        accentMuted: '#7A7088',
        accentDark: '#3E334B',
        accentAlt: '#9F8383', // Secondary accent
        accentAltLight: '#B79C9C',
        accentAltMuted: '#A88E8E',
        accentAltDark: '#7E6868',
        complementary: '#C8AAAA', // Complementary
        complementaryLight: '#E0C9C9',
        complementaryDark: '#A98D8D',
        // Surfaces / neutrals tuned to the palette
        surface: '#FFF4EA',
        surfaceAlt: '#FAE8D8',
        ink: '#2E2536',
        inkMuted: '#5D5165'
      },
      boxShadow: {
        glass: '0 10px 30px rgba(0,0,0,0.10)'
      }
    },
  },
  plugins: [],
};


