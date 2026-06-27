import { Switch } from '@chakra-ui/react'
import { FieldWrapper } from './FieldWrapper'
import { fieldError, useFormCtx } from './form-context'
import type { BoundFieldProps } from './types'

export type SwitchFieldProps = BoundFieldProps

export function SwitchField({ name, label, ...base }: SwitchFieldProps) {
  const form = useFormCtx()
  return (
    <form.Field name={name}>
      {(field) => (
        // The label is inline within the control itself; FieldWrapper handles error/helperText.
        // That is why we do not pass the label to FieldWrapper.
        <FieldWrapper {...base} error={fieldError(field)}>
          <Switch.Root
            checked={Boolean(field.state.value)}
            onCheckedChange={(details) => field.handleChange(details.checked === true)}
            onBlur={field.handleBlur}
          >
            <Switch.HiddenInput />
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            {label ? <Switch.Label>{label}</Switch.Label> : null}
          </Switch.Root>
        </FieldWrapper>
      )}
    </form.Field>
  )
}
