# Changelog

## 0.3.8 - 2026-11-14

- Fix `widgets_values` alignment when some widgets are linked: linked width/height no longer shift `batch_size` (which could trigger CUDA OOM).
- Support `extensions.seed_widgets` and seed control values so video/custom nodes keep their following widget values aligned.
- Show unsupported workflows in the picker instead of dropping them silently, with reasons in the tooltip and details dialog.

## 0.3.7 - 2026-11-12

- Release: npm visibility and index sync retry independently; a metadata delay no longer skips the GitHub Release, and a failed index sync is surfaced with a repair path.
- Add a manually runnable **Repair plugin index** workflow for post-publish recovery.
- `plugin-index.json` now lists every published version that declares `dsh.bundle`, newest first, so the market can offer older versions for rollback.
- Editor: fit the view before mounting the node graph and fade the graph in instead of popping it onto a blank canvas.
- Preview: fix the exit fade selector and show the backdrop blur immediately on open.

## 0.3.6 - 2026-11-11

- Modernize the client frontend: native `<dialog>` lightbox with top-layer/focus handling, `field-sizing` prompt textarea, container-query panel layout, browser theme integration and IME-safe address entry.
- Expand DSH discovery keywords (stable-diffusion, sdxl, flux, anima, noobai, prompt, node-editor, workflow-editor, local-ai).
- Add LAN scanning to the first-run connection screen.
- Automate releases: npm provenance, tarball dry-run and clean install checks, plugin-index sync and GitHub Release.
- Keep the Windows native-canvas entry hidden for now.

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
