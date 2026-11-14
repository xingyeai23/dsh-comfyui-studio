# Changelog

## 0.3.8 - 2026-11-14

- 修复部分 widget 被连线时 `widgets_values` 索引错位，避免 `batch_size` 被分辨率值污染导致 OOM。
- 支持 `extensions.seed_widgets`，seed 后的控制值不再错位到后续 widget。
- 工作流列表会显示视频、子图或解析失败的工作流及原因，不再静默隐藏。

## 0.3.7 - 2026-11-12

- 发布流程：npm 可见性与索引同步独立重试；元数据延迟不再跳过 GitHub Release，索引同步失败会给出修复路径。
- 新增可手动执行的 **Repair plugin index** workflow，用于发布后修复索引。
- `plugin-index.json` 现在列出所有带 `dsh.bundle` 的已发布版本，按新到旧排列，市场可回退旧版本。
- 编辑器：先完成 fit 再挂载节点图，并以淡入代替空白画布上的突然出现。
- 预览：修复退场淡出选择器，打开时背景模糊立即生效。

## 0.3.6 - 2026-11-11

- 前端现代化重写：原生 `<dialog>` 全屏预览（top-layer / 焦点管理）、`field-sizing` 提示词输入框、容器查询布局、浏览器主题集成和 IME 安全地址输入。
- 扩展 DSH 发现关键词（stable-diffusion、sdxl、flux、anima、noobai、prompt、node-editor、workflow-editor、local-ai）。
- 首次连接页增加局域网扫描。
- 发布自动化：npm provenance、tarball dry-run 与干净安装检查、插件索引同步和 GitHub Release。
- Windows 暂时隐藏原生画布入口。

## 0.3.5 - 2026-11-08

- 移除原生画布工具栏里重复的「收起」按钮和状态，标题行保留唯一收起操作。

## 0.3.4 - 2026-11-08

- Windows 桌面版暂时隐藏原生画布入口；macOS 与 DSH Web 保留内嵌 ComfyUI 画布。
- 通过 GitHub Actions trusted publishing 发布，并带 npm provenance。

## 0.3.3 - 2026-11-08

- 修复从原生画布切回内置画布后鼠标滚轮缩放失效。
- Windows 也应用桌面标题栏避让，编辑器工具栏不再和窗口按钮重叠。
- 桌面端保留 ComfyUI 原生 iframe；空白通常是配置地址不可达或页面被 ComfyUI 自身拦截。

## 0.3.2 - 2026-11-08

- 首次连接页增加「扫描局域网」按钮，找到的 ComfyUI 服务可以一键选择。
- 重连过程中重试按钮保持稳定。
- 修正首次使用示例：ComfyUI Desktop 和 Windows 便携版默认端口都是 8188（移除 8000 的说法）。

## 0.3.1 - 2026-11-07

- 文档：README 更短，聚焦安装与首次使用，附截图；API / 设计 / 排障 / 模型文档拆分到 `docs/`。
- 服务离线时显示居中的「ComfyUI 未连接」状态，带地址、重试/打开按钮和 5 秒自动重连，而不是空白面板。
- 面板增加错误边界，渲染异常时显示可读信息，而不是白屏。

## 0.3.0 - 2026-11-07

首个公开版本。

- 侧栏面板：已保存的 ComfyUI 工作流、提示词、LoRA 快捷编辑、VRAM/RAM/队列实时卡片和队列进度。
- 内置上滑节点编辑器：添加/编辑/绕过/删除节点、节点检查器、按类型生成配色、保存回 ComfyUI。
- 可选原生画布，内嵌 ComfyUI 官方网页 UI。
- 全屏结果预览：下载、复制、删除，以及从 ComfyUI 历史恢复的生成种子和一键复制。
- 基于 checkpoint 的 AI 改写与中文参考翻译；中英双语界面。
