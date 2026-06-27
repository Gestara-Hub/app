import { Combobox, useFilter, useListCollection } from '@chakra-ui/react'
import { FieldWrapper } from './FieldWrapper'
import { fieldError, useFormCtx } from './form-context'
import type { BoundFieldProps, Option } from './types'

export interface ComboboxFieldProps extends BoundFieldProps {
  options: Option[]
  placeholder?: string
}

export function ComboboxField({
  name,
  options,
  placeholder,
  ...base
}: ComboboxFieldProps) {
  const form = useFormCtx()

  // Locale-aware filter function (case-insensitive)
  const { contains } = useFilter({ sensitivity: 'base' })

  // Filterable collection: starts with all options and filters by the typed text
  const { collection, filter } = useListCollection<Option>({
    initialItems: options,
    filter: contains,
  })

  return (
    <form.Field name={name}>
      {(field) => {
        // Single selection exposed as a string: the Chakra control works with string[]
        const current = String(field.state.value ?? '')
        const selectedValues = current ? [current] : []

        return (
          <FieldWrapper {...base} error={fieldError(field)}>
            <Combobox.Root
              collection={collection}
              value={selectedValues}
              onValueChange={(details) =>
                field.handleChange(details.value[0] ?? '')
              }
              onInputValueChange={(details) => filter(details.inputValue)}
              disabled={base.disabled}
              readOnly={base.readOnly}
            >
              <Combobox.Control>
                <Combobox.Input placeholder={placeholder} />
                <Combobox.IndicatorGroup>
                  <Combobox.ClearTrigger />
                  <Combobox.Trigger />
                </Combobox.IndicatorGroup>
              </Combobox.Control>
              <Combobox.Positioner>
                <Combobox.Content>
                  <Combobox.Empty>Nenhuma opcao encontrada</Combobox.Empty>
                  {collection.items.map((item) => (
                    <Combobox.Item key={item.value} item={item}>
                      <Combobox.ItemText>{item.label}</Combobox.ItemText>
                      <Combobox.ItemIndicator />
                    </Combobox.Item>
                  ))}
                </Combobox.Content>
              </Combobox.Positioner>
            </Combobox.Root>
          </FieldWrapper>
        )
      }}
    </form.Field>
  )
}
