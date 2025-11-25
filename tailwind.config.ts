import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

export default {
  content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Noto Sans TC",
          "Poppins"
        ],
        mono: [
          "Fira Code"
        ]
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "width-down": {
          "0%": { width: "100%", left: "0%" },
          "100%": { width: "0%", left: "100%" },
        },
        "bounce-left": {
          "0%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(-5px)" },
          "100%": { transform: "translateX(0)" },
        },
        "bounce-right": {
          "0%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(5px)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in ease-in-out",
        "width-down": "width-down ease-in-out",
        "bounce-left": "bounce-left .3s linear",
        "bounce-right": "bounce-right .3s linear",
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    plugin(function ({ matchUtilities, theme }) {
      matchUtilities(
        {
          'animate-duration': (value) => ({
            animationDuration: value,
          }),
        },
        { values: theme('transitionDuration') }
      )
    }),
    plugin(function ({ matchUtilities, theme }) {
      matchUtilities(
        {
          'animate-delay': (value) => ({
            animationDelay: value,
          }),
        },
        { values: theme('transitionDelay') }
      )
    }),
    plugin(function ({ matchUtilities, theme }) {
      matchUtilities(
        {
          'animate-ease': (value) => ({
            animationTimingFunction: value,
          }),
        },
        { values: theme('transitionTimingFunction') }
      )
    }),
  ],
} satisfies Config;
