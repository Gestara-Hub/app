import { NumberInput } from '@chakra-ui/react'
import { FieldWrapper } from './FieldWrapper'
import { fieldError, useFormCtx } from './form-context'
import type { BoundFieldProps } from './types'

export interface NumberFieldProps extends BoundFieldProps {
  min?: number
  max?: number
  step?: number
  placeholder?: string
}

export function NumberField({ name, min, max, step, placeholder, ...base }: NumberFieldProps) {
  const form = useFormCtx()
  return (
    <form.Field name={name}>
      {(field) => (
        <FieldWrapper {...base} error={fieldError(field)}>
          {/* Root receives value/onValueChange and the min/max/step bounds when provided */}
          <NumberInput.Root
            value={String(field.state.value ?? '')}
            onValueChange={(details) => field.handleChange(details.value)}
            min={min}
            max={max}
            step={step}
            disabled={base.disabled}
            readOnly={base.readOnly}
          >
            <NumberInput.Control>
              <NumberInput.IncrementTrigger />
              <NumberInput.DecrementTrigger />
            </NumberInput.Control>
            <NumberInput.Input placeholder={placeholder} onBlur={field.handleBlur} />
          </NumberInput.Root>
        </FieldWrapper>
      )}
    </form.Field>
  )
}
