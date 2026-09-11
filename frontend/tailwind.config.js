/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#07111c",
          900: "#0b1f33",
          800: "#123049",
          700: "#1a4060",
        },
        sea: {
          400: "#4fb0c6",
          500: "#1f6f8b",
          600: "#155a72",
        },
      },
      fontFamily: {
        sans: ["Source Sans 3", "Segoe UI", "system-ui", "sans-serif"],
        display: ["IBM Plex Sans", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
