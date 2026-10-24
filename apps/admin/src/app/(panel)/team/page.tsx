import type { Metadata } from "next";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ADMIN_ROLE_LABEL, isAdminRole } from "@/lib/permissions";
import { requireAdmin } from "@/lib/server/context";
import { sql } from "@/lib/server/db";

export const metadata: Metadata = { title: "Equipe" };

const STATUS_LABEL: Record<string, string> = { active: "Ativo", invited: "Convidado", disabled: "Desativado" };

/**
 * Quem tem acesso ao painel. Por enquanto so leitura: o convite de novas
 * pessoas chega na fase 6 (por ora, `pnpm admin:create-admin`).
 */
export default async function TeamPage() {
  await requireAdmin("team:view");
  const rows = await sql()<
    { id: string; name: string; email: string; role: string; status: string; last_login_at: Date | null }[]
  >`select id, name, email, role, status, last_login_at from platform.admins order by created_at`;
  return (
    <>
      <PageHeader
        title="Equipe"
        description="Pessoas com acesso ao painel. Elas nunca entram no app dos clientes, e quem é cliente nunca entra aqui."
      />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Último acesso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium break-words">{row.name}</TableCell>
                <TableCell className="break-all text-muted-foreground">{row.email}</TableCell>
                <TableCell>{isAdminRole(row.role) ? ADMIN_ROLE_LABEL[row.role] : row.role}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "active" ? "secondary" : "outline"} className="font-normal">
                    {STATUS_LABEL[row.status] ?? row.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.last_login_at ? format(row.last_login_at, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "Nunca entrou"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
