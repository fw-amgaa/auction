import next from "eslint-config-next/core-web-vitals";

// Next 16 removed `next lint`; eslint-config-next now ships a native flat-config
// array (core-web-vitals already includes the base TypeScript rules).
const config = [
  ...next,
  {
    rules: {
      // React Compiler rules newly bundled by Next 16's eslint-config-next.
      // They flag pre-existing component patterns (a 1s ticking clock's
      // setState-in-effect, Date.now() during render, etc.) that are unrelated
      // to the auth/package migration. Keep them visible as warnings rather
      // than failing the build; address them in a separate pass.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
];

export default config;
