/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { DisposableStore, Disposable } from '../../../../../base/common/lifecycle.js';
import { observableValue, type IObservable } from '../../../../../base/common/observable.js';
import { isEqual } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IEditorWillOpenEvent } from '../../../../../workbench/common/editor.js';
import { BrowserEditorInput, type IBeforeDisposeBrowserEditorEvent } from '../../../../../workbench/contrib/browserView/common/browserEditorInput.js';
import { IBrowserViewContextualFilter, IBrowserViewWorkbenchService } from '../../../../../workbench/contrib/browserView/common/browserView.js';
import { IEditorGroupsService } from '../../../../../workbench/services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../../../workbench/services/editor/common/editorService.js';
import { ISession } from '../../../../services/sessions/common/session.js';
import { IActiveSession, ISessionsChangeEvent, ISessionsManagementService } from '../../../../services/sessions/common/sessionsManagement.js';
import { ISessionsService } from '../../../../services/sessions/browser/sessionsService.js';
import { SessionBrowserViewController } from '../../browser/sessionBrowserView.js';

interface IDisposal {
	readonly force: boolean | undefined;
	readonly vetoed: boolean;
}

class TestSession extends mock<ISession>() {
	readonly archived = observableValue('archived', false);
	override readonly sessionId: string;
	override readonly resource: URI;
	override get isArchived() { return this.archived; }
	constructor(sessionId: string, path: string) {
		super();
		this.sessionId = sessionId;
		this.resource = URI.from({ scheme: 'session', path });
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

function createInput(store: DisposableStore, id: string): { input: BrowserEditorInput; disposals: IDisposal[] } {
	const onBeforeDispose = store.add(new Emitter<IBeforeDisposeBrowserEditorEvent>());
	const onWillDispose = store.add(new Emitter<void>());
	const disposals: IDisposal[] = [];
	const input = Object.create(BrowserEditorInput.prototype) as BrowserEditorInput;
	Object.defineProperty(input, 'id', { get: () => id });
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
	return { input, disposals };
}

interface IHarness {
	readonly activeSession: ReturnType<typeof observableValue<ISession | undefined>>;
	readonly known: Map<string, BrowserEditorInput>;
	readonly sessions: TestSession[];
	readonly controller: SessionBrowserViewController;
	readonly open: (input: BrowserEditorInput) => void;
	readonly replace: (from: ISession, to: ISession) => void;
	readonly remove: (sessions: readonly ISession[]) => void;
	readonly included: (input: BrowserEditorInput) => boolean;
	filter: IBrowserViewContextualFilter | undefined;
	bindingChanges: number;
}

function createHarness(store: DisposableStore, active: ISession): IHarness {
	const sessionsChanged = store.add(new Emitter<ISessionsChangeEvent>());
	const sessionReplaced = store.add(new Emitter<{ readonly from: ISession; readonly to: ISession }>());
	const willOpenEditor = store.add(new Emitter<IEditorWillOpenEvent>());
	const activeSession = observableValue<ISession | undefined>('active', active);
	const known = new Map<string, BrowserEditorInput>();
	const sessions: TestSession[] = [];
	const harness = {
		activeSession,
		known,
		sessions,
		bindingChanges: 0,
		filter: undefined,
	} as IHarness;

	const management = new class extends mock<ISessionsManagementService>() {
		override readonly onDidChangeSessions = sessionsChanged.event;
		override readonly onDidReplaceSession = sessionReplaced.event;
		override getSession(resource: URI): ISession | undefined {
			return sessions.find(session => isEqual(session.resource, resource));
		}
		override getSessionForChatResource(): undefined {
			return undefined;
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
		override registerOpenHandler() {
			return Disposable.None;
		}
		override getKnownBrowserViews() {
			return known;
		}
	}();
	const editorService = new class extends mock<IEditorService>() {
		override readonly onWillOpenEditor = willOpenEditor.event;
	}();
	const groups = new class extends mock<IEditorGroupsService>() {
		override readonly onDidAddGroup = Event.None;
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
	harness.included = input => {
		assert.ok(harness.filter);
		return harness.filter.include(input, {});
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

	test('closing the browser while its session is active still disposes it', () => {
		const session = new TestSession('session', '/session');
		const harness = createHarness(store, session);
		harness.sessions.push(session);
		const { input, disposals } = createInput(store, 'browser-close');

		harness.open(input);
		input.dispose();

		assert.deepStrictEqual(disposals, [{ force: undefined, vetoed: false }]);
	});
});
