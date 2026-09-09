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

suite('ConversationLens reveal navigation (T5a) - 源码接线扫描', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('maximize CSS hides the Conversation tree, not the shared slot on Trajectory', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8');
		assert.ok(css.includes('.conversation-lens-input-maximized:not(:has(.conversation-lens-phase-prefirst)) .conversation-lens-timeline'));
		assert.ok(css.includes('.conversation-lens-input-maximized:not(:has(.conversation-lens-phase-prefirst)):not(.conversation-lens-showing-trajectory)'));
		assert.ok(!/\.conversation-timeline\.conversation-lens-input-maximized:not\(:has\(\.conversation-lens-phase-prefirst\)\)\s*\{\s*display:\s*none;/.test(css));
	});
});
