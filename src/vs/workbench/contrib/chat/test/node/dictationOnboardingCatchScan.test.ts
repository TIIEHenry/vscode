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
const DICTATION_ONBOARDING_REL = 'src/vs/workbench/contrib/chat/browser/speechToText/dictationOnboarding.ts';

function dictationOnboardingSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), DICTATION_ONBOARDING_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/speechToText/dictationOnboarding.ts'),
		path.join(thisDir, '../../../../../../../', DICTATION_ONBOARDING_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `dictationOnboarding.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('DictationOnboarding leftover fire-and-forget catch scan (D560/D568/D576)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('dictationOnboarding fire-and-forget refreshMicrophones voids double-catch onUnexpectedError', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(dictationOnboardingSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleRefresh = `void this.refreshMicrophones()${doubleCatch}`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('async refreshMicrophones('));
		assert.strictEqual((source.match(/void this\.refreshMicrophones\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 2);
		assert.ok(source.includes(`devicechange', () => ${doubleRefresh}`));
		assert.ok(source.includes(`${doubleRefresh};`));
		assert.ok(!source.includes('void this.refreshMicrophones();'));
		assert.ok(!source.includes('void this.refreshMicrophones().catch(onUnexpectedError);'));
	});

	test('dictationOnboarding fire-and-forget startPreview voids double-catch onUnexpectedError (D568)', () => {
		const source = fs.readFileSync(dictationOnboardingSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleStartPreview = `void this.startPreview()${doubleCatch};`;
		assert.ok(source.includes('async startPreview('));
		assert.strictEqual((source.match(/void this\.startPreview\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 2);
		assert.ok(source.includes(doubleStartPreview));
		assert.ok(!source.includes('void this.startPreview();'));
		assert.ok(!source.includes('void this.startPreview().catch(onUnexpectedError);'));
	});

	test('dictationOnboarding leftover listen / switchMicrophone / service refresh voids double-catch onUnexpectedError (D576)', () => {
		const source = fs.readFileSync(dictationOnboardingSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const collapsed = source.replace(/\s+/g, ' ');
		const doubleListen = `void this.preview.listen(option.deviceId).then(() => this.updateHint())${doubleCatch};`;
		const doubleSwitch = `void this.switchMicrophone(option.deviceId).then(analyser => this.refreshMicrophones(analyser))${doubleCatch};`;
		const doubleServiceRefresh = `void Promise.resolve(this.currentBanner?.refreshMicrophones(analyserNode, switchMicrophone))${doubleCatch};`;
		assert.ok(source.includes(doubleListen));
		assert.ok(collapsed.includes(doubleSwitch));
		assert.ok(source.includes(doubleServiceRefresh));
		assert.strictEqual((source.match(/void this\.preview\.listen\(option\.deviceId\)\.then\(\(\) => this\.updateHint\(\)\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void Promise\.resolve\(this\.currentBanner\?\.refreshMicrophones\(analyserNode, switchMicrophone\)\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.ok(!source.includes('void this.preview.listen(option.deviceId).then(() => this.updateHint());'));
		assert.ok(!source.includes('void this.preview.listen(option.deviceId).then(() => this.updateHint()).catch(onUnexpectedError);'));
		assert.ok(!collapsed.includes('void this.switchMicrophone(option.deviceId).then(analyser => this.refreshMicrophones(analyser));'));
		assert.ok(!collapsed.includes('void this.switchMicrophone(option.deviceId).then(analyser => this.refreshMicrophones(analyser)).catch(onUnexpectedError);'));
		assert.ok(!source.includes('failed to switch dictation microphone'));
		assert.ok(!source.includes('void this.currentBanner?.refreshMicrophones(analyserNode, switchMicrophone);'));
		assert.ok(!source.includes('void this.currentBanner?.refreshMicrophones(analyserNode, switchMicrophone).catch(onUnexpectedError);'));
	});
});
