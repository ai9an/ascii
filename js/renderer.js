const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function rgbString(color) { return `rgb(${color.r | 0} ${color.g | 0} ${color.b | 0})`; }

function mixColor(a, b, amount) {
  const ca = typeof a === "string" ? hexToRgb(a) : a;
  const cb = typeof b === "string" ? hexToRgb(b) : b;
  return {
    r: ca.r + (cb.r - ca.r) * amount,
    g: ca.g + (cb.g - ca.g) * amount,
    b: ca.b + (cb.b - ca.b) * amount
  };
}

export function colorAt(stops, value) {
  const ordered = [...stops].sort((a, b) => a.position - b.position);
  const t = clamp(value);
  if (t <= ordered[0].position) return ordered[0].color;
  if (t >= ordered.at(-1).position) return ordered.at(-1).color;
  const rightIndex = ordered.findIndex((stop) => stop.position >= t);
  const left = ordered[rightIndex - 1];
  const right = ordered[rightIndex];
  const local = (t - left.position) / Math.max(.0001, right.position - left.position);
  return rgbString(mixColor(left.color, right.color, local));
}

function sourceDimensions(source) {
  return {
    width: source.videoWidth || source.naturalWidth || source.width || 1,
    height: source.videoHeight || source.naturalHeight || source.height || 1
  };
}

function adjustedLuminance(r, g, b, settings) {
  let value = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  value += settings.brightness / 100;
  const contrast = clamp(settings.contrast, -100, 100);
  const factor = (100 + contrast) / Math.max(1, 100 - contrast);
  value = (value - .5) * factor + .5;
  value = Math.pow(clamp(value), 1 / Math.max(.1, settings.gamma));
  if (settings.invert) value = 1 - value;
  return clamp(value);
}

function applyDithering(luminance, width, height, levels, mode) {
  if (mode === "none") return luminance;
  const values = Float32Array.from(luminance);
  if (mode === "ordered") {
    const matrix = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    const strength = 1 / Math.max(2, levels);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        values[index] = clamp(values[index] + ((matrix[y % 4][x % 4] / 16) - .5) * strength);
      }
    }
    return values;
  }
  const steps = Math.max(1, levels - 1);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const oldValue = clamp(values[index]);
      const nextValue = Math.round(oldValue * steps) / steps;
      const error = oldValue - nextValue;
      values[index] = nextValue;
      if (x + 1 < width) values[index + 1] += error * 7 / 16;
      if (y + 1 < height) {
        if (x > 0) values[index + width - 1] += error * 3 / 16;
        values[index + width] += error * 5 / 16;
        if (x + 1 < width) values[index + width + 1] += error / 16;
      }
    }
  }
  return values;
}

function resizeCanvas(canvas, width, height) {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

export class AsciiRenderer {
  constructor(outputCanvas) {
    this.canvas = outputCanvas;
    this.context = outputCanvas.getContext("2d", { alpha: true });
    this.sampleCanvas = document.createElement("canvas");
    this.sampleContext = this.sampleCanvas.getContext("2d", { willReadFrequently: true });
    this.sharpCanvas = document.createElement("canvas");
    this.sharpContext = this.sharpCanvas.getContext("2d");
    this.glowCanvas = document.createElement("canvas");
    this.glowContext = this.glowCanvas.getContext("2d");
    this.lastFrame = null;
  }

  render(source, settings, time = performance.now()) {
    const started = performance.now();
    const dimensions = sourceDimensions(source);
    const columns = Math.max(16, Math.round(settings.columns * (settings.performanceMode ? .55 : 1)));
    const fontSize = settings.fontSize;
    const cellWidth = Math.max(2, fontSize * .615 + settings.letterSpacing);
    const cellHeight = Math.max(fontSize * .75, fontSize * settings.lineHeight);

    // A monospace glyph cell is much taller than it is wide. Rows are derived from the
    // rendered cell dimensions (not simply source pixels) so the final canvas preserves
    // the source aspect ratio instead of stretching the artwork vertically.
    const rows = Math.max(4, Math.round((dimensions.height / dimensions.width) * (columns * cellWidth) / cellHeight));
    const width = Math.max(1, Math.ceil(columns * cellWidth));
    const height = Math.max(1, Math.ceil(rows * cellHeight));
    resizeCanvas(this.sampleCanvas, columns, rows);
    resizeCanvas(this.canvas, width, height);
    resizeCanvas(this.sharpCanvas, width, height);
    resizeCanvas(this.glowCanvas, width, height);

    this.sampleContext.clearRect(0, 0, columns, rows);
    this.sampleContext.drawImage(source, 0, 0, columns, rows);
    const pixels = this.sampleContext.getImageData(0, 0, columns, rows).data;
    const ramp = Array.from(settings.charset || " .#");
    if (settings.reverseRamp) ramp.reverse();
    const luma = new Float32Array(columns * rows);
    for (let index = 0; index < luma.length; index += 1) {
      const pixel = index * 4;
      luma[index] = adjustedLuminance(pixels[pixel], pixels[pixel + 1], pixels[pixel + 2], settings);
    }
    const mappedLuma = applyDithering(luma, columns, rows, ramp.length, settings.dithering);

    const sharp = this.sharpContext;
    const glow = this.glowContext;
    sharp.clearRect(0, 0, width, height);
    glow.clearRect(0, 0, width, height);
    const font = `${fontSize}px "IBM Plex Mono", "Apple Color Emoji", monospace`;
    sharp.font = font; glow.font = font;
    sharp.textBaseline = "top"; glow.textBaseline = "top";
    const lines = [];

    for (let y = 0; y < rows; y += 1) {
      let line = "";
      for (let x = 0; x < columns; x += 1) {
        const index = y * columns + x;
        const pixel = index * 4;
        const value = clamp(mappedLuma[index]);
        const glyph = ramp[Math.min(ramp.length - 1, Math.round(value * (ramp.length - 1)))] || " ";
        line += glyph;
        let glyphColor;
        if (settings.colorMode === "original") {
          glyphColor = `rgb(${pixels[pixel]} ${pixels[pixel + 1]} ${pixels[pixel + 2]})`;
        } else if (settings.colorMode === "solid") {
          glyphColor = settings.solidColor;
        } else if (settings.colorMode === "palette") {
          const paletteValue = settings.paletteMapping === "horizontal" ? x / Math.max(1, columns - 1)
            : settings.paletteMapping === "vertical" ? y / Math.max(1, rows - 1) : value;
          glyphColor = colorAt(settings.palette, paletteValue);
        } else {
          glyphColor = settings.monoColor;
        }
        const drawX = x * cellWidth;
        const drawY = y * cellHeight - fontSize * .04;
        sharp.fillStyle = glyphColor;
        sharp.fillText(glyph, drawX, drawY);
        if (settings.glowEnabled && (settings.glowApplication === "all" || value >= .68)) {
          glow.fillStyle = settings.glowColorMode === "custom" ? settings.glowColor : glyphColor;
          glow.fillText(glyph, drawX, drawY);
        }
      }
      lines.push(line);
    }

    const context = this.context;
    context.clearRect(0, 0, width, height);
    if (settings.backgroundMode === "solid") {
      context.fillStyle = settings.backgroundColor;
      context.fillRect(0, 0, width, height);
    } else if (settings.backgroundMode === "gradient") {
      const gradient = context.createLinearGradient(0, 0, width, height);
      settings.palette.forEach((stop) => {
        gradient.addColorStop(stop.position, rgbString(mixColor(stop.color, "#02040a", .78)));
      });
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    }
    if (settings.glowEnabled && settings.glowIntensity > 0 && settings.glowBlur > 0) {
      const pulse = settings.glowPulse ? .86 + Math.sin(time / 760) * .14 : 1;
      // Bloom is built by compositing two blurred duplicates behind the sharp layer.
      // This retains a crisp glyph core and avoids the muddy result of text shadowBlur.
      context.save();
      context.globalCompositeOperation = "lighter";
      context.filter = `blur(${Math.max(1, settings.glowBlur * .52)}px)`;
      context.globalAlpha = settings.glowIntensity * pulse * .7;
      context.drawImage(this.glowCanvas, 0, 0);
      context.filter = `blur(${Math.max(2, settings.glowBlur * 1.35)}px)`;
      context.globalAlpha = settings.glowIntensity * pulse * .33;
      context.drawImage(this.glowCanvas, 0, 0);
      context.restore();
    }
    context.drawImage(this.sharpCanvas, 0, 0);

    this.lastFrame = {
      text: lines.join("\n"), columns, rows, glyphs: columns * rows,
      width, height, duration: performance.now() - started
    };
    return this.lastFrame;
  }
}
