import { Box, Heading, Text } from '@chakra-ui/react'

interface PagePlaceholderProps {
  title: string
  description?: string
}

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <Box>
      <Heading size="2xl" color="fg.default">
        {title}
      </Heading>
      {description ? (
        <Text mt="2" color="fg.muted">
          {description}
        </Text>
      ) : null}
      <Box
        mt="6"
        p="6"
        rounded="md"
        borderWidth="1px"
        borderStyle="dashed"
        borderColor="border.strong"
        color="fg.muted"
        fontSize="sm"
      >
        Tela em construcao. O conteudo deste modulo sera implementado nos proximos
        incrementos.
      </Box>
    </Box>
  )
}
