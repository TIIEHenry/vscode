/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentTokenUsageData } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';
import { isConversationPairingHold } from './conversationSessionStatus.js';
import { createCatalogIconButton } from './engineCatalogIconButton.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import { getEngineSectionApiUnavailableCopy } from './engineSectionChrome.js';

const $ = DOM.$;

const TOKEN_USAGE_FEATURE = localize('ua.engineTokenUsageFeatureLabel', "token usage");

function getTransportErrorMessage(error: unknown): string | undefined {
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return undefined;
}

function tokenUsageRows(usage: UniverseAgentTokenUsageData): readonly { readonly label: string; readonly value: string }[] {
	return [
		{ label: localize('ua.engineTokenUsageInputTokens', "Input tokens"), value: String(usage.inputTokens) },
		{ label: localize('ua.engineTokenUsageOutputTokens', "Output tokens"), value: String(usage.outputTokens) },
		{ label: localize('ua.engineTokenUsageThinkingTokens', "Thinking tokens"), value: String(usage.thinkingTokens) },
		{ label: localize('ua.engineTokenUsageCacheReadTokens', "Cache read tokens"), value: String(usage.cacheReadTokens) },
		{ label: localize('ua.engineTokenUsageCacheWriteTokens', "Cache write tokens"), value: String(usage.cacheWriteTokens) },
		{ label: localize('ua.engineTokenUsageRequestCount', "Request count"), value: String(usage.requestCount) },
		{ label: localize('ua.engineTokenUsageTotalCostMicros', "Total cost (micros)"), value: String(usage.totalCostMicros) },
		{ label: localize('ua.engineTokenUsageCurrency', "Currency"), value: usage.currency ?? '' },
	];
}

/**
 * Global token-usage snapshot for Engine Preferences.
 * `getGlobalUsage()` takes no arguments. Counts and `totalCostMicros` are shown
 * as returned — no date window and no currency conversion. Pairing-hold and
 * disconnect do not call. A missing method is unsupported, not a zero snapshot.
 */
export class EngineTokenUsageSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly status: EngineCatalogStatusWidget;
	private readonly refreshToolbar: HTMLElement;
	private readonly refreshButton: Button;
	private readonly listHost: HTMLElement;

	private hasSnapshot = false;
	private refreshGeneration = 0;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-token-usage-section'));
		this.container.style.display = 'none';

		this.status = this._register(new EngineCatalogStatusWidget(this.container));

		this.refreshToolbar = DOM.append(this.container, $('.engine-catalog-write-toolbar.engine-catalog-icon-actions'));
		this.refreshToolbar.style.display = 'none';
		this.refreshButton = this._register(createCatalogIconButton(
			this.refreshToolbar,
			localize('ua.engineTokenUsageRefresh', "Refresh token usage"),
			Codicon.refresh,
		));
		this._register(this.refreshButton.onDidClick(() => {
			void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
		}));

		this.listHost = DOM.append(this.container, $('.engine-catalog-list'));
		this.listHost.setAttribute('role', 'list');
		this.listHost.setAttribute('aria-label', localize('ua.engineTokenUsageList', "Token usage"));
		this.listHost.style.display = 'none';

		this._register(this.connection.onDidChangeConnection(() => {
			void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
		}));
		void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
	}

	override dispose(): void {
		this.refreshGeneration++;
		this.clearSnapshot();
		super.dispose();
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	setSectionActive(active: boolean): void {
		this.container.style.display = active ? '' : 'none';
	}

	setShowSectionHeading(_show: boolean): void {
		// Pane detail title only.
	}

	/** Snapshot, not a list badge. */
	getItemCount(): number | undefined {
		return undefined;
	}

	layout(_width: number, _height: number): void {
		// Static rows.
	}

	private hasGlobalUsageHook(): boolean {
		return typeof this.connection.getGlobalUsage === 'function';
	}

	private isCurrent(generation: number): boolean {
		return generation === this.refreshGeneration && !this._store.isDisposed;
	}

	private setRefreshVisible(visible: boolean): void {
		this.refreshToolbar.style.display = visible ? '' : 'none';
		this.refreshButton.enabled = visible;
	}

	private openConnection(): void {
		void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID).catch(onUnexpectedError).catch(onUnexpectedError);
	}

	private async refresh(): Promise<void> {
		if (this._store.isDisposed) {
			return;
		}
		const generation = ++this.refreshGeneration;
		const connected = this.connection.isEngineConnected();

		// Pairing-hold first, including leftover-looks-live. Do not call getGlobalUsage.
		if (isConversationPairingHold(this.connection) || !connected) {
			this.applyDisconnected();
			return;
		}

		if (!this.hasGlobalUsageHook()) {
			this.renderUnsupported();
			return;
		}

		this.setRefreshVisible(true);
		if (!this.hasSnapshot) {
			this.listHost.style.display = 'none';
		}
		this.status.render({
			mode: 'loading',
			loadingKind: 'list',
			featureLabel: TOKEN_USAGE_FEATURE,
		});

		try {
			// Empty request. No session id and no date range.
			const result = await this.connection.getGlobalUsage!();
			if (!this.isCurrent(generation)) {
				return;
			}
			if (isConversationPairingHold(this.connection) || !this.connection.isEngineConnected()) {
				this.applyDisconnected();
				return;
			}
			this.paintUsage(result.usage);
			this.status.render({ mode: 'ready', featureLabel: TOKEN_USAGE_FEATURE });
		} catch (error) {
			if (!this.isCurrent(generation)) {
				return;
			}
			if (isConversationPairingHold(this.connection) || !this.connection.isEngineConnected()) {
				this.applyDisconnected();
				return;
			}
			// Transport failure stays failed. Do not invent a zero snapshot.
			if (!this.hasSnapshot) {
				this.clearSnapshot();
			}
			this.status.render({
				mode: 'failed',
				featureLabel: TOKEN_USAGE_FEATURE,
				reason: getTransportErrorMessage(error),
				onRetry: () => void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError),
			});
		}
	}

	private applyDisconnected(): void {
		this.setRefreshVisible(false);
		if (this.hasSnapshot && isConversationPairingHold(this.connection)) {
			this.listHost.style.display = '';
			this.renderDisconnected();
			return;
		}
		this.clearSnapshot();
		this.renderDisconnected();
	}

	private renderDisconnected(): void {
		this.status.render({
			mode: 'disconnected',
			onOpenConnection: () => this.openConnection(),
		});
	}

	private renderUnsupported(): void {
		this.clearSnapshot();
		this.setRefreshVisible(false);
		this.status.render({
			mode: 'unsupported',
			featureLabel: TOKEN_USAGE_FEATURE,
			reason: getEngineSectionApiUnavailableCopy(TOKEN_USAGE_FEATURE),
		});
	}

	private paintUsage(usage: UniverseAgentTokenUsageData): void {
		DOM.clearNode(this.listHost);
		for (const row of tokenUsageRows(usage)) {
			const element = DOM.append(this.listHost, $('.engine-catalog-row'));
			element.setAttribute('role', 'listitem');
			DOM.append(element, $('.engine-catalog-name')).textContent = row.label;
			DOM.append(element, $('.engine-catalog-description')).textContent = row.value;
		}
		this.listHost.style.display = '';
		this.hasSnapshot = true;
	}

	private clearSnapshot(): void {
		this.hasSnapshot = false;
		DOM.clearNode(this.listHost);
		this.listHost.style.display = 'none';
	}
}
