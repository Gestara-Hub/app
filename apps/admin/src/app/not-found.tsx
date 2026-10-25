import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 px-4 py-10 text-center">
      <Brand />
      <div className="w-full max-w-[400px] space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl ring-1 ring-black/5 sm:p-8 dark:ring-white/5">
        <p className="text-sm text-muted-foreground">Erro 404</p>
        <h1 className="text-2xl font-semibold tracking-tight">Página não encontrada</h1>
        <p className="text-sm text-muted-foreground">O endereço não existe ou foi movido.</p>
        <Button asChild>
          <Link href="/">Voltar ao início</Link>
        </Button>
      </div>
    </div>
  );
}
