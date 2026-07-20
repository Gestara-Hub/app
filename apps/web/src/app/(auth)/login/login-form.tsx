"use client";

import { useTransition } from "react";
import { ChevronRight } from "lucide-react";
import type { UserView } from "@gestarahub/contracts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { userInitials } from "@/lib/session";
import { userProfileLabel } from "@/lib/labels";
import { useSwitchableUsers } from "@/features/users/hooks/use-users";
import { signIn } from "../actions";

export function LoginForm({ from }: { from: string }) {
  const { data: options, isLoading } = useSwitchableUsers();
  const [isPending, startTransition] = useTransition();

  const onSelect = (user: UserView) => {
    startTransition(async () => {
      await signIn(user, from);
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Selecione um usuário para entrar (ambiente de demonstração). Cada
        organização usa um modelo diferente — escolher um usuário entra na
        organização dele.
      </p>

      <div className="space-y-2">
        {isLoading
          ? [0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))
          : (options ?? []).map((opt) => (
              <button
                key={opt.user.id}
                type="button"
                onClick={() => onSelect(opt.user)}
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
            ))}
      </div>

      {isPending ? (
        <p className="text-xs text-muted-foreground">Entrando…</p>
      ) : null}
    </div>
  );
}
