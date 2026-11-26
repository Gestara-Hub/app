#!/usr/bin/env node
/**
 * Tunel publico para testar o webhook do Asaas no ambiente local (doc 19, secao 4).
 *
 *   pnpm tunnel            (descobre sozinho se o dev esta em http ou https)
 *   pnpm tunnel --https    (forca https: `pnpm dev:https`)
 *   pnpm tunnel --http     (forca http: `pnpm dev`)
 *
 * 1. Sobe `cloudflared tunnel --url http(s)://localhost:3200` (tunel rapido, sem
 *    conta). Com https (certificado local do `next dev --experimental-https`),
 *    o cloudflared nao confere o certificado (`--no-tls-verify`): o certificado
 *    e do proprio computador, e o trecho publico segue em https pela Cloudflare.
 * 2. Le o endereco publico gerado e grava em apps/web/.env.local:
 *    ASAAS_WEBHOOK_URL=<endereco>/api/webhooks/asaas
 *    e cria ASAAS_WEBHOOK_SECRET se ainda nao existir.
 * 3. Fica no ar ate Ctrl+C.
 *
 * O endereco muda a cada vez que o tunel sobe. Depois de subir, reinicie o
 * `pnpm dev` (o Next so le o .env ao iniciar); no proximo acesso a organizacao,
 * o app recadastra o webhook na subconta com a URL nova.
 *
 * So mexe nas duas linhas ASAAS_WEBHOOK_*; o resto do .env.local fica como esta
 * e nunca e impresso.
 */
import { spawn, spawnSync } from "node:child_process";
import { request } from "node:https";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ENV_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../.env.local");
const PORT = process.env.PORT || "3200";
const WEBHOOK_PATH = "/api/webhooks/asaas";
const args = new Set(process.argv.slice(2));

/** O dev responde em https nesta porta? (certificado local: nao confere). */
function devAnswersHttps() {
  return new Promise((done) => {
    const req = request(
      { host: "localhost", port: PORT, path: "/", method: "HEAD", rejectUnauthorized: false, timeout: 2000 },
      (res) => {
        res.resume();
        done(true);
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => done(false));
    req.end();
  });
}

const useHttps = args.has("--https") ? true : args.has("--http") ? false : await devAnswersHttps();
const ORIGIN = `${useHttps ? "https" : "http"}://localhost:${PORT}`;

if (spawnSync("cloudflared", ["--version"], { stdio: "ignore" }).status !== 0) {
  console.error("cloudflared não encontrado. Instale com: brew install cloudflared");
  process.exit(1);
}

/** Troca (ou acrescenta) uma linha KEY=valor sem tocar nas outras. */
function setEnv(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(content)) return content.replace(pattern, line);
  return `${content.replace(/\n*$/, "\n")}${line}\n`;
}

function writeWebhookEnv(publicUrl) {
  let content = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  if (!/^# Webhook do Asaas/m.test(content)) {
    content = `${content.replace(/\n*$/, "\n")}\n# Webhook do Asaas (gerado por pnpm tunnel; a URL muda a cada execucao)\n`;
  }
  content = setEnv(content, "ASAAS_WEBHOOK_URL", `${publicUrl}${WEBHOOK_PATH}`);
  let createdSecret = false;
  if (!/^ASAAS_WEBHOOK_SECRET=.+$/m.test(content)) {
    content = setEnv(content, "ASAAS_WEBHOOK_SECRET", randomBytes(24).toString("hex"));
    createdSecret = true;
  }
  writeFileSync(ENV_FILE, content);
  return createdSecret;
}

console.log(`Subindo o túnel para ${ORIGIN}...`);
if (!useHttps && !args.has("--http")) {
  console.log("(O dev não respondeu em https agora. Se for usar o pnpm dev:https, rode: pnpm tunnel --https)");
}
const tunnelArgs = ["tunnel", "--no-autoupdate", "--url", ORIGIN];
if (useHttps) tunnelArgs.push("--no-tls-verify");
const tunnel = spawn("cloudflared", tunnelArgs, {
  stdio: ["ignore", "pipe", "pipe"],
});

let announced = false;
const onOutput = (chunk) => {
  const text = chunk.toString();
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (match && !announced) {
    announced = true;
    const createdSecret = writeWebhookEnv(match[0]);
    console.log("");
    console.log(`Túnel no ar: ${match[0]}`);
    console.log(`Webhook:     ${match[0]}${WEBHOOK_PATH}`);
    console.log(`.env.local:  ASAAS_WEBHOOK_URL atualizada${createdSecret ? " e ASAAS_WEBHOOK_SECRET criada" : ""}.`);
    console.log("");
    console.log(`Agora: reinicie o ${useHttps ? "pnpm dev:https" : "pnpm dev"} e abra o app (Configurações > Pagamento online)`);
    console.log("para o webhook ser cadastrado na subconta. Deixe este terminal aberto. Ctrl+C encerra.");
  }
  if (/ERR|error/i.test(text) && !/Retrying|INF/.test(text)) process.stderr.write(text);
};
tunnel.stdout.on("data", onOutput);
tunnel.stderr.on("data", onOutput);

const stop = () => tunnel.kill("SIGINT");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
tunnel.on("exit", (code) => {
  console.log(`Túnel encerrado${code ? ` (código ${code})` : ""}.`);
  process.exit(code ?? 0);
});
