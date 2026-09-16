/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

suite('VoiceModeOnboarding fire-and-forget refreshMicrophones catch scan (D565)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('voiceModeOnboarding fire-and-forget refreshMicrophones voids double-catch onUnexpectedError', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = readVoiceModeOnboardingSource();
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleRefresh = `void this.refreshMicrophones()${doubleCatch}`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\.refreshMicrophones\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 2);
		assert.ok(source.includes(doubleRefresh));
		assert.ok(!source.includes('void this.refreshMicrophones();'));
		assert.ok(!source.includes('void this.refreshMicrophones().catch(onUnexpectedError);'));
	});
});

suite('VoiceModeOnboarding fire-and-forget executeCommand / persist catch scan (D573)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('voiceModeOnboarding fire-and-forget executeCommand and persist voids double-catch onUnexpectedError', () => {
		// Single-layer log catch still leaks when mocha's unexpected handler warn-then-rethrows.
		const source = readVoiceModeOnboardingSource();
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleExecute = `void this.commandService.executeCommand(commandId)\n\t\t\t\t\t\t${doubleCatch}`;
		const doublePersist = `void this.configurationService.updateValue(VOICE_SETTING, voice.id, ConfigurationTarget.USER)\n\t\t\t${doubleCatch}`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\.commandService\.executeCommand\(commandId\)\s*\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 1);
		assert.ok(source.includes(doubleExecute));
		assert.strictEqual((source.match(/void this\.configurationService\.updateValue\(VOICE_SETTING, voice\.id, ConfigurationTarget\.USER\)\s*\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 1);
		assert.ok(source.includes(doublePersist));
		assert.ok(!source.includes('.catch(error => this.logService.error(`[voice] Failed to run ${commandId}: ${error}`))'));
		assert.ok(!source.includes('.catch(error => this.logService.error(`[voice] Failed to persist the Voice Mode voice: ${error}`))'));
		assert.ok(!source.includes('this.commandService.executeCommand(commandId).catch(onUnexpectedError);'));
		assert.ok(!source.includes('this.configurationService.updateValue(VOICE_SETTING, voice.id, ConfigurationTarget.USER).catch(onUnexpectedError);'));
		assert.ok(source.includes("void context.close().catch(() => { /* already closing */ })"));
		assert.ok(source.includes('audio.play().catch(error => {'));
		assert.strictEqual((source.match(/void this\.refreshMicrophones\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 2);
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
