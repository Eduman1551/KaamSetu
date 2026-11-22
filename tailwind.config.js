/** @type {import('tailwindcss').Config} */
// Palette: navy base, saffron accent, teal = good / verified, soft red = missing / gap.
// Role chips: student = saffron, company = sky, college = violet (badges + active nav only).
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
        sky: '#60A5FA',
        violet: '#A78BFA',
      },
      fontFamily: {
        heading: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glass: '0 8px 30px rgba(0, 0, 0, 0.28)',
        glow: '0 0 0 1px rgba(255,153,51,0.55), 0 6px 20px rgba(255,153,51,0.28)',
      },
      maxWidth: { prose: '65ch' },
    },
  },
  plugins: [],
};
