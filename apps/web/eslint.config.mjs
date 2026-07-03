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

  // --- Fronteiras de arquitetura (MFE-readiness, ver docs/frontend/01) ---
  // OBS: no flat config, blocos com a MESMA regra nao mesclam — o ultimo que
  // casa vence. Por isso cada escopo carrega TODOS os seus patterns num bloco so,
  // e a excecao do auth vem por ultimo (sobrescreve o bloco de features).
  {
    // Design system (ui/form/shared) + libs + config: camada compartilhada
    // (futuro @gestarahub/ui). Nao depende de features nem toca o mock store.
    files: [
      "src/components/ui/**",
      "src/components/form/**",
      "src/components/shared/**",
      "src/lib/**",
      "src/config/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*", "@/features/*/**"],
              message: "Camada compartilhada nao pode importar de features.",
            },
            {
              group: ["@/mocks", "@/mocks/**"],
              message: "Camada compartilhada nao acessa o mock store.",
            },
          ],
        },
      ],
    },
  },
  {
    // Shell de composicao (layout): conhece features (nav/auth), mas nao o mock store.
    files: ["src/components/layout/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/mocks", "@/mocks/**"],
              message: "A shell nao acessa o mock store direto.",
            },
          ],
        },
      ],
    },
  },
  {
    // Features: importam OUTRAS features so pelo barrel publico (@/features/<x>),
    // nunca pelos internals; e nao acessam o mock store direto (via services/hooks).
    files: ["src/features/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/*", "@/features/*/*/**"],
              message:
                "Cross-feature: importe do barrel publico @/features/<x>, nao dos internals.",
            },
            {
              group: ["@/mocks", "@/mocks/**"],
              message: "Feature nao acessa o mock store direto; use a camada de services.",
            },
          ],
        },
      ],
    },
  },
  {
    // Excecao: a resolucao de sessao (auth server-side) usa o mock store como
    // "DB" transitorio (vira auth/API real depois). Mantem so a regra cross-feature.
    files: ["src/features/auth/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/*", "@/features/*/*/**"],
              message:
                "Cross-feature: importe do barrel publico @/features/<x>, nao dos internals.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
