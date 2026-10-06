/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { IAction } from '../../../../../base/common/actions.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { INotification, INotificationHandle, INotificationService, NoOpProgress } from '../../../../../platform/notification/common/notification.js';
import { TestNotificationService } from '../../../../../platform/notification/test/common/testNotificationService.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IQuickInputButton, IQuickInputService, IQuickPick, IQuickPickDidAcceptEvent, IQuickPickItem, QuickInputHideReason } from '../../../../../platform/quickinput/common/quickInput.js';
import { ChatModel } from '../../../chat/common/model/chatModel.js';
import { LocalChatSessionUri } from '../../../chat/common/model/chatUri.js';
import { IChatService } from '../../../chat/common/chatService/chatService.js';
import { ChatElicitationRequestPart } from '../../../chat/common/model/chatProgressTypes/chatElicitationRequestPart.js';
import { McpElicitationService } from '../../browser/mcpElicitationService.js';
import { ContributionEnablementState } from '../../../chat/common/enablement.js';
import { ElicitResult, IMcpServer, IMcpToolCallContext, McpConnectionState, McpServerCacheState } from '../../common/mcpTypes.js';
import { MCP } from '../../../../../platform/mcp/common/modelContextProtocol.js';

class ControllableNotificationHandle implements INotificationHandle {
	private readonly _onDidClose = new Emitter<void>();
	readonly onDidClose = this._onDidClose.event;
	readonly onDidChangeVisibility = Event.None;
	readonly progress = new NoOpProgress();

	close(): void {
		this._onDidClose.fire();
	}

	updateSeverity(): void { }
	updateMessage(): void { }
	updateActions(): void { }
}

class RecordingNotificationService extends TestNotificationService {
	readonly notifications: INotification[] = [];
	readonly handles: ControllableNotificationHandle[] = [];

	override notify(notification: INotification): INotificationHandle {
		this.notifications.push(notification);
		const handle = new ControllableNotificationHandle();
		this.handles.push(handle);
		return handle;
	}
}

function createTestServer(store: Pick<DisposableStore, 'add'>): IMcpServer {
	const owner = {};
	return {
		collection: { id: 'collection', label: 'Collection', order: 0 },
		definition: { id: 'server', label: 'Test Server' },
		connection: observableValue(owner, undefined),
		connectionState: observableValue(owner, { state: McpConnectionState.Kind.Running }),
		enablement: observableValue(owner, ContributionEnablementState.EnabledProfile),
		serverMetadata: observableValue(owner, undefined),
		readDefinitions: () => observableValue(owner, { server: undefined, collection: undefined }),
		showOutput: async () => { },
		start: async () => ({ state: McpConnectionState.Kind.Running }),
		stop: async () => { },
		cacheState: observableValue(owner, McpServerCacheState.Live),
		tools: observableValue(owner, []),
		prompts: observableValue(owner, []),
		capabilities: observableValue(owner, undefined),
		resources: () => (async function* () { })(),
		resourceTemplates: async () => [],
		dispose: () => { },
	};
}

class FakeQuickPick<T extends IQuickPickItem> extends Disposable implements IQuickPick<T> {
	declare readonly type: 'quickPick';
	title!: string;
	step = 1;
	totalSteps = 1;
	placeholder = '';
	private _value = '';
	validationMessage = '';
	ignoreFocusOut = false;
	canSelectMany = false;
	items: readonly (T | { type: 'separator' })[] = [];
	activeItems: readonly T[] = [];
	selectedItems: readonly T[] = [];
	buttons: readonly IQuickInputButton[] = [];
	severity = 0;
	visible = false;

	private readonly _onDidAccept = this._register(new Emitter<IQuickPickDidAcceptEvent>());
	readonly onDidAccept = this._onDidAccept.event;
	private readonly _onDidHide = this._register(new Emitter<{ reason: QuickInputHideReason }>());
	readonly onDidHide = this._onDidHide.event;
	private readonly _onDidTriggerButton = this._register(new Emitter<IQuickInputButton>());
	readonly onDidTriggerButton = this._onDidTriggerButton.event;
	private readonly _onDidChangeValue = this._register(new Emitter<string>());
	readonly onDidChangeValue = this._onDidChangeValue.event;
	readonly onDidChangeActive = Event.None;
	readonly onDidTriggerItemButton = Event.None;
	readonly onDidTriggerSeparatorButton = Event.None;

	get value(): string {
		return this._value;
	}

	set value(value: string) {
		if (this._value !== value) {
			this._value = value;
			this._onDidChangeValue.fire(value);
		}
	}

	show(): void {
		this.visible = true;
	}

	hide(): void {
		if (!this.visible) {
			return;
		}
		this.visible = false;
		this._onDidHide.fire({ reason: QuickInputHideReason.Other });
	}

	dispose(): void {
		this.hide();
		super.dispose();
	}

	fireAccept(): void {
		if (!this.canSelectMany) {
			this.selectedItems = this.activeItems.length ? [...this.activeItems] : [];
		}
		this._onDidAccept.fire({ inBackground: false });
	}
}

function formElicitation(properties: Record<string, MCP.PrimitiveSchemaDefinition>, required?: string[]): MCP.ElicitRequestFormParams {
	return {
		mode: 'form',
		message: 'Form elicitation',
		elicitationId: 'form-test',
		requestedSchema: {
			type: 'object',
			properties,
			required,
		},
	};
}

function urlElicitation(): MCP.ElicitRequestURLParams {
	return {
		mode: 'url',
		message: 'Authorize this app',
		url: 'https://example.com/oauth',
		elicitationId: 'elicit-test',
	};
}

function createService(store: Pick<DisposableStore, 'add'>, options: {
	notificationService: RecordingNotificationService;
	getSession?: (resource: URI) => unknown;
	quickPick?: FakeQuickPick<IQuickPickItem>;
}): McpElicitationService {
	const chatService = new class extends mock<IChatService>() {
		override getSession(resource: URI): ReturnType<IChatService['getSession']> {
			return options.getSession?.(resource) as ReturnType<IChatService['getSession']>;
		}
	}();

	const quickPick = options.quickPick ?? new FakeQuickPick<IQuickPickItem>();
	store.add(quickPick);
	const quickInputService = new class extends mock<IQuickInputService>() {
		override backButton = { iconClass: '', tooltip: '' };
		override createQuickPick<T extends IQuickPickItem>(): IQuickPick<T> {
			return quickPick as IQuickPick<T>;
		}
	}();

	const services = new ServiceCollection(
		[INotificationService, options.notificationService],
		[IQuickInputService, quickInputService],
		[IChatService, chatService],
		[IOpenerService, new (mock<IOpenerService>())()],
	);
	const insta = store.add(new TestInstantiationService(services));
	return insta.createInstance(McpElicitationService);
}

function beginFormElicitation(
	store: Pick<DisposableStore, 'add'>,
	notifications: RecordingNotificationService,
	server: IMcpServer,
	elicitation: MCP.ElicitRequestFormParams,
): { resultPromise: Promise<ElicitResult>; quickPick: FakeQuickPick<IQuickPickItem> } {
	const quickPick = new FakeQuickPick<IQuickPickItem>();
	const service = createService(store, { notificationService: notifications, quickPick });
	const resultPromise = service.elicit(server, undefined, elicitation, CancellationToken.None);
	assert.strictEqual(notifications.notifications.length, 1);
	const respondAction = notifications.notifications[0].actions?.primary?.[0] as IAction;
	assert.ok(respondAction);
	void respondAction.run(undefined);
	return { resultPromise, quickPick };
}

function pickItemById(quickPick: FakeQuickPick<IQuickPickItem>, id: string | undefined): IQuickPickItem {
	const item = quickPick.items.find(i => i.type !== 'separator' && i.id === id);
	assert.ok(item);
	return item as IQuickPickItem;
}

async function waitForQuickPickVisible(quickPick: FakeQuickPick<IQuickPickItem>): Promise<void> {
	for (let i = 0; i < 50 && !quickPick.visible; i++) {
		await new Promise(resolve => setTimeout(resolve, 0));
	}
	assert.ok(quickPick.visible);
}

function createChatModel(getRequests: () => readonly unknown[]): ChatModel {
	const chatModel = Object.create(ChatModel.prototype) as ChatModel;
	(chatModel as unknown as { getRequests: () => readonly unknown[] }).getRequests = getRequests;
	(chatModel as unknown as { acceptResponseProgress: (request: unknown, part: unknown) => void }).acceptResponseProgress = () => { };
	return chatModel;
}

suite('McpElicitationService', () => {
	const ds = ensureNoDisposablesAreLeakedInTestSuite();

	test('url elicit with no chat request uses the notification', async () => {
		const notifications = new RecordingNotificationService();
		const sessionResource = LocalChatSessionUri.forSession('empty-session');
		const chatModel = createChatModel(() => []);
		const service = createService(ds, {
			notificationService: notifications,
			getSession: resource => resource.toString() === sessionResource.toString() ? chatModel : undefined,
		});
		const server = createTestServer(ds);
		const context: IMcpToolCallContext = { chatSessionResource: sessionResource };
		const elicitation = urlElicitation();

		const declinePromise = service.elicit(server, context, elicitation, CancellationToken.None);
		assert.strictEqual(notifications.notifications.length, 1);

		const cancelAction = notifications.notifications[0].actions?.secondary?.[0] as IAction | undefined;
		assert.ok(cancelAction);
		await cancelAction.run(undefined);
		const declineResult = await declinePromise;
		declineResult.dispose();
		assert.strictEqual(declineResult.value.action, 'decline');

		const notifications2 = new RecordingNotificationService();
		const service2 = createService(ds, {
			notificationService: notifications2,
			getSession: resource => resource.toString() === sessionResource.toString() ? chatModel : undefined,
		});
		const closePromise = service2.elicit(server, context, elicitation, CancellationToken.None);
		assert.strictEqual(notifications2.notifications.length, 1);
		notifications2.handles[0].close();
		const cancelResult = await closePromise;
		cancelResult.dispose();
		assert.strictEqual(cancelResult.value.action, 'cancel');

		const notifications3 = new RecordingNotificationService();
		const service3 = createService(ds, { notificationService: notifications3 });
		const noContextPromise = service3.elicit(server, undefined, elicitation, CancellationToken.None);
		assert.strictEqual(notifications3.notifications.length, 1);
		notifications3.handles[0].close();
		const noContextResult = await noContextPromise;
		noContextResult.dispose();
		assert.strictEqual(noContextResult.value.action, 'cancel');
	});

	test('url elicit chat card cancels with the token', async () => {
		const notifications = new RecordingNotificationService();
		const sessionResource = LocalChatSessionUri.forSession('active-session');
		const request = { id: 'req-1' };
		let elicitationPart: ChatElicitationRequestPart | undefined;
		const chatModel = createChatModel(() => [request]);
		(chatModel as unknown as { acceptResponseProgress: (req: unknown, part: unknown) => void }).acceptResponseProgress = (_req, part) => {
			elicitationPart = part as ChatElicitationRequestPart;
		};

		const service = createService(ds, {
			notificationService: notifications,
			getSession: resource => resource.toString() === sessionResource.toString() ? chatModel : undefined,
		});
		const server = createTestServer(ds);
		const context: IMcpToolCallContext = { chatSessionResource: sessionResource };
		const elicitation = urlElicitation();

		const unhandled: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandled.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);

		try {
			const resultPromise = service.elicit(server, context, elicitation, CancellationToken.Cancelled);
			const result = await resultPromise;
			result.dispose();
			assert.strictEqual(unhandled.length, 0);
			assert.strictEqual(result.value.action, 'cancel');
			assert.ok(elicitationPart);
			assert.strictEqual(notifications.notifications.length, 0);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('form elicitation optional boolean and number fields omit None from content', async () => {
		const notifications = new RecordingNotificationService();
		const server = createTestServer(ds);
		const elicitation = formElicitation({
			flag: { type: 'boolean' },
			count: { type: 'number' },
			whole: { type: 'integer' },
		});
		const { resultPromise, quickPick } = beginFormElicitation(ds, notifications, server, elicitation);
		await waitForQuickPickVisible(quickPick);

		quickPick.activeItems = [pickItemById(quickPick, undefined)];
		quickPick.fireAccept();
		await waitForQuickPickVisible(quickPick);

		quickPick.activeItems = [pickItemById(quickPick, undefined)];
		quickPick.fireAccept();
		await waitForQuickPickVisible(quickPick);

		quickPick.activeItems = [pickItemById(quickPick, undefined)];
		quickPick.fireAccept();

		const result = await resultPromise;
		result.dispose();
		assert.strictEqual(result.value.action, 'accept');
		assert.ok(result.value.action === 'accept' && !('flag' in result.value.content));
		assert.ok(result.value.action === 'accept' && !('count' in result.value.content));
		assert.ok(result.value.action === 'accept' && !('whole' in result.value.content));

		const notifications2 = new RecordingNotificationService();
		const elicitation2 = formElicitation({
			flag: { type: 'boolean' },
			count: { type: 'number' },
		});
		const run2 = beginFormElicitation(ds, notifications2, server, elicitation2);
		await waitForQuickPickVisible(run2.quickPick);
		run2.quickPick.activeItems = [pickItemById(run2.quickPick, 'true')];
		run2.quickPick.fireAccept();
		await waitForQuickPickVisible(run2.quickPick);
		run2.quickPick.value = '42';
		await new Promise(resolve => setTimeout(resolve, 0));
		run2.quickPick.activeItems = [pickItemById(run2.quickPick, '$current')];
		run2.quickPick.fireAccept();
		const result2 = await run2.resultPromise;
		result2.dispose();
		assert.strictEqual(result2.value.action, 'accept');
		if (result2.value.action === 'accept') {
			assert.strictEqual(result2.value.content.flag, true);
			assert.strictEqual(result2.value.content.count, 42);
		}

		const notifications3 = new RecordingNotificationService();
		const elicitation3 = formElicitation({ flag: { type: 'boolean' } });
		const run3 = beginFormElicitation(ds, notifications3, server, elicitation3);
		await waitForQuickPickVisible(run3.quickPick);
		run3.quickPick.activeItems = [pickItemById(run3.quickPick, 'false')];
		run3.quickPick.fireAccept();
		const result3 = await run3.resultPromise;
		result3.dispose();
		if (result3.value.action === 'accept') {
			assert.strictEqual(result3.value.content.flag, false);
		}
	});

	test('form elicitation accept with no selection stays pending until hide', async () => {
		const notifications = new RecordingNotificationService();
		const server = createTestServer(ds);
		const elicitation = formElicitation({ name: { type: 'string' } }, ['name']);
		const { resultPromise, quickPick } = beginFormElicitation(ds, notifications, server, elicitation);
		await waitForQuickPickVisible(quickPick);

		const unhandled: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandled.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);

		try {
			quickPick.value = '';
			quickPick.selectedItems = [];
			quickPick.fireAccept();
			await new Promise(resolve => setTimeout(resolve, 0));
			assert.strictEqual(unhandled.length, 0);

			let settled = false;
			void resultPromise.then(() => { settled = true; });
			await new Promise(resolve => setTimeout(resolve, 0));
			assert.strictEqual(settled, false);

			quickPick.hide();
			const result = await resultPromise;
			result.dispose();
			assert.strictEqual(result.value.action, 'cancel');
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}

		const notifications2 = new RecordingNotificationService();
		const multiElicitation = formElicitation({
			tags: { type: 'array', items: { enum: ['alpha', 'beta'] } },
		});
		const multi = beginFormElicitation(ds, notifications2, server, multiElicitation);
		await waitForQuickPickVisible(multi.quickPick);
		multi.quickPick.canSelectMany = true;
		multi.quickPick.selectedItems = [];
		multi.quickPick.fireAccept();
		await new Promise(resolve => setTimeout(resolve, 0));
		multi.quickPick.activeItems = [pickItemById(multi.quickPick, undefined)];
		multi.quickPick.selectedItems = multi.quickPick.activeItems;
		multi.quickPick.fireAccept();
		const noneResult = await multi.resultPromise;
		noneResult.dispose();
		if (noneResult.value.action === 'accept') {
			assert.ok(!('tags' in noneResult.value.content));
		}

		const notifications3 = new RecordingNotificationService();
		const multiPick = beginFormElicitation(ds, notifications3, server, multiElicitation);
		await waitForQuickPickVisible(multiPick.quickPick);
		multiPick.quickPick.canSelectMany = true;
		const alpha = pickItemById(multiPick.quickPick, 'alpha');
		multiPick.quickPick.activeItems = [alpha];
		multiPick.quickPick.selectedItems = [alpha];
		multiPick.quickPick.fireAccept();
		const pickResult = await multiPick.resultPromise;
		pickResult.dispose();
		if (pickResult.value.action === 'accept') {
			assert.deepStrictEqual(pickResult.value.content.tags, ['alpha']);
		}
	});
});
