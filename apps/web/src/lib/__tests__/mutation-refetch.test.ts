import { describe, expect, it } from "vitest";
import { MutationCache, QueryObserver } from "@tanstack/react-query";
import { AppQueryClient } from "../mutation-refetch";

// Gravacao so termina com a tela atualizada (doc 07 §2.11, 27/11/2026).

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function clientWithCollector(): AppQueryClient {
  const client: AppQueryClient = new AppQueryClient({
    mutationCache: new MutationCache({
      onSuccess: (_d, _v, _c, mutation) => {
        if (!mutation.meta?.backgroundRefetch) client.startCollecting(mutation);
      },
      onSettled: (_d, _e, _v, _c, mutation): Promise<void> => client.waitCollected(mutation),
    }),
    defaultOptions: { queries: { retry: false } },
  });
  return client;
}

/** Consulta montada (ativa) que leva `ms` para reler. */
function activeQuery(client: AppQueryClient, ms: number) {
  let reads = 0;
  const observer = new QueryObserver(client, {
    queryKey: ["roster"],
    queryFn: async () => {
      reads += 1;
      await sleep(ms);
      return reads;
    },
  });
  const unsubscribe = observer.subscribe(() => {});
  return { unsubscribe, reads: () => client.getQueryData<number>(["roster"]) };
}

describe("gravação espera a tela atualizar", () => {
  it("o sucesso só chega depois da releitura que o hook pediu", async () => {
    const client = clientWithCollector();
    const roster = activeQuery(client, 30);
    await sleep(50);
    expect(roster.reads()).toBe(1);

    const result = await client
      .getMutationCache()
      .build(client, {
        mutationFn: async () => "ok",
        onSuccess: () => {
          void client.invalidateQueries({ queryKey: ["roster"] });
        },
      })
      .execute(undefined);

    expect(result).toBe("ok");
    expect(roster.reads()).toBe(2);
    roster.unsubscribe();
  });

  it("com backgroundRefetch, a gravação não espera", async () => {
    const client = clientWithCollector();
    const roster = activeQuery(client, 60);
    await sleep(80);

    await client
      .getMutationCache()
      .build(client, {
        mutationFn: async () => "ok",
        meta: { backgroundRefetch: true },
        onSuccess: () => {
          void client.invalidateQueries({ queryKey: ["roster"] });
        },
      })
      .execute(undefined);

    expect(roster.reads()).toBe(1);
    roster.unsubscribe();
  });

  it("releitura lenta não prende a gravação além do teto", async () => {
    const client = clientWithCollector();
    const mutation = {};
    client.startCollecting(mutation);
    const roster = activeQuery(client, 1_000);
    void client.invalidateQueries({ queryKey: ["roster"] });
    const started = Date.now();
    await client.waitCollected(mutation, 40);
    expect(Date.now() - started).toBeLessThan(500);
    roster.unsubscribe();
  });

  it("fora de uma gravação, invalidar não guarda nada", async () => {
    const client = clientWithCollector();
    void client.invalidateQueries({ queryKey: ["x"] });
    const started = Date.now();
    await client.waitCollected({});
    expect(Date.now() - started).toBeLessThan(20);
  });
});
