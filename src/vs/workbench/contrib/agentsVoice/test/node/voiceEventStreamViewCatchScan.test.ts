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
const VOICE_EVENT_STREAM_VIEW_PATH = path.join(repoRoot, 'src/vs/workbench/contrib/agentsVoice/browser/transcriptsView/voiceEventStreamView.ts');

suite('VoiceEventStreamView fire-and-forget refresh catch scan', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('voiceEventStreamView fire-and-forget refresh voids double-catch onUnexpectedError', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(VOICE_EVENT_STREAM_VIEW_PATH, 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleRefresh = `void this.refresh()${doubleCatch};`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\.refresh\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 2);
		assert.ok(source.includes(doubleRefresh));
		assert.ok(!source.includes('void this.refresh();'));
		assert.ok(!source.includes('void this.refresh().catch(onUnexpectedError);'));
	});
});
