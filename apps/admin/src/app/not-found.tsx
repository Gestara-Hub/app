import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm text-muted-foreground">Erro 404</p>
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <Button asChild>
        <Link href="/">Voltar ao início</Link>
      </Button>
    </div>
  );
}
