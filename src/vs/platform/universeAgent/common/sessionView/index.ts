/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// VS Code-owned barrel for the vendored session-core `view/**` tree.
// Renderer-safe: view types + idempotent frame/patch apply only. It deliberately
// does NOT mirror upstream `view/index.ts`, which re-exports the Actor-side
// `pending-actions-bound` module (see dev/plans/conversation-stream-timeline.md §3.1).
//
// S1 scaffold: only type exports until `scripts/sync-session-core.sh` vendors
// apply.ts and the rest of view/**.

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
