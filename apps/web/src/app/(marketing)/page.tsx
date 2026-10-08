import type { Metadata } from "next";
import { LandingView } from "@/features/landing";

export const metadata: Metadata = {
  title:
    "GestaraHub — Plataforma de Gestão para Academias, Estúdios e Agendamentos",
  description:
    "Gestão completa de turmas, graduações de artes marciais, mensalidades, presença digital e agendamentos. Experimente grátis por 14 dias.",
};

export default function LandingPage() {
  return <LandingView />;
}
