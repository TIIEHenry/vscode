/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../../base/common/event.js';
import { observableValue } from '../../../../../../base/common/observable.js';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { IMenuService, MenuItemAction } from '../../../../../../platform/actions/common/actions.js';
import { IActionWidgetService } from '../../../../../../platform/actionWidget/browser/actionWidget.js';
import { IActionListItem } from '../../../../../../platform/actionWidget/browser/actionList.js';
import { CustomizationType, type AgentCustomization } from '../../../../../../platform/agentHost/common/state/protocol/state.js';
import { agentHostAgentPickerStorageKey, resolveAgentHostAgent } from '../../../../../../platform/agentHost/common/customAgents.js';
import { ICommandService } from '../../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { TestInstantiationService } from '../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { MockContextKeyService, MockKeybindingService } from '../../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { IKeybindingService } from '../../../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../../../platform/opener/common/opener.js';
import { IProductService } from '../../../../../../platform/product/common/productService.js';
import { InMemoryStorageService, StorageScope } from '../../../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../../../platform/telemetry/common/telemetry.js';
import { NullTelemetryServiceShape } from '../../../../../../platform/telemetry/common/telemetryUtils.js';
import { IChatAgentService } from '../../../../../../workbench/contrib/chat/common/participants/chatAgents.js';
import { ChatMode, CustomChatMode, IChatMode, IChatModeService, IChatModes } from '../../../../../../workbench/contrib/chat/common/chatModes.js';
import { IChatService } from '../../../../../../workbench/contrib/chat/common/chatService/chatService.js';
import { IChatSessionsService } from '../../../../../../workbench/contrib/chat/common/chatSessionsService.js';
import { PromptsStorage } from '../../../../../../workbench/contrib/chat/common/promptSyntax/service/promptsService.js';
import { Target } from '../../../../../../workbench/contrib/chat/common/promptSyntax/promptTypes.js';
import { ModePickerActionItem } from '../../../../../../workbench/contrib/chat/browser/widget/input/modePickerActionItem.js';
import { IWorkbenchAssignmentService } from '../../../../../../workbench/services/assignment/common/assignmentService.js';
import { IAgentHostSessionsProvider } from '../../../../../common/agentHostSessionsProvider.js';
import { IActiveSession } from '../../../../../services/sessions/common/sessionsManagement.js';
import { AgentHostNewSessionAgentPickerActionItem, agentHostAgentPickerTarget, writeAgentHostAgentPickerSelection } from '../../browser/agentHostAgentPicker.js';

suite('agentHostAgentPicker', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const alpha: AgentCustomization = { type: CustomizationType.Agent, id: 'agent://a', uri: 'agent://a', name: 'alpha' };
	const beta: AgentCustomization = { type: CustomizationType.Agent, id: 'agent://b', uri: 'agent://b', name: 'beta', description: 'b desc' };
	const agents: readonly AgentCustomization[] = [alpha, beta];

	suite('agentHostAgentPickerStorageKey', () => {
		test('builds a per-scheme storage key', () => {
			assert.strictEqual(
				agentHostAgentPickerStorageKey('agent-host-copilotcli'),
				'workbench.agentsession.agentHostAgentPicker.agent-host-copilotcli.selectedAgentUri',
			);
		});
	});

	suite('resolveAgentHostAgent', () => {
		test('returns the session-selected agent when its URI is in the list', () => {
			assert.deepStrictEqual(resolveAgentHostAgent(agents, 'agent://b', undefined), beta);
		});

		test('falls back to the stored URI when the session has no selection', () => {
			assert.strictEqual(resolveAgentHostAgent(agents, undefined, 'agent://a'), alpha);
		});

		test('returns undefined when neither session nor stored selection matches the list', () => {
			assert.strictEqual(resolveAgentHostAgent(agents, undefined, 'agent://missing'), undefined);
			assert.strictEqual(resolveAgentHostAgent(agents, 'agent://missing', undefined), undefined);
		});

		test('session selection wins over stored selection', () => {
			assert.deepStrictEqual(resolveAgentHostAgent(agents, 'agent://a', 'agent://b'), alpha);
		});

		test('falls through to stored URI when the session agent URI is not in the list', () => {
			// The session's recorded selection is no longer in the effective
			// agent list (e.g. the customization providing it was removed),
			// so the stored fallback is consulted.
			assert.deepStrictEqual(resolveAgentHostAgent(agents, 'agent://gone', 'agent://a'), alpha);
		});

		test('returns undefined for an empty agent list', () => {
			assert.strictEqual(resolveAgentHostAgent([], 'agent://a', 'agent://a'), undefined);
			assert.strictEqual(resolveAgentHostAgent([], undefined, undefined), undefined);
		});
	});

	suite('agentHostAgentPickerTarget', () => {
		test('uses GitHub Copilot when the session type contributes no target', () => {
			assert.strictEqual(agentHostAgentPickerTarget(undefined), Target.GitHubCopilot);
			assert.strictEqual(agentHostAgentPickerTarget(Target.Undefined), Target.GitHubCopilot);
			assert.strictEqual(agentHostAgentPickerTarget(Target.Claude), Target.Claude);
		});
	});

	suite('writeAgentHostAgentPickerSelection', () => {
		test('stores a custom agent uri and clears it for the default Agent', () => {
			const storage = store.add(new InMemoryStorageService());
			const chatResource = URI.parse('agent-host-copilotcli:/untitled-1');
			const session = {
				resource: chatResource,
				sessionId: 'local-agent-host:1',
				activeChat: { get: () => ({ resource: chatResource }) },
			} as IActiveSession;
			const calls: { sessionId: string; chat: string; agent: { uri: string; name: string } | undefined }[] = [];
			const provider = {
				setAgent: (sessionId: string, resource: URI, agent: { uri: string; name: string } | undefined) => {
					calls.push({ sessionId, chat: resource.toString(), agent });
				},
			} as IAgentHostSessionsProvider;
			const alphaUri = URI.parse('file:///workspace/.github/agents/alpha.agent.md');
			const alpha = new CustomChatMode({
				id: alphaUri.toString(),
				uri: alphaUri,
				name: 'alpha',
				agentInstructions: { content: '', toolReferences: [] },
				source: { storage: PromptsStorage.local },
				target: Target.Undefined,
				visibility: { userInvocable: true, agentInvocable: true },
				enabled: true,
			});

			writeAgentHostAgentPickerSelection(storage, session, provider, alpha);

			assert.strictEqual(storage.get(agentHostAgentPickerStorageKey(chatResource.scheme), StorageScope.PROFILE), alphaUri.toString());
			assert.deepStrictEqual(calls, [{
				sessionId: 'local-agent-host:1',
				chat: chatResource.toString(),
				agent: { uri: alphaUri.toString(), name: 'alpha' },
			}]);

			writeAgentHostAgentPickerSelection(storage, session, provider, ChatMode.Agent);

			assert.strictEqual(storage.get(agentHostAgentPickerStorageKey(chatResource.scheme), StorageScope.PROFILE), undefined);
			assert.strictEqual(calls[1]?.agent, undefined);
		});
	});

	test('new-session Agent chip hosts ModePickerActionItem and keeps agent-host entries', async () => {
		const instantiationService = store.add(new TestInstantiationService());
		const shown: { labels: string[]; runHost: (() => Promise<void>) | undefined } = { labels: [], runHost: undefined };
		instantiationService.stub(IActionWidgetService, {
			show: (_user: string, _supportsPreview: boolean, items: readonly IActionListItem<{ run: () => Promise<void> }>[]) => {
				shown.labels = items.map(item => item.label ?? '');
				const host = items.find(item => item.label === 'Host Alpha');
				shown.runHost = host?.item ? () => host.item!.run() : undefined;
			},
			hide: () => { },
			isVisible: false,
		} as IActionWidgetService);
		instantiationService.stub(IChatAgentService, { getDefaultAgent: () => undefined } as IChatAgentService);
		instantiationService.stub(IKeybindingService, new MockKeybindingService());
		instantiationService.stub(IConfigurationService, { inspect: () => ({}) } as IConfigurationService);
		instantiationService.stub(IContextKeyService, new MockContextKeyService());
		instantiationService.stub(IMenuService, {
			createMenu: () => ({
				getActions: () => [],
				dispose: () => { },
			}),
		} as IMenuService);
		instantiationService.stub(ICommandService, { executeCommand: async () => { } } as ICommandService);
		instantiationService.stub(IProductService, {} as IProductService);
		instantiationService.stub(ITelemetryService, new NullTelemetryServiceShape());
		instantiationService.stub(IOpenerService, { open: async () => true } as IOpenerService);
		instantiationService.stub(IWorkbenchAssignmentService, {
			onDidRefetchAssignments: Event.None,
			getTreatment: async () => undefined,
		} as IWorkbenchAssignmentService);
		const hostUri = URI.parse('file:///workspace/.github/agents/host-alpha.agent.md');
		const copilotUri = URI.parse('file:///workspace/.github/agents/copilot-beta.agent.md');
		const claudeUri = URI.parse('file:///workspace/.claude/agents/claude-only.agent.md');
		const hiddenUri = URI.parse('file:///workspace/.github/agents/hidden.agent.md');
		const host = mode(hostUri, 'Host Alpha', Target.Undefined, true);
		const copilot = mode(copilotUri, 'Copilot Beta', Target.GitHubCopilot, true);
		const claude = mode(claudeUri, 'Claude Only', Target.Claude, true);
		const hidden = mode(hiddenUri, 'Hidden Subagent', Target.Undefined, false);
		const modes: IChatModes & { dispose(): void } = {
			onDidChange: Event.None,
			builtin: [ChatMode.Agent, ChatMode.Ask],
			custom: [host, copilot, claude, hidden],
			findModeById: id => [ChatMode.Agent, ChatMode.Ask, host, copilot, claude, hidden].find(candidate => candidate.id === id),
			findModeByName: () => undefined,
			waitForPendingUpdates: async () => { },
			dispose: () => { },
		};
		instantiationService.stub(IChatModeService, { createModes: () => modes } as IChatModeService);
		instantiationService.stub(IChatSessionsService, { getCustomAgentTargetForSessionType: () => Target.Undefined } as IChatSessionsService);
		instantiationService.stub(IChatService, { getSession: () => undefined } as IChatService);

		const storage = store.add(new InMemoryStorageService());
		const chatResource = URI.parse('agent-host-copilotcli:/untitled-1');
		const sessionMode = observableValue<{ readonly id: string; readonly kind: string } | undefined>('mode', undefined);
		const session = observableValue<IActiveSession | undefined>('session', {
			resource: chatResource,
			sessionId: 'local-agent-host:1',
			providerId: 'local-agent-host',
			mode: sessionMode,
			activeChat: observableValue('activeChat', {
				resource: chatResource,
				mode: sessionMode,
			}),
		} as IActiveSession);
		const calls: { agent: { uri: string; name: string } | undefined }[] = [];
		const provider = {
			setAgent: (_sessionId: string, _resource: URI, agent: { uri: string; name: string } | undefined) => {
				calls.push({ agent });
			},
		} as IAgentHostSessionsProvider;
		const picker = store.add(instantiationService.createInstance(
			AgentHostNewSessionAgentPickerActionItem,
			{ id: 'sessions.agentHost.agentPicker', label: 'Agent', tooltip: '', enabled: true, class: undefined, run: async () => { } } as MenuItemAction,
			session,
			(selected: IChatMode) => {
				writeAgentHostAgentPickerSelection(storage, session.get()!, provider, selected);
			},
		));

		assert.ok(picker instanceof ModePickerActionItem);
		const container = document.createElement('div');
		picker.render(container);
		container.querySelector('.dropdown-label')?.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));

		assert.deepStrictEqual(shown.labels.filter(label => label.length > 0), ['Agent', 'Host Alpha', 'Copilot Beta']);
		assert.ok(shown.runHost);
		await shown.runHost();
		assert.strictEqual(storage.get(agentHostAgentPickerStorageKey(chatResource.scheme), StorageScope.PROFILE), hostUri.toString());
		assert.deepStrictEqual(calls, [{ agent: { uri: host.id, name: 'Host Alpha' } }]);
	});
});

function mode(uri: URI, name: string, target: Target, userInvocable: boolean): CustomChatMode {
	return new CustomChatMode({
		id: uri.toString(),
		uri,
		name,
		agentInstructions: { content: '', toolReferences: [] },
		source: { storage: PromptsStorage.local },
		target,
		visibility: { userInvocable, agentInvocable: true },
		enabled: true,
	});
}
