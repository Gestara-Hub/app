---
name: adr
description: Record an architecture or product decision in the project docs the standard way, and fix any doc drift it creates. Use when a non-trivial decision is made or reversed (stack, pattern, data model, product rule).
---

# Record a decision (ADR)

Format (match the existing docs): sections `## Decisao` / `## Contexto` / `## Escopo` / `## Alternativas`.
Homes: `docs/technical/00-decisoes-tecnicas.md` (technical), `docs/frontend/*` (frontend),
`docs/product/*` (product/business rules).

## Steps
1. Write the decision in that format in the right doc (or a new numbered `NN-*.md`): the decision, why,
   what was rejected, and where the real implementation lives.
2. **Fix drift**: if this reverses/supersedes an earlier doc, add a `> ⚠️ DESATUALIZADO / SUPERSEDED`
   banner there pointing to the new reality (as done for `docs/frontend/05-agenda-react-big-calendar.md`).
3. If it's a durable convention future sessions need, also add a **one-line memory** (`[[slug]]`) —
   don't duplicate the whole doc; link to it.

Keep it short and honest. A decision the code contradicts is worse than no decision.
