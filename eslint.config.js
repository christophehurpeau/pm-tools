import pobConfig from "@pob/eslint-config";

export default [
  ...pobConfig.configs.node,
  {
    settings: {
      "import-x/core-modules": ["bun", "bun:test"],
    },
  },
  {
    ignores: ["packages/*/test/fixtures/**/*.json"],
  },
  {
    // typescript-eslint 8.71 added these type-aware rules to strictTypeChecked;
    // @pob/eslint-config 67.10 turns the TS program off (oxlint runs typed
    // rules) without turning them off, so eslint crashes on every .ts file.
    files: ["**/*.{ts,cts,mts,tsx}"],
    rules: {
      "@typescript-eslint/no-generated-empty-object-type": "off",
      "@typescript-eslint/no-unsafe-enum-assignment": "off",
    },
  },
  {
    files: ["**/*.{js,mjs,mts,ts,tsx}"],
    rules: {
      // styleText was backported to node 22.13, so every version the packages
      // support has it except the 23.0-23.4 window the engines range admits
      // only in theory. Set here rather than inline: oxlint misreads a
      // three-segment rule name in a disable comment as naming no rule.
      "n/no-unsupported-features/node-builtins": [
        "error",
        { ignores: ["util.styleText"] },
      ],
    },
  },
  {
    files: ["packages/bun-dedup/**/*.ts"],
    rules: {
      "n/hashbang": [
        "error",
        {
          executableMap: {
            ".js": "node",
            ".ts": "bun",
          },
        },
      ],
    },
  },
];
