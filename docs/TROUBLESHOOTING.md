# 故障排查

| 现象 | 处理 |
| --- | --- |
| `anima.json` 显示「缺少或无效的模型/文件」 | 服务端缺 `qwen_image_vae.safetensors`。从 [Comfy-Org/Qwen-Image_ComfyUI](https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI) 下载 `split_files/vae/qwen_image_vae.safetensors`，放到 ComfyUI 主机的 `models/vae`，刷新即可（[anima 文档](https://civitai.com/models/2458426/anima) 也要求这个 VAE） |
| 下拉里没有某个工作流 | 只显示图片输出且不含子图的工作流；视频工作流、子图工作流和内置模板不会出现 |
| 出图与参考图不一致 | 参考图可能用了 hires fix、Clip skip、ADetailer 或 LoRA；面板会提示清理与尺寸差异，缺失节点需在 ComfyUI 里补 |
| 提示词里的 `<lora:...>` 没效果 | ComfyUI 后端不解析文本 LoRA 标签；改用左侧 LoRA 卡片编辑加载节点，或直接在画布里加 `LoraLoader` 并连线 |
| 队列进度条不动 | 需要浏览器到 ComfyUI 的 WebSocket（Host 侧自动连接 `/ws`）；被防火墙拦截时仍会显示队列计数 |
| 警告 / 报错看不到 | 错误和警告会以右上角气泡提示；工作流区块的「N 条提示 / N 个问题」按钮可重新打开弹窗 |
| 深色模式按钮看不清 | 主按钮使用 `--dsw-alias-brand-primary` 背景和 `--dsw-alias-bg-base` 文字 |
| 面板连不上 ComfyUI | 确认 ComfyUI 已启动；地址和端口与实例一致；ComfyUI Desktop 在设置里检查监听地址；局域网访问需允许监听 |
| 原生画布空白 | DSH 以 HTTPS 打开而 ComfyUI 是 HTTP 时会被混合内容拦截；改用「新窗口打开」或让 ComfyUI 也走 HTTPS |
| 安装后左侧栏没有入口 | 确认插件已安装并刷新页面（⌘R）；Host 代码更新需要重载插件或重启 DSH |
