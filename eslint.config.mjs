import nextConfig from "eslint-config-next";

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  {
    // Globstar on every entry so nested copies are covered too: `eslint .`
    // descends into `.worktrees/<branch>/`, where each worktree carries its
    // own `.next/` (including `.next/standalone/` symlinks that dangle) and
    // crashed the run with ENOENT instead of linting. Local lint must not
    // depend on which sibling worktrees happen to exist.
    ignores: [
      "**/coverage/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/.worktrees/**",
    ],
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
