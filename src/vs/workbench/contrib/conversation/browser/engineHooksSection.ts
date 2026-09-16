/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { readCapabilityEntry } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import type { UniverseAgentCapabilitySupport, UniverseAgentHookPoint } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import {
	canShowCatalogRows,
	type EngineCatalogListPhase,
	type EngineCatalogPaneMode,
	resolveEngineCatalogPaneMode,
} from './engineCatalog.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import { getEngineSectionApiUnavailableCopy } from './engineSectionChrome.js';
import { isConversationPairingHold } from './conversationSessionStatus.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';

const $ = DOM.$;

const HOOKS_FEATURE = localize('ua.engineHooksFeatureLabel', "hook metadata");

function getTransportErrorMessage(error: unknown): string | undefined {
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return undefined;
}

export class EngineHooksSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly status: EngineCatalogStatusWidget;
	private readonly layoutHost: HTMLElement;
	private readonly pointsList: HTMLElement;

	private mode: EngineCatalogPaneMode = 'disconnected';
	private pointCount = 0;
	private listPhase: EngineCatalogListPhase = { kind: 'none' };
	private refreshGeneration = 0;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-hooks-section'));
		this.container.style.display = 'none';

		this.status = this._register(new EngineCatalogStatusWidget(this.container));

		this.layoutHost = DOM.append(this.container, $('.engine-hooks-layout'));
		this.layoutHost.style.display = 'none';

		const definitionsColumn = DOM.append(this.layoutHost, $('.engine-hooks-column.engine-hooks-column--definitions'));
		DOM.append(definitionsColumn, $('h4')).textContent = localize('ua.engineHooksDefinitions', "Definitions");
		const definitionsList = DOM.append(definitionsColumn, $('.engine-hooks-list'));
		definitionsList.textContent = localize('ua.engineHooksDefinitionsEmpty', "No hook definitions.");

		const pointsColumn = DOM.append(this.layoutHost, $('.engine-hooks-column.engine-hooks-column--points'));
		DOM.append(pointsColumn, $('h4')).textContent = localize('ua.engineHooksPoints', "Hook points");
		this.pointsList = DOM.append(pointsColumn, $('.engine-hooks-list.engine-catalog-list'));

		this._register(this.connection.onDidChangeConnection(() => {
			void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
		}));
		void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
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

	getMode(): EngineCatalogPaneMode {
		return this.mode;
	}

	getListEntryCount(): number {
		return this.pointCount;
	}

	layout(_width: number, _height: number): void {
		// Static two-column chrome.
	}

	private hasHookPointsListHook(): boolean {
		return typeof this.connection.listHookPoints === 'function';
	}

	private resolveMode(
		connected: boolean,
		support: UniverseAgentCapabilitySupport,
		listPhase: EngineCatalogListPhase = { kind: 'none' },
	): EngineCatalogPaneMode {
		const mode = resolveEngineCatalogPaneMode(connected, support, listPhase);
		if (!this.hasHookPointsListHook() && (mode === 'ready' || mode === 'empty' || (connected && support === 'SUPPORTED'))) {
			return 'unsupported';
		}
		return mode;
	}

	private keepLeftoverCatalogForPairingHold(hadLiveCatalog: boolean): boolean {
		return hadLiveCatalog && isConversationPairingHold(this.connection);
	}

	private applyDisconnectedRefresh(support: UniverseAgentCapabilitySupport, hadLiveCatalog: boolean): void {
		// D357 leftover-looks-live: pairing-hold first. KEEP-chrome is not only `!connected`.
		if (this.keepLeftoverCatalogForPairingHold(hadLiveCatalog)) {
			this.layoutHost.style.display = '';
			this.listPhase = { kind: 'none' };
			this.renderStatus(this.resolveMode(false, support));
			return;
		}
		this.clearPresentation();
		this.listPhase = { kind: 'none' };
		this.renderStatus(this.resolveMode(false, support));
	}

	private async refresh(): Promise<void> {
		const generation = ++this.refreshGeneration;
		const connected = this.connection.isEngineConnected();
		const hooksMetadata = readCapabilityEntry(this.connection.getCapabilitySnapshot(), 'hooksMetadata');

		if (isConversationPairingHold(this.connection) || !connected) {
			this.applyDisconnectedRefresh(hooksMetadata.support, this.pointCount > 0);
			return;
		}

		if (hooksMetadata.support === 'UNSUPPORTED') {
			this.clearPresentation();
			this.listPhase = { kind: 'none' };
			this.renderStatus(
				this.resolveMode(true, hooksMetadata.support),
				hooksMetadata.reason ?? localize(
					'ua.engineHooksMetadataUnsupported',
					"Current engine does not provide hook metadata.",
				),
			);
			return;
		}

		if (!this.hasHookPointsListHook()) {
			this.clearPresentation();
			this.listPhase = { kind: 'none' };
			this.renderStatus(this.resolveMode(true, hooksMetadata.support), getEngineSectionApiUnavailableCopy(HOOKS_FEATURE));
			return;
		}

		if (hooksMetadata.support === 'UNKNOWN') {
			const hadLivePaint = this.pointCount > 0;
			if (!hadLivePaint) {
				this.clearPresentation();
			} else {
				this.layoutHost.style.display = '';
			}
			this.listPhase = { kind: 'none' };
			this.renderStatus(this.resolveMode(true, hooksMetadata.support), undefined, 'capability');
			return;
		}

		this.listPhase = { kind: 'inFlight' };
		this.renderStatus(this.resolveMode(true, hooksMetadata.support, this.listPhase), undefined, 'list');

		try {
			const result = await this.connection.listHookPoints!();
			if (generation !== this.refreshGeneration) {
				return;
			}
			if (isConversationPairingHold(this.connection) || !this.connection.isEngineConnected()) {
				this.applyDisconnectedRefresh(hooksMetadata.support, this.pointCount > 0);
				return;
			}
			this.listPhase = { kind: 'success', itemCount: result.points.length };
			const mode = this.resolveMode(true, hooksMetadata.support, this.listPhase);
			this.renderStatus(mode);
			if (canShowCatalogRows(mode) || result.points.length === 0) {
				this.renderPoints(result.points);
				this.layoutHost.style.display = mode === 'ready' || mode === 'empty' ? '' : 'none';
				if (mode !== 'ready') {
					this.pointCount = result.points.length;
				}
			} else {
				this.clearPresentation();
			}
		} catch (error) {
			if (generation !== this.refreshGeneration) {
				return;
			}
			const hadLivePaint = this.pointCount > 0;
			if (!hadLivePaint) {
				this.clearPresentation();
			} else {
				this.layoutHost.style.display = '';
			}
			const reason = getTransportErrorMessage(error);
			this.listPhase = { kind: 'failed', error: reason };
			this.renderStatus(
				this.resolveMode(true, hooksMetadata.support, this.listPhase),
				reason,
				undefined,
				() => void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError),
			);
		}
	}

	private renderStatus(
		mode: EngineCatalogPaneMode,
		reason?: string,
		loadingKind?: 'capability' | 'list',
		onRetry?: () => void,
	): void {
		this.mode = mode;
		this.status.render({
			mode,
			featureLabel: HOOKS_FEATURE,
			reason,
			loadingKind,
			emptyCopy: localize('ua.engineHooksPointsEmpty', "No hook points."),
			onRetry,
			onOpenConnection: mode === 'disconnected'
				? () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID)
				: undefined,
		});
	}

	private renderPoints(points: readonly UniverseAgentHookPoint[]): void {
		this.pointCount = points.length;
		DOM.clearNode(this.pointsList);
		if (points.length === 0) {
			this.pointsList.textContent = localize('ua.engineHooksPointsEmpty', "No hook points.");
			return;
		}
		for (const point of points) {
			const row = DOM.append(this.pointsList, $('.engine-catalog-row.engine-hooks-row'));
			const text = DOM.append(row, $('.engine-catalog-text'));
			DOM.append(text, $('.engine-catalog-name')).textContent = point.methodName || point.id;
			DOM.append(text, $('.engine-catalog-description')).textContent = [
				point.family,
				localize('ua.engineHooksInstalledCount', "{0} installed", point.installedCount),
			].filter(part => part.length > 0).join(' · ');
		}
	}

	private clearPresentation(): void {
		this.pointCount = 0;
		DOM.clearNode(this.pointsList);
		this.layoutHost.style.display = 'none';
	}
}
