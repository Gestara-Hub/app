import { RadioGroup } from '@chakra-ui/react'
import { FieldWrapper } from './FieldWrapper'
import { fieldError, useFormCtx } from './form-context'
import type { BoundFieldProps, Option } from './types'

export interface RadioFieldProps extends BoundFieldProps {
  options: Option[]
  orientation?: 'horizontal' | 'vertical'
}

export function RadioField({
  name,
  options,
  orientation = 'vertical',
  ...base
}: RadioFieldProps) {
  const form = useFormCtx()
  return (
    <form.Field name={name}>
      {(field) => (
        <FieldWrapper {...base} error={fieldError(field)}>
          <RadioGroup.Root
            value={String(field.state.value ?? '')}
            // onValueChange provides the details; we forward only the value (string)
            onValueChange={(details) => field.handleChange(details.value)}
            orientation={orientation}
            disabled={base.disabled}
            readOnly={base.readOnly}
          >
            {options.map((option) => (
              <RadioGroup.Item key={option.value} value={option.value}>
                <RadioGroup.ItemHiddenInput />
                <RadioGroup.ItemIndicator />
                <RadioGroup.ItemText>{option.label}</RadioGroup.ItemText>
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
        </FieldWrapper>
      )}
    </form.Field>
  )
}
