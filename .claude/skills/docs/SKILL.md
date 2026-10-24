---
name: docs
description: Decide where a doc goes, write it in the standard format and keep the map in docs/README.md current. Use whenever you create, change, move or retire a doc, record a decision (stack, pattern, data model, product rule) or add something "for later".
---

# Docs: where each thing goes and how to write it

## Types of doc and where they live
| Kind | Folder |
| --- | --- |
| Business rule and the why | `docs/product/` |
| How it works (architecture, modules) | `docs/technical/` |
| How to do it (step by step) | `docs/guides/` |
| Screens and interface standards | `docs/frontend/` |
| System tests and findings | `docs/qa/` |
| Plans for another session | `docs/handoff/` |
| What no longer holds | `docs/archive/` |

"Do later" items also get one line in `docs/pendencias.md` (the single list).

## Order before writing
1. Look the subject up in the "Mapa por assunto" of `docs/README.md`.
2. If the subject already has a doc, add a section to it.
3. Create a file only for a new subject, with the next free number of the folder.
4. Update the map (and the README index) in the same commit.

## Standard header
Every doc starts with: `Data:` · `Status:` (Proposta, Decidido, Feito ou Histórico) · `Código:` (main folders and files) · `Testes:`.

## Recording a decision
Sections `## Decisao` / `## Contexto` / `## Escopo` / `## Alternativas`, in the doc of the subject (product rule in `docs/product/`, technical in `docs/technical/`, frontend in `docs/frontend/`). Say what was decided, why, what was rejected and where the implementation lives.

## Reversed or replaced
The old doc gets `> Histórico: substituído por <link>` and moves to `docs/archive/` (`git mv`), then every link to it is fixed (`node apps/web/scripts/check-doc-links.mjs` must report zero). A decision the code contradicts is worse than no decision.

## Memory
A durable convention future sessions need also gets a one-line memory (`[[slug]]`) that links to the doc; never duplicate the doc.

## Only the classes model
Docs of the scheduling (barbershop) and delivery models stay where they are, untouched, unless asked.
