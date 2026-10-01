/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../base/common/buffer.js';
import { Event } from '../../../base/common/event.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import type {
	UniverseAgentPtyClientMessage,
	UniverseAgentPtyClose,
	UniverseAgentPtyError,
	UniverseAgentPtyOpenSession,
	UniverseAgentPtyOpenSessionResponse,
	UniverseAgentPtyResize,
	UniverseAgentPtyServerMessage,
	UniverseAgentPtySessionClosed,
} from './universeAgentTypes.js';

/** IPC channel name for the electron-main Pty bridge. Not the connection channel. */
export const universeAgentPtyChannelName = 'universeAgentPty';

/**
 * Preview empty-state command that opens an editor-area terminal backed by
 * this bridge. Watermark selects it only when the engine is connected and
 * `isBridgeAvailable()` is true.
 */
export const previewUniverseAgentPtyEditorCommandId = 'workbench.action.terminal.openUniverseAgentPtyEditor';

export const IUniverseAgentPty = createDecorator<IUniverseAgentPty>('universeAgentPty');

/**
 * Client frame sent with `call`. `write` bytes are a VSBuffer array element so
 * IPC `serialize` keeps raw bytes. A VSBuffer nested in an object is JSON and
 * drops `0x00` / `0xFF`.
 */
export type UniverseAgentPtyClientFrame =
	| readonly ['openSession', UniverseAgentPtyOpenSession]
	| readonly ['resize', number, number]
	| readonly ['write', VSBuffer]
	| readonly ['close', boolean];

/**
 * Server frame delivered with `listen` / `onDynamicPtyServerMessage`.
 * `read` bytes are a VSBuffer array element, same rule as the client frame.
 */
export type UniverseAgentPtyServerFrame =
	| readonly ['openSessionResponse', UniverseAgentPtyOpenSessionResponse]
	| readonly ['read', VSBuffer]
	| readonly ['sessionClosed', UniverseAgentPtySessionClosed]
	| readonly ['error', UniverseAgentPtyError];

/**
 * Renderer-facing Pty bridge. Desktop proxies this to electron-main.
 * Web's empty implementation reports the bridge unavailable.
 */
export interface IUniverseAgentPty {

	readonly _serviceBrand: undefined;

	/** Desktop main bridge is registered. Web resolves `false`. */
	isBridgeAvailable(): Promise<boolean>;

	/** Opens `openPtyStream` in the main process and returns a stream id. */
	openStream(): Promise<string>;

	/**
	 * Forwards one `PtyClientMessage`. Empty `engineSessionId` /
	 * `clientSessionId` / `tabId` and empty `data` are passed through.
	 * `columns` / `rows` / `interruptOnly` false are passed through.
	 */
	sendClientMessage(streamId: string, frame: UniverseAgentPtyClientFrame): Promise<void>;

	/** Per-stream `PtyServerMessage` frames. Bytes stay on the `read` element. */
	onDynamicPtyServerMessage(streamId: string): Event<UniverseAgentPtyServerFrame>;

	/** Ends the main-process `openPtyStream` handle. */
	disposeStream(streamId: string): Promise<void>;
}

/** Copy IPC bytes into a standalone `Uint8Array` for `openPtyStream`. */
export function vsBufferToUint8Array(value: VSBuffer): Uint8Array {
	const copy = new Uint8Array(value.byteLength);
	if (value.byteLength > 0) {
		copy.set(value.buffer.subarray(0, value.byteLength));
	}
	return copy;
}

export function universeAgentPtyClientFrameToMessage(frame: readonly unknown[]): UniverseAgentPtyClientMessage {
	if (!Array.isArray(frame) || typeof frame[0] !== 'string') {
		throw new Error('Invalid Pty client frame');
	}
	switch (frame[0]) {
		case 'openSession':
			return { openSession: readOpenSession(frame[1]) };
		case 'resize':
			return { resize: readResize(frame[1], frame[2]) };
		case 'write':
			return { write: { data: readWriteData(frame[1]) } };
		case 'close':
			return { close: readClose(frame[1]) };
		default:
			throw new Error(`Invalid Pty client frame: ${frame[0]}`);
	}
}

export function universeAgentPtyServerMessageToFrame(message: UniverseAgentPtyServerMessage): UniverseAgentPtyServerFrame | undefined {
	if (message.read) {
		const copy = new Uint8Array(message.read.data.byteLength);
		if (copy.byteLength > 0) {
			copy.set(message.read.data);
		}
		return ['read', VSBuffer.wrap(copy)];
	}
	if (message.openSessionResponse) {
		return ['openSessionResponse', message.openSessionResponse];
	}
	if (message.sessionClosed) {
		return ['sessionClosed', message.sessionClosed];
	}
	if (message.error) {
		return ['error', message.error];
	}
	return undefined;
}

function readOpenSession(value: unknown): UniverseAgentPtyOpenSession {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Invalid Pty openSession frame');
	}
	const open = value as UniverseAgentPtyOpenSession;
	if (typeof open.engineSessionId !== 'string'
		|| typeof open.clientSessionId !== 'string'
		|| typeof open.tabId !== 'string'
		|| typeof open.columns !== 'number'
		|| typeof open.rows !== 'number'
		|| !Array.isArray(open.shellArgs)
		|| !open.environment
		|| typeof open.environment !== 'object') {
		throw new Error('Invalid Pty openSession frame');
	}
	return open;
}

function readResize(columns: unknown, rows: unknown): UniverseAgentPtyResize {
	if (typeof columns !== 'number' || typeof rows !== 'number') {
		throw new Error('Invalid Pty resize frame');
	}
	return { columns, rows };
}

function readWriteData(value: unknown): Uint8Array {
	if (!(value instanceof VSBuffer)) {
		throw new Error('Pty write data must be a VSBuffer');
	}
	return vsBufferToUint8Array(value);
}

function readClose(value: unknown): UniverseAgentPtyClose {
	if (typeof value !== 'boolean') {
		throw new Error('Invalid Pty close frame');
	}
	return { interruptOnly: value };
}
