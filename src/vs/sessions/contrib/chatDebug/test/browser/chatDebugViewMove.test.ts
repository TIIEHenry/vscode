/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ExtensionIdentifier } from '../../../../../platform/extensions/common/extensions.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IViewContainersRegistry, IViewDescriptor, IViewsRegistry, ViewContainer, ViewContainerLocation, Extensions as ViewContainerExtensions, WindowEnablement } from '../../../../../workbench/common/views.js';
import { attachSessionsChatDebugView } from '../../browser/chatDebug.contribution.js';

suite('SessionsChatDebugViewMove', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();
	const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
	const viewsRegistry = Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry);

	const copilotViewId = 'copilot-chat';
	const extensionContainerId = 'workbench.view.extension.copilot-chat';
	const sessionsContainerId = 'workbench.sessions.panel.chatDebugContainer';
	const explorerContainerId = 'test.chatDebug.explorer';

	let attachment: DisposableStore | undefined;
	const ownedContainerIds = new Set<string>();

	teardown(() => {
		attachment?.dispose();
		attachment = undefined;

		const current = viewsRegistry.getViewContainer(copilotViewId);
		const view = viewsRegistry.getView(copilotViewId);
		if (current && view) {
			viewsRegistry.deregisterViews([view], current);
		}

		for (const id of [sessionsContainerId, extensionContainerId, explorerContainerId]) {
			if (!ownedContainerIds.has(id) && id !== sessionsContainerId) {
				continue;
			}
			const container = viewContainerRegistry.get(id);
			if (!container) {
				continue;
			}
			const views = [...viewsRegistry.getViews(container)];
			if (views.length) {
				viewsRegistry.deregisterViews(views, container);
			}
			viewContainerRegistry.deregisterViewContainer(container);
		}
		ownedContainerIds.clear();
	});

	function registerContainer(id: string, location: ViewContainerLocation): ViewContainer {
		const existing = viewContainerRegistry.get(id);
		if (existing) {
			ownedContainerIds.add(id);
			return existing;
		}
		// eslint-disable-next-line local/code-no-any-casts
		const container = viewContainerRegistry.registerViewContainer({ id, title: { value: id, original: id }, ctorDescriptor: new SyncDescriptor(<any>{}) }, location);
		ownedContainerIds.add(id);
		return container;
	}

	function registerCopilotView(container: ViewContainer): IViewDescriptor {
		const view = {
			id: copilotViewId,
			name: { value: 'Chat Debug', original: 'Chat Debug' },
			// eslint-disable-next-line local/code-no-any-casts
			ctorDescriptor: new SyncDescriptor(<any>{}),
			canMoveView: true,
			extensionId: new ExtensionIdentifier('GitHub.copilot-chat'),
		};
		viewsRegistry.registerViews([view], container);
		return view;
	}

	function flushMicrotasks(): Promise<void> {
		return new Promise(resolve => queueMicrotask(() => queueMicrotask(() => queueMicrotask(resolve))));
	}

	test('moves copilot-chat into the sessions panel container', async () => {
		const extensionContainer = registerContainer(extensionContainerId, ViewContainerLocation.Sidebar);
		registerCopilotView(extensionContainer);
		attachment = disposables.add(attachSessionsChatDebugView(viewContainerRegistry, viewsRegistry));

		await flushMicrotasks();

		const moved = viewsRegistry.getView(copilotViewId);
		assert.ok(moved);
		assert.strictEqual(viewsRegistry.getViewContainer(copilotViewId)?.id, sessionsContainerId);
		assert.strictEqual(viewContainerRegistry.get(extensionContainerId), undefined);
		assert.strictEqual(moved.canMoveView, false);
		assert.strictEqual(moved.windowEnablement, WindowEnablement.Sessions);
		assert.strictEqual(moved.id, copilotViewId);
		const extensionId = (moved as IViewDescriptor & { extensionId?: ExtensionIdentifier }).extensionId;
		assert.strictEqual(extensionId?.value, 'GitHub.copilot-chat');
		assert.strictEqual(viewContainerRegistry.get(sessionsContainerId)?.hideIfEmpty, true);
		assert.strictEqual(viewContainerRegistry.get(sessionsContainerId)?.windowEnablement, WindowEnablement.Sessions);
	});

	test('moves the view again after the extension removes and re-registers it', async () => {
		const extensionContainer = registerContainer(extensionContainerId, ViewContainerLocation.Sidebar);
		registerCopilotView(extensionContainer);
		attachment = disposables.add(attachSessionsChatDebugView(viewContainerRegistry, viewsRegistry));
		await flushMicrotasks();

		const sessionsContainer = viewContainerRegistry.get(sessionsContainerId);
		assert.ok(sessionsContainer);
		const moved = viewsRegistry.getView(copilotViewId);
		assert.ok(moved);
		viewsRegistry.deregisterViews([moved], sessionsContainer);

		const again = registerContainer(extensionContainerId, ViewContainerLocation.Sidebar);
		registerCopilotView(again);
		await flushMicrotasks();

		assert.strictEqual(viewsRegistry.getViewContainer(copilotViewId)?.id, sessionsContainerId);
		assert.strictEqual(viewContainerRegistry.get(extensionContainerId), undefined);
		assert.strictEqual(viewContainerRegistry.get(sessionsContainerId), sessionsContainer);
		assert.strictEqual(viewsRegistry.getView(copilotViewId)?.canMoveView, false);
		assert.strictEqual(viewsRegistry.getView(copilotViewId)?.windowEnablement, WindowEnablement.Sessions);
	});

	test('moves a view that lands in the extension container via moveViews', async () => {
		const explorer = registerContainer(explorerContainerId, ViewContainerLocation.Sidebar);
		registerCopilotView(explorer);
		attachment = disposables.add(attachSessionsChatDebugView(viewContainerRegistry, viewsRegistry));
		await flushMicrotasks();

		assert.strictEqual(viewsRegistry.getViewContainer(copilotViewId)?.id, explorerContainerId);
		assert.strictEqual(viewContainerRegistry.get(sessionsContainerId), undefined);

		const extensionContainer = registerContainer(extensionContainerId, ViewContainerLocation.Sidebar);
		const view = viewsRegistry.getView(copilotViewId);
		assert.ok(view);
		viewsRegistry.moveViews([view], extensionContainer);
		await flushMicrotasks();

		assert.strictEqual(viewsRegistry.getViewContainer(copilotViewId)?.id, sessionsContainerId);
		assert.strictEqual(viewContainerRegistry.get(extensionContainerId), undefined);
		assert.strictEqual(viewsRegistry.getViews(explorer).some(candidate => candidate.id === copilotViewId), false);
		assert.strictEqual(viewsRegistry.getView(copilotViewId)?.windowEnablement, WindowEnablement.Sessions);
	});
});
