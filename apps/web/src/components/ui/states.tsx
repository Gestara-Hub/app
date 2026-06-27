import { Box, Button, Center, Spinner, Stack, Text } from '@chakra-ui/react'
import type { ReactNode } from 'react'

// Cross-cutting list/content states (see docs/product/10-estados-e-mensagens.md).

export function LoadingState({ label = 'Carregando...' }: { label?: string }) {
  return (
    <Center py="12">
      <Stack align="center" gap="3">
        <Spinner color="brand.solid" />
        <Text color="fg.muted" fontSize="sm">
          {label}
        </Text>
      </Stack>
    </Center>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <Center py="12">
      <Stack align="center" gap="2" textAlign="center" maxW="sm">
        <Text fontWeight="semibold" color="fg.default">
          {title}
        </Text>
        {description ? (
          <Text color="fg.muted" fontSize="sm">
            {description}
          </Text>
        ) : null}
        {action ? <Box pt="2">{action}</Box> : null}
      </Stack>
    </Center>
  )
}

export function ErrorState({
  description = 'Nao foi possivel carregar.',
  onRetry,
}: {
  description?: string
  onRetry?: () => void
}) {
  return (
    <Center py="12">
      <Stack align="center" gap="3" textAlign="center">
        <Text color="fg.muted" fontSize="sm">
          {description}
        </Text>
        {onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Tentar novamente
          </Button>
        ) : null}
      </Stack>
    </Center>
  )
}
