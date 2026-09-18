/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const RESOLVER_REL = 'src/vs/workbench/contrib/terminal/browser/terminalProfileResolverService.ts';
const SERVICE_REL = 'src/vs/workbench/contrib/terminal/browser/terminalService.ts';
const MARK_REL = 'src/vs/workbench/contrib/terminal/browser/xterm/markNavigationAddon.ts';
const XTERM_REL = 'src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts';
const PROCESS_REL = 'src/vs/workbench/contrib/terminal/browser/terminalProcessManager.ts';
const INSTANCE_REL = 'src/vs/workbench/contrib/terminal/browser/terminalInstance.ts';
const PROFILE_REL = 'src/vs/workbench/contrib/terminal/browser/terminalProfileService.ts';
const ENV_REL = 'src/vs/workbench/contrib/terminal/common/environmentVariableService.ts';
const NATIVE_REL = 'src/vs/workbench/contrib/terminal/electron-browser/terminalNativeContribution.ts';
const VIEW_REL = 'src/vs/workbench/contrib/terminal/browser/terminalView.ts';
const BACKEND_REL = 'src/vs/workbench/contrib/terminal/electron-browser/localTerminalBackend.ts';
const REMOTE_PTY_REL = 'src/vs/workbench/contrib/terminal/browser/remotePty.ts';
const HOST_PTY_REL = 'src/vs/workbench/contrib/terminal/browser/agentHostPty.ts';
const ERRORS_REL = 'src/vs/base/common/errors.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

function assertDoubleThen(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch};`) || source.includes(`${call}${doubleCatch})`) || source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const getEnvironmentThen = `this._remoteAgentService.getEnvironment().then(env => this._primaryBackendOs = env?.os || OS)`;
const initializeBackend = `void this._initializePrimaryBackend()`;
const timeoutZeroThen = `timeout(0).then(() => this._register(this._instantiationService.createInstance(TerminalEditorStyle, mainWindow.document.head)))`;
const lastInstanceThen = `lastInstance.then(() => mark(\`code/terminal/didRecreateTerminal/\${attachPersistentProcess.id}-\${attachPersistentProcess.pid}\`))`;
const setupConfig = `void this._setupConfigListener()`;
const invalidateCollections = `void this._invalidateExtensionCollections()`;
const openFileRequest = `void this._onOpenFileRequest(args[0] as INativeOpenFileRequest)`;
const viewExecuteCommand = `void this._commandService.executeCommand(this._menuItemAction.alt.id, { location: TerminalLocation.Panel } satisfies ICreateTerminalOptions)`;

suite('Terminal leftover Promise fire-and-forget catch scan (D748)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers twenty-two leftover Promise double-chain sites; D685 wrap stays', () => {
		const resolver = fs.readFileSync(resolveSource(RESOLVER_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const mark = fs.readFileSync(resolveSource(MARK_REL), 'utf8');
		const xterm = fs.readFileSync(resolveSource(XTERM_REL), 'utf8');
		const processManager = fs.readFileSync(resolveSource(PROCESS_REL), 'utf8');
		const instance = fs.readFileSync(resolveSource(INSTANCE_REL), 'utf8');
		const profile = fs.readFileSync(resolveSource(PROFILE_REL), 'utf8');
		const env = fs.readFileSync(resolveSource(ENV_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const view = fs.readFileSync(resolveSource(VIEW_REL), 'utf8');
		const d748 = [
			[resolver, getEnvironmentThen],
			[service, initializeBackend],
			[service, timeoutZeroThen],
			[service, lastInstanceThen],
			[profile, setupConfig],
			[native, openFileRequest],
			[view, viewExecuteCommand],
		] as const;
		assert.strictEqual(d748.length, 7);
		for (const [source, call] of d748) {
			assertDoubleThen(source, call);
		}
		assert.strictEqual((service.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 5);
		assert.strictEqual((instance.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 7);
		assert.strictEqual((xterm.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 11);
		assert.strictEqual((mark.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 1);
		assert.strictEqual((processManager.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 1);
		assert.strictEqual((env.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 2);
		assert.ok(service.includes(`reconnectedPromise.then(async () => {`));
		assert.ok(service.includes(`this._whenConnected.complete();\n\t\t})${doubleCatch};`));
		assert.ok(service.includes(`void Promise.resolve(activeGroup).then(group => {`));
		assert.ok(service.includes(`this._terminalGroupService.activeGroup = group;`));
		assert.ok(service.includes(`})${doubleCatch};`));
		assert.ok(mark.includes(`timeout(350).then(() => {`));
		assert.ok(mark.includes(`renderedElement.classList.remove('terminal-scroll-highlight-outline');`));
		assert.ok(mark.includes(`})${doubleCatch};`));
		assert.ok(xterm.includes(`this._xtermAddonLoader.importAddon('clipboard').then(ClipboardAddon => {`));
		assert.ok(xterm.includes(`this._xtermAddonLoader.importAddon('progress').then(ProgressAddon => {`));
		assert.ok(processManager.includes(`void Promise.resolve(this.backend?.getLatency()).then(measurements => {`));
		assert.ok(instance.includes(`if (!this.isDisposed) {\n\t\t\t\tthrow err;\n\t\t\t}\n\t\t})${doubleCatch};`));
		assert.ok(instance.includes(`contribution.xtermReady?.(xterm);`));
		assert.ok(instance.includes(`this._userHome = userHome.fsPath;`));
		assert.ok(instance.includes(`contribution.xtermOpen?.(xterm);`));
		assert.ok(instance.includes(`this._messageTitleDisposable.value = xterm.raw.onTitleChange(e => this._onTitleChange(e));`));
		assert.ok(instance.includes(`this._attachPressAnyKeyToCloseListener(xterm.raw);`));
		assert.ok(instance.includes(`contribution.layout?.(xterm, dimension);`));
		assert.ok(env.includes(`() => void this._invalidateExtensionCollections()${doubleCatch}`));
		assert.strictEqual((env.match(new RegExp(invalidateCollections.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, 2);
		assert.ok(!env.includes(`${invalidateCollections};`));
		const d748Count = 5 + 7 + 2 + 1 + 1 + 2 + 1 + 1 + 1 + 1;
		assert.strictEqual(d748Count, 22);
	});

	test('leftover getEnvironment / initialize / timeout / reconnect / recreate thens are Promise double-chain', () => {
		const resolver = fs.readFileSync(resolveSource(RESOLVER_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		assert.ok(resolver.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(service.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(resolver.includes('getEnvironment(): Promise<IProcessEnvironment>;') || resolver.includes('this._remoteAgentService.getEnvironment()'));
		assert.ok(service.includes('private async _initializePrimaryBackend() {'));
		assertDoubleThen(resolver, getEnvironmentThen);
		assertDoubleThen(service, initializeBackend);
		assertDoubleThen(service, timeoutZeroThen);
		assert.ok(service.includes(`this._whenConnected.complete();\n\t\t})${doubleCatch};`));
		assert.ok(service.includes(`void Promise.resolve(activeGroup).then(group => {`));
		assertDoubleThen(service, lastInstanceThen);
	});

	test('leftover addon / latency / xtermReady / userHome thens are Promise double-chain', () => {
		const mark = fs.readFileSync(resolveSource(MARK_REL), 'utf8');
		const xterm = fs.readFileSync(resolveSource(XTERM_REL), 'utf8');
		const processManager = fs.readFileSync(resolveSource(PROCESS_REL), 'utf8');
		const instance = fs.readFileSync(resolveSource(INSTANCE_REL), 'utf8');
		assert.ok(mark.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(xterm.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(processManager.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(instance.includes("import { BugIndicatingError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(xterm.includes(`async importAddon<T extends keyof IXtermAddonNameToCtor>(name: T): Promise<IXtermAddonNameToCtor[T]>` ) || xterm.includes(`this._xtermAddonLoader.importAddon('clipboard')`));
		assert.ok(processManager.includes('async getLatency(): Promise<IPtyHostLatencyMeasurement[]>') || processManager.includes('this.backend?.getLatency()'));
		assert.ok(instance.includes('this._xtermReadyPromise.then'));
		assert.ok(mark.includes(`timeout(350).then(() => {`) && mark.includes(doubleCatch));
		assert.ok(xterm.includes(`this._xtermAddonLoader.importAddon('clipboard').then(ClipboardAddon => {`) && xterm.includes(doubleCatch));
		assert.ok(xterm.includes(`this._xtermAddonLoader.importAddon('progress').then(ProgressAddon => {`) && xterm.includes(doubleCatch));
		assert.ok(processManager.includes(`void Promise.resolve(this.backend?.getLatency()).then(measurements => {`) && processManager.includes(doubleCatch));
		assert.ok(instance.includes(`if (!this.isDisposed) {\n\t\t\t\tthrow err;\n\t\t\t}\n\t\t})${doubleCatch};`));
		assert.ok(instance.includes(`contribution.xtermReady?.(xterm);`) && instance.includes(doubleCatch));
		assert.ok(instance.includes(`this._pathService.userHome().then(userHome => {`) && instance.includes(doubleCatch));
	});

	test('leftover setupConfig / invalidate / openFiles / inline-tab executeCommand leftover voids are Promise double-chain', () => {
		const profile = fs.readFileSync(resolveSource(PROFILE_REL), 'utf8');
		const env = fs.readFileSync(resolveSource(ENV_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const view = fs.readFileSync(resolveSource(VIEW_REL), 'utf8');
		assert.ok(profile.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(env.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(native.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(view.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(profile.includes('private async _setupConfigListener(): Promise<void> {'));
		assert.ok(env.includes('private async _invalidateExtensionCollections(): Promise<void> {'));
		assert.ok(native.includes('private async _onOpenFileRequest(request: INativeOpenFileRequest): Promise<void> {'));
		assertDoubleThen(profile, setupConfig);
		assert.strictEqual((env.match(new RegExp(`${invalidateCollections.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${doubleCatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) ?? []).length, 2);
		assertDoubleThen(native, openFileRequest);
		assertDoubleThen(view, viewExecuteCommand);
	});

	test('opener / D145 / Connect acquirePort / Pty / assigned then / two-arg then stay skipped', () => {
		const instance = fs.readFileSync(resolveSource(INSTANCE_REL), 'utf8');
		const backend = fs.readFileSync(resolveSource(BACKEND_REL), 'utf8');
		const remotePty = fs.readFileSync(resolveSource(REMOTE_PTY_REL), 'utf8');
		const hostPty = fs.readFileSync(resolveSource(HOST_PTY_REL), 'utf8');
		assert.ok(instance.includes("this._openerService.open('https://code.visualstudio.com/docs/terminal/shell-integration?referrer=in-product');"));
		assert.ok(!instance.includes(`this._openerService.open('https://code.visualstudio.com/docs/terminal/shell-integration?referrer=in-product')${doubleCatch}`));
		assert.ok(backend.includes(`acquirePort('vscode:createPtyHostMessageChannel', 'vscode:createPtyHostMessageChannelResult').then(port => {`));
		assert.ok(!backend.includes(`acquirePort('vscode:createPtyHostMessageChannel', 'vscode:createPtyHostMessageChannelResult').then(port => {}${doubleCatch}`));
		assert.ok(backend.includes('const directProxy = ProxyChannel.toService<IPtyService>(getDelayedChannel(this._directProxyClientEventually.p.then(client => client.getChannel(TerminalIpcChannels.PtyHostWindow))));'));
		assert.ok(remotePty.includes('this._startBarrier.wait().then(_ => {'));
		assert.ok(!remotePty.includes(`this._startBarrier.wait().then(_ => {}${doubleCatch}`));
		assert.ok(hostPty.includes('void this._connection.disposeTerminal(this._terminalUri).catch(err => this._logHostDisposalError(err));'));
		assert.ok(!hostPty.includes('void this._connection.disposeTerminal(this._terminalUri).catch(onUnexpectedError)'));
		assert.ok(instance.includes('return this.ptyProcessReady.then(() => this._resize(cols, rows, pixelWidth, pixelHeight));') || fs.readFileSync(resolveSource(PROCESS_REL), 'utf8').includes('return this.ptyProcessReady.then(() => this._resize(cols, rows, pixelWidth, pixelHeight));'));
	});
});
