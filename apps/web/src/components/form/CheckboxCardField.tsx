import { CheckboxCard } from '@chakra-ui/react'
import { FieldWrapper } from './FieldWrapper'
import { fieldError, useFormCtx } from './form-context'
import type { BoundFieldProps } from './types'

export interface CheckboxCardFieldProps extends BoundFieldProps {
  // Title shown inside the card (control label)
  title?: string
  // Helper description shown below the title
  description?: string
}

export function CheckboxCardField({
  name,
  title,
  description,
  ...base
}: CheckboxCardFieldProps) {
  const form = useFormCtx()
  return (
    <form.Field name={name}>
      {(field) => (
        // The card has its own inline label; we use the wrapper only for error/helperText
        <FieldWrapper {...base} error={fieldError(field)}>
          <CheckboxCard.Root
            checked={Boolean(field.state.value)}
            // CheckedChangeDetails.checked may be boolean or 'indeterminate'
            onCheckedChange={(details) => field.handleChange(details.checked === true)}
            disabled={base.disabled}
            readOnly={base.readOnly}
          >
            <CheckboxCard.HiddenInput />
            <CheckboxCard.Control>
              <CheckboxCard.Content>
                {title ? <CheckboxCard.Label>{title}</CheckboxCard.Label> : null}
                {description ? (
                  <CheckboxCard.Description>{description}</CheckboxCard.Description>
                ) : null}
              </CheckboxCard.Content>
              <CheckboxCard.Indicator />
            </CheckboxCard.Control>
          </CheckboxCard.Root>
        </FieldWrapper>
      )}
    </form.Field>
  )
}
