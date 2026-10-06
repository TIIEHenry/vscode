/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { strictEqual } from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IProcessReadyEvent, ITerminalChildProcess, ITerminalBackend, TitleEventSource, type IProcessEnvironment, type IShellLaunchConfig, type ITerminalProcessOptions } from '../../../../../platform/terminal/common/terminal.js';
import { IViewDescriptorService, ViewContainerLocation } from '../../../../common/views.js';
import { ITerminalConfigurationService, ITerminalEditorService, ITerminalInstance, ITerminalInstanceService, ITerminalService } from '../../browser/terminal.js';
import { TerminalConfigurationService } from '../../browser/terminalConfigurationService.js';
import { TerminalEditorInput } from '../../browser/terminalEditorInput.js';
import { TerminalInputSerializer } from '../../browser/terminalEditorSerializer.js';
import { TerminalInstance } from '../../browser/terminalInstance.js';
import { IEnvironmentVariableService } from '../../common/environmentVariable.js';
import { EnvironmentVariableService } from '../../common/environmentVariableService.js';
import { ITerminalProfileResolverService } from '../../common/terminal.js';
import { workbenchInstantiationService, TestTerminalProfileResolverService } from '../../../../test/browser/workbenchTestServices.js';

const terminalShellTypeContextKey = {
	set: () => { },
	reset: () => { },
	get: () => undefined
};

class TestViewDescriptorService implements Partial<IViewDescriptorService> {
	readonly onDidChangeLocation = Event.None;
	getViewLocationById(_id: string): ViewContainerLocation {
		return ViewContainerLocation.Panel;
	}
}

class ReportCwdTerminalChildProcess extends Disposable implements ITerminalChildProcess {
	id = 42;
	private readonly _onProcessReady = this._register(new Emitter<IProcessReadyEvent>());
	readonly onProcessReady = this._onProcessReady.event;
	readonly onDidChangeProperty = Event.None;
	readonly onProcessData = Event.None;
	readonly onProcessExit = Event.None;
	readonly onProcessTitleChanged = Event.None;
	readonly onProcessShellTypeChanged = Event.None;
	get capabilities() { return []; }

	constructor(readonly reportedCwd: string) {
		super();
	}

	async start(): Promise<undefined> {
		this._onProcessReady.fire({ pid: 1, cwd: this.reportedCwd, windowsPty: undefined });
		return undefined;
	}

	updateProperty(): Promise<void> {
		throw new Error('not implemented');
	}

	shutdown(): void { }
	input(): void { }
	sendSignal(): void { }
	resize(): void { }
	clearBuffer(): void { }
	acknowledgeDataEvent(): void { }
	async setUnicodeVersion(): Promise<void> { }
	async getInitialCwd(): Promise<string> { return this.reportedCwd; }
	async getCwd(): Promise<string> { return this.reportedCwd; }
	async processBinary(): Promise<void> { }
	refreshProperty(): Promise<any> { return Promise.resolve(''); }
}

class AttachBackendTerminalInstanceService extends Disposable implements Partial<ITerminalInstanceService> {
	constructor(private readonly reportedCwd: string) {
		super();
	}

	async getBackend() {
		return {
			onPtyHostExit: Event.None,
			onPtyHostUnresponsive: Event.None,
			onPtyHostResponsive: Event.None,
			onPtyHostRestart: Event.None,
			onDidMoveWindowInstance: Event.None,
			onDidRequestDetach: Event.None,
			getShellEnvironment: async () => ({}),
			getLatency: () => Promise.resolve([]),
			attachToProcess: async () => this._register(new ReportCwdTerminalChildProcess(this.reportedCwd)),
			createProcess: async (
				_shellLaunchConfig: IShellLaunchConfig,
				_cwd: string,
				_cols: number,
				_rows: number,
				_unicodeVersion: '6' | '11',
				_env: IProcessEnvironment,
				_options: ITerminalProcessOptions,
				_shouldPersist: boolean
			) => {
				throw new Error('createProcess should not be called when attach succeeds');
			},
		} as unknown as ITerminalBackend;
	}
}

function createMockTerminalInstance(overrides: Partial<ITerminalInstance> & Pick<ITerminalInstance, 'persistentProcessId' | 'shouldPersist'>): ITerminalInstance {
	return {
		processId: 0,
		title: 'title',
		titleSource: TitleEventSource.Process,
		icon: undefined,
		color: undefined,
		hasChildProcesses: false,
		shellIntegrationNonce: 'nonce',
		shellLaunchConfig: {
			isFeatureTerminal: false,
			hideFromUser: false,
		},
		...overrides,
	} as ITerminalInstance;
}

suite('TerminalInputSerializer', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	suite('TerminalInputSerializer', () => {
		let serializer: TerminalInputSerializer;

		setup(() => {
			const instantiationService = workbenchInstantiationService(undefined, store);
			instantiationService.stub(ITerminalEditorService, {} as ITerminalEditorService);
			serializer = instantiationService.createInstance(TerminalInputSerializer);
		});

		test('serializes non-empty cwd from the terminal instance', () => {
			const instance = createMockTerminalInstance({
				persistentProcessId: 1,
				shouldPersist: true,
				cwd: '/home/user/project',
			});
			const input = { terminalInstance: instance } as TerminalEditorInput;
			const json = JSON.parse(serializer.serialize(input)!);
			strictEqual(json.cwd, '/home/user/project');
		});

		test('serializes empty cwd when instance cwd is undefined or empty', () => {
			for (const cwd of [undefined, ''] as const) {
				const instance = createMockTerminalInstance({
					persistentProcessId: 1,
					shouldPersist: true,
					cwd,
				});
				const input = { terminalInstance: instance } as TerminalEditorInput;
				const json = JSON.parse(serializer.serialize(input)!);
				strictEqual(json.cwd, '');
			}
		});
	});

	suite('TerminalInputSerializer attach cwd', () => {
		const processCwd = '/process/reported/cwd';

		function createAttachShellLaunchConfig(savedCwd: string): IShellLaunchConfig {
			return {
				executable: '/usr/bin/zsh',
				attachPersistentProcess: {
					id: 42,
					pid: 1,
					title: 'restored',
					titleSource: TitleEventSource.Process,
					cwd: savedCwd,
					shellIntegrationNonce: 'nonce',
				},
			};
		}

		async function createRestoredTerminalInstance(savedCwd: string): Promise<TerminalInstance> {
			const instantiationService = workbenchInstantiationService({
				configurationService: () => new TestConfigurationService({
					terminal: {
						integrated: {
							fontFamily: 'monospace',
							scrollback: 1000,
							fastScrollSensitivity: 2,
							mouseWheelScrollSensitivity: 1,
							unicodeVersion: '6',
							commandsToSkipShell: [],
							shellIntegration: {
								enabled: false,
							},
							enablePersistentSessions: true,
						}
					},
				})
			}, store);
			instantiationService.set(ITerminalProfileResolverService, new TestTerminalProfileResolverService());
			instantiationService.stub(IViewDescriptorService, new TestViewDescriptorService());
			instantiationService.stub(IEnvironmentVariableService, store.add(instantiationService.createInstance(EnvironmentVariableService)));
			instantiationService.stub(ITerminalInstanceService, store.add(new AttachBackendTerminalInstanceService(processCwd)));
			instantiationService.stub(ITerminalService, { setNextCommandId: async () => { } } as Partial<ITerminalService>);
			instantiationService.stub(ITerminalConfigurationService, store.add(instantiationService.createInstance(TerminalConfigurationService)));

			const instance = store.add(instantiationService.createInstance(
				TerminalInstance,
				terminalShellTypeContextKey,
				createAttachShellLaunchConfig(savedCwd),
			));
			await instance.xtermReadyPromise;
			return instance;
		}

		test('keeps process cwd when attachPersistentProcess cwd is empty', async () => {
			const instance = await createRestoredTerminalInstance('');
			strictEqual(instance.cwd, processCwd);
		});

		test('applies attachPersistentProcess cwd when it is non-empty', async () => {
			const savedCwd = '/saved/from/editor';
			const instance = await createRestoredTerminalInstance(savedCwd);
			strictEqual(instance.cwd, savedCwd);
		});
	});
});
