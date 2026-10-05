/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import { runTypeScriptEditorChatFollowUp, shouldOfferTypeScriptAiQuickFix } from '../../languageFeatures/util/editorChatGate';

suite('TypeScript AI quick fix editor chat', () => {
	test('default Code window does not offer the AI quick fix and does not start Inline Chat', async () => {
		for (const isAgentSessionsWorkspace of [false, undefined]) {
			assert.strictEqual(shouldOfferTypeScriptAiQuickFix({
				isAgentSessionsWorkspace,
				copilotChatActive: true,
			}), false);

			let started = 0;
			let telemetry = 0;
			const ran = await runTypeScriptEditorChatFollowUp({
				isAgentSessionsWorkspace,
				sendTelemetry: () => { telemetry++; },
				startEditorChat: async () => { started++; },
			});
			assert.strictEqual(ran, false);
			assert.strictEqual(started, 0);
			assert.strictEqual(telemetry, 0);
		}
	});

	test('Agents window still offers the AI quick fix and starts Inline Chat after telemetry', async () => {
		assert.strictEqual(shouldOfferTypeScriptAiQuickFix({
			isAgentSessionsWorkspace: true,
			copilotChatActive: true,
		}), true);

		const order: string[] = [];
		const ran = await runTypeScriptEditorChatFollowUp({
			isAgentSessionsWorkspace: true,
			sendTelemetry: () => { order.push('telemetry'); },
			startEditorChat: async () => { order.push('start'); },
		});
		assert.strictEqual(ran, true);
		assert.deepStrictEqual(order, ['telemetry', 'start']);
	});

	test('Agents window does not offer the AI quick fix when Copilot Chat is inactive', async () => {
		assert.strictEqual(shouldOfferTypeScriptAiQuickFix({
			isAgentSessionsWorkspace: true,
			copilotChatActive: false,
		}), false);
	});
});
