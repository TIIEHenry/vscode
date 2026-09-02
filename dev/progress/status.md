---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-02
summary: "HEAD 83b279a0；M7 转入 UI 完成波，P 槽承接 platform/universeAgent 合同（Web 断连含 Hub、MCP 运行态/Plugins、DetailRef、模型注册表、compacted），A=Engine/Connection、B=Conversation→Client Settings、C=品牌/键位/主题/Web 三 UI 槽并行，测试债由 V 槽旁路处理"
---

# Development Progress

## Current Session

- **集成 HEAD：** `83b279a0` — `agent-ide`；loop/A–D 与 loop/merge 同指该提交，进入 M7 前工作树基线干净。
- **M6 代码事实：** A1/A2、page-access B、trajectory D、stream-timeline S1–S6、Hub H0–H5、Navigator N1–N4、Sources Review R1–R4b、Diff F1–F3/F5 均已落；Engine E1 已有 Skills/Agents/MCP Definitions/Tools 读写主体。
- **未验证不等于未开发：** PRD-008、Diff F4、Navigator N5、Review R5、Hub H4a、Web D15 仍缺证据；它们进入 V 槽，不再冻结 UI 主线。
- **M7 产品裁定：** 测试失败不阻塞后续 UI 切片；数据损坏、权限绕过、secret 泄漏为全局硬门；无法编译/启动与分层破坏只阻塞该**冲突域**合入（与 [health-gates](health-gates.md) 一致）。新失败统一记 [D17](deferred-gaps.md)。
- **M7 方案：** [总波](../plans/m7-ui-completion-wave.md)及 Engine、Client、Conversation、产品身份、可达性五份子方案 **2026-09-02 升 `accepted`**。规则 16 四轮：本会话只读一轮 → Cursor CLI `cursor-grok-4.6-high` `--mode ask` 7 路并行三轮（第一轮 7×Approve with changes，9 Critical / ~45 Important；第二轮 7×Approve with changes，0 Critical；第三轮 6×Approve + Conversation 1 Important 已文本对齐）。各方案「规则 16」节有逐轮处理表。可按看板开工。第二轮新增改动：P0 补 Hub、Client Settings 移交 B、Agents Model tab 改 unsupported（G-ENG-4）、Client 再删两键余 9、产品身份 §3 改为两棵目录树（`userDataPath.ts` 开发态名）、DetailRef 六态合同、对话页停止把 error/unknown/question 洗成 assistant。
- **审查改入要点（2026-09-02）：** ① 新增 **P 槽**承接 `platform/universeAgent` 合同——Web 形态今天没有 `IUniverseAgentConnection` 注册（`workbench.web.main.ts` 无 UA 行、无 `platform/universeAgent/browser/`），P0 先补；② Engine 方案 Provider/Model 按引擎 proto 重写：模型是 `ConfigService.ListModels` 只读注册表，Provider 凭据无 RPC（G-ENG-1）保持 unsupported，会话级 `SwitchModel`/模型策略不进 Engine 页；③ DetailRef 的引擎 RPC `AgentService.FetchToolDetail` 已存在，缺的是 IDE 通道（P2a）；compacted 缺 host demux（P2b）；④ Client Settings 删掉无消费点的 `advertiseWorkspaceTools`；⑤ 可达性 A11Y-1/2、RWD-1/2 的实施归 B/A，C 出清单；⑥ **用户裁定**产品图标以 Singularity 标识（`Singular/logo/singularity.svg`）为唯一源，product-identity I3 拆 I3a/I3b 后不再阻塞。协议参考页新增 [§1b](../../docs/reference/universe-agent/engine-protocol-surface.md)。

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
