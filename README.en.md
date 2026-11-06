# dsh-comfyui-studio

[![npm](https://img.shields.io/npm/v/dsh-comfyui-studio.svg)](https://www.npmjs.com/package/dsh-comfyui-studio)

ComfyUI studio plugin for [DeepSeek Harness](https://github.com/xingyeai23/dsh-comfyui-studio): manage saved ComfyUI workflows, prompts, LoRAs and generated images from a DSH sidebar panel.

## Features

- Sidebar entry with saved workflow picker, prompt box and AI rewrite (tags/natural language based on the checkpoint).
- Live VRAM/RAM/queue cards and a real WebSocket queue progress bar.
- LoRA quick-edit card: pick the LoRA file, adjust model/CLIP strength, or bypass the LoRA node without opening the graph.
- Built-in node editor: slide-up canvas, typed nodes, right-click add/edit/bypass/delete, node inspector, save back to ComfyUI `workflows/`.
- Optional **native canvas**: embeds the official ComfyUI web UI in the same sheet (falls back to "open in new window" when iframes are blocked).
- Full-screen lightbox with prev/next, download, clipboard copy, delete from results, and the generation seed with one-click copy.
- Bilingual UI (Chinese/English), keyboard shortcuts and `prefers-reduced-motion` support.

## Install

1. DSH → Plugins → Discover → Add index source:
   `https://raw.githubusercontent.com/xingyeai23/dsh-comfyui-studio/main/plugin-index.json`
2. Install "ComfyUI Studio" and refresh the page (⌘R).

Or install from source with `plugin_manager` (`install_bundle`, target = this repository).

## Requirements and configuration

- DeepSeek Harness `>=0.2.2-rc.1`, Node.js `>=20.3`.
- ComfyUI reachable over HTTP (tested with ComfyUI 0.44); default base URL is `http://127.0.0.1:8188`.
- Override `baseUrl` in your DSH profile `cordis.patch.yml` for a LAN/remote server:

```yaml
- id: comfyui-panel
  config:
    baseUrl: http://192.168.1.10:8188
```

The panel deliberately has no in-app address field; the profile is the single source of truth.

## Privacy

No telemetry and no uploads. The plugin talks to your ComfyUI through the local DSH Host; AI rewrite/translation sends the prompt to the model provider configured in your DSH profile. The embedded native canvas is ComfyUI's own web UI, so its plugins/errors belong to ComfyUI.

## Development

```bash
node --check lib/client.js
node --test test/*.test.mjs
node scripts/verify.mjs
```

## License

MIT. This is a community plugin, not an official ComfyUI or DeepSeek Harness project.
