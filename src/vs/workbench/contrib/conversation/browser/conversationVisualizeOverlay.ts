/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append } from '../../../../base/browser/dom.js';
import { CodeWindow } from '../../../../base/browser/window.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { ILayoutService } from '../../../services/layout/browser/layoutService.js';
import { IWebviewService } from '../../webview/browser/webview.js';
import {
	ConversationMermaidExtensionInfo,
	createMermaidHostContext,
	mountConversationMermaidHost,
} from './conversationMermaidHost.js';

export const conversationVisualizeOverlayTitle = localize('conversationVisualize.overlayTitle', "Diagram");
export const conversationVisualizeOverlayClose = localize('conversationVisualize.overlayClose', "Close");
export const conversationVisualizeOverlayReset = localize('conversationVisualize.overlayReset', "Reset view");

export interface ConversationVisualizeOverlayOpenOptions {
	readonly source: string;
	readonly title?: string;
	readonly extensionInfo: ConversationMermaidExtensionInfo | undefined;
	readonly targetWindow: CodeWindow;
	readonly webviewService: IWebviewService;
}

/**
 * Full-screen visualize overlay. Owned by {@link ConversationLens}; not tied to turn render disposables.
 */
export class ConversationVisualizeOverlay extends Disposable {

	private overlayElement: HTMLElement | undefined;
	private sessionDisposables: DisposableStore | undefined;

	constructor(
		@ILayoutService private readonly layoutService: ILayoutService,
	) {
		super();
	}

	isOpen(): boolean {
		return !!this.overlayElement;
	}

	open(options: ConversationVisualizeOverlayOpenOptions): void {
		this.close();

		const session = new DisposableStore();
		this.sessionDisposables = session;

		const container = this.layoutService.getContainer(options.targetWindow);
		const overlay = append(container, $('div.conversation-visualize-overlay'));
		overlay.setAttribute('role', 'dialog');
		overlay.setAttribute('aria-modal', 'true');

		const panel = append(overlay, $('div.conversation-visualize-overlay-panel'));

		const header = append(panel, $('div.conversation-visualize-overlay-header'));
		const titleId = `conversation-visualize-overlay-title-${Date.now()}`;
		const titleEl = append(header, $(`h2.conversation-visualize-overlay-title#${titleId}`));
		titleEl.textContent = options.title?.trim() || conversationVisualizeOverlayTitle;
		overlay.setAttribute('aria-labelledby', titleId);

		const actions = append(header, $('div.conversation-visualize-overlay-actions'));

		const resetContainer = append(actions, $('span.conversation-visualize-overlay-reset'));
		const resetButton = session.add(new Button(resetContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: conversationVisualizeOverlayReset,
		}));
		resetButton.icon = Codicon.discard;

		const closeContainer = append(actions, $('span.conversation-visualize-overlay-close'));
		const closeButton = session.add(new Button(closeContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: conversationVisualizeOverlayClose,
		}));
		closeButton.icon = Codicon.close;

		const body = append(panel, $('div.conversation-visualize-overlay-body'));
		const mountResult = mountConversationMermaidHost(
			body,
			createMermaidHostContext(body, options.extensionInfo, options.webviewService),
			{ mode: 'overlay', source: options.source, title: options.title },
			session,
		);

		if (mountResult.webview) {
			session.add(resetButton.onDidClick(() => {
				void mountResult.webview!.postMessage({ type: 'resetPanZoom' });
			}));
		} else {
			resetButton.enabled = false;
		}

		session.add(closeButton.onDidClick(() => this.close()));
		session.add(addDisposableListener(container, 'keydown', (e) => {
			if (e.keyCode === KeyCode.Escape) {
				e.preventDefault();
				e.stopPropagation();
				this.close();
			}
		}));

		this.overlayElement = overlay;
	}

	close(): void {
		this.sessionDisposables?.dispose();
		this.sessionDisposables = undefined;
		this.overlayElement?.remove();
		this.overlayElement = undefined;
	}

	override dispose(): void {
		this.close();
		super.dispose();
	}
}
