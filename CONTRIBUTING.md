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

发布由 GitHub Actions 的 `.github/workflows/release.yml` 完成（npm trusted publishing + provenance），推送 tag 即触发：

1. 更新 `CHANGELOG.md`、`package.json`、`lib/comfy.js` 的 `PLUGIN_VERSION`，三者版本号一致；
2. 运行 `node scripts/verify.mjs`；
3. 提交并推送，创建并推送 tag（例如 `v0.3.4`）；
4. GitHub Actions 会自动完成：
   - 校验 tag 与 `package.json` 一致、跑测试；
   - `npm pack --dry-run` 检查 tarball 内容；
   - 把 tarball 安装到干净目录，验证 `dsh.bundle` 存在；
   - `npm publish --provenance --access public`；
   - 等待 npm 暴露新版本，并独立重试同步 `plugin-index.json`（保留全部已发布版本）；
   - 即使 npm 元数据传播较慢，也会继续创建 GitHub Release；索引同步失败时任务会报错并提供修复提示。

5. 如果发布任务提示索引未同步：Actions → **Repair plugin index** → Run workflow，填入刚发布的版本号。该任务会从 npm 重建完整版本列表并提交 `plugin-index.json`，不会重新发布 npm。

首次配置：在 npm 包页面 → **Settings → Publishing access → Trusted Publisher → GitHub Actions**，填写：

- Organization/user：`xingyeai23`
- Repository：`dsh-comfyui-studio`
- Workflow filename：`release.yml`
- Environment：留空

本地应急发布（trusted publishing 不可用时）：

```bash
npm login
npm publish --otp=<6 位验证码>
node scripts/sync-release.mjs <version>
git add plugin-index.json && git commit -m "Point plugin index at <version>" && git push
gh release create "v<version>" --title "v<version>" --notes-file CHANGELOG.md
```

本地发布会缺少 provenance；正常发布请优先用 tag + workflow。

## 问题反馈

请附上：DSH 版本、ComfyUI 版本、操作系统、`/comfyui-panel/health` 返回，以及与问题相关的控制台报错。
