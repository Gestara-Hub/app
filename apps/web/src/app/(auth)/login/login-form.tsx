"use client";

import { useTransition } from "react";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { userInitials } from "@/lib/session";
import { userProfileLabel } from "@/lib/labels";
import { useSwitchableUsers } from "@/features/users/hooks/use-users";
import type { UserSwitchOption } from "@/services/usersService";
import { signIn } from "../actions";

/** Usuario de demonstracao (dona da Academia X no seed). */
const DEMO_OWNER_ID = "usr-ac-ana";

export function LoginForm({ from }: { from: string }) {
  const { data: options, isLoading } = useSwitchableUsers();
  const [isPending, startTransition] = useTransition();

  // Demo: so a dona da Academia X, pelo id (trocar nome ou e-mail nao tranca a conta).
  const filteredOptions = (options ?? []).filter((opt) => opt.user.id === DEMO_OWNER_ID);

  const onSelect = (opt: UserSwitchOption) => {
    startTransition(async () => {
      // Se for proprietário e ainda não concluiu o setup inicial, vai direto para /setup
      const destination =
        !opt.onboardingCompleted && opt.user.profile === "owner" ? "/setup" : from;
      await signIn(opt.user, destination);
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Selecione o usuário de demonstração para acessar o sistema.
      </p>

      <div className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-16 w-full rounded-lg" />
        ) : filteredOptions.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            Nenhum usuário disponível. Recarregue a página.
          </p>
        ) : (
          filteredOptions.map((opt) => (
            <button
              key={opt.user.id}
              type="button"
              onClick={() => onSelect(opt)}
              disabled={isPending}
              className="flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent disabled:pointer-events-none disabled:opacity-60"
            >
              <Avatar className="size-9">
                <AvatarFallback className="bg-secondary text-sm">
                  {userInitials(opt.user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="min-w-0 break-words text-sm font-medium">
                  {opt.user.name}
                </div>
                <div className="min-w-0 break-words text-xs text-muted-foreground">
                  {opt.organizationName} · {userProfileLabel(opt.user.profile)}
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))
        )}
      </div>

      {isPending ? (
        <p className="text-xs text-muted-foreground">Entrando…</p>
      ) : null}
    </div>
  );
}
