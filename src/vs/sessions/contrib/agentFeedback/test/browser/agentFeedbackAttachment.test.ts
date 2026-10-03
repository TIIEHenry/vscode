/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { IDelayedHoverOptions, IHoverLifecycleOptions } from '../../../../../base/browser/ui/hover/hover.js';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { KeyCode } from '../../../../../base/common/keyCodes.js';
import { Disposable, DisposableStore, IDisposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { IContextViewDelegate, IContextViewService, IOpenContextView } from '../../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { getSelectionKeyboardEvent, WorkbenchObjectTree } from '../../../../../platform/list/browser/listService.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { workbenchInstantiationService } from '../../../../../workbench/test/browser/workbenchTestServices.js';
import { LOCAL_AGENT_HOST_PROVIDER_ID } from '../../../../common/agentHostSessionsProvider.js';
import { ISession, SessionStatus } from '../../../../services/sessions/common/session.js';
import { ISessionsChangeEvent, ISessionsManagementService } from '../../../../services/sessions/common/sessionsManagement.js';
import { ISessionsProvidersChangeEvent, ISessionsProvidersService } from '../../../../services/sessions/browser/sessionsProvidersService.js';
import { IChatWidget, IChatWidgetService, IChatWidgetViewModelChangeEvent } from '../../../../../workbench/contrib/chat/browser/chat.js';
import { IAgentFeedbackVariableEntry } from '../../../../../workbench/contrib/chat/common/attachments/chatVariableEntries.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { AgentFeedbackAttachmentContribution } from '../../browser/agentFeedbackAttachment.js';
import { AgentFeedbackAttachmentWidget } from '../../browser/agentFeedbackAttachmentWidget.js';
import { AgentFeedbackKind, AgentFeedbackState, IAgentFeedback, IAgentFeedbackChangeEvent, IAgentFeedbackService } from '../../browser/agentFeedbackService.js';
import { buildNewSessionPrompt } from '../../browser/agentFeedbackAttachmentEntry.js';

interface TrackedChatWidget {
	readonly widget: IChatWidget;
	attachmentSnapshot(): { id: string; texts: string[] }[];
	setSession(session: URI | undefined): void;
	submit(): void;
}

function createTrackedChatWidget(store: DisposableStore, initialSession: URI | undefined): TrackedChatWidget {
	const onDidChangeViewModel = store.add(new Emitter<IChatWidgetViewModelChangeEvent>());
	const onDidSubmitAgent = store.add(new Emitter<void>());
	const attachments: IAgentFeedbackVariableEntry[] = [];
	let viewModel: { sessionResource: URI } | undefined = initialSession ? { sessionResource: initialSession } : undefined;
	const widget = {
		get viewModel() { return viewModel; },
		onDidChangeViewModel: onDidChangeViewModel.event,
		onDidSubmitAgent: onDidSubmitAgent.event as unknown as IChatWidget['onDidSubmitAgent'],
		attachmentModel: {
			get attachments() { return attachments; },
			delete(id: string) {
				const index = attachments.findIndex(entry => entry.id === id);
				if (index >= 0) {
					attachments.splice(index, 1);
				}
			},
			addContext(entry: IAgentFeedbackVariableEntry) {
				attachments.push(entry);
			},
		},
	} as unknown as IChatWidget;
	return {
		widget,
		attachmentSnapshot: () => attachments.map(entry => ({ id: entry.id, texts: entry.feedbackItems.map(item => item.text) })),
		setSession(session: URI | undefined) {
			const previousSessionResource = viewModel?.sessionResource;
			viewModel = session ? { sessionResource: session } : undefined;
			onDidChangeViewModel.fire({ previousSessionResource, currentSessionResource: viewModel?.sessionResource });
		},
		submit() { onDidSubmitAgent.fire(); },
	};
}

class TestHoverService extends mock<IHoverService>() {
	hoverOptions: (() => IDelayedHoverOptions) | IDelayedHoverOptions | undefined;

	override hideHover(): void { }

	override setupDelayedHover(
		_target: HTMLElement,
		hoverOptions: (() => IDelayedHoverOptions) | IDelayedHoverOptions,
		_lifecycleOptions?: IHoverLifecycleOptions,
	): IDisposable {
		this.hoverOptions = hoverOptions;
		return Disposable.None;
	}
}

class TestContextViewService extends mock<IContextViewService>() {
	showCount = 0;
	closeCount = 0;
	delegate: IContextViewDelegate | undefined;

	override showContextView(delegate: IContextViewDelegate): IOpenContextView {
		this.showCount++;
		this.delegate = delegate;
		let closed = false;
		return {
			close: () => {
				if (closed) {
					return;
				}
				closed = true;
				this.closeCount++;
				delegate.onHide?.();
				this.delegate = undefined;
			}
		};
	}
}

/**
 * Calls `delegate.render` so the context-view tree exists and `onDidOpen` can be driven.
 * The base stub only records the delegate, which cannot lock this path.
 */
class RenderingTestContextViewService extends TestContextViewService {
	override showContextView(delegate: IContextViewDelegate): IOpenContextView {
		this.showCount++;
		this.delegate = delegate;
		const container = document.createElement('div');
		document.body.appendChild(container);
		const content = delegate.render(container);
		let closed = false;
		return {
			close: () => {
				if (closed) {
					return;
				}
				closed = true;
				this.closeCount++;
				content.dispose();
				delegate.onHide?.();
				this.delegate = undefined;
				container.remove();
			}
		};
	}
}

function idleProvidersService(): ISessionsProvidersService {
	return new class extends mock<ISessionsProvidersService>() {
		override onDidChangeProviders = Event.None;
	};
}

suite('AgentFeedbackAttachmentContribution', () => {
	const store = new DisposableStore();

	teardown(() => store.clear());
	ensureNoDisposablesAreLeakedInTestSuite();

	test('skips chat widget attachments for agent host sessions', () => {
		const sessionResource = URI.parse('agent-host-copilot:/session-1');
		const feedback: IAgentFeedback = {
			id: 'feedback-1',
			text: 'Check this',
			resourceUri: URI.file('/workspace/a.ts'),
			range: new Range(1, 1, 1, 5),
			sessionResource,
			kind: AgentFeedbackKind.UserReview,
			state: AgentFeedbackState.Accepted,
		};
		let getWidgetCallCount = 0;
		let listener: ((event: IAgentFeedbackChangeEvent) => void) | undefined;

		const feedbackService = new class extends mock<IAgentFeedbackService>() {
			override onDidChangeFeedback = (callback: (event: IAgentFeedbackChangeEvent) => void) => {
				listener = callback;
				return { dispose: () => { listener = undefined; } };
			};
			override getFeedback(): readonly IAgentFeedback[] { return [feedback]; }
		};
		const widgetService = new class extends mock<IChatWidgetService>() {
			override getAllWidgets(): readonly IChatWidget[] { return []; }
			override onDidAddWidget = Event.None;
			override onDidRemoveWidget = Event.None;
			override getWidgetBySessionResource(_sessionResource: URI): IChatWidget | undefined {
				getWidgetCallCount++;
				throw new Error('attachments should not be read for agent host sessions');
			}
		};
		const sessionsManagementService = new class extends mock<ISessionsManagementService>() {
			override onDidChangeSessions = Event.None;
			override getSession(resource: URI): ISession | undefined {
				return resource.toString() === sessionResource.toString()
					? { providerId: LOCAL_AGENT_HOST_PROVIDER_ID, status: observableValue('status', SessionStatus.InProgress) } as unknown as ISession
					: undefined;
			}
		};

		store.add(new AgentFeedbackAttachmentContribution(feedbackService, widgetService, sessionsManagementService, idleProvidersService()));
		assert.ok(listener, 'expected feedback listener to be registered');

		listener!({ sessionResource, feedbackItems: [feedback] });

		assert.strictEqual(getWidgetCallCount, 0);
	});

	test('attaches accepted feedback once the session chat loads after the comments', () => {
		const sessionResource = URI.parse('copilot-chat:/session-late');
		const feedback: IAgentFeedback = {
			id: 'feedback-late',
			text: 'Queue this comment',
			resourceUri: URI.file('/workspace/a.ts'),
			range: new Range(4, 1, 4, 8),
			sessionResource,
			kind: AgentFeedbackKind.UserReview,
			state: AgentFeedbackState.Accepted,
		};
		let listener: ((event: IAgentFeedbackChangeEvent) => void) | undefined;
		let marked = 0;
		const feedbackService = new class extends mock<IAgentFeedbackService>() {
			override onDidChangeFeedback = (callback: (event: IAgentFeedbackChangeEvent) => void) => {
				listener = callback;
				return { dispose: () => { listener = undefined; } };
			};
			override getFeedback(): readonly IAgentFeedback[] { return [feedback]; }
			override markFeedbackSubmitted(): void { marked++; }
		};

		const onDidChangeViewModel = store.add(new Emitter<IChatWidgetViewModelChangeEvent>());
		const onDidSubmitAgent = store.add(new Emitter<void>());
		const onDidAddWidget = store.add(new Emitter<IChatWidget>());
		const added: IAgentFeedbackVariableEntry[] = [];
		let loaded = false;
		let viewModel: { sessionResource: URI } | undefined;
		const widget = {
			get viewModel() { return viewModel; },
			onDidChangeViewModel: onDidChangeViewModel.event,
			onDidSubmitAgent: onDidSubmitAgent.event as unknown as IChatWidget['onDidSubmitAgent'],
			attachmentModel: {
				attachments: [] as { id: string }[],
				delete(id: string) {
					const index = this.attachments.findIndex(entry => entry.id === id);
					if (index >= 0) {
						this.attachments.splice(index, 1);
					}
				},
				addContext(entry: IAgentFeedbackVariableEntry) {
					this.attachments.push(entry);
					added.push(entry);
				},
			},
		} as unknown as IChatWidget;
		const widgetService = new class extends mock<IChatWidgetService>() {
			override getAllWidgets(): readonly IChatWidget[] { return [widget]; }
			override onDidAddWidget = onDidAddWidget.event;
			override onDidRemoveWidget = Event.None;
			override getWidgetBySessionResource(resource: URI): IChatWidget | undefined {
				return loaded && resource.toString() === sessionResource.toString() ? widget : undefined;
			}
		};
		const sessionsManagementService = new class extends mock<ISessionsManagementService>() {
			override getSession(): ISession | undefined { return undefined; }
		};

		store.add(new AgentFeedbackAttachmentContribution(feedbackService, widgetService, sessionsManagementService, idleProvidersService()));
		assert.ok(listener);

		listener!({ sessionResource, feedbackItems: [feedback] });
		assert.deepStrictEqual(added.map(entry => entry.id), []);

		loaded = true;
		viewModel = { sessionResource };
		onDidChangeViewModel.fire({ previousSessionResource: undefined, currentSessionResource: sessionResource });

		assert.deepStrictEqual({
			ids: added.map(entry => entry.id),
			texts: added[0]?.feedbackItems.map(item => item.text),
		}, {
			ids: [`agentFeedback:${sessionResource.toString()}`],
			texts: ['Queue this comment'],
		});

		onDidSubmitAgent.fire();
		assert.strictEqual(marked, 1);
	});

	test('does not resolve accepted feedback after the chat widget switches sessions', () => {
		const sessionA = URI.parse('copilot-chat:/session-a');
		const sessionB = URI.parse('copilot-chat:/session-b');
		const feedbackFor = (sessionResource: URI, id: string, text: string): IAgentFeedback => ({
			id,
			text,
			resourceUri: URI.file('/workspace/a.ts'),
			range: new Range(2, 1, 2, 4),
			sessionResource,
			kind: AgentFeedbackKind.UserReview,
			state: AgentFeedbackState.Accepted,
		});
		const feedbackA = feedbackFor(sessionA, 'feedback-a', 'Comment A');
		const feedbackB = feedbackFor(sessionB, 'feedback-b', 'Comment B');
		const marked: string[] = [];
		let listener: ((event: IAgentFeedbackChangeEvent) => void) | undefined;
		const feedbackService = new class extends mock<IAgentFeedbackService>() {
			override onDidChangeFeedback = (callback: (event: IAgentFeedbackChangeEvent) => void) => {
				listener = callback;
				return { dispose: () => { listener = undefined; } };
			};
			override getFeedback(resource: URI): readonly IAgentFeedback[] {
				if (resource.toString() === sessionA.toString()) {
					return [feedbackA];
				}
				if (resource.toString() === sessionB.toString()) {
					return [feedbackB];
				}
				return [];
			}
			override markFeedbackSubmitted(resource: URI): void {
				marked.push(resource.toString());
			}
		};
		const tracked = createTrackedChatWidget(store, sessionA);
		const widgetService = new class extends mock<IChatWidgetService>() {
			override getAllWidgets(): readonly IChatWidget[] { return [tracked.widget]; }
			override onDidAddWidget = Event.None;
			override onDidRemoveWidget = Event.None;
			override getWidgetBySessionResource(resource: URI): IChatWidget | undefined {
				return tracked.widget.viewModel?.sessionResource.toString() === resource.toString() ? tracked.widget : undefined;
			}
		};
		const sessionsManagementService = new class extends mock<ISessionsManagementService>() {
			override getSession(): ISession | undefined { return undefined; }
		};

		store.add(new AgentFeedbackAttachmentContribution(feedbackService, widgetService, sessionsManagementService, idleProvidersService()));
		assert.ok(listener);
		listener!({ sessionResource: sessionA, feedbackItems: [feedbackA] });

		tracked.setSession(sessionB);
		const attachmentsOnB = tracked.attachmentSnapshot();
		tracked.submit();
		const markedAfterB = [...marked];

		tracked.setSession(sessionA);
		tracked.submit();

		assert.deepStrictEqual({
			attachmentsOnB,
			markedAfterB,
			attachmentsOnA: tracked.attachmentSnapshot(),
			marked,
		}, {
			attachmentsOnB: [{ id: `agentFeedback:${sessionB.toString()}`, texts: ['Comment B'] }],
			markedAfterB: [sessionB.toString()],
			attachmentsOnA: [{ id: `agentFeedback:${sessionA.toString()}`, texts: ['Comment A'] }],
			marked: [sessionB.toString(), sessionA.toString()],
		});
	});

	test('keeps the feedback attachment on the widget that takes over the session', () => {
		const sessionResource = URI.parse('copilot-chat:/session-move');
		const feedback: IAgentFeedback = {
			id: 'feedback-move',
			text: 'Follow the session',
			resourceUri: URI.file('/workspace/a.ts'),
			range: new Range(5, 1, 5, 3),
			sessionResource,
			kind: AgentFeedbackKind.UserReview,
			state: AgentFeedbackState.Accepted,
		};
		const marked: string[] = [];
		let listener: ((event: IAgentFeedbackChangeEvent) => void) | undefined;
		const feedbackService = new class extends mock<IAgentFeedbackService>() {
			override onDidChangeFeedback = (callback: (event: IAgentFeedbackChangeEvent) => void) => {
				listener = callback;
				return { dispose: () => { listener = undefined; } };
			};
			override getFeedback(resource: URI): readonly IAgentFeedback[] {
				return resource.toString() === sessionResource.toString() ? [feedback] : [];
			}
			override markFeedbackSubmitted(resource: URI): void {
				marked.push(resource.toString());
			}
		};
		const first = createTrackedChatWidget(store, sessionResource);
		const second = createTrackedChatWidget(store, undefined);
		const widgets = [first.widget, second.widget];
		const widgetService = new class extends mock<IChatWidgetService>() {
			override getAllWidgets(): readonly IChatWidget[] { return widgets; }
			override onDidAddWidget = Event.None;
			override onDidRemoveWidget = Event.None;
			override getWidgetBySessionResource(resource: URI): IChatWidget | undefined {
				return widgets.find(widget => widget.viewModel?.sessionResource.toString() === resource.toString());
			}
		};
		const sessionsManagementService = new class extends mock<ISessionsManagementService>() {
			override getSession(): ISession | undefined { return undefined; }
		};

		store.add(new AgentFeedbackAttachmentContribution(feedbackService, widgetService, sessionsManagementService, idleProvidersService()));
		assert.ok(listener);
		listener!({ sessionResource, feedbackItems: [feedback] });

		second.setSession(sessionResource);
		const whileBothShowSession = {
			first: first.attachmentSnapshot(),
			second: second.attachmentSnapshot(),
		};
		first.setSession(undefined);
		first.submit();
		const markedAfterFirstSubmit = [...marked];
		second.submit();

		assert.deepStrictEqual({
			whileBothShowSession,
			afterFirstLeaves: {
				first: first.attachmentSnapshot(),
				second: second.attachmentSnapshot(),
			},
			markedAfterFirstSubmit,
			marked,
		}, {
			whileBothShowSession: {
				first: [{ id: `agentFeedback:${sessionResource.toString()}`, texts: ['Follow the session'] }],
				second: [{ id: `agentFeedback:${sessionResource.toString()}`, texts: ['Follow the session'] }],
			},
			afterFirstLeaves: {
				first: [],
				second: [{ id: `agentFeedback:${sessionResource.toString()}`, texts: ['Follow the session'] }],
			},
			markedAfterFirstSubmit: [],
			marked: [sessionResource.toString()],
		});
	});

	test('drops the reactive attachment once the session resolves as an agent host', () => {
		const sessionResource = URI.parse('copilot-chat:/session-host');
		const feedback: IAgentFeedback = {
			id: 'feedback-host',
			text: 'Do not keep this pill',
			resourceUri: URI.file('/workspace/a.ts'),
			range: new Range(3, 1, 3, 4),
			sessionResource,
			kind: AgentFeedbackKind.UserReview,
			state: AgentFeedbackState.Accepted,
		};
		let providerId: string | undefined;
		let feedbackListener: ((event: IAgentFeedbackChangeEvent) => void) | undefined;
		const marked: string[] = [];
		const sessionsChanged = store.add(new Emitter<ISessionsChangeEvent>());
		const providersChanged = store.add(new Emitter<ISessionsProvidersChangeEvent>());
		const feedbackService = new class extends mock<IAgentFeedbackService>() {
			override onDidChangeFeedback = (callback: (event: IAgentFeedbackChangeEvent) => void) => {
				feedbackListener = callback;
				return { dispose: () => { feedbackListener = undefined; } };
			};
			override getFeedback(resource: URI): readonly IAgentFeedback[] {
				return resource.toString() === sessionResource.toString() ? [feedback] : [];
			}
			override markFeedbackSubmitted(resource: URI): void {
				marked.push(resource.toString());
			}
		};
		const tracked = createTrackedChatWidget(store, sessionResource);
		const widgetService = new class extends mock<IChatWidgetService>() {
			override getAllWidgets(): readonly IChatWidget[] { return [tracked.widget]; }
			override onDidAddWidget = Event.None;
			override onDidRemoveWidget = Event.None;
		};
		const sessionsManagementService = new class extends mock<ISessionsManagementService>() {
			override onDidChangeSessions = sessionsChanged.event;
			override getSession(resource: URI): ISession | undefined {
				if (!providerId || resource.toString() !== sessionResource.toString()) {
					return undefined;
				}
				return { providerId, status: observableValue('status', SessionStatus.InProgress) } as unknown as ISession;
			}
		};
		const providersService = new class extends mock<ISessionsProvidersService>() {
			override onDidChangeProviders = providersChanged.event;
		};
		const attachmentId = `agentFeedback:${sessionResource.toString()}`;
		const pill = [{ id: attachmentId, texts: ['Do not keep this pill'] }];

		store.add(new AgentFeedbackAttachmentContribution(feedbackService, widgetService, sessionsManagementService, providersService));
		assert.ok(feedbackListener);
		feedbackListener!({ sessionResource, feedbackItems: [feedback] });
		const whileUnknown = tracked.attachmentSnapshot();

		providerId = LOCAL_AGENT_HOST_PROVIDER_ID;
		feedbackListener!({ sessionResource, feedbackItems: [feedback] });
		const afterFeedbackRecognized = tracked.attachmentSnapshot();
		tracked.submit();

		providerId = undefined;
		feedbackListener!({ sessionResource, feedbackItems: [feedback] });
		const restoredWhileUnknown = tracked.attachmentSnapshot();
		providerId = LOCAL_AGENT_HOST_PROVIDER_ID;
		sessionsChanged.fire({ added: [], removed: [], changed: [] });
		const afterSessionsChanged = tracked.attachmentSnapshot();

		providerId = undefined;
		feedbackListener!({ sessionResource, feedbackItems: [feedback] });
		providerId = LOCAL_AGENT_HOST_PROVIDER_ID;
		providersChanged.fire({ added: [], removed: [] });
		tracked.submit();

		assert.deepStrictEqual({
			whileUnknown,
			afterFeedbackRecognized,
			restoredWhileUnknown,
			afterSessionsChanged,
			afterProvidersChanged: tracked.attachmentSnapshot(),
			marked,
		}, {
			whileUnknown: pill,
			afterFeedbackRecognized: [],
			restoredWhileUnknown: pill,
			afterSessionsChanged: [],
			afterProvidersChanged: [],
			marked: [],
		});
	});

	test('formats new-session prompts with comment locations and nested replies', () => {
		const sessionResource = URI.parse('agent-feedback:/new-session');
		const feedback = (id: string, text: string, path: string, range: Range, replies?: readonly string[]): IAgentFeedback => ({
			id,
			text,
			resourceUri: URI.file(path),
			range,
			sessionResource,
			kind: AgentFeedbackKind.UserReview,
			state: AgentFeedbackState.Accepted,
			replies: replies?.map(text => ({ text, author: 'user' as const })),
		});
		const roots = [URI.file('/workspace'), URI.file('/second-root')];
		const first = feedback('one', 'Fix this', '/workspace/src/a.ts', new Range(10, 2, 12, 4), ['Also cover null', 'Keep the\nerror detail']);
		const second = feedback('two', 'Rename this', '/workspace/src/b.ts', new Range(3, 1, 3, 8));
		const inSecondRoot = feedback('three', 'Update this', '/second-root/lib/c.ts', new Range(7, 1, 7, 5));
		const outsideWorkspace = feedback('four', 'Check this', '/elsewhere/d.ts', new Range(1, 1, 1, 2));

		assert.deepStrictEqual({
			promptAndComments: buildNewSessionPrompt('Implement the change', [first, second], roots),
			singleComment: buildNewSessionPrompt('', [first], roots),
			multipleComments: buildNewSessionPrompt('', [first, second], roots),
			multiRoot: buildNewSessionPrompt('', [second, inSecondRoot, outsideWorkspace], roots),
		}, {
			promptAndComments: 'Implement the change\n- Fix this (src/a.ts:10:2-12:4)\n  - reply: Also cover null\n  - reply: Keep the\n    error detail\n- Rename this (src/b.ts:3:1-3:8)',
			singleComment: 'Fix this (src/a.ts:10:2-12:4)\n  - reply: Also cover null\n  - reply: Keep the\n    error detail',
			multipleComments: '- Fix this (src/a.ts:10:2-12:4)\n  - reply: Also cover null\n  - reply: Keep the\n    error detail\n- Rename this (src/b.ts:3:1-3:8)',
			multiRoot: '- Rename this (src/b.ts:3:1-3:8)\n- Update this (lib/c.ts:7:1-7:5)\n- Check this (/elsewhere/d.ts:1:1-1:2)',
		});
	});

	test('single comment uses a preview label and reveals directly', () => {
		const instantiationService = store.add(new TestInstantiationService());
		const sessionResource = URI.parse('agent-host-copilot:/session-1');
		const revealedFeedbackIds: string[] = [];
		const feedbackService = new class extends mock<IAgentFeedbackService>() {
			override async revealFeedback(_sessionResource: URI, feedbackId: string): Promise<void> {
				revealedFeedbackIds.push(feedbackId);
			}
		};
		const hoverService = new TestHoverService();
		const contextViewService = new TestContextViewService();
		instantiationService.stub(IAgentFeedbackService, feedbackService);
		instantiationService.stub(IHoverService, hoverService);
		instantiationService.stub(IContextViewService, contextViewService);
		instantiationService.stub(ILanguageService, new class extends mock<ILanguageService>() { });
		instantiationService.stub(IThemeService, new class extends mock<IThemeService>() { });

		const attachment: IAgentFeedbackVariableEntry = {
			kind: 'agentFeedback',
			id: 'attachment-1',
			name: '1 comment',
			value: '1 comment',
			sessionResource,
			feedbackItems: [
				{ id: 'comment-1', text: 'abcdefghijklmnopqrstuvwxyz', resourceUri: URI.file('/workspace/a.ts'), range: new Range(1, 1, 1, 1) },
			],
		};
		const container = document.createElement('div');
		const widget = store.add(instantiationService.createInstance(
			AgentFeedbackAttachmentWidget,
			attachment,
			{ shouldFocusClearButton: false, supportsDeletion: false },
			container,
		));

		widget.element.click();
		widget.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

		const hoverOptions = typeof hoverService.hoverOptions === 'function' ? hoverService.hoverOptions() : hoverService.hoverOptions;
		assert.deepStrictEqual({
			label: widget.element.textContent,
			hoverContent: hoverOptions?.content,
			contextViewShowCount: contextViewService.showCount,
			revealedFeedbackIds,
		}, {
			label: 'abcdefghijklmnopqrstuvwxy…',
			hoverContent: 'View comments',
			contextViewShowCount: 0,
			revealedFeedbackIds: ['comment-1', 'comment-1'],
		});
	});

	test('does not leak unhandled rejection when revealFeedback rejects on a single comment', async () => {
		const instantiationService = store.add(new TestInstantiationService());
		const sessionResource = URI.parse('agent-host-copilot:/session-1');
		const feedbackService = new class extends mock<IAgentFeedbackService>() {
			override async revealFeedback(_sessionResource: URI, _feedbackId: string): Promise<void> {
				throw new Error('boom');
			}
		};
		instantiationService.stub(IAgentFeedbackService, feedbackService);
		instantiationService.stub(IHoverService, new TestHoverService());
		instantiationService.stub(IContextViewService, new TestContextViewService());
		instantiationService.stub(ILanguageService, new class extends mock<ILanguageService>() { });
		instantiationService.stub(IThemeService, new class extends mock<IThemeService>() { });

		const attachment: IAgentFeedbackVariableEntry = {
			kind: 'agentFeedback',
			id: 'attachment-1',
			name: '1 comment',
			value: '1 comment',
			sessionResource,
			feedbackItems: [
				{ id: 'comment-1', text: 'Check this', resourceUri: URI.file('/workspace/a.ts'), range: new Range(1, 1, 1, 1) },
			],
		};
		const container = document.createElement('div');
		const widget = store.add(instantiationService.createInstance(
			AgentFeedbackAttachmentWidget,
			attachment,
			{ shouldFocusClearButton: false, supportsDeletion: false },
			container,
		));

		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(() => { });
		try {
			widget.element.click();
			await timeout(0);
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('multiple comments toggle a context view without revealing a comment', () => {
		const instantiationService = store.add(new TestInstantiationService());
		const sessionResource = URI.parse('agent-host-copilot:/session-1');
		const revealedFeedbackIds: string[] = [];
		const feedbackService = new class extends mock<IAgentFeedbackService>() {
			override async revealFeedback(_sessionResource: URI, feedbackId: string): Promise<void> {
				revealedFeedbackIds.push(feedbackId);
			}
		};
		const contextViewService = new TestContextViewService();
		instantiationService.stub(IAgentFeedbackService, feedbackService);
		instantiationService.stub(IHoverService, new TestHoverService());
		instantiationService.stub(IContextViewService, contextViewService);
		instantiationService.stub(ILanguageService, new class extends mock<ILanguageService>() { });
		instantiationService.stub(IThemeService, new class extends mock<IThemeService>() { });

		const attachment: IAgentFeedbackVariableEntry = {
			kind: 'agentFeedback',
			id: 'attachment-1',
			name: '2 comments',
			value: '2 comments',
			sessionResource,
			feedbackItems: [
				{ id: 'comment-1', text: 'First', resourceUri: URI.file('/workspace/a.ts'), range: new Range(1, 1, 1, 1) },
				{ id: 'comment-2', text: 'Second', resourceUri: URI.file('/workspace/b.ts'), range: new Range(2, 1, 2, 1) },
			],
		};
		const container = document.createElement('div');
		const widget = store.add(instantiationService.createInstance(
			AgentFeedbackAttachmentWidget,
			attachment,
			{ shouldFocusClearButton: false, supportsDeletion: false },
			container,
		));

		widget.element.click();
		const expandedAfterOpen = widget.element.ariaExpanded;
		let escapePrevented = false;
		let escapePropagationStopped = false;
		contextViewService.delegate?.onDOMEvent?.({
			browserEvent: { type: 'keydown' },
			keyCode: KeyCode.Escape,
			preventDefault: () => { escapePrevented = true; },
			stopPropagation: () => { escapePropagationStopped = true; },
		}, widget.element);
		const expandedAfterEscape = widget.element.ariaExpanded;
		widget.element.click();
		widget.element.click();

		assert.deepStrictEqual({
			label: widget.element.textContent,
			ariaHasPopup: widget.element.ariaHasPopup,
			expandedAfterOpen,
			expandedAfterEscape,
			expandedAfterClose: widget.element.ariaExpanded,
			escapePrevented,
			escapePropagationStopped,
			contextViewShowCount: contextViewService.showCount,
			contextViewCloseCount: contextViewService.closeCount,
			revealedFeedbackIds,
		}, {
			label: '2 comments',
			ariaHasPopup: 'tree',
			expandedAfterOpen: 'true',
			expandedAfterEscape: 'false',
			expandedAfterClose: 'false',
			escapePrevented: true,
			escapePropagationStopped: true,
			contextViewShowCount: 2,
			contextViewCloseCount: 2,
			revealedFeedbackIds: [],
		});
	});

	test('does not leak unhandled rejection when revealFeedback rejects from a context view comment', async () => {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const sessionResource = URI.parse('agent-host-copilot:/session-1');
		let revealCalls = 0;
		const feedbackService = new class extends mock<IAgentFeedbackService>() {
			override async revealFeedback(_sessionResource: URI, _feedbackId: string): Promise<void> {
				revealCalls++;
				throw new Error('boom');
			}
		};
		instantiationService.stub(IAgentFeedbackService, feedbackService);
		instantiationService.stub(IContextViewService, new RenderingTestContextViewService());

		const attachment: IAgentFeedbackVariableEntry = {
			kind: 'agentFeedback',
			id: 'attachment-1',
			name: '2 comments',
			value: '2 comments',
			sessionResource,
			feedbackItems: [
				{ id: 'comment-1', text: 'First', resourceUri: URI.file('/workspace/a.ts'), range: new Range(1, 1, 1, 1) },
				{ id: 'comment-2', text: 'Second', resourceUri: URI.file('/workspace/b.ts'), range: new Range(2, 1, 2, 1) },
			],
		};
		const container = document.createElement('div');
		document.body.appendChild(container);
		store.add(toDisposable(() => container.remove()));
		const widget = store.add(instantiationService.createInstance(
			AgentFeedbackAttachmentWidget,
			attachment,
			{ shouldFocusClearButton: false, supportsDeletion: false },
			container,
		));

		widget.element.click();

		type FeedbackTreeElement = { readonly type: 'file' | 'comment'; readonly id?: string };
		const tree = (widget as unknown as {
			_contextView: { _tree: WorkbenchObjectTree<FeedbackTreeElement> | undefined };
		})._contextView._tree;
		assert.ok(tree, 'context view onDidOpen cannot be driven: tree did not render');
		const comment = tree.getNode(null)?.children[0]?.children[0]?.element;
		assert.ok(comment && comment.type === 'comment', 'expected a rendered comment row');

		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(() => { });
		try {
			tree.setFocus([comment]);
			tree.setSelection([comment], getSelectionKeyboardEvent('keydown', false, false));
			await timeout(0);
			assert.deepStrictEqual({ revealCalls, unhandledRejections }, { revealCalls: 1, unhandledRejections: [] });
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});
});
