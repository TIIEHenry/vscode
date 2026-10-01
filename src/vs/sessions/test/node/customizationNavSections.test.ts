/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';

const FIVE_SECTIONS = ['Agents', 'Skills', 'Instructions', 'Hooks', 'McpServers'];
const DROPPED_SECTIONS = ['Plugins', 'Tools', 'Automations', 'HarnessSettings'];

function readRepoFile(rel: string): string {
	const full = path.join(process.cwd(), rel);
	assert.ok(fs.existsSync(full), `${rel} not found from cwd ${process.cwd()}`);
	return fs.readFileSync(full, 'utf8');
}

function sectionNames(source: string, prefix: string): string[] {
	return [...source.matchAll(new RegExp(`${prefix}AICustomizationManagementSection\\.(\\w+)`, 'g'))].map(found => found[1]);
}

suite('sessions customization nav sections', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('sidebar customization items match the five sessions sections', () => {
		const source = readRepoFile('src/vs/sessions/contrib/sessions/browser/customizationsToolbar.contribution.ts');
		const block = source.match(/export const CUSTOMIZATION_ITEMS: ICustomizationItemConfig\[\] = \[([\s\S]*?)\];/);
		assert.ok(block, 'CUSTOMIZATION_ITEMS array not found');
		assert.deepStrictEqual(sectionNames(block[1], 'section: '), FIVE_SECTIONS);
		for (const name of DROPPED_SECTIONS) {
			assert.ok(!block[1].includes(`AICustomizationManagementSection.${name}`), name);
		}
	});

	test('overview sections match the five sessions sections', () => {
		const source = readRepoFile('src/vs/sessions/contrib/aiCustomizationTreeView/browser/aiCustomizationOverviewView.ts');
		assert.deepStrictEqual(sectionNames(source, 'id: '), FIVE_SECTIONS);
		for (const name of DROPPED_SECTIONS) {
			assert.ok(!source.includes(`AICustomizationManagementSection.${name}`), name);
		}
	});
});
