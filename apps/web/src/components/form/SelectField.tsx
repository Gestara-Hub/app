import { Select, createListCollection } from '@chakra-ui/react'
import { useMemo } from 'react'
import { FieldWrapper } from './FieldWrapper'
import { fieldError, useFormCtx } from './form-context'
import type { BoundFieldProps, Option } from './types'

export interface SelectFieldProps extends BoundFieldProps {
  options: Option[]
  placeholder?: string
}

export function SelectField({ name, options, placeholder = 'Selecione...', ...base }: SelectFieldProps) {
  const form = useFormCtx()
  // Chakra's Select.Root works with collections; memoize to avoid recreation
  const collection = useMemo(() => createListCollection({ items: options }), [options])

  return (
    <form.Field name={name}>
      {(field) => (
        <FieldWrapper {...base} error={fieldError(field)}>
          <Select.Root
            collection={collection}
            // Internal API works with arrays; we expose single selection as a string
            value={field.state.value ? [String(field.state.value)] : []}
            onValueChange={(details) => field.handleChange(details.value[0] ?? '')}
            onInteractOutside={field.handleBlur}
          >
            <Select.HiddenSelect />
            <Select.Control>
              <Select.Trigger>
                <Select.ValueText placeholder={placeholder} />
              </Select.Trigger>
              <Select.IndicatorGroup>
                <Select.Indicator />
              </Select.IndicatorGroup>
            </Select.Control>
            <Select.Positioner>
              <Select.Content>
                {collection.items.map((item) => (
                  <Select.Item key={item.value} item={item}>
                    <Select.ItemText>{item.label}</Select.ItemText>
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Select.Root>
        </FieldWrapper>
      )}
    </form.Field>
  )
}
