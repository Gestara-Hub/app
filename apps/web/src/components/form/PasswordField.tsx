import { IconButton, Input, InputGroup } from '@chakra-ui/react'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { FieldWrapper } from './FieldWrapper'
import { fieldError, useFormCtx } from './form-context'
import type { BoundFieldProps } from './types'

export interface PasswordFieldProps extends BoundFieldProps {
  placeholder?: string
}

// Password field bound to the form via context. Composes Input + InputGroup with
// a show/hide button, since Chakra v3 password-input is not native (it's a snippet).
export function PasswordField({ name, placeholder, ...base }: PasswordFieldProps) {
  const form = useFormCtx()
  // Local state only to toggle text visibility
  const [visible, setVisible] = useState(false)

  return (
    <form.Field name={name}>
      {(field) => (
        <FieldWrapper {...base} error={fieldError(field)}>
          <InputGroup
            endElement={
              <IconButton
                aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
                variant="ghost"
                size="sm"
                // Prevents losing input focus when clicking the button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setVisible((v) => !v)}
                disabled={base.disabled}
              >
                {visible ? <EyeOff /> : <Eye />}
              </IconButton>
            }
          >
            <Input
              type={visible ? 'text' : 'password'}
              value={String(field.state.value ?? '')}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder={placeholder}
            />
          </InputGroup>
        </FieldWrapper>
      )}
    </form.Field>
  )
}
