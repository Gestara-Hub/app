import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface InitialsAvatarProps {
  name: string;
  className?: string;
  size?: "default" | "sm" | "lg";
  /**
   * Cor com significado vinda de fora (ex.: a da modalidade, igual ao
   * Calendario). Pessoas ficam neutras: a cor por pessoa foi testada em
   * 10/11/2026 e enchia as listas de cor sem dizer nada.
   */
  tone?: string;
}

export function InitialsAvatar({
  name,
  className,
  size = "default",
  tone,
}: InitialsAvatarProps) {
  return (
    <Avatar
      size={size}
      className={cn(
        "size-9 shrink-0 border text-xs font-semibold select-none",
        tone ?? "border-border/50 bg-muted/60 text-foreground/80",
        className,
      )}
    >
      <AvatarFallback className={cn("text-xs font-semibold", tone ? "bg-transparent text-inherit" : "bg-muted/70 text-foreground")}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
