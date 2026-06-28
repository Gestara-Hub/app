"use client";

import { Clock, MoreVertical, Pencil, Power, PowerOff } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCentavos, formatDuracao } from "@/lib/format";
import type { Servico } from "@/types";
import { ServiceStatusBadge } from "./service-status-badge";

interface ServiceCardProps {
  service: Servico;
  onEdit: (service: Servico) => void;
  onInactivate: (service: Servico) => void;
  onReactivate: (service: Servico) => void;
}

export function ServiceCard({
  service,
  onEdit,
  onInactivate,
  onReactivate,
}: ServiceCardProps) {
  const ativo = service.status === "ativo";

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base leading-tight">{service.nome}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2 pt-1">
          <ServiceStatusBadge status={service.status} />
          <span>{service.categoria}</span>
        </CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground"
              >
                <MoreVertical className="size-4" />
                <span className="sr-only">Ações do serviço</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(service)}>
                <Pencil />
                Editar
              </DropdownMenuItem>
              {ativo ? (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onInactivate(service)}
                >
                  <PowerOff />
                  Inativar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onReactivate(service)}>
                  <Power />
                  Reativar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>

      <CardContent className="flex-1">
        {service.descricao ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {service.descricao}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground/60 italic">
            Sem descrição
          </p>
        )}
      </CardContent>

      <CardFooter className="justify-between border-t pt-4 text-sm">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Clock className="size-3.5" />
          {formatDuracao(service.duracaoMinutos)}
        </span>
        <span className="font-semibold text-foreground">
          {formatCentavos(service.precoCentavos)}
        </span>
      </CardFooter>
    </Card>
  );
}
