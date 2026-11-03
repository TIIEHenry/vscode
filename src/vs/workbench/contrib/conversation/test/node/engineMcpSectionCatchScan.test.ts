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
const SOURCE_REL = 'src/vs/workbench/contrib/conversation/browser/engineMcpSection.ts';

function sourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `engineMcpSection.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const singleCatch = '.catch(onUnexpectedError)';
const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

suite('Engine MCP fire-and-forget catch scan', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('async MCP actions catch dialog and transport failures', () => {
		const source = fs.readFileSync(sourcePath(), 'utf8');
		assert.ok(/import \{[^}]*\bonUnexpectedError\b[^}]*\} from '\.\.\/\.\.\/\.\.\/\.\.\/base\/common\/errors\.js';/.test(source));
		assert.strictEqual(source.includes(doubleCatch), false, 'source must not contain double catch');
		for (const method of [
			'promptAddServer',
			'promptUpdateSelectedServer',
			'confirmAndRemoveSelectedServer',
			'refresh',
			'toggleServer',
		]) {
			const matches = source.match(new RegExp(`void this\\.${method}\\([^\\n;]*`, 'g')) ?? [];
			assert.ok(matches.length > 0, `${method} should have at least one fire-and-forget call`);
			for (const match of matches) {
				assert.ok(match.includes(singleCatch), `${method} fire-and-forget call must use a single catch: ${match}`);
			}
		}

		const commandMatches = source.match(/void this\.commandService\.executeCommand\([^\n;]*/g) ?? [];
		assert.ok(commandMatches.length > 0, 'commandService.executeCommand should have at least one fire-and-forget call');
		for (const match of commandMatches) {
			assert.ok(match.includes(singleCatch), `commandService.executeCommand fire-and-forget call must use a single catch: ${match}`);
		}
	});

	test('all fire-and-forget void calls use single catch and no double catch', () => {
		const source = fs.readFileSync(sourcePath(), 'utf8');
		assert.strictEqual(source.includes(doubleCatch), false);
		const voidMatches = source.match(/void this\.[^\n;]+/g) ?? [];
		assert.strictEqual(voidMatches.length, 12, 'should have exactly 12 void this.* calls');
		for (const match of voidMatches) {
			assert.ok(match.includes(singleCatch), `fire-and-forget call must use single catch: ${match}`);
		}
	});
});
