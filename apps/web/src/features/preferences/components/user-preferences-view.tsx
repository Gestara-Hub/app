"use client";

import { useTheme } from "next-themes";
import { toast } from "@/lib/toast";
import { BellOff, BellRing, Check, Monitor, Moon, RotateCcw, Rows3, Sparkles, Sun, Volume2, VolumeX } from "lucide-react";
import { CHECKIN_SOUNDS, type CheckinSound, type ThemeMode } from "@gestarahub/contracts";
import { cn } from "@/lib/utils";
import { useIsClient } from "@/lib/use-is-client";
import { THEME_COLORS, useThemeColor } from "@/lib/theme-accent";
import { CHECKIN_SOUND_LABELS, playAudioFeedback, playBellChime } from "@/lib/audio-feedback";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirmAction } from "@/components/shared/confirm-action-dialog";
import { useUserPreferences } from "../hooks/use-user-preferences";

const THEME_MODES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Do sistema", icon: Monitor },
];

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

/**
 * Preferências de cada pessoa (menu da conta). Desde 31/10/2026: tema, cor de
 * destaque e sons; o personalizador completo (fontes, cantos, menu) saiu.
 */
export function UserPreferencesView({ onResetComplete }: { onResetComplete?: () => void }) {
  const { preferences, updatePreference, updatePreferences, resetPreferences } = useUserPreferences();
  const { setTheme } = useTheme();
  const [themeColor, setThemeColor] = useThemeColor();
  const { confirm, dialog: confirmDialog } = useConfirmAction();
  // As preferencias vem do armazenamento do navegador: o servidor nao as
  // conhece. A escolha (tema, cor, som) so aparece depois de montar, senao o
  // desenho do servidor e o do navegador diferem (achado 75 do teste geral).
  const isClient = useIsClient();
  const theme = isClient ? preferences.theme : undefined;
  const color = isClient ? themeColor : undefined;
  const audioEnabled = isClient && preferences.audioFeedbackEnabled;
  const bellSoundEnabled = isClient && preferences.bellSoundEnabled !== false;
  // Som que saiu da lista (ou nenhum salvo): fica a confirmacao, o padrao.
  const savedSound = isClient ? preferences.checkinSound : undefined;
  const checkinSound: CheckinSound = savedSound && CHECKIN_SOUNDS.includes(savedSound) ? savedSound : "confirm";

  const handleThemeChange = (mode: ThemeMode) => {
    updatePreference("theme", mode);
    setTheme(mode);
  };

  const handleAudioToggle = (enabled: boolean) => {
    updatePreference("audioFeedbackEnabled", enabled);
    if (enabled) {
      playAudioFeedback("checkin", checkinSound);
      toast.success("Som ligado.");
    } else {
      toast.info("Som desligado.");
    }
  };

  const handleBellSoundToggle = (enabled: boolean) => {
    updatePreference("bellSoundEnabled", enabled);
    if (enabled) {
      playBellChime();
      toast.success("Som do sino ligado.");
    } else {
      toast.info("Som do sino desligado.");
    }
  };

  // Escolher no select ja toca o som: a previa e a propria escolha.
  const handleSoundChange = (sound: CheckinSound) => {
    updatePreference("checkinSound", sound);
    playAudioFeedback("checkin", sound);
  };

  const handleResetOnboarding = () => {
    updatePreferences({ onboarding: { dismissed: false, completedStepIds: [] } });
    toast.success("Primeiros passos de volta no painel.");
  };

  const handleResetDismissedAlerts = () => {
    updatePreference("dismissedAlertKeys", []);
    toast.success("Dicas e avisos dispensados voltaram.");
  };

  const handleFullReset = async () => {
    const ok = await confirm({
      title: "Voltar ao padrão?",
      description: "Tema, cor, som, primeiros passos e dicas voltam como no primeiro acesso.",
      confirmLabel: "Voltar ao padrão",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    await resetPreferences();
    setTheme("system");
    toast.success("Preferências de volta ao padrão.");
    onResetComplete?.();
  };

  return (
    <div className="space-y-6">
      {confirmDialog}
      <section className="space-y-3">
        <SectionTitle title="Aparência" description="Tema e cor de destaque das telas." />

        <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-3">
          {THEME_MODES.map(({ value, label, icon: Icon }) => {
            const selected = theme === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => handleThemeChange(value)}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-3 text-center transition-all hover:border-primary/50",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  selected
                    ? "border-primary bg-primary/5 font-medium text-primary"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
                <span className="text-xs">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Cor de destaque</p>
          <div role="radiogroup" aria-label="Cor de destaque" className="flex flex-wrap gap-2">
            {THEME_COLORS.map((option) => {
              const selected = color === option.name;
              return (
                <button
                  key={option.name}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={option.label}
                  title={option.label}
                  onClick={() => setThemeColor(option.name)}
                  className={cn(
                    "flex size-8 cursor-pointer items-center justify-center rounded-full border-2 border-background ring-1 ring-border transition-shadow",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected && "ring-2 ring-foreground",
                  )}
                  style={{ backgroundColor: option.color }}
                >
                  {selected ? <Check className="size-4 text-white" aria-hidden /> : null}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-border/40 pt-4">
        <SectionTitle title="Sons" description="Sinais sonoros nas tarefas rápidas do dia a dia." />
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center gap-3">
            {audioEnabled ? (
              <Volume2 className="size-5 shrink-0 text-primary" />
            ) : (
              <VolumeX className="size-5 shrink-0 text-muted-foreground" />
            )}
            <div>
              <p className="text-xs font-medium text-foreground">Som ao marcar presença</p>
              <p className="text-[11px] text-muted-foreground">Toca na lista de chamada.</p>
            </div>
          </div>
          <Switch checked={audioEnabled} onCheckedChange={handleAudioToggle} aria-label="Som ao marcar presença" />
        </div>
        {audioEnabled ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
            <p className="text-xs font-medium text-foreground">Som</p>
            <div className="flex items-center gap-2">
              <Select value={checkinSound} onValueChange={(value) => handleSoundChange(value as CheckinSound)}>
                <SelectTrigger className="w-36 text-base md:text-sm" aria-label="Som ao marcar presença">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHECKIN_SOUNDS.map((sound) => (
                    <SelectItem key={sound} value={sound}>
                      {CHECKIN_SOUND_LABELS[sound]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={() => playAudioFeedback("checkin", checkinSound)}>
                Testar
              </Button>
            </div>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center gap-3">
            {bellSoundEnabled ? (
              <BellRing className="size-5 shrink-0 text-primary" />
            ) : (
              <BellOff className="size-5 shrink-0 text-muted-foreground" />
            )}
            <div>
              <p className="text-xs font-medium text-foreground">Som do sino</p>
              <p className="text-[11px] text-muted-foreground">Toca quando chega um lembrete novo.</p>
            </div>
          </div>
          <Switch checked={bellSoundEnabled} onCheckedChange={handleBellSoundToggle} aria-label="Som do sino" />
        </div>
      </section>

      <section className="space-y-3 border-t border-border/40 pt-4">
        <SectionTitle title="Guias e dicas" description="Traga de volta o que você dispensou." />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleResetOnboarding}>
            <Sparkles className="size-3.5" />
            Reativar primeiros passos
          </Button>
          <Button type="button" variant="outline" onClick={handleResetDismissedAlerts}>
            <Rows3 className="size-3.5" />
            Restaurar dicas dispensadas
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void handleFullReset()}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <RotateCcw className="size-3.5" />
            Voltar ao padrão
          </Button>
        </div>
      </section>
    </div>
  );
}
