"use client";

import { Check, ListChecks, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@gestarahub/core/api-error";
import { useModalitiesReviewOnBanner } from "@/lib/modalities-review-signal";
import {
  useBusinessSegment,
  useMarkModalitiesReviewed,
  useOrganization,
} from "@/features/settings";

/**
 * Aviso enquanto as modalidades criadas no setup nao foram revisadas: explica a
 * trilha de evolucao (vale para qualquer area). Quando o aviso de configuracao
 * inicial do topo mostra o "Esta tudo certo", confirma-se la; senao (outro
 * perfil ou outro passo pendente), aqui. Editar e salvar uma modalidade tambem
 * fecha.
 */
export function ModalitiesReviewNotice() {
  const { data: organization } = useOrganization();
  const segment = useBusinessSegment();
  const markMut = useMarkModalitiesReviewed();
  const confirmsOnBanner = useModalitiesReviewOnBanner();

  if (organization?.settings?.modalitiesReviewed !== false) return null;

  const trackTitle = segment.vocabulary.trackTitle.toLowerCase();
  const trackStartsOff = segment.progressionTemplate === null;

  async function markReviewed() {
    try {
      await markMut.mutateAsync();
      toast.success("Modalidades revisadas.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível concluir a revisão."));
    }
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400">
          <ListChecks className="size-4" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Revise as modalidades criadas na configuração inicial
          </p>
          <p className="text-xs text-muted-foreground">
            Cada modalidade pode ter uma {trackTitle}: a ordem de evolução e a
            meta de aulas para avançar. Confira se os níveis e as metas batem
            com o seu jeito de ensinar.
          </p>
          {trackStartsOff ? (
            <p className="text-xs text-muted-foreground">
              Nas suas modalidades a trilha veio desligada; ligue se quiser
              acompanhar o progresso dos alunos.
            </p>
          ) : null}
          {confirmsOnBanner ? (
            <p className="text-xs font-medium text-foreground">
              Quando estiver tudo certo, confirme em “Está tudo certo” no aviso acima.
            </p>
          ) : null}
        </div>
      </div>
      {confirmsOnBanner ? null : (
      <Button
        type="button"
        variant="outline"
        className="shrink-0"
        disabled={markMut.isPending}
        onClick={markReviewed}
      >
        {markMut.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
        Está tudo certo
      </Button>
      )}
    </div>
  );
}
