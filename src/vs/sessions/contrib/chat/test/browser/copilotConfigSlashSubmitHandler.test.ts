/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { SessionConfigKey } from '../../../../../platform/agentHost/common/sessionConfigKeys.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { resetShownWarnings } from '../../../../../workbench/contrib/chat/common/chatPermissionWarnings.js';
import { IAgentHostSessionsProvider, LOCAL_AGENT_HOST_PROVIDER_ID } from '../../../../common/agentHostSessionsProvider.js';
import { ISessionsProvider } from '../../../../services/sessions/common/sessionsProvider.js';
import { NewChatInputWidget } from '../../browser/newChatInput.js';
import { ISessionsCopilotConfigSlashServices, trySessionsCopilotConfigSlashSubmit } from '../../browser/copilotConfigSlashSubmitHandler.js';

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
});
