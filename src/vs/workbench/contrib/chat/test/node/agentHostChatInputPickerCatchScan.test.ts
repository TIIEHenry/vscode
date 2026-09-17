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
const SOURCE_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostChatInputPicker.ts';

function agentHostChatInputPickerSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/agentSessions/agentHost/agentHostChatInputPicker.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `agentHostChatInputPicker.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('AgentHostChatInputPicker leftover fire-and-forget catch scan', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Promise leftover voids are double-chain; opener leftover stays skipped', () => {
		// These methods return Promise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows (D480).
		const source = fs.readFileSync(agentHostChatInputPickerSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const showAnchor = 'void this._showPicker(anchor)';
		const showTrigger = 'void this._showPicker(trigger)';
		const refreshResolved = 'void this._refreshInitialResolved(sessionResource, backendSession)';
		const confirmSet = 'void this._confirmAndSetValue(ctx.backendSession, item)';
		const updateValue = 'void this._configurationService.updateValue(settingId, target)';
		const getOrCreate = 'void this._provisional.getOrCreate(';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _showPicker(trigger: HTMLElement): Promise<void> {'));
		assert.ok(source.includes('private async _refreshInitialResolved(sessionResource: URI, backendSession: URI): Promise<void> {'));
		assert.ok(source.includes('getOrCreate('));
		assert.ok(source.includes('private async _confirmAndSetValue(backendSession: URI, item: IConfigPickerItem): Promise<void> {'));
		assert.strictEqual((source.match(/void this\._showPicker\(anchor\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\._showPicker\(trigger\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${showAnchor}${doubleCatch};`));
		assert.ok(source.includes(`${showTrigger}${doubleCatch}`));
		assert.ok(source.includes(`${refreshResolved}${doubleCatch};`));
		assert.ok(source.includes(`${confirmSet}${doubleCatch};`));
		assert.ok(source.includes(`${updateValue}${doubleCatch};`));
		assert.ok(source.includes(getOrCreate));
		assert.ok(source.includes(`this._readWorkingDirectory(),\n\t\t\t)${doubleCatch};`));
		assert.ok(!source.includes(`${showAnchor};`));
		assert.ok(!source.includes(`${showTrigger};`));
		assert.ok(!source.includes(`${refreshResolved};`));
		assert.ok(!source.includes(`${confirmSet};`));
		assert.ok(!source.includes(`${updateValue};`));
		assert.ok(!source.includes(`${showAnchor}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${showTrigger}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${refreshResolved}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${confirmSet}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${updateValue}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`this._readWorkingDirectory(),\n\t\t\t);`));
		assert.ok(!/^\t+this\._showPicker\(trigger\);/m.test(source));
		assert.ok(source.includes('void this._openerService.open(URI.parse(permissionsLearnMoreUrl));'));
	});
});
