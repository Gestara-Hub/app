import { describe, expect, it } from "vitest";
import type { UserProfile } from "@gestarahub/contracts";
import { canAccessRoute, isRouteInModel } from "@/components/layout/nav";
import { can } from "@/lib/permissions";

const as = (profile: UserProfile) => ({ profile });

describe("isRouteInModel", () => {
  it("/schedule (com ou sem query) existe em scheduling e nao em classes", () => {
    expect(isRouteInModel("/schedule", "scheduling")).toBe(true);
    expect(isRouteInModel("/schedule?x=1", "scheduling")).toBe(true);
    expect(isRouteInModel("/schedule", "classes")).toBe(false);
    expect(isRouteInModel("/schedule?x=1", "classes")).toBe(false);
    expect(isRouteInModel("/schedule#dia", "classes")).toBe(false);
  });

  it("/services fica fora do modelo de turmas", () => {
    expect(isRouteInModel("/services", "classes")).toBe(false);
  });

  it("/clients e compartilhado", () => {
    expect(isRouteInModel("/clients", "scheduling")).toBe(true);
    expect(isRouteInModel("/clients", "classes")).toBe(true);
  });

  it("/classes e detalhes herdam do item-pai: barrados em scheduling", () => {
    expect(isRouteInModel("/classes", "scheduling")).toBe(false);
    expect(isRouteInModel("/classes/abc", "scheduling")).toBe(false);
    expect(isRouteInModel("/classes/sessions/xyz", "scheduling")).toBe(false);
    expect(isRouteInModel("/classes/abc", "classes")).toBe(true);
  });

  it("rota fora de toda nav e compartilhada", () => {
    expect(isRouteInModel("/rota-desconhecida", "classes")).toBe(true);
  });

  it("nao casa por prefixo parcial de segmento", () => {
    // "/classesx" nao e "/classes"
    expect(isRouteInModel("/classesx", "scheduling")).toBe(true);
  });
});

describe("canAccessRoute", () => {
  it("usa o item mais especifico: /classes/modalities e Modalidades (classes:manage)", () => {
    // Atendente tem classes:view mas nao classes:manage.
    expect(can("attendant", "classes:view")).toBe(true);
    expect(can("attendant", "classes:manage")).toBe(false);
    expect(canAccessRoute(as("attendant"), "/classes/modalities", "classes")).toBe(false);
    expect(canAccessRoute(as("attendant"), "/classes/modalities?x=1", "classes")).toBe(false);
    expect(canAccessRoute(as("attendant"), "/classes", "classes")).toBe(true);
    expect(canAccessRoute(as("attendant"), "/classes/calendar", "classes")).toBe(true);
    expect(canAccessRoute(as("manager"), "/classes/modalities", "classes")).toBe(true);
  });

  it("/classes/plans pede billing:view (profissional barrado, atendente liberado)", () => {
    expect(canAccessRoute(as("professional"), "/classes/plans", "classes")).toBe(false);
    expect(canAccessRoute(as("attendant"), "/classes/plans", "classes")).toBe(true);
  });

  it("/schedule liberado em scheduling e barrado em classes, mesmo para owner", () => {
    expect(canAccessRoute(as("owner"), "/schedule", "scheduling")).toBe(true);
    expect(canAccessRoute(as("owner"), "/schedule?x=1", "scheduling")).toBe(true);
    expect(canAccessRoute(as("owner"), "/schedule", "classes")).toBe(false);
    expect(canAccessRoute(as("owner"), "/schedule?x=1", "classes")).toBe(false);
  });

  it("/clients liberado nos dois modelos para quem tem clients:view", () => {
    expect(canAccessRoute(as("attendant"), "/clients", "scheduling")).toBe(true);
    expect(canAccessRoute(as("attendant"), "/clients", "classes")).toBe(true);
    // Profissional nao tem clients:view.
    expect(canAccessRoute(as("professional"), "/clients", "classes")).toBe(false);
  });

  it("/classes/abc barrado em scheduling", () => {
    expect(canAccessRoute(as("owner"), "/classes/abc", "scheduling")).toBe(false);
  });

  it("rotas administrativas do rodape respeitam a permissao", () => {
    expect(canAccessRoute(as("owner"), "/users", "classes")).toBe(true);
    expect(canAccessRoute(as("attendant"), "/users", "classes")).toBe(false);
    expect(canAccessRoute(as("manager"), "/settings", "scheduling")).toBe(false);
  });

  it("dashboard / exige dashboard:view", () => {
    expect(canAccessRoute(as("owner"), "/", "classes")).toBe(true);
    expect(canAccessRoute(as("professional"), "/", "classes")).toBe(false);
  });
});
