// Revisao geral de 31/10/2026 (achado S10): o registro so resolve "namespace.metodo"
// proprios; todo metodo dos servicos registrados continua resolvendo.
import { it, expect } from "vitest";
import { SERVICE_NAMESPACES, resolveServiceMethod } from "@/services/world/registry";

it("todo metodo dos servicos registrados resolve com hasOwn", async () => {
  const missing: string[] = [];
  for (const [ns, entry] of Object.entries(SERVICE_NAMESPACES)) {
    const service = await entry.load();
    const names = new Set<string>();
    let proto: object | null = service;
    while (proto && proto !== Object.prototype) {
      for (const k of Object.getOwnPropertyNames(proto)) if (typeof (service as Record<string, unknown>)[k] === "function" && k !== "constructor") names.add(k);
      proto = Object.getPrototypeOf(proto);
    }
    for (const m of names) {
      if (entry.browserOnly?.includes(m)) continue;
      if (!(await resolveServiceMethod(`${ns}.${m}`))) missing.push(`${ns}.${m}`);
    }
  }
  expect(missing).toEqual([]);
  expect(await resolveServiceMethod("clients.__proto__")).toBeUndefined();
  expect(await resolveServiceMethod("__proto__.toString")).toBeUndefined();
  expect(await resolveServiceMethod("clients.constructor")).toBeUndefined();
});
