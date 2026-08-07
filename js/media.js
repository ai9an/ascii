const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/ogg"]);

export class MediaController {
  constructor({ onReady, onFrame, onError }) {
    this.onReady = onReady; this.onFrame = onFrame; this.onError = onError;
    this.source = null; this.kind = "image"; this.objectUrl = null; this.frameHandle = 0; this.loadToken = 0;
  }

  async loadDemo(path) {
    const token = ++this.loadToken;
    const image = new Image(); image.decoding = "async";
    image.onload = () => { if (token === this.loadToken) this.activate(image, "image", "asterion demo"); };
    image.onerror = () => { if (token === this.loadToken) this.onError("the bundled demo could not be loaded."); };
    image.src = path;
  }

  async loadFile(file) {
    if (!file) return;
    const token = ++this.loadToken;
    const extension = file.name.split(".").pop()?.toLowerCase();
    const type = IMAGE_TYPES.has(file.type) || ["png", "jpg", "jpeg", "webp", "gif"].includes(extension) ? "image"
      : VIDEO_TYPES.has(file.type) || ["mp4", "webm", "ogg", "ogv"].includes(extension) ? "video" : null;
    if (!type) { this.onError("unsupported file. choose a supported image or browser-native video."); return; }
    this.stopFrames();
    if (this.kind === "video") this.source?.pause?.();
    this.revokeObjectUrl();
    if (type === "image") {
      // createImageBitmap decodes a GIF into a stable first frame, matching the static-GIF
      // contract while avoiding animation timing differences between browser image elements.
      if ("createImageBitmap" in window) {
        try {
          const bitmap = await createImageBitmap(file);
          if (token !== this.loadToken) { bitmap.close(); return; }
          this.activate(bitmap, "image", file.name);
          return;
        } catch {
          // Some Safari/WebKit versions cannot create an ImageBitmap for every image codec.
          // The object-URL image path below remains the cross-browser fallback.
        }
      }
      if (token !== this.loadToken) return;
      this.objectUrl = URL.createObjectURL(file);
      const image = new Image(); image.decoding = "async";
      image.onload = () => { if (token === this.loadToken) this.activate(image, "image", file.name); };
      image.onerror = () => { if (token === this.loadToken) this.onError("this image could not be decoded by your browser."); };
      image.src = this.objectUrl;
      return;
    }
    this.objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true; video.loop = true; video.playsInline = true; video.preload = "auto";
    video.addEventListener("loadeddata", async () => {
      if (token !== this.loadToken) return;
      this.activate(video, "video", file.name);
      try { await video.play(); } catch { this.onError("press the preview to start video playback."); }
    }, { once: true });
    video.addEventListener("error", () => { if (token === this.loadToken) this.onError("this video codec is not supported by your browser."); }, { once: true });
    video.src = this.objectUrl; video.load();
  }

  activate(source, kind, name) {
    const previous = this.source;
    this.stopFrames();
    if (previous && previous !== source) previous.close?.();
    this.source = source; this.kind = kind;
    this.onReady({ source, kind, name });
    if (kind === "video") this.startFrames();
  }

  startFrames() {
    if (!this.source || this.kind !== "video") return;
    const tick = () => {
      if (!this.source.paused && !this.source.ended) this.onFrame(this.source);
      if ("requestVideoFrameCallback" in this.source) this.frameHandle = this.source.requestVideoFrameCallback(tick);
      else this.frameHandle = requestAnimationFrame(tick);
    };
    if ("requestVideoFrameCallback" in this.source) this.frameHandle = this.source.requestVideoFrameCallback(tick);
    else this.frameHandle = requestAnimationFrame(tick);
  }

  stopFrames() {
    if (!this.frameHandle || !this.source) return;
    if (this.kind === "video" && "cancelVideoFrameCallback" in this.source) this.source.cancelVideoFrameCallback(this.frameHandle);
    else cancelAnimationFrame(this.frameHandle);
    this.frameHandle = 0;
  }

  revokeObjectUrl() { if (this.objectUrl) URL.revokeObjectURL(this.objectUrl); this.objectUrl = null; }
}
