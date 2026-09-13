/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        dark: '#0F1419',
        card: '#17202b',
        'card-light': '#2d3748',
        'input-dark': '#1a1f2e',
        primary: '#00A651',
        'primary-teal': '#1dd1a1',
        'primary-dark': '#008C44',
        'primary-light': '#00C96A',
        'secondary-purple': '#5f27cd',
        'secondary-blue': '#0984e3',
        'text-primary': '#ffffff',
        'text-secondary': '#b0bec5',
        'border-dark': 'rgba(255, 255, 255, 0.1)',
        danger: '#ee5a6f',
        success: '#1dd1a1',
        warning: '#F39C12',
      },
    },
  },
  plugins: [],
}
