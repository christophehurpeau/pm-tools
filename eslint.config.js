import pobConfig from "@pob/eslint-config";

export default [
  ...pobConfig(import.meta.url).configs.node,
  {
    settings: {
      "import-x/core-modules": ["bun", "bun:test"],
    },
  },
  {
    ignores: ["packages/*/test/fixtures/**/*.json"],
  },
  {
    files: ["**/*.ts"],
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
