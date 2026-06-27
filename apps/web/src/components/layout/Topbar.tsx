import { Button, Flex, HStack, Text } from '@chakra-ui/react'
import { useRouter } from '@tanstack/react-router'
import { LogOut, Plus } from 'lucide-react'
import { authService } from '@/services/authService'

export function Topbar() {
  const router = useRouter()

  function handleLogout() {
    authService.logout()
    router.navigate({ to: '/login' })
  }

  return (
    <Flex
      as="header"
      align="center"
      justify="space-between"
      h="56px"
      px="6"
      flexShrink={0}
      bg="bg.topbar"
      borderBottomWidth="1px"
      borderColor="border.default"
      position="sticky"
      top="0"
      zIndex="docked"
    >
      <Text fontSize="sm" color="fg.muted">
        Corte Nobre - Matriz
      </Text>
      <HStack gap="2">
        <Button colorPalette="brand" size="sm">
          <Plus size={16} /> Novo agendamento
        </Button>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut size={16} /> Sair
        </Button>
      </HStack>
    </Flex>
  )
}
