import type { Metadata } from "next";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Aceitar convite" };

export default async function AcceptPage({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const { token_hash: token } = await searchParams;
  return <AcceptForm token={token ?? ""} />;
}
