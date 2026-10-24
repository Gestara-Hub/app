import { cn } from "@/lib/utils";

const LABEL = { local: "Ambiente local", staging: "Ambiente de teste", production: "Produção" } as const;
const COLOR = {
  local: "bg-[var(--env-local)] text-white",
  staging: "bg-[var(--env-staging)] text-black",
  production: "bg-[var(--env-production)] text-white",
} as const;

/** Faixa fina no topo: de relance, em qual ambiente a pessoa esta mexendo. */
export function EnvStrip({ env }: { env: keyof typeof LABEL }) {
  return (
    <div
      role="status"
      className={cn("flex h-5 items-center justify-center text-[10px] font-semibold tracking-wider uppercase", COLOR[env])}
    >
      {LABEL[env]}
    </div>
  );
}
