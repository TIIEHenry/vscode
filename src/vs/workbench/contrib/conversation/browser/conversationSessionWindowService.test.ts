/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { NullLogService } from '../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IConversationPartService, IConversationPartWindowSlots } from '../../../browser/parts/conversation/conversationPart.js';
import { IConversationEditorPart, IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { ConversationEditorPaneId, conversationSessionLeafPrimaryClass, conversationSessionLeafSecondaryClass } from '../common/conversationSessionWindow.js';
import { ConversationSessionWindowService } from './conversationSessionWindowService.js';
import { ConversationStubService } from './conversationStubService.js';

class QuietRosterService extends ConversationStubService {
	seedSessionQuietly(): string {
		const previous = this.model.getActiveSessionId();
		const sessionId = this.model.createSession();
		this.model.switchSession(previous);
		this._onDidChangeSession.fire(sessionId);
		return sessionId;
	}

	fireDeletedSession(sessionId: string): void {
		this._onDidDeleteSession.fire(sessionId);
	}
}

suite('ConversationSessionWindowService', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('onDidDeleteSession promotes surviving leaf when primary window is deleted', async () => {
		const rosterService = store.add(new QuietRosterService());
		const gridHost = document.createElement('div');
		document.body.appendChild(gridHost);
		store.add({ dispose: () => gridHost.remove() });

		const onDidCreateSlots = new Emitter<IConversationPartWindowSlots>();
		store.add(onDidCreateSlots);

		const conversationParts: IConversationEditorPart[] = [];
		const editorGroupsService = {
			createConversationEditorPart: (_parent: unknown, sessionKey: string) => {
				const part = {
					sessionKey,
					whenReady: Promise.resolve(),
					activeGroup: { focus: () => { }, activeEditorPane: { getId: () => ConversationEditorPaneId } },
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

		const sessionWindowService = store.add(new ConversationSessionWindowService(
			{
				onDidCreateSlots: onDidCreateSlots.event,
				onDidFocus: Event.None,
				getSlots: () => ({ sessionBar: document.createElement('div'), sessionWindowGrid: gridHost, editorPartHost: undefined }),
				setFocusedLeafContainer: () => { },
				focus: () => { },
			} as unknown as IConversationPartService,
			editorGroupsService,
			rosterService,
			new NullLogService(),
			{ error: () => { } } as INotificationService,
		));

		await timeout(0);

		const primaryId = rosterService.getActiveSessionId();
		const secondaryId = rosterService.seedSessionQuietly();
		await sessionWindowService.ensurePrimaryWindow(primaryId);
		await sessionWindowService.openSessionBeside(secondaryId);

		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), primaryId);
		const primaryLeaf = sessionWindowService.getLeafSlots(primaryId)!;
		const secondaryLeaf = sessionWindowService.getLeafSlots(secondaryId)!;
		assert.ok(primaryLeaf.container.classList.contains(conversationSessionLeafPrimaryClass));
		assert.ok(secondaryLeaf.container.classList.contains(conversationSessionLeafSecondaryClass));

		rosterService.fireDeletedSession(primaryId);

		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), secondaryId);
		assert.ok(!sessionWindowService.getLeafSlots(primaryId));
		assert.ok(secondaryLeaf.container.classList.contains(conversationSessionLeafPrimaryClass));
		assert.ok(!secondaryLeaf.container.classList.contains(conversationSessionLeafSecondaryClass));
	});
});
