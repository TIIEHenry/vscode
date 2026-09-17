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
const SERVICE_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostUntitledProvisionalSessionService.ts';

function untitledProvisionalSessionServiceSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SERVICE_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/agentSessions/agentHost/agentHostUntitledProvisionalSessionService.ts'),
		path.join(thisDir, '../../../../../../../', SERVICE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `agentHostUntitledProvisionalSessionService.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('AgentHostUntitledProvisionalSessionService leftover fire-and-forget catch scan (D646)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('four leftover voids double-catch onUnexpectedError; disposeSession stays double (D646)', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(untitledProvisionalSessionServiceSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const changeFolder = 'void this._changeWorkingDirectory(sessionResource, folder)';
		const changePrimary = 'void this._changeWorkingDirectory(sessionResource, this._newSessionFolderService.resolveNewSessionPrimary(sessionResource))';
		const reconcile = 'void this._queue(sessionResource, () => this._reconcileGeneration(sessionResource, entry))';
		const disposePending = 'void this._disposeBackend(backendSession, \'pending provisional cleanup\')';
		const disposeSession = 'void this.disposeSession(sessionResource)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\._changeWorkingDirectory\(sessionResource, folder\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\._changeWorkingDirectory\(sessionResource, this\._newSessionFolderService\.resolveNewSessionPrimary\(sessionResource\)\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\._queue\(sessionResource, \(\) => this\._reconcileGeneration\(sessionResource, entry\)\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\._disposeBackend\(backendSession, 'pending provisional cleanup'\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\.disposeSession\(sessionResource\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${changeFolder}${doubleCatch};`));
		assert.ok(source.includes(`${changePrimary}${doubleCatch};`));
		assert.ok(source.includes(`${reconcile}${doubleCatch};`));
		assert.ok(source.includes(`${disposePending}${doubleCatch};`));
		assert.ok(source.includes(`${disposeSession}${doubleCatch};`));
		assert.ok(!source.includes(`${changeFolder};`));
		assert.ok(!source.includes(`${changePrimary};`));
		assert.ok(!source.includes(`${reconcile};`));
		assert.ok(!source.includes(`${disposePending};`));
		assert.ok(!source.includes(`${disposeSession};`));
		assert.ok(!source.includes(`${changeFolder}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${changePrimary}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${reconcile}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${disposePending}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${disposeSession}.catch(onUnexpectedError);`));
	});
});
