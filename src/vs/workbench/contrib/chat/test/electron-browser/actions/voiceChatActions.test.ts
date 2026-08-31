/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IsSessionsWindowContext } from '../../../../../common/contextkeys.js';
import { HasSpeechProvider, SpeechToTextInProgress } from '../../../../speech/common/speechService.js';
import { ChatContextKeys } from '../../../common/actions/chatContextKeys.js';
import {
	InlineVoiceChatAction,
	parseNextChatResponseChunk,
	QuickVoiceChatAction,
	StartVoiceChatAction,
	VoiceChatInChatViewAction,
} from '../../../electron-browser/actions/voiceChatActions.js';

// INV-NO-COPILOT: Voice Chat F1 palette entries are gated with IsSessionsWindowContext on their
// preconditions in voiceChatActions.ts (electron-browser).

function evalPrecondition(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

const voiceChatReady: Record<string, ContextKeyValue> = {
	[IsSessionsWindowContext.key]: false,
	[ChatContextKeys.enabled.key]: true,
	[HasSpeechProvider.key]: true,
	['scopedVoiceChatGettingReady']: false,
	[SpeechToTextInProgress.key]: false,
};

const agentsWindowVoiceChatReady: Record<string, ContextKeyValue> = {
	...voiceChatReady,
	[IsSessionsWindowContext.key]: true,
};

suite('VoiceChatActions', function () {

	function assertChunk(text: string, expected: string | undefined, offset: number): { chunk: string | undefined; offset: number } {
		const res = parseNextChatResponseChunk(text, offset);
		assert.strictEqual(res.chunk, expected);

		return res;
	}

	test('parseNextChatResponseChunk', function () {

		// Simple, no offset
		assertChunk('Hello World', undefined, 0);
		assertChunk('Hello World.', undefined, 0);
		assertChunk('Hello World. ', 'Hello World.', 0);
		assertChunk('Hello World? ', 'Hello World?', 0);
		assertChunk('Hello World! ', 'Hello World!', 0);
		assertChunk('Hello World: ', 'Hello World:', 0);

		// Ensure chunks are parsed from the end, no offset
		assertChunk('Hello World. How is your day? And more...', 'Hello World. How is your day?', 0);

		// Ensure chunks are parsed from the end, with offset
		let offset = assertChunk('Hello World. How is your ', 'Hello World.', 0).offset;
		offset = assertChunk('Hello World. How is your day? And more...', 'How is your day?', offset).offset;
		offset = assertChunk('Hello World. How is your day? And more to come! ', 'And more to come!', offset).offset;
		assertChunk('Hello World. How is your day? And more to come! ', undefined, offset);

		// Sparted by newlines
		offset = assertChunk('Hello World.\nHow is your', 'Hello World.', 0).offset;
		assertChunk('Hello World.\nHow is your day?\n', 'How is your day?', offset);
	});

	test('Start Voice Chat F1 is gated to Agents Window', () => {
		const precondition = new StartVoiceChatAction().desc.precondition;
		assert.ok(precondition);
		assert.strictEqual(evalPrecondition(precondition, voiceChatReady), false, 'default Code window must hide Start Voice Chat in F1');
		assert.strictEqual(evalPrecondition(precondition, agentsWindowVoiceChatReady), true, 'Agents Window may show Start Voice Chat in F1');
	});

	test('Voice Chat in Chat View F1 stays gated to Agents Window', () => {
		const precondition = new VoiceChatInChatViewAction().desc.precondition;
		assert.ok(precondition);
		assert.strictEqual(evalPrecondition(precondition, voiceChatReady), false);
		assert.strictEqual(evalPrecondition(precondition, agentsWindowVoiceChatReady), true);
	});

	test('Inline Voice Chat F1 stays gated to Agents Window', () => {
		const precondition = new InlineVoiceChatAction().desc.precondition;
		assert.ok(precondition);
		assert.strictEqual(evalPrecondition(precondition, { ...voiceChatReady, activeEditor: 'workbench.editor.chat' }), false);
		assert.strictEqual(evalPrecondition(precondition, { ...agentsWindowVoiceChatReady, activeEditor: 'workbench.editor.chat' }), true);
	});

	test('Quick Voice Chat F1 stays gated to Agents Window', () => {
		const precondition = new QuickVoiceChatAction().desc.precondition;
		assert.ok(precondition);
		assert.strictEqual(evalPrecondition(precondition, voiceChatReady), false);
		assert.strictEqual(evalPrecondition(precondition, agentsWindowVoiceChatReady), true);
	});

	ensureNoDisposablesAreLeakedInTestSuite();
});
