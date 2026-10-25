/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { Emitter, Event } from '../../../../base/common/event.js';
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

/** Roster row is already gone, but onDidDeleteSession has not fired. */
class OptimisticDeleteRoster extends QuietRosterService {
	private readonly omittedIds = new Set<string>();
	private projectedActiveId: string | undefined;

	omit(sessionId: string): void {
		this.omittedIds.add(sessionId);
	}

	restore(sessionId: string): void {
		this.omittedIds.delete(sessionId);
	}

	override getSessions() {
		return super.getSessions().filter(session => !this.omittedIds.has(session.id));
	}

	override getActiveSessionId(): string {
		const projected = this.projectedActiveId;
		if (projected && !this.omittedIds.has(projected) && super.getSessions().some(session => session.id === projected)) {
			return projected;
		}
		return super.getActiveSessionId();
	}

	projectActive(sessionId: string): void {
		this.projectedActiveId = sessionId;
		this._onDidChangeActiveSession.fire(sessionId);
	}
}

/** List refresh dropped ids. Distinct from an in-flight delete, which must not reveal yet. */
class CatalogPruneRoster extends OptimisticDeleteRoster {
	private readonly _onDidPruneEngineSessions = this._register(new Emitter<readonly string[]>());
	override readonly onDidPruneEngineSessions = this._onDidPruneEngineSessions.event;

	prune(sessionIds: readonly string[]): void {
		this._onDidPruneEngineSessions.fire(sessionIds);
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
			{ error: () => { } } as unknown as INotificationService,
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

	test('onDidDeleteSession clears focused leaf when last window is deleted', async () => {
		const rosterService = store.add(new QuietRosterService());
		const gridHost = document.createElement('div');
		document.body.appendChild(gridHost);
		store.add({ dispose: () => gridHost.remove() });

		let focusedLeafContainer: HTMLElement | undefined;
		let focusedConversationLeaf: string | undefined = 'stale';

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
			setFocusedConversationLeaf: (sessionKey: string | undefined) => {
				focusedConversationLeaf = sessionKey;
			},
			getFocusedConversationLeaf: () => focusedConversationLeaf,
			get conversationParts() {
				return conversationParts;
			},
		} as unknown as IEditorGroupsService;

		const sessionWindowService = store.add(new ConversationSessionWindowService(
			{
				onDidCreateSlots: Event.None,
				onDidFocus: Event.None,
				getSlots: () => ({ sessionBar: document.createElement('div'), sessionWindowGrid: gridHost, editorPartHost: undefined }),
				setFocusedLeafContainer: (container: HTMLElement | undefined) => {
					focusedLeafContainer = container;
				},
				focus: () => { },
			} as unknown as IConversationPartService,
			editorGroupsService,
			rosterService,
			new NullLogService(),
			{ error: () => { } } as unknown as INotificationService,
		));

		await timeout(0);

		const sessionId = rosterService.getActiveSessionId();
		await sessionWindowService.ensurePrimaryWindow(sessionId);

		const leaf = sessionWindowService.getLeafSlots(sessionId)!;
		assert.strictEqual(focusedLeafContainer, leaf.container);
		assert.strictEqual(focusedConversationLeaf, sessionId);

		rosterService.fireDeletedSession(sessionId);

		assert.strictEqual(sessionWindowService.getLeafSlots(sessionId), undefined);
		assert.strictEqual(focusedLeafContainer, undefined);
		assert.strictEqual(focusedConversationLeaf, undefined);
	});

	test('stalled primary bootstrap does not write primary back onto a session deleted during whenReady', async () => {
		const rosterService = store.add(new QuietRosterService());
		const firstId = rosterService.getActiveSessionId();
		let releaseFirstReady!: () => void;
		const firstReady = new Promise<void>(resolve => {
			releaseFirstReady = resolve;
		});

		const gridHost = document.createElement('div');
		document.body.appendChild(gridHost);
		store.add({ dispose: () => gridHost.remove() });

		const conversationParts: IConversationEditorPart[] = [];
		const editorGroupsService = {
			createConversationEditorPart: (_parent: unknown, sessionKey: string) => {
				const part = {
					sessionKey,
					whenReady: sessionKey === firstId ? firstReady : Promise.resolve(),
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
				onDidCreateSlots: Event.None,
				onDidFocus: Event.None,
				getSlots: () => ({ sessionBar: document.createElement('div'), sessionWindowGrid: gridHost, editorPartHost: undefined }),
				setFocusedLeafContainer: () => { },
				focus: () => { },
			} as unknown as IConversationPartService,
			editorGroupsService,
			rosterService,
			new NullLogService(),
			{ error: () => { } } as unknown as INotificationService,
		));

		try {
			await timeout(0);
			assert.strictEqual(sessionWindowService.getPrimarySessionKey(), undefined);
			assert.ok(sessionWindowService.getLeafSlots(firstId));

			assert.strictEqual(rosterService.deleteSession(firstId), true);
			const nextId = rosterService.getActiveSessionId();
			assert.notStrictEqual(nextId, firstId);

			await timeout(0);
			assert.strictEqual(sessionWindowService.getPrimarySessionKey(), nextId);
			assert.strictEqual(sessionWindowService.getLeafSlots(firstId), undefined);

			releaseFirstReady();
			await timeout(0);

			assert.strictEqual(sessionWindowService.getPrimarySessionKey(), nextId);
			assert.strictEqual(sessionWindowService.getLeafSlots(firstId), undefined);
			sessionWindowService.hideSessionWindow(nextId);
			assert.strictEqual(sessionWindowService.isSessionWindowVisible(nextId), true);
		} finally {
			releaseFirstReady();
		}
	});

	test('deleting the focused non-primary session drops its leaf and does not open the neighbor beside', async () => {
		const rosterService = store.add(new QuietRosterService());
		const gridHost = document.createElement('div');
		document.body.appendChild(gridHost);
		store.add({ dispose: () => gridHost.remove() });

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
				onDidCreateSlots: Event.None,
				onDidFocus: Event.None,
				getSlots: () => ({ sessionBar: document.createElement('div'), sessionWindowGrid: gridHost, editorPartHost: undefined }),
				setFocusedLeafContainer: () => { },
				focus: () => { },
			} as unknown as IConversationPartService,
			editorGroupsService,
			rosterService,
			new NullLogService(),
			{ error: () => { } } as unknown as INotificationService,
		));

		await timeout(0);

		const primaryId = rosterService.getActiveSessionId();
		const secondaryId = rosterService.seedSessionQuietly();
		const neighborId = rosterService.seedSessionQuietly();
		await sessionWindowService.ensurePrimaryWindow(primaryId);
		await sessionWindowService.openSessionBeside(secondaryId);
		sessionWindowService.getLeafSlots(secondaryId)!.container.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		assert.strictEqual(sessionWindowService.getFocusedLeafSessionKey(), secondaryId);
		assert.strictEqual(rosterService.getActiveSessionId(), secondaryId);

		assert.strictEqual(rosterService.deleteSession(secondaryId), true);
		await timeout(0);

		assert.strictEqual(sessionWindowService.getLeafSlots(secondaryId), undefined);
		assert.strictEqual(sessionWindowService.getLeafSlots(neighborId), undefined);
		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), primaryId);
		assert.strictEqual(sessionWindowService.isSessionWindowVisible(primaryId), true);
		assert.deepStrictEqual(sessionWindowService.getVisibleSessionKeys(), [primaryId]);
	});

	async function openFocusedPrimary(rosterService: OptimisticDeleteRoster) {
		const gridHost = document.createElement('div');
		document.body.appendChild(gridHost);
		store.add({ dispose: () => gridHost.remove() });

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
				onDidCreateSlots: Event.None,
				onDidFocus: Event.None,
				getSlots: () => ({ sessionBar: document.createElement('div'), sessionWindowGrid: gridHost, editorPartHost: undefined }),
				setFocusedLeafContainer: () => { },
				focus: () => { },
			} as unknown as IConversationPartService,
			editorGroupsService,
			rosterService,
			new NullLogService(),
			{ error: () => { } } as unknown as INotificationService,
		));

		await timeout(0);
		const primaryId = rosterService.getActiveSessionId();
		const neighborId = rosterService.seedSessionQuietly();
		await sessionWindowService.ensurePrimaryWindow(primaryId);
		const primaryLeaf = sessionWindowService.getLeafSlots(primaryId);
		assert.ok(primaryLeaf);
		assert.strictEqual(sessionWindowService.getFocusedLeafSessionKey(), primaryId);
		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), primaryId);
		return { sessionWindowService, conversationParts, primaryId, neighborId, primaryLeaf };
	}

	test('optimistic active change while the focused primary is already gone does not reveal a neighbor', async () => {
		const rosterService = store.add(new OptimisticDeleteRoster());
		const { sessionWindowService, conversationParts, primaryId, neighborId, primaryLeaf } = await openFocusedPrimary(rosterService);

		rosterService.omit(primaryId);
		rosterService.projectActive(neighborId);
		await timeout(0);

		assert.strictEqual(sessionWindowService.getLeafSlots(neighborId), undefined);
		assert.ok(!conversationParts.some(part => part.sessionKey === neighborId));
		assert.strictEqual(sessionWindowService.getLeafSlots(primaryId), primaryLeaf);
		assert.deepStrictEqual(sessionWindowService.getVisibleSessionKeys(), [primaryId]);
		assert.strictEqual(sessionWindowService.getAllLeafSessionKeys().length, 1);
	});

	test('catalog prune drops the focused leaf and reveals the surviving active session', async () => {
		const rosterService = store.add(new CatalogPruneRoster());
		const { sessionWindowService, conversationParts, primaryId, neighborId } = await openFocusedPrimary(rosterService);

		rosterService.omit(primaryId);
		rosterService.projectActive(neighborId);
		await timeout(0);
		assert.strictEqual(sessionWindowService.getLeafSlots(neighborId), undefined);
		assert.strictEqual(sessionWindowService.getLeafSlots(primaryId) !== undefined, true);

		rosterService.prune([primaryId]);
		await timeout(0);

		assert.strictEqual(sessionWindowService.getLeafSlots(primaryId), undefined);
		assert.ok(!sessionWindowService.getAllLeafSessionKeys().includes(primaryId));
		assert.ok(!conversationParts.some(part => part.sessionKey === primaryId));
		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), neighborId);
		assert.strictEqual(sessionWindowService.isSessionWindowVisible(neighborId), true);
		assert.deepStrictEqual([...sessionWindowService.getVisibleSessionKeys()], [neighborId]);
		assert.deepStrictEqual(conversationParts.map(part => part.sessionKey), [neighborId]);
	});

	test('onDidDeleteSession after an optimistic primary removal still shows the surviving active session', async () => {
		const rosterService = store.add(new OptimisticDeleteRoster());
		const { sessionWindowService, conversationParts, primaryId, neighborId } = await openFocusedPrimary(rosterService);

		rosterService.omit(primaryId);
		rosterService.projectActive(neighborId);
		await timeout(0);
		assert.strictEqual(sessionWindowService.getLeafSlots(neighborId), undefined);

		rosterService.fireDeletedSession(primaryId);
		await timeout(0);

		assert.strictEqual(sessionWindowService.getLeafSlots(primaryId), undefined);
		assert.ok(!sessionWindowService.getAllLeafSessionKeys().includes(primaryId));
		assert.ok(!conversationParts.some(part => part.sessionKey === primaryId));
		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), neighborId);
		assert.strictEqual(sessionWindowService.isSessionWindowVisible(neighborId), true);
		assert.deepStrictEqual([...sessionWindowService.getVisibleSessionKeys()], [neighborId]);
		assert.deepStrictEqual(conversationParts.map(part => part.sessionKey), [neighborId]);
	});

	test('refused delete never fires onDidDeleteSession and leaves no neighbor leaf', async () => {
		const rosterService = store.add(new OptimisticDeleteRoster());
		const { sessionWindowService, conversationParts, primaryId, neighborId, primaryLeaf } = await openFocusedPrimary(rosterService);

		rosterService.omit(primaryId);
		rosterService.projectActive(neighborId);
		await timeout(0);

		rosterService.restore(primaryId);
		rosterService.projectActive(primaryId);
		await timeout(0);

		assert.strictEqual(sessionWindowService.getLeafSlots(primaryId), primaryLeaf);
		assert.strictEqual(sessionWindowService.getLeafSlots(neighborId), undefined);
		assert.ok(!conversationParts.some(part => part.sessionKey === neighborId));
		assert.strictEqual(sessionWindowService.getFocusedLeafSessionKey(), primaryId);
		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), primaryId);
		assert.deepStrictEqual([...sessionWindowService.getVisibleSessionKeys()], [primaryId]);
		assert.deepStrictEqual(sessionWindowService.getAllLeafSessionKeys(), [primaryId]);
	});
});
