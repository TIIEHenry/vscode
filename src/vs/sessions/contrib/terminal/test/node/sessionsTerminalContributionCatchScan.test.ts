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
const SOURCE_REL = 'src/vs/sessions/contrib/terminal/browser/sessionsTerminalContribution.ts';

function sessionsTerminalContributionSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/sessionsTerminalContribution.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `sessionsTerminalContribution.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('SessionsTerminalContribution leftover fire-and-forget catch scan (D644)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('_closeTerminalsForSession double-catch then finally; _closeArchivedSessionTerminals double-catch (D644)', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(sessionsTerminalContributionSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const closeRemoved = 'void this._closeTerminalsForSession(session.sessionId, `session removed (${session.sessionId})`)';
		const closeArchived = 'void this._closeArchivedSessionTerminals(session)';
		const finallyBody = '.finally(() => this._sessionTerminals.delete(session.sessionId));';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _closeTerminalsForSession(sessionId: string, reason: string): Promise<void> {'));
		assert.ok(source.includes('private async _closeArchivedSessionTerminals(session: ISession): Promise<void> {'));
		assert.strictEqual((source.split(closeRemoved).length - 1), 1, `${closeRemoved} should appear once`);
		assert.strictEqual((source.split(closeArchived).length - 1), 1, `${closeArchived} should appear once`);
		assert.ok(source.includes(`${closeRemoved}${doubleCatch}${finallyBody}`), `${closeRemoved} missing double-catch+finally`);
		assert.ok(source.includes(`${closeArchived}${doubleCatch};`), `${closeArchived} missing double-catch`);
		assert.ok(!source.includes(`${closeRemoved};`), `${closeRemoved} leftover bare`);
		assert.ok(!source.includes(`${closeArchived};`), `${closeArchived} leftover bare`);
		assert.ok(!source.includes(`${closeRemoved}.catch(onUnexpectedError)${finallyBody}`), `${closeRemoved} leftover single-chain+finally`);
		assert.ok(!source.includes(`${closeArchived}.catch(onUnexpectedError);`), `${closeArchived} leftover single-chain`);
	});
});
