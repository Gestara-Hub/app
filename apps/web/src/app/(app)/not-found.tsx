import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

// 404 dentro do app shell (notFound() chamado por uma page do grupo (app)).
export default function AppNotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <FileQuestion className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold tracking-tight">
        Página não encontrada
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        O registro ou a página que você procura não existe ou foi removido.
      </p>
      <Button asChild>
        <Link href="/">Voltar para o início</Link>
      </Button>
    </div>
  );
}
