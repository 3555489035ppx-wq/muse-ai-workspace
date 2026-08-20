import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

const phaseZeroFiles = [
  "src/domain/**/*.ts",
  "src/db/**/*.ts",
  "src/repositories/**/*.ts",
  "src/infrastructure/**/*.{ts,tsx}",
  "src/stores/**/*.ts",
  "tests/**/*.{ts,tsx}",
  "server/**/*.ts",
  "scripts/**/*.ts",
];

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      ".phase0-coverage-build/**",
      "node_modules/**",
      "src/**/*.js",
      "src/**/*.jsx",
      "tests/**/*.mjs",
      "scripts/**",
      "worker/**",
      "vite.config.mjs",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: phaseZeroFiles,
  })),
  ...tseslint.configs.stylisticTypeChecked.map((config) => ({
    ...config,
    files: phaseZeroFiles,
  })),
  {
    files: phaseZeroFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
    },
  },
);
