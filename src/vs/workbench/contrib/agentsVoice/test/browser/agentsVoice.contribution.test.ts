/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { constObservable } from '../../../../../base/common/observable.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry, ICommandService } from '../../../../../platform/commands/common/commands.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { AGENTS_VOICE_CONNECTED, AGENTS_VOICE_ENTITLED } from '../../common/agentsVoice.js';
import { ChatContextKeys } from '../../../chat/common/actions/chatContextKeys.js';
import { SHOW_VOICE_MODE_ONBOARDING_COMMAND } from '../../../chat/browser/speechToText/micButtonMenuActions.js';
import { IVoiceSessionController, VoiceState } from '../../../chat/browser/voiceClient/voiceSessionController.js';

import '../../browser/agentsVoice.contribution.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

function findCommandPaletteItem(commandId: string) {
	return MenuRegistry.getMenuItems(MenuId.CommandPalette)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId);
}

const defaultWindow: Record<string, ContextKeyValue> = {
	[IsSessionsWindowContext.key]: false,
	[ChatContextKeys.enabled.key]: true,
	'config.agents.voice.enabled': true,
	[AGENTS_VOICE_ENTITLED.key]: true,
	[AGENTS_VOICE_CONNECTED.key]: true,
};

const agentsWindowVoiceReady: Record<string, ContextKeyValue> = {
	...defaultWindow,
	[IsSessionsWindowContext.key]: true,
};

const sessionsWindowOnlyCommandIds = [
	'agentsVoice.openSettings',
	SHOW_VOICE_MODE_ONBOARDING_COMMAND,
	'agentsVoice.pushToTalk',
	'agentsVoice.disconnect',
	'agentsVoice.simulateConnection',
	'agentsVoice.resetOnboarding',
];

suite('AgentsVoiceContribution - default window Command Palette', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Voice F1 commands stay in Command Palette for Agents Window only', () => {
		for (const commandId of sessionsWindowOnlyCommandIds) {
			const item = findCommandPaletteItem(commandId);
			assert.ok(item, `${commandId} should remain registered for Agents Window`);
			assert.ok(item.when, `${commandId} Command Palette item should have a when clause`);

			assert.strictEqual(
				evalWhen(item.when, defaultWindow),
				false,
				`default Code window must hide ${commandId} in Command Palette`
			);
			assert.strictEqual(
				evalWhen(item.when, agentsWindowVoiceReady),
				true,
				`Agents Window may list ${commandId} in Command Palette`
			);
		}
	});
});

suite('AgentsVoiceContribution - startVoiceInChat', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	const sessionA = 'chat-session://workspace/folder/session-a';
	const sessionB = 'chat-session://workspace/folder/session-b';

	function createStartVoiceInChatHarness(options: {
		readonly currentSessionQueries: () => string | undefined;
		readonly connect?: () => Promise<void>;
	}) {
		let pttDownCalls = 0;
		let pttUpCalls = 0;
		const instantiationService = workbenchInstantiationService(undefined, disposables);
		instantiationService.stub(IConfigurationService, new TestConfigurationService({
			'agents.voice.handsFree': true,
		}));
		instantiationService.stub(IKeybindingService, new class extends mock<IKeybindingService>() {
			override enableKeybindingHoldMode(): Promise<void> | undefined {
				return undefined;
			}
		});
		instantiationService.stub(ICommandService, new class extends mock<ICommandService>() {
			override executeCommand<R = unknown>(commandId: string, ..._args: unknown[]): Promise<R | undefined> {
				if (commandId === '_chat.voice.getCurrentSession') {
					return Promise.resolve(options.currentSessionQueries() as R | undefined);
				}
				return Promise.resolve(undefined);
			}
		});
		instantiationService.stub(IVoiceSessionController, new class extends mock<IVoiceSessionController>() {
			override readonly isConnected = constObservable(false);
			override readonly voiceState = constObservable<VoiceState>('idle');
			override setActiveWindow(): void { }
			override setTargetSession(): void { }
			override activateSession(): void { }
			override setDraftTarget(): void { }
			override connect(): Promise<void> {
				return options.connect?.() ?? Promise.resolve();
			}
			override pttDown(): void {
				pttDownCalls++;
			}
			override pttUp(): void {
				pttUpCalls++;
			}
		});

		const command = CommandsRegistry.getCommand('agentsVoice.startVoiceInChat');
		assert.ok(command, 'startVoiceInChat must register as a command');

		return {
			run: () => instantiationService.invokeFunction(accessor => Promise.resolve(command!.handler(accessor))),
			get pttDownCalls() { return pttDownCalls; },
			get pttUpCalls() { return pttUpCalls; },
		};
	}

	test('does not push-to-talk when the active composer changes during connect', async () => {
		let query = 0;
		let releaseConnect!: () => void;
		const connectGate = new Promise<void>(resolve => { releaseConnect = resolve; });

		const harness = createStartVoiceInChatHarness({
			currentSessionQueries: () => {
				query++;
				return query === 1 ? sessionA : sessionB;
			},
			connect: () => connectGate,
		});

		const runPromise = harness.run();
		releaseConnect();
		await runPromise;

		assert.strictEqual(harness.pttDownCalls, 0);
		assert.strictEqual(harness.pttUpCalls, 0);
	});

	test('still push-to-talk when the active composer is unchanged after connect', async () => {
		const harness = createStartVoiceInChatHarness({
			currentSessionQueries: () => sessionA,
			connect: () => Promise.resolve(),
		});

		await harness.run();

		assert.strictEqual(harness.pttDownCalls, 1);
		assert.strictEqual(harness.pttUpCalls, 1);
	});
});
