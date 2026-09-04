/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, reset } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
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
import { IConversationRosterService } from './conversationStubService.js';

export const conversationLensSnapshotsButtonClass = 'conversation-lens-session-snapshots';
export const conversationLensSnapshotsOverlayClass = 'conversation-lens-snapshots-overlay';
export const conversationLensSnapshotsRowClass = 'conversation-lens-snapshots-row';
export const conversationLensSnapshotsRestoreClass = 'conversation-lens-snapshots-restore';
export const conversationLensSnapshotsDeleteClass = 'conversation-lens-snapshots-delete';

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

/**
 * SessionBar extra control + overlay for AgentService.ListSnapshots.
 * Distinct from SessionBar History ({@link ConversationTrajectoryList} turn index).
 * Restore on rows calls {@link IUniverseAgentConnection.restoreSnapshot};
 * a successful restore refreshes via {@link IUniverseAgentConnection.listSnapshots}
 * and keeps the overlay open. Failed restore / no send does not refresh.
 * Delete on rows confirms then calls {@link IUniverseAgentConnection.deleteSnapshot};
 * a confirmed successful delete refreshes via {@link IUniverseAgentConnection.listSnapshots}
 * and keeps the overlay open. Cancel / failed delete / no send does not refresh.
 * no Create.
 */
export class ConversationEngineSnapshotsList extends Disposable {

	readonly element: HTMLElement;
	readonly overlayElement: HTMLElement;

	private readonly button: Button;
	private readonly body: HTMLElement;
	private readonly rowDisposables = this._register(new DisposableStore());
	private open = false;
	private renderGeneration = 0;

	constructor(
		buttonParent: HTMLElement,
		overlayParent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IConversationRosterService private readonly roster: IConversationRosterService,
		@IDialogService private readonly dialogService: IDialogService,
	) {
		super();

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
		const sessionId = this.roster.getActiveSessionId();
		const connected = this.connection.isEngineConnected();
		const listSnapshots = this.connection.listSnapshots;
		const hasHook = typeof listSnapshots === 'function';

		if (!canRequestEngineSnapshots(connected, hasHook, sessionId) || !listSnapshots) {
			this.paintStatus(this.unavailableCopy(connected, hasHook, sessionId));
			return;
		}

		this.paintStatus(conversationLensSessionBarSnapshotsLoading);
		try {
			const result = await listSnapshots.call(this.connection, { sessionId });
			if (generation !== this.renderGeneration) {
				return;
			}
			this.paintSnapshots(result.snapshots);
		} catch (error) {
			if (generation !== this.renderGeneration) {
				return;
			}
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.paintStatus(formatEngineSnapshotFailedCopy(reason));
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
		const sessionId = this.roster.getActiveSessionId();
		const connected = this.connection.isEngineConnected();
		const restore = this.connection.restoreSnapshot;
		const hasHook = typeof restore === 'function';
		if (!canRestoreEngineSnapshot(connected, hasHook, snapshotId, sessionId) || !restore || !sessionId) {
			return;
		}
		void this.restoreThenRefreshList(restore, sessionId, snapshotId);
	}

	private async restoreThenRefreshList(
		restore: NonNullable<IUniverseAgentConnection['restoreSnapshot']>,
		sessionId: string,
		snapshotId: string,
	): Promise<void> {
		try {
			const result = await restore.call(this.connection, { sessionId, snapshotId });
			if (!result.ok) {
				return;
			}
		} catch {
			return;
		}
		if (!this.open) {
			return;
		}
		await this.refresh();
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
		const sessionId = this.roster.getActiveSessionId();
		const remove = this.connection.deleteSnapshot;
		if (!this.canSendDelete(snapshot.id) || !remove || !sessionId) {
			return;
		}
		void this.deleteThenRefreshList(remove, sessionId, snapshot.id);
	}

	private async deleteThenRefreshList(
		remove: NonNullable<IUniverseAgentConnection['deleteSnapshot']>,
		sessionId: string,
		snapshotId: string,
	): Promise<void> {
		try {
			const result = await remove.call(this.connection, { sessionId, snapshotId });
			if (!result.ok) {
				return;
			}
		} catch {
			return;
		}
		if (!this.open) {
			return;
		}
		await this.refresh();
	}

	private canSendDelete(snapshotId: string): boolean {
		const sessionId = this.roster.getActiveSessionId();
		const connected = this.connection.isEngineConnected();
		const hasHook = typeof this.connection.deleteSnapshot === 'function';
		return canDeleteEngineSnapshot(connected, hasHook, snapshotId, sessionId);
	}

	private paintStatus(text: string): void {
		this.rowDisposables.clear();
		reset(this.body);
		const status = append(this.body, $('.conversation-lens-snapshots-status'));
		status.setAttribute('role', 'status');
		status.textContent = text;
	}

	private paintSnapshots(snapshots: readonly UniverseAgentSessionSnapshotInfo[]): void {
		this.rowDisposables.clear();
		reset(this.body);
		if (snapshots.length === 0) {
			this.paintStatus(conversationLensSessionBarSnapshotsEmpty);
			return;
		}

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

			const restoreContainer = append(row, $(`.${conversationLensSnapshotsRestoreClass}`));
			const restoreButton = this.rowDisposables.add(new Button(restoreContainer, {
				...defaultButtonStyles,
				supportIcons: true,
				small: true,
				secondary: true,
				title: conversationLensSessionBarSnapshotsRestore,
				ariaLabel: conversationLensSessionBarSnapshotsRestore,
			}));
			restoreButton.icon = Codicon.discard;
			restoreButton.label = conversationLensSessionBarSnapshotsRestore;
			this.rowDisposables.add(restoreButton.onDidClick(() => this.restoreSnapshot(snapshot.id)));

			const deleteContainer = append(row, $(`.${conversationLensSnapshotsDeleteClass}`));
			const deleteButton = this.rowDisposables.add(new Button(deleteContainer, {
				...defaultButtonStyles,
				supportIcons: true,
				small: true,
				secondary: true,
				title: conversationLensSessionBarSnapshotsDelete,
				ariaLabel: conversationLensSessionBarSnapshotsDelete,
			}));
			deleteButton.icon = Codicon.trash;
			deleteButton.label = conversationLensSessionBarSnapshotsDelete;
			this.rowDisposables.add(deleteButton.onDidClick(() => void this.deleteSnapshot(snapshot)));
		}
	}
}
