import js from "@eslint/js"
import prettierConfig from "eslint-config-prettier"
import react from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import globals from "globals"
import tseslint from "typescript-eslint"

export default tseslint.config(
  {ignores: ["out/", "release/"]},
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", {argsIgnorePattern: "^_"}],
    },
  },
  {
    files: ["*.cjs"],
    languageOptions: {sourceType: "commonjs", globals: globals.node},
    rules: {"@typescript-eslint/no-require-imports": "off"},
  },
  {
    files: ["src/main/**", "src/preload/**", "src/shared/**", "scripts/**"],
    languageOptions: {globals: globals.node},
  },
  {
    files: ["src/renderer/**"],
    ...react.configs.flat.recommended,
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: globals.browser,
    },
    plugins: {react, "react-hooks": reactHooks},
    settings: {react: {version: "detect"}},
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      "react/prop-types": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  prettierConfig
)
