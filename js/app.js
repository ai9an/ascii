import { CHARSETS, PALETTES, DEFAULT_SETTINGS } from "./config.js";
import { AsciiRenderer } from "./renderer.js";
import { PaletteEditor } from "./palette-editor.js";
import { MediaController } from "./media.js";
import { downloadText, copyText, downloadPng, supportedWebmType, WebmRecorder } from "./exporter.js";
import { PresetStore } from "./preset-store.js";

const byId = (id) => document.getElementById(id);
const settings = structuredClone(DEFAULT_SETTINGS);
const outputCanvas = byId("outputCanvas");
const sourceCanvas = byId("sourceCanvas");
const sourceContext = sourceCanvas.getContext("2d");
const renderer = new AsciiRenderer(outputCanvas);
const presetStore = new PresetStore();
let renderRequest = 0;
let pulseRequest = 0;
let frameNumber = 0;
let mediaKind = "image";
let recorder = null;
let toastTimer = 0;
let activeLocalPresetId = "";
const MAX_EXPORT_DIMENSION = 8192;
const MAX_EXPORT_PIXELS = 40_000_000;

function toast(message) {
  const element = byId("toast");
  element.textContent = message; element.classList.add("visible");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove("visible"), 2400);
}

function setStatus(message) { byId("statusText").textContent = message; }

function getSourceDimensions(source) {
  return {
    width: source?.videoWidth || source?.naturalWidth || source?.width || 1,
    height: source?.videoHeight || source?.naturalHeight || source?.height || 1
  };
}

function getPngExportPlan() {
  if (!media.source) return null;
  const base = renderer.measure(media.source, settings, 1, false);
  const source = getSourceDimensions(media.source);
  const selection = byId("pngResolution").value;
  const requestedScale = selection === "source"
    ? Math.max(source.width / base.naturalWidth, source.height / base.naturalHeight)
    : Number(selection);
  const limit = Math.min(
    MAX_EXPORT_DIMENSION / base.width,
    MAX_EXPORT_DIMENSION / base.height,
    Math.sqrt(MAX_EXPORT_PIXELS / (base.width * base.height))
  );
  const scale = Math.max(.1, Math.min(requestedScale, limit));
  const frame = renderer.measure(media.source, settings, scale, false);
  return { ...frame, scale, limited: scale < requestedScale - .001 };
}

function updatePngDimensions() {
  const plan = getPngExportPlan();
  if (!plan) return;
  byId("pngDimensions").textContent = `${plan.width.toLocaleString()} × ${plan.height.toLocaleString()} px${plan.limited ? " · browser-safe limit" : " · crisp glyph render"}`;
}

function cleanName(name) { return name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").toLowerCase(); }

function drawSource(source) {
  const sourceWidth = source.videoWidth || source.naturalWidth || source.width || 1;
  const sourceHeight = source.videoHeight || source.naturalHeight || source.height || 1;
  const scale = Math.min(1, 1200 / sourceWidth, 1200 / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  if (sourceCanvas.width !== width || sourceCanvas.height !== height) {
    sourceCanvas.width = width; sourceCanvas.height = height;
  }
  sourceContext.clearRect(0, 0, width, height);
  sourceContext.drawImage(source, 0, 0, width, height);
}

function updateStats(frame) {
  byId("gridStat").textContent = `${frame.columns} × ${frame.rows}`;
  byId("glyphStat").textContent = frame.glyphs.toLocaleString();
  byId("renderStat").textContent = `${frame.duration.toFixed(1)} ms`;
  if (mediaKind === "video" && media.source) {
    const seconds = media.source.currentTime || 0;
    const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
    const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
    byId("hudTime").textContent = `00:${minutes}:${rest}`;
  }
  updatePngDimensions();
}

function renderNow(time = performance.now()) {
  if (!media.source) return;
  try {
    drawSource(media.source);
    updateStats(renderer.render(media.source, settings, time));
    setStatus(mediaKind === "video" ? (settings.performanceMode ? "video · performance mode" : "video signal live") : "still signal ready");
  } catch (error) {
    console.error(error); setStatus("render interrupted");
  }
}

function requestRender() {
  cancelAnimationFrame(renderRequest);
  renderRequest = requestAnimationFrame((time) => renderNow(time));
}

function updatePulseLoop() {
  cancelAnimationFrame(pulseRequest);
  if (!settings.glowPulse || mediaKind === "video") return;
  const tick = (time) => { renderNow(time); pulseRequest = requestAnimationFrame(tick); };
  pulseRequest = requestAnimationFrame(tick);
}

function setVideoControls(visible) {
  document.querySelectorAll(".video-only").forEach((element) => { element.hidden = !visible; });
  const webmType = supportedWebmType();
  byId("recordWebm").hidden = !visible || !webmType;
  byId("compatNote").textContent = !visible
    ? "exports stay on your device. load a video to enable real-time webm recording."
    : webmType ? `webm recording ready (${webmType.includes("vp9") ? "vp9" : webmType.includes("vp8") ? "vp8" : "browser default"}). recording runs in real time.`
      : "this browser cannot record webm from canvas. still image and text exports remain available.";
}

const media = new MediaController({
  onReady({ kind, name }) {
    mediaKind = kind; frameNumber = 0;
    byId("mediaName").textContent = cleanName(name);
    setVideoControls(kind === "video");
    renderNow(); updatePulseLoop();
  },
  onFrame() {
    frameNumber += 1;
    if (settings.performanceMode && frameNumber % 2) return;
    renderNow();
  },
  onError(message) { toast(message); setStatus("input unavailable"); }
});

function buildCharsets() {
  const container = byId("charsetPresets");
  CHARSETS.forEach((preset) => {
    const button = document.createElement("button");
    button.type = "button"; button.className = `preset-button${preset.id === settings.charsetId ? " active" : ""}`;
    button.dataset.charset = preset.id;
    const name = document.createElement("span"); name.textContent = preset.name;
    const preview = document.createElement("code"); preview.textContent = preset.ramp;
    button.append(name, preview);
    button.addEventListener("click", () => {
      settings.charset = preset.ramp; settings.charsetId = preset.id;
      byId("customCharset").value = "";
      container.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
      requestRender();
    });
    container.append(button);
  });
}

function buildPalettes() {
  const container = byId("palettePresets");
  PALETTES.forEach((palette) => {
    const button = document.createElement("button"); button.type = "button";
    button.className = `palette-swatch${palette.id === settings.paletteId ? " active" : ""}`;
    button.title = palette.name; button.dataset.palette = palette.id;
    const swatch = document.createElement("i");
    swatch.style.background = `linear-gradient(90deg, ${palette.stops.map((stop) => `${stop.color} ${stop.position * 100}%`).join(",")})`;
    button.append(swatch);
    button.addEventListener("click", () => {
      settings.palette = palette.stops.map((stop) => ({ ...stop })); settings.paletteId = palette.id;
      paletteEditor.setStops(palette.stops);
      container.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
      requestRender();
    });
    container.append(button);
  });
}

const paletteEditor = new PaletteEditor(byId("paletteTrack"), (stops) => {
  settings.palette = stops; settings.paletteId = "custom";
  document.querySelectorAll(".palette-swatch").forEach((button) => button.classList.remove("active"));
  requestRender();
});

function syncUiFromSettings() {
  const knownCharset = CHARSETS.some((preset) => preset.id === settings.charsetId);
  document.querySelectorAll(".preset-button").forEach((button) => button.classList.toggle("active", knownCharset && button.dataset.charset === settings.charsetId));
  byId("customCharset").value = knownCharset ? "" : settings.charset;

  ["reverseRamp", "glowEnabled", "glowPulse", "invert", "performanceMode"].forEach((id) => {
    byId(id).checked = Boolean(settings[id]);
  });
  ["backgroundMode", "paletteMapping", "glowColorMode", "glowApplication", "dithering"].forEach((id) => {
    const input = byId(id);
    input.value = settings[id];
    if (!input.value) { input.value = DEFAULT_SETTINGS[id]; settings[id] = input.value; }
  });
  ["solidColor", "backgroundColor", "glowColor"].forEach((id) => {
    const input = byId(id);
    input.value = settings[id];
    settings[id] = input.value;
  });

  const rangeValues = {
    columns: settings.columns,
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight * 100,
    letterSpacing: settings.letterSpacing,
    brightness: settings.brightness,
    contrast: settings.contrast,
    gamma: settings.gamma * 100,
    glowBlur: settings.glowBlur,
    glowIntensity: settings.glowIntensity * 100
  };
  Object.entries(rangeValues).forEach(([id, value]) => {
    const input = byId(id); input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  byId("colorMode").querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.colorMode === settings.colorMode));
  document.querySelectorAll(".mode-solid").forEach((element) => { element.hidden = settings.colorMode !== "solid"; });
  document.querySelectorAll(".mode-palette").forEach((element) => { element.hidden = settings.colorMode !== "palette"; });

  paletteEditor.setStops(settings.palette);
  document.querySelectorAll(".palette-swatch").forEach((button) => button.classList.toggle("active", button.dataset.palette === settings.paletteId));
  updatePulseLoop(); requestRender();
}

function applyLocalPreset(preset) {
  const restored = structuredClone(DEFAULT_SETTINGS);
  Object.assign(restored, preset.settings);
  restored.palette = Array.isArray(preset.settings.palette) && preset.settings.palette.length >= 2
    ? preset.settings.palette.map((stop) => ({ ...stop }))
    : structuredClone(DEFAULT_SETTINGS.palette);
  Object.assign(settings, restored);
  activeLocalPresetId = preset.id;
  syncUiFromSettings(); renderLocalPresets();
}

function renderLocalPresets() {
  const container = byId("localPresetList");
  let presets;
  try { presets = presetStore.list(); }
  catch { presets = []; }
  container.replaceChildren();
  if (!presets.length) {
    const empty = document.createElement("p"); empty.className = "local-preset-empty"; empty.textContent = "no saved presets yet";
    container.append(empty); return;
  }
  presets.forEach((preset) => {
    const item = document.createElement("div");
    item.className = `local-preset-item${preset.id === activeLocalPresetId ? " active" : ""}`;
    const load = document.createElement("button"); load.type = "button"; load.className = "local-preset-load"; load.dataset.loadPreset = preset.id;
    const name = document.createElement("b"); name.textContent = preset.name;
    const meta = document.createElement("small");
    meta.textContent = `${preset.settings.columns || DEFAULT_SETTINGS.columns} cols · ${preset.settings.charsetId || "custom"}`;
    load.append(name, meta);
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "local-preset-delete";
    remove.dataset.deletePreset = preset.id; remove.setAttribute("aria-label", `delete ${preset.name}`); remove.title = "delete preset"; remove.textContent = "×";
    item.append(load, remove); container.append(item);
  });
}

function wireLocalPresets() {
  const nameInput = byId("localPresetName");
  const save = () => {
    try {
      const saved = presetStore.save(nameInput.value, settings);
      activeLocalPresetId = saved.id; nameInput.value = "";
      renderLocalPresets(); toast("preset saved locally");
    } catch (error) {
      toast(error.message || "local presets are unavailable"); nameInput.focus();
    }
  };
  byId("saveLocalPreset").addEventListener("click", save);
  nameInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); save(); } });
  byId("localPresetList").addEventListener("click", (event) => {
    const loadButton = event.target.closest("[data-load-preset]");
    const deleteButton = event.target.closest("[data-delete-preset]");
    try {
      if (loadButton) {
        const preset = presetStore.get(loadButton.dataset.loadPreset);
        if (preset) { applyLocalPreset(preset); toast("preset loaded"); }
      } else if (deleteButton) {
        presetStore.remove(deleteButton.dataset.deletePreset);
        if (activeLocalPresetId === deleteButton.dataset.deletePreset) activeLocalPresetId = "";
        renderLocalPresets(); toast("preset deleted");
      }
    } catch { toast("local presets are unavailable"); }
  });
  window.addEventListener("storage", () => renderLocalPresets());
  renderLocalPresets();
}

function bindRange(id, value, format) {
  const input = byId(id); const output = document.querySelector(`output[for="${id}"]`);
  const sync = () => {
    const min = Number(input.min); const max = Number(input.max);
    input.style.setProperty("--range", `${((Number(input.value) - min) / (max - min)) * 100}%`);
    output.textContent = format(Number(input.value)); settings[id] = value(Number(input.value)); requestRender();
  };
  input.addEventListener("input", sync); sync();
}

function bindSelect(id) { byId(id).addEventListener("change", (event) => { settings[id] = event.target.value; requestRender(); }); }
function bindCheck(id, after = () => {}) { byId(id).addEventListener("change", (event) => { settings[id] = event.target.checked; requestRender(); after(); }); }

function wireControls() {
  byId("customCharset").addEventListener("input", (event) => {
    const characters = Array.from(event.target.value);
    if (characters.length >= 2) {
      settings.charset = event.target.value; settings.charsetId = "custom";
      document.querySelectorAll(".preset-button").forEach((button) => button.classList.remove("active")); requestRender();
    }
  });
  bindCheck("reverseRamp"); bindCheck("glowEnabled"); bindCheck("glowPulse", updatePulseLoop);
  bindCheck("invert"); bindCheck("performanceMode");
  ["backgroundMode", "paletteMapping", "glowColorMode", "glowApplication", "dithering"].forEach(bindSelect);
  [["solidColor", "solidColor"], ["backgroundColor", "backgroundColor"], ["glowColor", "glowColor"]].forEach(([id, key]) => {
    byId(id).addEventListener("input", (event) => { settings[key] = event.target.value; requestRender(); });
  });
  bindRange("columns", (number) => number, (number) => `${number} cols`);
  bindRange("fontSize", (number) => number, (number) => `${number} px`);
  bindRange("lineHeight", (number) => number / 100, (number) => `${(number / 100).toFixed(2)}×`);
  bindRange("letterSpacing", (number) => number, (number) => `${number.toFixed(2)} px`);
  bindRange("brightness", (number) => number, (number) => `${number > 0 ? "+" : ""}${number}`);
  bindRange("contrast", (number) => number, (number) => `${number > 0 ? "+" : ""}${number}`);
  bindRange("gamma", (number) => number / 100, (number) => (number / 100).toFixed(2));
  bindRange("glowBlur", (number) => number, (number) => `${number} px`);
  bindRange("glowIntensity", (number) => number / 100, (number) => `${number}%`);

  byId("colorMode").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-color-mode]"); if (!button) return;
    settings.colorMode = button.dataset.colorMode;
    byId("colorMode").querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
    document.querySelectorAll(".mode-solid").forEach((element) => { element.hidden = settings.colorMode !== "solid"; });
    document.querySelectorAll(".mode-palette").forEach((element) => { element.hidden = settings.colorMode !== "palette"; });
    requestRender();
  });
  byId("addStop").addEventListener("click", () => paletteEditor.addStop());
}

function wireInput() {
  byId("fileInput").addEventListener("change", (event) => {
    const [file] = event.target.files;
    media.loadFile(file);
    event.target.value = "";
  });
  const dropZone = byId("dropZone");
  ["dragenter", "dragover"].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.remove("dragover"); }));
  dropZone.addEventListener("drop", (event) => media.loadFile(event.dataTransfer.files[0]));
  byId("viewportShell").addEventListener("click", () => { if (mediaKind === "video" && media.source?.paused) media.source.play().catch(() => {}); });
}

function wireLayout() {
  byId("panelToggle").addEventListener("click", () => {
    if (matchMedia("(max-width: 900px)").matches) document.body.classList.toggle("panel-open");
    else document.body.classList.toggle("panel-collapsed");
    byId("panelToggle").setAttribute("aria-expanded", String(!document.body.classList.contains("panel-collapsed")));
  });
  byId("mobileClose").addEventListener("click", () => document.body.classList.remove("panel-open"));
  byId("viewMode").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-view]"); if (!button) return;
    byId("viewMode").querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
    byId("viewportShell").dataset.view = button.dataset.view;
    if (button.dataset.view !== "render" && media.source) drawSource(media.source);
  });
  byId("fullscreenButton").addEventListener("click", () => document.body.classList.toggle("fullscreen-preview"));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") document.body.classList.remove("fullscreen-preview", "panel-open"); });
}

function wireExports() {
  byId("copyText").addEventListener("click", async () => {
    if (!renderer.lastFrame) return; await copyText(renderer.lastFrame.text); toast("ascii copied to clipboard");
  });
  byId("downloadText").addEventListener("click", () => { if (renderer.lastFrame) downloadText(renderer.lastFrame.text); });
  byId("pngResolution").addEventListener("change", updatePngDimensions);
  byId("downloadPng").addEventListener("click", async () => {
    if (!media.source) return;
    const button = byId("downloadPng");
    const label = button.querySelector("b");
    const previousLabel = label.textContent;
    button.disabled = true; label.textContent = "rendering…";
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const exportCanvas = document.createElement("canvas");
    try {
      const plan = getPngExportPlan();
      const exportRenderer = new AsciiRenderer(exportCanvas);
      exportRenderer.render(media.source, settings, performance.now(), { scale: plan.scale, performanceMode: false });
      await downloadPng(exportCanvas);
      toast(`png exported · ${plan.width.toLocaleString()} × ${plan.height.toLocaleString()} px`);
    } catch (error) {
      console.error(error); toast(error.message || "png export failed");
    } finally {
      exportCanvas.width = 1; exportCanvas.height = 1;
      button.disabled = false; label.textContent = previousLabel;
    }
  });
  byId("recordWebm").addEventListener("click", async () => {
    if (!media.source || mediaKind !== "video") return;
    recorder = new WebmRecorder(outputCanvas, media.source, {
      onProgress(progress) { byId("recordingBar").value = progress; byId("recordingLabel").textContent = `recording… ${Math.round(progress * 100)}%`; },
      onState(active) { byId("recordingProgress").hidden = !active; byId("recordWebm").disabled = active; if (!active) recorder = null; }
    });
    try { await recorder.start(); } catch (error) { toast(error.message); recorder = null; }
  });
  byId("stopRecording").addEventListener("click", () => recorder?.stop());
}

buildCharsets(); buildPalettes(); paletteEditor.setStops(settings.palette);
wireControls(); wireInput(); wireLayout(); wireExports(); wireLocalPresets(); setVideoControls(false);
document.fonts?.ready.then(() => requestRender());
media.loadDemo("assets/demo.svg");
