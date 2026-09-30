/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentPtyClientMessage,
	UniverseAgentPtyOpenSession,
} from '../../common/universeAgentTypes.js';
import type {
	PtyErrorWire,
	PtyOpenSessionResponseWire,
	PtyReadWire,
	PtyServerMessageWire,
	PtySessionClosedWire,
} from './grpcClientMappersCatalog.js';
import {
	encodeBytesField,
	encodeInt32Field,
	encodePresentMessageField,
	encodeStringField,
	lastBytes,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * PtyClientMessage oneof — `open_session`=1 `resize`=2 `write`=3 `close`=4.
 * Each present arm is encoded. `write.data` is proto bytes, not base64.
 * Optional strings stay present when defined, including empty.
 * `shell_args` and environment map entries stay present, including empty key/value.
 * proto3: empty required strings and 0 columns/rows omitted. `interrupt_only` false omitted.
 */
export function encodePtyClientMessage(message: UniverseAgentPtyClientMessage): Uint8Array {
	const parts: Buffer[] = [];
	if (message.openSession !== undefined) {
		parts.push(encodePresentMessageField(1, encodeOpenSession(message.openSession)));
	}
	if (message.resize !== undefined) {
		parts.push(encodePresentMessageField(2, Buffer.concat([
			encodeInt32Field(1, message.resize.columns),
			encodeInt32Field(2, message.resize.rows),
		])));
	}
	if (message.write !== undefined) {
		parts.push(encodePresentMessageField(3, encodeBytesField(1, message.write.data)));
	}
	if (message.close !== undefined) {
		parts.push(encodePresentMessageField(4, encodeInt32Field(1, message.close.interruptOnly ? 1 : 0)));
	}
	return Buffer.concat(parts);
}

/**
 * PtyServerMessage oneof — `open_session_response`=1 `read`=2 `session_closed`=3 `error`=4.
 * `read.data` is base64 for the existing mapper. Unknown fields unread.
 * Explicit 0 bool/enum is kept; absent fields stay omitted.
 */
export function decodePtyServerMessage(bytes: Uint8Array): PtyServerMessageWire {
	const fields = readProtoFields(bytes);
	const open = lastBytes(fields, 1);
	const read = lastBytes(fields, 2);
	const closed = lastBytes(fields, 3);
	const error = lastBytes(fields, 4);
	return {
		...(open !== undefined ? { open_session_response: decodeOpenResponse(open) } : {}),
		...(read !== undefined ? { read: decodeRead(read) } : {}),
		...(closed !== undefined ? { session_closed: decodeClosed(closed) } : {}),
		...(error !== undefined ? { error: decodeError(error) } : {}),
	};
}

/**
 * PtyOpenSession — `engine_session_id`=1 `client_session_id`=2 `tab_id`=3
 * optional `working_directory`=4 optional `shell_command`=5 repeated `shell_args`=6
 * map `environment`=7 optional `initial_command`=8 `columns`=9 `rows`=10.
 */
function encodeOpenSession(open: UniverseAgentPtyOpenSession): Uint8Array {
	const parts: Buffer[] = [
		encodeStringField(1, open.engineSessionId),
		encodeStringField(2, open.clientSessionId),
		encodeStringField(3, open.tabId),
		encodeOptionalString(4, open.workingDirectory),
		encodeOptionalString(5, open.shellCommand),
	];
	for (const arg of open.shellArgs) {
		parts.push(encodePresentString(6, arg));
	}
	parts.push(encodeEnvironment(7, open.environment));
	parts.push(encodeOptionalString(8, open.initialCommand));
	parts.push(encodeInt32Field(9, open.columns));
	parts.push(encodeInt32Field(10, open.rows));
	return Buffer.concat(parts);
}

/** proto3 `map<string,string>` = repeated MapEntry (`key`=1 `value`=2), including empty. */
function encodeEnvironment(field: number, values: Readonly<Record<string, string>>): Buffer {
	return Buffer.concat(Object.entries(values).map(([key, value]) => encodePresentMessageField(field, Buffer.concat([
		encodePresentString(1, key),
		encodePresentString(2, value),
	]))));
}

function encodePresentString(field: number, value: string): Buffer {
	return encodePresentMessageField(field, Buffer.from(value, 'utf8'));
}

function encodeOptionalString(field: number, value: string | undefined): Buffer {
	if (value === undefined) {
		return Buffer.alloc(0);
	}
	return encodePresentString(field, value);
}

/** PtyOpenSessionResponse — `success`=1 `pty_session_id`=2 optional `working_directory`=3 optional `title`=4 `failure_reason`=5 optional `error_message`=6. */
function decodeOpenResponse(bytes: Uint8Array): PtyOpenSessionResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	const ptySessionId = lastString(fields, 2);
	const workingDirectory = lastString(fields, 3);
	const title = lastString(fields, 4);
	const failureReason = lastVarint(fields, 5);
	const errorMessage = lastString(fields, 6);
	return {
		...(success !== undefined ? { success: success !== 0n } : {}),
		...(ptySessionId !== undefined ? { pty_session_id: ptySessionId } : {}),
		...(workingDirectory !== undefined ? { working_directory: workingDirectory } : {}),
		...(title !== undefined ? { title } : {}),
		...(failureReason !== undefined ? { failure_reason: Number(failureReason) } : {}),
		...(errorMessage !== undefined ? { error_message: errorMessage } : {}),
	};
}

/** PtyRead — `data`=1 bytes, exposed as base64 for `base64ToBytes`. */
function decodeRead(bytes: Uint8Array): PtyReadWire {
	const data = lastBytes(readProtoFields(bytes), 1);
	return data === undefined ? {} : { data: Buffer.from(data).toString('base64') };
}

/** PtySessionClosed — `exit_code`=1 optional `title`=2. */
function decodeClosed(bytes: Uint8Array): PtySessionClosedWire {
	const fields = readProtoFields(bytes);
	const exitCode = lastVarint(fields, 1);
	const title = lastString(fields, 2);
	return {
		...(exitCode !== undefined ? { exit_code: Number(exitCode) } : {}),
		...(title !== undefined ? { title } : {}),
	};
}

/** PtyError — `code`=1 `message`=2. */
function decodeError(bytes: Uint8Array): PtyErrorWire {
	const fields = readProtoFields(bytes);
	const code = lastVarint(fields, 1);
	const message = lastString(fields, 2);
	return {
		...(code !== undefined ? { code: Number(code) } : {}),
		...(message !== undefined ? { message } : {}),
	};
}
