import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listSpaceUsers } from "@/lib/server/user-two-factor";
import { InactivateSpaceForm, ReactivateSpaceForm, ResetUserTwoFactorForm } from "./plan-forms";

/** Aba "Dados e LGPD": exportar os dados do espaco e inativar/reativar (so o proprietario chega aqui). */
const PROFILE_LABEL: Record<string, string> = { owner: "Proprietário", manager: "Gerente", attendant: "Atendente", professional: "Profissional" };

export async function DataTab({ space }: { space: { id: string; name: string; status: string } }) {
  const inactive = space.status === "inactive";
  const users = (await listSpaceUsers(space.id))
    .filter((u) => u.authUserId && (u.app || u.email2fa))
    .map((u) => ({
      id: u.userId,
      label: `${u.name} (${PROFILE_LABEL[u.profile] ?? u.profile}) · ${[u.app ? "aplicativo" : null, u.email2fa ? "e-mail" : null].filter(Boolean).join(" e ")}`,
    }));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exportar os dados do espaço</CardTitle>
          <CardDescription>
            Arquivo com o cadastro e a operação do espaço (alunos, turmas, cobranças...), sem senhas nem chaves. Para pedidos de acesso ou portabilidade do titular. Fica registrado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={`/spaces/${space.id}/export`} method="post" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="export-reason">Motivo (fica registrado)</Label>
              <Textarea id="export-reason" name="reason" rows={2} required minLength={5} maxLength={300} className="text-base md:text-sm" />
            </div>
            <Button type="submit" variant="outline">
              Baixar arquivo
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="lg:col-span-2">
        {users.length > 0 ? (
          <ResetUserTwoFactorForm spaceId={space.id} users={users} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reiniciar a verificação em duas etapas de uma pessoa</CardTitle>
              <CardDescription>Ninguém deste espaço usa a verificação em duas etapas hoje.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
      {inactive ? <ReactivateSpaceForm spaceId={space.id} /> : <InactivateSpaceForm spaceId={space.id} />}
    </div>
  );
}
