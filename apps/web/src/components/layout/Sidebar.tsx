import { Box, Flex, Text, VStack } from '@chakra-ui/react'
import { Link } from '@tanstack/react-router'
import { navPrincipal, navRodape } from '@/lib/navigation'
import type { NavItem } from '@/lib/navigation'

function NavLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.to === '/' }}
      style={{ textDecoration: 'none', width: '100%' }}
    >
      {({ isActive }) => (
        <Flex
          align="center"
          gap="3"
          px="3"
          py="2"
          rounded="md"
          fontSize="md"
          fontWeight={isActive ? 'semibold' : 'medium'}
          color={isActive ? 'fg.onBrand' : 'whiteAlpha.800'}
          bg={isActive ? 'brand.solid' : 'transparent'}
          transition="background 0.15s"
          _hover={{ bg: isActive ? 'brand.solid' : 'whiteAlpha.200' }}
        >
          <Icon size={18} />
          <Text>{item.label}</Text>
        </Flex>
      )}
    </Link>
  )
}

export function Sidebar() {
  return (
    <Flex
      direction="column"
      w="248px"
      flexShrink={0}
      bg="bg.sidebar"
      color="whiteAlpha.900"
      p="3"
      h="100dvh"
      position="sticky"
      top="0"
    >
      <Box px="3" py="4">
        <Text fontSize="xl" fontWeight="bold" color="fg.onBrand">
          GestaraHub
        </Text>
        <Text fontSize="xs" color="whiteAlpha.600">
          Corte Nobre
        </Text>
      </Box>

      <VStack align="stretch" gap="1" mt="2">
        {navPrincipal.map((item) => (
          <NavLink key={item.to} item={item} />
        ))}
      </VStack>

      <Box flex="1" />

      <VStack align="stretch" gap="1">
        {navRodape.map((item) => (
          <NavLink key={item.to} item={item} />
        ))}
      </VStack>
    </Flex>
  )
}
