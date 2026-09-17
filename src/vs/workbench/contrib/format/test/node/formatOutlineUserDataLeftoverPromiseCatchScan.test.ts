/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const FORMAT_REL = 'src/vs/workbench/contrib/format/browser/formatActionsMultiple.ts';
const OUTLINE_REL = 'src/vs/workbench/contrib/outline/browser/outlinePane.ts';
const PROFILE_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfile.ts';
const PROFILE_EDITOR_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditor.ts';
const PROFILE_MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/common/lifecycle.ts';
const PROFILE_PLATFORM_REL = 'src/vs/platform/userDataProfile/common/userDataProfile.ts';
const TAGS_REL = 'src/vs/workbench/contrib/tags/electron-browser/workspaceTags.ts';
const TESTING_CONTENT_REL = 'src/vs/workbench/contrib/testing/common/testingContentProvider.ts';
const TESTING_RESULT_REL = 'src/vs/workbench/contrib/testing/common/testResult.ts';
const TESTING_COVERAGE_VIEW_REL = 'src/vs/workbench/contrib/testing/browser/testCoverageView.ts';
const TESTING_COVERAGE_REL = 'src/vs/workbench/contrib/testing/common/testCoverage.ts';

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

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

suite('format/outline/userDataProfile leftover Promise fire-and-forget catch scan (D693)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('format leftover _analyzeFormatter then is Promise double-chain; leftover remaining wraps _updateConfigValues', () => {
		const source = fs.readFileSync(resolveSource(FORMAT_REL), 'utf8');
		assertPromiseSignature(source, 'private async _analyzeFormatter<T extends FormattingEditProvider>(kind: FormattingKind, formatter: T[], document: ITextModel): Promise<T | string> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const analyzeThen = `this._analyzeFormatter(FormattingKind.File, formatter, document).then(result => {
			if (cts.token.isCancellationRequested) {
				return;
			}
			if (typeof result !== 'string') {
				return;
			}
			const command = { id: \`formatter/configure/dfl/\${generateUuid()}\`, title: nls.localize('do.config.command', "Configure...") };
			this._languageStatusStore.add(CommandsRegistry.registerCommand(command.id, () => this._pickAndPersistDefaultFormatter(formatter, document)));
			this._languageStatusStore.add(this._languageStatusService.addStatus({
				id: 'formatter.conflict',
				name: nls.localize('summary', "Formatter Conflicts"),
				selector: { language: document.getLanguageId(), pattern: document.uri.fsPath },
				severity: Severity.Error,
				label: nls.localize('formatter', "Formatting"),
				detail: result,
				busy: false,
				source: '',
				command,
				accessibilityInfo: undefined
			}));
		})`;
		assert.ok(source.includes(`${analyzeThen}${doubleCatch};`));
		assert.ok(!source.includes(`${analyzeThen};`));
		assert.ok(!source.includes(`${analyzeThen}.catch(onUnexpectedError);`));
		assert.ok(source.includes(`this._updateConfigValues()${doubleCatch};`));
		assert.ok(!source.includes('this._updateConfigValues();'));
	});

	test('outline leftover _editorControlChangePromise then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(OUTLINE_REL), 'utf8');
		assertPromiseSignature(source, 'private _editorControlChangePromise: Promise<void> = Promise.resolve();');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const focusThen = `this._editorControlChangePromise.then(() => {
			super.focus();
			this._tree?.domFocus();
		})`;
		assert.ok(source.includes(`${focusThen}${doubleCatch};`));
		assert.ok(!source.includes(`${focusThen};`));
		assert.ok(!source.includes(`${focusThen}.catch(onUnexpectedError);`));
	});

	test('userDataProfile leftover when / getTemplates thens are Promise double-chain; opener stays skipped', () => {
		const profile = fs.readFileSync(resolveSource(PROFILE_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(PROFILE_EDITOR_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(PROFILE_MODEL_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const platform = fs.readFileSync(resolveSource(PROFILE_PLATFORM_REL), 'utf8');
		assertPromiseSignature(lifecycle, 'when(phase: LifecyclePhase): Promise<void>;');
		assertPromiseSignature(platform, 'cleanUp(): Promise<void>;');
		assertPromiseSignature(profile, 'async handleURL(uri: URI): Promise<boolean> {');
		assertPromiseSignature(model, 'getTemplates(): Promise<readonly IProfileTemplateInfo[]> {');
		assert.ok(profile.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(editor.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(profile, 'lifecycleService.when(LifecyclePhase.Eventually).then(() => userDataProfilesService.cleanUp())');
		assertDoubleThen(profile, 'lifecycleService.when(LifecyclePhase.Restored).then(() => this.handleURL(URI.revive(environmentService.options!.profileToPreview!)))');
		const templatesThen = `this.model.getTemplates().then(templates => {
			this.templates = templates;
			if (this.profileWidget) {
				this.profileWidget.templates = templates;
			}
		})`;
		assert.ok(editor.includes(`${templatesThen}${doubleCatch};`));
		assert.ok(!editor.includes(`${templatesThen};`));
		assert.ok(!editor.includes(`${templatesThen}.catch(onUnexpectedError);`));
		assert.ok(profile.includes("return accessor.get(IOpenerService).open(URI.parse('https://aka.ms/vscode-profiles-help'));"));
		assert.ok(!profile.includes("accessor.get(IOpenerService).open(URI.parse('https://aka.ms/vscode-profiles-help')).catch"));
	});

	test('tags leftover getWorkspaceInformation then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(TAGS_REL), 'utf8');
		assertPromiseSignature(source, 'private async getWorkspaceInformation(): Promise<IWorkspaceInformation> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this.getWorkspaceInformation().then(stats => this.diagnosticsService.reportWorkspaceStats(stats))');
	});

	test('testing leftover endPromise / details thens are Promise double-chain', () => {
		const content = fs.readFileSync(resolveSource(TESTING_CONTENT_REL), 'utf8');
		const result = fs.readFileSync(resolveSource(TESTING_RESULT_REL), 'utf8');
		const view = fs.readFileSync(resolveSource(TESTING_COVERAGE_VIEW_REL), 'utf8');
		const coverage = fs.readFileSync(resolveSource(TESTING_COVERAGE_REL), 'utf8');
		assertPromiseSignature(result, 'readonly endPromise: Promise<void>;');
		assertPromiseSignature(coverage, 'public async details(token = CancellationToken.None) {');
		assert.ok(content.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(view.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const endThen = `task.output.endPromise.then(() => {
				if (dispose.isDisposed) {
					return;
				}
				if (!hadContent) {
					append(localize('runNoOutout', 'The test run did not record any output.'));
					dispose.dispose();
				}
			})`;
		assert.ok(content.includes(`${endThen}${doubleCatch};`));
		assert.ok(!content.includes(`${endThen};`));
		assert.ok(!content.includes(`${endThen}.catch(onUnexpectedError);`));
		assertDoubleThen(view, 'el.value!.details().then(details => this.updateWithDetails(el, details))');
	});

	test('opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty stay skipped', () => {
		const format = fs.readFileSync(resolveSource(FORMAT_REL), 'utf8');
		const outline = fs.readFileSync(resolveSource(OUTLINE_REL), 'utf8');
		const profile = fs.readFileSync(resolveSource(PROFILE_REL), 'utf8');
		const tags = fs.readFileSync(resolveSource(TAGS_REL), 'utf8');
		const content = fs.readFileSync(resolveSource(TESTING_CONTENT_REL), 'utf8');
		const view = fs.readFileSync(resolveSource(TESTING_COVERAGE_VIEW_REL), 'utf8');
		assert.ok(format.includes('this._store.add(this._extensionService.onDidChangeExtensions(this._updateConfigValues, this));'));
		assert.ok(format.includes('this._store.add(_languageFeaturesService.documentFormattingEditProvider.onDidChange(this._updateConfigValues, this));'));
		assert.ok(format.includes('this._store.add(_languageFeaturesService.documentRangeFormattingEditProvider.onDidChange(this._updateConfigValues, this));'));
		assert.ok(!format.includes('onDidChangeExtensions(() => this._updateConfigValues()'));
		assert.ok(profile.includes("return accessor.get(IOpenerService).open(URI.parse('https://aka.ms/vscode-profiles-help'));"));
		assert.ok(!profile.includes("accessor.get(IOpenerService).open(URI.parse('https://aka.ms/vscode-profiles-help')).catch"));
		assert.ok(!outline.includes('acknowledge('));
		assert.ok(!format.includes('acknowledge('));
		assert.ok(!profile.includes('acknowledge('));
		assert.ok(!profile.includes('releaseLease('));
		for (const source of [format, outline, profile, tags, content, view]) {
			assert.ok(!source.includes('Wire('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});

function assertDoubleThen(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch};`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}
