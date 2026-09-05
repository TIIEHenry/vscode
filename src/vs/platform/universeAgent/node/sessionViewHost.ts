/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import type { IUniverseAgentConnection } from '../common/universeAgentConnection.js';
import type { IUniverseAgentHostConnection } from '../common/universeAgentHostConnection.js';
import {
	parseDetailRef,
	ToolDetailKind,
	type ConversationViewFrame,
	type ConversationViewFrameApplied,
	type ConversationWriteMessage,
	type DetailFetchOutcome,
	type ItemAttribution,
	type ItemCompactedAttribution,
	type ParsedDetailRef,
} from '../common/conversationViewFrame.js';
import type { IUniverseAgentSessionViewFrameEvent } from '../common/universeAgentSessionView.js';
import { createSessionCore, type SessionCore } from './sessionCore/session-core.js';
import type { CoreIntent, HistoryFillCoreIntent } from './sessionCore/intents.js';
import { isChatCoreIntent, isHistoryFillCoreIntent } from './sessionCore/intents.js';
import type { CorrelationRef, StreamCloseCause, ViewFrameAck, ViewFrameSink } from './sessionCore/messages.js';
import type { SessionId, ViewFrame, ViewLeaseId } from '../common/sessionView/types.js';
import type { AttemptId, TimerId } from './sessionCore/ports.js';
import type { UniverseAgentChatStream, UniverseAgentSessionStreamCloseCause } from '../common/universeAgentTypes.js';
import { demuxSessionStreamPayload, localFactFromQuestionArm } from './sessionStreamDemux.js';
import { OverlayDeltaJoin } from './overlayDeltaJoin.js';
import {
	iterL2EnvelopesFromStreamPayload,
	normalizeAttributionBranchReason,
	projectCompactFactsFromBranchReasonEnvelope,
	projectCompactFactsFromRangeReplaced,
	type CompactedEnvelopeFacts,
} from './compactedAttribution.js';
import {
	createSessionViewDiagnosticsPort,
	createSessionViewIdPort,
	NodeSchedulerPort,
} from './sessionViewHostPorts.js';
import { AgentTreeCoordinator, type AgentTreeBoundFact } from './agentTreeCoordinator.js';
import {
	FileMutationJoin,
	isMultiAgentStatusPayload,
	readTeamCreatedTeamId,
	shouldRefreshAgentTree,
} from './fileMutationJoin.js';

type ActiveStream = {
	readonly attemptId: AttemptId;
	readonly dispose: () => void;
	readonly sessionId: string;
};

type SessionSidecar = {
	readonly tree: AgentTreeCoordinator;
	readonly fileJoin: FileMutationJoin;
	readonly overlayDelta: OverlayDeltaJoin;
};

type ActiveChatStream = {
	readonly chatAttemptId: AttemptId;
	readonly write: (payload: unknown) => void;
	readonly dispose: () => void;
};

type ToolAttributionHint = {
	readonly itemId: string;
	readonly toolCallId?: string;
	readonly agentId?: string;
	readonly role?: ItemAttribution['role'];
	/** Protocol `branch_reason`; compact tokens are normalized to `'compact'`. */
	readonly branchReason?: string;
	/** P2b: three turn ids + optional SummaryBlock text. Browser never sets this. */
	readonly compacted?: ItemCompactedAttribution;
};

type ActiveLease = {
	readonly sessionId: string;
	readonly leaseId: ViewLeaseId;
	readonly sink: ViewFrameSink;
};

function writeMessageToCoreFact(msg: ConversationWriteMessage, leaseId: ViewLeaseId, correlation: CorrelationRef): unknown {
	switch (msg.kind) {
		case 'submitInput':
			return {
				kind: 'submitInput',
				correlation,
				payload: { text: msg.text, originLeaseId: leaseId },
			};
		case 'permissionRespond':
			return { kind: 'permissionRespond', requestId: msg.requestId, decision: msg.decision };
		case 'questionRespond':
			return {
				kind: 'questionRespond',
				questionId: msg.requestId,
				answers: Object.fromEntries(
					Object.entries(msg.answers).map(([key, value]) => [key, { selectedLabels: value.selectedLabels, multiSelect: value.selectedLabels.length > 1 }]),
				),
				customText: msg.customText ?? '',
			};
		case 'clientToolRespond':
			return {
				kind: 'clientToolRespond',
				callId: msg.requestId,
				isError: false,
				content: msg.resultJson,
			};
	}
}

function chatPayloadFromWrite(payload: unknown): Record<string, unknown> {
	if (payload !== null && typeof payload === 'object' && !Array.isArray(payload)) {
		return payload as Record<string, unknown>;
	}
	return { session_input: payload };
}

/**
 * Node-side session-core host: SessionEventStream + Actor + lease sinks (S4/S5).
 */
export type SessionViewHostOptions = {
	readonly lingerMs?: number;
	readonly chatFlushTimeoutMs?: number;
};

export class SessionViewHost extends Disposable {

	private readonly scheduler = this._register(new NodeSchedulerPort(timerId => this.onHostTimerFired(timerId)));
	private readonly ids = createSessionViewIdPort();
	private readonly diagnostics = createSessionViewDiagnosticsPort();
	private readonly core: SessionCore;
	private readonly leases = new Map<string, ActiveLease>();
	private readonly leaseAttribution = new Map<string, Map<string, ItemAttribution>>();
	private readonly leaseDetails = new Map<string, Map<string, string>>();
	private readonly capturedDetails = new Map<string, Map<string, ParsedDetailRef>>();
	private readonly streams = new Map<string, ActiveStream>();
	private readonly chatStreams = new Map<string, ActiveChatStream>();
	private readonly sessionSidecars = new Map<string, SessionSidecar>();
	private readonly knownSessions = new Set<string>();
	private readonly attemptOwners = new Map<string, string>();
	private readonly chatOwners = new Map<string, string>();
	private readonly toolAttributionHints = new Map<string, ToolAttributionHint[]>();
	private readonly timerOwners = new Map<TimerId, string>();
	private connectionGeneration = 0;
	private connectionUp = false;

	private readonly _onDidApplyFrame = this._register(new Emitter<IUniverseAgentSessionViewFrameEvent>());
	readonly onDidApplyFrame = this._onDidApplyFrame.event;

	constructor(
		private readonly connection: IUniverseAgentConnection,
		private readonly host: IUniverseAgentHostConnection,
		options?: SessionViewHostOptions,
	) {
		super();
		this.core = createSessionCore({
			scheduler: this.scheduler,
			ids: this.ids,
			diagnostics: this.diagnostics,
			lingerMs: options?.lingerMs,
			chatFlushTimeoutMs: options?.chatFlushTimeoutMs,
		});
		this._register(host.onRequestAgentTreeRefresh(({ sessionId }) => {
			this.scheduleAgentTreeRefresh(sessionId);
		}));
	}

	acquireLease(sessionId: string): string {
		const leaseId = this.ids.nextAttemptId() as unknown as ViewLeaseId;
		const sid = sessionId as SessionId;
		this.knownSessions.add(sessionId);
		this.core.ensureSession(sid);
		const sink: ViewFrameSink = {
			enqueue: frame => this.onFrameEnqueued(leaseId, sessionId, frame),
			acknowledge: () => { },
		};
		const outcome = this.core.post(sid, { t: 'acquireLease', leaseId, sink });
		if (!outcome.accepted) {
			throw new Error(`acquireLease rejected: ${outcome.reason}`);
		}
		this.drainIntents(sessionId);
		this.leases.set(String(leaseId), { sessionId, leaseId, sink });
		this.leaseAttribution.set(String(leaseId), new Map());
		this.leaseDetails.set(String(leaseId), new Map());
		this.ensureSessionSidecar(sessionId);
		if (this.connectionUp) {
			this.postConnectionUp(sessionId);
			this.scheduleAgentTreeRefresh(sessionId, true);
		}
		return String(leaseId);
	}

	releaseLease(leaseId: string): void {
		const binding = this.leases.get(leaseId);
		if (!binding) {
			return;
		}
		this.leases.delete(leaseId);
		this.leaseAttribution.delete(leaseId);
		this.leaseDetails.delete(leaseId);
		const outcome = this.core.post(binding.sessionId as SessionId, { t: 'releaseLease', leaseId: binding.leaseId });
		if (outcome.accepted) {
			this.drainIntents(binding.sessionId);
		}
	}

	post(leaseId: string, msg: ConversationWriteMessage) {
		const binding = this.leases.get(leaseId);
		if (!binding) {
			return { accepted: false as const, reason: 'no_such_session' as const };
		}
		if (!this.connection.isEngineConnected()) {
			return { accepted: false as const, reason: 'not_authenticated' as const };
		}
		const fact = writeMessageToCoreFact(msg, binding.leaseId, this.ids.nextWriteId() as unknown as CorrelationRef);
		const outcome = this.core.post(binding.sessionId as SessionId, { t: 'localFact', fact });
		if (outcome.accepted) {
			this.drainIntents(binding.sessionId);
			return { accepted: true as const, correlation: { id: String(outcome.correlation) } };
		}
		return { accepted: false as const, reason: outcome.reason };
	}

	acknowledge(leaseId: string, ack: ViewFrameAck): void {
		const binding = this.leases.get(leaseId);
		if (!binding) {
			return;
		}
		const outcome = this.core.post(binding.sessionId as SessionId, {
			t: 'frameAck',
			leaseId: binding.leaseId,
			generation: ack.generation,
			frameId: ack.frameId,
			appliedVersion: ack.appliedVersion,
			...(ack.effectIds !== undefined ? { effectIds: ack.effectIds } : {}),
		});
		if (outcome.accepted) {
			this.drainIntents(binding.sessionId);
		}
	}

	requestResync(leaseId: string): void {
		const binding = this.leases.get(leaseId);
		if (!binding) {
			return;
		}
		this.core.post(binding.sessionId as SessionId, { t: 'requestResync', leaseId: binding.leaseId });
		this.drainIntents(binding.sessionId);
	}

	async requestDetail(leaseId: string, ref: string): Promise<DetailFetchOutcome> {
		const binding = this.leases.get(leaseId);
		if (!binding) {
			return { ok: false, reason: 'failed', message: 'no such lease' };
		}
		const parsed = parseDetailRef(ref) ?? this.lookupCapturedDetail(binding.sessionId, ref);
		if (!parsed) {
			return { ok: false, reason: 'failed', message: 'unparseable DetailRef' };
		}
		const result = await this.host.fetchToolDetail({
			sessionId: binding.sessionId,
			toolCallId: parsed.toolCallId,
			detailKind: parsed.detailKind,
			refId: parsed.refId,
		});
		if (!result.ok) {
			return result;
		}
		const details = this.leaseDetails.get(leaseId) ?? new Map();
		details.set(ref, result.content);
		this.leaseDetails.set(leaseId, details);
		return {
			ok: true,
			truncated: result.truncated,
			content: result.content,
			...(result.totalBytes !== undefined ? { totalBytes: result.totalBytes } : {}),
		};
	}

	onEngineConnectionChanged(): void {
		if (this.connection.isEngineConnected()) {
			this.connectionGeneration += 1;
			this.connectionUp = true;
			for (const binding of this.leases.values()) {
				this.postConnectionUp(binding.sessionId);
			}
		} else {
			this.connectionUp = false;
			for (const stream of this.streams.values()) {
				stream.dispose();
			}
			this.streams.clear();
			for (const stream of this.chatStreams.values()) {
				stream.dispose();
			}
			this.chatStreams.clear();
			for (const binding of this.leases.values()) {
				this.core.post(binding.sessionId as SessionId, {
					t: 'connectionDown',
					reason: { kind: 'transport' },
				});
				this.drainIntents(binding.sessionId);
			}
		}
	}

	private postConnectionUp(sessionId: string): void {
		const sid = sessionId as SessionId;
		this.core.ensureSession(sid);
		const outcome = this.core.post(sid, {
			t: 'connectionUp',
			connectionGeneration: this.connectionGeneration,
		});
		if (outcome.accepted) {
			this.core.post(sid, { t: 'localFact', fact: { kind: 'rootAgentBound', agentId: 'default' } });
			this.drainIntents(sessionId);
		}
	}

	private ensureSessionSidecar(sessionId: string): SessionSidecar {
		let sidecar = this.sessionSidecars.get(sessionId);
		if (!sidecar) {
			sidecar = {
				tree: new AgentTreeCoordinator(sessionId, this.host),
				fileJoin: new FileMutationJoin(sessionId),
				overlayDelta: new OverlayDeltaJoin(),
			};
			this.sessionSidecars.set(sessionId, sidecar);
		}
		return sidecar;
	}

	private postAgentTreeBound(sessionId: string, fact: AgentTreeBoundFact): void {
		const sid = sessionId as SessionId;
		this.core.post(sid, { t: 'localFact', fact });
		this.drainIntents(sessionId);
	}

	private scheduleAgentTreeRefresh(sessionId: string, immediate = false): void {
		if (!this.connection.isEngineConnected() || this.host.isAgentTreeUnsupported()) {
			return;
		}
		const sidecar = this.ensureSessionSidecar(sessionId);
		const onBound = (fact: AgentTreeBoundFact) => this.postAgentTreeBound(sessionId, fact);
		if (immediate) {
			void sidecar.tree.pullNow(onBound);
		} else {
			sidecar.tree.scheduleRefresh(onBound);
		}
	}

	private handleHostStreamPayload(sessionId: string, payload: unknown): void {
		const sidecar = this.ensureSessionSidecar(sessionId);

		if (shouldRefreshAgentTree(payload)) {
			this.scheduleAgentTreeRefresh(sessionId);
		}

		const teamId = readTeamCreatedTeamId(payload);
		if (teamId !== undefined) {
			this.core.post(sessionId as SessionId, {
				t: 'localFact',
				fact: { kind: 'teamIdBound', teamId },
			});
			this.drainIntents(sessionId);
		}

		if (isMultiAgentStatusPayload(payload)) {
			this.host.notifyTeamRuntimeChange(sessionId);
		}

		sidecar.fileJoin.handleStreamPayload(payload, record => {
			this.host.notifyFileMutation(record);
		}, signal => {
			this.host.notifyTurnSettle({
				sessionId,
				runtimeTurnId: signal.runtimeTurnId,
				assistantTurnId: signal.assistantTurnId,
			});
		});

		this.captureToolAttributionHint(sessionId, payload);
		this.captureEnvelopeAttributionHint(sessionId, payload);
		this.captureRangeReplacedCompactHint(sessionId, payload);
		this.captureDetailRefHint(sessionId, payload);
	}

	private captureToolAttributionHint(sessionId: string, payload: unknown): void {
		if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
			return;
		}
		const record = payload as Record<string, unknown>;
		const lifecycle = record.tool_call_lifecycle ?? record.toolCallLifecycle;
		if (lifecycle && typeof lifecycle === 'object') {
			const body = lifecycle as object;
			const toolCallId = readPayloadField(body, 'tool_call_id', 'toolCallId');
			const turnId = readPayloadField(body, 'turn_id', 'turnId');
			const agentId = readPayloadField(body, 'agent_id', 'agentId');
			if (typeof toolCallId === 'string' && toolCallId) {
				const hints = this.toolAttributionHints.get(sessionId) ?? [];
				hints.push({
					itemId: typeof turnId === 'string' ? turnId : toolCallId,
					toolCallId,
					agentId: typeof agentId === 'string' ? agentId : undefined,
				});
				this.toolAttributionHints.set(sessionId, hints);
			}
		}
	}

	private captureEnvelopeAttributionHint(sessionId: string, payload: unknown): void {
		const envelopes = iterL2EnvelopesFromStreamPayload(payload);
		if (envelopes.length === 0 && isBareHistoryEnvelope(payload)) {
			this.mergeEnvelopeHint(sessionId, payload);
			return;
		}
		for (const envelope of envelopes) {
			this.mergeEnvelopeHint(sessionId, envelope);
		}
	}

	/**
	 * Path 1 producer: `branch_reason='compact'` (or wire `compaction`) on an L2 envelope.
	 * Non-compact branch_reason / role / agent_id still land as ordinary attribution.
	 */
	private mergeEnvelopeHint(sessionId: string, envelope: unknown): void {
		if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope)) {
			return;
		}
		const compact = projectCompactFactsFromBranchReasonEnvelope(envelope);
		if (compact) {
			this.mergeCompactFactsHint(sessionId, compact);
			return;
		}
		const id = readPayloadField(envelope, 'id');
		if (typeof id !== 'string' || !id) {
			return;
		}
		const branchReason = normalizeAttributionBranchReason(readPayloadField(envelope, 'branch_reason', 'branchReason'));
		const agentId = readPayloadField(envelope, 'agent_id', 'agentId');
		const role = normalizeAttributionRole(readPayloadField(envelope, 'role'));
		if (!branchReason && !role && typeof agentId !== 'string') {
			return;
		}
		this.mergeHint(sessionId, {
			itemId: id,
			role,
			agentId: typeof agentId === 'string' ? agentId : undefined,
			branchReason,
		});
	}

	/**
	 * Path 2 producer: `EnvelopeRangeReplaced(reason=COMPACT)` alone is sufficient.
	 * BRANCH_NOTICE is not consulted for identity.
	 */
	private captureRangeReplacedCompactHint(sessionId: string, payload: unknown): void {
		for (const facts of projectCompactFactsFromRangeReplaced(payload)) {
			this.mergeCompactFactsHint(sessionId, facts);
		}
	}

	private mergeCompactFactsHint(sessionId: string, facts: CompactedEnvelopeFacts): void {
		this.mergeHint(sessionId, {
			itemId: facts.itemId,
			role: facts.role,
			agentId: facts.agentId,
			branchReason: facts.branchReason,
			compacted: facts.compacted,
		});
	}

	private mergeHint(sessionId: string, incoming: ToolAttributionHint): void {
		const hints = this.toolAttributionHints.get(sessionId) ?? [];
		const index = hints.findIndex(hint => hint.itemId === incoming.itemId);
		if (index < 0) {
			hints.push(incoming);
		} else {
			const existing = hints[index];
			hints[index] = {
				itemId: incoming.itemId,
				toolCallId: incoming.toolCallId ?? existing.toolCallId,
				agentId: incoming.agentId ?? existing.agentId,
				role: incoming.role ?? existing.role,
				branchReason: incoming.branchReason ?? existing.branchReason,
				compacted: incoming.compacted ?? existing.compacted,
			};
		}
		this.toolAttributionHints.set(sessionId, hints);
	}

	private captureDetailRefHint(sessionId: string, payload: unknown): void {
		if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
			return;
		}
		const record = payload as Record<string, unknown>;
		const snapshot = record.tool_runtime_snapshot ?? record.toolRuntimeSnapshot ?? record;
		if (snapshot === null || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
			return;
		}
		const toolCallId = readPayloadField(snapshot, 'tool_call_id', 'toolCallId');
		if (typeof toolCallId !== 'string' || !toolCallId) {
			return;
		}
		const refFields = [
			readPayloadField(snapshot, 'detail_ref', 'detailRef'),
			readPayloadField(snapshot, 'output_ref', 'outputRef'),
			readPayloadField(snapshot, 'preview_ref', 'previewRef'),
			readPayloadField(snapshot, 'page_ref', 'pageRef'),
			readPayloadField(snapshot, 'transcript_ref', 'transcriptRef'),
		];
		const filePayload = readPayloadField(snapshot, 'file_mutation_payload', 'fileMutationPayload');
		if (filePayload && typeof filePayload === 'object') {
			refFields.push(readPayloadField(filePayload, 'preview_ref', 'previewRef'));
		}
		for (const field of refFields) {
			const parsed = readCapturedDetailRef(toolCallId, field);
			if (parsed) {
				this.storeCapturedDetail(sessionId, parsed);
			}
		}
	}

	private storeCapturedDetail(sessionId: string, parsed: ParsedDetailRef): void {
		const bySession = this.capturedDetails.get(sessionId) ?? new Map();
		bySession.set(parsed.refId, parsed);
		bySession.set(parsed.toolCallId, parsed);
		this.capturedDetails.set(sessionId, bySession);
	}

	private lookupCapturedDetail(sessionId: string, ref: string): ParsedDetailRef | undefined {
		return this.capturedDetails.get(sessionId)?.get(ref);
	}

	private onFrameEnqueued(leaseId: ViewLeaseId, sessionId: string, frame: ViewFrame): void {
		const attributionMap = this.leaseAttribution.get(String(leaseId)) ?? new Map();
		const attributionPatches: Array<NonNullable<ConversationViewFrame['attribution']>[number]> = [];
		const hints = this.toolAttributionHints.get(sessionId) ?? [];
		if (frame.body.kind === 'baseline') {
			for (const item of frame.body.snapshot.timeline) {
				const id = String(item.id);
				if (!attributionMap.has(id)) {
					const hint = findAttributionHint(hints, id, item.turnId);
					const role = hint?.role ?? 'assistant';
					const attribution = attributionFromHint(hint, role);
					attributionMap.set(id, attribution);
					attributionPatches.push({ op: 'upsertAttribution', itemId: id, attribution });
				}
			}
		} else if (frame.body.kind === 'patches') {
			for (const patch of frame.body.patches) {
				if (patch.op === 'upsertTimelineItem') {
					const id = String(patch.item.id);
					const summary = patch.item.summary;
					const hint = findAttributionHint(hints, id, patch.item.turnId);
					const isCompactRow = hint?.branchReason === 'compact' || hint?.compacted !== undefined;
					if (summary.kind === 'tool' || isCompactRow) {
						const attribution = attributionFromHint(hint, hint?.role ?? (summary.kind === 'tool' ? 'tool' : 'system'));
						attributionMap.set(id, attribution);
						attributionPatches.push({ op: 'upsertAttribution', itemId: id, attribution });
					}
				}
			}
		}
		const viewFrame: ConversationViewFrame = { frame, attribution: attributionPatches.length ? attributionPatches : undefined };
		let applied: ConversationViewFrameApplied;
		if (frame.body.kind === 'baseline') {
			applied = { kind: 'baseline' };
		} else if (frame.body.kind === 'patches') {
			const changedIds = new Set<string>();
			for (const patch of frame.body.patches) {
				if (patch.op === 'upsertTimelineItem') {
					changedIds.add(String(patch.item.id));
				} else if (patch.op === 'removeTimelineItem') {
					changedIds.add(String(patch.itemId));
				} else {
					changedIds.add(String(patch.op));
				}
			}
			applied = { kind: 'patches', changedIds };
		} else {
			applied = { kind: 'effects', effects: frame.body.effects };
		}
		// ProxyChannel fans this to every window; each renderer filters by leaseId.
		this._onDidApplyFrame.fire({ leaseId: String(leaseId), sessionId, frame: viewFrame, applied });
	}

	private drainIntents(hintSessionId: string): void {
		const intents = this.core.takeIntents();
		for (const intent of intents) {
			this.handleIntent(this.resolveIntentSession(intent, hintSessionId), intent);
		}
	}

	private resolveIntentSession(intent: CoreIntent, fallback: string): string {
		switch (intent.do) {
			case 'openStream':
				return this.findSessionBy(sid => this.core.attemptId(sid as SessionId) === intent.attemptId) ?? fallback;
			case 'closeStream': {
				for (const stream of this.streams.values()) {
					if (stream.attemptId === intent.attemptId) {
						return stream.sessionId;
					}
				}
				return this.attemptOwners.get(String(intent.attemptId)) ?? fallback;
			}
			case 'startTimer':
			case 'cancelTimer': {
				const owned = this.timerOwners.get(intent.timerId);
				if (owned) {
					return owned;
				}
				const id = String(intent.timerId);
				if (id.startsWith('linger:')) {
					return id.slice('linger:'.length) || fallback;
				}
				if (id.startsWith('chat-flush:')) {
					const rest = id.slice('chat-flush:'.length);
					const cut = rest.lastIndexOf(':');
					return cut > 0 ? rest.slice(0, cut) : fallback;
				}
				return fallback;
			}
			case 'ensureChatStream':
			case 'closeChatStream':
				return this.chatOwners.get(String(intent.chatAttemptId))
					?? this.findSessionBy(sid => this.core.chatAttemptId(sid as SessionId) === intent.chatAttemptId)
					?? fallback;
			case 'chatStreamWrite':
				return this.chatOwners.get(String(intent.chatAttemptId))
					?? this.findSessionBy(sid => this.core.chatAttemptId(sid as SessionId) === intent.chatAttemptId)
					?? fallback;
			case 'fillHistoryGap':
				return this.attemptOwners.get(String(intent.attemptId))
					?? this.findSessionBy(sid => this.core.attemptId(sid as SessionId) === intent.attemptId)
					?? fallback;
			case 'unaryCommand':
				return intent.sessionId || fallback;
			case 'openContinuationStream':
				return fallback;
		}
	}

	private findSessionBy(predicate: (sessionId: string) => boolean): string | undefined {
		for (const sessionId of this.knownSessions) {
			if (predicate(sessionId)) {
				return sessionId;
			}
		}
		for (const lease of this.leases.values()) {
			if (predicate(lease.sessionId)) {
				return lease.sessionId;
			}
		}
		return undefined;
	}

	private handleIntent(sessionId: string, intent: CoreIntent): void {
		switch (intent.do) {
			case 'openStream':
				this.attemptOwners.set(String(intent.attemptId), sessionId);
				this.openStream(sessionId, intent.attemptId);
				break;
			case 'closeStream': {
				const active = this.streams.get(`${sessionId}:${intent.attemptId}`);
				active?.dispose();
				this.streams.delete(`${sessionId}:${intent.attemptId}`);
				break;
			}
			case 'startTimer':
				this.timerOwners.set(intent.timerId, sessionId);
				this.scheduler.startTimer(intent.timerId, intent.delayMs);
				break;
			case 'cancelTimer':
				this.scheduler.cancelTimer(intent.timerId);
				this.timerOwners.delete(intent.timerId);
				break;
			case 'ensureChatStream':
				this.openResidentChat(sessionId, intent.chatAttemptId);
				break;
			case 'closeChatStream':
				this.closeResidentChat(sessionId, intent.chatAttemptId);
				break;
			default:
				if (isChatCoreIntent(intent) && intent.do === 'chatStreamWrite') {
					void this.writeChat(sessionId, intent.correlation, intent.payload, intent.chatAttemptId);
				} else if (isHistoryFillCoreIntent(intent)) {
					void this.fillHistory(sessionId, intent);
				}
				break;
		}
	}

	private onHostTimerFired(timerId: TimerId): void {
		const sessionId = this.timerOwners.get(timerId);
		this.timerOwners.delete(timerId);
		if (!sessionId) {
			return;
		}
		const outcome = this.core.post(sessionId as SessionId, { t: 'timerFired', timerId });
		if (outcome.accepted) {
			this.drainIntents(sessionId);
		}
	}

	private postStreamClosed(sessionId: string, attemptId: AttemptId, cause: StreamCloseCause): void {
		const outcome = this.core.post(sessionId as SessionId, {
			t: 'streamClosed',
			attemptId,
			cause,
		});
		if (outcome.accepted) {
			this.drainIntents(sessionId);
		}
	}

	private openStream(sessionId: string, attemptId: AttemptId): void {
		const key = `${sessionId}:${attemptId}`;
		let streamOpened = false;
		let disposed = false;
		const subscription = this.connection.subscribeSessionEventStream(sessionId, event => {
			if (!streamOpened) {
				streamOpened = true;
				this.scheduleAgentTreeRefresh(sessionId, true);
			}
			this.handleHostStreamPayload(sessionId, event.payload);
			const sidecar = this.ensureSessionSidecar(sessionId);
			const arms = [
				...demuxSessionStreamPayload(event.payload),
				...sidecar.overlayDelta.handlePayload(event.payload),
			];
			for (const arm of arms) {
				if (arm && typeof arm === 'object' && (arm as { arm?: string }).arm === 'heartbeat') {
					void this.sendHeartbeatAck(sessionId);
					continue;
				}
				this.core.post(sessionId as SessionId, {
					t: 'streamEvent',
					attemptId,
					event: arm,
				});
				this.drainIntents(sessionId);
				const questionFact = localFactFromQuestionArm(arm);
				if (questionFact) {
					this.core.post(sessionId as SessionId, { t: 'localFact', fact: questionFact });
					this.drainIntents(sessionId);
				}
			}
		}, cause => {
			if (disposed) {
				return;
			}
			this.postStreamClosed(sessionId, attemptId, streamCloseCauseFromTransport(cause));
		});
		this.streams.set(key, {
			attemptId,
			sessionId,
			dispose: () => {
				disposed = true;
				subscription.dispose();
			},
		});
	}

	private openResidentChat(sessionId: string, chatAttemptId: AttemptId): void {
		this.chatOwners.set(String(chatAttemptId), sessionId);
		const existing = this.chatStreams.get(sessionId);
		if (existing && existing.chatAttemptId === chatAttemptId) {
			this.postChatLifecycle(sessionId, 'chatStreamUp', chatAttemptId);
			return;
		}
		existing?.dispose();
		this.chatStreams.delete(sessionId);

		const open = this.connection.openChatStream;
		if (typeof open !== 'function') {
			this.postChatLifecycle(sessionId, 'chatStreamUp', chatAttemptId);
			return;
		}

		let disposed = false;
		const handle: UniverseAgentChatStream = open.call(this.connection, sessionId, () => { }, cause => {
			if (disposed) {
				return;
			}
			this.chatStreams.delete(sessionId);
			this.postChatLifecycle(sessionId, 'chatStreamDown', chatAttemptId);
			void cause;
		});
		this.chatStreams.set(sessionId, {
			chatAttemptId,
			write: payload => handle.write(payload),
			dispose: () => {
				disposed = true;
				handle.dispose();
			},
		});
		this.postChatLifecycle(sessionId, 'chatStreamUp', chatAttemptId);
	}

	private closeResidentChat(sessionId: string, chatAttemptId: AttemptId): void {
		const stream = this.chatStreams.get(sessionId);
		if (stream && stream.chatAttemptId === chatAttemptId) {
			stream.dispose();
			this.chatStreams.delete(sessionId);
		}
		this.postChatLifecycle(sessionId, 'chatStreamDown', chatAttemptId);
	}

	private postChatLifecycle(sessionId: string, kind: 'chatStreamUp' | 'chatStreamDown', chatAttemptId: AttemptId): void {
		this.core.post(sessionId as SessionId, {
			t: 'localFact',
			fact: { kind, chatAttemptId },
		});
		this.drainIntents(sessionId);
	}

	private async sendHeartbeatAck(sessionId: string): Promise<void> {
		if (!this.connection.isEngineConnected()) {
			return;
		}
		const resident = this.chatStreams.get(sessionId);
		if (resident) {
			resident.write({ heartbeat_ack: {} });
			return;
		}
		try {
			await this.connection.chat({
				sessionId,
				payload: { heartbeat_ack: {} },
			}, () => { });
		} catch {
			// transport failure surfaces on next RPC
		}
	}

	private async writeChat(sessionId: string, correlation: CorrelationRef, payload: unknown, chatAttemptId: AttemptId): Promise<void> {
		const sid = sessionId as SessionId;
		const mark = (status: 'written' | 'failed', errorMessage?: string) => {
			this.core.post(sid, {
				t: 'localFact',
				fact: {
					kind: 'inputDelivery',
					messageId: String(correlation),
					status,
					...(errorMessage !== undefined ? { errorMessage } : {}),
				},
			});
			this.drainIntents(sessionId);
		};
		if (!this.connection.isEngineConnected()) {
			mark('failed', 'Engine not connected');
			return;
		}
		const resident = this.chatStreams.get(sessionId);
		if (resident && resident.chatAttemptId === chatAttemptId) {
			try {
				resident.write(chatPayloadFromWrite(payload));
				mark('written');
			} catch {
				mark('failed', 'Chat write failed');
			}
			return;
		}
		try {
			await this.connection.chat({
				sessionId,
				payload: chatPayloadFromWrite(payload),
			}, () => {
				mark('written');
			});
		} catch {
			mark('failed', 'Chat write failed');
		}
	}

	private async fillHistory(sessionId: string, intent: HistoryFillCoreIntent): Promise<void> {
		const sid = sessionId as SessionId;
		try {
			const result = await this.connection.getHistory({
				sessionId,
				limit: Math.max(1, intent.toInclusive - intent.fromExclusive),
			});
			const envelopes = result.envelopes.map(row => ({
				cursorSeq: row.cursorSeq,
				payload: row.payload,
			}));
			for (const row of envelopes) {
				this.captureEnvelopeAttributionHint(sessionId, row.payload);
				this.captureRangeReplacedCompactHint(sessionId, row.payload);
			}
			this.core.post(sid, {
				t: 'historyResult',
				attemptId: intent.attemptId,
				requestId: intent.requestId,
				result: { ok: true, envelopes },
			});
		} catch {
			this.core.post(sid, {
				t: 'historyResult',
				attemptId: intent.attemptId,
				requestId: intent.requestId,
				result: { ok: false, code: 'transport_failed' },
			});
		}
		this.drainIntents(sessionId);
	}
}

function streamCloseCauseFromTransport(cause: UniverseAgentSessionStreamCloseCause): StreamCloseCause {
	return cause.kind === 'remote' ? { kind: 'remote' } : { kind: 'error', message: cause.message };
}

function attributionFromHint(hint: ToolAttributionHint | undefined, role: ItemAttribution['role']): ItemAttribution {
	return {
		role,
		...(hint?.toolCallId ? { toolCallId: hint.toolCallId } : {}),
		...(hint?.agentId ? { agentId: hint.agentId } : {}),
		...(hint?.branchReason ? { branchReason: hint.branchReason } : {}),
		...(hint?.compacted ? { compacted: hint.compacted } : {}),
	};
}

function findAttributionHint(hints: readonly ToolAttributionHint[], itemId: string, turnId?: string): ToolAttributionHint | undefined {
	return hints.find(hint =>
		hint.itemId === itemId
		|| hint.toolCallId === itemId
		|| hint.compacted?.compactBranchTurnId === itemId
		|| (turnId !== undefined && hint.compacted?.compactBranchTurnId === String(turnId))
	);
}

function isBareHistoryEnvelope(payload: unknown): boolean {
	if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
		return false;
	}
	const id = readPayloadField(payload, 'id');
	if (typeof id !== 'string' || !id) {
		return false;
	}
	return readPayloadField(payload, 'blocks') !== undefined
		|| readPayloadField(payload, 'branch_reason', 'branchReason') !== undefined;
}

function normalizeAttributionRole(value: unknown): ItemAttribution['role'] | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}
	switch (value.toLowerCase()) {
		case 'user':
			return 'user';
		case 'assistant':
			return 'assistant';
		case 'system':
			return 'system';
		case 'tool':
			return 'tool';
		default:
			return undefined;
	}
}

function readCapturedDetailRef(toolCallId: string, value: unknown): ParsedDetailRef | undefined {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return undefined;
	}
	const refId = readPayloadField(value, 'ref_id', 'refId');
	if (typeof refId !== 'string' || !refId) {
		return undefined;
	}
	const kind = readPayloadField(value, 'kind', 'detail_kind', 'detailKind');
	const detailKind = typeof kind === 'number' && Number.isFinite(kind) ? kind : ToolDetailKind.TOOL_DETAIL;
	return { toolCallId, detailKind, refId };
}

function readPayloadField(record: object, ...keys: string[]): unknown {
	for (const key of keys) {
		const desc = Object.getOwnPropertyDescriptor(record, key);
		if (desc !== undefined && Object.hasOwn(desc, 'value')) {
			return desc.value;
		}
	}
	return undefined;
}
