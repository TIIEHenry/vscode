/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Proto JSON → domain demux for SessionEventStream (M6-A2 leftover).
 * L1 control, L2 envelope classify (TOOL_RESULT > TOOL_CALL > TEXT > THINKING),
 * L3 `runtime_overlay_snapshot` → overlay pending / activeTurn / clear,
 * L4 permission / ask_user_question / client_tool_call.
 * Individual L3 deltas stay dropped — overlay SSOT is the snapshot (Desktop).
 * `arm:'question'` is not folded by vendored Actor; host posts `questionAsked`.
 * Snake_case and camelCase own-data keys; accessors never run.
 */

const TEXT_PREVIEW_MAX = 8192;

const BLOCK_TYPE_TEXT = 1;
const BLOCK_TYPE_TOOL_CALL = 2;
const BLOCK_TYPE_TOOL_RESULT = 3;
const BLOCK_TYPE_THINKING = 4;
const BLOCK_TYPE_CANVAS_REF = 15;
const BLOCK_TYPE_SNIPPET = 16;
const BLOCK_TYPE_ITERATION_STARTUP = 17;
const BLOCK_TYPE_LOOP_HANDOFF = 18;
const BLOCK_TYPE_COMPACTED_SPAN = 19;
const BLOCK_TYPE_PEER_MESSAGE = 20;

const PIN_ERA_PLACEHOLDER_TYPES = new Set<number>([
	BLOCK_TYPE_SNIPPET,
	BLOCK_TYPE_ITERATION_STARTUP,
	BLOCK_TYPE_LOOP_HANDOFF,
	BLOCK_TYPE_COMPACTED_SPAN,
	BLOCK_TYPE_PEER_MESSAGE,
]);

const BLOCK_PRIORITY = [BLOCK_TYPE_TOOL_RESULT, BLOCK_TYPE_TOOL_CALL, BLOCK_TYPE_TEXT, BLOCK_TYPE_THINKING] as const;

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

function isExactToken(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function isRecord(value: unknown): value is object {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function ownObject(record: object, ...keys: string[]): object | undefined {
	const value = readField(record, ...keys);
	return isRecord(value) ? value : undefined;
}

function truncatePreview(raw: string, max: number): string {
	if (raw.length <= max) {
		return raw;
	}
	return `${raw.slice(0, Math.max(0, max - 1))}…`;
}

function nonEmptyTrimmed(value: unknown): string | null {
	if (typeof value !== 'string') {
		return null;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function hasControlChar(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if (code <= 0x1f || code === 0x7f) {
			return true;
		}
	}
	return false;
}

function admitTurnId(value: unknown): value is string {
	return isExactToken(value) && !hasControlChar(value);
}

function titleFromRole(role: unknown): string {
	const normalized = typeof role === 'string' ? role.replace(/^MESSAGE_ROLE_/, '').toUpperCase() : role;
	switch (normalized) {
		case 'USER':
		case 1:
			return 'You';
		case 'ASSISTANT':
		case 2:
			return 'Agent';
		case 'SYSTEM':
		case 3:
			return 'System';
		case 'TOOL':
		case 4:
			return 'Tool';
		default:
			return 'Message';
	}
}

function turnIdFields(envelope: object): { readonly turnId: string } | Record<string, never> {
	const turnId = readField(envelope, 'turn_id', 'turnId');
	return admitTurnId(turnId) ? { turnId } : {};
}

function normalizeBlockType(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isSafeInteger(value)) {
		return value;
	}
	if (typeof value !== 'string') {
		return undefined;
	}
	const key = value.replace(/^BLOCK_TYPE_/, '').toUpperCase();
	switch (key) {
		case 'TEXT': return BLOCK_TYPE_TEXT;
		case 'TOOL_CALL': return BLOCK_TYPE_TOOL_CALL;
		case 'TOOL_RESULT': return BLOCK_TYPE_TOOL_RESULT;
		case 'THINKING': return BLOCK_TYPE_THINKING;
		case 'CANVAS_REF': return BLOCK_TYPE_CANVAS_REF;
		case 'SNIPPET': return BLOCK_TYPE_SNIPPET;
		case 'ITERATION_STARTUP': return BLOCK_TYPE_ITERATION_STARTUP;
		case 'LOOP_HANDOFF': return BLOCK_TYPE_LOOP_HANDOFF;
		case 'COMPACTED_SPAN': return BLOCK_TYPE_COMPACTED_SPAN;
		case 'PEER_MESSAGE': return BLOCK_TYPE_PEER_MESSAGE;
		default: return undefined;
	}
}

function blockTypeOf(block: object): number | undefined {
	const declared = normalizeBlockType(readField(block, 'block_type', 'blockType'));
	if (declared !== undefined) {
		return declared;
	}
	if (ownObject(block, 'tool_result_block', 'toolResultBlock')) {
		return BLOCK_TYPE_TOOL_RESULT;
	}
	if (ownObject(block, 'tool_call_block', 'toolCallBlock')) {
		return BLOCK_TYPE_TOOL_CALL;
	}
	if (ownObject(block, 'thinking_block', 'thinkingBlock')) {
		return BLOCK_TYPE_THINKING;
	}
	if (ownObject(block, 'text_block', 'textBlock') || typeof readField(block, 'text', 'content') === 'string') {
		return BLOCK_TYPE_TEXT;
	}
	if (ownObject(block, 'canvas_ref_block', 'canvasRefBlock')) {
		return BLOCK_TYPE_CANVAS_REF;
	}
	return undefined;
}

function admitToolName(value: unknown): string | undefined {
	if (!isExactToken(value) || value.length > 128) {
		return undefined;
	}
	return value;
}

function isUsableToolResult(block: object): boolean {
	if (blockTypeOf(block) !== BLOCK_TYPE_TOOL_RESULT) {
		return false;
	}
	const payload = ownObject(block, 'tool_result_block', 'toolResultBlock') ?? block;
	return admitToolName(readField(payload, 'tool_name', 'toolName')) !== undefined;
}

function isUsableToolCall(block: object): boolean {
	if (blockTypeOf(block) !== BLOCK_TYPE_TOOL_CALL) {
		return false;
	}
	const payload = ownObject(block, 'tool_call_block', 'toolCallBlock') ?? block;
	return admitToolName(readField(payload, 'tool_name', 'toolName')) !== undefined;
}

function textFromBlock(block: object): string | null {
	const nested = ownObject(block, 'text_block', 'textBlock');
	if (nested) {
		return nonEmptyTrimmed(readField(nested, 'text'));
	}
	return nonEmptyTrimmed(readField(block, 'text', 'content'));
}

function isUsableText(block: object): boolean {
	return blockTypeOf(block) === BLOCK_TYPE_TEXT && textFromBlock(block) !== null;
}

function thinkingFromBlock(block: object): string | null {
	const nested = ownObject(block, 'thinking_block', 'thinkingBlock');
	if (nested) {
		return nonEmptyTrimmed(readField(nested, 'thinking'));
	}
	return nonEmptyTrimmed(readField(block, 'thinking'));
}

function isUsableThinking(block: object): boolean {
	return blockTypeOf(block) === BLOCK_TYPE_THINKING && thinkingFromBlock(block) !== null;
}

function firstUsable(blocks: readonly object[], predicate: (block: object) => boolean): object | undefined {
	for (const block of blocks) {
		if (predicate(block)) {
			return block;
		}
	}
	return undefined;
}

function joinUsableText(blocks: readonly object[]): string | null {
	const parts: string[] = [];
	for (const block of blocks) {
		if (!isUsableText(block)) {
			continue;
		}
		const text = textFromBlock(block);
		if (text !== null) {
			parts.push(text);
		}
	}
	return parts.length > 0 ? parts.join('\n') : null;
}

function collectCanvasRefs(blocks: readonly object[]): readonly { canvasId: string; revisionId: string; title: string; sourceHash?: string }[] {
	const refs: { canvasId: string; revisionId: string; title: string; sourceHash?: string }[] = [];
	for (const block of blocks) {
		if (blockTypeOf(block) !== BLOCK_TYPE_CANVAS_REF) {
			continue;
		}
		const payload = ownObject(block, 'canvas_ref_block', 'canvasRefBlock') ?? block;
		const canvasId = readField(payload, 'canvas_id', 'canvasId');
		const revisionId = readField(payload, 'revision_id', 'revisionId');
		const title = readField(payload, 'title');
		const sourceHash = readField(payload, 'source_hash', 'sourceHash');
		if (!isExactToken(canvasId) || !isExactToken(revisionId) || !isExactToken(title)) {
			continue;
		}
		refs.push({
			canvasId,
			revisionId,
			title,
			...(typeof sourceHash === 'string' ? { sourceHash } : {}),
		});
	}
	return refs;
}

function mapToolResult(id: string, orderKey: string, block: object, turnId: { readonly turnId: string } | Record<string, never>): unknown | undefined {
	const payload = ownObject(block, 'tool_result_block', 'toolResultBlock') ?? block;
	const toolName = admitToolName(readField(payload, 'tool_name', 'toolName'));
	if (toolName === undefined) {
		return undefined;
	}
	const content = readField(payload, 'content');
	const resultPreview = typeof content === 'string' && content.length > 0 ? truncatePreview(content, TEXT_PREVIEW_MAX) : undefined;
	const isError = readField(payload, 'is_error', 'isError');
	return {
		arm: 'tool',
		body: {
			id,
			orderKey,
			toolName,
			title: toolName,
			status: isError === true ? 'failed' : 'completed',
			...(resultPreview !== undefined ? { resultPreview } : {}),
			...turnId,
		},
	};
}

function mapToolCall(id: string, orderKey: string, block: object, turnId: { readonly turnId: string } | Record<string, never>): unknown | undefined {
	const payload = ownObject(block, 'tool_call_block', 'toolCallBlock') ?? block;
	const toolName = admitToolName(readField(payload, 'tool_name', 'toolName'));
	if (toolName === undefined) {
		return undefined;
	}
	const argsJson = readField(payload, 'arguments_json', 'argumentsJson');
	const argPreview = typeof argsJson === 'string' && argsJson.length > 0 ? truncatePreview(argsJson, TEXT_PREVIEW_MAX) : undefined;
	return {
		arm: 'tool',
		body: {
			id,
			orderKey,
			toolName,
			title: toolName,
			status: 'completed',
			...(argPreview !== undefined ? { argPreview } : {}),
			...turnId,
		},
	};
}

function mapByPriority(id: string, orderKey: string, role: unknown, blocks: readonly object[], turnId: { readonly turnId: string } | Record<string, never>): unknown | undefined {
	for (const type of BLOCK_PRIORITY) {
		if (type === BLOCK_TYPE_TOOL_RESULT) {
			const block = firstUsable(blocks, isUsableToolResult);
			const mapped = block ? mapToolResult(id, orderKey, block, turnId) : undefined;
			if (mapped) {
				const canvasRefs = collectCanvasRefs(blocks);
				if (canvasRefs.length === 0) {
					return mapped;
				}
				return { arm: 'tool', body: { ...(mapped as { body: object }).body, canvasRefs } };
			}
			continue;
		}
		if (type === BLOCK_TYPE_TOOL_CALL) {
			const block = firstUsable(blocks, isUsableToolCall);
			const mapped = block ? mapToolCall(id, orderKey, block, turnId) : undefined;
			if (mapped) {
				const canvasRefs = collectCanvasRefs(blocks);
				if (canvasRefs.length === 0) {
					return mapped;
				}
				return { arm: 'tool', body: { ...(mapped as { body: object }).body, canvasRefs } };
			}
			continue;
		}
		if (type === BLOCK_TYPE_TEXT) {
			const joined = joinUsableText(blocks);
			if (joined !== null) {
				return {
					arm: 'text',
					body: {
						id,
						orderKey,
						title: titleFromRole(role),
						preview: truncatePreview(joined, TEXT_PREVIEW_MAX),
						...turnId,
					},
				};
			}
			continue;
		}
		const block = firstUsable(blocks, isUsableThinking);
		const thinking = block ? thinkingFromBlock(block) : null;
		if (thinking !== null) {
			return {
				arm: 'reasoning',
				body: {
					id,
					orderKey,
					title: 'THINKING',
					collapsedPreview: truncatePreview(thinking, TEXT_PREVIEW_MAX),
					streaming: false,
				},
			};
		}
	}

	for (const block of blocks) {
		const type = blockTypeOf(block);
		if (type === undefined || !PIN_ERA_PLACEHOLDER_TYPES.has(type)) {
			continue;
		}
		const fromType = nonEmptyTrimmed(readField(block, 'original_type', 'originalType'));
		const rawJson = readField(block, 'raw_json', 'rawJson');
		const preview = fromType ?? (typeof rawJson === 'string' && rawJson.length > 0 ? truncatePreview(rawJson, TEXT_PREVIEW_MAX) : null);
		if (preview === null) {
			continue;
		}
		return {
			arm: 'text',
			body: {
				id,
				orderKey,
				title: titleFromRole(role),
				preview,
				...turnId,
			},
		};
	}

	for (const block of blocks) {
		const type = blockTypeOf(block);
		if (type === undefined || type === BLOCK_TYPE_CANVAS_REF || PIN_ERA_PLACEHOLDER_TYPES.has(type) || BLOCK_PRIORITY.includes(type as typeof BLOCK_PRIORITY[number])) {
			continue;
		}
		const originalType = readField(block, 'original_type', 'originalType');
		const rawJson = readField(block, 'raw_json', 'rawJson');
		if (typeof originalType !== 'string' || originalType.length === 0 || typeof rawJson !== 'string' || rawJson.length === 0) {
			continue;
		}
		return {
			arm: 'unknownBlock',
			body: {
				id,
				orderKey,
				typeName: originalType,
				rawContent: truncatePreview(rawJson, TEXT_PREVIEW_MAX),
				...turnId,
			},
		};
	}
	return undefined;
}

function demuxHello(body: unknown): unknown | undefined {
	if (!isRecord(body)) {
		return undefined;
	}
	const sessionVersion = toSafeInt(readField(body, 'session_version', 'sessionVersion'));
	const headSeq = toSafeInt(readField(body, 'head_seq', 'headSeq'));
	const runtimeEpoch = toSafeInt(readField(body, 'runtime_epoch', 'runtimeEpoch'));
	const lastMutatedFromSeq = toSafeInt(readField(body, 'last_mutated_from_seq', 'lastMutatedFromSeq'));
	if (sessionVersion === undefined || headSeq === undefined || runtimeEpoch === undefined || lastMutatedFromSeq === undefined) {
		return undefined;
	}
	return {
		arm: 'hello',
		body: { sessionVersion, headSeq, runtimeEpoch, lastMutatedFromSeq },
	};
}

function demuxEnvelope(envelope: unknown): unknown | undefined {
	if (!isRecord(envelope)) {
		return undefined;
	}
	const id = readOwnDataValue(envelope, 'id');
	const seq = toSafeInt(readOwnDataValue(envelope, 'seq'));
	if (typeof id !== 'string' || !id || seq === undefined) {
		return undefined;
	}
	const blocksRaw = readOwnDataValue(envelope, 'blocks');
	const blocks: object[] = [];
	if (Array.isArray(blocksRaw)) {
		for (const block of blocksRaw) {
			if (isRecord(block)) {
				blocks.push(block);
			}
		}
	}
	const mapped = mapByPriority(id, String(seq), readField(envelope, 'role'), blocks, turnIdFields(envelope));
	if (!mapped) {
		return undefined;
	}
	return { ...(mapped as object), seq };
}

function readReplacedEnvelopeIds(body: object): readonly string[] {
	const raw = readField(body, 'replaced_envelope_ids', 'replacedEnvelopeIds');
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
	if (!isRecord(body)) {
		return undefined;
	}
	const fromSeq = toSafeInt(readField(body, 'from_seq', 'fromSeq'));
	if (fromSeq === undefined || fromSeq <= 0) {
		return undefined;
	}
	const replacement = readField(body, 'replacement', 'replacements');
	const events: unknown[] = [];
	if (Array.isArray(replacement)) {
		for (const envelope of replacement) {
			const demuxed = demuxEnvelope(envelope);
			if (demuxed) {
				events.push(demuxed);
			}
		}
	}
	const newHeadSeq = toSafeInt(readField(body, 'new_head_seq', 'newHeadSeq'));
	const sessionVersion = toSafeInt(readField(body, 'session_version', 'sessionVersion'));
	const subtreeRootTurnId = readField(body, 'subtree_root_turn_id', 'subtreeRootTurnId');
	const divergedFromTurnId = readField(body, 'diverged_from_turn_id', 'divergedFromTurnId');
	const operationId = readField(body, 'operation_id', 'operationId');
	const reason = readField(body, 'reason');
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

function retainedAgentId(value: unknown): { readonly agentId: string } | Record<string, never> {
	return isExactToken(value) && value.length <= 128 && !hasControlChar(value) ? { agentId: value } : {};
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
		const header = typeof headerRaw === 'string' && headerRaw.trim() ? truncatePreview(headerRaw.trim(), TEXT_PREVIEW_MAX) : undefined;
		const question = typeof questionRaw === 'string' && questionRaw.trim() ? truncatePreview(questionRaw.trim(), TEXT_PREVIEW_MAX) : undefined;
		const optionsRaw = readField(itemRaw, 'options');
		const optionsPreview: string[] = [];
		if (Array.isArray(optionsRaw)) {
			for (const opt of optionsRaw) {
				if (!isRecord(opt)) {
					continue;
				}
				const label = readOwnDataValue(opt, 'label');
				if (typeof label === 'string' && label.trim()) {
					optionsPreview.push(truncatePreview(label.trim(), TEXT_PREVIEW_MAX));
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

function demuxPermission(body: unknown): unknown | undefined {
	if (!isRecord(body)) {
		return undefined;
	}
	const requestId = readField(body, 'request_id', 'requestId');
	const permissionKind = readField(body, 'tool_name', 'toolName');
	if (!isExactToken(requestId) || !isExactToken(permissionKind)) {
		return undefined;
	}
	const description = readField(body, 'description');
	return {
		arm: 'permission',
		body: {
			id: requestId,
			orderKey: requestId,
			title: typeof description === 'string' ? description : '',
			permissionKind,
			...retainedAgentId(readField(body, 'agent_id', 'agentId')),
		},
	};
}

function demuxClientToolCall(body: unknown, sessionId: unknown): unknown | undefined {
	if (!isRecord(body)) {
		return undefined;
	}
	const requestId = readField(body, 'request_id', 'requestId');
	const toolName = readField(body, 'tool_name', 'toolName');
	if (!isExactToken(requestId) || typeof toolName !== 'string') {
		return undefined;
	}
	const argumentsJson = readField(body, 'arguments_json', 'argumentsJson');
	return {
		arm: 'clientToolCall',
		body: {
			callId: requestId,
			toolName,
			argumentsJson: typeof argumentsJson === 'string' ? argumentsJson : '',
			...(typeof sessionId === 'string' ? { sessionId } : {}),
			...retainedAgentId(readField(body, 'agent_id', 'agentId')),
		},
	};
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

function descriptionOrEmpty(value: unknown): string {
	return typeof value === 'string' ? (nonEmptyTrimmed(value) ?? '') : '';
}

function retainedArgumentsJson(record: object): { readonly argumentsJson: string } | Record<string, never> {
	const value = readField(record, 'arguments_json', 'argumentsJson');
	if (typeof value !== 'string' || value.trim().length === 0) {
		return {};
	}
	return { argumentsJson: value.trim() };
}

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
	if (!isRecord(payload)) {
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
	const health = record.subscription_health ?? record.subscriptionHealth;
	if (health !== undefined) {
		if (!isRecord(health)) {
			return [];
		}
		const phase = readField(health, 'phase');
		if (typeof phase !== 'number' || !Number.isFinite(phase)) {
			return [];
		}
		return [{ arm: 'subscriptionHealth', body: { phase } }];
	}
	const closed = record.session_closed ?? record.sessionClosed;
	if (closed !== undefined) {
		const reason = isRecord(closed) ? readField(closed, 'reason') : undefined;
		return [{ arm: 'sessionClosed', body: { reason: typeof reason === 'number' && Number.isFinite(reason) ? reason : 0 } }];
	}
	if (record.session_purged !== undefined || record.sessionPurged !== undefined) {
		const purged = record.session_purged ?? record.sessionPurged;
		if (purged !== undefined && !isRecord(purged)) {
			return [];
		}
		return [{ arm: 'sessionPurged', body: {} }];
	}

	const appended = record.envelope_appended ?? record.envelopeAppended;
	if (appended !== undefined) {
		if (isRecord(appended)) {
			const demuxed = demuxEnvelope(readOwnDataValue(appended, 'envelope'));
			return demuxed ? [demuxed] : [];
		}
	}
	const batch = record.envelope_batch_appended ?? record.envelopeBatchAppended;
	if (batch !== undefined) {
		if (isRecord(batch)) {
			return demuxEnvelopeList(readOwnDataValue(batch, 'envelopes'));
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

	const permission = record.permission_request ?? record.permissionRequest;
	if (permission !== undefined) {
		const demuxed = demuxPermission(permission);
		return demuxed ? [demuxed] : [];
	}
	const question = record.ask_user_question ?? record.askUserQuestion;
	if (question !== undefined) {
		const demuxed = demuxAskUserQuestion(question, sessionId);
		return demuxed ? [demuxed] : [];
	}
	const clientTool = record.client_tool_call ?? record.clientToolCall;
	if (clientTool !== undefined) {
		const demuxed = demuxClientToolCall(clientTool, sessionId);
		return demuxed ? [demuxed] : [];
	}
	return [];
}
