"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { onOpenSupport, type OpenSupportDetail } from "../support-events";
import { SupportSheet } from "./support-sheet";

/**
 * Janela do "Fale com a gente", montada uma vez no layout do app. Qualquer
 * tela abre com `openSupport()` e a conversa ja sai com a tela de origem.
 */
export function SupportHost() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<OpenSupportDetail>({});
  const [origin, setOrigin] = useState(pathname);

  useEffect(
    () =>
      onOpenSupport((next) => {
        setDetail(next);
        setOrigin(window.location.pathname);
        setOpen(true);
      }),
    [],
  );

  return (
    <SupportSheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDetail({});
      }}
      origin={origin}
      draft={detail.draft}
      errorReference={detail.errorReference}
    />
  );
}
