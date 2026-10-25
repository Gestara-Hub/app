import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { BackLink } from "@/components/shared/back-link";
import { toBrasiliaInput } from "@/lib/format";
import { getAnnouncement } from "@/lib/server/announcements";
import { requireAdmin } from "@/lib/server/context";
import { AnnouncementForm } from "../announcement-form";

export const metadata: Metadata = { title: "Editar comunicado" };

export default async function EditAnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("announcements:manage");
  const { id } = await params;
  const row = /^[0-9a-f-]{36}$/i.test(id) ? await getAnnouncement(id) : null;
  if (!row) notFound();
  return (
    <>
      <BackLink href="/announcements" label="Voltar aos Comunicados" />
      <PageHeader title="Editar comunicado" description={`${row.dismissed} ${row.dismissed === 1 ? "pessoa dispensou" : "pessoas dispensaram"}.`} />
      <AnnouncementForm
        values={{
          id: row.id,
          title: row.title,
          body: row.body,
          severity: row.severity,
          audience: row.audience,
          tiers: row.filter.tiers ?? [],
          areas: row.filter.areas ?? [],
          spaces: (row.filter.spaces ?? []).join("\n"),
          startsAt: toBrasiliaInput(row.startsAt),
          endsAt: toBrasiliaInput(row.endsAt),
        }}
      />
    </>
  );
}
