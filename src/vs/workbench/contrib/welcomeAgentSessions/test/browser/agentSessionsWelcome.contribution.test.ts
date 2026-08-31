/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { BrowserWorkbenchEnvironmentService } from '../../../../services/environment/browser/environmentService.js';
import { workbenchInstantiationService, TestEditorService, TestProductService } from '../../../../test/browser/workbenchTestServices.js';
import { ChatContextKeys } from '../../../chat/common/actions/chatContextKeys.js';
import { AgentSessionsWelcomeInput } from '../../browser/agentSessionsWelcomeInput.js';
import { AgentSessionsWelcomePage, AgentSessionsWelcomeInputWorkbenchSerializer } from '../../browser/agentSessionsWelcome.js';
import { shouldRegisterAgentSessionsWelcomeEditorResolver } from '../../browser/agentSessionsWelcome.contribution.js';

import '../../browser/agentSessionsWelcome.contribution.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

function getCommandPaletteItem(commandId: string) {
	return MenuRegistry.getMenuItems(MenuId.CommandPalette)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId);
}

class DefaultCodeWindowEnvironmentService extends BrowserWorkbenchEnvironmentService {
	override get isSessionsWindow(): boolean {
		return false;
	}
}

class AgentsWindowEnvironmentService extends BrowserWorkbenchEnvironmentService {
	override get isSessionsWindow(): boolean {
		return true;
	}
}

const testEnvOptions = Object.create(null);
const testLogsHome = URI.file('tests').with({ scheme: 'vscode-tests' });

suite('AgentSessionsWelcomeContribution', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const defaultWindow = {
		[IsSessionsWindowContext.key]: false,
		[ChatContextKeys.enabled.key]: true,
	};
	const agentsWindow = {
		[IsSessionsWindowContext.key]: true,
		[ChatContextKeys.enabled.key]: true,
	};

	test('shouldRegisterAgentSessionsWelcomeEditorResolver is false in default Code window', () => {
		assert.strictEqual(shouldRegisterAgentSessionsWelcomeEditorResolver(false), false);
		assert.strictEqual(shouldRegisterAgentSessionsWelcomeEditorResolver(true), true);
	});

	test('AgentSessionsWelcomeInputWorkbenchSerializer canSerialize is false in default Code window', () => {
		const env = new DefaultCodeWindowEnvironmentService('', testLogsHome, testEnvOptions, TestProductService);
		const instantiationService = workbenchInstantiationService({ environmentService: () => env }, store);
		const serializer = instantiationService.createInstance(AgentSessionsWelcomeInputWorkbenchSerializer);
		const input = new AgentSessionsWelcomeInput({});

		assert.strictEqual(serializer.canSerialize(input), false);
	});

	test('workbench.action.openAgentSessionsWelcome command palette when is false in default Code window', () => {
		const paletteItem = getCommandPaletteItem(AgentSessionsWelcomePage.COMMAND_ID);
		assert.ok(paletteItem, `${AgentSessionsWelcomePage.COMMAND_ID} should remain registered`);
		assert.ok(paletteItem.when, `${AgentSessionsWelcomePage.COMMAND_ID} command palette item should have a when clause`);

		assert.strictEqual(
			evalWhen(paletteItem.when, defaultWindow),
			false,
			`${AgentSessionsWelcomePage.COMMAND_ID} must hide from default Code window Command Palette`
		);
		assert.strictEqual(
			evalWhen(paletteItem.when, agentsWindow),
			true,
			`${AgentSessionsWelcomePage.COMMAND_ID} may show in Agents Window Command Palette`
		);
	});

	test('workbench.action.openAgentSessionsWelcome opens AgentSessionsWelcomeInput in Agents Window', async () => {
		const env = new AgentsWindowEnvironmentService('', testLogsHome, testEnvOptions, TestProductService);
		const editorService = store.add(new TestEditorService());
		const instantiationService = workbenchInstantiationService({
			editorService: () => editorService,
			environmentService: () => env,
		}, store);

		await instantiationService.get(ICommandService).executeCommand(AgentSessionsWelcomePage.COMMAND_ID);

		assert.strictEqual(editorService.activeEditor instanceof AgentSessionsWelcomeInput, true);
	});
});
