#!/usr/bin/env node
/**
 * Gera os icones do app instalado (PWA) a partir de src/assets/icon.svg:
 *
 *   pnpm icons:build
 *
 * Margens no padrao de cada sistema (10/11/2026; doc technical/10):
 * - icon-192/512 ("any": computador e Android sem recorte): quadrado com
 *   cantos arredondados e o G em 60% do lado.
 * - icon-maskable-192/512 (Android recorta em circulo, gota ou quadrado):
 *   fundo cheio e o G em 56%, dentro da area segura (circulo de 80%).
 * - apple-touch-icon (180, iPhone arredonda sozinho): fundo cheio, G em 60%.
 * Antes o G ocupava 72% a 80% e ficava colado na borda.
 * Usa o sharp que ja vem com o Next.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sharp = require(require.resolve("sharp", { paths: [dirname(require.resolve("next/package.json"))] }));

const SRC = resolve(here, "../src/assets/icon.svg");
const OUT = resolve(here, "../public/icons");
const BG = "#18181B";

const source = readFileSync(SRC, "utf8");
// O G sozinho: tira o fundo arredondado do SVG da marca.
const glyphSvg = source.replace(/<rect width="256" height="256" rx="56" fill="#18181B"\/>/, "");
if (glyphSvg === source) throw new Error("Fundo do icon.svg nao encontrado: confira o SVG da marca.");

async function glyph(px) {
  const big = await sharp(Buffer.from(glyphSvg), { density: 1200 })
    .resize(2048, 2048, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const trimmed = await sharp(big).trim().png().toBuffer();
  return sharp(trimmed).resize(px, px, { fit: "inside" }).png().toBuffer();
}

function background(size, rounded) {
  const rx = rounded ? Math.round(size * 0.22) : 0;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${rx}" fill="${BG}"/></svg>`,
  );
}

async function make(file, size, ratio, rounded) {
  const g = await glyph(Math.round(size * ratio));
  const { width, height } = await sharp(g).metadata();
  let img = sharp(background(size, rounded)).composite([
    { input: g, left: Math.round((size - width) / 2), top: Math.round((size - height) / 2) },
  ]);
  if (!rounded) img = img.flatten({ background: BG });
  writeFileSync(resolve(OUT, file), await img.png().toBuffer());
  console.log(`${file}: ${size}px, G ${Math.round((Math.max(width, height) / size) * 100)}%`);
}

await make("icon-192.png", 192, 0.6, true);
await make("icon-512.png", 512, 0.6, true);
await make("icon-maskable-192.png", 192, 0.56, false);
await make("icon-maskable-512.png", 512, 0.56, false);
await make("apple-touch-icon.png", 180, 0.6, false);
