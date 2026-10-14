import type { Metadata } from "next";
import { LandingView } from "@/features/landing";

export const metadata: Metadata = {
  title: "GestaraHub | Gestão simples para quem ensina",
  description:
    "Turmas, chamada no celular, mensalidades e evolução dos alunos em um só lugar. Para quem dá aula em grupo ou particular: lutas, pilates, dança, música, idiomas, confeitaria, artesanato e cursos livres. Plano grátis, sem cartão de crédito.",
};

export default function LandingPage() {
  return <LandingView />;
}
