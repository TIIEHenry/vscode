/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { agentsMarkdownSaveUpdates, formatAgentsMarkdown, parseAgentsMarkdown } from '../../browser/engineAgentAgentsMd.js';

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

	test('save keeps quoted frontmatter newlines and quotes instead of JSON escapes', () => {
		const source = formatAgentsMarkdown({
			summary: 'line\n2',
			usage: 'say "hi"\nnow',
			detailLevel: '"quoted"',
			description: 'a: b\\c',
			systemPrompt: 'body',
		});
		const parsed = parseAgentsMarkdown(source);
		assert.strictEqual(parsed.summary, 'line\n2');
		assert.strictEqual(parsed.usage, 'say "hi"\nnow');
		assert.strictEqual(parsed.detailLevel, '"quoted"');
		assert.strictEqual(parsed.description, 'a: b\\c');
		assert.strictEqual(parsed.systemPrompt, 'body');
		assert.strictEqual(parseAgentsMarkdown('---\nsummary: \'keep me\'\n---\nbody').summary, 'keep me');

		const updates = agentsMarkdownSaveUpdates(source);
		assert.strictEqual(updates.summary, 'line\n2');
		assert.strictEqual(updates.usage, 'say "hi"\nnow');
		assert.strictEqual(updates.detailLevel, '"quoted"');
		assert.strictEqual(updates.description, 'a: b\\c');
		assert.strictEqual(updates.systemPrompt, 'body');
		assert.strictEqual(formatAgentsMarkdown({
			summary: updates.summary,
			usage: updates.usage,
			detailLevel: updates.detailLevel,
			description: updates.description,
			systemPrompt: updates.systemPrompt,
		}), source);
	});

	test('formatAgentsMarkdown keeps separate fields when the prompt already starts with ---', () => {
		const systemPrompt = '---\nsummary: inside\n---\nactual body';
		const text = formatAgentsMarkdown({
			summary: 'line\n2',
			usage: 'general',
			systemPrompt,
		});
		assert.ok(text.includes('summary: "line\\n2"'), text);
		assert.ok(text.includes('usage: general'), text);
		assert.ok(text.endsWith(systemPrompt), text);
		const updates = agentsMarkdownSaveUpdates(text);
		assert.strictEqual(updates.summary, 'line\n2');
		assert.strictEqual(updates.usage, 'general');
		assert.strictEqual(updates.detailLevel, undefined);
		assert.strictEqual(updates.description, undefined);
		assert.strictEqual(updates.systemPrompt, systemPrompt);
	});

	test('formatAgentsMarkdown still shows summary when a leading --- is not a closed frontmatter block', () => {
		const systemPrompt = '---\nnot a field block';
		const text = formatAgentsMarkdown({ summary: 'keep me', systemPrompt });
		assert.ok(text.includes('summary: keep me'), text);
		assert.ok(text.endsWith(systemPrompt), text);
		const updates = agentsMarkdownSaveUpdates(text);
		assert.strictEqual(updates.summary, 'keep me');
		assert.strictEqual(updates.systemPrompt, systemPrompt);
	});

	test('formatAgentsMarkdown does not wrap a second frontmatter when profile fields already match the prompt', () => {
		const raw = formatAgentsMarkdown({
			summary: 'Demo',
			usage: 'coding',
			systemPrompt: '# Body',
		});
		assert.strictEqual(formatAgentsMarkdown({
			summary: 'Demo',
			usage: 'coding',
			systemPrompt: raw,
		}), raw);
	});
});
