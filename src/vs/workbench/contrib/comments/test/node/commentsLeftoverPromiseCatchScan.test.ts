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
const CONTROLLER_REL = 'src/vs/workbench/contrib/comments/browser/commentsController.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

function assertDoubleChain(source: string, call: string, count: number): void {
	assert.strictEqual((source.match(new RegExp(call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, count);
	assert.ok(source.includes(`${call}${doubleCatch};`));
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

suite('Comments leftover Promise fire-and-forget catch scan (D687)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('beginCompute leftover voids are double-chain', () => {
		const source = fs.readFileSync(resolveSource(CONTROLLER_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private beginCompute(): Promise<void> {'));
		assertDoubleChain(source, 'void this.beginCompute()', 3);
	});

	test('revealCommentThread leftover thens are double-chain', () => {
		const source = fs.readFileSync(resolveSource(CONTROLLER_REL), 'utf8');
		const computeThen = `this._computeAndSetPromise.then(_ => {
					this.revealCommentThread(threadId, commentUniqueId, false, focus);
				})`;
		const beginThen = `this.beginCompute().then(_ => {
					this.revealCommentThread(threadId, commentUniqueId, false, focus);
				})`;
		assert.ok(source.includes(`${computeThen}${doubleCatch};`));
		assert.ok(source.includes(`${beginThen}${doubleCatch};`));
		assert.ok(!source.includes(`${computeThen};`));
		assert.ok(!source.includes(`${beginThen};`));
		assert.ok(!source.includes(`${computeThen}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${beginThen}.catch(onUnexpectedError);`));
	});

	test('beginComputeAndHandleEditorChange leftover then is double-chain; sync void callers stay skipped', () => {
		const source = fs.readFileSync(resolveSource(CONTROLLER_REL), 'utf8');
		assert.ok(source.includes(`this.beginCompute().then(() => {
			if (!this._hasRespondedToEditorChange) {`));
		assert.ok(source.includes(`status(nls.localize('hasCommentRanges', "Editor has commenting ranges."));
					}
				}
			}
		})${doubleCatch};`));
		assert.ok(!source.includes(`status(nls.localize('hasCommentRanges', "Editor has commenting ranges."));
					}
				}
			}
		});`));
		assert.ok(source.includes('this._register(this.commentService.onDidSetDataProvider(_ => this.beginComputeAndHandleEditorChange()));'));
		assert.ok(source.includes('this._register(this.commentService.onDidUpdateCommentingRanges(_ => this.beginComputeAndHandleEditorChange()));'));
		assert.ok(!source.includes('void this.beginComputeAndHandleEditorChange()'));
	});

	test('openCommentsView leftover voids are double-chain', () => {
		const source = fs.readFileSync(resolveSource(CONTROLLER_REL), 'utf8');
		assert.ok(source.includes('private async openCommentsView(thread: languages.CommentThread) {'));
		assertDoubleChain(source, 'void this.openCommentsView(thread)', 2);
	});

	test('opener / D145-style leftover stays skipped', () => {
		const source = fs.readFileSync(resolveSource(CONTROLLER_REL), 'utf8');
		const openerStart = source.indexOf('editorService.openEditor({');
		const openerEnd = source.indexOf('export class CommentController', openerStart);
		assert.ok(openerStart >= 0 && openerEnd > openerStart);
		const opener = source.slice(openerStart, openerEnd);
		assert.ok(opener.includes('}, sideBySide ? SIDE_GROUP : ACTIVE_GROUP).then(editor => {'));
		assert.ok(!opener.includes('.catch('));
		assert.ok(source.includes('this._computePromise.then(() => this._computeAndSetPromise = undefined);'));
		assert.ok(!source.includes('this._computePromise.then(() => this._computeAndSetPromise = undefined).catch'));
		assert.ok(source.includes('this.addOrToggleCommentAtLine(range, e);'));
		assert.ok(!source.includes('this.addOrToggleCommentAtLine(range, e).catch'));
		assert.ok(source.includes('\t\t\t\t\tmatchedZone.update(thread);'));
		assert.ok(!source.includes('matchedZone.update(thread).catch'));
	});
});
