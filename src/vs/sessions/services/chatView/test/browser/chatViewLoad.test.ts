/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationError } from '../../../../../base/common/errors.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { chatViewLoadFailureMessage, isChatViewLoadFailure } from '../../browser/chatViewLoad.js';

suite('Sessions - Chat View Load', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('a missing model is a failure only while this view still shows that chat', () => {
		assert.deepStrictEqual({
			missing: isChatViewLoadFailure(false, false, true),
			acquired: isChatViewLoadFailure(false, true, true),
			cancelled: isChatViewLoadFailure(true, false, true),
			movedOn: isChatViewLoadFailure(false, false, false),
		}, {
			missing: true,
			acquired: false,
			cancelled: false,
			movedOn: false,
		});
	});

	test('describes a missing model and a thrown load without treating cancellation as a failure', () => {
		assert.deepStrictEqual({
			missing: chatViewLoadFailureMessage(),
			thrown: chatViewLoadFailureMessage(new Error('boom')),
			cancelled: chatViewLoadFailureMessage(new CancellationError()),
		}, {
			missing: 'Failed to open chat session.',
			thrown: 'Failed to open chat session: boom',
			cancelled: 'Failed to open chat session.',
		});
	});
});
