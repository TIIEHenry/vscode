---
title: "会话导航 GPT 参考图视觉"
type: progress
status: in_progress
phase: N/A
updated: 2026-11-02
summary: "Sessions 与 Projects 舒展行高及行尾菜单；只读方案审查已完成。"
---

# 会话导航 GPT 参考图视觉

- 方案：[视觉语言 §21](../../plans/chatgpt-visual-language.md#21-2026-11-02-用户修订会话列表舒展尺度)。
- owner：主 agent 实施两个列表、菜单与验证；保留其它 WIP，不提交。
- reviewer：review_list_plan 只读审查 C0/I3，重要项已改入方案。
- 实施：40px 行、项目组头 52px（含12px组前留白）、28px更多按钮；不添加钉住功能。
- 检查：本地验证：最新两个组件测试88 passing / 5 pending，Projects CSS检查3 passing，定向ESLint 0 errors（Sessions相关3 warnings）。compile-client曾于本轮19:33通过；末轮重跑仅在其它并发WIP engineToolsSection.ts:177报 Toggle 缺inputActiveOptionForeground，当前组合树编译未通过，未修改该文件。docs-health/wiki check无错误。实际默认窗口视觉/键盘复验未完成，未提交。

- 续补owner：活动栏/侧栏/阅读列/Composer；§22规则16 C0/I3已采纳，UA功能门控保持；隔离默认窗口已启动（无真引擎），实际检查进行中。

- 用户高度纠偏：§23覆盖此前40px行/44px底栏方案，改32px行/44px组/36px标题/28px输入控件/36px最小底栏；审查C0/I1已采纳。编译与实际窗口重验中。

- 收尾：用户明确列表高度后最终30px/组42px/行尾28px；§24复核C0/I0/M0。270组件过5pending、编译通过，CSS41过2处Engine旧尺寸断言记D17；实际窗口与源哈希见[验证记录](../../progress/conversation-gpt-visual-evidence/verification.md)。未提交、无真引擎验收。

- 最终续补：§25导航与§26输入卡完成；272组件过5pending、编译通过，CSS41过2个D17旧断言。Terra完成后对比C0/I0/M0、路径Minor关闭；实际侧栏240px，输入active98/prefirst122px。证据与限制见上述验证记录。未提交。

- §27图标细化：新增共享局部SVG轮廓，圆头1.5px描边、三点、权限盾牌与chevron；HC回退Codicon。238组件过5pending，编译/lint无错误；Terra C0/I0/M0。未提交，无真引擎。

- §28菜单：原生委托白名单+局部样式，16px壳/4px内衬/14px字/30px行，动作范围不变。238组件过5pending、编译/lint无错，Terra C0/I0/M0，真实多项子菜单未验。
