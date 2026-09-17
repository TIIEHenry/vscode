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
const PLAN_REVIEW_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatPlanReviewPart.ts';

function chatPlanReviewPartSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), PLAN_REVIEW_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/widget/chatContentParts/chatPlanReviewPart.ts'),
		path.join(thisDir, '../../../../../../../', PLAN_REVIEW_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `chatPlanReviewPart.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('ChatPlanReviewPart leftover fire-and-forget catch scan (D585)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('markUsed / enterFeedbackMode / submitFeedback voids double-caught; bare/single-chain gone in this file only', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(chatPlanReviewPartSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const markUsed = 'void this.markUsed()';
		const enterFeedback = 'void this.enterFeedbackMode({ focus: false })';
		const submitFeedback = 'void this.submitFeedback()';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(source.includes('async markUsed('));
		assert.ok(source.includes('async enterFeedbackMode('));
		assert.ok(source.includes('async submitFeedback('));
		assert.strictEqual((source.match(/void this\.markUsed\(\)/g) ?? []).length, 3);
		assert.strictEqual((source.match(/void this\.enterFeedbackMode\(\{ focus: false \}\)/g) ?? []).length, 2);
		assert.strictEqual((source.match(/void this\.submitFeedback\(\)/g) ?? []).length, 2);
		assert.ok(source.includes(`${markUsed}${doubleCatch};`));
		assert.ok(source.includes(`${enterFeedback}${doubleCatch};`));
		assert.ok(source.includes(`${submitFeedback}${doubleCatch};`));
		assert.ok(source.includes(`() => ${submitFeedback}${doubleCatch}`));
		assert.ok(!source.includes(`${markUsed};`));
		assert.ok(!source.includes(`${enterFeedback};`));
		assert.ok(!source.includes(`${submitFeedback};`));
		assert.ok(!source.includes(`${markUsed}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${enterFeedback}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${submitFeedback}.catch(onUnexpectedError);`));
		assert.ok(source.includes('await this.markUsed();'));
		assert.ok(!source.includes('await this.markUsed().catch'));
		assert.ok(source.includes('await this.enterFeedbackMode({ focus: true });'));
		assert.ok(!source.includes('await this.enterFeedbackMode({ focus: true }).catch'));
		assert.ok(source.includes('() => void this.enterReviewMode()'));
		assert.ok(!source.includes('void this.enterReviewMode().catch'));
		assert.ok(source.includes('submitFeedback: () => this.submitFeedback(),'));
	});
});
