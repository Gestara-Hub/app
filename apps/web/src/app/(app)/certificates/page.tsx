import { CertificatesView } from "@/features/certificates";
import { requirePermission } from "@/features/auth/require-permission";

export default async function CertificatesPage() {
  await requirePermission("classes:manage", "/certificates");
  return <CertificatesView />;
}
