/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { localize, localize2 } from '../../../../nls.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { isDefaultCodeWindow } from '../../chat/browser/chatShellRouting.js';
import { isConversationPairingHold, type IConversationPairingHoldSource } from './conversationSessionStatus.js';
import { IConversationRosterService } from './conversationStubService.js';

export const CONVERSATION_CREATE_SNAPSHOT_COMMAND_ID = 'workbench.action.conversation.createSnapshot';

export const CONVERSATION_CREATE_SNAPSHOT_DEFAULT_TITLE = localize('conversationCreateSnapshotDefaultTitle', "Snapshot");

export interface ConversationCreateSnapshotArgs {
	readonly title?: string;
	readonly description?: string;
}

/**
 * Honest gate for the Conversation Create Snapshot action.
 * Disconnected / no hook / empty sessionId → do not send.
 */
export function canCreateEngineSnapshot(
	connected: boolean,
	hasCreateSnapshot: boolean,
	sessionId: string | undefined,
): boolean {
	return connected && hasCreateSnapshot && !!sessionId?.trim();
}

/** KEEP leftover list-fail (D449/D456/D458): connected but roster not ready is not a live write surface. */
function isKeepLeftoverCreateSnapshotWrite(roster: IConversationRosterService | undefined): boolean {
	return !!roster
		&& roster.isEngineConnected()
		&& roster.isEngineSessionReady?.() === false;
}

/**
 * D310 F1 / D458 write gate: pairing-hold leftover, leftover-looks-live
 * (`connected===true` + pairingPending), and KEEP leftover list-fail
 * (`connected===true` + pairingPending===false + `isEngineSessionReady()===false`)
 * must not prompt or call `roster.createSnapshot`. Pairing-hold is checked
 * first so `testEngineConnected===true` cannot take the live path.
 */
export function shouldHoldCreateSnapshotWrite(
	ua: IConversationPairingHoldSource | undefined,
	roster?: IConversationRosterService,
): boolean {
	return isConversationPairingHold(ua) || isKeepLeftoverCreateSnapshotWrite(roster);
}

/**
 * Omitted title uses the default. Cleared / empty title is kept as-is
 * (match transport). Callers must not invoke this for a cancelled prompt.
 */
export function resolveCreateSnapshotTitle(input: string | undefined): string {
	return input !== undefined ? input : CONVERSATION_CREATE_SNAPSHOT_DEFAULT_TITLE;
}

export const conversationCreateSnapshotFailedCopy = localize(
	'conversationCreateSnapshotFailed',
	"Could not create snapshot.",
);

export const conversationCreateSnapshotDisconnectedCopy = localize(
	'conversationCreateSnapshotDisconnected',
	"Could not create snapshot — engine disconnected.",
);

/**
 * D110 mapping for Create Snapshot: true stays silent; false → failed,
 * or engine_disconnected when `!connected && history`.
 */
export function notifyCreateSnapshotRejected(
	created: boolean,
	connected: boolean,
	history: boolean,
	notificationService: Pick<INotificationService, 'error'>,
): boolean {
	if (created) {
		return true;
	}
	notificationService.error(
		!connected && history
			? conversationCreateSnapshotDisconnectedCopy
			: conversationCreateSnapshotFailedCopy,
	);
	return false;
}

/** Silent gate used to skip the unary. Disconnected + history (incl. pairing-hold leftover) is not silent. */
export function notifyCreateSnapshotUnavailable(
	connected: boolean,
	history: boolean,
	notificationService: Pick<INotificationService, 'error'>,
): void {
	if (!connected && history) {
		notifyCreateSnapshotRejected(false, false, true, notificationService);
	}
}

/**
 * D371 / D458 post-await write gate. After the title prompt resolves (cancel
 * already returned), leftover-looks-live (`isEngineConnected()===true` +
 * pairingPending) and KEEP leftover list-fail (`isEngineSessionReady()===false`)
 * must notice and not invoke `create`. Pairing-hold is checked first so
 * looks-live cannot take the live path. Returns whether the snapshot was
 * created; `undefined` when the write is held.
 */
export function tryCreateSnapshotAfterPrompt(
	ua: IConversationPairingHoldSource | undefined,
	history: boolean,
	notificationService: Pick<INotificationService, 'error'>,
	create: () => boolean,
	connected: boolean,
	roster?: IConversationRosterService,
): boolean | undefined {
	if (shouldHoldCreateSnapshotWrite(ua, roster)) {
		notifyCreateSnapshotUnavailable(false, history, notificationService);
		return undefined;
	}
	return notifyCreateSnapshotRejected(create(), connected, history, notificationService);
}

/**
 * Connected user Create Snapshot → AgentService.CreateSnapshot for the
 * active session. Does not list, restore, or delete snapshots, and does
 * not replace SessionBar History (GetHistory). Disconnected / no hook / empty
 * sessionId / cancelled prompt no-op. Pairing-hold leftover (including
 * leftover-looks-live) and KEEP leftover list-fail (D458) are checked
 * before `isEngineConnected()` and show the disconnected notice. After the
 * title prompt resolves, the same hold is checked again (D371/D458) so
 * leftover-looks-live / KEEP leftover in-flight cannot create.
 * `!isEngineConnected()` + history (true disconnect) also notices instead
 * of a silent return. `createSnapshot` false → notice (D110 failed /
 * engine_disconnected); true stays silent.
 */
registerAction2(class ConversationCreateSnapshotAction extends Action2 {

	constructor() {
		super({
			id: CONVERSATION_CREATE_SNAPSHOT_COMMAND_ID,
			title: localize2('conversationCreateSnapshot', 'Create Conversation Snapshot'),
			category: localize2('conversation', 'Conversation'),
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor, args?: ConversationCreateSnapshotArgs): Promise<void> {
		if (!isDefaultCodeWindow(accessor)) {
			return;
		}
		const roster = accessor.get(IConversationRosterService);
		const connection = accessor.get(IUniverseAgentConnection);
		const notificationService = accessor.get(INotificationService);
		const quickInputService = accessor.get(IQuickInputService);
		const sessionId = roster.getActiveSessionId();
		if (shouldHoldCreateSnapshotWrite(connection, roster)) {
			notifyCreateSnapshotUnavailable(false, roster.hasEngineConnectionHistory(), notificationService);
			return;
		}
		if (!canCreateEngineSnapshot(roster.isEngineConnected(), !!connection.createSnapshot, sessionId)) {
			notifyCreateSnapshotUnavailable(roster.isEngineConnected(), roster.hasEngineConnectionHistory(), notificationService);
			return;
		}
		let title = args?.title;
		if (title === undefined) {
			const next = await quickInputService.input({
				title: localize('conversationCreateSnapshotPromptTitle', "Create snapshot"),
				prompt: localize('conversationCreateSnapshotPrompt', "Snapshot title"),
				value: CONVERSATION_CREATE_SNAPSHOT_DEFAULT_TITLE,
			});
			if (next === undefined) {
				return;
			}
			title = resolveCreateSnapshotTitle(next);
		}
		tryCreateSnapshotAfterPrompt(
			connection,
			roster.hasEngineConnectionHistory(),
			notificationService,
			() => roster.createSnapshot(sessionId, {
				title,
				...(args?.description !== undefined ? { description: args.description } : {}),
			}),
			roster.isEngineConnected(),
			roster,
		);
	}
});
