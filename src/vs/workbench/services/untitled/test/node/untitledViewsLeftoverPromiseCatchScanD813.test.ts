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
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const TEXT_EDITOR_MODEL_REL = 'src/vs/workbench/common/editor/textEditorModel.ts';
const UNTITLED_MODEL_REL = 'src/vs/workbench/services/untitled/common/untitledTextEditorModel.ts';
const UNTITLED_SVC_REL = 'src/vs/workbench/services/untitled/common/untitledTextEditorService.ts';
const UNTITLED_INPUT_REL = 'src/vs/workbench/services/untitled/common/untitledTextEditorInput.ts';
const UNTITLED_HANDLER_REL = 'src/vs/workbench/services/untitled/common/untitledTextEditorHandler.ts';
const VIEWS_IFACE_REL = 'src/vs/workbench/services/views/common/viewsService.ts';
const VIEWS_DESC_REL = 'src/vs/workbench/services/views/browser/viewDescriptorService.ts';
const VIEWS_SVC_REL = 'src/vs/workbench/services/views/browser/viewsService.ts';
const FILES_CFG_REL = 'src/vs/workbench/services/filesConfiguration/common/filesConfigurationService.ts';
const TEXTFILE_MODEL_REL = 'src/vs/workbench/services/textfile/common/textFileEditorModel.ts';
const TEXTFILE_MGR_REL = 'src/vs/workbench/services/textfile/common/textFileEditorModelManager.ts';
const TEXTFILE_ENCODING_REL = 'src/vs/workbench/services/textfile/common/encoding.ts';

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

const untitledAutoDetectCall = 'this.autoDetectLanguage()';
const whenInstalledThenCall = 'this.extensionService.whenInstalledExtensionsRegistered().then(() => this.whenExtensionsRegistered())';
const openViewContainerCall = 'this.openViewContainer(viewContainer.id)';
const focusOpenViewCall = 'accessor.get(IViewsService).openView(viewDescriptor.id, !options?.preserveFocus)';
const resetOpenViewCall = 'accessor.get(IViewsService).openView(viewDescriptor.id, true)';
const resetOpenViewContainerCall = 'accessor.get(IViewsService).openViewContainer(viewContainer.id, true)';

const d813Calls: Array<[string, string, number]> = [
	[UNTITLED_MODEL_REL, untitledAutoDetectCall, 1],
	[VIEWS_DESC_REL, whenInstalledThenCall, 1],
	[VIEWS_SVC_REL, openViewContainerCall, 1],
	[VIEWS_SVC_REL, focusOpenViewCall, 1],
	[VIEWS_SVC_REL, resetOpenViewCall, 1],
	[VIEWS_DESC_REL, resetOpenViewContainerCall, 1],
];

suite('untitled + views leftover Promise fire-and-forget catch scan (D813)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers six leftover Promise double-chain sites after untitled had only autoDetectLanguage and filesConfiguration had no leftover', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d813Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 6);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(UNTITLED_MODEL_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(VIEWS_SVC_REL) ?? ''), 3);
		assert.strictEqual(countDoubleChains(seen.get(VIEWS_DESC_REL) ?? ''), 2);
		assert.ok(!fs.readFileSync(resolveSource(UNTITLED_SVC_REL), 'utf8').includes(doubleCatch));
		assert.ok(!fs.readFileSync(resolveSource(UNTITLED_INPUT_REL), 'utf8').includes(doubleCatch));
		assert.ok(!fs.readFileSync(resolveSource(UNTITLED_HANDLER_REL), 'utf8').includes(doubleCatch));
		assert.ok(!fs.readFileSync(resolveSource(FILES_CFG_REL), 'utf8').includes(doubleCatch));
	});

	test('untitled leftover autoDetectLanguage is Promise double-chain', () => {
		const untitled = fs.readFileSync(resolveSource(UNTITLED_MODEL_REL), 'utf8');
		const textEditorModel = fs.readFileSync(resolveSource(TEXT_EDITOR_MODEL_REL), 'utf8');
		assertPromiseSignature(textEditorModel, 'protected autoDetectLanguage(): Promise<void> {');
		assertPromiseSignature(textEditorModel, 'private async doAutoDetectLanguage(): Promise<void> {');
		assert.ok(untitled.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(untitled, untitledAutoDetectCall);
		assert.ok(!untitled.includes('\t\tthis.autoDetectLanguage();\n'));
		assert.ok(!untitled.includes('override async autoDetectLanguage'));
	});

	test('views leftover whenInstalledExtensionsRegistered then / openViewContainer / leftover openView FOF are Promise double-chain', () => {
		const viewsDesc = fs.readFileSync(resolveSource(VIEWS_DESC_REL), 'utf8');
		const viewsSvc = fs.readFileSync(resolveSource(VIEWS_SVC_REL), 'utf8');
		const viewsIface = fs.readFileSync(resolveSource(VIEWS_IFACE_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		assertPromiseSignature(extensions, 'whenInstalledExtensionsRegistered(): Promise<boolean>;');
		assertPromiseSignature(viewsIface, 'openViewContainer(id: string, focus?: boolean): Promise<IPaneComposite | null>;');
		assertPromiseSignature(viewsSvc, 'async openViewContainer(id: string, focus?: boolean): Promise<IPaneComposite | null> {');
		assertPromiseSignature(viewsIface, 'openView<T extends IView>(id: string, focus?: boolean): Promise<T | null>;');
		assertPromiseSignature(viewsSvc, 'async openView<T extends IView>(id: string, focus?: boolean): Promise<T | null> {');
		assert.ok(viewsDesc.includes('whenExtensionsRegistered(): void {'));
		assert.ok(viewsDesc.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(viewsSvc.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(viewsDesc, whenInstalledThenCall);
		assertWrapped(viewsSvc, openViewContainerCall);
		assertWrapped(viewsSvc, focusOpenViewCall);
		assertWrapped(viewsSvc, resetOpenViewCall);
		assertWrapped(viewsDesc, resetOpenViewContainerCall);
		assert.ok(!viewsDesc.includes('this.extensionService.whenInstalledExtensionsRegistered().then(() => this.whenExtensionsRegistered());'));
		assert.ok(!viewsSvc.includes('\t\t\tthis.openViewContainer(viewContainer.id);\n'));
	});

	test('D811-landed textfile leftover stays wrapped; queueFor / encoding returned then / filesConfiguration leftover remaining stay unwrapped', () => {
		const textfileModel = fs.readFileSync(resolveSource(TEXTFILE_MODEL_REL), 'utf8');
		const textfileMgr = fs.readFileSync(resolveSource(TEXTFILE_MGR_REL), 'utf8');
		const encoding = fs.readFileSync(resolveSource(TEXTFILE_ENCODING_REL), 'utf8');
		const filesCfg = fs.readFileSync(resolveSource(FILES_CFG_REL), 'utf8');
		assertPromiseSignature(textfileModel, 'protected override async autoDetectLanguage(): Promise<void> {');
		assert.ok(textfileModel.includes(`this.autoDetectLanguage()${doubleCatch}`));
		assert.ok(!textfileModel.includes('\t\tthis.autoDetectLanguage();\n'));
		assert.ok(textfileMgr.includes('this.modelResolveQueue.queueFor(model.resource, async () => {'));
		assert.ok(!textfileMgr.includes(`this.modelResolveQueue.queueFor(model.resource, async () => {${doubleCatch}`));
		assert.ok(encoding.includes('return guessEncodingByBuffer(buffer.slice(0, bytesRead), candidateGuessEncodings).then(guessedEncoding => {'));
		assert.ok(!encoding.includes(`guessEncodingByBuffer(buffer.slice(0, bytesRead), candidateGuessEncodings).then(guessedEncoding => {${doubleCatch}`));
		assert.ok(!filesCfg.includes(doubleCatch));
		assertPromiseSignature(filesCfg, 'toggleAutoSave(): Promise<void>;');
		assertPromiseSignature(filesCfg, 'async toggleAutoSave(): Promise<void> {');
		assert.ok(filesCfg.includes("return this.configurationService.updateValue('files.autoSave', newAutoSaveValue);"));
		assert.ok(!filesCfg.includes(`updateValue('files.autoSave', newAutoSaveValue)${doubleCatch}`));
	});

	test('opener / Action2.run returned Promise / assigned then / two-arg then / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const untitled = fs.readFileSync(resolveSource(UNTITLED_MODEL_REL), 'utf8');
		const untitledSvc = fs.readFileSync(resolveSource(UNTITLED_SVC_REL), 'utf8');
		const untitledInput = fs.readFileSync(resolveSource(UNTITLED_INPUT_REL), 'utf8');
		const viewsDesc = fs.readFileSync(resolveSource(VIEWS_DESC_REL), 'utf8');
		const viewsSvc = fs.readFileSync(resolveSource(VIEWS_SVC_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(untitledSvc, 'resolve(options?: INewUntitledTextEditorOptions): Promise<IUntitledTextEditorModel>;');
		assertPromiseSignature(untitled, 'override async resolve(): Promise<void> {');
		assertPromiseSignature(untitledInput, 'setEncoding(encoding: string, mode: EncodingMode /* ignored, we only have Encode */): Promise<void> {');

		assert.ok(!untitled.includes('IOpenerService'));
		assert.ok(!untitledSvc.includes('IOpenerService'));
		assert.ok(!viewsSvc.includes('IOpenerService'));
		assert.ok(!viewsDesc.includes('IOpenerService'));
		assert.ok(!untitled.includes('openerService.open'));
		assert.ok(!viewsSvc.includes('openerService.open'));

		assert.ok(!untitled.includes('extends Action2'));
		assert.ok(viewsSvc.includes('public async run(serviceAccessor: ServicesAccessor): Promise<void> {'));
		assert.ok(viewsSvc.includes('await viewsService.openViewContainer(viewContainer.id, true);'));
		assert.ok(!viewsSvc.includes(`await viewsService.openViewContainer(viewContainer.id, true)${doubleCatch}`));
		assert.ok(viewsSvc.includes('await viewsService.openView(viewDescriptor.id, !options?.preserveFocus);'));
		assert.ok(!viewsSvc.includes(`await viewsService.openView(viewDescriptor.id, !options?.preserveFocus)${doubleCatch}`));
		assert.ok(viewsSvc.includes('viewsService.closeViewContainer(viewContainer.id);'));
		assert.ok(!viewsSvc.includes(`viewsService.closeViewContainer(viewContainer.id)${doubleCatch}`));

		assert.ok(untitledInput.includes('return this.model.setEncoding(encoding);'));
		assert.ok(!untitledInput.includes(`return this.model.setEncoding(encoding)${doubleCatch}`));
		assert.ok(untitledSvc.includes('await model.resolve();'));
		assert.ok(!untitledSvc.includes(`await model.resolve()${doubleCatch}`));
		assert.ok(untitled.includes('return super.resolve();'));
		assert.ok(!untitled.includes(`return super.resolve()${doubleCatch}`));

		assert.ok(!untitled.includes('.then('));
		assert.ok(!untitled.includes(', error => {'));
		assert.ok(!untitled.includes(' = this.autoDetectLanguage'));
		assert.ok(!viewsDesc.includes(' = this.whenInstalledExtensionsRegistered'));
		assert.ok(!viewsSvc.includes(' = this.openViewContainer'));

		assert.ok(!untitled.includes('.catch(onUnexpectedError).catch(onUnexpectedError).catch(onUnexpectedError)'));
		assert.ok(!viewsSvc.includes('.catch(onUnexpectedError).catch(onUnexpectedError).catch(onUnexpectedError)'));
		assert.ok(!viewsDesc.includes('.catch(onUnexpectedError).catch(onUnexpectedError).catch(onUnexpectedError)'));

		for (const source of [untitled, untitledSvc, untitledInput, viewsDesc, viewsSvc]) {
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
