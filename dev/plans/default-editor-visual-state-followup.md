---
title: "默认编辑器视觉状态修复与续审"
type: plan
status: accepted
phase: M7
updated: 2026-10-26
summary: "五项视觉修复已提交并有原运行证据；三路合成后真实窗口发现D1380未知Stub投影、D1381 Provider窄行碰撞，剩余边界待修，当前不宣称整轮视觉通过。"
---

# 默认编辑器视觉状态修复与续审

用户已授权「修复后继续」。依据 [PRD-025 / PRD-028](../../docs/product/requirements.md)、[UI 规范](../../docs/architecture/cross-cutting/ui-design-principles.md) 与 [产品范围](../../docs/product/vision.md)。本轮只使用默认编辑器窗口；Agents Window 仅作对照。既有 D1371–D1373 已修问题不重复计入。

## 问题、机制与验收

| 项 | 根因与修复机制 | 验收与边界 |
| --- | --- | --- |
| V1 状态正文可读性 | Connection / Engine 成功、警告等说明把图标语义色用作正文。正文回到 foreground，语义色保留在已有图标/圆点或淡底 | 生产 CSS + DOM 浅/深/高对比主题测正文合成对比至少 4.5:1；已有加载、成功、警告、失败文案保留；窄宽不溢出，不将所有语义指示抹灰 |
| V2 会话列表失焦 | 默认编辑器会话列表子元素固定 activeSelectionForeground，未跟随列表切换背景 | 选中行标题/idle 图标继承行前景或按活动/失焦正确配对；Light+ 与产品浅/深色检查，从列表聚焦到 Composer 后文字仍可读；保留键盘焦点与副标题层次 |
| V2b 续审：Sources 引擎文件列表 | 现行 sourcesFilesExplorer 的 engine directory 入口使用 SourcesFilesList；名称固定 foreground，覆盖 ResourceLabels 继承色，选中背景变化时文件名不跟随 | 仅选中/聚焦的 label-name 继承实际行前景，未选名称与 meta 层次不变；真实 SourcesFilesList / WorkbenchObjectTree 与生产 CSS 验证 Light+ 及产品浅深色的聚焦→外部输入→返回；不改数据或树模型 |
| V3 选择与悬停区分 | Triggers / Clipboard / Context Variables 选择和悬停共用 toolbar.hoverBackground | 有焦点用 activeSelection 前景/背景，失焦用 inactiveSelection 前景/背景；子名称/说明继承该配对，悬停用 hover 且不覆盖选择；两行同现时可分辨，保留键盘焦点；不增加状态源或选择行为 |
| V4 Provider 只读状态 | 不能切换的状态画成 switch，Enabled/Disabled 文字被视觉隐藏；Provider 整行 opacity 会继续稀释禁用状态和仍可用动作 | 移除开关轨道/滑块，显示已有本地化状态文案；仅撤掉 Provider 整行 opacity，Models 原行为不变；无 switch role、无额外 Tab stop、不发新 RPC；保留配置状态与凭据操作。PRD-025 与 engine-catalog 已先更新 |
| V5 过程折状态 | 模型不统计 cancelled，外层无取消图标；状态计数拼在步骤名末尾，整串省略会裁掉关键数量。增加真实取消计数/图标，将状态拆成独立元素，仅名称可省略，状态必要时换行 | 执行中 → 失败 → 取消 → 无的图标优先级保留既有执行/失败优先；混合 failed/waiting/cancelled 数量完整，300 / 450 / 720px 叶宽不裁状态；未知工具不画完成勾；原位状态更新与展开/收起回归，不仅重排文本冒充解决 |

## 分工与验证

这是人类直接协作的当前分支工作，不启动 loop、不占新 worktree。共享工位按文件互斥：设置 agent 独占两份首选项 CSS、Provider renderer 与设置测试；过程折 agent 独占 Fold Model / Fold renderer、conversationLens.css 与相关测试；会话列表 agent 独占 conversationSessions.css / 就近回归，以及续审 Sources 引擎文件列表 CSS / 样式回归；父 agent 负责文档与唯一产物刷新。所有 agent 均不启动全仓编译或并发写 out。

1. 方案写完先派独立只读 reviewer，核验 Critical / Important 后改稿，方案与实施分开提交。
2. 采用现有 DOM 行为测试与真实生产样式回归，避免 CSS 字符串镜像测试。先用旧生产产物运行新回归确认失败，再刷新改动生产产物验证通过；只做覆盖本轮风险的测试。
3. 父 agent 持 `/tmp/vscode-compile.lock` 只刷新改动 TS/CSS，使用仓库开发 esbuild 选项；需要时用 TypeScript API 对变更文件定向语义检查。既有全仓编译红基线不写成通过，不为视觉修复扩大到其他诊断。
4. 首选仓库 `scripts/test.sh` 的实际 Electron DOM；按需隔离 Xvfb / user-data，不读写日常登录、不连接引擎。仅复用已有 Stub / fake service 夹具。静态、DOM 主题夹具、完整产品实拍分别记证据，不互相冒充。
5. 通过定向 lint、diff-check、文档健康与生成状态检查后同步方案/行动层，并继续只读审查同类问题。修复范围外或需改变产品能力的发现单独记录，不虚构已完成。

## 进度与只读审查

- [x] 规则 16：`shell_visual_audit` 于 2026-10-26 独立只读审查，Critical 无；两项 Important 已核验写入 V3 的前景/背景与子文字配对、V4 的 Provider 整行透明度边界；可进入实施。Minor 纳入回归：未知工具覆盖 live / Stub，两态均不画完成勾；全部明确 completed 时外层仍无图标，仅工具行保留勾。
- [x] V2b 补充短审：`timeline_visual_audit` 独立核对现行引擎目录 → SourcesFilesList → WorkbenchObjectTree / ResourceLabels 路径，Critical / Important 无，可实施；Minor 采纳为聚焦未选行与未选邻行不受新选择样式污染的回归。
- [x] V1 / V3 / V4 设置侧修复及回归；同根因修正两份 CSS 的高对比根类选择器，Provider 保持 24px 单行、只读状态完整、托管提示随重绘释放。
- [x] V2 会话列表失焦修复及回归；真实焦点复验补修选中行背景过渡的短暂低对比，普通悬停过渡保留，尊重主题图标前景。
- [x] V2b 续审 Sources 引擎文件列表同根因修复及回归（独立短审后实施）。
- [x] V5 过程折状态修复及回归；状态摘要不随步骤名省略，未知工具不画完成勾，取消与混合状态原位更新。
- [x] 新产物针对性验证、续审与文档收尾；八套件 Electron 350 passing / 14 个真实焦点 pending，官方 Chrome 补验该十四项全部通过且零 pending；定向九份 TS 与 HEAD 同为九条既有诊断，无新增。详见 [验证证据](../progress/default-editor-visual-state-followup-evidence/verification.md)。
- [x] 最终独立只读复核：`timeline_visual_audit` 确认代码/文档边界与验证数量一致，Critical / Important 无；Minor 已收窄 Back 焦点环仅条件核对的证据措辞。

协作与最终证据统一记入 [本轮看板](../parallel/active/default-editor-visual-state-followup.md)。不提升 PRD-025 / PRD-028 总体状态。

## 合成后独立实拍续审

原825提交的350+14与上述完成勾选是当时组件/主题夹具证据，保留不改写。source330b689的merge聚焦287+14与九TS语义0之后，真实默认窗口又证实D1380未知Stub投影及D1381 Provider兄弟badge碰撞；两项与V4/V5原验收直接相关，当前状态回到accepted（方案生成列闭集不支持in_progress，已接受方案但剩余边界尚待实施/复验）。父已分别委派D/C独立根因修，方案与最终复验见[当前集成看板](../parallel/active/ui-visual-review-2026-10-26.md#新轮默认编辑器视觉源码三路合成)；未修前不宣布整轮视觉通过，旧测试与实拍证据不互换。
