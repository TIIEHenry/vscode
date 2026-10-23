/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { COMPOSER_IME_COMMIT_GUARD_MS, IComposerImeBlockedEnterInput, isComposerImeBlockedEnter, isComposerImeCommitGuardEnter } from '../../browser/conversationComposerIme.js';

suite('isComposerImeBlockedEnter', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const endedAt = 1_000;

	function enter(overrides: Partial<IComposerImeBlockedEnterInput> = {}): IComposerImeBlockedEnterInput {
		return {
			isComposing: false,
			keyCode: 13,
			shiftKey: false,
			metaKey: false,
			ctrlKey: false,
			altKey: false,
			compositionEndedAt: undefined,
			now: endedAt,
			...overrides,
		};
	}

	test('composing blocks', () => {
		assert.strictEqual(isComposerImeBlockedEnter(enter({
			isComposing: true,
			shiftKey: true,
			compositionEndedAt: 0,
			now: endedAt + COMPOSER_IME_COMMIT_GUARD_MS,
		})), true);
	});

	test('keyCode 229 blocks', () => {
		assert.strictEqual(isComposerImeBlockedEnter(enter({
			keyCode: 229,
			metaKey: true,
		})), true);
	});

	test('499ms after compositionend, plain Enter blocks', () => {
		assert.strictEqual(isComposerImeBlockedEnter(enter({
			compositionEndedAt: endedAt,
			now: endedAt,
		})), true);
		assert.strictEqual(isComposerImeBlockedEnter(enter({
			compositionEndedAt: endedAt,
			now: endedAt + COMPOSER_IME_COMMIT_GUARD_MS - 1,
		})), true);
	});

	test('500ms after compositionend, plain Enter does not block', () => {
		assert.strictEqual(isComposerImeBlockedEnter(enter({
			compositionEndedAt: endedAt,
			now: endedAt + COMPOSER_IME_COMMIT_GUARD_MS,
		})), false);
	});

	test('within the window, Shift, Meta, Ctrl, and Alt Enter do not block', () => {
		const within = { compositionEndedAt: endedAt, now: endedAt + COMPOSER_IME_COMMIT_GUARD_MS - 1 };
		assert.strictEqual(isComposerImeBlockedEnter(enter({ ...within, shiftKey: true })), false);
		assert.strictEqual(isComposerImeBlockedEnter(enter({ ...within, metaKey: true })), false);
		assert.strictEqual(isComposerImeBlockedEnter(enter({ ...within, ctrlKey: true })), false);
		assert.strictEqual(isComposerImeBlockedEnter(enter({ ...within, altKey: true })), false);
	});

	test('no composition timestamp, plain Enter does not block', () => {
		assert.strictEqual(isComposerImeBlockedEnter(enter()), false);
	});

	test('the commit guard is one Enter; composing does not consume it', () => {
		const within = { compositionEndedAt: endedAt, now: endedAt + 10 };
		assert.strictEqual(isComposerImeCommitGuardEnter(enter(within)), true);
		assert.strictEqual(isComposerImeCommitGuardEnter(enter({ ...within, isComposing: true })), false);
		assert.strictEqual(isComposerImeCommitGuardEnter(enter({ ...within, keyCode: 229 })), false);
		assert.strictEqual(isComposerImeCommitGuardEnter(enter({ ...within, shiftKey: true })), false);
		assert.strictEqual(isComposerImeBlockedEnter(enter({ ...within, compositionEndedAt: undefined })), false);
	});
});
