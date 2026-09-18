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
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const FILES_REL = 'src/vs/platform/files/common/files.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const LANG_DETECT_REL = 'src/vs/workbench/services/languageDetection/common/languageDetectionWorkerService.ts';
const TEXT_EDITOR_MODEL_REL = 'src/vs/workbench/common/editor/textEditorModel.ts';
const TEXTFILES_REL = 'src/vs/workbench/services/textfile/common/textfiles.ts';
const MODEL_REL = 'src/vs/workbench/services/textfile/common/textFileEditorModel.ts';
const MGR_REL = 'src/vs/workbench/services/textfile/common/textFileEditorModelManager.ts';
const SVC_REL = 'src/vs/workbench/services/textfile/browser/textFileService.ts';
const ENCODING_REL = 'src/vs/workbench/services/textfile/common/encoding.ts';
const EDITOR_SVC_REL = 'src/vs/workbench/services/textfile/common/textEditorService.ts';
const BROWSER_SVC_REL = 'src/vs/workbench/services/textfile/browser/browserTextFileService.ts';
const NATIVE_SVC_REL = 'src/vs/workbench/services/textfile/electron-browser/nativeTextFileService.ts';
const PARTICIPANT_REL = 'src/vs/workbench/services/textfile/common/textFileSaveParticipant.ts';
const NATIVE_TEST_REL = 'src/vs/workbench/services/textfile/test/electron-browser/nativeTextFileService.test.ts';
const UNTITLED_SVC_REL = 'src/vs/workbench/services/untitled/common/untitledTextEditorService.ts';
const VIEWS_DESC_REL = 'src/vs/workbench/services/views/browser/viewDescriptorService.ts';
const FILES_CFG_REL = 'src/vs/workbench/services/filesConfiguration/common/filesConfigurationService.ts';
const WORKING_COPY_TRACKER_REL = 'src/vs/workbench/services/workingCopy/common/workingCopyBackupTracker.ts';
const WORKING_COPY_HISTORY_REL = 'src/vs/workbench/services/workingCopy/common/workingCopyHistoryTracker.ts';
const WORKING_COPY_STORED_REL = 'src/vs/workbench/services/workingCopy/common/storedFileWorkingCopy.ts';

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

function countIncludes(source: string, needle: string): number {
	return (source.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
}

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const onDidFilesChangeCall = 'this.onDidFilesChange(e)';
const autoDetectLanguageCall = 'this.autoDetectLanguage()';
const onMaybeShouldChangeEncodingCall = 'this.onMaybeShouldChangeEncoding()';
const asyncReloadIifeCall = `await model.resolve(options);
						} catch (error) {
							if (!model.isDisposed()) {
								onUnexpectedError(error); // only log if the model is still around
							}
						}
					})()`;

const d811Calls: Array<[string, string, number]> = [
	[MODEL_REL, onDidFilesChangeCall, 1],
	[MODEL_REL, autoDetectLanguageCall, 2],
	[MODEL_REL, onMaybeShouldChangeEncodingCall, 1],
	[MGR_REL, asyncReloadIifeCall, 1],
];

suite('textfile leftover Promise fire-and-forget catch scan (D811)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers five leftover Promise double-chain sites in services/textfile and did not overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d811Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 5);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(MODEL_REL) ?? ''), 4);
		assert.strictEqual(countDoubleChains(seen.get(MGR_REL) ?? ''), 1);
		assert.ok(!fs.readFileSync(resolveSource(UNTITLED_SVC_REL), 'utf8').includes(doubleCatch));
		assert.ok(!fs.readFileSync(resolveSource(FILES_CFG_REL), 'utf8').includes(doubleCatch));
	});

	test('textfile leftover onDidFilesChange / autoDetectLanguage / onMaybeShouldChangeEncoding are Promise/async + double-chain', () => {
		const model = fs.readFileSync(resolveSource(MODEL_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		const textEditorModel = fs.readFileSync(resolveSource(TEXT_EDITOR_MODEL_REL), 'utf8');
		const textfiles = fs.readFileSync(resolveSource(TEXTFILES_REL), 'utf8');
		const langDetect = fs.readFileSync(resolveSource(LANG_DETECT_REL), 'utf8');

		assertPromiseSignature(model, 'private async onDidFilesChange(e: FileChangesEvent): Promise<void> {');
		assertPromiseSignature(files, 'exists(resource: URI): Promise<boolean>;');
		assertPromiseSignature(model, 'protected override async autoDetectLanguage(): Promise<void> {');
		assertPromiseSignature(textEditorModel, 'protected autoDetectLanguage(): Promise<void> {');
		assertPromiseSignature(extensions, 'whenInstalledExtensionsRegistered(): Promise<boolean>;');
		assertPromiseSignature(langDetect, 'detectLanguage(resource: URI, supportedLangs?: string[]): Promise<string | undefined>;');
		assertPromiseSignature(model, 'private async onMaybeShouldChangeEncoding(): Promise<void> {');
		assertPromiseSignature(textfiles, 'getPreferredReadEncoding(resource: URI): Promise<IResourceEncoding>;');
		assertPromiseSignature(model, 'private async forceResolveFromFile(): Promise<void> {');

		assert.ok(model.includes("import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(model, onDidFilesChangeCall);
		assertWrapped(model, autoDetectLanguageCall);
		assertWrapped(model, onMaybeShouldChangeEncodingCall);
		assert.strictEqual(countIncludes(model, `${autoDetectLanguageCall}${doubleCatch}`), 2);
		assert.ok(!model.includes('e => this.onDidFilesChange(e)));'));
		assert.ok(!model.includes('\t\tthis.autoDetectLanguage();\n'));
		assert.ok(!model.includes('() => this.onMaybeShouldChangeEncoding());'));
	});

	test('textfile leftover async reload IIFE is Promise/async + double-chain', () => {
		const mgr = fs.readFileSync(resolveSource(MGR_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(MODEL_REL), 'utf8');
		const textfiles = fs.readFileSync(resolveSource(TEXTFILES_REL), 'utf8');
		assertPromiseSignature(model, 'override async resolve(options?: ITextFileResolveOptions): Promise<void> {');
		assertPromiseSignature(textfiles, 'resolve(options?: ITextFileResolveOptions): Promise<void>;');
		assert.ok(mgr.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(mgr, asyncReloadIifeCall);
		assert.ok(mgr.includes(`${asyncReloadIifeCall}${doubleCatch};`));
		assert.ok(!mgr.includes(`${asyncReloadIifeCall};\n`));
	});

	test('textfile leftover remaining queueFor / returned Promise stay unwrapped', () => {
		const filesCfg = fs.readFileSync(resolveSource(FILES_CFG_REL), 'utf8');
		const mgr = fs.readFileSync(resolveSource(MGR_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(MODEL_REL), 'utf8');
		const encoding = fs.readFileSync(resolveSource(ENCODING_REL), 'utf8');
		const nativeTest = fs.readFileSync(resolveSource(NATIVE_TEST_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(NATIVE_SVC_REL), 'utf8');
		const browser = fs.readFileSync(resolveSource(BROWSER_SVC_REL), 'utf8');

		assert.ok(!filesCfg.includes(doubleCatch));

		assert.ok(mgr.includes('this.modelResolveQueue.queueFor(model.resource, async () => {'));
		assert.ok(!mgr.includes(`this.modelResolveQueue.queueFor(model.resource, async () => {${doubleCatch}`));
		assert.ok(mgr.includes('e.waitUntil((async () => {'));
		assert.ok(!mgr.includes(`e.waitUntil((async () => {${doubleCatch}`));
		assert.ok(mgr.includes('this._register(this.fileService.onDidFilesChange(e => this.onDidFilesChange(e)));'));
		assert.ok(!mgr.includes(`this._register(this.fileService.onDidFilesChange(e => this.onDidFilesChange(e)${doubleCatch}`));

		assert.ok(model.includes('return super.autoDetectLanguage();'));
		assert.ok(!model.includes(`return super.autoDetectLanguage()${doubleCatch}`));
		assert.ok(model.includes('return this.forceResolveFromFile();'));
		assert.ok(!model.includes(`return this.forceResolveFromFile()${doubleCatch}`));
		assert.ok(encoding.includes('return guessEncodingByBuffer(buffer.slice(0, bytesRead), candidateGuessEncodings).then(guessedEncoding => {'));
		assert.ok(!encoding.includes(`guessEncodingByBuffer(buffer.slice(0, bytesRead), candidateGuessEncodings).then(guessedEncoding => {${doubleCatch}`));
		assert.ok(nativeTest.includes('model.save().then(() => pendingSaveAwaited = true);'));
		assert.ok(!nativeTest.includes(`model.save().then(() => pendingSaveAwaited = true)${doubleCatch}`));
		assert.ok(native.includes('event.join(this.onWillShutdown(), { id: \'join.textFiles\', label: localize(\'join.textFiles\', "Saving text files") })'));
		assert.ok(!native.includes(`this.onWillShutdown()${doubleCatch}`));
		assert.ok(browser.includes('event.veto(this.onBeforeShutdown(), \'veto.textFiles\')'));
		assert.ok(!browser.includes(`this.onBeforeShutdown()${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const model = fs.readFileSync(resolveSource(MODEL_REL), 'utf8');
		const mgr = fs.readFileSync(resolveSource(MGR_REL), 'utf8');
		const svc = fs.readFileSync(resolveSource(SVC_REL), 'utf8');
		const encoding = fs.readFileSync(resolveSource(ENCODING_REL), 'utf8');
		const editorSvc = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');
		const participant = fs.readFileSync(resolveSource(PARTICIPANT_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const views = fs.readFileSync(resolveSource(VIEWS_DESC_REL), 'utf8');
		const tracker = fs.readFileSync(resolveSource(WORKING_COPY_TRACKER_REL), 'utf8');
		const historyTracker = fs.readFileSync(resolveSource(WORKING_COPY_HISTORY_REL), 'utf8');
		const stored = fs.readFileSync(resolveSource(WORKING_COPY_STORED_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(encoding, 'async function guessEncodingByBuffer(buffer: VSBuffer, candidateGuessEncodings?: string[]): Promise<string | null> {');
		assert.ok(views.includes('whenExtensionsRegistered(): void {'));

		assert.ok(!model.includes('IOpenerService'));
		assert.ok(!mgr.includes('IOpenerService'));
		assert.ok(!model.includes('openerService.open'));
		assert.ok(!mgr.includes('openerService.open'));

		assert.ok(!model.includes('extends Action2'));
		assert.ok(!mgr.includes('extends Action2'));
		assert.ok(!svc.includes('extends Action2'));

		assert.ok(!model.includes('.then('));
		assert.ok(!mgr.includes('.then('));
		assert.ok(!model.includes(', error => {'));
		assert.ok(!mgr.includes(', error => {'));
		assert.ok(!model.includes(' = this.autoDetectLanguage'));
		assert.ok(!model.includes(' = this.onMaybeShouldChangeEncoding'));
		assert.ok(!model.includes(' = this.onDidFilesChange'));

		assert.ok(model.includes('await this.doResolve(options);'));
		assert.ok(!model.includes(`await this.doResolve(options)${doubleCatch}`));
		assert.ok(model.includes('return this.setEncodingInternal(encoding, mode);'));
		assert.ok(!model.includes(`return this.setEncodingInternal(encoding, mode)${doubleCatch}`));
		assert.ok(mgr.includes('return this.doResolve(resource, options);'));
		assert.ok(!mgr.includes(`return this.doResolve(resource, options)${doubleCatch}`));
		assert.ok(mgr.includes('return this.saveParticipants.participate(model, context, progress, token);'));
		assert.ok(!mgr.includes(`return this.saveParticipants.participate(model, context, progress, token)${doubleCatch}`));

		assert.ok(!model.includes('.catch(onUnexpectedError).catch(onUnexpectedError).catch(onUnexpectedError)'));
		assert.ok(!mgr.includes('.catch(onUnexpectedError).catch(onUnexpectedError).catch(onUnexpectedError)'));

		assert.ok(tracker.includes('this.whenReady = this.resolveBackupsToRestore();'));
		assert.ok(!tracker.includes(`this.whenReady = this.resolveBackupsToRestore()${doubleCatch}`));
		assert.ok(historyTracker.includes('this.limiter.queue(async () => {'));
		assert.ok(!historyTracker.includes(`this.limiter.queue(async () => {${doubleCatch}`));
		assert.ok(stored.includes('run: () => this.save({ ...options, ignoreModifiedSince: true, reason: SaveReason.EXPLICIT })'));
		assert.ok(!stored.includes(`run: () => this.save({ ...options, ignoreModifiedSince: true, reason: SaveReason.EXPLICIT })${doubleCatch}`));
		assert.ok(stored.includes('run: () => this.revert()'));
		assert.ok(!stored.includes(`run: () => this.revert()${doubleCatch}`));

		for (const source of [model, mgr, svc, encoding, editorSvc, participant]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
		}
	});
});
