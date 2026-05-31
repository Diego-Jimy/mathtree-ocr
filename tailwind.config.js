/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        panel: "0 24px 70px rgba(7, 17, 31, 0.18)",
        glow: "0 0 36px rgba(45, 212, 191, 0.28)"
      }
    }
  },
  plugins: []
};
