"use client";

import { useState } from "react";
import { Building2, History, Sparkles } from "lucide-react";
import type {
  ModalityProgressionTrack,
  ProgressionLevelStep,
  ProgressionTrackStyle,
  StudentModalityProgression,
  StudentProgressionOrigin,
} from "@gestarahub/contracts";
import { todayISO } from "@gestarahub/core/date";
import { Button } from "@/components/ui/button";
import { DialogBody } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SegmentVocabulary } from "@/lib/business-segment-presets";
import { ageAt, isLevelAllowedForAge, levelAgeLabel, trackUsesAges } from "@/lib/progression-tracks";
import { cn } from "@/lib/utils";
import { DegreePicker, LevelSelect } from "./graduate-panel";

export interface StartingPointResult {
  origin: StudentProgressionOrigin;
  originAcademy?: string;
  originTeacher?: string;
  level: ProgressionLevelStep;
  subLevel: number;
  promotedAt: string;
  initialAttendanceOffset: number;
}

const ORIGINS: {
  value: StudentProgressionOrigin;
  title: string;
  desc: string;
  icon: typeof Sparkles;
}[] = [
  { value: "started_here", title: "Começou aqui", desc: "Do início, sem histórico", icon: Sparkles },
  { value: "transfer", title: "Veio de outra academia", desc: "Já chega com nível", icon: Building2 },
  { value: "before_system", title: "Treinava aqui antes do sistema", desc: "Só registrar o ponto atual", icon: History },
];

/**
 * "Ponto de partida" (antes "Historico inicial"): como o aluno chegou e de
 * onde ele comeca na trilha. Usado uma vez por aluno.
 */
export function StartingPointPanel({
  track,
  trackStyle,
  vocabulary,
  birthDate,
  progression,
  isPending,
  onCancel,
  onSave,
}: {
  track: ModalityProgressionTrack;
  trackStyle: ProgressionTrackStyle;
  vocabulary: SegmentVocabulary;
  birthDate?: string;
  progression?: StudentModalityProgression;
  isPending: boolean;
  onCancel: () => void;
  onSave: (result: StartingPointResult) => void;
}) {
  const isBelt = trackStyle === "belt";
  const levelLabel = isBelt ? "Faixa" : vocabulary.level === "Faixa" ? "Nível" : vocabulary.level;
  const levelLower = levelLabel.toLowerCase();
  const usesAges = trackUsesAges(track);

  const savedLevel =
    track.levels.find((l) => l.id === progression?.levelId || l.name === progression?.levelName) ??
    track.levels[0];
  const [origin, setOrigin] = useState<StudentProgressionOrigin>(
    progression?.origin ??
      (progression && (savedLevel?.id !== track.levels[0]?.id || progression.subLevel > 0)
        ? "before_system"
        : "started_here"),
  );
  const [academy, setAcademy] = useState(progression?.originAcademy ?? "");
  const [teacher, setTeacher] = useState(progression?.originTeacher ?? "");
  const [levelId, setLevelId] = useState(savedLevel?.id ?? "");
  const [sub, setSub] = useState(progression?.subLevel ?? 0);
  const [since, setSince] = useState(progression?.promotedAt ?? todayISO());
  const [offset, setOffset] = useState(progression?.initialAttendanceOffset ?? 0);
  const [showAll, setShowAll] = useState(false);

  const age = ageAt(birthDate, since || todayISO());
  const options =
    showAll || !usesAges ? track.levels : track.levels.filter((l) => isLevelAllowedForAge(l, age) || l.id === levelId);
  const level = track.levels.find((l) => l.id === levelId) ?? track.levels[0];
  const outOfAge = usesAges && level && !isLevelAllowedForAge(level, age);
  const target = track.targetAttendances ?? 30;

  // "Comecou aqui": primeiro nivel da idade, sem graus, sem aulas anteriores.
  const firstForAge = track.levels.find((l) => !usesAges || isLevelAllowedForAge(l, ageAt(birthDate, todayISO()))) ?? track.levels[0];

  function save() {
    if (origin === "started_here") {
      if (!firstForAge) return;
      onSave({
        origin,
        level: firstForAge,
        subLevel: 0,
        promotedAt: progression?.promotedAt ?? todayISO(),
        initialAttendanceOffset: 0,
      });
      return;
    }
    if (!level) return;
    onSave({
      origin,
      originAcademy: origin === "transfer" ? academy.trim() || undefined : undefined,
      originTeacher: origin === "transfer" ? teacher.trim() || undefined : undefined,
      level,
      subLevel: level.maxSubLevels > 0 ? Math.min(sub, level.maxSubLevels) : 0,
      promotedAt: since || todayISO(),
      initialAttendanceOffset: Math.max(0, Math.round(offset) || 0),
    });
  }

  // Corpo e rodape do modal (padrao: corpo rola, rodape fixo); o titulo vem do modal.
  return (
    <>
      <DialogBody className="space-y-4">
      <p className="text-sm text-muted-foreground">Como o aluno chegou e de onde ele começa na trilha.</p>

      <div className="grid gap-2 sm:grid-cols-3">
        {ORIGINS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setOrigin(o.value)}
            aria-pressed={origin === o.value}
            className={cn(
              "flex items-start gap-2 rounded-xl border p-3 text-left transition-colors",
              origin === o.value
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border bg-background hover:bg-accent/50",
            )}
          >
            <o.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="block text-sm font-medium">{o.title}</span>
              <span className="block text-[11px] text-muted-foreground">{o.desc}</span>
            </span>
          </button>
        ))}
      </div>

      {origin === "started_here" ? (
        <p className="rounded-xl border border-border/60 bg-background p-3 text-sm text-muted-foreground">
          O aluno começa em <strong className="text-foreground">{firstForAge?.name}</strong>
          {firstForAge && firstForAge.maxSubLevels > 0 ? ", sem graus" : ""}, e as aulas contam a
          partir de agora. Nada para preencher.
        </p>
      ) : (
        <div className="space-y-3">
          {origin === "transfer" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="origin-academy" className="text-sm font-medium text-foreground">
                  Academia de origem
                </label>
                <Input
                  id="origin-academy"
                  value={academy}
                  onChange={(e) => setAcademy(e.target.value)}
                  placeholder="Informe a academia (opcional)"
                  className="text-base md:text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="origin-teacher" className="text-sm font-medium text-foreground">
                  Professor que {isBelt ? "graduou" : "avaliou"}
                </label>
                <Input
                  id="origin-teacher"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                  placeholder="Informe o professor (opcional)"
                  className="text-base md:text-sm"
                />
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="start-level" className="text-sm font-medium text-foreground">
                {levelLabel} atual
              </label>
              <LevelSelect
                id="start-level"
                levels={options}
                value={levelId}
                onChange={(v) => {
                  setLevelId(v);
                  setSub(0);
                }}
                trackStyle={trackStyle}
                age={age}
                usesAges={usesAges}
                placeholder={vocabulary.selectLevel}
              />
              {usesAges ? (
                age === null ? (
                  <p className="text-[11px] text-muted-foreground">
                    Cadastre a data de nascimento para filtrar pela idade.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    {showAll ? `Mostrar só para ${age} anos` : `Mostrar todas as ${vocabulary.levelPlural.toLowerCase()}`}
                  </button>
                )
              ) : null}
              {outOfAge ? (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Fora da faixa etária ({levelAgeLabel(level)}). O aluno tinha {age} anos nessa data.
                </p>
              ) : null}
            </div>
            {level && level.maxSubLevels > 0 ? (
              <div className="space-y-1.5">
                <span className="text-sm font-medium text-foreground">Grau atual</span>
                <DegreePicker max={level.maxSubLevels} value={sub} onChange={setSub} />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <label htmlFor="start-since" className="text-sm font-medium text-foreground">
                {isBelt ? "Graduado nesta faixa em" : `Nest${levelLower === "fase" ? "a" : "e"} ${levelLower} desde`}
              </label>
              <Input
                id="start-since"
                type="date"
                value={since}
                max={todayISO()}
                onChange={(e) => setSince(e.target.value)}
                className="text-base md:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="start-offset" className="text-sm font-medium text-foreground">
                Aulas já feitas {vocabulary.inLevel}
              </label>
              <Input
                id="start-offset"
                type="number"
                inputMode="numeric"
                min={0}
                value={offset}
                onChange={(e) => setOffset(Number(e.target.value) || 0)}
                className="text-base md:text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Contam para a meta de {target} aulas. Deixe 0 se não souber.
              </p>
            </div>
          </div>
        </div>
      )}

      </DialogBody>
      <div className="flex shrink-0 justify-end gap-2 border-t border-border/40 px-6 py-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="button" disabled={isPending} onClick={save}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </>
  );
}
