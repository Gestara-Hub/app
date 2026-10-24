import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { listAnnouncements, type AnnouncementRow } from "@/lib/server/announcements";
import { requireAdmin } from "@/lib/server/context";
import { archiveAnnouncementAction } from "./actions";
import { AREA_LABEL } from "./announcement-form";

export const metadata: Metadata = { title: "Comunicados" };

const STATE_LABEL = { active: "No ar", scheduled: "Agendado", ended: "Encerrado", archived: "Arquivado" } as const;
const SEVERITY_LABEL = { info: "Aviso", warning: "Atenção", urgent: "Urgente" } as const;
const TIER_LABEL: Record<string, string> = { free: "Grátis", pro: "Profissional", scale: "Expansão" };

function audienceText(row: AnnouncementRow): string {
  if (row.audience === "all") return "Todos os espaços";
  if (row.audience === "tier") return (row.filter.tiers ?? []).map((t) => TIER_LABEL[t] ?? t).join(", ");
  if (row.audience === "area") return (row.filter.areas ?? []).map((a) => AREA_LABEL[a] ?? a).join(", ");
  const n = row.filter.spaces?.length ?? 0;
  return n === 1 ? "1 espaço" : `${n} espaços`;
}

/** Comunicados aos espaços (manutenção, novidade, termo novo, incidente). */
export default async function AnnouncementsPage() {
  const { admin } = await requireAdmin("announcements:manage");
  const rows = await listAnnouncements();
  const manage = can(admin.role, "announcements:manage");
  return (
    <>
      <PageHeader title="Comunicados" description="Mensagens que aparecem no topo do app dos clientes. Quem dispensa deixa de ver; o urgente fica até acabar.">
        {manage ? (
          <Button asChild>
            <Link href="/announcements/new">+ Novo comunicado</Link>
          </Button>
        ) : null}
      </PageHeader>
      <Card>
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhum comunicado ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Comunicado</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Quem recebe</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Dispensas</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-xs">
                    <p className="font-medium break-words">{row.title}</p>
                    <p className="text-xs text-muted-foreground">{SEVERITY_LABEL[row.severity]}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.state === "active" ? "default" : "secondary"}>{STATE_LABEL[row.state]}</Badge>
                  </TableCell>
                  <TableCell className="break-words">{audienceText(row)}</TableCell>
                  <TableCell className="text-sm">
                    {dateTime(row.startsAt)}
                    <br />
                    <span className="text-muted-foreground">até {row.endsAt ? dateTime(row.endsAt) : "arquivar"}</span>
                  </TableCell>
                  <TableCell className="tabular-nums">{row.dismissed}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/announcements/${row.id}`}>Editar</Link>
                      </Button>
                      <form action={archiveAnnouncementAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="archive" value={row.archivedAt ? "0" : "1"} />
                        <Button type="submit" variant="ghost" size="sm">
                          {row.archivedAt ? "Restaurar" : "Arquivar"}
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
