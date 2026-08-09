import type { Config } from "@react-router/dev/config";

export default {
    // Config options...
    // Server-side render by default, to enable SPA mode set this to `false`
    ssr: true,
    future: {
        // Required for the route `middleware` export that guards /dashboard.
        // See app/routes/dashboard.tsx.
        v8_middleware: true,
    },
} satisfies Config;
