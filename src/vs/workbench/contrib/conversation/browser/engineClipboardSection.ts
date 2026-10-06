/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { hasModifierKeys, StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { conversationEntryHookPresent, isAdvertisedEngineRpc } from '../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentClipboardEntrySummary } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import { getEngineSectionApiUnavailableCopy } from './engineSectionChrome.js';
import {
	canSendEngineClipboardClear,
	canSendEngineClipboardListRequest,
	canSendEngineClipboardRead,
	canSendEngineClipboardWrite,
	ENGINE_CLIPBOARD_CLEAR_LABEL,
	ENGINE_CLIPBOARD_LIST_EMPTY_COPY,
	ENGINE_CLIPBOARD_LIST_FEATURE,
	ENGINE_CLIPBOARD_READ_LABEL,
	ENGINE_CLIPBOARD_WRITE_LABEL,
	engineClipboardClearRequest,
	engineClipboardListRequest,
	engineClipboardReadRequest,
	engineClipboardWriteRequest,
	formatEngineClipboardClearLabel,
	formatEngineClipboardListLabel,
	formatEngineClipboardReadLabel,
	formatEngineClipboardWriteLabel,
} from './engineClipboardList.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';
import { isConversationPairingHold } from './conversationSessionStatus.js';
import { writeStatus } from './connectionPreferencesPane.js';

const $ = DOM.$;

/**
 * Engine Preferences Clipboard — honest List + Read + Write + Clear.
 * Connected + hook only. Empty sessionId / agentId / clipId / label /
 * content / filePath / url are sent as-is. Write always sends TEXT +
 * empty fields. Clear always sends empty sessionId. Empty clipId and
 * removedCount 0 stay as-is. Write/Clear success is restored after
 * refresh only when ListClipboard listed (D212 / D201 sibling).
 * List throw after a live paint keeps leftover rows + failed (D239);
 * first-pull throw stays empty+failed and must not paint empty-success.
 * Connected + missing list hook after a live paint keeps leftover rows +
 * unsupported (D257); first-pull no-hook stays empty+unsupported.
 * Disconnect still clears rows.
 * Pairing-hold leftover keeps rows + disconnected note (D281) and disables
 * Write/Clear (D314) and Read (D319); leftover-looks-live
 * (`isEngineConnected()===true` + pairingPending) also refuses writes/Read
 * and skips extra list. First-pull leftover-looks-live (no leftover) stays
 * empty and skips list (D347 pairing-hold-first). KEEP
 * `applyDisconnectedRefresh` already closes write buttons; do not redo KEEP.
 * List-fail leftover keeps rows + failed and closes Write/Read/Clear (D438);
 * write gate is not only connected+pairingHold (`leftoverListFailed` / mode
 * failed).
 */
export class EngineClipboardSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly status: EngineCatalogStatusWidget;
	private readonly listHost: HTMLElement;
	private readonly writeButton: Button;
	private readonly readButton: Button;
	private readonly clearButton: Button;
	private readonly writeStatus: HTMLElement;
	private readonly readStatus: HTMLElement;
	private readonly clearStatus: HTMLElement;

	private sectionActive = false;
	private renderGeneration = 0;
	private _writeGeneration = 0;
	private leftoverListFailed = false;
	private entries: UniverseAgentClipboardEntrySummary[] = [];
	private entryCount = 0;
	private readonly _onDidChangeItemCount = this._register(new Emitter<void>());
	readonly onDidChangeItemCount: Event<void> = this._onDidChangeItemCount.event;
	private selectedEntry: UniverseAgentClipboardEntrySummary | undefined;
	private renderedRows: { readonly element: HTMLElement; readonly model: UniverseAgentClipboardEntrySummary }[] = [];

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
		this.writeButton = this._register(new Button(actionsRow, { ...defaultButtonStyles, secondary: true }));
		this.writeButton.label = ENGINE_CLIPBOARD_WRITE_LABEL;
		this._register(this.writeButton.onDidClick(() => void this.handleWrite().catch(onUnexpectedError).catch(onUnexpectedError)));

		this.readButton = this._register(new Button(actionsRow, { ...defaultButtonStyles, secondary: true }));
		this.readButton.label = ENGINE_CLIPBOARD_READ_LABEL;
		this._register(this.readButton.onDidClick(() => void this.handleRead().catch(onUnexpectedError).catch(onUnexpectedError)));

		this.clearButton = this._register(new Button(actionsRow, { ...defaultButtonStyles, secondary: true }));
		this.clearButton.label = ENGINE_CLIPBOARD_CLEAR_LABEL;
		this._register(this.clearButton.onDidClick(() => void this.handleClear().catch(onUnexpectedError).catch(onUnexpectedError)));

		this.writeStatus = DOM.append(this.container, $('.engine-clipboard-write-status'));
		this.writeStatus.style.display = 'none';
		this.readStatus = DOM.append(this.container, $('.engine-clipboard-read-status'));
		this.readStatus.style.display = 'none';
		this.clearStatus = DOM.append(this.container, $('.engine-clipboard-clear-status'));
		this.clearStatus.style.display = 'none';
		this.updateWriteAction();
		this.updateReadAction();
		this.updateClearAction();

		this._register(this.connection.onDidChangeConnection(() => {
			if (this.sectionActive) {
				void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
				return;
			}
			// The nav stays visible while this section is hidden. A real disconnect
			// still drops the leftover count; pairing-hold and a live engine do not list.
			if (isConversationPairingHold(this.connection) || this.connection.isEngineConnected()) {
				return;
			}
			this.applyDisconnectedRefresh(this.entries.length > 0);
		}));
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	getItemCount(): number | undefined {
		return this.entryCount > 0 ? this.entryCount : undefined;
	}

	private setEntryCount(count: number): void {
		if (this.entryCount === count) {
			return;
		}
		this.entryCount = count;
		this._onDidChangeItemCount.fire();
	}

	setSectionActive(active: boolean): void {
		this.sectionActive = active;
		this.container.style.display = active ? '' : 'none';
		if (active) {
			void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
		}
	}

	setShowSectionHeading(_show: boolean): void {
		// Pane detail title only.
	}

	layout(_width: number, _height: number): void {
		// Static list.
	}

	private async refresh(): Promise<boolean> {
		const generation = ++this.renderGeneration;
		const hook = this.connection.listClipboard;
		const pairingHold = isConversationPairingHold(this.connection);
		const canSend = canSendEngineClipboardListRequest(
			this.connection.isEngineConnected(),
			conversationEntryHookPresent(this.connection.getConnectionSnapshot(), 'listClipboard', hook),
			pairingHold,
		);

		this.writeStatus.style.display = 'none';
		writeStatus(this.writeStatus, '');
		this.readStatus.style.display = 'none';
		writeStatus(this.readStatus, '');
		this.clearStatus.style.display = 'none';
		writeStatus(this.clearStatus, '');
		this.updateWriteAction();
		this.updateReadAction();
		this.updateClearAction();

		// D347 leftover-looks-live: pairing-hold first. KEEP is not only leftover + pairingHold.
		if (pairingHold || !this.connection.isEngineConnected()) {
			return this.applyDisconnectedRefresh(this.entries.length > 0);
		}

		if (!canSend || !hook) {
			if (this.entries.length === 0) {
				this.clearListPresentation();
			}
			this.status.render({
				mode: 'unsupported',
				featureLabel: ENGINE_CLIPBOARD_LIST_FEATURE,
				reason: getEngineSectionApiUnavailableCopy(ENGINE_CLIPBOARD_LIST_FEATURE),
			});
			return false;
		}

		this.status.render({
			mode: 'loading',
			loadingKind: 'list',
			featureLabel: ENGINE_CLIPBOARD_LIST_FEATURE,
		});

		try {
			const result = await hook.call(this.connection, engineClipboardListRequest());
			if (generation !== this.renderGeneration) {
				return false;
			}
			if (isConversationPairingHold(this.connection) || !this.connection.isEngineConnected()) {
				return this.applyDisconnectedRefresh(this.entries.length > 0);
			}
			this.leftoverListFailed = false;
			this.entries = [...result.entries];
			this.paintList();
			this.updateWriteAction();
			this.updateReadAction();
			this.updateClearAction();
			return true;
		} catch (error) {
			if (generation !== this.renderGeneration) {
				return false;
			}
			const reason = error instanceof Error ? error.message : String(error);
			this.leftoverListFailed = true;
			this.status.render({
				mode: 'failed',
				featureLabel: ENGINE_CLIPBOARD_LIST_FEATURE,
				reason,
				onRetry: () => void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError),
			});
			// D438: leftover rows stay; Write/Read/Clear chrome must close after list-fail.
			this.updateWriteAction();
			this.updateReadAction();
			this.updateClearAction();
			return false;
		}
	}

	private keepLeftoverCatalogForPairingHold(hadLiveCatalog: boolean): boolean {
		return hadLiveCatalog && isConversationPairingHold(this.connection);
	}

	private isClipboardWritePairingHold(): boolean {
		return isConversationPairingHold(this.connection);
	}

	/** Catalog leftover contract: list-fail leftover is not a live write surface. */
	private isClipboardWriteListFailed(): boolean {
		return this.leftoverListFailed;
	}

	private applyDisconnectedRefresh(hadLiveCatalog: boolean): boolean {
		this.updateWriteAction();
		this.updateReadAction();
		this.updateClearAction();
		if (this.keepLeftoverCatalogForPairingHold(hadLiveCatalog)) {
			this.status.render({
				mode: 'disconnected',
				onOpenConnection: () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID).catch(onUnexpectedError).catch(onUnexpectedError),
			});
			return false;
		}
		this.clearListPresentation();
		this.status.render({
			mode: 'disconnected',
			onOpenConnection: () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID).catch(onUnexpectedError).catch(onUnexpectedError),
		});
		return false;
	}

	private clearListPresentation(): void {
		this.entries = [];
		this.setEntryCount(0);
		this.selectedEntry = undefined;
		this.listHost.style.display = 'none';
		DOM.clearNode(this.listHost);
		this.renderedRows = [];
	}

	private paintList(): void {
		this.setEntryCount(this.entries.length);
		this.selectedEntry = undefined;
		DOM.clearNode(this.listHost);
		this.renderedRows = [];

		if (this.entries.length === 0) {
			this.listHost.style.display = 'none';
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
			this.renderedRows.push({ element: row, model: entry });
			row.setAttribute('role', 'listitem');
			row.tabIndex = 0;
			row.setAttribute('aria-selected', 'false');
			row.textContent = formatEngineClipboardListLabel(entry);
			row.addEventListener('click', () => this.selectEntry(entry));
			row.addEventListener('keydown', event => this.onClipboardRowKeyDown(event, entry));
		}
	}

	private selectEntry(entry: UniverseAgentClipboardEntrySummary): void {
		this.selectedEntry = entry;
		this.paintSelection();
	}

	private onClipboardRowKeyDown(event: KeyboardEvent, entry: UniverseAgentClipboardEntrySummary): void {
		const action = readEngineListRowKey(event);
		if (!action) {
			return;
		}
		// Enter/Space select this row, the same as click. Arrows move .selected.
		// None of these keys call Write, Read, or Clear.
		stopEngineListRowKey(event);
		if (action === 'activate') {
			this.selectEntry(entry);
			return;
		}
		this.moveClipboardSelection(action === 'next' ? 1 : -1, event.currentTarget);
	}

	private moveClipboardSelection(delta: number, from: EventTarget | null): void {
		const rows = this.renderedRows;
		if (rows.length === 0) {
			return;
		}
		let index = rows.findIndex(row => row.element === from);
		if (index < 0) {
			index = rows.findIndex(row => row.model === this.selectedEntry);
		}
		const nextIndex = index < 0
			? (delta > 0 ? 0 : rows.length - 1)
			: Math.min(rows.length - 1, Math.max(0, index + delta));
		const next = rows[nextIndex];
		if (next.model !== this.selectedEntry) {
			this.selectEntry(next.model);
		}
		next.element.focus();
	}

	private paintSelection(): void {
		for (const rendered of this.renderedRows) {
			const selected = rendered.model === this.selectedEntry;
			rendered.element.classList.toggle('selected', selected);
			rendered.element.setAttribute('aria-selected', String(selected));
		}
	}

	private clipboardAdvertised(key: 'writeClipboard' | 'readClipboard' | 'clearClipboard', method: unknown): boolean {
		return isAdvertisedEngineRpc(this.connection.getCapabilitySnapshot(), key, method);
	}

	private updateWriteAction(): void {
		this.writeButton.enabled = !this.isClipboardWriteListFailed() && canSendEngineClipboardWrite(
			this.connection.isEngineConnected(),
			this.clipboardAdvertised('writeClipboard', this.connection.writeClipboard),
			this.isClipboardWritePairingHold(),
		);
	}

	private updateReadAction(): void {
		this.readButton.enabled = !this.isClipboardWriteListFailed() && canSendEngineClipboardRead(
			this.connection.isEngineConnected(),
			this.clipboardAdvertised('readClipboard', this.connection.readClipboard),
			this.isClipboardWritePairingHold(),
		);
	}

	private updateClearAction(): void {
		this.clearButton.enabled = !this.isClipboardWriteListFailed() && canSendEngineClipboardClear(
			this.connection.isEngineConnected(),
			this.clipboardAdvertised('clearClipboard', this.connection.clearClipboard),
			this.isClipboardWritePairingHold(),
		);
	}

	private async handleWrite(): Promise<void> {
		const hook = this.connection.writeClipboard;
		if (this.isClipboardWriteListFailed() || !canSendEngineClipboardWrite(this.connection.isEngineConnected(), this.clipboardAdvertised('writeClipboard', hook), this.isClipboardWritePairingHold()) || !hook) {
			return;
		}
		const generation = ++this._writeGeneration;
		const request = engineClipboardWriteRequest();
		try {
			const result = await hook.call(this.connection, request);
			if (generation !== this._writeGeneration || this._store.isDisposed) {
				return;
			}
			this.writeStatus.style.display = '';
			writeStatus(this.writeStatus, formatEngineClipboardWriteLabel(result.clipId), 'success');
			const listed = await this.refresh();
			if (generation !== this._writeGeneration || this._store.isDisposed) {
				return;
			}
			if (listed) {
				this.writeStatus.style.display = '';
				writeStatus(this.writeStatus, formatEngineClipboardWriteLabel(result.clipId), 'success');
			}
		} catch (error) {
			if (generation !== this._writeGeneration || this._store.isDisposed) {
				return;
			}
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.writeStatus.style.display = '';
			writeStatus(this.writeStatus, reason, 'error');
		}
	}

	private async handleRead(): Promise<void> {
		const hook = this.connection.readClipboard;
		if (this.isClipboardWriteListFailed() || !canSendEngineClipboardRead(this.connection.isEngineConnected(), this.clipboardAdvertised('readClipboard', hook), this.isClipboardWritePairingHold()) || !hook) {
			return;
		}
		const request = engineClipboardReadRequest(this.selectedEntry);
		try {
			const result = await hook.call(this.connection, request);
			this.readStatus.style.display = '';
			writeStatus(this.readStatus, formatEngineClipboardReadLabel(result.entry), 'success');
		} catch (error) {
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.readStatus.style.display = '';
			writeStatus(this.readStatus, reason, 'error');
		}
	}

	private async handleClear(): Promise<void> {
		const hook = this.connection.clearClipboard;
		if (this.isClipboardWriteListFailed() || !canSendEngineClipboardClear(this.connection.isEngineConnected(), this.clipboardAdvertised('clearClipboard', hook), this.isClipboardWritePairingHold()) || !hook) {
			return;
		}
		const request = engineClipboardClearRequest();
		try {
			const result = await hook.call(this.connection, request);
			this.clearStatus.style.display = '';
			writeStatus(this.clearStatus, formatEngineClipboardClearLabel(result.removedCount), 'success');
			const listed = await this.refresh();
			if (listed) {
				this.clearStatus.style.display = '';
				writeStatus(this.clearStatus, formatEngineClipboardClearLabel(result.removedCount), 'success');
			}
		} catch (error) {
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.clearStatus.style.display = '';
			writeStatus(this.clearStatus, reason, 'error');
		}
	}
}

type EngineListRowKey = 'activate' | 'next' | 'previous';

function readEngineListRowKey(event: KeyboardEvent): EngineListRowKey | undefined {
	if (event.isComposing || hasModifierKeys(event)) {
		return undefined;
	}
	const standard = new StandardKeyboardEvent(event);
	if (standard.equals(KeyCode.Enter) || standard.equals(KeyCode.Space) || event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
		return 'activate';
	}
	if (standard.equals(KeyCode.DownArrow) || standard.equals(KeyCode.RightArrow) || event.key === 'ArrowDown' || event.key === 'ArrowRight') {
		return 'next';
	}
	if (standard.equals(KeyCode.UpArrow) || standard.equals(KeyCode.LeftArrow) || event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
		return 'previous';
	}
	return undefined;
}

function stopEngineListRowKey(event: KeyboardEvent): void {
	const standard = new StandardKeyboardEvent(event);
	standard.preventDefault();
	standard.stopPropagation();
}
