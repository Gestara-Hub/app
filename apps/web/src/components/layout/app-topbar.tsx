"use client";

import { Building2, Check, LogOut, Moon, Sun, Users } from "lucide-react";
import { useTheme } from "next-themes";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut, switchUser } from "@/app/(auth)/actions";
import { userInitials } from "@/lib/session";
import { userProfileLabel } from "@/lib/labels";
import { useCurrentUser } from "@/features/auth";
import { useUsers } from "@/features/users/hooks/use-users";

export function AppTopbar() {
  const user = useCurrentUser();
  const { data: users } = useUsers({ status: "active" });
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-5" />

      <div className="hidden items-center gap-2 text-sm font-medium sm:flex">
        <Building2 className="size-4 text-muted-foreground" />
        Corte Nobre — Matriz
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9"
          aria-label="Alternar modo claro/escuro"
          title="Alternar modo claro/escuro"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Moon className="size-4 dark:hidden" />
          <Sun className="hidden size-4 dark:block" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 px-1.5 sm:px-2">
              <Avatar className="size-6">
                <AvatarFallback className="bg-secondary text-xs">
                  {userInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">
                {user.name}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{user.name}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {userProfileLabel(user.profile)}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
              <Users className="size-3.5" />
              Trocar usuário (demo)
            </DropdownMenuLabel>
            {(users ?? []).map((u) => (
              <form key={u.id} action={switchUser.bind(null, u.id)}>
                <DropdownMenuItem asChild disabled={u.id === user.id}>
                  <button type="submit" className="w-full cursor-pointer">
                    <span className="flex-1 truncate">{u.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {userProfileLabel(u.profile)}
                    </span>
                    {u.id === user.id ? <Check className="size-4" /> : null}
                  </button>
                </DropdownMenuItem>
              </form>
            ))}

            <DropdownMenuSeparator />
            <form action={signOut}>
              <DropdownMenuItem asChild variant="destructive">
                <button type="submit" className="w-full cursor-pointer">
                  <LogOut />
                  Sair
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
