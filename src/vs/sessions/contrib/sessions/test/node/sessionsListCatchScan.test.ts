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
const LIST_REL = 'src/vs/sessions/contrib/sessions/browser/views/sessionsList.ts';

function sessionsListSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), LIST_REL),
		path.join(thisDir, '../../browser/views/sessionsList.ts'),
		path.join(thisDir, '../../../../../../../', LIST_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `sessionsList.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('SessionsList leftover fire-and-forget catch scan (D637)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('rename / openChat / getTreatment double-catch onUnexpectedError (D637)', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(sessionsListSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const rename = 'this.commandService.executeCommand(RENAME_SESSION_COMMAND_ID, session)';
		const openChat = 'this._sessionsService.openChat(element.session, element.chat.resource, { preserveFocus })';
		const getTreatment = 'this.assignmentService.getTreatment<number>(SessionsList.SESSION_GROUP_LIMIT_TREATMENT).then(value => {';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('private updateSessionGroupLimit(): void {'));
		assert.strictEqual((source.split(rename).length - 1), 1, `${rename} should appear once`);
		assert.strictEqual((source.split(openChat).length - 1), 1, `${openChat} should appear once`);
		assert.strictEqual((source.split(getTreatment).length - 1), 1, `${getTreatment} should appear once`);
		assert.ok(source.includes(`${rename}${doubleCatch};`), `${rename} missing double-catch`);
		assert.ok(source.includes(`${openChat}${doubleCatch};`), `${openChat} missing double-catch`);
		assert.ok(source.includes(getTreatment));
		assert.ok(source.includes(`}).catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${rename};`), `${rename} leftover bare`);
		assert.ok(!source.includes(`${openChat};`), `${openChat} leftover bare`);
		assert.ok(!source.includes(`${rename}.catch(onUnexpectedError);`), `${rename} leftover single-chain`);
		assert.ok(!source.includes(`${openChat}.catch(onUnexpectedError);`), `${openChat} leftover single-chain`);
		assert.ok(!source.includes(`}).catch(onUnexpectedError);`), 'getTreatment leftover single-chain');
	});
});
