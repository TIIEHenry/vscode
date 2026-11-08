/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { getConversationChatResource } from '../common/conversationChatInput.js';
import {
	CONVERSATION_REFS_MARKER,
	composeConversationPayload,
	composerSubmitText,
	type IComposerSurfaceHost,
} from './conversationComposerRefs.js';

suite('conversationComposerRefs (unit)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('composerSubmitText does not duplicate a trailer pasted into the body while chips still hold the ref', () => {
		const line = getConversationChatResource('s1', 'c1').toString();
		const wireBody = `hello\n\n${CONVERSATION_REFS_MARKER}\n${line}`;
		const host: IComposerSurfaceHost = {
			dockTextarea: { value: wireBody },
			composerRefResources: [line],
		};
		const expected = composeConversationPayload('hello', [line]);
		assert.strictEqual(composerSubmitText(host), expected);
		assert.strictEqual((composerSubmitText(host)?.match(new RegExp(CONVERSATION_REFS_MARKER, 'g')) ?? []).length, 1);
	});
});
