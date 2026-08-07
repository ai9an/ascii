const STORAGE_KEY = "ascii-local-presets-v1";
const MAX_PRESETS = 20;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `preset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class PresetStore {
  list() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const presets = JSON.parse(raw);
      return Array.isArray(presets)
        ? presets.filter((preset) => preset?.id && preset?.name && preset?.settings).slice(0, MAX_PRESETS)
        : [];
    } catch {
      return [];
    }
  }

  get(id) {
    return this.list().find((preset) => preset.id === id) || null;
  }

  save(name, settings) {
    const normalizedName = name.trim().toLowerCase().slice(0, 32);
    if (!normalizedName) throw new Error("name your preset first");
    const presets = this.list();
    const existing = presets.find((preset) => preset.name.toLowerCase() === normalizedName);
    const now = Date.now();
    const saved = existing || { id: createId(), createdAt: now };
    saved.name = normalizedName;
    saved.updatedAt = now;
    saved.settings = clone(settings);
    const next = [saved, ...presets.filter((preset) => preset.id !== saved.id)].slice(0, MAX_PRESETS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return saved;
  }

  remove(id) {
    const next = this.list().filter((preset) => preset.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
}
