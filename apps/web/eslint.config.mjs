import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Componentes vendored do shadcn/ui (copiados pela CLI) nao foram escritos
    // para as regras estritas novas do react-hooks (purity / set-state-in-effect).
    // Relaxamos so aqui para nao brigar com o codigo gerado nem com `shadcn add`;
    // o codigo proprio do projeto continua sujeito as regras.
    files: ["src/components/ui/**"],
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/incompatible-library": "off",
    },
  },
]);

export default eslintConfig;
