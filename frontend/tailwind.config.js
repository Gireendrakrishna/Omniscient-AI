/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        omniscient: {
          bg: "#000000",
          secondaryBg: "#0A0A0A",
          card: "#111111",
          gold: "#D4AF37",
          darkGold: "#AA8529",
          red: "#B22222",
          textPrimary: "#FFFFFF",
          textSecondary: "#BDBDBD",
          textMuted: "#777777",
        },
      },
    },
  },
  plugins: [],
};
