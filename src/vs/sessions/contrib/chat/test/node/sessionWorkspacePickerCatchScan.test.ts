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
const SOURCE_REL = 'src/vs/sessions/contrib/chat/browser/sessionWorkspacePicker.ts';

function sessionWorkspacePickerSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/sessionWorkspacePicker.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `sessionWorkspacePicker.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

suite('SessionWorkspacePicker leftover fire-and-forget catch scan (D611)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('_dispatchPickerItem item.run / commandId voids single-catch onUnexpectedError (D611)', () => {
		const source = fs.readFileSync(sessionWorkspacePickerSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const run = 'void Promise.resolve(item.run())';
		const command = 'void this.commandService.executeCommand(item.commandId)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('protected async _dispatchPickerItem(item: IWorkspacePickerItem): Promise<boolean>'));
		assert.strictEqual((source.match(/void Promise\.resolve\(item\.run\(\)\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\.commandService\.executeCommand\(item\.commandId\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${run}${singleCatch};`));
		assert.ok(source.includes(`${command}${singleCatch};`));
		assert.ok(!source.includes(`${run};`));
		assert.ok(!source.includes(`${command};`));
		assert.ok(!source.includes(`${run}${doubleCatch};`));
		assert.ok(!source.includes(`${command}${doubleCatch};`));
		assert.strictEqual(countDoubleChains(source), 0);
	});
});

suite('SessionWorkspacePicker leftover fire-and-forget catch scan (D619)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onSelect _dispatchPickerItem / restore findWorkspace single-catch onUnexpectedError (D619)', () => {
		const source = fs.readFileSync(sessionWorkspacePickerSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const onSelect = 'void this._dispatchPickerItem(item)';
		const restore = 'void this._sessionWorkspaceFallback.findWorkspace().then(restored => {';
		const directBrowse = 'void this._dispatchPickerItem(directBrowseItem)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\._dispatchPickerItem\(item\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${onSelect}${singleCatch};`));
		assert.ok(!source.includes(`${onSelect};`));
		assert.ok(!source.includes(`${onSelect}${doubleCatch};`));
		assert.strictEqual((source.match(/this\._sessionWorkspaceFallback\.findWorkspace\(\)/g) ?? []).length, 1);
		assert.ok(source.includes(restore));
		assert.ok(source.includes(`}).catch(onUnexpectedError);`));
		assert.ok(!source.includes(`}).catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.strictEqual((source.match(/void this\._dispatchPickerItem\(directBrowseItem\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${directBrowse}.catch(onUnexpectedError).finally(() => {`));
		assert.ok(!source.includes(`${directBrowse}${doubleCatch}`));
		assert.strictEqual(countDoubleChains(source), 0);
	});
});

suite('SessionWorkspacePicker leftover fire-and-forget catch scan (D624)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('directBrowse _dispatchPickerItem single-catch onUnexpectedError then finally (D624)', () => {
		const source = fs.readFileSync(sessionWorkspacePickerSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const directBrowse = 'void this._dispatchPickerItem(directBrowseItem)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('protected async _dispatchPickerItem(item: IWorkspacePickerItem): Promise<boolean>'));
		assert.strictEqual((source.match(/void this\._dispatchPickerItem\(directBrowseItem\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${directBrowse}.catch(onUnexpectedError).finally(() => {`));
		assert.ok(!source.includes(`${directBrowse}${doubleCatch}`));
		assert.strictEqual(countDoubleChains(source), 0);
	});
});
