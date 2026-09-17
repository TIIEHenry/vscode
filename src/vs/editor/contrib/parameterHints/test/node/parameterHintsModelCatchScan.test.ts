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
const SOURCE_REL = 'src/vs/editor/contrib/parameterHints/browser/parameterHintsModel.ts';

function parameterHintsModelSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/parameterHintsModel.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `parameterHintsModel.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('ParameterHintsModel leftover fire-and-forget catch scan (D670)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('throttledDelayer.trigger leftover site is one and double-chain; single-chain gone (D670)', () => {
		// doTrigger returns Promise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(parameterHintsModelSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const triggerSite = `this.throttledDelayer.trigger(() => {
			return this.doTrigger(triggerId);
		}, delay)
			`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/this\.throttledDelayer\.trigger\(\(\) => \{/g) ?? []).length, 1);
		assert.strictEqual((source.match(/\.catch\(/g) ?? []).length, 2);
		assert.ok(source.includes(`${triggerSite}${doubleCatch};`));
		assert.ok(!source.includes(`${triggerSite};`));
		assert.ok(!source.includes(`${triggerSite}.catch(onUnexpectedError);`));
	});
});
