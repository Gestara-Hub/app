import { TagsInput } from '@chakra-ui/react'
import { FieldWrapper } from './FieldWrapper'
import { fieldError, useFormCtx } from './form-context'
import type { BoundFieldProps } from './types'

export interface TagsFieldProps extends BoundFieldProps {
  placeholder?: string
}

export function TagsField({ name, placeholder, ...base }: TagsFieldProps) {
  const form = useFormCtx()
  return (
    <form.Field name={name}>
      {(field) => (
        <FieldWrapper {...base} error={fieldError(field)}>
          {/* The tags state comes from the field; onValueChange returns { value } */}
          <TagsInput.Root
            value={(field.state.value as string[]) ?? []}
            onValueChange={(details) => field.handleChange(details.value)}
            disabled={base.disabled}
            readOnly={base.readOnly}
          >
            <TagsInput.Control>
              {/* Render an item for each existing tag */}
              <TagsInput.Context>
                {(api) =>
                  api.value.map((item, index) => (
                    <TagsInput.Item key={`${item}-${index}`} index={index} value={item}>
                      <TagsInput.ItemPreview>
                        <TagsInput.ItemText>{item}</TagsInput.ItemText>
                        <TagsInput.ItemDeleteTrigger />
                      </TagsInput.ItemPreview>
                      <TagsInput.ItemInput />
                    </TagsInput.Item>
                  ))
                }
              </TagsInput.Context>
              <TagsInput.Input placeholder={placeholder} />
            </TagsInput.Control>
            {/* Hidden input for native form submission */}
            <TagsInput.HiddenInput />
          </TagsInput.Root>
        </FieldWrapper>
      )}
    </form.Field>
  )
}
