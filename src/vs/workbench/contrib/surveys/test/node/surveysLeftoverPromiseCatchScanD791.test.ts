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
const GITHUB_REL = 'src/vs/workbench/contrib/github/browser/githubLinkPresentation.contribution.ts';
const LANGUAGE_SURVEYS_REL = 'src/vs/workbench/contrib/surveys/browser/languageSurveys.contribution.ts';
const SURVEY_PANE_REL = 'src/vs/workbench/contrib/surveys/browser/surveyEditorPane.ts';
const NPS_REL = 'src/vs/workbench/contrib/surveys/browser/nps.contribution.ts';
const SURVEY_CONTRIB_REL = 'src/vs/workbench/contrib/surveys/browser/survey.contribution.ts';
const WELCOME_BANNER_REL = 'src/vs/workbench/contrib/welcomeBanner/browser/welcomeBanner.contribution.ts';
const EDITOR_REL = 'src/vs/workbench/services/editor/common/editorService.ts';
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

function assertDoubleChain(source: string, call: string, count: number): void {
	assert.strictEqual((source.match(new RegExp(call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, count, `count mismatch: ${call}`);
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`), `single-chain remains: ${call}`);
}

suite('surveys leftover Promise fire-and-forget catch scan (D791)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('github leftover remaining three sites plus surveys wraps are Promise/async + double-chain', () => {
		const github = fs.readFileSync(resolveSource(GITHUB_REL), 'utf8');
		const languageSurveys = fs.readFileSync(resolveSource(LANGUAGE_SURVEYS_REL), 'utf8');
		const surveyPane = fs.readFileSync(resolveSource(SURVEY_PANE_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		assert.ok(github.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(languageSurveys.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(surveyPane.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertPromiseSignature(github, 'private async _flush(): Promise<void> {');
		assertPromiseSignature(github, 'private async _initializeSubscription(target: GitHubLinkTarget, generation: number, controller: AbortController, store: DisposableStore): Promise<void> {');
		assertPromiseSignature(github, 'hydrate(target: GitHubLinkTarget, account: GitHubAccountHandle): Promise<void> {');
		assertPromiseSignature(languageSurveys, 'private async handleSurveys() {');
		assertPromiseSignature(editor, 'closeEditor(editor: IEditorIdentifier, options?: ICloseEditorOptions): Promise<void>;');
		assertDoubleChain(github, 'void this._flush()', 1);
		assertDoubleChain(github, 'void this._initializeSubscription(target, generation, controller, store)', 1);
		const hydrateThen = `void this._hydrator.hydrate(target, account).catch(error => {
				this._logService.trace(\`[GitHubLinkPresentation] Bulk hydration failed for \${formatTarget(target)}; falling back to resource fetch\`, error);
			})`;
		assert.ok(github.includes(`${hydrateThen}${doubleCatch};`));
		assert.ok(!github.includes(`${hydrateThen};`));
		assert.ok(!github.includes(`${hydrateThen}.catch(onUnexpectedError);`));
		assertDoubleChain(languageSurveys, 'this.handleSurveys()', 1);
		assertDoubleChain(surveyPane, 'this.editorService.closeEditor({ editor: submittedInput, groupId: this.group.id })', 1);
		assert.strictEqual(countDouble(github), 3);
		assert.strictEqual(countDouble(languageSurveys) + countDouble(surveyPane), 2);
		assert.strictEqual(countDouble(github) + countDouble(languageSurveys) + countDouble(surveyPane), 5);
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
