# Changelog

## 0.3.5 - 2026-11-08

- Remove the duplicate "collapse" button and status from the native-canvas toolbar; the header keeps the single collapse action.

## 0.3.4 - 2026-11-08

- Hide the native-canvas entry on Windows desktop for now; it still loads unreliably there. macOS and DSH Web keep the embedded ComfyUI canvas.
- Release via GitHub Actions trusted publishing with npm provenance.

## 0.3.3 - 2026-11-08

- Fix canvas mouse-wheel zoom after switching back from the native canvas.
- Apply the desktop titlebar clearance on Windows as well, so the editor toolbar no longer overlaps the window controls.
- Keep the native ComfyUI iframe on desktop; a blank frame usually means the configured address is unreachable or the ComfyUI page is blocked by its own server.

## 0.3.2 - 2026-11-08

- Add a "Scan LAN" button to the first-run screen; found ComfyUI servers can be selected with one click.
- Keep the retry action buttons stable while reconnecting.
- Correct the first-run examples: ComfyUI Desktop and the Windows portable build both default to port 8188 (with 8000 references removed).

## 0.3.1 - 2026-11-07

- Docs: shorter README focused on install/first use, with screenshots; API/design/troubleshooting/model docs split into `docs/`.

- Show a centered "ComfyUI is not connected" state with the configured address, retry/open buttons and automatic 5-second reconnect instead of a blank panel when the server is offline.
- Wrap the panel in an error boundary so a render error shows a readable message instead of a white page.

## 0.3.0 - 2026-11-07

First public release.

- Sidebar panel with saved ComfyUI workflows, prompts, LoRA quick edit, live VRAM/RAM/queue cards and queue progress.
- Built-in slide-up node editor: add/edit/bypass/delete nodes, node inspector, generated-by-type colors, save back to ComfyUI.
- Optional native canvas embedding the official ComfyUI web UI.
- Full-screen result lightbox with download/copy/delete and generation seed (with one-click copy, recovered from ComfyUI history).
- AI rewrite and Chinese reference translation based on the checkpoint; bilingual UI.
