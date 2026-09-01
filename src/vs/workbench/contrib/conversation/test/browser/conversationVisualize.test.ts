/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	comparisonMarkdown,
	mermaidFence,
	parseVisualizeArgs,
	validateConversationVisualizePayload,
	visualizeArgsFromMermaidTool,
} from '../../common/conversationVisualize.js';

suite('ConversationVisualize', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	suite('validateConversationVisualizePayload', () => {

		test('accepts a diagram with mermaid', () => {
			assert.doesNotThrow(() => validateConversationVisualizePayload({
				type: 'diagram',
				mermaid: 'graph LR; A-->B',
			}));
		});

		test('rejects a diagram without mermaid', () => {
			assert.throws(
				() => validateConversationVisualizePayload({ type: 'diagram', mermaid: '' }),
				/mermaid/,
			);
		});

		test('rejects a diagram with blank mermaid', () => {
			assert.throws(
				() => validateConversationVisualizePayload({ type: 'diagram', mermaid: '   ' }),
				/mermaid/,
			);
		});

		test('accepts a comparison with named options', () => {
			assert.doesNotThrow(() => validateConversationVisualizePayload({
				type: 'comparison',
				options: [
					{ name: 'A', pros: [], cons: [], recommended: false },
					{ name: 'B', pros: [], cons: [], recommended: true },
				],
			}));
		});

		test('rejects a comparison with no options', () => {
			assert.throws(
				() => validateConversationVisualizePayload({
					type: 'comparison',
					options: [],
				}),
				/options/,
			);
		});

		test('rejects a comparison option missing a name', () => {
			assert.throws(
				() => validateConversationVisualizePayload({
					type: 'comparison',
					options: [{ name: '', pros: [], cons: [], recommended: false }],
				}),
				/name/,
			);
		});
	});

	suite('parseVisualizeArgs', () => {

		test('returns validated args for a diagram payload', () => {
			const result = parseVisualizeArgs({ type: 'diagram', mermaid: 'graph LR; A-->B', title: 'Flow' });
			assert.strictEqual(result.ok, true);
			if (result.ok) {
				assert.strictEqual(result.args.type, 'diagram');
				assert.strictEqual(result.args.title, 'Flow');
				assert.strictEqual(result.args.mermaid, 'graph LR; A-->B');
			}
		});

		test('returns fallback markdown instead of throwing for invalid diagram payload', () => {
			const result = parseVisualizeArgs({ type: 'diagram', mermaid: '   ', title: 'Broken' });
			assert.strictEqual(result.ok, false);
			if (!result.ok) {
				assert.match(result.error, /mermaid/);
				assert.match(result.fallbackMarkdown, /Visualize error/);
				assert.match(result.fallbackMarkdown, /```mermaid/);
				assert.match(result.fallbackMarkdown, /Broken/);
			}
		});

		test('normalizes comparison options with default pros, cons, and recommended', () => {
			const result = parseVisualizeArgs({
				type: 'comparison',
				options: [{ name: 'Stub A' }, { name: 'Stub B', recommended: true }],
			});
			assert.strictEqual(result.ok, true);
			if (result.ok) {
				assert.strictEqual(result.args.type, 'comparison');
				assert.deepStrictEqual(result.args.options[0], {
					name: 'Stub A',
					description: undefined,
					pros: [],
					cons: [],
					recommended: false,
					mermaid: undefined,
				});
				assert.strictEqual(result.args.options[1].recommended, true);
			}
		});
	});

	suite('mermaidFence', () => {

		test('wraps the source in a mermaid fence', () => {
			const out = mermaidFence(undefined, 'graph LR; A-->B');
			assert.match(out, /```mermaid/);
			assert.match(out, /graph LR; A-->B/);
			assert.ok(out.trimEnd().endsWith('```'));
		});

		test('puts the title as a heading before the fence', () => {
			const out = mermaidFence('Flow', 'graph LR; A-->B');
			assert.match(out, /Flow/);
			assert.ok(out.indexOf('Flow') < out.indexOf('```mermaid'));
		});

		test('trims surrounding whitespace from the source', () => {
			const out = mermaidFence(undefined, '\n  graph LR; A-->B  \n');
			assert.match(out, /```mermaid\ngraph LR; A-->B\n```/);
		});
	});

	suite('comparisonMarkdown', () => {

		const options = [
			{ name: 'Option A', description: 'First', pros: ['fast'], cons: ['pricey'], recommended: false },
			{ name: 'Option B', pros: ['cheap'], cons: [], recommended: true },
		];

		test('renders each option name', () => {
			const out = comparisonMarkdown(undefined, options);
			assert.match(out, /Option A/);
			assert.match(out, /Option B/);
		});

		test('marks only the recommended option', () => {
			const out = comparisonMarkdown(undefined, options);
			const marker = '✅ Recommended';
			assert.strictEqual(out.split(marker).length - 1, 1);
			assert.ok(out.indexOf(marker) > out.indexOf('Option A'));
		});

		test('lists pros and cons as bullets', () => {
			const out = comparisonMarkdown(undefined, options);
			assert.match(out, /- fast/);
			assert.match(out, /- pricey/);
			assert.match(out, /- cheap/);
		});

		test('includes an inline mermaid fence when an option has one', () => {
			const out = comparisonMarkdown(undefined, [{
				name: 'Arch',
				pros: [],
				cons: [],
				recommended: false,
				mermaid: 'graph TD; X-->Y',
			}]);
			assert.match(out, /```mermaid/);
			assert.match(out, /graph TD; X-->Y/);
		});

		test('puts the title as a heading before the first option', () => {
			const out = comparisonMarkdown('Choices', options);
			assert.match(out, /Choices/);
			assert.ok(out.indexOf('Choices') < out.indexOf('Option A'));
		});
	});

	suite('visualizeArgsFromMermaidTool', () => {

		test('maps renderMermaidDiagram-shaped input to diagram args', () => {
			const args = visualizeArgsFromMermaidTool({ markup: 'graph LR; A-->B', title: 'Roadmap' });
			assert.deepStrictEqual(args, {
				type: 'diagram',
				mermaid: 'graph LR; A-->B',
				title: 'Roadmap',
			});
		});
	});
});
