/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import type { IUniverseAgentConnection } from '../common/universeAgentConnection.js';
import type {
	ConversationViewFrame,
	ConversationViewFrameApplied,
	ConversationWriteMessage,
	ItemAttribution,
} from '../common/conversationViewFrame.js';
import type { IUniverseAgentSessionViewFrameEvent } from '../common/universeAgentSessionView.js';
import { createSessionCore, type SessionCore } from './sessionCore/session-core.js';
import type { CoreIntent, HistoryFillCoreIntent } from './sessionCore/intents.js';
import { isChatCoreIntent, isHistoryFillCoreIntent } from './sessionCore/intents.js';
import type { CorrelationRef, ViewFrameSink } from './sessionCore/messages.js';
import type { SessionId, ViewFrame, ViewLeaseId } from '../common/sessionView/types.js';
import type { AttemptId } from './sessionCore/ports.js';
import { demuxSessionStreamPayload } from './sessionStreamDemux.js';
import {
	createSessionViewDiagnosticsPort,
	createSessionViewIdPort,
	NodeSchedulerPort,
} from './sessionViewHostPorts.js';

type ActiveStream = {
	readonly attemptId: AttemptId;
	readonly dispose: () => void;
};

type ActiveLease = {
	readonly sessionId: string;
	readonly leaseId: ViewLeaseId;
	readonly sink: ViewFrameSink;
};

function writeMessageToCoreFact(msg: ConversationWriteMessage, leaseId: ViewLeaseId): unknown {
	switch (msg.kind) {
		case 'submitInput':
			return {
				kind: 'submitInput',
				correlation: `corr:${Date.now()}` as CorrelationRef,
				payload: { text: msg.text, originLeaseId: leaseId },
			};
		case 'permissionRespond':
			return { kind: 'permissionRespond', requestId: msg.requestId, decision: msg.decision };
		case 'questionRespond':
			return {
				kind: 'questionRespond',
				questionId: msg.requestId,
				answers: Object.fromEntries(
					Object.entries(msg.answers).map(([key, value]) => [key, { selectedLabels: [value], multiSelect: false }]),
				),
				customText: '',
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
export class SessionViewHost extends Disposable {

	private readonly scheduler = this._register(new NodeSchedulerPort());
	private readonly ids = createSessionViewIdPort();
	private readonly diagnostics = createSessionViewDiagnosticsPort();
	private readonly core: SessionCore;
	private readonly leases = new Map<string, ActiveLease>();
	private readonly leaseAttribution = new Map<string, Map<string, ItemAttribution>>();
	private readonly streams = new Map<string, ActiveStream>();
	private connectionGeneration = 0;
	private connectionUp = false;

	private readonly _onDidApplyFrame = this._register(new Emitter<IUniverseAgentSessionViewFrameEvent>());
	readonly onDidApplyFrame = this._onDidApplyFrame.event;

	constructor(
		private readonly connection: IUniverseAgentConnection,
	) {
		super();
		this.core = createSessionCore({
			scheduler: this.scheduler,
			ids: this.ids,
			diagnostics: this.diagnostics,
		});
	}

	acquireLease(sessionId: string): string {
		const leaseId = this.ids.nextAttemptId() as unknown as ViewLeaseId;
		const sid = sessionId as SessionId;
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
		if (this.connectionUp) {
			this.postConnectionUp(sessionId);
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
		const fact = writeMessageToCoreFact(msg, binding.leaseId);
		const outcome = this.core.post(binding.sessionId as SessionId, { t: 'localFact', fact });
		if (outcome.accepted) {
			this.drainIntents(binding.sessionId);
			return { accepted: true as const, correlation: { id: String(outcome.correlation) } };
		}
		return { accepted: false as const, reason: outcome.reason };
	}

	requestResync(leaseId: string): void {
		const binding = this.leases.get(leaseId);
		if (!binding) {
			return;
		}
		this.core.post(binding.sessionId as SessionId, { t: 'requestResync', leaseId: binding.leaseId });
		this.drainIntents(binding.sessionId);
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

	private onFrameEnqueued(leaseId: ViewLeaseId, sessionId: string, frame: ViewFrame): void {
		const attributionMap = this.leaseAttribution.get(String(leaseId)) ?? new Map();
		const attributionPatches: Array<NonNullable<ConversationViewFrame['attribution']>[number]> = [];
		if (frame.body.kind === 'baseline') {
			for (const item of frame.body.snapshot.timeline) {
				const id = String(item.id);
				if (!attributionMap.has(id)) {
					const role = 'assistant' as const;
					attributionMap.set(id, { role });
					attributionPatches.push({ op: 'upsertAttribution', itemId: id, attribution: { role } });
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
		this._onDidApplyFrame.fire({ leaseId: String(leaseId), sessionId, frame: viewFrame, applied });
	}

	private drainIntents(sessionId: string): void {
		const intents = this.core.takeIntents();
		for (const intent of intents) {
			this.handleIntent(sessionId, intent);
		}
	}

	private handleIntent(sessionId: string, intent: CoreIntent): void {
		switch (intent.do) {
			case 'openStream':
				this.openStream(sessionId, intent.attemptId);
				break;
			case 'closeStream': {
				const active = this.streams.get(`${sessionId}:${intent.attemptId}`);
				active?.dispose();
				this.streams.delete(`${sessionId}:${intent.attemptId}`);
				break;
			}
			case 'ensureChatStream':
				this.core.post(sessionId as SessionId, {
					t: 'localFact',
					fact: { kind: 'chatStreamUp', chatAttemptId: intent.chatAttemptId },
				});
				this.drainIntents(sessionId);
				break;
			case 'closeChatStream':
				this.core.post(sessionId as SessionId, {
					t: 'localFact',
					fact: { kind: 'chatStreamDown', chatAttemptId: intent.chatAttemptId },
				});
				this.drainIntents(sessionId);
				break;
			default:
				if (isChatCoreIntent(intent) && intent.do === 'chatStreamWrite') {
					void this.writeChat(sessionId, intent.correlation, intent.payload);
				} else if (isHistoryFillCoreIntent(intent)) {
					void this.fillHistory(sessionId, intent);
				}
				break;
		}
	}

	private openStream(sessionId: string, attemptId: AttemptId): void {
		const key = `${sessionId}:${attemptId}`;
		const subscription = this.connection.subscribeSessionEventStream(sessionId, event => {
			const arms = demuxSessionStreamPayload(event.payload);
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
			}
		});
		this.streams.set(key, { attemptId, dispose: () => subscription.dispose() });
	}

	private async sendHeartbeatAck(sessionId: string): Promise<void> {
		if (!this.connection.isEngineConnected()) {
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

	private async writeChat(sessionId: string, correlation: CorrelationRef, payload: unknown): Promise<void> {
		const sid = sessionId as SessionId;
		if (!this.connection.isEngineConnected()) {
			this.core.post(sid, {
				t: 'localFact',
				fact: {
					kind: 'inputDelivery',
					messageId: String(correlation),
					status: 'failed',
					errorMessage: 'Engine not connected',
				},
			});
			this.drainIntents(sessionId);
			return;
		}
		try {
			await this.connection.chat({
				sessionId,
				payload: chatPayloadFromWrite(payload),
			}, () => {
				this.core.post(sid, {
					t: 'localFact',
					fact: {
						kind: 'inputDelivery',
						messageId: String(correlation),
						status: 'written',
					},
				});
				this.drainIntents(sessionId);
			});
		} catch {
			this.core.post(sid, {
				t: 'localFact',
				fact: {
					kind: 'inputDelivery',
					messageId: String(correlation),
					status: 'failed',
					errorMessage: 'Chat write failed',
				},
			});
			this.drainIntents(sessionId);
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
