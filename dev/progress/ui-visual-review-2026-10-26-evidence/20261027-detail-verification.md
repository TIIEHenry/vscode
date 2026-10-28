---
title: "Conversation细节实现：底栏中线与过程摘要行"
type: reference
status: completed
phase: M7
updated: 2026-10-27
summary: "两个生产CSS细节已落地：消除Composer宿主基线尾隙，过程摘要默认24px/compact22px；浅深正常/窄实拍与PreFirst/行内编辑通过，扫描保持39通过2既有失败。"
---

# 实际改动与结果

[方案§14](../../plans/chatgpt-visual-language.md#14-默认编辑器细节实现底栏中线与过程摘要行2026-10-27) · [测量/来源/测试/本轮独立diff](20261027-detail-results.json) · [复现探针](20261027-detail-probe.cjs)。产品范围只有默认编辑器Conversation，不改Agents Window。

生产 `conversationLens.css` 在已有WIP之上只改两处：过程header/thinking-header line-height 1.45→1.5（12px字计算18px）；Composer add/tune/send三个纯图标宿主display:flex/align-items:center。没有加!important、改字号/图标/按钮尺寸/leading上下padding4和margin-4/伪元素扩展命中，也没有改More显隐、权限/模型/只读语义或C1/C2原型。

| 实测 | before | after |
| --- | --- | --- |
| 图标按钮与select的中心最大差，浅深正常/窄 | 0.59375px | 0px |
| add/tune/send宿主高（按钮自身始终24px） | 25.203125px | 24px |
| 默认底栏，正常/窄 | 33.203125 / 29.203125px | 32 / 28px |
| 过程摘要单行，默认密度 | 23.390625px | 24px |
| compact摘要（仅局部class检查） | 本轮无新before | 22px（上下padding2px既有规则保留） |

after实际点击盒/中心测量使用按钮盒，未把宿主中心当按钮中心。顶部tab/标题/图标钮中心在before均48.5px，after未改其规则；root codicon字号本来16px，后代13px规则不匹配，不谎称本轮把图标13改16。

## 真实窗口与操作检查

- 空seed、独立user-data/extensions/shared-data与engine-home，自建虚拟显示，默认编辑器 `--new-window --enable-smoke-test-driver`，DPR1/visualScale1、无引擎连接。复用launch技能/壳冒烟入口。源/out before一致；持`/tmp/vscode-compile.lock`仅复制此CSS输出，然后只重载自己的临时窗口。CDP实际加载该输出，恢复浏览器解码后字节与source/out匹配；JS/其他CSS与用户日常profile未修改。
- 浅/深×正常752px叶/窄375.5px叶各有同宽before/after。窗口1440/1024×1000；after为控制变量显式将临时窗口Conversation Part设752px，不是产品默认布局变更。一次reload保留Comparison空叶导致初轮after未命中fixture；该轮弃用，最终探针显式reveal正确session并Exit编辑态，最终JSON/图片均为正确fixture。用户不会遇到这个探针状态校正路径。
- Add context与Tool options在按钮中心、上边外3px、下边外3px的elementFromPoint都命中自身，扩展命中未丢；Send disabled未触发。窄叶隐藏add/tune、More显示；Enter打开More、Esc后焦点返回More；正常More仍display:none。
- 摘要Enter展开，focus-visible为1px focusBorder。展开后主header/thinking-header行高18px、默认盒24px；waiting摘要仍在。未改变失败/取消的呈现逻辑。
- PreFirst含只读Agent槽：六项可见控件中心都575px，宿主/按钮/select仍24px；只读Agent伪箭头仍none。点用户卡进入现有turnEdit，同一Composer挂到行内（editMounted=1），send宿主24px且命中尺寸保持；没有修改返回/提交行为，也没有真正提交。

## 验证与限制

规则16实施前只读review：Critical0/Important0/Minor2，已对齐line-height1.5、默认24/compact22并补PreFirst/turnEdit。现有编译产物下`node test/unit/node/index.js --run src/vs/workbench/contrib/conversation/test/node/conversationLensCssScan.test.ts`改前与改后均39 passing / 2 failing。两项是`Maximize and session switch close History/Snapshots; More stays session actions`与`connection and provider chrome stay on small radii`，本轮未改的现状也失败，未扩修/未称套件全绿。探针几何和运行交互是本改动主要证据，没有新增镜像CSS的测试。

定向stylelint改前/后都exit0，仍有15条既有变量提示和179条token建议，未新增。未编译全仓、未跑全套业务测试；HC只保留原焦点/边界规则，本轮没有新增完整HC实拍；真实引擎、输入法、提交与长状态本地化不在本次CSS改动的运行验收范围。

图片留本地 `/home/clarence/Projects/Agents/vscode/.build/ui-detail-20261027/`：

- `before-light-normal-composer.png` / `after-light-normal-composer.png`（底栏细节，肉眼差异很小，数值用于佐证）。
- `before-light-normal-summary.png` / `after-light-normal-summary.png`（摘要单行整数节奏）。
- `before-dark-narrow.png` / `after-dark-narrow.png`（完整窄叶）；`after-dark-prefirst.png` / `after-dark-turnedit.png`（共用Composer状态）。

本轮是可逆的细节实施，未宣称解决大布局或完成PRD-028；源码其他WIP全部保留，不提交。收尾实施独立只读复核 Critical 0 / Important 0 / Minor 0；docs-health 0 errors / 37既有warnings，主题diff-check通过、status179行。自有Electron91643/Xvfb91115已关闭，无剩余自有Electron，旧PID1444798仍存活，既有引擎未动；结果JSON的cleanup保留身份核对记录。
