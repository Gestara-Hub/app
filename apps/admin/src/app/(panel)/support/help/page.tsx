import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/server/context";
import { listHelpFeedback, listHelpMisses } from "@/lib/server/support";

export const metadata: Metadata = { title: "Uso da ajuda" };

const DAYS = 30;

/** Pelo que o app mostra: o que as pessoas buscam e não acham, e quais artigos não ajudam. */
export default async function HelpUsagePage() {
  await requireAdmin("support:view");
  const [misses, feedback] = await Promise.all([listHelpMisses(DAYS), listHelpFeedback(DAYS)]);
  return (
    <>
      <Button asChild variant="ghost" className="mb-2 -ml-2">
        <Link href="/support">
          <ArrowLeft className="size-4" /> Voltar ao Suporte
        </Link>
      </Button>
      <PageHeader title="Uso da ajuda" description={`Últimos ${DAYS} dias. Mostra o que falta escrever e o que precisa melhorar nos artigos.`} />

      <h2 className="mb-2 text-base font-semibold">Buscas sem resultado</h2>
      <Card className="mb-6 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>O que buscaram</TableHead>
              <TableHead className="text-right">Buscas</TableHead>
              <TableHead className="text-right">Espaços</TableHead>
              <TableHead>Última vez</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {misses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  Nenhuma busca sem resultado no período.
                </TableCell>
              </TableRow>
            ) : (
              misses.map((miss) => (
                <TableRow key={miss.term}>
                  <TableCell className="break-words font-medium">{miss.term}</TableCell>
                  <TableCell className="text-right tabular-nums">{miss.searches}</TableCell>
                  <TableCell className="text-right tabular-nums">{miss.spaces}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{format(miss.lastAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <h2 className="mb-2 text-base font-semibold">Isso ajudou?</h2>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trecho do artigo</TableHead>
              <TableHead className="text-right">Ajudou</TableHead>
              <TableHead className="text-right">Não ajudou</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feedback.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                  Ninguém avaliou um trecho no período.
                </TableCell>
              </TableRow>
            ) : (
              feedback.map((row) => (
                <TableRow key={row.chunkId}>
                  <TableCell className="break-all font-mono text-xs">{row.chunkId}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.helpful}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.notHelpful}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
