# 模型说明

## anima

参考文档：[Civitai · Anima](https://civitai.com/models/2458426/anima)（与 [HF anima_baseV10](https://huggingface.co/LyliaEngine/anima_baseV10) 相同）。官方要求：

- 分辨率 512²–1536²；**30–50 步**、**CFG 4–6**；默认采样器 **er_sde**（也可 euler_a、dpmpp_2m_sde_gpu）；
- 正向前缀：`masterpiece, best quality, score_7, safe, `；
- 负向提示词：`worst quality, low quality, score_1, score_2, score_3, artist name`。

面板对 `anima.json` 做了约束：正向提示词自动补官方前缀，替换通用前缀；负向提示词固定为官方推荐，界面不展示。工作流现有的 30 步 / CFG 4 / er_sde / 1024×1080 都在官方范围内，模型文档链接会显示在工作流信息里。

如果服务端 VAE 列表里没有 `qwen_image_vae.safetensors`，anima 工作流会在资产检查里提示。把它放到 ComfyUI 主机的 `models/vae`（可从 [Comfy-Org/Qwen-Image_ComfyUI](https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI) 获取）后刷新即可。

## 模型类型判断

Host 根据当前工作流的 checkpoint / unet 名称判断模型类型，用于 AI 转写：

| 模型类型 | 转写结果 |
| --- | --- |
| 标签模型（NoobAI / Illustrious / Anima / Pony / SDXL …） | 英文 danbooru 标签，保留权重与 `<lora:...>` |
| 自然语言模型（Flux / SD3 / Qwen-Image / Kolors …） | 一段润色英文 |
| 未知 / 多模态 | 第一行标签 + 第二行自然语言 |
