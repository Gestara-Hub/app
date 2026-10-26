---
name: smoke-web
description: Launch and drive apps/web (Next dev) for a runtime smoke test — forged session cookie to skip login, puppeteer-core over the system Chrome (no browser download), and a localStorage store-injection trick for deterministic data. Use to verify UI/behavior changes actually render and work in the running app.
---

# Smoke-test `apps/web` (launch + drive the real app)

> **Run the suites first.** `pnpm test` (engine + services, <1s) and `pnpm e2e`
> (Playwright, ~25s, reuses the dev server on :3000) cover the regression paths.
> Only drive the app by hand for what changed or is not covered yet, and turn
> every new bug into a spec in `apps/web/e2e` or `src/services/__tests__`.
> E2E helpers live in `apps/web/e2e/fixtures.ts`: `loginAs`, `seedAcademy`,
> `editWorld`, `student`, clock frozen at 2026-09-22, fails on console errors.

The web app is a **client-heavy Next.js (App Router, Turbopack) mock**: data lives
**client-side** in `localStorage["gestarahub:db"]`, seeded on first load. So `curl`
only proves the shell boots — anything data-dependent (agenda cards, dashboard KPIs,
detail modals) needs a **real browser**. This skill is the verified path.

## 0. Prereqs (already true on this machine)

- Node + `pnpm` (v11) available. Google Chrome installed at
  `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
- No Playwright / chromium-cli. We drive with **`puppeteer-core`** pointed at the
  system Chrome (no browser download). Install it in a **scratch dir**, never the
  repo (keeps `package.json`/lockfile clean).

## 1. Launch the dev server

```bash
pnpm --filter @gestarahub/web dev > /tmp/gestara-dev.log 2>&1 &
# wait for "Ready", then:
lsof -ti:3000 >/dev/null && echo LISTENING   # http://localhost:3000
```

To also prove the **workspace packages resolve in a production build** (e.g. after
touching `@gestarahub/contracts` / `@gestarahub/core`):
`pnpm --filter @gestarahub/web build` (Turbopack; runs `tsc` too).

## 2. Auth — forge the session cookie (skip the login flow)

`src/proxy.ts` guards `(app)/*` via the cookie **`gestarahub_session`**, whose
value is the logged user's `UserView` as base64 JSON (see `lib/session.ts`), and
redirects to `/login`. Easiest: log in through `/login` (the e2e `loginAs` does). Seeded users live in
`apps/web/src/mocks/seed.ts`; use the **owner** for full permissions:

| userId | who | perfil |
| --- | --- | --- |
| `usr-marcelo` | Marcelo Andrade | owner (todas as permissões) |

Forge it in the driver via `page.setCookie({ name:'gestarahub_session', value:'usr-marcelo', domain:'localhost', path:'/' })`.
Quick HTTP check without a browser:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -b 'gestarahub_session=usr-marcelo' http://localhost:3000/schedule  # 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/schedule                                      # 307 -> /login
```
(`/appointments` legitimately 307-redirects to `/schedule` — unified screen.)

## 3. Driver setup (scratch dir, system Chrome)

```bash
SP="$SCRATCHPAD/smoke"; mkdir -p "$SP" && cd "$SP"
npm init -y >/dev/null && npm i puppeteer-core@23 >/dev/null   # no browser download
```

## 4. Driver skeleton (adapt per task)

```js
const puppeteer = require("puppeteer-core");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "http://localhost:3000", OUT = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Radix dropdowns/popovers/dialogs need REAL pointer events and must be clicked
// by ROLE, SCOPED to the open portal — matching by text hits background cards.
async function clickReal(page, { sel, text, scope = "body", role }) {
  const box = await page.evaluate((sel, text, scope, role) => {
    const root = document.querySelector(scope) || document;
    let el = sel ? root.querySelector(sel)
      : [...root.querySelectorAll(role || 'button,[role="menuitem"],[role="option"]')]
          .find((e) => (e.textContent || "").trim().includes(text));
    if (!el) return null;
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, sel, text, scope, role);
  if (!box) return false;
  await page.mouse.click(box.x, box.y);       // real event -> Radix opens
  return true;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: "new",
    args: ["--no-sandbox", "--window-size=1440,960"],
    defaultViewport: { width: 1440, height: 960 },
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.setCookie({ name: "gestarahub_session", value: "usr-marcelo", domain: "localhost", path: "/" });

  await page.goto(`${BASE}/schedule`, { waitUntil: "networkidle0", timeout: 60000 });
  await sleep(1500);                                   // let TanStack Query hydrate
  await page.screenshot({ path: `${OUT}/agenda.png` });

  // Open "Novo agendamento" and its Serviços multi-select (scope clicks to the dialog):
  await clickReal(page, { text: "Novo" });            await sleep(600);
  await clickReal(page, { text: "Agendamento", role: '[role="menuitem"]' }); await sleep(900);
  await clickReal(page, { sel: 'button[aria-label="Profissional"]', scope: '[role="dialog"]' }); await sleep(500);
  await clickReal(page, { text: "Marcelo Andrade", scope: '[role="listbox"],[data-radix-popper-content-wrapper]', role: '[role="option"]' });
  await clickReal(page, { sel: 'button[aria-label="Serviços"]', scope: '[role="dialog"]' }); await sleep(700);
  // pick options inside the OPEN listbox portal only:
  await clickReal(page, { text: "Corte", scope: '[role="listbox"],[data-radix-popper-content-wrapper]', role: '[role="option"]' });

  console.log(errors.length ? errors.join(" | ") : "NO page/console errors");
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
```

**Always read the screenshots back** (Read tool renders PNGs). A blank frame = launch failure.

## 5. Deterministic data via store injection

To force an edge state (e.g. a **multi-service** appointment) without driving the
whole form, mutate the store in-page and reload:

```js
await page.evaluate(() => {
  const blob = JSON.parse(localStorage.getItem("gestarahub:db"));
  const db = blob.data ?? blob;
  const a = db.appointments.find((x) => x.serviceIds.length === 1); // pick a target
  const prof = db.professionals.find((p) => p.id === a.professionalId);
  a.serviceIds.push(prof.serviceIds.find((s) => !a.serviceIds.includes(s))); // add a 2nd service
  localStorage.setItem("gestarahub:db", JSON.stringify(blob));
});
await page.reload({ waitUntil: "networkidle0" });
```
Caveat: this bypasses the service layer, so **derived fields aren't recomputed**
(e.g. `end` stays as-is when you add a service) — good enough to prove *display*
logic; for true end-to-end use the form. Changing the data **shape** requires
bumping `SEED_VERSION` in `mocks/store.ts` (it resets the store on load).

## Gotchas (hard-won)

- **Mock data is client-side** — `curl`/SSR shows only the shell; use the browser.
- **Radix components** (dropdown/combobox/multiselect/dialog): use real
  `page.mouse.click` on the bounding box, and **scope option/menuitem clicks to the
  open portal** (`[role="dialog"]`, `[data-radix-popper-content-wrapper]`,
  `[role="listbox"]`) matching by `[role="option"]`/`[role="menuitem"]` — never by
  text across the whole document (collides with background appointment cards).
  `page.keyboard.press("Escape")` closes the topmost popover.
- **Fresh browser = empty localStorage** → the store re-seeds each launch (inject
  within the same run).
- Clean up: `lsof -ti:3000 | xargs kill`. The scratch dir is disposable.
- If the fallback needed new tooling (it did — puppeteer-core), that's captured here
  so the next run doesn't rediscover it.
