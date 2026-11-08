# Changelog

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
