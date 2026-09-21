"use client";

import { useSyncExternalStore } from "react";

export type BaseColor = "zinc" | "slate" | "stone" | "gray" | "neutral";

export type ThemeColor =
  | "zinc"
  | "slate"
  | "stone"
  | "gray"
  | "neutral"
  | "red"
  | "rose"
  | "orange"
  | "green"
  | "blue"
  | "yellow"
  | "violet"
  | "cyan"
  | "emerald";

export type ThemeRadius = "0" | "0.3" | "0.5" | "0.75" | "1.0";

export type MenuColor = "default" | "inverted" | "subtle";
export type MenuAccent = "subtle" | "bold";
export type ThemeFont =
  | "system"
  | "inter"
  | "roboto"
  | "open-sans"
  | "geist"
  | "poppins"
  | "montserrat"
  | "outfit"
  | "plus-jakarta-sans"
  | "dm-sans"
  | "ibm-plex-sans"
  | "nunito"
  | "lato"
  | "noto-sans"
  | "nunito-sans"
  | "figtree"
  | "raleway"
  | "public-sans"
  | "delius-swash-caps"
  | "barlow"
  | "hind"
  | "instrument-sans"
  | "manrope"
  | "oxanium"
  | "mono";

export type ThemeStyle = "default" | "mira" | "nova" | "vega";

export interface ThemeState {
  baseColor: BaseColor;
  themeColor: ThemeColor;
  radius: ThemeRadius;
  menuColor: MenuColor;
  menuAccent: MenuAccent;
  font: ThemeFont;
  style: ThemeStyle;
  presetId?: string;
}

export const BASE_COLORS: { name: BaseColor; label: string; color: string }[] = [
  { name: "neutral", label: "Neutro", color: "#737373" },
  { name: "zinc", label: "Zinco", color: "#71717a" },
  { name: "slate", label: "Ardósia", color: "#64748b" },
  { name: "stone", label: "Pedra", color: "#78716c" },
  { name: "gray", label: "Cinza", color: "#6b7280" },
];

export const THEME_COLORS: { name: ThemeColor; label: string; color: string }[] = [
  { name: "neutral", label: "Neutro", color: "#737373" },
  { name: "zinc", label: "Zinco", color: "#71717a" },
  { name: "slate", label: "Ardósia", color: "#64748b" },
  { name: "stone", label: "Pedra", color: "#78716c" },
  { name: "gray", label: "Cinza", color: "#6b7280" },
  { name: "red", label: "Vermelho", color: "#ef4444" },
  { name: "rose", label: "Rosa", color: "#f43f5e" },
  { name: "orange", label: "Laranja", color: "#f97316" },
  { name: "green", label: "Verde", color: "#22c55e" },
  { name: "emerald", label: "Esmeralda", color: "#10b981" },
  { name: "blue", label: "Azul", color: "#3b82f6" },
  { name: "cyan", label: "Ciano", color: "#06b6d4" },
  { name: "yellow", label: "Amarelo", color: "#eab308" },
  { name: "violet", label: "Violeta", color: "#8b5cf6" },
];

export const THEME_RADIUSES: { value: ThemeRadius; label: string }[] = [
  { value: "0", label: "0" },
  { value: "0.3", label: "0.3" },
  { value: "0.5", label: "0.5" },
  { value: "0.75", label: "0.75" },
  { value: "1.0", label: "1.0" },
];

export const MENU_COLORS: { value: MenuColor; label: string }[] = [
  { value: "default", label: "Padrão / Sólido" },
  { value: "inverted", label: "Invertido (Escuro)" },
  { value: "subtle", label: "Sutil (Translúcido)" },
];

export const MENU_ACCENTS: { value: MenuAccent; label: string }[] = [
  { value: "subtle", label: "Sutil" },
  { value: "bold", label: "Marcante" },
];

export interface ThemeFontOption {
  value: ThemeFont;
  label: string;
  fontFamily: string;
  googleFontQuery?: string;
}

export const THEME_FONTS: ThemeFontOption[] = [
  { value: "system", label: "System (Nativo)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { value: "inter", label: "Inter", fontFamily: "'Inter', sans-serif", googleFontQuery: "Inter:wght@400;500;600;700" },
  { value: "roboto", label: "Roboto", fontFamily: "'Roboto', sans-serif", googleFontQuery: "Roboto:wght@400;500;700" },
  { value: "open-sans", label: "Open Sans", fontFamily: "'Open Sans', sans-serif", googleFontQuery: "Open+Sans:wght@400;500;600;700" },
  { value: "geist", label: "Geist (Padrão)", fontFamily: "var(--font-geist-sans), sans-serif" },
  { value: "poppins", label: "Poppins", fontFamily: "'Poppins', sans-serif", googleFontQuery: "Poppins:wght@400;500;600;700" },
  { value: "montserrat", label: "Montserrat", fontFamily: "'Montserrat', sans-serif", googleFontQuery: "Montserrat:wght@400;500;600;700" },
  { value: "outfit", label: "Outfit", fontFamily: "'Outfit', sans-serif", googleFontQuery: "Outfit:wght@400;500;600;700" },
  { value: "plus-jakarta-sans", label: "Plus Jakarta Sans", fontFamily: "'Plus Jakarta Sans', sans-serif", googleFontQuery: "Plus+Jakarta+Sans:wght@400;500;600;700" },
  { value: "dm-sans", label: "DM Sans", fontFamily: "'DM Sans', sans-serif", googleFontQuery: "DM+Sans:wght@400;500;700" },
  { value: "ibm-plex-sans", label: "IBM Plex Sans", fontFamily: "'IBM Plex Sans', sans-serif", googleFontQuery: "IBM+Plex+Sans:wght@400;500;600;700" },
  { value: "nunito", label: "Nunito", fontFamily: "'Nunito', sans-serif", googleFontQuery: "Nunito:wght@400;500;600;700" },
  { value: "lato", label: "Lato", fontFamily: "'Lato', sans-serif", googleFontQuery: "Lato:wght@400;700" },
  { value: "noto-sans", label: "Noto Sans", fontFamily: "'Noto Sans', sans-serif", googleFontQuery: "Noto+Sans:wght@400;500;600;700" },
  { value: "nunito-sans", label: "Nunito Sans", fontFamily: "'Nunito Sans', sans-serif", googleFontQuery: "Nunito+Sans:wght@400;500;600;700" },
  { value: "figtree", label: "Figtree", fontFamily: "'Figtree', sans-serif", googleFontQuery: "Figtree:wght@400;500;600;700" },
  { value: "raleway", label: "Raleway", fontFamily: "'Raleway', sans-serif", googleFontQuery: "Raleway:wght@400;500;600;700" },
  { value: "public-sans", label: "Public Sans", fontFamily: "'Public Sans', sans-serif", googleFontQuery: "Public+Sans:wght@400;500;600;700" },
  { value: "delius-swash-caps", label: "Delius Swash Caps", fontFamily: "'Delius Swash Caps', cursive", googleFontQuery: "Delius+Swash+Caps" },
  { value: "barlow", label: "Barlow", fontFamily: "'Barlow', sans-serif", googleFontQuery: "Barlow:wght@400;500;600;700" },
  { value: "hind", label: "Hind", fontFamily: "'Hind', sans-serif", googleFontQuery: "Hind:wght@400;500;600;700" },
  { value: "instrument-sans", label: "Instrument Sans", fontFamily: "'Instrument Sans', sans-serif", googleFontQuery: "Instrument+Sans:wght@400;500;600;700" },
  { value: "manrope", label: "Manrope", fontFamily: "'Manrope', sans-serif", googleFontQuery: "Manrope:wght@400;500;600;700" },
  { value: "oxanium", label: "Oxanium", fontFamily: "'Oxanium', sans-serif", googleFontQuery: "Oxanium:wght@400;500;600;700" },
  { value: "mono", label: "Mono (Monoespaçada)", fontFamily: "var(--font-mono), monospace" },
];

export const THEME_STYLES: { value: ThemeStyle; label: string }[] = [
  { value: "default", label: "Padrão (Clássico)" },
  { value: "mira", label: "Mira (Suave & Elevado)" },
  { value: "nova", label: "Nova (Dinâmico / Alto Contraste)" },
  { value: "vega", label: "Vega (Minimalista / Plano)" },
];

export interface ThemePreset {
  id: string;
  name: string;
  previewColors: [string, string, string, string];
  state: ThemeState;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "default",
    name: "Padrão (Default)",
    previewColors: ["#18181b", "#71717a", "#e4e4e7", "#ffffff"],
    state: {
      baseColor: "zinc",
      themeColor: "zinc",
      radius: "0.5",
      menuColor: "default",
      menuAccent: "subtle",
      font: "geist",
      style: "default",
      presetId: "default",
    },
  },
  {
    id: "art-deco",
    name: "Art Deco",
    previewColors: ["#eab308", "#ca8a04", "#78716c", "#fef08a"],
    state: {
      baseColor: "stone",
      themeColor: "yellow",
      radius: "0.3",
      menuColor: "default",
      menuAccent: "bold",
      font: "raleway",
      style: "nova",
      presetId: "art-deco",
    },
  },
  {
    id: "caffeine",
    name: "Caffeine",
    previewColors: ["#ea580c", "#c2410c", "#78716c", "#ffedd5"],
    state: {
      baseColor: "stone",
      themeColor: "orange",
      radius: "0.5",
      menuColor: "default",
      menuAccent: "subtle",
      font: "dm-sans",
      style: "mira",
      presetId: "caffeine",
    },
  },
  {
    id: "claude",
    name: "Claude",
    previewColors: ["#d97706", "#f59e0b", "#78716c", "#fef3c7"],
    state: {
      baseColor: "stone",
      themeColor: "orange",
      radius: "0.5",
      menuColor: "subtle",
      menuAccent: "subtle",
      font: "poppins",
      style: "mira",
      presetId: "claude",
    },
  },
  {
    id: "clean-slate",
    name: "Clean Slate",
    previewColors: ["#334155", "#64748b", "#cbd5e1", "#f8fafc"],
    state: {
      baseColor: "slate",
      themeColor: "slate",
      radius: "0.5",
      menuColor: "default",
      menuAccent: "subtle",
      font: "inter",
      style: "default",
      presetId: "clean-slate",
    },
  },
  {
    id: "corporate",
    name: "Corporate",
    previewColors: ["#1d4ed8", "#3b82f6", "#64748b", "#eff6ff"],
    state: {
      baseColor: "slate",
      themeColor: "blue",
      radius: "0.3",
      menuColor: "inverted",
      menuAccent: "bold",
      font: "inter",
      style: "nova",
      presetId: "corporate",
    },
  },
  {
    id: "elegant-luxury",
    name: "Elegant Luxury",
    previewColors: ["#ca8a04", "#eab308", "#171717", "#fefce8"],
    state: {
      baseColor: "neutral",
      themeColor: "yellow",
      radius: "0.5",
      menuColor: "inverted",
      menuAccent: "bold",
      font: "montserrat",
      style: "mira",
      presetId: "elegant-luxury",
    },
  },
  {
    id: "ghibli-studio",
    name: "Ghibli Studio",
    previewColors: ["#16a34a", "#22c55e", "#78716c", "#dcfce7"],
    state: {
      baseColor: "stone",
      themeColor: "green",
      radius: "0.75",
      menuColor: "default",
      menuAccent: "subtle",
      font: "nunito",
      style: "mira",
      presetId: "ghibli-studio",
    },
  },
  {
    id: "marshmallow",
    name: "Marshmallow",
    previewColors: ["#e11d48", "#fb7185", "#737373", "#ffe4e6"],
    state: {
      baseColor: "neutral",
      themeColor: "rose",
      radius: "0.75",
      menuColor: "subtle",
      menuAccent: "subtle",
      font: "outfit",
      style: "mira",
      presetId: "marshmallow",
    },
  },
  {
    id: "marvel",
    name: "Marvel",
    previewColors: ["#dc2626", "#ef4444", "#09090b", "#fee2e2"],
    state: {
      baseColor: "neutral",
      themeColor: "red",
      radius: "0.3",
      menuColor: "inverted",
      menuAccent: "bold",
      font: "figtree",
      style: "nova",
      presetId: "marvel",
    },
  },
  {
    id: "material-design",
    name: "Material Design",
    previewColors: ["#2563eb", "#60a5fa", "#737373", "#dbeafe"],
    state: {
      baseColor: "neutral",
      themeColor: "blue",
      radius: "0.75",
      menuColor: "default",
      menuAccent: "subtle",
      font: "roboto",
      style: "mira",
      presetId: "material-design",
    },
  },
  {
    id: "midnight-bloom",
    name: "Midnight Bloom",
    previewColors: ["#7c3aed", "#8b5cf6", "#334155", "#ede9fe"],
    state: {
      baseColor: "slate",
      themeColor: "violet",
      radius: "0.5",
      menuColor: "inverted",
      menuAccent: "bold",
      font: "plus-jakarta-sans",
      style: "nova",
      presetId: "midnight-bloom",
    },
  },
  {
    id: "modern-minimal",
    name: "Modern Minimal",
    previewColors: ["#18181b", "#52525b", "#a1a1aa", "#ffffff"],
    state: {
      baseColor: "zinc",
      themeColor: "zinc",
      radius: "0.3",
      menuColor: "subtle",
      menuAccent: "subtle",
      font: "geist",
      style: "vega",
      presetId: "modern-minimal",
    },
  },
  {
    id: "nature",
    name: "Nature",
    previewColors: ["#059669", "#10b981", "#78716c", "#d1fae5"],
    state: {
      baseColor: "stone",
      themeColor: "emerald",
      radius: "0.5",
      menuColor: "default",
      menuAccent: "subtle",
      font: "manrope",
      style: "mira",
      presetId: "nature",
    },
  },
  {
    id: "neo-brutalism",
    name: "Neo Brutalism",
    previewColors: ["#000000", "#eab308", "#52525b", "#facc15"],
    state: {
      baseColor: "neutral",
      themeColor: "yellow",
      radius: "0",
      menuColor: "default",
      menuAccent: "bold",
      font: "mono",
      style: "nova",
      presetId: "neo-brutalism",
    },
  },
  {
    id: "pastel-dreams",
    name: "Pastel Dreams",
    previewColors: ["#8b5cf6", "#c084fc", "#e4e4e7", "#f3e8ff"],
    state: {
      baseColor: "neutral",
      themeColor: "violet",
      radius: "1.0",
      menuColor: "subtle",
      menuAccent: "subtle",
      font: "outfit",
      style: "mira",
      presetId: "pastel-dreams",
    },
  },
  {
    id: "perplexity",
    name: "Perplexity",
    previewColors: ["#0891b2", "#06b6d4", "#64748b", "#cffafe"],
    state: {
      baseColor: "slate",
      themeColor: "cyan",
      radius: "0.5",
      menuColor: "default",
      menuAccent: "subtle",
      font: "plus-jakarta-sans",
      style: "mira",
      presetId: "perplexity",
    },
  },
  {
    id: "slack",
    name: "Slack",
    previewColors: ["#4a154b", "#611f69", "#ecb22e", "#2eb67d"],
    state: {
      baseColor: "neutral",
      themeColor: "violet",
      radius: "0.5",
      menuColor: "inverted",
      menuAccent: "bold",
      font: "inter",
      style: "default",
      presetId: "slack",
    },
  },
  {
    id: "spotify",
    name: "Spotify",
    previewColors: ["#1db954", "#1ed760", "#121212", "#191414"],
    state: {
      baseColor: "neutral",
      themeColor: "green",
      radius: "1.0",
      menuColor: "inverted",
      menuAccent: "bold",
      font: "figtree",
      style: "nova",
      presetId: "spotify",
    },
  },
  {
    id: "summer",
    name: "Summer",
    previewColors: ["#ea580c", "#f97316", "#6b7280", "#ffedd5"],
    state: {
      baseColor: "gray",
      themeColor: "orange",
      radius: "0.75",
      menuColor: "default",
      menuAccent: "subtle",
      font: "raleway",
      style: "mira",
      presetId: "summer",
    },
  },
];

const STORAGE_KEY = "gestarahub:theme-generator-state";

const DEFAULT_STATE: ThemeState = {
  baseColor: "zinc",
  themeColor: "zinc",
  radius: "0.5",
  menuColor: "default",
  menuAccent: "subtle",
  font: "geist",
  style: "default",
  presetId: "default",
};

export function getActivePresetId(state: ThemeState): string | undefined {
  if (!state) return undefined;

  // 1. If explicit presetId is provided, check if primary properties match:
  if (state.presetId) {
    const preset = THEME_PRESETS.find((p) => p.id === state.presetId);
    if (preset) {
      const colorsMatch =
        preset.state.baseColor === state.baseColor &&
        preset.state.themeColor === state.themeColor &&
        preset.state.radius === state.radius &&
        preset.state.menuColor === state.menuColor &&
        preset.state.menuAccent === state.menuAccent &&
        preset.state.style === state.style;
      if (colorsMatch) return preset.id;
    }
  }

  // 2. Check if current settings match any known preset:
  const matched = THEME_PRESETS.find(
    (p) =>
      p.state.baseColor === state.baseColor &&
      p.state.themeColor === state.themeColor &&
      p.state.radius === state.radius &&
      p.state.menuColor === state.menuColor &&
      p.state.menuAccent === state.menuAccent &&
      p.state.style === state.style,
  );

  return matched ? matched.id : undefined;
}

// Gerenciamento de histórico de desfazer/refazer
let history: ThemeState[] = [DEFAULT_STATE];
let historyIndex = 0;

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function loadFontOnDemand(fontValue: string) {
  if (typeof document === "undefined") return;
  const font = THEME_FONTS.find((f) => f.value === fontValue);
  if (!font) return;

  if (font.googleFontQuery) {
    const linkId = `gh-font-${font.value}`;
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${font.googleFontQuery}&display=swap`;
      document.head.appendChild(link);
    }
  }
}

export function loadFontCatalogPreview() {
  if (typeof document === "undefined") return;
  const linkId = "gh-font-catalog-preview";
  if (document.getElementById(linkId)) return;

  const fontQueries = THEME_FONTS.filter((f) => f.googleFontQuery)
    .map((f) => `family=${f.googleFontQuery}`)
    .join("&");

  const link = document.createElement("link");
  link.id = linkId;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${fontQueries}&display=swap`;
  document.head.appendChild(link);
}

function applyStateToDOM(state: ThemeState) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-base-color", state.baseColor);
  root.setAttribute("data-theme-color", state.themeColor);
  root.setAttribute("data-theme-radius", state.radius);
  root.setAttribute("data-menu-color", state.menuColor);
  root.setAttribute("data-menu-accent", state.menuAccent);
  root.setAttribute("data-font", state.font);
  root.setAttribute("data-style", state.style);
  if (state.presetId) {
    root.setAttribute("data-preset", state.presetId);
  } else {
    root.removeAttribute("data-preset");
  }
  loadFontOnDemand(state.font);
}

function saveStateToStorage(state: ThemeState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // backward compatibility keys
    localStorage.setItem("gestarahub:theme-color", state.themeColor);
    localStorage.setItem("gestarahub:theme-radius", state.radius);
  } catch {
    // Ignore
  }
}

function loadStateFromStorage(): ThemeState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ThemeState>;
      const loaded: ThemeState = {
        baseColor: parsed.baseColor || DEFAULT_STATE.baseColor,
        themeColor: parsed.themeColor || DEFAULT_STATE.themeColor,
        radius: parsed.radius || DEFAULT_STATE.radius,
        menuColor: parsed.menuColor || DEFAULT_STATE.menuColor,
        menuAccent: parsed.menuAccent || DEFAULT_STATE.menuAccent,
        font: parsed.font || DEFAULT_STATE.font,
        style: parsed.style || DEFAULT_STATE.style,
        presetId: parsed.presetId,
      };
      loaded.presetId = getActivePresetId(loaded) ?? parsed.presetId;
      return loaded;
    }
    const oldColor = localStorage.getItem("gestarahub:theme-color") as ThemeColor | null;
    const oldRadius = localStorage.getItem("gestarahub:theme-radius") as ThemeRadius | null;
    if (oldColor || oldRadius) {
      const legacy: ThemeState = {
        ...DEFAULT_STATE,
        themeColor: oldColor || DEFAULT_STATE.themeColor,
        radius: oldRadius || DEFAULT_STATE.radius,
      };
      legacy.presetId = getActivePresetId(legacy);
      return legacy;
    }
  } catch {
    // Ignore
  }
  return DEFAULT_STATE;
}

// Inicializa estado
let currentState: ThemeState = DEFAULT_STATE;

if (typeof window !== "undefined") {
  currentState = loadStateFromStorage();
  history = [currentState];
  historyIndex = 0;
  applyStateToDOM(currentState);
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): ThemeState {
  return currentState;
}

function getServerSnapshot(): ThemeState {
  return DEFAULT_STATE;
}

export function useThemeCustomizer() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function pushState(newState: ThemeState) {
    const resolvedPreset = getActivePresetId(newState) ?? newState.presetId;
    const finalState: ThemeState = { ...newState, presetId: resolvedPreset };
    currentState = finalState;
    history = history.slice(0, historyIndex + 1);
    history.push(finalState);
    historyIndex = history.length - 1;

    applyStateToDOM(finalState);
    saveStateToStorage(finalState);
    emitChange();
  }

  function setBaseColor(baseColor: BaseColor) {
    pushState({ ...state, baseColor, presetId: undefined });
  }

  function setThemeColor(themeColor: ThemeColor) {
    pushState({ ...state, themeColor, presetId: undefined });
  }

  function setThemeRadius(radius: ThemeRadius) {
    pushState({ ...state, radius, presetId: undefined });
  }

  function setMenuColor(menuColor: MenuColor) {
    pushState({ ...state, menuColor, presetId: undefined });
  }

  function setMenuAccent(menuAccent: MenuAccent) {
    pushState({ ...state, menuAccent, presetId: undefined });
  }

  function setThemeFont(font: ThemeFont) {
    pushState({ ...state, font, presetId: undefined });
  }

  function setThemeStyle(style: ThemeStyle) {
    pushState({ ...state, style, presetId: undefined });
  }

  function applyPreset(presetId: string) {
    const preset = THEME_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      pushState({ ...preset.state, presetId });
    }
  }

  function undo() {
    if (historyIndex > 0) {
      historyIndex -= 1;
      currentState = history[historyIndex];
      applyStateToDOM(currentState);
      saveStateToStorage(currentState);
      emitChange();
    }
  }

  function redo() {
    if (historyIndex < history.length - 1) {
      historyIndex += 1;
      currentState = history[historyIndex];
      applyStateToDOM(currentState);
      saveStateToStorage(currentState);
      emitChange();
    }
  }

  function randomize() {
    const randomBase = BASE_COLORS[Math.floor(Math.random() * BASE_COLORS.length)].name;
    const randomTheme = THEME_COLORS[Math.floor(Math.random() * THEME_COLORS.length)].name;
    const randomRadius = THEME_RADIUSES[Math.floor(Math.random() * THEME_RADIUSES.length)].value;
    const randomMenu = MENU_COLORS[Math.floor(Math.random() * MENU_COLORS.length)].value;
    const randomStyle = THEME_STYLES[Math.floor(Math.random() * THEME_STYLES.length)].value;

    pushState({
      ...state,
      baseColor: randomBase,
      themeColor: randomTheme,
      radius: randomRadius,
      menuColor: randomMenu,
      style: randomStyle,
      presetId: undefined,
    });
  }

  function resetTheme() {
    pushState(DEFAULT_STATE);
  }

  function generateCssCode(): string {
    return `/* GestaraHub Custom Theme (shadcn/ui compatible) */
:root {
  --radius: ${state.radius === "0" ? "0rem" : `${state.radius}rem`};
  /* Base: ${state.baseColor} | Theme: ${state.themeColor} | Style: ${state.style} | Menu: ${state.menuColor} */
}

/* data-attributes no html: */
/* <html data-base-color="${state.baseColor}" data-theme-color="${state.themeColor}" data-theme-radius="${state.radius}" data-menu-color="${state.menuColor}" data-style="${state.style}"> */`;
  }

  return {
    state,
    setBaseColor,
    setThemeColor,
    setThemeRadius,
    setMenuColor,
    setMenuAccent,
    setThemeFont,
    setThemeStyle,
    applyPreset,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    randomize,
    resetTheme,
    generateCssCode,
    mounted: true,
  };
}
