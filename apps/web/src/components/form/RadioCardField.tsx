import { RadioCard, SimpleGrid } from '@chakra-ui/react'
import { FieldWrapper } from './FieldWrapper'
import { fieldError, useFormCtx } from './form-context'
import type { BoundFieldProps } from './types'

// Option for a radio card: title (label), value and optional description.
export interface RadioCardOption {
  label: string
  value: string
  description?: string
}

export interface RadioCardFieldProps extends BoundFieldProps {
  options: RadioCardOption[]
  // Number of columns in the cards grid (default: 1).
  columns?: number
}

export function RadioCardField({ name, options, columns = 1, ...base }: RadioCardFieldProps) {
  const form = useFormCtx()
  return (
    <form.Field name={name}>
      {(field) => (
        <FieldWrapper {...base} error={fieldError(field)}>
          <RadioCard.Root
            value={String(field.state.value ?? '')}
            // details.value is the selected value (string).
            onValueChange={(details) => field.handleChange(details.value ?? '')}
            disabled={base.disabled}
            readOnly={base.readOnly}
          >
            <SimpleGrid columns={columns} gap={2}>
              {options.map((option) => (
                <RadioCard.Item key={option.value} value={option.value}>
                  <RadioCard.ItemHiddenInput />
                  <RadioCard.ItemControl>
                    <RadioCard.ItemContent>
                      <RadioCard.ItemText>{option.label}</RadioCard.ItemText>
                      {option.description ? (
                        <RadioCard.ItemDescription>{option.description}</RadioCard.ItemDescription>
                      ) : null}
                    </RadioCard.ItemContent>
                    <RadioCard.ItemIndicator />
                  </RadioCard.ItemControl>
                </RadioCard.Item>
              ))}
            </SimpleGrid>
          </RadioCard.Root>
        </FieldWrapper>
      )}
    </form.Field>
  )
}
