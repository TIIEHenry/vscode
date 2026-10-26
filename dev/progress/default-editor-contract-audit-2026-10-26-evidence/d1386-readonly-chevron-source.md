---
title: "D1386 只读箭头 after I1 补修源码检查点"
type: reference
status: active
phase: M7
updated: 2026-10-26
summary: "仅补生产hidden优先选择器与四主题真实CSS/DOM几何回归；未运行，等待merge旧CSS red/新CSS green和C同窗正式CSS复验。"
---

# D1386 只读箭头补修

从 D `ea54727` clean 核对祖先关系后只ff到真实运行检查点 `57cdb48b010e8fb685ad7e76916e59cf9d6833d7`。原11业务red/11新green、完整IdentityStrip40和Lens8、四TS0的集成证据均保留；这次不冒充重跑，也不改前波full45/27失败。

## 独立 after 发现与根因

C（非D作者）默认编辑器的 `gamma` / `fresh-gamma` 两只读箭头 hidden=true，但display:block/visibility:visible，各12×12；tabIndex=-1、无popup、default cursor和无操作均正确。证据为 C `.build/d1386-independent-after/observations-readonly-details.json` 与 `shots/51-readonly-chevron-details.png`。作者实读报告/DOM并看原图，未自行操作运行窗口或改样式。旧loaded CSS 5624bytes / SHA256 `5c595ca1447e1e6fe5b5ea3b28395c2d8b2baee1d5e5391b55a93987ce521839`，与57cdb48 source CSS相同。

实际 `base/browser/ui/codicons/codicon/codicon.css` 的 `.codicon[class*='codicon-']` 声明display:inline-block；箭头是flex子项，computed被blockify。作者display覆盖UA hidden规则；身份条已有strip/chip/Add的高优先hidden组漏了箭头。因此只新增 `.monaco-workbench .part.conversation .conversation-identity-chip-open[hidden] { display:none }` 到同组，不改布局/颜色/交互/权限。属于原方案§2.4合同补修，无新设计。

## 新增回归与静态检查

`conversationIdentityStrip.test.ts` 新增四项（vs / vs-dark / hc-black / hc-light），每项真实加载production IdentityStrip CSS、codicon CSS和 `getIconsStyleSheet` 生成的production glyph规则。真实Lens local→engine→local，每阶段240/720宽；检查strip确实渲染、folder/branch箭头computed display和实际bounds：engine none/0×0，本地visible/非零且tabIndex0。没有复制CSS或只断hidden/source regex。

- 改动test ESLint exit0，0errors/0warnings；git diff --check exit0。
- 定向stylelint新CSS exit0，但5条既有unknown变量诊断（conversation-background一次、ua-ease四次）和9条token建议；57cdb48原CSS在临时文件用同命令复现同5+9，仅行号随新选择器移一行，不宣称stylelint无诊断。
- 未编译/typecheck/transpile/out/watch、未运行任何依赖out测试。文档门禁执行结果随交付记录，不把静态peer或本检查点称UI验收。
- C非作者只读补修diff peer C0/I0：选择器直接命中真实根因，四条真实CSS/glyph computed/bounds回归覆盖local→engine→local与窄宽；最终实际窗口复验仍等正式新CSS，不据静态结论解除I1。
- generated status check exit0；docs health exit0，550 markdown / 0 errors / 46既有links warnings。

## 唯一merge与独立after交接

保持三生产JS及原测试green来源不变，核旧CSS仍为5c595…；只fresh新增test JS，grep `D1386 production CSS`，期望四个真实computed几何red（不得以load/timeout计业务red）。再复制正式新IdentityStrip CSS到唯一merge out，核SHA；只换CSS后同grep green，并完整IdentityStrip回归。codicon.css、字体与iconsStyleSheet须为真实现有产物，缺资源是夹具失败，不记产品red；不注入替代display规则。仅merge负责测试产物fresh/类型校验。

C已保留原默认编辑器窗口及before CSS身份；正式新CSS产物交付后由C真实reload该href，核loaded CSS/hash，再在四主题、窄宽、local/engine箭头与实际键盘菜单复验。D作者不自行代签after，不提前解除I1；planaccepted/D1386open直到实际结果齐备。没有真实git checkout、mic或语音网络。
