import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Testes da camada de services (regras de negocio sobre o store mock), em Node.
//
// Dois grupos (doc 20): quase todos rodam SEM isolar arquivos (o modulo e
// carregado uma vez por processo: ~6 s em vez de ~20 s); os que trocam modulos
// com `vi.mock` precisam de isolamento e rodam a parte. A separacao e
// automatica: basta o arquivo conter `vi.mock(`.

const root = fileURLToPath(new URL(".", import.meta.url));

function testFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : testFiles(path);
    return entry.name.endsWith(".test.ts") && !entry.name.endsWith(".db.test.ts") ? [path] : [];
  });
}

const mockedFiles = testFiles(join(root, "src"))
  .filter((file) => readFileSync(file, "utf8").includes("vi.mock("))
  .map((file) => relative(root, file));

const exclude = ["src/**/*.db.test.ts", "node_modules/**"];

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    projects: [
      {
        extends: true,
        test: { name: "rapido", include: ["src/**/*.test.ts"], exclude: [...exclude, ...mockedFiles], isolate: false },
      },
      {
        extends: true,
        test: { name: "isolado", include: mockedFiles.length > 0 ? mockedFiles : ["__nenhum__"], exclude },
      },
    ],
  },
});
