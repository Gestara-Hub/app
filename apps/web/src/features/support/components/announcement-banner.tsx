"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Info, Megaphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { unwrap } from "@/services/server/action";
import { dismissAnnouncementAction, listAnnouncementsAction, type AnnouncementView } from "@/services/support/announcementActions";

const STYLE: Record<AnnouncementView["severity"], { box: string; icon: typeof Info }> = {
  info: { box: "border-sky-500/30 bg-sky-500/10", icon: Megaphone },
  warning: { box: "border-amber-500/30 bg-amber-500/10", icon: Info },
  urgent: { box: "border-destructive/40 bg-destructive/10", icon: AlertTriangle },
};

/**
 * Comunicados do GestaraHub no topo do app (manutencao, novidade, termo novo...).
 * Dispensa por pessoa; o urgente fica ate acabar. Confere a cada 5 minutos.
 */
export function AnnouncementBanner() {
  const queryClient = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => unwrap(listAnnouncementsAction()),
    refetchInterval: 5 * 60_000,
    retry: false,
    staleTime: 60_000,
  });
  const dismiss = useMutation({
    mutationFn: (id: string) => unwrap(dismissAnnouncementAction(id)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["announcements"] }),
  });
  if (data.length === 0) return null;
  return (
    <div className="space-y-2 px-4 pt-3 print:hidden" aria-label="Comunicados do GestaraHub">
      {data.map((item) => {
        const { box, icon: Icon } = STYLE[item.severity];
        return (
          <div key={item.id} role={item.severity === "urgent" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-lg border p-3 text-sm", box)}>
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium break-words">{item.title}</p>
              <p className="mt-0.5 break-words text-muted-foreground">{item.body}</p>
            </div>
            {item.severity !== "urgent" ? (
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Dispensar: ${item.title}`} onClick={() => dismiss.mutate(item.id)}>
                <X />
              </Button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
