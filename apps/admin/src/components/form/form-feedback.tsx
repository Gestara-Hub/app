import type { ActionState } from "./use-action-form";

/** Erro (vermelho) ou confirmacao (verde) que a server action devolveu, abaixo dos campos. */
export function FormFeedback({ state, okText }: { state: ActionState; okText?: string }) {
  return (
    <>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok && (okText ?? state.message) ? (
        <p role="status" className="text-sm text-success">
          {okText ?? state.message}
        </p>
      ) : null}
    </>
  );
}
