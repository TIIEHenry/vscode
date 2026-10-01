/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ErrorNoTelemetry } from '../../../base/common/errors.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { generateUuid } from '../../../base/common/uuid.js';
import type { IServerChannel } from '../../../base/parts/ipc/common/ipc.js';
import {
	universeAgentPtyClientFrameToMessage,
	universeAgentPtyServerMessageToFrame,
	type UniverseAgentPtyServerFrame,
} from '../common/universeAgentPty.js';
import type {
	UniverseAgentPtyServerMessage,
	UniverseAgentPtyStream,
	UniverseAgentSessionStreamCloseCause,
} from '../common/universeAgentTypes.js';

/**
 * In-process host that already has `openPtyStream`. The renderer must not
 * call that method through `ProxyChannel.fromService` — callbacks and the
 * returned `write` / `end` / `dispose` are dropped, and object fields lose bytes.
 */
export interface IUniverseAgentPtyStreamHost {
	openPtyStream?(
		onResponse: (response: UniverseAgentPtyServerMessage) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentPtyStream;
}

interface IPtySlot {
	readonly id: string;
	readonly emitter: Emitter<UniverseAgentPtyServerFrame>;
	readonly pending: UniverseAgentPtyServerFrame[];
	handle: UniverseAgentPtyStream | undefined;
	handleEnded: boolean;
	flushing: boolean;
	released: boolean;
}

/**
 * Main-process Pty bridge. `call` forwards `PtyClientMessage`.
 * `listen('onDynamicPtyServerMessage', streamId)` returns `PtyServerMessage`
 * frames. Write/read bytes stay VSBuffer elements of those arrays; this
 * channel copies them to `Uint8Array` before `openPtyStream`.
 */
export class UniverseAgentPtyChannel extends Disposable implements IServerChannel<string> {

	private readonly streams = new Map<string, IPtySlot>();

	constructor(private readonly host: IUniverseAgentPtyStreamHost) {
		super();
	}

	override dispose(): void {
		const slots = [...this.streams.values()];
		for (const slot of slots) {
			this.releaseSlot(slot);
		}
		super.dispose();
	}

	call<T>(_ctx: string, command: string, arg?: unknown): Promise<T> {
		const args = Array.isArray(arg) ? arg : [];
		switch (command) {
			case 'isBridgeAvailable':
				return Promise.resolve(true as T);
			case 'openStream':
				return this.openStream() as Promise<T>;
			case 'sendClientMessage':
				return this.sendClientMessage(String(args[0] ?? ''), args[1]) as Promise<T>;
			case 'disposeStream':
				this.endHandle(String(args[0] ?? ''));
				return Promise.resolve(undefined as T);
			default:
				throw new ErrorNoTelemetry(`Method not found: ${command}`);
		}
	}

	listen<T>(_ctx: string, event: string, arg?: unknown): Event<T> {
		if (event === 'onDynamicPtyServerMessage') {
			return this.onDynamicPtyServerMessage(String(arg ?? '')) as Event<T>;
		}
		throw new ErrorNoTelemetry(`Event not found: ${event}`);
	}

	private openStream(): Promise<string> {
		const open = this.host.openPtyStream;
		if (!open) {
			return Promise.reject(new Error('openPtyStream is unavailable'));
		}
		const id = generateUuid();
		const slot = this.createSlot(id);
		this.streams.set(id, slot);
		try {
			const handle = open.call(
				this.host,
				message => this.onServerMessage(slot, message),
				cause => this.onServerClosed(slot, cause),
			);
			if (slot.handleEnded) {
				handle.end();
				handle.dispose();
			} else {
				slot.handle = handle;
			}
		} catch (err) {
			slot.handleEnded = true;
			this.releaseSlot(slot);
			return Promise.reject(err);
		}
		return Promise.resolve(id);
	}

	private sendClientMessage(streamId: string, frame: unknown): Promise<void> {
		const slot = this.streams.get(streamId);
		if (!slot || slot.handleEnded || !slot.handle) {
			return Promise.reject(new Error(`Pty stream not found: ${streamId}`));
		}
		let message;
		try {
			message = universeAgentPtyClientFrameToMessage(Array.isArray(frame) ? frame : []);
		} catch (err) {
			return Promise.reject(err);
		}
		slot.handle.write(message);
		return Promise.resolve();
	}

	private onDynamicPtyServerMessage(streamId: string): Event<UniverseAgentPtyServerFrame> {
		const slot = this.streams.get(streamId);
		if (!slot) {
			return Event.None;
		}
		return slot.emitter.event;
	}

	private createSlot(id: string): IPtySlot {
		return {
			id,
			pending: [],
			handle: undefined,
			handleEnded: false,
			flushing: false,
			released: false,
			emitter: new Emitter<UniverseAgentPtyServerFrame>({
				onDidAddFirstListener: () => {
					const current = this.streams.get(id);
					if (current) {
						this.flush(current);
					}
				},
				onDidRemoveLastListener: () => {
					const current = this.streams.get(id);
					if (current) {
						this.releaseSlot(current);
					}
				},
			}),
		};
	}

	/**
	 * Ends the grpc handle and drops the slot. `Emitter.dispose` re-enters
	 * `onDidRemoveLastListener`, so `released` stops that from looping.
	 */
	private releaseSlot(slot: IPtySlot): void {
		if (slot.released) {
			return;
		}
		slot.released = true;
		this.endHandle(slot.id);
		this.streams.delete(slot.id);
		slot.emitter.dispose();
	}

	private flush(slot: IPtySlot): void {
		slot.flushing = true;
		try {
			const queued = slot.pending.splice(0, slot.pending.length);
			for (const frame of queued) {
				slot.emitter.fire(frame);
			}
		} finally {
			slot.flushing = false;
		}
		const rest = slot.pending.splice(0, slot.pending.length);
		for (const frame of rest) {
			slot.emitter.fire(frame);
		}
	}

	private emit(slot: IPtySlot, frame: UniverseAgentPtyServerFrame): void {
		if (slot.flushing || !slot.emitter.hasListeners()) {
			slot.pending.push(frame);
			return;
		}
		slot.emitter.fire(frame);
	}

	private onServerMessage(slot: IPtySlot, message: UniverseAgentPtyServerMessage): void {
		if (slot.handleEnded) {
			return;
		}
		const frame = universeAgentPtyServerMessageToFrame(message);
		if (frame) {
			this.emit(slot, frame);
		}
	}

	private onServerClosed(slot: IPtySlot, cause: UniverseAgentSessionStreamCloseCause): void {
		if (slot.handleEnded) {
			return;
		}
		const message = cause.kind === 'error' ? cause.message : '';
		this.emit(slot, ['error', { code: '', message }]);
		this.endHandle(slot.id);
	}

	private endHandle(streamId: string): void {
		const slot = this.streams.get(streamId);
		if (!slot || slot.handleEnded) {
			return;
		}
		slot.handleEnded = true;
		const handle = slot.handle;
		slot.handle = undefined;
		if (!handle) {
			return;
		}
		handle.end();
		handle.dispose();
	}
}
