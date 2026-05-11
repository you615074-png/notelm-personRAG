/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0066cc",
          focus: "#0071e3",
          "on-dark": "#2997ff",
        },
        ink: {
          DEFAULT: "#1d1d1f",
          muted: "#333333",
          secondary: "#7a7a7a",
        },
        surface: {
          canvas: "#ffffff",
          parchment: "#f5f5f7",
          pearl: "#fafafc",
        },
        hairline: {
          DEFAULT: "#e0e0e0",
          soft: "rgba(0,0,0,0.04)",
        },
      },
      fontFamily: {
        sans: [
          "SF Pro Text",
          "SF Pro Display",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "sans-serif",
        ],
      },
      fontSize: {
        "apple-body": ["17px", { lineHeight: "1.47", letterSpacing: "-0.022em" }],
        "apple-body-strong": ["17px", { lineHeight: "1.24", letterSpacing: "-0.022em", fontWeight: "600" }],
        "apple-caption": ["14px", { lineHeight: "1.29", letterSpacing: "-0.016em" }],
        "apple-fine": ["12px", { lineHeight: "1.0", letterSpacing: "-0.01em" }],
        "apple-tagline": ["21px", { lineHeight: "1.19", letterSpacing: "0.011em", fontWeight: "600" }],
      },
      borderRadius: {
        pill: "980px",
        "apple-card": "18px",
        "apple-btn-sm": "8px",
      },
      spacing: {
        section: "80px",
      },
    },
  },
  plugins: [],
}
