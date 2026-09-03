/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Minimal proto → domain demux for SessionEventStream (M6-A2 / stream-timeline S4 / M7 P2b).
 * Handles the arms session-core Actor recognises for baseline sync, plus L2
 * `envelope_range_replaced` → `rangeReplaced` (path-2 compact identity is applied
 * in `compactedAttribution.ts`, not here).
 * L3 `runtime_overlay_snapshot` → overlay pending / activeTurn / clear (SSOT with
 * OverlayDeltaJoin: demux owns snapshots; join owns incremental deltas).
 * L4 `ask_user_question` → `question` arm; host posts `questionAsked` via
 * `localFactFromQuestionArm` (Actor does not fold `arm:'question'`).
 * Unknown arms are dropped at the host.
 */

function readOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key);
	if (desc === undefined || desc.get !== undefined || desc.set !== undefined || !Object.hasOwn(desc, 'value')) {
		return undefined;
	}
	return desc.value;
}

function readField(record: object, ...keys: string[]): unknown {
	for (const key of keys) {
		const value = readOwnDataValue(record, key);
		if (value !== undefined) {
			return value;
		}
	}
	return undefined;
}

function isRecord(value: unknown): value is object {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isExactToken(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function admitTurnId(value: unknown): value is string {
	return isExactToken(value);
}

function retainedAgentId(value: unknown): { readonly agentId: string } | Record<string, never> {
	return isExactToken(value) && value.length <= 128 ? { agentId: value } : {};
}

function toSafeInt(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
		return value;
	}
	if (typeof value === 'string' && value.length > 0) {
		const parsed = Number(value);
		if (Number.isSafeInteger(parsed) && parsed >= 0) {
			return parsed;
		}
	}
	return undefined;
}

function demuxHello(body: unknown): unknown | undefined {
	if (body === null || typeof body !== 'object' || Array.isArray(body)) {
		return undefined;
	}
	const sessionVersion = toSafeInt(readOwnDataValue(body, 'session_version') ?? readOwnDataValue(body, 'sessionVersion'));
	const headSeq = toSafeInt(readOwnDataValue(body, 'head_seq') ?? readOwnDataValue(body, 'headSeq'));
	const runtimeEpoch = toSafeInt(readOwnDataValue(body, 'runtime_epoch') ?? readOwnDataValue(body, 'runtimeEpoch'));
	const lastMutatedFromSeq = toSafeInt(readOwnDataValue(body, 'last_mutated_from_seq') ?? readOwnDataValue(body, 'lastMutatedFromSeq'));
	if (sessionVersion === undefined || headSeq === undefined || runtimeEpoch === undefined || lastMutatedFromSeq === undefined) {
		return undefined;
	}
	return {
		arm: 'hello',
		body: { sessionVersion, headSeq, runtimeEpoch, lastMutatedFromSeq },
	};
}

function titleFromRole(role: string | undefined): string {
	switch (role) {
		case 'USER': return 'You';
		case 'ASSISTANT': return 'Agent';
		case 'SYSTEM': return 'System';
		case 'TOOL': return 'Tool';
		default: return 'Message';
	}
}

function demuxEnvelope(envelope: unknown): unknown | undefined {
	if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope)) {
		return undefined;
	}
	const id = readOwnDataValue(envelope, 'id');
	const seq = toSafeInt(readOwnDataValue(envelope, 'seq'));
	const role = readOwnDataValue(envelope, 'role');
	if (typeof id !== 'string' || !id || seq === undefined) {
		return undefined;
	}
	const blocks = readOwnDataValue(envelope, 'blocks');
	let preview = '';
	if (Array.isArray(blocks)) {
		for (const block of blocks) {
			if (block && typeof block === 'object') {
				const text = readOwnDataValue(block as object, 'text') ?? readOwnDataValue(block as object, 'content');
				if (typeof text === 'string' && text.length > 0) {
					preview = text.slice(0, 240);
					break;
				}
			}
		}
	}
	const roleStr = typeof role === 'string' ? role : 'USER';
	const branchReason = readOwnDataValue(envelope, 'branch_reason') ?? readOwnDataValue(envelope, 'branchReason');
	const turnId = readOwnDataValue(envelope, 'turn_id') ?? readOwnDataValue(envelope, 'turnId');
	return {
		arm: 'text',
		seq,
		body: {
			id,
			itemId: id,
			orderKey: String(seq),
			seq,
			title: titleFromRole(roleStr),
			preview,
			role: roleStr.toLowerCase(),
			...(typeof turnId === 'string' && turnId ? { turnId } : {}),
			...(typeof branchReason === 'string' && branchReason ? { branchReason } : {}),
		},
	};
}

function readReplacedEnvelopeIds(body: object): readonly string[] {
	const raw = readOwnDataValue(body, 'replaced_envelope_ids') ?? readOwnDataValue(body, 'replacedEnvelopeIds');
	if (!Array.isArray(raw)) {
		return [];
	}
	const ids: string[] = [];
	for (const item of raw) {
		if (typeof item === 'string' && item.length > 0) {
			ids.push(item);
		}
	}
	return ids;
}

function demuxRangeReplaced(body: unknown): unknown | undefined {
	if (body === null || typeof body !== 'object' || Array.isArray(body)) {
		return undefined;
	}
	const fromSeq = toSafeInt(readOwnDataValue(body, 'from_seq') ?? readOwnDataValue(body, 'fromSeq'));
	if (fromSeq === undefined || fromSeq <= 0) {
		return undefined;
	}
	const replacement = readOwnDataValue(body, 'replacement') ?? readOwnDataValue(body, 'replacements');
	const events: unknown[] = [];
	if (Array.isArray(replacement)) {
		for (const envelope of replacement) {
			const demuxed = demuxEnvelope(envelope);
			if (demuxed) {
				events.push(demuxed);
			}
		}
	}
	const newHeadSeq = toSafeInt(readOwnDataValue(body, 'new_head_seq') ?? readOwnDataValue(body, 'newHeadSeq'));
	const sessionVersion = toSafeInt(readOwnDataValue(body, 'session_version') ?? readOwnDataValue(body, 'sessionVersion'));
	const subtreeRootTurnId = readOwnDataValue(body, 'subtree_root_turn_id') ?? readOwnDataValue(body, 'subtreeRootTurnId');
	const divergedFromTurnId = readOwnDataValue(body, 'diverged_from_turn_id') ?? readOwnDataValue(body, 'divergedFromTurnId');
	const operationId = readOwnDataValue(body, 'operation_id') ?? readOwnDataValue(body, 'operationId');
	const reason = readOwnDataValue(body, 'reason');
	return {
		arm: 'rangeReplaced',
		body: {
			meta: {
				fromSeq,
				replacedEnvelopeIds: readReplacedEnvelopeIds(body),
				...(typeof subtreeRootTurnId === 'string' && subtreeRootTurnId ? { subtreeRootTurnId } : {}),
				...(newHeadSeq !== undefined ? { newHeadSeq } : {}),
				...(sessionVersion !== undefined ? { sessionVersion } : {}),
				...(typeof divergedFromTurnId === 'string' && divergedFromTurnId ? { divergedFromTurnId } : {}),
				...(typeof operationId === 'string' && operationId ? { operationId } : {}),
				...(reason !== undefined ? { reason } : {}),
			},
			events,
		},
	};
}

function demuxEnvelopeList(envelopes: unknown): unknown[] {
	if (!Array.isArray(envelopes)) {
		return [];
	}
	const events: unknown[] = [];
	for (const envelope of envelopes) {
		const demuxed = demuxEnvelope(envelope);
		if (demuxed) {
			events.push(demuxed);
		}
	}
	return events;
}

function mapPendingKind(kind: unknown): 'permission' | 'question' | 'clientToolCall' | undefined {
	if (kind === 1 || kind === 'PENDING_ACTION_KIND_PERMISSION' || kind === 'permission') {
		return 'permission';
	}
	if (kind === 2 || kind === 'PENDING_ACTION_KIND_ASK_USER_QUESTION' || kind === 'question') {
		return 'question';
	}
	if (kind === 3 || kind === 'PENDING_ACTION_KIND_CLIENT_TOOL_CALL' || kind === 'clientToolCall') {
		return 'clientToolCall';
	}
	return undefined;
}

function projectQuestionItems(itemsRaw: unknown): ReadonlyArray<{
	readonly id: string;
	readonly header?: string;
	readonly question?: string;
	readonly optionsPreview?: readonly string[];
	readonly multiSelect: boolean;
	readonly allowCustom: boolean;
}> {
	if (!Array.isArray(itemsRaw)) {
		return [];
	}
	const out: Array<{
		readonly id: string;
		readonly header?: string;
		readonly question?: string;
		readonly optionsPreview?: readonly string[];
		readonly multiSelect: boolean;
		readonly allowCustom: boolean;
	}> = [];
	for (const itemRaw of itemsRaw) {
		if (!isRecord(itemRaw) || !isExactToken(readOwnDataValue(itemRaw, 'id'))) {
			continue;
		}
		const headerRaw = readOwnDataValue(itemRaw, 'header');
		const questionRaw = readOwnDataValue(itemRaw, 'question');
		const header = typeof headerRaw === 'string' && headerRaw.trim() ? headerRaw.trim() : undefined;
		const question = typeof questionRaw === 'string' && questionRaw.trim() ? questionRaw.trim() : undefined;
		const optionsRaw = readField(itemRaw, 'options');
		const optionsPreview: string[] = [];
		if (Array.isArray(optionsRaw)) {
			for (const opt of optionsRaw) {
				if (!isRecord(opt)) {
					continue;
				}
				const label = readOwnDataValue(opt, 'label');
				if (typeof label === 'string' && label.trim()) {
					optionsPreview.push(label.trim());
				}
			}
		}
		out.push({
			id: readOwnDataValue(itemRaw, 'id') as string,
			...(header !== undefined ? { header } : {}),
			...(question !== undefined ? { question } : {}),
			...(optionsPreview.length > 0 ? { optionsPreview } : {}),
			multiSelect: readField(itemRaw, 'multi_select', 'multiSelect') === true,
			allowCustom: readField(itemRaw, 'allow_custom', 'allowCustom') === true,
		});
	}
	return out;
}

function descriptionOrEmpty(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function retainedArgumentsJson(record: object): { readonly argumentsJson: string } | Record<string, never> {
	const value = readField(record, 'arguments_json', 'argumentsJson');
	if (typeof value !== 'string' || value.trim().length === 0) {
		return {};
	}
	return { argumentsJson: value.trim() };
}

/**
 * L3 snapshot → overlayPendingSnapshot (+ activeTurn or clear).
 * OverlayDeltaJoin resets on the same payload and yields nothing.
 */
function demuxRuntimeOverlay(body: unknown): unknown[] {
	if (!isRecord(body)) {
		return [];
	}
	const runtimeEpoch = toSafeInt(readField(body, 'runtime_epoch', 'runtimeEpoch'));
	const pendingRaw = readField(body, 'pending');
	const pending: object[] = [];
	if (Array.isArray(pendingRaw)) {
		for (const raw of pendingRaw) {
			if (!isRecord(raw)) {
				continue;
			}
			const requestId = readField(raw, 'request_id', 'requestId');
			const kind = mapPendingKind(readField(raw, 'kind'));
			if (!isExactToken(requestId) || kind === undefined) {
				continue;
			}
			const description = descriptionOrEmpty(readField(raw, 'description'));
			const toolName = readField(raw, 'tool_name', 'toolName');
			if (kind === 'question') {
				const questions = projectQuestionItems(readField(raw, 'questions', 'items'));
				pending.push({
					requestId,
					kind,
					description,
					...retainedAgentId(readField(raw, 'agent_id', 'agentId')),
					...(questions.length > 0 ? { questions } : {}),
				});
				continue;
			}
			pending.push({
				requestId,
				kind,
				description,
				...(typeof toolName === 'string' && toolName.length > 0 ? { toolName } : {}),
				...retainedAgentId(readField(raw, 'agent_id', 'agentId')),
				...retainedArgumentsJson(raw),
			});
		}
	}
	const events: unknown[] = [{
		arm: 'overlayPendingSnapshot',
		body: {
			...(runtimeEpoch !== undefined ? { runtimeEpoch } : {}),
			pending,
		},
	}];
	const activeTurn = readField(body, 'active_turn', 'activeTurn');
	if (activeTurn === undefined || activeTurn === null) {
		events.push({ arm: 'overlayActiveTurnClear', body: {} });
		return events;
	}
	if (!isRecord(activeTurn)) {
		return events;
	}
	const turnId = readField(activeTurn, 'turn_id', 'turnId');
	if (!admitTurnId(turnId)) {
		return events;
	}
	const streamingTextRaw = readField(activeTurn, 'streaming_text', 'streamingText');
	const thinkingTextRaw = readField(activeTurn, 'thinking_text', 'thinkingText');
	const generatingToolNameRaw = readField(activeTurn, 'generating_tool_name', 'generatingToolName');
	events.push({
		arm: 'overlayActiveTurn',
		body: {
			turnId,
			streamingText: typeof streamingTextRaw === 'string' ? streamingTextRaw : '',
			thinkingText: typeof thinkingTextRaw === 'string' ? thinkingTextRaw : '',
			...(typeof generatingToolNameRaw === 'string' && generatingToolNameRaw.length > 0 ? { generatingToolName: generatingToolNameRaw } : {}),
		},
	});
	return events;
}

function demuxAskUserQuestion(body: unknown, sessionId: unknown): unknown | undefined {
	if (!isRecord(body)) {
		return undefined;
	}
	const requestId = readField(body, 'request_id', 'requestId');
	if (!isExactToken(requestId)) {
		return undefined;
	}
	const questions = projectQuestionItems(readField(body, 'items', 'questions'));
	return {
		arm: 'question',
		body: {
			id: requestId,
			orderKey: requestId,
			questions,
			...(typeof sessionId === 'string' ? { sessionId } : {}),
			...retainedAgentId(readField(body, 'agent_id', 'agentId')),
		},
	};
}

/**
 * Actor does not fold `arm:'question'`. Host posts this localFact so L4
 * ask-user creates a pending seat without waiting for an overlay snapshot.
 */
export function localFactFromQuestionArm(event: unknown): {
	readonly kind: 'questionAsked';
	readonly questionId: string;
	readonly questions: readonly unknown[];
	readonly agentId?: string;
} | undefined {
	if (!isRecord(event) || readOwnDataValue(event, 'arm') !== 'question') {
		return undefined;
	}
	const body = readOwnDataValue(event, 'body');
	if (!isRecord(body)) {
		return undefined;
	}
	const questionId = readOwnDataValue(body, 'id');
	const questions = readOwnDataValue(body, 'questions');
	if (!isExactToken(questionId) || !Array.isArray(questions) || questions.length === 0) {
		return undefined;
	}
	const agentId = readOwnDataValue(body, 'agentId');
	return {
		kind: 'questionAsked',
		questionId,
		questions,
		...retainedAgentId(agentId),
	};
}

/**
 * Convert a gRPC SessionStreamEvent payload into zero or more domain stream events.
 */
export function demuxSessionStreamPayload(payload: unknown): readonly unknown[] {
	if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
		return [];
	}
	const record = payload as Record<string, unknown>;
	const sessionId = readField(payload, 'session_id', 'sessionId');
	const hello = record.hello;
	if (hello !== undefined) {
		const demuxed = demuxHello(hello);
		return demuxed ? [demuxed] : [];
	}
	if (record.heartbeat !== undefined) {
		return [{ arm: 'heartbeat' }];
	}
	const appended = record.envelope_appended ?? record.envelopeAppended;
	if (appended !== undefined) {
		if (appended && typeof appended === 'object') {
			const envelope = readOwnDataValue(appended as object, 'envelope');
			const demuxed = demuxEnvelope(envelope);
			return demuxed ? [demuxed] : [];
		}
	}
	const batch = record.envelope_batch_appended ?? record.envelopeBatchAppended;
	if (batch !== undefined) {
		if (batch && typeof batch === 'object') {
			const envelopes = readOwnDataValue(batch as object, 'envelopes');
			return demuxEnvelopeList(envelopes);
		}
	}
	const replaced = record.envelope_range_replaced ?? record.envelopeRangeReplaced;
	if (replaced !== undefined) {
		const demuxed = demuxRangeReplaced(replaced);
		return demuxed ? [demuxed] : [];
	}
	const overlay = record.runtime_overlay_snapshot ?? record.runtimeOverlaySnapshot;
	if (overlay !== undefined) {
		return demuxRuntimeOverlay(overlay);
	}
	if (record.session_closed !== undefined || record.sessionClosed !== undefined) {
		return [{ arm: 'sessionClosed', body: { reason: 0 } }];
	}
	if (record.permission_request !== undefined) {
		const body = record.permission_request;
		if (body && typeof body === 'object') {
			const requestId = readOwnDataValue(body as object, 'request_id') ?? readOwnDataValue(body as object, 'requestId');
			const description = readOwnDataValue(body as object, 'description');
			if (typeof requestId === 'string' && requestId.length > 0 && requestId === requestId.trim()) {
				return [{
					arm: 'permission',
					body: {
						itemId: requestId,
						requestId,
						description: typeof description === 'string' ? description : 'Permission required',
					},
				}];
			}
		}
	}
	const question = record.ask_user_question ?? record.askUserQuestion;
	if (question !== undefined) {
		const demuxed = demuxAskUserQuestion(question, sessionId);
		return demuxed ? [demuxed] : [];
	}
	return [];
}
