"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { HelpChunk } from "@/lib/support/help-search";
import { onOpenHelp, onStartGuide } from "../help-events";

// Sob demanda (11/11/2026): a janela da ajuda e o guia levam a base de artigos
// (~36 KB gzip) que ia em toda pagina. So baixam na primeira abertura.
const HelpSheet = dynamic(() => import("./help-sheet").then((m) => m.HelpSheet), { ssr: false });
const GuidePanel = dynamic(() => import("./guide-panel").then((m) => m.GuidePanel), { ssr: false });

/** Janela da ajuda e guia na tela, montados uma vez no layout do app; qualquer tela abre com `openHelp()` e `startGuide(id)`. */
export function HelpHost() {
  const [open, setOpen] = useState(false);
  // Monta a janela so depois da primeira abertura (o fechar continua animado).
  const [mounted, setMounted] = useState(false);
  const [guide, setGuide] = useState<HelpChunk | null>(null);
  useEffect(
    () =>
      onOpenHelp(() => {
        setMounted(true);
        setOpen(true);
      }),
    [],
  );
  useEffect(
    () =>
      onStartGuide((chunkId) => {
        setOpen(false);
        void import("@/lib/support/help-search").then(({ HELP_CHUNKS }) => {
          const chunk = HELP_CHUNKS.find((c) => c.id === chunkId && c.guide);
          if (!chunk) return;
          setGuide(chunk);
        });
      }),
    [],
  );
  return (
    <>
      {mounted ? <HelpSheet open={open} onOpenChange={setOpen} /> : null}
      {guide ? <GuidePanel key={guide.id} chunk={guide} onClose={() => setGuide(null)} /> : null}
    </>
  );
}
