import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

// GestaraHub theme (Corte Nobre) - see docs/frontend/04-design-system.md.
// The UI ALWAYS consumes semantic tokens and status tokens by key; never literal hex.
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
      // Operational panel density: base body 14px.
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
        // Brand: matte amber/gold (razor, brass, leather).
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
        // Neutrals: warm graphite (structure and text).
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
        // Appointment status colors (EXACT canon keys).
        status: {
          pending: { solid: { value: '#B7791F' }, surface: { value: '#FBF1DC' } },
          confirmed: { solid: { value: '#2C5F8A' }, surface: { value: '#E1ECF5' } },
          in_service: { solid: { value: '#2F7A4D' }, surface: { value: '#DEF0E5' } },
          completed: { solid: { value: '#54544F' }, surface: { value: '#ECECEA' } },
          cancelled: { solid: { value: '#C0392B' }, surface: { value: '#F7E2DF' } },
          no_show: { solid: { value: '#7A3FA0' }, surface: { value: '#EFE3F5' } },
          // Block is NOT a status; its own style (hatch/neutral).
          block: { surface: { value: '#EDEDEB' }, border: { value: '#C2C2BC' } },
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
        // Enables colorPalette="brand" on Chakra components.
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
