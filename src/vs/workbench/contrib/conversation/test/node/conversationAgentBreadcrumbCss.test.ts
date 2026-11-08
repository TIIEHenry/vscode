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

suite('Conversation agent breadcrumb chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('breadcrumb item motion stays within the 100ms contract and honors reduced motion', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationAgentBreadcrumb.css'), 'utf8');
		assert.match(css, /\.monaco-workbench \.conversation-agent-breadcrumb-item\s*\{[^}]*transition:\s*background-color 100ms/s);
		assert.doesNotMatch(css, /transition:\s*[^;]*0\.12s/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.conversation-agent-breadcrumb-item::before[\s\S]*?transition:\s*none;/s);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.conversation-agent-breadcrumb-item::before[\s\S]*?transition:\s*none;/s);
	});

	test('breadcrumb pressed surface follows hover surface', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationAgentBreadcrumb.css'), 'utf8');
		const hoverIndex = css.indexOf('.conversation-agent-breadcrumb-item:not([aria-current="location"]):hover');
		const pressedIndex = css.indexOf('.conversation-agent-breadcrumb-item:active');
		assert.ok(hoverIndex >= 0, 'breadcrumb hover surface contract');
		assert.ok(pressedIndex > hoverIndex, 'pressed surface must follow hover surface so pointer-down feedback wins');
		assert.match(css, /\.conversation-agent-breadcrumb-item:not\(\[aria-current="location"\]\):hover[^\{]*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /\.conversation-agent-breadcrumb-item:not\(\[aria-current="location"\]\):hover::before[^\{]*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /\.conversation-agent-breadcrumb-item:active:not\(\[aria-current="location"\]\)\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /\.conversation-agent-breadcrumb-item:active:not\(\[aria-current="location"\]\)::before\s*\{[^}]*toolbar-activeBackground/s);
		assert.match(css, /\.conversation-agent-breadcrumb-item\s*\{[^}]*position:\s*relative[^}]*isolation:\s*isolate/s);
		assert.match(css, /\.conversation-agent-breadcrumb-item::before\s*\{[^}]*inset:\s*1px 4px/s);
	});
});
