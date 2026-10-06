/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../../../base/browser/window.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { EditorService } from '../../../../services/editor/browser/editorService.js';
import { createEditorParts, workbenchInstantiationService } from '../../workbenchTestServices.js';
import { ConversationEditorPartImpl } from '../../../../browser/parts/editor/conversationEditorPart.js';
import { installConversationLensResizeObserverHarness } from '../../../../contrib/conversation/test/browser/conversationLensLayoutHarness.js';

suite('ConversationEditorPart - layout & ResizeObserver', () => {

	installConversationLensResizeObserverHarness();

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disposables = store as unknown as DisposableStore;

	interface FakeObserverRecord {
		callback: () => void;
		target: Element | undefined;
		disconnected: boolean;
	}

	let activeObservers: FakeObserverRecord[] = [];

	class FakeResizeObserver {
		private readonly record: FakeObserverRecord;

		constructor(callback: () => void) {
			this.record = {
				callback,
				target: undefined,
				disconnected: false,
			};
			activeObservers.push(this.record);
		}

		observe(target: Element): void {
			this.record.target = target;
		}

		unobserve(_target: Element): void {
		}

		disconnect(): void {
			this.record.disconnected = true;
		}
	}

	interface LayoutCall {
		readonly width: number;
		readonly height: number;
		readonly top: number;
		readonly left: number;
	}

	let layoutCalls: LayoutCall[] = [];
	const originalLayout = ConversationEditorPartImpl.prototype.layout;
	const originalMainWindowResizeObserver = mainWindow.ResizeObserver;
	const originalGlobalResizeObserver = globalThis.ResizeObserver;

	setup(() => {
		layoutCalls = [];
		activeObservers = [];
		// eslint-disable-next-line local/code-no-any-casts
		(mainWindow as any).ResizeObserver = FakeResizeObserver;
		// eslint-disable-next-line local/code-no-any-casts
		(globalThis as any).ResizeObserver = FakeResizeObserver;
		ConversationEditorPartImpl.prototype.layout = function (width: number, height: number, top: number, left: number) {
			layoutCalls.push({ width, height, top, left });
			return originalLayout.call(this, width, height, top, left);
		};
	});

	teardown(() => {
		ConversationEditorPartImpl.prototype.layout = originalLayout;
		// eslint-disable-next-line local/code-no-any-casts
		(mainWindow as any).ResizeObserver = originalMainWindowResizeObserver;
		// eslint-disable-next-line local/code-no-any-casts
		(globalThis as any).ResizeObserver = originalGlobalResizeObserver;
	});

	async function createPartsHarness() {
		const instantiationService = workbenchInstantiationService(undefined, disposables);
		const parts = await createEditorParts(instantiationService, disposables);
		store.add(parts);
		instantiationService.stub(IEditorGroupsService, parts);
		const editorService = store.add(instantiationService.createInstance(EditorService, undefined));
		instantiationService.stub(IEditorService, editorService);
		return parts;
	}

	test('0x0 host falls back to (800, 600, 0, 0) and ResizeObserver updates when size becomes positive', async () => {
		const parts = await createPartsHarness();

		const host = document.createElement('div');
		let hostWidth = 0;
		let hostHeight = 0;
		Object.defineProperty(host, 'clientWidth', { get: () => hostWidth, configurable: true });
		Object.defineProperty(host, 'clientHeight', { get: () => hostHeight, configurable: true });
		disposables.add({ dispose: () => host.remove() });

		const part = parts.createConversationEditorPart(host, 'session-test-zero');
		assert.ok(part);

		// Initial layout fallback for 0x0 host
		assert.strictEqual(layoutCalls.length, 1);
		assert.deepStrictEqual(layoutCalls[0], { width: 800, height: 600, top: 0, left: 0 });

		const observerRecord = activeObservers.find(obs => obs.target === host);
		assert.ok(observerRecord, 'ResizeObserver must observe host');
		assert.strictEqual(observerRecord.disconnected, false);

		// ResizeObserver fires with 0x0 host: should skip layout
		hostWidth = 0;
		hostHeight = 0;
		observerRecord.callback();
		assert.strictEqual(layoutCalls.length, 1, 'ResizeObserver on 0x0 should not trigger layout');

		// ResizeObserver fires when size becomes positive (500x400): triggers layout(500, 400, 0, 0)
		hostWidth = 500;
		hostHeight = 400;
		observerRecord.callback();
		assert.strictEqual(layoutCalls.length, 2, 'ResizeObserver on positive dimensions should trigger layout');
		assert.deepStrictEqual(layoutCalls[1], { width: 500, height: 400, top: 0, left: 0 });

		// Repeated ResizeObserver fires with same positive size (500x400): should skip duplicate layout
		observerRecord.callback();
		assert.strictEqual(layoutCalls.length, 2, 'Consecutive trigger with same dimensions should not repeat layout');

		// Changing to another positive size triggers layout
		hostWidth = 600;
		hostHeight = 450;
		observerRecord.callback();
		assert.strictEqual(layoutCalls.length, 3);
		assert.deepStrictEqual(layoutCalls[2], { width: 600, height: 450, top: 0, left: 0 });

		// Dropping to non-positive skips layout
		hostWidth = 0;
		hostHeight = 450;
		observerRecord.callback();
		assert.strictEqual(layoutCalls.length, 3, 'Non-positive width should skip layout');

		// Disposal disconnects observer
		parts.disposeConversationEditorPart('session-test-zero');
		assert.strictEqual(observerRecord.disconnected, true, 'Observer should disconnect on dispose');
	});

	test('fallback from 0x0 records (0, 0) so later 800x600 size still triggers layout', async () => {
		const parts = await createPartsHarness();

		const host = document.createElement('div');
		let hostWidth = 0;
		let hostHeight = 0;
		Object.defineProperty(host, 'clientWidth', { get: () => hostWidth, configurable: true });
		Object.defineProperty(host, 'clientHeight', { get: () => hostHeight, configurable: true });
		disposables.add({ dispose: () => host.remove() });

		parts.createConversationEditorPart(host, 'session-test-fallback-repeat');

		// Initial fallback
		assert.strictEqual(layoutCalls.length, 1);
		assert.deepStrictEqual(layoutCalls[0], { width: 800, height: 600, top: 0, left: 0 });

		const observerRecord = activeObservers.find(obs => obs.target === host);
		assert.ok(observerRecord);

		// Size becomes 800x600. Because previous recorded measurement was (0, 0), layout must run.
		hostWidth = 800;
		hostHeight = 600;
		observerRecord.callback();
		assert.strictEqual(layoutCalls.length, 2);
		assert.deepStrictEqual(layoutCalls[1], { width: 800, height: 600, top: 0, left: 0 });

		// Consecutive 800x600 should not run again
		observerRecord.callback();
		assert.strictEqual(layoutCalls.length, 2);

		parts.disposeConversationEditorPart('session-test-fallback-repeat');
		assert.strictEqual(observerRecord.disconnected, true);
	});

	test('initial positive host uses host dimensions and does not duplicate on first observer trigger', async () => {
		const parts = await createPartsHarness();

		const host = document.createElement('div');
		const hostWidth = 720;
		const hostHeight = 480;
		Object.defineProperty(host, 'clientWidth', { get: () => hostWidth, configurable: true });
		Object.defineProperty(host, 'clientHeight', { get: () => hostHeight, configurable: true });
		disposables.add({ dispose: () => host.remove() });

		parts.createConversationEditorPart(host, 'session-test-positive');

		// Initial layout uses measured positive dimensions
		assert.strictEqual(layoutCalls.length, 1);
		assert.deepStrictEqual(layoutCalls[0], { width: 720, height: 480, top: 0, left: 0 });

		const observerRecord = activeObservers.find(obs => obs.target === host);
		assert.ok(observerRecord);

		// Observer fires with same initial positive dimensions: should not duplicate
		observerRecord.callback();
		assert.strictEqual(layoutCalls.length, 1);

		parts.disposeConversationEditorPart('session-test-positive');
		assert.strictEqual(observerRecord.disconnected, true);
	});
});
