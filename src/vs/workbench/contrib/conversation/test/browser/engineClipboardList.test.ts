/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	canSendEngineClipboardClear,
	canSendEngineClipboardListRequest,
	canSendEngineClipboardRead,
	canSendEngineClipboardWrite,
	ENGINE_CLIPBOARD_CLEAR_LABEL,
	ENGINE_CLIPBOARD_LIST_EMPTY_COPY,
	ENGINE_CLIPBOARD_READ_LABEL,
	ENGINE_CLIPBOARD_WRITE_LABEL,
	engineClipboardClearRequest,
	engineClipboardListRequest,
	engineClipboardReadRequest,
	engineClipboardWriteRequest,
	formatEngineClipboardClearLabel,
	formatEngineClipboardListLabel,
	formatEngineClipboardReadLabel,
	formatEngineClipboardWriteLabel,
} from '../../browser/engineClipboardList.js';

suite('Engine clipboard list bind', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('List gate is connected + hook; empty sessionId stays empty', () => {
		assert.strictEqual(canSendEngineClipboardListRequest(false, true), false);
		assert.strictEqual(canSendEngineClipboardListRequest(true, false), false);
		assert.strictEqual(canSendEngineClipboardListRequest(true, true), true);
		assert.deepStrictEqual(engineClipboardListRequest(), {
			sessionId: '',
		});
	});

	test('clipboard label keeps empty fields as-is', () => {
		assert.strictEqual(formatEngineClipboardListLabel({
			clipId: '',
			label: '',
			type: 'CLIPBOARD_TEXT',
			createdBy: '',
			createdAt: 0,
		}), ' — CLIPBOARD_TEXT — ');
		assert.strictEqual(formatEngineClipboardListLabel({
			clipId: '  clip  ',
			label: '  Note  ',
			type: 'CLIPBOARD_FILE_PATH',
			createdBy: '  agent  ',
			createdAt: 0,
		}), '  Note   — CLIPBOARD_FILE_PATH —   clip  ');
		assert.strictEqual(ENGINE_CLIPBOARD_LIST_EMPTY_COPY, 'No clipboard entries.');
	});

	test('Read gate is connected + hook; empty ids stay empty', () => {
		assert.strictEqual(canSendEngineClipboardRead(false, true), false);
		assert.strictEqual(canSendEngineClipboardRead(true, false), false);
		assert.strictEqual(canSendEngineClipboardRead(true, true), true);
		assert.deepStrictEqual(engineClipboardReadRequest(undefined), {
			sessionId: '',
			clipId: '',
		});
		assert.deepStrictEqual(engineClipboardReadRequest({ clipId: '' }), {
			sessionId: '',
			clipId: '',
		});
		assert.deepStrictEqual(engineClipboardReadRequest({ clipId: '  clip  ' }), {
			sessionId: '',
			clipId: '  clip  ',
		});
		assert.strictEqual(ENGINE_CLIPBOARD_READ_LABEL, 'Read');
		assert.strictEqual(formatEngineClipboardReadLabel({
			clipId: '',
			label: '',
			type: 'CLIPBOARD_TEXT',
			content: '',
			createdBy: '',
			createdAt: 0,
		}), ' —  — CLIPBOARD_TEXT —  —  — 0');
	});

	test('Write gate is connected + hook; empty ids stay empty', () => {
		assert.strictEqual(canSendEngineClipboardWrite(false, true), false);
		assert.strictEqual(canSendEngineClipboardWrite(true, false), false);
		assert.strictEqual(canSendEngineClipboardWrite(true, true), true);
		assert.deepStrictEqual(engineClipboardWriteRequest(), {
			sessionId: '',
			agentId: '',
			label: '',
			type: 'CLIPBOARD_TEXT',
			content: '',
			filePath: '',
			url: '',
		});
		assert.strictEqual(ENGINE_CLIPBOARD_WRITE_LABEL, 'Write');
		assert.strictEqual(formatEngineClipboardWriteLabel(''), '');
		assert.strictEqual(formatEngineClipboardWriteLabel('  clip  '), '  clip  ');
	});

	test('Clear gate is connected + hook; empty sessionId stays empty', () => {
		assert.strictEqual(canSendEngineClipboardClear(false, true), false);
		assert.strictEqual(canSendEngineClipboardClear(true, false), false);
		assert.strictEqual(canSendEngineClipboardClear(true, true), true);
		assert.deepStrictEqual(engineClipboardClearRequest(), {
			sessionId: '',
		});
		assert.strictEqual(ENGINE_CLIPBOARD_CLEAR_LABEL, 'Clear');
		assert.strictEqual(formatEngineClipboardClearLabel(0), '0');
		assert.strictEqual(formatEngineClipboardClearLabel(3), '3');
	});
});
