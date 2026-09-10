---
title: "引擎侧根因分析：session store 迁移半途卡死导致 Create 回 ALREADY_EXISTS"
type: report
status: open
phase: M7
updated: 2026-09-09
summary: "D25/D26 是同一个 bug。store 在 user_version=0 且表已存在的状态下走迁移分支，某条迁移抛 xerial「Query does not return results」，writeUserVersion 永不执行 ⇒ 库永久打不开；09-04 resolvedOwner fail-closed 把这个打不开翻译成 ALREADY_EXISTS。本仓不改引擎代码，本篇是交接给引擎侧的分析。"
---

# 引擎侧根因分析：session store 迁移半途卡死

> **交接对象：** UniverseAgent 引擎仓（`grpc-server` / `core` session store）。
> **本仓立场：** 只读分析，**不改引擎仓代码**。本篇不提交修法，只交付证据链、根因判定与排查入口。
> **本仓对应缺口：** [deferred-gaps](../progress/deferred-gaps.md) D25 / D26（本篇判定二者同源，见 §7）。
> **引擎侧相关既有行：** `D-SESSION-RESOLVED-OWNER-FAILCLOSED-1`（closed 2026-09-04）、`D-SESSION-META-WORKDIR-1`（closed 2026-09-06）、`D-SESSION-AUTHZ-ID-NAMESPACE-1`（open）。

## 0. 结论

引擎返回 `ALREADY_EXISTS` **不是 bug，是设计内的 fail-closed 拒绝**。真正坏掉的是它下面一层：session store 的 schema 迁移半途失败，且失败状态**不可自愈**，导致该 store 永久打不开。

因果链（每一环都有实测证据，见 §1–§3）：

1. store 落在「表已建好、但 `PRAGMA user_version = 0`」的中间态
2. `ensureSchema` 见 `current(0) < target` 且 `message_envelope` 表存在 ⇒ 走 **迁移分支**（不是 `Schema.create`）
3. 迁移分支中某条语句抛 xerial JDBC 的 `Query does not return results`
4. 异常逃出 ⇒ 该分支末尾的 `writeUserVersion(driver, target)` **永不执行** ⇒ `user_version` 停在 0
5. 下次打开重复 2–4，**永久循环**，store 再也读不出 `session_meta`
6. `getMeta` / `listSessions` 失败 ⇒ `openSessionStore` 回 `Failed` ⇒ `resolvedOwner` 回 `LookupFailed`
7. `LookupFailed` 按 ADR-319 D1.3 **fail-closed deny** ⇒ `getOrCreate` 抛 `SessionAlreadyExistsException` ⇒ 映射成无细节 `ALREADY_EXISTS`

第 7 步是 2026-09-04 引擎侧自己关闭 `D-SESSION-RESOLVED-OWNER-FAILCLOSED-1` 时**故意加的**，方向正确，不应回退。它的作用是把一个原先被静默放行（null = 无主可绑 = ALLOW，即 hijack 漏洞）的故障暴露成硬失败。

## 1. 证据链：引擎运行日志

来源 `vscode-debug-engine/logs/engine-restart-20260906T041732.log:340-352`，同一次 Create 调用窗口内（`elapsed=5ms`）串完整条链。**以下为节选**，`…` 处省略的是同类重复行（另一 session id 或同一探测的第二次）：

```
04:31:00.211 WARN PartitionedMessageStore - listSessions failed for tree session-101: Query does not return results
…
04:31:00.217 WARN PartitionedMessageStore - getMeta failed for session-101 in .../.sessions/session-101: Query does not return results
…
04:31:00.228 WARN u.agentic.grpc.SessionManager - Failed to open message store: Query does not return results
04:31:00.228 WARN u.agentic.grpc.SessionManager - Failed to load persisted owner for session-101: Query does not return results
…
04:31:00.300 WARN u.agentic.grpc.SessionManager - Failed to open message store: Query does not return results
04:31:00.300 WARN u.agentic.grpc.SessionManager - Failed to load persisted owner for session-100: Query does not return results
04:31:00.300 WARN u.a.g.interceptor.LoggingInterceptor - gRPC response: agentservice.SessionService/Create status=ALREADY_EXISTS desc=Session already exists elapsed=5ms
```

（省略行：341 `.214` listSessions(session-100)、343–345 `.220`/`.223`/`.225` getMeta 重复、348–349 `.231` open+owner(session-100)。全段无第二种错误串。）

要点：

- 末三行 `Failed to open message store` → `Failed to load persisted owner` → `Create status=ALREADY_EXISTS` 落在**同一毫秒**（`.300`）且紧邻 ⇒ 三者是同一次调用的因果，不是巧合。整段跨度 `.211`→`.300`（约 89 ms）是同一次 Create 内的多次 store 探测
- 失败发生在 **store 层**（`PartitionedMessageStore`），且 `listSessions` 与 `getMeta` **同时**失败 ⇒ 这一条根因同时解释本仓 D25（List 真空）与 D26（Create 回 6）
- 整段日志里 **没有**任何「目录已存在所以拒绝」的语义。本仓 D26 原先记的病因（「建目录后按目录存在回 6」）与日志不符

## 2. 证据链：落盘库文件实测

对 `vscode-debug-engine/universe-agent/grpc-server/.sessions/session-100/messages.db` 实测（2026-09-09，`sqlite3` 只读查询）：

| 探测 | 结果 | 含义 |
|:-----|:-----|:-----|
| `.tables` | `idempotent_operation` · `message_envelope` · `session_meta` | 表**已建**，所以 `ensureSchema` 不会走 `Schema.create` |
| `PRAGMA user_version` | **0** | 迁移**从未成功收尾**（成功应写入 `SCHEMA_VERSION`） |
| `SELECT count(*) FROM session_meta` | **0** | 与本仓 D26 观察到的「`session_meta` 空」一致 |
| `PRAGMA table_info(session_meta)` | 末列为 `pairing_tool_result_ids_json`，**无 `work_dir`** | 库停在 `work_dir` 之前的旧 schema |

目录 mtime 显示 `.sessions/session-100/` 与 `messages.db` 建于 09-06 04:14，而失败日志在 04:31 —— 库文件是这轮自己建的，不是历史遗留脏数据。

**「表已存在 + `user_version=0` + 无 `work_dir`」这三件事同时成立，就是卡死态的指纹。**

## 3. 证据链：引擎代码路径（只读引用）

`core/src/jvmMain/kotlin/universe/agentic/session/SqlDelightMessageStoreProvider.kt:48-72` `ensureSchema`：

- `current = readUserVersion(driver)` = 0；`target = SqlDelightMessageStore.SCHEMA_VERSION`
- `current >= target` 不成立 ⇒ 继续
- `tableExists(driver, "message_envelope")` 为 **true** ⇒ 走 `else` 分支，顺序执行 `migrateSessionMetaVisibility` / `migrateSessionMetaLastMutatedFromSeq` / `migrateSessionMetaOwnerIdentity` / `migrateSessionMetaPairingSummary` / `migrateSessionMetaWorkDir` / `migrateIdempotentOperationTable` / `migrateEnvelopeIdToPartialUniqueIndex` / `migrateEnvelopeParentTurnIndex` / `migrateAnchorResolutionIndexes`
- `writeUserVersion(driver, target)` 在 `if/else` **之后**（`:71`），两臂都要经过它

⇒ 任意一条迁移抛异常，`user_version` 就永远停在 0，下次打开原样重跑。**这是卡死不可自愈的结构性原因**，与具体是哪条迁移无关。

拒绝侧路径：

- `grpc-server/.../SessionManager.kt:1824-1854` `resolvedOwner`：`SessionStoreOpenResult.Failed` ⇒ `ResolvedOwner.LookupFailed`（1821 行注释明确「与 `Unrecorded` 不同，**必须 fail-closed**」）
- `SessionManager.kt:741-744`：`LookupFailed` ⇒ `log.debug("... deny bind")` + `throw SessionAlreadyExistsException()`
- `SessionGrpcService.kt:99-100`：捕获后映射为**无细节** `ALREADY_EXISTS`（无细节是 ADR-319 D3 防枚举要求，非疏漏）
- `SessionManager.kt:1286-1294`：`Failed to open message store` 的 warn 落点

## 4. 为什么是这个时间点爆的

两次引擎侧变更叠加，都在本仓 D26 登记（09-06 04:24）之前几天：

| 日期 | 引擎侧变更 | 作用 |
|:-----|:-----------|:-----|
| 2026-09-04 | `D-SESSION-RESOLVED-OWNER-FAILCLOSED-1` closed —— `LookupFailed` 不再等同 `Unrecorded`，改 deny | 把「store 打不开」从**静默放行**变成**硬失败**。安全方向正确 |
| 2026-09-06 | `D-SESSION-META-WORKDIR-1` closed —— `session_meta` 加 `work_dir` 列 + SCHEMA 7 | 让**已存在的旧库**必须走迁移分支，从而暴露迁移路径上的故障 |

在 09-04 之前，store 打不开会被当成「这个会话没有主人，可以绑」，Chat 侥幸能跑；在 09-06 之前，不需要迁移，不触发这条路径。两者一叠加，IDE 主回路当天即断。

**这不是任何一次变更做错了**，是两次正确变更的交叉影响没有被跨仓发现——因为本仓从未把症状报到引擎侧，引擎侧也无从知道 IDE 断了。

## 5. 根因判定与未确认部分

**已确认（有实测证据）**

1. 卡死态存在且指纹明确（§2）
2. `ensureSchema` 在该状态下必走迁移分支、且 `writeUserVersion` 在末尾（§3）⇒ 失败即永久卡死
3. 失败异常的字符串是 `Query does not return results`（§1）
4. 该字符串的来源在引擎自己的代码注释里有记录 —— `SqlDelightMessageStoreProvider.kt:300`：
   > `// PRAGMA user_version = N is a write; executeQuery fails on xerial JDBC ("Query does not return results").`

   即：**在 xerial JDBC 上把「写语句」走 `executeQuery` 就会抛这个错**。引擎已在 `writeUserVersion` 修掉一处（改用 `driver.execute`），说明这是已知的 bug 类别。

**未确认（留给引擎侧）**

具体是迁移分支里**哪一条语句**抛的，本仓未定位。已排除的：provider 内 4 处 `executeQuery`（`:100` / `:284` / `:306` / `:317`）都是 PRAGMA / sqlite_master **读**，正常返回结果集；`addColumnIfMissing`（`:330-338`）的 `ALTER TABLE` 已走 `driver.execute`，写法正确。

因此嫌疑落在**两处**：迁移函数内部由 SQLDelight 生成的调用，或 `MessageStoreDb.Schema` 的 migration。

**已按调用点排除的候选**：`MessageStorePhysicalOpener.kt:78-95` `applyAndroidPhysicalPragmas` 故意用 `executeQuery` 跑赋值型 PRAGMA（ART 要求），文档注明「MUST NOT be used for JDBC file drivers」，症状本会与本例一致 —— 但全仓搜索显示它**唯一调用点**是 `singularity/bridge/src/androidMain/.../AndroidMessageStorePhysicalOpener.kt`（`androidMain` 源集），`grpc-server` 的 JVM 路径到不了。**排除，不要按这条方向分诊。**

## 6. 建议引擎侧的排查入口（不指定修法）

1. **最小复现**：造一个「表已建、`user_version=0`、`session_meta` 无 `work_dir` 列」的 `messages.db`，对它调 `ensureSchema`，断言抛错并打印栈。§2 的指纹就是造夹具的配方；本机 `.sessions/session-100/messages.db` 可直接当样本。
2. **定位语句**：`ensureSchema` 的迁移分支目前是「一条抛错全盘回不去」。加栈打印或逐条隔离即可指名。
3. **顺带值得看的结构问题**（本仓不主张怎么改，只指出）：
   - 迁移分支缺少「部分成功」的记账 —— 失败后 `user_version` 不前进，也没有任何标记，运维上看不出这个库已经废了，只能从 WARN 日志推
   - `Failed to open message store` 目前是 `WARN`，但后果是该会话**永久不可用**，日志级别与后果不匹配
4. **不建议的方向**：不要为了让 Create 通过而放宽 `LookupFailed` 的 deny。那会退回 09-04 之前的 hijack 面。本仓 D26 原先写的闭合条件（「引擎 Create 先写 meta 再回成功」）正是这个错误方向，已在本篇 §7 撤回。

## 7. 本仓侧后果与已做的修正

- **D25 与 D26 同源**。D25 记的 `Query does not return results`（List 真空）与 D26 记的 Create 回 6，是 §1 里同一条 store 故障的两个出口。此前作为两行独立缺口各自挂着，谁都没往下查。
- **D26 原病因与闭合条件均有误**，已按本篇改口：病因不是「建目录后按目录存在回 6 且不写 meta」，闭合条件不是「Create 先写 meta 再回成功」。
- **本仓侧无可修之处**。宿主面（Tree 抛出、Create recover 收敛、ghost/List-fail 显示 bind-failed）在 A 槽 `host-bind-safety` / `ghost-bind-failed-ui` 已收口。剩余部分完全在引擎仓。
- **PRD-008 保持 `blocked`**，闭合依赖引擎侧本行。

## 8. 复现与验证边界

**复现**（本仓侧，只读）

1. 引擎日志：`vscode-debug-engine/logs/engine-restart-20260906T041732.log`，看 `340-352` 行
2. 卡死库：`vscode-debug-engine/universe-agent/grpc-server/.sessions/session-100/messages.db`，按 §2 四条探测复验

**验证边界**

- §1–§3 全部为实测或代码只读确认，非推断
- §5「未确认」段落列的具体抛错语句**是推断**，需引擎侧按 §6.1 坐实
- 本仓未运行引擎、未改引擎仓**源码 / proto / 构建文件**、未跑 gradle。**例外**：按 [cross-repo-protocol §3.4](../plans/cross-repo-protocol.md) 步骤 4，在引擎仓 `dev/progress/deferred-gaps.md` 追加了一行指针（docs-only，`D-SESSION-STORE-MIGRATION-STUCK-1`）
- `session-100` / `session-101` 在本仓 `src/` 内出现于四个单测文件（`sessionViewHostEngineBind.test.ts` 31 处 / `sessionCreateRecover.test.ts` 20 处 / `universeAgentRendererSync.test.ts` 3 处 / `conversationEngineRosterService.test.ts` 4 处，共 58 处）。**这两个 id 与钉死工位 `.sessions/` 下同名目录是否同源、落盘目录的实际创建方是谁，本仓均未追**——不排除 E2E 路径把夹具 id 送到了活引擎。取样合理性不依赖这一点（§2 的卡死指纹对任何一个该状态的库都成立），但引擎侧若要按 id 溯源需自行确认。（2026-09-09 修正：本行初稿写「不来自本仓 `src/`（已全文搜索确认）」，实为一次带 `!*test*` 过滤的搜索；措辞与结论均已改。）
