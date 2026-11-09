/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../..');
const mediaPath = path.join(repoRoot, 'src/vs/workbench/browser/parts/conversation/media/ua-common.css');

suite('Conversation shared motion contract', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('prefers-reduced-motion keeps the ua-motion marker opt-in', () => {
		const css = fs.readFileSync(mediaPath, 'utf8');
		const media = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
		assert.match(media, /\.monaco-workbench:not\(\.monaco-enable-motion\) \.ua-motion\s*\{[^}]*transition:\s*none;[^}]*animation:\s*none;/s);
		assert.doesNotMatch(media, /(?:^|\n)\s*\.ua-motion\s*\{/);
		assert.match(css, /\.ua-motion\s*\{[^}]*\/\* marker \*\//s);
	});

	test('conversation motion nodes keep the ua-motion marker', () => {
		for (const relativePath of [
			'src/vs/workbench/contrib/conversation/browser/conversationProcessFold.ts',
			'src/vs/workbench/contrib/conversation/browser/conversationVisualizeCard.ts',
			'src/vs/workbench/contrib/conversation/browser/conversationSessionsView.ts',
		]) {
			const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
			assert.match(source, /ua-motion/, `${relativePath} must keep the ua-motion marker`);
		}
	});
});
