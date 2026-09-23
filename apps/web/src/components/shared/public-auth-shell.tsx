import Image from "next/image";
import type { ReactNode } from "react";
import {
  Briefcase,
  CalendarClock,
  GraduationCap,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import logoLightImage from "@/assets/logo-light.png";
import logoDarkImage from "@/assets/logo-dark.png";

type PublicAuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

const BASE_MODULES = [
  { icon: CalendarClock, label: "Agenda" },
  { icon: GraduationCap, label: "Turmas & Aulas" },
  { icon: Users, label: "Clientes & Alunos" },
  { icon: Briefcase, label: "Equipe" },
  { icon: Store, label: "Serviços & Modalidades" },
  { icon: Wallet, label: "Mensalidades & Planos" },
];

const ADDON_MODULES = [
  "Comunicação & Notificações",
  "Analytics & Relatórios",
  "Controle de Caixa & Despesas",
  "Pagamentos Online & Pix",
  "Múltiplas Unidades",
];

export function PublicAuthShell({ title, subtitle, children }: PublicAuthShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(14,165,233,0.14),transparent_34%),radial-gradient(circle_at_86%_86%,rgba(99,102,241,0.12),transparent_36%)] dark:bg-[radial-gradient(circle_at_16%_18%,rgba(14,165,233,0.09),transparent_32%),radial-gradient(circle_at_86%_86%,rgba(139,92,246,0.1),transparent_34%)]" />
        <div className="absolute left-[-8rem] top-[-8rem] h-64 w-64 rounded-full bg-primary/15 blur-3xl motion-safe:animate-pulse dark:bg-primary/10" />
        <div className="absolute bottom-[-9rem] right-[-7rem] h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl motion-safe:animate-pulse dark:bg-cyan-500/10" />
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-6 py-10 lg:grid-cols-[1fr_460px]">
        <section className="hidden lg:block">
          <div className="max-w-xl space-y-7">
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground">
                GestaraHub
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Gestão completa do seu negócio — agenda, turmas, clientes, equipe e
                mensalidades, em um só lugar.
              </p>
            </div>

            <div className="space-y-3">
              {/* Lista informativa dos modulos: sem borda nem hover, nao e clicavel */}
              <ul className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {BASE_MODULES.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.label} className="flex items-center gap-2.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="text-sm text-foreground">{item.label}</span>
                    </li>
                  );
                })}
              </ul>

              <div className="pt-1 text-sm text-muted-foreground">
                <span>Complementos: </span>
                <span className="relative inline-flex items-center group">
                  <span className="cursor-help font-medium text-foreground underline decoration-dotted underline-offset-2">
                    ver mais
                  </span>
                  <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-72 translate-y-1 rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground opacity-0 shadow-lg transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                    <strong className="block pb-1 text-[11px] tracking-wide text-muted-foreground">
                      Complementos
                    </strong>
                    {ADDON_MODULES.map((addon) => (
                      <span key={addon} className="block py-0.5">
                        • {addon}
                      </span>
                    ))}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="mb-5 flex justify-center">
            <Image src={logoLightImage} alt="GestaraHub" className="h-20 w-auto dark:hidden" priority />
            <Image src={logoDarkImage} alt="GestaraHub" className="hidden h-20 w-auto dark:block" priority />
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute -inset-[1px] rounded-[1.1rem] bg-gradient-to-r from-primary/25 via-primary/15 to-primary/20 opacity-40 blur-sm motion-safe:animate-pulse dark:opacity-60" />
            <Card className="relative border-border/70 bg-card/95 shadow-lg backdrop-blur">
              <CardHeader className="space-y-2 pb-4">
                <CardTitle className="text-3xl font-semibold tracking-tight">
                  {title}
                </CardTitle>
                <CardDescription className="text-sm">{subtitle}</CardDescription>
              </CardHeader>
              <CardContent>{children}</CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
