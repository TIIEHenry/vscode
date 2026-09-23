/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, reset } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { handleConversationOverlayTab } from './conversationConfirmationSeat.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentSessionSnapshotInfo } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import {
	conversationLensSessionBarSnapshots,
	conversationLensSessionBarSnapshotsClose,
	conversationLensSessionBarSnapshotsDelete,
	conversationLensSessionBarSnapshotsEmpty,
	conversationLensSessionBarSnapshotsLoading,
	conversationLensSessionBarSnapshotsTitle,
	conversationLensSessionBarSnapshotsRestore,
	conversationLensSessionBarSnapshotsUnavailableDisconnected,
	conversationLensSessionBarSnapshotsUnavailableNoHook,
	conversationLensSessionBarSnapshotsUnavailableNoSession,
} from './conversationLensSessionBarStrings.js';
import { isConversationPairingHold } from './conversationSessionStatus.js';
import { writeStatus } from './connectionPreferencesPane.js';
import { IConversationRosterService } from './conversationStubService.js';

export const conversationLensSnapshotsButtonClass = 'conversation-lens-session-snapshots';
export const conversationLensSnapshotsOverlayClass = 'conversation-lens-snapshots-overlay';
export const conversationLensSnapshotsRowClass = 'conversation-lens-snapshots-row';
export const conversationLensSnapshotsRestoreClass = 'conversation-lens-snapshots-restore';
export const conversationLensSnapshotsDeleteClass = 'conversation-lens-snapshots-delete';
export const conversationLensSnapshotsWriteStatusClass = 'conversation-lens-snapshots-write-status';

export function canRequestEngineSnapshots(
	connected: boolean,
	hasListSnapshots: boolean,
	sessionId: string | undefined,
): boolean {
	return connected && hasListSnapshots && !!sessionId;
}

/** Honest gate for overlay Restore → AgentService.RestoreSnapshot. */
export function canRestoreEngineSnapshot(
	connected: boolean,
	hasRestoreSnapshot: boolean,
	snapshotId: string | undefined,
	sessionId: string | undefined,
): boolean {
	return connected && hasRestoreSnapshot && !!snapshotId?.trim() && !!sessionId?.trim();
}

/** Honest gate for overlay Delete → AgentService.DeleteSnapshot. */
export function canDeleteEngineSnapshot(
	connected: boolean,
	hasDeleteSnapshot: boolean,
	snapshotId: string | undefined,
	sessionId: string | undefined,
): boolean {
	return connected && hasDeleteSnapshot && !!snapshotId?.trim() && !!sessionId?.trim();
}

export function formatEngineSnapshotCreatedAt(createdAt: number | undefined): string {
	if (createdAt === undefined) {
		return '—';
	}
	const ms = createdAt < 1e12 ? createdAt * 1000 : createdAt;
	const date = new Date(ms);
	if (Number.isNaN(date.getTime())) {
		return String(createdAt);
	}
	return date.toISOString();
}

export function formatEngineSnapshotFailedCopy(reason: string): string {
	return localize('conversationLens.sessionBarSnapshotsFailed', "Failed to read engine snapshots — {0}", reason);
}

export function formatEngineSnapshotRestoreFailedCopy(reason: string): string {
	return localize('conversationLens.sessionBarSnapshotsRestoreFailed', "Unable to restore: {0}", reason);
}

export function formatEngineSnapshotDeleteFailedCopy(reason: string): string {
	return localize('conversationLens.sessionBarSnapshotsDeleteFailed', "Unable to delete: {0}", reason);
}

export const ENGINE_SNAPSHOT_RESTORE_SUCCESS_COPY = localize('conversationLens.sessionBarSnapshotsRestoreSuccess', "Restored.");

export const ENGINE_SNAPSHOT_DELETE_SUCCESS_COPY = localize('conversationLens.sessionBarSnapshotsDeleteSuccess', "Deleted.");

function snapshotWriteFailureReason(error: unknown): string {
	return error instanceof Error && error.message ? error.message : String(error);
}

/**
 * SessionBar extra control + overlay for AgentService.ListSnapshots.
 * Distinct from SessionBar History ({@link ConversationEngineHistoryList} GetHistory).
 * Restore on rows calls {@link IUniverseAgentConnection.restoreSnapshot};
 * a successful restore paints {@link ENGINE_SNAPSHOT_RESTORE_SUCCESS_COPY} on the
 * sibling write-status, then refreshes via {@link IUniverseAgentConnection.listSnapshots}.
 * Success copy is restored only after a successful list; a subsequent list
 * failure must not leave Restored. on the failed overlay.
 * Failed restore / no send does not refresh;
 * ok:false / throw paints a sibling write-status line without unloading rows.
 * Delete on rows confirms then calls {@link IUniverseAgentConnection.deleteSnapshot};
 * a confirmed successful delete paints {@link ENGINE_SNAPSHOT_DELETE_SUCCESS_COPY}
 * the same way (success → refresh → success-if-listed) and keeps the overlay open.
 * Cancel / failed delete / no send does not refresh;
 * ok:false / throw paints the same write-status line without unloading rows.
 * Success copy is painted on the write-status sibling, not via paintStatus
 * (that helper unloads rows).
 * List throw after a live paint keeps leftover rows + failed (D242);
 * first-pull throw stays empty+failed and must not paint empty-success.
 * Connected no-hook after a live paint keeps leftover rows + UnavailableNoHook (D268);
 * first-pull no-hook stays empty+unavailable and must not paint empty-success.
 * Disconnect still unloads rows.
 * Pairing-hold leftover keeps rows + disconnected copy (D280) and disables
 * Restore/Delete (D309); leftover-looks-live (`isEngineConnected()===true`
 * + pairingPending) also refuses writes. Pairing-hold-first refresh (D346)
 * first-pull leftover-looks-live (no leftover) paints empty / disconnected
 * and skips listSnapshots; leftover WITH leftover still KEEP + 0 extra list.
 * Post-await leftover-looks-live (D365) also KEEP + disconnected and
 * refuses paintSnapshots as live.
 * KEEP `applyPairingHoldLeftoverRefresh` already closes Restore/Delete;
 * do not redo KEEP.
 * List-fail leftover keeps rows + failed and closes Restore/Delete (D440);
 * write gate is not only connected+pairingHold (`leftoverListFailed`).
 * KEEP leftover list-fail (D458: connected + pairingPending===false +
 * `isEngineSessionReady()===false`) also closes Restore/Delete.
 * Restore/Delete success copy is restored only after a successful list
 * (D54/D154 listed-gate); leftover list-fail clears Restored./Deleted.
 * no Create.
 */
export class ConversationEngineSnapshotsList extends Disposable {

	readonly element: HTMLElement;
	readonly overlayElement: HTMLElement;

	private readonly button: Button;
	private readonly body: HTMLElement;
	private readonly writeStatus: HTMLElement;
	private readonly rowDisposables = this._register(new DisposableStore());
	private open = false;
	private renderGeneration = 0;
	private leftoverListFailed = false;
	private paintedLiveSnapshots = false;
	private paintedSnapshotSessionId: string | undefined;
	private onWillShow: (() => void) | undefined;
	private readonly getSessionId?: () => string | undefined;

	constructor(
		buttonParent: HTMLElement,
		overlayParent: HTMLElement,
		getSessionId?: () => string | undefined,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IConversationRosterService private readonly roster: IConversationRosterService,
		@IDialogService private readonly dialogService: IDialogService,
	) {
		super();
		this.getSessionId = getSessionId;

		this.element = append(buttonParent, $(`.${conversationLensSnapshotsButtonClass}`));
		this.button = this._register(new Button(this.element, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: conversationLensSessionBarSnapshotsTitle,
		}));
		this.button.icon = Codicon.layers;
		this.button.label = conversationLensSessionBarSnapshots;
		this.button.element.classList.add('conversation-lens-snapshots-button');
		this.button.element.setAttribute('aria-expanded', 'false');
		this.button.element.setAttribute('aria-haspopup', 'dialog');
		this._register(this.button.onDidClick(() => this.toggle()));

		this.overlayElement = append(overlayParent, $(`.${conversationLensSnapshotsOverlayClass}`));
		this.overlayElement.hidden = true;
		this.overlayElement.tabIndex = -1;
		this.overlayElement.setAttribute('role', 'dialog');
		this.overlayElement.setAttribute('aria-modal', 'true');
		this.overlayElement.setAttribute('aria-label', conversationLensSessionBarSnapshotsTitle);

		const panel = append(this.overlayElement, $('.conversation-lens-snapshots-panel'));
		const header = append(panel, $('.conversation-lens-snapshots-header'));
		const title = append(header, $('h2.conversation-lens-snapshots-title'));
		title.textContent = conversationLensSessionBarSnapshotsTitle;
		const closeContainer = append(header, $('.conversation-lens-snapshots-close'));
		const closeButton = this._register(new Button(closeContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: conversationLensSessionBarSnapshotsClose,
		}));
		closeButton.icon = Codicon.close;
		this._register(closeButton.onDidClick(() => this.close()));

		this.body = append(panel, $('.conversation-lens-snapshots-body'));
		this.writeStatus = append(panel, $(`.${conversationLensSnapshotsWriteStatusClass}`));
		this.writeStatus.setAttribute('role', 'status');
		this.writeStatus.hidden = true;

		this._register(addDisposableListener(this.overlayElement, 'keydown', e => {
			if (handleConversationOverlayTab(this.overlayElement, e)) {
				return;
			}
			if (e.keyCode === KeyCode.Escape) {
				e.preventDefault();
				e.stopPropagation();
				this.close();
			}
		}));
		this._register(this.connection.onDidChangeConnection(() => {
			if (this.open) {
				void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
			}
		}));
		this._register(this.roster.onDidChangeActiveSession(() => {
			if (this.open) {
				void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
			}
		}));
		this._register(this.roster.onDidChangeEngineConnection(() => {
			if (this.open) {
				void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
			}
		}));
		this._register(this.roster.onDidChangeSession(() => {
			if (this.open && this.paintedLiveSnapshots && this.isKeepLeftoverListFailWrite()) {
				this.disableLeftoverWriteButtons();
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

	setOnWillShow(handler: () => void): void {
		this.onWillShow = handler;
	}

	show(): void {
		this.onWillShow?.();
		this.open = true;
		this.overlayElement.hidden = false;
		this.button.element.setAttribute('aria-expanded', 'true');
		this.overlayElement.focus();
		void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
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

	private keepLeftoverCatalogForPairingHold(hadLiveCatalog: boolean): boolean {
		return hadLiveCatalog && isConversationPairingHold(this.connection);
	}

	/** KEEP leftover list-fail (D449/D456/D458): connected but roster not ready is not a live write surface. */
	private isKeepLeftoverListFailWrite(): boolean {
		return this.roster.isEngineConnected()
			&& this.roster.isEngineSessionReady?.() === false;
	}

	/** Catalog leftover contract: list-fail leftover / KEEP leftover is not a live write surface. */
	private isSnapshotWriteLive(): boolean {
		return this.connection.isEngineConnected()
			&& !isConversationPairingHold(this.connection)
			&& !this.leftoverListFailed
			&& !this.isKeepLeftoverListFailWrite();
	}

	private disableLeftoverWriteButtons(): void {
		const writeButtons = this.body.querySelectorAll(
			`.${conversationLensSnapshotsRestoreClass} .monaco-button, .${conversationLensSnapshotsDeleteClass} .monaco-button`,
		);
		for (const button of writeButtons) {
			button.classList.add('disabled');
			button.setAttribute('aria-disabled', 'true');
			button.setAttribute('disabled', 'true');
		}
	}

	private applyPairingHoldLeftoverRefresh(): boolean {
		this.paintListFailed(conversationLensSessionBarSnapshotsUnavailableDisconnected);
		this.disableLeftoverWriteButtons();
		return false;
	}

	private resolveSessionId(): string | undefined {
		return this.getSessionId ? this.getSessionId() : this.roster.getActiveSessionId();
	}

	private applyDisconnectedRefresh(): boolean {
		const sessionId = this.resolveSessionId();
		const hasHook = typeof this.connection.listSnapshots === 'function';
		const disconnectedCopy = this.unavailableCopy(false, hasHook, sessionId);
		if (this.paintedLiveSnapshots && this.keepLeftoverCatalogForPairingHold(true)) {
			return this.applyPairingHoldLeftoverRefresh();
		}
		this.paintStatus(disconnectedCopy);
		return false;
	}

	private async refresh(): Promise<boolean> {
		const generation = ++this.renderGeneration;
		const sessionId = this.resolveSessionId();
		if (this.paintedSnapshotSessionId !== sessionId) {
			this.paintedLiveSnapshots = false;
			this.paintedSnapshotSessionId = sessionId;
		}
		const connected = this.connection.isEngineConnected();
		const listSnapshots = this.connection.listSnapshots;
		const hasHook = typeof listSnapshots === 'function';

		if (isConversationPairingHold(this.connection)) {
			return this.applyDisconnectedRefresh();
		}
		if (!connected) {
			return this.applyDisconnectedRefresh();
		}
		if (!hasHook || !listSnapshots) {
			this.paintListFailed(this.unavailableCopy(connected, hasHook, sessionId));
			return false;
		}
		if (!sessionId) {
			this.paintStatus(this.unavailableCopy(connected, hasHook, sessionId));
			return false;
		}

		if (!this.paintedLiveSnapshots) {
			this.paintStatus(conversationLensSessionBarSnapshotsLoading);
		} else {
			this.paintWriteStatus(undefined);
			this.removeBodyStatus();
		}
		try {
			const result = await listSnapshots.call(this.connection, { sessionId });
			if (generation !== this.renderGeneration) {
				return false;
			}
			if (isConversationPairingHold(this.connection) || !this.connection.isEngineConnected()) {
				return this.applyDisconnectedRefresh();
			}
			if (sessionId !== this.resolveSessionId()) {
				return false;
			}
			this.leftoverListFailed = false;
			this.paintSnapshots(result.snapshots);
			return true;
		} catch (error) {
			if (generation !== this.renderGeneration) {
				return false;
			}
			if (sessionId !== this.resolveSessionId()) {
				return false;
			}
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.leftoverListFailed = true;
			this.paintListFailed(formatEngineSnapshotFailedCopy(reason));
			// D440: leftover rows stay; Restore/Delete chrome must close after list-fail.
			this.disableLeftoverWriteButtons();
			return false;
		}
	}

	private unavailableCopy(connected: boolean, hasHook: boolean, sessionId: string | undefined): string {
		if (!connected) {
			return conversationLensSessionBarSnapshotsUnavailableDisconnected;
		}
		if (!hasHook) {
			return conversationLensSessionBarSnapshotsUnavailableNoHook;
		}
		if (!sessionId) {
			return conversationLensSessionBarSnapshotsUnavailableNoSession;
		}
		return conversationLensSessionBarSnapshotsUnavailableDisconnected;
	}

	private restoreSnapshot(snapshotId: string): void {
		const sessionId = this.resolveSessionId();
		const restore = this.connection.restoreSnapshot;
		const hasHook = typeof restore === 'function';
		if (!canRestoreEngineSnapshot(this.isSnapshotWriteLive(), hasHook, snapshotId, sessionId) || !restore || !sessionId) {
			return;
		}
		void this.restoreThenRefreshList(restore, sessionId, snapshotId).catch(onUnexpectedError).catch(onUnexpectedError);
	}

	private async restoreThenRefreshList(
		restore: NonNullable<IUniverseAgentConnection['restoreSnapshot']>,
		sessionId: string,
		snapshotId: string,
	): Promise<void> {
		try {
			const result = await restore.call(this.connection, { sessionId, snapshotId });
			if (!result.ok) {
				this.paintWriteStatus(formatEngineSnapshotRestoreFailedCopy(result.message ?? ''), 'error');
				return;
			}
		} catch (error) {
			this.paintWriteStatus(formatEngineSnapshotRestoreFailedCopy(snapshotWriteFailureReason(error)), 'error');
			return;
		}
		if (!this.open) {
			return;
		}
		this.paintWriteStatus(ENGINE_SNAPSHOT_RESTORE_SUCCESS_COPY, 'success');
		const listed = await this.refresh();
		if (listed) {
			this.paintWriteStatus(ENGINE_SNAPSHOT_RESTORE_SUCCESS_COPY, 'success');
		}
	}

	private async deleteSnapshot(snapshot: UniverseAgentSessionSnapshotInfo): Promise<void> {
		if (!this.canSendDelete(snapshot.id)) {
			return;
		}
		const label = snapshot.title.trim() || snapshot.id;
		const confirmed = await this.dialogService.confirm({
			type: 'warning',
			message: localize('conversationLens.sessionBarSnapshotsDeleteConfirm', "Delete snapshot \"{0}\"?", label),
			detail: localize('conversationLens.sessionBarSnapshotsDeleteConfirmDetail', "This engine checkpoint will be removed. This cannot be undone."),
			primaryButton: conversationLensSessionBarSnapshotsDelete,
		});
		if (!confirmed.confirmed) {
			return;
		}
		const sessionId = this.resolveSessionId();
		const remove = this.connection.deleteSnapshot;
		if (!this.canSendDelete(snapshot.id) || !remove || !sessionId) {
			return;
		}
		void this.deleteThenRefreshList(remove, sessionId, snapshot.id).catch(onUnexpectedError).catch(onUnexpectedError);
	}

	private async deleteThenRefreshList(
		remove: NonNullable<IUniverseAgentConnection['deleteSnapshot']>,
		sessionId: string,
		snapshotId: string,
	): Promise<void> {
		try {
			const result = await remove.call(this.connection, { sessionId, snapshotId });
			if (!result.ok) {
				this.paintWriteStatus(formatEngineSnapshotDeleteFailedCopy(result.message ?? ''), 'error');
				return;
			}
		} catch (error) {
			this.paintWriteStatus(formatEngineSnapshotDeleteFailedCopy(snapshotWriteFailureReason(error)), 'error');
			return;
		}
		if (!this.open) {
			return;
		}
		this.paintWriteStatus(ENGINE_SNAPSHOT_DELETE_SUCCESS_COPY, 'success');
		const listed = await this.refresh();
		if (listed) {
			this.paintWriteStatus(ENGINE_SNAPSHOT_DELETE_SUCCESS_COPY, 'success');
		}
	}

	private canSendDelete(snapshotId: string): boolean {
		const sessionId = this.resolveSessionId();
		const hasHook = typeof this.connection.deleteSnapshot === 'function';
		return canDeleteEngineSnapshot(this.isSnapshotWriteLive(), hasHook, snapshotId, sessionId);
	}

	private paintWriteStatus(text: string | undefined, tone: 'neutral' | 'success' | 'error' = 'neutral'): void {
		if (!text) {
			writeStatus(this.writeStatus, '');
			this.writeStatus.hidden = true;
			return;
		}
		writeStatus(this.writeStatus, text, tone);
		this.writeStatus.hidden = false;
	}

	private paintStatus(text: string): void {
		this.paintedLiveSnapshots = false;
		this.paintWriteStatus(undefined);
		this.rowDisposables.clear();
		reset(this.body);
		const status = append(this.body, $('.conversation-lens-snapshots-status'));
		status.setAttribute('role', 'status');
		status.textContent = text;
	}

	private paintListFailed(text: string): void {
		this.paintWriteStatus(undefined);
		if (!this.paintedLiveSnapshots) {
			this.paintStatus(text);
			return;
		}
		this.removeBodyStatus();
		const status = append(this.body, $('.conversation-lens-snapshots-status'));
		status.setAttribute('role', 'status');
		status.textContent = text;
	}

	private removeBodyStatus(): void {
		for (const el of [...this.body.querySelectorAll('.conversation-lens-snapshots-status')]) {
			el.remove();
		}
	}

	private paintSnapshots(snapshots: readonly UniverseAgentSessionSnapshotInfo[]): void {
		this.leftoverListFailed = false;
		this.paintWriteStatus(undefined);
		this.rowDisposables.clear();
		reset(this.body);
		if (snapshots.length === 0) {
			this.paintStatus(conversationLensSessionBarSnapshotsEmpty);
			return;
		}

		this.paintedLiveSnapshots = true;
		const list = append(this.body, $('.conversation-lens-snapshots-list'));
		list.setAttribute('role', 'list');
		for (const snapshot of snapshots) {
			const row = append(list, $(`.${conversationLensSnapshotsRowClass}`));
			row.setAttribute('role', 'listitem');
			row.setAttribute('data-snapshot-id', snapshot.id);

			const id = append(row, $('.conversation-lens-snapshots-id'));
			id.textContent = snapshot.id;

			const title = append(row, $('.conversation-lens-snapshots-title-text'));
			title.textContent = snapshot.title;

			const created = append(row, $('.conversation-lens-snapshots-created-at'));
			created.textContent = formatEngineSnapshotCreatedAt(snapshot.createdAt);
			if (snapshot.createdAt !== undefined) {
				created.setAttribute('data-created-at', String(snapshot.createdAt));
			}

			const turns = append(row, $('.conversation-lens-snapshots-turn-count'));
			turns.textContent = snapshot.turnCount === undefined ? '—' : String(snapshot.turnCount);
			if (snapshot.turnCount !== undefined) {
				turns.setAttribute('data-turn-count', String(snapshot.turnCount));
			}

			const sessionId = this.resolveSessionId();
			const writeLive = this.isSnapshotWriteLive();
			const canRestore = canRestoreEngineSnapshot(
				writeLive,
				typeof this.connection.restoreSnapshot === 'function',
				snapshot.id,
				sessionId,
			);
			const canDelete = canDeleteEngineSnapshot(
				writeLive,
				typeof this.connection.deleteSnapshot === 'function',
				snapshot.id,
				sessionId,
			);
			const restoreUnavailable = this.unavailableCopy(writeLive, typeof this.connection.restoreSnapshot === 'function', sessionId);
			const deleteUnavailable = this.unavailableCopy(writeLive, typeof this.connection.deleteSnapshot === 'function', sessionId);

			const restoreContainer = append(row, $(`.${conversationLensSnapshotsRestoreClass}`));
			const restoreButton = this.rowDisposables.add(new Button(restoreContainer, {
				...defaultButtonStyles,
				supportIcons: true,
				small: true,
				secondary: true,
				disabled: !canRestore,
				title: canRestore ? conversationLensSessionBarSnapshotsRestore : restoreUnavailable,
				ariaLabel: canRestore
					? conversationLensSessionBarSnapshotsRestore
					: `${conversationLensSessionBarSnapshotsRestore} — ${restoreUnavailable}`,
			}));
			restoreButton.icon = Codicon.discard;
			restoreButton.label = conversationLensSessionBarSnapshotsRestore;
			restoreButton.enabled = canRestore;
			this.rowDisposables.add(restoreButton.onDidClick(() => this.restoreSnapshot(snapshot.id)));

			const deleteContainer = append(row, $(`.${conversationLensSnapshotsDeleteClass}`));
			const deleteButton = this.rowDisposables.add(new Button(deleteContainer, {
				...defaultButtonStyles,
				supportIcons: true,
				small: true,
				secondary: true,
				disabled: !canDelete,
				title: canDelete ? conversationLensSessionBarSnapshotsDelete : deleteUnavailable,
				ariaLabel: canDelete
					? conversationLensSessionBarSnapshotsDelete
					: `${conversationLensSessionBarSnapshotsDelete} — ${deleteUnavailable}`,
			}));
			deleteButton.icon = Codicon.trash;
			deleteButton.label = conversationLensSessionBarSnapshotsDelete;
			deleteButton.enabled = canDelete;
			this.rowDisposables.add(deleteButton.onDidClick(() => void this.deleteSnapshot(snapshot).catch(onUnexpectedError).catch(onUnexpectedError)));
		}
	}
}
