# 设计说明

## 组件

- **Client 半边**：在 DSH 左侧栏注册 `sidebar.panellist` 入口（id `comfyui-panel`），并在 `main` 席位注册同名键控面板。
- **Host 半边**：提供 `/comfyui-panel/*` 同源路由；面板不直接连接 ComfyUI 的跨域接口。
- **无状态 Host**：`base` 随请求传入；工作流列表和转换结果按地址缓存。

## 数据流

1. Client 请求 `/config` 获取默认 ComfyUI 地址；
2. `/state`、`/live` 轮询服务状态、模型、队列和结果；
3. 选择工作流后请求 `/workflow`，把前端图转换成可编辑参数；
4. 生成时把参数 / LoRA 覆盖提交到 `/generate`，Host 转换并提交 `/prompt`；
5. 结果通过 `/view` 代理读取，图片经 ObjectURL 展示。

## 安全

- `base` 只允许 http / https，且不含凭据；
- 固定上游路径，工作流名和图片坐标做校验；
- 路由只接受同源请求，请求体有大小上限；
- 插件本身不保存 ComfyUI 凭据。

## 主题与清理

- 只使用 `--dsw-alias-*` 主题 token；文案走 Client locale（内置中 / 英）。
- 路由、字典、轮询定时器、ObjectURL 随插件 / 组件卸载释放。

## 边界

工作流编辑器编辑节点、连线、控件和位置，不渲染 ComfyUI 的节点皮肤、分组框和 Note 样式；视频工作流、子图工作流和 img2img 上传不在面板的直接生成范围内，但会在工作流列表中标记为不可用并显示原因，不再静默隐藏。
