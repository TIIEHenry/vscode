/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { DisposableStore, Disposable } from '../../../../../base/common/lifecycle.js';
import { constObservable, observableValue, type IObservable } from '../../../../../base/common/observable.js';
import { isEqual } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IEditorWillOpenEvent } from '../../../../../workbench/common/editor.js';
import { BrowserEditorInput, type IBeforeDisposeBrowserEditorEvent } from '../../../../../workbench/contrib/browserView/common/browserEditorInput.js';
import { IBrowserViewContextualFilter, IBrowserViewOpenHandler, IBrowserViewWorkbenchService } from '../../../../../workbench/contrib/browserView/common/browserView.js';
import { IEditorGroup, IEditorGroupsService } from '../../../../../workbench/services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../../../workbench/services/editor/common/editorService.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { ChatInteractivity, IChat, ISession, SessionStatus } from '../../../../services/sessions/common/session.js';
import { IActiveSession, ISessionsChangeEvent, ISessionsManagementService } from '../../../../services/sessions/common/sessionsManagement.js';
import { ISessionsService } from '../../../../services/sessions/browser/sessionsService.js';
import { SessionBrowserViewController } from '../../browser/sessionBrowserView.js';

interface IDisposal {
	readonly force: boolean | undefined;
	readonly vetoed: boolean;
}

function createTestChat(resource: URI): IChat {
	const createdAt = new Date(0);
	return {
		resource,
		createdAt,
		title: constObservable('chat'),
		updatedAt: constObservable(createdAt),
		status: constObservable(SessionStatus.Completed),
		changes: constObservable([]),
		checkpoints: constObservable(undefined),
		modelId: constObservable(undefined),
		modelSource: constObservable(undefined),
		mode: constObservable(undefined),
		isArchived: constObservable(false),
		isRead: constObservable(true),
		interactivity: constObservable(ChatInteractivity.Full),
		description: constObservable(undefined),
		lastTurnEnd: constObservable(undefined),
	};
}

class TestSession implements ISession {
	readonly archived = observableValue('archived', false);
	readonly sessionId: string;
	readonly resource: URI;
	readonly providerId = 'test';
	readonly sessionType = 'test';
	readonly icon = Codicon.comment;
	readonly createdAt = new Date(0);
	readonly workspace = constObservable(undefined);
	readonly title = constObservable('session');
	readonly updatedAt = observableValue('updatedAt', new Date(0));
	readonly status = observableValue('status', SessionStatus.Completed);
	readonly changes = constObservable([]);
	readonly changesets = constObservable(undefined);
	readonly modelId = constObservable(undefined);
	readonly mode = constObservable(undefined);
	readonly loading = constObservable(false);
	readonly isRead = constObservable(true);
	readonly description = constObservable(undefined);
	readonly lastTurnEnd = constObservable(undefined);
	readonly capabilities = constObservable({ supportsMultipleChats: false });
	readonly mainChat: IObservable<IChat>;
	readonly chats: IObservable<readonly IChat[]>;
	get isArchived() { return this.archived; }
	constructor(sessionId: string, path: string, chatResources?: readonly URI[]) {
		this.sessionId = sessionId;
		this.resource = URI.from({ scheme: 'session', path });
		const chatList = chatResources?.length
			? chatResources.map(resource => createTestChat(resource))
			: [createTestChat(this.resource)];
		this.mainChat = constObservable(chatList[0]);
		this.chats = constObservable(chatList);
	}
}

/** Visible-session stand-in: same id, resource, and archive observable as the provider session. */
function asVisibleSession(session: TestSession): ISession {
	return new class extends mock<ISession>() {
		override get sessionId() { return session.sessionId; }
		override get resource() { return session.resource; }
		override get isArchived() { return session.isArchived; }
	}();
}

interface ITestAgentOwner {
	readonly type: 'agent';
	readonly sessionId: string;
}

function createInput(store: DisposableStore, id: string, owner?: ITestAgentOwner): { input: BrowserEditorInput; disposals: IDisposal[]; resolveModel(next: ITestAgentOwner | undefined): void } {
	const onBeforeDispose = store.add(new Emitter<IBeforeDisposeBrowserEditorEvent>());
	const onWillDispose = store.add(new Emitter<void>());
	const onDidResolveModel = store.add(new Emitter<void>());
	const disposals: IDisposal[] = [];
	let model: { readonly owner: ITestAgentOwner } | undefined = owner ? { owner } : undefined;
	const input = Object.create(BrowserEditorInput.prototype) as BrowserEditorInput;
	Object.defineProperty(input, 'id', { get: () => id });
	Object.defineProperty(input, 'model', { get: () => model });
	input.dispose = (force?: boolean) => {
		if (!force) {
			let vetoed = false;
			onBeforeDispose.fire({ veto: () => { vetoed = true; } });
			if (vetoed) {
				disposals.push({ force, vetoed: true });
				return;
			}
		}
		disposals.push({ force, vetoed: false });
		onWillDispose.fire();
	};
	Object.defineProperty(input, 'onBeforeDispose', { value: onBeforeDispose.event });
	Object.defineProperty(input, 'onWillDispose', { value: onWillDispose.event });
	Object.defineProperty(input, 'onDidResolveModel', { value: onDidResolveModel.event });
	return {
		input,
		disposals,
		resolveModel: next => {
			model = next ? { owner: next } : undefined;
			onDidResolveModel.fire();
		},
	};
}

interface IHarness {
	readonly activeSession: ReturnType<typeof observableValue<ISession | undefined>>;
	readonly known: Map<string, BrowserEditorInput>;
	readonly sessions: TestSession[];
	controller: SessionBrowserViewController;
	readonly chats: Map<string, TestSession>;
	readonly browserViewsChanged: Emitter<void>;
	open: (input: BrowserEditorInput) => void;
	replace: (from: ISession, to: ISession) => void;
	remove: (sessions: readonly ISession[]) => void;
	deleteCommitted: (session: ISession) => void;
	graduateDraft: (draft: TestSession, committed: TestSession, draftChat: URI, committedChat: URI) => void;
	included: (input: BrowserEditorInput) => boolean;
	shouldOpen: (owner: { readonly type: 'user' } | ITestAgentOwner) => boolean;
	filter: IBrowserViewContextualFilter | undefined;
	openHandler: IBrowserViewOpenHandler | undefined;
	bindingChanges: number;
}

function createHarness(store: DisposableStore, active: ISession | undefined, alreadyOpen?: readonly BrowserEditorInput[]): IHarness {
	const sessionsChanged = store.add(new Emitter<ISessionsChangeEvent>());
	const sessionDeleted = store.add(new Emitter<ISession>());
	const sessionReplaced = store.add(new Emitter<{ readonly from: ISession; readonly to: ISession }>());
	const willOpenEditor = store.add(new Emitter<IEditorWillOpenEvent>());
	const browserViewsChanged = store.add(new Emitter<void>());
	const activeSession = observableValue<ISession | undefined>('active', active);
	const known = new Map<string, BrowserEditorInput>();
	const sessions: TestSession[] = [];
	const chats = new Map<string, TestSession>();
	const harness = {
		activeSession,
		known,
		sessions,
		chats,
		browserViewsChanged,
		bindingChanges: 0,
		filter: undefined,
		openHandler: undefined,
	} as IHarness;

	const management = new class extends mock<ISessionsManagementService>() {
		override readonly onDidChangeSessions = sessionsChanged.event;
		override readonly onDidReplaceSession = sessionReplaced.event;
		override readonly onDidDeleteSession = sessionDeleted.event;
		override getSession(resource: URI): ISession | undefined {
			return sessions.find(session => isEqual(session.resource, resource));
		}
		override getSessionForChatResource(resource: URI): { session: ISession; chat: IChat } | undefined {
			const session = chats.get(resource.toString());
			if (!session) {
				return undefined;
			}
			const chat = session.chats.get().find(candidate => isEqual(candidate.resource, resource)) ?? session.mainChat.get();
			return { session, chat };
		}
	}();
	const sessionsService = new class extends mock<ISessionsService>() {
		override readonly activeSession: IObservable<IActiveSession | undefined> = activeSession as IObservable<IActiveSession | undefined>;
	}();
	const browserViews = new class extends mock<IBrowserViewWorkbenchService>() {
		override registerContextualFilter(filter: IBrowserViewContextualFilter) {
			harness.filter = filter;
			store.add(filter.onDidChange?.(() => { harness.bindingChanges++; }) ?? Disposable.None);
			return Disposable.None;
		}
		override readonly onDidChangeBrowserViews = browserViewsChanged.event;
		override registerOpenHandler(handler: IBrowserViewOpenHandler) {
			harness.openHandler = handler;
			return Disposable.None;
		}
		override getKnownBrowserViews() {
			return known;
		}
	}();
	const editorService = new class extends mock<IEditorService>() {
		override readonly onWillOpenEditor = willOpenEditor.event;
	}();
	const editorGroups: { readonly editors: readonly BrowserEditorInput[] }[] = alreadyOpen ? [{ editors: alreadyOpen }] : [];
	const groups = new class extends mock<IEditorGroupsService>() {
		override readonly onDidAddGroup = Event.None;
		override get groups(): readonly IEditorGroup[] {
			return editorGroups as unknown as readonly IEditorGroup[];
		}
	}();

	harness.controller = store.add(new SessionBrowserViewController(
		management as ISessionsManagementService,
		sessionsService as ISessionsService,
		browserViews as IBrowserViewWorkbenchService,
		editorService as IEditorService,
		groups as IEditorGroupsService,
	));
	harness.open = input => {
		known.set(input.id, input);
		willOpenEditor.fire({ editor: input, groupId: 1 });
	};
	harness.replace = (from, to) => {
		// The provider drops the draft before publishing graduation.
		const index = sessions.indexOf(from as TestSession);
		if (index >= 0) {
			sessions.splice(index, 1);
		}
		sessionReplaced.fire({ from, to });
		sessionsChanged.fire({ added: [], removed: from.sessionId === to.sessionId ? [] : [from], changed: [to] });
	};
	harness.remove = removed => {
		sessionsChanged.fire({ added: [], removed, changed: [] });
	};
	harness.deleteCommitted = session => {
		const index = sessions.indexOf(session as TestSession);
		if (index >= 0) {
			sessions.splice(index, 1);
		}
		for (const chatKey of [...chats.keys()]) {
			if (chats.get(chatKey) === session) {
				chats.delete(chatKey);
			}
		}
		sessionsChanged.fire({ added: [], removed: [session], changed: [] });
		sessionDeleted.fire(session);
	};
	harness.graduateDraft = (draft, committed, draftChat, committedChat) => {
		chats.set(draftChat.toString(), draft);
		const draftIndex = sessions.indexOf(draft);
		if (draftIndex >= 0) {
			sessions.splice(draftIndex, 1);
		}
		if (!sessions.includes(committed)) {
			sessions.push(committed);
		}
		chats.delete(draftChat.toString());
		chats.set(committedChat.toString(), committed);
		sessionReplaced.fire({ from: draft, to: committed });
		sessionsChanged.fire({ added: [], removed: [draft], changed: [committed] });
	};
	harness.included = input => {
		assert.ok(harness.filter);
		return harness.filter.include(input, {});
	};
	harness.shouldOpen = owner => {
		assert.ok(harness.openHandler);
		return harness.openHandler.shouldOpenEditor(undefined!, owner, undefined!);
	};
	return harness;
}

suite('SessionBrowserViewController', () => {

	const store = new DisposableStore();

	teardown(() => store.clear());

	ensureNoDisposablesAreLeakedInTestSuite();

	test('draft graduation keeps the browser with the committed session', () => {
		const draft = new TestSession('draft', '/draft');
		const committed = new TestSession('committed', '/committed');
		const other = new TestSession('other', '/other');
		const harness = createHarness(store, asVisibleSession(draft));
		harness.sessions.push(draft, committed, other);
		const { input, disposals } = createInput(store, 'browser-1');

		harness.open(input);
		assert.strictEqual(harness.included(input), true);

		const committedView = asVisibleSession(committed);
		harness.activeSession.set(committedView, undefined);
		assert.strictEqual(harness.included(input), false, 'still bound to the draft until graduation');

		const changesBefore = harness.bindingChanges;
		harness.replace(draft, committed);
		assert.deepStrictEqual(disposals, [], 'graduation must not destroy the open browser');
		assert.strictEqual(harness.included(input), true);
		assert.ok(harness.bindingChanges > changesBefore, 'contextual browsers refresh after rebind');

		draft.archived.set(true, undefined);
		assert.deepStrictEqual(disposals, [], 'the draft archive flag is no longer the browser\'s');

		harness.activeSession.set(asVisibleSession(other), undefined);
		input.dispose();
		assert.deepStrictEqual(disposals, [{ force: undefined, vetoed: true }], 'leaving the committed session still keeps the browser');

		committed.archived.set(true, undefined);
		assert.deepStrictEqual(disposals.at(-1), { force: true, vetoed: false });
	});

	test('graduation onto the same resource does not destroy the browser', () => {
		const draft = new TestSession('draft', '/same');
		const committed = new TestSession('committed', '/same');
		const harness = createHarness(store, draft);
		harness.sessions.push(draft, committed);
		const { input, disposals } = createInput(store, 'browser-same');

		harness.open(input);
		harness.activeSession.set(committed, undefined);
		harness.replace(draft, committed);

		assert.deepStrictEqual(disposals, []);
		assert.strictEqual(harness.included(input), true);
	});

	test('deleting a session still destroys its browser after a graduation', () => {
		const draft = new TestSession('draft', '/draft');
		const committed = new TestSession('committed', '/committed');
		const other = new TestSession('other', '/other');
		const harness = createHarness(store, draft);
		harness.sessions.push(draft, committed, other);
		const graduated = createInput(store, 'graduated');
		const separate = createInput(store, 'separate');

		harness.open(graduated.input);
		harness.replace(draft, committed);

		harness.activeSession.set(other, undefined);
		harness.open(separate.input);
		harness.remove([other]);

		assert.deepStrictEqual(graduated.disposals, []);
		assert.deepStrictEqual(separate.disposals, [{ force: true, vetoed: false }]);
	});

	test('browser already open when the controller starts stays with its session', () => {
		const session = new TestSession('session', '/session');
		const other = new TestSession('other', '/other');
		const { input, disposals } = createInput(store, 'restored');
		const harness = createHarness(store, session, [input]);
		harness.sessions.push(session, other);

		assert.strictEqual(harness.included(input), true);

		harness.activeSession.set(other, undefined);
		input.dispose();
		assert.deepStrictEqual(disposals, [{ force: undefined, vetoed: true }], 'leaving the session keeps the restored browser');

		harness.activeSession.set(session, undefined);
		session.archived.set(true, undefined);
		assert.deepStrictEqual(disposals.at(-1), { force: true, vetoed: false });
	});

	test('browser open before any session is claimed once a session exists', () => {
		const session = new TestSession('session', '/session');
		const other = new TestSession('other', '/other');
		const { input, disposals } = createInput(store, 'early');
		const harness = createHarness(store, undefined, [input]);

		assert.strictEqual(harness.included(input), true, 'unowned until a session exists');

		harness.activeSession.set(session, undefined);
		assert.strictEqual(harness.included(input), true);

		harness.activeSession.set(other, undefined);
		assert.strictEqual(harness.included(input), false, 'claimed by the session that appeared');
		input.dispose();
		assert.deepStrictEqual(disposals, [{ force: undefined, vetoed: true }]);
	});

	test('closing the browser while its session is active still disposes it', () => {
		const session = new TestSession('session', '/session');
		const harness = createHarness(store, session);
		harness.sessions.push(session);
		const { input, disposals } = createInput(store, 'browser-close');

		harness.open(input);
		input.dispose();

		assert.deepStrictEqual(disposals, [{ force: undefined, vetoed: false }]);
	});

	test('restored agent page stays with its owner instead of the session that was active', () => {
		const owner = new TestSession('owner', '/owner');
		const bystander = new TestSession('bystander', '/bystander');
		const chat = URI.from({ scheme: 'chat', path: '/owner/main' });
		const { input, disposals, resolveModel } = createInput(store, 'restored-agent');
		const harness = createHarness(store, bystander, [input]);
		harness.sessions.push(owner, bystander);
		harness.chats.set(chat.toString(), owner);

		resolveModel({ type: 'agent', sessionId: chat.toString() });
		assert.strictEqual(harness.included(input), false, 'the bystander does not keep the page');

		// Switching onto the bystander closes editors. The live page belongs to owner.
		input.dispose();
		assert.deepStrictEqual(disposals, [{ force: undefined, vetoed: true }], 'the bystander must not destroy the owner page');
		bystander.archived.set(true, undefined);
		assert.deepStrictEqual(disposals, [{ force: undefined, vetoed: true }], 'archiving the bystander must not destroy the owner page');

		harness.activeSession.set(asVisibleSession(owner), undefined);
		assert.strictEqual(harness.included(input), true);
		input.dispose();
		assert.deepStrictEqual(disposals.at(-1), { force: undefined, vetoed: false }, 'closing it in the owning session stays closed');
	});

	test('agent page opened while another session is active is not bound to that session', () => {
		const owner = new TestSession('owner', '/owner');
		const other = new TestSession('other', '/other');
		const chat = URI.from({ scheme: 'chat', path: '/owner/side' });
		const harness = createHarness(store, other);
		harness.sessions.push(owner, other);
		harness.chats.set(chat.toString(), owner);
		const { input, disposals } = createInput(store, 'opened-agent', { type: 'agent', sessionId: chat.toString() });

		assert.strictEqual(harness.shouldOpen({ type: 'agent', sessionId: chat.toString() }), false);
		assert.strictEqual(harness.shouldOpen({ type: 'agent', sessionId: other.resource.toString() }), true);
		assert.strictEqual(harness.shouldOpen({ type: 'agent', sessionId: 'chat://missing' }), false);
		assert.strictEqual(harness.shouldOpen({ type: 'user' }), true);

		harness.open(input);
		assert.strictEqual(harness.included(input), false);
		other.archived.set(true, undefined);
		assert.deepStrictEqual(disposals, [], 'the other session archive is not this page');

		harness.activeSession.set(owner, undefined);
		input.dispose();
		assert.deepStrictEqual(disposals, [{ force: undefined, vetoed: false }]);
	});

	test('agent page that never opened a tab is not shown on another session and dies with its owner', () => {
		const owner = new TestSession('owner', '/owner');
		const other = new TestSession('other', '/other');
		const harness = createHarness(store, other);
		harness.sessions.push(other);
		const agent = createInput(store, 'background-agent', { type: 'agent', sessionId: owner.resource.toString() });
		const user = createInput(store, 'background-user');
		harness.known.set(agent.input.id, agent.input);
		harness.known.set(user.input.id, user.input);
		harness.browserViewsChanged.fire();

		assert.strictEqual(harness.included(agent.input), false, 'a gone session\'s page must not show on the active session');
		assert.strictEqual(harness.included(user.input), true);

		harness.remove([owner]);
		assert.deepStrictEqual(agent.disposals, [{ force: true, vetoed: false }]);
		assert.deepStrictEqual(user.disposals, []);
	});

	test('draft graduation agent owner keeps an already-open page on the committed session', () => {
			const draftChat = URI.from({ scheme: 'untitled', path: '/draft-chat' });
			const committedChat = URI.from({ scheme: 'chat', path: '/committed-chat' });
			const draft = new TestSession('draft', '/draft', [draftChat]);
			const committed = new TestSession('committed', '/committed', [committedChat]);
			const other = new TestSession('other', '/other');
			const harness = createHarness(store, asVisibleSession(draft));
			harness.sessions.push(draft, committed, other);
			harness.chats.set(draftChat.toString(), draft);
			const { input, disposals } = createInput(store, 'grad-open-agent', { type: 'agent', sessionId: draftChat.toString() });

			harness.open(input);
			assert.strictEqual(harness.included(input), true);

			harness.activeSession.set(asVisibleSession(committed), undefined);
			assert.strictEqual(harness.included(input), false, 'draft chat owner stops resolving before graduation');

			harness.graduateDraft(draft, committed, draftChat, committedChat);
			assert.deepStrictEqual(disposals, [], 'graduation must not destroy the open browser');
			assert.strictEqual(harness.included(input), true, 'committed session keeps the stale owner uri');
	});

	test('draft graduation agent owner shows a known background page after graduation', () => {
			const draftChat = URI.from({ scheme: 'untitled', path: '/draft-bg' });
			const committedChat = URI.from({ scheme: 'chat', path: '/committed-bg' });
			const draft = new TestSession('draft-bg', '/draft-bg', [draftChat]);
			const committed = new TestSession('committed-bg', '/committed-bg', [committedChat]);
			const harness = createHarness(store, asVisibleSession(committed));
			harness.sessions.push(draft, committed);
			harness.chats.set(draftChat.toString(), draft);
			const agent = createInput(store, 'grad-bg-agent', { type: 'agent', sessionId: draftChat.toString() });
			harness.known.set(agent.input.id, agent.input);

			assert.strictEqual(harness.included(agent.input), false, 'hidden before graduation while draft owner is unresolved on committed session');

			harness.graduateDraft(draft, committed, draftChat, committedChat);
			harness.browserViewsChanged.fire();
			assert.strictEqual(harness.included(agent.input), true);
	});

	test('draft graduation agent owner claims a page that appears after graduation with a stale owner uri', () => {
			const draftChat = URI.from({ scheme: 'untitled', path: '/late-draft' });
			const committedChat = URI.from({ scheme: 'chat', path: '/late-committed' });
			const draft = new TestSession('late-draft', '/late-draft', [draftChat]);
			const committed = new TestSession('late-committed', '/late-committed', [committedChat]);
			const harness = createHarness(store, asVisibleSession(committed));
			harness.sessions.push(draft, committed);
			harness.chats.set(draftChat.toString(), draft);

			harness.graduateDraft(draft, committed, draftChat, committedChat);

			const { input, disposals } = createInput(store, 'grad-late-agent', { type: 'agent', sessionId: draftChat.toString() });
			harness.known.set(input.id, input);
			harness.browserViewsChanged.fire();

			assert.deepStrictEqual(disposals, []);
			assert.strictEqual(harness.included(input), true);
	});

	test('draft graduation agent owner follows a second graduation to the latest committed identity', () => {
			const firstChat = URI.from({ scheme: 'untitled', path: '/first-chat' });
			const secondChat = URI.from({ scheme: 'chat', path: '/second-chat' });
			const thirdChat = URI.from({ scheme: 'chat', path: '/third-chat' });
			const first = new TestSession('first', '/first', [firstChat]);
			const second = new TestSession('second', '/second', [secondChat]);
			const third = new TestSession('third', '/third', [thirdChat]);
			const harness = createHarness(store, asVisibleSession(first));
			harness.sessions.push(first, second, third);
			harness.chats.set(firstChat.toString(), first);
			const agent = createInput(store, 'grad-twice-agent', { type: 'agent', sessionId: firstChat.toString() });
			harness.known.set(agent.input.id, agent.input);

			harness.graduateDraft(first, second, firstChat, secondChat);
			harness.activeSession.set(asVisibleSession(second), undefined);
			assert.strictEqual(harness.included(agent.input), true);

			harness.chats.set(secondChat.toString(), second);
			harness.graduateDraft(second, third, secondChat, thirdChat);
			harness.activeSession.set(asVisibleSession(third), undefined);
			assert.strictEqual(harness.included(agent.input), true, 'first owner uri maps to the latest committed session');
	});

	test('draft graduation agent owner destroys stale owner pages on real delete after graduation', () => {
			const draftChat = URI.from({ scheme: 'untitled', path: '/delete-draft' });
			const committedChat = URI.from({ scheme: 'chat', path: '/delete-committed' });
			const draft = new TestSession('delete-draft', '/delete-draft', [draftChat]);
			const committed = new TestSession('delete-committed', '/delete-committed', [committedChat]);
			const harness = createHarness(store, asVisibleSession(committed));
			harness.sessions.push(draft, committed);
			harness.chats.set(draftChat.toString(), draft);
			const open = createInput(store, 'grad-delete-open', { type: 'agent', sessionId: draftChat.toString() });
			const background = createInput(store, 'grad-delete-bg', { type: 'agent', sessionId: draftChat.toString() });
			harness.open(open.input);
			harness.known.set(background.input.id, background.input);

			harness.graduateDraft(draft, committed, draftChat, committedChat);
			assert.strictEqual(harness.included(open.input), true);

			harness.deleteCommitted(committed);
			assert.ok(open.disposals.some(d => d.force === true && !d.vetoed), 'open page force-disposed on real delete');
			assert.ok(background.disposals.some(d => d.force === true && !d.vetoed), 'background page force-disposed on real delete');
	});

	test('draft graduation agent owner keeps unknown agent owners hidden without a graduation mapping', () => {
			const owner = new TestSession('owner', '/owner');
			const other = new TestSession('other', '/other');
			const harness = createHarness(store, asVisibleSession(owner));
			harness.sessions.push(owner, other);
			const missing = URI.from({ scheme: 'chat', path: '/missing-owner' });
			const agent = createInput(store, 'grad-unknown-agent', { type: 'agent', sessionId: missing.toString() });
			harness.known.set(agent.input.id, agent.input);
			harness.browserViewsChanged.fire();

			assert.strictEqual(harness.included(agent.input), false);
			harness.activeSession.set(asVisibleSession(other), undefined);
			assert.strictEqual(harness.included(agent.input), false);
	});

	test('archiving the owner destroys a background agent page and archiving someone else does not', () => {
		const owner = new TestSession('owner', '/owner');
		const other = new TestSession('other', '/other');
		const chat = URI.from({ scheme: 'chat', path: '/owner/hidden' });
		const harness = createHarness(store, other);
		harness.sessions.push(owner, other);
		harness.chats.set(chat.toString(), owner);
		const { input, disposals } = createInput(store, 'background-owned', { type: 'agent', sessionId: chat.toString() });
		harness.known.set(input.id, input);
		harness.browserViewsChanged.fire();

		other.archived.set(true, undefined);
		assert.deepStrictEqual(disposals, []);
		owner.archived.set(true, undefined);
		assert.deepStrictEqual(disposals, [{ force: true, vetoed: false }]);
	});
});
