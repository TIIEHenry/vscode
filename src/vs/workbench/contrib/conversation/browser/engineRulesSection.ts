/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { ensureCapabilitySnapshot } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import type {
	UniverseAgentCapabilitySupport,
	UniverseAgentProjectRule,
	UniverseAgentProjectRulePriority,
	UniverseAgentProjectRuleScope,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import {
	canPerformCatalogWriteLive,
	canShowCatalogRows,
	type EngineCatalogListPhase,
	type EngineCatalogPaneMode,
	resolveEngineCatalogPaneMode,
} from './engineCatalog.js';
import { createCatalogIconButton } from './engineCatalogIconButton.js';
import { showEngineConfirmPopover } from './engineConfirmPopover.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import { appendCatalogScopeNote, getEngineSectionApiUnavailableCopy } from './engineSectionChrome.js';
import { isConversationPairingHold } from './conversationSessionStatus.js';
import { writeStatus } from './connectionPreferencesPane.js';
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
	private readonly writeStatus: HTMLElement;
	private readonly scopePanels: HTMLElement;
	private readonly globalToolbar: HTMLElement;
	private readonly projectToolbar: HTMLElement;
	private readonly globalList: HTMLElement;
	private readonly projectList: HTMLElement;
	private readonly rowActions = this._register(new DisposableStore());
	private readonly ruleActionButtons: Button[] = [];

	private mode: EngineCatalogPaneMode = 'disconnected';
	private ruleCount = 0;
	private readonly _onDidChangeItemCount = this._register(new Emitter<void>());
	readonly onDidChangeItemCount: Event<void> = this._onDidChangeItemCount.event;
	private listPhase: EngineCatalogListPhase = { kind: 'none' };
	private refreshGeneration = 0;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@ICommandService private readonly commandService: ICommandService,
		@IDialogService private readonly dialogService: IDialogService,
		@IContextViewService private readonly contextViewService: IContextViewService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-rules-section'));
		this.container.style.display = 'none';
		appendCatalogScopeNote(this.container, localize('ua.engineRulesScope', "Project rules follow the open work root. Global rules are engine-wide."));

		this.status = this._register(new EngineCatalogStatusWidget(this.container));

		this.writeStatus = DOM.append(this.container, $('.engine-catalog-action-message.engine-rules-write-status'));
		this.writeStatus.setAttribute('role', 'status');
		this.writeStatus.style.display = 'none';

		this.scopePanels = DOM.append(this.container, $('.engine-rules-scopes'));
		this.scopePanels.style.display = 'none';

		const globalPanel = DOM.append(this.scopePanels, $('.engine-rules-scope.engine-rules-scope--global'));
		DOM.append(globalPanel, $('h4')).textContent = localize('ua.engineRulesGlobal', "Global");
		this.globalToolbar = DOM.append(globalPanel, $('.engine-catalog-write-toolbar.engine-catalog-icon-actions'));
		this.globalToolbar.style.display = 'none';
		const globalAdd = this._register(createCatalogIconButton(this.globalToolbar, localize('ua.engineRulesAddGlobal', "Add global rule"), Codicon.add));
		this._register(globalAdd.onDidClick(() => void this.promptRule(RULE_SCOPE_GLOBAL).catch(onUnexpectedError).catch(onUnexpectedError)));
		this.globalList = DOM.append(globalPanel, $('.engine-rules-list.engine-catalog-list'));

		const projectPanel = DOM.append(this.scopePanels, $('.engine-rules-scope.engine-rules-scope--project'));
		DOM.append(projectPanel, $('h4')).textContent = localize('ua.engineRulesProject', "Project");
		this.projectToolbar = DOM.append(projectPanel, $('.engine-catalog-write-toolbar.engine-catalog-icon-actions'));
		this.projectToolbar.style.display = 'none';
		const projectAdd = this._register(createCatalogIconButton(this.projectToolbar, localize('ua.engineRulesAddProject', "Add project rule"), Codicon.add));
		this._register(projectAdd.onDidClick(() => void this.promptRule(RULE_SCOPE_WORKDIR).catch(onUnexpectedError).catch(onUnexpectedError)));
		this.projectList = DOM.append(projectPanel, $('.engine-rules-list.engine-catalog-list'));

		this._register(this.connection.onDidChangeConnection(() => {
			void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
		}));
		void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
	}

	override dispose(): void {
		this.refreshGeneration++;
		this.clearPresentation();
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

	getMode(): EngineCatalogPaneMode {
		return this.mode;
	}

	getListEntryCount(): number {
		return this.ruleCount;
	}

	/** Nav badge counts rules, not the Global / Project headings. Disabled rules still count. */
	getItemCount(): number | undefined {
		return this.ruleCount > 0 ? this.ruleCount : undefined;
	}

	private setRuleCount(count: number): void {
		if (this.ruleCount === count) {
			return;
		}
		this.ruleCount = count;
		this._onDidChangeItemCount.fire();
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
		this.writeStatus.style.display = 'none';
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
			if (generation !== this.refreshGeneration || this._store.isDisposed) {
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
					this.setRuleCount(itemCount);
				}
			} else {
				this.clearPresentation();
			}
		} catch (error) {
			if (generation !== this.refreshGeneration || this._store.isDisposed) {
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
				? () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID).catch(onUnexpectedError).catch(onUnexpectedError)
				: undefined,
		});
		this.updateWriteChrome();
	}

	private canMutateRules(): boolean {
		return canPerformCatalogWriteLive(
			this.mode,
			this.connection.isEngineConnected(),
			isConversationPairingHold(this.connection),
		);
	}

	private ruleWriteHoldReason(): string {
		if (isConversationPairingHold(this.connection) || !this.connection.isEngineConnected()) {
			return localize('ua.engineRulesNotConnected', "Engine not connected");
		}
		return localize('ua.engineRulesCannotChange', "Rules cannot be changed right now.");
	}

	private updateWriteChrome(): void {
		const add = this.canMutateRules() && typeof this.connection.upsertProjectRule === 'function';
		this.globalToolbar.style.display = add ? '' : 'none';
		this.projectToolbar.style.display = add ? '' : 'none';
		const remove = this.canMutateRules() && typeof this.connection.deleteProjectRule === 'function';
		const reason = this.ruleWriteHoldReason();
		for (const button of this.ruleActionButtons) {
			const enabled = button.element.dataset.ruleAction === 'delete' ? remove : add;
			const label = button.element.dataset.ruleLabel ?? '';
			button.enabled = enabled;
			button.setTitle(enabled ? label : reason);
			button.setAriaLabel(enabled ? label : (label ? `${label}. ${reason}` : reason));
		}
	}

	private showWriteMessage(message: string, tone: 'success' | 'error'): void {
		this.writeStatus.style.display = message ? '' : 'none';
		writeStatus(this.writeStatus, message, tone);
	}

	private async promptRule(scope: UniverseAgentProjectRuleScope, existing?: UniverseAgentProjectRule): Promise<void> {
		const upsert = this.connection.upsertProjectRule;
		if (!this.canMutateRules() || typeof upsert !== 'function') {
			return;
		}
		const required = localize('ua.engineRuleTitleRequired', "Title is required.");
		const priorityInvalid = localize('ua.engineRulePriorityInvalid', "Priority must be a whole number from 0 to 3, or left blank.");
		const result = await this.dialogService.input({
			type: 'question',
			message: existing
				? localize('ua.engineRuleEditTitle', "Edit rule")
				: localize('ua.engineRuleAddTitle', "Add rule"),
			detail: localize('ua.engineRuleDialogDetail', "Priority is a whole number from 0 to 3. Leave it blank to keep the current priority. A new rule with a blank priority is saved as 0."),
			primaryButton: localize('ua.engineRuleSave', "Save"),
			checkbox: {
				label: localize('ua.engineRuleEnabledCheckbox', "Enabled"),
				checked: existing?.enabled ?? true,
			},
			inputs: [
				{ type: 'text', label: localize('ua.engineRuleTitle', "Title"), value: existing?.title ?? '', placeholder: localize('ua.engineRuleTitle', "Title") },
				{ type: 'text', label: localize('ua.engineRuleBody', "Body"), value: existing?.body ?? '', placeholder: localize('ua.engineRuleBody', "Body") },
				{ type: 'text', label: localize('ua.engineRulePriority', "Priority"), value: existing ? String(existing.priority) : '', placeholder: localize('ua.engineRulePriority', "Priority") },
			],
			validate: values => {
				if (!(values[0] ?? '').trim()) {
					return required;
				}
				const priority = (values[2] ?? '').trim();
				if (priority && !/^[0-3]$/.test(priority)) {
					return priorityInvalid;
				}
				return undefined;
			},
		});
		if (!result.confirmed || !result.values || !this.canMutateRules() || typeof upsert !== 'function') {
			return;
		}
		const title = (result.values[0] ?? '').trim();
		if (!title) {
			this.showWriteMessage(required, 'error');
			return;
		}
		const priorityRaw = (result.values[2] ?? '').trim();
		if (priorityRaw && !/^[0-3]$/.test(priorityRaw)) {
			this.showWriteMessage(priorityInvalid, 'error');
			return;
		}
		const priority = (priorityRaw ? Number(priorityRaw) : (existing?.priority ?? 0)) as UniverseAgentProjectRulePriority;
		try {
			await upsert({
				scope,
				sessionId: '',
				rule: {
					id: existing?.id ?? '',
					title,
					enabled: result.checkboxChecked ?? false,
					priority,
					body: result.values[1] ?? '',
					scope,
					globs: existing?.globs ?? [],
					appliesTo: existing?.appliesTo ?? [],
				},
			});
			this.showWriteMessage(localize('ua.engineRuleSaved', "Rule saved."), 'success');
			await this.refresh();
			if (!this._store.isDisposed && (this.mode === 'ready' || this.mode === 'empty')) {
				this.showWriteMessage(localize('ua.engineRuleSaved', "Rule saved."), 'success');
			}
		} catch (error) {
			if (this._store.isDisposed) {
				return;
			}
			this.showWriteMessage(getTransportErrorMessage(error) ?? localize('ua.engineRuleSaveFailed', "Unable to save rule."), 'error');
		}
	}

	private async deleteRule(scope: UniverseAgentProjectRuleScope, rule: UniverseAgentProjectRule, anchor: HTMLElement): Promise<void> {
		const remove = this.connection.deleteProjectRule;
		if (!this.canMutateRules() || typeof remove !== 'function') {
			return;
		}
		const label = rule.title || rule.id;
		const confirmed = await showEngineConfirmPopover({
			contextViewService: this.contextViewService,
			anchor,
			message: localize('ua.engineRuleDeleteConfirm', "Delete rule \"{0}\"?", label),
			confirmLabel: localize('ua.engineRuleDelete', "Delete"),
		});
		if (!confirmed || !this.canMutateRules() || typeof remove !== 'function') {
			return;
		}
		try {
			await remove({ scope, sessionId: '', id: rule.id });
			this.showWriteMessage(localize('ua.engineRuleDeleted', "Rule deleted."), 'success');
			await this.refresh();
			if (!this._store.isDisposed && (this.mode === 'ready' || this.mode === 'empty')) {
				this.showWriteMessage(localize('ua.engineRuleDeleted', "Rule deleted."), 'success');
			}
		} catch (error) {
			if (this._store.isDisposed) {
				return;
			}
			this.showWriteMessage(getTransportErrorMessage(error) ?? localize('ua.engineRuleDeleteFailed', "Unable to delete rule."), 'error');
		}
	}

	private renderLists(globalRules: readonly UniverseAgentProjectRule[], projectRules: readonly UniverseAgentProjectRule[]): void {
		this.setRuleCount(globalRules.length + projectRules.length);
		this.rowActions.clear();
		this.ruleActionButtons.length = 0;
		this.paintRuleList(this.globalList, globalRules, RULE_SCOPE_GLOBAL);
		this.paintRuleList(this.projectList, projectRules, RULE_SCOPE_WORKDIR);
		this.updateWriteChrome();
	}

	private paintRuleList(host: HTMLElement, rules: readonly UniverseAgentProjectRule[], scope: UniverseAgentProjectRuleScope): void {
		DOM.clearNode(host);
		if (rules.length === 0) {
			host.textContent = localize('ua.engineRulesEmpty', "No rules.");
			return;
		}
		const canUpsert = this.canMutateRules() && typeof this.connection.upsertProjectRule === 'function';
		const canDelete = this.canMutateRules() && typeof this.connection.deleteProjectRule === 'function';
		for (const rule of rules) {
			const row = DOM.append(host, $('.engine-catalog-row.engine-rules-row'));
			if (!rule.enabled) {
				row.classList.add('engine-rules-row--disabled');
			}
			const text = DOM.append(row, $('.engine-catalog-text'));
			const label = rule.title || rule.id;
			DOM.append(text, $('.engine-catalog-name')).textContent = label;
			const bits = [rule.enabled
				? localize('ua.engineRuleEnabled', "Enabled")
				: localize('ua.engineRuleDisabled', "Disabled")];
			if (rule.globs.length) {
				bits.push(rule.globs.join(', '));
			}
			DOM.append(text, $('.engine-catalog-description')).textContent = bits.join(' · ');
			if (!canUpsert && !canDelete) {
				continue;
			}
			const actions = DOM.append(row, $('.engine-catalog-row-actions.engine-catalog-icon-actions'));
			if (canUpsert) {
				const editLabel = localize('ua.engineRuleEdit', "Edit {0}", label);
				const edit = this.rowActions.add(createCatalogIconButton(actions, editLabel, Codicon.edit));
				edit.element.dataset.ruleAction = 'edit';
				edit.element.dataset.ruleLabel = editLabel;
				this.ruleActionButtons.push(edit);
				this.rowActions.add(edit.onDidClick(() => void this.promptRule(scope, rule).catch(onUnexpectedError).catch(onUnexpectedError)));
			}
			if (canDelete) {
				const deleteLabel = localize('ua.engineRuleDeleteAria', "Delete {0}", label);
				const remove = this.rowActions.add(createCatalogIconButton(actions, deleteLabel, Codicon.trash));
				remove.element.dataset.ruleAction = 'delete';
				remove.element.dataset.ruleLabel = deleteLabel;
				this.ruleActionButtons.push(remove);
				this.rowActions.add(remove.onDidClick(() => void this.deleteRule(scope, rule, remove.element).catch(onUnexpectedError).catch(onUnexpectedError)));
			}
		}
	}

	private clearPresentation(): void {
		this.setRuleCount(0);
		this.rowActions.clear();
		this.ruleActionButtons.length = 0;
		DOM.clearNode(this.globalList);
		DOM.clearNode(this.projectList);
		this.scopePanels.style.display = 'none';
	}
}
