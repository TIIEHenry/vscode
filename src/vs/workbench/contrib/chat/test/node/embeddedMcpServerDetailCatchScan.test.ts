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
const DETAIL_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/embeddedMcpServerDetail.ts';

function embeddedMcpServerDetailSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), DETAIL_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/aiCustomization/embeddedMcpServerDetail.ts'),
		path.join(thisDir, '../../../../../../../', DETAIL_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `embeddedMcpServerDetail.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('EmbeddedMcpServerDetail leftover fire-and-forget catch scan (D569)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('loadSourceDefinition void double-catch onUnexpectedError', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(embeddedMcpServerDetailSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this.loadSourceDefinition(server, server.source, renderGeneration)';
		const doubleCall = `${call}${doubleCatch};`;
		assert.ok(source.includes("from '../../../../../base/common/errors.js'"));
		assert.ok(source.includes('onUnexpectedError'));
		assert.strictEqual((source.match(/void this\.loadSourceDefinition\(server, server\.source, renderGeneration\)/g) ?? []).length, 1);
		assert.ok(source.includes(doubleCall));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
	});
});
