/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, suite, test } from 'vitest';
import { COPILOT_TERMINAL_EXPLAIN_LAST_COMMAND_ID, COPILOT_TERMINAL_FIX_LAST_COMMAND_ID, getCopilotTerminalFailureQuickFixCommands, runCopilotTerminalExplainCommand, runCopilotTerminalFixCommand } from '../terminalFixGenerator';

suite('Copilot terminal failure quick fixes', () => {
	test('default Code window does not offer Fix or Explain, and the commands do not open chat', async () => {
		for (const isAgentSessionsWorkspace of [false, undefined]) {
			expect(getCopilotTerminalFailureQuickFixCommands({
				isAgentSessionsWorkspace,
				enabled: true,
				commandLine: 'npm test',
			})).toEqual([]);

			let triggered = 0;
			await runCopilotTerminalExplainCommand({
				isAgentSessionsWorkspace,
				query: '/explain #terminalLastCommand',
				triggerTerminalChat: async () => { triggered++; },
			});
			expect(triggered).toBe(0);

			let generated = 0;
			await runCopilotTerminalFixCommand({
				isAgentSessionsWorkspace,
				generateFixes: () => { generated++; },
			});
			expect(generated).toBe(0);
		}
	});

	test('Agents window still offers Fix and Explain and runs them', async () => {
		expect(getCopilotTerminalFailureQuickFixCommands({
			isAgentSessionsWorkspace: true,
			enabled: true,
			commandLine: 'npm test',
		})).toEqual([
			COPILOT_TERMINAL_FIX_LAST_COMMAND_ID,
			COPILOT_TERMINAL_EXPLAIN_LAST_COMMAND_ID,
		]);

		const queries: string[] = [];
		await runCopilotTerminalExplainCommand({
			isAgentSessionsWorkspace: true,
			query: '/explain #terminalLastCommand',
			triggerTerminalChat: async chat => { queries.push(chat.query); },
		});
		expect(queries).toEqual(['/explain #terminalLastCommand']);

		let generated = 0;
		await runCopilotTerminalFixCommand({
			isAgentSessionsWorkspace: true,
			generateFixes: () => { generated++; },
		});
		expect(generated).toBe(1);
	});

	test('Agents window still hides the quick fixes when chat is disabled or the command was cancelled', () => {
		expect(getCopilotTerminalFailureQuickFixCommands({
			isAgentSessionsWorkspace: true,
			enabled: false,
			commandLine: 'npm test',
		})).toEqual([]);
		expect(getCopilotTerminalFailureQuickFixCommands({
			isAgentSessionsWorkspace: true,
			enabled: true,
			commandLine: 'npm test^C',
		})).toEqual([]);
	});
});
