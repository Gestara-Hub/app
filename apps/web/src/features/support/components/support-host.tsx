"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { setErrorReporter } from "@/lib/toast";
import { onOpenSupport, openSupport, type OpenSupportDetail } from "../support-events";
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

  // O botão "Relatar problema" dos avisos de erro abre a conversa de problema já com o código.
  useEffect(() => {
    setErrorReporter((errorReference) => openSupport({ kind: "bug", errorReference }));
    return () => setErrorReporter(undefined);
  }, []);

  return (
    <SupportSheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDetail({});
      }}
      origin={origin}
      draft={detail.draft}
      kind={detail.kind}
      errorReference={detail.errorReference}
    />
  );
}
