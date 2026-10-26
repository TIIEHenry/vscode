---
title: "进度索引"
type: index
status: accepted
phase: N/A
updated: 2026-10-27
summary: "行动层进度入口；含 D388 第二次 gulp 绿证据；D390 直接 CLI 仍 OOM（dest 未写）；ELR S1–S4 与 bug-hunt 01 S2 已落，Sources 架构 P7 已落且方案仍 accepted；2026-10-16 视觉审查发现稿"
---

# 进度

| 文件 | 说明 |
|------|------|
| [upstream-min-patch.md](upstream-min-patch.md) | ADR-007 上游侵入面 A/B 清单与 comm 完备性闸门 |
| [status.md](status.md) | 当前快照（≤200 行） |
| [J/E实现peer补修阶段](default-editor-contract-audit-2026-10-26-evidence/je-peer-rework-2026-10-27.md) | E900f C0/I3/M0退回occupied、原报告未入库；J八处hasListeners调用待不可变修订/仅两overlap旧red复跑，不formal合源/emit/freeze |
| [5df已提交协议基线接入](default-editor-contract-audit-2026-10-26-evidence/main-5df-baseline-verification.md) | 231b真三路119路径保留、src精确7fa3c86=5df；无新emit，out仍ad80身份，J/E正式完整编译待 |
| [J/E不可变候选旧业务红](default-editor-contract-audit-2026-10-26-evidence/je-preintegration-old-red-verification.md) | J宿主4真红/并发2混夹具问题待作者补修；E真实DOM6红（4缺错误、2先缺busy）；34native身份均恢复，未formal合源/新绿/after |
| [180fc已提交基线接入与全量编译](default-editor-contract-audit-2026-10-26-evidence/main-180fc-baseline-verification.md) | ad80真三路保留78路径，src精确030def=180fc，真实compile-client0；原生emit替换65d旧pack，J/E候选未接，无主ff重试/after |
| [D1387 宿主源码审查](default-editor-contract-audit-2026-10-26-evidence/d1387-comparison-gate-code-review.md) / [宿主与重叠保护两轮方案审查](default-editor-contract-audit-2026-10-26-evidence/d1387-host-observation-plan-review.md) | 原实现同tuple多宿主Important；新增Sources重叠I1经第二轮方案C0/I0，J bf50方案独立accepted后实施中，未接新生产/after |
| [D1387 不可变叠加验证](default-editor-contract-audit-2026-10-26-evidence/d1387-preintegration-verification.md) | 精确23f R1/R2各4业务红；65d虚拟noEmit0、完整Electron357过、wiring23/1既有红、lint0/56；51份原始证据入库，父51/30/Src独立复核通过；J并发I1方案C0/I0/生产待接、E accepted实施中，未formal合源/after |
| [当前编译合同基线验证](default-editor-contract-audit-2026-10-26-evidence/compile-baseline-verification.md) | 全量compile-client45→3→0；Electron325过3既有红、Node10过、AstraC0/I0，源产物身份绑定提交，不升PRD |
| [D1387 实现独立peer](default-editor-contract-audit-2026-10-26-evidence/d1387-implementation-peer-review.md) / [接入与安全同步](default-editor-contract-audit-2026-10-26-evidence/d1387-peer-integration.md) | J23f完整实现C0/I2，Astra已裁补修；D不可变报告真三路接入，编译绿基线仅ff主工位，无Sources实现/after通过 |
| [D1385范围纠正与D1387方案纯文档集成](default-editor-contract-audit-2026-10-26-evidence/docs-scope-sources-integration.md) | 两ref真实三路、共享PRD与完整历史保留，源/out/原编译日志不变；D1387为当前产品执行队列，D1385停止原UI验收/open、D1386closed |
| [D1387 原两机制业务red](default-editor-contract-audit-2026-10-26-evidence/d1387-original-causes-red.md) / [custom窄例外方案审查](default-editor-contract-audit-2026-10-26-evidence/d1387-custom-newtab-plan-review.md) | 旧生产+J23f新测试0过14红（12DTO断言、2准确组业务拒绝）；仅两测试out刷新。规则16增量C0/I0，I1/I2源码补修/green/after仍待 |
| [D1387 Sources 打开 before 与设计](default-editor-contract-audit-2026-10-26-evidence/d1387-before.md) | 两真实Git库、Preview no-op与Conversation具体组路由；C1–C6/实际Debugger五模块、Astra两轮裁定；正式方案规则16已通过C0/I0，未修复after |
| [D1386 只读箭头补修检查点](default-editor-contract-audit-2026-10-26-evidence/d1386-readonly-chevron-source.md) | 非作者after I1的既有合同CSS补修；四主题computed/bounds回归已写，等待旧CSS red/新CSS green与正式新CSS同窗after |
| [D1386 叶级身份条](default-editor-contract-audit-2026-10-26-evidence/d1386-source-checkpoint.md) / [原运行](default-editor-contract-audit-2026-10-26-evidence/d1386-verification.md) / [CSS后修](default-editor-contract-audit-2026-10-26-evidence/d1386-chevron-verification.md) / [独立after](default-editor-contract-audit-2026-10-26-evidence/d1386-independent-after.md) | 原11红/40+Lens8绿，CSS4红/完整44绿，非作者真实after C0/I0/M0；范围内implemented/closed，限制保留 |
| [D1385 原运行](default-editor-contract-audit-2026-10-26-evidence/d1385-verification.md) / [取消顺序后修](default-editor-contract-audit-2026-10-26-evidence/d1385-cancel-verification.md) | 原5红/182绿、取消旧红/完整183绿；默认宿主前提已撤回，原UI验收未满足并停止，accepted/open；[范围裁定](default-editor-contract-audit-2026-10-26-evidence/d1385-default-window-scope-decision.md) / [独立入口核验](default-editor-contract-audit-2026-10-26-evidence/d1385-default-window-ui-boundary.md) / [勘误只读审查](default-editor-contract-audit-2026-10-26-evidence/d1385-scope-erratum-peer.md) |
| [D1383 Tunnel 验证](default-editor-contract-audit-2026-10-26-evidence/verification.md) | 旧生产 red、新生产 19 passing、两 TS 定向语义 0。该证据写入时全量未跑 |
| [D1382 ReviewNav 自动回归](default-editor-contract-audit-2026-10-26-evidence/d1382-verification.md) | 旧生产3过/7败、新生产37过；后续[独立默认编辑器after](default-editor-contract-audit-2026-10-26-evidence/d1382-independent-after.md)已到，按ReviewNav通知合同implemented/closed，限制保留 |
| [D1384 远端配置验证](default-editor-contract-audit-2026-10-26-evidence/d1384-verification.md) | 旧生产 16 项断言失败、4 项旧通过、1 项超时不计；新生产 21 过、远端 17 过。全量 46/28 |
| [review-docs-loop.md](review-docs-loop.md) | 15m 审查循环日志（文档漂移 / 未闭缺口） |
| [health-gates.md](health-gates.md) | Loop 集成门禁命令（本仓） |
| [deferred-gaps.md](deferred-gaps.md) | Loop 延期缺口 SSOT |
| [research-queue.md](research-queue.md) | Loop 待研究队列 SSOT |
| [packaging-p0-evidence.md](packaging-p0-evidence.md) | packaging-and-release §4.0–4.2 只读证实（工位 B / loop/B）；无窗 P1 子集见 [D388](../roadmap/active/d388-packaging-p1-asar-machine.md) |
| [d388-packaging-p1-asar-evidence.md](d388-packaging-p1-asar-evidence.md) | D388 无窗断言：空 `.map` 已复原；第二次 gulp exit 0；asar 见两包 `package.json`；首次红记录保留 |
| [d390-packaging-p2-vscode-web-evidence.md](d390-packaging-p2-vscode-web-evidence.md) | D390 无窗排除面：首败+8192/env+直接 CLI 16g/32g 均红；dest 未写；不关 D390/D391/D392 |
| [d390-packaging-p2-vscode-web-machine](../roadmap/active/d390-packaging-p2-vscode-web-machine.md) | D390 无窗 vscode-web 排除面合同（实施 blocked；dest 未写） |
| [worktree-pool.md](worktree-pool.md) | 仓外 `vscode-WorkTrees` 工位表 |
| [钉死引擎调试](../../docs/guides/debug-engine.md) | 仓外 HeadlessServer，不是 Loop 槽 |
| [bug-hunt-2026-09-24](bug-hunt-2026-09-24/INDEX.md) | 2026-09-24 十六路只读扫描；方案在 `dev/plans/bug-hunt-2026-09-24/` |
| [ui-gap-review-2026-10-01.md](ui-gap-review-2026-10-01.md) | 2026-10-01 四路只读 UI 缺口审查（3 Critical、19 Important）；发现稿，不登记 D、不升 PRD |
| [visual-review-2026-10-16.md](visual-review-2026-10-16.md) | 2026-10-16 对照 UI 设计原则审查工作区未提交的视觉改动（5 条需要改、3 条建议改）；静态审查未截图，发现稿，不登记 D |
| [sources-architecture-review-2026-09-28.md](sources-architecture-review-2026-09-28.md) | Sources 只读架构审查 8 条（SAR-1…8）。方案 [sources-architecture](../plans/sources-architecture.md) 仍 accepted；P7 已在 loop/merge 落 |
| [engine-link-architecture-review-2026-09-28.md](engine-link-architecture-review-2026-09-28.md) | 引擎链接只读架构审查 9 条（ELR-1…9）。ELR-1/ELR-2 的 S1–S4 与 bug-hunt 01 S2 已落；试连超时绕过 SAS 仍开 |
