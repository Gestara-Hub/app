import { createFileRoute } from '@tanstack/react-router'
import { Box, Heading, Text } from '@chakra-ui/react'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <Box p="8">
      <Heading size="2xl" color="brand.fg">
        GestaraHub
      </Heading>
      <Text mt="4" color="fg.muted">
        Esqueleto do app — cenario Corte Nobre. Chakra UI v3 ativo.
      </Text>
    </Box>
  )
}
