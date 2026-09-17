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
const NOTIFY_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostSignedOutModelsNotification.ts';

function agentHostSignedOutModelsNotificationSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), NOTIFY_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/agentSessions/agentHost/agentHostSignedOutModelsNotification.ts'),
		path.join(thisDir, '../../../../../../../', NOTIFY_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `agentHostSignedOutModelsNotification.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('AgentHostSignedOutModelsNotification leftover fire-and-forget catch scan (D647)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('signed-out notify then() sites are then + double-chain; bare then / single-chain gone in this file only', () => {
		// Single-chain `.then(...).catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(agentHostSignedOutModelsNotificationSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const sites = [
			`this._defaultAccountService.getDefaultAccount().then(() => {
			if (!this._store.isDisposed) {
				this._accountResolved = true;
				this._update();
			}
		})`,
			`extensionService.whenInstalledExtensionsRegistered().then(() => {
			if (!this._store.isDisposed) {
				this._extensionsRegistered = true;
				this._update();
			}
		})`,
			`this._languageModelsConfigurationService.whenReady.then(() => {
			if (!this._store.isDisposed) {
				this._configurationLoaded = true;
				this._update();
			}
		})`,
		] as const;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/getDefaultAccount\(\)\.then\(/g) ?? []).length, 1);
		assert.strictEqual((source.match(/whenInstalledExtensionsRegistered\(\)\.then\(/g) ?? []).length, 1);
		assert.strictEqual((source.match(/whenReady\.then\(/g) ?? []).length, 1);
		assert.strictEqual((source.match(/\}\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 3);
		for (const site of sites) {
			assert.strictEqual((source.split(site).length - 1), 1, `${site} should appear once`);
			assert.ok(source.includes(`${site}${doubleCatch};`), `${site} missing then + double-catch`);
			assert.ok(!source.includes(`${site};`), `${site} leftover bare then`);
			assert.ok(!source.includes(`${site}.catch(onUnexpectedError);`), `${site} leftover single-chain`);
		}
	});
});
