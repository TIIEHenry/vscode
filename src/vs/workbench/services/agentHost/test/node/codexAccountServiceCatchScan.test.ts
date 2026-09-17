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
const SOURCE_REL = 'src/vs/workbench/services/agentHost/browser/codexAccountService.ts';

function codexAccountServiceSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/codexAccountService.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `codexAccountService.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('CodexAccountService leftover fire-and-forget catch scan (D667)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('profile image then() leftover site is then + double-chain (D667)', () => {
		// readCodexProfileImageDataUri returns Promise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(codexAccountServiceSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const thenSite = `void readCodexProfileImageDataUri(this._agentHostService, reference).then(profileImageDataUri => {
			if (request !== this._profileImageRequest || profileImageKey !== this._profileImageKey) {
				return;
			}
			if (!profileImageDataUri) {
				this._profileImageKey = undefined;
				return;
			}
			this._account = { ...this._rootAccount, profileImageDataUri };
			this._onDidChangeAccount.fire(this._account);
		})`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/readCodexProfileImageDataUri\(this\._agentHostService, reference\)\.then\(/g) ?? []).length, 1);
		assert.ok(source.includes(`${thenSite}${doubleCatch};`));
		assert.ok(!source.includes(`${thenSite};`));
		assert.ok(!source.includes(`${thenSite}.catch(onUnexpectedError);`));
	});

	test('openCodexAuthUrl leftover site remains D145-style single-chain', () => {
		const source = fs.readFileSync(codexAccountServiceSourcePath(), 'utf8');
		const call = 'void openCodexAuthUrl(this._openerService, account.authUrl)';
		assert.strictEqual((source.match(/void openCodexAuthUrl\(this\._openerService, account\.authUrl\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError).catch(onUnexpectedError);`));
	});
});
