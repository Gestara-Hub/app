import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

// Tema do GestaraHub (Corte Nobre) - ver docs/frontend/04-design-system.md.
// A UI consome SEMPRE tokens semanticos e tokens de status por chave; nunca hex literal.
const config = defineConfig({
  globalCss: {
    'html, body, #app': { minHeight: '100%' },
    body: { bg: 'bg.canvas', color: 'fg.default' },
  },
  theme: {
    tokens: {
      fonts: {
        heading: { value: '"Inter", "Segoe UI", system-ui, sans-serif' },
        body: { value: '"Inter", "Segoe UI", system-ui, sans-serif' },
        mono: { value: '"JetBrains Mono", ui-monospace, monospace' },
      },
      // Densidade de painel operacional: corpo base 14px.
      fontSizes: {
        xs: { value: '0.75rem' },
        sm: { value: '0.8125rem' },
        md: { value: '0.875rem' },
        lg: { value: '1rem' },
        xl: { value: '1.25rem' },
        '2xl': { value: '1.5rem' },
      },
      radii: {
        sm: { value: '4px' },
        md: { value: '6px' },
        lg: { value: '8px' },
      },
      colors: {
        // Marca: ambar/dourado fosco (navalha, latao, couro).
        brand: {
          50: { value: '#FBF6EC' },
          100: { value: '#F3E6C9' },
          200: { value: '#E6CD97' },
          300: { value: '#D6B266' },
          400: { value: '#C49A41' },
          500: { value: '#A87C2A' },
          600: { value: '#8A6420' },
          700: { value: '#6B4D19' },
          800: { value: '#4D3712' },
          900: { value: '#2E210B' },
        },
        // Neutros: grafite quente (estrutura e texto).
        neutral: {
          50: { value: '#F7F7F6' },
          100: { value: '#EDEDEB' },
          200: { value: '#DCDCD8' },
          300: { value: '#C2C2BC' },
          400: { value: '#9C9C95' },
          500: { value: '#74746E' },
          600: { value: '#54544F' },
          700: { value: '#3A3A36' },
          800: { value: '#26261F' },
          900: { value: '#16160F' },
        },
        // Cores de status de agendamento (chaves EXATAS do canon).
        status: {
          pendente: { solid: { value: '#B7791F' }, surface: { value: '#FBF1DC' } },
          confirmado: { solid: { value: '#2C5F8A' }, surface: { value: '#E1ECF5' } },
          em_atendimento: { solid: { value: '#2F7A4D' }, surface: { value: '#DEF0E5' } },
          concluido: { solid: { value: '#54544F' }, surface: { value: '#ECECEA' } },
          cancelado: { solid: { value: '#C0392B' }, surface: { value: '#F7E2DF' } },
          nao_compareceu: { solid: { value: '#7A3FA0' }, surface: { value: '#EFE3F5' } },
          // Bloqueio NAO e status; estilo proprio (hachura/neutro).
          bloqueio: { surface: { value: '#EDEDEB' }, border: { value: '#C2C2BC' } },
        },
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          canvas: { value: { base: '{colors.neutral.50}', _dark: '{colors.neutral.900}' } },
          surface: { value: { base: 'white', _dark: '{colors.neutral.800}' } },
          subtle: { value: { base: '{colors.neutral.100}', _dark: '{colors.neutral.700}' } },
          sidebar: { value: { base: '{colors.neutral.900}', _dark: '{colors.neutral.900}' } },
          topbar: { value: { base: 'white', _dark: '{colors.neutral.800}' } },
        },
        fg: {
          default: { value: { base: '{colors.neutral.700}', _dark: '{colors.neutral.50}' } },
          muted: { value: { base: '{colors.neutral.500}', _dark: '{colors.neutral.300}' } },
          onBrand: { value: { base: 'white', _dark: 'white' } },
        },
        border: {
          default: { value: { base: '{colors.neutral.200}', _dark: '{colors.neutral.700}' } },
          strong: { value: { base: '{colors.neutral.300}', _dark: '{colors.neutral.600}' } },
        },
        // Habilita colorPalette="brand" nos componentes Chakra.
        brand: {
          solid: { value: { base: '{colors.brand.600}', _dark: '{colors.brand.500}' } },
          contrast: { value: 'white' },
          fg: { value: { base: '{colors.brand.700}', _dark: '{colors.brand.300}' } },
          muted: { value: { base: '{colors.brand.100}', _dark: '{colors.brand.800}' } },
          subtle: { value: { base: '{colors.brand.50}', _dark: '{colors.brand.900}' } },
          emphasized: { value: { base: '{colors.brand.200}', _dark: '{colors.brand.700}' } },
          focusRing: { value: { base: '{colors.brand.500}', _dark: '{colors.brand.400}' } },
        },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
