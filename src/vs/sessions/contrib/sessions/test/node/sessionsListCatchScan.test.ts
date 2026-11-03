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

function countDoubleChains(text: string): number {
	const matches = text.match(/\.catch\([a-zA-Z0-9_$.]+\)\s*\.catch\([a-zA-Z0-9_$.]+\)/g);
	return matches ? matches.length : 0;
}

suite('SessionsList leftover fire-and-forget catch scan (D637)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('rename / openChat / getTreatment single-catch onUnexpectedError (D637)', () => {
		const source = fs.readFileSync(sessionsListSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const rename = 'this.commandService.executeCommand(RENAME_SESSION_COMMAND_ID, session)';
		const openChat = 'this._sessionsService.openChat(element.session, element.chat.resource, { preserveFocus })';
		const getTreatment = 'this.assignmentService.getTreatment<number>(SessionsList.SESSION_GROUP_LIMIT_TREATMENT).then(value => {';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('private updateSessionGroupLimit(): void {'));
		assert.strictEqual(countDoubleChains(source), 0);
		assert.strictEqual((source.split(rename).length - 1), 1, `${rename} should appear once`);
		assert.strictEqual((source.split(openChat).length - 1), 1, `${openChat} should appear once`);
		assert.strictEqual((source.split(getTreatment).length - 1), 1, `${getTreatment} should appear once`);
		assert.ok(source.includes(`${rename}${singleCatch};`), `${rename} missing single-catch`);
		assert.ok(source.includes(`${openChat}${singleCatch};`), `${openChat} missing single-catch`);
		assert.ok(source.includes(getTreatment));
		assert.ok(source.includes(`}).catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${rename};`), `${rename} leftover bare`);
		assert.ok(!source.includes(`${openChat};`), `${openChat} leftover bare`);
	});
});
