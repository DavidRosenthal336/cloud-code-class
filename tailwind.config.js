/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0A1F44',
          deep: '#061635',
          soft: '#1A3060',
        },
        gold: {
          DEFAULT: '#B08D57',
          soft: '#C9A878',
        },
        slate: {
          ink: '#1F2937',
        },
      },
      fontFamily: {
        serif: ['"Times New Roman"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
