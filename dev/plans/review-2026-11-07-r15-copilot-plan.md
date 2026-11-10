---
title: "十六路审查 2026-11-07 r15：extensions/copilot 方案"
type: plan
status: accepted
phase: N/A
updated: 2026-11-11
summary: "hold 2、weaken 2、drop 0；方案覆盖替换工具预备结果的复用范围、BYOK 旧密钥迁移的完成判定与删除时机、损坏元数据写路径的拒写与批量刷盘，以及笔记本运行工具的错误回传。r15-1、r15-3、r15-4 只在 Agents 窗口可达；r15-2 的迁移代码会在启用了扩展的默认窗口里执行，但要有本产品配置里不会出现的旧版 key 才会触发。已按 2026-11-07 只读审查改稿；同日已实施（未编译、未跑 typecheck，只跑了相关 vitest），代码审查经一轮修改后可接受。"
---

# 十六路审查 2026-11-07 r15：extensions/copilot 方案

状态：执行中。负责：agent:opus。
签收：签。签收人：agent:opus，依据用户 2026-11-07 在会话中说的「需要的做一下 不编译」，日期：2026-11-07。
覆盖需求：无（维护类：四条都是 `extensions/copilot` 上游代码的缺陷修复。触发面是 Agents 窗口里的 Copilot 聊天与 Copilot CLI 会话，或本产品配置里不会出现的旧版 BYOK key；现行产品需求只验收默认编辑器窗口的产品壳，这四条不改变默认窗口里任何用户能观察到的行为）。

只改下面四条，代码改动都在 `extensions/copilot` 里。r15-1、r15-3、r15-4 在本产品默认编辑器窗口里没有触发入口；r15-2 的迁移代码会在启用了扩展的默认窗口里执行，但它的前提不会出现在本产品配置里。依据见表后的「可达性」一节。

| 编号 | 判定 | 严重度 | 说明 |
|:-----|:-----|:-------|:-----|
| r15-1 | weaken | 中→低 | 缓存属实：`abstractReplaceStringTool.tsx` 第 70 行与第 102–113 行只按路径和新旧串缓存，从不失效；`toolsService.ts` 第 97 行每个工具只建一个实例。反证：缓存只存最近一次输入，必须是同一工具紧挨着的上一次调用输入完全相同才会重放；替换工具只由 Copilot 智能体的工具循环调用，这条循环的入口在默认窗口全部关闭，只在 Agents 窗口可达。 |
| r15-2 | weaken | 中→低 | 第 51 行不等待迁移命令、第 52 行就删 secret，属实。反证：前提是 `b69754ceca5`（2026-01-15）之前的版本写下的 `copilot-byok-<名称>-api-key`，那之前 Anthropic 与 OpenAI 兼容提供方在生产代码里写它，HEAD 上已没有生产写入方；本产品数据目录 `.universe-agent-studio` 由 `3a220ab19e4`（2026-09-02）才启用，`product.json` 没有 `extensionsGallery`，本产品自己的配置里不会有这把旧 key，`getAPIKey` 读不到时迁移什么也不做。 |
| r15-3 | hold | 低 | 写路径的拒写分支被 `updateMetadataFields` 第 243–245 行的乐观写入架空，属实。属于 r14-2 落地遗漏：`dev/plans/review-2026-10-11-r14-copilot-extension-plan.md` 的不变量已要求只用批量缓存修复，该方案已标 implemented，`281589a56b1` 只修好读路径；本条只承接写路径。现有用例不覆盖这条路径，也没有测试或文档把这种覆盖定为预期。触发要直接打开或写入 Copilot CLI 会话，默认窗口里打开会话会改为聚焦 Conversation，只在 Agents 窗口可达；已是最低级，不再下调。 |
| r15-4 | hold | 低 | `runNotebookCellTool.tsx` 第 197–198 行只记遥测，`invoke` 以 `undefined` 结束；扩展宿主据此抛 `CancellationError`，回合循环按取消结束整轮，链条属实。同目录 `editNotebookTool.tsx` 第 282–289 行会重抛。只在 Agents 窗口的智能体会话里可达；已是最低级，不再下调。 |

### 可达性：`extensions/copilot` 在默认编辑器窗口

- 随产品打包：是。`product.json` 第 91 行把 `GitHub.copilot-chat` 定为默认聊天扩展，第 243–245 行把它列进 `builtInExtensionsEnabledWithAutoUpdates`。`build/lib/extensions.ts` 的通用本地扩展打包把 `copilot` 列在 `excludedExtensions`（第 319 行），另由第 472–492 行的 `packageCopilotExtensionStream` 在非 CI 本地构建里从源码编译并打进产品；`build/gulpfile.extensions.ts` 第 287–290 行的 `compile-copilot-extension-build` 调用它，`build/next/build-fast.ts` 第 21 行与第 118–119 行也编译 `extensions/copilot`。开发态窗口把它当内置扩展从 `extensions/` 加载。
- 默认窗口里是否启用：取决于配置状态。`extensionEnablementService.ts` 的 `_isDisabledBySessionsWindow`（第 668–693 行）在非 Agents 窗口直接返回 false。默认窗口里唯一会禁用内置聊天扩展的是 `ensureChatExtensionInitialDisabledState`（第 156–192 行）：每个配置首次运行时，聊天设置未完成就禁用该扩展。默认窗口不跑聊天设置（`chatSetupRunner.ts` 第 188–193 行的 `shouldRunChatSetupRunner` 只在 Agents 窗口为真），所以只在默认窗口用过的新配置里扩展是禁用的；在 Agents 窗口完成过设置、或手动启用过的配置里，它在默认窗口也会随 `onStartupFinished` 激活。`dev/plans/review-2026-11-04-p2-upstream-seams-plan.md` 第 363–367 行已有同样结论，并记下 `extensions/copilot/package.json` 给命令和菜单加了 `isSessionsWindow` 门闩。
- 扩展激活之后默认窗口能走到什么：Copilot 聊天的入口全部关闭。`chatWidgetService.ts` 第 27 行的 `canOpenChatViewOrEditor` 在默认窗口为 false，测试 `canOpenChatViewOrEditor is false in default Code window` 与 `openSession does not open ChatView or ChatEditor in default Code window` 锁住；编辑器内联聊天的 `startInlineChatWhen` 要求 `IsSessionsWindowContext`（`inlineChatActions.ts` 第 50–54 行，测试 `default Code window hides Open Inline Chat from Command Palette, editor context, Chat title bar, and Ctrl+I`）；终端内联聊天同理（`terminalChatActions.ts` 第 39 行，测试 `default Code window returns before updateInput, acceptInput, and reveal`）；笔记本单元格聊天的前置条件同样是 `IsSessionsWindowContext`（`cellChatActions.ts`、`notebook.chat.contribution.ts`）。打开会话时 `agentSessionsOpener.ts` 第 188–192 行在默认窗口改为聚焦 Conversation。`src/vs/workbench/contrib/conversation` 不引用 `IChatService` 或 `ILanguageModelToolsService`，引擎侧也不调用扩展注册的工具。产品文档写明默认路径不用 `ChatWidget` / `ChatEditor`（`dev/plans/m5-ui-shell-hardening.md` 第 40 行，`docs/systems/conversation/composer-and-inbox.md` 第 98 行）。
- 结论：扩展激活时自己跑的代码（BYOK 提供方注册和旧密钥迁移）会在启用了扩展的默认窗口里执行，所以 r15-2 的代码路径在默认窗口可达，只是它的前提（旧版 key）不会出现在本产品配置里。替换工具和笔记本运行工具的调用（r15-1、r15-4）、Copilot CLI 会话的打开与写入（r15-3）只在 Agents 窗口可达。

### r15-1

问题类：替换字符串类工具把预备好的编辑缓存在单例上且从不失效，同一工具下一次输入相同的调用会重放按旧正文算出的偏移。

不变量：

- `invoke` 发出的每个文本编辑或笔记本编辑，都按目标文件在本次调用时的正文定位：要么由本次 `invoke` 新算，要么复用本次调用自己的 `prepareInvocation` 算出的结果，并且 `applyEdit` 读的那份正文（实时文档，不是回合快照）自那以后没有变化。
- 一份预备结果最多被一次 `invoke` 使用：执行入口在自己的第一个 `await` 之前同步取走并删除条目。
- `prepareInvocation` 开头先删除同键（同一 `chatRequestId`、同一输入）的旧条目，再决定要不要新算。确认不需要时 `createEditConfirmation` 直接返回（`editFileToolUtils.tsx` 第 945–947 行），不会新算，`invoke` 只能重算，拿不到被拒调用留下的旧条目。
- 不同 `chatRequestId` 之间不共享预备结果。没有 `chatRequestId` 时不存不取，`invoke` 直接重算。
- 确认框里的 diff 来自本次 `prepareInvocation` 新算的结果。
- 缓存里以拒绝结束的预备结果不交给 `invoke`，丢弃后重算。
- 允许列表检查（`getDisallowedEditUriError`）与内容排除检查（`assertFileNotContentExcluded`）对每次调用都执行过：复用的结果来自同一次调用的 `prepareInvocation`，否则在 `invoke` 里重算。这两项检查取的是实例字段 `_promptContext`，它会被交错请求覆盖，这个问题不在本条（见「明确不改什么」和「实施前提与提交」里的缺口登记）。

要动的符号：`AbstractReplaceStringTool.lastOperation`（删除）、`AbstractReplaceStringTool.prepareEdits`（拆成确认入口和执行入口）、`AbstractReplaceStringTool.prepareInvocation`（开头删同键条目）、`AbstractReplaceStringTool.generateConfirmationDetails`、`AbstractReplaceStringTool._prepareEditsForFile` 与 `generateEdit`（把 `applyEdit` 读到的正文带回来）、`IPrepareEdit`（新增一个可选字段记这份正文）、`applyEdit`（返回值加上它读到的原文）、`ReplaceStringTool.invoke`、`MultiReplaceStringTool.invoke`。文件：`extensions/copilot/src/extension/tools/node/abstractReplaceStringTool.tsx`、`extensions/copilot/src/extension/tools/node/replaceStringTool.tsx`、`extensions/copilot/src/extension/tools/node/multiReplaceStringTool.tsx`、`extensions/copilot/src/extension/tools/node/editFileToolUtils.tsx`。

改法：

1. 删掉实例字段 `lastOperation`，改成按「`chatRequestId` 加输入键」存放的映射。输入键沿用现在的 `JSON.stringify(this.extractReplaceInputs(input))`，拼键方式照 `applyPatchTool.tsx` 第 91–93 行的 `_patchKey`。
2. `prepareInvocation` 一开始就按本次 `options.chatRequestId` 与输入删掉同键条目，然后照旧调用 `createEditConfirmation`。确认入口给 `generateConfirmationDetails`（第 602 行）用：每次都调用 `_prepareEdits` 新算；有 `chatRequestId` 时写入映射，没有时只算不存。核心在每次 `invoke` 之前都会先调 `prepareInvocation`（`languageModelToolsService.ts` 第 617 行与第 707 行，经第 1040–1065 行转给扩展宿主），而扩展宿主转来的准备选项里只有 `chatRequestId`，没有逐次调用的 id（`extHostLanguageModelTools.ts` 第 296–303 行）。先删再存，`invoke` 取到的就只会是本次调用自己的预备结果。
3. `applyEdit`（`editFileToolUtils.tsx` 第 567 行起）在返回值里加上它读到的原文（第 587 行的 `originalFile`）。`generateEdit` 把这份原文连同 `edits`、`updatedFile` 一起交回；修复分支（第 476 行再次调用 `applyEdit`）交回修复那次读到的原文。`_prepareEditsForFile` 把它存进 `IPrepareEdit` 的新字段。
4. 执行入口给两个 `invoke` 用：按 `options.chatRequestId` 和本次输入取条目，取到就先从映射删除，再等待结果。复用前逐个文件核对：记下了原文的，用与 `applyEdit` 相同的来源重新读一次（文本文件用 `workspaceService.openTextDocumentAndSnapshot(uri)`，笔记本用 `openNotebookDocumentAndSnapshot(uri, alternativeNotebookContent.getFormat(model))`，`model` 与 `doGenerateEdit` 传的是同一个），正文不同就整份重算。不能用 `openDocumentAndSnapshot` 比较：同一回合里改过的文件，它返回 `turnEditedDocuments` 里的回合快照（第 1010–1013 行），这份快照不随实时文档变化。预备时文件不存在、现在 `canExistingFileBeEdited` 为真，也整份重算；条目以拒绝结束时丢弃并重算；取不到条目时直接调用 `_prepareEdits`。多文件输入只要有一个文件要重算就整份重算，`_errorConflictingEdits` 的结论随之重来。确认之后正文变了时，重算替换的仍是同一对新旧串，找不到就按现有错误交回模型，不会把确认时的偏移用到新正文上。
5. 映射要有上界。新的 `chatRequestId` 开始写入时删掉其他请求留下的条目，或者只保留最近若干条。被淘汰的条目只会让 `invoke` 重算，不影响正确性。
6. `MultiReplaceStringTool.invoke` 会就地合并 `prepared`（第 130–158 行的 `splice` 和改写 `textEdits`）。取走即删之后这份数组只属于本次调用，合并逻辑不用改。

明确不改什么：

- `_prepareEditsForFile`、`generateEdit` 与修复（`healReplaceStringParams`）的匹配和生成逻辑，`_errorConflictingEdits`，`applyAllEdits` 的写流方式。`applyEdit` 只多交回它读到的原文，匹配结果不变。
- `IPrepareEdit.document` 仍取 `openDocumentAndSnapshot` 的回合快照，修复和 `updated` 照旧用它；`turnEditedDocuments` 的写法不变。
- `prepareInvocation` 仍经 `createEditConfirmation`；不需要确认时仍不预算，由 `invoke` 自己算。
- 实例字段 `_promptContext` 仍由 `resolveInput` 写入。它和 `dev/plans/review-2026-10-24-r15-copilot-plan.md` r15-3 修过的补丁工具是同一类问题，本条不改，提交时登记为缺口。
- `ApplyPatchTool` 不动。
- 保持通过：`replaceStringTool.spec.tsx` 的 `whitespace change everywhere`、`should fail when input filePath resolves to URI outside allowedEditUris`；`multiReplaceStringTool.spec.tsx` 的 `replaces a simple string`、`multi-sr bug`、`The multi_replace_string_in_file trashed my file due to overlapping replacements #277154`；`editFileToolUtils.spec.ts` 中 `replace_string_in_file - applyEdit` 套件的全部用例。

本地验证：

- 用例里要给 `model`，避免进修复分支：`generateEdit` 只在没有 `model` 或 family 含 `gemini-2` 时调用 `healReplaceStringParams`（第 446–448 行），那会去请求 `copilot-utility-small` 端点。`invoke` 的选项传 `model`（family 不含 `gemini-2`）；`prepareInvocation` 的选项没有 `model`，它取 `resolveInput` 上下文里的 `request.model`，所以上下文里也要给。改正文用 `util/common/test/shims/textDocument.ts` 第 30 行的 `setDocText`。
- 在 `extensions/copilot/src/extension/tools/test/node/replaceString/replaceStringTool.spec.tsx` 新增「相同输入连续两次」：同一个 `ReplaceStringTool` 实例，文档含 `foo()`，输入 `oldString: "foo()"`、`newString: "foo(bar)"`。第一次 `invoke` 后把发出的编辑应用到 `TestWorkspaceService` 里的文档，再以相同输入第二次 `invoke`。断言文档不会变成 `foo(barbar)`：第二次调用报找不到匹配，且不发出编辑。
- 同文件新增「确认被拒后同输入」：带 `forceConfirmationReason` 调 `prepareInvocation`（存下条目），不调 `invoke`，模拟用户拒绝；在 `foo()` 前插入一行；再以同一 `chatRequestId`、不带 `forceConfirmationReason` 调 `prepareInvocation`（工作区内文件不需要确认，走第 945–947 行）和 `invoke`。用覆盖 `doGenerateEdit` 的测试子类计数，断言第二次调用重新算过，编辑落在改动后的位置。
- 同文件新增「回合快照」：`resolveInput` 的上下文里放入该文件的 `turnEditedDocuments` 快照（与当前正文相同），带 `forceConfirmationReason` 调 `prepareInvocation` 之后改动实时文档，再 `invoke`。断言重新计算，编辑落在改动后的位置。再新增一条：`prepareInvocation` 之后正文没变时，`doGenerateEdit` 合计只调用一次。
- 在 `extensions/copilot/src/extension/tools/node/test/multiReplaceStringTool.spec.tsx` 新增同样的「相同输入连续两次」断言。这个 suite 在 `beforeAll` 里共享 `documents` 和工具实例，新用例用自己的文档 URI。
- 在 `editFileToolUtils.spec.ts` 的 `replace_string_in_file - applyEdit` 套件里新增断言：返回值里的原文等于调用前的文档正文。
- 在 `extensions/copilot` 下跑 `npm run test:unit -- src/extension/tools/test/node/replaceString/replaceStringTool.spec.tsx src/extension/tools/node/test/multiReplaceStringTool.spec.tsx src/extension/tools/node/test/editFileToolUtils.spec.ts`，再跑 `npm run typecheck`。仓库级门禁见「实施前提与提交」。

### r15-2

问题类：BYOK 旧密钥迁移在迁移命令结果出来之前就删掉 secret，迁移失败时 key 两头都没有，命令的拒绝也没人处理；只改成「成功后再删」又会让旧 key 和分组同时列模型，而且重名时会无限重试。

降级理由：前提是旧版扩展写下的 `copilot-byok-<名称>-api-key`。`b69754ceca5` 之前 `anthropicProvider.ts` 与 `baseOpenAICompatibleProvider.ts` 在生产代码里调用 `storeAPIKey`；HEAD 上 `storeAPIKey` 只在 `saveModelConfig` 与 `handleAPIKeyUpdate` 里出现，两者都没有生产调用方。本产品数据目录 `.universe-agent-studio` 由 `3a220ab19e4`（2026-09-02）启用，产品不接扩展市场，本产品自己的配置里不会出现这把旧 key。代码缺陷仍在，影响 Anthropic、Gemini、OpenAI、xAI、OpenRouter 这几个沿用基类迁移、拉模型列表失败会抛错的提供方（`anthropicProvider.ts` 第 89–92 行，`geminiNativeProvider.ts` 第 67–78 行，`abstractLanguageModelChatProvider.ts` 第 165–168 行）。

不变量：

- 迁移逻辑只在基类的 `configureDefaultGroupWithApiKeyOnly` 里。构造函数（第 37 行）和 `provideLanguageModelChatInformation`（第 63–65 行）仍调用这个可覆写的方法；`AbstractCustomOAIBYOKModelProvider`（`customOAIProvider.ts` 第 117–120 行，Azure 与 CustomOAI 共用）与 `CustomEndpointBYOKModelProvider`（`customEndpointProvider.ts` 第 134–137 行）的空操作覆写继续生效，它们不读旧 key、不发迁移命令、不写完成标记。
- 每个提供方名有一个 `globalState` 完成标记。迁移命令成功返回，或核心报告该 vendor 已有同名分组时，写下标记；标记在时不再读旧 key、不再发迁移命令。
- 旧 key 只在迁移命令成功、标记已写之后删除。已有同名分组时只写标记、不删旧 key（停用但保留）。其他失败不写标记、不删 key，下一次激活再试。
- 无分组的列表调用不再用旧 key 列模型，不论迁移进行中、失败还是完成。核心对每个 vendor 都先发一次无分组列表请求（`languageModels.ts` 第 1220 行），再按每个已配置分组各发一次（第 1276 行）；模型只经分组列出，旧 key 和迁移出的分组（或用户已有的同名分组）不会各列一套。
- 同一提供方实例在一次激活里最多发起一次迁移。构造函数和列表调用共用这一次，不并发发出第二条命令，也不等它结束。
- 迁移自己接住所有错误，总以 resolve 结束；构造函数里不等待的那次调用不会留下未处理的拒绝。

要动的符号：`AbstractLanguageModelChatProvider.configureDefaultGroupWithApiKeyOnly`（第 47–55 行，基类实现）；`IBYOKStorageService` 与 `BYOKStorageService` 新增完成标记的读写方法（按提供方名读写 `globalState`，键名照 `customOAIProvider.ts` 第 94 行 `copilot-byok-migration-…` 的写法）；测试里声明成 `IBYOKStorageService` 的三个存储替身补上新方法（`anthropicProvider.spec.ts` 第 75 行、`customEndpointProvider.spec.ts` 第 55 行、`geminiNativeProvider.spec.ts` 第 83 行）。构造函数第 37 行与 `provideLanguageModelChatInformation` 第 63–65 行的调用形式不变。文件：`extensions/copilot/src/extension/byok/vscode-node/abstractLanguageModelChatProvider.ts`、`extensions/copilot/src/extension/byok/vscode-node/byokStorageService.ts` 和上述三个测试文件。

改法：

1. 基类 `configureDefaultGroupWithApiKeyOnly` 改为：第一次调用时创建一个记在实例上的迁移 Promise，之后的调用复用它；创建或复用之后立即返回 `undefined`，不把旧 key 交给列表调用，也不等迁移结束。方法签名不变，覆写照旧生效。
2. 迁移 Promise 里依次：标记已在就结束；读 `getAPIKey(this._name)`，读不到就结束；`await this.configureDefaultGroupIfExists(this._name, { apiKey })`。
3. 命令成功：先写完成标记，再 `deleteAPIKey(this._name, BYOKAuthType.GlobalApiKey)`。删除失败只记日志、不重试，旧 key 已不会被任何路径使用。
4. 命令失败且错误是核心的同名报错（`languageModelsConfigurationService.ts` 第 111 行，`Language model group with name <名称> already exists for vendor <vendor>`，名称和 vendor 都是本提供方的）：写完成标记，不删旧 key，记一条 info 日志说明已有同名分组。迁移用的分组名是 `providerName`；Anthropic、xAI、OpenRouter、OpenAI 的 `providerName` 与 `package.json` 第 1743–1817 行的显示名相同，而核心新建分组的默认名就是显示名（`languageModels.ts` 第 1617 行与第 1923 行），所以这四个 vendor 上很容易重名。
5. 其他失败：记一条 error 日志（带提供方名，不带 key），不写标记、不删 key。
6. 边界：核心报错文本将来若改了，同名情况会退回「每次激活重试一次、只记日志」，不删 key，也不会多出一套模型。旧 key 本身无效（例如列模型返回 401）时同样每次激活失败一次。

明确不改什么：

- 核心 `LanguageModelsService.migrateLanguageModelsProviderGroup`（`languageModels.ts` 第 2284–2299 行）和第 111 行的同名报错。不把命令改成「同名即成功」：`AbstractCustomOAIBYOKModelProvider.migrateConfig` 用同一个分组名按 key 逐组迁移（`customOAIProvider.ts` 第 108–111 行），那样会把第二组起悄悄丢掉。它今天第二组起就失败、迁移永远完成不了，这个旧问题提交时登记为缺口。
- 同一 vendor 已有别名分组时（例如 gemini 用户自建的默认名是「Google」，迁移建的是「Gemini」），两组各列各的模型。这和今天的行为相同，本条不处理。
- `BYOKStorageService` 现有键名与 `getAPIKey`、`deleteAPIKey`；`OllamaLMProvider.migrateConfig`；`BYOKContrib._applyPolicy` 的注册条件（`isClientBYOKAllowed`）；构造函数不等待迁移，激活不被网络请求卡住。
- 保持通过：`anthropicProvider.spec.ts`、`geminiNativeProvider.spec.ts`、`openAIProvider.spec.ts`、`openRouterProvider.spec.ts`、`ollamaProvider.spec.ts`、`customEndpointProvider.spec.ts`、`azureProvider.spec.ts` 的现有用例。它们的存储替身让 `getAPIKey` 返回 `undefined`，不进迁移分支；`geminiNativeProvider.spec.ts` 里让 `getAPIKey` 返回 `bad_key` 的两条是 `it.skip`。

本地验证：

- 新增 `extensions/copilot/src/extension/byok/vscode-node/test/abstractLanguageModelChatProvider.spec.ts`。用一个实现 `getAllModels` 等抽象方法的最小测试子类；照 `inlineChatCodeActions.spec.ts` 第 54 行的写法，用 `vi.mock('vscode', async (importOriginal) => …)` 保留原有垫片，只替换 `commands.executeCommand`。
- 断言：命令成功时先写标记、再删 key，各一次。
- 断言：命令以普通错误拒绝时，不写标记、不删 key；用同一个存储替身再建一个实例，会再发一次命令；全程没有未处理的拒绝。
- 断言：命令以同名报错拒绝时，写标记、不删 key；再建实例不再发命令。
- 断言：旧 key 在、迁移还没结束时，无分组调用 `provideLanguageModelChatInformation({ silent: true }, token)` 交给 `getAllModels` 的 `apiKey` 是 `undefined`；构造加这次调用合计只发一次命令。
- 在 `customEndpointProvider.spec.ts` 新增：存储替身的 `getAPIKey` 与完成标记方法记录调用；构造 `CustomEndpointBYOKModelProvider` 并做一次无分组列表后，这些方法都没被调用，覆写生效。
- 在 `extensions/copilot` 下跑 `npm run test:unit -- src/extension/byok/vscode-node/test/abstractLanguageModelChatProvider.spec.ts src/extension/byok/vscode-node/test/customEndpointProvider.spec.ts src/extension/byok/vscode-node/test/anthropicProvider.spec.ts src/extension/byok/vscode-node/test/geminiNativeProvider.spec.ts src/extension/byok/vscode-node/test/openAIProvider.spec.ts src/extension/byok/vscode-node/test/openRouterProvider.spec.ts src/extension/byok/vscode-node/test/ollamaProvider.spec.ts src/extension/byok/vscode-node/test/azureProvider.spec.ts`，再跑 `npm run typecheck`，确认声明了类型的存储替身都补齐了新方法。仓库级门禁见「实施前提与提交」。

### r15-3

问题类：单会话元数据文件损坏、会话又没有可信的缓存记录时，经 `updateMetadataFields` 的写入仍把损坏文件换成只含本次字段的对象。

承接范围：r14-2 方案的不变量（能读到字节但解析失败时不得覆盖，只有批量缓存里已有该会话时才允许修复）已经覆盖这一点。该方案已标 implemented，`281589a56b1` 修好了读路径（`readSessionMetadataFile` 返回 `null`、`getSessionMetadata` 不写存根）；写路径第 581–585 行的拒写判断看的是 `_cache[sessionId]`，而 `updateMetadataFields` 在调用 `updateSessionMetadata` 之前已把本次字段放进 `_cache`，对所有公开写入方法都不生效。本条只承接写路径。

不变量：

- `vscode.metadata.json` 读到字节但解析失败或不是对象时，只有该会话在 `_cache` 里有可作底稿的记录，才允许用「底稿加本次字段」替换文件。可作底稿的记录只来自批量文件（`initializeStorage`、`updateGlobalStorageImpl` 与 `reloadBulkFromDisk` 采纳的磁盘条目），或本进程里成功读到（`readSessionMetadataFile`）、成功写过（`updateSessionMetadata` 写盘之后）的单会话文件。
- `updateMetadataFields` 第 243–245 行放进 `_cache` 的乐观字段不能让会话取得修复资格；同一会话并发的另一次写入留下的乐观字段也不能。会话已在底稿集合里时，修复用的 `_cache` 记录可以带着这些乐观字段。
- 拒写时不写这个文件，原字节不变；撤销本次乐观写入，`_cache`、`_sessionFolderEntry` 与 `_folderToSessions` 里不留下只来自乐观写入的记录。
- 批量文件只按底稿记录写：不在底稿集合里的会话，不用它在 `_cache` 里的值新增或替换批量条目（规则见改法第 5 步）。
- `updateSessionMetadata` 用返回值报告这次有没有写盘，不为拒写抛错；只有 `updateMetadataFields` 把拒写变成专门的错误交给调用方。`getSessionMetadata` 建存根的分支遇到拒写不抛错。公开接口 `IChatSessionMetadataStore` 的方法签名不变。
- 写入方法的不等待调用都接住拒绝，不留下未处理的拒绝。
- 标题迁移只在 `setCustomTitle` 成功之后才从全局存储删除旧标题，并且不原地修改 `globalState.get` 返回的对象；失败时全局存储的内存值和持久值都不变，照常返回旧标题，打开会话不因此失败。

要动的符号：`ChatSessionMetadataStore.updateMetadataFields`（第 234–248 行）、`updateSessionMetadata`（第 530–621 行，含损坏分支第 578–590 行和返回值）、`getSessionMetadata` 建存根的分支（第 488–491 行）、`updateGlobalStorageImpl`（第 644–678 行）、`initializeStorage`、`reloadBulkFromDisk`、`readSessionMetadataFile`、`deleteSessionMetadata`（维护底稿标记）；`CopilotCLISessionService` 里第 632 行与第 636 行的 `void` 调用；`CustomSessionTitleService.getCustomSessionTitle`（第 32–54 行，含第 45 行的 `delete entries[sessionId]`）。文件：`extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/chatSessionMetadataStoreImpl.ts`、`extensions/copilot/src/extension/chatSessions/copilotcli/node/copilotcliSessionService.ts`、`extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/customSessionTitleServiceImpl.ts`。

改法：

1. 在 `ChatSessionMetadataStore` 上加一个会话 id 集合，记下 `_cache` 里哪些会话的记录可作底稿。`initializeStorage` 清理后的批量条目、`updateGlobalStorageImpl` 与 `reloadBulkFromDisk` 采纳的磁盘条目、`readSessionMetadataFile` 读成功的会话、`updateSessionMetadata` 写盘成功之后的会话加入；`deleteSessionMetadata` 删除缓存时移除。`updateMetadataFields` 的乐观写入不加入。
2. `updateSessionMetadata` 改为返回写入状态。写盘成功为「已写」。损坏且不在底稿集合里为「拒写」：记 error 日志，不调用 `replaceMetadataFile`。现有两条不写盘就返回的路径（第 558–561 行读失败但不是文件不存在，第 566–573 行目录不存在且不建目录）为「未写」，行为照旧。损坏且在底稿集合里时沿用现有修复：缓存记录去掉 `writtenToDisc` 作底稿，`diskFileExisted = true`。写盘本身抛错照旧向上抛。
3. `updateMetadataFields` 按状态处理。「已写」照旧调用 `updateGlobalStorage`。「拒写」时删除 `_cache[sessionId]`，用 `_updateFolderIndex(sessionId, undefined)` 清掉索引，不调用 `updateGlobalStorage`，再以专门的错误拒绝；会话在底稿集合里时第 2 步不会拒写，所以这里不会误删可信记录。「未写」照旧，不抛错。
4. `getSessionMetadata` 建存根的分支（第 488–491 行）遇到「拒写」时，删掉第 488 行放进去的 `{}` 占位，让下一次读取回到磁盘；不调用 `updateGlobalStorage`，返回 `undefined`，不抛错。读的时候文件还不存在、写之前另一个进程留下了半截文件，就会走到这里。
5. 刷盘时跳过：在 `updateGlobalStorageImpl` 里，对 `_cache` 中不在底稿集合里的会话 S：
   - 不用 `_cache[S]` 新增批量条目，也不用它替换磁盘上已有的 S 条目。
   - 磁盘上有 S 条目时把它原样写回，不覆盖 `_cache[S]` 的乐观值，也不因此把 S 记成底稿。
   - 磁盘上没有 S 条目时，写出的文件里没有 S。
   - 被删除的会话以删除墓碑为准（`dev/plans/review-2026-10-30-r15-copilot-plan.md` r15-1）：既不从 `_cache` 写出，也不把磁盘条目写回或采纳。
   - `_cache` 里没有的会话照旧采纳磁盘条目（第 656–661 行）并记成底稿；底稿会话照旧按 `modified` 比较（第 662–668 行）。

   S 的乐观值等它自己的单会话写入结束再处理：成功时进底稿，由 `updateMetadataFields` 末尾的 `updateGlobalStorage` 刷进去；拒写时按第 3 步回滚。这样排队写入期间别的会话触发的刷盘，不会把乐观字段写进批量文件、让下次启动的 `initializeStorage` 把它当成底稿。只来自占位的 `{}` 记录（`getSessionMetadata` 对不存在、又不建存根的文件缓存的空记录）同样不在底稿集合里，不再写进批量文件；今天写进去的 `{}` 条目下次启动也会被 `initializeStorage`（第 190–193 行）丢掉，结果一样。这条规则也改变了「未写」路径在批量文件里的效果：新会话的单会话文件读失败又不是文件不存在时（第 558–561 行），`updateMetadataFields` 照旧调用 `updateGlobalStorage`，但会话不在底稿集合里，本次乐观字段不再刷进批量文件，只留在本进程的 `_cache` 里，重启后不再出现。第 566–573 行目录不存在且不建目录的路径只在 `createDirectoryIfNotFound` 为 false 时走到，两个调用方都用默认值 true，今天走不到。
6. `copilotcliSessionService.ts` 第 632 行的 `setSessionOrigin` 和第 636 行的 `setSessionParentId` 两处 `void` 调用补 `.catch`，记日志。新会话的文件还不存在，走不到拒写；这两处今天在写盘失败时就会留下未处理的拒绝。
7. 标题迁移（`customSessionTitleServiceImpl.ts`）：`ExtensionMemento.get` 返回的是内部值本身（`extHostMemento.ts` 第 70–76 行），第 45 行的 `delete entries[sessionId]` 在调用 `update` 之前就改掉了内存值。改为：读到旧标题后不改这个对象；先 `await setCustomTitle`；成功后重新 `get` 一次当前值，复制一份，在副本上删掉该会话，再 `update`（副本为空时写 `undefined`）。重新读当前值是为了不覆盖另一次并发迁移刚做的删除。`setCustomTitle` 拒绝（拒写或写失败）时不碰全局存储，记日志，返回旧标题。现在第 48–51 行用 `Promise.all` 同时做两件事；拒写之后会让 `provideChatSessionContentForExistingSession`（`copilotCLIChatSessionsContribution.ts` 第 744 行）的 `Promise.all` 整体失败，会话打不开。
8. 其他调用方不改。归档的两处（`chatSessions.ts` 第 259–263 行、`copilotCLIChatSessions.ts` 第 261–265 行）已有 `try/catch`；`copilotCLIChatSessions.ts` 第 195–205 行的标题链与 `copilotcliSessionService.ts` 第 1149 行已有 `.catch`；其余 `await` 调用今天已经要面对 `replaceMetadataFile` 写失败的拒绝，拒写只是多一种原因。

明确不改什么：

- 文件不存在时创建 `{ origin: 'other' }` 存根的路径，以及读失败（不是文件不存在）时不写存根的路径；`updateSessionMetadata` 两条「未写」路径本身的行为（它们在批量文件里的效果见第 5 步末尾）。
- 解析成功时的合并顺序（缓存、磁盘、本次字段）和 `replaceMetadataFile` 的临时文件加改名。
- `MAX_BULK_STORAGE_ENTRIES` 裁剪、`initializeStorage` 丢弃无位置信息条目的规则，以及 10-30 r15-1 要改的 `deleteSessionMetadata` 批量读改写（由 `dev/plans/review-2026-10-30-r15-copilot-plan.md` 承接）。
- 列表路径的外部会话过滤（`isExternalSession`、`shouldShowSession`）。损坏且不在缓存里的会话在列表里本来就被隐藏，列表刷新不会触发这条写入。
- 保持通过：`should leave corrupt per-session metadata bytes unchanged`、`should repair corrupt per-session metadata from cache when the session is updated`、`should not create a stub when per-session metadata read fails for a reason other than not found`、`should write empty metadata file when per-session file read fails`、`writes only the requested partial fields; other fields written by external process are preserved`，以及 `debounced bulk storage updates`、`updateGlobalStorageImpl - merge behavior` 两组用例（它们的会话都经成功写盘或来自批量文件，都算底稿）。

本地验证：

- 在 `extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/test/chatSessionMetadataStoreImpl.spec.ts` 的 `getSessionMetadata - cache behavior` 里新增：批量文件为 `{}`，某会话的单会话文件是含 `worktreeProperties.worktreePath` 与 `lastCheckpointRef` 的截断 JSON。调用 `setCustomTitle`，断言它以拒写错误结束，文件字节不变，没有对该路径的 `writeFile` 或 `rename`；推进定时器 1.1 秒后批量文件里没有这个会话；`getCustomTitle` 返回 `undefined`。
- 同样前提下并发调用 `setCustomTitle` 与 `setSessionArchived`：两次都以拒写错误结束，文件字节不变。
- 会话先经 `getWorktreeProperties` 成功读到合法文件，随后文件被改成非法 JSON，再调用 `storeWorktreeInfo`：允许修复，写出的文件保留原 `workspaceFolder`，`worktreeProperties` 是新值。
- 存根分支：第一次读该会话文件报文件不存在、之后读到截断 JSON 时，`getWorktreeProperties` 正常返回 `undefined`、不抛错；该文件字节不变；再调用一次 `getWorktreeProperties` 会重新读盘。
- 刷盘跳过一：会话 P 拒写之后，会话 Q 正常写入并触发刷盘；推进定时器后批量文件里有 Q、没有 P。
- 刷盘跳过二：让 P 的单会话写入停在改名之前（用受控 Promise 拦住 `rename`），这期间往批量文件里放一条 P 的条目，再让 Q 写入触发刷盘。断言刷盘后批量文件里的 P 条目与放进去的完全相同，`getCustomTitle(P)` 仍返回乐观写入的标题；放开 P 的写入后，下一次刷盘写出 P 合并后的记录。
- 10-30 r15-1 的删除墓碑落地后补一条：被删会话在刷盘时不会从磁盘写回。
- 标题迁移：新增 `extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/test/customSessionTitleServiceImpl.spec.ts`。照 `chatSessionMetadataStoreImpl.spec.ts` 第 40–70 行写一个 `get` 返回同一对象引用的 `MockGlobalState`，元数据存储用替身。断言：`setCustomTitle` 拒绝时返回旧标题，事先放进去的那个对象里仍有该会话，`update` 没被调用；`setCustomTitle` 成功时该会话从全局存储删掉，且删除发生在写入成功之后；两个会话的迁移都成功后，两条旧标题都被删掉。
- 在 `extensions/copilot/src/extension/chatSessions/copilotcli/node/test/copilotCliSessionService.spec.ts` 新增：让 `MockChatSessionMetadataStore`（`chatSessions/common/test/mockChatSessionMetadataStore.ts`）的 `setSessionOrigin` 拒绝，`createSession` 仍正常返回，错误进了日志，没有未处理的拒绝。
- 在 `extensions/copilot` 下跑 `npm run test:unit -- src/extension/chatSessions/copilotcli/vscode-node/test/chatSessionMetadataStoreImpl.spec.ts src/extension/chatSessions/copilotcli/vscode-node/test/customSessionTitleServiceImpl.spec.ts src/extension/chatSessions/copilotcli/node/test/copilotCliSessionService.spec.ts`，再跑 `npm run typecheck`。仓库级门禁见「实施前提与提交」。

### r15-4

问题类：笔记本运行单元格工具把确认之后的所有异常吞成空结果，扩展宿主把空结果当成用户取消，整轮请求随之结束。

不变量：

- `RunNotebookCellTool.invoke` 不以 `undefined` 结束：要么返回结果，要么抛错。
- 真正的取消（`isCancellationError(error)` 为真）仍按取消结束，模型看到的结果与现在一致。
- 其他错误交回模型：重抛原错误，由 `toolCallErrorToResult` 写成 `ERROR while calling tool: …`，不标 `isCancelled`。`getNotebookAndCell`（第 229–245 行）给出的「Notebook … not found.」「Cell … not found in the notebook, use the read_file …」原文出现在模型看到的结果里。
- 遥测照旧记录结果，并在 `finally` 里发送。

要动的符号：`RunNotebookCellTool.invoke` 的 `catch`（第 197–198 行）。文件：`extensions/copilot/src/extension/tools/node/runNotebookCellTool.tsx`。

改法：

1. `catch` 里先区分取消：`isCancellationError(error)` 为真时记 `telemetryEvent.skipped('canceled')`，与第 122–125 行令牌取消分支的口径一致；其他错误照现在记 `telemetryEvent.failed(error.message || 'exceptionThrown')`。
2. 记完后重抛原错误，与 `editNotebookTool.tsx` 第 282–289 行一致。不改成返回带错误文本的结果，免得两个笔记本工具的错误约定分叉。
3. `finally` 里的 `telemetryEvent.send` 不变。

明确不改什么：

- `prepareInvocation` 和确认文案；第 122–125 行令牌已取消时返回空 `LanguageModelToolResult` 的分支；markdown 单元格、空单元格的跳过结果；`raceTimeout` 三秒后的「did not finish executing」提示；安装 Jupyter 扩展那段自己的空 `catch`（第 116–118 行）。
- 核心 `extHostLanguageModelTools.ts` 第 236–239 行对空结果抛 `CancellationError` 的约定，`toolCallErrorToResult`（`toolCalling.tsx` 第 665–672 行）和回合循环第 2380–2382 行的取消处理。
- `editNotebookTool.tsx` 不动，保持 `editNotebookTool.spec.tsx` 现有用例通过。

本地验证：

- 新增 `extensions/copilot/src/extension/tools/node/test/runNotebookCellTool.spec.tsx`，照 `editNotebookTool.spec.tsx` 用 `ExtHostNotebookDocumentData.fromNotebookData` 和 `TestWorkspaceService` 搭笔记本，`INotebookService` 用替身。
- Jupyter 分支要打桩：笔记本是 Jupyter 文档且含 Python 单元格、又查不到 `ms-toolsai.jupyter` 时，`invoke` 会先经 `IToolsService.invokeTool` 调安装扩展工具（第 107–119 行）。断言二和断言三要让 `IExtensionsService.getExtension` 对这个 id 返回一个对象，或者改用非 Python 单元格，不进这条分支；断言一在 `getNotebookAndCell` 就抛错，到不了这里。
- 断言一：用笔记本里不存在的 `cellId` 调 `invoke`（模拟确认期间单元格被删），`invoke` 以错误拒绝，错误文本含 `not found in the notebook`，不以 `undefined` 结束。
- 断言二：`ensureKernelSelected` 或 `runCells` 的替身以普通错误拒绝时，`invoke` 以同一错误拒绝。
- 断言三：替身抛 `CancellationError` 时，`invoke` 以取消错误结束（`isCancellationError` 为真）。
- 在 `extensions/copilot` 下跑 `npm run test:unit -- src/extension/tools/node/test/runNotebookCellTool.spec.tsx src/extension/tools/node/test/editNotebookTool.spec.tsx`，再跑 `npm run typecheck`。仓库级门禁见「实施前提与提交」。

## 实施前提与提交

1. 本稿签收之后才实施。本轮只改稿，状态保持草案。
2. r15-3 第 5 步和 `dev/plans/review-2026-10-30-r15-copilot-plan.md` r15-1（删除墓碑）都改 `updateGlobalStorageImpl`。先落地的一方照常实施；后落地的一方把删除墓碑放在本条「刷盘时跳过」规则之前判断。两条若在同一个提交里实施，一起写一起测。
3. 提交本方案时，在 `dev/plans/INDEX.md` 里与 `review-2026-10-30-r15-copilot-plan.md` 同一张十六路审查表中登记一行：标题、`draft`、一句话摘要。发现稿 `dev/plans/review-2026-11-07-r15-copilot.md` 那时若仍未登记，同批登记。
4. 提交本方案时，在 `dev/progress/deferred-gaps.md` 按该表格式登记本方案不处理的三处同类问题，编号按该文件规则取：
   - `AbstractReplaceStringTool._promptContext` 仍是单例字段，交错请求会互相覆盖允许列表和响应流，与 `dev/plans/review-2026-10-24-r15-copilot-plan.md` r15-3 修过的补丁工具同类。
   - `AbstractCustomOAIBYOKModelProvider.migrateConfig`（`customOAIProvider.ts` 第 92–115 行，Azure 与 CustomOAI 共用）用同一个分组名迁移多把 key，第二把起被核心以同名拒绝，完成标记永远写不上，每次激活都重试。
   - `OllamaLMProvider` 构造函数第 68 行不等待也不接 `migrateConfig` 的拒绝，迁移失败会留下未处理的拒绝。
5. 本地门禁：`extensions/copilot` 下按各条列出的文件跑 `npm run test:unit -- <文件>`，再跑 `npm run typecheck`。仓库级跑 `npm run compile`（并行跑 `compile-client` 与 `compile-copilot`，后者只用 esbuild、不做类型检查，类型以 `npm run typecheck` 为准）、`npm run eslint`、`python3 scripts/check-docs-health.py`、`python3 scripts/wiki/wiki.py check --root .`。

## 审查

2026-11-07 只读审查的结论是须改稿，r15-4 可按稿实施；没有 Critical，判定与严重度都不变。Important 六条都核实属实，已改：I1，r15-1 复用前改为和 `applyEdit` 读的实时文档比较（`openDocumentAndSnapshot` 对同一回合改过的文件返回回合快照，`editFileToolUtils.tsx` 第 1010–1013 行），`applyEdit` 交回它读到的原文；`prepareInvocation` 开头先删同键条目，确认不需要时（第 945–947 行）被拒调用留下的旧条目不会再被取用；补了「确认被拒后同输入」「回合快照」两条用例。I2，迁移逻辑留在可覆写的 `configureDefaultGroupWithApiKeyOnly` 基类实现里，构造函数和列表调用仍调用它，`customOAIProvider.ts` 第 117–120 行与 `customEndpointProvider.ts` 第 134–137 行的空操作覆写继续生效；本地验证加上 `customEndpointProvider.spec.ts` 和「覆写后不读旧 key」的用例。I3，迁移命令成功或核心报告同名分组已存在时写 `globalState` 完成标记，标记在时不再迁移；同名时只停用、不删 key；无分组列表不再用旧 key，旧 key 与分组不会各列一套模型；写明了 `package.json` 第 1743–1817 行四个 vendor 的显示名与迁移分组名相同、核心默认用显示名建分组，所以重名常见。没有采用「把核心命令改成同名即成功」，因为 `customOAIProvider.ts` 第 108–111 行用同一个分组名逐组迁移多把 key，那样会把第二组起悄悄丢掉。I4，标题迁移不再原地删 `globalState.get` 返回的对象（`extHostMemento.ts` 第 70–76 行返回内部值本身），改为写成功后重新读、复制、删除、`update`，并用 `get` 返回同一引用的 `MockGlobalState` 测。I5，「刷盘时跳过」写成五条规则：不新增、不替换批量条目，磁盘有条目时原样写回且不动 `_cache`，删除墓碑优先，并补了两条刷盘用例和一条待墓碑落地后的用例。I6，`updateSessionMetadata` 改为返回写入状态，只有 `updateMetadataFields` 把拒写变成错误，`getSessionMetadata` 建存根的分支（第 488–491 行）拒写时不抛错；`copilotcliSessionService.ts` 第 632 行与第 636 行的 `void` 调用补 `.catch`，并补了对应用例。Minor 都已处理：摘要与可达性的措辞把 r15-2 和另外三条分开写；r15-1 的不变量 6 改写，并写明 `_promptContext` 的限制；缺口改成「实施前提与提交」里的登记项；r15-1 用例给 `model`，不进修复分支；mock 示例改引 `inlineChatCodeActions.spec.ts` 第 54 行；「不变量 2 的措辞」转述只剩关键词，按 r15-1 与 r15-2 的不变量 2 理解，两处都已改写；r15-4 用例给 Jupyter 分支打桩；各条本地验证都加上了 `npm run typecheck`。另按共性意见改了三处：「覆盖需求」写明不对应现行需求的理由，本地验证只写本地入口，实施步骤写明提交时登记 `dev/plans/INDEX.md`。

## 实施记录（2026-11-07）

用户同意实施并要求不编译。四条都已落到代码里，代码改动都在 `extensions/copilot` 下。本路没有改 `dev/plans/INDEX.md`、`dev/progress/deferred-gaps.md` 等共享登记表。工作区里 `dev/plans/INDEX.md` 第 422–423 行已有发现稿与本方案的 `draft` 登记，是另一会话加的、尚未提交，「实施前提与提交」第 3 步的登记已经在了；状态变化时的同步和第 4 步交给父 agent。

### r15-1（已实施）

- 生产代码：`extensions/copilot/src/extension/tools/node/abstractReplaceStringTool.tsx`（删掉 `lastOperation`；新增按「`chatRequestId` 加输入」存放的 `_preparedEdits`、模块函数 `preparedEditsKey`、`_prepareEditsForConfirmation`、`_reusePreparedEdits`、`_isPreparedEditCurrent`；`IPrepareEdit` 新增 `sourceText`；`generateEdit` 与 `_prepareEditsForFile` 带回 `applyEdit` 读到的原文；`prepareInvocation` 开头删除同键条目）；`extensions/copilot/src/extension/tools/node/editFileToolUtils.tsx`（`applyEdit` 两处返回都加上 `originalFile`）。
- 测试：`extensions/copilot/src/extension/tools/test/node/replaceString/replaceStringTool.spec.tsx` 新增「ReplaceString Tool - prepared edits」一组四条（相同输入连续两次、确认被拒后同输入、回合快照、正文未变时复用）；`extensions/copilot/src/extension/tools/node/test/multiReplaceStringTool.spec.tsx` 新增「MultiReplaceString - prepared edits」一组一条（相同输入连续两次）；`extensions/copilot/src/extension/tools/node/test/editFileToolUtils.spec.ts` 新增 `returns the text it read`。
- 与方案的出入：`prepareEdits` 保留原名，直接改成执行入口，确认入口另起私有方法 `_prepareEditsForConfirmation`，所以 `ReplaceStringTool.invoke`、`MultiReplaceStringTool.invoke` 不用改。预备时没读到正文的条目（文件不存在或不在允许列表）在文件现已存在时整份重算，不在允许列表的情况重算后得到同样的错误；预备时就失败、带 `document` 的条目沿用预备结果，与确认框一致。映射上界取「新的 `chatRequestId` 写入时清掉其他请求的条目」。两份 spec 的新组都给 `IEndpointProvider` 换了桩，并在上下文里放 family 为 `test-family` 的 `model`：第二次调用找不到匹配时直接报错，不进修复分支，也不去取测试端点。

### r15-2（已实施）

- 生产代码：`extensions/copilot/src/extension/byok/vscode-node/abstractLanguageModelChatProvider.ts`（`configureDefaultGroupWithApiKeyOnly` 基类实现改为每个实例只启动一次 `_migrateLegacyApiKey`，并且总返回 `undefined`；命令成功先写标记再删 key；`_isExistingGroupError` 识别核心的同名报错，命中时只写标记不删 key；其他失败记 error 日志、保留 key）；`extensions/copilot/src/extension/byok/vscode-node/byokStorageService.ts`（`IBYOKStorageService` 与 `BYOKStorageService` 新增 `isLegacyApiKeyMigrated`、`markLegacyApiKeyMigrated`，`globalState` 键为 `copilot-byok-migration-<提供方名>-apiKey`）。
- 测试：新增 `extensions/copilot/src/extension/byok/vscode-node/test/abstractLanguageModelChatProvider.spec.ts`（成功、普通失败、同名、无分组列表不用旧 key 且只迁移一次、没有旧 key 时不碰标记，共五条）；`customEndpointProvider.spec.ts` 新增「覆写后不读旧 key」；`anthropicProvider.spec.ts`、`customEndpointProvider.spec.ts`、`geminiNativeProvider.spec.ts` 的存储替身补上两个新方法。
- 与方案的出入：迁移里先读旧 key、再看标记（方案写的是先看标记）。结果相同；没有旧 key 时不读 `globalState`，只实现了 `getAPIKey` 的旧测试替身也不会碰到新方法。新测试没有按方案用 `vi.mock('vscode', …)`：替换 `vscode` 模块后，提供方的导入链要读垫片里没有的 `ChatHookType`，vitest 对被 mock 的模块会直接报缺少导出；改为在测试子类里覆写受保护的 `configureDefaultGroupIfExists`，让它调用测试替身。真正调用 `commands.executeCommand` 的那一行没有被这个单元测试覆盖。

### r15-3（部分实施）

- 生产代码：`extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/chatSessionMetadataStoreImpl.ts`（新增底稿集合 `_diskBackedSessions`，在 `initializeStorage`、`readSessionMetadataFile`、写盘成功后、`updateGlobalStorageImpl` 与 `reloadBulkFromDisk` 采纳磁盘条目时加入，`deleteSessionMetadata` 时移除；`updateSessionMetadata` 返回 `MetadataWriteResult`，损坏分支只认底稿集合；`updateMetadataFields` 拒写时回滚乐观值并抛导出的 `CorruptSessionMetadataError`；`getSessionMetadata` 建存根的分支拒写时删掉占位、不抛错；刷盘只写底稿记录，磁盘已有条目时原样写回且不动 `_cache`）；`extensions/copilot/src/extension/chatSessions/copilotcli/node/copilotcliSessionService.ts`（第 632 行与第 636 行两处 `void` 调用改为 `.catch` 记 warn，写法照同文件第 1149 行）；`extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/customSessionTitleServiceImpl.ts`（先写元数据，成功后重新读、复制、删除、`update`；失败时保留旧标题并返回它；删除旧条目的 `update` 失败时记 warn，照常返回标题）；`extensions/copilot/src/extension/chatSessions/vscode-node/copilotCLIChatSessionsContribution.ts` 第 1964、1969、2129、2132 行与 `extensions/copilot/src/extension/chatSessions/vscode-node/sessionRequestLifecycle.ts` 第 75、79 行的 `setWorktreeProperties`、`trackSessionWorkspaceFolder` 不等待调用补 `.catch` 记 error，写法照同文件已有的 `.catch`。
- 测试：`chatSessionMetadataStoreImpl.spec.ts` 在 `getSessionMetadata - cache behavior` 里新增六条（拒写、并发拒写、按本进程读到的记录修复、存根分支竞态、拒写会话不进批量文件、写入挂起时原样写回磁盘条目）；新增 `extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/test/customSessionTitleServiceImpl.spec.ts`（四条，含删除旧条目失败时照常返回标题）；`copilotCliSessionService.spec.ts` 在 `CopilotCLISessionService.createSession` 里新增一条；`extensions/copilot/src/extension/chatSessions/vscode-node/test/copilotCLIChatSessionParticipant.spec.ts` 在 `CopilotCLIChatSessionParticipant.handleRequest` 里新增一条（现有非隔离会话的 `trackSessionWorkspaceFolder` 以 `CorruptSessionMetadataError` 拒绝时，请求照常进行，拒绝被记进 error 日志）。
- 没做的部分：刷盘规则里「删除墓碑优先」及对应用例没有做。工作区里 10-30 r15-1 的删除墓碑还没落地，`chatSessionMetadataStoreImpl.ts` 里没有墓碑。按「实施前提与提交」第 2 步，10-30 r15-1 落地时要把墓碑判断放在本条刷盘规则之前，并补上「被删会话在刷盘时不会从磁盘写回」的用例。
- 与方案的出入：损坏分支在「在底稿集合里」之外保留了原有的「记录里有 `writtenToDisc` 以外的键」条件，更保守。只来自占位的 `{}` 记录不再写进批量文件，下次启动的结果和今天相同。改法第 8 步说「其他调用方不改」，漏了上面 `copilotCLIChatSessionsContribution.ts` 与 `sessionRequestLifecycle.ts` 的六处不等待调用：现有非隔离会话每次请求都会走第 1969 行，单会话文件损坏、又不在底稿集合里时，拒写会变成未处理的拒绝。代码审查后补了 `.catch`；没有改到服务内部去接，`await` 这两个方法的调用方仍能拿到拒绝。

### r15-4（已实施）

- 生产代码：`extensions/copilot/src/extension/tools/node/runNotebookCellTool.tsx`（`catch` 里取消错误记 `skipped('canceled')`，其他错误照旧记失败，然后都重抛）。
- 测试：新增 `extensions/copilot/src/extension/tools/node/test/runNotebookCellTool.spec.tsx`（单元格已删、选内核失败、执行命令失败、取消，共四条）。
- 与方案的出入：新测试不经 `createExtensionUnitTestingServices()`，只给失败路径用得到的桩。经它取到的测试端点提供方会去读 SQLite 测试缓存，每条用例都会带出一个未处理错误；Jupyter 分支按方案用 `IExtensionsService.getExtension` 的桩跳过。

### 验证

- 未编译：没有跑 `npm run compile`、`npm run typecheck`、eslint 和 docs-health，类型靠逐个回读改过的文件把关。
- 在 `extensions/copilot` 下用 `./node_modules/.bin/vitest --run --pool=forks <文件>` 只跑了涉及的 spec：
  - r15-4：`runNotebookCellTool.spec.tsx` 4 条通过；`editNotebookTool.spec.tsx` 13 条通过，但伴随既有的 SQLite 未处理错误。
  - r15-1：`replaceStringTool.spec.tsx`、`multiReplaceStringTool.spec.tsx`、`editFileToolUtils.spec.ts` 共 123 条，122 条通过。失败的 `The multi_replace_string_in_file trashed my file due to overlapping replacements #277154` 报的是测试端点提供方打不开 SQLite 缓存（见下一条），出在渲染结果的 `toolResultToString`；这条用例不传 `chatRequestId`，走不到新的预备结果映射。没有在改动前的代码上单独跑过它。
  - r15-2：八个 BYOK spec 共 66 条通过、3 条原本就跳过。
  - r15-3：`chatSessionMetadataStoreImpl.spec.ts`、`customSessionTitleServiceImpl.spec.ts`、`copilotCliSessionService.spec.ts` 共 140 条通过、1 条原本就跳过。
  - 代码审查后重跑：`multiReplaceStringTool.spec.tsx` 4 条中 3 条通过，失败的仍是 #277154，新组单独跑通过、没有未处理错误。`copilotCLIChatSessionParticipant.spec.ts` 67 条通过，伴随 37 个 `file is not a database` 未处理错误；去掉新用例再跑也是 37 个，新用例单独跑没有未处理错误，临时去掉第 1969 行的 `.catch` 时新用例失败。失败出在 error 日志断言上：`@vitest/spy` 会给 `vi.fn` 返回的 Promise 挂上处理器，去掉 `.catch` 时 vitest 也报不出未处理的拒绝，所以这条用例靠日志断言判断拒绝有没有被接住。`sessionRequestLifecycle.spec.ts` 18 条、`copilotCLIChatSessions.spec.ts` 13 条、`customSessionTitleServiceImpl.spec.ts` 4 条通过。
- 既有的环境问题：`extensions/copilot/test/simulation/cache/base.sqlite` 是 133 字节的 Git LFS 指针（`git check-attr filter` 为 `lfs`），测试端点提供方打开它时报 `file is not a database`。#277154 因此失败，经测试服务取端点的用例也会带出未处理错误，与本次改动无关。
- 之后要跑的本地验证：在 `extensions/copilot` 下跑 `npm run test:unit -- src/extension/tools/test/node/replaceString/replaceStringTool.spec.tsx src/extension/tools/node/test/multiReplaceStringTool.spec.tsx src/extension/tools/node/test/editFileToolUtils.spec.ts src/extension/tools/node/test/runNotebookCellTool.spec.tsx src/extension/tools/node/test/editNotebookTool.spec.tsx src/extension/byok/vscode-node/test/abstractLanguageModelChatProvider.spec.ts src/extension/byok/vscode-node/test/customEndpointProvider.spec.ts src/extension/byok/vscode-node/test/anthropicProvider.spec.ts src/extension/byok/vscode-node/test/geminiNativeProvider.spec.ts src/extension/byok/vscode-node/test/openAIProvider.spec.ts src/extension/byok/vscode-node/test/openRouterProvider.spec.ts src/extension/byok/vscode-node/test/ollamaProvider.spec.ts src/extension/byok/vscode-node/test/azureProvider.spec.ts src/extension/chatSessions/copilotcli/vscode-node/test/chatSessionMetadataStoreImpl.spec.ts src/extension/chatSessions/copilotcli/vscode-node/test/customSessionTitleServiceImpl.spec.ts src/extension/chatSessions/copilotcli/node/test/copilotCliSessionService.spec.ts src/extension/chatSessions/vscode-node/test/copilotCLIChatSessionParticipant.spec.ts src/extension/chatSessions/vscode-node/test/sessionRequestLifecycle.spec.ts src/extension/chatSessions/vscode-node/test/copilotCLIChatSessions.spec.ts`，再跑 `npm run typecheck`；仓库级跑 `npm run compile`、`npm run eslint`、`python3 scripts/check-docs-health.py`、`python3 scripts/wiki/wiki.py check --root .`。

### 代码审查（2026-11-07）

只读代码审查的结论是须修改，两条 Important、四条 Minor 核实后都属实，处理如下：

- Important，不等待调用没接拒写：`copilotCLIChatSessionsContribution.ts` 第 1964、1969、2129、2132 行与 `sessionRequestLifecycle.ts` 第 75、79 行都补了 `.catch` 记 error，并在 `copilotCLIChatSessionParticipant.spec.ts` 补了「现有非隔离会话元数据损坏时跑一次请求」的用例。
- Important，multiReplace 新用例经修复分支依赖测试端点：已挪到单独的「MultiReplaceString - prepared edits」组，照 `replaceStringTool.spec.tsx` 换掉 `IEndpointProvider` 并放入 family 为 `test-family` 的 `request.model`，共享组的文档列表还原。
- Minor，「未写」路径的刷盘效果：已在 r15-3 改法第 5 步末尾写明新会话的乐观字段不再刷进批量文件，「明确不改什么」改为指向那里。
- Minor，r15-3 不变量第 2 条：已改成「乐观字段不能让会话取得修复资格」，并写明会话已有底稿时修复记录可以带着乐观字段。
- Minor，标题迁移的 `globalState.update` 失败：已接住并记 warn，照常返回标题，`customSessionTitleServiceImpl.spec.ts` 补了一条用例。
- Minor，`dev/plans/INDEX.md` 的说法：实施记录开头已改为写明第 422–423 行的登记是另一会话加的、尚未提交。

### D1421 后续：Ollama 迁移后的旧配置清理恢复（2026-11-11）

状态：执行中。负责：agent:branch_sync_audit。恢复方案经 agent:engine_next_step 独立只读审查为 C0/I0；待主任务单独提交方案后实施，生产逻辑尚未实施。

问题：`OllamaLMProvider.migrateConfig` 先创建新分组，再清理旧 `OllamaEndpoint`。第一步已成功、第二步临时失败后，下次激活会再次创建同名分组，因冲突提前退出，永远到不了清理步骤。`51cd33c08ff` 已接住并记录拒绝，但没有解决恢复。新组已经可用，此条不改变默认窗口产品入口。

边界与已有 API：

- 扩展侧迁移命令 `lm.migrateLanguageModelsProviderGroup` 返回 `void`；没有可读取完整分组身份与配置的扩展 API。不能把同名错误当成本迁移成功，更不能重写同名组来完成清理。
- 只有本实例调用迁移命令成功返回，才能记录私有 `globalState` 清理检查点。独立版本键为 `copilot-byok-migration-Ollama-endpoint-cleanup-v1`，不调用 `setKeysForSync`。检查点固定保存 `{ schemaVersion: 1, provider: 'ollama', group: 'Ollama', id: <随机认领ID>, sourceURI: <来源身份>, target: ConfigTarget, url: rawURL }`；所有字段逐项校验，`target` 仅接受 Global / Workspace / WorkspaceFolder，`url` 是原作用域的非空原始字符串，不按 trim 后的有效值认领。`globalState.get` 返回值仅作只读校验，复制成独立值使用，不改内部对象引用。不保存 key，不把新组当前配置当作旧源重新写入。
- `IConfigurationService.inspectConfig` 能区分 global/workspace/folder；无 target 的 `setConfig(key, undefined)` 会清除所有作用域，不能用于只迁移了一个有效 endpoint 的恢复。清理必须显式限定原作用域，并重读该作用域原值。
- `globalState` 属于 `StorageScope.PROFILE`，跨 workspace 共享；仅匹配 target 和 URL 不足以证明来源。Global 的 `sourceURI` 固定为 `profile-local`（依靠不跨 profile、不 sync 的存储边界）；Workspace 用 `workspace.workspaceFile` URI，单文件夹窗口则用唯一 folder URI；WorkspaceFolder 用实际配置 folder URI。当前无资源上下文且多根窗口无法唯一定位 folder 时不迁移、不清理，保留源并记日志。

拟定改法：

1. Ollama 使用现有 DI 注入 `IVSCodeExtensionContext`。新迁移从 `inspectConfig(OllamaEndpoint)` 按 WorkspaceFolder / Workspace / Global 优先序选择一个显式配置的来源，固定该 `sourceURI`、`target` 与非空 `rawURL`；不只取 `getConfig` 的有效值。没有可信检查点时仍执行真实迁移命令；成功后先持久化完整检查点，再尝试清理原旧设置。命令失败、同名冲突、检查点写入失败，都保留旧设置并由已有外层 handler 记日志。
2. 下次激活先处理可信检查点，只有当前来源 `sourceURI` 相同且 `inspectConfig` 中该 `target` 的原始值严格等于检查点 `url`，才跳过创建、仅重试 `setConfig(OllamaEndpoint, undefined, target)`；不查名称猜归属，不调用会清所有作用域的无 target 写法。异 workspace 或来源不明时保留检查点与新旧设置并结束，不清、不覆盖其他窗口记录。同一来源已删除就仅清检查点；来源已改为其他值则保留新值并结束本次恢复，不顺着有效配置回退认领其他作用域。用户对已迁移分组的修改、重命名或删除不触发重建。
3. 检查点写入后、发出清理前重新计算原 target 对应的 `sourceURI`，并通过 `inspectConfig` 重读该作用域的原始值；来源身份或 rawURL 已变化就保留用户新值、不发清理、不覆盖检查点去声称新值已迁移。清理成功后删除检查点；删除检查点失败不重建新组，后续在确认旧设置已经不在时收掉检查点。删除前重新读取并比对完整记录（含随机认领 ID）；未知 schema 或不同记录都不清除，不改写非自己已认领的数据。
4. 同一次激活不并发启动第二次恢复；每次只处理启动时认领的旧源，不顺着作用域回退继续导入其他 endpoint。单实例只启动一次不是跨窗口锁；检查点重读也不冒充跨窗口 CAS。

须在审查中明确的并发边界：当前 `setConfig` 只有异步普通写，没有 compare-and-swap。清理前重读能保护迁移或检查点写入期间的修改，不能原子保护清理 RPC 已发出后、实际落盘前的同键修改。不得把这段窗口写成“用户并发修改已保证保留”；若本条验收要求覆盖这段窗口，需要在配置写入队列增加条件清理能力，本条先不以非原子重读冒充解决。

另有安全保留窗口：迁移命令成功后，检查点写入失败或进程退出，仍会留下新组和旧源，下次可能遇到同名冲突；此时保留旧源、记录错误，不按名称认领他人组。`Memento.update` 成功只代表主线程存储接受该更新，新组与检查点并非一笔事务。本修复只关闭“检查点已成功记录后，旧源清理失败可于下次恢复”的路径，不据此关闭上述全部恢复债。

待准备回归（只用桩，不访问网络，不编译，交主任务统一运行）：

- 迁移组成功、清理第一次拒绝、二次激活清理成功；真实迁移只调用一次，检查点在失败后保留、清理后移除。
- 两次激活之间用户修改已迁移组；二次仅清旧源，组的修改保持。
- 没有检查点、或检查点来源不匹配时遇到同名他人组；保留旧源，不清理、不认领对方组。
- 持久化检查点期间修改旧 endpoint；不清掉新值。不清除未迁移作用域里的其他 endpoint。
- profile-local 检查点不能跨来源误用：workspace A 与 B 配置同一 URL 时，A 的检查点不清 B；多根无法确定实际 folder 时保留源。
- 检查点写入或清理后移除失败；不把失败当完成，不因清理恢复重建新组。
- 未知 schema、其他 provider/group、损坏记录或不同认领 ID 不清；不就地修改 `globalState.get` 返回的对象。
- 清理 RPC 在途的同键并发修改作为配置 API 边界单列，是否扩展条件写 API 由只读审查决定，不以顺序桩伪造原子保证。

本次编辑范围：Ollama provider、对应 spec、本定向段落及 D1421 证据状态；不动 root 的 MiMo 方案、进度页、UI、其他 WIP，不自行运行 Node、编译、LLM 或提交。

签收记录（2026-11-11）：agent:engine_next_step 独立只读审查 C0/I0，主任务签收；实施清理前须同时重核当前 `sourceURI` 与原作用域 `rawURL`，不得仅比较 target 枚举与 URL，并保留上文检查点非事务、清理 RPC 无 CAS 两个 API 边界。
