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
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const LANGUAGE_SURVEYS_REL = 'src/vs/workbench/contrib/surveys/browser/languageSurveys.contribution.ts';
const NPS_REL = 'src/vs/workbench/contrib/surveys/browser/nps.contribution.ts';
const SURVEY_CONTRIB_REL = 'src/vs/workbench/contrib/surveys/browser/survey.contribution.ts';
const WELCOME_BANNER_REL = 'src/vs/workbench/contrib/welcomeBanner/browser/welcomeBanner.contribution.ts';
const BANNER_REL = 'src/vs/workbench/services/banner/browser/bannerService.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';

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

function countDouble(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

suite('surveys leftover Promise fire-and-forget catch scan (D791)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('opener / D145 / Resolve / Connect / Watch / Pty / Action2.run / returned Promise / already-double / invented proto / nps / welcomeBanner stay skipped', () => {
		const languageSurveys = fs.readFileSync(resolveSource(LANGUAGE_SURVEYS_REL), 'utf8');
		const nps = fs.readFileSync(resolveSource(NPS_REL), 'utf8');
		const surveyContrib = fs.readFileSync(resolveSource(SURVEY_CONTRIB_REL), 'utf8');
		const welcomeBanner = fs.readFileSync(resolveSource(WELCOME_BANNER_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const banner = fs.readFileSync(resolveSource(BANNER_REL), 'utf8');
		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assert.ok(languageSurveys.includes('openerService.open('));
		assert.ok(!/openerService\.open\([^;]*\)\.catch\(onUnexpectedError\)/.test(languageSurveys));
		assert.ok(nps.includes('openerService.open('));
		assert.ok(!/openerService\.open\([^;]*\)\.catch\(onUnexpectedError\)/.test(nps));
		assert.strictEqual(countDouble(nps), 0);
		assert.ok(surveyContrib.includes('override async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(surveyContrib.includes("return openSurveyEditor(accessor, 'dev-command');"));
		assert.ok(!surveyContrib.includes(`openSurveyEditor(accessor, 'dev-command')${doubleCatch}`));
		assert.ok(surveyContrib.includes('return editorService.openEditor(input, { pinned: true }, preferredGroup).then(() => undefined);'));
		assert.ok(!surveyContrib.includes(`editorService.openEditor(input, { pinned: true }, preferredGroup).then(() => undefined)${doubleCatch}`));
		assert.ok(banner.includes('show(item: IBannerItem): void;'));
		assert.ok(welcomeBanner.includes('bannerService.show({'));
		assert.ok(!welcomeBanner.includes(doubleCatch));
		assert.strictEqual(countDouble(welcomeBanner), 0);
		assert.ok(!languageSurveys.includes('acknowledge('));
		assert.ok(!languageSurveys.includes('releaseLease('));
		assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(languageSurveys));
		assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(languageSurveys));
		assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(languageSurveys));
		assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(languageSurveys));
	});
});
