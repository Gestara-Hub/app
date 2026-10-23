#!/usr/bin/env node
/**
 * Recria a demonstracao no Supabase local (doc 15, fatia 4):
 *
 *   pnpm demo:local
 *
 * 1. Cria DEMO_PASSWORD em apps/web/.env.local, se ainda nao existir (senha
 *    dos usuarios da demonstracao; o botao "Entrar na demonstracao" usa).
 * 2. Roda `demo:seed`, que apaga e recria o espaco de demonstracao.
 *
 * So mexe na linha DEMO_PASSWORD do .env.local e nunca imprime a senha.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = resolve(WEB, ".env.local");

let content = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
const created = !/^DEMO_PASSWORD=.+$/m.test(content);
if (created) {
  const password = randomBytes(18).toString("base64url");
  // Linha vazia (modelo do .env.example): preenche no lugar; sem a linha, acrescenta.
  content = /^DEMO_PASSWORD=.*$/m.test(content)
    ? content.replace(/^DEMO_PASSWORD=.*$/m, `DEMO_PASSWORD=${password}`)
    : `${content.replace(/\n*$/, "\n")}\n# Senha dos usuarios da demonstracao (gerado por pnpm demo:local)\nDEMO_PASSWORD=${password}\n`;
  writeFileSync(ENV_FILE, content);
}

execFileSync("pnpm", ["demo:seed"], { cwd: WEB, stdio: ["ignore", "pipe", "inherit"] })
  .toString()
  .split("\n")
  .filter((l) => l.includes("Demonstração pronta") || l.includes("Tests"))
  .forEach((l) => console.log(l.trim()));
console.log(created ? "DEMO_PASSWORD criada no .env.local: reinicie o pnpm dev." : "DEMO_PASSWORD já existia no .env.local.");
