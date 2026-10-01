/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeferredPromise } from '../../../../base/common/async.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IProcessPropertyMap, ITerminalChildProcess, ITerminalLaunchError, ITerminalLaunchResult, ProcessPropertyType } from '../../../../platform/terminal/common/terminal.js';
import { IUniverseAgentPty, previewUniverseAgentPtyEditorCommandId, type UniverseAgentPtyClientFrame, type UniverseAgentPtyServerFrame } from '../../../../platform/universeAgent/common/universeAgentPty.js';
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

	constructor(
		id: number,
		cols: number,
		rows: number,
		private readonly bridge: IUniverseAgentPty,
		private readonly engineSessionId: string,
	) {
		super(id, false);
		this._lastDimensions.cols = cols;
		this._lastDimensions.rows = rows;
	}

	async start(): Promise<ITerminalLaunchError | ITerminalLaunchResult | undefined> {
		if (this.closed) {
			return { message: 'Pty closed' };
		}
		try {
			const streamId = await this.bridge.openStream();
			if (this.closed) {
				await this.bridge.disposeStream(streamId);
				return { message: 'Pty closed' };
			}
			this.streamId = streamId;
			this._register(this.bridge.onDynamicPtyServerMessage(streamId)(frame => this.onServerFrame(frame)));
			await this.bridge.sendClientMessage(streamId, this.openFrame());
			this.flushPendingWrites();
			return await this._launch.p;
		} catch (err) {
			return { message: err instanceof Error ? err.message : String(err) };
		}
	}

	shutdown(_immediate: boolean): void {
		this.closed = true;
		if (!this._launch.isSettled) {
			this._launch.complete({ message: 'Pty closed' });
		}
		this.closeStream();
	}

	input(data: string): void {
		if (this._inReplay) {
			return;
		}
		this.writeData(VSBuffer.fromString(data));
	}

	sendSignal(_signal: string): void {
	}

	processBinary(data: string): Promise<void> {
		const bytes = new Uint8Array(data.length);
		for (let i = 0; i < data.length; i++) {
			bytes[i] = data.charCodeAt(i) & 0xFF;
		}
		this.writeData(VSBuffer.wrap(bytes));
		return Promise.resolve();
	}

	resize(cols: number, rows: number): void {
		if (this._inReplay || (this._lastDimensions.cols === cols && this._lastDimensions.rows === rows)) {
			return;
		}
		this._lastDimensions.cols = cols;
		this._lastDimensions.rows = rows;
		if (!this.streamId) {
			return;
		}
		void this.bridge.sendClientMessage(this.streamId, ['resize', cols, rows]);
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
		if (!this.streamId) {
			this._pendingWrites.push(data);
			return;
		}
		void this.bridge.sendClientMessage(this.streamId, ['write', data]);
	}

	private flushPendingWrites(): void {
		if (!this.streamId) {
			return;
		}
		const pending = this._pendingWrites.splice(0, this._pendingWrites.length);
		for (const data of pending) {
			void this.bridge.sendClientMessage(this.streamId, ['write', data]);
		}
	}

	private closeStream(): void {
		const streamId = this.streamId;
		if (!streamId || this.didShutdown) {
			return;
		}
		this.didShutdown = true;
		void this.bridge.sendClientMessage(streamId, ['close', false]).finally(() => {
			void this.bridge.disposeStream(streamId);
		});
	}

	private onServerFrame(frame: UniverseAgentPtyServerFrame): void {
		switch (frame[0]) {
			case 'openSessionResponse':
				this.consumeOpen(frame[1]);
				break;
			case 'read':
				this._onProcessData.fire(frame[1].toString());
				break;
			case 'sessionClosed':
				if (!this._launch.isSettled) {
					this._launch.complete({ message: 'Pty session closed' });
				} else {
					this._onProcessExit.fire(frame[1].exitCode);
				}
				break;
			case 'error':
				if (!this._launch.isSettled) {
					this._launch.complete({ message: frame[1].message });
				} else {
					this._onProcessExit.fire(undefined);
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

	override async run(accessor: ServicesAccessor): Promise<void> {
		const terminalService = accessor.get(ITerminalService);
		const bridge = accessor.get(IUniverseAgentPty);
		const instance = await terminalService.createTerminal({
			location: { viewColumn: ACTIVE_GROUP },
			config: {
				name: localize('universeAgentPty.name', "Terminal"),
				isFeatureTerminal: false,
				customPtyImplementation: (id, cols, rows) => new UniverseAgentCustomPty(id, cols, rows, bridge, ''),
			},
		});
		await instance.focusWhenReady();
	}
});
