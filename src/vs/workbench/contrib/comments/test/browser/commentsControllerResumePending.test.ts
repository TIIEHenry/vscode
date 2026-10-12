/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { PendingComment, PendingCommentThread } from '../../../../../editor/common/languages.js';
import { URI } from '../../../../../base/common/uri.js';
import { CommentController } from '../../browser/commentsController.js';

type ResumeHost = {
	_commentWidgets: unknown[];
	commentService: { removeContinueOnComment(): boolean };
	resumePendingComment(editorURI: URI, thread: PendingCommentThread): Promise<void>;
};

async function resumePending(existingBody: string, incomingBody: string): Promise<PendingComment> {
	let received: PendingComment | undefined;
	const range = new Range(3, 1, 3, 8);
	const zone = {
		uniqueOwner: 'test-owner',
		commentThread: { range },
		getPendingComments: () => ({
			newComment: { body: existingBody, cursor: { lineNumber: 1, column: 1 } },
			edits: {},
		}),
		setPendingComment: (pending: PendingComment) => {
			received = pending;
		},
	};
	const controller = Object.create(CommentController.prototype) as ResumeHost;
	controller._commentWidgets = [zone];
	controller.commentService = { removeContinueOnComment: () => true };
	const thread: PendingCommentThread = {
		range,
		uri: URI.parse('file:///workspace/file.ts'),
		uniqueOwner: 'test-owner',
		isReply: false,
		comment: { body: incomingBody, cursor: { lineNumber: 4, column: 2 } },
	};
	await controller.resumePendingComment(thread.uri, thread);
	assert.ok(received);
	return received;
}

suite('Comments - resumePendingComment', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('resumePendingComment joins bodies that do not include each other', async () => {
		const existing = 'alpha draft';
		const incoming = 'beta pending';
		const pending = await resumePending(existing, incoming);
		assert.strictEqual(pending.body, `${existing}\n${incoming}`);
		assert.strictEqual(pending.body.includes('[object Object]'), false);
		assert.deepStrictEqual(pending.cursor, { lineNumber: 4, column: 2 });
	});

	test('resumePendingComment keeps the longer body when one includes the other', async () => {
		const longer = 'keep the longer draft text';
		const shorter = 'longer draft';
		const keptExisting = await resumePending(longer, shorter);
		assert.strictEqual(keptExisting.body, longer);
		assert.notStrictEqual(keptExisting.body, `${longer}\n${shorter}`);
		assert.strictEqual(keptExisting.body.includes('[object Object]'), false);

		const keptIncoming = await resumePending(shorter, longer);
		assert.strictEqual(keptIncoming.body, longer);
		assert.notStrictEqual(keptIncoming.body, `${shorter}\n${longer}`);
		assert.strictEqual(keptIncoming.body.includes('[object Object]'), false);
	});
});
