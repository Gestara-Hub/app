import type { Metadata } from "next";
import { LandingView } from "@/features/landing";

export const metadata: Metadata = {
  title: "GestaraHub | Gestão simples para quem ensina",
  description:
    "Turmas, chamada no celular, mensalidades e evolução dos alunos em um só lugar. Para academias de luta, estúdios, escolas de música, idiomas e dança. Grátis para sempre.",
};

export default function LandingPage() {
  return <LandingView />;
}
