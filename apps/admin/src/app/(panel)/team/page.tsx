import type { Metadata } from "next";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ADMIN_ROLE_LABEL, can } from "@/lib/permissions";
import { requireAdmin } from "@/lib/server/context";
import { inviteEnabled } from "@/lib/server/auth-admin";
import { listTeam } from "@/lib/server/team";
import { InviteForm, MemberActions } from "./team-forms";

export const metadata: Metadata = { title: "Equipe" };

const STATUS_LABEL: Record<string, string> = { active: "Ativo", invited: "Convidado", disabled: "Desativado" };

/** Quem tem acesso ao painel: convidar, mudar papel, desativar e reiniciar o 2FA (so o proprietario). */
export default async function TeamPage() {
  const { admin } = await requireAdmin("team:view");
  const rows = await listTeam();
  const manage = can(admin.role, "team:manage");
  return (
    <>
      <PageHeader
        title="Equipe"
        description="Pessoas com acesso ao painel. Elas nunca entram no app dos clientes, e quem é cliente nunca entra aqui."
      />
      {manage ? (
        <div className="mb-6">
          <InviteForm enabled={inviteEnabled()} />
        </div>
      ) : null}
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Último acesso</TableHead>
              {manage ? <TableHead className="text-right">Ações</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium break-words">{row.name}</TableCell>
                <TableCell className="break-all text-muted-foreground">{row.email}</TableCell>
                <TableCell>{ADMIN_ROLE_LABEL[row.role]}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "active" ? "secondary" : "outline"} className="font-normal">
                    {STATUS_LABEL[row.status] ?? row.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.lastLoginAt ? format(row.lastLoginAt, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "Nunca entrou"}
                </TableCell>
                {manage ? (
                  <TableCell>
                    <div className="flex justify-end">
                      <MemberActions id={row.id} role={row.role} status={row.status} isSelf={row.id === admin.id} />
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
