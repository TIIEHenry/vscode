---
title: "十六路审查 2026-11-07 r08：contrib/chat 方案"
type: plan
status: accepted
phase: N/A
updated: 2026-11-07
summary: "hold 2、weaken 1、drop 0。2026-11-07 规则 16 只读审查须改稿，已按四条 Important 与全部 Minor 改稿。r08-1 让 AI 自定义管理编辑器返回列表时经文本文件模型保存、持有引用到保存结束，并给严格夹具补桩；r08-2（只在 Agents 窗口）让内置覆盖保存等写入结果再离开，覆盖重入、关闭、离开又回来三种边界；r08-3 把未加载会话的改名记入索引，只在新建模型时补上。同日已实施（未编译、未跑测试），代码审查经一轮修改后可接受。"
---

# 十六路审查 2026-11-07 r08：contrib/chat 方案

状态：执行中。负责：agent:opus。
签收：签。签收人：agent:opus，依据用户 2026-11-07 在会话中说的「需要的做一下 不编译」，日期：2026-11-07。
覆盖需求：无。r08-1 改的是默认窗口设置里「Open Customizations…」打开的 Customizations 文件工具，它按 `docs/reference/code-oss-b2/settings-ua-access.md` 34、90–92 行作为上游文件工具保留，现行 PRD 没有它的验收：PRD-025 把技能与 agent 的产品主面定在 Engine 页（`docs/product/requirements.md` 404–420 行，409 行的用户价值写明不让用户在文件工具之间寻找），PRD-026 的七组 Client 设置也不含这条链接（426–439 行）。r08-2 与 r08-3 只在 Agents 窗口可达，按 `docs/product/vision.md` 35 行不属于产品范围；PRD-017 的本地会话持久化指 Conversation 会话（requirements.md 285–296 行），不是上游 chat 的 `ChatSessionStore`。

只改下面三条，范围停在 `src/vs/workbench/contrib/chat`、它的测试，以及 r08-1 需要补桩的组件夹具 `src/vs/workbench/test/browser/componentFixtures/sessions/aiCustomizationManagementEditor.fixture.ts`；r08-2 与 r08-3 只在 Agents 窗口可达，按低优先级处理。

| 编号 | 判定 | 严重度 | 说明 |
|:-----|:-----|:-------|:-----|
| r08-1 | hold | 高 | 见下文 |
| r08-2 | weaken | 中→低 | 「Save override」丢内容的路径只在 Agents 窗口可达。默认窗口的编辑器只列当前 harness 的条目，当前 harness 停在 Local；Local 用的基础 `PromptsService.getBuiltinPromptFiles` 返回空数组（`promptsServiceImpl.ts` 483–490 行），只有 Agents 窗口的 `AgenticPromptsService` 覆盖它。发现稿引的 `promptsServiceCustomizationItemProvider.ts` 281–286 行只给内置 chat 扩展的条目设 `groupKey`，`source` 仍是 `extension`，这类条目按只读打开（`aiCustomizationManagementEditor.ts` 1287 行）。默认窗口剩下的是工作区与用户文件写失败不提示，但改动留在脏模型里不丢；r08-1 改走模型保存后由文本文件保存错误处理器提示，这部分由 r08-1 承接。 |
| r08-3 | hold | 低 | 见下文（发现稿已按只在 Agents 窗口可达定为低，核实一致） |

## 实施前提与通用步骤

1. 本地验证顺序。`scripts/test.sh --run` 加载的是 `out/` 下的编译产物，所以每条都先跑 `npm run compile`（只改 TypeScript 时可用 `npm run compile-client`），再跑各条列出的 `scripts/test.sh --run …`，然后跑 `npm run eslint`。实施中改了文档（见第 2 条）之后，再跑 `python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`，以及 `dev/progress/health-gates.md`「文档健康」一节另列的 `python3 scripts/generate-docs-status.py --check` 与 `python3 -m unittest scripts/tests/test_docs_status.py`。
2. 登记与文档。提交时确保本方案登记在 `dev/plans/INDEX.md` 的方案表里（`plans-index-status` 生成列，状态取本稿 frontmatter）。2026-11-07 改稿时，工作区里已有别的会话加的未提交登记行（发现稿 `review-2026-11-07-r08-chat.md` 与本方案，INDEX 408–409 行）；提交前核对这两行是否已经入库，没有就随本方案的提交带上，不连带 INDEX 里其它主题的未提交改动。提交前跑 `python3 scripts/wiki/wiki.py remind --root .`，按提示更新文档，或在提交说明最后一段写 `Docs-Reviewed:`。D582（`dev/progress/deferred-gaps.md` 957 行）记的「三处不再画专用 localize 通知」被 r08-1、r08-2 有意改变，提交说明引用 D582。
3. 与 p6-2 S2c 的先后。`review-2026-11-04-p6-tests-and-process-plan.md` 145 行的 S2c 要把 leftover `.catch` 扫描改成「调用会失败的路径并断言错误被接住」，其中包括 `src/vs/workbench/contrib/chat/test/node/aiCustomizationManagementEditorCatchScan.test.ts`。本方案有意改变这几条路径的失败处理：r08-1 让返回保存不再经 `fileService.writeFile`，写失败改由文本文件保存错误处理器提示；r08-2 让覆盖保存失败改为提示并留在编辑态，不再交给 `onUnexpectedError`。所以 S2c 按旧行为写的断言不能沿用，处理方式取决于谁先落地。S2c 先落地：本方案实施时把 S2c 为这几条路径写的行为断言改成新行为，并在提交说明写明是有意的行为变化。本方案先落地：r08-2 改掉 D582 用例（`handleEditorActionButton / saveExistingCustomization / saveBuiltinPromptCopy rejection paths single-catch onUnexpectedError`）里 `void this.saveBuiltinPromptCopy(saveRequest).then(...)` 出现一次的断言，以及 `onDidRequestCreate / onDidRequestCreateManual leftover voids single-catch onUnexpectedError` 里 `void this.listWidget?.refresh();` 的次数断言；r08-1 不改调用点原文，不碰这份文件的断言；S2c 之后按落地后的调用形态和行为转写。两边不同时改这份测试文件：一方提交之后，另一方再动。
4. r08-3 与 `review-2026-10-30-r10-chat-plan.md`（已签收、执行中）的先后。r10-3 也改 `acquireOrRestoreLocalSession`，要把清 `_transferredSessionResource` 挪到读到可用内容之后；当前代码还没改，仍在 `chatServiceImpl.ts` 656–658 行先清再读。r10-2 改索引条目校验。r08-3 排在 r10 之后实施，在 r10-3 的结果上加合并步骤；若顺序相反，r10-3 落地时保留 r08-3 在 `acquireOrCreate` 之后的合并。r08-3 新增的字段是可选的，不影响 r10-2 的条目合格判定。

### r08-1

问题类：AI 自定义管理编辑器返回列表时绕过文本文件模型直接写盘，模型一直保持脏状态、不再随磁盘重新加载，之后再次返回会把旧内容不经冲突检查地写回磁盘。

核查：引用行与发现稿一致，`contrib/chat` 下没有未提交改动。默认编辑器窗口可达：设置编辑器 `ua` 分区「Customizations」组的「Open Customizations…」链接（`src/vs/workbench/contrib/preferences/browser/settingsLayout.ts` 540–548 行；`getTocDataForWindow(false)` 只滤掉 `chat` 分区，559–567 行）由 `settingsTree.ts` 1244、1250 行的 `executeCommand` 执行 `aiCustomization.openManagementEditor`。`registerAction2` 注册的命令处理器不检查 `precondition`（`src/vs/platform/actions/common/actions.ts` 740–743 行），所以 `aiCustomizationManagement.contribution.ts` 793 行带 `IsSessionsWindowContext` 的前置条件只挡命令面板和快捷键。`settingsUaToc.test.ts` 的 `resolved default window tree keeps navigation-only ua groups` 锁住这条链接，`docs/reference/code-oss-b2/settings-ua-access.md` 34、92 行把它定为默认窗口打开 Customizations 文件工具的入口。工作区与用户文件以可写方式打开（`aiCustomizationManagementEditor.ts` 1285–1288 行）。桌面 `files.autoSave` 默认 `off`，只有 Agents 窗口默认 `afterDelay`（`src/vs/workbench/contrib/files/browser/files.contribution.ts` 270、273 行），默认窗口里没有自动保存替模型清掉脏状态。文本文件模型管理器从不重载脏模型（`textFileEditorModelManager.ts` 122–135 行），也不释放脏模型（613–620 行）；再次解析已存在的模型时不重载（383–425 行），模型自己在脏时也拒绝重载（`textFileEditorModel.ts` 305–311 行）。没有测试或文档把「返回列表时用 `fileService.writeFile` 写盘」定为预期；`aiCustomizationManagementEditorCatchScan.test.ts` 只锁调用点的 catch 形态。既往审查、方案、`deferred-gaps.md`（D566、D574、D582、D590、D598 只处理 leftover catch）和归档里没有同一缺陷。

不变量：

- 对工作区或用户自定义文件，`goBackToList`（包括 `clearInput` 在编辑态调用的那一次）只通过该文件的文本文件模型保存来写盘，不再对这个文件调用 `fileService.writeFile`。
- 保存用模型自己的 URI 找文件模型。`createModelReference` 会把 URI 规范化（`src/vs/workbench/services/textmodelResolver/common/textModelResolverService.ts` 247 行），文件模型管理器按精确键查找（`textFileEditorModelManager.ts` 72、331 行），拿 `currentEditingUri` 可能找不到。
- 保存成功、且保存开始之后这个模型没有新的编辑（例如重新打开同一项后继续输入，或同一文件在别的编辑器里被改）时，工作副本不再是脏的，`IWorkingCopyService.isDirty` 为 false，之后磁盘变化按文本文件模型管理器的常规流程重新加载。保存期间有新编辑时，模型照常保持脏状态。
- 模型上次加载之后磁盘被别处改过、且平台冲突判定能识别时（缺口见改法第 7 步），保存不覆盖磁盘内容。冲突和其它写入失败由文本文件保存错误处理器提示用户（`textFileEditorModel.ts` 的 `handleSaveError`，989–1017 行），模型保留用户的改动并保持脏状态。保存调用不传 `ignoreErrorHandler`。
- 本次编辑的模型引用在保存结束（成功或失败）之前不释放，结束后恰好释放一次。
- `commitFiles` 只在保存成功之后调用。
- 内置项（`AICustomizationSources.builtin`）的编辑会话与覆盖保存不走这条路径。
- 组件夹具里用严格实例化服务构造这个编辑器的那一处仍能构造成功。

要动的符号：

- `src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts`：`IExistingCustomizationSaveRequest`（224–228 行）、`createExistingCustomizationSaveRequest`（3284–3299 行，只有 `goBackToList` 3177 行一个调用方）、`goBackToList`（3170–3229 行，其中 3189 行释放引用）、`saveExistingCustomization`（3317–3322 行）、构造函数参数列表（419–446 行，新增注入 `ITextFileService`）。
- `src/vs/workbench/test/browser/componentFixtures/sessions/aiCustomizationManagementEditor.fixture.ts`：构造编辑器的那组 `createEditorServices(..., { additionalServices })`（800 行起；编辑器在 1095 行由 `instantiationService.createInstance` 构造），在 `IWorkingCopyService` 桩（982–986 行）旁注册一个 `ITextFileService` 桩。这个夹具的实例化服务是严格模式（`fixtureUtils.ts` 735 行 `new TestInstantiationService(services, true, undefined, true)`），构造时遇到未注册的服务会抛错（`src/vs/platform/instantiation/common/instantiationService.ts` 142、387–393 行）。全仓只有这一处用实例化服务构造该编辑器。

改法：

1. 构造函数注入 `ITextFileService`。同一提交里在夹具的 `additionalServices` 注册 `ITextFileService` 桩，用 `mock<ITextFileService>()` 即可，夹具不触发保存。`fixtureUtils.ts` 的共享默认服务不动。
2. `IExistingCustomizationSaveRequest` 去掉 `content` 文本快照，改为携带 `fileUri`、`projectRoot` 和本次编辑的模型引用。
3. `createExistingCustomizationSaveRequest` 的建请求条件保持不变：`_editorContentChanged` 为真、来源不是 builtin、有 `currentEditingUri`、有 `currentModelRef`。建请求时把 `currentModelRef` 移交给请求对象并把字段置空，`goBackToList` 3189 行对已移交的引用不再释放；没有建请求时，3189 行照旧释放。`dispose()`（509–511 行）对 `currentModelRef` 已用可选链，移交后不会重复释放。
4. `saveExistingCustomization` 改为调用 `ITextFileService.save(modelUri, { reason: SaveReason.EXPLICIT, skipSaveParticipants: true })`，`modelUri` 取请求所持引用的 `textEditorModel.uri`（`src/vs/workbench/services/textfile/browser/textFileService.ts` 352、376–385 行：交给已有的文件模型保存，失败返回 `undefined`）。跳过保存参与者，是为了让写盘内容与内嵌编辑器里的文本一致，和现在直接写文本的结果相同。返回值非空时才调用 `commitFiles`，参数仍用 `fileUri`；返回 `undefined`（写入失败、冲突，或模型只读而未写）时不调用，也不另加提示，失败提示由文本文件保存错误处理器负责。无论结果如何，都在 `finally` 里释放请求持有的引用。不回退到 `fileService.writeFile`。
5. 调用点 `void this.saveExistingCustomization(saveRequest).catch(onUnexpectedError);`（3227 行）保持原文：后台保存不等待，界面照旧立即回到列表或迁移页。保存不检查 `this._store.isDisposed`，因为关闭编辑器时由 `clearInput`（2722–2732 行）触发的保存在面板释放之后也要做完。
6. 边界：返回时模型已经不脏（例如撤销回保存版本，或期间已被保存命令存过），`save` 不写盘，按成功处理。后台保存进行中用户重新打开同一项，拿到的是同一个模型，现有的 `workingCopyService.onDidSave` 监听（3149–3158 行）会在保存结束后把 `_editorContentChanged` 改回 `isDirty(uri)`，不需要另加处理。
7. 边界：冲突判定沿用平台现状，本条不弥补它的缺口。`src/vs/platform/files/common/fileService.ts` 500–535 行只在磁盘 mtime 晚于模型所记、且按旧 mtime 与磁盘现有长度算出的 etag 对不上时才报冲突，外部改动后长度不变就检测不到；长度变了但待写内容与磁盘相同也放行。用户把 `files.saveConflictResolution` 设成 `overwriteFileOnDisk` 时，模型保存不带 etag（`textFileEditorModel.ts` 956 行，`filesConfigurationService.ts` 548–550 行），不做冲突检查。

明确不改什么：

- 3143 行用 `isDirty(uri)` 初始化 `_editorContentChanged` 的语义不变：打开时已脏的文件，返回时仍会尝试保存，只是改走模型保存。
- 返回列表的界面流程和遥测 `chatCustomizationEditor.saveItem` 的发出时机不变。
- `showEmbeddedEditor` 切到另一项（3069 行）和 `dispose()`（509–511 行）释放引用时不保存的现状不变。
- 内置项编辑会话、「Save override」与 `handleBuiltinSave` 不在本条，见 r08-2。
- `fixtureUtils.ts` 的共享服务表不变，只在这个夹具里补桩。
- `aiCustomizationManagementEditorCatchScan.test.ts`：本条不改调用点原文，也不加回 `console.error('Failed to save customization changes on exit:'`，D582 用例里关于 `saveExistingCustomization` 的断言不受影响；与 S2c 的先后见「实施前提与通用步骤」第 3 条。`aiCustomizationManagementEditor.test.ts` 现有用例（如 `cleans up and detaches DOM container and embedded editors on dispose`）继续通过。

本地验证（顺序见「实施前提与通用步骤」第 1 条：先 compile，再跑测试，最后 eslint）：

- 在 `src/vs/workbench/contrib/chat/test/browser/aiCustomization/aiCustomizationManagementEditor.test.ts` 新增一条，沿用 `createTestEditor()` 的原型桩。原型桩不跑字段初始化，需在桩上显式设置：`currentEditingUri`、`currentEditingSource = AICustomizationSources.local`、`currentEditingProjectRoot`、`_editorContentChanged = true`；记录释放次数的假 `currentModelRef`，其 `object.textEditorModel.uri` 故意与 `currentEditingUri` 写法不同（例如大小写不同）；记录调用并返回入参 URI 的 `textFileService.save`；记录调用的 `fileService.writeFile` 与 `workspaceService.commitFiles`。依次调用 `createExistingCustomizationSaveRequest` 与 `saveExistingCustomization`，断言：`save` 只调用一次，收到的是模型 URI，选项含 `SaveReason.EXPLICIT` 与 `skipSaveParticipants: true`；`writeFile` 未被调用；`commitFiles` 在 `save` 解决之后才调用；`save` 解决之前引用未释放，之后释放一次；`currentModelRef` 已被置空。
- 同文件新增失败断言：`save` 返回 `undefined` 时 `commitFiles` 未被调用，引用仍释放一次，`saveExistingCustomization` 正常结束、不拒绝。
- 同文件新增一条用真实文本文件模型的断言，搭法照 `src/vs/workbench/services/textfile/test/browser/textFileEditorModel.test.ts`（`workbenchInstantiationService` 与 `TestServiceAccessor`）：取得模型引用、改内容后走同一保存路径，断言 `accessor.textFileService.isDirty(uri)` 为 false。再仿照该文件的 `save error (conflict)`，把 `accessor.fileService.writeShouldThrowError` 设为 `FILE_MODIFIED_SINCE`，断言保存后模型仍脏、`commitFiles` 未被调用。
- 用 `scripts/test.sh --run src/vs/workbench/contrib/chat/test/browser/aiCustomization/aiCustomizationManagementEditor.test.ts` 跑上述用例，再用 `scripts/test.sh --run src/vs/workbench/contrib/chat/test/node/aiCustomizationManagementEditorCatchScan.test.ts` 确认扫描用例仍通过。夹具补桩由 `npm run compile` 做类型检查。

### r08-2

问题类：Agents 窗口里对内置技能点「Save override」时，先回到列表并销毁唯一的内存编辑副本，再在后台写文件；写失败只写日志，修改丢失。

反证（降级理由）：

- 内置项路径在默认编辑器窗口不可达。只有 `source` 为 `AICustomizationSources.builtin` 的技能或提示词才进入内置编辑会话（`aiCustomizationManagementEditor.ts` 3092 行），而编辑器只列当前 harness 的条目。`CustomizationHarnessService` 只静态注册 Local harness（`src/vs/workbench/contrib/chat/browser/aiCustomization/customizationHarnessService.ts` 18–31 行）。扩展可以经提供者 API 注册外部 harness，API 允许条目来源为 `builtin`（`src/vscode-dts/vscode.proposed.chatSessionCustomizationProvider.d.ts` 68、97 行）；agent host 也会注册外部 harness（`agentHostChatContribution.ts` 323 行）。但当前 harness 由 `activeSessionResource` 派生，初值是默认 harness（`src/vs/workbench/contrib/chat/common/customizationHarnessService.ts` 473–476 行），只在 `aiCustomization.openManagementEditor` 解析出会话时切换（`aiCustomizationManagement.contribution.ts` 798–811 行，`aiCustomizationManagement.ts` 28–45 行）。默认窗口经设置链接执行这条命令时不带参数；Chat 视图只在 Agents 窗口，chat 编辑器在默认窗口改道 Conversation（`chatShellRouting.ts` 16–19 行），没有非本地会话可供切换，当前 harness 停在 Local。
- Local 的条目里，`builtin` 来源只来自 `mergeBuiltinSkills`（`aiCustomizationItemSource.ts` 276 行起），它读 `listPromptFilesForStorage(skill, PromptsStorage.builtIn)`；基础 `PromptsService.getBuiltinPromptFiles` 返回空数组（`promptsServiceImpl.ts` 483–490 行），只有 Agents 窗口的 `AgenticPromptsService` 覆盖它（`src/vs/sessions/contrib/chat/browser/promptsService.ts` 28、102 行），`agentHostLocalCustomizations.ts` 43–45 行的注释也写明常规工作台窗口在 builtin 存储下什么都不返回。agent host 的条目提供者只产出 local、user、plugin 来源，或沿用同步来源（`agentCustomizationItemProvider.ts` 200、268–272、316、364 行），同步来源在默认窗口同样没有 builtin。
- 发现稿引的 `promptsServiceCustomizationItemProvider.ts` 281–286 行只给内置 chat 扩展的条目设 `groupKey`，`source` 仍是 `extension`（同函数 274 行的判断与对象展开）；`aiCustomizationItemSource.ts` 242–247 行同样返回 `source: extension`。这类条目按只读打开（`aiCustomizationManagementEditor.ts` 1287 行），不会出现「Save override」。
- 默认窗口里剩下的是工作区与用户文件写失败不提示（3225–3228 行；工作台的未预期错误处理器只写日志，`src/vs/workbench/browser/workbench.ts` 113–129 行）。这部分不丢内容：文本文件模型保持脏状态，被管理器留着（`textFileEditorModelManager.ts` 613–620 行），再打开同一项能看到改动，关窗时会提示保存。r08-1 改走模型保存后，失败由文本文件保存错误处理器提示，这部分由 r08-1 承接，本条不再单独改。
- `c69a54d3d67` 确实把这几处 `notificationService.warn` / `error` 换成了 `onUnexpectedError`，D582（`dev/progress/deferred-gaps.md` 957 行）也记下「三处不再画专用 localize 通知」。那是 leftover catch 清理的附带后果，没有把静默定为产品预期，所以不据此 drop。

不变量：

- 同一个内置项同一时间只有一次覆盖保存。保存进行中（包括 Quick Pick 阶段）再从按钮、Ctrl+S 或关闭确认里的 Save 进入时，不再弹 Quick Pick、不再写盘，而是等这一次的结果。
- 覆盖保存进行期间，该项的内置编辑会话不被 `goBackToList` 或 `clearInput` 释放。
- 覆盖保存失败时，用户看到与 `handleBuiltinSave` 相同的提示（「Could not save the override to the workspace.」或「Could not save the override to your user folder.」），编辑内容可取回：还停在该项编辑态时留在编辑态；已经离开时会话保留，再打开该项能看到修改。面板已释放时只保证提示出现。
- 覆盖保存成功、且会话内容仍等于这次写入的快照时，与现在一致：按钮路径回到列表、释放会话、刷新列表；保存处理路径清掉 `_editorContentChanged`。会话内容已经比快照新（保存期间离开又回来继续改过）时，不离开编辑态、不释放会话，「Save override」仍可用。
- 保存期间用户已切到别的视图时，成功或失败都不调用 `goBackToList` 去覆盖当前视图，保持 `437701242a4` 加的守卫语义；Quick Pick 返回后已不在同一项编辑态就不写，两条入口一致。

要动的符号：`handleEditorActionButton`（3360–3408 行）；`handleBuiltinSave`（3445–3481 行）——编辑器输入的保存处理在 2705 行登记，Ctrl+S 与关闭确认里的 Save 都经 `AICustomizationManagementEditorInput.save`（`aiCustomizationManagementEditorInput.ts` 79–88 行）调到它，保存进行中输入一直是脏的（`updateInputDirtyState`，3438–3443 行）；`goBackToList` 中释放内置编辑会话的分支（3185–3187 行）；`clearInput` 里的 `disposeBuiltinEditingSessions()`（2747 行）。新增：一个与 `builtinEditingSessions`（341 行）并列的字段，例如 `builtinOverrideSavesInFlight`，键与 `builtinEditingSessions` 一样用 `uri.toString()`，值含这次保存的 Promise 与写入快照；一个两条入口共用的覆盖保存方法。`saveBuiltinPromptCopy`（3301–3315 行）、`createBuiltinPromptSaveRequest`（3262–3282 行）、`pickBuiltinPromptSaveTarget` 不变。文件：`src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts`。

改法：

1. 新增共用覆盖保存方法，按钮与保存处理都走它。进入时记下当前编辑项的 URI；该 URI 已在新字段里时，直接返回那份 Promise。否则立刻登记，再弹 Quick Pick；取消返回 false。Quick Pick 返回后若已不在同一项编辑态，返回 false、不写；这是 3377–3379 行的守卫，`handleBuiltinSave` 现在没有，一并补上。然后建请求、记下快照，`await saveBuiltinPromptCopy`。失败时 `console.error` 加现有的 `notificationService.warn`，返回 false；成功返回 true。`finally` 从新字段里移除。遥测位置保持：按钮路径在建请求后发，`handleBuiltinSave` 在成功后发。
2. 成功后的收尾在共用方法返回前做，先取该 URI 的会话。内容等于快照、且正停在该项编辑态时，按钮路径调用 `goBackToList()`，由它释放会话并刷新列表；保存处理路径沿用 3468–3471 行，只把 `_editorContentChanged` 置 false 并更新按钮。内容等于快照、但当前不在该项编辑态时，释放该会话，面板未释放则刷新列表。内容与快照不同时，不离开、不释放，`_editorContentChanged` 按内容与原文比较保持为真。会话已不在（面板已释放）时不做别的。
3. 失败后的收尾：不离开编辑态，不释放会话。已经离开的，会话留着，再打开该项时 `getOrCreateBuiltinEditingSession`（3237–3242 行）复用这份会话。
4. `goBackToList` 在当前项是内置项、且其 URI 在新字段里时，跳过 3185–3187 行的释放。`clearInput` 2747 行改为只释放不在新字段里的会话，在途会话交给第 2、3 步。关闭确认里选 Save 时，保存处理按第 1 步合流；失败时输入仍是脏的，关闭被否决（`src/vs/workbench/browser/parts/editor/editorGroupView.ts` 1877–1887 行）。选 Don't Save 时，`revert` 只清输入的脏标记（`aiCustomizationManagementEditorInput.ts` 90–92 行），随后 `clearInput` 不释放在途会话。`dispose()` 仍释放全部会话（509–514 行）。
5. 新字段在 `goBackToList`、`clearInput` 里按 `dispose()` 对 `builtinEditingSessions` 的写法判空（512 行），因为单测的原型桩不跑字段初始化。实施时若在 `dispose()` 里碰这个字段，同样判空。
6. 按钮的 `editorActionButtonInProgress` 在等待期间保持为真；`finally`（3400–3407 行）不变。
7. `aiCustomizationManagementEditorCatchScan.test.ts` 的处理见「实施前提与通用步骤」第 3 条。

明确不改什么：

- 工作区与用户文件的返回保存（r08-1）。
- 选 Workspace / User / Cancel 的 Quick Pick，以及取消即不保存。
- `createBuiltinPromptSaveRequest`、`saveBuiltinPromptCopy` 的目标路径计算（技能写成 `{skillName}/SKILL.md`）与 `commitFiles`。
- 编辑器输入的保存处理继续返回布尔值；`AICustomizationManagementEditorInput` 不改。
- `uses edit copy for built-in skills that support raw overrides` 等现有用例继续通过。

本地验证（顺序见「实施前提与通用步骤」第 1 条）。在 `aiCustomizationManagementEditor.test.ts` 新增下列用例，每种边界一条。原型桩上需显式设置：`builtinEditingSessions`（放一份内容为编辑后文本的模型）、新字段、`currentEditingUri`、`currentEditingSource = AICustomizationSources.builtin`、`currentEditingPromptType = PromptsType.skill`、`_editorContentChanged = true`、`viewMode = 'editor'`、`fileService`（`createFolder`、`writeFile`）、`notificationService.warn`、`telemetryService.publicLog2`、`workspaceService.getActiveProjectRoot`；把 `pickBuiltinPromptSaveTarget` 换成返回 Workspace 的桩，需要时把 `goBackToList` 换成记录调用的桩。

- 失败：`writeFile` 拒绝。调用 `handleEditorActionButton` 后，`notificationService.warn` 以 workspace 文案调用一次，`goBackToList` 未被调用，会话仍在且内容未变。
- 成功：`writeFile` 成功，`goBackToList` 被调用一次。
- 重入：`writeFile` 挂起时调用 `handleBuiltinSave()`，模拟 Ctrl+S 或关闭确认里的 Save。`pickBuiltinPromptSaveTarget` 共调用一次，`writeFile` 共调用一次，`handleBuiltinSave` 的结果与挂起的那次相同。再一条：Quick Pick 挂起时再次进入，Quick Pick 仍只弹一次。
- 关闭：`writeFile` 挂起时调用 `clearInput`（可先把 `viewMode` 设为 `list`，只验 2747 行；或补齐 `goBackToList` 触及的字段）。在途会话未被释放；随后写入失败时，提示出现且会话仍在；另一条写入成功时，会话被释放。
- 离开又回来：`writeFile` 挂起时调用真实的 `goBackToList`，再回到同一项（把编辑态字段设回该项，或调用真实的 `showEmbeddedEditor`）并改动会话内容，然后写入成功。`goBackToList` 不再被调用，会话保留新内容，`_editorContentChanged` 仍为真。
- 用 `scripts/test.sh --run src/vs/workbench/contrib/chat/test/browser/aiCustomization/aiCustomizationManagementEditor.test.ts` 与 `scripts/test.sh --run src/vs/workbench/contrib/chat/test/node/aiCustomizationManagementEditorCatchScan.test.ts` 跑。

### r08-3

问题类：在会话列表里给未加载的本地 chat 会话改名，只改了索引里的标题；打开会话后模型用会话文件里的旧标题，下一次保存再把索引改回旧名。

核查：引用行与发现稿一致。`setChatSessionTitle`（`chatServiceImpl.ts` 435–448 行）在模型未加载时只经 `setSessionTitle`（`chatSessionStore.ts` 510–517 行）改内存索引，再由 `saveState`（`chatServiceImpl.ts` 368–390 行）刷写索引。`acquireOrRestoreLocalSession`（648–678 行）只读会话文件，`reviveStoredSession`（`chatSessionStore.ts` 690 行起）不合并索引标题，`ChatModel` 构造时 `_customTitle` 取文件里的值（`chatModel.ts` 2816 行）。打开之后，`updateAndFlushIndexSync`（`chatSessionStore.ts` 762–776 行）用 `getSessionMetadataSync`（877–905 行）按模型重算标题。测试只锁索引标题被改（`chatSessionStore.test.ts` 的 `setSessionTitle updates existing session title`），没有锁「会话文件不改」。既往方案没有承接：`review-2026-10-30-r10-chat-plan.md` 只处理 `storeTask`、坏索引、转移会话、编辑工具和待发队列。可达性：能对未加载会话改名的入口有三处，都只在 Agents 窗口。会话列表的右键菜单只在 Chat 视图（`chatViewPane.ts` 968 行）和会话欢迎页（`agentSessionsWelcome.ts` 613 行）里出现；会话选择器的改名按钮（`agentSessionsPicker.ts` 137–139 行）只由 Chat 视图的标题控件创建（`chatViewTitleControl.ts` 95 行，`chatViewPane.ts` 1167 行）。Chat 视图带 `IsSessionsWindowContext`（`chatParticipant.contribution.ts` 59–60 行），会话欢迎页只在 Agents 窗口注册（`agentSessionsWelcome.contribution.ts` 33–34、80、147 行）。默认窗口里能改名的只剩 F2 改聚焦会话（`agentSessionsActions.ts` 713–718、754–765 行）、chat 编辑器（`chatEditor.ts` 333 行）和 `/rename`（`chatSlashCommands.ts` 246 行），作用的都是已加载会话，走 438 行的 `setCustomTitle`，不触发本缺陷。严重度维持低。

不变量：

- 未加载的本地会话改名后，第一次恢复得到的模型 `customTitle` 等于新名字，列表显示新名字；之后的保存把新名字写进会话文件和索引。
- 已加载会话改名的行为不变。
- 没有改过名的会话，恢复后的标题与现在相同。
- 索引里的标题只合并到这次恢复新建的模型上，不改已经存在的模型。
- 改名与会话加载并发时，最后留下的是新名字。

要动的符号：`IChatSessionEntryMetadata`（783 行起，新增可选字段 `customTitle`）、`getSessionMetadataSync`（877–905 行）、`getSessionMetadata` 的序列化数据分支（914–931 行）、`ChatSessionStore.setSessionTitle`（510–517 行），文件 `src/vs/workbench/contrib/chat/common/model/chatSessionStore.ts`；`ChatService.acquireOrRestoreLocalSession`（648–678 行）、`ChatService.setChatSessionTitle`（435–448 行），文件 `src/vs/workbench/contrib/chat/common/chatService/chatServiceImpl.ts`。

改法：

1. `IChatSessionEntryMetadata` 增加可选字段 `customTitle`，表示用户或标题提供者设过的自定义标题。`isChatSessionEntryMetadata`（830–838 行）只校验 `sessionId`、`title`、`lastMessageDate`，新字段不进必填校验，索引版本不变。
2. `getSessionMetadataSync` 与 `getSessionMetadata` 的序列化数据分支都写这个字段，取 `session.customTitle`，没有就不写。序列化数据分支用于旧存储迁移（914 行注释），迁移数据的 `customTitle` 与会话文件一致，恢复时合并是空操作。`chatSessionStore.test.ts` 的 `createMockChatModel`（37–49 行）返回的 `MockChatModel` 不是 `ChatModel` 实例，`storeSessions` 也走这个分支（908 行的 `instanceof` 判断）。
3. `setSessionTitle` 在条目存在时同时设 `title` 与 `customTitle`；条目不存在时仍什么都不做。
4. `acquireOrRestoreLocalSession` 在调用 `acquireOrCreate`（670 行）之前，同步记下 `_sessionModels.has(sessionResource)`。`acquireOrCreate` 遇到已有键时返回已有模型（`src/vs/workbench/contrib/chat/common/model/chatModelStore.ts` 117–120 行），所以只在这次调用新建了模型时合并：用 `ChatSessionStore.getMetadataForSessionSync`（`chatSessionStore.ts` 600–603 行）取索引条目，条目带非空 `customTitle` 且与模型的 `customTitle` 不同时，对模型调用 `setCustomTitle`（`chatModel.ts` 3235–3238 行）。之后的保存由会话序列化把新标题写进会话文件。
5. `setChatSessionTitle` 在 `await setSessionTitle` 之后再查一次 `_sessionModels`：这期间会话被加载出来、且模型的 `customTitle` 不等于新名字时，对它调用 `setCustomTitle`，再 `saveState`。这样改名与加载并发时，`updateAndFlushIndexSync` 按模型重算也得到新名字。
6. 不为未加载会话重写会话文件。日志式存储（`.jsonl`）下，加载中的模型按自己的序列化状态追加写（`writeSession`，`chatSessionStore.ts` 349–403 行），另行整份重写会让两者对不上。

明确不改什么：

- 贡献会话与 agent host 会话的改名（`renameChatSession`）不变。
- 会话文件格式、`writeSession`、`storeSessions` 不变。
- 索引标题的取值规则 `customTitle || title` 不变；没有条目时 `setSessionTitle` 仍什么都不做。保持 `storeSessions persists custom title`、`setSessionTitle updates existing session title`、`setSessionTitle does nothing for non-existent session` 通过。
- 与 r10-2（坏条目只跳过该条）兼容，先后见「实施前提与通用步骤」第 4 条。
- `agentSessionsActions.ts` 的改名动作不变，保持 `renames the session in the focused chat widget`、`resolves the rename keybinding in the sessions list and focused regular chats` 通过。

本地验证（顺序见「实施前提与通用步骤」第 1 条）：

- 在 `src/vs/workbench/contrib/chat/test/common/model/chatSessionStore.test.ts` 用 `createMockChatModel`（走序列化数据分支）新增断言：带自定义标题的模型经 `storeSessions` 之后，索引条目的 `customTitle` 等于该标题；不带时该字段为 undefined；`setSessionTitle` 之后 `title` 与 `customTitle` 都是新值。
- 在 `src/vs/workbench/contrib/chat/test/common/chatService/chatService.test.ts` 仿照 `retrieveSession`（377 行）新增一条，覆盖真实 `ChatModel` 的同步分支：用 `createChatService()` 建服务；`startNewLocalSession` 得到的引用不挂进 `testDisposables`，加一条请求后手工释放并 `waitForModelDisposals`；`await setChatSessionTitle(resource, 'Renamed')`；用 `acquireOrLoadSession` 直接恢复（不用 `getOrRestoreModel`，它把引用挂进 `testDisposables`，要到 teardown 才释放），断言 `customTitle` 与 `title` 都是新名字，再手工释放并 `waitForModelDisposals`；最后用新的 `createChatService()` 与 `getOrRestoreModel` 恢复，标题仍是新名字。
- 同文件再加一条并发：先发起 `acquireOrLoadSession` 不等待，紧接着调用 `setChatSessionTitle`，两者都结束后模型标题是新名字；手工释放并 `waitForModelDisposals` 之后，`getSessionTitle(resource)` 读到的索引标题也是新名字。
- 用 `scripts/test.sh --run src/vs/workbench/contrib/chat/test/common/model/chatSessionStore.test.ts` 与 `scripts/test.sh --run src/vs/workbench/contrib/chat/test/common/chatService/chatService.test.ts` 跑。

## 审查

2026-11-07 只读审查的结论是须改稿，没有 Critical，四条 Important 核实后都采纳并已改。I1：注入 `ITextFileService` 会让严格夹具 `aiCustomizationManagementEditor.fixture.ts` 1095 行构造失败（`fixtureUtils.ts` 735 行严格模式，`instantiationService.ts` 387–393 行抛错），r08-1 的要动符号、改法第 1 步和验证已补夹具桩，改动范围放宽到该夹具文件。I2：`chatSessionStore.test.ts` 的模拟模型走 `getSessionMetadata` 914–931 行的序列化数据分支，r08-3 改为两个分支都写 `customTitle`，store 用例走序列化分支，chatService 用例用真实 `ChatModel` 覆盖同步分支。I3：r08-2 等待保存期间的重入（2705、3438–3443 行，以及输入的 `save` 79–88 行）、`clearInput` 2747 行的整体释放、离开又回来（2286、2335、2911 行，会话复用在 3237–3242 行）都属实，已改为共用覆盖保存方法加进行中字段合流重入，`clearInput` 与 `goBackToList` 不释放在途会话，成功后先比对会话内容再决定离开与释放，并按三种边界各补一条用例。I4：原稿写「S2c 改成行为断言后以改后的为准」，方向写反了；已改为本方案有意改变 S2c 要锁的失败处理，谁先落地决定处理方式，两边不同时改 `aiCustomizationManagementEditorCatchScan.test.ts`，见「实施前提与通用步骤」第 3 条。Minor 十条都已改：保存改用模型 URI（`textModelResolverService.ts` 247 行会规范化 URI）；「不再脏」的不变量加了「保存开始后没有新编辑」的限定；补了平台冲突判定的缺口（`fileService.ts` 500–535 行，`overwriteFileOnDisk` 关闭检查）；列出原型桩要设的字段，新字段按 `dispose()` 512 行的写法判空；「600–603 行」注明在 `chatSessionStore.ts`；合并只作用于新建的模型（`chatModelStore.ts` 117–120 行）；写明与 2026-10-30 r10 方案的先后；chatService 用例改为手工管理引用，不经 `testDisposables` 拖到 teardown；「只注册 Local」改为「只静态注册 Local」，并说明扩展与 agent host 的外部 harness 在默认窗口不会成为当前 harness；r08-3 的可达性补上 `agentSessionsPicker.ts` 137–139 行的改名按钮，它只由 Chat 视图创建，结论不变。共性问题一并处理：本地验证改为先 compile、再跑测试、再 eslint，改文档后跑 docs-health；「覆盖需求」写明不对应现行 PRD 的理由；实施步骤写明提交时登记 `dev/plans/INDEX.md`。判定表的判定与严重度不变。

## 实施记录（2026-11-07）

按用户「不编译」的要求实施了 hold 与 weaken 的三条，没有 drop 条目。未编译，未跑测试，也未跑 eslint 与 docs-health。工作区里别的会话的未提交改动原样保留，本次只改了下面列出的文件。

### r08-1（已实施）

- `src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts`：构造函数末尾注入 `ITextFileService`；`IExistingCustomizationSaveRequest` 把 `content` 换成 `modelRef`；`createExistingCustomizationSaveRequest` 建请求时把 `currentModelRef` 移交给请求并把字段置空；`saveExistingCustomization` 改为 `ITextFileService.save(modelRef.object.textEditorModel.uri, { reason: SaveReason.EXPLICIT, skipSaveParticipants: true })`，返回值非空才 `commitFiles(projectRoot, [fileUri])`，`finally` 里释放引用。调用点 `void this.saveExistingCustomization(saveRequest).catch(onUnexpectedError);` 原文未动。
- `src/vs/workbench/test/browser/componentFixtures/sessions/aiCustomizationManagementEditor.fixture.ts`：在 `IWorkingCopyService` 桩旁注册 `mock<ITextFileService>()`。
- 与方案的出入：`goBackToList` 里释放 `currentModelRef` 的两行没改。移交发生在它之前（`createExistingCustomizationSaveRequest` 已把字段置空），这两行只会释放没建请求时的引用，效果与方案第 3 步相同。
- 测试：`aiCustomizationManagementEditor.test.ts` 新增 `saves an edited workspace customization through its text file model and releases the reference afterwards`、`does not commit when saving the text file model fails and still releases the reference`、`saving through the text file model clears its dirty state and keeps it dirty on a save conflict`。最后一条用 `workbenchInstantiationService` 与 `TestServiceAccessor` 搭真实文本文件模型，模型登记照 `textFileService.test.ts` 的 `save - file` 写法。

### r08-2（已实施）

- `aiCustomizationManagementEditor.ts`：新增类型 `BuiltinOverrideSaveEntry`、字段 `builtinOverrideSavesInFlight`，以及方法 `saveBuiltinOverride`（合流入口）、`runBuiltinOverrideSave`（选目标、守卫、写盘、失败提示，`finally` 里移出进行中字段）、`finishBuiltinOverrideSave`（成功收尾，先比对会话内容与写入快照）、`logBuiltinOverrideSave`、`disposeIdleBuiltinEditingSessions`。`handleEditorActionButton` 的内置分支与 `handleBuiltinSave` 都改为调用 `saveBuiltinOverride`；`goBackToList` 对进行中的内置会话跳过释放；`clearInput` 改为只释放不在进行中字段里的会话。`dispose()` 未改。
- `src/vs/workbench/contrib/chat/test/node/aiCustomizationManagementEditorCatchScan.test.ts`：按用户「r08-2 本轮先于 p6 S2c 落地」的说明，把 D582 用例里 `void this.saveBuiltinPromptCopy(saveRequest).then(...)` 出现一次的断言改成 `void this.saveBuiltinPromptCopy(` 出现 0 次。`onDidRequestCreate / onDidRequestCreateManual leftover voids single-catch onUnexpectedError` 里 `void this.listWidget?.refresh();` 的次数仍是 2（`goBackToList` 一处，`finishBuiltinOverrideSave` 一处），没有改。p6-2 S2c 之后转写这份文件时，要按落地后的行为写：覆盖保存失败时提示并留在编辑态，不再经 `onUnexpectedError`。
- 与方案的出入：
  - 进行中字段的值只存保存的 Promise，没有存写入快照。快照留在请求对象里，`finishBuiltinOverrideSave` 直接拿 `request.content` 比对，字段里的快照没有读者。
  - 遥测取值改用 `request.promptType` 与 `AICustomizationSources.builtin`，不再读 `currentEditingPromptType`、`currentEditingSource`。按钮路径两者相同；保存处理路径在写盘期间用户切走时，旧写法会记成别的项。发出位置不变。
  - 合流的调用方只拿到布尔结果，成功收尾按发起保存的那一个入口走：Ctrl+S 合流到按钮发起的保存时，成功后照按钮的方式回到列表；按钮合流到 Ctrl+S 发起的保存时，成功后留在编辑态。
  - 选好目标却建不出请求（没有可保存的改动）时，按钮仍回到列表，与原行为一致。
- 测试：`aiCustomizationManagementEditor.test.ts` 新增 `keeps the built-in override edits in the editor and warns when the override write fails`、`returns to the list and releases the built-in session once the override is written`、`joins a running override write instead of picking a target and writing again`、`joins an override save that is still waiting for its target`、`closing the editor while the override is written keeps the session until the write settles`、`keeps edits made after leaving and returning while the override was written`。这些用例的原型桩换了一个独立的 `_store`：真实的 `goBackToList` 会经 `clearEditorPreview` 清空 `editorPreviewDisposables`，而 `createTestEditor()` 原先的 `_store` 就挂在里面。
- 另有三份扫描读这个编辑器源码：`aiCustomizationLeftoverPromiseCatchScanD835.test.ts`、`chatLeftoverPromiseCatchScanD943.test.ts`、`chatSetupLeftoverPromiseCatchScanD840.test.ts`。它们期待编辑器里有双链 catch，而 HEAD 上编辑器已经没有双链（11-03 去重），这些断言在 HEAD 上就不成立。本次只去掉一处单链 `.catch(onUnexpectedError)`，没有扫描统计单链总数，它们的结果不会因本次改动变化。

### r08-3（已实施）

- `src/vs/workbench/contrib/chat/common/model/chatSessionStore.ts`：`IChatSessionEntryMetadata` 增加可选字段 `customTitle`；`getSessionMetadataSync` 与 `getSessionMetadata` 的序列化数据分支写入 `customTitle: session.customTitle || undefined`；`setSessionTitle` 同时设 `title` 与 `customTitle`。
- `src/vs/workbench/contrib/chat/common/chatService/chatServiceImpl.ts`：`acquireOrRestoreLocalSession` 在 `acquireOrCreate` 之前记下 `_sessionModels.has`，只对这次新建的模型用索引里的 `customTitle` 调 `setCustomTitle`；`setChatSessionTitle` 在 `await setSessionTitle` 之后，对期间恢复出来的模型补调 `setCustomTitle`。
- 与方案的出入：方案写「没有就不写」，实现照邻近字段（`permissionLevel`、`workingDirectory` 等）的写法用 `|| undefined`：内存里这个键存在、值为 undefined，序列化进存储时省略。
- 依赖：2026-10-30 r10 方案的改动（r10-1 `storeSessions` 的 `finally`、r10-2 索引条目校验、r10-3 `acquireOrRestoreLocalSession` 的转移指针）不在当前工作区，本条直接在当前代码上实施。r10-3 之后落地时，要保留本条在 `acquireOrCreate` 之后的合并；新字段是可选的，不影响 r10-2 的条目合格判定。
- 测试：`chatSessionStore.test.ts` 新增 `index entries carry the custom title and setSessionTitle records it`；`chatService.test.ts` 新增 `restoring an unloaded session applies a rename that only reached the index` 与 `a rename racing a restore of the same unloaded session keeps the new title`。

### 没做的部分

方案范围内的步骤都已实施。共享登记表由父 agent 统一写：`dev/plans/INDEX.md` 里两份 r08 稿的登记行已经在工作区（未提交）；`src/vs/workbench/test/browser/componentFixtures/sessions/aiCustomizationManagementEditor.fixture.ts` 是新出现的上游文件改动，要登记进 `dev/progress/upstream-min-patch.md` 的 B 表（chat 目录已按 `src/vs/workbench/contrib/chat/**` 前缀登记）；提交说明引用 D582。

### 之后要跑的本地验证

先编译，再跑测试，最后跑 eslint 与文档检查：

```bash
npm run compile
scripts/test.sh --run src/vs/workbench/contrib/chat/test/browser/aiCustomization/aiCustomizationManagementEditor.test.ts
scripts/test.sh --run src/vs/workbench/contrib/chat/test/node/aiCustomizationManagementEditorCatchScan.test.ts
scripts/test.sh --run src/vs/workbench/contrib/chat/test/common/model/chatSessionStore.test.ts
scripts/test.sh --run src/vs/workbench/contrib/chat/test/common/chatService/chatService.test.ts
scripts/test.sh --run src/vs/workbench/contrib/chat/test/browser/agentSessions/agentSessionsActions.test.ts
npm run eslint
python3 scripts/check-docs-health.py
python3 scripts/wiki/wiki.py check --root .
```

D835、D943、D840 三份扫描如需对照，用 `scripts/test.sh --run <文件>` 跑，并与 HEAD 上的结果比较，而不是与全绿比较。

### 代码审查（2026-11-07）

只读代码审查结论为须修改，处理如下（仍未编译、未跑测试）：

- Critical（写入失败分支的 `console.error` 会让测试运行器判失败）：已改。`aiCustomizationManagementEditor.test.ts` 新增 `withoutOverrideWriteErrorLog`，在 `keeps the built-in override edits in the editor and warns when the override write fails` 与 `closing the editor while the override is written keeps the session until the write settles` 的失败段临时替换 `console.error`，只吞掉以 `Failed to save built-in override:` 开头的消息，`finally` 里恢复；生产代码里这句日志保留。
- Minor 1（改名补设对调用前已加载的模型也生效）：已改。`setChatSessionTitle` 只在函数开头没取到模型时，才在 `await setSessionTitle` 之后补设。
- Minor 2（Quick Pick 期间离开、随后取消或已不在该项，会话留到 `clearInput`）：已改。`runBuiltinOverrideSave` 的两个提前返回调用新方法 `releaseBuiltinEditingSessionIfLeft`，当前已不在该项编辑态时释放会话；新增用例 `releases the built-in session when the target pick is cancelled after leaving the item`。
- Minor 3（写盘期间别的条目的按钮也被禁用）：按方案第 6 步保持，不改。
- Minor 4（新服务恢复的断言证明不了会话文件里有新名字）：已改。核对时还发现，`InMemoryTestFileService.writeFile` 忽略 `append`，恢复后再写只留下追加的增量，第二个服务读这份日志会因缺初始条目而恢复失败，原来那步在测试桩上本来就不成立。现改为断言最后一次写会话文件（路径含会话 id）的内容含 `Renamed`，并断言索引标题。
- Minor 5（可选，扫描里新加的源码文本断言）：已删除 D582 用例里「`void this.saveBuiltinPromptCopy(` 出现 0 次」那一条；失败与成功行为由浏览器用例覆盖，`await this.saveBuiltinPromptCopy(saveRequest);` 的原有断言保留。
