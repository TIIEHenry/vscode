/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Minimal proto → domain demux for SessionEventStream (M6-A2 / stream-timeline S4).
 * Handles the arms session-core Actor recognises for baseline sync; unknown arms
 * are dropped at the host (Actor counts event.unknown_arm when forwarded opaquely).
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
	return {
		arm: 'text',
		body: {
			itemId: id,
			seq,
			title: titleFromRole(roleStr),
			preview,
			role: roleStr.toLowerCase(),
		},
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
	if (record.hello !== undefined) {
		const hello = demuxHello(record.hello);
		return hello ? [hello] : [];
	}
	if (record.heartbeat !== undefined) {
		return [{ arm: 'heartbeat' }];
	}
	if (record.envelope_appended !== undefined) {
		const appended = record.envelope_appended;
		if (appended && typeof appended === 'object') {
			const envelope = readOwnDataValue(appended as object, 'envelope');
			const demuxed = demuxEnvelope(envelope);
			return demuxed ? [demuxed] : [];
		}
	}
	if (record.session_closed !== undefined) {
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
