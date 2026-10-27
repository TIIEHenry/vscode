---
title: "Sources Accept 读后授权：分工与门禁"
type: progress
status: active
phase: M7
updated: 2026-10-27
summary: "b2原54与5f4 same-ref窄peer均C0/I0/M0经父采纳、44 I1关；root核f5a后授权共同预stub最小Pane test-only候选，旧helper/default/resolver/cases及生产/Panel保持，仅静态待新窄peer/唯一lane/out冻结。"
---

# Sources Accept 读后授权：分工与门禁

本看板仅跟踪[独立方案](../../plans/sources-accept-post-read-authorization.md)的推进，不重复 Sources 长期 SSOT。固定基线 `c7fefd780bd9720f3889e310d4706210189a3fc7` / `src=a2c34649ee88df907c03b70c9ec3235cb1b4a9d9`，不追 main；原 draft 为 `4b0d3d62e65e54e71d3b1748f100fac7ca5f6ce3`，经父核验与 Astra 规则16 C0/I0/M2、两Minor实改后为 accepted 方案阶段；父级独立核验 accepted `5c0916b71070c5f75742fcbd831cd8c31be0bd34` 后已明确授权实施；两生产宿主+两测试候选 ab43 已经父核与 Astra 正式源码 peer C0/I0/M1；父级采纳 A7 覆盖 Minor，本轮只补测试与必要文档，静态计数共 54。b2 四例增量已由 root 核验、原 Astra 窄 peer C0/I0/M0，原 M1 关闭；作者不运行任何业务测试。旧 run1 暴露的 Panel 生产 VM 泄漏与独立 Pane DI setup 另立[生命周期方案](../../plans/sources-panel-diff-view-model-lifetime.md)，不混入既有 Accept plan。

| 角色 | 范围 | 当前门禁 |
| --- | --- | --- |
| D / sources_audit | 仅两宿主 Accept 读后写前当前授权的方案，规则16后才实施 | b2不可变、原54/旧71调用/旧patch保留；四例窄peer C0/I0/M0已交，不写out/运行业务。父核e949后已获生命周期实施授权，44正式源码peer C0/I1/M0、生产静态符合边界；5f4 same-ref窄peer C0/I0/M0经父采纳、I1关闭，18新例未运行；root核f5a后已授权仅Pane factory预注入收为无条件一次stub，当前最小test-only候选待父核/新窄peer/唯一lane。 |
| root | scope 与合同选择、draft路径/原文保留核验、安排独立评审 | 已核draft/规则16/accepted及ab43，采纳源码peer唯一A7 Minor并授权补4；已核b2并确认Astra窄peer关闭M1；亲核旧run1边界、a04规则16 C0/I0/M0已采纳；5f4窄peer C0/I0/M0已采纳/I1关，已独立核f5a全部9docs并采纳；现明确授权共同pre-stub最小test-only候选，固定后另核/窄peer才释放唯一lane两case旧生产资格run2。 |
| Astra / architecture_audit | 当前授权取舍、规则16只读方案审查，实施后独立源码 peer | 精确draft规则16 C0/I0/M2后，ab43正式源码peer C0/I0/M1已交；唯一A7覆盖Minor经父核采纳、b2补4窄peer C0/I0/M0关闭；生产VM泄漏独立a04规则16 C0/I0/M0；44代码peer C0/I1/M0已交，same-ref修订5f4窄peer C0/I0/M0已交且父采纳/I1关；d0规则16 C0/I0/M1已采纳/Minor已改，现共同预stub源码候选仍待新窄peer，不借5f4结论外推。 |
| baseline_executor | 唯一源码 checker / emit / 官方 Electron 业务验证 lane | run1精确c7生产3+ab43测试2：A1双业务红；阳性只3 body过、Panel A2 afterEach leak/console、Panel A3未达；独立input setup未达。正式原件proof d51ce65已由baseline提交，后续green需另获释放。 |

推进顺序：draft/父核/规则16/两Minor实改/独立accepted → 父核5c并授权源码 → ab43两宿主与50新例候选 → 父核及Astra源码peer C0/I0/M1 → 父采纳A7 Minor、D补4成54 → 父核b2/Astra窄peer C0/I0/M0关闭M1 → 唯一lane旧red已得、生命周期44候选I1已修为5f4窄peer C0/I0/M0/父采纳关闭 → d0共同预stub规则16 C0/I0/M1/root采纳后f5a独立accepted → root核f5a并授权共同预stub最小test-only候选 → 父核固定候选/新窄peer后才唯一lane旧生产两case资格run2 → 后续新green与父级验收。不得把作者静态检查代替源码peer或业务门禁。

旧 J/E R3 是已局部签收的独立波，D1387 closed / 两窄方案 implemented 保持；其证据与失败不改。本 scope 不升级 PRD 或宽 Sources Diff 方案，也不重开 open/Move 修复。catalog-ready 后缺 lease 恢复、local Git 迟到结果的 notice 归属留后续独立候选；不同 engine 复用同 session 字符串的读归属仅记边界。

[作者检查点与空间/ff事实来源](../../progress/sources-accept-post-read-authorization-checkpoint.md)保留原 status 首条，B 的 ENOSPC 来自父通报、空间恢复原因不明、D 单次 ff 成功。本 scope 不碰 B 的失败 checkout，不写原 out/freeze/cache 或旧封存证据。

## 实测验证先决：Panel VM lifetime

| 独立范围 | 当前阶段与入口 |
| --- | --- |
| Panel VM lifetime | root 采纳原 Astra 生产 Important 与 DI setup 定界；[独立方案](../../plans/sources-panel-diff-view-model-lifetime.md)原 a04draft 经 root 核验与原 Astra 规则16 C0/I0/M0、root采纳后为 accepted；显式 VM / refs 唯一 owner、detach→VM→refs、body / dispose / 迟到 resolver 全路径合同保持；§3.4共同factory预stub合同已另经d0规则16/root采纳后accepted。root核e949后已另行授权：44正式源码peer C0/I1/M0、生产静态符合签收边界，root采纳新same-ref夹具I1，5f4窄peer C0/I0/M0经父采纳关闭；短期underlying resolver keepers、Panel计数/detach/provider0/最终owner断言保持。18例仍未运行；当前仅Pane factory预注入由if收为无条件一次stub的新候选待窄peer/唯一lane，两runAccept/Pane生产/Panel.test/原54/旧71/旧patch不变；Accept/Panel及共同预stub窄修订均accepted，源码实施授权分别记录。 |
| §3.4 共同factory预stub | [独立窄修订](../../plans/sources-panel-fixture-preinjection-amendment.md)经原Astra对精确d0规则16 C0/I0/M1、root全文/源链核验采纳后独立accepted；已应用原Panel§3.4首段及唯一标题Minor/锚点，其他§1–§5逐字保护。exact c7旧default-false原case仍为setup1/0/1、业务red0；root已精确核f5a并明确授权最小源码：当前仅Pane factory旧helper前预stub从if(resolveModels)收为一次无条件；旧helper/default=false/resolver/case/header/assert保持，生产/Panel.test不动；待新候选父核/原Astra窄peer后才唯一lane另取资格。 |

该 scope 复用本看板与现作者检查点，不新建长期日志。方案阶段只读精确 Git，不请求 baseline 接入含 ab43 / b2 源码的 D HEAD；当前完整 Panel 实施候选统一 peer / 绑定验证，作者不编译/业务运行；旧默认false DI资格与d0窄合同签收已分别记录，共同预stub最小源码已另获父级授权，尚待新窄peer/唯一lane。旧 run1 正式入口 `dev/progress/sources-accept-post-read-authorization-old-red-evidence/INDEX.md` 属 baseline proof `d51ce65f86605b47f31c8d99bfbd98fd9f43564d`，D 未同步/复制；原结果与恢复资格保持。


## 独立后续：Conversation可见叶 lease 恢复

[独立draft](../../plans/conversation-visible-lease-recovery.md)仅跟踪root在原Astra新鲜源码裁定后授权的§24后续范围，固定a4a/srcd78a；复用本板，不改上文Sources历史或其验证门禁。D只写docs draft与索引/行动记录，不改源码/测试/out、不请求baseline接DHEAD；root核固定commit/path hash后，仍交原Astra规则16，再独立accepted及另行源码授权。当前Sources候选如报源码/fixture问题优先响应。

仅Pane现visibility生命周期中的session reconcile；当前input/lens存活、明确bound一致、实际visible、未suspended、真实引擎live/非pairing、catalog ready且自身缺lease才沿原bind补领。回归须真实EditorParts→EditorService→Pane/Lens＋真实EngineRoster/UA emitter/Deferred listSessions/session-view frames，主red不能先hide/reveal/resetInput/manualbind；双pinned叶、KEEP与门关闭/owner撤销合同见plan。local Git迟到notice继续后置；Source两plan/原54+18/JSON及PRD/D1387/宽方案保持。


### 89d规则16后独立accepted文档

上节保留draft时点原文；当前以本节为准。root已逐8docs/hash/全文/sourceTree/status200独核89d，原Astra正式Rule16 C0/I0/M2经root采纳，两Minor已在[方案L2/§3.3及审查记录](../../plans/conversation-visible-lease-recovery.md#6-规则16原审查与独立accepted文档)澄清：KEEP测试持续live同identity且限定无新frame的引用窗口；三种非live状态采用自然missing→QueueReader真实session通知→同次UA内早于合法Lens重绑的前后采样，静态可行/实际fixture未达则资格未达。这里只签accepted文档，无源码授权，lease主red/新green/after未达，src仍d78a；root核accepted SHA后另议实施，不请求baseline接DHEAD，不借Sources54/18或run3外推。当前Sources问题优先，原三plan/JSON及PRD/D1387/宽方案保持。
