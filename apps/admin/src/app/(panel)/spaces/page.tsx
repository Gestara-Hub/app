import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { PlanBadge } from "@/components/shared/plan-badge";
import { Pager } from "@/components/shared/pager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ago, dateOnly } from "@/lib/format";
import { brasiliaDay } from "@/lib/sla";
import { requireAdmin } from "@/lib/server/context";
import { SPACE_SITUATIONS, SPACE_SORTS, listSpaces, spaceTotals, type SpaceFilters, type SpaceSituation, type SpaceSort } from "@/lib/server/spaces";
import { AREA_LABEL, planName } from "@/lib/space-plan";

export const metadata: Metadata = { title: "Espaços" };

const SITUATION_LABEL: Record<SpaceSituation, string> = {
  all: "Todas as situações",
  paid: "Plano pago",
  grace: "Pagamento atrasado",
  reverted: "Voltou ao Grátis",
  scheduled: "Troca de plano marcada",
  courtesy: "Cortesia",
  inactive: "Inativos",
  no_access_30d: "Sem acesso há 30 dias",
  no_online: "Sem recebimento online",
  errors_24h: "Com erro nas últimas 24 h",
};
const SORT_LABEL: Record<SpaceSort, string> = { recent: "Mais novos", name: "Nome", activity: "Último acesso" };

const pick = <T extends string>(value: string | undefined, list: readonly T[]): T | undefined => (list as readonly string[]).includes(value ?? "") ? (value as T) : undefined;

export default async function SpacesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin("spaces:view");
  const params = await searchParams;
  const filters: SpaceFilters = {
    q: params.q?.trim() || undefined,
    tier: pick(params.tier, ["free", "pro", "scale"] as const),
    situation: pick(params.situation, SPACE_SITUATIONS),
    area: params.area && params.area in AREA_LABEL ? params.area : undefined,
    createdWithin: params.created === "7" ? 7 : params.created === "30" ? 30 : undefined,
    sort: pick(params.sort, SPACE_SORTS),
    page: Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1),
  };
  const [{ rows, hasNext }, totals] = await Promise.all([listSpaces(filters), spaceTotals()]);
  const today = brasiliaDay(new Date());

  const query = (override: Record<string, string | undefined> = {}) => {
    const merged = { ...params, ...override };
    const usp = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) if (value) usp.set(key, value);
    return usp.toString();
  };
  const exportHref = `/spaces/export?${query({ page: undefined })}`;

  return (
    <>
      <PageHeader title="Espaços" description="Todos os espaços (tenants) e a situação de cada um. Só números: nenhum dado de aluno.">
        <Button asChild variant="outline">
          <Link href={exportHref} prefetch={false}>
            Exportar CSV
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {[
          ["Espaços", totals.total],
          ["Com plano pago", totals.paid],
          ["Sem acesso há 30 dias", totals.noAccess30d],
          ["Inativos", totals.inactive],
        ].map(([label, value]) => (
          <Card key={label} className="gap-1 p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
          </Card>
        ))}
      </div>

      <form action="/spaces" className="mb-4 flex flex-wrap items-end gap-2">
        <Input name="q" defaultValue={filters.q} placeholder="Nome, dono, e-mail ou código" aria-label="Buscar espaços" className="w-64 text-base md:text-sm" />
        <Select name="tier" label="Plano" value={filters.tier} options={[["", "Todos os planos"], ["free", "Grátis"], ["pro", "Profissional"], ["scale", "Expansão"]]} />
        <Select name="situation" label="Situação" value={filters.situation} options={SPACE_SITUATIONS.map((s) => [s === "all" ? "" : s, SITUATION_LABEL[s]])} />
        <Select name="area" label="Área" value={filters.area} options={[["", "Todas as áreas"], ...Object.entries(AREA_LABEL)]} />
        <Select name="created" label="Criado" value={params.created} options={[["", "Qualquer data"], ["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"]]} />
        <Select name="sort" label="Ordem" value={filters.sort} options={SPACE_SORTS.map((s) => [s, SORT_LABEL[s]])} />
        <Button type="submit">Filtrar</Button>
        {Object.keys(params).some((k) => k !== "page" && params[k]) ? (
          <Button asChild variant="ghost">
            <Link href="/spaces">Limpar</Link>
          </Button>
        ) : null}
      </form>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Espaço</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead className="text-right">Alunos</TableHead>
              <TableHead className="text-right">Turmas</TableHead>
              <TableHead>Último acesso</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Nenhum espaço com esses filtros.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-72">
                    <Link href={`/spaces/${row.id}`} className="font-medium break-words hover:underline">
                      {row.name}
                    </Link>
                    <p className="text-xs text-muted-foreground break-words">
                      {row.ownerName ?? "Sem dono ativo"} · {row.customAreaName || AREA_LABEL[row.area ?? ""] || "Sem área"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {row.status === "inactive" ? <Badge variant="destructive" className="font-normal">Inativo</Badge> : null}
                      {row.errors24h > 0 ? <Badge variant="outline" className="border-destructive/40 font-normal text-destructive">{row.errors24h} erro{row.errors24h > 1 ? "s" : ""} em 24 h</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{planName(row.subscription)}</p>
                    <PlanBadge subscription={row.subscription} today={today} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.studentsActive}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.classesActive}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{ago(row.lastSignInAt)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{dateOnly(row.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
      <Pager page={filters.page} hasNext={hasNext} href={(page) => `/spaces?${query({ page: page > 1 ? String(page) : undefined })}`} />
    </>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value?: string; options: (readonly [string, string])[] | [string, string][] }) {
  return (
    <select
      name={name}
      defaultValue={value ?? ""}
      aria-label={label}
      className="h-9 rounded-md border bg-background px-2 text-base md:text-sm"
    >
      {options.map(([optionValue, optionLabel]) => (
        <option key={optionValue} value={optionValue}>
          {optionLabel}
        </option>
      ))}
    </select>
  );
}
