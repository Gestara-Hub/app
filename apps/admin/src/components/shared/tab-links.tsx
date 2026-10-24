import Link from "next/link";
import { cn } from "@/lib/utils";

/** Abas por endereco (`?tab=`): cada uma e um link, a pagina renderiza so a ativa no servidor. */
export function TabLinks({ tabs, active, href }: { tabs: { value: string; label: string }[]; active: string; href: (tab: string) => string }) {
  return (
    <nav className="mb-4 flex flex-wrap gap-1 border-b" aria-label="Seções">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={href(tab.value)}
          aria-current={tab.value === active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            tab.value === active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
