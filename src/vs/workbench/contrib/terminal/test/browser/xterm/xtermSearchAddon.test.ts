/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { Terminal } from '@xterm/xterm';
import { rejects, strictEqual } from 'assert';
import { importAMDNodeModule } from '../../../../../../amdX.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { IEditorOptions } from '../../../../../../editor/common/config/editorOptions.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { TestInstantiationService } from '../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { TerminalCapabilityStore } from '../../../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js';
import { workbenchInstantiationService } from '../../../../../test/browser/workbenchTestServices.js';
import { ITerminalConfiguration } from '../../../common/terminal.js';
import { registerColors } from '../../../common/terminalColorRegistry.js';
import type { IXtermAddonNameToCtor } from '../../../browser/xterm/xtermAddonImporter.js';
import { XtermTerminal } from '../../../browser/xterm/xtermTerminal.js';
import { TestXtermAddonImporter } from './xtermTestUtils.js';

registerColors();

const defaultTerminalConfig: Partial<ITerminalConfiguration> = {
	fontFamily: 'monospace',
	fontWeight: 'normal',
	fontWeightBold: 'normal',
	gpuAcceleration: 'off',
	scrollback: 10,
	fastScrollSensitivity: 2,
	mouseWheelScrollSensitivity: 1,
	unicodeVersion: '6'
};

const disposedSearchAddon = 'Could not create search addon, terminal is disposed';

class FakeSearchAddon {
	static constructed = 0;
	constructor(_options?: { highlightLimit?: number }) {
		FakeSearchAddon.constructed++;
	}
	activate(): void { }
	dispose(): void { }
	readonly onDidChangeResults = () => ({ dispose() { } });
	readonly onBeforeSearch = () => ({ dispose() { } });
	readonly onAfterSearch = () => ({ dispose() { } });
	findNext(): boolean { return true; }
	findPrevious(): boolean { return false; }
}

class SearchImportProbe extends TestXtermAddonImporter {
	searchImports = 0;
	private _failure: unknown;
	private _hold: Promise<void> | undefined;

	failAfter(gate: Promise<void>, error: unknown): void {
		this._hold = gate;
		this._failure = error;
	}

	hold(gate: Promise<void>): void {
		this._hold = gate;
	}

	override async importAddon<T extends keyof IXtermAddonNameToCtor>(name: T): Promise<IXtermAddonNameToCtor[T]> {
		if (name !== 'search') {
			return super.importAddon(name);
		}
		this.searchImports++;
		const failure = this._failure;
		this._failure = undefined;
		const hold = this._hold;
		this._hold = undefined;
		if (hold) {
			await hold;
		}
		if (failure) {
			throw failure;
		}
		return FakeSearchAddon as unknown as IXtermAddonNameToCtor[T];
	}
}

suite('XtermTerminal search addon', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	let instantiationService: TestInstantiationService;
	let XTermBaseCtor: typeof Terminal;

	function createTerminal(importer: SearchImportProbe): XtermTerminal {
		return store.add(instantiationService.createInstance(XtermTerminal, undefined, XTermBaseCtor, {
			cols: 80,
			rows: 30,
			xtermColorProvider: { getBackgroundColor: () => undefined },
			capabilities: store.add(new TerminalCapabilityStore()),
			disableShellIntegrationReporting: true,
			detached: true,
			xtermAddonImporter: importer,
		}, undefined));
	}

	function getSearchAddon(terminal: XtermTerminal): Promise<unknown> {
		return (terminal as unknown as { _getSearchAddon(): Promise<unknown> })._getSearchAddon();
	}

	setup(async () => {
		FakeSearchAddon.constructed = 0;
		const configurationService = new TestConfigurationService({
			editor: {
				fastScrollSensitivity: 2,
				mouseWheelScrollSensitivity: 1
			} as Partial<IEditorOptions>,
			files: {},
			terminal: {
				integrated: defaultTerminalConfig
			}
		});
		instantiationService = workbenchInstantiationService({
			configurationService: () => configurationService
		}, store);
		XTermBaseCtor = (await importAMDNodeModule<typeof import('@xterm/xterm')>('@xterm/xterm', 'lib/xterm.js')).Terminal;
	});

	test('retries a rejected search import and then caches the loaded addon', async () => {
		const importer = new SearchImportProbe();
		const error = new Error('search addon failed to load');
		let release!: () => void;
		importer.failAfter(new Promise<void>(resolve => { release = resolve; }), error);
		const terminal = createTerminal(importer);

		const first = terminal.findNext('a', {});
		const second = terminal.findNext('b', {});
		strictEqual(importer.searchImports, 1);

		release();
		await rejects(first, (reason: unknown) => reason === error);
		await rejects(second, (reason: unknown) => reason === error);
		strictEqual(importer.searchImports, 1);
		strictEqual(FakeSearchAddon.constructed, 0);

		strictEqual(await terminal.findNext('c', {}), true);
		strictEqual(importer.searchImports, 2);
		strictEqual(FakeSearchAddon.constructed, 1);
		strictEqual(await terminal.findNext('d', {}), true);
		strictEqual(importer.searchImports, 2);
		strictEqual(FakeSearchAddon.constructed, 1);
	});

	test('a disposed terminal rejects the in-flight search import and the next call', async () => {
		const importer = new SearchImportProbe();
		let release!: () => void;
		importer.hold(new Promise<void>(resolve => { release = resolve; }));
		const terminal = createTerminal(importer);

		const pending = terminal.findNext('a', {});
		strictEqual(importer.searchImports, 1);
		terminal.dispose();
		release();

		await rejects(pending, (reason: unknown) => reason === disposedSearchAddon);
		strictEqual(FakeSearchAddon.constructed, 0);
		await rejects(terminal.findNext('b', {}), (reason: unknown) => reason === disposedSearchAddon);
		strictEqual(importer.searchImports, 2);
		strictEqual(FakeSearchAddon.constructed, 0);
	});

	test('dispose does not drop a search addon that already loaded', async () => {
		const importer = new SearchImportProbe();
		const terminal = createTerminal(importer);

		strictEqual(await terminal.findNext('a', {}), true);
		const loaded = await getSearchAddon(terminal);
		terminal.dispose();

		strictEqual(await getSearchAddon(terminal), loaded);
		strictEqual(await terminal.findNext('b', {}), true);
		strictEqual(importer.searchImports, 1);
		strictEqual(FakeSearchAddon.constructed, 1);
	});
});
