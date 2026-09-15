/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { Emitter } from '../../../../../base/common/event.js';
import { DisposableStore, IDisposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { ConversationTurnContentAdapter } from '../../browser/conversationTurnContentAdapter.js';
import { IConversationRosterService } from '../../browser/conversationStubService.js';
import { IConversationSessionWindowService } from '../../browser/conversationSessionWindowService.js';
import { conversationSessionPillClass, conversationSessionPillHoverLines, conversationSessionPillKindAttribute } from '../../browser/conversationSessionPill.js';
import { resolveConversationTimelineLink } from '../../browser/resolveConversationTimelineLink.js';
import { IConversationSessionChatEntry, IConversationSessionChatService } from '../../common/conversationSessionChat.js';
import { createEmptyConversationSessionChatService, createNoopConversationSessionWindowService } from './conversationTimelineLinkTestStubs.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';

suite('Conversation timeline session pills', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	interface IHarnessRosterSession {
		id: string;
		title: string;
		workDir?: string;
		source?: string;
	}

	function assistantTurn(text: string, id = 'a1'): ConversationStubTurn {
		return { id, kind: 'assistant', text };
	}

	async function clickHref(container: HTMLElement, href: string): Promise<void> {
		const anchor = container.querySelector(`a[data-href="${href}"]`) as HTMLAnchorElement | null;
		assert.ok(anchor, `missing anchor for ${href}`);
		anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		await timeout(0);
	}

	function createHarness(options?: {
		sessions?: IHarnessRosterSession[];
		catalog?: IConversationSessionChatEntry[];
	}) {
		const disposables = store.add(new DisposableStore());
		const sessions = options?.sessions ?? [
			{ id: 'untitled', title: 'Untitled' },
			{ id: 'visualize', title: 'Visualize' },
		];
		const catalogBySession = new Map<string, IConversationSessionChatEntry[]>();
		for (const entry of options?.catalog ?? []) {
			const list = catalogBySession.get(entry.sessionKey) ?? [];
			list.push(entry);
			catalogBySession.set(entry.sessionKey, list);
		}
		const onDidChangeSession = new Emitter<void>();
		const onDidChangeActiveSession = new Emitter<string>();
		const onDidChangeCatalog = new Emitter<string>();
		disposables.add(onDidChangeSession);
		disposables.add(onDidChangeActiveSession);
		disposables.add(onDidChangeCatalog);
		let activeId = sessions[0]?.id ?? '';
		const openedEditors: unknown[] = [];
		const openSubAgentCalls: Array<{ sessionKey: string; chatId: string }> = [];
		const openExtensionTabCalls: Array<{ sessionKey: string; chatId: string }> = [];
		const revealCalls: string[] = [];
		const openerCalls: Array<{ resource: URI | string; options?: { openExternal?: boolean } }> = [];
		const hoverTexts: string[] = [];
		let dialogOpen = false;

		const roster = {
			getSessions: () => sessions,
			getActiveSessionId: () => activeId,
			switchSession: (id: string) => {
				activeId = id;
				onDidChangeActiveSession.fire(id);
			},
			onDidChangeSession: onDidChangeSession.event,
			onDidChangeActiveSession: onDidChangeActiveSession.event,
			isEngineConnected: () => false,
		} as unknown as IConversationRosterService;

		const sessionChat = {
			...createEmptyConversationSessionChatService(),
			onDidChangeCatalog: onDidChangeCatalog.event,
			getCatalog: (sessionKey: string) => catalogBySession.get(sessionKey) ?? [],
			registerSubAgentChat: (sessionKey: string, chatId: string, title: string) => {
				const entry: IConversationSessionChatEntry = { sessionKey, chatId, title, originKind: 'tool' };
				const list = catalogBySession.get(sessionKey) ?? [];
				list.push(entry);
				catalogBySession.set(sessionKey, list);
				onDidChangeCatalog.fire(sessionKey);
				return entry;
			},
			openSubAgent: async (sessionKey: string, chatId: string) => {
				openSubAgentCalls.push({ sessionKey, chatId });
			},
			openExtensionTab: async (sessionKey: string, chatId: string) => {
				openExtensionTabCalls.push({ sessionKey, chatId });
			},
			isSubAgentDialogOpen: () => dialogOpen,
			closeSubAgentDialog: () => { dialogOpen = false; },
			findOpenTabForChat: () => undefined,
			getConversationPart: () => ({
				sessionKey: activeId,
				activeGroup: {
					openEditor: async (input: unknown) => {
						openedEditors.push(input);
						if (input && typeof (input as IDisposable).dispose === 'function') {
							disposables.add(input as IDisposable);
						}
					},
				},
			}),
		} as unknown as IConversationSessionChatService;

		const sessionWindow = {
			...createNoopConversationSessionWindowService(),
			revealSessionWindow: async (sessionKey: string) => {
				revealCalls.push(sessionKey);
			},
		} as IConversationSessionWindowService;

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, roster);
		instantiationService.stub(IConversationSessionChatService, sessionChat);
		instantiationService.stub(IConversationSessionWindowService, sessionWindow);
		instantiationService.stub(IOpenerService, {
			open: async (resource: URI | string, options?: { openExternal?: boolean }) => {
				openerCalls.push({ resource, options });
				return true;
			},
		} as IOpenerService);
		instantiationService.stub(IDialogService, {
			confirm: async () => ({ confirmed: true }),
		} as unknown as IDialogService);
		instantiationService.stub(IHoverService, {
			setupManagedHover: (_delegate: unknown, _target: unknown, content: string) => {
				hoverTexts.push(typeof content === 'string' ? content : '');
				return { dispose: () => { }, update: () => { }, show: () => { } };
			},
		} as unknown as IHoverService);
		instantiationService.stub(IEditorGroupsService, {
			getActiveConversationEditorPart: () => ({ sessionKey: activeId }),
		} as IEditorGroupsService);

		const adapter = instantiationService.createInstance(ConversationTurnContentAdapter);
		const container = document.createElement('div');
		document.body.appendChild(container);
		disposables.add({ dispose: () => container.remove() });

		function render(turn: ConversationStubTurn) {
			return disposables.add(adapter.renderTurnBody(turn, container));
		}

		return {
			container,
			render,
			sessions,
			roster,
			sessionChat,
			onDidChangeSession,
			onDidChangeCatalog,
			catalogBySession,
			openedEditors,
			openSubAgentCalls,
			openExtensionTabCalls,
			revealCalls,
			openerCalls,
			hoverTexts,
			setDialogOpen: (value: boolean) => { dialogOpen = value; },
			addSession: (session: IHarnessRosterSession) => {
				sessions.push(session);
				onDidChangeSession.fire();
			},
		};
	}

	test('1 allow conversation-chat anchors and strip agent-host-session / command', () => {
		const { container, render } = createHarness({
			catalog: [{ sessionKey: 'untitled', chatId: 'c1', title: 'Agent', originKind: 'tool' }],
		});
		render(assistantTurn([
			'[ok](conversation-chat:/session/untitled/chat/c1)',
			'[host](agent-host-session://s1)',
			'[cmd](command:workbench.action.showCommands)',
		].join(' ')));

		assert.ok(container.querySelector('a[data-href="conversation-chat:/session/untitled/chat/c1"]'));
		assert.strictEqual(container.querySelectorAll('a[data-href^="agent-host-session"]').length, 0);
		assert.strictEqual(container.querySelectorAll('a[data-href^="command:"]').length, 0);
	});

	test('2 http opens once; conversation-chat and file never openExternal', async () => {
		const { container, render, openerCalls } = createHarness({
			catalog: [{ sessionKey: 'untitled', chatId: 'c1', title: 'Agent', originKind: 'tool' }],
		});
		render(assistantTurn([
			'[web](https://example.com/x)',
			'[pill](conversation-chat:/session/untitled/chat/c1)',
			'[disk](file:///tmp/readme.md)',
		].join(' ')));

		await clickHref(container, 'https://example.com/x');
		assert.strictEqual(openerCalls.length, 1);
		assert.strictEqual(openerCalls[0]?.options?.openExternal, true);

		await clickHref(container, 'conversation-chat:/session/untitled/chat/c1');
		assert.strictEqual(openerCalls.length, 1);

		const fileAnchor = container.querySelector('a[data-href^="file:"]') as HTMLAnchorElement | null
			?? container.querySelector('a[href^="file:"]') as HTMLAnchorElement | null;
		assert.ok(fileAnchor, 'file link should survive sanitizer');
		fileAnchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		await timeout(0);
		assert.ok(openerCalls.every(call => call.options?.openExternal !== true || String(call.resource).includes('example.com')));
		assert.strictEqual(openerCalls.filter(call => call.options?.openExternal).length, 1);
	});

	test('3 unresolved internal targets stay plain text and do not navigate', async () => {
		const { container, render, revealCalls, openSubAgentCalls, openerCalls, roster } = createHarness();
		const activeBefore = roster.getActiveSessionId();
		render(assistantTurn([
			'[missing](conversation-chat:/session/unknown/chat/x)',
			'[evil](conversation-chat://evil/session/untitled/chat/default)',
			'[cmd](conversation-chat:command:workbench.action.showCommands)',
			'[nocat](conversation-chat:/session/untitled/chat/no-such-agent)',
		].join(' ')));

		assert.strictEqual(container.querySelectorAll(`.${conversationSessionPillClass}`).length, 0);
		for (const href of [
			'conversation-chat:/session/unknown/chat/x',
			'conversation-chat://evil/session/untitled/chat/default',
			'conversation-chat:command:workbench.action.showCommands',
			'conversation-chat:/session/untitled/chat/no-such-agent',
		]) {
			const node = container.querySelector(`a[data-href="${href}"]`) as HTMLAnchorElement | null;
			if (node) {
				node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
				await timeout(0);
			}
		}
		assert.strictEqual(roster.getActiveSessionId(), activeBefore);
		assert.deepStrictEqual(revealCalls, []);
		assert.deepStrictEqual(openSubAgentCalls, []);
		assert.deepStrictEqual(openerCalls, []);
	});

	test('4 pill kind follows open target, not whether the session is foreign', () => {
		const { container, render } = createHarness({
			sessions: [
				{ id: 'untitled', title: 'Untitled' },
				{ id: 'other', title: 'Other' },
			],
			catalog: [
				{ sessionKey: 'untitled', chatId: 'tool-a', title: 'Writer', originKind: 'tool' },
				{ sessionKey: 'other', chatId: 'tool-b', title: 'Other writer', originKind: 'tool' },
				{ sessionKey: 'untitled', chatId: 'fork-a', title: 'Fork A', originKind: 'fork' },
			],
		});
		render(assistantTurn([
			'[t](conversation-chat:/session/untitled/chat/tool-a)',
			'[ot](conversation-chat:/session/other/chat/tool-b)',
			'[root](conversation-chat:/session/untitled/chat/default)',
			'[f](conversation-chat:/session/untitled/chat/fork-a)',
		].join(' ')));

		const pills = [...container.querySelectorAll(`.${conversationSessionPillClass}`)] as HTMLAnchorElement[];
		assert.strictEqual(pills.length, 4);
		assert.strictEqual(pills[0]?.getAttribute(conversationSessionPillKindAttribute), 'subagent');
		assert.ok(pills[0]?.querySelector('.codicon-comment-discussion'));
		assert.strictEqual(pills[1]?.getAttribute(conversationSessionPillKindAttribute), 'subagent');
		assert.strictEqual(pills[2]?.getAttribute(conversationSessionPillKindAttribute), 'session');
		assert.ok(pills[2]?.querySelector('.codicon-agent'));
		assert.strictEqual(pills[3]?.getAttribute(conversationSessionPillKindAttribute), 'session');
		assert.strictEqual(pills[0]?.textContent?.includes('t'), true);
		assert.strictEqual(container.querySelectorAll('.chat-rich-link').length, 0);
	});

	test('5 hover lines omit missing workDir / model and never say connected', () => {
		const withAll = resolveConversationTimelineLink(
			'conversation-chat:/session/s1/chat/agent',
			[{ id: 's1', title: 'Alpha', workDir: '/tmp/ws' }],
			[{ sessionKey: 's1', chatId: 'agent', title: 'Writer', originKind: 'tool', model: 'gemini' }],
		);
		assert.strictEqual(withAll.kind, 'hit');
		if (withAll.kind === 'hit') {
			assert.deepStrictEqual(conversationSessionPillHoverLines(withAll), ['Alpha · Writer', '/tmp/ws', 'gemini']);
		}

		const noWork = resolveConversationTimelineLink(
			'conversation-chat:/session/s1/chat/agent',
			[{ id: 's1', title: '' }],
			[{ sessionKey: 's1', chatId: 'agent', title: 'Writer', originKind: 'tool' }],
		);
		assert.strictEqual(noWork.kind, 'hit');
		if (noWork.kind === 'hit') {
			const lines = conversationSessionPillHoverLines(noWork);
			assert.deepStrictEqual(lines, ['s1 · Writer']);
			assert.ok(!lines.join('\n').includes('已连接'));
			assert.ok(!lines.join('\n').includes('已同步'));
		}

		const { render, hoverTexts } = createHarness({
			sessions: [{ id: 'untitled', title: 'Untitled', workDir: '/home/ws' }],
			catalog: [{ sessionKey: 'untitled', chatId: 'tool-a', title: 'Writer', originKind: 'tool', model: 'm1' }],
		});
		render(assistantTurn('[t](conversation-chat:/session/untitled/chat/tool-a)'));
		assert.ok(hoverTexts.some(text => text.includes('Untitled · Writer') && text.includes('/home/ws') && text.includes('m1')));
	});

	test('6 same-session tool pill opens sub-agent dialog', async () => {
		const { container, render, openSubAgentCalls, openedEditors } = createHarness({
			catalog: [{ sessionKey: 'untitled', chatId: 'tool-a', title: 'Writer', originKind: 'tool' }],
		});
		render(assistantTurn('[t](conversation-chat:/session/untitled/chat/tool-a)'));
		await clickHref(container, 'conversation-chat:/session/untitled/chat/tool-a');
		assert.deepStrictEqual(openSubAgentCalls, [{ sessionKey: 'untitled', chatId: 'tool-a' }]);
		assert.deepStrictEqual(openedEditors, []);
	});

	test('7 root pill focuses default tab without closing a tool tab; fork opens extension tab', async () => {
		const { container, render, openedEditors, openExtensionTabCalls, setDialogOpen, sessionChat } = createHarness({
			catalog: [{ sessionKey: 'untitled', chatId: 'fork-a', title: 'Fork A', originKind: 'fork' }],
		});
		setDialogOpen(true);
		render(assistantTurn([
			'[root](conversation-chat:/session/untitled/chat/default)',
			'[fork](conversation-chat:/session/untitled/chat/fork-a)',
		].join(' ')));
		await clickHref(container, 'conversation-chat:/session/untitled/chat/default');
		assert.strictEqual(sessionChat.isSubAgentDialogOpen(), false);
		assert.ok(openedEditors.length >= 1);

		await clickHref(container, 'conversation-chat:/session/untitled/chat/fork-a');
		assert.deepStrictEqual(openExtensionTabCalls, [{ sessionKey: 'untitled', chatId: 'fork-a' }]);
	});

	test('11 sideChat catalog entries are not decorated and do not navigate', async () => {
		const { container, render, openSubAgentCalls, revealCalls } = createHarness({
			catalog: [{ sessionKey: 'untitled', chatId: 'side-1', title: 'Side', originKind: 'sideChat' }],
		});
		render(assistantTurn('[s](conversation-chat:/session/untitled/chat/side-1)'));
		assert.strictEqual(container.querySelectorAll(`.${conversationSessionPillClass}`).length, 0);
		const anchor = container.querySelector('a[data-href="conversation-chat:/session/untitled/chat/side-1"]') as HTMLAnchorElement | null;
		if (anchor) {
			anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
			await timeout(0);
		}
		assert.deepStrictEqual(openSubAgentCalls, []);
		assert.deepStrictEqual(revealCalls, []);
	});

	test('12 engine-cache roster sessions still resolve root pills', async () => {
		const resolved = resolveConversationTimelineLink(
			'conversation-chat:/session/cached/chat/default',
			[{ id: 'cached', title: 'Cached', workDir: '/old' }],
			[],
		);
		assert.strictEqual(resolved.kind, 'hit');
		if (resolved.kind === 'hit') {
			assert.strictEqual(resolved.sessionKey, 'cached');
			assert.strictEqual(resolved.originKind, 'root');
		}

		const { container, render, revealCalls, roster } = createHarness({
			sessions: [
				{ id: 'untitled', title: 'Untitled' },
				{ id: 'cached', title: 'Cached', source: 'engine-cache' },
			],
		});
		render(assistantTurn('[c](conversation-chat:/session/cached/chat/default)'));
		assert.strictEqual(container.querySelectorAll(`.${conversationSessionPillClass}`).length, 1);
		await clickHref(container, 'conversation-chat:/session/cached/chat/default');
		assert.strictEqual(roster.getActiveSessionId(), 'cached');
		assert.deepStrictEqual(revealCalls, ['cached']);
	});

	test('16 late catalog and roster paint pills once', () => {
		const { container, render, sessionChat, addSession, hoverTexts } = createHarness({
			sessions: [{ id: 'untitled', title: 'Untitled' }],
		});
		render(assistantTurn([
			'[root](conversation-chat:/session/other/chat/default)',
			'[tool](conversation-chat:/session/untitled/chat/late-tool)',
		].join(' ')));
		assert.strictEqual(container.querySelectorAll(`.${conversationSessionPillClass}`).length, 0);

		sessionChat.registerSubAgentChat('untitled', 'late-tool', 'Late');
		assert.strictEqual(container.querySelectorAll(`.${conversationSessionPillClass}`).length, 1);

		addSession({ id: 'other', title: 'Other' });
		assert.strictEqual(container.querySelectorAll(`.${conversationSessionPillClass}`).length, 2);

		const hoverCount = hoverTexts.length;
		sessionChat.registerSubAgentChat('untitled', 'late-tool', 'Late');
		assert.strictEqual(container.querySelectorAll(`.${conversationSessionPillClass}`).length, 2);
		assert.strictEqual(hoverTexts.length, hoverCount);
	});

	test('S4 stub fixture copy contains Stub conversation-chat links', () => {
		const { container, render } = createHarness({
			catalog: [{ sessionKey: 'untitled', chatId: 'stub-readme-agent', title: 'README agent (Stub)', originKind: 'tool' }],
		});
		render(assistantTurn('Stub: README draft ready. See [Visualize session (Stub)](conversation-chat:/session/visualize/chat/default) or [README agent (Stub)](conversation-chat:/session/untitled/chat/stub-readme-agent).'));
		assert.ok(container.textContent?.includes('Stub'));
		assert.strictEqual(container.querySelectorAll(`.${conversationSessionPillClass}`).length, 2);
	});
});
