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
const PET_ACHIEVEMENTS_REL = 'src/vs/workbench/contrib/chat/browser/chatPetAchievements.contribution.ts';

function chatPetAchievementsContributionSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), PET_ACHIEVEMENTS_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/chatPetAchievements.contribution.ts'),
		path.join(thisDir, '../../../../../../../', PET_ACHIEVEMENTS_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `chatPetAchievements.contribution.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('ChatPetAchievements leftover fire-and-forget catch scan (D577)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('observation voids are double-caught; bare/single-chain gone in this file only', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(chatPetAchievementsContributionSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const customInit = 'void this.initializeCustomizationObservation()';
		const mcpInit = 'void this.initializeMcpObservation()';
		const baseline = 'void this.establishCustomizationBaseline(skills, instructions, source, true)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('async initializeCustomizationObservation('));
		assert.ok(source.includes('async initializeMcpObservation('));
		assert.ok(source.includes('async establishCustomizationBaseline('));
		assert.strictEqual((source.match(/void this\.initializeCustomizationObservation\(\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\.initializeMcpObservation\(\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\.establishCustomizationBaseline\(skills, instructions, source, true\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${customInit}${doubleCatch};`));
		assert.ok(source.includes(`${mcpInit}${doubleCatch};`));
		assert.ok(source.includes(`${baseline}${doubleCatch};`));
		assert.ok(!source.includes(`${customInit};`));
		assert.ok(!source.includes(`${mcpInit};`));
		assert.ok(!source.includes(`${baseline};`));
		assert.ok(!source.includes(`${customInit}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${mcpInit}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${baseline}.catch(onUnexpectedError);`));
		assert.ok(source.includes('await this.establishCustomizationBaseline(skills, instructions, source, waitForLatestFetch)'));
		assert.ok(!source.includes('await this.establishCustomizationBaseline(skills, instructions, source, waitForLatestFetch).catch'));
	});
});
