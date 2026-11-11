import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Fundo da secao aberta da ficha (muted 40%, escuro 25%) sobre a cor do card,
 * nao sobre o fundo da pagina: no escuro o card e mais claro que o fundo.
 */
const OPEN_SECTION_BG =
  "bg-[color-mix(in_oklab,var(--muted)_40%,var(--card))] dark:bg-[color-mix(in_oklab,var(--muted)_25%,var(--card))]";

/** Inputs e gatilhos de select transparentes ficariam cinza como o bloco. */
const FIELDS_ON_TINT = "[&_input]:bg-background [&_textarea]:bg-background [&_button[role=combobox]]:bg-background";

/**
 * Secao de um formulario longo (10/11/2026, doc 07 §2.9): no computador, o
 * mesmo visual da secao aberta da ficha do aluno e do `CollapsibleSection`
 * (doc 07 §1.8): borda fina, fundo suave e uma barra fina a esquerda que para
 * antes da borda. No celular (abaixo de `sm`), sem caixa nenhuma: borda, fundo,
 * barra e padding comiam a largura e os campos ficavam espremidos; la os
 * grupos se separam so pelo espaco (`space-y-8 sm:space-y-4` no corpo).
 * Sem titulo visivel e sem abrir/fechar (`title` so nomeia a secao para
 * leitor de tela). Ordem padrao dos cadastros de turma e evento: Sobre, Quem
 * conduz, Quando, Vagas e cobranca.
 */
export function FormSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section
      aria-label={title}
      className={cn(
        "relative space-y-4",
        "sm:overflow-hidden sm:rounded-lg sm:border sm:border-border sm:py-4 sm:pr-4 sm:pl-5",
        "sm:bg-[color-mix(in_oklab,var(--muted)_40%,var(--card))] sm:dark:bg-[color-mix(in_oklab,var(--muted)_25%,var(--card))]",
        "sm:[&_input]:bg-background sm:[&_textarea]:bg-background sm:[&_button[role=combobox]]:bg-background",
        className,
      )}
    >
      {/* m-0: o space-y-4 da secao poe margem embaixo dos filhos e encurtava a barra embaixo. */}
      <span aria-hidden className="absolute inset-y-2 left-1 m-0 hidden w-[3px] rounded-full bg-foreground/60 sm:block" />
      {children}
    </section>
  );
}

/**
 * Parte opcional que se liga com um interruptor (ex.: "Esta modalidade tem
 * avaliacoes", doc 07 §2.9): borda sempre; ligada, ganha o fundo e a barra
 * da secao aberta da ficha, como o `CollapsibleSection` aberto. Desligada,
 * fica so com a borda, como uma secao fechada. No celular, padding menor.
 */
export function toggleSectionClass(on: boolean, className?: string): string {
  return cn(
    "relative space-y-3 overflow-hidden rounded-lg border border-border p-3 transition-colors duration-300 sm:p-3.5",
    on ? OPEN_SECTION_BG : "bg-card",
    FIELDS_ON_TINT,
    className,
  );
}

/** Barra fina a esquerda da secao ligada (some, encolhendo, ao desligar). */
export function SectionBar({ visible }: { visible: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        // m-0: o space-y da secao poe margem embaixo dos filhos e encurtava a barra.
        "absolute inset-y-2 left-[3px] m-0 w-[3px] origin-top rounded-full bg-foreground/60 transition-[opacity,transform] duration-300 sm:left-1",
        visible ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0",
      )}
    />
  );
}
