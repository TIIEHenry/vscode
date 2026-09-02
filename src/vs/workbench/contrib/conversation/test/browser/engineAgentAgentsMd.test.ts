/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { formatAgentsMarkdown, parseAgentsMarkdown } from '../../browser/engineAgentAgentsMd.js';

suite('engineAgentAgentsMd', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('formatAgentsMarkdown composes frontmatter and body', () => {
		const text = formatAgentsMarkdown({
			summary: 'Short summary',
			usage: 'general',
			systemPrompt: '# Instructions',
		});
		assert.ok(text.startsWith('---\n'));
		assert.ok(text.includes('summary: Short summary'));
		assert.ok(text.endsWith('# Instructions'));
	});

	test('parseAgentsMarkdown round-trips composed markdown', () => {
		const source = '---\nsummary: Demo\nusage: coding\n---\n# Body\n\nMore text';
		const parsed = parseAgentsMarkdown(source);
		assert.strictEqual(parsed.summary, 'Demo');
		assert.strictEqual(parsed.usage, 'coding');
		assert.strictEqual(parsed.systemPrompt, '# Body\n\nMore text');
		assert.strictEqual(formatAgentsMarkdown({ ...parsed, systemPrompt: parsed.systemPrompt }), source);
	});

	test('formatAgentsMarkdown preserves raw file when systemPrompt includes frontmatter', () => {
		const raw = '---\ncustom: true\n---\nBody';
		assert.strictEqual(formatAgentsMarkdown({ systemPrompt: raw }), raw);
	});
});
