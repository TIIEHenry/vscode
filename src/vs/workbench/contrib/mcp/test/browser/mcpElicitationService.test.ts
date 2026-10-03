/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { IAction } from '../../../../../base/common/actions.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { INotification, INotificationHandle, INotificationService, NoOpProgress } from '../../../../../platform/notification/common/notification.js';
import { TestNotificationService } from '../../../../../platform/notification/test/common/testNotificationService.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { ChatModel } from '../../../chat/common/model/chatModel.js';
import { LocalChatSessionUri } from '../../../chat/common/model/chatUri.js';
import { IChatService } from '../../../chat/common/chatService/chatService.js';
import { ChatElicitationRequestPart } from '../../../chat/common/model/chatProgressTypes/chatElicitationRequestPart.js';
import { McpElicitationService } from '../../browser/mcpElicitationService.js';
import { ContributionEnablementState } from '../../../chat/common/enablement.js';
import { IMcpServer, IMcpToolCallContext, McpConnectionState, McpServerCacheState } from '../../common/mcpTypes.js';
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
}): McpElicitationService {
	const chatService = new class extends mock<IChatService>() {
		override getSession(resource: URI): ReturnType<IChatService['getSession']> {
			return options.getSession?.(resource) as ReturnType<IChatService['getSession']>;
		}
	}();

	const services = new ServiceCollection(
		[INotificationService, options.notificationService],
		[IQuickInputService, new (mock<IQuickInputService>())()],
		[IChatService, chatService],
		[IOpenerService, new (mock<IOpenerService>())()],
	);
	const insta = store.add(new TestInstantiationService(services));
	return insta.createInstance(McpElicitationService);
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
});
