/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Minimal proto → domain demux for SessionEventStream (M6-A2 / stream-timeline S4 / M7 P2b).
 * Handles the arms session-core Actor recognises for baseline sync, plus L2
 * `envelope_range_replaced` → `rangeReplaced` (path-2 compact identity is applied
 * in `compactedAttribution.ts`, not here). Unknown arms are dropped at the host.
 */

function readOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key);
	if (desc === undefined || !Object.hasOwn(desc, 'value')) {
		return undefined;
	}
	return desc.value;
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

/**
 * Convert a gRPC SessionStreamEvent payload into zero or more domain stream events.
 */
export function demuxSessionStreamPayload(payload: unknown): readonly unknown[] {
	if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
		return [];
	}
	const record = payload as Record<string, unknown>;
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
	return [];
}
