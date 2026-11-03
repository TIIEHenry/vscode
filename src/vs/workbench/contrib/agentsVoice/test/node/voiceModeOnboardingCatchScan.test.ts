/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

suite('VoiceModeOnboarding fire-and-forget refreshMicrophones catch scan (D565)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('voiceModeOnboarding fire-and-forget refreshMicrophones voids single-catch onUnexpectedError and zero double-catches', () => {
		const source = readVoiceModeOnboardingSource();
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const singleRefresh = `void this.refreshMicrophones()${singleCatch}`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual(countDoubleChains(source), 0);
		assert.strictEqual((source.match(/void this\.refreshMicrophones\(\)\.catch\(onUnexpectedError\)/g) ?? []).length, 2);
		assert.ok(source.includes(singleRefresh));
		assert.ok(!source.includes('void this.refreshMicrophones();'));
		assert.ok(!source.includes(doubleCatch));
	});
});

suite('VoiceModeOnboarding fire-and-forget executeCommand / persist catch scan (D573)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('voiceModeOnboarding fire-and-forget executeCommand and persist voids single-catch onUnexpectedError and zero double-catches', () => {
		const source = readVoiceModeOnboardingSource();
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const singleExecute = `void this.commandService.executeCommand(commandId)\n\t\t\t\t\t\t${singleCatch}`;
		const singlePersist = `void this.configurationService.updateValue(VOICE_SETTING, voice.id, ConfigurationTarget.USER)\n\t\t\t${singleCatch}`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual(countDoubleChains(source), 0);
		assert.strictEqual((source.match(/void this\.commandService\.executeCommand\(commandId\)\s*\.catch\(onUnexpectedError\)/g) ?? []).length, 1);
		assert.ok(source.includes(singleExecute));
		assert.strictEqual((source.match(/void this\.configurationService\.updateValue\(VOICE_SETTING, voice\.id, ConfigurationTarget\.USER\)\s*\.catch\(onUnexpectedError\)/g) ?? []).length, 1);
		assert.ok(source.includes(singlePersist));
		assert.ok(!source.includes('.catch(error => this.logService.error(`[voice] Failed to run ${commandId}: ${error}`))'));
		assert.ok(!source.includes('.catch(error => this.logService.error(`[voice] Failed to persist the Voice Mode voice: ${error}`))'));
		assert.ok(!source.includes(doubleCatch));
		assert.ok(source.includes("void context.close().catch(() => { /* already closing */ })"));
		assert.ok(source.includes('audio.play().catch(error => {'));
		assert.strictEqual((source.match(/void this\.refreshMicrophones\(\)\.catch\(onUnexpectedError\)/g) ?? []).length, 2);
	});
});

function readVoiceModeOnboardingSource(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const relative = 'src/vs/workbench/contrib/agentsVoice/browser/voiceModeOnboarding.ts';
	const candidates = [
		path.join(process.cwd(), relative),
		path.join(thisDir, '../../../../../../../', relative),
	];
	const filePath = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(filePath, 'voiceModeOnboarding.ts not found from cwd or import.meta');
	return fs.readFileSync(filePath, 'utf8');
}
