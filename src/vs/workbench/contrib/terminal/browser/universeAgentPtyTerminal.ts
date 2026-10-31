/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeferredPromise, raceTimeout } from '../../../../base/common/async.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { isCancellationError } from '../../../../base/common/errors.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IProcessPropertyMap, ITerminalChildProcess, ITerminalLaunchError, ITerminalLaunchResult, ProcessPropertyType } from '../../../../platform/terminal/common/terminal.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentExpectedOwner } from '../../../../platform/universeAgent/common/universeAgentExpectedOwner.js';
import { IUniverseAgentPty, previewUniverseAgentPtyEditorCommandId, type UniverseAgentPtyClientFrame, type UniverseAgentPtyServerFrame } from '../../../../platform/universeAgent/common/universeAgentPty.js';
import { readPublishedEngineIdentityId, readPublishedLinkId } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import type { UniverseAgentPtyOpenSessionResponse } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { ACTIVE_GROUP } from '../../../services/editor/common/editorService.js';
import { BasePty } from '../common/basePty.js';
import { ITerminalService } from './terminal.js';

/**
 * Editor-area terminal whose bytes go to the electron-main Pty bridge, then
 * `openPtyStream`. Empty `engineSessionId` is sent as given.
 */
export class UniverseAgentCustomPty extends BasePty implements ITerminalChildProcess {

	private readonly _launch = new DeferredPromise<ITerminalLaunchError | undefined>();
	private readonly _pendingWrites: VSBuffer[] = [];
	private streamId: string | undefined;
	private closed = false;
	private didShutdown = false;
	/** Irreversible terminal: shutdown, launch failure, or exit delivered. No further writes or events. */
	private terminal = false;

	constructor(
		id: number,
		cols: number,
		rows: number,
		private readonly bridge: IUniverseAgentPty,
		private readonly engineSessionId: string,
		private readonly readOwner: () => UniverseAgentExpectedOwner | undefined = () => undefined,
		private readonly launchTimeoutMs = 15_000,
	) {
		super(id, false);
		this._lastDimensions.cols = cols;
		this._lastDimensions.rows = rows;
	}

	async start(): Promise<ITerminalLaunchError | ITerminalLaunchResult | undefined> {
		if (this.closed) {
			return { message: 'Pty closed' };
		}
		let timedOut = false;
		// The deadline starts before openStream so it covers the whole startup
		// chain. Startup rejections settle `_launch`, which the race watches, so
		// shutdown completing `_launch` also wakes this method mid-open/mid-send.
		void this.runStartup().then(undefined, err => {
			this.failLaunch(err instanceof Error ? err.message : String(err));
			this.closeStream();
		});
		const launched = await raceTimeout(this._launch.p, this.launchTimeoutMs, () => { timedOut = true; });
		if (timedOut) {
			const message = localize('universeAgentPty.launchTimeout', "The engine terminal did not start.");
			this.failLaunch(message);
			this.shutdown(true);
			return { message };
		}
		return launched;
	}

	private async runStartup(): Promise<void> {
		// Fail-closed before any IPC: an un-paired or switched link must not open a stream.
		const expectedOwner = this.readOwner();
		if (!expectedOwner) {
			throw new Error(localize('universeAgentPty.noOwner', "The engine terminal could not verify the active engine connection."));
		}
		const streamId = await this.bridge.openStream(expectedOwner).catch(err => {
			// Fail-closed: a stale owner (link switched mid-open) is not retryable here.
			if (isCancellationError(err)) {
				throw new Error(localize('universeAgentPty.ownerRejected', "The engine connection changed. Reopen the terminal."));
			}
			throw err;
		});
		if (this.terminal) {
			void this.bridge.disposeStream(streamId).catch(() => { /* opened after teardown; best-effort */ });
			return;
		}
		this.streamId = streamId;
		this._register(this.bridge.onDynamicPtyServerMessage(streamId)(frame => this.onServerFrame(frame)));
		if (this.terminal) {
			this.closeStream();
			return;
		}
		await this.bridge.sendClientMessage(streamId, this.openFrame());
		if (this.terminal) {
			this.closeStream();
			return;
		}
		this.flushPendingWrites();
	}

	shutdown(_immediate: boolean): void {
		this.closed = true;
		this.terminal = true;
		this.failLaunch('Pty closed');
		this.closeStream();
	}

	/** Settles the launch wait at most once; only an unsettled launch becomes terminal. */
	private failLaunch(message: string): void {
		if (!this._launch.isSettled) {
			this.terminal = true;
			this._launch.complete({ message });
		}
	}

	input(data: string): void {
		if (this._inReplay || this.terminal) {
			return;
		}
		this.writeData(VSBuffer.fromString(data));
	}

	sendSignal(_signal: string): void {
	}

	processBinary(data: string): Promise<void> {
		if (this.terminal) {
			return Promise.resolve();
		}
		const bytes = new Uint8Array(data.length);
		for (let i = 0; i < data.length; i++) {
			bytes[i] = data.charCodeAt(i) & 0xFF;
		}
		this.writeData(VSBuffer.wrap(bytes));
		return Promise.resolve();
	}

	resize(cols: number, rows: number): void {
		if (this._inReplay || this.terminal || (this._lastDimensions.cols === cols && this._lastDimensions.rows === rows)) {
			return;
		}
		this._lastDimensions.cols = cols;
		this._lastDimensions.rows = rows;
		if (!this.streamId) {
			return;
		}
		this.sendFrame(['resize', cols, rows]);
	}

	clearBuffer(): Promise<void> {
		return Promise.resolve();
	}

	acknowledgeDataEvent(_charCount: number): void {
	}

	setUnicodeVersion(_version: '6' | '11'): Promise<void> {
		return Promise.resolve();
	}

	async refreshProperty<T extends ProcessPropertyType>(type: T): Promise<IProcessPropertyMap[T]> {
		return this._properties[type];
	}

	async updateProperty<T extends ProcessPropertyType>(_type: T, _value: IProcessPropertyMap[T]): Promise<void> {
	}

	override dispose(): void {
		this.shutdown(true);
		super.dispose();
	}

	private openFrame(): UniverseAgentPtyClientFrame {
		return ['openSession', {
			engineSessionId: this.engineSessionId,
			clientSessionId: '',
			tabId: '',
			shellArgs: [],
			environment: {},
			columns: this._lastDimensions.cols,
			rows: this._lastDimensions.rows,
		}];
	}

	private writeData(data: VSBuffer): void {
		if (this.terminal) {
			return;
		}
		if (!this.streamId) {
			this._pendingWrites.push(data);
			return;
		}
		this.sendFrame(['write', data]);
	}

	private flushPendingWrites(): void {
		if (this.terminal || !this.streamId) {
			return;
		}
		const pending = this._pendingWrites.splice(0, this._pendingWrites.length);
		for (const data of pending) {
			this.sendFrame(['write', data]);
		}
	}

	/** Fire-and-forget send with the rejection consumed; late frames after teardown are expected. */
	private sendFrame(frame: UniverseAgentPtyClientFrame): void {
		const streamId = this.streamId;
		if (!streamId) {
			return;
		}
		void this.bridge.sendClientMessage(streamId, frame).catch(() => { });
	}

	private closeStream(): void {
		const streamId = this.streamId;
		if (!streamId || this.didShutdown) {
			return;
		}
		this.didShutdown = true;
		// A pending close must not block disposeStream: send close best-effort,
		// then end the main-process handle unconditionally.
		this.sendFrame(['close', false]);
		void this.bridge.disposeStream(streamId).catch(() => { });
	}

	private onServerFrame(frame: UniverseAgentPtyServerFrame): void {
		// Irreversible terminal: drop every late frame (no data/property/exit events).
		if (this.terminal) {
			return;
		}
		switch (frame[0]) {
			case 'openSessionResponse':
				this.consumeOpen(frame[1]);
				break;
			case 'read':
				this._onProcessData.fire(frame[1].toString());
				break;
			case 'sessionClosed':
				// Exactly one exit: first terminal frame wins, later ones are dropped.
				if (!this._launch.isSettled) {
					this.failLaunch('Pty session closed');
				} else {
					this.terminal = true;
					this._onProcessExit.fire(frame[1].exitCode);
				}
				break;
			case 'error':
				if (!this._launch.isSettled) {
					this.failLaunch(frame[1].message);
				} else {
					// BasePty exit is a number. The failure text stays on the data stream.
					if (frame[1].message) {
						this._onProcessData.fire(frame[1].message);
					}
					this.terminal = true;
					this._onProcessExit.fire(1);
				}
				break;
		}
	}

	private consumeOpen(response: UniverseAgentPtyOpenSessionResponse): void {
		if (response.workingDirectory !== undefined) {
			this._properties.cwd = response.workingDirectory;
			this._properties.initialCwd = response.workingDirectory;
			this._onDidChangeProperty.fire({ type: ProcessPropertyType.Cwd, value: response.workingDirectory });
			this._onDidChangeProperty.fire({ type: ProcessPropertyType.InitialCwd, value: response.workingDirectory });
		}
		if (response.title !== undefined) {
			this._properties.title = response.title;
			this._onDidChangeProperty.fire({ type: ProcessPropertyType.Title, value: response.title });
		}
		if (this._launch.isSettled) {
			return;
		}
		if (response.success) {
			this._onProcessReady.fire({
				pid: 0,
				cwd: this._properties.initialCwd,
				windowsPty: undefined,
			});
			this._launch.complete(undefined);
			return;
		}
		const message = response.errorMessage !== undefined ? response.errorMessage : response.failureReason;
		this._launch.complete({ message });
	}
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: previewUniverseAgentPtyEditorCommandId,
			title: localize2('universeAgentPty.openEditor', 'Open Engine Terminal in Editor'),
			f1: false,
		});
	}

	override async run(accessor: ServicesAccessor, args?: unknown): Promise<void> {
		const terminalService = accessor.get(ITerminalService);
		const bridge = accessor.get(IUniverseAgentPty);
		const connection = accessor.get(IUniverseAgentConnection);
		const readOwner = (): UniverseAgentExpectedOwner | undefined => {
			const snapshot = connection.getConnectionSnapshot();
			const engineIdentityId = readPublishedEngineIdentityId(snapshot);
			const linkId = readPublishedLinkId(snapshot);
			return engineIdentityId && linkId ? { engineIdentityId, linkId } : undefined;
		};
		const instance = await terminalService.createTerminal({
			location: readViewColumnLocation(args),
			config: {
				name: localize('universeAgentPty.name', "Terminal"),
				isFeatureTerminal: false,
				customPtyImplementation: (id, cols, rows) => new UniverseAgentCustomPty(id, cols, rows, bridge, '', readOwner),
			},
		});
		await instance.focusWhenReady();
	}
});

function readViewColumnLocation(args: unknown): { viewColumn: number } {
	if (args && typeof args === 'object' && 'location' in args) {
		const location = (args as { location?: unknown }).location;
		if (location && typeof location === 'object' && 'viewColumn' in location) {
			const viewColumn = (location as { viewColumn?: unknown }).viewColumn;
			if (typeof viewColumn === 'number') {
				return { viewColumn };
			}
		}
	}
	return { viewColumn: ACTIVE_GROUP };
}
