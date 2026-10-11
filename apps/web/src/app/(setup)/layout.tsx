import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { getOrganizationTier } from "@/features/auth/get-subscription-tier";
import { organizationModelById } from "@/mocks/store";
import { SessionProvider } from "@/features/auth/session-provider";

export default async function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?from=/setup");

  const model = organizationModelById(user.organizationId) ?? "classes";
  const tier = await getOrganizationTier(user.organizationId);

  return (
    <SessionProvider user={user} model={model} tier={tier}>
      <div className="min-h-screen bg-background text-foreground">
        {children}
      </div>
    </SessionProvider>
  );
}
