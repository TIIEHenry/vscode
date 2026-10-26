---
title: "D1385 范围纠正与 D1387 方案纯文档集成"
type: progress
status: accepted
phase: M7
updated: 2026-10-26
summary: "两不可变docs提交真实三路合入；D1385前提失效停止原UI验收且open，D1386closed保留，D1387 accepted/open进入当前产品队列；源码/out无变化、无新运行。"
---

# 纯文档集成检查点

基线 `d4725424a23f863d72d6b8015a86eb00dea0c2bc`。仅接作者正式 refs，不读取未提交实现：

| 来源 | 作者提交 | 三路合入 |
| --- | --- | --- |
| C 默认产品语音可达性勘误，18 paths | `4ed46252e41a87b9ca4cc8c436f14fa4069cc8dd` | `d17d01c3284016cb8f134cc0e2a204c608bc9e5e` |
| J Sources 打开分派/准确目标正式方案，28 paths | `133ef4e5cfa06f9905dd83a4570c8d6b0369a317` | `6ecd5cf6f2809cadbd151dbb95c2877a74f61124` |

两[方案](../../plans/copilot-chat-cold-voice-authorization.md) / [方案](../../plans/sources-open-dispatch-and-conversation-target.md)正文逐字节等各自作者ref。PRD005/009整节等J、PRD015整节等C，未覆盖不同条款；生成格仅走源脚本。M5与D1386方案全文等基线，DID各一行。完整机器核对见[集成快照](docs-scope-sources-snapshot.json)。

## 当前事实与执行队列

- **D1385 accepted/open**：[Astra最终范围纠正](d1385-default-window-scope-decision.md)与[D实际默认入口核验](d1385-default-window-ui-boundary.md)撤回“默认Copilot Chat宿主可达”前提。openView精确null、公开service/resolver/restore门闩与Conversation真实快捷键零voice均保留为负证据；手工组件/eligibility探索excluded，不算UI after。原UI目标未满足并停止，移出当前默认产品执行队列；不创建宿主/账号/Sessions入口，不标implemented/closed、不计Conversation真语音。原共享安全机制183与独立源码复审、失败红绿、兼容及无迁移代价均保留。
- **D1386 implemented/closed**：[原非作者after](d1386-independent-after.md)、原机器观察gzip、82张本地截图清单、实际loaded三JS正文与正式CSS dee625复验均未改。fixture/无真实Git或checkout/授权与在线引擎限制沿原范围，未重开或升PRD029。
- **D1387 accepted/open**为当前产品执行队列：[真实Git before](d1387-before.md)、两个独立根因、五实际模块来源、[Astra两轮报告](d1387-astra-design-decision.md)与[规则16 C0/I0](d1387-plan-peer-review.md)完整保留；均不是修复after。源码/red-green/非作者新产物after未交付，本轮不取J私有实现WIP。

正式D1387合同区分helper明确stale不mark与旧open-status generation只闸status；不新增session pin或通用可见成功保证。move缺失Conversation leaf保源，其他false/stale仍closeHost的既有策略保留，不借此改mark/关闭政策。三owner/slot与custom void、provider优先及真实两侧验证要求按正式稿执行。

## 完整性与验证限制

所有非docs/dev根条目的Git对象与d472完全一致，包括src/test/scripts/.github/build/extensions与package配置；工作树无这些路径修改。八项既有产物（action/controller、相关测试、三Conversation生产JS及CSS）SHA/字节/mtime与集成前相等，未编译/typecheck/transpile/写out、未复跑183/44，也无新Electron/设备/网络运行。

末次fullcompile仍是source `6f82fe5b05210fd72852abc5df729a70b68b4401` 的exit1、45诊断/27文件；后修仅3TS目标noEmit0。原45/27、46/28、55/36日志逐字节未变，不推算纯docs后的新全量结果。

三进度账冲突一度被集成脚本截断尾部，独立只读QA发现I1后已按C不可变完整blob重建，再仅插J新增行；去新增行后逐字节等C，deferred1339/status166/parallel107行（元数据前），D1386/D1382与全部历史恢复。复核最终C0/I0；后续仅添加本检查点当前说明。两正式方案的规则16各自已通过，集成QA不冒充实现验收。

## 文档门禁

见[基线健康检查](docs-scope-sources-health-before.log)、[最终健康检查](docs-scope-sources-health-after.json)与[门禁汇总](docs-scope-sources-gates.json)。J原工位报告73 warnings仅属原环境，本merge实际基线46；按实际新改文档链接检查与未改警告集合比对，不将73笼统称既有。生成状态由脚本刷新和check；status不超过200行。

本merge最终实际563份Markdown，0 errors / 46 warnings，与基线完整警告(path,message及重复次数)集合相等；23份新增/改动Markdown新增断链0，其中requirements继承一条既有外仓链接警告，未将其误记为本轮新引入。generated/check/diff门禁均exit0，status167行。详见机器门禁，不引用J原环境73作为本merge基线。

## 人类工位同步回执

父调度独立复核后，已将最终检查点 `61aadabda7e1b0fd1496dc0201b60f720f91aced` 以 `merge --ff-only` 同步到人类工位 `agent-ide` 与空闲 D；两处和 merge 均 clean。C 自行对齐同一检查点。复核包括两正式方案与作者提交逐字节相等、三进度账剔除已记录的 J 新增及元数据后与 C 完整 blob 相等、八项产物 SHA/字节/mtime 未变。截断历史的中间版本未同步到人类工位。

J 仍在 `133ef4e5cfa06f9905dd83a4570c8d6b0369a317` 之上独立实现 D1387；其未提交改动完整保留，未取入本次同步。未执行 reset/stash/clean，未 push。此回执仅记录已完成的同步，不增加编译、运行或产品验收结论。
