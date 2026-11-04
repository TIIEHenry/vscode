---
title: "Engine 设置参考图视觉适配"
type: plan
status: accepted
phase: N/A
updated: 2026-11-02
summary: "按用户提供的 ChatGPT 设置截图调整 Engine 壳与 Tools 阅读布局；只改视觉与布局，不增加搜索筛选或更改保存协议。"
---

# Engine 设置参考图视觉适配
状态：已审查，代码与组件验证完成，真实窗口验收待补；owner agent:codex。

覆盖需求：PRD-028（Engine 设置局部视觉例外）；PRD-025（保留现有工具配置行为）。

## 范围与依据

用户先要求修复设置界面，随后明确以所附 ChatGPT 设置截图复刻视觉即可。后者收窄范围：不新增搜索、分类筛选、批量操作，不改变 RPC、profile enablement、保存门或连接行为。默认编辑器窗口是唯一产品入口。

目标是 Calm / Focused / Consistent：浅灰导航、白色内容、居中限宽内容列、页面标题与卡片分层、弱描边与卡内分隔、统一控件。沿用主题 token 与既有组件，深色和高对比保留。按用户视觉要求，Engine 设置局部采用较从容的导航与双行工具行；不推广到其它 IDE 列表。

```text
Preferences       Client Settings       Connection | Engine
┌─ 浅灰导航 ──────┬────────────────────────────────────────┐
│ Overview       │          Tools                         │
│ Providers      │          配置作用域说明                 │
│ …              │          ┌ Agent profile   [当前值 ▾] ┐ │
│ Tools      174 │          │                  [Save]   │ │
│                │          └───────────────────────────┘ │
│                │          ┌ Engine tools              ┐ │
│                │          │ 名称                [✓]   │ │
│                │          │ 简介（单行省略）            │ │
│                │          │ ───────────────────────── │ │
│                │          │ 下一个工具           [✓]   │ │
│                │          └───────────────────────────┘ │
│                │          已有选中工具完整详情（按需）    │
└────────────────┴────────────────────────────────────────┘
```

## 实施

1. Engine 壳：浅灰导航有独立表面；导航行 32px（delegate/CSS 同步），标题与正文列同宽居中，白底卡片；Test Engine 保留原有独立 utility 行，去掉横贯窗口的分割线并收紧间距；避免改变导航列表宿主与窄屏可达性。
2. Tools：配置对象与 Save 同组；SelectBox 使用自绘选项并统一尺寸，长名称省略；双行工具行 44px、无说明行 32px、分组 28px，名称与说明上下对齐，32×20 开关右置，完整技术说明仍走已有只读详情。鼠标与键盘选中、开关保留键盘行为并使用 switch 语义。
3. Tools 外层不滚动，列表和详情各有预算；通过可释放的 ResizeObserver 按实际内容盒布局虚拟列表，避免把整个详情区高度当成列表高度。窄屏和短屏需要可达控件，当详情区实际高度小于 320px 时，列表固定 160px 并退回外层滚动；正常高度由列表自身承担滚动，详情限高单独滚动。
4. 作用域清楚、Save 仅在原可写态显示，无修改时禁用，保留脏稿/成功失败/能力状态的原协议，不假造即时生效。连接页如需同步仅调整表面与标题对齐，不更改业务逻辑。

## 验证与明确替换断言

- `engineToolsSection.test.ts` 的 `tool name stays on the checkbox line` 改为验证双行行高：旧全 24px 改为分组 28px、带说明 44px、无说明 32px；保留 category 内容断言。`enginePreferencesPane.test.ts` 的 Agents nav badge 用例中导航行高从 22px 改为 32px；计数断言不改。不得绕过现有 leftover / 写门测试。
- 聚焦 `scripts/test.sh` 跑 EngineToolsSection、EnginePreferencesPane；新产物按仓库 transpile 工作流生成；必要时局部 compile，相关文件 eslint。
- 用真实浏览器渲染检查浅色/深色/高对比、宽与窄、长工具名/说明、单滚动与焦点；受控夹具只能证明视觉及控件行为，不能称真实引擎验收。
- 文档健康与 wiki check；保留已有 WIP，不提交或暂存无关文件。

## 审查与结果

规则 16 已由只读 reviewer `review_settings_visual` 审查（当前环境使用同会话 subagent，未提供 Cursor Task 工具），Critical 0、Important 4。核验后采纳：放弃把 Test Engine 嵌入导航，保留独立 utility 行以规避列表高度/窄屏隐藏风险；明确 Save 沿用 canWrite；明确极短屏 320px 阈值与 160px 列表预算。Minor 采纳：长 profile 使用组件完整 title/aria；Tools CSS 限定 `.engine-tools-section`，不改 Agents 内部 checklist。

2026-11-02 实施中发现既有固定高度列表 `rerender()` 不重画，旧源码独立复现 `a list refresh issued before a save lands cannot repaint the saved enablement` 失败。仅替换重画方式为稳定 id 的 splice，恢复保存/profile 切换后真实勾选显示，不改 RPC 或写门。

## 最终实施与验证

- Engine 壳、Tools 设置组/右侧开关、虚拟列表实际盒布局、窄/短窗口降级已落工作区。未改 Connection 业务或布局，不新增搜索筛选。
- 固定行重画使用稳定 id 的 splice，模板直接恢复原开关焦点；刷新成功先更新 ready 状态再画行，避免首屏开关停留在 loading 的禁用态。
- 定向 Electron 48 项通过；包含宽窄真实 DOM、长文本、短窗口、键盘开关和焦点保持。完整方法及截图见[验证记录](../progress/engine-settings-visual-evidence/verification.md)。
- 组件渲染覆盖浅色、深色、高对比、1440×1000 / 440×760 / 1024×380；这些是生产组件 + 受控目录数据，未称真实引擎/完整默认窗口验收。方案保留 accepted，PRD 不升档。未提交、未推送。
