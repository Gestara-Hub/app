import { NumberInput } from '@chakra-ui/react'
import { FieldWrapper } from './FieldWrapper'
import { fieldError, useFormCtx } from './form-context'
import type { BoundFieldProps } from './types'

// Currency field (R$) bound to the form using Chakra v3 NumberInput.
// The value is kept as a numeric string (e.g. "1234.56").
export interface CurrencyFieldProps extends BoundFieldProps {
  // Minimum allowed value. Defaults to 0 to reject negative values.
  min?: number
}

export function CurrencyField({ name, min = 0, ...base }: CurrencyFieldProps) {
  const form = useFormCtx()
  return (
    <form.Field name={name}>
      {(field) => (
        <FieldWrapper {...base} error={fieldError(field)}>
          <NumberInput.Root
            value={String(field.state.value ?? '')}
            min={min}
            onValueChange={(details) => field.handleChange(details.value)}
            formatOptions={{ style: 'currency', currency: 'BRL' }}
            width="full"
          >
            <NumberInput.Control />
            <NumberInput.Input onBlur={field.handleBlur} />
          </NumberInput.Root>
        </FieldWrapper>
      )}
    </form.Field>
  )
}
