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

export function LoginForm({ from }: { from: string }) {
  const { data: options, isLoading } = useSwitchableUsers();
  const [isPending, startTransition] = useTransition();

  // Deixar apenas a Ana Ribeiro por enquanto (conforme solicitado pelo usuário)
  const filteredOptions = (options ?? []).filter(
    (opt) => opt.user.name === "Ana Ribeiro" || opt.user.email === "ana@academiax.com",
  );

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
                <div className="truncate text-sm font-medium">
                  {opt.user.name}
                </div>
                <div className="truncate text-xs text-muted-foreground">
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
