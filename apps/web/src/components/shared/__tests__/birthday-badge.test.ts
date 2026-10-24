import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { addDays, format, parseISO } from "date-fns";
import { describe, expect, it } from "vitest";
import { dateInSpace } from "@gestarahub/core/date";
import { BirthdayBadge } from "../birthday-badge";

/** Nascimento (ano 2010) que faz aniversário daqui a `days` dias. */
const bornInDays = (days: number) => `2010-${format(addDays(parseISO(dateInSpace()), days), "MM-dd")}`;

describe("selo de aniversário compacto (achado 73)", () => {
  it("diz que é aniversário, não só 'Em 5 dias'", () => {
    const html = renderToStaticMarkup(
      createElement(BirthdayBadge, { birthDate: bornInDays(5), showUpcoming: true, compact: true }),
    );
    expect(html).toContain("Aniv. em 5 dias");
    expect(html).toContain("Aniversário em 5 dias");
    expect(html).not.toMatch(/>Em 5 dias</);
  });

  it("o texto completo vai para o leitor de tela e para o title", () => {
    const html = renderToStaticMarkup(
      createElement(BirthdayBadge, { birthDate: bornInDays(1), showUpcoming: true, compact: true }),
    );
    expect(html).toContain('title="Aniversário amanhã"');
    expect(html).toContain('class="sr-only">Aniversário amanhã');
  });
});
