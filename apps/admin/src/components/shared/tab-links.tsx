import Link from "next/link";
import { cn } from "@/lib/utils";

/** Abas de uma tela de detalhe por endereço (`?tab=`): cada uma é um link, a página renderiza só a ativa no servidor. */
export function TabLinks({ tabs, active, href }: { tabs: { value: string; label: string }[]; active: string; href: (tab: string) => string }) {
  return (
    <nav className="mb-5 flex gap-1 overflow-x-auto border-b" aria-label="Seções">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={href(tab.value)}
          aria-current={tab.value === active ? "page" : undefined}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
            tab.value === active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
