"use client";

import { useState, type ComponentType } from "react";
import {
  AlertTriangle,
  PackageOpen,
  Plus,
  RotateCw,
  Search,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORIAS_SERVICO,
  type CategoriaServico,
  type Servico,
  type ServicoFiltro,
  type StatusCadastro,
} from "@/types";
import { useServices } from "../hooks/use-services";
import { ServiceCard } from "./service-card";

interface ServicesListProps {
  onCreate: () => void;
  onEdit: (service: Servico) => void;
  onInactivate: (service: Servico) => void;
  onReactivate: (service: Servico) => void;
}

export function ServicesList({
  onCreate,
  onEdit,
  onInactivate,
  onReactivate,
}: ServicesListProps) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<"all" | CategoriaServico>("all");
  const [status, setStatus] = useState<"all" | StatusCadastro>("all");

  const filtro: ServicoFiltro = {
    busca: busca.trim() || undefined,
    categoria: categoria === "all" ? undefined : categoria,
    status: status === "all" ? undefined : status,
  };

  const { data, isPending, isError, refetch } = useServices(filtro);
  const services = data ?? [];

  const hasBusca = Boolean(filtro.busca);
  const hasFilters = Boolean(filtro.categoria || filtro.status);

  const clearBusca = () => setBusca("");
  const clearAll = () => {
    setBusca("");
    setCategoria("all");
    setStatus("all");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por nome ou descrição..."
            className="px-8"
            aria-label="Buscar serviço"
          />
          {busca ? (
            <button
              type="button"
              onClick={clearBusca}
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        <Select
          value={categoria}
          onValueChange={(value) => setCategoria(value as "all" | CategoriaServico)}
        >
          <SelectTrigger className="sm:w-48" aria-label="Filtrar por categoria">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {CATEGORIAS_SERVICO.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(value) => setStatus(value as "all" | StatusCadastro)}
        >
          <SelectTrigger className="sm:w-36" aria-label="Filtrar por status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <SkeletonGrid />
      ) : isError ? (
        <StateCard
          icon={AlertTriangle}
          title="Não foi possível carregar os serviços. Tente novamente."
          actionLabel="Tentar novamente"
          actionIcon={RotateCw}
          onAction={() => refetch()}
        />
      ) : services.length === 0 ? (
        hasBusca ? (
          <StateCard
            icon={Search}
            title="Nenhum resultado para esta busca."
            actionLabel="Limpar busca"
            onAction={clearBusca}
          />
        ) : hasFilters ? (
          <StateCard
            icon={Search}
            title="Nenhum resultado para os filtros aplicados."
            actionLabel="Limpar filtros"
            onAction={clearAll}
          />
        ) : (
          <StateCard
            icon={PackageOpen}
            title="Nenhum serviço cadastrado ainda."
            actionLabel="Cadastrar serviço"
            actionIcon={Plus}
            onAction={onCreate}
            primary
          />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onEdit={onEdit}
              onInactivate={onInactivate}
              onReactivate={onReactivate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="space-y-3 py-5">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <div className="flex justify-between pt-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-14" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface StateCardProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  actionLabel: string;
  actionIcon?: ComponentType<{ className?: string }>;
  onAction: () => void;
  primary?: boolean;
}

function StateCard({
  icon: Icon,
  title,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
  primary,
}: StateCardProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <Icon className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{title}</p>
        <Button
          variant={primary ? "default" : "outline"}
          size="sm"
          onClick={onAction}
        >
          {ActionIcon ? <ActionIcon className="size-4" /> : null}
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
