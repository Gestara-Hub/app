import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { BackLink } from "@/components/shared/back-link";
import { requireAdmin } from "@/lib/server/context";
import { AnnouncementForm } from "../announcement-form";

export const metadata: Metadata = { title: "Novo comunicado" };

export default async function NewAnnouncementPage() {
  await requireAdmin("announcements:manage");
  return (
    <>
      <BackLink href="/announcements" />
      <PageHeader title="Novo comunicado" description="Confira quantos espaços recebem antes de publicar." />
      <AnnouncementForm values={{ title: "", body: "", severity: "info", audience: "all", tiers: [], areas: [], spaces: "", startsAt: "", endsAt: "" }} />
    </>
  );
}
