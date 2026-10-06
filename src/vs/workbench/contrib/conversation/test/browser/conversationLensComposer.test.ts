/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { InMemoryStorageService } from '../../../../../platform/storage/common/storage.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ENGINE_BIND_FAILED_SESSION_ID } from '../../browser/conversationEngineRosterService.js';
import { pruneOrphanComposerDrafts, type IConversationLensComposerHost } from '../../browser/conversationLensComposer.js';
import { loadUaClientComposerDraft, storeUaClientComposerDraft, uaClientComposerDraftEntryKey } from '../../browser/uaClientComposerDrafts.js';

suite('conversationLensComposer', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('pruneOrphanComposerDrafts keeps drafts when the visible roster narrows to bind-fail only', () => {
		const storageService = new InMemoryStorageService();
		storeUaClientComposerDraft(storageService, 'sess-A', 'default', 'draft on A');
		const draftKey = uaClientComposerDraftEntryKey('sess-A', 'default');
		const drafts = new Map<string, string>([[draftKey, 'draft on A']]);
		const host = {
			drafts,
			storageService,
			stubService: {
				getSessions: () => [{ id: ENGINE_BIND_FAILED_SESSION_ID, title: '' }],
			},
		} as unknown as IConversationLensComposerHost;

		pruneOrphanComposerDrafts(host);

		assert.strictEqual(drafts.get(draftKey), 'draft on A');
		assert.strictEqual(loadUaClientComposerDraft(storageService, 'sess-A', 'default'), 'draft on A');
	});

});
