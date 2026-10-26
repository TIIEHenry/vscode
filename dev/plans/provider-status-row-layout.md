---
title: "Provider 状态行按内容宽度换行"
type: plan
status: accepted
phase: M7
updated: 2026-10-26
summary: "D1381：Astra只读C0/I1已修入PRD/UI窄宽例外；仅Provider状态行按内容预算换轨，主状态与来源完整、动作预留；待实施与merge验证。"
---

# Provider 状态行按内容宽度换行

范围是默认编辑器 Engine Providers 的状态行。沿用 [PRD-025 / PRD-028](../../docs/product/requirements.md)、[UI 规范](../../docs/architecture/cross-cutting/ui-design-principles.md)、[Engine catalog](../../docs/systems/workbench/engine-catalog.md) 与 [当前集成看板](../parallel/active/ui-visual-review-2026-10-26.md)。本稿承接既有 [D1381](../progress/deferred-gaps.md)，不另建缺陷编号，不改 Models、Provider 预设目录或整个 pane 的断点，不改能力门控、读写 RPC、hover 所有权及 D1380 投影/codec。

## 事实与选择

Astra 在 source `330b689` 的真实默认窗口、完整主题、生产 `EngineProvidersSection` 中观察到 340px 行碰撞：badges 父盒仅 66 / 48px，内部配置 pill 为 88 / 109px，文字侵入 Enabled / Disabled。原几何测试只查全行边界与各 pill 自身不截字，未查兄弟相交。原图与 JSON 位于主仓 `.build/visual-review-astra/followup825/`，不入 git；[实拍摘要](../progress/ui-visual-review-2026-10-26-evidence/825-merge-visual-review.md) 保留。

| 选择 | 原则与机制 | 代价与边界 |
| --- | --- | --- |
| 推荐：Provider 行内按内容宽度自然换轨 | 稳定与诚实优先：身份组包含 24px avatar 与姓名/说明，动作保留现有 22px 命中区；content 内身份、主状态组（Configured + Enabled）、来源依序排布，actions 为直属行尾。配置和启用优先同组，来源完整、各 pill 不被挤成残片；空间不够就整组换轨，组本身超宽时再依序换行/按词折行 | 宽时仍是 24px 单行。300 / 340px pane 下预计 48–72px，**24px 是每条视觉轨密度，本类行整体允许增加**；本地化/字体放大不设 72px 高度上限。窄宽扫描高度增加，换取完整可辨状态；只为 Provider 状态行设置该例外 |
| 最近替代：局部 container query 固定两行 grid | 可约束行序与列对齐，但需另维护宽度阈值；内容、来源、本地化、字体改变后仍可能预算不足 | 本次不采用固定阈值；不扩大 pane 断点，不为同一局部问题新增 ResizeObserver 或 JS 宽度真相 |

可用宽度按实际容器算：300px pane 的左右 20px 内衬后，状态行约 260px；再扣行两侧 8px、两颗 22px 动作及其 2px 间距、content/action 间 6px，content 约 192px。avatar 放在身份组内，metadata 换轨后可使用这段完整宽度；英文最长主状态约 164px，可独占一轨，来源放不下再另起一轨。此处是方案估算，最终以生产 DOM 测量为准。若本地化或放大字体令主状态组本身超过预算，组内依序换行，单个 pill 允许按词/长词折行，全文可辨且不设固定高度。姓名仍可省略并保留完整 managed hover；来源不再压成 16px 残片。DOM 阅读序与视觉序一致（姓名/说明 → 配置/启用 → 来源 → 动作）；仅已有图标动作进入 Tab 顺序。avatar 与 actions 保持首轨，悬停与焦点仅改变动作显隐，不增减布局空间、不改变换轨。

## 实施与验证

- [x] 规则 16 只读审查：Astra Critical 0 / Important 1，已按规则 10a 修入 PRD-028 验收 3 与 UI §4/§5.3 的局部窄宽例外；方案独立提交后才实施。
- [x] 已补源：`engineProviderModelSection.ts` 仅调整状态行分组与顺序；生产 `enginePreferencesPane.css` 为该行提供内容驱动换轨，配置/启用/来源完整，现有动作仍为直属行尾以复用 hover/focus CSS。待运行验证。
- [x] 已补测试源：`preferencesStatusStyle.test.ts` 使用生产 CSS + 真实 Section/DI，不复制 CSS。Light / Dark / HC Dark / HC Light，300 → 340 → 720 → 340 → 300px 往返，长名称、两种配置/启用、两种来源；查每个元素完整且落在行/实际 pane 内，名称仍可识别，身份/主状态/来源/每个图标动作任意两项矩形无交叠，相邻行无垂直交叠。宽时 24px；窄时完整内容自然增高。含无写方法的只读行和长状态/来源文案，检查超过 72px 仍完整。待运行验证。
- [x] 已拆测试源：八项几何用例独立于原生焦点；四项键盘用例在真实活跃 Chrome 检查每颗按钮 focus、可见焦点、现有 22px 命中区与中心点命中、顺序稳定，读取/聚焦不发 RPC。既有空/失败/unknown/unsupported/断连及写能力门控测试保留。待运行验证。
- [ ] 唯一 merge 工位 fresh 后运行受影响的 Provider 语义套件与 Preferences status styles，Chrome 补真实焦点；完整主题真实默认窗口在 300 / 340 / 720px 浅深/HC 实拍并操作 hover、键盘，保存兄弟几何与截图。运行前 D1381 保持 open，不把旧 287+14 或组件测试替代 after 实拍。

C 工位禁止 compile、transpile、typecheck、watch 或写 `out/`；只提交源/测试/必要文档与可运行条件，唯一 merge 流水线负责 fresh 与执行。PRD-028 验收 3 已明确该局部例外，PRD 状态仍 accepted；不把原视觉方案标为 implemented。

## 审查与落地

Astra 同轮正式只读审查：Strengths 为局部内容预算、固定动作空间、兄弟相交与只读测试；Critical 0。Important 1 指出原 PRD-028/UI 单行约束冲突，已核验属实并先按规则 10a 写入仅 Provider 状态行例外。Minor 的现有 22px 命中与本地化无高度上限均已写入。Assessment 为 I1 修后可实施，正式 after 仍须独立实拍；D1381 不因方案接受关闭。reviewer 未改文件。

方案提交 `fec79c4b79a`。三份源码/测试的实施草稿再次由 Astra 只读复核 Critical 0 / Important 0；Minor 建议加长状态与来源文案预算验证，已补入同一真实几何用例，避免只有英文长姓名。

实际已运行：两份目标 TS ESLint **0 errors / 2 warnings**，命令因 warning 退出 1；用 ESLint `lintText` 对方案 HEAD 的 Provider 源文作只读基线，仍是同两条既有 `querySelectorAll` warning（原 505/1178 行，当前移到 509/1182）。更新后的样式测试单独 ESLint exit 0。目标 CSS stylelint exit 0，仍报告原文件已有变量与 token 提示。没有 compile / transpile / typecheck / watch / out 写入，也没有浏览器测试或 after 实拍结果。

唯一 merge 的最小 fresh 集为 `engineProviderModelSection.ts`、`preferencesStatusStyle.test.ts` 与 `browser/media/enginePreferencesPane.css`（2 TS + 1 CSS）；按锁内既有开发选项刷新并记 source/out 摘要。最小运行是 `Engine providers and models sections` 语义回归与 `Preferences status styles` 全套，Chrome 必须执行四条 `provider actions keep focus, hit targets and layout at narrow widths`，不得把隐藏 Electron 的 focus pending 算作通过。再由独立 reviewer 在完整默认窗口与完整浅深/HC主题，以真实 pane 的 300/340/720px 内容预算检查与操作 hover/Tab，保存 after 截图及兄弟几何；全部完成前计划仍 accepted、D1381 仍 open。
