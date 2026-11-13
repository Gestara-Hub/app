"use client";

import type { CheckInList, CheckInListEntry, OfflineCheckIn, TicketCheckResult } from "@gestarahub/contracts";

/**
 * Leitura sem internet (doc product/29, "Leitura sem internet"): a lista do dia
 * e a fila de entradas ficam no aparelho (IndexedDB). O codigo do ingresso fica
 * embaralhado (SHA-256), igual ao do servidor. A lista vale so para o dia e some
 * ao sair da conta.
 */

const DB_NAME = "gestarahub-checkin";
const DB_VERSION = 1;
const LISTS = "lists";
const QUEUE = "queue";

export interface QueuedCheckIn extends OfflineCheckIn {
  id?: number;
  sessionId: string;
  /** Nome mostrado no aviso da fila. */
  studentName?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LISTS)) db.createObjectStore(LISTS, { keyPath: "sessionId" });
      if (!db.objectStoreNames.contains(QUEUE)) db.createObjectStore(QUEUE, { keyPath: "id", autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = fn(tx.objectStore(store));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function saveCheckInList(list: CheckInList): Promise<void> {
  await run(LISTS, "readwrite", (s) => s.put(list));
}

export async function loadCheckInList(sessionId: string): Promise<CheckInList | undefined> {
  try {
    return await run<CheckInList | undefined>(LISTS, "readonly", (s) => s.get(sessionId));
  } catch {
    return undefined;
  }
}

export async function queueCheckIn(entry: QueuedCheckIn): Promise<void> {
  await run(QUEUE, "readwrite", (s) => s.add(entry));
}

export async function queuedCheckIns(sessionId: string): Promise<QueuedCheckIn[]> {
  try {
    const all = await run<QueuedCheckIn[]>(QUEUE, "readonly", (s) => s.getAll());
    return all.filter((e) => e.sessionId === sessionId);
  } catch {
    return [];
  }
}

export async function removeQueued(ids: number[]): Promise<void> {
  for (const id of ids) await run(QUEUE, "readwrite", (s) => s.delete(id));
}

/** Sair da conta ou outro dia: a lista some do aparelho (a fila ainda nao enviada fica). */
export async function clearCheckInLists(keepToday?: string): Promise<void> {
  try {
    const lists = await run<CheckInList[]>(LISTS, "readonly", (s) => s.getAll());
    for (const list of lists) if (list.date !== keepToday) await run(LISTS, "readwrite", (s) => s.delete(list.sessionId));
  } catch {
    // Sem IndexedDB (aba anonima): nada guardado.
  }
}

/** SHA-256 do codigo, igual ao do servidor (`ticketCodeHash`). */
export async function hashTicketCode(raw: string): Promise<string> {
  const value = raw.trim();
  const fromUrl = /\/p\/i\/([A-Za-z0-9-]+)/.exec(value)?.[1] ?? value;
  const code = fromUrl.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Confere pela lista guardada, como o servidor faria. `entry` volta para a
 * fila; "nao achado" deixa confirmar mesmo assim (conferido ao sincronizar).
 */
export function checkOffline(
  list: CheckInList,
  hash: string,
  options: { confirm?: boolean } = {},
): { result: TicketCheckResult; entry?: CheckInListEntry } {
  const entry = list.entries.find((e) => e.codeHash === hash);
  if (!entry) return { result: { outcome: "not_found", entered: false } };
  const day = list.dayPosition && list.dayTotal ? { day: { date: list.date, position: list.dayPosition, total: list.dayTotal } } : {};
  const base = { registrationId: entry.registrationId, studentName: entry.studentName, ...day };
  if (entry.status === "reserved") return { result: { ...base, outcome: "reserved", entered: false, pendingCents: entry.pendingCents }, entry };
  if (entry.checkedInAt) return { result: { ...base, outcome: "already", entered: false, checkedInAt: entry.checkedInAt }, entry };
  if (entry.pendingCents > 0 && !options.confirm) {
    return { result: { ...base, outcome: "payment_pending", entered: false, pendingCents: entry.pendingCents }, entry };
  }
  return {
    result: { ...base, outcome: entry.pendingCents > 0 ? "payment_pending" : "ok", entered: true, pendingCents: entry.pendingCents },
    entry,
  };
}

/**
 * Liga o service worker da leitura sem internet (so a tela do dia do evento e
 * os arquivos do app). Sem suporte (navegador antigo, http fora de localhost),
 * a lista continua guardada e a tela aberta segue funcionando sem sinal.
 */
export async function enableOfflineCheckIn(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    await navigator.serviceWorker.register("/checkin-sw.js");
    return true;
  } catch {
    return false;
  }
}
