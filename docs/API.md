# Host API 路由

面板的 Host 半边提供同源、JSON、`cache-control: no-store` 的 HTTP 路由；带 `Origin` 时必须同源。所有 `base` 参数都是 ComfyUI 地址，且只允许 http / https 且不含凭据。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/comfyui-panel/health` | 存活探针 |
| GET | `/comfyui-panel/config` | 默认地址、扫描端口、版本 |
| GET | `/comfyui-panel/live?base=` | 实时 system_stats + 队列 + WebSocket 进度（顶部每 1s） |
| GET | `/comfyui-panel/state?base=` | 服务 + 模型 + 队列 + 最近 12 张结果 |
| GET | `/comfyui-panel/workflows?base=` | 工作流列表 + supported / cleanup / missingAssets |
| GET | `/comfyui-panel/workflow?base=&name=` | 参数面 + `cleanup` / `missingAssets` / `modelKind` + 原始 `graph` |
| GET | `/comfyui-panel/object-info?base=&types=A,B` | 节点 `/object_info` 文档（编辑器控件与新增节点） |
| GET | `/comfyui-panel/node-catalog?base=` | 精简节点目录（类型 / 显示名 / 分类） |
| POST | `/comfyui-panel/workflows/save` | `{base, name, graph}` 保存用户工作流 |
| POST | `/comfyui-panel/workflows/delete` | `{base, name}` 删除用户工作流 |
| POST | `/comfyui-panel/generate` | `{base, workflow, overrides}` |
| POST | `/comfyui-panel/rewrite` | `{text, kind:'tags'\|'natural'\|'both'\|'zh'}` |
| GET | `/comfyui-panel/job?base=&id=` | 任务状态 |
| GET | `/comfyui-panel/view?base=&filename=&subfolder=&type=` | 代理输出图片 |
| POST | `/comfyui-panel/interrupt` | 中断当前任务 |
| POST | `/comfyui-panel/queue/clear` | 清空排队 |
| POST | `/comfyui-panel/connect` | 探测地址（脚本可用） |
| GET | `/comfyui-panel/discover?port=` | 扫描局域网（脚本可用） |

保存工作流时按 ComfyUI 用户工作流格式写到 `/userdata/workflows/<名称>.json`，并失效工作流缓存。
