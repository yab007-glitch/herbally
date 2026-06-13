import nextConfig from "eslint-config-next";

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  {
    ignores: ["coverage/**", ".next/**", "node_modules/**"],
  },
  ...(Array.isArray(nextConfig) ? nextConfig : [nextConfig]).map((config) => {
    if (config.plugins && "@typescript-eslint" in config.plugins) {
      return {
        ...config,
        rules: {
          ...config.rules,
          "@typescript-eslint/no-unused-vars": [
            "warn",
            { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
          ],
          "@typescript-eslint/no-explicit-any": "warn",
        },
      };
    }
    return config;
  }),
];

export default eslintConfig;
