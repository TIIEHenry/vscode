---
title: "十六路审查 2026-11-07 r10：conversation 阅读面、时间线与作曲器方案"
type: plan
status: accepted
phase: N/A
updated: 2026-11-07
summary: "hold 2、weaken 1、drop 0，另有审查新增 1。r10-1（高降中）待用户就 D7 拍板后实施：甲随 D7-A，同会话重新激活一律不退出编辑；乙随 D7-B 或暂不定 D7，叶被隐藏时照今天的结果退出编辑，两扇并排切焦点不退出。r10-2 叶级会话栏写回草稿时带上引用；r10-3 队列编辑保存链结算前核对仍在编辑同一项；r10-4（审查新增）删除被拒或回滚时不覆盖编辑中的正文。r10-2、r10-3、r10-4 不依赖 D7。2026-11-07 规则 16 只读审查须改稿，已改；同日 r10-1 按乙实施，r10-2、r10-3、r10-4 一并实施（未编译、未跑测试），代码审查可接受；甲仍待 D7。"
---

# 十六路审查 2026-11-07 r10：conversation 阅读面、时间线与作曲器方案

状态：执行中。负责：agent:opus。
签收：签（收窄）。签收人：agent:opus，依据用户 2026-11-07 在会话中说的「需要的做一下 不编译」，日期：2026-11-07。r10-1 只按乙实施，甲待 D7。
覆盖需求：PRD-015（验收 6「列表内编辑与队列编辑复用同一 Composer」，以及 2026-10-27 队列补充验收里 Hold、Edit、Release 依次被明确接受且失败保留草稿：r10-1、r10-3、r10-4；2026-10-21 补充的引用芯片：r10-2）、PRD-016（验收 7 两扇会话窗口并列：r10-1）、PRD-026（验收 2 草稿恢复按设置生效：r10-2）、PRD-002（验收 6 删除会话：r10-4）。四条都只让实现回到这些已签收的验收，不新增或改写需求。

改动范围停在 `src/vs/workbench/contrib/conversation/browser` 的镜头活动会话订阅与隐藏处理、`ConversationLens` 的 `syncComposerRefs` 声明、叶级会话栏与编辑器页 accessor、会话栏删除被拒与回滚时的输入框回填、队列编辑保存链，以及对应测试和 `docs/systems/conversation/` 下几句文字。不改窗口服务、名册和队列读取。r10-2、r10-3、r10-4 不依赖 D7，可以先做；r10-1 待用户就 D7 拍板后实施，并排在 r10-4 之后。

行号是 2026-11-07 改稿时回读的工作区位置（HEAD `841ea38816d` 加他人未提交改动）。审查前后 `conversationLensComposerChrome.ts`、`conversationInboxOverlay.ts`、`conversationLensSessionBar.ts`、`conversationLensSessionBinding.ts`、`conversationEditorPane.ts`、`conversationLeafSessionBar.ts`、`conversationComposerAt.ts` 都还在被并行修改，行号已经漂移过多次。实施前一律按符号名重新定位。

| 编号 | 判定 | 严重度 | 说明 |
|:-----|:-----|:-------|:-----|
| r10-1 | weaken | 高→中 | 成立部分：焦点在两扇会话窗口之间往返时，绑定镜头对自己的会话再走一遍 `applyActiveSession`，退出正在进行的回合编辑或队列编辑，并用撰写草稿覆盖输入框。稿里「释放 EDITING 占位、原文按队列发出」在产品里走不到。焦点回到 A 时，名册自己的活动会话监听先运行（`conversationEngineRosterService.ts` 151 行在构造时注册；1903–1908 行 `bindLiveTreeObservationLease` 先调 `syncQueueReader`）。`ConversationEngineQueueReader.update` 把 A 的队列状态置成 `loading`（`conversationEngineQueueReader.ts` 34–55；焦点去 B 时 A 已被标成 `stale`）。`engineQueueEditMustKeepHold` 因 `readState` 不是 `ready` 返回 true（`conversationSessionAvailability.ts` 113–121），`applyActiveSession` 于是以 `releaseQueueHold = false` 退出编辑（`conversationLensSessionBinding.ts` 285），不发 Release。stub 队列在产品里没有条目（`conversationStubModel.ts` 331 行默认空队列，`setMessageQueueFixture` 只在测试里调用）。实际后果是修改丢失，该项的 EDITING 占位悬空、不会被发出（可从 Inbox 再点进，`conversationInboxOverlay.ts` 877–880），另外发送失败行、行内操作态和轨迹搜索被清掉，lease 被重取。待用户就 D7 拍板后实施，见「r10-1 与 D7」。 |
| r10-2 | hold | 中 | 成立。产品里的会话栏是叶级会话栏，它没有引用数组，`composerDraftText(叶级会话栏)` 只返回正文，切会话、新建、删除写回的草稿丢掉引用尾块。见下文。 |
| r10-3 | hold | 低 | 成立。产品里经焦点切回或切走再切回进入前置条件：`composerWriteBusyReason` 不看在途的队列保存（`conversationLensComposerChrome.ts` 923–925），离开队列编辑后能马上开始回合编辑。不依赖 D7；r10-1 按甲落地后本条成为防御。见下文。 |
| r10-4 | 审查新增 | 低 | 2026-11-07 规则 16 审查提出，已对照工作区核实成立：删除本会话被拒时，编辑中的正文被撰写草稿覆盖（`conversationLensSessionBar.ts` 966–982），两条测试锁住了这一覆盖。不依赖 D7；r10-1 依赖它。见下文。 |

## 实施顺序与提交

1. 顺序：r10-4、r10-2、r10-3 互不依赖，也不依赖 D7，可以先做。r10-1 等用户就 D7 拍板（见「r10-1 与 D7」），并排在 r10-4 之后：r10-1 落地后，绑定镜头在删除回滚时不再先退出编辑，需要 r10-4 的回填条件挡住撰写草稿。
2. 与 p4-3 的先后：`review-2026-11-04-p4-conversation-class-split-plan.md` 的 p4-3 已签收、未实施（工作区还没有 `conversationComposerModel.ts`）。它要把 `composerPolicy`、`editingTurnId`、`editingQueueItemId`、`queueEditSettlementItemId`、`composeDraftSnapshot` 收进模型，并改 `conversationLensSessionBar.ts`、`conversationLeafSessionBar.ts`、`conversationEditorPane.ts`、`conversationLensComposer.ts` 等本方案也要改的文件。两边不进同一次提交。p4-3 先落地时，本方案新增的读取（r10-1 的新方法与隐藏处理、r10-3 的判断、r10-4 的两处回填条件）改读模型；本方案先落地时，p4-3b 的读者清单要补上这几处。
3. 本地验证顺序，每个实施切片都照做：先 `npm run compile`，只改局部 TypeScript 时可以用 `npm run compile-client`。`./scripts/test.sh --run` 加载的是 `out/` 下的编译产物（`test/unit/electron/renderer.js` 114 行定输出目录，189–195 行把 `src/...ts` 路径映射到 `out/` 下的模块），不先编译会跑到旧代码。再用 `./scripts/test.sh --run <文件>` 跑各条点名的测试文件，可以一次带多个 `--run`；合入前用 `scripts/run-unit-custom.sh` 跑 conversation 域。然后跑 `npm run eslint`。改了 `docs/` 或 `dev/` 下的文档，再跑 `python3 scripts/check-docs-health.py` 和 `python3 scripts/wiki/wiki.py check --root .`。
4. 提交本方案时把它登记进 `dev/plans/INDEX.md`。方案提交与实施提交分开（`docs/DOCUMENTATION.md` 规则 13）。
5. r10-1 实施前，用户对 D7 的拍板由 D7 所在方案 `interaction-review-2026-11-06.md` 的负责人写进该方案与 `docs/systems/conversation/composer-and-inbox.md`；本方案不改那两处的 D7 正文。
6. 实施 r10-1 时，在 `dev/progress/deferred-gaps.md` 登记一条缺口（先按关键词搜索，没有重复再登记）：叶从隐藏恢复同一会话时，`bindSessionViewNow` 按首拉清掉过程折展开与轨迹搜索（`conversationLensSessionBinding.ts` 165–173、256–264），而 `docs/systems/conversation/lens-and-trajectory.md` 第 109 行只写了同一会话重连和 KEEP leftover 保留搜索，隐藏恢复是否也应保留没有定。本方案不修。

### r10-1

实施前提：用户就 D7 拍板，并据此在下面的甲、乙中选定一种；r10-4 已落地。

问题类：绑定镜头把「自己绑定的会话重新成为活动会话」当成切会话处理，两扇会话窗口之间移动焦点，就会退出本叶的编辑、丢掉修改，并清掉本叶的会话内状态。

触发核对：编辑器页的镜头带 `sessionKey` 构造（`conversationEditorPane.ts` 169–174），产品里的两处镜头（编辑器页、子代理浮层）都是绑定镜头。叶容器 `focusin` 先 `setFocusedLeaf`，活动会话不同就 `switchSession`（`conversationSessionWindowService.ts` 615–620、701–703），引擎名册切换时发 `onDidChangeActiveSession`（`conversationEngineRosterService.ts` 420–425）。焦点去 B 时，A 的镜头因为会话不同只关内层浮层（`conversationLens.ts` 385–389）；焦点回到 A 时会话相同，落进 `applyActiveSession`（390 行）。队列编辑在引擎声明 GetQueue、队列读到 `ready` 时开放（`conversationInboxOverlay.ts` 838–847）；PRD-015 的 2026-10-27 补充验收把真实引擎行编辑的前提定为 Hold、Edit、Release 依次被明确接受且失败保留草稿，这条链已按 `composer-and-inbox.md` 第 61 行落地，所以队列编辑这一分支在产品里可达。没有测试或文档把焦点切回时退出编辑定为预期：`composer-and-inbox.md` 第 61 行写队列编辑只在 Escape / Exit 时退出并释放，第 63 行写不同叶可以独立编辑，第 29 行写失败行在写成功或切会话时才消失；`lens-and-trajectory.md` 第 109 行写只有换到另一条会话才清轨迹搜索。

#### r10-1 与 D7

D7（`interaction-review-2026-11-06.md` 第 141 行，待拍板）问的是：切会话时正在编辑的回合怎么处理。A（D7 原文标为推荐）是按会话保存回合编辑稿，回到该会话时恢复，不弹确认；B 是离开前锚定提示 Save / Discard。选定后写进 `composer-and-inbox.md`。

r10-1 碰到 D7，是因为切走再切回走的是同一段代码。产品里经叶级会话栏、Sessions 列表或 Navigator 切到别的会话时，原叶只是隐藏（`conversationSessionWindowService.ts` 459、480、504–510、523–529 都走 `hideSessionWindowWithoutFire`）；回到这个会话时恢复的是同一个镜头，它收到的同样是「自己的会话重新成为活动会话」。如果重新激活时一律不退出编辑、隐藏时也不处理，切走再切回就会保留编辑，这就是 D7-A 在镜头没被销毁时的效果。本方案不替用户选，两种取舍如下，不变量、改法和验证都按甲、乙分写：

- 甲（D7 选 A）：同会话重新激活一律只做轻量刷新，不走切会话例程，叶被隐藏时也不动编辑。两扇并排之间移动焦点、切走再切回，回合编辑和队列编辑都原样留在镜头里，队列项的 EDITING 占位跟着编辑一直留着，不再悬空。会话被删、叶被销毁或窗口重开后的恢复，要另加按会话保存编辑稿的存储，归 D7-A 的实施，不在 r10-1。切走再切回时过程折展开和轨迹搜索仍会被清（见边界情况），D7-A 若要求「原样回来」，这一点也要另外处理。
- 乙（D7 选 B，或用户想先修两扇并排而暂不定 D7）：同会话重新激活同样只做轻量刷新，但叶被隐藏时先退出编辑，结果与今天回来时相同：编辑退出，撰写草稿回到输入框，队列项占位不释放。两扇并排之间移动焦点不算离开，不提示也不退出。离开前的 Save / Discard 提示归 D7-B 另做，提示落地后正常不会带着编辑离开。乙不改变「切走再切回丢编辑」这一现状，不替 D7 做决定，也可以在 D7 拍板前先落地。

拍板时请一并确认两点。第一，D7 原文只写回合编辑，队列编辑是否同规则；本方案两种取舍都让队列编辑跟回合编辑同规则。第二，只有编辑器页对自己的镜头发隐藏信号（`conversationEditorPane.ts` 263 调 `releaseSessionViewLeaseForHiddenLeaf`），子代理浮层的镜头收不到；乙之下，浮层里的编辑在叶隐藏再回来后仍会留着，是否可以接受。

不变量：

两种取舍都成立：

- 绑定镜头（`boundSessionId` 已设）收到 `onDidChangeActiveSession(sessionId)` 且 `sessionId` 等于 `boundSessionId` 时，不调用 `applyActiveSession`。这次事件不改 `composerPolicy`、`editingTurnId`、`editingQueueItemId`、`composeDraftSnapshot`、输入框正文和 `composerRefResources`，不调用 `releaseMessageQueueItemHold`、`clearPostFailure`、`timelineTree.clearTurnActionState`、`trajectoryView.clearSessionState`、`resetInputHistoryBrowse`，也不调用 `applyComposerSurfaceText`。
- 同一情形下，镜头仍持有绑定会话的 lease 时（两扇并排、叶没被隐藏过），不重取，过程折展开与轨迹搜索因此留着。只有 `sessionViewLease` 为空或不属于绑定会话、并且 `sessionViewBindingSuspended` 为假时，才 `bindSessionView(boundSessionId)`。
- 同一情形下仍刷新随活动会话变化的外观：标题、Inbox 状态、相位与时间线空态、门闩、会话配置控件可用态、发送钮、同步徽章。就绪度按活动会话取（`getConversationSessionReadiness`），这一步不能省。
- 绑定镜头收到其它会话时，仍只关内层 History、Snapshots、Inbox 列表与 Visualize。
- 无绑定镜头（`boundSessionId` 未设）收到活动会话变化，以及 `setBoundSessionId` 换绑到另一会话，仍完整走 `applyActiveSession`。
- 窗口服务在叶获焦时仍把名册活动会话切到该叶。

只在甲成立：

- 叶被隐藏时不动编辑；叶从隐藏恢复、会话重新激活后，编辑仍在。lease 在隐藏时已释放，恢复时由编辑器页在获焦之前重取（`runReveal` 先 `fireVisibleWindowsChange()` 再 `focusLeaf`，`conversationSessionWindowService.ts` 424、430；`conversationEditorPane.ts` 253–290），新方法见到 lease 已在，不再重取。回合编辑的作曲器在时间线重绘编辑行时挂回（`conversationTimelineHost.ts` 450 起的 `setEditingTurnId`，`conversationTimelineRenderer.ts` 471）。

只在乙成立：

- 叶被隐藏时（编辑器页调 `releaseSessionViewLeaseForHiddenLeaf`），镜头先以 `exitComposerEdit(true, false)` 退出编辑：回合编辑与队列编辑退出，输入框回到撰写草稿，不发 Release。不释放占位是有意的：隐藏时活动会话还是 A、队列仍是 `ready`，若按 `engineQueueEditMustKeepHold` 决定释放，会把改动前的原文放回队列发出去。
- 叶从隐藏恢复后，重新激活不再有编辑可退，结果与今天回来时相同。

要动的符号：`ConversationLens` 构造函数里 `stubService.onDidChangeActiveSession` 订阅的分派（`conversationLens.ts` 385–391）；新增私有方法承接绑定会话重新成为活动会话（建议名 `refreshReactivatedBoundSession`）；乙另改 `releaseSessionViewLeaseForHiddenLeaf`（833–838），在清 lease 之前退出编辑。文件：`src/vs/workbench/contrib/conversation/browser/conversationLens.ts`；测试 `conversationLens.test.ts`、`conversationLeafSessionBar.test.ts`；文档 `docs/systems/conversation/composer-and-inbox.md` §2。

改法：

1. 订阅分三支。`boundSessionId` 已设且 `sessionId` 不同：维持现在的 `closeBoundInnerOverlays()` 后返回。`boundSessionId` 已设且 `sessionId` 相同：调用新方法后返回。`boundSessionId` 未设：维持 `applyActiveSession(sessionId)`。
2. 新方法先处理 lease：`sessionViewBindingSuspended` 为假，且 `sessionViewLease` 为空或不属于绑定会话时，调用 `bindSessionView(boundSessionId)`。隐藏叶已挂起时不在这里重取，交给编辑器页。
3. 新方法随后依次调用 `updateSessionTitle()`、`renderInboxStatus()`、`updateConversationPhase()`、`updateGateRow()`、`updateComposerSessionSelectsEnabled(this)`、`updateSendEnabled()`、`updateSyncChrome()`。不调用 `syncSessionConfigSelects`：它按存储值重选模型下拉，会盖掉在飞的乐观选择（`review-2026-10-30-r11-conversation-plan.md` r11-3 的范围），绑定会话没变，配置值不需要重选。不调用 `refreshSessionSelectOptions`：编辑器页镜头不挂会话下拉，叶级会话栏自己在 `onDidChangeSession` 里刷新。不调用 `cancelSessionTitleEdit`：标题编辑框属于叶级会话栏，共享的 `switchToSession` 已在开头取消它（`conversationLensSessionBar.ts` 992–994）。
4. `updateConversationPhase` 里 PreFirst 不允许编辑的退出规则照旧，只在会话没有可见消息时生效。
5. 不改 `applyActiveSession` 的函数体。它开头已经按 `ui-interaction-visual-review-2026-11-07.md` 加上了标题编辑取消（`conversationLensSessionBinding.ts` 274–276），真切会话照旧走它。
6. 新方法只读 `boundSessionId`，不新增 `getActiveSessionId()` 调用（`review-2026-11-04-p3-session-scope-plan.md` p3-1c 的 lint 规则）。
7. 乙：`releaseSessionViewLeaseForHiddenLeaf` 在清 lease 之前，若 `composerPolicy` 不是 `compose`，调用 `exitComposerEdit(true, false)`。隐藏发生在 `focusLeaf` 把焦点送进新叶之前，`exitComposerEdit` 的回焦只在作曲器原本有焦点时发生，随后的 `focusLeaf` 会把焦点带走。甲：不做这一步。
8. 文档：在 `composer-and-inbox.md` §2 第 63 行那段后补一句，与 D7 的拍板句合写一处。甲写：会话叶重新获得焦点或从隐藏恢复都不算切会话，回合编辑、队列编辑和它的 EDITING 占位、发送失败行都留着，叶被销毁后的恢复见 D7。乙写：两扇会话窗口之间移动焦点不算切会话，获焦叶的编辑、占位和发送失败行都留着；叶被隐藏时编辑退出，占位不释放。两种写法都注明：叶从隐藏恢复时过程折展开与轨迹搜索会被清，是否预期见登记的缺口。

边界情况：

- 叶从隐藏恢复：lease 在隐藏时释放，编辑器页在获焦前重取。`bindSessionViewNow` 看到没有上一个 lease、时间线却有已画内容，按首拉处理，清掉过程折展开与轨迹状态（`conversationLensSessionBinding.ts` 165–173、256–264）；引擎 lease 起步是空的 `pending` 副本，时间线在帧到达前还会先清空（182–188、262–264）。这段在甲、乙下都不变，按「实施顺序与提交」第 6 条登记缺口。
- 甲之下，时间线清空到重绘之间，作曲器暂时不在文档里，编辑状态和输入框正文留在镜头上。`isPreFirst` 先看名册里的回合（`conversationLensProjection.ts` 120–122），有消息的会话这时不算 PreFirst，第 271–273 行的退出规则不会触发。
- 队列编辑在 A 打开、焦点在 B 时，名册的队列读取只跟随活动会话，A 的队列状态是 `stale`，A 里保存或退出按现有规则报失败、保留草稿与占位。焦点回到 A、队列重新读到 `ready` 后再保存或退出照常。这是现行的诚实降级，不改。
- 在途保存期间焦点往返：作曲器留在队列编辑，保存链按现有规则结算。乙之下，在途保存期间叶被隐藏，编辑会在隐藏时退出，靠 r10-3 的判断防止之后的收尾去退出别的编辑。

明确不改什么：

- `applyActiveSession`（`conversationLensSessionBinding.ts` 273 起）及其测试 `switching session clears the composer failure row and row-local action state`、`applyActiveSession first-pull to other session refreshes phase and sync chrome without acquire`、`applyActiveSession same-session KEEP leftover does not clear leftover`。
- `setBoundSessionId` 换绑的行为。
- 无绑定镜头经自身会话栏切会话的测试：`turnEdit session switch keeps compose draft snapshot not bubble text`、`queueEdit session switch keeps compose draft snapshot`、`compose session switch still writes textarea into drafts`、`turnEdit deleteSession optimistic rollback restores compose draft snapshot not bubble text`。
- 绑定叶离开活动会话时关内层浮层（`conversation-bound-session.md` 第 68 行 S3 选定）。
- 窗口服务 `focusin` 与 `setFocusedLeaf` 的 `switchSession`。保持 `conversationSessionWindowService.test.ts` 的 `deleting the focused non-primary session drops its leaf and does not open the neighbor beside`（focusin 后活动会话是该叶）与 `conversationLeafSessionBar.test.ts` 的 `two visible leaves: switching to the other visible session focuses it without replace`。
- 名册的队列读取只跟随活动会话（`ConversationEngineQueueReader`）、`engineQueueEditMustKeepHold`、`exitComposerEdit` 与 `cancelQueueEdit` 的释放规则。
- 可见叶 lease 恢复不靠活动会话事件：保持 `conversationSessionWindowReveal.test.ts` 的 `L1 same visible empty owner recovers its own lease after same-session catalog ready without reveal` 与 `L3 loading and real list rejection leave a visible empty owner missing until successful ready`。
- `bindSessionViewNow` 的首拉判定：隐藏恢复时清过程折与轨迹，只登记、不改。

本地验证：

- `conversationLens.test.ts` 新增一组，用 `mountLens({ stubService, sessionKey: A, tablistOnly: true })` 构造与产品相同的绑定镜头（不带自身会话栏）。单元夹具里没有隐藏信号，前四条代表两扇并排，两种取舍都要过：
  - 回合编辑：A 有用户回合，`beginTurnEdit` 后改输入框并派发 input；`stubService.switchSession(B)` 再 `switchSession(A)`。断言仍是 `turnEdit`、`editingTurnId` 不变、输入框是改过的文字、`readComposerDraft(A)` 仍是进编辑前的撰写草稿。旧代码在回到 A 时退出编辑，这条会失败。
  - 队列编辑：`setMessageQueueFixture` 放一条 PENDING 项，`holdMessageQueueItem(A, 'q-edit', 'EDITING')` 后 `beginQueueEdit('q-edit')` 并改字；往返后仍是 `queueEdit`、`editingQueueItemId` 不变、输入框保留、夹具项的 `hold` 仍是 `EDITING`。旧代码在 stub 队列上会在回到 A 时释放占位。
  - 会话内状态：`showPostFailure('failed')` 后往返，失败行仍可见；`trajectoryView.clearSessionState` 换成计数桩，往返后计数为 0；`sessionViewLease` 仍是往返前的同一对象。
  - 换绑仍按切会话：`setBoundSessionId(B)` 后编辑退出，输入框是 B 的草稿。
  - 隐藏再回来，按拍板只保留对应的一条：在 `switchSession(B)` 之前调用 `releaseSessionViewLeaseForHiddenLeaf()`，回来时先 `bindSessionView(A)` 再 `switchSession(A)`，模拟编辑器页的顺序。甲断言回合编辑仍在、`editingTurnId` 不变、输入框是改过的文字，重绘后 `timelineTree.getTurnEditHost` 返回的编辑行里含镜头的作曲器节点。乙断言 `releaseSessionViewLeaseForHiddenLeaf()` 之后已是 `compose`、输入框是撰写草稿；队列编辑版本里夹具项的 `hold` 仍是 `EDITING`，没有释放。
- `conversationLeafSessionBar.test.ts`：给 `createHarness` 加一个可选的名册参数，默认仍是 `new QuietRosterService()`（夹具 42–50、139–140 行）。
  - 两扇窗口：`openSessionBeside(b)` 后在主叶镜头 `beginTurnEdit` 并改字，依次对 B、A 两个叶容器派发 `focusin`；断言活动会话依次是 B、A，主叶镜头仍在回合编辑且文字保留。两种取舍都要过，旧代码会失败。
  - 切走再切回（审查要求补的用例），按拍板只保留对应的一条：单叶时在主叶镜头 `beginTurnEdit` 并改字，用共享函数 `switchToSession(主叶的叶级会话栏, b)` 切走（主叶隐藏），再用 B 叶的叶级会话栏切回主叶。甲断言主叶镜头仍在回合编辑、文字保留、作曲器在编辑行里，旧代码会失败；乙断言主叶镜头已回到撰写态、输入框是撰写草稿，旧代码也能过，这条只锁住现状。
- 按「实施顺序与提交」第 3 条：先编译；再 `./scripts/test.sh --run` 跑 `conversationLens.test.ts`、`conversationLeafSessionBar.test.ts`，以及「明确不改什么」里涉及的 `conversationLensSessionBinding.test.ts`、`conversationLensDisposeGate.test.ts`、`conversationSessionWindowService.test.ts`、`conversationSessionWindowReveal.test.ts`；然后 `npm run eslint`；改了 `composer-and-inbox.md` 再跑 docs-health 两条。

### r10-2

问题类：叶级会话栏代替镜头计算出站草稿时只取输入框里的正文，产品里经叶级会话栏切会话、新建、删除写回的草稿丢掉引用尾块，之后读回草稿的路径会把引用芯片清空。

触发核对：编辑器页镜头不挂会话栏（`conversationEditorPane.ts` 169–174），产品会话栏是 `ConversationLeafSessionBar`。会话下拉（`conversationLensSessionBar.ts` 266–275）和 More 菜单会话行（359 行）调用共享函数 `switchToSession(host, …)`，新建（229、373 行）与删除（245、375 行）同样以叶级会话栏为宿主。叶级会话栏只借了镜头的 `dockTextarea`（`conversationLeafSessionBar.ts` 127），没有 `composerRefResources`，`composerDraftText` 于是只返回正文（`conversationComposerRefs.ts` 93–100），经 accessor 覆盖镜头在输入和加芯片时写下的整段（`conversationLensDock.ts` 538；`conversationComposerAt.ts` 231–233）。`ua.client.chatInput.restoreDrafts` 默认开（`uaClientSettings.ts` 56–58；未设置时按开处理，`uaClientSettingsHelpers.ts` 33–35），这份草稿还会落盘。隐藏叶恢复时 `applyActiveSession` 读回草稿（`conversationLensSessionBinding.ts` 290），新镜头构造时 `restoreComposerDraftToInput` 读回草稿（`conversationLens.ts` 364），两处都走 `applyComposerSurfaceText` 的无尾块分支清空芯片（`conversationComposerRefs.ts` 125–127）。已签收的 `conversation-timeline-session-pills.md` 第 441 行要求出站草稿读写含引用的整段；活码只在宿主是镜头时满足。没有测试锁定叶级会话栏丢引用，也没有旧方案承接。

不变量：

- 撰写态下，叶级会话栏为切会话、新建、删除写进草稿表的文字，等于同一时刻的 `composerDraftText(镜头)`：正文加合法引用尾块，没有引用时只有正文。
- 编辑态下仍写 `composeDraftSnapshot`；镜头进入编辑时已按整段拍下它（`conversationLensComposerChrome.ts` 549、581）。
- 删除被拒（`conversationLensSessionBar.ts` 966–982）或乐观删除回滚（`restorePendingDeleteDraft`，859–881）在撰写态回填输入框时，正文和引用芯片一起恢复到镜头：镜头的 `composerRefResources` 与芯片行一致。编辑态不回填，见 r10-4。
- 镜头自带会话栏的路径（无绑定镜头与测试夹具）结果不变。
- 草稿键（`draftMapKey`）、`restoreDrafts` 开关与存储格式不变。

要动的符号：`ConversationLens`（`conversationLens.ts` 220 起）用 `declare` 声明可选的 `syncComposerRefs`；`IConversationLeafPaneAccessors`（`conversationLeafSessionBar.ts` 45–58）新增两个可选成员，一个取镜头的引用数组，一个让镜头重画芯片行；`ConversationEditorPane`（`conversationEditorPane.ts` 292–310 一带的 accessor 实现）实现这两个成员，分别返回 `this.lens?.composerRefResources`、调用 `this.lens?.syncComposerRefs?.()`；`ConversationLeafSessionBar` 用 getter 暴露 `composerRefResources`，并提供 `syncComposerRefs()`，两者都转给 accessor；`IConversationLensSessionBarHost`（`conversationLensSessionBar.ts` 48–106）声明可选的 `composerRefResources` 与 `syncComposerRefs`，写明共享函数会读写它们。文件：`conversationLens.ts`、`conversationEditorPane.ts`、`conversationLeafSessionBar.ts`、`conversationLensSessionBar.ts`（只改接口声明）；测试 `conversationLeafSessionBar.test.ts`；文档 `docs/systems/conversation/composer-and-inbox.md` §6。`outgoingComposerDraftText`、`switchToSession`、`createNewSession`、`deleteActiveSession`、`restorePendingDeleteDraft` 的函数体不因本条改动（回填条件由 r10-4 改）。

改法：

1. `ConversationLens` 上用 `declare` 声明可选的 `syncComposerRefs`。这个方法由 `wireComposerAt` 在运行时挂到镜头上（`conversationComposerAt.ts` 258）；类只 `extends Disposable`、没有声明它，编辑器页写 `this.lens?.syncComposerRefs?.()` 编译不过。`declare` 只补类型、不产生字段初始化，不会在构造时把运行时挂上的函数盖成 `undefined`。签名照 `IComposerSurfaceHost` 里已有的可选声明写（`conversationComposerRefs.ts` 39）。
2. 编辑器页加两个 accessor。没有镜头时取数组返回 `undefined`、重画为空操作；这时经 accessor 的 `writeComposerDraft` 本来就是空操作，结果与现在相同。
3. 叶级会话栏的 `composerRefResources` getter 每次经 accessor 取镜头上的那一个数组，不缓存、不复制：`applyComposerSurfaceText` 靠原地 `splice` 改数组，复制会让镜头的芯片和草稿对不上。`syncComposerRefs()` 只转给镜头。
4. 这样 `composerDraftText(叶级会话栏)` 读到镜头的引用，出站草稿带尾块；撰写态下删除被拒与回滚时，`applyComposerSurfaceText(叶级会话栏, 整段)` 把引用写回镜头数组并重画芯片行。叶级会话栏已经借用镜头的 `dockTextarea`，引用数组按同样方式借用。
5. 不选「只加一个返回整段草稿的 accessor」：那样写出能修好，但删除被拒与回滚的回填仍只恢复正文。
6. 文档：`composer-and-inbox.md` §6 第 106 行那段后补一句：草稿存整段（正文加引用尾块），叶级会话栏切会话、新建、删除写回时同样带引用。
7. 与 r10-1、r10-4 的关系：本条独立，先后都可以。r10-1 按甲落地后，隐藏叶恢复不再读回草稿，这条路径上的芯片不再被清；但落盘的草稿仍缺引用，窗口重开或新镜头构造时仍会丢。r10-4 让回填只在撰写态发生，与本条的引用恢复互不冲突。

明确不改什么：

- `composerDraftText`、`applyComposerSurfaceText`、`splitConversationRefs`、`composeConversationPayload`。
- 编辑态出站仍是 `composeDraftSnapshot`：保持 `turnEdit session switch keeps compose draft snapshot not bubble text`、`queueEdit session switch keeps compose draft snapshot`、`turnEdit createNewSession writes compose draft snapshot not bubble text`，以及 `conversationComposerEditDraft.test.ts` 的 `turnEdit deleteSession false keeps compose draft snapshot not bubble text` 的草稿断言（它的输入框断言由 r10-4 改）。
- 不带引用数组的宿主仍只写正文：保持 `conversationComposerEditDraft.test.ts` 的 `compose deleteSession false still writes textarea into drafts`（夹具宿主没有 `composerRefResources`，共享函数不改，结果不变）。
- 删除草稿归属：保持 `SessionBar synchronous refused delete preserves a target draft updated after switching surfaces`、`SessionBar pending confirmation cannot copy a successor surface draft into its target` 与 `SessionBar pending delete draft … belongs to … owner` 一组。
- 叶级会话栏自己的 `switchToSession` 方法（`conversationLeafSessionBar.ts` 310–315，直接 `switchLeafSession`、不写草稿）与 `switchLeafSession`。
- 叶级会话栏既有测试 `two visible leaves: switching to the other visible session focuses it without replace`、`leaf session bar title follows roster rename while that leaf is not active`、`ConversationLeafSessionBar clears and detaches bar on dispose`；`conversationComposerAtChip.test.ts` 整个文件。

本地验证（都在 `conversationLeafSessionBar.test.ts`，用 r10-1 里给 `createHarness` 加的名册参数；每条写明旧代码怎样失败）：

- 切会话：主叶镜头 `addComposerContextRef(镜头, ref)` 并输入正文（`ref` 取另一会话的合法 `getConversationChatResource(...).toString()`），调用共享函数 `switchToSession(主叶的叶级会话栏, b)`；断言 `readComposerDraft(主叶会话)` 等于 `composeConversationPayload(正文, [ref])`，含 `CONVERSATION_REFS_MARKER` 与 `ref`。旧代码只写正文，这条失败。
- 接着用 `applyComposerSurfaceText(镜头, '')` 清空正文和芯片（不写草稿），再调用 `restoreComposerDraftToInput()`；断言 `composerRefResources` 是 `[ref]`、输入框是正文。旧代码草稿缺尾块，芯片恢复为空。
- 新建：叶级会话栏 `createNewSession` 写回的主叶草稿带尾块。旧代码失败。
- 删除被拒：名册参数传入 `deleteSession` 返回 false 的 `QuietRosterService` 子类，确认后断言草稿带尾块（旧代码失败），镜头 `composerRefResources` 仍是 `[ref]`、芯片行不隐藏（新旧都过，作回归）。
- 撰写态回滚：名册参数传入照 `SessionBar pending delete draft … owner` 里 `RollbackRoster` 写法的子类，删除时隐藏会话、回滚只发 `onDidChangeSession`。删除之后、回滚之前用 `applyComposerSurfaceText(镜头, 正文)` 把芯片清掉（不写草稿）；回滚后断言芯片回到 `[ref]`。旧代码的叶级会话栏回填不碰引用数组，芯片仍为空。
- 原稿里在 `conversationLens.test.ts` 用新镜头恢复整段草稿的用例去掉：它的草稿不是叶级会话栏写的，新旧代码都能过。
- 按「实施顺序与提交」第 3 条：先编译；再 `./scripts/test.sh --run` 跑 `conversationLeafSessionBar.test.ts`，以及「明确不改什么」里涉及的 `conversationLens.test.ts`、`conversationComposerEditDraft.test.ts`、`conversationComposerAtChip.test.ts`；然后 `npm run eslint`；改了 `composer-and-inbox.md` 再跑 docs-health 两条。

### r10-3

问题类：队列编辑的保存链在 Edit 与 Release 结算时不核对作曲器是否还在编辑这一项，作曲器已离开这次队列编辑后，`finalize` 会退出之后开始的回合编辑或另一项队列编辑并用撰写草稿覆盖输入框，`failChain` 会把这次保存的失败行写到别的编辑上。

触发核对：保存时 557 行把 `queueEditSettlementItemId` 设成这一项（`conversationLensComposer.ts`）。在途期间 r10-1 所说的焦点切回，或切走再切回（叶隐藏后回来，今天同样走 `applyActiveSession`），都会让 `engineQueueEditMustKeepHold` 因 settlement id 相同返回 true，`applyActiveSession` 以 `releaseQueueHold = false` 退出编辑；`exitComposerEdit` 621 行的拦截只在 `releaseQueueHold` 为真时生效（`conversationLensComposerChrome.ts`）。作曲器回到 `compose` 后，`beginTurnEdit` 里的 `exitComposerEdit(host, false)` 在 615–617 行直接返回 true，回合编辑照常开始。之后 Release 结算为真时，`finalize()` 不看当前编辑对象，直接 `exitComposerEdit(true, false)`（`conversationLensComposer.ts` 558–562、588–591）；Release 没能发出或结算为假时，`failChain` 写失败行（575–579、592–593）。`cancelQueueEdit` 的结算回调在 675–677 行先核对仍在编辑同一项，保存链缺这一步。现有测试没有锁定「作曲器离开后保存链仍退出编辑」。时间窗只有 Edit 与 Release 两次往返（回到 A 后 A 的队列还要重新读到 `ready`，Release 才发得出），严重度维持低。

判据与合同：`composer-and-inbox.md` 第 61 行写「身份或 link 变了，或任一次没有被接受，编辑留在原地并报失败」，说的是作曲器仍拿着这次队列编辑的情形；下面的判断成立时，行为照旧。作曲器已经离开这次编辑时，编辑稿在离开时已经丢掉，没有「原地」可留。失败文案都是对作曲器当前正文说的（`conversationLensDockStrings.ts` 91–97：`engine_disconnected` 与 `session_not_ready` 写 Draft kept，`failed` 写 Try again），写到别的编辑上是错话。这时该项的真实状态留在 Inbox 行上：Edit 被拒或 Release 没发出时仍是 EDITING，行上标 Editing（`conversationInboxOverlay.ts` 963–966），可以再点进（877–880）。

不变量：

- `finalize` 只在 `composerPolicy` 为 `queueEdit`、`editingQueueItemId` 等于本链的 `itemId`、`getBoundSessionId()` 等于本链的 `sessionId` 时调用 `exitComposerEdit(true, false)`；三项任一不成立时，只清链并 `renderInboxStatus()`。
- `failChain` 只在同样三项都成立时 `showQueueEditFailure`；否则只清链。
- 三项都成立时，保存链现有行为不变：Edit 被接受才发 Release，链路变了报 `delivery_unknown`，失败保留草稿与占位。
- 链结束时总会清掉等于本项的 `queueEditSettlementItemId`。

要动的符号：`saveQueueEdit` 里的 `finalize`、`failChain` 两个闭包（`conversationLensComposer.ts` 558–566），新增一个闭包内判断「仍在编辑这一项」。文件：`src/vs/workbench/contrib/conversation/browser/conversationLensComposer.ts`；测试 `conversationComposerEditDraft.test.ts`、`conversationEngineRosterService.test.ts`；文档 `docs/systems/conversation/composer-and-inbox.md` §2 第 61 行。

改法：

1. 在 `saveQueueEdit` 里、`finalize` 之前定义判断，读三项当前值，与发起时捕获的 `sessionId`、`itemId` 比较。判据与 `cancelQueueEdit` 的结算回调一致（`conversationLensComposerChrome.ts` 675–677）。
2. `finalize`：先 `clearChain()`；判断成立才 `exitComposerEdit(true, false)`；最后总是 `renderInboxStatus()`，让 Inbox 反映 Release 之后的队列。
3. `failChain`：先 `clearChain()`；判断成立才 `showQueueEditFailure(host, reason)`。作曲器已离开时不写失败行，理由见上面「判据与合同」；这与 `cancelQueueEdit` 结算回调在作曲器离开后直接返回的做法相同。
4. 作曲器在链结算前又进入了同一项的队列编辑（该项仍是 EDITING，可从 Inbox 再点进）时，判断成立，Release 结算为真后照常退出：占位已经释放，留在编辑里会去改一条不再被占住的项。
5. 同步路径（没有结算钩子的测试替身和本地夹具）在发起与结算之间没有机会改变作曲器，判断恒成立，行为不变。
6. 文档：在 `composer-and-inbox.md` §2 第 61 行队列编辑那条末尾补一句：保存链结算时作曲器已不在编辑这一项，只结束这条链，不退出别的编辑，也不把失败写到别的编辑上，该项状态看 Inbox 行。
7. 顺序：不依赖 D7，可以先做。r10-1 落地前，焦点切回和切走再切回都能进入前置条件；r10-1 按甲落地后两条都关上，本条成为防御，剩下的路径是 `updateConversationPhase` 的 PreFirst 退出和未绑定宿主切会话；按乙落地后焦点切回关上，切走再切回会在隐藏时退出编辑，本条继续有用。与 p4-3 的先后见「实施顺序与提交」第 2 条。

明确不改什么：

- 保存链的顺序，`releaseAfterAcceptedEdit`、`finish` 与 `samePublishedEngineLink` 判据；`cancelQueueEdit`；`exitComposerEdit`。
- `beginTurnEdit` 与 `composerWriteBusyReason`：不把在途的队列保存加进忙碌判断。
- 以下既有测试的断言不变：`conversationComposerEditDraft.test.ts` 的 `saveQueueEdit keeps the draft and hold until the engine accepts the edit`、`saveQueueEdit releases the hold after the engine accepts the edit`、`saveQueueEdit accepted after the published link changes keeps the hold and reports delivery_unknown`、`saveQueueEdit confirming a loaded refs trailer does not rewrite it`、`saveQueueEdit unchanged or whitespace-only body exits without a write or failure`、`cancelQueueEdit during an in-flight edit does not release the hold`；`conversationEngineRosterService.test.ts` 的 `default editor queue edit signs off hold, edit, and release against a running engine`、`default editor queue edit keeps draft and hold when the running engine refuses the edit`；`conversationLensDisposeGate.test.ts` 的 `saveQueueEdit roster true exits edit and does not show post failure`、`connected live saveQueueEdit still writes when engine session is ready`。
- 上面 `conversationComposerEditDraft.test.ts` 的前四条与 `conversationEngineRosterService.test.ts` 的两条，宿主夹具没有 `editingQueueItemId`，要补上 `editingQueueItemId: 'q1'`，与真实镜头处于队列编辑时的状态一致；断言不改。`conversationLensDisposeGate.test.ts` 那两条的夹具已经带这个字段。

本地验证：

- `conversationComposerEditDraft.test.ts` 新增：宿主处于 `queueEdit`、`editingQueueItemId: 'q1'`；`saveQueueEdit` 之后把宿主改成回合编辑（`composerPolicy` 为 `turnEdit`、`editingQueueItemId` 置空、`editingTurnId` 有值），再让 Edit、Release 依次结算为真。断言 Release 发出一次、`exitComposerEdit` 未被调用、`showPostFailure` 未被调用、`queueEditSettlementItemId` 已清、`renderInboxStatus` 被调用。旧代码会调用 `exitComposerEdit`。
- 同文件新增：同样改成回合编辑后让 Edit 结算为假。断言 `showPostFailure` 未被调用、链已清、没有发 Release。旧代码会写失败行。
- 同文件新增：改成编辑另一项 `q2` 后 Release 结算为真。断言不退出编辑。旧代码会退出。
- 按「实施顺序与提交」第 3 条：先编译；再 `./scripts/test.sh --run` 跑 `conversationComposerEditDraft.test.ts`、`conversationEngineRosterService.test.ts`、`conversationLensDisposeGate.test.ts`；然后 `npm run eslint`；改了 `composer-and-inbox.md` 再跑 docs-health 两条。

### r10-4

来源：2026-11-07 规则 16 只读审查提出，不在发现稿里；已对照工作区核实成立。

问题类：删除本会话被拒时，会话栏把删除前的出站草稿回填进输入框而不看作曲器状态；作曲器处于回合编辑或队列编辑时，编辑中的正文被撰写草稿覆盖，接着点保存会把撰写草稿当成编辑内容发出去。

触发核对：`deleteActiveSession` 的同步被拒分支（`conversationLensSessionBar.ts` 966–982）在 971–973 行只核对绑定会话，就 `applyComposerSurfaceText(host, draftText)`。编辑态下 `draftText` 是 `composeDraftSnapshot`（`outgoingComposerDraftText`，817–819），作曲器又没有退出编辑，于是编辑行里显示撰写草稿，`saveTurnEdit` / `saveQueueEdit` 读到的 `composerSubmitText(host)` 就是这份撰写草稿。这违反 `composer-and-inbox.md` 第 27 行「保存回合或队列编辑时，点发送只保存这次编辑，不会把刚恢复的撰写草稿再发出去」。锁住这一覆盖的是 `conversationLens.test.ts` 3772–3800（3799 行断言输入框是 `A`）与 `conversationComposerEditDraft.test.ts` 114–127（126 行同样断言）。两条都来自提交 `3ee55538e3f`（2026-09-23），提交说明只针对「编辑态删会话失败不把气泡正文写进撰写草稿」，那次没有改任何文档，输入框断言没有合同依据。`restorePendingDeleteDraft`（859–881）在 878–880 行有同样不看作曲器状态的回填；今天引擎名册回滚先发活动会话变化（`conversationEngineRosterService.ts` 1850–1852），绑定镜头的 `applyActiveSession` 先退出编辑，这条路径暂时不出错。r10-1 落地后（甲、乙都一样）绑定镜头不再先退出，就会出错。同步被拒在产品里少见：确认后会话栏重查写闸和会话是否还在（`conversationLensSessionBar.ts` 950–955），引擎名册只在归属不符、配对保持、列表失败或删除本身被拒时同步返回 false（`conversationEngineRosterService.ts` 877–900），所以严重度记为低。

不变量：

- 删除被拒的同步分支与 `restorePendingDeleteDraft` 只在 `composerPolicy` 为 `compose` 时回填输入框；编辑态只写草稿表，编辑中的正文与芯片不动。
- 草稿表的写入不变：编辑态仍写 `composeDraftSnapshot`。
- 之后退出编辑时，输入框回到撰写草稿（`exitComposerEdit` 按 `composeDraftSnapshot || readComposerDraft` 恢复，`conversationLensComposerChrome.ts` 637–639）。
- 撰写态的回填与删除失败提示不变。

要动的符号：`deleteActiveSession` 同步被拒分支里 `applyComposerSurfaceText` 的条件（`conversationLensSessionBar.ts` 971–973）；`restorePendingDeleteDraft` 里 `applyComposerSurfaceText` 的条件（878–880）。文件：`src/vs/workbench/contrib/conversation/browser/conversationLensSessionBar.ts`；测试 `conversationLens.test.ts`、`conversationComposerEditDraft.test.ts`；文档 `docs/systems/conversation/session-windows.md`「删除确认与草稿归属」。

改法：

1. 两处回填都加上 `host.composerPolicy === 'compose'`。宿主是叶级会话栏时，这个值经 accessor 读镜头（`conversationLeafSessionBar.ts` 317–319）。
2. 编辑态只写草稿表；撰写草稿留在镜头的 `composeDraftSnapshot` 与草稿表里，退出编辑时恢复。
3. 替换两处断言：`conversationLens.test.ts` 3799 行改为断言输入框仍是编辑正文 `B`、`composerPolicy` 仍是 `turnEdit`，再调用 `lens.exitComposerEdit()`，断言输入框回到 `A`；`conversationComposerEditDraft.test.ts` 126 行改为断言 `host.dockTextarea.value` 仍是 `B`。两条测试的名字说的是草稿（不写气泡正文），草稿断言不变，名字不改。
4. 文档：`session-windows.md`「删除确认与草稿归属」第 43 行那段补一句：作曲器处于回合或队列编辑时，删除被拒或回滚只写回撰写草稿，不覆盖编辑中的正文，退出编辑后撰写草稿回到输入框。
5. 不依赖 D7，可以先做；r10-1 依赖本条。

明确不改什么：

- `outgoingComposerDraftText`、删除归属检查（`sameConversationDeleteOwner`）与删除确认流程。
- 撰写态行为：保持 `conversationComposerEditDraft.test.ts` 的 `compose deleteSession false still writes textarea into drafts`、`SessionBar pending delete draft … belongs to … owner` 一组、`SessionBar synchronous refused delete preserves a target draft updated after switching surfaces`、`SessionBar pending confirmation cannot copy a successor surface draft into its target`。
- `turnEdit deleteSession optimistic rollback restores compose draft snapshot not bubble text`：镜头带自身会话栏，回滚监听先于镜头的活动会话监听登记，加条件后先只写草稿，再由 `applyActiveSession` 退出编辑并恢复撰写草稿，终态不变。
- `turnEdit createNewSession writes compose draft snapshot not bubble text`。

本地验证：

- 按改法第 3 步改两处断言。旧代码下新断言失败。
- `conversationLens.test.ts` 新增：无绑定镜头（`mountLens()`），名册照 `SessionBar pending delete draft … owner` 里的 `RollbackRoster` 写法，删除时隐藏会话、回滚只发 `onDidChangeSession`、不改活动会话；回合编辑中删除并确认，再回滚。断言仍是 `turnEdit`、输入框是编辑正文、`readComposerDraft` 是撰写草稿。旧代码回滚时把撰写草稿写进编辑中的输入框，这条会失败。
- 按「实施顺序与提交」第 3 条：先编译；再 `./scripts/test.sh --run` 跑 `conversationLens.test.ts`、`conversationComposerEditDraft.test.ts`；然后 `npm run eslint`；改了 `session-windows.md` 再跑 docs-health 两条。

## 审查

2026-11-07 规则 16 只读审查的结论是须改稿，没有 Critical，Important 三条都已改入。I1（r10-2）成立：`ConversationLens` 只 `extends Disposable`（`conversationLens.ts` 220），没有声明 `syncComposerRefs`，这个方法由 `wireComposerAt` 在运行时挂上（`conversationComposerAt.ts` 258），编辑器页取它编译不过；r10-2 改为在 `ConversationLens` 上用 `declare` 声明，把 `conversationLens.ts` 列进改动范围，本地验证补了 compile、eslint 与 docs-health。I2（r10-1）成立：切走再切回在产品里走的是同一条重新激活路径，原稿等于替待定的 D7 选了 A；r10-1 改为「待用户就 D7 拍板后实施」，写出甲（随 D7-A）与乙（随 D7-B 或暂不定，叶隐藏时照今天的结果退出编辑）两种取舍及后果，不替用户拍板；不变量加上「镜头仍持有 lease」的限定，写明隐藏恢复时 `bindSessionViewNow` 按首拉清掉过程折展开与轨迹搜索（`conversationLensSessionBinding.ts` 165–173、256–264），并作为实施步骤登记缺口；补了切走再切回的用例，甲断言编辑还在，乙断言与今天相同。I3 成立：同步被拒的删除分支（`conversationLensSessionBar.ts` 966–982）在编辑态覆盖编辑正文，违反 `composer-and-inbox.md` 第 27 行，两条锁定测试来自只针对草稿内容的 `3ee55538e3f`；新增不依赖 D7 的 r10-4，给它和 `restorePendingDeleteDraft` 加撰写态条件，替换两处断言，原稿 r10-1 第 5 步并入 r10-4。Minor 都已处理：r10-2 的用例改为每条写明旧代码怎样失败，去掉新旧都能过的新镜头恢复用例，改用叶级会话栏写下的草稿做恢复断言，并补了撰写态回滚时芯片被恢复的用例；不变量的 lease 限定已加；`applyActiveSession` 开头的标题编辑取消已经落地（274–276），r10-1 的相应步骤已改写；r10-3 的判据对照 `composer-and-inbox.md` 第 61 行重写，并加了补文档的步骤；与 p4-3 的先后写进「实施顺序与提交」第 2 条；`createHarness` 加可选名册参数；行号按改稿时回读重新定位，并提醒实施前按符号定位。另按本轮共性意见补了本地验证顺序（先编译、再测试、再 eslint，改文档再跑 docs-health）、按验收编号写的覆盖需求，以及提交时登记 `dev/plans/INDEX.md` 的步骤。

## 实施记录（2026-11-07）

用户同意实施，并要求不编译。本轮在当前工作区上改了 r10-1（按乙）、r10-2、r10-3、r10-4。没有编译，没有跑任何测试，没有跑 eslint 与 docs-health；类型靠逐个回读和核对调用方把关。被改的文件里有别的会话尚未提交的改动（例如 `applyActiveSession` 开头的标题编辑取消、`exitComposerEdit` 的回焦、会话栏接口里新增的浮层字段），都原样保留，本轮只做针对性修改。

### r10-4（已实施）

- `src/vs/workbench/contrib/conversation/browser/conversationLensSessionBar.ts`：`restorePendingDeleteDraft` 与 `deleteActiveSession` 同步被拒分支里的 `applyComposerSurfaceText`，条件加上 `host.composerPolicy === 'compose'`；编辑态只写草稿表。
- `src/vs/workbench/contrib/conversation/test/browser/conversationLens.test.ts`：`turnEdit deleteSession false keeps compose draft snapshot not bubble text` 的输入框断言改为仍是编辑正文 `B`、`composerPolicy` 仍是 `turnEdit`，再 `exitComposerEdit()` 后回到 `A`；新增 `turnEdit pending delete rollback without an active change keeps the edit text`（回滚只发会话变化）。
- `src/vs/workbench/contrib/conversation/test/browser/conversationComposerEditDraft.test.ts`：同名测试的输入框断言改为 `B`。
- `docs/systems/conversation/session-windows.md`：「删除确认与草稿归属」补一句编辑态删除被拒或回滚不覆盖编辑正文；`updated` 改为 2026-11-07。
- 与方案无出入。

### r10-2（已实施）

- `conversationLens.ts`：在 `composerRefResources` 后声明 `declare syncComposerRefs: (() => void) | undefined;`。出入：方案写的是「用 `declare` 声明可选的」，仓库里没有 `declare x?:` 的先例，改用不带 `?`、类型含 `undefined` 的写法，类型等价，同样不产生字段初始化。
- `conversationLeafSessionBar.ts`：`IConversationLeafPaneAccessors` 加可选的 `getComposerRefResources()` 与 `syncComposerRefs()`；`ConversationLeafSessionBar` 加 `composerRefResources` 取值器（每次经 accessor 取镜头上的同一个数组）和 `syncComposerRefs()`。
- `conversationEditorPane.ts`：实现上面两个 accessor，分别返回 `this.lens?.composerRefResources`、调用 `this.lens?.syncComposerRefs?.()`。
- `conversationLensSessionBar.ts`：`IConversationLensSessionBarHost` 声明可选的 `composerRefResources` 与 `syncComposerRefs`。共享函数体没改。
- `conversationLeafSessionBar.test.ts`：`createHarness` 加可选的名册参数（传实例，默认仍是 `QuietRosterService`）；新增 `RefusingDeleteRosterService`、`RollbackDeleteRosterService` 两个名册子类和 `waitForCondition` 轮询辅助；新增四条用例：叶级会话栏切会话写回带尾块并能从这份草稿恢复芯片、新建写回带尾块、删除被拒后草稿带尾块且芯片仍在、只发会话变化的回滚把芯片恢复到镜头。原稿里「新镜头恢复整段草稿」的用例按改稿结论没有写。
- `docs/systems/conversation/composer-and-inbox.md` §6：补一句草稿存整段、叶级会话栏写回同样带引用；`updated` 改为 2026-11-07。

### r10-3（已实施）

- `conversationLensComposer.ts`：`saveQueueEdit` 里新增 `stillEditingThisItem`（`composerPolicy` 为 `queueEdit`、`editingQueueItemId` 等于本链的项、`getBoundSessionId()` 等于本链的会话）；`finalize` 只在它成立时 `exitComposerEdit(true, false)`，总是 `renderInboxStatus()`；`failChain` 只在它成立时写失败。
- `conversationComposerEditDraft.test.ts`：四条既有测试（`saveQueueEdit keeps the draft and hold until the engine accepts the edit`、`saveQueueEdit releases the hold after the engine accepts the edit`、`saveQueueEdit accepted after the published link changes keeps the hold and reports delivery_unknown`、`saveQueueEdit confirming a loaded refs trailer does not rewrite it`）的宿主夹具补 `editingQueueItemId: 'q1'`，断言不变；新增三条：Release 结算时作曲器已转到回合编辑或另一项队列编辑（循环两种）不退出、Edit 被拒时作曲器已转到回合编辑不写失败。
- `conversationEngineRosterService.test.ts`：只给 `default editor queue edit signs off hold, edit, and release against a running engine` 与 `default editor queue edit keeps draft and hold when the running engine refuses the edit` 的宿主夹具补 `editingQueueItemId: 'q1'`，别的不动。
- `composer-and-inbox.md` §2 第 61 行队列编辑条目末尾补一句结算时作曲器已离开这一项只结束链。
- `conversationComposerAtChip.test.ts` 里那条 `saveQueueEdit` 的宿主没有 `editingQueueItemId`，它只断言保存的正文，判断不成立后不再调用 `exitComposerEdit`，断言不受影响，没有改。

### r10-1（按乙实施；甲未实施）

- D7 仍待用户拍板。本轮按乙：只修两扇窗口之间切焦点，叶被隐藏时照今天回来时的结果退出编辑。甲（隐藏时也保留编辑）要等用户就 D7 拍板后另做。
- `conversationLens.ts`：活动会话订阅分三支，绑定镜头收到自己的会话时调用新增的私有方法 `refreshReactivatedBoundSession`（只在没有本会话 lease 且未挂起时 `bindSessionView`，再刷新标题、Inbox、相位、门闩、配置控件可用态、发送钮、同步徽章；不调用 `syncSessionConfigSelects`、`refreshSessionSelectOptions`、`cancelSessionTitleEdit`）；`releaseSessionViewLeaseForHiddenLeaf` 在清 lease 之前，作曲器不在撰写态时 `exitComposerEdit(true, false)`。
- `conversationLens.test.ts`：新增 `seedHeldQueueItem` 辅助和六条用例：回到本会话时保留回合编辑、保留队列编辑与 EDITING 占位、保留失败行与轨迹状态与 lease、换绑仍退出编辑、隐藏时退出回合编辑、隐藏时退出队列编辑且占位不释放。
- `conversationLeafSessionBar.test.ts`：新增两条集成用例：两扇窗口间派发 `focusin` 往返后回合编辑仍在；经叶级会话栏切走（主叶隐藏）时回合编辑退出，切回后仍是撰写态与撰写草稿。
- `composer-and-inbox.md` §2 第 63 行那段之后补一段乙的写法，注明切走时的处理待 D7，叶从隐藏恢复时过程折展开与轨迹搜索仍会被清、是否应保留未定。
- 方案第 6 条要登记的缺口（叶从隐藏恢复同一会话时按首拉清掉过程折展开与轨迹搜索）由父 agent 写进 `dev/progress/deferred-gaps.md`，本轮没有改那张表。

### 依赖与提交顺序

- p4-3（`ConversationComposerModel`）还没落地。本轮新增的读取直接读宿主字段：`releaseSessionViewLeaseForHiddenLeaf` 读 `composerPolicy`，`saveQueueEdit` 的判断读 `composerPolicy` 与 `editingQueueItemId`，会话栏两处回填读 `composerPolicy`。p4-3b 落地时要把这几处列进读者清单。
- 被改文件里别的会话的未提交改动与本轮改动同在工作区，提交时按各自主题分开暂存，顺序留给提交时处理。
- 提交本方案时登记进 `dev/plans/INDEX.md`（父 agent 统一写）。

### 之后要跑的本地验证

1. `npm run compile`（只改局部 TypeScript 时可用 `npm run compile-client`）。
2. `./scripts/test.sh --run src/vs/workbench/contrib/conversation/test/browser/conversationLens.test.ts --run src/vs/workbench/contrib/conversation/test/browser/conversationLeafSessionBar.test.ts --run src/vs/workbench/contrib/conversation/test/browser/conversationComposerEditDraft.test.ts --run src/vs/workbench/contrib/conversation/test/browser/conversationEngineRosterService.test.ts --run src/vs/workbench/contrib/conversation/test/browser/conversationLensDisposeGate.test.ts --run src/vs/workbench/contrib/conversation/test/browser/conversationLensSessionBinding.test.ts --run src/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowService.test.ts --run src/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.ts --run src/vs/workbench/contrib/conversation/test/browser/conversationComposerAtChip.test.ts --run src/vs/workbench/contrib/conversation/test/browser/conversationIdentityStrip.test.ts`；合入前 `scripts/run-unit-custom.sh` 跑 conversation 域。
3. `npm run eslint`。
4. `python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`。

### 代码审查（2026-11-07）

只读代码审查的结论是可接受，只有 Minor，本轮都已处理，仍未编译、未跑测试。

- 隐藏后回来不再清失败行，与 `composer-and-inbox.md` 里失败行「切会话时也消失」矛盾：保持今天的结果，`releaseSessionViewLeaseForHiddenLeaf` 在退出编辑之后一并 `clearPostFailure()`、`timelineTree.clearTurnActionState()`、`resetInputHistoryBrowse()`。只重置浏览状态、不还原输入框，是因为撰写态浏览输入历史时召回的正文已经写进草稿（`navigateInputHistory`），今天回来时读回的就是这份草稿；文档新段同步写明这几样在隐藏时清掉，`bound leaf hidden during a turn edit…` 用例加了失败行被清的断言。
- 文档新段的隐藏来源不全：改成「含切到别的会话让位、点隐藏、被挤出并排」。
- `conversationLens.ts` 两处注释：订阅分支改为「绑定会话重新成为活动会话」并列出焦点回来、隐藏叶恢复、Sessions 列表激活三种来源；隐藏处理补上第二个不释放占位的理由（从 Sessions 列表切走时队列已是 `stale`，请求释放会被 `engineQueueEditMustKeepHold` 拦下，编辑退不出）。
- `refreshReactivatedBoundSession` 的重取分支补了两条用例：清掉 lease、未挂起时回到本会话会 `bindSessionView` 一次；隐藏挂起时不重取。
- `conversationLeafSessionBar.test.ts` 回滚夹具的注释改为照实描述：只模拟只发会话变化的路径，真实引擎回滚在挪过活动会话时会先发活动会话变化。
