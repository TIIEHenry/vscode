---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-02
summary: "loop/merge 已合入 M7 代码与 accepted 方案；P0/P1a/P1b/P2a/P2b、E2-1–E2-2/E2-4–E2-7、Q2–Q6、I2–I5/I3b、K2 已落；CS-1 进行中；测试债 D17/D18 旁路"
---

# Development Progress

## Current Session

- **集成 HEAD：** `loop/merge` 已并入 `agent-ide` 的 M7 accepted 方案（`b772de6f`）与字母槽实现。推送后以本合并提交为准。
- **M6 代码事实：** A1/A2、page-access B、trajectory D、stream-timeline S1–S6、Hub H0–H5、Navigator N1–N4、Sources Review R1–R4b、Diff F1–F3/F5 均已落；Engine E1 已有 Skills/Agents/MCP Definitions/Tools 读写主体。
- **未验证不等于未开发：** PRD-008、Diff F4、Navigator N5、Review R5、Hub H4a、Web D15 仍缺证据；它们进入 V 槽，不再冻结 UI 主线。
- **M7 产品裁定：** 测试失败不阻塞后续 UI 切片；数据损坏、权限绕过、secret 泄漏为全局硬门；无法编译/启动与分层破坏只阻塞该**冲突域**合入（与 [health-gates](health-gates.md) 一致）。新失败统一记 [D17](deferred-gaps.md)；I3b 安装包未验记 [D18](deferred-gaps.md)。
- **M7 方案：** 六份子方案 **2026-09-02 升 `accepted`**（规则 16 四轮，见各方案文末）。
- **本波已落代码（loop/merge）：** P0 Web 三服务断连；P1a MCP 运行态/Plugins 真探测；P1b `listModels` + `providerConfig` 固定 unsupported；P2a DetailRef `requestDetail`；P2b L2 compacted 归因投影；Q2 接通 Detail 六态 + stub/engine `requestDetail`；Q3 compacted 只消费 attribution、零伪造；Q4 live 过程折按 `fold:${firstId}` 保留展开；Q5a 四 kind 不再洗白 + 独立提问座位；Q5b 键盘 Escape 分层 + Accessible View；Q6 叶宽打 `.is-narrow` / `.is-compact` + 300px 保住输入/Back/reveal；E2-1 废止 hide-on-disconnect + 六态 + Web 省略桌面控件；E2-2 Model 只读注册表 + Provider 零输入；E2-4/E2-5 Runtime/Plugins 接真方法；E2-6 四节迁入保持选中/dirty + Agents Model unsupported；E2-7 窄宽度 `.is-narrow` + 跨面断连文案对齐；I2 userData `universe-agent-studio-dev`；I3a 品牌源与生成；I3b deb/rpm hicolor + electron 元数据；I4 点名路径去 Code - OSS；I5 从 code-oss-dev 迁 settings/keybindings/snippets；K2 Sources Review 三命令接到选中行。
- **未完：** CS-1…CS-6 Client Settings；C 槽 K1/T1/L1；W1 Web 冒烟不挡主线。

## Blockers

- 当前没有阻塞全部 M7 UI 开发的代码项。
- 子域硬阻塞只按 [health-gates](health-gates.md) §开发继续规则判定。
- 非阻塞账：[D8](deferred-gaps.md) valid-layers、D9 terminal、D15 Web 证据（依赖 P0）、D16 基线红、D17 M7 验证债。

## Next

规则 16 已完成（2026-09-02），按 [并行看板](../parallel/active/m7-ui-completion.md) 开一平台槽、三 UI 槽与一验证槽：

| 槽 | 顺序 | 方案 |
|----|------|------|
| P | P0 Web 断连（Connection + SessionView + Hub）→ P1a MCP 运行态/Plugins → P2a DetailRef → P1b 模型注册表 → P2b compacted；每刀同步 browser 实现 | [总波 §4 Wave 0](../plans/m7-ui-completion-wave.md) · [protocol-surface §1b](../../docs/reference/universe-agent/engine-protocol-surface.md) |
| A | E2-1（两栏宿主 + 废止 hide-on-disconnect + **Web 省略桌面控件**，P0 后）/ E2-3 Rules/Hooks 壳 → E2-2/E2-4/E2-5 壳先落、真数据随 P1b/P1a → E2-6 迁入 → E2-7 窄宽度（RWD-2）与文案 | [Engine](../plans/engine-preferences-completion.md) |
| B | Q1 Overview + Q2 壳（preview/unavailable）→ Q3 compacted（随 P2b）/ Q4 live fold / Q5a 四 kind + 停止洗白 / Q2 接通（随 P2a）→ Q5b 键盘 ARIA / Q6 窄宽度跨面 → CS-1…CS-6 Client Settings | [Conversation](../plans/conversation-ui-closeout.md) · [Client](../plans/client-settings-completion.md) |
| C | I2 + I3a 标识与图标脚本 / K1 → T1 / K2 / I4 / I5 → W1 Web 冒烟（随 P0 + E2-1）/ I3b / L1 清单复核 | [Identity](../plans/product-identity.md) · [A11y/RWD](../plans/accessibility-responsive-ui.md) |
| V | M6 证据、D16/D17、各 M7 回归；不抢生产文件 | [Deferred gaps](deferred-gaps.md) |

**不做：** H6 GUA 自动直连、完整插件/Skill 市场、用 fixture 冒充 Engine、为追求全绿冻结不冲突 UI 槽、引擎仓侧新增 RPC（只登记 G-ENG-1/2/3）、会话级模型策略 UI。
