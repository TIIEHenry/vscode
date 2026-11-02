/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { getAgentProfileContentIssue } from '../../common/universeAgentAgentProfileContent.js';

suite('Agent profile raw Instructions content', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	// Independent literal expectations for the pinned Kotlin/JVM loader order.
	const cases: readonly { readonly body: string | undefined; readonly valid: boolean }[] = [
		{ body: undefined, valid: false }, { body: '', valid: false },
		{ body: ' \t\n\r', valid: false }, { body: '\u0000', valid: false },
		{ body: '\u2003\u0000', valid: false }, { body: '\u0000\u2003', valid: true },
		{ body: '\u00a0\u0000', valid: false }, { body: '\u0000\u00a0', valid: true },
		{ body: '\u001b', valid: false }, { body: '\u001b\u2003', valid: true },
		{ body: '\u001c\u00a0\u1680\u2000\u2028\u202f\u205f\u3000', valid: false },
		{ body: '\ufeff', valid: true }, { body: '\u0085', valid: true },
		{ body: '\u180e', valid: true }, { body: '\u200b', valid: true },
		{ body: '---', valid: true }, { body: '---\ncustom: true\n---', valid: true },
		{ body: '---\nsummary: same\n---\n---\n---', valid: true },
		{ body: '  body\r\nsecond\rline  \u0000', valid: true },
	];

	for (const { body, valid } of cases) {
		test(`raw body ${JSON.stringify(body)} is ${valid ? 'valid' : 'invalid'}`, () => {
			const profile = { systemPrompt: body };
			assert.deepStrictEqual({ valid: getAgentProfileContentIssue(profile) === undefined, body: profile.systemPrompt }, { valid, body });
		});
	}

	test('independent pinned JVM golden whitespace characters are all blank', () => {
		// Java 21.0.11 / Kotlin 2.3.21, actual CharsKt.isWhitespace,
		// StringsKt.isBlank and trim agree on these 28 BMP characters.
		const whitespace = [0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000];
		assert.deepStrictEqual(whitespace.map(code => getAgentProfileContentIssue({ systemPrompt: String.fromCharCode(code) })), whitespace.map(() => 'Instructions are required.'));
	});

	test('non-string runtime data is rejected without coercion', () => {
		for (const systemPrompt of [null, 123, {}, []]) {
			assert.strictEqual(getAgentProfileContentIssue({ systemPrompt: systemPrompt as unknown as string }), 'Instructions are required.');
		}
	});

	test('metadata cannot provide the independently required raw body', () => {
		// PIN gRPC defaults are non-null strings, so the writer always closes
		// the outer block before appending raw Instructions. These are literal
		// persisted files, not a second implementation of its YAML writer.
		const files = [
			{ body: '', persisted: '---\nsummary: \nusage: \ndetailLevel: \n---\n\n', valid: false },
			{ body: '\u2003\u0000', persisted: '---\nsummary: \nusage: \ndetailLevel: \n---\n\n\u2003\u0000', valid: false },
			{ body: '', persisted: '---\nsummary: x\n---\nmetadata pseudo body\nusage: \ndetailLevel: \n---\n\n', valid: false },
			{ body: '---\ncustom: true\n---', persisted: '---\nsummary: \nusage: \ndetailLevel: \n---\n\n---\ncustom: true\n---', valid: true },
		];
		for (const entry of files) {
			assert.ok(entry.persisted.endsWith(`---\n\n${entry.body}`));
			assert.strictEqual(getAgentProfileContentIssue({ systemPrompt: entry.body }) === undefined, entry.valid);
		}
	});
});
