/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { projectProcessFoldSpans, summarizeProcessSteps } from './conversationProcessFoldModel.js';
import { ConversationStubTurn } from './conversationStubModel.js';

suite('conversationProcessFoldModel (browser unit)', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('summarizeProcessSteps uses thinking text before payload for the outer step list', () => {
		const turns: ConversationStubTurn[] = [{
			id: 't1',
			kind: 'thinking',
			text: 'Stub: outline sections',
			payload: 'Stub: Consider intro, setup, usage, and license sections.',
		}, {
			id: 'tool1',
			kind: 'tool',
			text: 'Stub: README.md',
			toolName: 'read',
		}];
		const span = projectProcessFoldSpans(turns)[0];
		assert.ok(span);
		const summary = summarizeProcessSteps(span);
		assert.ok(summary.includes('Stub: outline sections'));
		assert.ok(!summary.includes('Consider intro'));
	});

	test('summarizeProcessSteps still falls back to payload when text is the THINKING title', () => {
		const body = `${'甲'.repeat(80)}${'乙'.repeat(40)}`;
		const turns: ConversationStubTurn[] = [{
			id: 't1',
			kind: 'thinking',
			text: 'THINKING',
			payload: body,
		}];
		const span = projectProcessFoldSpans(turns)[0];
		assert.ok(span);
		const summary = summarizeProcessSteps(span);
		assert.ok(summary.includes('…'));
		assert.ok(!summary.includes('THINKING'));
	});
});
