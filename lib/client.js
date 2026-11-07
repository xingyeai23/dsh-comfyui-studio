/**
 * dsh-comfyui-studio — Client (browser) half.
 *
 * Registers the left-sidebar entry (`sidebar.panellist`, id `comfyui-panel`) and
 * the main-column studio page (`main`, key `comfyui-panel`).
 *
 * Layout: live hardware/activity strip on top, saved-workflow + prompt /
 * parameter controls on the left, result preview on the right, and a draggable
 * splitter between them. All ComfyUI and AI traffic goes through the Host
 * half's same-origin `/comfyui-panel/*` routes.
 */
window.__ModuleLoader__.load({
  id: 'dsh-comfyui-studio',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const Fragment = React.Fragment;

    const NS = 'comfyui-panel';
    const PANEL_ID = 'comfyui-panel';
    const BASE = '/comfyui-panel';
    const STORAGE_KEY = 'dsh-comfyui-studio:v2';
    const LIVE_MS = 1000;
    const STATE_MS = 20000;
    const JOB_POLL_MS = 1200;
    const JOB_MISSING_GRACE_MS = 15000;
    const MIN_LEFT = 280;
    const MAX_LEFT = 680;
    const DEFAULT_LEFT = 372;

    const WORKFLOW_REFERENCES = {
      'anima.json': 'https://civitai.com/models/2458426/anima',
    };
    const COMFY_DOWNLOAD_URL = 'https://www.comfy.org/download';
    const COMFY_GUIDE_URL = 'https://docs.comfy.org/installation';
    const COMFY_DESKTOP_URL = 'https://docs.comfy.org/installation/desktop/overview';
    const COMFY_PORTABLE_URL = 'https://docs.comfy.org/installation/comfyui_portable_windows';
    const COMFY_GITHUB_URL = 'https://github.com/comfyanonymous/ComfyUI';

    const DEFAULT_FORM = {
      positive: '',
      negative: '',
      steps: 20,
      cfg: 8,
      seed: 424242,
      seedControl: 'randomize',
      sampler: 'euler',
      scheduler: 'normal',
      width: 512,
      height: 512,
      batchSize: 1,
    };

    const SEED_CONTROL_VALUES = ['randomize', 'fixed', 'increment', 'decrement'];
    const LORA_TYPES = ['LoraLoader', 'LoraLoaderModelOnly'];
    const NODE_ACCENTS = ['#5b8def', '#3fb6a8', '#a78bfa', '#e8a25c', '#4ecb8d', '#e0709a', '#4fc3f7', '#c084fc', '#f2c94c', '#7bd389'];


    const zh = {
      'panel.title': 'ComfyUI',
      'status.loading': '连接中…',
      'status.online': '在线',
      'status.offline': '离线',
      'actions.back': '返回会话',
      'actions.refresh': '刷新',
      'actions.generate': '生成',
      'actions.generating': '提交中…',
      'actions.interrupt': '中断生成',
      'actions.interrupting': '中断中…',
      'actions.reset': '恢复默认参数',
      'actions.rewrite': 'AI 转写',
      'actions.rewriting': '转写中…',
      'actions.download': '下载',
      'actions.prev': '上一张',
      'actions.next': '下一张',
      'actions.refreshWorkflows': '刷新',
      'actions.decrease': '减小',
      'actions.increase': '增大',
      'actions.editWorkflow': '编辑',
      'lightbox.preview': '图片预览',
      'lightbox.count': '{index} / {total}',
      'lightbox.download': '下载',
      'lightbox.copy': '复制',
      'lightbox.copying': '复制中…',
      'lightbox.copied': '已复制到剪贴板',
      'lightbox.copyFailed': '复制失败：{message}',
      'lightbox.delete': '删除',
      'lightbox.deleted': '已从结果中移除',
      'lightbox.prev': '上一张',
      'lightbox.next': '下一张',
      'lightbox.close': '关闭',
      'lightbox.seed': '种子',
      'lightbox.seedUnknown': '—',
      'lightbox.copySeed': '复制种子',
      'lightbox.seedCopied': '种子已复制',
      'editor.title': '编辑工作流',
      'editor.name': '工作流名称',
      'editor.unsaved': '未保存',
      'editor.saved': '已保存',
      'editor.save': '保存',
      'editor.saving': '保存中…',
      'editor.close': '收起',
      'editor.deleteWorkflow': '删除工作流',
      'editor.delete': '删除',
      'editor.deleteConfirm': '删除工作流「{name}」？此操作不可撤销。',
      'editor.closeConfirm': '有未保存的修改，收起后修改会丢失。',
      'editor.discard': '放弃修改',
      'editor.cancel': '取消',
      'editor.addNode': '添加节点',
      'editor.fit': '适应画布',
      'editor.zoomIn': '放大',
      'editor.zoomOut': '缩小',
      'editor.searchNodes': '搜索节点…',
      'editor.nodeCount': '{count} 个节点',
      'editor.hint': '拖动节点 · 滚轮缩放 · 从右侧圆点拖到左侧圆点连线 · Delete 删除选中',
      'editor.loading': '正在读取节点定义…',
      'editor.loadFailed': '节点定义加载失败：{message}',
      'editor.emptyCatalog': '没有匹配的节点',
      'editor.saveFailed': '保存失败：{message}',
      'editor.deleteFailed': '删除失败：{message}',
      'editor.invalidName': '请输入有效的工作流名称',
      'editor.savedToast': '已保存工作流 {name}',
      'editor.deletedToast': '已删除工作流 {name}',
      'editor.deleteNode': '删除节点',
      'editor.deleteSelection': '删除选中',
      'editor.seedControl': '种子生成后行为',
      'editor.bypass': '绕过节点',
      'editor.bypassed': '已绕过',
      'editor.editNode': '编辑节点',
      'editor.deleteNode': '删除节点',
      'editor.deleteLink': '删除连线',
      'editor.properties': '节点属性',
      'editor.titleField': '节点标题',
      'editor.sockets': '输入 / 输出',
      'editor.saveAndClose': '保存并收起',
      'editor.discardAndClose': '不保存',
      'tutorial.button': '使用教程',
      'tutorial.title': '画布使用教程',
      'tutorial.start': '知道了，开始使用',
      'tutorial.close': '关闭',
      'tutorial.gesturesTitle': '画布操作',
      'tutorial.gestures': '拖动节点移动位置，拖动空白处平移，滚轮以光标为中心缩放；顶部「适应画布」一键铺满。',
      'tutorial.nodesTitle': '编辑与节点属性',
      'tutorial.nodes': '双击节点或右键「编辑节点」打开右侧属性面板，可直接改控件值（例如 LoRA 名称与强度）、改节点标题；节点标题栏的 ⊘ 可绕过该节点。',
      'tutorial.menuTitle': '右键菜单',
      'tutorial.menu': '空白处右键「添加节点」会在鼠标位置新建节点；节点右键可编辑/绕过/删除；连线右键可删除。选中后按 Delete 也能删除。',
      'tutorial.loraTitle': 'LoRA 同步',
      'tutorial.lora': '这里的 LoRA 绕过与主界面的 LoRA「启用」是同一份状态：画布上绕过，主界面就取消启用，反之亦然。',
      'tutorial.saveTitle': '保存与收起',
      'tutorial.save': '右上角「保存」写回 ComfyUI 的 workflows 目录；有未保存修改时点「收起」会弹窗让你选择保存、不保存或取消。',
      'tutorial.nativeTitle': '内嵌 ComfyUI 网页',
      'tutorial.native': '工具栏「原生画布」可直接内嵌 ComfyUI 官方网页（完整画布与所有节点）；在里面保存的工作流会在收起画布后同步到主界面。',
      'editor.native': '原生画布',
      'editor.builtin': '内置画布',
      'editor.nativeTitle': 'ComfyUI 原生画布',
      'editor.nativeHint': '已内嵌 ComfyUI 官方网页：保存/加载都在网页内完成；收起画布后会刷新主界面的工作流列表。若网页空白，可用「新窗口打开」。',
      'editor.openExternal': '新窗口打开',
      'editor.connectionFailed': '这两个端口类型不匹配',
      'editor.connectionSelf': '不能把节点连到它自己',
      'node.CheckpointLoaderSimple': '加载模型',
      'node.UNETLoader': 'UNet 加载器',
      'node.CLIPLoader': 'CLIP 加载器',
      'node.VAELoader': 'VAE 加载器',
      'node.LoraLoader': 'LoRA 加载器',
      'node.CLIPTextEncode': '提示词编码',
      'node.KSampler': 'K 采样器',
      'node.EmptyLatentImage': '空 Latent',
      'node.VAEDecode': 'VAE 解码',
      'node.SaveImage': '保存图片',
      'node.PreviewImage': '预览图片',
      'section.workflows': '工作流',
      'section.prompt': '提示词',
      'section.params': '参数',
      'section.loras': 'LoRA',
      'section.preview': '预览',
      'lora.enabled': '启用',
      'lora.loading': '读取 LoRA 文件…',
      'lora.noFile': '没有匹配的 LoRA 文件',
      'field.loraModel': '模型强度',
      'field.loraClip': 'CLIP 强度',
      'field.size': '尺寸',
      'seed.randomize': '随机',
      'seed.fixed': '固定',
      'seed.increment': '递增',
      'seed.decrement': '递减',
      'field.checkpoint': '模型',
      'field.positive': '正向提示词',
      'field.negative': '负向提示词',
      'field.steps': '步数',
      'field.cfg': 'CFG',
      'field.seed': '种子',
      'field.random': '随机',
      'field.sampler': '采样器',
      'field.scheduler': '调度器',
      'field.width': '宽',
      'field.height': '高',
      'field.batch': '数量',
      'batch.dragHint': '按住上下拖动调整数量',
      'field.gpu': '显卡',
      'field.vram': '显存占用',
      'field.gpuUtil': 'GPU 占用',
      'field.ram': '内存',
      'field.queue': '队列',
      'field.activity': '活动',
      'field.model': '模型',
      'workflow.select': '选择工作流',
      'workflow.none': '没有可运行的图片工作流（workflows 目录为空或不支持）',
      'workflow.loading': '正在读取工作流…',
      'workflow.hint': '工作流来自 ComfyUI 的 workflows 目录；改动只影响本次生成。',
      'prompt.mode.tags': '标签',
      'prompt.mode.natural': '自然语言',
      'prompt.kind.tags': '标签（按模型自动）',
      'prompt.kind.natural': '自然语言（按模型自动）',
      'prompt.kind.both': '标签 + 自然语言（按模型自动）',
      'prompt.kindLabel': '转写：{kind}',
      'prompt.negativeFixed': '负向提示词已固定为模型官方推荐，不再显示。',
      'ref.title': '中文参考',
      'ref.action': '译成中文',
      'ref.busy': '翻译中…',
      'ref.empty': '点「译成中文」查看当前提示词的中文参考。',
      'ref.stale': '提示词已修改，可重新翻译。',
      'ref.emptyPrompt': '提示词为空。',
      'workflow.reference': '模型文档',
      'hint.steps': '官方默认 20 · 常用 20–30',
      'hint.cfg': '官方默认 8 · 常用 5–8',
      'hint.seed': '0 – 4294967295 · 可随机',
      'hint.sampler': '官方默认 euler · 常用 euler / euler_ancestral',
      'hint.scheduler': '官方默认 normal · 常用 normal / karras',
      'hint.width': 'SDXL 常用 832–1024 · 8 的倍数',
      'hint.height': 'SDXL 常用 1024–1216 · 8 的倍数',
      'hint.batch': '官方默认 1 · 常用 1–4',
      'actions.close': '关闭',
      'dialog.warnings': '提示',
      'dialog.reasons': '无法运行的原因',
      'workflow.problems': '{count} 个问题',
      'workflow.warningsCount': '{count} 条提示',
      'prompt.auto': '生成时自动转写中文',
      'prompt.aiHint': '点「AI 转写」把中文转成英文提示词；已有英文与 <lora:...> 会保留。',
      'prompt.placeholder.positive': '例如：一只戴红围巾的白猫坐在窗台，午后阳光，动漫风格',
      'prompt.placeholder.negative': '例如：低质量，模糊，水印',
      'prompt.rewriteEmpty': '先写点中文提示词再转写。',
      'prompt.rewriteDone': '已转写为英文提示词。',
      'params.reset': '已恢复工作流默认参数。',
      'preview.empty': '还没有图片。生成完成后会出现在这里。',
      'preview.noFile': '未选择图片',
      'preview.count': '第 {index} / {total} 张',
      'status.idle': '空闲',
      'value.none': '—',
      'value.used': '{used} / {total}',
      'value.queue': '运行 {running} · 排队 {pending}',
      'value.gpuUsage': '显存占用 {percent}% · {used} / {total}',
      'value.gpuUtil': 'GPU 占用 {percent}%',
      'value.vramInfo': '显存 {used} / {total}',
      'value.progress': '生成中 {percent}% · {value}/{max}',
      'value.percent': '{percent}%',
      'job.queued': '排队中…',
      'job.running': '生成中…',
      'job.completed': '生成完成',
      'job.error': '生成失败',
      'job.cancelled': '已中断',
      'job.elapsed': '已用 {time}',
      'job.position': '前面还有 {position} 个',
      'job.done': '生成完成，用时 {time}',
      'job.interrupted': '已请求中断',
      'job.lastDone': '最近完成 {time}',
      'banner.offline': '无法连接 ComfyUI：{message}',
      'banner.generate': '提交失败：{message}',
      'banner.rewrite': 'AI 转写失败：{message}',
      'banner.workflow': '工作流读取失败：{message}',
      'banner.workflows': '工作流列表读取失败：{message}',
      'banner.interrupt': '中断失败：{message}',
      'banner.image': '图片加载失败：{message}',
      'hint.offline': '确认 ComfyUI 已启动、地址与端口正确，且两台设备在同一局域网。',
      'offline.title': '还没有检测到 ComfyUI',
      'offline.desc': '请先安装并启动 ComfyUI；启动后这里会自动连接，不需要刷新页面。',
      'offline.connectingTitle': '正在连接 ComfyUI…',
      'offline.connectingDesc': '正在读取服务状态，请稍候。',
      'offline.configTitle': '正在读取 ComfyUI 配置…',
      'offline.configDesc': '插件 Host 还没有就绪。如果一直没有反应，请重新加载 ComfyUI 插件或重启 DSH。',
      'offline.address': '地址',
      'offline.saveAddress': '保存并连接',
      'offline.savedAddress': '地址已保存，正在连接…',
      'offline.invalidAddress': '地址格式不对，示例：http://192.168.1.10:8188',
      'offline.connectFailed': '连接失败，请确认 ComfyUI 已启动、地址和端口正确。',
      'offline.step1Title': '安装 ComfyUI',
      'offline.step1': '推荐 ComfyUI Desktop（官网下载，支持 Windows/macOS/Linux）；也可以下载 Windows 便携版。',
      'offline.step2Title': '启动服务',
      'offline.step2': 'Desktop：打开应用并启动实例；便携版：双击 run_nvidia_gpu.bat。默认端口都是 8188。',
      'offline.step3Title': '连接面板',
      'offline.step3': '本机填 127.0.0.1，局域网填主机 IP；端口以 ComfyUI 实例显示的地址为准。',
      'offline.download': '官网下载',
      'offline.desktopGuide': 'Desktop 教程',
      'offline.portableGuide': '便携版教程',
      'offline.github': 'GitHub',
      'workflow.emptyGuide': '第一次使用：在 ComfyUI 里搭建并保存一个图片工作流，然后点「刷新」。',
      'offline.copied': '地址已复制',
      'offline.retry': '立即重试',
      'offline.retrying': '正在连接…',
      'offline.open': '打开 ComfyUI 网页',
      'offline.error': '最近一次错误',
      'crash.title': 'ComfyUI 面板渲染出错',
      'crash.desc': '错误已被捕获。请刷新页面；如果反复出现，请把控制台报错反馈给插件作者。',
      'crash.reload': '刷新页面',
      'hint.selectWorkflow': '先选择一个工作流',
      'hint.noPromptNode': '该工作流没有可编辑的提示词节点。',
      'hint.notRunnable': '该工作流暂时不可运行，原因见上方。',
      'aria.panel': 'ComfyUI 工作室',
      'aria.preview': '生成结果预览',
      'aria.thumbs': '历史结果缩略图',
      'aria.workflowList': '工作流选择',
      'aria.progress': '生成进度',
      'aria.splitter': '调整左右面板宽度',
    };

    const en = {
      'panel.title': 'ComfyUI',
      'status.loading': 'Connecting…',
      'status.online': 'Online',
      'status.offline': 'Offline',
      'actions.back': 'Back to chat',
      'actions.refresh': 'Refresh',
      'actions.generate': 'Generate',
      'actions.generating': 'Submitting…',
      'actions.interrupt': 'Interrupt',
      'actions.interrupting': 'Interrupting…',
      'actions.reset': 'Reset to workflow defaults',
      'actions.rewrite': 'AI rewrite',
      'actions.rewriting': 'Rewriting…',
      'actions.download': 'Download',
      'actions.prev': 'Previous',
      'actions.next': 'Next',
      'actions.refreshWorkflows': 'Refresh',
      'actions.decrease': 'Decrease',
      'actions.increase': 'Increase',
      'actions.editWorkflow': 'Edit',
      'lightbox.preview': 'Image preview',
      'lightbox.count': '{index} / {total}',
      'lightbox.download': 'Download',
      'lightbox.copy': 'Copy',
      'lightbox.copying': 'Copying…',
      'lightbox.copied': 'Copied to clipboard',
      'lightbox.copyFailed': 'Copy failed: {message}',
      'lightbox.delete': 'Delete',
      'lightbox.deleted': 'Removed from results',
      'lightbox.prev': 'Previous',
      'lightbox.next': 'Next',
      'lightbox.close': 'Close',
      'lightbox.seed': 'Seed',
      'lightbox.seedUnknown': '—',
      'lightbox.copySeed': 'Copy seed',
      'lightbox.seedCopied': 'Seed copied',
      'editor.title': 'Edit workflow',
      'editor.name': 'Workflow name',
      'editor.unsaved': 'Unsaved',
      'editor.saved': 'Saved',
      'editor.save': 'Save',
      'editor.saving': 'Saving…',
      'editor.close': 'Collapse',
      'editor.deleteWorkflow': 'Delete workflow',
      'editor.delete': 'Delete',
      'editor.deleteConfirm': 'Delete workflow "{name}"? This cannot be undone.',
      'editor.closeConfirm': 'You have unsaved changes. Collapsing discards them.',
      'editor.discard': 'Discard',
      'editor.cancel': 'Cancel',
      'editor.addNode': 'Add node',
      'editor.fit': 'Fit view',
      'editor.zoomIn': 'Zoom in',
      'editor.zoomOut': 'Zoom out',
      'editor.searchNodes': 'Search nodes…',
      'editor.nodeCount': '{count} nodes',
      'editor.hint': 'Drag nodes · wheel to zoom · drag a right dot onto a left dot to connect · Delete removes the selection',
      'editor.loading': 'Loading node definitions…',
      'editor.loadFailed': 'Node definitions failed to load: {message}',
      'editor.emptyCatalog': 'No matching nodes',
      'editor.saveFailed': 'Save failed: {message}',
      'editor.deleteFailed': 'Delete failed: {message}',
      'editor.invalidName': 'Enter a valid workflow name',
      'editor.savedToast': 'Saved workflow {name}',
      'editor.deletedToast': 'Deleted workflow {name}',
      'editor.deleteNode': 'Delete node',
      'editor.deleteSelection': 'Delete selection',
      'editor.seedControl': 'Seed control after generate',
      'editor.bypass': 'Bypass node',
      'editor.bypassed': 'Bypassed',
      'editor.editNode': 'Edit node',
      'editor.deleteNode': 'Delete node',
      'editor.deleteLink': 'Delete link',
      'editor.properties': 'Node properties',
      'editor.titleField': 'Node title',
      'editor.sockets': 'Inputs / Outputs',
      'editor.saveAndClose': 'Save and collapse',
      'editor.discardAndClose': 'Discard',
      'tutorial.button': 'Tutorial',
      'tutorial.title': 'Canvas tutorial',
      'tutorial.start': 'Got it, start editing',
      'tutorial.close': 'Close',
      'tutorial.gesturesTitle': 'Canvas gestures',
      'tutorial.gestures': 'Drag a node to move it, drag empty space to pan, wheel to zoom around the cursor; "Fit view" frames everything.',
      'tutorial.nodesTitle': 'Node properties',
      'tutorial.nodes': 'Double-click a node (or right-click > Edit node) to open the properties panel: edit widget values such as the LoRA file and strengths, rename the node, and use ⊘ in the title bar to bypass it.',
      'tutorial.menuTitle': 'Right-click menu',
      'tutorial.menu': 'Right-click empty space to add a node at the cursor; right-click a node to edit/bypass/delete it; right-click a link to delete it. Delete also removes the selection.',
      'tutorial.loraTitle': 'LoRA stays in sync',
      'tutorial.lora': 'Bypassing a LoRA here and the LoRA card "Enabled" checkbox in the main panel share one state, in both directions.',
      'tutorial.saveTitle': 'Save and collapse',
      'tutorial.save': 'Save writes back to ComfyUI\'s workflows folder. Collapsing with unsaved changes asks whether to save, discard, or cancel.',
      'tutorial.nativeTitle': 'Embedded ComfyUI web UI',
      'tutorial.native': 'The "Native canvas" toolbar button embeds the official ComfyUI web UI with the full canvas. Workflows saved there show up in the panel after you collapse the sheet.',
      'editor.native': 'Native canvas',
      'editor.builtin': 'Built-in canvas',
      'editor.nativeTitle': 'ComfyUI native canvas',
      'editor.nativeHint': 'The official ComfyUI web UI is embedded: save and load there; collapsing the sheet refreshes the workflow list. If the frame is blank, use "Open in new window".',
      'editor.openExternal': 'Open in new window',
      'editor.connectionFailed': 'These port types do not match',
      'editor.connectionSelf': 'A node cannot connect to itself',
      'node.CheckpointLoaderSimple': 'Checkpoint',
      'node.UNETLoader': 'UNet loader',
      'node.CLIPLoader': 'CLIP loader',
      'node.VAELoader': 'VAE loader',
      'node.LoraLoader': 'LoRA loader',
      'node.CLIPTextEncode': 'Text encode',
      'node.KSampler': 'KSampler',
      'node.EmptyLatentImage': 'Empty latent',
      'node.VAEDecode': 'VAE decode',
      'node.SaveImage': 'Save image',
      'node.PreviewImage': 'Preview image',
      'section.workflows': 'Workflows',
      'section.prompt': 'Prompt',
      'section.params': 'Parameters',
      'section.loras': 'LoRA',
      'section.preview': 'Preview',
      'lora.enabled': 'Enabled',
      'lora.loading': 'Loading LoRA files…',
      'lora.noFile': 'No matching LoRA file',
      'field.loraModel': 'Model strength',
      'field.loraClip': 'CLIP strength',
      'field.size': 'Size',
      'seed.randomize': 'Random',
      'seed.fixed': 'Fixed',
      'seed.increment': 'Increment',
      'seed.decrement': 'Decrement',
      'field.checkpoint': 'Model',
      'field.positive': 'Prompt',
      'field.negative': 'Negative prompt',
      'field.steps': 'Steps',
      'field.cfg': 'CFG',
      'field.seed': 'Seed',
      'field.random': 'Random',
      'field.sampler': 'Sampler',
      'field.scheduler': 'Scheduler',
      'field.width': 'Width',
      'field.height': 'Height',
      'field.batch': 'Batch',
      'batch.dragHint': 'Drag up/down to change the batch count',
      'field.gpu': 'GPU',
      'field.vram': 'VRAM usage',
      'field.gpuUtil': 'GPU usage',
      'field.ram': 'RAM',
      'field.queue': 'Queue',
      'field.activity': 'Activity',
      'field.model': 'Model',
      'workflow.select': 'Select a workflow',
      'workflow.none': 'No runnable image workflow (the workflows folder is empty or unsupported).',
      'workflow.loading': 'Reading workflows…',
      'workflow.hint': 'Workflows come from ComfyUI\'s workflows folder; edits only affect this run.',
      'prompt.mode.tags': 'Tags',
      'prompt.mode.natural': 'Natural language',
      'prompt.kind.tags': 'Tags (auto by model)',
      'prompt.kind.natural': 'Natural language (auto by model)',
      'prompt.kind.both': 'Tags + natural language (auto by model)',
      'prompt.kindLabel': 'Rewrite: {kind}',
      'prompt.negativeFixed': 'Negative prompt is fixed to the model author\'s recommendation.',
      'ref.title': 'Chinese reference',
      'ref.action': 'Translate',
      'ref.busy': 'Translating…',
      'ref.empty': 'Press Translate to see a Chinese reference of the prompt.',
      'ref.stale': 'The prompt changed; translate again for an up-to-date reference.',
      'ref.emptyPrompt': 'The prompt is empty.',
      'workflow.reference': 'Model docs',
      'hint.steps': 'Official default 20 · usual 20–30',
      'hint.cfg': 'Official default 8 · usual 5–8',
      'hint.seed': '0 – 4294967295 · random allowed',
      'hint.sampler': 'Official default euler · usually euler / euler_ancestral',
      'hint.scheduler': 'Official default normal · usually normal / karras',
      'hint.width': 'SDXL usually 832–1024 · multiple of 8',
      'hint.height': 'SDXL usually 1024–1216 · multiple of 8',
      'hint.batch': 'Official default 1 · usually 1–4',
      'actions.close': 'Close',
      'dialog.warnings': 'Notes',
      'dialog.reasons': 'Why it cannot run',
      'workflow.problems': '{count} problem(s)',
      'workflow.warningsCount': '{count} note(s)',
      'prompt.auto': 'Auto-rewrite Chinese before generating',
      'prompt.aiHint': 'Press AI rewrite to turn Chinese into English; existing English and <lora:...> tokens are kept.',
      'prompt.placeholder.positive': 'e.g. a white cat with a red scarf on a windowsill, warm afternoon light, anime style',
      'prompt.placeholder.negative': 'e.g. lowres, blurry, watermark',
      'prompt.rewriteEmpty': 'Write some Chinese text before rewriting.',
      'prompt.rewriteDone': 'Rewritten into an English prompt.',
      'params.reset': 'Workflow defaults restored.',
      'preview.empty': 'No images yet. They appear here after a generation.',
      'preview.noFile': 'No image selected',
      'preview.count': '{index} / {total}',
      'status.idle': 'Idle',
      'value.none': '—',
      'value.used': '{used} / {total}',
      'value.queue': '{running} running · {pending} queued',
      'value.gpuUsage': 'VRAM {percent}% · {used} / {total}',
      'value.gpuUtil': 'GPU {percent}%',
      'value.vramInfo': 'VRAM {used} / {total}',
      'value.progress': 'Generating {percent}% · {value}/{max}',
      'value.percent': '{percent}%',
      'job.queued': 'Queued…',
      'job.running': 'Generating…',
      'job.completed': 'Done',
      'job.error': 'Generation failed',
      'job.cancelled': 'Cancelled',
      'job.elapsed': '{time} elapsed',
      'job.position': '{position} ahead',
      'job.done': 'Done in {time}',
      'job.interrupted': 'Interrupt requested',
      'job.lastDone': 'Last done {time}',
      'banner.offline': 'Cannot reach ComfyUI: {message}',
      'banner.generate': 'Submit failed: {message}',
      'banner.rewrite': 'AI rewrite failed: {message}',
      'banner.workflow': 'Workflow failed to load: {message}',
      'banner.workflows': 'Workflow list failed to load: {message}',
      'banner.interrupt': 'Interrupt failed: {message}',
      'banner.image': 'Image failed to load: {message}',
      'hint.offline': 'Check that ComfyUI runs, the address/port are right, and both devices share the LAN.',
      'offline.title': 'ComfyUI was not detected yet',
      'offline.desc': 'Install and start ComfyUI first; this panel connects automatically, no page refresh needed.',
      'offline.connectingTitle': 'Connecting to ComfyUI…',
      'offline.connectingDesc': 'Reading the server status, one moment.',
      'offline.configTitle': 'Reading ComfyUI configuration…',
      'offline.configDesc': 'The plugin host is not ready yet. If this persists, reload the ComfyUI plugin or restart DSH.',
      'offline.address': 'Address',
      'offline.saveAddress': 'Save and connect',
      'offline.savedAddress': 'Address saved, connecting…',
      'offline.invalidAddress': 'Invalid address, e.g. http://192.168.1.10:8188',
      'offline.connectFailed': 'Connection failed. Check that ComfyUI is running, with the right address and port.',
      'offline.step1Title': 'Install ComfyUI',
      'offline.step1': 'We recommend ComfyUI Desktop (Windows/macOS/Linux); the Windows portable build also works.',
      'offline.step2Title': 'Start the server',
      'offline.step2': 'Desktop: open the app and launch an instance. Portable: run run_nvidia_gpu.bat. Both default to port 8188.',
      'offline.step3Title': 'Connect the panel',
      'offline.step3': 'Use 127.0.0.1 on this machine, or the host IP over LAN; use the address shown by the ComfyUI instance.',
      'offline.download': 'Download',
      'offline.desktopGuide': 'Desktop guide',
      'offline.portableGuide': 'Portable guide',
      'offline.github': 'GitHub',
      'workflow.emptyGuide': 'First time? Build and save an image workflow in ComfyUI, then press Refresh.',
      'offline.copied': 'Address copied',
      'offline.retry': 'Retry now',
      'offline.retrying': 'Connecting…',
      'offline.open': 'Open ComfyUI page',
      'offline.error': 'Last error',
      'crash.title': 'The ComfyUI panel failed to render',
      'crash.desc': 'The error was caught. Refresh the page; if it keeps happening, report the console error to the plugin author.',
      'crash.reload': 'Refresh page',
      'hint.selectWorkflow': 'Select a workflow first',
      'hint.noPromptNode': 'This workflow has no editable prompt node.',
      'hint.notRunnable': 'This workflow cannot run yet; see the reasons above.',
      'aria.panel': 'ComfyUI studio',
      'aria.preview': 'Result preview',
      'aria.thumbs': 'Result thumbnails',
      'aria.workflowList': 'Workflow selection',
      'aria.progress': 'Generation progress',
      'aria.splitter': 'Resize the left and right panels',
    };

    const CSS = `
.cs-page {
  position: relative;
  height: 100%; min-height: 0; display: flex; flex-direction: column;
  box-sizing: border-box;
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
  font-size: 14px; line-height: 1.55; overflow: hidden;
  scrollbar-width: none;
}
.cs-page::-webkit-scrollbar { width: 0; height: 0; }
.cs-page * { box-sizing: border-box; }
.cs-page--resizing, .cs-page--resizing * { user-select: none; cursor: col-resize !important; }
.cs-top {
  flex: none; display: flex; flex-direction: column; gap: 10px;
  padding: 16px clamp(16px, 2.5vw, 28px) 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
[data-platform=darwin] .cs-top { padding-top: calc(16px + var(--dsh-frame-top-clearance, 0px)); }
.cs-head { display: flex; align-items: center; justify-content: space-between; gap: 12px 16px; flex-wrap: wrap; }
.cs-title-wrap { display: flex; align-items: center; gap: 8px; min-width: 0; }
.cs-title { margin: 0; font-size: 19px; font-weight: 500; line-height: 26px; }
.cs-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--dsw-alias-state-idle-primary, rgba(128,128,128,.6)); }
.cs-dot--on { background: var(--dsw-alias-state-success-primary, #2ea043); }
.cs-dot--warn { background: var(--dsw-alias-state-warn-primary, #d29922); }
.cs-status-text { font-size: 12px; color: var(--dsw-alias-label-secondary); }
.cs-mono { font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace); }
.cs-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cs-btn {
  font: inherit; font-size: 12px; line-height: 18px; height: 30px;
  padding: 0 12px; border-radius: 9px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  border: 1px solid transparent; background: transparent; color: inherit;
  transition: background-color .15s ease, border-color .15s ease, opacity .15s ease;
  text-decoration: none; white-space: nowrap;
}
.cs-btn:disabled { opacity: .45; cursor: default; }
.cs-btn--primary { background: var(--dsw-alias-brand-primary, #4d6bfe); color: var(--dsw-alias-bg-base); }
.cs-btn--primary:hover:not(:disabled) { background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4d6bfe) 88%, var(--dsw-alias-label-primary, #000)); }
.cs-btn--secondary { border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }
.cs-btn--secondary:hover:not(:disabled), .cs-btn--ghost:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);
}
.cs-btn--ghost { color: var(--dsw-alias-label-secondary); }
.cs-btn--tiny { height: 24px; padding: 0 9px; font-size: 11px; border-radius: 7px; }
.cs-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }

.cs-stats {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.cs-stat {
  min-width: 0; display: flex; flex-direction: column; gap: 3px;
  padding: 7px 10px; border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.cs-stat--wide { grid-column: span 1; }
.cs-stat-label { font-size: 10px; letter-spacing: .04em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); }
.cs-stat-value { font-size: 12px; line-height: 17px; color: var(--dsw-alias-label-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cs-stat-value .cs-dim { color: var(--dsw-alias-label-secondary); }
.cs-stat-sub { font-size: 10px; line-height: 14px; color: var(--dsw-alias-label-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cs-bar { display: block; height: 6px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; margin-top: 2px; }
.cs-bar-fill { display: block; height: 100%; border-radius: 999px; background: var(--dsw-alias-brand-primary, #4d6bfe); transition: width .3s ease; }
.cs-bar-fill--warn { background: var(--dsw-alias-state-warn-primary, #d29922); }
.cs-banner {
  display: flex; gap: 10px; align-items: flex-start; justify-content: space-between;
  border-radius: 9px; padding: 8px 10px; font-size: 12px; line-height: 18px;
}
.cs-banner p { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.cs-banner--error { background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5534b) 12%, transparent); color: var(--dsw-alias-state-error-primary, #e5534b); }
.cs-banner--warn { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d29922) 14%, transparent); color: var(--dsw-alias-state-warn-primary, #d29922); }
.cs-banner--ok { background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #2ea043) 12%, transparent); color: var(--dsw-alias-state-success-primary, #2ea043); }

.cs-body {
  position: relative;
  flex: 1; min-height: 0; display: grid;
  grid-template-columns: var(--cs-left, 372px) 10px minmax(0, 1fr);
  padding: 14px clamp(16px, 2.5vw, 28px) 18px;
  overflow: hidden;
}
.cs-body--connection > .cs-left,
.cs-body--connection > .cs-right,
.cs-body--connection > .cs-splitter { visibility: hidden; pointer-events: none; }
.cs-page--connection .cs-fab--hidden, .cs-fab.cs-fab--hidden { display: none; }
.cs-page--connection .cs-top { display: none; }
.cs-page--connection .cs-body { padding: 0; }
.cs-offline-links { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; margin: 12px 0 4px; }
.cs-offline-step { display: flex; gap: 10px; margin: 9px 0; text-align: left; }
.cs-offline-step-num {
  flex: none; width: 20px; height: 20px; margin-top: 1px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 600; color: var(--dsw-alias-brand-primary, #4d6bfe);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4d6bfe) 12%, transparent);
}
.cs-offline-step-body { min-width: 0; }
.cs-offline-step-body b { display: block; font-size: 12px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.cs-offline-step-body p { margin: 1px 0 0; font-size: 11px; line-height: 1.6; color: var(--dsw-alias-label-secondary); }
.cs-offline-head { text-align: center; margin-bottom: 12px; }
.cs-offline-edit { display: flex; flex-direction: column; gap: 8px; margin: 4px 0 12px; text-align: left; }
.cs-offline-edit-line { display: flex; align-items: center; gap: 8px; }
.cs-offline-input {
  flex: 1; min-width: 0; height: 32px; padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 9px;
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12px; font-family: var(--ds-font-family-code, ui-monospace, Menlo, monospace);
  outline: none;
}
.cs-offline-input:focus { border-color: var(--dsw-alias-brand-primary, #4d6bfe); }
.cs-offline-found { display: flex; flex-direction: column; gap: 4px; margin-top: 2px; }
.cs-offline-found button {
  text-align: left; font: inherit; font-size: 11px; cursor: pointer; padding: 5px 8px;
  border-radius: 7px; border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
}
.cs-offline-found button:hover { border-color: var(--dsw-alias-brand-primary, #4d6bfe); }
.cs-wf-empty-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
.cs-offline-page {
  height: 100%; min-height: 0; display: flex; align-items: center; justify-content: center;
  padding: 24px; overflow: auto; background: var(--dsw-alias-bg-base);
  animation: cs-fade-in .18s ease;
}
.cs-offline-card {
  width: min(500px, 100%); padding: 22px 24px 20px; text-align: center;
  border-radius: 16px; border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1); box-shadow: 0 24px 60px rgb(0 0 0 / 32%);
}
.cs-offline-icon {
  width: 42px; height: 42px; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center;
  border-radius: 12px; color: var(--dsw-alias-label-secondary);
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent);
}
.cs-offline-icon--busy { color: var(--dsw-alias-brand-primary, #4d6bfe); }
.cs-offline-spinner {
  width: 17px; height: 17px; border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent);
  border-top-color: var(--dsw-alias-brand-primary, #4d6bfe);
  animation: cs-spin .8s linear infinite;
}
@keyframes cs-spin { to { transform: rotate(360deg); } }
.cs-offline-title { margin: 0 0 6px; font-size: 15px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.cs-offline-desc { margin: 0 0 12px; font-size: 12px; line-height: 1.65; color: var(--dsw-alias-label-secondary); }
.cs-offline-address { display: flex; align-items: center; justify-content: center; gap: 6px; min-width: 0; margin: 0 0 10px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.cs-offline-address code {
  min-width: 0; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  padding: 2px 8px; border-radius: 6px; border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
  font-family: var(--ds-font-family-code, ui-monospace, Menlo, monospace); font-size: 11.5px;
}
.cs-offline-address .cs-btn { height: 22px; padding: 0 7px; font-size: 10px; }
.cs-offline-actions { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; margin: 14px 0 10px; }
.cs-offline-note { margin: 0; font-size: 10.5px; line-height: 1.65; color: var(--dsw-alias-label-secondary); }
.cs-offline-error {
  margin: 10px 0 0; padding: 8px 10px; max-height: 76px; overflow: auto;
  border-radius: 8px; text-align: left; font-size: 10.5px; line-height: 1.55; word-break: break-word;
  color: var(--dsw-alias-state-error-primary, #e5534b);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5534b) 10%, transparent);
}
.cs-crash {
  height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; padding: 24px; text-align: center;
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
}
.cs-crash h2 { margin: 0; font-size: 15px; }
.cs-crash p { max-width: 380px; margin: 0 0 8px; font-size: 12px; line-height: 1.65; color: var(--dsw-alias-label-secondary); }
.cs-crash-detail {
  max-width: 560px; max-height: 180px; overflow: auto; margin: 0 0 10px; padding: 8px 10px;
  border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary);
  font-family: var(--ds-font-family-code, ui-monospace, Menlo, monospace); font-size: 10.5px;
  line-height: 1.5; text-align: left; white-space: pre-wrap; word-break: break-word;
}
.cs-left {
  display: flex; flex-direction: column; gap: 10px; min-height: 0;
  overflow-x: hidden; overflow-y: auto; padding-right: 2px;
  scrollbar-gutter: stable;
}
.cs-left::-webkit-scrollbar { width: 8px; }
.cs-left::-webkit-scrollbar-track { background: transparent; }
.cs-left::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 20%, transparent);
  border: 2px solid transparent; border-radius: 999px; background-clip: content-box;
}
.cs-left::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 34%, transparent);
  background-clip: content-box;
}
@supports not selector(::-webkit-scrollbar) {
  .cs-left {
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--dsw-alias-label-primary) 24%, transparent) transparent;
  }
}
.cs-splitter {
  position: relative; width: 10px; cursor: col-resize; border-radius: 999px;
  background: transparent; border: none; padding: 0; touch-action: none;
}
.cs-splitter::after {
  content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 2px; height: 40px; border-radius: 2px; background: var(--dsw-alias-border-l2);
}
.cs-splitter:hover::after, .cs-splitter--active::after { background: var(--dsw-alias-brand-primary); }
.cs-splitter:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.cs-right { display: flex; flex-direction: column; gap: 10px; min-height: 0; padding-left: 2px; padding-bottom: 64px; }

.cs-card { border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); border-radius: 14px; padding: 12px 14px; }
.cs-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 9px; flex-wrap: wrap; }
.cs-card-title { margin: 0; font-size: 13px; font-weight: 500; }
.cs-hint { margin: 6px 0 0; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 1.5; }
.cs-select {
  font: inherit; font-size: 12px; color: inherit; width: 100%; height: 32px; padding: 0 9px;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 9px;
  background: var(--dsw-alias-bg-base); outline: none;
}
.cs-select:focus { border-color: var(--dsw-alias-border-l2); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary, #4d6bfe) 12%, transparent); }
.cs-wf-meta { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; font-size: 11px; color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; }
.cs-wf-meta b { color: var(--dsw-alias-label-primary); font-weight: 500; }
.cs-notes { margin: 6px 0 0; padding-left: 16px; font-size: 11px; line-height: 1.6; color: var(--dsw-alias-state-warn-primary, #d29922); }
.cs-notes--error { color: var(--dsw-alias-state-error-primary, #e5534b); }
.cs-wf-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
.cs-chip {
  font: inherit; font-size: 11px; line-height: 20px; height: 22px; padding: 0 9px;
  border-radius: 999px; border: 1px solid var(--dsw-alias-border-l2);
  background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer;
}
.cs-chip:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); }
.cs-chip--warn { color: var(--dsw-alias-state-warn-primary, #d29922); border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d29922) 45%, transparent); }
.cs-chip--error { color: var(--dsw-alias-state-error-primary, #e5534b); border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5534b) 45%, transparent); }
.cs-field-hint { font-size: 10px; line-height: 1.35; color: var(--dsw-alias-label-secondary); opacity: .9; }

.cs-prompt-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.cs-textarea {
  width: 100%; font: inherit; font-size: 12px; line-height: 1.55; color: inherit;
  padding: 8px 9px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px;
  background: var(--dsw-alias-bg-base); outline: none; resize: vertical;
  scrollbar-width: none;
}
.cs-textarea::-webkit-scrollbar { width: 0; height: 0; }
.cs-textarea--positive { height: 132px; min-height: 90px; max-height: 240px; }
.cs-textarea--negative { height: 64px; min-height: 48px; }
.cs-textarea:focus { border-color: var(--dsw-alias-brand-primary, #4d6bfe); }
.cs-textarea::placeholder { color: var(--dsw-alias-label-secondary); opacity: .7; }
.cs-field { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.cs-label { font-size: 11px; color: var(--dsw-alias-label-secondary); }
.cs-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 10px; }
.cs-form-grid .cs-field--wide { grid-column: 1 / -1; }
.cs-field .cs-num, .cs-inline .cs-num { width: 100%; }
.cs-inline .cs-num { flex: 1; }
.cs-inline { display: flex; align-items: center; gap: 6px; }
.cs-check { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.cs-lora { display: flex; flex-direction: column; gap: 8px; padding: 10px 0; border-top: 1px solid var(--dsw-alias-border-l1); }
.cs-lora:first-of-type { border-top: none; padding-top: 2px; }
.cs-lora-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.cs-lora-title { font-size: 11px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.cs-lora-name { width: 100%; }
.cs-lora-name--text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.cs-lora-strength { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 10px; }
.cs-lora-strength .cs-field:only-child { grid-column: 1 / -1; }
.cs-seed { display: flex; align-items: center; gap: 6px; }
.cs-seed .cs-num { flex: 1; min-width: 0; }
.cs-seed-input {
  flex: 1; min-width: 0; height: 30px; padding: 0 9px;
  font: inherit; font-size: 12px; font-family: var(--ds-font-family-code, ui-monospace, Menlo, monospace);
  color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-base);
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 9px; outline: none;
}
.cs-seed-input:focus { border-color: var(--dsw-alias-brand-primary); }
.cs-seed-control { width: 78px; flex: none; }
.cs-size-row { display: flex; align-items: center; gap: 6px; }
.cs-size-row .cs-num { flex: 1; min-width: 0; }
.cs-size-x { flex: none; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.cs-check input { accent-color: var(--dsw-alias-brand-primary); }

.cs-num { display: flex; align-items: stretch; border: 1px solid var(--dsw-alias-border-l2); border-radius: 9px; overflow: hidden; background: var(--dsw-alias-bg-base); }
.cs-num:focus-within { border-color: var(--dsw-alias-border-l2); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary, #4d6bfe) 12%, transparent); }
.cs-num--active { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary, #4d6bfe) 45%, var(--dsw-alias-border-l2)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary, #4d6bfe) 10%, transparent); }
.cs-num-btn {
  flex: none; width: 24px; border: none; background: transparent; color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 15px; line-height: 1; cursor: pointer; padding: 0;
}
.cs-num-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); color: var(--dsw-alias-label-primary); }
.cs-num-btn:disabled { opacity: .4; cursor: default; }
.cs-num-input {
  flex: 1; min-width: 0; width: 100%; border: none; background: transparent; outline: none;
  font: inherit; font-size: 12px; color: inherit; text-align: center; height: 30px;
  cursor: ew-resize; touch-action: none;
}
.cs-num-input:disabled { cursor: default; opacity: .55; }
.cs-num--active .cs-num-input { cursor: ew-resize; }
.cs-num-input::-webkit-outer-spin-button,
.cs-num-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

.cs-fab {
  position: fixed; right: 24px; bottom: 16px; z-index: 30;
  display: flex; align-items: center; gap: 10px;
}
.cs-fab--active {
  padding: 6px 10px; border-radius: 14px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 8px 24px rgb(0 0 0 / 26%);
}
.cs-fab-status { display: flex; flex-direction: column; gap: 1px; min-width: 0; max-width: 260px; font-size: 11px; line-height: 15px; color: var(--dsw-alias-label-secondary); }
.cs-fab-status b { color: var(--dsw-alias-label-primary); font-weight: 500; }
.cs-fab-batch {
  display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px;
  border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 6px 16px rgb(0 0 0 / 24%);
  font-size: 11px; color: var(--dsw-alias-label-secondary);
}
.cs-fab--active .cs-fab-batch { box-shadow: none; }
.cs-fab-num {
  min-width: 26px; padding: 2px 6px; border-radius: 6px; text-align: center;
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px; color: var(--dsw-alias-label-primary);
  cursor: ns-resize; user-select: none; touch-action: none;
}
.cs-fab-num:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); }
.cs-fab-num--active { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent); }
.cs-fab-num:focus-visible { outline: none; box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, transparent); }
.cs-fab-status span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-fab-error { color: var(--dsw-alias-state-error-primary, #e5534b) !important; }
.cs-fab .cs-btn--primary {
  height: 38px; padding: 0 22px; font-size: 13px; border-radius: 999px;
  box-shadow: 0 6px 16px rgb(0 0 0 / 24%);
}
.cs-fab--active .cs-btn--primary { height: 34px; padding: 0 18px; border-radius: 10px; box-shadow: none; }
.cs-toast {
  position: fixed; top: 18px; right: 22px; z-index: 90;
  display: flex; align-items: flex-start; gap: 8px;
  max-width: min(460px, 88vw); padding: 9px 10px 9px 12px;
  border-radius: 12px; border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 8px 24px rgb(0 0 0 / 28%);
  font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-primary);
  animation: cs-slide-down .2s ease;
}
.cs-toast-dot { flex: none; width: 7px; height: 7px; margin-top: 5px; border-radius: 50%; background: var(--dsw-alias-state-idle-primary); }
.cs-toast--error .cs-toast-dot { background: var(--dsw-alias-state-error-primary, #e5534b); }
.cs-toast--warn .cs-toast-dot { background: var(--dsw-alias-state-warn-primary, #d29922); }
.cs-toast--ok .cs-toast-dot { background: var(--dsw-alias-state-success-primary, #2ea043); }
.cs-toast p { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.cs-toast-close { flex: none; border: none; background: transparent; color: var(--dsw-alias-label-secondary); font-size: 15px; line-height: 18px; cursor: pointer; padding: 0 2px; }
.cs-toast-close:hover { color: var(--dsw-alias-label-primary); }
.cs-editor {
  position: absolute; inset: 0; z-index: 60;
  display: flex; flex-direction: column; min-height: 0;
  background: var(--dsw-alias-bg-base);
  border-radius: 16px 16px 0 0;
  border-top: 1px solid var(--dsw-alias-border-l2);
  box-shadow: 0 -18px 48px rgb(0 0 0 / 38%);
  transform: translate3d(0, 0, 0);
  will-change: transform;
  backface-visibility: hidden;
  contain: layout paint style;
  transition: transform .26s cubic-bezier(.2, .78, .25, 1);
}
.cs-editor--enter, .cs-editor--exiting { transform: translate3d(0, 100%, 0); }
[data-platform=darwin] .cs-editor { padding-top: var(--dsh-frame-top-clearance, 48px); }
.cs-editor-head { flex: none; display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.cs-editor-title { font-size: 13px; font-weight: 500; white-space: nowrap; }
.cs-editor-name {
  font: inherit; font-size: 12px; height: 30px; min-width: 160px; max-width: 320px; padding: 0 10px;
  border-radius: 8px; border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base); color: inherit; outline: none;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.cs-editor-name:focus { border-color: var(--dsw-alias-brand-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent); }
.cs-editor-state { font-size: 10px; letter-spacing: .04em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); }
.cs-editor-state--dirty { color: var(--dsw-alias-state-warn-primary, #d29922); }
.cs-editor-actions { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.cs-btn--danger { color: var(--dsw-alias-state-error-primary, #e5534b); }
.cs-btn--danger:hover:not(:disabled) { background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5534b) 12%, transparent); }
.cs-editor-confirm {
  flex: none; display: flex; align-items: center; gap: 10px; justify-content: space-between;
  padding: 8px 14px; font-size: 12px; color: var(--dsw-alias-label-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d29922) 12%, transparent);
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  animation: cs-slide-down .18s ease;
}
.cs-editor-confirm-actions { display: flex; gap: 6px; flex: none; }
.cs-editor-dialog-backdrop {
  position: absolute; inset: 0; z-index: 8; display: flex; align-items: center; justify-content: center;
  padding: 24px; background: color-mix(in srgb, var(--dsw-alias-bg-base) 72%, transparent);
  backdrop-filter: blur(3px); animation: cs-fade-in .16s ease;
}
.cs-editor-dialog {
  width: min(430px, 92%); padding: 16px 16px 14px; border-radius: 14px;
  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 24px 60px rgb(0 0 0 / 45%); animation: cs-pop-in .18s ease;
}
.cs-editor-dialog h3 { margin: 0 0 8px; font-size: 14px; font-weight: 500; }
.cs-editor-dialog-text { margin: 0 0 14px; font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-secondary); }
.cs-editor-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
.cs-tutorial-backdrop {
  position: absolute; inset: 0; z-index: 9; display: flex; align-items: center; justify-content: center;
  padding: 24px; background: color-mix(in srgb, var(--dsw-alias-bg-base) 74%, transparent);
  backdrop-filter: blur(3px); animation: cs-fade-in .16s ease;
}
.cs-tutorial {
  width: min(560px, 92%); max-height: min(560px, 86%);
  display: flex; flex-direction: column; overflow: hidden;
  border-radius: 16px; border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1); box-shadow: 0 28px 70px rgb(0 0 0 / 48%);
  animation: cs-pop-in .2s ease;
}
.cs-tutorial-head { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 16px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.cs-tutorial-head h3 { margin: 0; font-size: 14px; font-weight: 500; }
.cs-tutorial-body { flex: 1; min-height: 0; overflow: auto; padding: 10px 16px; display: flex; flex-direction: column; gap: 11px; }
.cs-tutorial-item b { display: block; margin-bottom: 2px; font-size: 12px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.cs-tutorial-item p { margin: 0; font-size: 11.5px; line-height: 1.6; color: var(--dsw-alias-label-secondary); }
.cs-tutorial-actions { flex: none; display: flex; justify-content: flex-end; padding: 10px 16px 14px; }
.cs-editor-toolbar { flex: none; display: flex; align-items: center; gap: 5px; padding: 6px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1); font-size: 11px; color: var(--dsw-alias-label-secondary); }
.cs-editor-toolbar .cs-btn { border-color: var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); }
.cs-editor-toolbar .cs-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--dsw-alias-label-primary) 9%, var(--dsw-alias-bg-layer-1)); }
.cs-editor-toolbar .cs-btn:disabled { border-color: var(--dsw-alias-border-l1); background: transparent; opacity: .4; }
.cs-editor-toolbar-sep { flex: none; width: 1px; height: 16px; margin: 0 3px; background: var(--dsw-alias-border-l1); }
.cs-editor-toolbar-status { margin-left: auto; flex: none; font-size: 10px; color: var(--dsw-alias-label-secondary); }
.cs-editor-zoom { min-width: 38px; text-align: center; font-variant-numeric: tabular-nums; }
.cs-editor-hint { margin-left: 8px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-editor-count { margin-left: auto; flex: none; }
.cs-editor-error { flex: none; padding: 6px 14px; font-size: 11px; color: var(--dsw-alias-state-error-primary, #e5534b); border-bottom: 1px solid var(--dsw-alias-border-l1); }
.cs-editor-native { flex: 1; min-height: 0; width: 100%; display: block; border: 0; background: #111; }
.cs-editor-native-label { font-size: 11px; color: var(--dsw-alias-label-secondary); }
.cs-editor-canvas {
  position: relative; flex: 1; min-height: 0; overflow: hidden; touch-action: none;
  background-color: var(--dsw-alias-bg-base);
  background-image: radial-gradient(circle, color-mix(in srgb, var(--dsw-alias-label-primary) 9%, transparent) 1px, transparent 1px);
  cursor: grab;
}
.cs-editor-canvas:active { cursor: grabbing; }
.cs-editor-layer { position: absolute; left: 0; top: 0; width: 0; height: 0; transform-origin: 0 0; }
.cs-editor-links { position: absolute; left: 0; top: 0; width: 1px; height: 1px; overflow: visible; }
.cs-link-path { fill: none; stroke: color-mix(in srgb, var(--dsw-alias-label-primary) 32%, transparent); stroke-width: 1.6; }
.cs-link-path--selected { stroke: var(--dsw-alias-brand-primary); stroke-width: 2.4; }
.cs-link-hit { fill: none; stroke: transparent; stroke-width: 14; pointer-events: stroke; cursor: pointer; }
.cs-link-draft { fill: none; stroke: var(--dsw-alias-brand-primary); stroke-width: 2; stroke-dasharray: 5 4; }
.cs-node {
  position: absolute; border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-left: 3px solid var(--cs-accent, var(--dsw-alias-border-l2));
  background: var(--cs-node-body, color-mix(in srgb, var(--cs-accent, #6b7280) 8%, var(--dsw-alias-bg-layer-1)));
  box-shadow: 0 10px 24px rgb(0 0 0 / 22%);
  transition: box-shadow .15s ease, border-color .15s ease;
}
.cs-node--selected { border-color: var(--dsw-alias-brand-primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary) 28%, transparent), 0 10px 24px rgb(0 0 0 / 28%); }
.cs-node--bypassed { opacity: .55; }
.cs-node--bypassed .cs-node-head { filter: grayscale(.5); }
.cs-node-bypass {
  flex: none; width: 18px; height: 18px; padding: 0; border: none; border-radius: 5px;
  background: transparent; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 1;
  cursor: pointer; opacity: 0;
  transition: opacity .15s ease, background-color .15s ease, color .15s ease;
}
.cs-node:hover .cs-node-bypass, .cs-node--selected .cs-node-bypass, .cs-node--bypassed .cs-node-bypass { opacity: 1; }
.cs-node-bypass:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent); color: var(--dsw-alias-label-primary); }
.cs-node-bypass--active { color: var(--dsw-alias-state-warn-primary, #d29922); }
.cs-node-head {
  height: 30px; display: flex; align-items: center; gap: 6px; padding: 0 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l1); border-radius: 9px 9px 0 0;
  background: color-mix(in srgb, var(--cs-accent, #6b7280) 38%, var(--dsw-alias-bg-layer-1));
  cursor: grab; user-select: none;
}
.cs-node-head:active { cursor: grabbing; }
.cs-node-title { flex: 1; min-width: 0; font-size: 11px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--dsw-alias-label-primary); text-shadow: 0 1px 2px rgb(0 0 0 / 45%); }
.cs-node-del {
  flex: none; width: 18px; height: 18px; border: none; border-radius: 5px; background: transparent;
  color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 1; cursor: pointer; padding: 0; opacity: 0;
  transition: opacity .15s ease, background-color .15s ease, color .15s ease;
}
.cs-node:hover .cs-node-del, .cs-node--selected .cs-node-del { opacity: 1; }
.cs-node-del:hover { background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5534b) 16%, transparent); color: var(--dsw-alias-state-error-primary, #e5534b); }
.cs-node-row { position: absolute; left: 0; right: 0; display: flex; align-items: center; gap: 6px; padding: 0 9px; font-size: 10px; color: var(--dsw-alias-label-secondary); }
.cs-node-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-node-label--out { text-align: right; }
.cs-node-socket-type { flex: none; font-size: 8.5px; letter-spacing: .04em; text-transform: uppercase; opacity: .65; }
.cs-port {
  position: absolute; width: 11px; height: 11px; border-radius: 50%;
  background: var(--dsw-alias-bg-base); border: 1.5px solid var(--dsw-alias-border-l2);
  cursor: crosshair; transition: border-color .12s ease, background-color .12s ease, transform .12s ease;
}
.cs-port:hover { border-color: var(--dsw-alias-brand-primary); transform: scale(1.15); }
.cs-port--in { left: -9px; top: 50%; margin-top: -5.5px; }
.cs-port--out { right: -6px; top: 50%; margin-top: -5.5px; }
.cs-port--linked { border-color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 65%, var(--dsw-alias-bg-base)); }
.cs-widget {
  flex: none; width: 52%; max-width: 150px; height: 19px; padding: 0 5px;
  font: inherit; font-size: 9.5px; color: var(--dsw-alias-label-primary);
  border-radius: 5px; border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base); outline: none;
}
.cs-widget:focus { border-color: var(--dsw-alias-brand-primary); }
.cs-widget--combo { padding-right: 2px; }
.cs-widget--text { height: 34px; resize: none; padding: 3px 5px; line-height: 1.25; scrollbar-width: none; }
.cs-widget--text::-webkit-scrollbar { width: 0; height: 0; }
.cs-widget--control { width: 62px; }
.cs-widget-check { flex: none; width: 13px; height: 13px; accent-color: var(--dsw-alias-brand-primary); }
.cs-editor-palette {
  position: absolute; left: 12px; top: 12px; bottom: 12px; z-index: 4; width: 286px;
  display: flex; flex-direction: column; overflow: hidden;
  border-radius: 12px; border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1); box-shadow: 0 18px 44px rgb(0 0 0 / 38%);
  animation: cs-rise .2s ease;
}
.cs-editor-palette-head { flex: none; display: flex; align-items: center; justify-content: space-between; padding: 8px 10px 4px; font-size: 12px; font-weight: 500; }
.cs-editor-search {
  flex: none; margin: 4px 10px 8px; height: 28px; padding: 0 8px; font: inherit; font-size: 11px;
  border-radius: 7px; border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base); color: inherit; outline: none;
}
.cs-editor-search:focus { border-color: var(--dsw-alias-brand-primary); }
.cs-editor-palette-list { flex: 1; min-height: 0; overflow: auto; padding: 0 4px 6px; scrollbar-width: none; }
.cs-editor-palette-list::-webkit-scrollbar { width: 0; }
.cs-palette-item {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 5px 8px;
  border: none; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 11px; text-align: left; cursor: pointer; transition: background-color .12s ease;
}
.cs-palette-item:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent); }
.cs-palette-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-palette-cat { flex: none; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 9px; color: var(--dsw-alias-label-secondary); opacity: .8; }
.cs-editor-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--dsw-alias-label-secondary); background: color-mix(in srgb, var(--dsw-alias-bg-base) 55%, transparent); backdrop-filter: blur(2px); }
.cs-editor-menu {
  position: absolute; z-index: 6; min-width: 168px; padding: 4px;
  border-radius: 10px; border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1); box-shadow: 0 16px 36px rgb(0 0 0 / 38%);
  animation: cs-rise .14s ease;
}
.cs-editor-menu button {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 9px;
  border: none; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 11px; text-align: left; cursor: pointer;
  transition: background-color .12s ease;
}
.cs-editor-menu button:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 9%, transparent); }
.cs-editor-menu button.cs-menu-danger { color: var(--dsw-alias-state-error-primary, #e5534b); }
.cs-editor-menu-sep { height: 1px; margin: 4px 2px; background: var(--dsw-alias-border-l1); }
.cs-editor-inspector {
  position: absolute; top: 12px; right: 12px; bottom: 12px; z-index: 5; width: 304px;
  display: flex; flex-direction: column; overflow: hidden;
  border-radius: 12px; border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1); box-shadow: 0 18px 44px rgb(0 0 0 / 40%);
  animation: cs-rise .18s ease;
}
.cs-inspector-head { flex: none; display: flex; align-items: center; gap: 8px; padding: 9px 10px 6px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.cs-inspector-title { flex: 1; min-width: 0; font-size: 12px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-inspector-body { flex: 1; min-height: 0; overflow: auto; padding: 8px 10px 10px; scrollbar-width: none; display: flex; flex-direction: column; gap: 8px; }
.cs-inspector-body::-webkit-scrollbar { width: 0; }
.cs-inspector-row { display: flex; flex-direction: column; gap: 3px; }
.cs-inspector-row .cs-widget { width: 100%; max-width: none; height: 26px; font-size: 11px; }
.cs-inspector-row .cs-widget--text { height: 64px; }
.cs-inspector-label { font-size: 10px; color: var(--dsw-alias-label-secondary); }
.cs-inspector-sockets { display: flex; flex-direction: column; gap: 3px; padding-top: 6px; border-top: 1px solid var(--dsw-alias-border-l1); }
.cs-inspector-socket { display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--dsw-alias-label-secondary); }
.cs-inspector-socket i { flex: none; width: 7px; height: 7px; border-radius: 50%; border: 1px solid var(--dsw-alias-border-l2); }
.cs-inspector-actions { flex: none; display: flex; gap: 6px; justify-content: flex-end; padding: 6px 10px 10px; }

.cs-lightbox {
  position: fixed; inset: 0; z-index: 80; display: flex; flex-direction: column;
  align-items: center; justify-content: center; padding: 32px;
  background: rgb(0 0 0 / 72%); backdrop-filter: blur(6px);
  opacity: 1; transition: opacity .22s ease;
}
.cs-lightbox--enter, .cs-lightbox--exiting { opacity: 0; }
.cs-lightbox-stage { position: relative; display: flex; align-items: center; justify-content: center; max-width: 100%; max-height: calc(100% - 64px); transform: scale(1); transition: transform .24s cubic-bezier(.22, .8, .28, 1); }
.cs-lightbox--enter .cs-lightbox-stage, .cs-lightbox--exiting .cs-lightbox-stage { transform: scale(.94); }
.cs-lightbox-stage img { display: block; max-width: min(92vw, 1600px); max-height: calc(100vh - 180px); object-fit: contain; border-radius: 10px; box-shadow: 0 24px 80px rgb(0 0 0 / 55%); }
.cs-lightbox-img { animation: cs-pop-in .22s ease; }
.cs-lightbox-bar { position: fixed; right: 28px; bottom: 26px; display: flex; align-items: center; gap: 8px; }
.cs-lightbox-meta { position: fixed; left: 28px; bottom: 30px; display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: rgb(255 255 255 / 78%); text-shadow: 0 1px 3px rgb(0 0 0 / 60%); max-width: 55vw; }
.cs-lightbox-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-lightbox-seed { display: flex; align-items: center; gap: 6px; font-size: 11.5px; }
.cs-lightbox-seed code { font-family: var(--ds-font-family-code, ui-monospace, Menlo, monospace); font-size: 11.5px; color: rgb(255 255 255 / 95%); background: rgb(255 255 255 / 14%); border-radius: 5px; padding: 1px 7px; }
.cs-lightbox-seed-copy { border: 1px solid rgb(255 255 255 / 22%); background: rgb(20 20 22 / 55%); color: rgb(255 255 255 / 92%); border-radius: 6px; font: inherit; font-size: 10px; line-height: 16px; padding: 1px 7px; cursor: pointer; transition: background-color .15s ease; }
.cs-lightbox-seed-copy:hover { background: rgb(46 46 50 / 85%); }
.cs-lightbox-nav {
  position: fixed; top: 50%; transform: translateY(-50%); width: 42px; height: 42px; border-radius: 50%;
  border: 1px solid rgb(255 255 255 / 22%); background: rgb(20 20 22 / 55%); color: rgb(255 255 255 / 94%); font-size: 20px; line-height: 1;
  cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background-color .15s ease;
}
.cs-lightbox-nav:hover:not(:disabled) { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 70%, rgb(20 20 22)); }
.cs-lightbox-nav:disabled { opacity: .25; cursor: default; }
.cs-lightbox-nav--prev { left: 24px; }
.cs-lightbox-nav--next { right: 24px; }
.cs-btn--overlay { border-color: rgb(255 255 255 / 22%); background: rgb(20 20 22 / 62%); color: rgb(255 255 255 / 94%); backdrop-filter: blur(8px); }
.cs-btn--overlay:hover:not(:disabled) { background: rgb(46 46 50 / 82%); }
.cs-btn--overlay-danger { color: #ff8a82; }

@keyframes cs-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes cs-pop-in { from { opacity: 0; transform: scale(.985); } to { opacity: 1; transform: scale(1); } }
@keyframes cs-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes cs-slide-down { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
.cs-fab .cs-btn--primary, .cs-fab-batch { transition: box-shadow .2s ease, transform .15s ease, background-color .15s ease; }
.cs-fab .cs-btn--primary:hover:not(:disabled) { transform: translateY(-1px); }
.cs-card { transition: border-color .18s ease; }
.cs-ref-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--dsw-alias-border-l1); }
.cs-ref {
  margin-top: 6px; padding: 8px 10px; border-radius: 9px;
  border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2);
  font-size: 12px; line-height: 1.65; color: var(--dsw-alias-label-secondary);
  white-space: pre-wrap; max-height: 160px; overflow: auto; scrollbar-width: none;
}
.cs-ref::-webkit-scrollbar { width: 0; height: 0; }
.cs-link { width: max-content; font-size: 11px; color: var(--dsw-alias-brand-primary); text-decoration: none; }
.cs-link:hover { text-decoration: underline; }
.cs-dialog-backdrop {
  position: fixed; inset: 0; z-index: 60;
  display: flex; align-items: center; justify-content: center; padding: 24px;
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 82%, transparent);
}
.cs-dialog {
  width: min(620px, 92vw); max-height: 78vh; overflow: auto;
  padding: 14px 16px 12px; border-radius: 14px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1);
}
.cs-dialog h3 { margin: 0 0 10px; font-size: 14px; font-weight: 500; }
.cs-dialog ul { margin: 0; padding-left: 18px; font-size: 12px; line-height: 1.7; color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; }
.cs-dialog-actions { display: flex; justify-content: flex-end; margin-top: 12px; }

.cs-preview-card { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 10px 12px 12px; }
.cs-preview-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.cs-preview-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.cs-preview-stage {
  flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center;
  border-radius: 10px; background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1); overflow: hidden;
}
.cs-preview-stage img { display: block; max-width: 100%; max-height: 100%; object-fit: contain; }
.cs-preview-stage--filled { cursor: zoom-in; }
.cs-preview-stage--filled img { animation: cs-pop-in .22s ease; }
.cs-preview-empty { padding: 24px 16px; text-align: center; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.cs-thumbs { flex: none; display: flex; gap: 6px; overflow-x: auto; overflow-y: hidden; padding: 2px 0 4px; min-height: 72px; align-items: center; scrollbar-width: none; }
.cs-thumbs::-webkit-scrollbar { width: 0; height: 0; }
.cs-thumb {
  flex: none; width: 64px; height: 64px; padding: 0; position: relative;
  transition: border-color .15s ease, transform .15s ease;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; overflow: hidden;
  background: var(--dsw-alias-bg-layer-2); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--dsw-alias-label-secondary); font-size: 10px;
}
.cs-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cs-thumb--active { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.cs-thumb:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.cs-thumb:hover { border-color: var(--dsw-alias-border-l2); transform: translateY(-1px); }

@media (max-width: 980px) {
  .cs-page { overflow: auto; }
  .cs-body { grid-template-columns: minmax(0, 1fr); overflow: visible; }
  .cs-left { overflow: visible; }
  .cs-right { min-height: 520px; padding-left: 0; }
  .cs-splitter { display: none; }
  .cs-fab { right: 14px; bottom: 14px; }
  .cs-toast { right: 14px; top: 14px; }
  .cs-editor-head { flex-wrap: wrap; }
  .cs-editor-name { flex: 1; max-width: none; }
  .cs-editor-hint { display: none; }
  .cs-lightbox-stage img { max-height: calc(100vh - 150px); }
  .cs-lightbox { padding: 18px; }
  .cs-lightbox-bar { right: 16px; bottom: 16px; }
  .cs-lightbox-meta { left: 16px; bottom: 20px; max-width: 60vw; }
}
@media (max-width: 720px) {
  .cs-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (prefers-reduced-motion: reduce) {
  .cs-btn, .cs-bar-fill, .cs-editor, .cs-lightbox, .cs-lightbox-stage, .cs-thumb,
  .cs-fab .cs-btn--primary, .cs-fab-batch { transition: none !important; }
  .cs-preview-stage--filled img, .cs-lightbox-img, .cs-toast, .cs-editor-palette, .cs-editor-confirm { animation: none !important; }
}
`;

    /**
     * @param {unknown} error thrown value.
     * @returns {string} its message.
     */
    function messageOf(error) {
      return error instanceof Error ? error.message : String(error);
    }

    /**
     * @param {string} text template.
     * @param {Record<string, string | number>} params values.
     * @returns {string} filled text.
     */
    function interpolate(text, params) {
      return String(text).replace(/\{(\w+)\}/g, (match, name) => (params[name] === undefined ? match : String(params[name])));
    }

    /**
     * @param {unknown} error thrown value.
     * @returns {string} display text including node errors.
     */
    function describeError(error) {
      const text = messageOf(error);
      const nodeErrors = /** @type {any} */ (error)?.nodeErrors;
      if (nodeErrors === null || typeof nodeErrors !== 'object') return text;
      const details = [];
      for (const value of Object.values(nodeErrors)) {
        const list = value !== null && typeof value === 'object' && Array.isArray(/** @type {any} */ (value).errors)
          ? /** @type {any} */ (value).errors
          : [];
        for (const item of list) {
          if (item !== null && typeof item === 'object' && typeof item.message === 'string' && item.message !== '') details.push(item.message);
        }
      }
      return details.length === 0 ? text : `${text}：${details.join('；')}`;
    }

    /**
     * JSON request against the Host half.
     * @param {string} path route path under BASE (may include a query string).
     * @param {{ method?: string, body?: unknown }} [options] request options.
     * @returns {Promise<any>} parsed JSON body.
     */
    async function requestJson(path, options = {}) {
      const init = { cache: 'no-store', method: options.method ?? 'GET' };
      if (options.body !== undefined) {
        init.headers = { 'content-type': 'application/json' };
        init.body = JSON.stringify(options.body);
      }
      const response = await fetch(BASE + path, init);
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      if (!response.ok || data === null) {
        const reason = data !== null && typeof data.error === 'string' ? data.error : `HTTP ${response.status}`;
        const error = new Error(reason);
        if (data !== null && data.nodeErrors !== undefined) error.nodeErrors = data.nodeErrors;
        throw error;
      }
      return data;
    }

    /**
     * @param {string} path route path.
     * @param {Record<string, string | number>} query query params.
     * @returns {string} path with an encoded query string.
     */
    function withQuery(path, query) {
      const parts = [];
      for (const [name, value] of Object.entries(query)) {
        if (value === '' || value === null || value === undefined) continue;
        parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
      }
      return parts.length === 0 ? path : `${path}?${parts.join('&')}`;
    }

    /**
     * @param {unknown} bytes byte count.
     * @returns {string} human readable size.
     */
    function formatBytes(bytes) {
      const value = typeof bytes === 'number' && Number.isFinite(bytes) ? bytes : null;
      if (value === null || value < 0) return '—';
      if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
      if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(0)} MB`;
      return `${value} B`;
    }

    /**
     * @param {number} milliseconds duration.
     * @returns {string} short duration.
     */
    function formatDuration(milliseconds) {
      const value = Math.max(0, milliseconds) / 1000;
      if (value < 60) return `${value.toFixed(1)}s`;
      const minutes = Math.floor(value / 60);
      const seconds = Math.floor(value % 60);
      return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
    }

    /**
     * @param {number} timestamp epoch ms.
     * @returns {string} local clock time.
     */
    function clockTime(timestamp) {
      try {
        return new Date(timestamp).toLocaleTimeString(undefined, { hour12: false });
      } catch {
        return '';
      }
    }

    /**
     * @returns {number} random usable seed.
     */
    function randomSeed() {
      return Math.floor(Math.random() * 4294967295);
    }

    /**
     * Compute the next seed for the chosen ComfyUI seed-control mode.
     * @param {unknown} value current seed value.
     * @param {string} control seed control mode.
     * @returns {number} seed to submit.
     */
    function nextSeedValue(value, control) {
      const current = Number(value);
      const base = Number.isSafeInteger(current) && current >= 0 ? current : randomSeed();
      if (control === 'fixed') return base;
      if (control === 'increment') return (base + 1) % 4294967296;
      if (control === 'decrement') return (base + 4294967295) % 4294967296;
      return randomSeed();
    }

    /**
     * Extract editable LoRA loader rows from a raw workflow graph.
     * @param {any} graph raw workflow.
     * @param {any[]} saved previously stored LoRA drafts.
     * @returns {Array<{ nodeId: string, type: string, name: string, model: any, clip: any, enabled: boolean }>} rows.
     */
    function loraNodesOf(graph, saved) {
      const savedById = new Map();
      for (const entry of Array.isArray(saved) ? saved : []) {
        if (entry !== null && typeof entry === 'object' && entry.nodeId !== undefined) savedById.set(String(entry.nodeId), entry);
      }
      const rows = [];
      for (const node of Array.isArray(graph?.nodes) ? graph.nodes : []) {
        if (node === null || typeof node !== 'object' || !LORA_TYPES.includes(String(node.type))) continue;
        const values = Array.isArray(node.widgets_values) ? node.widgets_values : [];
        const named = node.widgets_values_named !== null && typeof node.widgets_values_named === 'object' ? node.widgets_values_named : {};
        const stored = savedById.get(String(node.id)) ?? {};
        rows.push({
          nodeId: String(node.id),
          type: String(node.type),
          name: typeof stored.name === 'string' ? stored.name : (typeof named.lora_name === 'string' ? named.lora_name : (typeof values[0] === 'string' ? values[0] : '')),
          model: stored.model !== undefined ? stored.model : (named.strength_model !== undefined ? named.strength_model : (values[1] ?? 1)),
          clip: stored.clip !== undefined ? stored.clip : (named.strength_clip !== undefined ? named.strength_clip : (values[2] ?? 1)),
          enabled: stored.enabled !== undefined ? stored.enabled !== false : node.mode !== 4 && node.mode !== 2,
        });
      }
      return rows;
    }

    /**
     * Apply LoRA quick-edit rows onto a workflow graph copy.
     * @param {any} graph raw workflow.
     * @param {any[]} rows quick-edit rows.
     * @returns {any} graph with LoRA nodes enabled/bypassed and values updated.
     */
    function applyLorasToGraph(graph, rows) {
      if (!Array.isArray(rows) || rows.length === 0) return graph;
      const byId = new Map(rows.map((row) => [String(row?.nodeId ?? ''), row]));
      return {
        ...graph,
        nodes: (Array.isArray(graph?.nodes) ? graph.nodes : []).map((node) => {
          const row = byId.get(String(node?.id));
          if (row === undefined || !LORA_TYPES.includes(String(node?.type))) return node;
          const values = Array.isArray(node.widgets_values) ? [...node.widgets_values] : [];
          const named = node.widgets_values_named !== null && typeof node.widgets_values_named === 'object' ? { ...node.widgets_values_named } : null;
          if (typeof row.name === 'string' && row.name !== '') {
            values[0] = row.name;
            if (named !== null) named.lora_name = row.name;
          }
          const model = Number(row.model);
          if (row.model !== undefined && row.model !== null && Number.isFinite(model)) {
            values[1] = model;
            if (named !== null) named.strength_model = model;
          }
          const clip = Number(row.clip);
          if (node.type === 'LoraLoader' && row.clip !== undefined && row.clip !== null && Number.isFinite(clip)) {
            values[2] = clip;
            if (named !== null) named.strength_clip = clip;
          }
          return {
            ...node,
            mode: row.enabled === false ? 4 : 0,
            ...(values.length > 0 ? { widgets_values: values } : {}),
            ...(named === null ? {} : { widgets_values_named: named }),
          };
        }),
      };
    }

    /**
     * Pick a stable accent color per node (workflow color first, category second).
     * @param {any} node raw node.
     * @param {any} doc `/object_info` document.
     * @returns {string} CSS color.
     */
    function nodeAccentOf(node, doc) {
      const candidate = node?.color;
      if (typeof candidate === 'string' && /^#[0-9a-f]{3,8}$/i.test(candidate)) return candidate;
      const label = String(node?.type ?? doc?.category ?? '');
      let hash = 0;
      for (let index = 0; index < label.length; index += 1) hash = (hash * 31 + label.charCodeAt(index)) % 9973;
      return NODE_ACCENTS[hash % NODE_ACCENTS.length];
    }

    /**
     * @param {any} node frontend node.
     * @param {any} slot widget slot.
     * @returns {any} current widget value (named map first).
     */
    function widgetValueOf(node, slot) {
      const named = node?.widgets_values_named;
      if (named !== null && typeof named === 'object' && Object.prototype.hasOwnProperty.call(named, slot.name)) return named[slot.name];
      if (Array.isArray(node?.widgets_values)) return node.widgets_values[slot.index];
      return undefined;
    }

    /**
     * @param {any} node frontend node.
     * @param {any} slot widget slot.
     * @returns {any} current seed-control value.
     */
    function widgetControlValueOf(node, slot) {
      if (!Array.isArray(node?.widgets_values) || slot.controlIndex === null) return null;
      return node.widgets_values[slot.controlIndex];
    }

    /**
     * @param {any} node frontend node.
     * @returns {string | null} explicit workflow body color.
     */
    function nodeBodyColorOf(node) {
      const candidate = node?.bgcolor;
      return typeof candidate === 'string' && /^#[0-9a-f]{3,8}$/i.test(candidate) ? candidate : null;
    }

    /**
     * @returns {Record<string, any>} persisted settings.
     */
    function readSettings() {
      const defaults = { workflow: '', baseUrl: '', mode: 'tags', autoRewrite: true, overrides: {}, leftWidth: DEFAULT_LEFT, seeds: {} };
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === null) return defaults;
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object') return defaults;
        return {
          workflow: typeof parsed.workflow === 'string' ? parsed.workflow : '',
          baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : '',
          mode: parsed.mode === 'natural' ? 'natural' : 'tags',
          autoRewrite: parsed.autoRewrite !== false,
          overrides: parsed.overrides !== null && typeof parsed.overrides === 'object' && !Array.isArray(parsed.overrides) ? parsed.overrides : {},
          seeds: parsed.seeds !== null && typeof parsed.seeds === 'object' && !Array.isArray(parsed.seeds) ? parsed.seeds : {},
          leftWidth: Number.isFinite(parsed.leftWidth) ? Math.min(MAX_LEFT, Math.max(MIN_LEFT, parsed.leftWidth)) : DEFAULT_LEFT,
        };
      } catch {
        return defaults;
      }
    }

    /**
     * @param {Record<string, any>} settings settings to store.
     * @returns {void}
     */
    function writeSettings(settings) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch {
        // private mode / quota: the panel still works for this page session
      }
    }

    /**
     * @param {any} ctx Client plugin context.
     * @returns {(key: string, params?: Record<string, string | number>) => string} translate.
     */
    function makeTranslator(ctx) {
      let bound = null;
      try {
        bound = typeof ctx.locale.bind === 'function' ? ctx.locale.bind(NS) : null;
      } catch {
        bound = null;
      }
      return function translate(key, params) {
        let text = '';
        if (typeof bound === 'function') {
          try {
            const value = bound(key);
            if (typeof value === 'string' && value !== key) text = value;
          } catch {
            text = '';
          }
        }
        if (text === '') {
          let active = 'en';
          try {
            active = String(ctx.locale.getLocale()?.active ?? 'en').toLowerCase();
          } catch {
            active = 'en';
          }
          const dict = active.startsWith('zh') ? zh : en;
          text = dict[key] !== undefined ? dict[key] : en[key] !== undefined ? en[key] : key;
        }
        return params === undefined ? text : interpolate(text, params);
      };
    }

    /**
     * @param {any} ctx Client plugin context.
     * @returns {void}
     */
    function useLocaleTick(ctx) {
      const [, bump] = React.useState(0);
      React.useEffect(() => {
        if (typeof ctx.locale.subscribe !== 'function') return undefined;
        return ctx.locale.subscribe(() => bump((value) => value + 1));
      }, []);
    }

    /**
     * Register the panel dictionaries with the Client locale service.
     * @param {any} ctx Client plugin context.
     * @returns {() => void} disposer.
     */
    function registerDictionaries(ctx) {
      try {
        const dispose = ctx.locale.register(NS, { zh, en });
        if (typeof dispose === 'function') return dispose;
      } catch {
        // fall through to per-locale registration
      }
      const disposers = [];
      for (const [locale, dict] of [['zh', zh], ['en', en]]) {
        try {
          const dispose = ctx.locale.register(NS, locale, dict);
          if (typeof dispose === 'function') disposers.push(dispose);
        } catch {
          // embedded fallback still covers this locale
        }
      }
      return () => {
        for (const dispose of disposers.reverse()) {
          try {
            dispose();
          } catch {
            // already disposed
          }
        }
      };
    }

    /**
     * Left-sidebar icon: a small graph node pair plus a spark.
     * @param {{ size?: number, active?: boolean }} props owner props.
     * @returns {React.ReactElement} icon element.
     */
    function SidebarIcon(props) {
      const size = typeof props.size === 'number' ? props.size : 18;
      const active = props.active === true;
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': 'true',
        style: { display: 'block', flex: 'none' },
      },
      h('rect', { x: 3, y: 4.6, width: 7, height: 5.4, rx: 1.7, stroke: 'currentColor', strokeWidth: 1.5, opacity: active ? 1 : 0.8 }),
      h('rect', { x: 13.6, y: 14, width: 7, height: 5.4, rx: 1.7, stroke: 'currentColor', strokeWidth: 1.5, opacity: active ? 1 : 0.8 }),
      h('path', { d: 'M10.2 7.3h2.2a2 2 0 0 1 2 2v4.7', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', opacity: 0.6 }),
      h('path', { d: 'M17.6 2.9l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z', fill: 'currentColor', opacity: active ? 1 : 0.5 }));
    }

    /**
     * A labelled field wrapper.
     * @param {{ label: string, wide?: boolean, children: any }} props field props.
     * @returns {React.ReactElement} field element.
     */
    function Field(props) {
      return h('div', { className: 'cs-field' + (props.wide === true ? ' cs-field--wide' : '') },
        h('span', { className: 'cs-label' }, props.label),
        props.children,
        typeof props.hint === 'string' && props.hint !== '' ? h('span', { className: 'cs-field-hint' }, props.hint) : null);
    }

    /**
     * A numeric input with left/right step buttons and horizontal drag-to-adjust.
     * @param {{ value: any, onChange: (value: string) => void, min: number, max: number, step: number, disabled?: boolean, label: string, t: (key: string) => string }} props field props.
     * @returns {React.ReactElement} number control.
     */
    function NumberField(props) {
      const drag = React.useRef(null);
      const [active, setActive] = React.useState(false);
      const clampStep = (raw) => {
        const number = Number(raw);
        const base = Number.isFinite(number) ? number : props.min;
        const stepped = Math.round(base / props.step) * props.step;
        const clamped = Math.min(props.max, Math.max(props.min, stepped));
        return Number(clamped.toFixed(props.step < 1 ? 2 : 0));
      };
      const bump = (direction) => {
        if (props.disabled === true) return;
        const number = Number(props.value);
        props.onChange(String(clampStep((Number.isFinite(number) ? number : props.min) + direction * props.step)));
      };
      const onPointerDown = (event) => {
        if (props.disabled === true || event.button !== 0) return;
        drag.current = { x: event.clientX, value: Number.isFinite(Number(props.value)) ? Number(props.value) : props.min, moved: false };
        if (typeof event.currentTarget.setPointerCapture === 'function') event.currentTarget.setPointerCapture(event.pointerId);
      };
      const onPointerMove = (event) => {
        const state = drag.current;
        if (state === null) return;
        const dx = event.clientX - state.x;
        if (state.moved !== true && Math.abs(dx) < 4) return;
        state.moved = true;
        setActive(true);
        event.preventDefault();
        props.onChange(String(clampStep(state.value + (dx / 3) * props.step)));
      };
      const finishDrag = (event) => {
        if (drag.current === null) return;
        drag.current = null;
        setActive(false);
        try {
          if (typeof event.currentTarget.releasePointerCapture === 'function') event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // the pointer may already be released
        }
      };
      return h('div', { className: 'cs-num' + (active ? ' cs-num--active' : '') },
        h('button', {
          type: 'button', className: 'cs-num-btn', tabIndex: -1,
          'aria-label': props.t('actions.decrease'), disabled: props.disabled === true,
          onClick: () => bump(-1),
        }, '‹'),
        h('input', {
          className: 'cs-num-input',
          type: 'text',
          inputMode: 'decimal',
          value: props.value,
          disabled: props.disabled === true,
          'aria-label': props.label,
          onChange: (event) => props.onChange(event.target.value),
          onPointerDown,
          onPointerMove,
          onPointerUp: finishDrag,
          onPointerCancel: finishDrag,
        }),
        h('button', {
          type: 'button', className: 'cs-num-btn', tabIndex: -1,
          'aria-label': props.t('actions.increase'), disabled: props.disabled === true,
          onClick: () => bump(1),
        }, '›'));
    }

    /**
     * A compact draggable number for the fixed action bar: drag up/down (or use
     * the arrow keys) to change it, no dropdown and no spinner.
     * @param {{ value: any, min: number, max: number, step: number, disabled?: boolean, label: string, t: (key: string) => string, onChange: (value: string) => void }} props control props.
     * @returns {React.ReactElement} drag number.
     */
    function DragNumber(props) {
      const drag = React.useRef(null);
      const [active, setActive] = React.useState(false);
      const clampValue = (raw) => {
        const number = Number(raw);
        const base = Number.isFinite(number) ? number : props.min;
        const stepped = Math.round(base / props.step) * props.step;
        return Math.min(props.max, Math.max(props.min, stepped));
      };
      const emit = (next) => props.onChange(String(clampValue(next)));
      const onPointerDown = (event) => {
        if (props.disabled === true || event.button !== 0) return;
        drag.current = { y: event.clientY, value: Number.isFinite(Number(props.value)) ? Number(props.value) : props.min };
        event.preventDefault();
        if (typeof event.currentTarget.setPointerCapture === 'function') event.currentTarget.setPointerCapture(event.pointerId);
      };
      const onPointerMove = (event) => {
        const state = drag.current;
        if (state === null) return;
        const dy = event.clientY - state.y;
        if (Math.abs(dy) < 3) return;
        setActive(true);
        event.preventDefault();
        emit(state.value - (dy / 6) * props.step);
      };
      const finishDrag = (event) => {
        if (drag.current === null) return;
        drag.current = null;
        setActive(false);
        try {
          if (typeof event.currentTarget.releasePointerCapture === 'function') event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // the pointer may already be released
        }
      };
      return h('span', {
        className: 'cs-fab-num' + (active ? ' cs-fab-num--active' : ''),
        role: 'spinbutton',
        tabIndex: 0,
        'aria-label': props.label,
        'aria-valuenow': Number.isFinite(Number(props.value)) ? Number(props.value) : props.min,
        'aria-valuemin': props.min,
        'aria-valuemax': props.max,
        title: props.t('batch.dragHint'),
        onPointerDown,
        onPointerMove,
        onPointerUp: finishDrag,
        onPointerCancel: finishDrag,
        onKeyDown: (event) => {
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            emit((Number(props.value) || props.min) + props.step);
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            emit((Number(props.value) || props.min) - props.step);
          }
        },
      }, String(props.value));
    }

    /** Common ComfyUI node type labels. */
    const NODE_LABEL_KEYS = {
      CheckpointLoaderSimple: 'node.CheckpointLoaderSimple',
      UNETLoader: 'node.UNETLoader',
      CLIPLoader: 'node.CLIPLoader',
      VAELoader: 'node.VAELoader',
      LoraLoader: 'node.LoraLoader',
      CLIPTextEncode: 'node.CLIPTextEncode',
      KSampler: 'node.KSampler',
      EmptyLatentImage: 'node.EmptyLatentImage',
      VAEDecode: 'node.VAEDecode',
      SaveImage: 'node.SaveImage',
      PreviewImage: 'node.PreviewImage',
    };

    /**
     * @param {any} node workflow node.
     * @param {(key: string) => string} t translate.
     * @returns {string} display label.
     */
    function nodeLabel(node, t) {
      const key = NODE_LABEL_KEYS[node?.type];
      if (key !== undefined) return t(key);
      return String(node?.title ?? node?.type ?? '');
    }

    // ---- workflow editor geometry -------------------------------------------
    const EDITOR_HEAD = 30;
    const EDITOR_ROW = 24;
    const EDITOR_TEXT_ROW = 46;
    const EDITOR_PAD = 10;
    const EDITOR_MIN_WIDTH = 210;
    const EDITOR_MAX_WIDTH = 340;
    const EDITOR_SEED_CONTROLS = ['randomize', 'fixed', 'increment', 'decrement'];

    /**
     * @param {unknown} spec `/object_info` input spec.
     * @returns {boolean} whether the input is a widget.
     */
    function isWidgetSpec(spec) {
      if (!Array.isArray(spec) || spec.length === 0) return false;
      if (Array.isArray(spec[0])) return true;
      const kind = spec[0];
      return kind === 'INT' || kind === 'FLOAT' || kind === 'STRING' || kind === 'BOOLEAN' || kind === 'COMBO';
    }

    /**
     * @param {unknown} spec widget spec.
     * @returns {Record<string, any>} spec options.
     */
    function widgetSpecOptions(spec) {
      return Array.isArray(spec) && spec.length > 1 && spec[1] !== null && typeof spec[1] === 'object' ? spec[1] : {};
    }

    /**
     * @param {any} doc `/object_info` document.
     * @returns {Array<{ name: string, spec: any }>} widget inputs in frontend order.
     */
    function widgetSpecsOf(doc) {
      const rows = [];
      const gather = (group) => {
        if (group === null || typeof group !== 'object' || Array.isArray(group)) return;
        for (const [name, spec] of Object.entries(group)) {
          if (isWidgetSpec(spec)) rows.push({ name, spec });
        }
      };
      gather(doc?.input?.required);
      gather(doc?.input?.optional);
      return rows;
    }

    /**
     * Widget slots with the positional indexes used by `widgets_values`.
     * @param {any} doc `/object_info` document.
     * @returns {Array<{ name: string, spec: any, index: number, controlIndex: number | null }>} slots.
     */
    function widgetSlotsOf(doc) {
      const slots = [];
      let index = 0;
      for (const entry of widgetSpecsOf(doc)) {
        const options = widgetSpecOptions(entry.spec);
        const slot = { name: entry.name, spec: entry.spec, index, controlIndex: null };
        index += 1;
        if (options.control_after_generate === true) {
          slot.controlIndex = index;
          index += 1;
        }
        slots.push(slot);
      }
      return slots;
    }

    /**
     * @param {unknown} spec widget spec.
     * @returns {'int' | 'float' | 'string' | 'boolean' | 'combo'} control kind.
     */
    function widgetKindOf(spec) {
      if (!Array.isArray(spec) || spec.length === 0) return 'string';
      if (Array.isArray(spec[0])) return 'combo';
      if (spec[0] === 'INT') return 'int';
      if (spec[0] === 'FLOAT') return 'float';
      if (spec[0] === 'BOOLEAN') return 'boolean';
      return 'string';
    }

    /**
     * @param {unknown} spec widget spec.
     * @returns {any[]} combo choices.
     */
    function widgetChoicesOf(spec) {
      return Array.isArray(spec) && Array.isArray(spec[0]) ? spec[0] : [];
    }

    /**
     * @param {unknown} spec widget spec.
     * @returns {{ min?: number, max?: number, step?: number }} number bounds.
     */
    function widgetNumberOptions(spec) {
      const options = widgetSpecOptions(spec);
      const result = {};
      if (Number.isFinite(Number(options.min))) result.min = Number(options.min);
      if (Number.isFinite(Number(options.max))) result.max = Number(options.max);
      if (Number.isFinite(Number(options.step)) && Number(options.step) > 0) result.step = Number(options.step);
      return result;
    }

    /**
     * @param {unknown} spec widget spec.
     * @returns {any} default value.
     */
    function widgetDefaultOf(spec) {
      const options = widgetSpecOptions(spec);
      if (Array.isArray(spec) && Array.isArray(spec[0])) return spec[0][0] ?? '';
      if (spec?.[0] === 'INT' || spec?.[0] === 'FLOAT') {
        if (Number.isFinite(Number(options.default))) return Number(options.default);
        return Number.isFinite(Number(options.min)) ? Number(options.min) : 0;
      }
      if (spec?.[0] === 'BOOLEAN') return options.default === true;
      return typeof options.default === 'string' ? options.default : '';
    }

    /**
     * @param {any} node frontend node.
     * @returns {number} card width in workflow units.
     */
    function editorNodeWidth(node) {
      const size = Array.isArray(node?.size) ? node.size : null;
      const raw = size === null ? 240 : Number(size[0]);
      const width = Number.isFinite(raw) && raw > 0 ? raw : 240;
      return Math.max(EDITOR_MIN_WIDTH, Math.min(EDITOR_MAX_WIDTH, Math.round(width)));
    }

    /**
     * @param {any} row editor row.
     * @returns {number} row height.
     */
    function editorRowHeight(row) {
      if (row === null || row === undefined || row.kind !== 'widget' || row.slot === null) return EDITOR_ROW;
      if (widgetKindOf(row.slot.spec) !== 'string') return EDITOR_ROW;
      const name = String(row.slot.name).toLowerCase();
      const options = widgetSpecOptions(row.slot.spec);
      return options.multiline === true || name === 'text' || name.includes('prompt') ? EDITOR_TEXT_ROW : EDITOR_ROW;
    }

    /**
     * Describe one node's rows for rendering and port geometry.
     * @param {any} node frontend node.
     * @param {any | null} doc its `/object_info` document.
     * @returns {{ rows: any[], slots: any[], inputCount: number }} row model.
     */
    function editorRowsOf(node, doc) {
      const slots = widgetSlotsOf(doc);
      const slotByName = new Map(slots.map((slot) => [slot.name, slot]));
      const rows = [];
      const usedNames = new Set();
      const inputs = Array.isArray(node?.inputs) ? node.inputs : [];
      for (let index = 0; index < inputs.length; index += 1) {
        const input = inputs[index] !== null && typeof inputs[index] === 'object' ? inputs[index] : {};
        const widgetName = input.widget !== null && typeof input.widget === 'object' && typeof input.widget.name === 'string' ? input.widget.name : null;
        const slot = widgetName === null ? null : (slotByName.get(widgetName) ?? null);
        const linked = input.link !== null && input.link !== undefined;
        if (widgetName !== null) usedNames.add(widgetName);
        rows.push({
          kind: slot !== null && !linked && doc !== null && doc !== undefined ? 'widget' : 'input',
          slot,
          slotIndex: index,
          input,
          linked,
        });
      }
      const inputCount = rows.length;
      const outputs = Array.isArray(node?.outputs) ? node.outputs : [];
      for (let index = 0; index < outputs.length; index += 1) {
        const output = outputs[index] !== null && typeof outputs[index] === 'object' ? outputs[index] : {};
        rows.push({ kind: 'output', slot: null, slotIndex: index, output, linked: false });
      }
      if (doc !== null && doc !== undefined) {
        for (const slot of slots) {
          if (usedNames.has(slot.name)) continue;
          rows.push({ kind: 'widget', slot, slotIndex: null, input: null, linked: false });
        }
      }
      return { rows, slots, inputCount };
    }

    /**
     * @param {any} node frontend node.
     * @param {any | null} doc its `/object_info` document.
     * @returns {number} card height in workflow units.
     */
    function editorNodeHeight(node, doc) {
      const { rows } = editorRowsOf(node, doc);
      let height = EDITOR_HEAD + EDITOR_PAD;
      for (const row of rows) height += editorRowHeight(row);
      return height;
    }

    /**
     * @param {Map<number, any>} nodeById nodes.
     * @param {any} node frontend node.
     * @param {'in' | 'out'} side port side.
     * @param {number} index slot index.
     * @param {Map<string, any>} docs docs by type.
     * @returns {{ x: number, y: number }} workflow-space port centre.
     */
    function editorPortPoint(nodeById, node, side, index, docs) {
      const doc = docs.get(String(node?.type));
      const { rows, inputCount } = editorRowsOf(node, doc ?? null);
      const x = (Number(node?.pos?.[0]) || 0);
      const y = (Number(node?.pos?.[1]) || 0);
      const width = editorNodeWidth(node);
      const rowIndex = side === 'out' ? inputCount + index : index;
      let offset = 0;
      for (let row = 0; row < rowIndex; row += 1) offset += editorRowHeight(rows[row]);
      const height = rows[rowIndex] === undefined ? EDITOR_ROW : editorRowHeight(rows[rowIndex]);
      return { x: x + (side === 'out' ? width : 0), y: y + EDITOR_HEAD + offset + height / 2 };
    }

    /**
     * Deep-clone a raw workflow and normalise the link list.
     * @param {any} raw workflow document.
     * @returns {any} editable clone.
     */
    function cloneWorkflowGraph(raw) {
      const source = raw !== null && typeof raw === 'object' ? raw : {};
      const clone = JSON.parse(JSON.stringify(source));
      clone.nodes = Array.isArray(clone.nodes)
        ? clone.nodes.filter((node) => node !== null && typeof node === 'object')
        : [];
      const seen = new Set();
      const sourceLinks = Array.isArray(clone.links) ? clone.links : [];
      clone.links = [];
      for (const link of sourceLinks) {
        let id = 0;
        let originId = 0;
        let originSlot = 0;
        let targetId = 0;
        let targetSlot = 0;
        let type = '*';
        if (Array.isArray(link) && link.length >= 5) {
          id = Number(link[0]);
          originId = Number(link[1]);
          originSlot = Number(link[2]);
          targetId = Number(link[3]);
          targetSlot = Number(link[4]);
          type = typeof link[5] === 'string' ? link[5] : '*';
        } else if (link !== null && typeof link === 'object' && link.id !== undefined) {
          id = Number(link.id);
          originId = Number(link.origin_id);
          originSlot = Number(link.origin_slot);
          targetId = Number(link.target_id);
          targetSlot = Number(link.target_slot);
          type = typeof link.type === 'string' ? link.type : '*';
        } else {
          continue;
        }
        if (!Number.isFinite(id) || seen.has(id)) continue;
        seen.add(id);
        clone.links.push([id, originId, Number.isFinite(originSlot) ? originSlot : 0, targetId, Number.isFinite(targetSlot) ? targetSlot : 0, type]);
      }
      if (!Number.isFinite(Number(clone.last_node_id))) {
        clone.last_node_id = Math.max(0, ...clone.nodes.map((node) => Number(node.id) || 0));
      }
      if (!Number.isFinite(Number(clone.last_link_id))) {
        clone.last_link_id = Math.max(0, ...clone.links.map((link) => Number(link[0]) || 0));
      }
      return clone;
    }

    /**
     * @param {any} doc workflow document.
     * @param {number} nodeId node id.
     * @returns {any | null} node.
     */
    function findWorkflowNode(doc, nodeId) {
      return doc.nodes.find((node) => Number(node.id) === Number(nodeId)) ?? null;
    }

    /**
     * @param {any} node frontend node.
     * @param {any} slot widget slot.
     * @param {any} value new value.
     * @param {any[]} slots all widget slots of the node.
     * @returns {any} updated node.
     */
    function applyWidgetValue(node, slot, value, slots) {
      const next = { ...node };
      if (Array.isArray(node.widgets_values)) {
        const values = [...node.widgets_values];
        while (values.length <= slot.index) values.push(null);
        values[slot.index] = value;
        next.widgets_values = values;
      } else {
        const values = [];
        for (const entry of slots) {
          values[entry.index] = widgetDefaultOf(entry.spec);
          if (entry.controlIndex !== null) values[entry.controlIndex] = 'randomize';
        }
        values[slot.index] = value;
        next.widgets_values = values;
      }
      if (node.widgets_values_named !== null && typeof node.widgets_values_named === 'object') {
        next.widgets_values_named = { ...node.widgets_values_named, [slot.name]: value };
      }
      return next;
    }

    /**
     * @param {any} node frontend node.
     * @param {any} slot widget slot.
     * @param {string} control seed control value.
     * @returns {any} updated node.
     */
    function applyWidgetControl(node, slot, control) {
      if (!Array.isArray(node.widgets_values) || slot.controlIndex === null) return node;
      const values = [...node.widgets_values];
      while (values.length < slot.controlIndex) values.push(null);
      values[slot.controlIndex] = control;
      return { ...node, widgets_values: values };
    }

    /**
     * @param {any} doc workflow document.
     * @param {number} linkId link id.
     * @returns {any} updated document.
     */
    function removeWorkflowLink(doc, linkId) {
      const nodes = doc.nodes.map((node) => ({
        ...node,
        inputs: (node.inputs ?? []).map((input) => (input !== null && typeof input === 'object' && Number(input.link) === linkId ? { ...input, link: null } : input)),
        outputs: (node.outputs ?? []).map((output) => (output !== null && typeof output === 'object' && Array.isArray(output.links)
          ? { ...output, links: output.links.filter((id) => Number(id) !== linkId) }
          : output)),
      }));
      return { ...doc, nodes, links: doc.links.filter((link) => Number(link[0]) !== linkId) };
    }

    /**
     * @param {any} doc workflow document.
     * @param {number} nodeId node id.
     * @returns {any} updated document.
     */
    function removeWorkflowNode(doc, nodeId) {
      const removed = new Set();
      for (const link of doc.links) {
        if (Number(link[1]) === Number(nodeId) || Number(link[3]) === Number(nodeId)) removed.add(Number(link[0]));
      }
      const nodes = doc.nodes
        .filter((node) => Number(node.id) !== Number(nodeId))
        .map((node) => ({
          ...node,
          inputs: (node.inputs ?? []).map((input) => (input !== null && typeof input === 'object' && removed.has(Number(input.link)) ? { ...input, link: null } : input)),
          outputs: (node.outputs ?? []).map((output) => (output !== null && typeof output === 'object' && Array.isArray(output.links)
            ? { ...output, links: output.links.filter((id) => !removed.has(Number(id))) }
            : output)),
        }));
      return { ...doc, nodes, links: doc.links.filter((link) => !removed.has(Number(link[0]))) };
    }

    /**
     * Connect two ports, replacing any previous link on the target input.
     * @param {any} doc workflow document.
     * @param {number} originId source node id.
     * @param {number} originSlot source output slot.
     * @param {number} targetId target node id.
     * @param {number} targetSlot target input slot.
     * @returns {any} updated document.
     */
    function connectWorkflowNodes(doc, originId, originSlot, targetId, targetSlot) {
      if (Number(originId) === Number(targetId)) return doc;
      const nodes = doc.nodes.map((node) => ({
        ...node,
        inputs: (node.inputs ?? []).map((input) => (input !== null && typeof input === 'object' ? { ...input } : input)),
        outputs: (node.outputs ?? []).map((output) => (output !== null && typeof output === 'object'
          ? { ...output, links: Array.isArray(output.links) ? [...output.links] : [] }
          : output)),
      }));
      const origin = nodes.find((node) => Number(node.id) === Number(originId));
      const target = nodes.find((node) => Number(node.id) === Number(targetId));
      if (origin === undefined || target === undefined) return doc;
      const output = (origin.outputs ?? [])[originSlot];
      const input = (target.inputs ?? [])[targetSlot];
      if (output === null || output === undefined || input === null || input === undefined) return doc;
      const outType = String(output.type ?? '*');
      const inType = String(input.type ?? '*');
      if (outType !== inType && outType !== '*' && inType !== '*' && outType !== 'ANY' && inType !== 'ANY') return doc;
      const links = doc.links.map((link) => [...link]);
      const previous = input.link === null || input.link === undefined ? null : Number(input.link);
      if (previous !== null) {
        const oldLink = links.find((link) => Number(link[0]) === previous);
        if (oldLink !== undefined) {
          const oldOrigin = nodes.find((node) => Number(node.id) === Number(oldLink[1]));
          if (oldOrigin !== undefined) {
            const oldOutput = (oldOrigin.outputs ?? [])[Number(oldLink[2])];
            if (oldOutput !== null && oldOutput !== undefined && Array.isArray(oldOutput.links)) {
              oldOutput.links = oldOutput.links.filter((id) => Number(id) !== previous);
            }
          }
          links.splice(links.indexOf(oldLink), 1);
        }
      }
      let nextId = Number(doc.last_link_id) || 0;
      for (const link of links) nextId = Math.max(nextId, Number(link[0]) || 0);
      nextId += 1;
      links.push([nextId, Number(originId), Number(originSlot), Number(targetId), Number(targetSlot), outType]);
      input.link = nextId;
      output.links = Array.isArray(output.links) ? [...output.links, nextId] : [nextId];
      return { ...doc, nodes, links, last_link_id: nextId };
    }

    /**
     * Build a fresh frontend node from its `/object_info` document.
     * @param {any} doc workflow document.
     * @param {string} type node class type.
     * @param {any | null} info `/object_info` document.
     * @param {number} x workflow x.
     * @param {number} y workflow y.
     * @returns {any} updated document.
     */
    function addWorkflowNode(doc, type, info, x, y) {
      let nextId = Number(doc.last_node_id) || 0;
      for (const node of doc.nodes) nextId = Math.max(nextId, Number(node.id) || 0);
      nextId += 1;
      const inputs = [];
      const values = [];
      const named = {};
      const consume = (group) => {
        if (group === null || typeof group !== 'object' || Array.isArray(group)) return;
        for (const [name, spec] of Object.entries(group)) {
          if (isWidgetSpec(spec)) {
            const kind = widgetKindOf(spec);
            const value = widgetDefaultOf(spec);
            inputs.push({ name, type: kind === 'combo' ? 'COMBO' : (Array.isArray(spec) && typeof spec[0] === 'string' ? spec[0] : 'STRING'), widget: { name }, link: null });
            values.push(value);
            named[name] = value;
            if (widgetSpecOptions(spec).control_after_generate === true) values.push('randomize');
          } else {
            inputs.push({ name, type: Array.isArray(spec) ? String(spec[0]) : 'STRING', link: null });
          }
        }
      };
      consume(info?.input?.required);
      consume(info?.input?.optional);
      const outputTypes = Array.isArray(info?.output) ? info.output : [];
      const outputNames = Array.isArray(info?.output_name) ? info.output_name : [];
      const outputs = outputTypes.map((entry, index) => {
        const name = Array.isArray(entry) ? entry[0] : outputNames[index];
        const type = Array.isArray(entry) ? entry[1] : entry;
        return { name: String(name ?? type ?? ''), type: String(type ?? '*'), links: [] };
      });
      const node = {
        id: nextId,
        type,
        pos: [Math.round(x), Math.round(y)],
        size: [240, 140],
        flags: {},
        order: doc.nodes.length,
        mode: 0,
        inputs,
        outputs,
        properties: {},
        widgets_values: values,
        widgets_values_named: named,
      };
      return { ...doc, nodes: [...doc.nodes, node], last_node_id: nextId };
    }

    // ---- image lightbox -----------------------------------------------------
    /**
     * Convert any image blob into PNG (the clipboard only accepts PNG).
     * @param {Blob} blob source image.
     * @returns {Promise<Blob>} PNG blob.
     */
    async function imageBlobToPng(blob) {
      if (blob.type === 'image/png') return blob;
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      if (context === null) return blob;
      context.drawImage(bitmap, 0, 0);
      const png = await new Promise((resolve) => canvas.toBlob((result) => resolve(result), 'image/png'));
      return png ?? blob;
    }

    /**
     * Full-screen result preview with download / copy / delete actions.
     * @param {{ t: any, item: any, index: number, total: number, busy: boolean, onPrev: () => void, onNext: () => void, onClose: () => void, onClosed: () => void, onDownload: () => void, onCopy: () => void, onDelete: () => void }} props lightbox props.
     * @returns {React.ReactElement | null} lightbox element.
     */
    function ImageLightbox(props) {
      const t = props.t;
      const [entered, setEntered] = React.useState(false);
      const [closing, setClosing] = React.useState(false);
      React.useEffect(() => {
        const timer = setTimeout(() => setEntered(true), 20);
        return () => clearTimeout(timer);
      }, []);
      const close = () => {
        if (closing) return;
        setClosing(true);
        setTimeout(() => props.onClosed(), 230);
      };
      React.useEffect(() => {
        const onKey = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            close();
          } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            props.onPrev();
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            props.onNext();
          }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [closing, props.item === null ? null : props.item.key]);
      const remove = () => {
        if (closing) return;
        const key = props.item === null ? null : props.item.key;
        setClosing(true);
        setTimeout(() => props.onDelete(key), 230);
      };
      const item = props.item;
      if (item === null || item === undefined) return null;
      const className = 'cs-lightbox' + (entered && !closing ? '' : ' cs-lightbox--enter') + (closing ? ' cs-lightbox--exiting' : '');
      return h('div', {
        className,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': t('lightbox.preview'),
        onClick: (event) => { if (event.target === event.currentTarget) close(); },
      },
      h('div', { className: 'cs-lightbox-stage' },
        item.url !== null && item.url !== undefined
          ? h('img', { key: item.key, className: 'cs-lightbox-img', src: item.url, alt: item.filename })
          : h('div', { className: 'cs-preview-empty' }, item.error ?? t('preview.empty'))),
      h('button', {
        type: 'button', className: 'cs-lightbox-nav cs-lightbox-nav--prev', onClick: props.onPrev,
        disabled: props.total < 2 || closing, 'aria-label': t('lightbox.prev'),
      }, '‹'),
      h('button', {
        type: 'button', className: 'cs-lightbox-nav cs-lightbox-nav--next', onClick: props.onNext,
        disabled: props.total < 2 || closing, 'aria-label': t('lightbox.next'),
      }, '›'),
      h('div', { className: 'cs-lightbox-meta' },
        h('div', { className: 'cs-lightbox-name' },
          `${item.filename} · ${t('lightbox.count', { index: String(props.index + 1), total: String(props.total) })}`),
        h('div', { className: 'cs-lightbox-seed' },
          h('span', null, t('lightbox.seed')),
          h('code', null, item.seed === null || item.seed === undefined ? t('lightbox.seedUnknown') : String(item.seed)),
          item.seed === null || item.seed === undefined
            ? null
            : h('button', {
              type: 'button',
              className: 'cs-lightbox-seed-copy',
              onClick: props.onCopySeed,
            }, t('lightbox.copySeed')))),
      h('div', { className: 'cs-lightbox-bar' },
        h('button', {
          type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--secondary cs-btn--overlay',
          onClick: props.onDownload, disabled: item.url === null || item.url === undefined,
        }, t('lightbox.download')),
        h('button', {
          type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--secondary cs-btn--overlay',
          onClick: props.onCopy, disabled: props.busy || item.url === null || item.url === undefined,
        }, props.busy ? t('lightbox.copying') : t('lightbox.copy')),
        h('button', {
          type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--ghost cs-btn--overlay cs-btn--overlay-danger',
          onClick: remove,
        }, t('lightbox.delete')),
        h('button', {
          type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--ghost cs-btn--overlay',
          onClick: close, 'aria-label': t('lightbox.close'),
        }, '×')));
    }

    // ---- workflow editor sheet ----------------------------------------------
    /**
     * Slide-up ComfyUI-style node canvas editor for the selected workflow.
     * @param {{ t: any, baseUrl: string, name: string, graph: any, notify: (kind: string, text: string) => void, onSaved: (name: string) => void, onDeleted: (name: string) => void, onClosed: () => void }} props editor props.
     * @returns {React.ReactElement} editor sheet.
     */
    function WorkflowEditor(props) {
      const t = props.t;
      const [doc, setDoc] = React.useState(() => applyLorasToGraph(cloneWorkflowGraph(props.graph), props.loraDraft));
      const [name, setName] = React.useState(() => String(props.name ?? '').replace(/\.json$/i, ''));
      const [dirty, setDirty] = React.useState(false);
      const [docs, setDocs] = React.useState(null);
      const [catalog, setCatalog] = React.useState(null);
      const [selection, setSelection] = React.useState(null);
      const [view, setView] = React.useState({ scale: 1, x: 40, y: 40 });
      const [draft, setDraft] = React.useState(null);
      const [palette, setPalette] = React.useState(null);
      const [menu, setMenu] = React.useState(null);
      const [inspectorId, setInspectorId] = React.useState(null);
      const [confirm, setConfirm] = React.useState(null);
      const [saving, setSaving] = React.useState(false);
      const [error, setError] = React.useState('');
      const [entered, setEntered] = React.useState(false);
      const [exiting, setExiting] = React.useState(false);
      const [revealed, setRevealed] = React.useState(false);
      const [tutorial, setTutorial] = React.useState(false);
      const [nativeCanvas, setNativeCanvas] = React.useState(() => {
        try {
          return window.localStorage.getItem('dsh-comfyui-studio:native-canvas') === '1';
        } catch {
          return false;
        }
      });
      const loraSnapshot = React.useRef(null);

      /**
       * Switch between the embedded ComfyUI web UI and the built-in canvas.
       * @param {boolean} native target mode.
       * @returns {void}
       */
      const chooseCanvas = (native) => {
        setNativeCanvas(native);
        try {
          window.localStorage.setItem('dsh-comfyui-studio:native-canvas', native ? '1' : '0');
        } catch {
          // private mode: the choice simply is not remembered
        }
        if (!native && typeof props.onRefreshWorkflows === 'function') props.onRefreshWorkflows();
      };

      const canvasRef = React.useRef(null);
      const dragRef = React.useRef(null);
      const docRef = React.useRef(doc);
      const viewRef = React.useRef(view);
      const fitted = React.useRef(false);
      const actionsRef = React.useRef(null);

      React.useEffect(() => {
        let seen = true;
        try {
          seen = window.localStorage.getItem('dsh-comfyui-studio:tutorial-v1') === '1';
        } catch {
          seen = true;
        }
        if (seen) return undefined;
        const timer = setTimeout(() => setTutorial(true), 420);
        return () => clearTimeout(timer);
      }, []);

      /** @returns {void} close the tutorial and remember it was seen. */
      const closeTutorial = () => {
        setTutorial(false);
        try {
          window.localStorage.setItem('dsh-comfyui-studio:tutorial-v1', '1');
        } catch {
          // private mode: the tutorial simply shows again next time
        }
      };

      // Mirror canvas LoRA bypass/strength edits into the main LoRA card.
      React.useEffect(() => {
        const rows = loraNodesOf(docRef.current, []);
        const snapshot = JSON.stringify(rows);
        if (loraSnapshot.current === null) {
          loraSnapshot.current = snapshot;
          return;
        }
        if (snapshot === loraSnapshot.current) return;
        loraSnapshot.current = snapshot;
        if (typeof props.onLorasChange === 'function') props.onLorasChange(rows);
      }, [doc, props.onLorasChange]);

      React.useEffect(() => {
        const raise = setTimeout(() => setEntered(true), 30);
        // Mount the node graph only after the sheet finished sliding in, so the
        // transform runs on an empty canvas and stays at 60 fps.
        const reveal = setTimeout(() => setRevealed(true), 300);
        return () => {
          clearTimeout(raise);
          clearTimeout(reveal);
        };
      }, []);
      React.useEffect(() => { docRef.current = doc; }, [doc]);
      React.useEffect(() => { viewRef.current = view; }, [view]);

      // Close the editor context menu when clicking anywhere else.
      React.useEffect(() => {
        if (menu === null) return undefined;
        const onDown = (event) => {
          const target = event.target;
          if (target instanceof Element && target.closest('.cs-editor-menu') !== null) return;
          setMenu(null);
        };
        window.addEventListener('pointerdown', onDown, true);
        return () => window.removeEventListener('pointerdown', onDown, true);
      }, [menu]);

      const finishClose = React.useCallback(() => {
        setExiting(true);
        if (nativeCanvas && typeof props.onRefreshWorkflows === 'function') props.onRefreshWorkflows();
        setTimeout(() => props.onClosed(), 300);
      }, [nativeCanvas, props.onClosed, props.onRefreshWorkflows]);

      const attemptClose = React.useCallback(() => {
        if (saving) return;
        if (dirty) {
          setConfirm('close');
          return;
        }
        finishClose();
      }, [dirty, finishClose, saving]);

      // Load the /object_info documents needed to label and edit widgets.
      React.useEffect(() => {
        let cancelled = false;
        const types = [...new Set((docRef.current.nodes ?? []).map((node) => String(node?.type ?? '')).filter((type) => type !== ''))];
        (async () => {
          try {
            const collected = {};
            for (let index = 0; index < types.length; index += 40) {
              const chunk = types.slice(index, index + 40);
              const data = await requestJson(withQuery('/object-info', { base: props.baseUrl, types: chunk.join(',') }));
              const entries = data.docs !== null && typeof data.docs === 'object' ? data.docs : {};
              for (const [type, info] of Object.entries(entries)) collected[type] = info;
            }
            if (!cancelled) setDocs(collected);
          } catch (loadError) {
            if (!cancelled) {
              setDocs({});
              setError(t('editor.loadFailed', { message: describeError(loadError) }));
            }
          }
        })();
        return () => { cancelled = true; };
      }, []);

      const fitView = React.useCallback(() => {
        const canvas = canvasRef.current;
        const nodes = docRef.current.nodes ?? [];
        if (canvas === null) return;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (nodes.length === 0 || width < 20 || height < 20) {
          setView({ scale: 1, x: 40, y: 40 });
          return;
        }
        const docsNow = docs ?? {};
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const node of nodes) {
          const x = Number(node?.pos?.[0]) || 0;
          const y = Number(node?.pos?.[1]) || 0;
          const nodeWidth = editorNodeWidth(node);
          const nodeHeight = editorNodeHeight(node, docsNow[String(node?.type)] ?? null);
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + nodeWidth);
          maxY = Math.max(maxY, y + nodeHeight);
        }
        const contentWidth = Math.max(120, maxX - minX);
        const contentHeight = Math.max(90, maxY - minY);
        const scale = Math.max(0.25, Math.min(1.1, Math.min((width - 80) / contentWidth, (height - 80) / contentHeight)));
        setView({
          scale,
          x: (width - contentWidth * scale) / 2 - minX * scale,
          y: (height - contentHeight * scale) / 2 - minY * scale,
        });
      }, [docs]);

      React.useEffect(() => {
        if (!revealed || docs === null || fitted.current) return;
        fitted.current = true;
        fitView();
      }, [docs, fitView, revealed]);

      const worldFromPointer = (event) => {
        const canvas = canvasRef.current;
        if (canvas === null) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const current = viewRef.current;
        return {
          x: (event.clientX - rect.left - current.x) / current.scale,
          y: (event.clientY - rect.top - current.y) / current.scale,
        };
      };

      const updateEditorWidget = (nodeId, slot, value, slots) => {
        const node = findWorkflowNode(docRef.current, nodeId);
        if (node === null) return;
        if (String(widgetValueOf(node, slot)) === String(value)) return;
        setDoc((previous) => ({
          ...previous,
          nodes: previous.nodes.map((entry) => (Number(entry.id) === Number(nodeId) ? applyWidgetValue(entry, slot, value, slots) : entry)),
        }));
        setDirty(true);
      };

      const updateEditorControl = (nodeId, slot, control) => {
        const node = findWorkflowNode(docRef.current, nodeId);
        if (node === null) return;
        if (String(widgetControlValueOf(node, slot)) === String(control)) return;
        setDoc((previous) => ({
          ...previous,
          nodes: previous.nodes.map((entry) => (Number(entry.id) === Number(nodeId) ? applyWidgetControl(entry, slot, control) : entry)),
        }));
        setDirty(true);
      };

      const deleteSelection = React.useCallback(() => {
        if (selection === null) return;
        setDoc((previous) => (selection.kind === 'node' ? removeWorkflowNode(previous, selection.id) : removeWorkflowLink(previous, selection.id)));
        setSelection(null);
        setDirty(true);
      }, [selection]);

      /**
       * Toggle ComfyUI canvas bypass (mode 4) for one node.
       * @param {number} nodeId node id.
       * @returns {void}
       */
      /**
       * Rename a node (its `title` field).
       * @param {number} nodeId node id.
       * @param {string} title new title.
       * @returns {void}
       */
      const updateNodeTitle = (nodeId, title) => {
        const node = findWorkflowNode(docRef.current, nodeId);
        if (node === null) return;
        const nextTitle = String(title).trim();
        if (String(node.title ?? '') === nextTitle) return;
        setDoc((previous) => ({
          ...previous,
          nodes: previous.nodes.map((entry) => {
            if (Number(entry.id) !== Number(nodeId)) return entry;
            const copy = { ...entry };
            if (nextTitle === '') delete copy.title;
            else copy.title = nextTitle;
            return copy;
          }),
        }));
        setDirty(true);
      };

      const toggleBypass = (nodeId) => {
        setDoc((previous) => ({
          ...previous,
          nodes: previous.nodes.map((node) => (Number(node.id) === Number(nodeId)
            ? { ...node, mode: Number(node.mode) === 4 ? 0 : 4 }
            : node)),
        }));
        setDirty(true);
      };

      const save = React.useCallback(async () => {
        if (saving) return;
        const trimmed = name.trim();
        const fileName = trimmed === '' ? '' : (/\.json$/i.test(trimmed) ? trimmed : `${trimmed}.json`);
        if (fileName === '' || fileName.length > 300 || fileName.includes('..') || fileName.startsWith('/') || fileName.includes('\\') || /[\u0000-\u001f]/.test(fileName)) {
          setError(t('editor.invalidName'));
          return;
        }
        setSaving(true);
        setError('');
        try {
          const data = await requestJson('/workflows/save', { method: 'POST', body: { base: props.baseUrl, name: fileName, graph: docRef.current } });
          const savedName = typeof data.name === 'string' && data.name !== '' ? data.name : fileName;
          setName(savedName.replace(/\.json$/i, ''));
          setDirty(false);
          setSaving(false);
          props.notify('ok', t('editor.savedToast', { name: savedName }));
          props.onSaved(savedName);
          finishClose();
        } catch (saveError) {
          setSaving(false);
          setError(t('editor.saveFailed', { message: describeError(saveError) }));
        }
      }, [name, props, saving, t, finishClose]);

      const removeWorkflow = async () => {
        if (saving) return;
        const opened = String(props.name ?? '').trim();
        const fileName = opened === '' ? '' : (/\.json$/i.test(opened) ? opened : `${opened}.json`);
        if (fileName === '') {
          setError(t('editor.invalidName'));
          return;
        }
        setSaving(true);
        setError('');
        try {
          await requestJson('/workflows/delete', { method: 'POST', body: { base: props.baseUrl, name: fileName } });
          setDirty(false);
          setConfirm(null);
          setSaving(false);
          props.notify('ok', t('editor.deletedToast', { name: fileName }));
          props.onDeleted(fileName);
          finishClose();
        } catch (deleteError) {
          setSaving(false);
          setError(t('editor.deleteFailed', { message: describeError(deleteError) }));
        }
      };

      actionsRef.current = {
        save,
        attemptClose,
        deleteSelection,
        dismiss: () => {
          if (menu !== null) setMenu(null);
          else if (inspectorId !== null) setInspectorId(null);
          else if (confirm !== null) setConfirm(null);
          else if (palette !== null) setPalette(null);
          else attemptClose();
        },
      };
      React.useEffect(() => {
        const onKey = (event) => {
          const actions = actionsRef.current;
          if (actions === null) return;
          const target = event.target;
          const typing = target instanceof Element && target.closest('input,textarea,select') !== null;
          if (event.key === 'Escape') {
            event.preventDefault();
            actions.dismiss();
            return;
          }
          if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 's') {
            event.preventDefault();
            void actions.save();
            return;
          }
          if (!typing && (event.key === 'Delete' || event.key === 'Backspace')) {
            event.preventDefault();
            actions.deleteSelection();
          }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, []);

      /**
       * Open the node palette, optionally anchored at a workflow point.
       * @param {{ x: number, y: number } | null} [anchor] placement anchor.
       * @returns {Promise<void>}
       */
      const openPalette = async (anchor = null) => {
        if (palette !== null) return;
        setPalette({ query: '', busy: catalog === null, anchor });
        if (catalog !== null) return;
        try {
          const data = await requestJson(withQuery('/node-catalog', { base: props.baseUrl }));
          setCatalog(Array.isArray(data.catalog) ? data.catalog : []);
          setPalette((previous) => (previous === null ? previous : { ...previous, busy: false }));
        } catch (catalogError) {
          setPalette(null);
          setError(t('editor.loadFailed', { message: describeError(catalogError) }));
        }
      };

      const addNode = async (type) => {
        const anchor = palette !== null ? palette.anchor : null;
        setPalette(null);
        try {
          let info = docs !== null ? docs[type] : undefined;
          if (info === undefined) {
            const data = await requestJson(withQuery('/object-info', { base: props.baseUrl, types: type }));
            info = data.docs !== null && typeof data.docs === 'object' ? (data.docs[type] ?? null) : null;
            setDocs((previous) => ({ ...(previous ?? {}), [type]: info }));
          }
          const canvas = canvasRef.current;
          const width = canvas === null ? 600 : canvas.clientWidth;
          const height = canvas === null ? 400 : canvas.clientHeight;
          const current = viewRef.current;
          const worldX = anchor !== null && anchor !== undefined ? anchor.x - 120 : (width / 2 - current.x) / current.scale - 120;
          const worldY = anchor !== null && anchor !== undefined ? anchor.y - 70 : (height / 2 - current.y) / current.scale - 70;
          setDoc((previous) => addWorkflowNode(previous, type, info, worldX, worldY));
          setDirty(true);
          setError('');
        } catch (addError) {
          setError(t('editor.loadFailed', { message: describeError(addError) }));
        }
      };

      const onPointerDown = (event) => {
        if (event.button !== 0) return;
        setMenu(null);
        setInspectorId(null);
        const target = event.target instanceof Element ? event.target : null;
        if (target === null) return;
        if (target.closest('input,select,textarea,button,label,a')) return;
        const linkHit = target.closest('[data-link-id]');
        if (linkHit !== null) {
          setSelection({ kind: 'link', id: Number(linkHit.getAttribute('data-link-id')) });
          return;
        }
        const outPort = target.closest('[data-out-port]');
        if (outPort !== null) {
          const nodeId = Number(outPort.getAttribute('data-node-id'));
          const slot = Number(outPort.getAttribute('data-slot'));
          const node = findWorkflowNode(docRef.current, nodeId);
          if (node !== null) {
            const docsNow = docs ?? {};
            const start = editorPortPoint(new Map(docRef.current.nodes.map((entry) => [Number(entry.id), entry])), node, 'out', slot, new Map(Object.entries(docsNow)));
            dragRef.current = { kind: 'link', originId: nodeId, originSlot: slot };
            setDraft({ start, end: start });
            setSelection({ kind: 'node', id: nodeId });
            event.preventDefault();
            if (canvasRef.current !== null) canvasRef.current.setPointerCapture(event.pointerId);
            return;
          }
        }
        const dragHandle = target.closest('[data-node-drag]');
        if (dragHandle !== null) {
          const nodeId = Number(dragHandle.getAttribute('data-node-drag'));
          const node = findWorkflowNode(docRef.current, nodeId);
          if (node !== null) {
            const world = worldFromPointer(event);
            const position = Array.isArray(node.pos) ? node.pos : [0, 0];
            dragRef.current = {
              kind: 'node',
              nodeId,
              startWorld: world,
              origin: [Number(position[0]) || 0, Number(position[1]) || 0],
            };
            setSelection({ kind: 'node', id: nodeId });
            event.preventDefault();
            if (canvasRef.current !== null) canvasRef.current.setPointerCapture(event.pointerId);
            return;
          }
        }
        const nodeHit = target.closest('[data-node-id]');
        if (nodeHit !== null) {
          setSelection({ kind: 'node', id: Number(nodeHit.getAttribute('data-node-id')) });
          return;
        }
        setMenu(null);
        dragRef.current = { kind: 'pan', startX: event.clientX, startY: event.clientY, origin: { ...viewRef.current } };
        setSelection(null);
        event.preventDefault();
        if (canvasRef.current !== null) canvasRef.current.setPointerCapture(event.pointerId);
      };

      /**
       * Open the canvas context menu for a node, link or empty space.
       * @param {React.MouseEvent} event contextmenu event.
       * @returns {void}
       */
      const onContextMenu = (event) => {
        event.preventDefault();
        const target = event.target instanceof Element ? event.target : null;
        const canvas = canvasRef.current;
        if (target === null || canvas === null) return;
        const rect = canvas.getBoundingClientRect();
        const linkId = target.closest('[data-link-id]');
        const nodeEl = target.closest('[data-node-id]');
        const nodeId = nodeEl === null ? null : Number(nodeEl.getAttribute('data-node-id'));
        const link = linkId === null ? null : Number(linkId.getAttribute('data-link-id'));
        if (nodeId !== null) setSelection({ kind: 'node', id: nodeId });
        else if (link !== null) setSelection({ kind: 'link', id: link });
        setMenu({
          x: Math.max(4, Math.min(event.clientX - rect.left, rect.width - 190)),
          y: Math.max(4, Math.min(event.clientY - rect.top, rect.height - 40)),
          nodeId,
          linkId: link,
        });
      };

      /** @returns {{ x: number, y: number }} context-menu position in workflow space. */
      const menuWorldPoint = () => {
        if (menu === null || canvasRef.current === null) return { x: 0, y: 0 };
        const current = viewRef.current;
        return { x: (menu.x - current.x) / current.scale, y: (menu.y - current.y) / current.scale };
      };

      const onPointerMove = (event) => {
        const drag = dragRef.current;
        if (drag === null) return;
        if (drag.kind === 'pan') {
          setView({
            scale: drag.origin.scale,
            x: drag.origin.x + (event.clientX - drag.startX),
            y: drag.origin.y + (event.clientY - drag.startY),
          });
          return;
        }
        if (drag.kind === 'node') {
          const world = worldFromPointer(event);
          if (Math.abs(world.x - drag.startWorld.x) < 1 && Math.abs(world.y - drag.startWorld.y) < 1) return;
          setDoc((previous) => ({
            ...previous,
            nodes: previous.nodes.map((node) => (Number(node.id) === drag.nodeId
              ? {
                ...node,
                pos: [
                  Math.round(drag.origin[0] + world.x - drag.startWorld.x),
                  Math.round(drag.origin[1] + world.y - drag.startWorld.y),
                ],
              }
              : node)),
          }));
          return;
        }
        if (drag.kind === 'link') {
          const world = worldFromPointer(event);
          setDraft((previous) => (previous === null ? previous : { ...previous, end: world }));
        }
      };

      const onPointerUp = (event) => {
        const drag = dragRef.current;
        dragRef.current = null;
        if (drag === null) return;
        if (drag.kind === 'node') {
          // A drag that barely moved is not a real edit: snap it back so the
          // "unsaved" badge only reflects content changes.
          const node = findWorkflowNode(docRef.current, drag.nodeId);
          if (node !== null) {
            const position = Array.isArray(node.pos) ? node.pos : [0, 0];
            const dx = Number(position[0]) - drag.origin[0];
            const dy = Number(position[1]) - drag.origin[1];
            if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) {
              setDoc((previous) => ({
                ...previous,
                nodes: previous.nodes.map((entry) => (Number(entry.id) === drag.nodeId ? { ...entry, pos: [drag.origin[0], drag.origin[1]] } : entry)),
              }));
            }
          }
        }
        if (drag.kind === 'link') {
          const target = document.elementFromPoint(event.clientX, event.clientY);
          const inputPort = target !== null && typeof target.closest === 'function' ? target.closest('[data-in-port]') : null;
          if (inputPort !== null && Number(inputPort.getAttribute('data-node-id')) === drag.originId) {
            setError(t('editor.connectionSelf'));
          } else if (inputPort !== null) {
            const targetId = Number(inputPort.getAttribute('data-node-id'));
            const targetSlot = Number(inputPort.getAttribute('data-slot'));
            const before = docRef.current;
            const after = connectWorkflowNodes(before, drag.originId, drag.originSlot, targetId, targetSlot);
            if (after !== before) {
              setDoc(after);
              setDirty(true);
            } else {
              setError(t('editor.connectionFailed'));
            }
          }
          setDraft(null);
        }
        const canvas = canvasRef.current;
        if (canvas !== null) {
          try {
            canvas.releasePointerCapture(event.pointerId);
          } catch {
            // the pointer may already be released
          }
        }
      };

      /**
       * Cancel a pointer gesture without completing it.
       * @param {PointerEvent} event pointer event.
       * @returns {void}
       */
      const cancelPointer = (event) => {
        dragRef.current = null;
        setDraft(null);
        const canvas = canvasRef.current;
        if (canvas !== null) {
          try {
            canvas.releasePointerCapture(event.pointerId);
          } catch {
            // the pointer may already be released
          }
        }
      };

      React.useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas === null) return undefined;
        const zoom = (event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (target !== null && target.closest('input,select,textarea')) return;
          event.preventDefault();
          setMenu(null);
          const rect = canvas.getBoundingClientRect();
          const current = viewRef.current;
          const factor = Math.exp(-(event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY) * 0.0015);
          const scale = Math.max(0.22, Math.min(1.8, current.scale * factor));
          const px = event.clientX - rect.left;
          const py = event.clientY - rect.top;
          setView({
            scale,
            x: px - ((px - current.x) / current.scale) * scale,
            y: py - ((py - current.y) / current.scale) * scale,
          });
        };
        canvas.addEventListener('wheel', zoom, { passive: false });
        return () => canvas.removeEventListener('wheel', zoom);
      }, []);

      const zoomBy = (factor) => {
        const canvas = canvasRef.current;
        const width = canvas === null ? 600 : canvas.clientWidth;
        const height = canvas === null ? 400 : canvas.clientHeight;
        setView((previous) => {
          const scale = Math.max(0.22, Math.min(1.8, previous.scale * factor));
          return {
            scale,
            x: width / 2 - ((width / 2 - previous.x) / previous.scale) * scale,
            y: height / 2 - ((height / 2 - previous.y) / previous.scale) * scale,
          };
        });
      };

      const docById = new Map(doc.nodes.map((node) => [Number(node.id), node]));
      const docsMap = new Map(Object.entries(docs ?? {}));
      const links = [];
      for (const link of doc.links) {
        const origin = docById.get(Number(link[1]));
        const target = docById.get(Number(link[3]));
        if (origin === undefined || target === undefined) continue;
        const from = editorPortPoint(docById, origin, 'out', Number(link[2]), docsMap);
        const to = editorPortPoint(docById, target, 'in', Number(link[4]), docsMap);
        const delta = Math.max(40, Math.abs(to.x - from.x) * 0.5);
        const path = `M ${from.x} ${from.y} C ${from.x + delta} ${from.y}, ${to.x - delta} ${to.y}, ${to.x} ${to.y}`;
        links.push({ id: Number(link[0]), type: String(link[5] ?? '*'), path, selected: selection !== null && selection.kind === 'link' && selection.id === Number(link[0]) });
      }
      const draftPath = draft === null
        ? ''
        : `M ${draft.start.x} ${draft.start.y} C ${draft.start.x + 60} ${draft.start.y}, ${draft.end.x - 60} ${draft.end.y}, ${draft.end.x} ${draft.end.y}`;

      /**
       * @param {any} node frontend node.
       * @param {any} slot widget slot.
       * @returns {React.ReactElement|null} seed-control selector.
       */
      const renderWidgetControl = (node, slot) => {
        if (slot.controlIndex === null) return null;
        const control = widgetControlValueOf(node, slot);
        return h('select', {
          className: 'cs-widget cs-widget--control',
          value: control === null || control === undefined ? 'randomize' : String(control),
          title: t('editor.seedControl'),
          onChange: (event) => updateEditorControl(node.id, slot, event.target.value),
        }, EDITOR_SEED_CONTROLS.map((option) => h('option', { key: option, value: option }, option)));
      };

      /**
       * @param {any} node frontend node.
       * @param {any} slot widget slot.
       * @param {any[]} slots all widget slots of the node.
       * @returns {React.ReactElement} widget editor.
       */
      const renderWidgetInput = (node, slot, slots) => {
        const kind = widgetKindOf(slot.spec);
        const value = widgetValueOf(node, slot);
        if (kind === 'combo') {
          const choices = widgetChoicesOf(slot.spec).map((choice) => String(choice));
          if (value !== undefined && value !== null && !choices.includes(String(value))) choices.unshift(String(value));
          return h('select', {
            className: 'cs-widget cs-widget--combo',
            value: String(value ?? ''),
            onChange: (event) => updateEditorWidget(node.id, slot, event.target.value, slots),
          }, choices.map((choice) => h('option', { key: choice, value: choice }, choice)));
        }
        if (kind === 'boolean') {
          return h('input', {
            type: 'checkbox',
            className: 'cs-widget-check',
            checked: value === true,
            onChange: (event) => updateEditorWidget(node.id, slot, event.target.checked, slots),
          });
        }
        if (kind === 'string') {
          const options = widgetSpecOptions(slot.spec);
          const nameLower = String(slot.name).toLowerCase();
          const multiline = options.multiline === true || nameLower === 'text' || nameLower.includes('prompt');
          return multiline
            ? h('textarea', {
              className: 'cs-widget cs-widget--text',
              value: String(value ?? ''),
              spellCheck: false,
              onChange: (event) => updateEditorWidget(node.id, slot, event.target.value, slots),
            })
            : h('input', {
              className: 'cs-widget',
              value: String(value ?? ''),
              spellCheck: false,
              onChange: (event) => updateEditorWidget(node.id, slot, event.target.value, slots),
            });
        }
        const bounds = widgetNumberOptions(slot.spec);
        const clampNumber = (raw) => {
          let next = kind === 'int' ? Math.round(raw) : raw;
          if (bounds.min !== undefined) next = Math.max(bounds.min, next);
          if (bounds.max !== undefined) next = Math.min(bounds.max, next);
          return next;
        };
        return h('input', {
          className: 'cs-widget',
          type: 'number',
          defaultValue: Number.isFinite(Number(value)) ? Number(value) : 0,
          min: bounds.min,
          max: bounds.max,
          step: bounds.step ?? (kind === 'int' ? 1 : 0.1),
          onChange: (event) => {
            const raw = event.target.value;
            if (raw === '' || raw === '-' || raw.endsWith('.')) return;
            const numeric = Number(raw);
            if (!Number.isFinite(numeric)) return;
            const next = clampNumber(numeric);
            if (String(next) === raw) return;
            updateEditorWidget(node.id, slot, next, slots);
          },
          onBlur: (event) => {
            const numeric = Number(event.target.value);
            const next = Number.isFinite(numeric) ? clampNumber(numeric) : (Number.isFinite(Number(value)) ? Number(value) : 0);
            event.target.value = String(next);
            updateEditorWidget(node.id, slot, next, slots);
          },
        });
      };

      const renderWidget = (node, row, top, key, slots) => {
        const slot = row.slot;
        return h('div', {
          key,
          className: 'cs-node-row cs-node-row--widget',
          style: { top: `${top}px`, height: `${editorRowHeight(row)}px` },
        },
        h('span', { className: 'cs-node-label', title: slot.name }, slot.name),
        renderWidgetInput(node, slot, slots),
        renderWidgetControl(node, slot));
      };

      const renderNode = (node) => {
        const info = docs !== null ? (docs[String(node.type)] ?? null) : null;
        const rowsInfo = editorRowsOf(node, info);
        const width = editorNodeWidth(node);
        const position = Array.isArray(node.pos) ? node.pos : [0, 0];
        const accent = nodeAccentOf(node, info);
        const bodyColor = nodeBodyColorOf(node);
        const selectedNode = selection !== null && selection.kind === 'node' && selection.id === Number(node.id);
        let cursor = EDITOR_HEAD;
        const children = [];
        rowsInfo.rows.forEach((row, index) => {
          const top = cursor;
          const height = editorRowHeight(row);
          cursor += height;
          if (row.kind === 'widget' && row.slot !== null) {
            children.push(renderWidget(node, row, top, `w${index}`, rowsInfo.slots));
            return;
          }
          if (row.kind === 'output') {
            const output = row.output ?? {};
            children.push(h('div', {
              key: `o${index}`,
              className: 'cs-node-row cs-node-row--output',
              style: { top: `${top}px`, height: `${height}px` },
            },
            h('span', { className: 'cs-node-label cs-node-label--out', title: String(output.localized_name ?? output.name ?? '') }, String(output.localized_name ?? output.name ?? '')),
            h('span', { className: 'cs-node-socket-type' }, String(output.type ?? '')),
            h('span', {
              className: 'cs-port cs-port--out',
              'data-out-port': 'out',
              'data-node-id': String(node.id),
              'data-slot': String(row.slotIndex),
              title: String(output.type ?? ''),
            })));
            return;
          }
          const input = row.input ?? {};
          children.push(h('div', {
            key: `i${index}`,
            className: 'cs-node-row',
            style: { top: `${top}px`, height: `${height}px` },
          },
          h('span', {
            className: 'cs-port cs-port--in' + (row.linked ? ' cs-port--linked' : ''),
            'data-in-port': 'in',
            'data-node-id': String(node.id),
            'data-slot': String(row.slotIndex),
            title: String(input.type ?? ''),
          }),
          h('span', { className: 'cs-node-label', title: String(input.localized_name ?? input.name ?? '') }, String(input.localized_name ?? input.name ?? '')),
          h('span', { className: 'cs-node-socket-type' }, String(input.type ?? ''))));
        });
        return h('div', {
          key: String(node.id),
          className: 'cs-node' + (selectedNode ? ' cs-node--selected' : '') + (Number(node.mode) === 4 ? ' cs-node--bypassed' : ''),
          'data-node-id': String(node.id),
          style: {
            left: `${Number(position[0]) || 0}px`,
            top: `${Number(position[1]) || 0}px`,
            width: `${width}px`,
            height: `${cursor + EDITOR_PAD}px`,
            zIndex: selectedNode ? 3 : 1,
            '--cs-accent': accent,
            ...(bodyColor === null ? {} : { '--cs-node-body': bodyColor }),
          },
        },
        h('div', { className: 'cs-node-head', 'data-node-drag': String(node.id) },
          h('span', { className: 'cs-node-title', title: String(node.type ?? '') }, nodeLabel(node, t) || String(node.type ?? '')),
          h('button', {
            type: 'button',
            className: 'cs-node-bypass' + (Number(node.mode) === 4 ? ' cs-node-bypass--active' : ''),
            title: t('editor.bypass'),
            'aria-label': t('editor.bypass'),
            'aria-pressed': Number(node.mode) === 4 ? 'true' : 'false',
            onClick: (event) => {
              event.stopPropagation();
              toggleBypass(Number(node.id));
            },
          }, '⊘'),
          h('button', {
            type: 'button',
            className: 'cs-node-del',
            title: t('editor.deleteNode'),
            'aria-label': t('editor.deleteNode'),
            onClick: () => {
              setDoc((previous) => removeWorkflowNode(previous, Number(node.id)));
              setSelection(null);
              setDirty(true);
            },
          }, '×')),
        children);
      };

      const orderedNodes = [...doc.nodes].sort((left, right) => {
        const leftSelected = selection !== null && selection.kind === 'node' && selection.id === Number(left.id) ? 1 : 0;
        const rightSelected = selection !== null && selection.kind === 'node' && selection.id === Number(right.id) ? 1 : 0;
        return leftSelected - rightSelected;
      });

      const query = palette === null ? '' : palette.query.trim().toLowerCase();
      const catalogItems = catalog === null
        ? []
        : catalog
          .filter((entry) => query === '' || String(entry.display ?? '').toLowerCase().includes(query) || String(entry.type ?? '').toLowerCase().includes(query) || String(entry.category ?? '').toLowerCase().includes(query))
          .slice(0, 120);

      const displayName = `${name.trim() === '' ? 'workflow' : name.trim()}${/\.json$/i.test(name.trim()) ? '' : '.json'}`;
      const openedFileName = (() => {
        const opened = String(props.name ?? '').trim();
        if (opened === '') return displayName;
        return /\.json$/i.test(opened) ? opened : `${opened}.json`;
      })();
      const paletteOpen = palette !== null;
      const canvasClassName = 'cs-editor-canvas';
      return h('section', {
        className: 'cs-editor' + (entered && !exiting ? '' : ' cs-editor--enter') + (exiting ? ' cs-editor--exiting' : ''),
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': t('editor.title'),
      },
      nativeCanvas ? null : h('div', { className: 'cs-editor-head' },
        h('span', { className: 'cs-editor-title' }, t('editor.title')),
        nativeCanvas
          ? h(Fragment, null,
            h('span', { className: 'cs-editor-native-label' }, t('editor.nativeTitle')),
            h('div', { className: 'cs-editor-actions' },
              h('button', {
                type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--secondary',
                onClick: attemptClose, disabled: saving,
              }, t('editor.close'))))
          : h(Fragment, null,
            h('input', {
              className: 'cs-editor-name',
              value: name,
              spellCheck: false,
              'aria-label': t('editor.name'),
              placeholder: t('editor.name'),
              onChange: (event) => { setName(event.target.value); setDirty(true); },
            }),
            h('span', { className: 'cs-editor-state' + (dirty ? ' cs-editor-state--dirty' : '') }, dirty ? t('editor.unsaved') : t('editor.saved')),
            h('div', { className: 'cs-editor-actions' },
              h('button', {
                type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--ghost cs-btn--danger',
                onClick: () => setConfirm('delete'), disabled: saving,
              }, t('editor.deleteWorkflow')),
              h('button', {
                type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--secondary',
                onClick: attemptClose, disabled: saving,
              }, t('editor.close')),
              h('button', {
                type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--primary',
                onClick: () => { void save(); }, disabled: saving,
              }, saving ? t('editor.saving') : t('editor.save'))))),
      confirm === null ? null : h('div', {
        className: 'cs-editor-dialog-backdrop',
        onPointerDown: (event) => event.stopPropagation(),
        onClick: (event) => { if (event.target === event.currentTarget && !saving) setConfirm(null); },
      },
      h('div', { className: 'cs-editor-dialog', role: 'dialog', 'aria-modal': 'true' },
        h('h3', null, confirm === 'delete' ? t('editor.deleteWorkflow') : t('editor.close')),
        h('p', { className: 'cs-editor-dialog-text' }, confirm === 'delete'
          ? t('editor.deleteConfirm', { name: openedFileName })
          : t('editor.closeConfirm')),
        h('div', { className: 'cs-editor-dialog-actions' },
          confirm === 'close'
            ? h('button', {
              type: 'button', className: 'cs-btn cs-btn--secondary',
              onClick: () => { setConfirm(null); void save(); },
              disabled: saving,
            }, saving ? t('editor.saving') : t('editor.saveAndClose'))
            : null,
          h('button', {
            type: 'button', className: 'cs-btn cs-btn--' + (confirm === 'delete' ? 'danger' : 'ghost'),
            onClick: () => {
              if (confirm === 'delete') {
                void removeWorkflow();
                return;
              }
              setConfirm(null);
              setDirty(false);
              finishClose();
            },
            disabled: saving,
          }, confirm === 'delete' ? t('editor.delete') : t('editor.discardAndClose')),
          h('button', {
            type: 'button', className: 'cs-btn cs-btn--ghost',
            onClick: () => setConfirm(null), disabled: saving,
          }, t('editor.cancel'))))),
      nativeCanvas
        ? h('div', { className: 'cs-editor-toolbar' },
          h('button', { type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--secondary', onClick: () => chooseCanvas(false) }, t('editor.builtin')),
          h('span', { className: 'cs-editor-toolbar-sep', 'aria-hidden': 'true' }),
          h('button', {
            type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--secondary',
            onClick: () => { if (typeof props.onRefreshWorkflows === 'function') props.onRefreshWorkflows(); },
          }, t('actions.refreshWorkflows')),
          h('button', { type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--secondary', onClick: () => { window.open(props.baseUrl, '_blank', 'noopener'); } }, t('editor.openExternal')),
          h('span', { className: 'cs-editor-toolbar-sep', 'aria-hidden': 'true' }),
          h('button', { type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--secondary', onClick: () => setTutorial(true) }, t('tutorial.button')),
          h('span', { className: 'cs-editor-toolbar-status' }, t('editor.nativeTitle')),
          h('button', { type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--secondary', onClick: attemptClose, disabled: saving }, t('editor.close')))
        : h('div', { className: 'cs-editor-toolbar' },
          h('button', { type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--secondary', onClick: () => chooseCanvas(true) }, t('editor.native')),
          h('span', { className: 'cs-editor-toolbar-sep', 'aria-hidden': 'true' }),
          h('button', { type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--secondary', onClick: () => { void openPalette(); } }, t('editor.addNode')),
          h('button', { type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--secondary', 'aria-label': t('editor.zoomOut'), onClick: () => zoomBy(1 / 1.2) }, '－'),
          h('span', { className: 'cs-editor-zoom' }, `${Math.round(view.scale * 100)}%`),
          h('button', { type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--secondary', 'aria-label': t('editor.zoomIn'), onClick: () => zoomBy(1.2) }, '＋'),
          h('button', { type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--secondary', onClick: fitView }, t('editor.fit')),
          h('span', { className: 'cs-editor-toolbar-sep', 'aria-hidden': 'true' }),
          h('button', {
            type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--secondary',
            onClick: deleteSelection, disabled: selection === null,
          }, t('editor.deleteSelection')),
          h('span', { className: 'cs-editor-toolbar-sep', 'aria-hidden': 'true' }),
          h('button', { type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--secondary', onClick: () => setTutorial(true) }, t('tutorial.button')),
          h('span', { className: 'cs-editor-toolbar-status' }, t('editor.nodeCount', { count: String(doc.nodes.length) }))),
      error === '' ? null : h('div', { className: 'cs-editor-error' }, error),
      nativeCanvas
        ? h('iframe', {
          className: 'cs-editor-native',
          src: props.baseUrl,
          title: t('editor.nativeTitle'),
          allow: 'clipboard-read; clipboard-write',
        })
        : h('div', {
        ref: canvasRef,
        className: canvasClassName,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel: cancelPointer,
        onContextMenu,
        onDoubleClick: (event) => {
          const target = event.target instanceof Element ? event.target : null;
          const nodeEl = target === null ? null : target.closest('[data-node-id]');
          if (nodeEl !== null) setInspectorId(Number(nodeEl.getAttribute('data-node-id')));
        },
        style: {
          backgroundSize: `${Math.max(8, 24 * view.scale)}px ${Math.max(8, 24 * view.scale)}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        },
      },
      h('div', {
        className: 'cs-editor-layer',
        style: { transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` },
      },
      revealed
        ? h(Fragment, null,
          h('svg', { className: 'cs-editor-links', 'aria-hidden': 'true' },
            links.map((link) => h('g', { key: `l${link.id}` },
              h('path', { className: 'cs-link-path' + (link.selected ? ' cs-link-path--selected' : ''), d: link.path, 'data-link-id': String(link.id) }),
              h('path', { className: 'cs-link-hit', d: link.path, 'data-link-id': String(link.id) }))),
            draft === null ? null : h('path', { className: 'cs-link-draft', d: draftPath })),
          orderedNodes.map(renderNode))
        : null),
      menu === null ? null : h('div', {
        className: 'cs-editor-menu',
        style: { left: `${menu.x}px`, top: `${menu.y}px` },
        onPointerDown: (event) => event.stopPropagation(),
        onContextMenu: (event) => event.preventDefault(),
      },
      menu.nodeId === null
        ? (menu.linkId === null
          ? h(Fragment, null,
            h('button', {
              type: 'button',
              onClick: () => {
                const point = menuWorldPoint();
                setMenu(null);
                void openPalette(point);
              },
            }, t('editor.addNode')),
            h('button', { type: 'button', onClick: () => { setMenu(null); fitView(); } }, t('editor.fit')))
          : h('button', {
            type: 'button', className: 'cs-menu-danger',
            onClick: () => {
              const linkId = menu.linkId;
              setMenu(null);
              setDoc((previous) => removeWorkflowLink(previous, linkId));
              setSelection(null);
              setDirty(true);
            },
          }, t('editor.deleteLink')))
        : (() => {
          const node = findWorkflowNode(doc, menu.nodeId);
          const bypassed = node !== null && Number(node.mode) === 4;
          return h(Fragment, null,
            h('button', {
              type: 'button',
              onClick: () => { const id = menu.nodeId; setMenu(null); setInspectorId(id); },
            }, t('editor.editNode')),
            h('button', {
              type: 'button',
              onClick: () => { const point = menuWorldPoint(); setMenu(null); void openPalette(point); },
            }, t('editor.addNode')),
            h('button', {
              type: 'button',
              onClick: () => { const id = menu.nodeId; setMenu(null); toggleBypass(id); },
            }, bypassed ? t('editor.bypassed') : t('editor.bypass')),
            h('div', { className: 'cs-editor-menu-sep' }),
            h('button', {
              type: 'button', className: 'cs-menu-danger',
              onClick: () => {
                const id = menu.nodeId;
                setMenu(null);
                setDoc((previous) => removeWorkflowNode(previous, id));
                setSelection(null);
                setInspectorId((current) => (current === id ? null : current));
                setDirty(true);
              },
            }, t('editor.deleteNode')));
        })()),
      (() => {
        const node = inspectorId === null ? null : findWorkflowNode(doc, inspectorId);
        if (node === null) return null;
        const info = docs !== null ? (docs[String(node.type)] ?? null) : null;
        const model = editorRowsOf(node, info);
        const widgetRows = model.rows.filter((row) => row.kind === 'widget' && row.slot !== null);
        const sockets = model.rows.filter((row) => row.kind === 'input' || row.kind === 'output');
        const body = h('div', { className: 'cs-inspector-body' },
          h('div', { className: 'cs-inspector-row' },
            h('span', { className: 'cs-inspector-label' }, t('editor.titleField')),
            h('input', {
              className: 'cs-widget',
              value: String(node.title ?? ''),
              placeholder: String(node.type ?? ''),
              spellCheck: false,
              onChange: (event) => updateNodeTitle(node.id, event.target.value),
            })),
          widgetRows.map((row) => h('div', { key: `w:${row.slot.name}`, className: 'cs-inspector-row' },
            h('span', { className: 'cs-inspector-label', title: row.slot.name }, row.slot.name),
            h('div', { className: 'cs-inline' }, renderWidgetInput(node, row.slot, model.slots), renderWidgetControl(node, row.slot)))),
          sockets.length === 0 ? null : h('div', { className: 'cs-inspector-sockets' },
            h('span', { className: 'cs-inspector-label' }, t('editor.sockets')),
            sockets.map((row) => h('div', { key: `s:${row.kind}:${row.slotIndex}`, className: 'cs-inspector-socket' },
              h('i', { 'aria-hidden': 'true' }),
              h('span', null, `${row.kind === 'input' ? '←' : '→'} ${String((row.kind === 'input' ? row.input?.localized_name ?? row.input?.name : row.output?.localized_name ?? row.output?.name) ?? '')} · ${String((row.kind === 'input' ? row.input?.type : row.output?.type) ?? '')}`)))));
        const actions = h('div', { className: 'cs-inspector-actions' },
          h('button', {
            type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--secondary',
            onClick: () => toggleBypass(node.id),
          }, Number(node.mode) === 4 ? t('editor.bypassed') : t('editor.bypass')),
          h('button', {
            type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--ghost cs-btn--danger',
            onClick: () => {
              const id = node.id;
              setDoc((previous) => removeWorkflowNode(previous, id));
              setSelection(null);
              setInspectorId(null);
              setDirty(true);
            },
          }, t('editor.deleteNode')));
        return h('div', {
          className: 'cs-editor-inspector',
          onPointerDown: (event) => event.stopPropagation(),
          onContextMenu: (event) => event.preventDefault(),
        },
        h('div', { className: 'cs-inspector-head' },
          h('span', { className: 'cs-inspector-title', title: String(node.type ?? '') }, nodeLabel(node, t) || String(node.type ?? '')),
          h('button', { type: 'button', className: 'cs-node-del', 'aria-label': t('editor.close'), onClick: () => setInspectorId(null) }, '×')),
        body,
        actions);
      })(),
      docs === null ? h('div', { className: 'cs-editor-loading' }, t('editor.loading')) : null,
      paletteOpen ? h('div', { className: 'cs-editor-palette', onPointerDown: (event) => event.stopPropagation() },
        h('div', { className: 'cs-editor-palette-head' },
          h('span', null, t('editor.addNode')),
          h('button', { type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--ghost', 'aria-label': t('editor.cancel'), onClick: () => setPalette(null) }, '×')),
        h('input', {
          className: 'cs-editor-search',
          value: palette.query,
          placeholder: t('editor.searchNodes'),
          spellCheck: false,
          autoFocus: true,
          onChange: (event) => setPalette((previous) => (previous === null ? previous : { ...previous, query: event.target.value })),
        }),
        h('div', { className: 'cs-editor-palette-list' },
          palette.busy
            ? h('p', { className: 'cs-hint' }, t('editor.loading'))
            : catalogItems.length === 0
              ? h('p', { className: 'cs-hint' }, t('editor.emptyCatalog'))
              : catalogItems.map((entry) => h('button', {
                key: entry.type,
                type: 'button',
                className: 'cs-palette-item',
                onClick: () => { void addNode(entry.type); },
              },
              h('span', { className: 'cs-palette-name' }, entry.display),
              h('span', { className: 'cs-palette-cat' }, entry.category))))) : null),
      tutorial ? h('div', {
        className: 'cs-tutorial-backdrop',
        onClick: (event) => { if (event.target === event.currentTarget) closeTutorial(); },
      },
      h('div', { className: 'cs-tutorial', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('tutorial.title') },
        h('div', { className: 'cs-tutorial-head' },
          h('h3', null, t('tutorial.title')),
          h('button', { type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--ghost', onClick: closeTutorial, 'aria-label': t('tutorial.close') }, '×')),
        h('div', { className: 'cs-tutorial-body' },
          h('div', { className: 'cs-tutorial-item' }, h('b', null, t('tutorial.gesturesTitle')), h('p', null, t('tutorial.gestures'))),
          h('div', { className: 'cs-tutorial-item' }, h('b', null, t('tutorial.nodesTitle')), h('p', null, t('tutorial.nodes'))),
          h('div', { className: 'cs-tutorial-item' }, h('b', null, t('tutorial.menuTitle')), h('p', null, t('tutorial.menu'))),
          h('div', { className: 'cs-tutorial-item' }, h('b', null, t('tutorial.loraTitle')), h('p', null, t('tutorial.lora'))),
          h('div', { className: 'cs-tutorial-item' }, h('b', null, t('tutorial.nativeTitle')), h('p', null, t('tutorial.native'))),
          h('div', { className: 'cs-tutorial-item' }, h('b', null, t('tutorial.saveTitle')), h('p', null, t('tutorial.save')))),
        h('div', { className: 'cs-tutorial-actions' },
          h('button', { type: 'button', className: 'cs-btn cs-btn--primary', onClick: closeTutorial }, t('tutorial.start'))))) : null);
    }

    /**
     * Catch render errors so the panel never collapses to a blank page.
     */
    class PanelErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { failed: false, error: null };
      }

      static getDerivedStateFromError(error) {
        return { failed: true, error };
      }

      componentDidCatch(error, info) {
        console.error('[comfyui-panel]', error, info);
      }

      render() {
        if (!this.state.failed) return this.props.children;
        const t = this.props.t;
        const error = this.state.error;
        return h(Fragment, null,
          h('style', { key: 'css' }, CSS),
          h('div', { className: 'cs-crash' },
            h('h2', null, t('crash.title')),
            h('p', null, t('crash.desc')),
            error === null || error === undefined ? null : h('pre', { className: 'cs-crash-detail' },
              String(error?.stack ?? error?.message ?? error)),
            h('button', {
              type: 'button',
              className: 'cs-btn cs-btn--secondary',
              onClick: () => { if (typeof window !== 'undefined') window.location.reload(); },
            }, t('crash.reload'))));
      }
    }

    /**
     * The main-column studio page.
     * @param {{ ctx: any, t: (key: string, params?: Record<string, string | number>) => string }} props slot props.
     * @returns {React.ReactElement} page element.
     */
    function StudioPanel(props) {
      const ctx = props.ctx;
      const t = props.t;
      useLocaleTick(ctx);

      const settingsRef = React.useRef(readSettings());
      const [baseUrl, setBaseUrl] = React.useState('');
      const [status, setStatus] = React.useState('loading');
      const [snapshot, setSnapshot] = React.useState(null);
      const [live, setLive] = React.useState(null);
      const [workflows, setWorkflows] = React.useState(null);
      const [workflowsBusy, setWorkflowsBusy] = React.useState(false);
      const [selected, setSelected] = React.useState(null);
      const [workflowInfo, setWorkflowInfo] = React.useState(null);
      const [workflowBusy, setWorkflowBusy] = React.useState(false);
      const [workflowReload, setWorkflowReload] = React.useState(0);
      const [form, setForm] = React.useState({ ...DEFAULT_FORM });
      const [results, setResults] = React.useState([]);
      const [previewKey, setPreviewKey] = React.useState(null);
      const [job, setJob] = React.useState(null);
      const [now, setNow] = React.useState(Date.now());
      const [lastDoneAt, setLastDoneAt] = React.useState(null);
      const [busy, setBusy] = React.useState('');
      const [rewriteBusy, setRewriteBusy] = React.useState(false);
      const [zhBusy, setZhBusy] = React.useState(false);
      const [zhRef, setZhRef] = React.useState(null);
      const [toast, setToast] = React.useState(null);
      const [dialog, setDialog] = React.useState(null);
      const [leftWidth, setLeftWidth] = React.useState(settingsRef.current.leftWidth);
      const [editor, setEditor] = React.useState(null);
      const [lightboxKey, setLightboxKey] = React.useState(null);
      const [lightboxBusy, setLightboxBusy] = React.useState(false);
      const [resizing, setResizing] = React.useState(false);
      const [loraDraft, setLoraDraft] = React.useState([]);
      const [loraOptions, setLoraOptions] = React.useState(null);
      const [connectionError, setConnectionError] = React.useState('');
      const [addressDraft, setAddressDraft] = React.useState('');
      const [offlineAttempts, setOfflineAttempts] = React.useState(0);
      const [offlineRetrying, setOfflineRetrying] = React.useState(false);
      const [offlineShown, setOfflineShown] = React.useState(false);
      const [coldLoading, setColdLoading] = React.useState(false);

      const jobRef = React.useRef(null);
      const urls = React.useRef(new Map());
      const inflight = React.useRef(new Set());
      const mounted = React.useRef(true);
      const selectedRef = React.useRef(selected);
      const formRef = React.useRef(form);
      const leftWidthRef = React.useRef(leftWidth);
      const bodyRef = React.useRef(null);
      const promptRef = React.useRef(null);
      const loraDraftRef = React.useRef([]);
      const resultsRef = React.useRef([]);
      const toastTimer = React.useRef(null);

      React.useEffect(() => {
        jobRef.current = job;
      }, [job]);
      React.useEffect(() => {
        selectedRef.current = selected;
      }, [selected]);
      React.useEffect(() => {
        formRef.current = form;
      }, [form]);
      React.useEffect(() => {
        leftWidthRef.current = leftWidth;
      }, [leftWidth]);
      React.useEffect(() => {
        resultsRef.current = results;
      }, [results]);
      React.useEffect(() => {
        loraDraftRef.current = loraDraft;
      }, [loraDraft]);
      React.useEffect(() => () => {
        mounted.current = false;
        for (const url of urls.current.values()) URL.revokeObjectURL(url);
        urls.current.clear();
      }, []);

      /**
       * @param {Record<string, any>} patch settings patch.
       * @returns {void}
       */
      const updateSettings = React.useCallback((patch) => {
        settingsRef.current = { ...settingsRef.current, ...patch };
        writeSettings(settingsRef.current);
      }, []);

      /**
       * Show one transient toast (auto-dismissed).
       * @param {'ok' | 'warn' | 'error'} kind tone.
       * @param {string} text message.
       * @returns {void}
       */
      const notify = React.useCallback((kind, text) => {
        setToast({ kind, text, id: Date.now() });
        if (toastTimer.current !== null) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 7000);
      }, []);

      /**
       * Open the details dialog.
       * @param {string} title dialog title.
       * @param {string[]} items dialog rows.
       * @returns {void}
       */
      const openDialog = React.useCallback((title, items) => {
        setDialog({ title, items: Array.isArray(items) ? items : [] });
      }, []);

      React.useEffect(() => () => {
        if (toastTimer.current !== null) clearTimeout(toastTimer.current);
      }, []);

      /**
       * Persist the current form as this workflow's remembered edits.
       * @param {string | null} workflowId workflow name.
       * @param {Record<string, any>} nextForm form to store.
       * @returns {void}
       */
      const saveOverride = React.useCallback((workflowId, nextForm) => {
        if (typeof workflowId !== 'string' || workflowId === '') return;
        const overrides = { ...settingsRef.current.overrides };
        overrides[workflowId] = {
          positive: nextForm.positive,
          negative: nextForm.negative,
          steps: nextForm.steps,
          cfg: nextForm.cfg,
          seed: nextForm.seed,
          seedControl: nextForm.seedControl,
          loras: Array.isArray(nextForm.loras) ? nextForm.loras : loraDraftRef.current,
          sampler: nextForm.sampler,
          scheduler: nextForm.scheduler,
          width: nextForm.width,
          height: nextForm.height,
          batchSize: nextForm.batchSize,
        };
        const entries = Object.entries(overrides);
        const trimmed = entries.length > 40 ? Object.fromEntries(entries.slice(entries.length - 40)) : overrides;
        updateSettings({ overrides: trimmed });
      }, [updateSettings]);

      /**
       * Remember which seed produced each output file (bounded last 200).
       * @param {string[]} keys result keys.
       * @param {unknown} seed submitted seed.
       * @returns {void}
       */
      const rememberSeeds = React.useCallback((keys, seed) => {
        const value = Number(seed);
        if (!Number.isFinite(value)) return;
        const seeds = { ...(settingsRef.current.seeds !== null && typeof settingsRef.current.seeds === 'object' ? settingsRef.current.seeds : {}) };
        for (const key of keys) seeds[key] = value;
        const entries = Object.entries(seeds);
        if (entries.length > 200) {
          for (const [key] of entries.slice(0, entries.length - 200)) delete seeds[key];
        }
        updateSettings({ seeds });
      }, [updateSettings]);

      /**
       * Merge `/state.outputs` into the result list (newest first).
       * @param {Array<any>} outputs host output entries.
       * @returns {void}
       */
      const ingestOutputs = React.useCallback((outputs) => {
        if (!Array.isArray(outputs) || outputs.length === 0) return;
        setResults((previous) => {
          const seen = new Set(previous.map((entry) => entry.key));
          const next = [];
          for (const output of outputs) {
            const images = Array.isArray(output?.images) ? output.images : [];
            for (const image of images) {
              if (image === null || typeof image !== 'object' || typeof image.filename !== 'string') continue;
              if (!/\.(png|jpe?g|webp|gif)$/i.test(image.filename)) continue;
              const key = `${image.filename}|${image.subfolder ?? ''}|${image.type ?? 'output'}`;
              if (seen.has(key)) continue;
              seen.add(key);
              const remembered = settingsRef.current.seeds !== null && typeof settingsRef.current.seeds === 'object' ? settingsRef.current.seeds[key] : undefined;
              const historySeed = Number.isFinite(Number(output?.seed)) ? Number(output.seed) : null;
              next.push({
                key,
                filename: image.filename,
                subfolder: typeof image.subfolder === 'string' ? image.subfolder : '',
                type: typeof image.type === 'string' ? image.type : 'output',
                seed: historySeed !== null ? historySeed : (Number.isFinite(Number(remembered)) ? Number(remembered) : null),
                url: null,
                error: null,
              });
            }
          }
          if (next.length === 0) return previous;
          return next.concat(previous).slice(0, 60);
        });
      }, []);

      /**
       * Load the state snapshot for one address.
       * @param {string} base server address.
       * @returns {Promise<void>}
       */
      const loadState = React.useCallback(async (base) => {
        try {
          const data = await requestJson(withQuery('/state', { base }));
          if (!mounted.current) return;
          setSnapshot(data);
          if (data.online === true) {
            setStatus('online');
            setConnectionError('');
            setOfflineAttempts(0);
            ingestOutputs(data.outputs);
          } else {
            setStatus('offline');
            setConnectionError(typeof data.error === 'string' && data.error !== '' ? data.error : '');
          }
        } catch (error) {
          if (!mounted.current) return;
          setStatus('offline');
          setConnectionError(describeError(error));
        }
      }, [ingestOutputs, t]);

      /**
       * Load the saved workflow list and restore the remembered selection.
       * @param {string} base server address.
       * @returns {Promise<void>}
       */
      const loadWorkflowList = React.useCallback(async (base) => {
        setWorkflowsBusy(true);
        try {
          const data = await requestJson(withQuery('/workflows', { base }));
          if (!mounted.current) return;
          const list = Array.isArray(data.workflows) ? data.workflows : [];
          const images = list.filter((entry) => entry.outputKind === 'image' && entry.hasSubgraph !== true);
          setWorkflows(list);
          const saved = settingsRef.current.workflow;
          let next = null;
          if (saved !== '' && images.some((entry) => entry.name === saved)) next = saved;
          else {
            const supportedEntry = images.find((entry) => entry.supported === true);
            next = supportedEntry === undefined ? (images[0]?.name ?? null) : supportedEntry.name;
          }
          setSelected(next);
        } catch (error) {
          if (!mounted.current) return;
          setWorkflows([]);
          notify('error', t('banner.workflows', { message: describeError(error) }));
        } finally {
          if (mounted.current) setWorkflowsBusy(false);
        }
      }, [t]);

      // First load: read the host default address.
      React.useEffect(() => {
        let cancelled = false;
        (async () => {
          try {
            const config = await requestJson('/config');
            if (cancelled) return;
            const hostDefault = typeof config.defaultBaseUrl === 'string' ? config.defaultBaseUrl : '';
            let saved = settingsRef.current.baseUrl;
            // 0.3.1 briefly auto-probed localhost:8000 for the old Desktop
            // assumption; drop that saved value so it does not stick forever.
            if (/^https?:\/\/(?:127\.0\.0\.1|localhost):8000\/?$/i.test(saved)) {
              updateSettings({ baseUrl: '' });
              saved = '';
            }
            const next = typeof saved === 'string' && saved !== '' ? saved : hostDefault;
            setAddressDraft(next);
            if (next !== '') setBaseUrl(next);
          } catch (error) {
            if (!cancelled) notify('error', t('banner.offline', { message: describeError(error) }));
          }
        })();
        return () => {
          cancelled = true;
        };
      }, []);

      React.useEffect(() => { setAddressDraft(baseUrl); }, [baseUrl]);

      // Address ready: load state and workflows, then poll state.
      React.useEffect(() => {
        if (baseUrl === '') return undefined;
        setSnapshot(null);
        setLive(null);
        setStatus('loading');
        setWorkflowInfo(null);
        setSelected(null);
        setResults([]);
        setPreviewKey(null);
        setJob(null);
        setLastDoneAt(null);
        void loadState(baseUrl);
        void loadWorkflowList(baseUrl);
        const timer = setInterval(() => {
          if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void loadState(baseUrl);
        }, STATE_MS);
        return () => clearInterval(timer);
      }, [baseUrl, loadState, loadWorkflowList]);

      // While offline, retry the state endpoint every 5 seconds (the overlay
      // also says so), and reload the workflow list once the server is back.
      const wasOfflineRef = React.useRef(false);
      React.useEffect(() => {
        if (status !== 'offline' || baseUrl === '') return undefined;
        const timer = setInterval(() => {
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
          setOfflineAttempts((value) => value + 1);
          void loadState(baseUrl);
        }, 5000);
        return () => clearInterval(timer);
      }, [status, baseUrl, loadState]);
      React.useEffect(() => {
        if (status === 'offline') {
          wasOfflineRef.current = true;
          return;
        }
        if (status === 'online' && wasOfflineRef.current) {
          wasOfflineRef.current = false;
          void loadWorkflowList(baseUrl);
          setWorkflowReload((value) => value + 1);
        }
      }, [status, baseUrl, loadWorkflowList]);

      // Overlay timing: show the offline card only if the outage lasts.
      React.useEffect(() => {
        if (status !== 'offline') {
          setOfflineShown(false);
          return undefined;
        }
        const timer = setTimeout(() => setOfflineShown(true), 900);
        return () => clearTimeout(timer);
      }, [status]);
      React.useEffect(() => {
        if (!(status === 'loading' && snapshot === null)) {
          setColdLoading(false);
          return undefined;
        }
        const timer = setTimeout(() => setColdLoading(true), 700);
        return () => clearTimeout(timer);
      }, [status, snapshot]);

      // Live hardware/activity polling.
      React.useEffect(() => {
        if (baseUrl === '') return undefined;
        let stopped = false;
        let timer = null;
        const tick = async () => {
          if (!stopped && (typeof document === 'undefined' || document.visibilityState !== 'hidden')) {
            try {
              const data = await requestJson(withQuery('/live', { base: baseUrl }));
              if (!stopped && mounted.current) {
                setLive(data);
                setStatus(data.online === true ? 'online' : 'offline');
              }
            } catch {
              if (!stopped && mounted.current) setStatus('offline');
            }
          }
          if (!stopped) timer = setTimeout(tick, LIVE_MS);
        };
        void tick();
        return () => {
          stopped = true;
          if (timer !== null) clearTimeout(timer);
        };
      }, [baseUrl]);

      /**
       * @param {string} name workflow name.
       * @param {any} data `/workflow` response.
       * @returns {void}
       */
      const applyWorkflowForm = React.useCallback((name, data) => {
        const params = data !== null && typeof data === 'object' && data.params !== null && typeof data.params === 'object' ? data.params : {};
        const sampler = params.sampler ?? {};
        const latent = params.latent ?? {};
        const saved = settingsRef.current.overrides[name] ?? {};
        setForm({
          positive: typeof saved.positive === 'string' ? saved.positive : typeof params.positive?.text === 'string' ? params.positive.text : '',
          negative: typeof saved.negative === 'string' ? saved.negative : typeof params.negative?.text === 'string' ? params.negative.text : '',
          steps: saved.steps ?? sampler.steps ?? DEFAULT_FORM.steps,
          cfg: saved.cfg ?? sampler.cfg ?? DEFAULT_FORM.cfg,
          seed: saved.seed ?? sampler.seed ?? randomSeed(),
          seedControl: typeof saved.seedControl === 'string' && SEED_CONTROL_VALUES.includes(saved.seedControl) ? saved.seedControl : (typeof sampler.seedControl === 'string' && SEED_CONTROL_VALUES.includes(sampler.seedControl) ? sampler.seedControl : 'randomize'),
          sampler: saved.sampler ?? sampler.sampler ?? DEFAULT_FORM.sampler,
          scheduler: saved.scheduler ?? sampler.scheduler ?? DEFAULT_FORM.scheduler,
          width: saved.width ?? latent.width ?? DEFAULT_FORM.width,
          height: saved.height ?? latent.height ?? DEFAULT_FORM.height,
          batchSize: saved.batchSize ?? latent.batchSize ?? DEFAULT_FORM.batchSize,
        });
        const graph = data !== null && typeof data === 'object' ? data.graph : null;
        setLoraDraft(loraNodesOf(graph, saved.loras));
      }, []);

      // Load the LoRA file list once a workflow with LoRA loaders is selected.
      React.useEffect(() => {
        if (baseUrl === '' || selected === null || workflowInfo === null) {
          setLoraOptions(null);
          return undefined;
        }
        const types = [...new Set(loraNodesOf(workflowInfo.graph, []).map((entry) => entry.type))];
        if (types.length === 0) {
          setLoraOptions(null);
          return undefined;
        }
        let cancelled = false;
        setLoraOptions(null);
        (async () => {
          try {
            const data = await requestJson(withQuery('/object-info', { base: baseUrl, types: types.join(',') }));
            if (cancelled || !mounted.current) return;
            const names = new Set();
            for (const doc of Object.values(data.docs ?? {})) {
              const spec = doc?.input?.required?.lora_name;
              for (const choice of Array.isArray(spec?.[0]) ? spec[0] : []) {
                if (typeof choice === 'string' && choice !== '') names.add(choice);
              }
            }
            if (!cancelled && mounted.current) setLoraOptions([...names]);
          } catch {
            if (!cancelled && mounted.current) setLoraOptions([]);
          }
        })();
        return () => { cancelled = true; };
      }, [baseUrl, selected, workflowInfo]);

      // Selected workflow → load converted params and apply remembered edits.
      React.useEffect(() => {
        if (baseUrl === '' || selected === null) {
          setWorkflowInfo(null);
          return undefined;
        }
        let cancelled = false;
        setWorkflowBusy(true);
        setWorkflowInfo(null);
        (async () => {
          try {
            const data = await requestJson(withQuery('/workflow', { base: baseUrl, name: selected }));
            if (cancelled || !mounted.current) return;
            setWorkflowInfo(data);
            applyWorkflowForm(selected, data);
            if (data.supported !== true && Array.isArray(data.reasons) && data.reasons.length > 0) {
              setDialog({ title: t('dialog.reasons'), items: data.reasons });
            }
          } catch (error) {
            if (cancelled || !mounted.current) return;
            setWorkflowInfo(null);
            notify('error', t('banner.workflow', { message: describeError(error) }));
          } finally {
            if (!cancelled && mounted.current) setWorkflowBusy(false);
          }
        })();
        return () => {
          cancelled = true;
        };
      }, [selected, baseUrl, workflowReload, applyWorkflowForm, t]);

      // Keep sampler/scheduler choices inside the server's lists.
      React.useEffect(() => {
        const models = snapshot !== null && snapshot.models !== null && typeof snapshot.models === 'object' ? snapshot.models : null;
        if (models === null) return;
        const samplers = Array.isArray(models.samplers) ? models.samplers : [];
        const schedulers = Array.isArray(models.schedulers) ? models.schedulers : [];
        if (samplers.length === 0 && schedulers.length === 0) return;
        setForm((previous) => {
          const next = { ...previous };
          let changed = false;
          if (samplers.length > 0 && !samplers.includes(next.sampler)) {
            next.sampler = samplers[0];
            changed = true;
          }
          if (schedulers.length > 0 && !schedulers.includes(next.scheduler)) {
            next.scheduler = schedulers[0];
            changed = true;
          }
          return changed ? next : previous;
        });
      }, [snapshot]);

      // Thumbnail loading through the Host proxy, with blob URLs owned by the panel.
      React.useEffect(() => {
        if (baseUrl === '') return;
        const pending = results.filter((entry) => entry.url === null && entry.error === null && !inflight.current.has(entry.key));
        for (const entry of pending) {
          inflight.current.add(entry.key);
          const path = withQuery('/view', { base: baseUrl, filename: entry.filename, subfolder: entry.subfolder, type: entry.type });
          (async () => {
            try {
              const response = await fetch(BASE + path, { cache: 'no-store' });
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const blob = await response.blob();
              const objectUrl = URL.createObjectURL(blob);
              if (!mounted.current || !resultsRef.current.some((item) => item.key === entry.key)) {
                URL.revokeObjectURL(objectUrl);
                return;
              }
              urls.current.set(entry.key, objectUrl);
              setResults((previous) => previous.map((item) => (item.key === entry.key ? { ...item, url: objectUrl } : item)));
            } catch (error) {
              if (mounted.current) {
                setResults((previous) => previous.map((item) => (item.key === entry.key ? { ...item, error: messageOf(error) } : item)));
              }
            } finally {
              inflight.current.delete(entry.key);
            }
          })();
        }
      }, [results, baseUrl]);

      // Reclaim blob URLs for results that are no longer listed.
      React.useEffect(() => {
        const keys = new Set(results.map((entry) => entry.key));
        for (const [key, url] of urls.current) {
          if (keys.has(key)) continue;
          URL.revokeObjectURL(url);
          urls.current.delete(key);
        }
      }, [results]);

      // Default the preview to the newest result and keep it valid.
      React.useEffect(() => {
        setPreviewKey((current) => {
          if (results.length === 0) return null;
          if (current !== null && results.some((entry) => entry.key === current)) return current;
          return results[0].key;
        });
      }, [results]);

      // Escape closes the details dialog.
      React.useEffect(() => {
        if (dialog === null) return undefined;
        const onKey = (event) => {
          if (event.key === 'Escape') setDialog(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [dialog]);

      // Job polling and elapsed clock.
      React.useEffect(() => {
        const active = job !== null && (job.status === 'queued' || job.status === 'running');
        if (!active) return undefined;
        const interval = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(interval);
      }, [job === null ? null : job.status]);

      React.useEffect(() => {
        const id = job === null ? null : job.id;
        if (id === null) return undefined;
        let stopped = false;
        let timer = null;
        const tick = async () => {
          const current = jobRef.current;
          if (stopped || current === null || current.id !== id) return;
          if (current.status !== 'queued' && current.status !== 'running') return;
          try {
            const data = await requestJson(withQuery('/job', { base: baseUrl, id }));
            if (stopped) return;
            if (data.status === 'completed') {
              const images = Array.isArray(data.images) ? data.images : [];
              ingestOutputs([{ promptId: id, images }]);
              const keys = images
                .filter((image) => image !== null && typeof image === 'object' && typeof image.filename === 'string')
                .map((image) => `${image.filename}|${image.subfolder ?? ''}|${image.type ?? 'output'}`);
              const completedSeed = Number.isFinite(Number(data.seed)) ? Number(data.seed) : current.seed;
              if (keys.length > 0 && Number.isFinite(Number(completedSeed))) {
                rememberSeeds(keys, completedSeed);
                setResults((previous) => previous.map((entry) => (keys.includes(entry.key) ? { ...entry, seed: Number(completedSeed) } : entry)));
              }
              if (images.length > 0) {
                const first = images[0];
                setPreviewKey(`${first.filename}|${first.subfolder ?? ''}|${first.type ?? 'output'}`);
              }
              const doneAt = Date.now();
              setLastDoneAt(doneAt);
              setJob((previous) => (previous !== null && previous.id === id ? { ...previous, status: 'completed', images } : previous));
              void loadState(baseUrl);
              return;
            }
            if (data.status === 'error') {
              setJob((previous) => (previous !== null && previous.id === id ? { ...previous, status: 'error', error: typeof data.error === 'string' ? data.error : '' } : previous));
              notify('error', t('banner.generate', { message: data.error ?? t('job.error') }));
              return;
            }
            if (data.status === 'missing') {
              if (Date.now() - current.startedAt > JOB_MISSING_GRACE_MS) {
                setJob((previous) => (previous !== null && previous.id === id ? { ...previous, status: 'error', error: t('job.error') } : previous));
                return;
              }
            } else {
              setJob((previous) => (previous !== null && previous.id === id
                ? { ...previous, status: data.status, position: typeof data.position === 'number' ? data.position : null }
                : previous));
            }
          } catch (error) {
            if (!stopped) notify('error', t('banner.generate', { message: describeError(error) }));
          }
          if (!stopped) timer = setTimeout(tick, JOB_POLL_MS);
        };
        timer = setTimeout(tick, 500);
        return () => {
          stopped = true;
          if (timer !== null) clearTimeout(timer);
        };
      }, [job === null ? null : job.id, baseUrl, ingestOutputs, loadState, t]);

      /**
       * @param {string} name form field.
       * @param {unknown} value new value.
       * @returns {void}
       */
      const setField = (name, value) => setForm((previous) => ({ ...previous, [name]: value }));

      /**
       * Patch one LoRA row and remember it with the workflow.
       * @param {string} nodeId loader node id.
       * @param {Record<string, unknown>} patch changed fields.
       * @returns {void}
       */
      const updateLora = (nodeId, patch) => {
        const next = loraDraftRef.current.map((entry) => (entry.nodeId === nodeId ? { ...entry, ...patch } : entry));
        loraDraftRef.current = next;
        setLoraDraft(next);
        saveOverride(selectedRef.current, { ...formRef.current, loras: next });
      };

      /**
       * Select one workflow and remember the current form first.
       * @param {string} name workflow name.
       * @returns {void}
       */
      const selectWorkflow = (name) => {
        if (typeof name !== 'string' || name === '' || name === selectedRef.current) return;
        saveOverride(selectedRef.current, formRef.current);
        updateSettings({ workflow: name });
        setSelected(name);
        setWorkflowInfo(null);
      };

      /**
       * @returns {Promise<void>}
       */
      const refreshAll = async () => {
        if (baseUrl === '') return;
        await loadWorkflowList(baseUrl);
        setWorkflowReload((value) => value + 1);
        void loadState(baseUrl);
      };

      /**
       * Rewrite one text with the Host-side AI.
       * @param {string} text source text.
       * @returns {Promise<string>} rewritten prompt.
       */
      const rewrite = async (text) => {
        if (String(text).trim() === '') throw new Error(t('prompt.rewriteEmpty'));
        const kind = workflowInfo !== null && (workflowInfo.modelKind === 'natural' || workflowInfo.modelKind === 'both') ? workflowInfo.modelKind : 'tags';
        const data = await requestJson('/rewrite', { method: 'POST', body: { text, kind } });
        if (typeof data.text !== 'string' || data.text.trim() === '') throw new Error(t('prompt.rewriteEmpty'));
        return data.text.trim();
      };

      /**
       * @returns {Promise<void>}
       */
      const manualRewrite = async () => {
        if (rewriteBusy) return;
        setRewriteBusy(true);
        try {
          const text = await rewrite(formRef.current.positive);
          setForm((previous) => ({ ...previous, positive: text }));
        } catch (error) {
          notify('error', t('banner.rewrite', { message: describeError(error) }));
        } finally {
          setRewriteBusy(false);
        }
      };

      /**
       * Translate the positive prompt into Chinese for reference.
       * @returns {Promise<void>}
       */
      const translateReference = async () => {
        if (zhBusy) return;
        const text = formRef.current.positive.trim();
        if (text === '') {
          notify('warn', t('ref.emptyPrompt'));
          return;
        }
        setZhBusy(true);
        try {
          const data = await requestJson('/rewrite', { method: 'POST', body: { text, kind: 'zh' } });
          if (typeof data.text === 'string' && data.text.trim() !== '') setZhRef({ text: data.text.trim(), source: text });
        } catch (error) {
          notify('error', t('banner.rewrite', { message: describeError(error) }));
        } finally {
          setZhBusy(false);
        }
      };

      /**
       * @returns {Promise<void>}
       */
      const generate = async () => {
        if (busy !== '' || status !== 'online') {
          if (status !== 'online') notify('error', t('hint.offline'));
          return;
        }
        const workflow = selectedRef.current;
        if (workflow === null) {
          notify('error', t('hint.selectWorkflow'));
          return;
        }
        if (workflowInfo === null || workflowInfo.supported !== true) {
          notify('error', t('hint.notRunnable'));
          return;
        }
        const current = formRef.current;
        setBusy('generate');
        try {
          const positive = current.positive;
          const seed = nextSeedValue(current.seed, current.seedControl);
          const overrides = {
            positive,
            negative: current.negative,
            steps: current.steps,
            cfg: current.cfg,
            seed,
            sampler: current.sampler,
            scheduler: current.scheduler,
            width: current.width,
            height: current.height,
            batchSize: current.batchSize,
          };
          if (loraDraftRef.current.length > 0) overrides.loras = loraDraftRef.current;
          const data = await requestJson('/generate', { method: 'POST', body: { base: baseUrl, workflow, overrides } });
          setForm((previous) => ({ ...previous, seed }));
          saveOverride(workflow, { ...current, positive, seed });
          const startedAt = Date.now();
          setNow(startedAt);
          setJob({ id: data.promptId, startedAt, status: 'queued', position: null, images: [], error: '', seed });
        } catch (error) {
          notify('error', t('banner.generate', { message: describeError(error) }));
        } finally {
          setBusy('');
        }
      };

      /**
       * @returns {Promise<void>}
       */
      const interruptJob = async () => {
        if (busy !== '') return;
        setBusy('interrupt');
        try {
          await requestJson('/interrupt', { method: 'POST', body: { base: baseUrl } });
          setJob((previous) => (previous !== null && (previous.status === 'queued' || previous.status === 'running')
            ? { ...previous, status: 'cancelled' }
            : previous));
        } catch (error) {
          notify('error', t('banner.interrupt', { message: describeError(error) }));
        } finally {
          setBusy('');
        }
      };

      /**
       * @returns {void}
       */
      const backToConversation = () => {
        try {
          const layout = typeof ctx.get === 'function' ? ctx.get('layout') : undefined;
          if (layout !== undefined && typeof layout.selectPanel === 'function') layout.selectPanel(null);
        } catch (error) {
          notify('error', messageOf(error));
        }
      };

      /**
       * Reset the form to the workflow's own stored values.
       * @returns {void}
       */
      const resetForm = () => {
        const workflow = selectedRef.current;
        if (workflow === null) return;
        const overrides = { ...settingsRef.current.overrides };
        delete overrides[workflow];
        updateSettings({ overrides });
        if (workflowInfo !== null) applyWorkflowForm(workflow, workflowInfo);
      };

      /**
       * @param {number} delta preview step.
       * @returns {void}
       */
      const stepPreview = (delta) => {
        if (results.length === 0) return;
        const index = results.findIndex((entry) => entry.key === previewKey);
        const next = (index < 0 ? 0 : index) + delta;
        const wrapped = ((next % results.length) + results.length) % results.length;
        setPreviewKey(results[wrapped].key);
      };

      /**
       * Start dragging the splitter.
       * @param {React.PointerEvent} event pointer down.
       * @returns {void}
       */
      const startResize = (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = leftWidthRef.current;
        const container = bodyRef.current;
        const max = container === null ? MAX_LEFT : Math.max(MIN_LEFT, Math.min(MAX_LEFT, container.clientWidth - 360));
        let latest = startWidth;
        setResizing(true);
        const onMove = (moveEvent) => {
          latest = Math.max(MIN_LEFT, Math.min(max, startWidth + (moveEvent.clientX - startX)));
          setLeftWidth(latest);
        };
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          setResizing(false);
          updateSettings({ leftWidth: latest });
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      };

      /**
       * Keyboard resize of the splitter.
       * @param {React.KeyboardEvent} event key down.
       * @returns {void}
       */
      const onSplitterKey = (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const delta = event.key === 'ArrowLeft' ? -16 : 16;
        const next = Math.max(MIN_LEFT, Math.min(MAX_LEFT, leftWidthRef.current + delta));
        setLeftWidth(next);
        updateSettings({ leftWidth: next });
      };

      const online = status === 'online';
      const server = live !== null && live.online === true ? live.server : snapshot !== null && snapshot.online === true ? snapshot.server : null;
      const queue = live !== null && live.queue !== undefined ? live.queue : snapshot !== null && snapshot.queue !== undefined ? snapshot.queue : { running: 0, pending: 0 };
      const device = server !== null && Array.isArray(server.devices) && server.devices.length > 0 ? server.devices[0] : null;
      const vramUsed = device !== null && typeof device.vramTotal === 'number' && typeof device.vramFree === 'number' ? Math.max(0, device.vramTotal - device.vramFree) : null;
      const vramPercent = vramUsed !== null && device !== null && device.vramTotal > 0 ? Math.min(100, Math.round((vramUsed / device.vramTotal) * 100)) : null;
      const ramUsed = server !== null && typeof server.ramTotal === 'number' && server.ramTotal > 0 ? Math.max(0, server.ramTotal - (server.ramFree ?? 0)) : null;
      const ramPercent = ramUsed !== null && server.ramTotal > 0 ? Math.min(100, Math.round((ramUsed / server.ramTotal) * 100)) : null;
      const models = snapshot !== null && snapshot.models !== null && typeof snapshot.models === 'object' ? snapshot.models : { checkpoints: [], samplers: [], schedulers: [] };
      const samplers = Array.isArray(models.samplers) ? models.samplers : [];
      const schedulers = Array.isArray(models.schedulers) ? models.schedulers : [];
      const imageWorkflows = workflows === null ? [] : workflows.filter((workflow) => workflow.outputKind === 'image' && workflow.hasSubgraph !== true);
      const params = workflowInfo !== null && workflowInfo.params !== null && typeof workflowInfo.params === 'object' ? workflowInfo.params : null;
      const supported = workflowInfo !== null && workflowInfo.supported === true;
      const modelKind = workflowInfo !== null && (workflowInfo.modelKind === 'natural' || workflowInfo.modelKind === 'both') ? workflowInfo.modelKind : 'tags';
      const workflowReasons = workflowInfo !== null && Array.isArray(workflowInfo.reasons) ? workflowInfo.reasons : [];
      const workflowWarnings = workflowInfo !== null && Array.isArray(workflowInfo.warnings) ? workflowInfo.warnings : [];
      const promptEditable = supported && params !== null && params.positive !== null;
      const samplerEditable = supported && params !== null && params.sampler !== null;
      const latentEditable = supported && params !== null && params.latent !== null;
      const jobActive = job !== null && (job.status === 'queued' || job.status === 'running');
      const liveProgress = live !== null && live.progress !== null && typeof live.progress === 'object' ? live.progress : null;
      const progressRunning = liveProgress !== null && liveProgress.status === 'running';
      const progressPercent = progressRunning && Number.isFinite(liveProgress.percent) ? liveProgress.percent : 0;
      const progressValue = progressRunning && Number.isFinite(liveProgress.value) ? liveProgress.value : 0;
      const progressMax = progressRunning && Number.isFinite(liveProgress.max) ? liveProgress.max : 0;
      const gpuUtilization = liveProgress !== null && Number.isFinite(liveProgress.gpuUtilization) ? Math.round(liveProgress.gpuUtilization) : null;
      const gpuDisplayPercent = gpuUtilization !== null ? gpuUtilization : vramPercent;
      const elapsed = job !== null ? Math.max(0, now - job.startedAt) : 0;
      const statusText = status === 'online' ? t('status.online') : status === 'loading' ? t('status.loading') : t('status.offline');
      const dotClass = 'cs-dot' + (status === 'online' ? ' cs-dot--on' : status === 'loading' ? '' : ' cs-dot--warn');
      const jobLabel = job === null
        ? ''
        : job.status === 'queued'
          ? t('job.queued')
          : job.status === 'running'
            ? t('job.running')
            : job.status === 'completed'
              ? t('job.completed')
              : job.status === 'cancelled'
                ? t('job.cancelled')
                : job.status === 'error'
                  ? t('job.error')
                  : '';
      const previewIndex = results.findIndex((entry) => entry.key === previewKey);
      const preview = previewIndex >= 0 ? results[previewIndex] : null;
      const lightboxIndex = lightboxKey === null ? -1 : results.findIndex((entry) => entry.key === lightboxKey);
      const lightboxItem = lightboxIndex >= 0 ? results[lightboxIndex] : null;

      /** Open the current result in the full-screen lightbox. */
      const openLightbox = () => {
        if (preview !== null && preview.url !== null) setLightboxKey(preview.key);
      };
      /** @returns {void} close the lightbox. */
      const closeLightbox = () => setLightboxKey(null);
      /**
       * @param {number} delta previous/next step.
       * @returns {void}
       */
      const stepLightbox = (delta) => {
        if (results.length === 0 || lightboxIndex < 0) return;
        const next = results[(lightboxIndex + delta + results.length) % results.length];
        if (next !== undefined) {
          setLightboxKey(next.key);
          setPreviewKey(next.key);
        }
      };
      /** Copy the seed that produced the lightbox image. @returns {Promise<void>} */
      const copyLightboxSeed = async () => {
        if (lightboxItem === null || lightboxItem.seed === null || lightboxItem.seed === undefined) return;
        try {
          await navigator.clipboard.writeText(String(lightboxItem.seed));
          notify('ok', t('lightbox.seedCopied'));
        } catch (error) {
          notify('error', t('lightbox.copyFailed', { message: describeError(error) }));
        }
      };

      /** Download the lightbox image. @returns {void} */
      const downloadLightbox = () => {
        if (lightboxItem === null || lightboxItem.url === null) return;
        const anchor = document.createElement('a');
        anchor.href = lightboxItem.url;
        anchor.download = lightboxItem.filename;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      };
      /** Copy the lightbox image to the clipboard. @returns {Promise<void>} */
      const copyLightbox = async () => {
        if (lightboxItem === null || lightboxItem.url === null || lightboxBusy) return;
        setLightboxBusy(true);
        try {
          const response = await fetch(lightboxItem.url, { cache: 'no-store' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          const png = await imageBlobToPng(blob);
          if (typeof ClipboardItem !== 'function' || navigator.clipboard === undefined || typeof navigator.clipboard.write !== 'function') {
            throw new Error('clipboard unavailable');
          }
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
          notify('ok', t('lightbox.copied'));
        } catch (copyError) {
          notify('error', t('lightbox.copyFailed', { message: describeError(copyError) }));
        } finally {
          setLightboxBusy(false);
        }
      };
      /** Remove the lightbox image from the result list. @returns {void} */
      const deleteResult = (removedKey) => {
        if (typeof removedKey !== 'string') return;
        const list = resultsRef.current;
        const index = list.findIndex((entry) => entry.key === removedKey);
        const remaining = list.filter((entry) => entry.key !== removedKey);
        const objectUrl = urls.current.get(removedKey);
        if (typeof objectUrl === 'string') {
          URL.revokeObjectURL(objectUrl);
          urls.current.delete(removedKey);
        }
        setResults((previous) => previous.filter((entry) => entry.key !== removedKey));
        setLightboxKey(null);
        setPreviewKey((current) => {
          if (current !== removedKey && remaining.some((entry) => entry.key === current)) return current;
          return remaining.length === 0 ? null : remaining[Math.min(Math.max(index, 0), remaining.length - 1)].key;
        });
        notify('ok', t('lightbox.deleted'));
      };
      /** Open the slide-up workflow canvas for the selected workflow. @returns {void} */
      const openWorkflowEditor = () => {
        if (workflowInfo === null || selected === null) return;
        const graph = workflowInfo.graph;
        if (graph === null || typeof graph !== 'object' || !Array.isArray(graph.nodes)) return;
        setEditor({ key: `${selected}:${Date.now()}`, name: selected, graph, loras: loraDraftRef.current });
      };
      /**
       * Receive LoRA rows changed inside the canvas and mirror them in the main card.
       * @param {any[]} rows LoRA quick-edit rows.
       * @returns {void}
       */
      const handleEditorLoras = React.useCallback((rows) => {
        const next = Array.isArray(rows) ? rows : [];
        loraDraftRef.current = next;
        setLoraDraft(next);
        saveOverride(selectedRef.current, { ...formRef.current, loras: next });
      }, [saveOverride]);

      /**
       * @param {string} savedName name returned by the save route.
       * @returns {Promise<void>}
       */
      const handleWorkflowSaved = async (savedName) => {
        updateSettings({ workflow: savedName });
        setSelected(savedName);
        setWorkflowReload((value) => value + 1);
        try {
          await loadWorkflowList(baseUrl);
        } catch {
          // the list refresh is best effort; the editor already reported success
        }
      };
      /**
       * @returns {Promise<void>}
       */
      const handleWorkflowDeleted = async () => {
        updateSettings({ workflow: '' });
        setSelected(null);
        setWorkflowInfo(null);
        try {
          await loadWorkflowList(baseUrl);
        } catch {
          // the list refresh is best effort; the editor already reported success
        }
        setWorkflowReload((value) => value + 1);
      };

      // Grow the prompt box with its content (capped by the CSS max-height) so
      // the panel keeps exactly one visible scrollbar: the left control column.
      React.useEffect(() => {
        const element = promptRef.current;
        if (element === null) return;
        element.style.height = 'auto';
        element.style.height = `${Math.min(element.scrollHeight, 240)}px`;
      }, [form.positive, promptEditable, workflowInfo, leftWidth]);
      React.useEffect(() => {
        const onResize = () => {
          const element = promptRef.current;
          if (element === null) return;
          element.style.height = 'auto';
          element.style.height = `${Math.min(element.scrollHeight, 240)}px`;
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
      }, []);

      const pageClass = 'cs-page' + (resizing ? ' cs-page--resizing' : '');
      const bodyStyle = {};
      bodyStyle['--cs-left'] = `${leftWidth}px`;

      /**
       * One horizontal meter.
       * @param {number | null} percent fill percentage.
       * @returns {React.ReactElement | null} meter element.
       */
      const meter = (percent) => {
        if (percent === null) return null;
        return h('span', { className: 'cs-bar', 'aria-hidden': 'true' },
          h('span', {
            className: 'cs-bar-fill' + (percent >= 90 ? ' cs-bar-fill--warn' : ''),
            style: { width: `${Math.max(percent, percent > 0 ? 2 : 0)}%` },
          }));
      };

      /**
       * Normalise a user-entered ComfyUI address.
       * @param {string} raw raw input.
       * @returns {string | null} absolute http(s) address, or null when invalid.
       */
      const normalizeAddressInput = (raw) => {
        let value = String(raw).trim();
        if (value === '') return null;
        if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
        value = value.replace(/\/+$/, '');
        try {
          const url = new URL(value);
          if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.hostname === '') return null;
          return url.href.replace(/\/+$/, '');
        } catch {
          return null;
        }
      };

      /**
       * Persist and apply a user-entered ComfyUI address.
       * @param {string} raw raw input.
       * @returns {void}
       */
      const saveAddress = (raw) => {
        const value = normalizeAddressInput(raw);
        if (value === null) {
          notify('error', t('offline.invalidAddress'));
          return;
        }
        updateSettings({ baseUrl: value });
        setAddressDraft(value);
        notify('ok', t('offline.savedAddress'));
        if (value === baseUrl) void retryConnection();
        else setBaseUrl(value);
      };

      /**
       * Retry the connection now (or reload when the host config never arrived).
       * @returns {Promise<void>}
       */
      const retryConnection = async () => {
        if (baseUrl === '') {
          if (typeof window !== 'undefined') window.location.reload();
          return;
        }
        if (offlineRetrying) return;
        setOfflineRetrying(true);
        setOfflineAttempts(0);
        try {
          await loadState(baseUrl);
          await loadWorkflowList(baseUrl);
        } finally {
          if (mounted.current) setOfflineRetrying(false);
        }
      };

      const configMissing = baseUrl === '';
      const showOffline = status === 'offline' && (offlineShown || offlineAttempts > 0);
      const showConnecting = status === 'loading' && coldLoading;
      const showConnectionPage = showOffline || (baseUrl !== '' && showConnecting) || (configMissing && coldLoading);
      const externalLink = (href, label, primary) => h('a', {
        className: 'cs-btn ' + (primary ? 'cs-btn--secondary' : 'cs-btn--ghost'),
        href,
        target: '_blank',
        rel: 'noreferrer',
      }, label);
      const connectionPage = h(Fragment, null,
        h('style', { key: 'css' }, CSS),
        h('div', { className: 'cs-offline-page', role: 'status' },
        h('div', { className: 'cs-offline-card' },
          h('div', { className: 'cs-offline-head' },
            h('div', { className: 'cs-offline-icon' + (configMissing || showConnecting ? ' cs-offline-icon--busy' : '') },
              configMissing || showConnecting
                ? h('span', { className: 'cs-offline-spinner', 'aria-hidden': 'true' })
                : h('svg', {
                  viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor',
                  strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true',
                },
                h('path', { d: 'M9 7V3M15 7V3M7 7h10v3a5 5 0 0 1-10 0V7ZM12 15v6' }))),
            h('h2', { className: 'cs-offline-title' },
              configMissing ? t('offline.configTitle') : showOffline ? t('offline.title') : t('offline.connectingTitle')),
            h('p', { className: 'cs-offline-desc' },
              configMissing ? t('offline.configDesc') : showOffline ? t('offline.desc') : t('offline.connectingDesc'))),
          h('div', { className: 'cs-offline-edit' },
            h('div', { className: 'cs-offline-edit-line' },
              h('input', {
                className: 'cs-offline-input',
                value: addressDraft,
                placeholder: 'http://127.0.0.1:8188',
                spellCheck: false,
                'aria-label': t('offline.address'),
                onChange: (event) => setAddressDraft(event.target.value),
                onKeyDown: (event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  saveAddress(addressDraft);
                },
              }),
              h('button', {
                type: 'button', className: 'cs-btn cs-btn--secondary',
                onClick: () => saveAddress(addressDraft),
                disabled: addressDraft.trim() === '',
              }, t('offline.saveAddress')))),
          configMissing ? null : h(Fragment, null,
            h('div', { className: 'cs-offline-step' },
              h('span', { className: 'cs-offline-step-num' }, '1'),
              h('div', { className: 'cs-offline-step-body' },
                h('b', null, t('offline.step1Title')),
                h('p', null, t('offline.step1')))),
            h('div', { className: 'cs-offline-step' },
              h('span', { className: 'cs-offline-step-num' }, '2'),
              h('div', { className: 'cs-offline-step-body' },
                h('b', null, t('offline.step2Title')),
                h('p', null, t('offline.step2')))),
            h('div', { className: 'cs-offline-step' },
              h('span', { className: 'cs-offline-step-num' }, '3'),
              h('div', { className: 'cs-offline-step-body' },
                h('b', null, t('offline.step3Title')),
                h('p', null, t('offline.step3'))))),
          configMissing ? null : h('div', { className: 'cs-offline-links' },
            externalLink(COMFY_DOWNLOAD_URL, t('offline.download'), true),
            externalLink(COMFY_DESKTOP_URL, t('offline.desktopGuide')),
            externalLink(COMFY_PORTABLE_URL, t('offline.portableGuide')),
            externalLink(COMFY_GITHUB_URL, t('offline.github'))),
          showOffline && connectionError !== '' ? h('p', { className: 'cs-offline-error', title: connectionError }, t('offline.connectFailed')) : null,
          h('div', { className: 'cs-offline-actions' },
            h('button', {
              type: 'button', className: 'cs-btn cs-btn--primary',
              onClick: () => { void retryConnection(); },
              disabled: offlineRetrying || showConnecting,
            }, offlineRetrying ? t('offline.retrying') : t('offline.retry')),
            baseUrl === '' ? null : h('button', {
              type: 'button', className: 'cs-btn cs-btn--secondary',
              onClick: () => { if (typeof window !== 'undefined') window.open(baseUrl, '_blank', 'noopener'); },
            }, t('offline.open'))),
        )));

      if (showConnectionPage) return connectionPage;

      return h(Fragment, null,
        h('style', { key: 'css' }, CSS),
        h('section', { key: 'page', className: pageClass, 'aria-label': t('aria.panel') },
          h('header', { className: 'cs-top' },
            h('div', { className: 'cs-head' },
              h('div', { className: 'cs-title-wrap' },
                h('h1', { className: 'cs-title' }, t('panel.title')),
                h('span', { className: dotClass, 'aria-hidden': 'true' }),
                h('span', { className: 'cs-status-text' }, statusText)),
              h('div', { className: 'cs-actions' },
                h('button', {
                  type: 'button', className: 'cs-btn cs-btn--secondary',
                  onClick: () => { void interruptJob(); },
                  disabled: !jobActive || busy !== '',
                }, busy === 'interrupt' ? t('actions.interrupting') : t('actions.interrupt')),
                h('button', {
                  type: 'button', className: 'cs-btn cs-btn--ghost',
                  onClick: () => { void refreshAll(); },
                  disabled: baseUrl === '' || busy !== '',
                }, t('actions.refresh')),
                h('button', { type: 'button', className: 'cs-btn cs-btn--ghost', onClick: backToConversation }, t('actions.back')))),
            h('div', { className: 'cs-stats' },
              h('div', { className: 'cs-stat cs-stat--wide' },
                h('span', { className: 'cs-stat-label' }, gpuUtilization !== null ? t('field.gpuUtil') : t('field.vram')),
                h('span', { className: 'cs-stat-value cs-mono' },
                  gpuDisplayPercent === null ? t('value.none') : t('value.percent', { percent: String(gpuDisplayPercent) })),
                meter(gpuDisplayPercent),
                vramUsed === null || device === null
                  ? null
                  : h('span', { className: 'cs-stat-sub cs-mono' },
                    t('value.used', { used: formatBytes(vramUsed), total: formatBytes(device.vramTotal) }))),
              h('div', { className: 'cs-stat' },
                h('span', { className: 'cs-stat-label' }, t('field.ram')),
                h('span', { className: 'cs-stat-value cs-mono' },
                  ramPercent === null ? t('value.none') : t('value.percent', { percent: String(ramPercent) })),
                meter(ramPercent),
                ramUsed === null || server === null
                  ? null
                  : h('span', { className: 'cs-stat-sub cs-mono' },
                    t('value.used', { used: formatBytes(ramUsed), total: formatBytes(server.ramTotal) }))),
              h('div', { className: 'cs-stat' },
                h('span', { className: 'cs-stat-label' }, t('field.queue')),
                h('span', { className: 'cs-stat-value' },
                  progressRunning
                    ? t('value.progress', { percent: String(progressPercent), value: String(progressValue), max: String(progressMax) })
                    : t('value.queue', { running: String(queue.running ?? 0), pending: String(queue.pending ?? 0) })),
                meter(progressRunning ? progressPercent : 0)),
              h('div', { className: 'cs-stat' },
                h('span', { className: 'cs-stat-label' }, t('field.activity')),
                h('span', { className: 'cs-stat-value' },
                  jobActive ? `${jobLabel} · ${t('job.elapsed', { time: formatDuration(elapsed) })}` : t('status.idle'),
                  !jobActive && lastDoneAt !== null ? h('span', { className: 'cs-dim' }, ` · ${t('job.lastDone', { time: clockTime(lastDoneAt) })}`) : null))),
            ),

          h('div', { className: 'cs-body', style: bodyStyle, ref: bodyRef },
            h('div', { className: 'cs-left' },
              h('section', { className: 'cs-card', 'aria-label': t('aria.workflowList') },
                h('div', { className: 'cs-card-head' },
                  h('h2', { className: 'cs-card-title' }, t('section.workflows')),
                  h('div', { className: 'cs-actions' },
                    h('button', {
                      type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--ghost',
                      onClick: openWorkflowEditor,
                      disabled: workflowBusy || workflowsBusy || workflowInfo === null || selected === null,
                      title: t('editor.title'),
                    }, t('actions.editWorkflow')),
                    h('button', {
                      type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--ghost',
                      onClick: () => { void refreshAll(); },
                      disabled: workflowsBusy || baseUrl === '',
                    }, workflowsBusy ? t('workflow.loading') : t('actions.refreshWorkflows')))),
                imageWorkflows.length === 0
                  ? h(Fragment, null,
                    h('p', { className: 'cs-hint' }, workflowsBusy ? t('workflow.loading') : t('workflow.none')),
                    workflowsBusy || !online ? null : h(Fragment, null,
                      h('p', { className: 'cs-hint' }, t('workflow.emptyGuide')),
                      h('div', { className: 'cs-wf-empty-actions' },
                        h('button', {
                          type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--secondary',
                          onClick: () => { if (typeof window !== 'undefined') window.open(baseUrl, '_blank', 'noopener'); },
                        }, t('offline.open')),
                        h('button', {
                          type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--ghost',
                          onClick: () => { void loadWorkflowList(baseUrl); },
                        }, t('actions.refreshWorkflows')))))
                  : h('select', {
                    className: 'cs-select',
                    value: selected ?? '',
                    'aria-label': t('aria.workflowList'),
                    disabled: workflowsBusy,
                    onChange: (event) => selectWorkflow(event.target.value),
                  },
                  h('option', { value: '' }, t('workflow.select')),
                  imageWorkflows.map((workflow) => h('option', { key: workflow.name, value: workflow.name },
                    `${workflow.name.replace(/\.json$/i, '')}${workflow.supported === true ? '' : ' · ⚠'}`))),
                workflowInfo !== null
                  ? h('div', { className: 'cs-wf-meta' },
                    params !== null && typeof params.checkpoint === 'string' && params.checkpoint !== ''
                      ? h('span', null, h('b', null, t('field.model')), ': ', h('span', { className: 'cs-mono' }, params.checkpoint))
                      : null,
                    selected !== null && typeof WORKFLOW_REFERENCES[selected] === 'string'
                      ? h('a', {
                        className: 'cs-link',
                        href: WORKFLOW_REFERENCES[selected],
                        target: '_blank',
                        rel: 'noreferrer',
                      }, t('workflow.reference'))
                      : null,
                    workflowReasons.length > 0 || workflowWarnings.length > 0
                      ? h('div', { className: 'cs-wf-tags' },
                        workflowReasons.length > 0
                          ? h('button', {
                            type: 'button', className: 'cs-chip cs-chip--error',
                            onClick: () => openDialog(t('dialog.reasons'), workflowReasons),
                          }, t('workflow.problems', { count: String(workflowReasons.length) }))
                          : null,
                        workflowWarnings.length > 0
                          ? h('button', {
                            type: 'button', className: 'cs-chip cs-chip--warn',
                            onClick: () => openDialog(t('dialog.warnings'), workflowWarnings),
                          }, t('workflow.warningsCount', { count: String(workflowWarnings.length) }))
                          : null)
                      : null)
                  : workflowBusy
                    ? h('p', { className: 'cs-hint' }, t('workflow.loading'))
                    : null),

              h('section', { className: 'cs-card', 'aria-label': t('section.prompt') },
                h('div', { className: 'cs-card-head' },
                  h('h2', { className: 'cs-card-title' }, t('section.prompt')),
                  h('div', { className: 'cs-prompt-head' },
                    h('span', { className: 'cs-hint', style: { margin: 0 } },
                      t('prompt.kindLabel', { kind: t(`prompt.kind.${modelKind}`) })),
                    h('button', {
                      type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--secondary',
                      onClick: () => { void manualRewrite(); },
                      disabled: rewriteBusy || busy !== '' || !promptEditable,
                    }, rewriteBusy ? t('actions.rewriting') : t('actions.rewrite')))),
                promptEditable
                  ? h(Fragment, null,
                    h('textarea', {
                      ref: promptRef,
                      className: 'cs-textarea cs-textarea--positive',
                      value: form.positive,
                      placeholder: t('prompt.placeholder.positive'),
                      'aria-label': t('field.positive'),
                      spellCheck: false,
                      onChange: (event) => setField('positive', event.target.value),
                    }))
                  : h('p', { className: 'cs-hint' }, workflowBusy
                    ? t('workflow.loading')
                    : workflowInfo !== null && !supported ? t('hint.notRunnable') : t('hint.noPromptNode')),
                h('div', { className: 'cs-ref-head' },
                  h('span', { className: 'cs-label' }, t('ref.title')),
                  h('button', {
                    type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--ghost',
                    onClick: () => { void translateReference(); },
                    disabled: zhBusy || !promptEditable || form.positive.trim() === '',
                  }, zhBusy ? t('ref.busy') : t('ref.action'))),
                zhRef === null
                  ? h('p', { className: 'cs-hint' }, t('ref.empty'))
                  : h(Fragment, null,
                    zhRef.source !== form.positive ? h('p', { className: 'cs-hint' }, t('ref.stale')) : null,
                    h('div', { className: 'cs-ref' }, zhRef.text))),

              loraDraft.length === 0 ? null : h('section', { className: 'cs-card', 'aria-label': t('section.loras') },
                h('div', { className: 'cs-card-head' },
                  h('h2', { className: 'cs-card-title' }, t('section.loras')),
                  loraOptions === null
                    ? h('span', { className: 'cs-hint', style: { margin: 0 } }, t('lora.loading'))
                    : h('span', { className: 'cs-hint', style: { margin: 0 } }, loraOptions.length === 0 ? t('lora.noFile') : String(loraDraft.length))),
                loraDraft.map((entry, index) => {
                  const choices = loraOptions === null ? [] : loraOptions;
                  const names = entry.name !== '' && !choices.includes(entry.name) ? [entry.name].concat(choices) : choices;
                  return h('div', { key: entry.nodeId, className: 'cs-lora' },
                    h('div', { className: 'cs-lora-head' },
                      h('span', { className: 'cs-lora-title' }, `LoRA ${index + 1}`),
                      h('label', { className: 'cs-check' },
                        h('input', {
                          type: 'checkbox',
                          checked: entry.enabled === true,
                          onChange: (event) => updateLora(entry.nodeId, { enabled: event.target.checked }),
                        }),
                        t('lora.enabled'))),
                    loraOptions === null
                      ? h('div', { className: 'cs-lora-name cs-lora-name--text', title: String(entry.name) }, String(entry.name))
                      : h('select', {
                        className: 'cs-select cs-lora-name',
                        value: entry.name,
                        onChange: (event) => updateLora(entry.nodeId, { name: event.target.value }),
                      }, (names.length === 0 ? [entry.name] : names).map((name) => h('option', { key: name, value: name }, name))),
                    h('div', { className: 'cs-lora-strength' },
                      h(Field, { label: t('field.loraModel') },
                        h(NumberField, {
                          t, value: entry.model, min: -20, max: 20, step: 0.05, label: t('field.loraModel'),
                          onChange: (value) => updateLora(entry.nodeId, { model: value }),
                        })),
                      entry.type === 'LoraLoader'
                        ? h(Field, { label: t('field.loraClip') },
                          h(NumberField, {
                            t, value: entry.clip, min: -20, max: 20, step: 0.05, label: t('field.loraClip'),
                            onChange: (value) => updateLora(entry.nodeId, { clip: value }),
                          }))
                        : null));
                })),

              h('section', { className: 'cs-card', 'aria-label': t('section.params') },
                h('div', { className: 'cs-card-head' },
                  h('h2', { className: 'cs-card-title' }, t('section.params')),
                  h('button', {
                    type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--ghost',
                    onClick: resetForm,
                    disabled: workflowBusy || busy !== '' || selected === null,
                  }, t('actions.reset'))),
                h('div', { className: 'cs-form-grid' },
                  samplerEditable
                    ? h(Fragment, null,
                      h(Field, { label: t('field.steps') },
                        h(NumberField, { t, value: form.steps, min: 1, max: 500, step: 1, label: t('field.steps'), onChange: (value) => setField('steps', value) })),
                      h(Field, { label: t('field.cfg') },
                        h(NumberField, { t, value: form.cfg, min: 0, max: 100, step: 0.5, label: t('field.cfg'), onChange: (value) => setField('cfg', value) })),
                      h(Field, { label: t('field.sampler') },
                        h('select', {
                          className: 'cs-select', value: form.sampler, disabled: samplers.length === 0,
                          onChange: (event) => setField('sampler', event.target.value),
                        }, (samplers.length === 0 ? [form.sampler] : samplers).map((name) => h('option', { key: name, value: name }, name)))),
                      h(Field, { label: t('field.scheduler') },
                        h('select', {
                          className: 'cs-select', value: form.scheduler, disabled: schedulers.length === 0,
                          onChange: (event) => setField('scheduler', event.target.value),
                        }, (schedulers.length === 0 ? [form.scheduler] : schedulers).map((name) => h('option', { key: name, value: name }, name)))))
                    : null,
                  samplerEditable
                    ? h(Field, { label: t('field.seed') },
                      h('div', { className: 'cs-seed' },
                        h('input', {
                          className: 'cs-input cs-seed-input',
                          value: form.seed,
                          inputMode: 'numeric',
                          spellCheck: false,
                          'aria-label': t('field.seed'),
                          placeholder: t('field.random'),
                          onChange: (event) => setField('seed', String(event.target.value).replace(/\D/g, '').slice(0, 20)),
                        }),
                        h('select', {
                          className: 'cs-select cs-seed-control',
                          value: form.seedControl,
                          'aria-label': t('field.seed'),
                          onChange: (event) => setField('seedControl', event.target.value),
                        }, SEED_CONTROL_VALUES.map((value) => h('option', { key: value, value }, t(`seed.${value}`))))))
                    : null,
                  latentEditable
                    ? h(Field, { label: t('field.size') },
                      h('div', { className: 'cs-size-row' },
                        h(NumberField, {
                          t, value: form.width, min: 64, max: 4096, step: 8, label: t('field.width'),
                          onChange: (value) => setField('width', value),
                        }),
                        h('span', { className: 'cs-size-x', 'aria-hidden': 'true' }, '×'),
                        h(NumberField, {
                          t, value: form.height, min: 64, max: 4096, step: 8, label: t('field.height'),
                          onChange: (value) => setField('height', value),
                        })))
                    : null),
                ),
              ),

            h('button', {
              type: 'button',
              className: 'cs-splitter' + (resizing ? ' cs-splitter--active' : ''),
              'aria-label': t('aria.splitter'),
              'aria-orientation': 'vertical',
              role: 'separator',
              onPointerDown: startResize,
              onKeyDown: onSplitterKey,
            }),

            h('div', { className: 'cs-right' },
              h('section', { className: 'cs-card cs-preview-card', 'aria-label': t('aria.preview') },
                h('div', { className: 'cs-preview-head' },
                  h('div', { className: 'cs-preview-name', title: preview === null ? '' : preview.filename },
                    preview === null ? t('preview.noFile') : preview.filename),
                  h('div', { className: 'cs-actions' },
                    results.length === 0 ? null : h('span', { className: 'cs-preview-name' }, t('preview.count', { index: String(previewIndex + 1), total: String(results.length) })),
                    h('button', { type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--ghost', onClick: () => stepPreview(-1), disabled: results.length < 2, 'aria-label': t('actions.prev') }, '‹'),
                    h('button', { type: 'button', className: 'cs-btn cs-btn--tiny cs-btn--ghost', onClick: () => stepPreview(1), disabled: results.length < 2, 'aria-label': t('actions.next') }, '›'),
                    preview !== null && preview.url !== null
                      ? h('a', { className: 'cs-btn cs-btn--tiny cs-btn--secondary', href: preview.url, download: preview.filename }, t('actions.download'))
                      : null)),
                h('div', {
                  className: 'cs-preview-stage' + (preview !== null && preview.url !== null ? ' cs-preview-stage--filled' : ''),
                  onClick: preview !== null && preview.url !== null ? openLightbox : undefined,
                  role: preview !== null && preview.url !== null ? 'button' : undefined,
                  tabIndex: preview !== null && preview.url !== null ? 0 : undefined,
                  title: preview !== null && preview.url !== null ? t('lightbox.preview') : undefined,
                  onKeyDown: (event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    if (preview === null || preview.url === null) return;
                    event.preventDefault();
                    openLightbox();
                  },
                },
                  preview !== null && preview.url !== null
                    ? h('img', { key: preview.key, src: preview.url, alt: preview.filename })
                    : h('div', { className: 'cs-preview-empty' },
                      preview !== null && preview.error !== null ? preview.error : t('preview.empty'))),
                results.length === 0
                  ? null
                  : h('div', { className: 'cs-thumbs', 'aria-label': t('aria.thumbs') },
                    results.map((entry) => h('button', {
                      key: entry.key,
                      type: 'button',
                      className: 'cs-thumb' + (entry.key === previewKey ? ' cs-thumb--active' : ''),
                      title: entry.filename,
                      onClick: () => setPreviewKey(entry.key),
                      'aria-label': entry.filename,
                    },
                    entry.url !== null
                      ? h('img', { src: entry.url, alt: entry.filename, loading: 'lazy' })
                      : h('span', null, entry.error !== null ? '!' : '…')
                    )))
                  )
                )
              )
            ),
          h('div', { key: 'fab', className: 'cs-fab' + (job !== null ? ' cs-fab--active' : '') },
            job !== null
              ? h('div', { className: 'cs-fab-status' },
                h('b', null, jobLabel),
                jobActive ? h('span', null, t('job.elapsed', { time: formatDuration(elapsed) })) : null,
                job.position !== null && job.status === 'queued' ? h('span', null, t('job.position', { position: String(job.position) })) : null,
                job.status === 'error' && job.error !== '' ? h('span', { className: 'cs-fab-error' }, job.error) : null)
              : null,
            h('label', { className: 'cs-fab-batch' },
              h('span', null, t('field.batch')),
              h(DragNumber, {
                value: form.batchSize,
                min: 1,
                max: 16,
                step: 1,
                disabled: !latentEditable || busy !== '',
                label: t('field.batch'),
                t,
                onChange: (value) => setField('batchSize', value),
              })),
            h('button', {
              type: 'button', className: 'cs-btn cs-btn--primary',
              onClick: () => { void generate(); },
              disabled: busy !== '' || !online || jobActive || !supported || selected === null,
            }, busy === 'generate' ? t('actions.generating') : t('actions.generate'))),
          toast === null ? null : h('div', { key: 'toast', className: `cs-toast cs-toast--${toast.kind}`, role: 'status' },
            h('span', { className: 'cs-toast-dot', 'aria-hidden': 'true' }),
            h('p', null, toast.text),
            h('button', { type: 'button', className: 'cs-toast-close', 'aria-label': t('actions.close'), onClick: () => setToast(null) }, '×')),
          dialog === null ? null : h('div', {
            key: 'dialog',
            className: 'cs-dialog-backdrop',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': dialog.title,
            onClick: (event) => { if (event.target === event.currentTarget) setDialog(null); },
          },
          h('div', { className: 'cs-dialog' },
            h('h3', null, dialog.title),
            h('ul', null, dialog.items.map((item, index) => h('li', { key: index }, item))),
            h('div', { className: 'cs-dialog-actions' },
              h('button', { type: 'button', className: 'cs-btn cs-btn--secondary', onClick: () => setDialog(null) }, t('actions.close'))))),
          editor === null ? null : h(WorkflowEditor, {
            key: editor.key,
            t,
            baseUrl,
            name: editor.name,
            graph: editor.graph,
            loraDraft: editor.loras,
            onLorasChange: handleEditorLoras,
            onRefreshWorkflows: () => {
              // After editing in the embedded ComfyUI UI its saved graph is the
              // source of truth: drop our LoRA overlay so the card re-reads it.
              const workflow = selectedRef.current;
              if (workflow !== null) {
                const overrides = { ...settingsRef.current.overrides };
                const entry = overrides[workflow];
                if (entry !== null && typeof entry === 'object' && entry.loras !== undefined) {
                  const nextEntry = { ...entry };
                  delete nextEntry.loras;
                  overrides[workflow] = nextEntry;
                  updateSettings({ overrides });
                }
              }
              void loadWorkflowList(baseUrl);
              setWorkflowReload((value) => value + 1);
            },
            notify,
            onSaved: (savedName) => { void handleWorkflowSaved(savedName); },
            onDeleted: () => { void handleWorkflowDeleted(); },
            onClosed: () => setEditor(null),
          }),
          lightboxItem === null ? null : h(ImageLightbox, {
            t,
            item: lightboxItem,
            index: lightboxIndex,
            total: results.length,
            busy: lightboxBusy,
            onPrev: () => stepLightbox(-1),
            onNext: () => stepLightbox(1),
            onClosed: () => {
              setLightboxKey(null);
              setLightboxBusy(false);
            },
            onDownload: downloadLightbox,
            onCopy: () => { void copyLightbox(); },
            onCopySeed: () => { void copyLightboxSeed(); },
            onDelete: deleteResult,
          }));
    }

    /**
     * Register the studio page and its sidebar entry.
     * @param {any} ctx Client plugin context.
     * @returns {void}
     */
    function apply(ctx) {
      ctx.effect(() => registerDictionaries(ctx), 'comfyui-panel: dictionaries');
      const t = makeTranslator(ctx);
      const disposers = [
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
        }, (props) => h(PanelErrorBoundary, { t }, h(StudioPanel, { ...props, ctx, t })))),
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 30,
          locale: NS,
          label: () => t('panel.title'),
        }, (props) => h(SidebarIcon, props))),
      ];
      ctx.effect(() => () => {
        for (const dispose of disposers.reverse()) dispose();
      }, 'comfyui-panel: panel');
    }

    // Pure graph helpers are exposed for the offline test harness; the Host
    // loader only consumes `name`, `inject` and `apply`.
    const editorInternals = {
      addWorkflowNode,
      applyLorasToGraph,
      applyWidgetValue,
      cloneWorkflowGraph,
      connectWorkflowNodes,
      editorRowsOf,
      loraNodesOf,
      nextSeedValue,
      nodeAccentOf,
      removeWorkflowLink,
      removeWorkflowNode,
      widgetSlotsOf,
    };

    return { name: 'comfyui-panel-client', inject: ['slots', 'locale'], apply, __editorInternals: editorInternals };
  },
});
