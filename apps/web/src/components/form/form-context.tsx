import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { AnyFormApi } from '@tanstack/react-form'

// Minimal view of a field's state, enough for the library fields.
// (field selection by string; the value is treated as unknown and coerced in each field.)
export interface FieldRenderApi {
  state: {
    value: unknown
    meta: { isTouched: boolean; errors: ReadonlyArray<unknown> }
  }
  handleChange: (value: unknown) => void
  handleBlur: () => void
}

type FieldComponent = (props: {
  name: string
  children: (field: FieldRenderApi) => ReactNode
}) => ReactNode

// React form (useForm) + permissive access to the Field component.
export type FormLike = AnyFormApi & { Field: FieldComponent }

// Context that carries the form instance (RHF FormProvider/useFormContext style),
// so that fields only receive `name` + visual props.
const FormCtx = createContext<FormLike | null>(null)

export function FormProvider({
  form,
  children,
}: {
  form: AnyFormApi
  children: ReactNode
}) {
  return (
    <FormCtx.Provider value={form as unknown as FormLike}>
      {children}
    </FormCtx.Provider>
  )
}

export function useFormCtx(): FormLike {
  const form = useContext(FormCtx)
  if (!form) {
    throw new Error('Campo de formulario usado fora de <FormProvider>.')
  }
  return form
}

// Field error message, after it has been touched. Standard Schema (Zod) returns issues
// with .message; also accepts a string for safety.
export function fieldError(field: FieldRenderApi): string | undefined {
  if (!field.state.meta.isTouched) return undefined
  for (const e of field.state.meta.errors) {
    if (!e) continue
    if (typeof e === 'string') return e
    const msg = (e as { message?: string }).message
    if (msg) return msg
  }
  return undefined
}
