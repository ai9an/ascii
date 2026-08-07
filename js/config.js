export const CHARSETS = [
  { id: "standard", name: "standard", ramp: " .:-=+*#%@" },
  { id: "extended", name: "extended", ramp: " .'`^\",:;il!i~+_-?][}{1)(|\\/tfjrxnuvczxyujclq0ozmwqpdbkhao*#mw&8%b@$" },
  { id: "blocks", name: "blocks", ramp: "░▒▓█" },
  { id: "binary", name: "binary", ramp: "01" },
  { id: "starlight", name: "starlight", ramp: " ·⋆✦✧✶✹" },
  { id: "lunar", name: "lunar", ramp: "🌑🌒🌓🌔🌕" }
];

export const PALETTES = [
  { id: "ion", name: "ion", stops: [{ position: 0, color: "#10152b" }, { position: .38, color: "#365caa" }, { position: .72, color: "#79c8ff" }, { position: 1, color: "#eff9ff" }] },
  { id: "abyss", name: "abyss", stops: [{ position: 0, color: "#04070f" }, { position: .45, color: "#123d64" }, { position: .76, color: "#298da7" }, { position: 1, color: "#a7f5ed" }] },
  { id: "nova", name: "nova", stops: [{ position: 0, color: "#10091d" }, { position: .37, color: "#552568" }, { position: .7, color: "#da657b" }, { position: 1, color: "#ffd7a0" }] },
  { id: "polar", name: "polar", stops: [{ position: 0, color: "#07111d" }, { position: .36, color: "#174b62" }, { position: .7, color: "#4ad5c8" }, { position: 1, color: "#d7fff4" }] }
];

export const DEFAULT_SETTINGS = {
  charset: CHARSETS[1].ramp,
  charsetId: "extended",
  reverseRamp: false,
  colorMode: "palette",
  solidColor: "#8fb7ff",
  monoColor: "#d8e6ff",
  palette: PALETTES[0].stops.map((stop) => ({ ...stop })),
  paletteId: "ion",
  paletteMapping: "luminance",
  backgroundMode: "gradient",
  backgroundColor: "#05070c",
  glowEnabled: true,
  glowBlur: 10,
  glowIntensity: .48,
  glowColorMode: "auto",
  glowColor: "#5d8fff",
  glowApplication: "bright",
  glowPulse: false,
  columns: 96,
  fontSize: 10,
  lineHeight: 1,
  letterSpacing: 0,
  brightness: 0,
  contrast: 12,
  gamma: 1,
  invert: false,
  dithering: "none",
  performanceMode: false
};
