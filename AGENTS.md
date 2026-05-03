# AGENTS.md

## 项目定位

这是一个 Tauri 2 + React + TypeScript 的 PFF 资源管理器。当前第一版目标是只读浏览和导出：

- 打开单个 `.pff` 文件。
- 打开游戏/资源目录并扫描根目录 `*.pff` 与 `expansion/**/*.pff`。
- 浏览包列表、搜索、类型筛选、排序资源表。
- 对文本资源做 decoded 预览。
- 导出选中资源，支持 `raw` 与 `decoded` 两种模式。

不要在第一版实现新增、替换、删除或 compact/重写 PFF。所有 PFF 操作默认必须是非破坏性的。

## 包管理与常用命令

本项目使用 pnpm，不使用 npm/yarn。

- 安装依赖：`pnpm install`
- 前端开发：`pnpm dev`
- 前端构建：`pnpm build`
- Tauri 开发：`pnpm tauri dev`
- Tauri 调试构建：`pnpm tauri build --debug`
- Windows MSVC 构建单文件 exe：`pnpm tauri:build:windows-msvc`
- Windows MSVC 调试构建单文件 exe：`pnpm tauri:build:windows-msvc:debug`
- Rust 测试：`cd src-tauri && cargo test`

`src-tauri/tauri.conf.json` 的 `beforeDevCommand` 和 `beforeBuildCommand` 必须保持 pnpm 命令。

## 前端约定

- 入口 UI 在 `src/App.tsx`。
- 用户偏好的 React 风格是接近 Vue SFC：组件逻辑、JSX 和组件相关 CSS 尽量放在同一个 `.tsx` 文件里。
- `src/App.css` 只放全局基础样式，不要把大量组件样式拆进去。
- UI 必须继续贴近 `PFF Explorer.html` 的 Claude Design：绿色终端风格、三栏布局、顶部自定义标题栏、状态栏、资源表、右侧预览面板。
- 表格需要能处理大 PFF 包，继续使用虚拟滚动，不要退回全量 DOM 渲染。
- 文件选择和保存路径使用 `@tauri-apps/plugin-dialog`，不要自己模拟路径输入作为主要流程。

## 后端约定

- PFF 逻辑在 `src-tauri/src/pff/mod.rs`。
- 当前支持范围是 PFF3/PFF4：
  - 20 字节 header。
  - entry size 为 32 或 36。
  - 16 字节文件名。
- 参考实现来自 `/Users/BangZ/Documents/RCReborn/crates/rc-core/src/parser/pff.rs`，但本项目采用内置精简版，避免依赖本机绝对路径。
- `/Users/BangZ/Documents/jo-engine-analysis/PFF_FORMAT.md` 中的 548 字节旧结构只作为后续扩展参考，当前不要混入第一版解析逻辑。
- decoded 提取顺序固定为：
  1. raw bytes
  2. BFC1 解压
  3. SCR 解密，`.fx` 使用 FX key，其余使用 default key
  4. RTXT 转 TOML
- 前端不要获得通用文件系统权限；读写资源文件通过 Rust command 完成。

## 测试与验证

提交代码前至少运行：

- `pnpm build`
- `cd src-tauri && cargo test`

如果本机存在样例包，可额外运行：

```bash
cd src-tauri
PFF_EXPLORER_SAMPLE_PFF="/Users/BangZ/Downloads/dfxrc/resource.pff" cargo test opens_external_sample_when_env_is_set
```

改动 Tauri 配置、能力权限或插件后，额外运行：

```bash
pnpm tauri build --debug
```

## 提交约定

- 每次完成用户要求的代码改动后，如果必要验证通过，应自动提交本次改动，除非用户明确说不要提交。
- 提交前只暂存与本次任务相关的文件，不要把工作区里已有的无关改动带入提交。
- 提交前按改动范围运行必要验证：前端改动至少运行 `pnpm build`，Rust 改动额外运行 `cd src-tauri && cargo test`；验证失败时不要提交，先修复或说明失败原因。
- 纯文档改动可以不运行构建或测试，但需要在最终回复里说明。
- 提交信息使用简洁的英文祈使句，概括本次改动。
- 不要提交 `package-lock.json`、`yarn.lock` 或无关生成产物。

## 文件与依赖注意事项

- 保留 `pnpm-lock.yaml`，不要提交 `package-lock.json` 或 `yarn.lock`。
- 保留 `src-tauri/Cargo.lock`，这是应用项目。
- `PFF Explorer.html` 是设计参考文件，不要自动删除或重写。
- 不要把 `/Users/BangZ/Documents/RCReborn` 或 `/Users/BangZ/Documents/jo-engine-analysis` 当作运行时依赖，只能作为实现参考。
