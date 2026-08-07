import { colorAt } from "./renderer.js";

export class PaletteEditor {
  constructor(track, onChange) {
    this.track = track;
    this.onChange = onChange;
    this.stops = [];
    this.dragIndex = -1; this.dragStop = null;
    window.addEventListener("pointermove", (event) => this.onPointerMove(event));
    window.addEventListener("pointerup", () => { this.dragIndex = -1; this.dragStop = null; });
  }

  setStops(stops, emit = false) {
    this.stops = stops.map((stop) => ({ ...stop })).sort((a, b) => a.position - b.position);
    this.render();
    if (emit) this.onChange(this.getStops());
  }

  getStops() { return this.stops.map((stop) => ({ ...stop })); }

  addStop() {
    if (this.stops.length >= 8) return;
    const position = .5;
    const sampled = colorAt(this.stops, position);
    const channels = sampled.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number) || [127, 127, 127];
    const color = `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
    this.stops.push({ position, color });
    this.stops.sort((a, b) => a.position - b.position);
    this.render(); this.onChange(this.getStops());
  }

  removeStop(index) {
    if (this.stops.length <= 2) return;
    this.stops.splice(index, 1); this.render(); this.onChange(this.getStops());
  }

  render() {
    const gradient = this.stops.map((stop) => `${stop.color} ${stop.position * 100}%`).join(", ");
    this.track.style.background = `linear-gradient(90deg, ${gradient})`;
    this.track.replaceChildren();
    this.stops.forEach((stop, index) => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "palette-stop";
      button.style.left = `${stop.position * 100}%`; button.style.background = stop.color;
      button.title = "drag to reposition · double-click to remove";
      button.addEventListener("pointerdown", (event) => { event.preventDefault(); this.dragIndex = index; this.dragStop = stop; button.setPointerCapture?.(event.pointerId); });
      button.addEventListener("dblclick", () => this.removeStop(index));
      button.addEventListener("click", () => this.pickColor(index));
      this.track.append(button);
    });
  }

  pickColor(index) {
    if (this.dragIndex >= 0) return;
    const picker = document.createElement("input");
    picker.type = "color"; picker.value = this.stops[index].color;
    picker.style.position = "fixed"; picker.style.opacity = "0";
    picker.addEventListener("input", () => { this.stops[index].color = picker.value; this.render(); this.onChange(this.getStops()); });
    picker.addEventListener("change", () => picker.remove());
    document.body.append(picker); picker.click();
  }

  onPointerMove(event) {
    if (this.dragIndex < 0) return;
    const bounds = this.track.getBoundingClientRect();
    this.dragStop.position = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    this.stops.sort((a, b) => a.position - b.position);
    this.dragIndex = this.stops.indexOf(this.dragStop);
    this.render(); this.onChange(this.getStops());
  }
}
