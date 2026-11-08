# Security Policy

## Supported versions

The latest `0.3.x` release receives fixes. Older releases may not receive security patches.

## Reporting a vulnerability

Please report suspected vulnerabilities through GitHub's **private vulnerability reporting**:

1. Open the repository's **Security** tab.
2. Choose **Report a vulnerability**.
3. Include the affected version, the DSH/ComfyUI versions, and a minimal reproduction if possible.

Do not open a public issue for a suspected vulnerability. Do not include ComfyUI API keys, DSH profile files, QQ bot credentials or other secrets in a report or screenshot.

## Scope and trust model

- The plugin talks to the ComfyUI server configured in the DSH profile through the local Host. It does not collect telemetry or upload generated images.
- AI rewrite and translation send the prompt to the model provider configured in the DSH profile.
- The embedded native ComfyUI canvas is ComfyUI's own web page; its plugins, authentication and errors are outside this plugin's control.
- The plugin does not store ComfyUI credentials.
