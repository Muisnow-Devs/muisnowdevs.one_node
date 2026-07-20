import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [tailwindcss(), reactRouter(), svgr()],
    resolve: {
        tsconfigPaths: true,
    },
    optimizeDeps: {
        // exclude: ["react-syntax-highlighter"],
    },
});
