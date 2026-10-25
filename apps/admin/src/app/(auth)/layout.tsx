import { EnvStrip } from "@/components/layout/env-strip";
import { Brand } from "@/components/layout/brand";
import { getEnv } from "@/lib/server/env";

/** Moldura das telas de entrada: faixa do ambiente, marca e um cartão estreito centralizado. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <EnvStrip env={getEnv().ADMIN_ENV_LABEL} />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
        <Brand />
        <div className="w-full max-w-[400px]">{children}</div>
        <p className="max-w-[400px] text-center text-xs text-muted-foreground">
          Acesso restrito à equipe do GestaraHub. Tudo o que você faz aqui fica registrado.
        </p>
      </div>
    </div>
  );
}
