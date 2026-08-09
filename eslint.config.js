import js from "@eslint/js";
import { fixupPluginRules } from "@eslint/compat";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
    {
        ignores: [
            "node_modules/",
            "build/",
            ".react-router/",
            ".tokensave/",
            "*.sql",
            "!migrations/*.sql",
        ],
    },
    {
        files: ["**/*.{js,jsx,ts,tsx}"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.node,
                FormDataEntryValue: "readonly",
                React: "readonly",
            },
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        plugins: {
            react: fixupPluginRules(react),
            "jsx-a11y": fixupPluginRules(jsxA11y),
            "react-hooks": fixupPluginRules(reactHooks),
        },
        settings: {
            react: {
                version: "detect",
            },
            formComponents: ["Form"],
            linkComponents: [
                { name: "Link", linkAttribute: "to" },
                { name: "NavLink", linkAttribute: "to" },
            ],
            "import/resolver": {
                typescript: {},
            },
        },
        rules: {
            ...js.configs.recommended.rules,
            ...react.configs.recommended.rules,
            ...react.configs["jsx-runtime"].rules,
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
            ...jsxA11y.configs.recommended.rules,
        },
    },
    {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            parser: tsParser,
        },
        plugins: {
            "@typescript-eslint": fixupPluginRules(tseslint),
            import: fixupPluginRules(importPlugin),
        },
        settings: {
            "import/internal-regex": "^@/",
            "import/resolver": {
                node: {
                    extensions: [".ts", ".tsx"],
                },
                typescript: {
                    alwaysTryTypes: true,
                },
            },
        },
        rules: {
            ...tseslint.configs.recommended.rules,
            ...importPlugin.configs.recommended.rules,
            ...importPlugin.configs.typescript.rules,
            "@typescript-eslint/no-empty-object-type": "off",
            "@typescript-eslint/no-require-imports": "off",
            // tsc already catches undefined identifiers; no-undef false-positives on
            // TypeScript type-only names like RequestInfo/RequestInit.
            "no-undef": "off",
        },
    },
];
