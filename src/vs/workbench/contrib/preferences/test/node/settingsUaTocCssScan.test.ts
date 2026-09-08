/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

suite('Settings UA TOC - 源码接线扫描', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('D20 chrome CSS keeps search and Client group titles at narrow width', () => {
		const cssPath = fileURLToPath(new URL('../../../conversation/browser/media/uaClientSettingsChrome.css', import.meta.url));
		const css = fs.readFileSync(cssPath, 'utf8');
		assert.ok(css.includes('.settings-editor.narrow-width > .settings-header > .search-container'));
		assert.ok(css.includes('.settings-group-title-label'));
		assert.ok(css.includes('.setting-item-contents .setting-item-control'));
		assert.ok(css.includes('setting-item-enum'));
		assert.ok(!/display\s*:\s*none/.test(css));
	});
});
