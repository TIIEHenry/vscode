/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentMemoryCategoryInfo, UniverseAgentMemorySearchEntry } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';
import { isConversationPairingHold } from './conversationSessionStatus.js';
import { writeStatus } from './connectionPreferencesPane.js';
import { canPerformCatalogWriteLive, type EngineCatalogPaneMode } from './engineCatalog.js';
import { createCatalogIconButton } from './engineCatalogIconButton.js';
import { showEngineConfirmPopover } from './engineConfirmPopover.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import { getEngineSectionApiUnavailableCopy } from './engineSectionChrome.js';

const $ = DOM.$;

const MEMORY_FEATURE = localize('ua.engineMemoryFeatureLabel', "memory");
const MEMORY_SCOPE = 'global';
const MEMORY_SEARCH_LIMIT = 50;

function getTransportErrorMessage(error: unknown): string | undefined {
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return undefined;
}

/**
 * Engine Preferences Memory. Scope is always `global`. List uses an empty
 * category (all categories). There is no enable toggle. Search replaces the
 * list while the query is non-empty.
 */
export class EngineMemorySection extends Disposable {

	private readonly container: HTMLElement;
	private readonly status: EngineCatalogStatusWidget;
	private readonly filter: HTMLInputElement;
	private readonly toolbar: HTMLElement;
	private readonly writeStatus: HTMLElement;
	private readonly listHost: HTMLElement;
	private readonly rowActions = this._register(new DisposableStore());

	private mode: EngineCatalogPaneMode = 'disconnected';
	private fileCount = 0;
	private hasRows = false;
	private refreshGeneration = 0;
	private readonly _onDidChangeItemCount = this._register(new Emitter<void>());
	readonly onDidChangeItemCount: Event<void> = this._onDidChangeItemCount.event;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@ICommandService private readonly commandService: ICommandService,
		@IDialogService private readonly dialogService: IDialogService,
		@IContextViewService private readonly contextViewService: IContextViewService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-memory-section'));
		this.container.style.display = 'none';

		this.status = this._register(new EngineCatalogStatusWidget(this.container));

		this.filter = DOM.append(this.container, $('input.engine-provider-catalog-filter')) as HTMLInputElement;
		this.filter.type = 'search';
		this.filter.placeholder = localize('ua.engineMemorySearch', "Search memory");
		this.filter.setAttribute('aria-label', localize('ua.engineMemorySearch', "Search memory"));
		this._register(DOM.addDisposableListener(this.filter, 'input', () => {
			void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
		}));

		this.toolbar = DOM.append(this.container, $('.engine-catalog-write-toolbar.engine-catalog-icon-actions'));
		this.toolbar.style.display = 'none';
		const add = this._register(createCatalogIconButton(this.toolbar, localize('ua.engineMemoryAdd', "Add memory"), Codicon.add));
		this._register(add.onDidClick(() => void this.promptSave().catch(onUnexpectedError).catch(onUnexpectedError)));
		const refresh = this._register(createCatalogIconButton(this.toolbar, localize('ua.engineMemoryRefresh', "Refresh memory"), Codicon.refresh));
		this._register(refresh.onDidClick(() => void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError)));

		this.writeStatus = DOM.append(this.container, $('.engine-catalog-action-message.engine-memory-write-status'));
		this.writeStatus.setAttribute('role', 'status');
		this.writeStatus.style.display = 'none';

		this.listHost = DOM.append(this.container, $('.engine-catalog-list.engine-memory-list'));
		this.listHost.style.display = 'none';

		this._register(this.connection.onDidChangeConnection(() => {
			void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
		}));
		void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
	}

	override dispose(): void {
		this.refreshGeneration++;
		this.clearRows();
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

	/** File count after a list or search. Headings do not count. */
	getItemCount(): number | undefined {
		return this.fileCount > 0 ? this.fileCount : undefined;
	}

	layout(_width: number, _height: number): void {
		// Static rows.
	}

	private setFileCount(count: number): void {
		if (this.fileCount === count) {
			return;
		}
		this.fileCount = count;
		this._onDidChangeItemCount.fire();
	}

	private canMutate(): boolean {
		return canPerformCatalogWriteLive(
			this.mode,
			this.connection.isEngineConnected(),
			isConversationPairingHold(this.connection),
		);
	}

	private updateChrome(): void {
		const connected = this.connection.isEngineConnected() && !isConversationPairingHold(this.connection);
		const canList = connected && typeof this.connection.listMemory === 'function';
		const canAdd = this.canMutate() && typeof this.connection.saveMemory === 'function';
		this.toolbar.style.display = canList || canAdd ? '' : 'none';
		const addButton = this.toolbar.querySelector<HTMLElement>('[aria-label="Add memory"]');
		const refreshButton = this.toolbar.querySelector<HTMLElement>('[aria-label="Refresh memory"]');
		if (addButton) {
			addButton.style.display = canAdd ? '' : 'none';
		}
		if (refreshButton) {
			refreshButton.style.display = canList ? '' : 'none';
		}
		this.filter.disabled = !canList;
	}

	private showWriteMessage(message: string, tone: 'success' | 'error'): void {
		this.writeStatus.style.display = message ? '' : 'none';
		writeStatus(this.writeStatus, message, tone);
	}

	private async refresh(): Promise<void> {
		if (this._store.isDisposed) {
			return;
		}
		this.writeStatus.style.display = 'none';
		const generation = ++this.refreshGeneration;
		const connected = this.connection.isEngineConnected();
		if (isConversationPairingHold(this.connection) || !connected) {
			this.applyDisconnected();
			return;
		}
		const listMemory = this.connection.listMemory;
		if (typeof listMemory !== 'function') {
			this.renderUnsupported();
			return;
		}

		const query = this.filter.value.trim();
		this.mode = 'loading';
		this.updateChrome();
		if (!this.hasRows) {
			this.listHost.style.display = 'none';
		}
		this.status.render({
			mode: 'loading',
			loadingKind: 'list',
			featureLabel: MEMORY_FEATURE,
		});

		try {
			if (query) {
				const searchMemory = this.connection.searchMemory;
				if (typeof searchMemory !== 'function') {
					if (!this.isCurrent(generation)) {
						return;
					}
					this.showWriteMessage(localize('ua.engineMemorySearchUnavailable', "Search is unavailable."), 'error');
					this.mode = this.hasRows ? 'ready' : 'empty';
					this.updateChrome();
					this.status.render({
						mode: this.mode,
						featureLabel: MEMORY_FEATURE,
						emptyCopy: localize('ua.engineMemoryEmpty', "No memory."),
					});
					return;
				}
				const result = await searchMemory({
					scope: MEMORY_SCOPE,
					query,
					keywords: [],
					limit: MEMORY_SEARCH_LIMIT,
				});
				if (!this.isCurrent(generation)) {
					return;
				}
				if (isConversationPairingHold(this.connection) || !this.connection.isEngineConnected()) {
					this.applyDisconnected();
					return;
				}
				this.paintSearch(result.results);
			} else {
				const result = await listMemory({ scope: MEMORY_SCOPE, category: '' });
				if (!this.isCurrent(generation)) {
					return;
				}
				if (isConversationPairingHold(this.connection) || !this.connection.isEngineConnected()) {
					this.applyDisconnected();
					return;
				}
				this.paintList(result.categories);
			}
			this.mode = this.fileCount > 0 ? 'ready' : 'empty';
			this.status.render({
				mode: this.mode,
				featureLabel: MEMORY_FEATURE,
				emptyCopy: localize('ua.engineMemoryEmpty', "No memory."),
			});
			this.updateChrome();
		} catch (error) {
			if (!this.isCurrent(generation)) {
				return;
			}
			if (isConversationPairingHold(this.connection) || !this.connection.isEngineConnected()) {
				this.applyDisconnected();
				return;
			}
			if (!this.hasRows) {
				this.clearRows();
			}
			this.mode = 'failed';
			this.updateChrome();
			this.status.render({
				mode: 'failed',
				featureLabel: MEMORY_FEATURE,
				reason: getTransportErrorMessage(error),
				onRetry: () => void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError),
			});
		}
	}

	private isCurrent(generation: number): boolean {
		return generation === this.refreshGeneration && !this._store.isDisposed;
	}

	private applyDisconnected(): void {
		this.mode = 'disconnected';
		if (this.hasRows && isConversationPairingHold(this.connection)) {
			this.listHost.style.display = '';
		} else {
			this.clearRows();
		}
		this.updateChrome();
		this.status.render({
			mode: 'disconnected',
			onOpenConnection: () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID).catch(onUnexpectedError).catch(onUnexpectedError),
		});
	}

	private renderUnsupported(): void {
		this.clearRows();
		this.mode = 'unsupported';
		this.updateChrome();
		this.status.render({
			mode: 'unsupported',
			featureLabel: MEMORY_FEATURE,
			reason: getEngineSectionApiUnavailableCopy(MEMORY_FEATURE),
		});
	}

	private paintList(categories: readonly UniverseAgentMemoryCategoryInfo[]): void {
		this.rowActions.clear();
		DOM.clearNode(this.listHost);
		let count = 0;
		for (const category of categories) {
			const heading = DOM.append(this.listHost, $('h4'));
			heading.textContent = category.category;
			for (const file of category.files) {
				count++;
				this.paintRow(file.title || file.filename, category.category, file.filename, undefined);
			}
		}
		this.finishPaint(count);
	}

	private paintSearch(results: readonly UniverseAgentMemorySearchEntry[]): void {
		this.rowActions.clear();
		DOM.clearNode(this.listHost);
		for (const entry of results) {
			this.paintRow(entry.title || entry.filename, entry.category, entry.filename, entry.snippet);
		}
		this.finishPaint(results.length);
	}

	private finishPaint(count: number): void {
		this.hasRows = count > 0;
		this.listHost.style.display = count > 0 ? '' : 'none';
		this.setFileCount(count);
	}

	private paintRow(title: string, category: string, filename: string, snippet: string | undefined): void {
		const row = DOM.append(this.listHost, $('.engine-catalog-row.engine-memory-row'));
		const text = DOM.append(row, $('.engine-catalog-text'));
		DOM.append(text, $('.engine-catalog-name')).textContent = title;
		const bits = [category, filename];
		if (snippet) {
			bits.push(snippet);
		}
		DOM.append(text, $('.engine-catalog-description')).textContent = bits.filter(bit => bit.length > 0).join(' · ');
		if (typeof this.connection.deleteMemory !== 'function') {
			return;
		}
		const actions = DOM.append(row, $('.engine-catalog-row-actions.engine-catalog-icon-actions'));
		const remove = this.rowActions.add(createCatalogIconButton(actions, localize('ua.engineMemoryDelete', "Delete {0}", title), Codicon.trash));
		this.rowActions.add(remove.onDidClick(() => void this.deleteEntry(category, filename, title, remove.element).catch(onUnexpectedError).catch(onUnexpectedError)));
	}

	private clearRows(): void {
		this.rowActions.clear();
		this.hasRows = false;
		DOM.clearNode(this.listHost);
		this.listHost.style.display = 'none';
		this.setFileCount(0);
	}

	private async promptSave(): Promise<void> {
		const saveMemory = this.connection.saveMemory;
		if (!this.canMutate() || typeof saveMemory !== 'function') {
			return;
		}
		const required = localize('ua.engineMemoryContentRequired', "Content is required.");
		const result = await this.dialogService.input({
			type: 'question',
			message: localize('ua.engineMemoryAddTitle', "Add memory"),
			detail: localize('ua.engineMemoryDialogDetail', "Saved in the global memory scope. Category may be left blank."),
			primaryButton: localize('ua.engineMemorySave', "Save"),
			inputs: [
				{ type: 'text', label: localize('ua.engineMemoryContent', "Content"), placeholder: localize('ua.engineMemoryContent', "Content") },
				{ type: 'text', label: localize('ua.engineMemoryCategory', "Category"), placeholder: localize('ua.engineMemoryCategory', "Category") },
			],
			validate: values => (values[0] ?? '').trim() ? undefined : required,
		});
		if (!result.confirmed || !result.values || !this.canMutate() || typeof saveMemory !== 'function') {
			return;
		}
		const content = (result.values[0] ?? '').trim();
		if (!content) {
			this.showWriteMessage(required, 'error');
			return;
		}
		const category = (result.values[1] ?? '').trim();
		try {
			const saved = await saveMemory({ scope: MEMORY_SCOPE, content, category });
			if (!saved.success) {
				this.showWriteMessage(saved.message || localize('ua.engineMemorySaveFailed', "Unable to save memory."), 'error');
				return;
			}
			this.showWriteMessage(localize('ua.engineMemorySaved', "Memory saved."), 'success');
			await this.refresh();
			if (!this._store.isDisposed && (this.mode === 'ready' || this.mode === 'empty')) {
				this.showWriteMessage(localize('ua.engineMemorySaved', "Memory saved."), 'success');
			}
		} catch (error) {
			if (this._store.isDisposed) {
				return;
			}
			this.showWriteMessage(getTransportErrorMessage(error) ?? localize('ua.engineMemorySaveFailed', "Unable to save memory."), 'error');
		}
	}

	private async deleteEntry(category: string, filename: string, title: string, anchor: HTMLElement): Promise<void> {
		const deleteMemory = this.connection.deleteMemory;
		if (!this.canMutate() || typeof deleteMemory !== 'function') {
			return;
		}
		const confirmed = await showEngineConfirmPopover({
			contextViewService: this.contextViewService,
			anchor,
			message: localize('ua.engineMemoryDeleteConfirm', "Delete memory \"{0}\"?", title),
			confirmLabel: localize('ua.engineMemoryDeleteButton', "Delete"),
		});
		if (!confirmed || !this.canMutate() || typeof deleteMemory !== 'function') {
			return;
		}
		try {
			const removed = await deleteMemory({ scope: MEMORY_SCOPE, category, filename });
			if (!removed.success) {
				this.showWriteMessage(removed.message || localize('ua.engineMemoryDeleteFailed', "Unable to delete memory."), 'error');
				return;
			}
			this.showWriteMessage(localize('ua.engineMemoryDeleted', "Memory deleted."), 'success');
			await this.refresh();
			if (!this._store.isDisposed && (this.mode === 'ready' || this.mode === 'empty')) {
				this.showWriteMessage(localize('ua.engineMemoryDeleted', "Memory deleted."), 'success');
			}
		} catch (error) {
			if (this._store.isDisposed) {
				return;
			}
			this.showWriteMessage(getTransportErrorMessage(error) ?? localize('ua.engineMemoryDeleteFailed', "Unable to delete memory."), 'error');
		}
	}
}
