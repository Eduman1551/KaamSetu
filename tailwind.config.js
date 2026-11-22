/** @type {import('tailwindcss').Config} */
// The palette is deliberately tiny: navy base, saffron accent,
// teal = good / strength, soft red = missing, soft white text.
module.exports = {
  content: ['./pages/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B1B3A',
          950: '#06122A',
          900: '#0B1B3A',
          800: '#112650',
          700: '#183266',
        },
        saffron: '#FF9933',
        teal: '#2DD4BF',
        miss: '#F87171',
        ink: '#F5F7FB',
      },
      fontFamily: {
        heading: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 12px 40px rgba(0, 0, 0, 0.35)',
        glow: '0 0 0 1px rgba(255,153,51,0.6), 0 10px 30px rgba(255,153,51,0.35)',
      },
      borderRadius: { '2.5xl': '1.25rem' },
    },
  },
  plugins: [],
};
