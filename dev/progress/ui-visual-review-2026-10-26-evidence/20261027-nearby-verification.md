---
title: "Conversation近邻细节：引用删除与助手动作按压"
type: reference
status: completed
phase: M7
updated: 2026-10-27
summary: "真实长引用窄叶越界已修：删除22px、chip仍26px，链接可省略；助手action按压反馈恢复。浅深正常窄及HC窄6组前后，扫描基线39过2失败与stylelint15/179不变。"
---

# 实际diff与主要证据

[方案§15](../../plans/chatgpt-visual-language.md#15-近邻表面细节引用删除命中与助手动作按压2026-10-27) · [前后几何/来源/测试/独立diff](20261027-nearby-results.json) · [复现探针](20261027-nearby-probe.cjs)。本轮只在现有WIP上追加 `conversationLens.css` 的引用芯片与助手动作规则；§14的底栏中线/摘要行保留，不改消息卡、代码头、大布局、C1身份/C2原型或TS状态语义。

| 表面 | before实测 | after实测 |
| --- | --- | --- |
| 窄叶长引用 | 叶375.5px，chip334×26，但anchor350px不能缩小，删除钮16×16在x423–439，越过叶右424；chip scrollWidth370>client334 | 链接308×26省略、删除22×22在x381–403，完整落在334px chip内；chip/row scrollWidth分别等于clientWidth，chip高仍26 |
| 正常叶引用 | chip578.484×26，删除16×16 | chip584.484×26，删除22×22。多6px宽度换取命中区，未增高 |
| 引用删除hover/focus | hover透明；普通默认焦点已有1px，HC原为2px外描 | 补中性hover/active；普通1px内描、HC保留2px强焦点改内描（HC hover token可透明，不冒称其有淡底变化），中心/距右边2px hit均命中按钮 |
| 助手动作press，稳定等待160–180ms | 浅色hover与active同rgba(0,0,0,0.12)，深色同rgba(90,93,94,0.31) | 浅色press为rgb(214,214,216)，深色press为rgba(255,255,255,0.2)；hover保持；HC沿用现有token/fallback，不声称HC浅色white/.1背景有肉眼可辨明度差 |

引用修复只给draft chip直属anchor加min-width:0、overflow:hidden、text-overflow:ellipsis、white-space:nowrap；**未采用box-sizing:border-box**，因此没有把pill原content-box22px加4px内衬的26px总高改成22px。完整DOM标签、ARIA与原托管hover均保留；正文session pill规则不动。删除钮flex-shrink0、22×22、small圆角，字形仍16px。

助手active原声明非important，被ghost基础透明/hover important盖掉。只把active置于hover后并同级important，排除aria-disabled/原生disabled；没有移除所有Button的基底保证，也没有改颜色token、hover/focus、缩放或位移。此项恢复既定按压反馈，不改变复制/再生成/删除/轨迹命令。

## 覆盖与行为

六个before/after场景：产品Light/Dark各正常752px叶与窄375.5px叶，HC Dark/HC Light各窄叶。相同两用户/两助手、代码块、正文session引用与Composer长名引用，真实Add context菜单选本地session加入draft，未发送。窗口1440/1024×1000，DPR1/visualScale1；显式控制临时窗口Part752保证对照宽度，非产品布局修改。

- 长引用删除是主反例：before的初始几何/整窗截图保留越界。Playwright hover/focus会滚动祖先把16px按钮救回，因此before hover截图可能已横移；不能用它否定初始越界。after不需要这次横移，按钮和焦点都在chip内。
- 删除仅点击一次：引用计数到0，主会话仍untitled，visible仍untitled/visualize，没有触发链接导航。仅本地draft操作，无引擎调用。
- active测试仅按住、取样、移出再释放，没有执行动作命令。disabled用局部DOM aria-disabled与CDP强制active作样式反例：背景透明、pointer-events:none、opacity0.4，状态恢复；不冒充真实能力/断链验证。
- Code Copy为22×22、16px字形，focus-visible内描-1px，未被容器overflow:hidden裁掉；语言头8px/代码正文16px属于chrome/内容层次，实拍没有需改反例。消息卡的82%边界/内衬、复制按钮、旧/新动作22px与显隐不动。正文引用胶囊不改。

## 来源、检查与审查

空seed、独立user-data/extensions/shared-data与 `UNIVERSE_AGENT_HOME` 空目录；自建虚拟显示，默认编辑器无引擎。改前保存此CSS完整baseline，精确独立diff在结果JSON，保留工作区其他WIP。持编译锁仅复制此CSS到out，然后重载自己的窗口，移除所有临时style；source/out/实际加载恢复字节一致（CDP文本按浏览器Windows-1252反解）。没有全仓编译或共享JS刷新。

预审首轮C0/I0，长chip补审发现border-box会把26px压成22px的Important，作者临时验证后撤回border-box，仅保留收缩/省略，最终C0/I0/M0才实施。已有扫描改前与改后同39 passing / 2 failing：Maximize History/Snapshots关闭扫描与Provider圆角扫描旧断言；未改这些主题、不称全绿。stylelint前后exit0、同15变量提示和179token建议，无新增。未新增镜像CSS测试，没有扩修既有失败。

原始截图与完整日志只留本地 `/home/clarence/Projects/Agents/vscode/.build/ui-nearby-detail-20261027/`：

- `before-light-narrow.png` / `after-light-narrow.png`：初始长引用越界与修复。
- `before-light-narrow-reference-hover.png` / `after-light-narrow-reference-hover.png`：删除交互。
- `after-hc-light-narrow-reference-focus.png`：2px内描焦点，HC Dark也有同名文件。
- `before-light-normal-action-pressed.png` / `after-light-normal-action-pressed.png`：按压颜色。

作者与父agent已实际查看关键前后图。完整真实引擎/模型能力、未知引用URI、多引用极端数量、触控不在本轮验收；断连本地fixture不伪造实时spinner。本次真实删除实测覆盖本地引用行为，未另跑关联业务套件。实施后独立只读复核 Critical 0 / Important 0 / Minor 0；reviewer看窄引用前后、HC焦点和pressed截图。docs-health 0 errors / 37既有warnings、主题diff-check通过；自有Electron1045097/Xvfb1045038已核身份清理，剩余自有Electron0、Xvfb无活命令，旧PID1444798仍在，既有引擎未动，记录见结果JSON cleanup。只暂存主题证据，产品其他WIP保留，不提交。
