import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import svgr from "vite-plugin-svgr";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [tailwindcss(), reactRouter(), tsconfigPaths(), svgr()],
    optimizeDeps: {
        // exclude: ["react-syntax-highlighter"],
    },
});
