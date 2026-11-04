---
title: "其余设置页视觉组合验证"
type: progress
status: accepted
phase: N/A
updated: 2026-11-02
summary: "三路视觉组合完成；1101组件用例通过、4pending，47张受控截图；非真实引擎默认窗口验收。"
---

# 其余设置页视觉组合验证

覆盖需求：PRD-025、PRD-026、PRD-028（仅视觉适配，PRD不升）。[方案](../../plans/preferences-visual-alignment.md)规则16只读审查C0/I4已逐项核验收口；[并行看板](../../parallel/active/preferences-visual-alignment.md)。

## 结果与准确范围

| 检查 | 最终结果 | 原件 |
|---|---|---|
| Engine相关browser与test/browser用例 | 832 passing，0 failing | [engine-tests-final.log](engine-tests-final.log) |
| Connection、preferencesStatusStyle、SettingsEditor2 | 269 passing，4 pending，0 failing | [settings-tests-final.log](settings-tests-final.log) |
| 目标TypeScript语义与语法 | 20文件，0 diagnostics；不是全仓compile | [typecheck-final.log](typecheck-final.log) |
| 相关TS eslint | 0 error / 17 warning；未逐条证明均为基线 | [eslint.log](eslint.log) |
| Playwright生产组件受控数据渲染 | 47图，0横向溢出、0pageerror | [metrics](render-metrics.json)、[log](render.log) |

四个pending来自preferencesStatusStyle既有四主题焦点用例：Electron runner隐藏窗口，document.hasFocus()为false时条件跳过；本轮未添加跳过。相关生产和测试先经仓库 `build/next/transpile.ts` 转译57模块与复制5样式，再跑Electron；不是完整compile。目标类型检查用src/tsconfig.json建立program，逐文件getSyntacticDiagnostics/getSemanticDiagnostics（skipLibCheck/noEmit）：14个相关生产模块、EnginePreferences/Tools/Skills/Catalog/Connection五份测试及SettingsEditor2测试。

复跑入口（先按仓库指南准备out与Electron；无显示器环境需虚拟显示服务）：

```bash
rtk proxy bash scripts/test.sh --no-sandbox --glob 'vs/workbench/contrib/conversation/{browser,test/browser}/engine*.test.js'
rtk proxy bash scripts/test.sh --no-sandbox --run vs/workbench/contrib/conversation/test/browser/connectionPreferencesPane.test.js --run vs/workbench/contrib/conversation/test/browser/preferencesStatusStyle.test.js --run vs/workbench/contrib/preferences/test/browser/settingsEditor2.test.js
```

`--glob`与`--run`分开运行，runner优先run，混用会漏跑glob。共享out曾短暂缺少未触碰的base模块，恢复本轮转译后启动重试成功，不把模块加载失败归为产品断言失败。

## 视觉取样

Engine其余14页各1440×1000与440×760共28图；Skills/Agents/MCP的1024×380短窗3图；Providers/Models/Rules/ContextVariables深色及高对比8图；Connection Direct/Profiles宽、窄、短、高对比8图。用现有测试工厂挂真实生产pane、注入受控连接目录与主题token，未连接或写真实引擎。47张覆盖不同页面与尺寸，深色/高对比为取样而非每页全矩阵。Client以真实SettingsEditor2响应式测试验证进入/退出UA作用域前后虚拟行与group几何保持，未作完整窗口截图。

- [Connection Direct宽屏](connection-direct-wide.png)、[窄屏](connection-direct-narrow.png)、[短窗](connection-direct-short.png)
- [Providers](providers-wide.png)、[Models](models-wide.png)、[Rules窄屏](rules-narrow.png)
- [Skills](skills-wide.png)、[Agents窄屏](agents-narrow.png)、[MCP短窗](mcpServers-short.png)
- [高对比取样](providers-hc.png)、[深色取样](models-dark.png)

## 集成修正与保留证据

第一轮发现Provider夹具没有真实detail层级，补层级及样式/主题token后保留原碰撞、包含、完整标签与焦点断言；旧24px视觉高度改为新尺度至少40px。Skills与Connection开关role期望改为switch，动作名与业务值保留。Tools重画仅抑制程序splice期间的选择副作用，显式重选仍重查以保留pairing-hold语义。MCP初始ready时机和Connection程序分区切换导航同步也已修正，新增对应测试。

早期失败原件保留于本目录：engine-tests-before-integration-fixes.log、settings-tests-before-density-expectation.log、typecheck.log、tests.log等；最终结论只依上表final原件，不把早期失败抹掉或当基线通过。

## 文档与验收边界

稳定知识已同步Engine catalog、Settings接入、UI原则、PRD局部视觉补充；方案、看板和进度索引已更新。文档门禁结果补在下方。wiki remind存在全仓存量提醒，本轮不归档无关计划、不变更无关WIP；本主题知识已回写。

未全仓compile、未安装、未真实引擎默认编辑器窗口验收；未提交、未推送。受控组件证据不代表连接/权限/保存黄金路径产品验收。Sessions入口不属于本轮产品验证。

文档最终检查：`python3 scripts/check-docs-health.py` 检查731份Markdown，0错误36警告；`python3 scripts/wiki/wiki.py check --root .` 0错误371警告；`python3 scripts/generate-docs-status.py --check` OK；`git diff --check` 通过。警告含跨仓失效链接、存量审查状态和plans目录预算，不把它们称为全部文档无警告。

## 用户截图追补：宿主顶部与断连条（2026-11-02）

上轮组件图未包含真实Preferences外层header，遗漏了ActionBar继承满尺寸加padding的内缩不对称，以及Engine去掉pane padding后banner的水平零内衬。本轮同时覆盖Connection/Engine宿主：ActionBar与UL改自然宽高、border-box；返回与切换间距用flex gap，分段保留2px对称内缩；header与banner宽屏均24px、窄屏16px安全边距，compact总边距扣除pane已有10px。

追补方案经只读review_settings_visual审查C0/I0。`preferencesStatusStyle.test.ts` 新增真实ActionBar/Button与生产CSS盒测量：1100/440/320宽、浅深/两种高对比，检查分段左右上下内缩、banner文字/动作安全边界以及Connection共享header边距。与EnginePreferences整份回归合计50 passing / 4 pending / 0 failing，见[追补日志](host-alignment-tests.log)；4pending为Electron隐藏窗口无真实焦点时条件跳过的既有四主题Provider焦点测试，本轮没有添加skip。定向eslint0错误0警告（npm配置提示另列），见[日志](host-alignment-eslint.log)。首轮追补因新增测试stylesheet相对路径多退一级加载失败，修正后重跑，原件保留host-alignment-tests-before-fixture-path-fix.log。

另留[宽屏](host-alignment-wide.png)、[窄屏](host-alignment-narrow.png)、[深色](host-alignment-dark.png)布局夹具取样：加载生产CSS并复用相同DOM结构，非完整生产窗口截图；按钮运行时主题样式未全部注入，只用于检查顶部几何。真实控件几何以上述Electron测试为准。未更新全仓编译/真实引擎验收结论。
