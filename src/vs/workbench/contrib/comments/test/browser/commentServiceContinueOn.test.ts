/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { PendingCommentThread } from '../../../../../editor/common/languages.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IStorageService, StorageScope, StorageTarget, WillSaveStateReason } from '../../../../../platform/storage/common/storage.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { CommentService, ICommentController, ICommentInfo } from '../../browser/commentService.js';

const CONTINUE_ON_COMMENTS = 'comments.continueOnComments';

function pendingThread(path: string, body: string): PendingCommentThread {
	return {
		uniqueOwner: 'test',
		uri: URI.file(path),
		range: new Range(2, 1, 2, 5),
		comment: { body, cursor: { lineNumber: 1, column: body.length + 1 } },
		isReply: false,
	};
}

function createController(): ICommentController {
	return {
		id: 'test',
		label: 'Test Comments',
		owner: 'test',
		features: {},
		activeComment: undefined,
		createCommentThreadTemplate: async () => { },
		updateCommentThreadTemplate: async () => { },
		deleteCommentThreadMain: () => { },
		toggleReaction: async () => { },
		getDocumentComments: async (resource: URI): Promise<ICommentInfo> => ({
			uniqueOwner: 'test',
			threads: [],
			commentingRanges: { resource, ranges: [], fileComments: false },
		}),
		getNotebookComments: async () => ({ uniqueOwner: 'test', threads: [] }),
		setActiveCommentAndThread: async () => { },
	};
}

suite('Comments - continue on comments storage', () => {
	let disposables: DisposableStore;
	let instantiationService: TestInstantiationService;
	let storageService: TestStorageService;

	setup(() => {
		disposables = new DisposableStore();
		instantiationService = workbenchInstantiationService({}, disposables);
		instantiationService.stub(IConfigurationService, new TestConfigurationService());
		storageService = disposables.add(new TestStorageService());
		instantiationService.stub(IStorageService, storageService);
	});

	teardown(() => {
		instantiationService.dispose();
		disposables.dispose();
	});

	ensureNoDisposablesAreLeakedInTestSuite();

	function storedBodies(): string[] {
		const storage: IStorageService = storageService;
		const stored = storage.getObject<PendingCommentThread[]>(CONTINUE_ON_COMMENTS, StorageScope.WORKSPACE, []);
		return stored.map(thread => `${thread.uri.path}:${thread.comment.body}`).sort();
	}

	test('restores pending comments saved by a previous session', async () => {
		storageService.store(CONTINUE_ON_COMMENTS, [pendingThread('/workspace/closed.ts', 'unsent draft')], StorageScope.WORKSPACE, StorageTarget.USER);

		const commentService = disposables.add(instantiationService.createInstance(CommentService));
		commentService.registerCommentController('test', createController());

		const [info] = await commentService.getDocumentComments(URI.file('/workspace/closed.ts'));
		assert.deepStrictEqual(info?.pendingCommentThreads?.map(thread => thread.comment.body), ['unsent draft']);
	});

	test('saving state keeps stored pending comments of files that are not open', () => {
		storageService.store(CONTINUE_ON_COMMENTS, [pendingThread('/workspace/closed.ts', 'unsent draft')], StorageScope.WORKSPACE, StorageTarget.USER);

		const commentService = disposables.add(instantiationService.createInstance(CommentService));
		disposables.add(commentService.registerContinueOnCommentProvider({
			provideContinueOnComments: () => [pendingThread('/workspace/open.ts', 'draft in editor')],
		}));

		storageService.testEmitWillSaveState(WillSaveStateReason.NONE);

		assert.deepStrictEqual(storedBodies(), [
			'/workspace/closed.ts:unsent draft',
			'/workspace/open.ts:draft in editor',
		]);
	});

	test('saving state prefers the editor draft over the restored one at the same location', () => {
		storageService.store(CONTINUE_ON_COMMENTS, [pendingThread('/workspace/file.ts', 'old draft')], StorageScope.WORKSPACE, StorageTarget.USER);

		const commentService = disposables.add(instantiationService.createInstance(CommentService));
		disposables.add(commentService.registerContinueOnCommentProvider({
			provideContinueOnComments: () => [pendingThread('/workspace/file.ts', 'edited draft')],
		}));

		storageService.testEmitWillSaveState(WillSaveStateReason.NONE);

		assert.deepStrictEqual(storedBodies(), ['/workspace/file.ts:edited draft']);
	});

	test('a pending comment taken over by an editor is not saved again once cleared', () => {
		storageService.store(CONTINUE_ON_COMMENTS, [pendingThread('/workspace/file.ts', 'old draft')], StorageScope.WORKSPACE, StorageTarget.USER);

		const commentService = disposables.add(instantiationService.createInstance(CommentService));
		const resumed = pendingThread('/workspace/file.ts', 'old draft');
		assert.ok(commentService.removeContinueOnComment({ uniqueOwner: resumed.uniqueOwner, uri: resumed.uri, range: resumed.range!, isReply: false }));
		disposables.add(commentService.registerContinueOnCommentProvider({
			provideContinueOnComments: () => [],
		}));

		storageService.testEmitWillSaveState(WillSaveStateReason.NONE);

		assert.deepStrictEqual(storedBodies(), []);
	});
});
