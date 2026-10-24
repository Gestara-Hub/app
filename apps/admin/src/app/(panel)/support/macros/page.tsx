import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/server/context";
import { listMacros } from "@/lib/server/support";
import { deleteMacroAction } from "../actions";
import { MacroForm } from "./macro-form";

export const metadata: Metadata = { title: "Respostas prontas" };

export default async function MacrosPage() {
  await requireAdmin("support:reply");
  const macros = await listMacros();
  return (
    <>
      <Button asChild variant="ghost" className="mb-2 -ml-2">
        <Link href="/support">
          <ArrowLeft className="size-4" /> Voltar ao Suporte
        </Link>
      </Button>
      <PageHeader title="Respostas prontas" description="Textos que você insere na resposta ao cliente com um clique." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nova resposta pronta</CardTitle>
          </CardHeader>
          <CardContent>
            <MacroForm />
          </CardContent>
        </Card>
        {macros.map((macro) => (
          <Card key={macro.id}>
            <CardHeader>
              <CardTitle className="text-base break-words">{macro.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <MacroForm macro={macro} />
              <form action={deleteMacroAction}>
                <input type="hidden" name="id" value={macro.id} />
                <Button type="submit" variant="ghost" className="text-destructive">
                  Excluir
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
