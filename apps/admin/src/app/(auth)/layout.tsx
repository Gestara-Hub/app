import { EnvStrip } from "@/components/layout/env-strip";
import { Brand } from "@/components/layout/brand";
import { getEnv } from "@/lib/server/env";

/** Moldura das telas de entrada: marca, ambiente e um cartao estreito no meio. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <EnvStrip env={getEnv().ADMIN_ENV_LABEL} />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
        <Brand />
        <div className="w-full max-w-sm">{children}</div>
        <p className="max-w-sm text-center text-xs text-muted-foreground">
          Acesso restrito à equipe do GestaraHub. Tudo o que você faz aqui fica registrado.
        </p>
      </div>
    </div>
  );
}
