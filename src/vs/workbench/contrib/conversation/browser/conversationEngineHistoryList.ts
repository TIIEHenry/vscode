/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, reset } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentHistoryEnvelope } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import {
	conversationLensSessionBarHistory,
	conversationLensSessionBarHistoryClose,
	conversationLensSessionBarHistoryEmpty,
	conversationLensSessionBarHistoryLoading,
	conversationLensSessionBarHistoryTitle,
	conversationLensSessionBarHistoryUnavailableDisconnected,
} from './conversationLensSessionBarStrings.js';
import { IConversationRosterService } from './conversationStubService.js';

export const conversationLensHistoryButtonClass = 'conversation-lens-session-history';
export const conversationLensHistoryOverlayClass = 'conversation-lens-history-overlay';
export const conversationLensHistoryRowClass = 'conversation-lens-history-row';

/** Honest gate for SessionBar History → SessionService.GetHistory. Empty sessionId still sends. */
export function canRequestEngineHistory(connected: boolean): boolean {
	return connected;
}

export function formatEngineHistoryFailedCopy(reason: string): string {
	return localize('conversationLens.sessionBarHistoryFailed', "Failed to read engine history — {0}", reason);
}

/** Shallow preview only. Does not fold MessageEnvelope / invent turn kinds. */
export function formatEngineHistoryEnvelopePreview(payload: unknown): string {
	if (payload === undefined || payload === null) {
		return '';
	}
	if (typeof payload === 'string') {
		return truncateHistoryPreview(payload);
	}
	if (typeof payload === 'number' || typeof payload === 'boolean') {
		return String(payload);
	}
	if (typeof payload !== 'object' || Array.isArray(payload)) {
		return '';
	}
	const record = payload as Record<string, unknown>;
	const role = readShallowString(record, 'role');
	const text = readShallowString(record, 'text') ?? readShallowString(record, 'content');
	if (role && text) {
		return truncateHistoryPreview(`${role}: ${text}`);
	}
	if (text) {
		return truncateHistoryPreview(text);
	}
	return role ?? '';
}

function readShallowString(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key];
	return typeof value === 'string' && value.trim() ? value : undefined;
}

function truncateHistoryPreview(text: string): string {
	const trimmed = text.trim();
	if (!trimmed) {
		return '';
	}
	return trimmed.length > 120 ? `${trimmed.slice(0, 119)}…` : trimmed;
}

/**
 * SessionBar History extra control + overlay for SessionService.GetHistory.
 * Distinct from Snapshots overlay and from {@link ConversationTrajectoryList}
 * (legacy turn-index MessageNavigator helpers). Empty sessionId is sent as-is.
 * Disconnected does not send and does not paint fixture turns as engine history.
 */
export class ConversationEngineHistoryList extends Disposable {

	readonly element: HTMLElement;
	readonly overlayElement: HTMLElement;

	private readonly button: Button;
	private readonly body: HTMLElement;
	private open = false;
	private renderGeneration = 0;

	constructor(
		buttonParent: HTMLElement,
		overlayParent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IConversationRosterService private readonly roster: IConversationRosterService,
	) {
		super();

		this.element = append(buttonParent, $(`.${conversationLensHistoryButtonClass}`));
		this.button = this._register(new Button(this.element, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: conversationLensSessionBarHistoryTitle,
		}));
		this.button.icon = Codicon.history;
		this.button.label = conversationLensSessionBarHistory;
		this.button.element.classList.add('conversation-lens-history-button');
		this.button.element.setAttribute('aria-expanded', 'false');
		this.button.element.setAttribute('aria-haspopup', 'dialog');
		this._register(this.button.onDidClick(() => this.toggle()));

		this.overlayElement = append(overlayParent, $(`.${conversationLensHistoryOverlayClass}`));
		this.overlayElement.hidden = true;
		this.overlayElement.setAttribute('role', 'dialog');
		this.overlayElement.setAttribute('aria-modal', 'true');
		this.overlayElement.setAttribute('aria-label', conversationLensSessionBarHistoryTitle);

		const panel = append(this.overlayElement, $('.conversation-lens-history-panel'));
		const header = append(panel, $('.conversation-lens-history-header'));
		const title = append(header, $('h2.conversation-lens-history-title'));
		title.textContent = conversationLensSessionBarHistoryTitle;
		const closeContainer = append(header, $('.conversation-lens-history-close'));
		const closeButton = this._register(new Button(closeContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: conversationLensSessionBarHistoryClose,
		}));
		closeButton.icon = Codicon.close;
		this._register(closeButton.onDidClick(() => this.close()));

		this.body = append(panel, $('.conversation-lens-history-body'));

		this._register(addDisposableListener(this.overlayElement, 'keydown', e => {
			if (e.keyCode === KeyCode.Escape) {
				e.preventDefault();
				e.stopPropagation();
				this.close();
			}
		}));
		this._register(this.connection.onDidChangeConnection(() => {
			if (this.open) {
				void this.refresh();
			}
		}));
		this._register(this.roster.onDidChangeActiveSession(() => {
			if (this.open) {
				void this.refresh();
			}
		}));
		this._register(this.roster.onDidChangeEngineConnection(() => {
			if (this.open) {
				void this.refresh();
			}
		}));
	}

	isOpen(): boolean {
		return this.open;
	}

	toggle(): void {
		if (this.open) {
			this.close();
			return;
		}
		this.show();
	}

	show(): void {
		this.open = true;
		this.overlayElement.hidden = false;
		this.button.element.setAttribute('aria-expanded', 'true');
		void this.refresh();
	}

	close(): void {
		this.open = false;
		this.renderGeneration++;
		this.overlayElement.hidden = true;
		this.button.element.setAttribute('aria-expanded', 'false');
	}

	override dispose(): void {
		this.close();
		this.overlayElement.remove();
		super.dispose();
	}

	private async refresh(): Promise<void> {
		const generation = ++this.renderGeneration;
		const sessionId = this.roster.getActiveSessionId() ?? '';
		const connected = this.connection.isEngineConnected();

		if (!canRequestEngineHistory(connected)) {
			this.paintStatus(conversationLensSessionBarHistoryUnavailableDisconnected);
			return;
		}

		this.paintStatus(conversationLensSessionBarHistoryLoading);
		try {
			const result = await this.connection.getHistory({ sessionId });
			if (generation !== this.renderGeneration) {
				return;
			}
			this.paintEnvelopes(result.envelopes);
		} catch (error) {
			if (generation !== this.renderGeneration) {
				return;
			}
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.paintStatus(formatEngineHistoryFailedCopy(reason));
		}
	}

	private paintStatus(text: string): void {
		reset(this.body);
		const status = append(this.body, $('.conversation-lens-history-status'));
		status.setAttribute('role', 'status');
		status.textContent = text;
	}

	private paintEnvelopes(envelopes: readonly UniverseAgentHistoryEnvelope[]): void {
		reset(this.body);
		if (envelopes.length === 0) {
			this.paintStatus(conversationLensSessionBarHistoryEmpty);
			return;
		}

		const list = append(this.body, $('.conversation-lens-history-list'));
		list.setAttribute('role', 'list');
		for (const envelope of envelopes) {
			const row = append(list, $(`.${conversationLensHistoryRowClass}`));
			row.setAttribute('role', 'listitem');
			row.setAttribute('data-cursor-seq', envelope.cursorSeq);

			const cursor = append(row, $('.conversation-lens-history-cursor'));
			cursor.textContent = envelope.cursorSeq;

			const preview = append(row, $('.conversation-lens-history-preview'));
			const previewText = formatEngineHistoryEnvelopePreview(envelope.payload);
			preview.textContent = previewText || localize('conversationLens.sessionBarHistoryEmptyPreview', "(empty)");
		}
	}
}
