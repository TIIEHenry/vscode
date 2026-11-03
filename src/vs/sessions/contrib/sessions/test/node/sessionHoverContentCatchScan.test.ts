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
const SOURCE_REL = 'src/vs/sessions/contrib/sessions/browser/sessionHoverContent.ts';

function sessionHoverContentSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/sessionHoverContent.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `sessionHoverContent.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

suite('SessionHoverContent leftover fire-and-forget catch scan (D648)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('externalSession onOpen openSettings single-catch onUnexpectedError (D648)', () => {
		const source = fs.readFileSync(sessionHoverContentSourcePath(), 'utf8');
		const call = 'preferencesService.openSettings({';
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/preferencesService\.openSettings\(/g) ?? []).length, 1);
		assert.ok(source.includes(call));
		assert.ok(source.includes(`})${singleCatch};`));
		assert.ok(!source.includes(`${call});`));
		assert.ok(!source.includes(`})${doubleCatch};`));
		assert.strictEqual(countDoubleChains(source), 0);
	});
});
