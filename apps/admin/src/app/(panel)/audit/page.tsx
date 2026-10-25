import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { InitialsAvatar, ListContainer, ListRow, ListSummaryBar } from "@/components/shared/list";
import { Pager } from "@/components/shared/pager";
import { SegmentedLinks } from "@/components/shared/segmented-links";
import { AUDIT_GROUPS, auditActionLabel } from "@/lib/audit-labels";
import { dateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/server/context";
import { sql } from "@/lib/server/db";

export const metadata: Metadata = { title: "Auditoria" };

const PAGE_SIZE = 25;

/** Origem em texto de gente: o endereço da própria máquina vira "Este computador". */
function originLabel(ip: string | null): string | null {
  if (!ip) return null;
  if (ip === "::1" || ip === "127.0.0.1" || ip === "::ffff:127.0.0.1") return "Este computador";
  return ip;
}

/** Tudo o que foi feito no painel: so leitura, ninguem edita nem apaga. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<{ group?: string; page?: string }> }) {
  await requireAdmin("audit:view");
  const params = await searchParams;
  const group = AUDIT_GROUPS.some((g) => g.value === params.group) ? (params.group as string) : "all";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const prefix = group === "all" ? null : `${group}.%`;

  const rows = await sql()<
    { id: string; action: string; admin_name: string | null; organization_id: string | null; organization_name: string | null; reason: string | null; ip: string | null; created_at: Date }[]
  >`
    select a.id, a.action, a.admin_name, a.organization_id, o.name as organization_name, a.reason, a.ip, a.created_at
    from platform.audit_logs a
    left join public.organizations o on o.id = a.organization_id
    where (${prefix}::text is null or a.action like ${prefix})
    order by a.created_at desc
    limit ${PAGE_SIZE + 1} offset ${(page - 1) * PAGE_SIZE}`;
  const hasNext = rows.length > PAGE_SIZE;
  const shown = rows.slice(0, PAGE_SIZE);
  const link = (nextGroup: string, nextPage: number) => `/audit?group=${nextGroup}&page=${nextPage}`;

  return (
    <>
      <PageHeader title="Auditoria" description="Registro do que foi feito no painel. Só leitura." />
      <div className="mb-4">
        <SegmentedLinks label="Filtrar por tipo" items={[...AUDIT_GROUPS]} active={group} href={(value) => link(value, 1)} />
      </div>
      <div className="space-y-2">
        <ListSummaryBar count={shown.length} singularLabel="registro nesta página" pluralLabel="registros nesta página" />
        <ListContainer
          emptyState={shown.length === 0 ? <EmptyState icon={ScrollText} title="Nada registrado ainda." description="As ações feitas no painel aparecem aqui." /> : undefined}
        >
          {shown.map((row) => {
            const origin = originLabel(row.ip);
            return (
              <ListRow key={row.id}>
                <div className="flex items-start gap-3">
                  <InitialsAvatar name={row.admin_name ?? "Sistema"} />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="min-w-0 break-words text-sm font-medium">{auditActionLabel(row.action)}</p>
                    <p className="min-w-0 break-words text-xs text-muted-foreground">
                      {row.admin_name ?? "Sistema"} · {dateTime(row.created_at)}
                      {origin ? ` · ${origin}` : ""}
                    </p>
                    {row.organization_id ? (
                      <p className="min-w-0 break-words text-xs">
                        <span className="text-muted-foreground">Espaço: </span>
                        <Link href={`/spaces/${row.organization_id}`} className="underline underline-offset-2">
                          {row.organization_name ?? "Ver espaço"}
                        </Link>
                        <span className="ml-1 break-all font-mono text-[10px] text-muted-foreground/70">{row.organization_id.slice(0, 8)}</span>
                      </p>
                    ) : null}
                    {row.reason ? <p className="min-w-0 break-words text-xs text-muted-foreground">Motivo: {row.reason}</p> : null}
                  </div>
                </div>
              </ListRow>
            );
          })}
        </ListContainer>
      </div>
      <Pager page={page} hasNext={hasNext} href={(p) => link(group, p)} />
    </>
  );
}
