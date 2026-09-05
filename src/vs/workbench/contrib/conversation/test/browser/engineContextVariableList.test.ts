/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	canSendEngineContextVariableListRequest,
	canSendEngineContextVariableRead,
	ENGINE_CONTEXT_VARIABLE_LIST_EMPTY_COPY,
	ENGINE_CONTEXT_VARIABLE_READ_LABEL,
	engineContextVariableListRequest,
	engineContextVariableReadRequest,
	flattenEngineContextVariableList,
	formatEngineContextVariableListLabel,
	formatEngineContextVariableReadLabel,
} from '../../browser/engineContextVariableList.js';

suite('Engine context-variable list bind', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('List gate is connected + hook; empty sessionId / agentId stay empty', () => {
		assert.strictEqual(canSendEngineContextVariableListRequest(false, true), false);
		assert.strictEqual(canSendEngineContextVariableListRequest(true, false), false);
		assert.strictEqual(canSendEngineContextVariableListRequest(true, true), true);
		assert.deepStrictEqual(engineContextVariableListRequest(), {
			sessionId: '',
			agentId: '',
		});
	});

	test('context-variable label keeps empty fields as-is', () => {
		assert.strictEqual(formatEngineContextVariableListLabel('current', {
			name: '',
			scope: 'VARIABLE_GLOBAL',
			updatedBy: '',
			updatedAt: 0,
			contentPreview: '',
		}), 'current —  — VARIABLE_GLOBAL —  — 0 — ');
		assert.strictEqual(formatEngineContextVariableListLabel('inherited', {
			name: '  var  ',
			scope: 'VARIABLE_LOCAL',
			updatedBy: '  agent  ',
			updatedAt: 0,
			contentPreview: '  preview  ',
		}), 'inherited —   var   — VARIABLE_LOCAL —   agent   — 0 —   preview  ');
		assert.strictEqual(ENGINE_CONTEXT_VARIABLE_LIST_EMPTY_COPY, 'No context variables.');
		assert.deepStrictEqual(flattenEngineContextVariableList([], []), []);
		assert.deepStrictEqual(flattenEngineContextVariableList(
			[{ name: '', scope: 'VARIABLE_GLOBAL', updatedBy: '', updatedAt: 0, contentPreview: '' }],
			[{ name: '  inherit  ', scope: 'VARIABLE_LOCAL', updatedBy: '', updatedAt: 0, contentPreview: '' }],
		), [
			{ source: 'current', entry: { name: '', scope: 'VARIABLE_GLOBAL', updatedBy: '', updatedAt: 0, contentPreview: '' } },
			{ source: 'inherited', entry: { name: '  inherit  ', scope: 'VARIABLE_LOCAL', updatedBy: '', updatedAt: 0, contentPreview: '' } },
		]);
	});

	test('Read gate is connected + hook; empty ids stay empty', () => {
		assert.strictEqual(canSendEngineContextVariableRead(false, true), false);
		assert.strictEqual(canSendEngineContextVariableRead(true, false), false);
		assert.strictEqual(canSendEngineContextVariableRead(true, true), true);
		assert.deepStrictEqual(engineContextVariableReadRequest(undefined), {
			sessionId: '',
			name: '',
			agentId: '',
		});
		assert.deepStrictEqual(engineContextVariableReadRequest({ name: '' }), {
			sessionId: '',
			name: '',
			agentId: '',
		});
		assert.deepStrictEqual(engineContextVariableReadRequest({ name: '  var  ' }), {
			sessionId: '',
			name: '  var  ',
			agentId: '',
		});
		assert.strictEqual(ENGINE_CONTEXT_VARIABLE_READ_LABEL, 'Read');
		assert.strictEqual(formatEngineContextVariableReadLabel({
			name: '',
			content: '',
			scope: 'VARIABLE_GLOBAL',
			updatedBy: '',
			updatedAt: 0,
		}), ' —  — VARIABLE_GLOBAL —  — 0');
	});
});
