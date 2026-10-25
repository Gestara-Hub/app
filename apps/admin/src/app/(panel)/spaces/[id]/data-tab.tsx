import { ListContainer, ListRow } from "@/components/shared/list";
import { SectionHeading } from "@/components/shared/fact-list";
import { listSpaceUsers } from "@/lib/server/user-two-factor";
import { ExportDrawer } from "./export-drawer";
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
    <div className="space-y-6">
      <section>
        <SectionHeading title="Dados do titular" description="Tudo o que for feito aqui fica registrado na auditoria do painel." />
        <ListContainer>
          <ListRow actions={<ExportDrawer spaceId={space.id} />}>
            <p className="font-medium">Exportar os dados do espaço</p>
            <p className="min-w-0 break-words text-sm text-muted-foreground">Para pedidos de acesso ou portabilidade. Sem senhas nem chaves.</p>
          </ListRow>
          {users.length > 0 ? (
            <ResetUserTwoFactorForm spaceId={space.id} users={users} />
          ) : (
            <ListRow>
              <p className="font-medium">Reiniciar a verificação em duas etapas de uma pessoa</p>
              <p className="min-w-0 break-words text-sm text-muted-foreground">Ninguém deste espaço usa a verificação em duas etapas hoje.</p>
            </ListRow>
          )}
        </ListContainer>
      </section>
      <section>
        <SectionHeading title="Acesso ao espaço" />
        <ListContainer>{inactive ? <ReactivateSpaceForm spaceId={space.id} /> : <InactivateSpaceForm spaceId={space.id} />}</ListContainer>
      </section>
    </div>
  );
}
