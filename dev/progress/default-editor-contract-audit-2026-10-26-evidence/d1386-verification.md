---
title: "D1386 叶身份条集成运行证据"
type: reference
status: active
phase: M7
updated: 2026-10-26
summary: "旧5cc三生产正文身份确认后，11新增公共行为全断言红；新三生产11绿、完整IdentityStrip40过、Lens绑定8过；四TS定向0。独立默认编辑器after待到，accepted/open。"
---

# D1386 集成运行证据

源提交 `ea54727d5ddc62324627ca93b276b61a55306561` 真三路合入 `328cb823136c89f134b7d7f94653dee9f9c22bcf`，父checkpoint为 `4fb712274ee129c9a175c4e763406595bcf815d6`。仅处理文档冲突，保留父同步、D1382独立after闭合、D1384原46/28失败等记录；未在merge修改作者产品源码。方案仍[accepted](../../plans/2026-10-26-leaf-session-root-identity.md)，D1386仍open。

## 旧生产与只刷新测试

三生产源码 IdentityStrip/Lens/ReadingColumn 在5cc与4fb逐字相同。原磁盘三JS的去source map正文，分别与旧5cc源码按同一esbuild0.27.2（ESM/es2024、experimentalDecorators、useDefineForClassFields:false）转译完全相同；无需替换旧生产。整文件因source map不同不相同，未据此宣称整out同构建。原盘及新source摘要/mtime、旧转译摘要见[d1386-identity.json](d1386-identity.json)。

只fresh `conversationIdentityStrip.test.js`，三旧生产整文件摘要保持不变，见[test-refresh](d1386-test-refresh.json)。官方Electron + 隔离Xvfb、VSCODE_SKIP_PRELAUNCH=1，`scripts/test.sh --no-sandbox --disable-gpu --timeout 15000 --run src/vs/workbench/contrib/conversation/test/browser/conversationIdentityStrip.test.ts --grep D1386`：**0 passing / 11 failing**，进程exit1，全部AssertionError，无加载/超时失败，见[red原始日志](d1386-red.log)与[命令/时间](d1386-red-run.json)。

失败来自叶folder/分支/当前workspace项、旧菜单与delegate、recents、stale offer、无API绑定叶、非活动刷新及dispose。engine resolve/reject两个场景在初始folder断言即红，不把它们说成旧生产已经运行到晚到分支断言。其余具体失败位置以原栈为准。

## 仅刷新三生产后的 green

只fresh三生产JS，新测试整文件摘要不变；[刷新身份](d1386-prod-refresh.json)保存四TS source/output的hash、body与mtime。新增grep **11 passing**，见[新项green](d1386-green-new.log)。完整IdentityStrip单独运行 **40 passing**（含注册表清理检查1，既有28与新增11），见[完整green](d1386-green-full.log)。

相邻Lens只选择身份位置、两叶绑定、connection重绑、bound overlay关闭、隐藏/恢复与session切换共8项：**8 passing**，见[Lens运行](d1386-green-lens.log)与[精确grep](d1386-green-lens-run.json)。没有宣称完整Lens套件或整个Conversation都通过，也没有重复前波ReviewNav37/Tunnel19/配置21+17+15。

## 统一静态与本波编译

source6f82（已含语音及C自己的补修）下，原src/tsconfig上下文的七改动TS逐文件semantic+syntactic noEmit **0**，其中本刀四TS全部0；七TS ESLint0errors/0warnings。见[定向记录](d1385-d1386-types-final.json)、[lint](d1385-d1386-eslint.log)。第一次定向检查的三条C诊断与初轮语音测试错误保留在各自记录，不归因于本刀。

本新波仅一次compile-client，source `6f82fe5b05210fd72852abc5df729a70b68b4401`，11:02:48Z–11:03:12Z，exit1，**45诊断/27文件**，七改动TS无诊断；见[原始编译](d1385-d1386-compile-client.log)、[运行身份](d1385-d1386-compile-client-run.json)、[实际解析/对照](d1385-d1386-compile-summary.json)。这是本波真实新计数；前波source3e63的46/28原日志未覆盖，对照新增0、仅Event TS2314消失。未为全绿改sessions/tsconfig，没有第二次本波全量。

编译后D四输出正文均等于通过测试的正文，无需再fresh；整文件source map与mtime已更新。当前三生产body分别为IdentityStrip `27af36a5d723fea90c0ebff77fae27d228fcf3957f8881c1a51a34c370707e43`、Lens `9413b4211c76c9bb11f5603c0158d5c057b6ba47ec5660399f72d4e9a727830f`、ReadingColumn `424582d7af937cc1d1df6c1b961a64ca055517310015cbe20cd700c1a01fdc21`；[编译后摘要](d1385-d1386-postcompile-outputs.json)含全部source/out/hash/mtime。不把同模块正文一致扩大为整仓同构建。

## 仍待独立 after

自动DOM focus()+click()不算真实Enter/Space。C非作者独立默认编辑器after正在进行，已提前通知产物刷新、要求Debugger实际loaded JS与source范围。真实并列叶/local-engine与两local菜单/checkout URI、非活动变化、bind/隐藏恢复、stale offer、实际Tab/Enter/Space/Esc、四主题与窄叶等以最终独立报告为准；在真实报告到件核验前本方案accepted/D1386open。没有在用户仓库checkout，没有真实引擎写操作或借用户profile。本次未自行代拍/代签，未push或快进人类工位。

### 审查中反馈（本检查点未接补修）

C非作者在审查过程中反馈engine只读folder/branch的chevron虽hidden=true，computed display仍block且12×12，实际可见；tabIndex=-1/无popup/cursor default正确。反馈原证据位于 `/home/clarence/Projects/Agents/vscode-WorkTrees/C/.build/d1386-independent-after/observations-readonly-details.json`、`shots/51-readonly-chevron-details.png`，已报父与D作者。最终独立报告与作者CSS补修尚未合入本检查点；不凭自动green关闭D1386，也不把未完成反馈写成已验修复。

## 日志字节保留

测试输出自带行尾空格和空白末行。为通过全文diff-check，链接的.log展示副本仅去除这些空白；受影响文件的字节原件另存同名.raw.log.gz，解压可恢复原始字节，[摘要清单](d1385-d1386-log-format.json)记录两份SHA256。诊断正文、ANSI、失败/通过和栈均保留；旧46/28及55/36原日志未改。
