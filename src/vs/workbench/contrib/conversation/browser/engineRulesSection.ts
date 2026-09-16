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
import { ensureCapabilitySnapshot } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import type {
	UniverseAgentCapabilitySupport,
	UniverseAgentProjectRule,
	UniverseAgentProjectRuleScope,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';
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

const RULES_FEATURE = localize('ua.engineRulesFeatureLabel', "rules catalog");

/** ProjectRuleScopeProto.PROJECT_RULE_SCOPE_WORKDIR */
const RULE_SCOPE_WORKDIR: UniverseAgentProjectRuleScope = 1;
/** ProjectRuleScopeProto.PROJECT_RULE_SCOPE_GLOBAL */
const RULE_SCOPE_GLOBAL: UniverseAgentProjectRuleScope = 2;

function getTransportErrorMessage(error: unknown): string | undefined {
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return undefined;
}

function combineRulesSupport(
	global: UniverseAgentCapabilitySupport,
	project: UniverseAgentCapabilitySupport,
): UniverseAgentCapabilitySupport {
	if (global === 'UNKNOWN' || project === 'UNKNOWN') {
		return 'UNKNOWN';
	}
	if (global === 'UNSUPPORTED' && project === 'UNSUPPORTED') {
		return 'UNSUPPORTED';
	}
	return 'SUPPORTED';
}

export class EngineRulesSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly status: EngineCatalogStatusWidget;
	private readonly scopePanels: HTMLElement;
	private readonly globalList: HTMLElement;
	private readonly projectList: HTMLElement;

	private mode: EngineCatalogPaneMode = 'disconnected';
	private ruleCount = 0;
	private listPhase: EngineCatalogListPhase = { kind: 'none' };
	private refreshGeneration = 0;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-rules-section'));
		this.container.style.display = 'none';

		this.status = this._register(new EngineCatalogStatusWidget(this.container));

		this.scopePanels = DOM.append(this.container, $('.engine-rules-scopes'));
		this.scopePanels.style.display = 'none';

		const globalPanel = DOM.append(this.scopePanels, $('.engine-rules-scope.engine-rules-scope--global'));
		DOM.append(globalPanel, $('h4')).textContent = localize('ua.engineRulesGlobal', "Global");
		this.globalList = DOM.append(globalPanel, $('.engine-rules-list.engine-catalog-list'));

		const projectPanel = DOM.append(this.scopePanels, $('.engine-rules-scope.engine-rules-scope--project'));
		DOM.append(projectPanel, $('h4')).textContent = localize('ua.engineRulesProject', "Project");
		this.projectList = DOM.append(projectPanel, $('.engine-rules-list.engine-catalog-list'));

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
		return this.ruleCount;
	}

	layout(_width: number, _height: number): void {
		// Static scopes.
	}

	private hasRulesListHook(): boolean {
		return typeof this.connection.listProjectRules === 'function';
	}

	private resolveMode(
		connected: boolean,
		support: UniverseAgentCapabilitySupport,
		listPhase: EngineCatalogListPhase = { kind: 'none' },
	): EngineCatalogPaneMode {
		const mode = resolveEngineCatalogPaneMode(connected, support, listPhase);
		if (!this.hasRulesListHook() && (mode === 'ready' || mode === 'empty' || (connected && support === 'SUPPORTED'))) {
			return 'unsupported';
		}
		return mode;
	}

	private keepLeftoverCatalogForPairingHold(hadLiveCatalog: boolean): boolean {
		return hadLiveCatalog && isConversationPairingHold(this.connection);
	}

	private applyDisconnectedRefresh(support: UniverseAgentCapabilitySupport, hadLiveCatalog: boolean): void {
		// D356 leftover-looks-live: pairing-hold first. KEEP chrome is not only `!connected`.
		if (this.keepLeftoverCatalogForPairingHold(hadLiveCatalog)) {
			this.scopePanels.style.display = '';
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
		const capabilities = ensureCapabilitySnapshot(this.connection.getCapabilitySnapshot());
		const support = combineRulesSupport(capabilities.globalRules.support, capabilities.projectRules.support);
		const reason = capabilities.globalRules.reason ?? capabilities.projectRules.reason;

		if (isConversationPairingHold(this.connection) || !connected) {
			this.applyDisconnectedRefresh(support, this.ruleCount > 0);
			return;
		}

		if (support === 'UNSUPPORTED') {
			this.clearPresentation();
			this.listPhase = { kind: 'none' };
			this.renderStatus(this.resolveMode(true, support), reason);
			return;
		}

		if (!this.hasRulesListHook()) {
			this.clearPresentation();
			this.listPhase = { kind: 'none' };
			this.renderStatus(this.resolveMode(true, support), getEngineSectionApiUnavailableCopy(RULES_FEATURE));
			return;
		}

		if (support === 'UNKNOWN') {
			const hadLivePaint = this.ruleCount > 0;
			if (!hadLivePaint) {
				this.clearPresentation();
			} else {
				this.scopePanels.style.display = '';
			}
			this.listPhase = { kind: 'none' };
			this.renderStatus(this.resolveMode(true, support), undefined, 'capability');
			return;
		}

		this.listPhase = { kind: 'inFlight' };
		this.renderStatus(this.resolveMode(true, support, this.listPhase), undefined, 'list');

		try {
			const [global, project] = await Promise.all([
				this.connection.listProjectRules!({ scope: RULE_SCOPE_GLOBAL, sessionId: '' }),
				this.connection.listProjectRules!({ scope: RULE_SCOPE_WORKDIR, sessionId: '' }),
			]);
			if (generation !== this.refreshGeneration) {
				return;
			}
			if (isConversationPairingHold(this.connection) || !this.connection.isEngineConnected()) {
				this.applyDisconnectedRefresh(support, this.ruleCount > 0);
				return;
			}
			const itemCount = global.rules.length + project.rules.length;
			this.listPhase = { kind: 'success', itemCount };
			const mode = this.resolveMode(true, support, this.listPhase);
			this.renderStatus(mode);
			if (canShowCatalogRows(mode) || itemCount === 0) {
				this.renderLists(global.rules, project.rules);
				this.scopePanels.style.display = mode === 'ready' || mode === 'empty' ? '' : 'none';
				if (mode !== 'ready') {
					this.ruleCount = itemCount;
				}
			} else {
				this.clearPresentation();
			}
		} catch (error) {
			if (generation !== this.refreshGeneration) {
				return;
			}
			const hadLivePaint = this.ruleCount > 0;
			if (!hadLivePaint) {
				this.clearPresentation();
			} else {
				this.scopePanels.style.display = '';
			}
			const transportReason = getTransportErrorMessage(error);
			this.listPhase = { kind: 'failed', error: transportReason };
			this.renderStatus(
				this.resolveMode(true, support, this.listPhase),
				transportReason,
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
			featureLabel: RULES_FEATURE,
			reason,
			loadingKind,
			emptyCopy: localize('ua.engineRulesEmpty', "No rules."),
			onRetry,
			onOpenConnection: mode === 'disconnected'
				? () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID)
				: undefined,
		});
	}

	private renderLists(globalRules: readonly UniverseAgentProjectRule[], projectRules: readonly UniverseAgentProjectRule[]): void {
		this.ruleCount = globalRules.length + projectRules.length;
		this.paintRuleList(this.globalList, globalRules);
		this.paintRuleList(this.projectList, projectRules);
	}

	private paintRuleList(host: HTMLElement, rules: readonly UniverseAgentProjectRule[]): void {
		DOM.clearNode(host);
		if (rules.length === 0) {
			host.textContent = localize('ua.engineRulesEmpty', "No rules.");
			return;
		}
		for (const rule of rules) {
			const row = DOM.append(host, $('.engine-catalog-row.engine-rules-row'));
			if (!rule.enabled) {
				row.classList.add('engine-rules-row--disabled');
			}
			const text = DOM.append(row, $('.engine-catalog-text'));
			DOM.append(text, $('.engine-catalog-name')).textContent = rule.title || rule.id;
			const bits = [rule.enabled
				? localize('ua.engineRuleEnabled', "Enabled")
				: localize('ua.engineRuleDisabled', "Disabled")];
			if (rule.globs.length) {
				bits.push(rule.globs.join(', '));
			}
			DOM.append(text, $('.engine-catalog-description')).textContent = bits.join(' · ');
		}
	}

	private clearPresentation(): void {
		this.ruleCount = 0;
		DOM.clearNode(this.globalList);
		DOM.clearNode(this.projectList);
		this.scopePanels.style.display = 'none';
	}
}
