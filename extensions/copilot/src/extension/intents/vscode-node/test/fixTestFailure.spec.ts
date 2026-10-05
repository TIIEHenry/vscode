/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, suite, test } from 'vitest';
import { FIX_TEST_FAILURE_INLINE_CHAT_MESSAGE, runFixTestFailureChat, shouldProvideFixTestFailureCodeAction } from '../fixTestFailureContributions';

const testUri = { scheme: 'file' };

suite('Fix test failure chat', () => {
	test('default Code window does not offer the code action and does not open Inline Chat', async () => {
		for (const isAgentSessionsWorkspace of [false, undefined]) {
			expect(shouldProvideFixTestFailureCodeAction({
				isAgentSessionsWorkspace,
				codeActionsEnabled: true,
				hasFailure: true,
			})).toBe(false);

			let opened = 0;
			let telemetry = 0;
			const started = await runFixTestFailureChat({
				isAgentSessionsWorkspace,
				testUri,
				openAndStartInlineChat: async () => { opened++; },
				sendTelemetry: () => { telemetry++; },
			});
			expect(started).toBe(false);
			expect(opened).toBe(0);
			expect(telemetry).toBe(0);
		}
	});

	test('Agents window still offers the code action and starts Inline Chat', async () => {
		expect(FIX_TEST_FAILURE_INLINE_CHAT_MESSAGE).toBe('/fix the #testFailure');
		expect(shouldProvideFixTestFailureCodeAction({
			isAgentSessionsWorkspace: true,
			codeActionsEnabled: true,
			hasFailure: true,
		})).toBe(true);

		let opened = 0;
		let telemetry = 0;
		const started = await runFixTestFailureChat({
			isAgentSessionsWorkspace: true,
			testUri,
			openAndStartInlineChat: async () => { opened++; },
			sendTelemetry: () => { telemetry++; },
		});
		expect(started).toBe(true);
		expect(opened).toBe(1);
		expect(telemetry).toBe(1);
	});

	test('Agents window still hides the code action when chat code actions are off or there is no failure, and does not open chat without a test uri', async () => {
		expect(shouldProvideFixTestFailureCodeAction({
			isAgentSessionsWorkspace: true,
			codeActionsEnabled: false,
			hasFailure: true,
		})).toBe(false);
		expect(shouldProvideFixTestFailureCodeAction({
			isAgentSessionsWorkspace: true,
			codeActionsEnabled: true,
			hasFailure: false,
		})).toBe(false);

		let opened = 0;
		const started = await runFixTestFailureChat({
			isAgentSessionsWorkspace: true,
			testUri: undefined,
			openAndStartInlineChat: async () => { opened++; },
			sendTelemetry: () => { },
		});
		expect(started).toBe(false);
		expect(opened).toBe(0);
	});
});
