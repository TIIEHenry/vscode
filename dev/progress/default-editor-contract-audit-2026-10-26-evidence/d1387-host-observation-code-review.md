---
title: "D1387 宿主观测与重叠保护源码独立审查"
type: reference
status: accepted
phase: M7
updated: 2026-10-26
summary: "独立静态peer核对1ac1fdc的8路径/3TS：已审宿主与Sources重叠边界落地，29项新回归源码有意义，C0/I0/M1；lane发现8处hasListeners漏调用待原作者修补，不签运行、编译或after"
---

# D1387 宿主观测与重叠保护源码独立审查

审查者 `/root/sources_audit`，非 J 作者。受审不可变提交 `1ac1fdc4ae2db39f4e2c3a49e014bcc629b40419`，父提交为独立 accepted 方案 `bf50c66b8b970a4e29a1e92f0d3968232e2d6987`。完整读取本次8路径 diff、生产 helper 全部改动与新增/调整测试，核对已审[两轮规则16边界](d1387-host-observation-plan-review.md)、官方 handler、EditorService/组事件/组模型规范成员及 move-ref 链。此前原26文件实现及 API/custom 比较身份补修分别见[原实现peer](d1387-implementation-peer-review.md)与[比较身份peer](d1387-comparison-gate-code-review.md)，本报告不改写其历史。

没有改 J、主工位、merge、产品源码或 out；没有编译、typecheck、transpile、业务测试或窗口运行。D 仅记录本静态审查，不借作者 lint/语法或父先前357过作为本次运行结论。

| 文件 | 受审 SHA-256 |
|---|---|
| `sourcesChangeEntryOpen.ts` | `45cf6d831abda7efd46ae2121b520c5f142282caa079f0e913da8312bf73741a` |
| `sourcesChangesList.test.ts` | `45cf248ffa6588cefeb10bc1c36e371e5bf7d256549481ac56f42a3fcc7b2be9` |
| `sourcesDiffRefHelpers.test.ts` | `f07dc9fe157ce53387f58fd08f0a5ae2ccef1fcc480aae9ca59f60716fb479ce` |

## Strengths

- helper:162 同步捕获一次 command/id/args；后续 matcher、key、dispatch 共用捕获，没有 await 后重读 command。API file key 与 diff key 类型分离，使用结构化序列及 URI 全串，original/modified 有序，query/fragment 保留；custom 成对元数据同步捕获，未知目标仍是 wildcard，没有扩大单侧 URI 的可信边界。
- helper:166 在 listener 和 custom 预 pin/dispatch 之前登记同一 IEditorService 的 WeakMap 活动记录。`:258–270` 仅将同 key 或任一 wildcard 双方置 ambiguous，无串行、阻断或额外 dispatch；状态没有回写 false，先退出一方只删除自己，尚活动记录继续使第三同 key/wildcard 调用歧义，符合 sticky 与三调用合同。
- helper:181–188 让 scope 覆盖单次 dispatch await 与紧接同步宿主判定，finally 清理登记/listener 后才开始 metadata/pin/await-close。reject 透传；ambiguous 不调用宿主查找、不做任何后置 metadata/new pin/replace close。API 没有预 pin，custom newTab 的预 pin 窄例外与重叠/no-op/reject成本仍保留，不回滚或借此承诺零 pin。
- helper:333–371 不再按 active/requested/visible 顺序抢身份。事件只给候选：核原 group 对象仍由 getGroup 解析、成员未 dispose、完整比较匹配，实际成员判定明确为 `input === candidate.input || input.matches(candidate.input)`；同 group/成员去重，唯一有效候选优先。存在相关 will 但未落实/多候选不会回退旧 active；只有无相关观测才扫描全部 parts/groups 的全部 tabs。无组服务直接不认领，不从裸 active 猜宿主，不再解析 column 造组。
- API 后置不重新 pin 以覆盖 provider options；custom 仅 pin 核对成员；replace 仅在真实宿主仍是原动作组且旧成员仍在、与新 input 不 matches 时关旧。API/custom resolve<void> 仍 true，拒绝不兜底，直接 Preview pane/undefined、Conversation/Panel/stale 完成门未被本次改写。
- 新29项回归从公共 `openSourcesChangeEntry` 进入，没有调用新私有 capture/register/find 函数，也没有访问/镜像生产 WeakMap。4项 file/diff × newTab/replace 使用真实 EditorParts、CategorizedMainEditorPart、EditorService、TextEditorService 与官方 CommandsRegistry handler，provider 明确列 B + inactive/activation:PRESERVE/pinned:false；A 旧同 tuple input 保持 active/未 pin，B inactive tab 不在 visible panes 仍得准确 identity，二次 diff reveal 实际请求与组内规范成员不同但身份写在规范成员，公开 ref 读取保留新 SCM group/resource。
- 其余25项用公开依赖、Emitter 和 DeferredPromise 控制边界：两种 settle 次序、原组 replace 不误关、三调用 sticky、4种 custom wildcard 启动组合、5种完整 key/服务隔离、reject 清理后顺序恢复、8种成员/组/候选/fallback 正负控、custom 仅核对成员后 pin、无组禁裸 active、command/args 变化只读一次。断言投影只读 groupId/严格资源引用/trace，不再展开抛 getter 的 SCM 图。四项真实宿主与25项受控模型测试各有证明范围，不能当作真实 Git 两侧 after。
- DiffRefHelpers 的旧合法 custom 夹具新增真实组成员，保留同 modified 位于 staged/workingTree 两 SCM 组时的准确 resource/group，以及后续公共 move 到 Conversation/Panel；相邻无身份且多 SCM 组的负控继续不猜。没有修改生产 move 或放宽既有失败关闭策略。
- 此次唯一生产路径为 helper，且变更限 SCM 委托观测/匹配；原根因的官方 DTO 单次分派、真实调用方命令依赖、finder/fence、Review/Changes 错误代次与恢复等文件未变。helper 的 direct Preview false、Conversation 精确目标与 Panel 分派保持。原26文件、R1/R2及完整相关套仍须唯一车道回归，不能只跑新29项便覆盖原根因。

## Critical

0。未发现推翻本次已审实现方向的缺陷。

## Important

0。前两轮方案所列实际 B 宿主遮蔽与 Sources 重叠归因 Important，在本不可变源码中已按已审边界静态落实；此结论不表示旧生产业务 red、新生产 green、语义检查或全量编译已经通过。

## Minor

**M1：测试监听清理断言须调用方法。** 唯一车道在本报告定稿前回报 `sourcesChangesList.test.ts` 的 `listening: harness.events.hasListeners` 实际得到函数对象，而断言预期 false。D 随后只读确认 `base/common/event.ts:1432` 定义为 `hasListeners(): boolean`；测试:554/597/618/661/667/707/721/733 共8处都应由原作者改为 `hasListeners()`，不能只修两个 settle 用例。这是局部测试夹具错误，不改变上面的生产 C0/I0，但新 green 不能在原1ac上签收。

父/唯一车道另报旧65d配新测试的4项 official host 已在 identity 业务断言纯红；两 settle 用例也真实出现 g1/g2 identity 抢写，同时含上述函数对象差异。D 没有运行这些命令或复看整份日志；原两项失败不能全计为纯业务 red，须作者修补后由唯一车道重验受影响项，日志出处为 `/tmp/vscode-d1387-host-overlap-old65d-red-overlap.log`。D 不改 J 源码或抢产物车道。

非 Sources 外部同 tuple 操作没有 operationId、跨服务/窗口不保证因果归属等限制已在方案/SSOT明确保留；不重新把已接受的有界取舍列成缺陷。

## Assessment

**C0 / I0 / M1，核心可进入唯一车道 formalqueued；测试夹具修补后再计受影响的 red/green。** 车道按作者精确 selector 将旧 `65d2288036fdad74ab607e231d3db758fa397aa8` 生产配修正后的新测试，证明 `delegated host official` 以及 `Sources overlap same tuple .*settles first` 在实际身份业务断言 red；加载、类型、扫描失败、夹具差异或超时不计。然后刷新本次生产，新29项 green 后保留原 R1/R2、根因与完整相关套/语义及必要全量编译义务。

本报告不是运行 green、最终产物来源或默认编辑器真实 Git after。唯一产物车道尚未发最终 freeze；审查者不会用现有混合 out 提前启动窗口。最终 source/out 冻结、加载模块身份与非作者 Preview/Conversation/Panel、全部入口/move/Review 错误恢复等 after 仍待。D1387 保持 open，PRD 不升。

## 本报告门禁

实际 `git diff --check 1ac1fdc^ 1ac1fdc` 通过。新增 TS diff 未发现新增 any/unknown/never 宽 cast、skip/only、TS 诊断抑制或 ESLint disable；既有 test cast 不因本报告改写。D 文档健康新增报告前后均 exit 0、0 errors / 46 warnings，warning 集合不变；两份改动报告 frontmatter/本地链接新增问题为0，暂存 diff-check 通过。仅本报告与前轮方案报告的后续入口随本主题提交，不改父维护的 status/INDEX 账。
