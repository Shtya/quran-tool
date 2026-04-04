/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#1F7A63",
        secondary: "#E8F3EF",
        background: "#FDFBF7",
        accent: "#C8A96A",
        error: "#D64545",
      },
      fontFamily: {
        arabic: ["Amiri", "serif"],
      },
    },
  },
  plugins: [],
};
