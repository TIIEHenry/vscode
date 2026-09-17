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
const SOURCE_REL = 'src/vs/sessions/contrib/agentFeedback/browser/agentFeedbackContextView.ts';

function agentFeedbackContextViewSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/agentFeedbackContextView.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `agentFeedbackContextView.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('AgentFeedbackContextView leftover fire-and-forget catch scan (D641)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onDidOpen revealFeedback void double-catch onUnexpectedError (D641)', () => {
		// revealFeedback returns Promise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(agentFeedbackContextViewSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this._agentFeedbackService.revealFeedback(this._attachment.sessionResource, e.element.id)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\._agentFeedbackService\.revealFeedback\(this\._attachment\.sessionResource, e\.element\.id\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
	});
});
