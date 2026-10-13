/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import * as path from '../../../../../base/common/path.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IMessagePassingProtocol } from '../../../../../base/parts/ipc/common/ipc.js';
import { LogLevel } from '../../../../../platform/log/common/log.js';
import { WorkbenchState } from '../../../../../platform/workspace/common/workspace.js';
import { WebWorkerExtensionHost } from '../../browser/webWorkerExtensionHost.js';
import { ExtensionHostStartup, ExtensionHostExtensions } from '../../common/extensions.js';
import { LocalWebWorkerRunningLocation } from '../../common/extensionRunningLocation.js';

const doubleChain = 'this._protocolPromise.then(protocol => this._protocol = protocol).catch(onUnexpectedError).catch(onUnexpectedError);';

function iframeCount(container: HTMLElement): number {
	return container.querySelectorAll('iframe.web-worker-ext-host-iframe').length;
}

function extHostId(iframe: HTMLIFrameElement): string {
	const match = /vscodeWebWorkerExtHostId=([^&]+)/.exec(iframe.getAttribute('src') ?? '');
	assert.ok(match, iframe.getAttribute('src') ?? '');
	return decodeURIComponent(match[1]);
}

async function waitForIframe(container: HTMLElement): Promise<HTMLIFrameElement> {
	for (let attempt = 0; attempt < 50; attempt++) {
		const iframe = container.querySelector('iframe.web-worker-ext-host-iframe');
		if (iframe instanceof HTMLIFrameElement && iframe.contentWindow) {
			return iframe;
		}
		await new Promise(resolve => setTimeout(resolve, 0));
	}
	throw new Error('web worker extension host iframe was not created');
}

function postHostMessage(iframe: HTMLIFrameElement, data: object): void {
	window.dispatchEvent(new MessageEvent('message', {
		data,
		source: iframe.contentWindow,
	}));
}

function rejectWithError(iframe: HTMLIFrameElement, message: string): void {
	postHostMessage(iframe, {
		vscodeWebWorkerExtHostId: extHostId(iframe),
		error: { name: 'Error', message, stack: 'stack' },
	});
}

function postWire(port: MessagePort, byte: number): void {
	const copy = new Uint8Array([byte]).buffer;
	port.postMessage(copy, [copy]);
}

function protocolPromiseOf(host: WebWorkerExtensionHost): Promise<IMessagePassingProtocol> | null {
	return Reflect.get(host, '_protocolPromise');
}

async function withUnexpectedErrorsSwallowed(run: () => Promise<void>): Promise<void> {
	const original = errorHandler.getUnexpectedErrorHandler();
	setUnexpectedErrorHandler(() => { });
	try {
		await run();
		await Promise.resolve();
	} finally {
		setUnexpectedErrorHandler(original);
	}
}

function createHost(store: ReturnType<typeof ensureNoDisposablesAreLeakedInTestSuite>, container: HTMLElement): WebWorkerExtensionHost {
	const storageHome = URI.file('/tmp/web-worker-ext-host');
	const host = new WebWorkerExtensionHost(
		new LocalWebWorkerRunningLocation(0),
		ExtensionHostStartup.EagerAutoStart,
		{ getInitData: async () => ({ extensions: new ExtensionHostExtensions(0, [], []) }) },
		{
			sessionId: 'session',
			machineId: 'machine',
			sqmId: 'sqm',
			devDeviceId: 'device',
			firstSessionDate: '2020-01-01T00:00:00.000Z',
			msftInternal: false,
		} as never,
		{
			getWorkspace: () => ({ id: 'empty', folders: [], transient: false }),
			getWorkbenchState: () => WorkbenchState.EMPTY,
		} as never,
		{} as never,
		{ getLevel: () => LogLevel.Info } as never,
		{ getRegisteredLoggers: () => [] } as never,
		{
			extHostLogsPath: storageHome,
			debugExtensionHost: undefined,
			debugRenderer: false,
			extensionDevelopmentLocationURI: undefined,
			extensionTestsLocationURI: undefined,
			workspaceStorageHome: storageHome,
			isSessionsWindow: false,
			remoteAuthority: undefined,
			options: undefined,
			isBuilt: true,
			disableTelemetry: true,
		} as never,
		{ defaultProfile: { globalStorageHome: storageHome } } as never,
		{
			commit: undefined,
			version: '0.0.0',
			quality: undefined,
			date: undefined,
			nameLong: 'Test',
			embedderIdentifier: undefined,
			urlProtocol: 'vscode',
			extensionsGallery: undefined,
			remoteExtensionTips: {},
			virtualWorkspaceExtensionTips: {},
		} as never,
		{ mainContainer: container } as never,
		{} as never,
		// Fragment keeps the appended query off the about:blank URL so the iframe loads quietly.
		{ getWorkerUrl: () => 'about:blank#' } as never,
		{ defaultLogLevels: { default: LogLevel.Info, extensions: [] } } as never,
		{} as never,
	);
	store.add(host);
	return host;
}

suite('WebWorkerExtensionHost start', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('first barrier failure starts again and does not stack iframes or listeners', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		try {
			const host = createHost(store, container);
			const exits: string[] = [];
			store.add(host.onExit(exit => exits.push(exit[1] ?? '')));

			const first = host.start();
			const iframe = await waitForIframe(container);
			const id = extHostId(iframe);
			const source = iframe.contentWindow;
			assert.strictEqual(iframeCount(container), 1);

			await withUnexpectedErrorsSwallowed(async () => {
				rejectWithError(iframe, 'barrier failed');
				await assert.rejects(first, (error: unknown) => error instanceof Error && error.message === 'barrier failed');
			});

			assert.strictEqual(protocolPromiseOf(host), null);
			assert.strictEqual(iframeCount(container), 0);
			assert.deepStrictEqual(exits, ['barrier failed']);

			window.dispatchEvent(new MessageEvent('message', {
				data: {
					vscodeWebWorkerExtHostId: id,
					error: { name: 'Error', message: 'late', stack: 'stack' },
				},
				source,
			}));
			await new Promise(resolve => setTimeout(resolve, 0));
			assert.deepStrictEqual(exits, ['barrier failed']);

			const again = host.start();
			const retryIframe = await waitForIframe(container);
			assert.notStrictEqual(retryIframe, iframe);
			assert.strictEqual(iframeCount(container), 1);
			await withUnexpectedErrorsSwallowed(async () => {
				rejectWithError(retryIframe, 'barrier failed again');
				await assert.rejects(again, (error: unknown) => error instanceof Error && error.message === 'barrier failed again');
			});
			assert.strictEqual(iframeCount(container), 0);
			assert.deepStrictEqual(exits, ['barrier failed', 'barrier failed again']);
		} finally {
			container.remove();
		}
	});

	test('in-flight start calls share one attempt', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		try {
			const host = createHost(store, container);
			const first = host.start();
			const second = host.start();
			const iframe = await waitForIframe(container);
			assert.strictEqual(iframeCount(container), 1);
			assert.strictEqual(protocolPromiseOf(host) !== null, true);

			await withUnexpectedErrorsSwallowed(async () => {
				rejectWithError(iframe, 'shared failure');
				await assert.rejects(first, (error: unknown) => error instanceof Error && error.message === 'shared failure');
				await assert.rejects(second, (error: unknown) => error instanceof Error && error.message === 'shared failure');
			});
			assert.strictEqual(protocolPromiseOf(host), null);
			assert.strictEqual(iframeCount(container), 0);
		} finally {
			container.remove();
		}
	});

	test('a resolved start stays cached and the iframe goes away on dispose', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		try {
			const host = createHost(store, container);
			const channel = new MessageChannel();
			channel.port2.onmessage = () => postWire(channel.port2, 1);
			const pending = host.start();
			const iframe = await waitForIframe(container);
			postHostMessage(iframe, {
				vscodeWebWorkerExtHostId: extHostId(iframe),
				data: channel.port1,
			});
			postWire(channel.port2, 2);

			const protocol = await pending;
			assert.strictEqual(iframeCount(container), 1);
			assert.strictEqual(await host.start(), protocol);
			assert.strictEqual(iframeCount(container), 1);

			host.dispose();
			assert.strictEqual(iframeCount(container), 0);
		} finally {
			container.remove();
		}
	});

	test('an older rejection does not clear a newer attempt', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		try {
			const host = createHost(store, container);
			const first = host.start();
			const iframe = await waitForIframe(container);
			const replacement = new Promise<IMessagePassingProtocol>(() => { });
			Reflect.set(host, '_protocolPromise', replacement);

			await withUnexpectedErrorsSwallowed(async () => {
				rejectWithError(iframe, 'stale');
				await assert.rejects(first, (error: unknown) => error instanceof Error && error.message === 'stale');
			});

			assert.strictEqual(protocolPromiseOf(host), replacement);
			assert.strictEqual(iframeCount(container), 0);
			const shared = host.start();
			await new Promise(resolve => setTimeout(resolve, 0));
			assert.strictEqual(iframeCount(container), 0);
			assert.strictEqual(protocolPromiseOf(host), replacement);
			void shared;
		} finally {
			container.remove();
		}
	});

	test('leftover protocol then double-chain is still the line the scan test requires', () => {
		const root = process.cwd();
		const source = fs.readFileSync(path.join(root, 'src/vs/workbench/services/extensions/browser/webWorkerExtensionHost.ts'), 'utf8');
		const scan = fs.readFileSync(path.join(root, 'src/vs/workbench/services/extensions/test/node/extensionsServicesLeftoverPromiseCatchScan.test.ts'), 'utf8');
		assert.ok(source.includes(doubleChain));
		assert.ok(scan.includes('this._protocolPromise.then(protocol => this._protocol = protocol)'));
		assert.ok(scan.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));
	});
});
