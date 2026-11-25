"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Marcas de "ja vi" da pessoa (25/11/2026): boas-vindas, tours, dicas e o
 * cartao "Descobrir". Antes ficavam so no navegador (outro navegador ou o app
 * instalado mostrava tudo de novo); agora a verdade e a conta
 * (`preferences.seen`), e o navegador guarda uma copia para a tela nao piscar.
 *
 * - Marca antiga que so existe no navegador sobe para a conta na primeira
 *   leitura depois de a conta carregar (ninguem revê nada pela troca).
 * - "off" desfaz a marca (ex.: "Rever o tour").
 * - Sem conta (demonstracao, fora do app) funciona so no navegador, como antes.
 *
 * O provedor de preferencias (features/preferences) liga a conta aqui: entrega
 * as marcas ao carregar e grava o que for marcado. Este modulo nao conhece o
 * provedor (lib nao importa features).
 */

type Persist = (patch: Record<string, string>) => void;

let account: Record<string, string> = {};
let ready = false;
let persist: Persist | null = null;
const uploaded = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function readLocal(key: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    const value = window.localStorage.getItem(key);
    return value === "1" || value === "true";
  } catch {
    return false;
  }
}

function writeLocal(key: string, on: boolean) {
  try {
    if (on) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    // Sem storage: vale a conta.
  }
}

/** Liga a gravacao na conta (o provedor de preferencias chama uma vez). */
export function setSeenMarksPersister(next: Persist | null): void {
  persist = next;
}

/** Marcas da conta chegaram (ou mudaram em outro aparelho). */
export function setSeenMarksFromAccount(marks: Record<string, string> | undefined, loaded: boolean): void {
  account = { ...(marks ?? {}) };
  if (loaded) ready = true;
  notify();
}

/** A conta ja respondeu: decidir mostrar boas-vindas e tours so depois disto. */
export function seenMarksReady(): boolean {
  return ready;
}

export function hasSeenMark(key: string): boolean {
  const value = account[key];
  if (value === "off") return false;
  if (value) return true;
  const local = readLocal(key);
  // Marca antiga, so no navegador: sobe para a conta uma vez.
  if (local && ready && persist && !uploaded.has(key)) {
    uploaded.add(key);
    const date = new Date().toISOString();
    account = { ...account, [key]: date };
    queueMicrotask(() => persist?.({ [key]: date }));
  }
  return local;
}

/** Marca (ou desfaz, com `on: false`) e grava na conta. */
export function setSeenMark(key: string, on = true): void {
  const current = account[key];
  // Ja esta assim na conta: nada a gravar.
  if (on ? Boolean(current) && current !== "off" : current === "off") {
    writeLocal(key, on);
    return;
  }
  const value = on ? new Date().toISOString() : "off";
  account = { ...account, [key]: value };
  writeLocal(key, on);
  persist?.({ [key]: value });
  notify();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = () => onChange();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Le a marca reagindo a mudancas (nesta aba, em outras e na conta). No servidor: falso. */
export function useSeenMark(key: string): boolean {
  const getSnapshot = useCallback(() => hasSeenMark(key), [key]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** A conta ja respondeu (no servidor: nao). */
export function useSeenMarksReady(): boolean {
  return useSyncExternalStore(subscribe, seenMarksReady, () => false);
}
