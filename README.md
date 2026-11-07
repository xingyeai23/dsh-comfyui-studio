# dsh-comfyui-studio

[![npm](https://img.shields.io/npm/v/dsh-comfyui-studio.svg)](https://www.npmjs.com/package/dsh-comfyui-studio) [![CI](https://github.com/xingyeai23/dsh-comfyui-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/xingyeai23/dsh-comfyui-studio/actions/workflows/ci.yml)

带**左侧栏入口**的 DeepSeek Harness 插件：把 ComfyUI 变成工作台式面板。

- **顶部**：服务状态 + 四张**等宽**实时卡片（显存/内存/队列/活动）；右上角是「中断生成 / 刷新 / 返回会话」
- **首次使用 / 离线状态**：ComfyUI 没安装或没启动时，整页显示安装引导：官方下载、Desktop/便携版安装教程、GitHub 链接，三步安装/启动/连接说明。**兼容 ComfyUI Desktop**：桌面版默认端口是 8000，便携版是 8188；面板会在本机默认地址 8188 连不上时自动探测 8000，也提供「本机 Desktop :8000」「本机便携版 :8188」快捷按钮、双端口「扫描局域网」和「监听 0.0.0.0 后用主机 IP 访问」的说明。地址可以直接在面板里填写并保存（存在浏览器本地，优先于 profile 默认值），每 5 秒自动重连。连上后如果还没有可用工作流，会提示先在 ComfyUI 里保存图片工作流，并提供打开 ComfyUI / 刷新按钮。
- **左侧**：已保存工作流的**下拉选择**、提示词、中文参考、**LoRA 快捷编辑**、参数；参数不再显示任何“推荐范围”小字
- **右侧**：结果大图预览、上一张/下一张、下载、历史缩略图；单击大图打开全屏预览（淡入 + 缩放动画），全屏里可上一张/下一张、下载、复制到剪贴板、从结果列表删除；左下角显示这张图的生成种子并可一键复制
- **编辑**：工作流卡片右上角的「编辑」会从底部滑出一块 ComfyUI 风格的节点画布；顶部可改名、删除工作流，右上角「保存」写回 ComfyUI 的 `workflows/`，随后画布向下收回主界面
- **中间**：可拖动的分隔条调左右宽度（键盘 ←/→ 也行），宽度会被记住
- **滚动条**：整个面板只保留左侧控制栏一条细滚动条；提示词框随内容自动增高（上限 240px），译文参考、缩略图、画布节点面板等区域不再显示滚动条
- **右下角**：固定的「生成」按钮 + 数量；数量不是下拉框，按住上下拖动（或 ↑/↓）调整，空闲时只有这两个控件，生成中/失败时才显示状态；只有右侧预览列预留按钮空间，左侧控制栏不再留整条空白
- **数值控件**：数字两侧是「‹ / ›」微调按钮，鼠标按住数字左右拖动即可连续调值；参数布局为步数/CFG、采样器/调度器，第三行左侧是种子（可随机/固定/递增/递减），右侧是「宽 × 高」合并的尺寸输入框
- **LoRA**：工作流里存在 LoRA 加载节点时，主界面会多出一张 LoRA 卡片：直接选文件、改模型/CLIP 强度，勾掉「启用」即可原地绕过该节点，不用进画布
- **提示词**：点「AI 转写」按模型自动转成标签 / 自然语言 / 标签+自然语言；点「译成中文」可把正向提示词完整翻成中文做参考（没有“生成时自动转写”开关）

## 工作流与生成

下拉框只列 ComfyUI `workflows/` 里的**图片输出、且不含子图**的工作流；视频工作流、`z_image_turbo` 这类子图工作流、内置模板都不会出现。

ComfyUI 保存的是前端图（`nodes` + `links` + 控件值），`/prompt` 只接受 API 图，Host 半边在提交前做同前端排队时的转换：

- 控件值按 `/object_info` 顺序映射，正确处理种子的 `control_after_generate`；
- 还原连线，跟随 Reroute / PrimitiveNode / bypass，跳过 muted 与 Note 等前端节点；
- 从 KSampler 反查正/负 CLIPTextEncode 与 EmptyLatentImage，得到可编辑参数；
- **资产检查**：把每个模型/下拉输入与服务端 `object_info` 列表比对，缺文件时弹窗给出具体文件与目标目录，并禁用生成；
- **提示词清理**：提示词里混入 A1111 参数堆时自动清掉，并把参考参数（步数/CFG/采样器/调度器/种子）恢复成默认值；A1111 的尺寸是放大后的最终尺寸，保留工作流潜空间尺寸并提示；
- **LoRA 标签**：`<lora:...>` 只在 A1111 导入器里会展开成节点；手写工作流里的标签只是文本，这里会移除并提示。

### anima 的官方参数（严格按模型文档）

参考文档：[Civitai · Anima](https://civitai.com/models/2458426/anima)（与 [HF anima_baseV10](https://huggingface.co/LyliaEngine/anima_baseV10) 相同）。官方要求：

- 分辨率 512²–1536²；**30–50 步**、**CFG 4–6**；默认采样器 **er_sde**（也可 euler_a、dpmpp_2m_sde_gpu）；
- 正向前缀：`masterpiece, best quality, score_7, safe, `；
- 负向提示词：`worst quality, low quality, score_1, score_2, score_3, artist name`。

面板对 `anima.json` 做了强制约束：正向提示词自动补官方前缀（替换掉通用 `masterpiece, best quality, absurdres.` 前缀），负向提示词固定为官方推荐且**不再显示**；工作流现有 30 步 / CFG 4 / er_sde / 1024×1080 均在官方范围内。模型文档链接会显示在工作流信息里。

> 如果服务端 VAE 列表里没有 `qwen_image_vae.safetensors`，anima 工作流会在资产检查里提示。把它放到 ComfyUI 主机的 `models/vae`（可从 [Comfy-Org/Qwen-Image_ComfyUI](https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI) 获取）后刷新即可。

### 工作流编辑画布

平时不显示工作流预览；点工作流卡片右上角的「编辑」，画布会像抽屉一样从底部向上展开（收起时向下收回，主界面随之露出），动画与面板其余过渡都遵循 `prefers-reduced-motion`。

- **顶部**：工作流名称可直接编辑（改文件名等于另存为新工作流）；「删除工作流」带二次确认；右上角「保存」把当前画布写回 ComfyUI 的 `workflows/<名称>.json`。有未保存修改时点「收起」会弹出居中确认框，可选「保存并收起 / 不保存 / 取消」。拖动节点只改变布局、不计入「未保存」；只有改控件值、加删节点/连线、改名或绕过节点才标记未保存，轻微拖动（≤2px）会自动吸回原位。
- **使用教程**：第一次打开画布会自动弹出居中的使用教程（含内嵌 ComfyUI 网页的说明），关掉后不再自动出现；工具栏的「使用教程」按钮可随时再打开。
- **画布**：节点按 ComfyUI 前端坐标绘制，拖动节点移动、拖动空白处平移、滚轮以光标为中心缩放；「适应画布」一键铺满。展开/收起只做 transform 合成，并且等抽屉滑入完成后再挂载节点，避免掉帧。macOS 上标题栏会给窗口红绿灯留出 48px 顶部空间，不再重叠。
- **原生画布**：工具栏「原生画布」可直接内嵌 ComfyUI 官方的完整 Web UI（ComfyUI 允许 iframe 嵌入），保存/加载全部在网页内完成，收起后主界面自动刷新工作流列表；再点「内置画布」切回这里的简化画布。选择会被记住；若内嵌区域空白（例如 DSH 以 HTTPS 打开而 ComfyUI 是 HTTP），可用旁边的「新窗口打开」。原生模式下只保留一行工具栏、不再叠加自己的标题行。
- **工具栏**：内置/原生两种画布共用同一套工具栏样式：按钮统一描边、分组用竖线分隔、右侧显示状态；原先工具栏后面的「拖动节点…」长提示已删除，全部说明都收进「使用教程」弹窗。内嵌网页里出现的报错/助手面板属于 ComfyUI 本身（在浏览器直接打开同样存在），可在网页内关掉助手面板或修复对应插件。
- **右键菜单**：空白处右键可「添加节点 / 适应画布」；节点上右键可「编辑节点 / 添加节点 / 绕过 / 删除节点」；连线上右键可删除连线。双击节点也会打开节点属性面板（标题、全部控件、输入输出、绕过/删除），在画布左侧任意位置点一下即可关闭属性面板。
- **LoRA 同步**：画布上绕过/启用 LoRA、修改 LoRA 文件与强度，会实时同步到主界面的 LoRA 卡片；主界面勾选/取消「启用」后再打开画布，节点也已经是相应的绕过状态。
- **节点**：按节点类型自动配色（工作流里存了自定义 `color`/`bgcolor` 时优先用工作流颜色），左侧有一条同色强调条；显示输入/输出端口和控件（数值、下拉、文本、种子 + 生成后行为），控件改动实时写入工作流；节点标题栏的 ⊘ 按钮可**绕过**该节点（等同 ComfyUI 画布的 Ctrl+B，绕过节点会变淡）；拖动右侧圆点到左侧圆点即可连线（类型不匹配会提示），点连线选中后按 Delete 删除；节点右上角 × 或 Delete 删除节点及其连线。
- **添加节点**：左侧「添加节点」打开按分类排序的节点面板，支持搜索；选中后按该节点的 `/object_info` 自动补齐输入、输出和默认控件值。
- **保存**：Host 侧把画布按 ComfyUI 用户工作流格式 POST 到 `/userdata/workflows/<名称>.json`，并失效工作流缓存；保存成功后主界面自动刷新并选中该工作流。

### LoRA 快捷编辑

工作流里存在 `LoraLoader` / `LoraLoaderModelOnly` 节点时，左侧会出现 LoRA 卡片（无需打开画布）：
- 下拉选择 LoRA 文件（选项来自 ComfyUI 的 `object_info`），不改文件名时保持原值；
- 「模型强度 / CLIP 强度」可直接拖动或输入；
- 取消「启用」会在提交时**绕过**该 LoRA 节点：后端把它的 MODEL/CLIP 输入直接接到下游，等效于 ComfyUI 画布的 Ctrl+B 绕过；
- 这些值随工作流保存在浏览器本地，并作为 `/generate` 的 `loras` 覆盖传给 Host。

### 参数

步数与 CFG、采样器与调度器各占一行；第三行左侧是**种子**（普通数字输入框，不再支持按住拖动调值；右侧是模式选择：随机/固定/递增/递减），右侧是**尺寸**：`宽 × 高` 两个数字框用 `×` 隔开。参数卡片下面不再有任何“官方建议范围”提示。

### 图片放大预览

单击右侧结果大图即可打开全屏预览：背景淡入模糊、图片轻微缩放入场，Esc 或点背景关闭，←/→ 切换上/下一张；左下角显示文件名和**本次生成的种子**，点「复制种子」即可复制到剪贴板（历史图片若没有记录种子则显示「—」）。
右下角「下载」保存原图，「复制」把图片转成 PNG 写进剪贴板（失败会提示），「删除」只从面板结果列表移除（不删除 ComfyUI 服务器上的文件）。

### 实时进度与显卡占用

生成时主面板顶部的「队列」卡片会显示 WebSocket 推送的真实进度条（`value/max` 百分比），空闲时回到队列计数。
「显卡」卡片显示**显存占用率**（大号百分比 + 一条进度条 + used/total 小字），不再显示被截断的显卡名；「内存」卡片同样是百分比 + 条 + used/total。
ComfyUI 标准 API 只暴露显存、不暴露 GPU 计算占用率，所以这里只有这一条占用条——不是“占用率”和“显存”两条数据共用一条。如果服务端安装了 ComfyUI-Crystools，它的 `crystools.monitor` 会提供真实 GPU 利用率，卡片会自动切换为「GPU 占用」。

### 中文参考

负向提示词不再出现在界面上。正向提示词下方有「中文参考」：点「译成中文」调用当前 profile 模型，把提示词**完整**翻译成中文只读展示，便于确认内容；提示词改动后会提示重新翻译。翻译的 token 预算按输入长度动态放大，长提示词也不会被截断。

## AI 提示词转写（按模型自动）

不再手动选择「标签 / 自然语言」。Host 根据当前工作流的 checkpoint/unet 名字判断模型类型：

| 模型类型 | 转写结果 |
| --- | --- |
| 标签模型（NoobAI / Illustrious / Anima / Pony / SDXL …） | 英文 danbooru 标签，保留权重与 `<lora:...>` |
| 自然语言模型（Flux / SD3 / Qwen-Image / Kolors …） | 一段润色英文 |
| 未知/多模态 | 第一行标签 + 第二行自然语言 |

面板会显示「转写：标签（按模型自动）」。转写和中文参考翻译都关闭模型思考（`reasoningEffort: off`），只消耗输出 token；不需要时关掉「生成时自动转写中文」。

## 安装

**方式 A：插件索引（推荐）**

1. 打开 DSH 侧栏「插件」→「发现」→「添加索引源」，填入：
   `https://raw.githubusercontent.com/xingyeai23/dsh-comfyui-studio/main/plugin-index.json`
2. 在索引里找到「ComfyUI 工作室」并安装；刷新页面（⌘R）后左侧栏出现「ComfyUI」入口。

**方式 B：本地源码**

由 agent 调用 `plugin_manager` 的 `install_bundle`，`target` 指向本仓库目录。刷新页面后出现入口；Host 代码改动需要重新安装 bundle（或重启 DSH），客户端代码刷新页面即可。
卸载：`plugin_manager` → `remove_bundle`，target 为 `dsh-comfyui-studio`。

**方式 C：npm**

包名 `dsh-comfyui-studio`，已发布到 npm：`https://www.npmjs.com/package/dsh-comfyui-studio`。插件索引使用 npm 来源，`install_bundle` 的 `target` 为 `dsh-comfyui-studio@<version>`；也可以直接 `npm i dsh-comfyui-studio` 查看包内容。

## 配置

默认连接本机 `http://127.0.0.1:8188`。连接局域网/远程 ComfyUI 时，在 profile 的 `cordis.patch.yml` 里按 id 覆盖：

```yaml
- id: comfyui-panel
  config:
    baseUrl: http://192.168.1.10:8188   # 改成你的 ComfyUI 地址
    discoveryPort: 8188
    requestTimeoutMs: 8000
    llmProvider: ''
    llmModel: ''
    rewriteMaxTokens: 800
    rewriteReasoningEffort: off
```

首次使用时可以直接在离线引导里填写地址并「保存并连接」（保存在浏览器 `localStorage`，优先于 profile 默认值），也可以点「扫描局域网」自动发现。需要给所有用户改默认地址时，才改 profile 的 `baseUrl`；改完配置需要重载插件（插件页关/开）或重启 DSH。

每个工作流的提示词/参数与左右栏宽度存在浏览器 `localStorage`（`dsh-comfyui-studio:v2`）。

## 兼容性

- DeepSeek Harness：`>=0.2.2-rc.1`（`package.json` 的 `engines.dsh`），Node.js `>=20.3`。
- ComfyUI：在 ComfyUI 0.44 上验证；依赖标准 `/system_stats`、`/object_info`、`/history`、`/userdata/workflows` 与 `/ws`。
- 平台：macOS / Windows / Linux；DSH 桌面与 Web 均可（Web 端通过 Host 代理访问 ComfyUI）。
- 原生画布（内嵌 ComfyUI 网页）需要浏览器允许 iframe；若 DSH 以 HTTPS 访问而 ComfyUI 是 HTTP，浏览器会拦截混合内容，请用「新窗口打开」。

## 安全与隐私

- 插件不收集遥测，也不上传生成结果；面板只通过本机 Host 访问你配置的 ComfyUI。
- AI 转写/翻译会把提示词发送给当前 profile 配置的模型 provider；不需要时可在参数区关掉自动转写，或完全不用 AI 功能。
- 内嵌的原生画布是 ComfyUI 自己的网页，它的登录、插件和报错由 ComfyUI 及其扩展负责。
- Host 路由只接受同源请求，并校验 `base`、工作流名与图片坐标；图片经 Host 代理读取，插件本身不保存 ComfyUI 凭据。

## 开发与测试

```bash
node --check lib/client.js
node --test test/*.test.mjs
node scripts/verify.mjs
```

CI 在 Node 20/22/24 上运行同一组测试。发布新版本前更新 `CHANGELOG.md` 与 `package.json` 版本号，再打 tag。

## License

MIT，见 [LICENSE](LICENSE)。

## HTTP 路由（Host 半边）

同源、JSON、`cache-control: no-store`；带 `Origin` 时必须同源。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/comfyui-panel/health` | 存活探针 |
| GET | `/comfyui-panel/config` | 默认地址、扫描端口、版本 |
| GET | `/comfyui-panel/live?base=` | 实时 system_stats + 队列 + WebSocket 进度（顶部每 1s） |
| GET | `/comfyui-panel/state?base=` | 服务 + 模型 + 队列 + 最近 12 张结果 |
| GET | `/comfyui-panel/workflows?base=` | 工作流列表 + supported/cleanup/missingAssets |
| GET | `/comfyui-panel/workflow?base=&name=` | 参数面 + `cleanup` / `missingAssets` / `modelKind` + 原始 `graph` |
| GET | `/comfyui-panel/object-info?base=&types=A,B` | 节点 `/object_info` 文档（编辑器控件与新增节点用） |
| GET | `/comfyui-panel/node-catalog?base=` | 精简节点目录（类型/显示名/分类） |
| POST | `/comfyui-panel/workflows/save` | `{base, name, graph}` 保存用户工作流 |
| POST | `/comfyui-panel/workflows/delete` | `{base, name}` 删除用户工作流 |
| POST | `/comfyui-panel/generate` | `{base, workflow, overrides}` |
| POST | `/comfyui-panel/rewrite` | `{text, kind:'tags'\|'natural'\|'both'\|'zh'}` |
| GET | `/comfyui-panel/job?base=&id=` | 任务状态 |
| GET | `/comfyui-panel/view?base=&filename=&subfolder=&type=` | 代理输出图片 |
| POST | `/comfyui-panel/interrupt` | 中断当前任务 |
| POST | `/comfyui-panel/queue/clear` | 清空排队 |
| POST | `/comfyui-panel/connect` | 探测地址（面板不使用，脚本可用） |
| GET | `/comfyui-panel/discover?port=` | 扫描局域网（面板不使用，脚本可用） |

## 验证

```bash
node --test test/*.test.mjs                              # 假 ComfyUI：转换、清理、资产检查、路由、编辑器、客户端首屏
node scripts/verify.mjs                                  # 语法 + 单测
node scripts/verify.mjs --live                           # 列出并转换真实工作流
node scripts/verify.mjs --live --generate CKNOOBmain.json  # 真实跑一张小图
node scripts/verify.mjs --rewrite "一只戴红围巾的白猫"       # 走已安装插件的 /rewrite
```

## 故障排查

| 现象 | 处理 |
| --- | --- |
| `anima.json` 显示「缺少或无效的模型/文件」 | 服务端缺 `qwen_image_vae.safetensors`。从 [Comfy-Org/Qwen-Image_ComfyUI](https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI) 下载 `split_files/vae/qwen_image_vae.safetensors`，放到 ComfyUI 主机的 `models/vae`，刷新即可（[anima 文档](https://civitai.com/models/2458426/anima) 也要求这个 VAE） |
| 下拉里没有某个工作流 | 只显示图片输出且不含子图的工作流；视频/子图/内置模板已隐藏 |
| 出图与参考图不一致 | 参考图可能用了 hires fix、Clip skip、ADetailer 或 LoRA；面板会提示清理与尺寸差异，缺失节点需在 ComfyUI 里补 |
| 提示词里的 `<lora:...>` 没效果 | ComfyUI 后端不解析文本 LoRA 标签；改用左侧 LoRA 卡片编辑加载节点，或直接在画布里加 `LoraLoader` 并连线 |
| 队列进度条不动 | 需要浏览器到 ComfyUI 的 WebSocket（Host 侧自动连接 `/ws`）；被防火墙拦截时仍会显示队列计数 |
| 警告/报错看不到 | 错误/警告会以右上角气泡提示；工作流区块的「N 条提示 / N 个问题」按钮可重新打开弹窗；生成完成不再弹提示 |
| 深色模式按钮看不清 | 主按钮用 `--dsw-alias-brand-primary` 背景 + `--dsw-alias-bg-base` 文字 |

## 设计要点

- **左侧栏席位**：`sidebar.panellist`（id `comfyui-panel`）→ 宿主按 id 选中同名 `main` 键控席位。
- **无状态 Host**：`base` 随请求传入；工作流列表/转换按地址缓存。
- **安全**：固定上游路径、`base` 只允许 http/https 且不含凭据、工作流名与图片坐标校验、同源校验、请求体上限。
- **主题**：只用 `--dsw-alias-*` token；文字走 Client locale（内置中/英）。
- **清理**：路由、字典、轮询定时器、ObjectURL 随插件/组件卸载释放。

## 非目标

img2img/上传、子图工作流、视频输出预览、把 ComfyUI 网页嵌 iframe、agent 出图工具、多服务器管理；工作流编辑器只编辑节点/连线/控件和位置，不渲染 ComfyUI 的节点皮肤、分组框和 Note 样式。
