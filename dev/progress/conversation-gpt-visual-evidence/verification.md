---
title: "默认编辑器 GPT 参考图视觉验证"
type: progress
status: in_progress
phase: N/A
updated: 2026-11-02
summary: "最终列表30px；UA功能保持；编译通过、272组件通过5pending，CSS41通过2处Engine旧尺寸断言不匹配；隔离默认窗取样，不是真引擎验收。"
---

# 默认编辑器 GPT 参考图视觉验证

状态：执行中。实现未提交，整体视觉方案与PRD仍accepted，不宣称真实引擎验收。

- 用户在同屏参考图后明确指「列表行太高」。最终Sessions/Projects30px、项目组42px含12px留白、行尾28px。此前40px/32px是中间稿。
- 活动栏44px标准步距、20px图标、36px中性圆角选中底；默认非Modern UI也生效，显式compact保留。Conversation标题36px、操作28px、宿主32px。
- 阅读面、身份条、置顶回合、Composer共用800px外框；Trajectory原720px布局保留。Composer按用户新图校准：24px圆角、14px/24px文字、28px控件/40px底栏，空会话输入64px、活动空稿48px。实际中间32px列表版在1440×900测得空会话卡110px、底栏36px；原过大版本在452px叶宽测得158px，二者仅作过程事实。
- UA上下文、Tools、Permission、Agent条件、Model、放大输入、独立Inbox Stop/Goal/队列保持；不新增麦克风/钉住/插件。输入为单一实例，行内编辑生命周期不变。只读Agent长原因单行省略，原title/aria全文保留。

## 本地检查

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| `npm run compile-client` | 0 errors | [compile.log](compile.log) |
| `scripts/test.sh --runGlob '**/{activitybarPart,conversationLens,conversationLensComposerChrome,navigatorProjectsList,conversationSessionsView}.test.js'` | 272 passing / 5 pending | [browser-tests.log](browser-tests.log) |
| Node两份样式扫描 | 41 passing / 2 failing；两项均为Engine导航旧22px断言与当前设置32px样式不匹配，未独立重跑HEAD归因为baseline，记D17 | [css-tests.log](css-tests.log) |
| 定向ESLint | 导航0 errors / 3 warnings；本次Composer测试文件0 errors / 2 warnings | [eslint.log](eslint.log) |
| docs-health / wiki check | 最终两项均0 errors（有存量警告） | 本轮工具输出 |

293px组件夹具验证长模型名与原More/发送入口在卡内、内簇无横向溢出；原narrow设计将权限放More，未伪造不可见的inline Permit图标。Busy发送样例测试改用独立空会话检查idle条件，保留原忙碌禁发测试和门控。

只读方案审查§22 C0/I3、§23 C0/I1均采纳；§24最终列表细化复核C0/I0/M0。实现复核发现标题操作宿主22px裁28px按钮，已改32px/overflow visible。Engine Tools并发WIP曾缺Toggle必需foreground，仅补一项颜色参数后组合编译通过。

## 默认窗口视觉取样

通过仓库`launch`技能在`/sdd/tmp`临时profile启动默认编辑器窗口，未启动真引擎；默认主题来自独立seed，仅复制settings，没有日常登录写回。最初/tmp复制因空间不足失败，已清理该次临时副本。所有临时窗口仅用于自动取样。

- [before.png](before.png)：原1200×800、有Stub回合及确认座位的基线。
- [active-after.png](active-after.png)：扩大中间稿的active视图，不是最终列表尺寸。
- [dark-wide.png](dark-wide.png)、[dark-narrow.png](dark-narrow.png)：32px列表中间稿深色主题取样；窄窗口1024×768，Conversation叶宽452px，未冒称293px真窗。
- [final-light.png](final-light.png)：最终30px列表，1440×900；为观察居中内容列，通过现有开关临时隐藏Preview/Sources，未改产品默认配置。
- [final-list.png](final-list.png)：同一最终窗口的侧栏顶部实拍。

真实引擎连接、权限写入、模型切换和完整产品黄金路径未验。源树含其它WIP，精确文件哈希见[source-manifest.json](source-manifest.json)；测试与取样不等于已提交、安装或发布。

最终窗口实测：Sessions行30px、更多按钮28px，见[window-measurements.log](window-measurements.log)。窗口控制台有4条TerminalProfileResolverService读取undefined.catch错误及2条title/hover警告，未归因给本次视觉改动，也未宣称控制台无错；见[window-console.log](window-console.log)。键盘输入区Tab取样见[keyboard.log](keyboard.log)。

## 最终截图校准与独立审查

§25导航与§26输入框已实施，未提交。Sessions/Projects行30px、文字14px，菜单28px；日期组42px。实际240px侧栏见[测量](refinement/measurements.log)与[窄侧栏](refinement/light-sidebar-narrow.png)，Local folders路径不占行内但title/ARIA保留。

输入卡[用户参考](composer/reference.png)、[活动空稿](composer/light-card.png)、[首屏](composer/light-prefirst.png)、[浅色窄窗口](composer/light-compact.png)、[深色](composer/dark-prefirst.png)。实际active98px、filled106px、prefirst122px，字段48/64px、字号14px/行24px、底栏40px，所取卡片无内部横向溢出，见[测量](composer/measurements.log)。窄真窗卡宽最低420px；293px由组件测试覆盖，不混称实际窗口证据。

§26实施前只读方案审查C0/I0/M2均采纳。完成后Terra对比C0/I0/M0，上次路径Minor关闭，见[完整审查](refinement/terra-review.md)。272 passing/5 pending；两份CSS41 passing/2 failing仍为D17已登记Engine旧尺寸断言，不宣称全绿。编译通过；Composer测试文件lint0错2警告。仍无真实引擎发送/模型/权限写入及完整键盘路径验收。

## 圆角图标与内衬细化（§27）

用户[侧栏局部](icons/reference-sidebar.png)与[输入卡局部](icons/reference-composer.png)为栅格参考。以相同文字尺度重绘圆头线条、三点、文件夹、权限盾牌、加号、工具和发送箭头，模型chevron用12px画布；共享局部SVG mask，颜色继承原状态。保留30px行/12px行圆角、28px按钮、输入左12px/底栏左右8px与8px组间距，未全局替换字体图标。HC及forced-colors保留原Codicon；没有原SVG，不能声称取得原始资产或像素一致。

本轮三组组件238 passing/5 pending、compile-client通过、lint0错2警告、两份CSS扫描41过2个D17旧Engine断言。实拍见[输入卡](icons/light-card.png)、[More菜单](icons/light-menu.png)、[深色窄窗](icons/dark-narrow.png)、[强制颜色](icons/forced-colors.png)。Ask状态权限警告隐藏，当前无真引擎工作目录group；不冒称这些图标全状态真窗验收。Terra只读C0/I0/M0，确认轮廓/留白接近参考、深色窄栏无明显错位，原资产1:1与真实引擎交互未证明。

发送glyph宿主修正后重新编译刷新：当前禁用按钮28px、图形16px、normal mask SVG；forced mask none且原Codicon内容存在、focus-visible可见。Terra补看两种模式确认；见[发送测量](icons/send-measurements.log)。docs-health/wiki check及diff检查通过（有存量文档警告）。

## 菜单视觉（§28）

[参考](menus/reference.png)来自用户栅格图；只取视觉，UA动作范围保持。Sessions/Projects通过原生delegate类白名单接入局部样式，Composer Add/More/Tools同壳层。壳16px圆角/4px内衬，行12px圆角/最小30px，文字14px，图标16px/文字间距8px、快捷键12px右齐；长禁用原因允许自动增高。直接动作位图标不侵占checked槽、不作用未来子菜单动作，强制颜色回退Codicon。没有新造置顶、归档、移动项目与假快捷键。

实拍[浅色菜单](menus/light-menu.png)、[上下文选择](menus/light-add.png)、[深色窄窗最终](menus/dark-final.png)、[强制颜色](menus/forced-colors.png)。收掉原生内层边框后，最终菜单186×40、行30px、边缘到行5px=外边1+内衬4；原生ArrowDown焦点1px，Escape回列表焦点true，见[测量](menus/final-measurements.log)。最后仅CSS边框去重，原样同步到out并在刷新窗口中核验；主体compile-client通过，未再为CSS跑全量类型检查。

三个组件238 passing/5 pending，定向lint0 errors/2 warnings；CSS扫描41过/2个D17 Engine旧尺寸断言，未称全绿。Terra只读对照C0/I0/M0，认可圆角/边框/阴影/间距接近参考；UA菜单动作数量不同属于功能范围。无真引擎Projects多项菜单、子菜单与长禁用理由实拍，不能称这些已视觉验收。
