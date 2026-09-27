// Lints the root scripts, the database tests and packages/ with the web app's
// rules. Each app lints itself, so apps/ is skipped here.
import web from "./apps/web/eslint.config.mjs";

const eslintConfig = [
  ...web,
  {
    settings: {
      // Nothing at the root uses React; this only stops the plugin looking
      // for a react package it can't see from here.
      react: { version: "19" },
      next: { rootDir: "apps/web/" },
    },
  },
  { ignores: ["apps/**"] },
];

export default eslintConfig;
