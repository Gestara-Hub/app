// Option: selectable item used by list-based fields (Select, Combobox, Radio...).
export interface Option {
  label: string
  value: string
}

// Visual WRAPPER props (FieldWrapper): label/error/helper/state.
export interface BaseFieldProps {
  label?: string
  helperText?: string
  error?: string
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
  invalid?: boolean // if omitted, derives from `error`
}

// Base props for fields BOUND to the form (via context + name).
// value/onChange/onBlur/error are resolved internally (no wiring at the call site).
export interface BoundFieldProps {
  name: string
  label?: string
  helperText?: string
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
}
