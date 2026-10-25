"use client";

import { useTheme } from "next-themes";
import { toast } from "@/lib/toast";
import {
  Check,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Rows3,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsClient } from "@/lib/use-is-client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ThemeCustomizerPanel } from "@/components/theme/theme-customizer";
import { useUserPreferences } from "../hooks/use-user-preferences";
import { playAudioFeedback } from "@/lib/audio-feedback";
import type { ThemeMode } from "@gestarahub/contracts";

export function UserPreferencesView({ onResetComplete }: { onResetComplete?: () => void }) {
  const { preferences, updatePreference, updatePreferences, resetPreferences } =
    useUserPreferences();
  const { setTheme } = useTheme();
  // As preferencias vem do armazenamento do navegador: o servidor nao as
  // conhece. A escolha (tema, som) so aparece depois de montar, senao o
  // desenho do servidor e o do navegador diferem (achado 75 do teste geral).
  const isClient = useIsClient();
  const theme = isClient ? preferences.theme : undefined;
  const audioEnabled = isClient && preferences.audioFeedbackEnabled;

  const handleThemeChange = (mode: ThemeMode) => {
    updatePreference("theme", mode);
    setTheme(mode);
  };

  const handleAudioToggle = (enabled: boolean) => {
    updatePreference("audioFeedbackEnabled", enabled);
    if (enabled) {
      playAudioFeedback("checkin");
      toast.success("Feedback sonoro ativado.");
    } else {
      toast.info("Feedback sonoro desativado.");
    }
  };

  const handleResetOnboarding = () => {
    updatePreferences({
      onboarding: {
        dismissed: false,
        completedStepIds: [],
      },
    });
    toast.success("Checklist dos primeiros passos reativado!");
  };

  const handleResetDismissedAlerts = () => {
    updatePreference("dismissedAlertKeys", []);
    toast.success("Dicas e avisos dispensados foram restaurados.");
  };

  const handleFullReset = async () => {
    await resetPreferences();
    setTheme("system");
    toast.success("Todas as preferências foram restauradas para o padrão.");
    onResetComplete?.();
  };

  return (
    <div className="space-y-6">
      {/* 1. Aparência e Tema */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Aparência e Tema</h3>
          <p className="text-xs text-muted-foreground">
            Escolha o esquema de cores e o modo de exibição do sistema.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Modo Claro */}
          <button
            type="button"
            onClick={() => handleThemeChange("light")}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border-2 p-3 text-center transition-all hover:border-primary/50",
              theme === "light"
                ? "border-primary bg-primary/5 text-primary font-medium"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            <Sun className="size-5" />
            <span className="text-xs">Claro</span>
            {theme === "light" && <Check className="size-3 text-primary" />}
          </button>

          {/* Modo Escuro */}
          <button
            type="button"
            onClick={() => handleThemeChange("dark")}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border-2 p-3 text-center transition-all hover:border-primary/50",
              theme === "dark"
                ? "border-primary bg-primary/5 text-primary font-medium"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            <Moon className="size-5" />
            <span className="text-xs">Escuro</span>
            {theme === "dark" && <Check className="size-3 text-primary" />}
          </button>

          {/* Automático / Sistema */}
          <button
            type="button"
            onClick={() => handleThemeChange("system")}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border-2 p-3 text-center transition-all hover:border-primary/50",
              theme === "system"
                ? "border-primary bg-primary/5 text-primary font-medium"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            <Monitor className="size-5" />
            <span className="text-xs">Sistema</span>
            {theme === "system" && <Check className="size-3 text-primary" />}
          </button>
        </div>

        {/* Estilização Completa do Tema */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Palette className="size-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-foreground">Estilização do Tema</h4>
              <p className="text-[11px] text-muted-foreground">
                Personalize cores de destaque, base neutra, tipografia e bordas.
              </p>
            </div>
          </div>
          <ThemeCustomizerPanel />
        </div>
      </section>

      {/* 2. Sons */}
      <section className="space-y-3 border-t border-border/40 pt-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Sons</h3>
          <p className="text-xs text-muted-foreground">
            Sinais sonoros nas tarefas rápidas do dia a dia.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center gap-3">
            {audioEnabled ? (
              <Volume2 className="size-5 text-primary" />
            ) : (
              <VolumeX className="size-5 text-muted-foreground" />
            )}
            <div>
              <Label className="text-xs font-medium text-foreground">
                Sons de confirmação (presença)
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Toca um bipe discreto ao marcar presença de aluno na lista de chamada.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => playAudioFeedback("checkin")}
              title="Testar som"
            >
              Testar
            </Button>
            <Switch
              checked={audioEnabled}
              onCheckedChange={handleAudioToggle}
              aria-label="Ativar feedback sonoro"
            />
          </div>
        </div>
      </section>

      {/* 3. Restauração e Primeiros Passos */}
      <section className="space-y-3 border-t border-border/40 pt-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Guias e Restauração</h3>
          <p className="text-xs text-muted-foreground">
            Recupere tutoriais, checklist e retorne as preferências ao estado inicial.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleResetOnboarding}
            className="text-xs"
          >
            <Sparkles className="size-3.5" />
            Reativar primeiros passos
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleResetDismissedAlerts}
            className="text-xs"
          >
            <Rows3 className="size-3.5" />
            Restaurar dicas dispensadas
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={handleFullReset}
            className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <RotateCcw className="size-3.5" />
            Restaurar padrões de fábrica
          </Button>
        </div>
      </section>
    </div>
  );
}
