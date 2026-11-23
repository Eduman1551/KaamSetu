/** @type {import('tailwindcss').Config} */
// Colours are CSS variables (see styles/globals.css) so the same classes render the
// dark landing/auth look by default and the warm light theme inside `.theme-light`
// (all dashboards). Semantic roles:
//   navy*   = surfaces (page, card, inset)       ink     = text
//   saffron = primary accent                     teal    = good / verified (sage in light)
//   miss    = gap / missing (terracotta)         sky     = info / demand (muted blue)
//   violet  = college role colour (sage in light)
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

module.exports = {
  content: ['./pages/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: v('navy'),
          950: v('navy-950'),
          900: v('navy'),
          800: v('navy-800'),
          700: v('navy-700'),
        },
        saffron: v('saffron'),
        teal: v('teal'),
        miss: v('miss'),
        ink: v('ink'),
        sky: v('sky'),
        violet: v('violet'),
        sand: v('sand'),
      },
      fontFamily: {
        heading: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glass: 'var(--shadow-card)',
        glow: '0 0 0 1px rgba(255,153,51,0.55), 0 6px 20px rgba(255,153,51,0.28)',
      },
      maxWidth: { prose: '65ch' },
    },
  },
  plugins: [],
};
