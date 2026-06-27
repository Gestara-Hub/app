import { Button, FileUpload } from '@chakra-ui/react'
import type { FileUploadFileChangeDetails } from '@chakra-ui/react'
import { FieldWrapper } from './FieldWrapper'
import { fieldError, useFormCtx } from './form-context'
import type { BoundFieldProps } from './types'

export interface FileFieldProps extends BoundFieldProps {
  // Accepted types in the HTML input format (e.g. 'image/*' or '.pdf')
  accept?: string
  // Maximum number of allowed files
  maxFiles?: number
}

export function FileField({ name, accept, maxFiles, ...base }: FileFieldProps) {
  const form = useFormCtx()
  return (
    <form.Field name={name}>
      {(field) => {
        // Coerce the field value (unknown) to the files list
        const files = (field.state.value as File[]) ?? []
        // Chakra/Ark exposes the accepted files in details.acceptedFiles
        const handleFileChange = (details: FileUploadFileChangeDetails) => {
          field.handleChange(details.acceptedFiles)
        }
        return (
          <FieldWrapper {...base} error={fieldError(field)}>
            <FileUpload.Root
              acceptedFiles={files}
              onFileChange={handleFileChange}
              accept={accept}
              maxFiles={maxFiles}
            >
              <FileUpload.HiddenInput />
              <FileUpload.Trigger asChild>
                <Button variant="outline">Selecionar arquivo</Button>
              </FileUpload.Trigger>
              <FileUpload.List />
            </FileUpload.Root>
          </FieldWrapper>
        )
      }}
    </form.Field>
  )
}
