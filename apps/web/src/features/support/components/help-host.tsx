"use client";

import { useEffect, useState } from "react";
import { HELP_CHUNKS, type HelpChunk } from "@/lib/support/help-search";
import { onOpenHelp, onStartGuide } from "../help-events";
import { GuideRunner } from "./guide-runner";
import { HelpSheet } from "./help-sheet";

/** Janela da ajuda e guia na tela, montados uma vez no layout do app; qualquer tela abre com `openHelp()` e `startGuide(id)`. */
export function HelpHost() {
  const [open, setOpen] = useState(false);
  const [guide, setGuide] = useState<HelpChunk | null>(null);
  useEffect(() => onOpenHelp(() => setOpen(true)), []);
  useEffect(
    () =>
      onStartGuide((chunkId) => {
        const chunk = HELP_CHUNKS.find((c) => c.id === chunkId && c.guide);
        if (!chunk) return;
        setOpen(false);
        setGuide(chunk);
      }),
    [],
  );
  return (
    <>
      <HelpSheet open={open} onOpenChange={setOpen} />
      {guide ? <GuideRunner key={guide.id} chunk={guide} onClose={() => setGuide(null)} /> : null}
    </>
  );
}
