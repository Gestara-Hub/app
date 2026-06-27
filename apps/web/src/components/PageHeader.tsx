import { Flex, Heading, Stack, Text } from '@chakra-ui/react'
import type { ReactNode } from 'react'

// Page header: title + subtitle + contextual action (see docs/frontend/04).
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <Flex justify="space-between" align="flex-start" gap="4" mb="6">
      <Stack gap="1">
        <Heading size="2xl" color="fg.default">
          {title}
        </Heading>
        {description ? (
          <Text color="fg.muted" fontSize="sm">
            {description}
          </Text>
        ) : null}
      </Stack>
      {action}
    </Flex>
  )
}
