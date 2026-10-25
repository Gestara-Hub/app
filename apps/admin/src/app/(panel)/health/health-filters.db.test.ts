import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ownerSql } from "@/test/local";

vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

/** Saúde: total filtrado, página 2, última página e os filtros novos de erros, rotinas e avisos do parceiro. */
const owner = ownerSql();
const tag = crypto.randomUUID().slice(0, 6);
let orgId = "";
let otherOrgId = "";

beforeAll(async () => {
  const [a] = await owner<{ id: string }[]>`insert into public.organizations (name, model) values (${`Espaço Filtro ${tag}`}, 'classes') returning id`;
  const [b] = await owner<{ id: string }[]>`insert into public.organizations (name, model) values (${`Outro Lugar ${tag}`}, 'classes') returning id`;
  orgId = a.id;
  otherOrgId = b.id;
  await owner`
    insert into public.error_logs (organization_id, fingerprint, source, level, event, message)
    select ${orgId}, ${`fp-flt-${tag}-`}::text || i::text, 'browser', case when i <= 3 then 'warn' else 'error' end, ${`flt.${tag}`}, 'Falha ' || i
      from generate_series(1, 27) i`;
  await owner`insert into public.error_logs (organization_id, fingerprint, source, event, message) values (${otherOrgId}, ${`fp-flt-${tag}-x`}, 'server', ${`flt.${tag}.outro`}, 'Falha de outro')`;
  await owner`
    insert into public.job_runs (job, started_at, finished_at, status, organizations, failures)
    values (${`flt_${tag}`}, now() - interval '1 hour', now(), 'ok', 1, 0),
           (${`flt_${tag}`}, now() - interval '2 hours', now(), 'ok', 1, 0),
           (${`flt_${tag}`}, now() - interval '3 hours', now(), 'failed', 1, 2),
           (${`flt_${tag}`}, now() - interval '3 days', now(), 'failed', 1, 1),
           (${`flt_${tag}`}, now() - interval '40 days', now(), 'ok', 1, 0),
           (${`flt_outra_${tag}`}, now() - interval '1 hour', now(), 'ok', 1, 0)`;
  await owner`
    insert into public.webhook_events (provider, event_id, event, organization_id, status, outcome, received_at)
    values ('asaas', ${`evt-flt-${tag}-1`}, ${`PAYMENT_FLT_${tag}`}, ${orgId}, 'processed', 'ok', now() - interval '1 hour'),
           ('asaas', ${`evt-flt-${tag}-2`}, ${`PAYMENT_FLT_${tag}`}, ${orgId}, 'failed', 'erro', now() - interval '3 days'),
           ('asaas', ${`evt-flt-${tag}-3`}, ${`PAYMENT_OUTRO_${tag}`}, ${otherOrgId}, 'processed', 'ok', now() - interval '40 days')`;
});

afterAll(async () => {
  await owner`delete from public.error_logs where fingerprint like ${`fp-flt-${tag}-%`}`;
  await owner`delete from public.job_runs where job like ${`flt%${tag}`}`;
  await owner`delete from public.webhook_events where event_id like ${`evt-flt-${tag}-%`}`;
  await owner`delete from public.organizations where id = any(${[orgId, otherOrgId]})`;
  await owner.end();
});

describe("erros", () => {
  it("total filtrado, página 2 e última página quando passa do fim", async () => {
    const { listErrors } = await import("@/lib/server/health");
    const first = await listErrors({ period: "24h", q: `flt.${tag}`, page: 1 });
    expect(first.total).toBe(28);
    expect(first.rows).toHaveLength(25);
    expect(first.hasNext).toBe(true);
    const second = await listErrors({ period: "24h", q: `flt.${tag}`, page: 2 });
    expect(second.rows).toHaveLength(3);
    expect(second.hasNext).toBe(false);
    expect(await listErrors({ period: "24h", q: `flt.${tag}`, page: 40 })).toMatchObject({ page: 2, total: 28 });
  });

  it("filtra por espaço (id), nível, origem e busca pelo nome do espaço", async () => {
    const { listErrors } = await import("@/lib/server/health");
    expect((await listErrors({ period: "24h", organizationId: orgId, page: 1 })).total).toBe(27);
    expect((await listErrors({ period: "24h", organizationId: orgId, level: "warn", page: 1 })).total).toBe(3);
    expect((await listErrors({ period: "24h", organizationId: orgId, level: "error", page: 1 })).total).toBe(24);
    expect((await listErrors({ period: "24h", q: `Outro Lugar ${tag}`, page: 1 })).rows.map((r) => r.organizationId)).toEqual([otherOrgId]);
    expect((await listErrors({ period: "24h", q: `flt.${tag}`, source: "server", page: 1 })).total).toBe(1);
    // O texto digitado não vira curinga nem passa de 100 caracteres.
    expect((await listErrors({ period: "24h", q: "%", page: 1 })).rows.every((r) => `${r.event}${r.message}${r.organizationName}`.includes("%"))).toBe(true);
    expect((await listErrors({ period: "24h", q: "x".repeat(500), page: 1 })).total).toBe(0);
  });
});

describe("rotinas", () => {
  it("filtra por rotina, situação e período, com total", async () => {
    const { listJobRunsPage } = await import("@/lib/server/health");
    const job = `flt_${tag}`;
    expect((await listJobRunsPage({ job, page: 1 })).total).toBe(5);
    expect((await listJobRunsPage({ job, status: "failed", page: 1 })).total).toBe(2);
    expect((await listJobRunsPage({ job, status: "ok", page: 1 })).total).toBe(3);
    expect((await listJobRunsPage({ job, period: "24h", page: 1 })).total).toBe(3);
    expect((await listJobRunsPage({ job, period: "7d", status: "failed", page: 1 })).total).toBe(2);
    expect((await listJobRunsPage({ job, period: "30d", page: 1 })).total).toBe(4);
    expect((await listJobRunsPage({ job: `flt_outra_${tag}`, page: 1 })).total).toBe(1);
    expect(await listJobRunsPage({ job, page: 9 })).toMatchObject({ page: 1, total: 5 });
  });
});

describe("avisos do parceiro", () => {
  it("busca pelo evento, pelo código do aviso e pelo espaço, e filtra por período", async () => {
    const { listWebhooks } = await import("@/lib/server/health");
    expect((await listWebhooks({ q: `PAYMENT_FLT_${tag}`, page: 1 })).total).toBe(2);
    expect((await listWebhooks({ q: `evt-flt-${tag}-3`, page: 1 })).rows.map((r) => r.organizationId)).toEqual([otherOrgId]);
    expect((await listWebhooks({ q: `Espaço Filtro ${tag}`, page: 1 })).total).toBe(2);
    expect((await listWebhooks({ q: `${tag}`, period: "24h", page: 1 })).total).toBe(1);
    expect((await listWebhooks({ q: `${tag}`, period: "7d", page: 1 })).total).toBe(2);
    expect((await listWebhooks({ q: `${tag}`, period: "30d", status: "failed", page: 1 })).total).toBe(1);
    expect((await listWebhooks({ q: `${tag}`, page: 1 })).total).toBe(3);
  });
});
