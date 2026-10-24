import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    // Componentes do shadcn/ui copiados do apps/web: mesmas excecoes de la.
    files: ["src/components/ui/**"],
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/incompatible-library": "off",
    },
  },
  {
    // Fronteira do painel: nada de tela importa o banco ou a sessao do servidor
    // direto; so as paginas e as actions (server) importam `@/lib/server`.
    files: ["src/components/**", "src/hooks/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/lib/server/*", "@/lib/server"], message: "Componentes de tela não importam o servidor: use uma action ou a página." },
            { group: ["@gestarahub/web", "@gestarahub/web/*"], message: "O painel não importa o app dos clientes." },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
