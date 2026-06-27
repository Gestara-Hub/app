import { Field } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import type { BaseFieldProps } from './types'

// Default wrapper using Chakra v3's native Field component.
// Centralizes label, required indicator, helper text and error.
// Every field in form/ uses this wrapper to keep consistency.
export function FieldWrapper({
  label,
  helperText,
  error,
  required,
  disabled,
  readOnly,
  invalid,
  children,
}: BaseFieldProps & { children: ReactNode }) {
  const isInvalid = invalid ?? Boolean(error)
  return (
    <Field.Root
      invalid={isInvalid}
      required={required}
      disabled={disabled}
      readOnly={readOnly}
    >
      {label ? (
        <Field.Label>
          {label}
          {required ? <Field.RequiredIndicator /> : null}
        </Field.Label>
      ) : null}
      {children}
      {helperText && !error ? (
        <Field.HelperText>{helperText}</Field.HelperText>
      ) : null}
      {error ? <Field.ErrorText>{error}</Field.ErrorText> : null}
    </Field.Root>
  )
}
