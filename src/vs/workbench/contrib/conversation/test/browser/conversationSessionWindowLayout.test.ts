/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../../../base/browser/window.js';
import { timeout } from '../../../../../base/common/async.js';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { IConversationPartService } from '../../../../browser/parts/conversation/conversationPart.js';
import { IConversationEditorPart, IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { CONVERSATION_SESSION_WINDOW_LAYOUT_KEY, ConversationSessionWindowService } from '../../browser/conversationSessionWindowService.js';
import { ConversationStubService } from '../../browser/conversationStubService.js';
import { ConversationEditorPaneId } from '../../common/conversationSessionWindow.js';

class QuietRosterService extends ConversationStubService {
	seedSessionQuietly(): string {
		const previous = this.model.getActiveSessionId();
		const sessionId = this.model.createSession();
		this.model.switchSession(previous);
		this._onDidChangeSession.fire(sessionId);
		return sessionId;
	}
}

suite('Conversation session window layout restore', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function openStoredWindow(rosterService: QuietRosterService, storageService: TestStorageService) {
		const gridHost = mainWindow.document.createElement('div');
		mainWindow.document.body.appendChild(gridHost);
		store.add({ dispose: () => gridHost.remove() });
		const conversationParts: IConversationEditorPart[] = [];
		const editorGroupsService = {
			createConversationEditorPart: (_parent: unknown, sessionKey: string) => {
				const part = {
					sessionKey,
					whenReady: Promise.resolve(),
					activeGroup: { focus: () => { }, activeEditorPane: { getId: () => ConversationEditorPaneId } },
					leafVisible: true,
					leafPrimary: false,
					setLeafHostState: () => { },
				} as unknown as IConversationEditorPart;
				conversationParts.push(part);
				return part;
			},
			disposeConversationEditorPart: (sessionKey: string) => {
				const index = conversationParts.findIndex(part => part.sessionKey === sessionKey);
				if (index >= 0) {
					conversationParts.splice(index, 1);
				}
			},
			setFocusedConversationLeaf: () => { },
			getFocusedConversationLeaf: () => undefined,
			get conversationParts() {
				return conversationParts;
			},
		} as unknown as IEditorGroupsService;
		return store.add(new ConversationSessionWindowService(
			{
				onDidCreateSlots: Event.None,
				onDidFocus: Event.None,
				getSlots: () => ({ sessionBar: mainWindow.document.createElement('div'), sessionWindowGrid: gridHost, editorPartHost: undefined }),
				setFocusedLeafContainer: () => { },
				focus: () => { },
			} as unknown as IConversationPartService,
			editorGroupsService,
			rosterService,
			new NullLogService(),
			{ error: () => { } } as unknown as INotificationService,
			storageService,
		));
	}

	test('restart restores the visible primary and beside leaves and refocuses the active session', async () => {
		const storageService = store.add(new TestStorageService());
		const rosterService = store.add(new QuietRosterService());
		const first = openStoredWindow(rosterService, storageService);
		await timeout(0);
		const primaryId = rosterService.getActiveSessionId();
		const secondaryId = rosterService.seedSessionQuietly();
		await first.ensurePrimaryWindow(primaryId);
		await first.openSessionBeside(secondaryId);
		rosterService.switchSession(secondaryId);
		await timeout(0);
		first.dispose();

		const second = openStoredWindow(rosterService, storageService);
		await timeout(0);

		assert.strictEqual(second.getPrimarySessionKey(), primaryId);
		assert.deepStrictEqual([...second.getVisibleSessionKeys()], [primaryId, secondaryId]);
		assert.strictEqual(second.getFocusedLeafSessionKey(), secondaryId);
		assert.strictEqual(rosterService.getActiveSessionId(), secondaryId);
		const stored = JSON.parse(storageService.get(CONVERSATION_SESSION_WINDOW_LAYOUT_KEY, StorageScope.WORKSPACE) ?? '{}') as { primarySessionKey?: string; visibleSessionKeys?: string[] };
		assert.deepStrictEqual(stored.visibleSessionKeys, [primaryId, secondaryId]);
		assert.strictEqual(stored.primarySessionKey, primaryId);
	});

	test('restart drops a saved beside leaf that is no longer on the roster', async () => {
		const storageService = store.add(new TestStorageService());
		const rosterService = store.add(new QuietRosterService());
		const primaryId = rosterService.getActiveSessionId();
		storageService.store(CONVERSATION_SESSION_WINDOW_LAYOUT_KEY, JSON.stringify({
			version: 1,
			primarySessionKey: primaryId,
			visibleSessionKeys: [primaryId, 'missing-beside'],
		}), StorageScope.WORKSPACE, StorageTarget.MACHINE);

		const sessionWindowService = openStoredWindow(rosterService, storageService);
		await timeout(0);

		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), primaryId);
		assert.deepStrictEqual([...sessionWindowService.getVisibleSessionKeys()], [primaryId]);
		assert.strictEqual(sessionWindowService.getLeafSlots('missing-beside'), undefined);
	});
});
