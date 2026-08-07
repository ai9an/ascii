# ascii

a premium, client-side ascii art studio for images and browser-native video. everything is processed locally in the browser at [ascii.ai9an.com](https://ascii.ai9an.com/).

## features

- live image and video-to-ascii rendering
- custom character ramps, palettes, bloom, adjustments, and dithering
- local browser presets
- source, render, and comparison views
- txt, png, clipboard, and supported webm exports
- no backend, accounts, uploads, or build step

## previews

<table>
  <tr>
    <th>source</th>
    <th>ascii</th>
  </tr>
  <tr>
    <td><img src="previews/blackhole.png" alt="black hole source" width="420"></td>
    <td><img src="previews/blackhole-ascii.png" alt="black hole ascii result" width="420"></td>
  </tr>
  <tr>
    <td><img src="previews/planet.jpg" alt="planet source" width="300"></td>
    <td><img src="previews/planet-transparent-ascii.png" alt="planet ascii result" width="300"></td>
  </tr>
  <tr>
    <td><img src="previews/portrait.jpg" alt="portrait source" width="300"></td>
    <td><img src="previews/portrait-ascii.png" alt="portrait ascii result" width="300"></td>
  </tr>
  <tr>
    <td><img src="previews/thing-poster.jpg" alt="the thing poster source" width="300"></td>
    <td><img src="previews/thing-poster-ascii.png" alt="the thing poster ascii result" width="300"></td>
  </tr>
</table>

## run locally

```bash
python3 -m http.server 8000
```

open `http://localhost:8000`. modern chromium, firefox, and safari are supported; webm recording availability depends on the browser and codec support.
