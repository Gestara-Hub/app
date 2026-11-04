"use client";

import { useTeamWords } from "@/features/settings";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import type { UserProfile } from "@gestarahub/contracts";
import { Building2, Check, CircleHelp, LogOut, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/(auth)/actions";
import { switchDemoProfileAction } from "@/app/(auth)/signup-actions";
import { resetAnalytics } from "@/lib/analytics";
import { userInitials } from "@/lib/session";
import { userProfileLabel } from "@/lib/labels";
import { TwoFactorDialog, useCurrentUser, useGoogleOnlyAccount } from "@/features/auth";
import { useOrganization, useUnit } from "@/features/settings";
import { DEMO_USERS, isDemoOrganization, isDemoSpace } from "@/lib/demo";
import { settingsService } from "@/services/settings/settingsService";
import { UserPreferencesDialog } from "@/features/preferences";
import { RemindersBell } from "@/features/dashboard";
import { AccountMenuTip } from "./account-menu-tip";
import { openHelp, useSupportUnread } from "@/features/support";

export function AppTopbar() {
  const team = useTeamWords();
  const user = useCurrentUser();
  // Conta so do Google: senha e duas etapas ficam no Google, sem Seguranca aqui.
  const googleOnly = useGoogleOnlyAccount();
  const { data: unit } = useUnit();
  const { data: organization, isError: orgError } = useOrganization();
  const router = useRouter();
  // Demonstracao no banco: troca de perfil entrando como o usuario dele.
  const demo = isDemoOrganization(user.organizationId);
  const [isSwitching, startSwitch] = useTransition();
  const onSwitchProfile = (profile: UserProfile) =>
    startSwitch(async () => {
      const result = await switchDemoProfileAction(profile);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      settingsService.hydrateTenant({
        organization: result.organization,
        unit: result.unit,
        user: result.user,
        categories: result.categories,
      });
      router.push(result.redirectTo);
      router.refresh();
    });
  // Respostas do suporte ainda nao lidas (so na conta real).
  const { data: supportUnread = 0 } = useSupportUnread(!isDemoSpace(user.organizationId));
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 print:hidden">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-5" />

      <div className="flex min-w-0 items-center gap-2 text-xs font-medium sm:text-sm">
        <Building2 className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
        {/* Nome do espaco (o da configuracao inicial) e a unidade, quando tem. */}
        {organization || orgError ? (
          <span className="min-w-0 break-words leading-tight">
            {[organization?.name, unit?.name].filter(Boolean).join(" · ")}
          </span>
        ) : (
          <Skeleton className="h-4 w-32" aria-hidden />
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {/* Botão de ajuda desativado temporariamente no header (mantido no menu do usuário):
        <Button type="button" variant="ghost" size="icon" onClick={() => openHelp()} aria-label="Abrir a ajuda" title="Ajuda">
          <CircleHelp className="size-4" />
        </Button>
        */}
        <RemindersBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="size-8 rounded-full p-0"
              data-account-menu=""
              aria-label={supportUnread > 0 ? `Menu do usuário (${supportUnread} resposta do suporte)` : "Menu do usuário"}
            >
              <span className="relative">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-secondary text-xs font-medium">
                    {userInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                {supportUnread > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background bg-destructive" aria-hidden />
                ) : null}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{user.name}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {userProfileLabel(user.profile, team.title)}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setPreferencesOpen(true)}
              className="cursor-pointer"
            >
              <SlidersHorizontal className="size-4" />
              <span>Preferências</span>
            </DropdownMenuItem>
            {googleOnly ? null : (
              <DropdownMenuItem onSelect={() => setSecurityOpen(true)} className="cursor-pointer">
                <ShieldCheck className="size-4" />
                <span>Segurança</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {/* Ajuda e o Fale com a gente num item so: o painel de Ajuda termina
                com falar com a gente, relatar problema e sugerir melhoria. */}
            <DropdownMenuItem onSelect={() => openHelp()} className="cursor-pointer">
              <CircleHelp className="size-4" />
              <span>Ajuda e suporte</span>
              {supportUnread > 0 ? (
                <span className="ml-auto rounded-full bg-destructive px-1.5 text-[10px] font-semibold leading-4 text-destructive-foreground">
                  {supportUnread}
                </span>
              ) : null}
            </DropdownMenuItem>
            <DropdownMenuSeparator />

            {demo ? (
              <>
                <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                  <Users className="size-3.5" />
                  Ver a demonstração como
                </DropdownMenuLabel>
                {DEMO_USERS.map((demoUser) => (
                  <DropdownMenuItem
                    key={demoUser.profile}
                    disabled={isSwitching || demoUser.profile === user.profile}
                    onSelect={() => onSwitchProfile(demoUser.profile)}
                    className="cursor-pointer items-start"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block break-words">{demoUser.name}</span>
                      <span className="block break-words text-xs text-muted-foreground">
                        {userProfileLabel(demoUser.profile, team.title)}
                      </span>
                    </span>
                    {demoUser.profile === user.profile ? <Check className="mt-0.5 size-4" /> : null}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            ) : null}

            <form action={signOut}>
              <DropdownMenuItem asChild variant="destructive">
                <button type="submit" onClick={resetAnalytics} className="w-full cursor-pointer">
                  <LogOut />
                  Sair
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
        <AccountMenuTip supportUnread={supportUnread} demo={isDemoSpace(user.organizationId)} />
      </div>
    </header>
    <UserPreferencesDialog open={preferencesOpen} onOpenChange={setPreferencesOpen} />
    {googleOnly ? null : <TwoFactorDialog open={securityOpen} onOpenChange={setSecurityOpen} />}
    </>
  );
}
