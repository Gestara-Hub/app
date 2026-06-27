import { Textarea } from '@chakra-ui/react'
import { FieldWrapper } from './FieldWrapper'
import { fieldError, useFormCtx } from './form-context'
import type { BoundFieldProps } from './types'

export interface TextareaFieldProps extends BoundFieldProps {
  placeholder?: string
  rows?: number
}

// Textarea field bound to the form via context, with the standard wrapper for label/error/helper
export function TextareaField({ name, placeholder, rows, ...base }: TextareaFieldProps) {
  const form = useFormCtx()
  return (
    <form.Field name={name}>
      {(field) => (
        <FieldWrapper {...base} error={fieldError(field)}>
          <Textarea
            value={String(field.state.value ?? '')}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            placeholder={placeholder}
            rows={rows}
          />
        </FieldWrapper>
      )}
    </form.Field>
  )
}
