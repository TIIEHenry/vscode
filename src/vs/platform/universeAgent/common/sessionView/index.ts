/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// VS Code-owned barrel for the vendored session-core `view/**` tree.
// Renderer-safe: view types + idempotent frame/patch apply only. It deliberately
// does NOT mirror upstream `view/index.ts`, which re-exports the Actor-side
// `pending-actions-bound` module (see dev/plans/conversation-stream-timeline.md §3.1).

export type {
	SessionId,
	ViewLeaseId,
	TimelineItemId,
	OverlayBlockId,
	ClientActionRequestId,
	OperationId,
	EffectId,
	TextChunkId,
	DetailRef,
	SyncChrome,
	ToolSummaryStatus,
	QuestionSummaryItem,
	TimelineCanvasRef,
	TimelineItemSummary,
	TimelineItemView,
	TextChunkView,
	OverlayBlockView,
	RuntimeOverlayView,
	PendingActionView,
	PendingSendView,
	LiveAgentStatusView,
	LiveAgentTreeNodeView,
	LiveAgentSnapshotRowView,
	BranchTopologyNoticeView,
	SessionViewSnapshot,
	ViewPatch,
	ViewEffect,
	ViewFrame,
} from './types.js';

export {
	applyViewFrame,
	applyViewPatch,
	applyViewPatches,
	createEmptyReplica,
	snapshotsEqual,
} from './apply.js';
export type { ReplicaCursor } from './apply.js';

export { emptySessionViewSnapshot } from './empty-snapshot.js';

export { CLIENT_TOOL_ARG_PREVIEW_MAX, timelineItemFromClientToolCall } from './client-tool-call.js';
export type { ClientToolCallChromeInput } from './client-tool-call.js';

export {
	QUESTION_ASK_FALLBACK_CHILD_KEY,
	QUESTION_ITEM_OPTIONS_PREVIEW_MAX,
	QUESTION_ITEMS_PREVIEW_MAX,
	QUESTION_OPTION_PREVIEW_MAX,
	projectQuestionAskItems,
	questionAskChildKey,
	questionAskItemId,
	questionAskPendingRequestId,
	timelineItemFromQuestionAsk,
	timelineItemsFromQuestionAsk,
} from './question-ask.js';
export type { QuestionAskChromeInput, QuestionAskItemsProjection } from './question-ask.js';

export { sortOverlayBlocksByOrderKey, deduplicateOverlayBlocks } from './overlay-view-helpers.js';
