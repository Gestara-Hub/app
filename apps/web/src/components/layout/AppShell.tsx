import { Box, Flex } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <Flex minH="100dvh" bg="bg.canvas">
      <Sidebar />
      <Flex direction="column" flex="1" minW="0">
        <Topbar />
        <Box as="main" flex="1" p={{ base: '4', lg: '6' }}>
          {children}
        </Box>
      </Flex>
    </Flex>
  )
}
