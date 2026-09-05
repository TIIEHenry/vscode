/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentClipboardEntrySummary } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import { getEngineSectionApiUnavailableCopy } from './engineSectionChrome.js';
import {
	canSendEngineClipboardListRequest,
	canSendEngineClipboardRead,
	ENGINE_CLIPBOARD_LIST_EMPTY_COPY,
	ENGINE_CLIPBOARD_LIST_FEATURE,
	ENGINE_CLIPBOARD_READ_LABEL,
	engineClipboardListRequest,
	engineClipboardReadRequest,
	formatEngineClipboardListLabel,
	formatEngineClipboardReadLabel,
} from './engineClipboardList.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';

const $ = DOM.$;

/**
 * Engine Preferences Clipboard — honest List + Read. Connected + hook
 * only. Empty sessionId / clipId are sent as-is. Empty label / type /
 * clipId stay empty. createdAt 0 stays as-is.
 */
export class EngineClipboardSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly status: EngineCatalogStatusWidget;
	private readonly listHost: HTMLElement;
	private readonly readButton: Button;
	private readonly readStatus: HTMLElement;

	private sectionActive = false;
	private renderGeneration = 0;
	private entries: UniverseAgentClipboardEntrySummary[] = [];
	private selectedEntry: UniverseAgentClipboardEntrySummary | undefined;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-clipboard-section'));
		this.container.style.display = 'none';

		this.status = this._register(new EngineCatalogStatusWidget(this.container));

		this.listHost = DOM.append(this.container, $('.engine-clipboard-list'));
		this.listHost.setAttribute('role', 'list');
		this.listHost.style.display = 'none';

		const actionsRow = DOM.append(this.container, $('.engine-clipboard-actions'));
		this.readButton = this._register(new Button(actionsRow, { ...defaultButtonStyles, secondary: true }));
		this.readButton.label = ENGINE_CLIPBOARD_READ_LABEL;
		this._register(this.readButton.onDidClick(() => void this.handleRead()));

		this.readStatus = DOM.append(this.container, $('.engine-clipboard-read-status'));
		this.readStatus.style.display = 'none';
		this.updateReadAction();

		this._register(this.connection.onDidChangeConnection(() => {
			if (this.sectionActive) {
				void this.refresh();
			}
		}));
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	setSectionActive(active: boolean): void {
		this.sectionActive = active;
		this.container.style.display = active ? '' : 'none';
		if (active) {
			void this.refresh();
		}
	}

	setShowSectionHeading(_show: boolean): void {
		// Pane detail title only.
	}

	layout(_width: number, _height: number): void {
		// Static list.
	}

	private async refresh(): Promise<void> {
		const generation = ++this.renderGeneration;
		const hook = this.connection.listClipboard;
		const canSend = canSendEngineClipboardListRequest(
			this.connection.isEngineConnected(),
			typeof hook === 'function',
		);

		this.entries = [];
		this.selectedEntry = undefined;
		this.listHost.style.display = 'none';
		this.readStatus.style.display = 'none';
		this.readStatus.textContent = '';
		DOM.clearNode(this.listHost);
		this.updateReadAction();

		if (!this.connection.isEngineConnected()) {
			this.status.render({
				mode: 'disconnected',
				onOpenConnection: () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID),
			});
			return;
		}

		if (!canSend || !hook) {
			this.status.render({
				mode: 'unsupported',
				featureLabel: ENGINE_CLIPBOARD_LIST_FEATURE,
				reason: getEngineSectionApiUnavailableCopy(ENGINE_CLIPBOARD_LIST_FEATURE),
			});
			return;
		}

		this.status.render({
			mode: 'loading',
			loadingKind: 'list',
			featureLabel: ENGINE_CLIPBOARD_LIST_FEATURE,
		});

		try {
			const result = await hook.call(this.connection, engineClipboardListRequest());
			if (generation !== this.renderGeneration) {
				return;
			}
			if (!this.connection.isEngineConnected()) {
				return;
			}
			this.entries = [...result.entries];
			this.paintList();
		} catch (error) {
			if (generation !== this.renderGeneration) {
				return;
			}
			const reason = error instanceof Error ? error.message : String(error);
			this.status.render({
				mode: 'failed',
				featureLabel: ENGINE_CLIPBOARD_LIST_FEATURE,
				reason,
				onRetry: () => void this.refresh(),
			});
		}
	}

	private paintList(): void {
		if (this.entries.length === 0) {
			this.status.render({
				mode: 'empty',
				featureLabel: ENGINE_CLIPBOARD_LIST_FEATURE,
				emptyCopy: ENGINE_CLIPBOARD_LIST_EMPTY_COPY,
			});
			return;
		}

		this.status.hide();
		this.listHost.style.display = '';
		for (const entry of this.entries) {
			const row = DOM.append(this.listHost, $('.engine-clipboard-row'));
			row.setAttribute('role', 'listitem');
			row.textContent = formatEngineClipboardListLabel(entry);
			row.addEventListener('click', () => {
				this.selectedEntry = entry;
				this.paintSelection();
			});
		}
	}

	private paintSelection(): void {
		const rows = this.listHost.querySelectorAll('.engine-clipboard-row');
		rows.forEach((row, index) => {
			row.classList.toggle('selected', this.entries[index] === this.selectedEntry);
		});
	}

	private updateReadAction(): void {
		this.readButton.enabled = canSendEngineClipboardRead(
			this.connection.isEngineConnected(),
			typeof this.connection.readClipboard === 'function',
		);
	}

	private async handleRead(): Promise<void> {
		const hook = this.connection.readClipboard;
		if (!canSendEngineClipboardRead(this.connection.isEngineConnected(), typeof hook === 'function') || !hook) {
			return;
		}
		const request = engineClipboardReadRequest(this.selectedEntry);
		try {
			const result = await hook.call(this.connection, request);
			this.readStatus.textContent = formatEngineClipboardReadLabel(result.entry);
			this.readStatus.style.display = '';
		} catch (error) {
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.readStatus.textContent = reason;
			this.readStatus.style.display = '';
		}
	}
}
