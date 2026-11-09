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

suite('Conversation sessions inline filter chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('clear button motion stays within the 100ms contract and honors reduced motion', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationSessionsInlineFilter.css'), 'utf8');
		assert.match(css, /\.conversation-sessions-inline-filter-clear\s*\{[^}]*transition:\s*color 100ms[\s\S]*background-color 100ms/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.conversation-sessions-inline-filter-clear\s*\{[^}]*transition:\s*none;/s);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.conversation-sessions-inline-filter-clear\s*\{[^}]*transition:\s*none;/s);
	});
});
