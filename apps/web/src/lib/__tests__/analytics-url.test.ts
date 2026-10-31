import { describe, expect, it } from "vitest";
import { scrubAnalyticsUrl } from "../analytics-url";

// Analise de uso sem tokens, e-mail nem o id dos links publicos (auditoria de 30/10/2026).
describe("endereço limpo para a análise de uso", () => {
  it("tira o valor dos tokens e do e-mail, mantém o resto", () => {
    expect(scrubAnalyticsUrl("https://app.gestarahub.com.br/reset-password?token=abc123")).toBe(
      "https://app.gestarahub.com.br/reset-password?token=%5Bremovido%5D",
    );
    expect(scrubAnalyticsUrl("/accept-invite?token=xyz&from=%2Fdashboard")).toBe("/accept-invite?token=%5Bremovido%5D&from=%2Fdashboard");
    expect(scrubAnalyticsUrl("/forgot-password?email=ana%40exemplo.com")).toBe("/forgot-password?email=%5Bremovido%5D");
    expect(scrubAnalyticsUrl("/login?signup_token=t1")).toBe("/login?signup_token=%5Bremovido%5D");
  });

  it("o id dos links públicos vira marcador", () => {
    expect(scrubAnalyticsUrl("/consent/minor/0b9f6c1e-1111-4111-8111-111111111111")).toBe("/consent/minor/:id");
    expect(scrubAnalyticsUrl("/p/c/0b9f6c1e-1111-4111-8111-111111111111")).toBe("/p/c/:id");
    expect(scrubAnalyticsUrl("https://app.gestarahub.com.br/p/AB12CD34/comprovante")).toBe("https://app.gestarahub.com.br/p/:code/comprovante");
  });

  it("telas comuns passam iguais", () => {
    expect(scrubAnalyticsUrl("/classes/billing?status=all")).toBe("/classes/billing?status=all");
    expect(scrubAnalyticsUrl("https://app.gestarahub.com.br/dashboard")).toBe("https://app.gestarahub.com.br/dashboard");
    expect(scrubAnalyticsUrl("")).toBe("");
  });
});
