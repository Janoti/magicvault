/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Cinzel"', 'serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        vault: {
          bg: '#0d0f1a',
          surface: '#131627',
          card: '#1a1f35',
          border: '#252b47',
          accent: '#6c5ce7',
          'accent-hover': '#7d6ef5',
          gold: '#f0c040',
          'gold-dim': '#a08020',
          muted: '#8892b0',
          text: '#e2e8f0',
        },
        magic: {
          white: '#f8f0d8',
          blue: '#3a7ab5',
          black: '#9b2aa3',
          red: '#d64f1e',
          green: '#2e7d32',
          gold: '#d4a017',
          colorless: '#a0a0a0',
        }
      },
      backgroundImage: {
        'vault-gradient': 'radial-gradient(ellipse at top, #1a1f35 0%, #0d0f1a 70%)',
      }
    },
  },
  plugins: [],
}
