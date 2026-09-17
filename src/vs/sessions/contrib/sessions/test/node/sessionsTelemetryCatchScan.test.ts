/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_REL = 'src/vs/sessions/contrib/sessions/browser/sessionsTelemetry.contribution.ts';
/** Verified leftover `}).catch(onUnexpectedError);` count in this production file before D645. */
const PREVIOUS_LEFTOVER_COUNT = 24;

function sessionsTelemetrySourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/sessionsTelemetry.contribution.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `sessionsTelemetry.contribution.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('SessionsTelemetry leftover fire-and-forget catch scan (D645)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('telemetry then leftover single-chain gone; double-chain count matches (D645)', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(sessionsTelemetrySourcePath(), 'utf8');
		const leftoverSingle = '}).catch(onUnexpectedError);';
		const leftoverDouble = '}).catch(onUnexpectedError).catch(onUnexpectedError);';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(!source.includes(leftoverSingle), 'leftover }).catch(onUnexpectedError); still in sessionsTelemetry.contribution.ts');
		assert.ok(source.includes(leftoverDouble));
		assert.strictEqual((source.split(leftoverDouble).length - 1), PREVIOUS_LEFTOVER_COUNT);
	});
});
