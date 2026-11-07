---
title: "SGLang 默认编辑器联测的运行隔离"
type: plan
status: implemented
phase: N/A
updated: 2026-11-05
summary: "为已有真实编辑器剧本提供独立日志与证据根目录，再以 SGLang Local 执行一次生产路径采样。"
---

# SGLang 默认编辑器联测的运行隔离

状态：已完成。负责：agent:codex。代码与本方案限定实测完成；持续 goal 和其他验收边界另记。

覆盖需求：无（联测运行隔离与证据采样，不改变产品需求）。

## 问题与范围

已有 [真实编辑器剧本](../../../dev/plans/universe-agent-real-editor-e2e-2026-10-31.md) 的历史 4/4 使用本地 SSE fixture，不能代替 SGLang。现有 wrapper 可以使用调用者指定的生产引擎与模型目录，但 `application.ts` 会删除仓库公共 `.build/vscode-playwright-mcp/logs`；唯一 TMPDIR 只能隔离 `vscsmoke`，不能保护这些历史日志。`application.ts` 与 `evidence.ts` 又分别定义了 artifact 根，独立覆盖一处会造成日志和报告失配。

另一处小缺陷已单独修复：wrapper 末尾 `exec node` 替换 shell，导致 EXIT trap 不执行；去掉 exec 后由 shell 等待 runner 并回收自有 engine PID。三个真实子进程回归覆盖旧行为泄漏、新成功清理和失败清理/退出码保留。

本方案只调整测试工具的路径配置，不改变产品 UI、模型权限、scenario 的四步断言、PIN、预包或日常用户数据。

## 实施

1. 新增 `test/scenario/src/artifactPaths.ts`，统一导出 artifact 根及 logs/crashes/videos/evidence 路径。未配置时保留当前仓库默认目录。可选 `VSCODE_SCENARIO_ARTIFACT_ROOT` 必须为非空绝对路径，显式空值或相对路径报错，避免误落回公共目录。校验必须发生在 application 的任何 rmSync 之前。
2. `application.ts` 的 logger/crashes/video 和 `evidence.ts` 的报告/日志收集都使用该共享来源；不引入产品代码依赖，不在启动后切换根目录。
3. 以真正导入编译后 resolver 的针对性测试验证默认路径、覆盖路径及无效输入；不以源码字符串扫描代替行为断言。后续真实运行核查生成的日志/报告都在本轮目录，并对公共日志目录做前后内容哈希比较。
4. 独占本仓构建通道，用 `.nvmrc` 的 Node 24.18 正式编译 automation/scenario。无需再次全量 client compile；若产品源码随后变化，相关输出新鲜度另核。

## 补充：Electron shared-data 隔离

实施准备发现官方 runner 仅设置 user-data/extensions，未设置 shared-data。环境中的 VSCODE_PORTABLE 虽可隔离 shared-data，却优先于 CLI user-data，导致 application 对原目录的预置 settings 不被读取，因此不采用。

最小补充为 `application.ts` 在原 `testDataPath` 下派生独立 shared-data 目录，通过现有 `extraArgs` 数组向 Electron 传入单独的 `--shared-data-dir=<绝对路径>` 参数；无需修改 wrapper 的参数接口或字符串拆分逻辑，目录含空格也作为单一参数传递。保留原 user-data preseed 路径。该默认参数放在调用者显式 extraArgs 之前，保留既有显式覆盖能力；本波不提供此类覆盖。

采样进程环境明确不继承 VSCODE_PORTABLE/VSCODE_APPDATA。运行时核实际 Electron 参数与 shared-data 落位，并保护日常 shared-data 的内容哈希。该补充仍限原 application 路径与官方 runner 的隔离语义；原 reviewer agent:sol_navigator_test_diagnosis 已只读复核 C0/I0，可实施；父 agent 采纳 Minor：补含空格单一实参与显式覆盖顺序的行为证据。

## 一次真实运行

- 先核 50161 空闲及预包 VERSION/121 项库哈希；仍使用 clean `027ab7ed03` 生产预包，不改钉。
- 用全新仅属主可访问的运行根，分别放 TMPDIR、engine home、JVM user.home、workspace、artifacts。临时 profile 由官方 runner 创建，不复制测试或日常登录目录。
- 直接使用本仓真实编辑器 wrapper，不调用会覆盖 PIN home 的仓外 start/seed。它固定 OpenAI Chat 协议；只配置 SGLang `http://192.168.10.68:8192/v1` 与模型 `Local`、非秘密占位 key，清除其他 Provider 凭据。配置和模型目录从最小合成数据创建，默认项与 catalog 的 Local id 一致。
- 唯一 TMPDIR 保护其他 `vscsmoke`；共享 artifact 覆盖保护历史 logs。JVM 的 user.home 与日志目标在启动前核验。证据记录实际 engine/Node/source 身份、配置目标、退出码及 owned PID；不把配置声明当 HTTP wire 抓包。
- 运行原有默认 editor 四步：Loopback、Composer 提交、真实工具/完成助手行、reload 身份恢复。保持恰一个工具行等原断言；真实模型额外调用或其他不匹配如实记失败，不为通过临时弱化断言。
- 退出时仅终止并等待本轮创建的 engine/runner 子进程，保留合成 workspace 和证据，不触碰外部 37567 窗口及原 agent-home。所有脚本与测试失败均保留；每次真实请求只采样一次，失败后先诊断再决定后续。

## 验收与边界

- 路径测试、wrapper 生命周期回归、scenario 编译均通过。
- 真实运行产生可读报告/截图，所有步骤与实际模型调用结果分项记录，公共日志内容不变，自有引擎退出。
- 本方案的隔离实现可单独完成；SGLang 四步未全部通过时，接入验收保持未完成。即便自动剧本全过，也不代表人工 CUA、多主题视觉、F21 两模型或生产自主路由已验收。

## 审查

2026-11-05，独立 reviewer agent:sol_navigator_test_diagnosis 完成只读审查：Critical 0、Important 0；认可共享路径来源、默认兼容、行为测试及真实产物双层核验。Minor 建议已采纳：明确未设置/空值/相对/绝对输入，并确保校验先于任何删除。父 agent 核对当前 application/evidence 源码后接受，可实施隔离改动。真实运行仍须通过编译、隔离准备与前置身份核验；未执行即不计通过。

## 实施与首轮结果

隔离实现已落：共享 artifactPaths、单一 shared-data 参数 helper、wrapper 非 exec 收尾；Node 24 正式 scenario/automation 编译与 9 项行为回归通过。原四步真实运行得到 2 pass / 第三步 fail / 第四步未运行；错误为 MODEL_PROFILE_REQUIRED，尚未证明发出 SGLang 请求，完整接入验收不升完成。详见[当前证据](../../../dev/progress/sglang-provider-validation-2026-11-05.md#默认编辑器的首次真实模型配置采样)。

公共 artifact 与旧 engine home 哈希不变，自有进程退出。日常 shared-data 未采集 before 哈希，实际参数/落位已隔离；后续采样补齐该前置记录，不能倒填。182 文件 manifest 只覆盖 runner/automation 及 engine 身份文件，client 运行模块来源仍需独立核验。本方案保持执行中。

## 补充：原窗口实时事件取证

身份修复后的第二次运行已成功选择 Local、读取 marker；最终回复在 DB seq12 已持久化但原 UI 未显示。相同记录经过当前完整 actor 与投影离线重放可见，缺的是当时真实 batch/L3/branch 交错。此补充只增加临时运行观察，不改产品 source/out、原四步函数、断言、超时或模型提示；规则16复审通过后执行。

1. 沿用唯一运行根、保护基线、源码/产物清单、生产 PIN 与 SGLang 配置。在本次自有 Electron main 经 runner 已有 extraArgs 明确传 `--inspect-brk=127.0.0.1:0`。临时 scenario 入口引用原 exports 和原四步函数，不复制改写步骤；只增加调试参数及单独的 observer-ready 前置步骤，记录原文件与包装 SHA。该前置步骤不计入产品四步验收。
2. 第一次 resume 前确认 inspector URL 对应本次 own main PID、app 和 profile，按当前 out URL/hash 注册 A/B/C；尚未 parse 的脚本允许 pending breakpoint。Node24 的执行身份需在 runIfWaiting 后实际 Break-on-start 时读取，再首次 Debugger.resume。resume 后监听 scriptParsed/breakpointResolved，核真实脚本 hash，并实际观察同 session/attempt 的初始 hello 经 A/B/C 成功命中，才写 observer-ready。原四步之前的前置步骤只等待该就绪文件并核 run/PID，限时失败立即结束，保证无模型提交；不修改原四步函数/断言/timeout。启动入口外禁止暂停，不能靠首 PASS 后 500ms 的时间缝隙猜测就绪。首个附加尝试失败先查证，不连续重启。
3. 对当前 out 精确行设 conditional logpoint：条件只读取白名单标量/自有字段并输出带标签元数据，捕获自身错误，始终 false，不改对象、不调用业务函数。记录断点 resolved 的真实 script URL/行和脚本哈希。需要至少 A：SessionViewHost 的真实 subscribeSessionEventStream 回调入口，B：postAndDrain 的 core.post 返回后 accepted，C：SessionActor streamEvent 的 stale-attempt 守卫之后。初始 debugger 恢复后有意外 pause 即记录并终止诊断，不能以长暂停换取通过。
4. 只留 session/engineSession/attempt、seq 或批次范围、event arm、message/turn id、角色、正文长度、runtime epoch、分支涉及 ID、accepted 等元数据。禁止 dump 整个 payload、正文、工具参数/结果、Authorization、私钥或用户文件内容。观察器只持久化自有标签，其他 inspector console 消息丢弃；最多 2000 条或本轮结束即停止，超限明确标诊断不完整。
5. 原窗口继续原四步，CDP DOM 观察仍只读；记录 stdout/报告的独立结果与 observer 状态。用最终冷 DB seq12 的对应 id/seq 对照 A/B/C。A 缺失只定位到 IDE 回调之前；A 有而 B/C 无定位消费边界；C 有仍不可见则继续检查后续交错/帧分发，不直接归因单方。
6. 不增加独立 SessionEventStream subscriber：PIN allocateOnSubscribe 会分配 runtimeEpoch、队列，与原 UI 不等价。另装 ConnectionService/Host 只能当旁路诊断，不能冒充原窗口证据。退出时移除断点、断开 inspector/CDP，只清理本次 owned 进程，保留未仪器化的前轮失败证据。

此为带观察点的真实运行诊断。即使通过，也与原先未观察运行分开记录；不以 debugger 输出证明服务端 publish 或 HTTP wire。缺失观测须列限制，不据无日志直接声称数据丢失。

本补充首次规则16复审 C0/I1：初稿允许启动后附加，会漏掉初始 hello/attempt；父窗口采纳，改为 inspect-brk 第一次 resume 前注册、临时 observer-ready 前置步骤同步阻止模型提交。原 Sol reviewer 复核 C0/I0，I1 已关闭，父窗口核验后准予实施。observer-ready 不是产品通过项；诊断不完整与四步结果分开记账。

## 补充：助手多行与完成状态等待

a2 的第三步在 553ms 内因 strict-mode violation 失败：工具前助手正文与流式 overlay 同时存在，等待全部 assistant locator 的 singleton 假设不成立。最终 seq12 在该步骤内已到达原窗口 A/C/B；这不解释前一轮的最终回复缺失，也不证明 reload。原完成谓词还在内层 turn 读取 aria-busy，而产品将其写在外层 article，可能提前接受流式预览。

本补充仅修 `test/scenario/scenarios/universe-agent-real-editor.cjs` 的验收等待，不改产品、模型提示或 60 秒超时：

1. live/reload 两处助手存在性等待改为选首个匹配项。此等待只要求有可见助手；最终数量、身份及正文检查仍遍历全部行。工具存在性与恰一个工具断言不放宽。
2. 完成等待从最近的 timeline article 读取 busy，要求 article 存在、rootId/turnId 存在且不是 overlay 身份；包含精确 marker 的全部助手行仍必须恰好 1，且该唯一行必须持久完成；不能只数 completed 而漏掉额外的 busy marker。读取及检查沿用同一持久完成定义，不让尚在流式输出的 marker 提前放行。reload 后同样先等持久完成 marker 再读取并核身份，沿用 60 秒超时，避免仅见工具前正文就抢先报告最终回答缺失。
3. 保留错误行拒绝、失败工具拒绝、工具数量 1、全部 root 身份唯一、reload 前后身份集合完全一致。完成等待后再次核 live/reload 的错误状态，避免等待期间晚到错误或工具改为 Failed 被早期快照漏过；早期拒绝可保留。调整第三步标题为准确描述“一条工具结果和唯一完成回答”，不暗示总共只能一条助手消息。改进等待错误措辞，明确显示真实错误而不把 strict-mode 异常冒充已等待完整超时。
4. Sol 用真实 Playwright 页面载入场景步骤做针对性行为验证：工具前正文与 overlay 共存不发生 strict 失败；带 marker 的 busy/overlay 不放行；持久完成后通过；重复 marker、额外工具或 reload 身份变化仍拒绝。保留一个完整 live/reload 正向例。仅改 CJS 无需 client 重编译；生产 src/out 清单必须保持。
5. 独立实现复核通过后，Terra 在新 a3 根使用继承已校验 v2 的 v3 观察包做一次 SGLang 原四步。v3 仅给只读 DOM 采样补 assistant rootId、turnId、busy 与合成 marker 存在布尔，间隔/target/stop 不变；不新增正文记录。记录新的 scenario SHA；保留旧场景/结果证据，明确本次用了修正后的等待与加严的完成谓词。失败先诊断，不盲重跑。

规则16独立只读审查由 agent:sol_navigator_test_diagnosis 完成，C0/I0；父窗口核对 article busy 归属及原场景断言后采纳。Minor 已明确：first 仅作存在性等待，最终正文、数量与身份仍查全部行。首次源码 peer 发现 Important 1：错误/失败工具检查发生在完成等待前，会漏等待期间晚到的失败。父窗口采纳，补完成后终态检查及延迟错误回归，原 reviewer 对最终实现及 19 个行为用例复核 C0/I0，I1 已关闭。允许 Sol 实施此窄修正及针对性行为验证；新增测试放现有 scenario 测试位置，命令与长期用法按测试文档落位，不引入新产品 API 或共享构建。Sol 最终 Node24 真实 Chromium DOM 验证 19 例通过（Python harness 1 test、exit0）；CJS 语法与 diff-check 通过，生产 src/out 未修改。此为场景行为验证，a3 真实 SGLang 结果另记。

返回 [方案索引](../../../dev/plans/INDEX.md) · [SGLang 当前证据](../../../dev/progress/sglang-provider-validation-2026-11-05.md) · [测试与校验](../../../docs/architecture/cross-cutting/testing.md)。

## 限定收口

a4 使用完整隔离与新来源清单，在带观察点的真实 SGLang Local/OpenAI Chat 路径完成原四步4/4；setup单独记账。公共与日常保护五项不变、自有进程0、50161释放、src/out无变化。本方案代码与限定实测完成；前述失败与来源限制作为历史保留，不声称无观察器、F21或人工视觉全验收。当前事实见[SGLang验证记录](../../../dev/progress/sglang-provider-validation-2026-11-05.md#a4新排序键下原四步全部通过)。
