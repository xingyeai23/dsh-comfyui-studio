# 贡献指南

## 开发环境

- Node.js `>=20.3`
- 一个可访问的 ComfyUI 实例（离线测试不强制）
- DSH profile 通过 `plugin_manager` 安装本目录

## 常用命令

```bash
node --check lib/client.js
node --test test/*.test.mjs
node scripts/verify.mjs
```

## 真实 ComfyUI 验证

```bash
# 列出并转换真实工作流
node scripts/verify.mjs --live

# 真实跑一张小图
node scripts/verify.mjs --live --generate CKNOOBmain.json

# 调用已安装面板的 /rewrite
node scripts/verify.mjs --rewrite "一只戴红围巾的白猫"
```

`--live` 系列会直接导入 Host 使用的模块连接 ComfyUI；默认地址是 `http://127.0.0.1:8188`，可用 `--base` 或 `DSH_COMFYUI_BASE` 覆盖。

## 代码约定

- Client 是单文件浏览器 bundle，无构建步骤；Host 代码在 `lib/host.js`、`lib/comfy.js`、`lib/workflow.js`。
- 文案走 Client locale，`locale/zh.json` 与 `locale/en.json` 的 key 必须一致。
- 动效遵循 `prefers-reduced-motion`；主面板只保留一条可见滚动条。
- 新增 Host 路由时同步更新 [API 路由](docs/API.md) 和测试。

## 发布

1. 更新 `CHANGELOG.md` 和 `package.json` 版本号（`lib/comfy.js` 的 `PLUGIN_VERSION` 必须同步）；
2. 运行 `node scripts/verify.mjs`；
3. 提交并推送，创建对应 tag；
4. `npm publish`（发布后 npm 上的 `latest` 会出现在 README 徽章里）；
5. 如果安装方式走 Git 源，同步更新 `plugin-index.json` 的版本和 commit。

## 问题反馈

请附上：DSH 版本、ComfyUI 版本、操作系统、`/comfyui-panel/health` 返回，以及与问题相关的控制台报错。
