import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Box, Button, Flex, Heading, Input, Stack, Text } from '@chakra-ui/react'
import type { FormEvent } from 'react'
import { authService } from '@/services/authService'

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  const router = useRouter()

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    authService.login()
    router.navigate({ to: '/' })
  }

  return (
    <Flex minH="100dvh" align="center" justify="center" bg="bg.canvas" p="4">
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '360px' }}>
        <Box
          bg="bg.surface"
          p="8"
          rounded="lg"
          borderWidth="1px"
          borderColor="border.default"
          boxShadow="md"
        >
          <Heading size="xl" color="brand.fg">
            GestaraHub
          </Heading>
          <Text mt="1" mb="6" color="fg.muted" fontSize="sm">
            Corte Nobre — acesso (mock)
          </Text>
          <Stack gap="4">
            <Input
              type="email"
              placeholder="E-mail"
              defaultValue="marcelo@cortenobre.com"
            />
            <Input type="password" placeholder="Senha" defaultValue="123456" />
            <Button type="submit" colorPalette="brand">
              Entrar
            </Button>
          </Stack>
          <Text mt="4" fontSize="xs" color="fg.muted">
            Login mockado: qualquer credencial entra.
          </Text>
        </Box>
      </form>
    </Flex>
  )
}
