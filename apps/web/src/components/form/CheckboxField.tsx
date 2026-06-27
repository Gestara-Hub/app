import { Checkbox } from '@chakra-ui/react'
import { FieldWrapper } from './FieldWrapper'
import { fieldError, useFormCtx } from './form-context'
import type { BoundFieldProps } from './types'

// CheckboxField props: extends BoundFieldProps; boolean control bound to the form.
// The label is inline within the checkbox itself (Checkbox.Label), so we do not use
// the FieldWrapper label; the wrapper still handles error/helperText/state.
export interface CheckboxFieldProps extends BoundFieldProps {}

export function CheckboxField({ name, label, ...base }: CheckboxFieldProps) {
  const form = useFormCtx()
  return (
    <form.Field name={name}>
      {(field) => (
        // We do not forward the label to FieldWrapper: it is shown inline in the checkbox.
        <FieldWrapper {...base} error={fieldError(field)}>
          <Checkbox.Root
            checked={Boolean(field.state.value)}
            // details.checked may be boolean or 'indeterminate'; we normalize to boolean.
            onCheckedChange={(details) => field.handleChange(details.checked === true)}
            onBlur={field.handleBlur}
            disabled={base.disabled}
            readOnly={base.readOnly}
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            {label ? <Checkbox.Label>{label}</Checkbox.Label> : null}
          </Checkbox.Root>
        </FieldWrapper>
      )}
    </form.Field>
  )
}
