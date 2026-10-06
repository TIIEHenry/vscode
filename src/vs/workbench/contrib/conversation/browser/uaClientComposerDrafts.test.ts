/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { InMemoryStorageService } from '../../../../platform/storage/common/storage.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
	loadUaClientComposerDraft,
	removeUaClientComposerDraftsForSession,
	storeUaClientComposerDraft,
} from './uaClientComposerDrafts.js';

suite('uaClientComposerDrafts (unit)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('removeUaClientComposerDraftsForSession drops drafts whose chatId contains slashes', () => {
		const storageService = new InMemoryStorageService();
		storeUaClientComposerDraft(storageService, 'sess-1', 'team/worker', 'sub-agent draft');

		removeUaClientComposerDraftsForSession(storageService, 'sess-1');

		assert.strictEqual(loadUaClientComposerDraft(storageService, 'sess-1', 'team/worker'), '');
		assert.strictEqual(loadUaClientComposerDraft(storageService, 'sess-1', 'default'), '');
	});

});
