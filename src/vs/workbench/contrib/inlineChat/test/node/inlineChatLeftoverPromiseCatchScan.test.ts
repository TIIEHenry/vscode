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
const AGENTS_REL = 'src/vs/workbench/contrib/conversation/browser/engineAgentsSection.ts';
const ERRORS_REL = 'src/vs/base/common/errors.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

suite('InlineChat leftover Promise fire-and-forget catch scan (D701)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('engineAgentsSection leftover executeCommand singles are double-chain', () => {
		const source = fs.readFileSync(resolveSource(AGENTS_REL), 'utf8');
		const call = 'void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\.commandService\.executeCommand\(OPEN_CONNECTION_PREFERENCES_COMMAND_ID\)/g) ?? []).length, 3);
		assert.ok(source.includes(`${call}${doubleCatch}`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError),`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError)\n`));
		assert.ok(!source.includes(`${call};`));
	});
});
