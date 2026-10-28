---
title: "Conversation菜单细节：键盘定位与文字层级"
type: reference
status: completed
phase: M7
updated: 2026-10-27
summary: "Add context/More启用项补可见焦点，名称13px/副信息12px；六组真实浅深/HC菜单前后尺寸与24px行保持，Esc返回焦点缺口另列下一切片。"
---

# 本轮实际改动

[方案§16](../../plans/chatgpt-visual-language.md#16-自定义菜单细节键盘定位与标题副信息层级2026-10-27) · [六场景前后/来源/独立diff/测试](20261027-popup-results.json) · [复现探针](20261027-popup-probe.cjs)。只追加当前 `conversationLens.css`，保留§14/§15和所有其他WIP；没有改TS、模型注册、权限、引擎或大布局。

1. Add option/More启用item的focus-visible补1px focusBorder内描，HC Dark/Light补2px contrastActiveBorder回退focusBorder内描。规则置于原清outline规则之后，排除disabled/aria-disabled。原hover、当前Ask check、disabled原因和颜色不改。
2. 两类行名称从12px改为既有body1=13px，Add消息数meta显式label1=12px；24px行高、Add280px宽、容器/行padding、ellipsis/flex预算保持。More只读Agent note还是12px。当前规范§5.5本就要求13/12，未发现本类已接受12px例外，不是全局放大字体。

## 真实证据与保留项

| 核对 | before | after |
| --- | --- | --- |
| HC真实Tab到Add item | focus-visible=true，但outline none、透明底、border0，聚焦位置不可辨 | HC2px内描，Dark橙/Light蓝；More同样2px |
| 普通主题键盘项 | 只有原高亮底，无描边 | 1px内描，原背景保留 |
| 名称/元信息 | 同为12px | 名称13px、meta12px，element盒中线同一24px行 |
| Add整体 | 280×314.203px、所有行24px | 尺寸相同；长标题与1234567890 messages分别省略、不重叠，完整title原样保留 |
| 搜索/菜单边界 | 过滤very long有1项 | 仍1项；6个Add盒均在1440/1024×1000 viewport内，无横溢；More同样在窗内 |

六场景为产品Light/Dark的正常752px与窄375.5px叶，及HC Dark/Light窄叶。十条真实本地fixture session（含长名/大消息数）进入现有Add菜单；9+条时真实搜索输入出现。窄叶使用More→Add入口，全部使用真实按钮/菜单，不生成假模型或执行写RPC。布局Part显式752仅为控制对照条件，不改变产品默认布局。DPR1/visualScale1、空engine-home确保断连。

保留：现有24px项、标题/meta截断预算、现有容器和行内内衬、Search的focusBorder边、More Agent只读note/Ask check、容器阴影。More真实宽约209px，未见越窗，不根据无真实长Agent样本盲加max-width。Tools真实显示No tools configured，History真实显示not connected，未改它们。Model/Permission运行时不可用，未强行启用或造注册模型；More权限项保持disabled+aria-disabled。History Esc后仍回History，是既有修复，不记成本轮新增成果。

## 明确保留的下一切片：Esc返回焦点

本轮发现的独立行为缺口：进入Add filter/item后按Esc、等待250ms，菜单关闭，但activeElement为BODY；More项内Esc后同样回页面。首轮close后立即读取到旧Search sessions/Tool options不是可靠返回结果，已用settle基线与after校正，不能写成焦点返回通过。

代码位置：`conversationComposerAt.ts:92–97`文档capture Escape只close，`onHide`约174只清句柄；`conversationLensComposerChrome.ts:183–191`的registerPopupEscape及约363/415的More close/onHide也未保存并恢复owner。下一小切片建议：区分Esc dismiss与菜单动作选择，Esc时在销毁前仅恢复实际触发器（Add或经More打开时的More），保持菜单动作随后打开子弹层时由子层接管焦点，不在通用onHide无条件抢焦点；触发器已经隐藏/失效时使用现有合法回退焦点。应先方案只读review，再补真实keyboard进入filter/item→Esc与More→Add→Esc的行为回归。该逻辑不属于本轮两项CSS，不在此轮偷偷实施，也不把“有焦点描边”当成已解决返回焦点。

## 验证与限制

预实施规则16 Critical0/Important0/Minor0，确认规范与selector顺序。已有扫描前后同39 passing / 2 failing（Maximize关闭History/Snapshots与Provider圆角旧扫描断言），没有新增失败、不扩修。stylelint前后exit0、变量提示同15，token建议179→178（移除一处写死字体）；不称样式全无提示。无新增镜像CSS测试，无全量编译或业务套件扩跑。

一个隔离profile/Xvfb完成全部before/after，持编译锁仅复制此CSS到out，重载自己的窗口。源码/输出/实际加载恢复字节一致，无style覆盖，来源与精确独立diff在结果JSON。原始图留本地 `/home/clarence/Projects/Agents/vscode/.build/ui-popup-detail-20261027/`：

- `before-hc-dark-narrow-add-focus.png` / `after-hc-dark-narrow-add-focus.png`：HC不可见焦点→可见内描。
- `before-light-normal-add-focus.png` / `after-light-normal-add-focus.png`：名称与元信息层级。
- `after-hc-light-narrow-more-focus.png`：HC More定位；`after-dark-narrow-add-filtered.png`：窄叶搜索与边界。

完整真实模型/权限选择、长Agent名称、系统缩放/输入法、回到触发器行为未在本轮修复；后者已有明确反例与下一切片，其他缺少真实条件不伪造。实施后独立只读复核 Critical 0 / Important 0 / Minor 0；reviewer核四张指定图与独立diff。docs-health 0 errors / 37既有warnings、主题diff-check通过，status181行。自有Electron1142215/Xvfb1142152已核身份关闭，剩余0、旧PID1444798仍活、既有引擎未动，结果JSON cleanup保留。仅暂存本主题证据，不提交，其他WIP保留。
