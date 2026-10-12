import type { Id } from "@gestarahub/contracts";

/**
 * Conteudo dos anexos no mock. O store (localStorage) guarda so os metadados
 * (`FileAttachment`); os arquivos ficam no IndexedDB, que aguenta imagens e
 * PDFs. Sem IndexedDB (testes, Node) cai num Map em memoria. Com o backend,
 * vira o storage de arquivos.
 */

const DB_NAME = "gestarahub-files";
const STORE_NAME = "blobs";

const memory = new Map<Id, Blob>();
let dbPromise: Promise<IDBDatabase> | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = action(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error);
      }),
  );
}

export async function putFileBlob(id: Id, blob: Blob): Promise<void> {
  if (!hasIndexedDb()) {
    memory.set(id, blob);
    return;
  }
  await run<IDBValidKey>("readwrite", (store) => store.put(blob, id));
}

export async function getFileBlob(id: Id): Promise<Blob | undefined> {
  if (!hasIndexedDb()) return memory.get(id);
  return run<Blob | undefined>("readonly", (store) => store.get(id));
}
