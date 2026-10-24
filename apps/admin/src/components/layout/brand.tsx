import Image from "next/image";
import icon from "@/assets/icon.png";

/** Marca do GestaraHub com o selo "Admin" (a identidade do app dos clientes, em outro uso). */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Image src={icon} alt="" width={28} height={28} className="size-7 shrink-0" priority />
      {compact ? null : (
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">GestaraHub</span>
          <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Painel admin</span>
        </span>
      )}
    </span>
  );
}
