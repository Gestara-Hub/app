import { Input } from '@chakra-ui/react'
import { FieldWrapper } from './FieldWrapper'
import { fieldError, useFormCtx } from './form-context'
import type { BoundFieldProps } from './types'

export interface TextFieldProps extends BoundFieldProps {
  placeholder?: string
  type?: 'text' | 'email' | 'tel' | 'url'
}

// Text field bound to the form: <TextField name="name" label="Nome" required />
export function TextField({
  name,
  placeholder,
  type = 'text',
  ...base
}: TextFieldProps) {
  const form = useFormCtx()
  return (
    <form.Field name={name}>
      {(field) => (
        <FieldWrapper {...base} error={fieldError(field)}>
          <Input
            type={type}
            value={String(field.state.value ?? '')}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            placeholder={placeholder}
          />
        </FieldWrapper>
      )}
    </form.Field>
  )
}
