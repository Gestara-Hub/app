import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { Button, Dialog, Portal, Stack } from '@chakra-ui/react'
import {
  CurrencyField,
  FormProvider,
  NumberField,
  SelectField,
  SwitchField,
  TextField,
  TextareaField,
} from '@/components/form'
import {
  CATEGORY_LABELS,
  SERVICE_CATEGORIES,
  serviceFormSchema,
  serviceFormToInput,
  serviceToFormValues,
} from '@/types/service'
import type { Service, ServiceInput } from '@/types/service'

interface Props {
  open: boolean
  service?: Service | null // null/undefined = create
  saving?: boolean
  onSave: (input: ServiceInput) => void
  onClose: () => void
}

const categoryOptions = SERVICE_CATEGORIES.map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c],
}))

export function ServiceFormDialog({
  open,
  service,
  saving,
  onSave,
  onClose,
}: Props) {
  const form = useForm({
    defaultValues: serviceToFormValues(service),
    validators: { onChange: serviceFormSchema },
    onSubmit: ({ value }) => onSave(serviceFormToInput(value)),
  })

  // Reset the form on open (data of the service being edited, or empty).
  useEffect(() => {
    if (open) form.reset(serviceToFormValues(service))
  }, [open, service, form])

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => {
        if (!e.open) onClose()
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                e.stopPropagation()
                form.handleSubmit()
              }}
            >
              <Dialog.Header>
                <Dialog.Title>
                  {service ? 'Editar servico' : 'Novo servico'}
                </Dialog.Title>
              </Dialog.Header>

              <Dialog.Body>
                <FormProvider form={form}>
                  <Stack gap="4">
                    <TextField
                      name="name"
                      label="Nome"
                      required
                      placeholder="Ex.: Corte Masculino"
                    />
                    <SelectField
                      name="category"
                      label="Categoria"
                      required
                      options={categoryOptions}
                    />
                    <NumberField
                      name="durationMinutes"
                      label="Duracao (minutos)"
                      required
                      min={1}
                      placeholder="30"
                    />
                    <CurrencyField name="price" label="Preco" required />
                    <TextareaField
                      name="description"
                      label="Descricao"
                      rows={2}
                      placeholder="Opcional"
                    />
                    <SwitchField name="active" label="Servico ativo" />
                  </Stack>
                </FormProvider>
              </Dialog.Body>

              <Dialog.Footer>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button type="submit" colorPalette="brand" loading={saving}>
                  Salvar
                </Button>
              </Dialog.Footer>
            </form>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
