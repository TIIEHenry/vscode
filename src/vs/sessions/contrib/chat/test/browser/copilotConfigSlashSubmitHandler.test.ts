/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { isEqual } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { SessionConfigKey } from '../../../../../platform/agentHost/common/sessionConfigKeys.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IChatWidget, IChatWidgetService } from '../../../../../workbench/contrib/chat/browser/chat.js';
import { IChatSubmitRequestHandler, IChatSubmitRequestHandlerService } from '../../../../../workbench/contrib/chat/browser/chatSubmitRequestHandlerService.js';
import { resetShownWarnings } from '../../../../../workbench/contrib/chat/common/chatPermissionWarnings.js';
import { IAgentHostSessionsProvider, LOCAL_AGENT_HOST_PROVIDER_ID } from '../../../../common/agentHostSessionsProvider.js';
import { ISessionsProvidersService } from '../../../../services/sessions/browser/sessionsProvidersService.js';
import { IChat, ISession } from '../../../../services/sessions/common/session.js';
import { ISessionsManagementService } from '../../../../services/sessions/common/sessionsManagement.js';
import { ISessionsProvider } from '../../../../services/sessions/common/sessionsProvider.js';
import { NewChatInputWidget } from '../../browser/newChatInput.js';
import { ISessionsCopilotConfigSlashServices, SessionsCopilotConfigSlashSubmitHandlerContribution, trySessionsCopilotConfigSlashSubmit } from '../../browser/copilotConfigSlashSubmitHandler.js';

const send = Reflect.get(NewChatInputWidget.prototype, '_send') as (this: ISendHarness, background?: boolean) => Promise<boolean>;

interface IConfigWrite {
	readonly sessionId: string;
	readonly key: string;
	readonly value: unknown;
}

interface ISendHarness {
	_editor: {
		getModel(): { getValue(): string; setValue(value: string): void };
		updateOptions(options: { readOnly: boolean }): void;
	};
	options: {
		session: { get(): { resource: URI; providerId: string; sessionId: string; activeChat: { get(): undefined }; isQuickChat: { get(): boolean } } };
		hasAdditionalSendContent?: { get(): boolean };
		sendRequest(request: { query: string }): Promise<boolean>;
		deferredNotificationsEnabled?: { get(): boolean };
	};
	_contextAttachments: { attachments: readonly unknown[]; clear(): void };
	_sending: boolean;
	_canSendRequest: { get(): boolean };
	_sendGeneration: number;
	_store: { isDisposed: boolean };
	_sendButton?: undefined;
	sessionsProvidersService: { getProvider(providerId: string): ISessionsProvider | undefined };
	dialogService: IDialogService;
	storageService: IStorageService;
	chatSubmitRequestHandlerService: { tryHandle(request: unknown): Promise<boolean> };
	logService: { error(message: string, ...args: unknown[]): void };
	notificationService: { error(message: string): void };
	_implicitContexts: { enabledBaseEntries(suggested: boolean): readonly unknown[] };
	configurationService: { getValue(key: string): boolean };
	_draftState?: undefined;
	_loadingDelayDisposable: { value: object; clear(): void };
	sessionTypePicker: { modelTargetChatSessionType: { get(): string } };
	_modelSelection: { state: { get(): object } };
	chatInputNotificationService: { handleMessageSent(context: unknown): void };
}

suite('Copilot config slash submit', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	setup(() => {
		resetShownWarnings();
	});

	function services(options?: { confirm?: boolean }): { services: ISessionsCopilotConfigSlashServices; writes: IConfigWrite[]; prompts: number } {
		const writes: IConfigWrite[] = [];
		let prompts = 0;
		const provider = upcastPartial<IAgentHostSessionsProvider>({
			id: LOCAL_AGENT_HOST_PROVIDER_ID,
			setSessionConfigValue: async (sessionId: string, key: string, value: unknown) => {
				writes.push({ sessionId, key, value });
			},
		});
		return {
			writes,
			get prompts() { return prompts; },
			services: {
				getProvider: () => provider,
				dialogService: upcastPartial<IDialogService>({
					prompt: async () => {
						prompts++;
						return { result: options?.confirm === true, checkboxChecked: false };
					},
				}),
				storageService: upcastPartial<IStorageService>({
					getBoolean: () => false,
				}),
			},
		};
	}

	const target = {
		sessionResource: URI.from({ scheme: 'agent-host-copilotcli', path: '/session' }),
		providerId: LOCAL_AGENT_HOST_PROVIDER_ID,
		sessionId: 'session-1',
	};

	test('cancelling /yolo does not write config', async () => {
		const harness = services({ confirm: false });
		const outcome = await trySessionsCopilotConfigSlashSubmit({ ...target, input: '/yolo' }, harness.services);
		assert.strictEqual(outcome, 'declined');
		assert.strictEqual(harness.prompts, 1);
		assert.deepStrictEqual(harness.writes, []);
	});

	test('confirming /yolo writes bypass and consumes the toggle', async () => {
		const harness = services({ confirm: true });
		const outcome = await trySessionsCopilotConfigSlashSubmit({ ...target, input: '/yolo' }, harness.services);
		assert.strictEqual(outcome, 'handled');
		assert.deepStrictEqual(harness.writes, [{ sessionId: 'session-1', key: SessionConfigKey.AutoApprove, value: 'autoApprove' }]);
	});

	test('/plan with a remainder forwards after applying the mode', async () => {
		const harness = services();
		const outcome = await trySessionsCopilotConfigSlashSubmit({ ...target, input: '/plan the feature' }, harness.services);
		assert.strictEqual(outcome, 'forward');
		assert.strictEqual(harness.prompts, 0);
		assert.deepStrictEqual(harness.writes, [{ sessionId: 'session-1', key: SessionConfigKey.Mode, value: 'plan' }]);
	});

	test('a normal prompt is ignored', async () => {
		const harness = services();
		const outcome = await trySessionsCopilotConfigSlashSubmit({ ...target, input: 'hello' }, harness.services);
		assert.strictEqual(outcome, 'ignore');
		assert.strictEqual(harness.prompts, 0);
		assert.deepStrictEqual(harness.writes, []);
	});

	function inputHarness(input: string, options?: { confirm?: boolean; tryHandle?: boolean; failWrite?: boolean }): { harness: ISendHarness; text(): string; prompts: () => number; tryHandles: () => number; sent: { query: string }[]; writes: IConfigWrite[]; errors: string[] } {
		let text = input;
		let prompts = 0;
		let tryHandles = 0;
		const sent: { query: string }[] = [];
		const errors: string[] = [];
		const writes: IConfigWrite[] = [];
		const provider = upcastPartial<IAgentHostSessionsProvider>({
			id: LOCAL_AGENT_HOST_PROVIDER_ID,
			setSessionConfigValue: async (sessionId: string, key: string, value: unknown) => {
				if (options?.failWrite) {
					throw new Error('config write failed');
				}
				writes.push({ sessionId, key, value });
			},
		});
		const session = {
			resource: URI.from({ scheme: 'agent-host-copilotcli', path: '/session' }),
			providerId: LOCAL_AGENT_HOST_PROVIDER_ID,
			sessionId: 'session-1',
			activeChat: { get: () => undefined },
			isQuickChat: { get: () => false },
		};
		const harness = Object.assign(Object.create(NewChatInputWidget.prototype), {
			_editor: {
				getModel: () => ({
					getValue: () => text,
					setValue: (value: string) => { text = value; },
				}),
				updateOptions: () => { },
			},
			options: {
				session: { get: () => session },
				sendRequest: async request => {
					sent.push(request);
					return true;
				},
			},
			_contextAttachments: { attachments: [], clear: () => { } },
			_sending: false,
			_canSendRequest: { get: () => true },
			_sendGeneration: 0,
			_store: { isDisposed: false },
			sessionsProvidersService: { getProvider: () => provider },
			dialogService: upcastPartial<IDialogService>({
				prompt: async () => {
					prompts++;
					return { result: options?.confirm === true, checkboxChecked: false };
				},
			}),
			storageService: upcastPartial<IStorageService>({
				getBoolean: () => false,
				store: () => { },
			}),
			chatSubmitRequestHandlerService: {
				tryHandle: async () => {
					tryHandles++;
					return options?.tryHandle === true;
				},
			},
			logService: { error: () => { } },
			notificationService: { error: message => errors.push(message) },
			_implicitContexts: { enabledBaseEntries: () => [] },
			configurationService: { getValue: () => false },
			_loadingDelayDisposable: { value: {}, clear: () => { } },
			sessionTypePicker: { modelTargetChatSessionType: { get: () => 'agent-host-copilotcli' } },
			_modelSelection: { state: { get: () => ({}) } },
			chatInputNotificationService: { handleMessageSent: () => { } },
		} as ISendHarness);
		return { harness, text: () => text, prompts: () => prompts, tryHandles: () => tryHandles, sent, writes, errors };
	}

	test('cancelling /yolo on please keeps the draft and does not send', async () => {
		const fixture = inputHarness('/yolo on please', { confirm: false, tryHandle: true });
		const result = await send.call(fixture.harness, false);
		assert.strictEqual(result, false);
		assert.strictEqual(fixture.text(), '/yolo on please');
		assert.strictEqual(fixture.prompts(), 1);
		assert.strictEqual(fixture.tryHandles(), 0);
		assert.deepStrictEqual(fixture.sent, []);
		assert.deepStrictEqual(fixture.writes, []);
		assert.strictEqual(fixture.harness._sending, false);
	});

	test('confirming a pure /yolo clears the input without sending', async () => {
		const fixture = inputHarness('/yolo', { confirm: true, tryHandle: true });
		const result = await send.call(fixture.harness, false);
		assert.strictEqual(result, true);
		assert.strictEqual(fixture.text(), '');
		assert.strictEqual(fixture.tryHandles(), 0);
		assert.deepStrictEqual(fixture.sent, []);
		assert.deepStrictEqual(fixture.writes, [{ sessionId: 'session-1', key: SessionConfigKey.AutoApprove, value: 'autoApprove' }]);
		assert.strictEqual(fixture.harness._sending, false);
	});

	test('a normal prompt still goes through submit handlers', async () => {
		const fixture = inputHarness('hello', { tryHandle: true });
		const result = await send.call(fixture.harness, false);
		assert.strictEqual(result, true);
		assert.strictEqual(fixture.text(), '');
		assert.strictEqual(fixture.prompts(), 0);
		assert.strictEqual(fixture.tryHandles(), 1);
		assert.deepStrictEqual(fixture.sent, []);
		assert.deepStrictEqual(fixture.writes, []);
		assert.strictEqual(fixture.harness._sending, false);
	});

	test('/plan with a remainder sends the original text after one config write', async () => {
		const fixture = inputHarness('/plan the feature', { tryHandle: true });
		const result = await send.call(fixture.harness, false);
		assert.strictEqual(result, true);
		assert.strictEqual(fixture.tryHandles(), 0);
		assert.deepStrictEqual(fixture.sent.map(request => request.query), ['/plan the feature']);
		assert.deepStrictEqual(fixture.writes, [{ sessionId: 'session-1', key: SessionConfigKey.Mode, value: 'plan' }]);
		assert.strictEqual(fixture.text(), '');
		assert.strictEqual(fixture.harness._sending, false);
	});

	test('a failed config write re-enables send and keeps the draft', async () => {
		const fixture = inputHarness('/plan the feature', { failWrite: true, tryHandle: true });
		const result = await send.call(fixture.harness, false);
		assert.strictEqual(result, false);
		assert.strictEqual(fixture.text(), '/plan the feature');
		assert.strictEqual(fixture.tryHandles(), 0);
		assert.deepStrictEqual(fixture.sent, []);
		assert.strictEqual(fixture.harness._sending, false);
		assert.strictEqual(fixture.errors.length, 1);
		assert.ok(fixture.errors[0].includes("Couldn't send:"));
	});

	function nextMacrotask(): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, 0));
	}

	/**
	 * ChatWidget clears the editor after a consumed submit handler resolves.
	 * `lookup: 'chat'` is a peer chat: the session resource does not equal the
	 * chat resource, so only `getSessionForChatResource` can find the owner.
	 */
	function contributionHarness(input: string, options?: { confirm?: boolean; failWrite?: boolean; lookup?: 'session' | 'chat' }): {
		contribution: SessionsCopilotConfigSlashSubmitHandlerContribution;
		handler(): IChatSubmitRequestHandler;
		text(): string;
		setText(value: string): void;
		writes: IConfigWrite[];
		prompts(): number;
		resource: URI;
	} {
		const lookup = options?.lookup ?? 'session';
		const sessionResource = URI.from({ scheme: 'agent-host-copilotcli', path: '/session' });
		const resource = lookup === 'chat' ? sessionResource.with({ fragment: 'peer-1' }) : sessionResource;
		const session = upcastPartial<ISession>({
			providerId: LOCAL_AGENT_HOST_PROVIDER_ID,
			sessionId: 'session-1',
			resource: sessionResource,
		});
		let text = input;
		let prompts = 0;
		const writes: IConfigWrite[] = [];
		let handler: IChatSubmitRequestHandler | undefined;
		const provider = upcastPartial<IAgentHostSessionsProvider>({
			id: LOCAL_AGENT_HOST_PROVIDER_ID,
			setSessionConfigValue: async (sessionId: string, key: string, value: unknown) => {
				if (options?.failWrite) {
					throw new Error('config write failed');
				}
				writes.push({ sessionId, key, value });
			},
		});
		const widget = upcastPartial<IChatWidget>({
			viewModel: { sessionResource: resource } as IChatWidget['viewModel'],
			getInput: () => text,
			setInput: (value?: string) => { text = value ?? ''; },
		});
		const contribution = new SessionsCopilotConfigSlashSubmitHandlerContribution(
			upcastPartial<IChatSubmitRequestHandlerService>({
				register: candidate => {
					handler = candidate;
					return { dispose() { } };
				},
			}),
			upcastPartial<ISessionsManagementService>({
				getSession: candidate => lookup === 'session' && isEqual(candidate, sessionResource) ? session : undefined,
				getSessionForChatResource: candidate => lookup === 'chat' && isEqual(candidate, resource)
					? { session, chat: upcastPartial<IChat>({ resource }) }
					: undefined,
			}),
			upcastPartial<ISessionsProvidersService>({
				getProvider: <T extends ISessionsProvider>(_providerId: string): T | undefined => provider as T,
			}),
			upcastPartial<IDialogService>({
				prompt: async () => {
					prompts++;
					return { result: options?.confirm === true, checkboxChecked: false };
				},
			}),
			upcastPartial<IStorageService>({
				getBoolean: () => false,
			}),
			upcastPartial<IChatWidgetService>({
				getWidgetBySessionResource: candidate => isEqual(candidate, resource) ? widget : undefined,
			}),
		);
		return {
			contribution,
			handler: () => {
				if (!handler) {
					throw new Error('handler was not registered');
				}
				return handler;
			},
			text: () => text,
			setText: value => { text = value; },
			writes,
			prompts: () => prompts,
			resource,
		};
	}

	test('cancelling /yolo in an open chat puts the draft back after the clear', async () => {
		const fixture = contributionHarness('/yolo on please', { confirm: false, lookup: 'session' });
		try {
			const consumed = await fixture.handler().tryHandle({ sessionResource: fixture.resource, input: '/yolo on please' });
			assert.strictEqual(consumed, true);
			// ChatWidget drops the editor once the handler resolves.
			fixture.setText('');
			await nextMacrotask();
			assert.strictEqual(fixture.text(), '/yolo on please');
			assert.strictEqual(fixture.prompts(), 1);
			assert.deepStrictEqual(fixture.writes, []);
		} finally {
			fixture.contribution.dispose();
		}
	});

	test('confirming a pure /yolo still leaves the cleared input empty', async () => {
		const fixture = contributionHarness('/yolo', { confirm: true, lookup: 'session' });
		try {
			const consumed = await fixture.handler().tryHandle({ sessionResource: fixture.resource, input: '/yolo' });
			assert.strictEqual(consumed, true);
			fixture.setText('');
			await nextMacrotask();
			assert.strictEqual(fixture.text(), '');
			assert.deepStrictEqual(fixture.writes, [{ sessionId: 'session-1', key: SessionConfigKey.AutoApprove, value: 'autoApprove' }]);
		} finally {
			fixture.contribution.dispose();
		}
	});

	test('a peer chat applies /plan once and still forwards the text', async () => {
		const fixture = contributionHarness('/plan the feature', { lookup: 'chat' });
		try {
			const consumed = await fixture.handler().tryHandle({ sessionResource: fixture.resource, input: '/plan the feature' });
			assert.strictEqual(consumed, false);
			assert.strictEqual(fixture.prompts(), 0);
			assert.deepStrictEqual(fixture.writes, [{ sessionId: 'session-1', key: SessionConfigKey.Mode, value: 'plan' }]);
			assert.strictEqual(fixture.text(), '/plan the feature');
		} finally {
			fixture.contribution.dispose();
		}
	});

	test('a failed config write from an open chat rejects and does not clear the draft', async () => {
		const fixture = contributionHarness('/plan the feature', { failWrite: true, lookup: 'session' });
		try {
			await assert.rejects(
				() => fixture.handler().tryHandle({ sessionResource: fixture.resource, input: '/plan the feature' }),
				/config write failed/,
			);
			await nextMacrotask();
			assert.strictEqual(fixture.text(), '/plan the feature');
			assert.deepStrictEqual(fixture.writes, []);
		} finally {
			fixture.contribution.dispose();
		}
	});
});
