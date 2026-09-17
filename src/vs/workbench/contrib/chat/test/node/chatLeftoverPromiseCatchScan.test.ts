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
const FIND_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatFind/chatFindWidget.ts';
const PICKER_REL = 'src/vs/workbench/contrib/chat/browser/widget/input/modelPicker/modelPickerWidget.ts';
const PASTE_REL = 'src/vs/workbench/contrib/chat/browser/widget/input/editor/chatPasteProviders.ts';
const NOTIFY_REL = 'src/vs/workbench/contrib/chat/browser/widget/input/chatInputNotificationWidget.ts';
const FEEDBACK_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatContentParts/toolInvocationParts/chatAgentFeedbackReviewConfirmationSubPart.ts';

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

suite('Chat leftover Promise fire-and-forget catch scan (D679)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('chatFindWidget updateResultCount leftover voids are double-chain', () => {
		const source = fs.readFileSync(resolveSource(FIND_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assertDoubleChain(source, 'void this.updateResultCount()', 3);
	});

	test('modelPicker _requestWorkspaceTrust leftover is double-chain; opener leftover stays skipped', () => {
		const source = fs.readFileSync(resolveSource(PICKER_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _requestWorkspaceTrust(): Promise<void> {'));
		assertDoubleChain(source, 'void this._requestWorkspaceTrust()', 1);
		assert.ok(source.includes('void this._openerService.open(uri, { allowCommands: true });'));
		assert.ok(!source.includes('void this._openerService.open(uri, { allowCommands: true }).catch'));
	});

	test('chatPasteProviders primeSymbolReferenceCache leftover is double-chain', () => {
		const source = fs.readFileSync(resolveSource(PASTE_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async primeSymbolReferenceCache('));
		assertDoubleChain(source, 'void this.primeSymbolReferenceCache(model, ranges[0], text, token)', 1);
	});

	test('chatInputNotificationWidget _executeAction leftover is double-chain', () => {
		const source = fs.readFileSync(resolveSource(NOTIFY_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _executeAction(notification: IChatInputNotification, action: IChatInputNotificationAction): Promise<void> {'));
		assertDoubleChain(source, 'void this._executeAction(notification, action)', 1);
	});

	test('chatAgentFeedbackReviewConfirmationSubPart _populate leftover is double-chain', () => {
		const source = fs.readFileSync(resolveSource(FEEDBACK_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _populate(listElement: HTMLElement): Promise<void> {'));
		assertDoubleChain(source, 'void this._populate(listElement)', 1);
	});
});
