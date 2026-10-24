"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type DefaultValues, type FieldValues, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";

/** Resposta padrao das server actions do painel. */
export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

export type ServerAction<State extends ActionState> = (prev: State, formData: FormData) => Promise<State>;

/** Valores do formulario como a server action espera: texto, lista (varias entradas de mesmo nome) e checkbox ("1"). */
export function toFormData(values: Record<string, unknown>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) for (const item of value) data.append(key, String(item));
    else if (typeof value === "boolean") {
      if (value) data.set(key, "1");
    } else data.set(key, String(value));
  }
  return data;
}

interface Options<S extends z.ZodType<FieldValues, FieldValues>, State extends ActionState> {
  schema: S;
  defaultValues: DefaultValues<z.input<S>>;
  action: ServerAction<State>;
  /** Limpa o formulario depois de um envio com sucesso (notas, respostas, novos cadastros). */
  resetOnSuccess?: boolean;
}

export interface ActionForm<S extends z.ZodType<FieldValues, FieldValues>, State extends ActionState> {
  form: UseFormReturn<z.input<S>, unknown, z.output<S>>;
  state: State;
  pending: boolean;
  /** `onSubmit` do <form>: valida no navegador (Zod) e so entao chama a server action, que valida de novo. */
  submit: (action?: ServerAction<State>) => (event?: React.BaseSyntheticEvent) => Promise<void>;
}

/**
 * Formulario do painel: React Hook Form + Zod (o mesmo padrao do app dos
 * clientes) em cima das server actions. O navegador mostra o erro por campo na
 * hora; a action continua sendo a autoridade (valida de novo e e quem grava).
 */
export function useActionForm<S extends z.ZodType<FieldValues, FieldValues>, State extends ActionState = ActionState>({
  schema,
  defaultValues,
  action,
  resetOnSuccess,
}: Options<S, State>): ActionForm<S, State> {
  const form = useForm<z.input<S>, unknown, z.output<S>>({ resolver: zodResolver(schema), defaultValues, mode: "onSubmit" });
  const [state, setState] = useState<State>({} as State);
  const [pending, startTransition] = useTransition();

  const submit = (override?: ServerAction<State>) =>
    form.handleSubmit(
      () =>
        new Promise<void>((resolve, reject) => {
          startTransition(async () => {
            try {
              const result = await (override ?? action)(state, toFormData(form.getValues() as Record<string, unknown>));
              setState(result);
              if (result.ok && resetOnSuccess) form.reset();
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        }),
    );

  return { form, state, pending, submit };
}
