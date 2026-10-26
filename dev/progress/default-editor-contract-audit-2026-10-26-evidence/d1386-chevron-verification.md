---
title: "D1386 只读箭头补修运行与范围闭合"
type: reference
status: accepted
phase: M7
updated: 2026-10-26
summary: "旧正式CSS下四主题computed block/12×12全红，仅复制新CSS后4绿/完整44过；目标TS0、lint0，stylelint旧新同5变量/9建议。独立真实after C0/I0/M0，D1386闭合。"
---

# D1386 只读箭头补修与闭合

D正式补修 `b774373547426a592724f275ef131917fd3bdcfe` 真三路合入 `1247bec91a29d2202d1a13b40de861f4ea83b461`（父57cdb48）。仅生产CSS新增hidden优先选择器，及4条加载真实Identity/codicon CSS与生产glyph的computed/bounds回归；三份生产TS/JS不变。源及静态peer见[作者检查点](d1386-readonly-chevron-source.md)。

## 精确旧 CSS red → 仅 CSS green

out旧CSS SHA256 `5c595ca1447e1e6fe5b5ea3b28395c2d8b2baee1d5e5391b55a93987ce521839` 与57源CSS精确相等。只fresh IdentityStrip测试，三生产JS整文件hash/mtime不变；[身份](d1386-chevron-test-refresh.json)记录source/output。官方Electron+隔离Xvfb、跳过prelaunch，grep `D1386 production CSS` 为 **0 passing / 4 failing**；四主题均在engine folder、240px的真实computed `display:block/12×12` 对 `none/0×0` AssertionError，见[old-red](d1386-chevron-red.log)。无load/timeout，不把旧红说成已经跑完后面的branch/720px断言。

仅复制正式新CSS到out，source与output均为 `dee625a2a7c5a5ebbc10020c236f73409b927fb5939f9a3a8f262b8dcd0b8083`、5671bytes，output mtime `2026-10-26T11:34:30.988Z`；三生产JS和新测试字节均未改变，见[CSS刷新](d1386-chevron-css-refresh.json)。同grep **4 passing**，完整IdentityStrip **44 passing**（清理1、原39身份用例、新4CSS用例），见[四主题green](d1386-chevron-green.log)、[完整green](d1386-chevron-green-full.log)。新green逐主题走local→engine→local、240/720宽度，engine两箭头none/0×0、local可见且非零。

## 静态与独立 after

本次3改动TS在原src/tsconfig上下文逐文件semantic+syntactic noEmit0，含本刀单test；三TS ESLint0errors/0warnings，见[类型](d1385-d1386-followup-types.json)、[lint](d1385-d1386-followup-eslint.log)。stylelint对57旧CSS与正式新CSS都exit0，但均5条既有unknown variable诊断（conversation-background1、ua-ease4）与9token建议；[对照](d1386-chevron-stylelint-compare.json)及[旧](d1386-chevron-stylelint-old.log)/[新](d1386-chevron-stylelint-new.log)保留，不能称无诊断。

通知C非作者实际CSS路径/hash就绪后，其在原默认编辑器窗口真实reload生产href、CSS.getStyleSheetText精确读到dee625/5671bytes，没有临时注入。四主题、1024紧凑两叶、实际Tab/Enter/Space/Esc、各叶菜单URI/当前项与异步旧结果等[最终独立after](d1386-independent-after.md)为C0/I0/M0，I1已解除。集成核对三loadedJS正文与当前D三产物一致、CSS精确相同，亲视紧凑只读Tab跳过/高对比菜单截图，82图仅本地绝对路径保存；原observations按字节gzip留存。清理记录及PID复核完整。

父已据真实运行和完整非作者after核验授权范围闭合：D1386 closed、[方案](../../plans/2026-10-26-leaf-session-root-identity.md) implemented。此结论不包含真实Git/diff/checkout、远程授权新窗口或在线引擎，SCM为内存provider、checkout为真实UI command spy；不升PRD-029总体、不签S5/每叶自动挂载或信任扩展。C f9 voice action没有借此宣称在D窗口加载。本后修未做全量编译；原source6f82唯一full45/27失败和更早46/28/55/36均保留，不能替后修估计新全量计数。

新测试log展示副本仅规范行尾空白，byte-exact原件同名.raw.log.gz，各-run.json保存raw/display SHA和命令时间；未覆盖57以前的任何运行日志。
