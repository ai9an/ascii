function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text, filename = "ascii-signal.txt") {
  downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), filename);
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const area = document.createElement("textarea"); area.value = text; area.style.position = "fixed"; area.style.opacity = "0";
  document.body.append(area); area.select(); document.execCommand("copy"); area.remove();
}

export function downloadPng(canvas, filename = "ascii-signal.png") {
  canvas.toBlob((blob) => { if (blob) downloadBlob(blob, filename); }, "image/png");
}

export function supportedWebmType() {
  if (!("MediaRecorder" in window) || !HTMLCanvasElement.prototype.captureStream) return "";
  return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

export class WebmRecorder {
  constructor(canvas, video, { onProgress, onState }) {
    this.canvas = canvas; this.video = video; this.onProgress = onProgress; this.onState = onState;
    this.recorder = null; this.stream = null; this.chunks = []; this.timer = 0; this.previous = null; this.cancelled = false;
  }

  async start() {
    const mimeType = supportedWebmType();
    if (!mimeType || !this.video) throw new Error("webm recording is unavailable in this browser.");
    this.previous = { time: this.video.currentTime, loop: this.video.loop, paused: this.video.paused };
    this.cancelled = false; this.chunks = [];
    this.stream = this.canvas.captureStream(24);
    this.recorder = new MediaRecorder(this.stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    this.recorder.addEventListener("dataavailable", (event) => { if (event.data.size) this.chunks.push(event.data); });
    this.recorder.addEventListener("stop", () => this.finish(mimeType), { once: true });
    this.video.loop = false; this.video.currentTime = 0;
    await new Promise((resolve) => this.video.addEventListener("seeked", resolve, { once: true }));
    this.recorder.start(500); await this.video.play(); this.onState(true);
    const update = () => {
      const progress = this.video.duration ? Math.min(1, this.video.currentTime / this.video.duration) : 0;
      this.onProgress(progress);
      if (this.recorder?.state === "recording") this.timer = requestAnimationFrame(update);
    };
    update();
    this.video.addEventListener("ended", () => this.stop(), { once: true });
  }

  stop(cancelled = false) {
    this.cancelled = cancelled;
    if (this.recorder?.state === "recording") this.recorder.stop();
  }

  finish(mimeType) {
    cancelAnimationFrame(this.timer);
    this.stream?.getTracks().forEach((track) => track.stop());
    if (!this.cancelled && this.chunks.length) downloadBlob(new Blob(this.chunks, { type: mimeType }), "ascii-signal.webm");
    if (this.previous) {
      this.video.loop = this.previous.loop; this.video.currentTime = this.previous.time;
      if (!this.previous.paused) this.video.play().catch(() => {});
    }
    this.onProgress(0); this.onState(false); this.recorder = null; this.stream = null;
  }
}
