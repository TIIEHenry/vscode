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
const EDITOR_REL = 'src/vs/sessions/contrib/changes/browser/sessionChangesEditor.ts';

function sessionChangesEditorSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), EDITOR_REL),
		path.join(thisDir, '../../browser/sessionChangesEditor.ts'),
		path.join(thisDir, '../../../../../../../', EDITOR_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `sessionChangesEditor.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

suite('SessionChangesEditor leftover fire-and-forget catch scan (D597)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('handleHeaderMiddleClick executeCommand CHANGESET_REVIEW_ACTION_ID void single-catch onUnexpectedError (D597)', () => {
		const source = fs.readFileSync(sessionChangesEditorSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this.commandService.executeCommand(CHANGESET_REVIEW_ACTION_ID, resource)';
		const singleCall = `${call}${singleCatch};`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('handleHeaderMiddleClick(resource: URI): boolean'));
		assert.ok(source.includes('\t\treturn true;'));
		assert.strictEqual((source.match(/void this\.commandService\.executeCommand\(CHANGESET_REVIEW_ACTION_ID, resource\)/g) ?? []).length, 1);
		assert.ok(source.includes(singleCall));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}${doubleCatch};`));
		assert.strictEqual(countDoubleChains(source), 0);
	});
});
