import { createFileRoute } from '@tanstack/react-router'
import { ServicesPage } from '@/features/services/components/ServicesPage'

export const Route = createFileRoute('/_app/services')({
  component: ServicesPage,
})
