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
}

export function InitialsAvatar({
  name,
  className,
  size = "default",
}: InitialsAvatarProps) {
  return (
    <Avatar
      size={size}
      className={cn(
        "size-9 shrink-0 border border-border/50 bg-muted/60 text-xs font-semibold text-foreground/80 select-none",
        className,
      )}
    >
      <AvatarFallback className="bg-muted/70 text-foreground text-xs font-semibold">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
