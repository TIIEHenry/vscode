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
const SOURCE_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/agentGlobalConfigurationSettingsWidget.ts';

function agentGlobalConfigurationSettingsWidgetSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/aiCustomization/agentGlobalConfigurationSettingsWidget.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `agentGlobalConfigurationSettingsWidget.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('AHPAgentSettingsWidget leftover fire-and-forget catch scan', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('save and openEditor leftover sites double-catch onUnexpectedError', () => {
		// save / openEditor return Promise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows (D480).
		const source = fs.readFileSync(agentGlobalConfigurationSettingsWidgetSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const saveTrim = 'void this.save(key, input.value.trim())';
		const saveEnum = 'void this.save(key, schema.enum?.[event.index])';
		const openEditor = 'void this.editorService.openEditor({ resource: this.target?.mapResource(URI.parse(file.resource)) ?? URI.parse(file.resource), options: { pinned: true } })';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\.save\(/g) ?? []).length, 2);
		assert.ok(source.includes(`${saveTrim}${doubleCatch}`));
		assert.ok(source.includes(`${saveEnum}${doubleCatch}`));
		assert.ok(source.includes(`${openEditor}${doubleCatch}`));
		assert.ok(!source.includes(`${saveTrim};`));
		assert.ok(!source.includes(`${saveEnum};`));
		assert.ok(!source.includes(`${saveTrim}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${saveEnum}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${openEditor};`));
		assert.ok(!source.includes(`${openEditor}.catch(onUnexpectedError);`));
	});
});
