/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { ViewPaneContainer } from '../../../../workbench/browser/parts/views/viewPaneContainer.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../../workbench/common/contributions.js';
import { IViewContainersRegistry, IViewDescriptor, IViewsRegistry, ViewContainerLocation, Extensions as ViewContainerExtensions, WindowEnablement } from '../../../../workbench/common/views.js';

const COPILOT_CHAT_VIEW_CONTAINER_ID = 'workbench.view.extension.copilot-chat';
const COPILOT_CHAT_VIEW_ID = 'copilot-chat';
const SESSIONS_CHAT_DEBUG_CONTAINER_ID = 'workbench.sessions.panel.chatDebugContainer';

const chatDebugViewIcon = registerIcon('sessions-chat-debug-view-icon', Codicon.debug, localize('sessionsChatDebugViewIcon', 'View icon of the chat debug view in the sessions window.'));

/**
 * Move copilot-chat into the sessions Chat Debug panel and keep listening.
 * Disable, enable, or update re-registers the view without reloading the window.
 * A one-shot listener left that view on the activity-bar container, which this
 * window does not enable, so the panel stayed empty. The move is deferred so it
 * does not run inside registerViewContainer before the extension's moveViews.
 */
export function attachSessionsChatDebugView(viewContainerRegistry: IViewContainersRegistry, viewsRegistry: IViewsRegistry): DisposableStore {
	const disposables = new DisposableStore();
	let scheduled = false;

	const schedule = () => {
		if (disposables.isDisposed || scheduled) {
			return;
		}
		scheduled = true;
		queueMicrotask(() => {
			scheduled = false;
			if (disposables.isDisposed) {
				return;
			}
			tryMoveSessionsChatDebugView(viewContainerRegistry, viewsRegistry);
		});
	};

	disposables.add(viewsRegistry.onViewsRegistered(batch => {
		for (const { views } of batch) {
			if (views.some(view => view.id === COPILOT_CHAT_VIEW_ID)) {
				schedule();
				break;
			}
		}
	}));
	disposables.add(viewsRegistry.onDidChangeContainer(({ views }) => {
		if (views.some(view => view.id === COPILOT_CHAT_VIEW_ID)) {
			schedule();
		}
	}));

	schedule();
	return disposables;
}

function tryMoveSessionsChatDebugView(viewContainerRegistry: IViewContainersRegistry, viewsRegistry: IViewsRegistry): boolean {
	const view = viewsRegistry.getView(COPILOT_CHAT_VIEW_ID);
	if (!view) {
		return false;
	}

	const currentContainer = viewsRegistry.getViewContainer(COPILOT_CHAT_VIEW_ID);
	if (currentContainer?.id === SESSIONS_CHAT_DEBUG_CONTAINER_ID) {
		deregisterExtensionContainerIfEmpty(viewContainerRegistry, viewsRegistry);
		return true;
	}

	const extensionContainer = viewContainerRegistry.get(COPILOT_CHAT_VIEW_CONTAINER_ID);
	if (!extensionContainer || !currentContainer) {
		return false;
	}

	// deregisterViews matches by descriptor identity. Bail if this object is not the one in the container.
	viewsRegistry.deregisterViews([view], currentContainer);
	if (viewsRegistry.getView(COPILOT_CHAT_VIEW_ID)) {
		return false;
	}

	deregisterExtensionContainerIfEmpty(viewContainerRegistry, viewsRegistry);

	const chatDebugViewContainer = viewContainerRegistry.registerViewContainer({
		id: SESSIONS_CHAT_DEBUG_CONTAINER_ID,
		title: localize2('chatDebug', "Chat Debug"),
		icon: chatDebugViewIcon,
		order: 3,
		ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [SESSIONS_CHAT_DEBUG_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
		storageId: SESSIONS_CHAT_DEBUG_CONTAINER_ID,
		hideIfEmpty: true,
		windowEnablement: WindowEnablement.Sessions,
	}, ViewContainerLocation.Panel, { doNotRegisterOpenCommand: true });

	const sessionsView: IViewDescriptor = {
		...view,
		canMoveView: false,
		windowEnablement: WindowEnablement.Sessions,
	};
	viewsRegistry.registerViews([sessionsView], chatDebugViewContainer);
	return true;
}

function deregisterExtensionContainerIfEmpty(viewContainerRegistry: IViewContainersRegistry, viewsRegistry: IViewsRegistry): void {
	const extensionContainer = viewContainerRegistry.get(COPILOT_CHAT_VIEW_CONTAINER_ID);
	if (extensionContainer && viewsRegistry.getViews(extensionContainer).length === 0) {
		viewContainerRegistry.deregisterViewContainer(extensionContainer);
	}
}

class RegisterChatDebugViewContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'sessions.registerChatDebugView';

	constructor(
		@IProductService productService: IProductService,
	) {
		super();

		if (productService.quality === 'stable') {
			return;
		}

		const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry);
		this._register(attachSessionsChatDebugView(viewContainerRegistry, viewsRegistry));
	}
}

registerWorkbenchContribution2(RegisterChatDebugViewContribution.ID, RegisterChatDebugViewContribution, WorkbenchPhase.BlockRestore);
