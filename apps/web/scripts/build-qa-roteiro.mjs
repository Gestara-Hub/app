#!/usr/bin/env node
/**
 * Roteiro de teste manual em slides (02/11/2026): le o .md de docs/qa e gera
 * um .html ao lado, com um slide por passo, a conferencia de cada etapa, a
 * marcacao de "feito" e as anotacoes guardadas no navegador. O .md continua
 * sendo a fonte: edite ele e rode de novo.
 *
 *   pnpm --filter @gestarahub/web qa:roteiro            (o roteiro padrao)
 *   pnpm --filter @gestarahub/web qa:roteiro <caminho do .md>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const input = resolve(ROOT, process.argv[2] ?? "docs/qa/2026-11-02-roteiro-academia-artes-marciais.md");
const output = input.replace(/\.md$/, ".html");
const md = readFileSync(input, "utf8");

// --- markdown minimo --------------------------------------------------------

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Negrito, codigo e links (so o texto; os links do .md sao relativos ao repositorio). */
function inline(text) {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function table(lines) {
  const rows = lines.map((l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()));
  const [head, , ...body] = rows;
  return `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body
    .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

/** Blocos de um trecho: paragrafos, listas, tabelas. Devolve HTML. */
function blocks(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (l.trim().startsWith("|")) {
      const t = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) t.push(lines[i++]);
      out.push(table(t));
      continue;
    }
    if (/^\s*- /.test(l)) {
      const items = [];
      while (i < lines.length && /^\s*- /.test(lines[i])) items.push(lines[i++].replace(/^\s*- /, ""));
      out.push(`<ul>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\s*\d+\. /.test(l)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\. /.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\. /, ""));
      out.push(`<ol>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</ol>`);
      continue;
    }
    if (l.startsWith("> ")) { i++; continue; }
    const p = [];
    while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith("|") && !/^\s*(- |\d+\. |> )/.test(lines[i])) p.push(lines[i++].trim());
    out.push(`<p>${inline(p.join(" "))}</p>`);
  }
  return out.join("\n");
}

// --- secoes do roteiro ------------------------------------------------------

const lines = md.split("\n");
const title = (lines.find((l) => l.startsWith("# ")) ?? "# Roteiro").slice(2).trim();
const sections = [];
let current = null;
for (const l of lines) {
  if (l.startsWith("## ")) {
    current = { heading: l.slice(3).trim(), lines: [] };
    sections.push(current);
  } else if (current) current.lines.push(l);
}

const stages = [];
const intro = [];
for (const s of sections) {
  const m = s.heading.match(/^Etapa (\d+): (.+)$/);
  if (!m) {
    if (s.heading.toLowerCase().startsWith("achados")) continue;
    intro.push({ title: s.heading, html: blocks(s.lines) });
    continue;
  }
  const stage = { number: Number(m[1]), title: m[2], objective: "", steps: [], expect: "", db: "", coverLines: [] };
  let afterSteps = false;
  for (const l of s.lines) {
    const obj = l.match(/^\*\*Objetivo:\*\*\s*(.+)$/);
    const exp = l.match(/^\*\*Você deve ver:\*\*\s*(.+)$/);
    const db = l.match(/^\*\*No banco:\*\*\s*(.+)$/);
    const step = l.match(/^(\d+)\. (.+)$/);
    if (obj) stage.objective = obj[1];
    else if (exp) stage.expect = exp[1];
    else if (db) stage.db = db[1];
    else if (step) { stage.steps.push(step[2]); afterSteps = true; }
    else if (afterSteps && l.trim() && !l.trim().startsWith("|")) stage.coverLines.push(l); // nota depois da lista: vai para a capa
    else stage.coverLines.push(l);
  }
  stages.push(stage);
}

// --- slides -----------------------------------------------------------------

const slides = [];
for (const s of intro) slides.push({ kind: "info", stage: 0, title: s.title, html: s.html });
for (const st of stages) {
  const id = `e${st.number}`;
  slides.push({
    kind: "cover", stage: st.number, id: `${id}-capa`,
    title: `Etapa ${st.number}: ${st.title}`,
    objective: inline(st.objective), html: blocks(st.coverLines), stepCount: st.steps.length,
  });
  st.steps.forEach((text, i) => {
    slides.push({ kind: "step", stage: st.number, id: `${id}-p${i + 1}`, index: i + 1, total: st.steps.length, title: `Etapa ${st.number}: ${st.title}`, html: inline(text) });
  });
  slides.push({
    kind: "check", stage: st.number, id: `${id}-conferir`, title: `Etapa ${st.number}: ${st.title}`,
    expect: inline(st.expect), db: inline(st.db), stepCount: st.steps.length,
  });
}

const data = { title, source: basename(input), generatedAt: new Date().toISOString(), stages: stages.map((s) => ({ number: s.number, title: s.title, steps: s.steps.length })), slides };

// --- html -------------------------------------------------------------------

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<!-- Gerado por apps/web/scripts/build-qa-roteiro.mjs a partir de ${escapeHtml(basename(input))}. Edite o .md e rode de novo. -->
<style>
  :root {
    --bg: #f6f7f9; --card: #ffffff; --text: #111827; --muted: #6b7280; --line: #e5e7eb;
    --accent: #2563eb; --accent-soft: #dbeafe; --ok: #059669; --ok-soft: #d1fae5; --warn: #b45309; --warn-soft: #fef3c7;
    --code: #f3f4f6; --rail: #ffffff; color-scheme: light dark;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #0b0f17; --card: #111827; --text: #e5e7eb; --muted: #9ca3af; --line: #1f2937;
      --accent: #60a5fa; --accent-soft: #1e3a5f; --ok: #34d399; --ok-soft: #064e3b; --warn: #fbbf24; --warn-soft: #452c04;
      --code: #1f2937; --rail: #0f1522;
    }
  }
  :root[data-theme="dark"] {
    --bg: #0b0f17; --card: #111827; --text: #e5e7eb; --muted: #9ca3af; --line: #1f2937;
    --accent: #60a5fa; --accent-soft: #1e3a5f; --ok: #34d399; --ok-soft: #064e3b; --warn: #fbbf24; --warn-soft: #452c04;
    --code: #1f2937; --rail: #0f1522;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  a { color: var(--accent); }
  code { background: var(--code); padding: 1px 5px; border-radius: 4px; font-size: 0.92em; }
  .app { display: grid; grid-template-columns: 280px 1fr; min-height: 100dvh; }
  .rail { background: var(--rail); border-right: 1px solid var(--line); padding: 20px 16px; overflow-y: auto; }
  .rail h1 { font-size: 15px; margin: 0 0 4px; }
  .rail .sub { font-size: 12px; color: var(--muted); margin: 0 0 16px; }
  .rail ol { list-style: none; padding: 0; margin: 0; }
  .rail li button { width: 100%; text-align: left; background: none; border: 0; color: var(--text); padding: 8px 10px; border-radius: 8px; cursor: pointer; font: inherit; font-size: 13px; display: flex; gap: 10px; align-items: center; }
  .rail li button:hover { background: var(--accent-soft); }
  .rail li button.active { background: var(--accent-soft); font-weight: 600; }
  .dot { width: 22px; height: 22px; border-radius: 999px; border: 2px solid var(--line); display: inline-grid; place-items: center; font-size: 11px; flex: none; }
  .dot.done { background: var(--ok-soft); border-color: var(--ok); color: var(--ok); }
  .dot.partial { border-color: var(--accent); color: var(--accent); }
  .rail .tools { margin-top: 20px; display: grid; gap: 8px; }
  .main { display: flex; flex-direction: column; min-width: 0; }
  .top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 24px; border-bottom: 1px solid var(--line); font-size: 13px; color: var(--muted); }
  .top .pos { font-weight: 600; color: var(--text); }
  .stage-wrap { flex: 1; display: grid; place-items: start center; padding: 24px 16px 120px; }
  .card { width: min(820px, 100%); background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 28px 28px 24px; }
  .kicker { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 0 0 6px; }
  .card h2 { margin: 0 0 12px; font-size: 22px; line-height: 1.25; }
  .step-num { display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: var(--accent-soft); color: var(--accent); font-weight: 700; font-size: 20px; margin-bottom: 14px; }
  .instruction { font-size: 19px; line-height: 1.5; }
  .objective { background: var(--accent-soft); border-radius: 10px; padding: 12px 14px; margin: 0 0 14px; }
  .block { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line); }
  .block h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; margin: 10px 0; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { color: var(--muted); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  .table-scroll { overflow-x: auto; }
  label.done { display: inline-flex; align-items: center; gap: 10px; margin-top: 18px; padding: 10px 14px; border: 1px solid var(--line); border-radius: 10px; cursor: pointer; user-select: none; }
  label.done input { width: 18px; height: 18px; accent-color: var(--ok); }
  label.done.on { background: var(--ok-soft); border-color: var(--ok); }
  textarea { width: 100%; min-height: 84px; margin-top: 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg); color: var(--text); font: inherit; font-size: 14px; resize: vertical; }
  .btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--text); font: inherit; font-size: 14px; cursor: pointer; }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  .btn.ok { background: var(--ok); border-color: var(--ok); color: #fff; }
  .btn:disabled { opacity: .5; cursor: default; }
  .btn.small { padding: 7px 12px; font-size: 13px; }
  .bar { position: fixed; left: 280px; right: 0; bottom: 0; background: var(--card); border-top: 1px solid var(--line); padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .bar .hint { font-size: 12px; color: var(--muted); }
  .progress { height: 4px; background: var(--line); }
  .progress > div { height: 100%; background: var(--accent); transition: width .2s; }
  .toast { position: fixed; bottom: 76px; left: 50%; transform: translateX(-50%); background: var(--text); color: var(--bg); padding: 10px 16px; border-radius: 10px; font-size: 14px; opacity: 0; transition: opacity .2s; pointer-events: none; }
  .toast.show { opacity: 1; }
  .check-box { border-radius: 10px; padding: 12px 14px; margin: 10px 0; }
  .check-box.expect { background: var(--ok-soft); }
  .check-box.db { background: var(--warn-soft); }
  .menu-btn { display: none; }
  @media (max-width: 900px) {
    .app { grid-template-columns: 1fr; }
    .rail { position: fixed; inset: 0 25% 0 0; z-index: 20; transform: translateX(-100%); transition: transform .2s; }
    .rail.open { transform: none; box-shadow: 0 0 0 100vw rgba(0,0,0,.4); }
    .menu-btn { display: inline-flex; }
    .bar { left: 0; padding: 10px 16px; }
    .card { padding: 20px 16px; border-radius: 12px; }
    .instruction { font-size: 17px; }
    .stage-wrap { padding: 16px 16px 110px; }
  }
</style>
</head>
<body>
<div class="app">
  <aside class="rail" id="rail">
    <h1>${escapeHtml(title)}</h1>
    <p class="sub">Uma etapa por vez. Ao terminar, avise o agente com o botão da conferência.</p>
    <ol id="stages"></ol>
    <div class="tools">
      <button class="btn small" id="export">Exportar anotações (.md)</button>
      <button class="btn small" id="theme">Tema claro/escuro</button>
      <button class="btn small" id="reset">Limpar marcações</button>
    </div>
  </aside>
  <main class="main">
    <div class="top">
      <button class="btn small menu-btn" id="menu">Etapas</button>
      <span class="pos" id="pos"></span>
      <span id="count"></span>
    </div>
    <div class="progress"><div id="progress" style="width:0"></div></div>
    <div class="stage-wrap"><div class="card" id="card"></div></div>
  </main>
</div>
<div class="bar">
  <button class="btn" id="prev">‹ Anterior</button>
  <span class="hint">← → no teclado · marcações e anotações ficam neste navegador</span>
  <button class="btn primary" id="next">Próximo ›</button>
</div>
<div class="toast" id="toast"></div>
<script id="data" type="application/json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>
<script>
(function () {
  var data = JSON.parse(document.getElementById("data").textContent);
  var slides = data.slides;
  var KEY = "qa-roteiro:" + data.source;
  var state = load();
  var i = Math.min(state.pos || 0, slides.length - 1);

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function save() { try { state.pos = i; localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function done(id) { return !!(state.done && state.done[id]); }
  function setDone(id, v) { state.done = state.done || {}; if (v) state.done[id] = true; else delete state.done[id]; save(); }
  function note(id) { return (state.notes && state.notes[id]) || ""; }
  function setNote(id, v) { state.notes = state.notes || {}; if (v.trim()) state.notes[id] = v; else delete state.notes[id]; save(); }
  function stageSteps(n) { return slides.filter(function (s) { return s.kind === "step" && s.stage === n; }); }
  function stageDone(n) { var st = stageSteps(n); var d = st.filter(function (s) { return done(s.id); }).length; return { done: d, total: st.length, all: d === st.length && st.length > 0, checked: done("e" + n + "-conferir") }; }
  function toast(msg) { var t = document.getElementById("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove("show"); }, 1800); }
  function copy(text) { return (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast("Copiado. Cole no chat com o agente."); }, function () { prompt("Copie o texto:", text); }); }
  function stageNotes(n) {
    return stageSteps(n).map(function (s) { var v = note(s.id); return v ? "- Passo " + s.index + ": " + v : ""; }).filter(Boolean).concat(note("e" + n + "-conferir") ? ["- Conferência: " + note("e" + n + "-conferir")] : []);
  }

  function renderRail() {
    var ol = document.getElementById("stages");
    ol.innerHTML = "";
    var cur = slides[i].stage;
    var li0 = document.createElement("li");
    li0.innerHTML = '<button class="' + (cur === 0 ? "active" : "") + '" data-go="0"><span class="dot">i</span>Como usar</button>';
    ol.appendChild(li0);
    data.stages.forEach(function (st) {
      var d = stageDone(st.number);
      var cls = d.checked ? "done" : d.done > 0 ? "partial" : "";
      var li = document.createElement("li");
      var first = slides.findIndex(function (s) { return s.stage === st.number; });
      li.innerHTML = '<button class="' + (cur === st.number ? "active" : "") + '" data-go="' + first + '"><span class="dot ' + cls + '">' + (d.checked ? "✓" : st.number) + '</span><span>' + st.title + '</span></button>';
      ol.appendChild(li);
    });
    ol.querySelectorAll("button").forEach(function (b) { b.addEventListener("click", function () { go(Number(b.getAttribute("data-go"))); document.getElementById("rail").classList.remove("open"); }); });
  }

  function render() {
    var s = slides[i];
    var card = document.getElementById("card");
    var html = "";
    if (s.kind === "info") {
      html = '<p class="kicker">Antes de começar</p><h2>' + s.title + "</h2>" + s.html;
    } else if (s.kind === "cover") {
      html = '<p class="kicker">Etapa ' + s.stage + " · " + s.stepCount + " passos</p><h2>" + s.title.replace(/^Etapa \\d+: /, "") + "</h2>" +
        (s.objective ? '<p class="objective"><strong>Objetivo:</strong> ' + s.objective + "</p>" : "") +
        '<div class="table-scroll">' + s.html + "</div>";
    } else if (s.kind === "step") {
      var d = done(s.id);
      html = '<p class="kicker">' + s.title + "</p>" +
        '<div class="step-num">' + s.index + "</div>" +
        '<p class="instruction">' + s.html + "</p>" +
        '<label class="done ' + (d ? "on" : "") + '"><input type="checkbox" id="chk" ' + (d ? "checked" : "") + " /> Feito</label>" +
        '<textarea id="note" placeholder="Anote o que estranhou neste passo (fica salvo aqui no navegador)">' + note(s.id).replace(/</g, "&lt;") + "</textarea>";
    } else if (s.kind === "check") {
      var sd = stageDone(s.stage);
      html = '<p class="kicker">' + s.title + "</p><h2>Conferir a etapa " + s.stage + "</h2>" +
        '<p>' + sd.done + " de " + sd.total + " passos marcados como feitos.</p>" +
        (s.expect ? '<div class="check-box expect"><strong>Você deve ver:</strong> ' + s.expect + "</div>" : "") +
        (s.db ? '<div class="check-box db"><strong>O agente confere no banco:</strong> ' + s.db + "</div>" : "") +
        '<textarea id="note" placeholder="Achados da etapa (vão junto no aviso ao agente)">' + note(s.id).replace(/</g, "&lt;") + "</textarea>" +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">' +
        '<button class="btn ok" id="copy">Copiar aviso: "Etapa ' + s.stage + ' feita"</button>' +
        '<label class="done ' + (done(s.id) ? "on" : "") + '" style="margin:0"><input type="checkbox" id="chk" ' + (done(s.id) ? "checked" : "") + " /> Etapa concluída</label></div>";
    }
    card.innerHTML = html;
    var chk = document.getElementById("chk");
    if (chk) chk.addEventListener("change", function () { setDone(s.id, chk.checked); chk.parentElement.classList.toggle("on", chk.checked); renderRail(); });
    var nt = document.getElementById("note");
    if (nt) nt.addEventListener("input", function () { setNote(s.id, nt.value); });
    var cp = document.getElementById("copy");
    if (cp) cp.addEventListener("click", function () {
      var lines = ["Etapa " + s.stage + " feita"].concat(stageNotes(s.stage));
      copy(lines.join("\\n"));
    });
    document.getElementById("pos").textContent = s.kind === "step" ? "Etapa " + s.stage + " · passo " + s.index + " de " + s.total : s.kind === "cover" ? "Etapa " + s.stage + " · capa" : s.kind === "check" ? "Etapa " + s.stage + " · conferência" : s.title;
    document.getElementById("count").textContent = (i + 1) + " / " + slides.length;
    document.getElementById("progress").style.width = ((i + 1) / slides.length * 100) + "%";
    document.getElementById("prev").disabled = i === 0;
    document.getElementById("next").disabled = i === slides.length - 1;
    renderRail();
    window.scrollTo(0, 0);
  }

  function go(n) { i = Math.max(0, Math.min(slides.length - 1, n)); save(); render(); }
  document.getElementById("prev").addEventListener("click", function () { go(i - 1); });
  document.getElementById("next").addEventListener("click", function () { go(i + 1); });
  document.addEventListener("keydown", function (e) {
    if (e.target && (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT")) return;
    if (e.key === "ArrowRight" || e.key === "j") go(i + 1);
    if (e.key === "ArrowLeft" || e.key === "k") go(i - 1);
  });
  document.getElementById("menu").addEventListener("click", function () { document.getElementById("rail").classList.toggle("open"); });
  document.getElementById("theme").addEventListener("click", function () {
    var r = document.documentElement; var cur = r.getAttribute("data-theme");
    var dark = cur ? cur === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    r.setAttribute("data-theme", dark ? "light" : "dark");
  });
  document.getElementById("reset").addEventListener("click", function () {
    if (!confirm("Limpar todas as marcações e anotações deste roteiro?")) return;
    state = {}; i = 0; save(); render();
  });
  document.getElementById("export").addEventListener("click", function () {
    var out = ["# Anotações do roteiro: " + data.title, ""];
    data.stages.forEach(function (st) {
      var d = stageDone(st.number);
      out.push("## Etapa " + st.number + ": " + st.title + " (" + d.done + "/" + d.total + (d.checked ? ", concluída" : "") + ")");
      var n = stageNotes(st.number);
      out.push(n.length ? n.join("\\n") : "- sem anotações");
      out.push("");
    });
    var blob = new Blob([out.join("\\n")], { type: "text/markdown" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "anotacoes-roteiro.md"; a.click();
  });
  render();
})();
</script>
</body>
</html>
`;
writeFileSync(output, html);
console.log(`${basename(output)}: ${slides.length} slides, ${stages.length} etapas, ${stages.reduce((n, s) => n + s.steps.length, 0)} passos.`);
