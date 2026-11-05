"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { FormProvider, useWatch } from "react-hook-form";
import { CheckboxGroupField, FormFeedback, InputText, SelectField, TextArea, useActionForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { announcementSchema } from "@/lib/form-schemas";
import { previewAudienceAction, saveAnnouncementAction, type AnnouncementFormState } from "./actions";

export const AREA_LABEL: Record<string, string> = {
  martial_arts: "Lutas",
  pilates_yoga: "Pilates e yoga",
  functional_training: "Funcional e crossfit",
  dance: "Dança",
  music: "Música",
  languages: "Idiomas e reforço",
  swimming_sports: "Natação e esportes",
  gastronomy: "Gastronomia",
  arts_crafts: "Artes e artesanato",
  beauty_courses: "Beleza e cursos livres",
  custom: "Outra área",
};
const TIER_OPTIONS = [
  ["free", "Grátis"],
  ["pro", "Profissional"],
  ["scale", "Expansão"],
] as const;

export interface FormValues {
  id?: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "urgent";
  audience: "all" | "tier" | "area" | "spaces";
  tiers: string[];
  areas: string[];
  spaces: string;
  startsAt: string;
  endsAt: string;
}

/** Formulario de comunicado: mensagem, gravidade, quem recebe (com previa da quantidade) e quando vale. */
export function AnnouncementForm({ values }: { values: FormValues }) {
  const [preview, setPreview] = useState<AnnouncementFormState>({});
  const { form, state, pending, submit } = useActionForm<typeof announcementSchema, AnnouncementFormState>({
    schema: announcementSchema,
    defaultValues: values,
    action: saveAnnouncementAction,
  });
  const audience = useWatch({ control: form.control, name: "audience" });
  const showPreview = (_prev: AnnouncementFormState, formData: FormData) =>
    previewAudienceAction(_prev, formData).then((result) => {
      setPreview(result);
      return {} as AnnouncementFormState;
    });
  return (
    <FormProvider {...form}>
      <form onSubmit={submit()} className="max-w-2xl space-y-4" noValidate>
        <Section title="Mensagem" description="O que as pessoas vão ler no topo do app.">
          <InputText name="title" label="Título" required maxLength={120} />
          <TextArea name="body" label="Mensagem" required rows={4} maxLength={1000} />
          <SelectField
            name="severity"
            label="Importância"
            options={[
              ["info", "Aviso (pode dispensar)"],
              ["warning", "Atenção (pode dispensar)"],
              ["urgent", "Urgente (fica até acabar)"],
            ]}
          />
        </Section>

        <Section title="Quem recebe" description="Confira a quantidade antes de publicar.">
          <SelectField
            name="audience"
            label="Público"
            options={[
              ["all", "Todos os espaços"],
              ["tier", "Por plano"],
              ["area", "Por área"],
              ["spaces", "Espaços escolhidos"],
            ]}
            onValueChange={() => setPreview({})}
          />
          {audience === "tier" ? <CheckboxGroupField name="tiers" legend="Planos" options={TIER_OPTIONS} /> : null}
          {audience === "area" ? <CheckboxGroupField name="areas" legend="Áreas" options={Object.entries(AREA_LABEL)} columns /> : null}
          {audience === "spaces" ? <TextArea name="spaces" label="Códigos dos espaços (um por linha)" required rows={3} inputClassName="font-mono text-xs" /> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" disabled={pending} onClick={submit(showPreview)}>
              Ver quantos recebem
            </Button>
            {preview.preview ? (
              <p role="status" className="min-w-0 break-words text-sm text-muted-foreground">
                {preview.preview}
              </p>
            ) : null}
          </div>
          {preview.error ? (
            <p role="alert" className="text-sm text-destructive">
              {preview.error}
            </p>
          ) : null}
        </Section>

        <Section title="Quando vale" description="Horário de Brasília.">
          <div className="grid gap-4 sm:grid-cols-2">
            <InputText name="startsAt" label="Começa em" type="datetime-local" hint="Vazio: começa agora." />
            <InputText name="endsAt" label="Termina em" type="datetime-local" hint="Vazio: fica até você arquivar." />
          </div>
        </Section>

        <FormFeedback state={state} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="outline">
            <Link href="/announcements">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : values.id ? "Salvar" : "Publicar"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
