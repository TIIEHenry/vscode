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
const SOURCE_REL = 'src/vs/sessions/contrib/chat/browser/sessionTurnChanges.ts';

function sessionTurnChangesSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/sessionTurnChanges.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `sessionTurnChanges.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('SessionTurnChanges leftover fire-and-forget catch scan (D625)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('_openSessionTurnChanges four voids double-catch onUnexpectedError (D625)', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(sessionTurnChangesSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const lastTurn = 'void this._openSessionTurnChanges(owner.session)';
		const historical = 'void this._openSessionTurnChanges(owner.session, {';
		const transient = 'void this._openSessionTurnChanges(session, {';
		const standalone = 'void this._editorService.openEditor({';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _openSessionTurnChanges(session: ISession, transientTurn?: ISessionTransientTurnChanges): Promise<void>'));
		assert.strictEqual((source.match(/void this\._openSessionTurnChanges\(owner\.session\)/g) ?? []).length, 2);
		assert.ok(source.includes(`${lastTurn}${doubleCatch};`));
		assert.ok(!source.includes(`${lastTurn};`));
		assert.ok(!source.includes(`${lastTurn}.catch(onUnexpectedError);`));
		assert.strictEqual((source.match(/void this\._openSessionTurnChanges\(owner\.session, \{/g) ?? []).length, 1);
		assert.ok(source.includes(historical));
		assert.ok(source.includes('id: `${TURN_CHANGES_CHANGESET_ID}:${requestId}`'));
		assert.strictEqual((source.match(/void this\._openSessionTurnChanges\(session, \{/g) ?? []).length, 1);
		assert.ok(source.includes(transient));
		assert.ok(source.includes('id: `${TURN_CHANGES_CHANGESET_ID}:${id}`'));
		assert.strictEqual((source.match(/\}\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 3);
		assert.ok(!source.includes('}).catch(onUnexpectedError);'));
		assert.ok(source.includes(standalone));
		assert.ok(source.includes('label: localize(\'chatTurnPills.changes.title\', "Turn File Changes")'));
		assert.ok(source.includes(`${standalone}`));
		assert.ok(source.includes('\t\t} catch (error) {\n\t\t\tonUnexpectedError(error);\n\t\t}'));
	});
});
