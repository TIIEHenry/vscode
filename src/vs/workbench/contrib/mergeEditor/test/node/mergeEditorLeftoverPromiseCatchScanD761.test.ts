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
const COMMANDS_REL = 'src/vs/workbench/contrib/mergeEditor/browser/commands/commands.ts';
const INPUT_MODEL_REL = 'src/vs/workbench/contrib/mergeEditor/browser/mergeEditorInputModel.ts';
const CONFLICT_REL = 'src/vs/workbench/contrib/mergeEditor/browser/view/conflictActions.ts';
const MODEL_REL = 'src/vs/workbench/contrib/mergeEditor/browser/model/mergeEditorModel.ts';
const DIFFS_REL = 'src/vs/workbench/contrib/mergeEditor/browser/model/textModelDiffs.ts';
const MERGE_EDITOR_REL = 'src/vs/workbench/contrib/mergeEditor/browser/view/mergeEditor.ts';
const INPUT_REL = 'src/vs/workbench/contrib/mergeEditor/browser/mergeEditorInput.ts';
const DEV_REL = 'src/vs/workbench/contrib/mergeEditor/browser/commands/devCommands.ts';
const ELECTRON_DEV_REL = 'src/vs/workbench/contrib/mergeEditor/electron-browser/devCommands.ts';
const EDITOR_SERVICE_REL = 'src/vs/workbench/services/editor/common/editorService.ts';
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

const singleCatch = '.catch(onUnexpectedError)';
const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${singleCatch}`), `missing single-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${singleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}${doubleCatch}`));
}

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

const compare1 = 'mergeEditorCompare(viewModel, editorService, 1)';
const compare2 = 'mergeEditorCompare(viewModel, editorService, 2)';
const resetCall = 'viewModel.model.reset()';
const iifeTail = '})()';
const actionCall = 'item.action!()';

const d761Calls: Array<[string, string, number]> = [
	[COMMANDS_REL, compare1, 1],
	[COMMANDS_REL, compare2, 1],
	[COMMANDS_REL, resetCall, 1],
	[INPUT_MODEL_REL, iifeTail, 1],
	[CONFLICT_REL, actionCall, 1],
];

suite('Merge editor leftover remaining Promise fire-and-forget catch scan (D761)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers five leftover Promise single-catch sites and zero double-catches', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d761Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = (source.match(new RegExp(`${call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${singleCatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) ?? []).length;
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 5);
		assert.ok(sites >= 4);
		for (const [, source] of seen) {
			assert.strictEqual(countDoubleChains(source), 0);
		}
	});

	test('leftover mergeEditorCompare / reset fire-and-forgets are Promise single-catch', () => {
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(MODEL_REL), 'utf8');
		assertPromiseSignature(commands, 'async function mergeEditorCompare(viewModel: MergeEditorViewModel, editorService: IEditorService, inputNumber: 1 | 2) {');
		assertPromiseSignature(model, 'public async reset(): Promise<void> {');
		assert.ok(commands.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual(countDoubleChains(commands), 0);
		assert.ok(commands.includes(`${compare1}${singleCatch};`));
		assert.ok(commands.includes(`${compare2}${singleCatch};`));
		assert.ok(commands.includes(`${resetCall}${singleCatch};`));
		assert.ok(!commands.includes(`${compare1};`));
		assert.ok(!commands.includes(`${compare2};`));
		assert.ok(!commands.includes(`${resetCall};`));
	});

	test('leftover temp-file save IIFE / conflict action click are Promise single-catch', () => {
		const inputModel = fs.readFileSync(resolveSource(INPUT_MODEL_REL), 'utf8');
		const conflict = fs.readFileSync(resolveSource(CONFLICT_REL), 'utf8');
		assertPromiseSignature(inputModel, 'public async save(options?: ITextFileSaveOptions): Promise<void> {');
		assertPromiseSignature(conflict, 'action?: () => Promise<void>;');
		assert.ok(inputModel.includes("import { BugIndicatingError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(conflict.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(inputModel.includes(`})()${singleCatch};`));
		assert.ok(!inputModel.includes('\t\t})();'));
		assert.ok(conflict.includes(`onclick: () => item.action!()${singleCatch}`));
		assert.ok(!conflict.includes('onclick: () => item.action!() }'));
		assert.strictEqual(countDoubleChains(inputModel), 0);
		assert.strictEqual(countDoubleChains(conflict), 0);
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve stay skipped', () => {
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(MODEL_REL), 'utf8');
		const diffs = fs.readFileSync(resolveSource(DIFFS_REL), 'utf8');
		const mergeEditor = fs.readFileSync(resolveSource(MERGE_EDITOR_REL), 'utf8');
		const input = fs.readFileSync(resolveSource(INPUT_REL), 'utf8');
		const inputModel = fs.readFileSync(resolveSource(INPUT_MODEL_REL), 'utf8');
		const dev = fs.readFileSync(resolveSource(DEV_REL), 'utf8');
		const electronDev = fs.readFileSync(resolveSource(ELECTRON_DEV_REL), 'utf8');
		const editorService = fs.readFileSync(resolveSource(EDITOR_SERVICE_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(editorService, 'openEditor(editor: IUntypedEditorInput, group?: PreferredGroup): Promise<IEditorPane | undefined>;');
		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assert.ok(commands.includes('editorService.openEditor(editorService.activeEditor!, { pinned: true });'));
		assert.ok(!commands.includes('editorService.openEditor(editorService.activeEditor!, { pinned: true }).catch'));
		assert.ok(commands.includes('accessor.get(IEditorService).openEditor(input);'));
		assert.ok(!commands.includes('accessor.get(IEditorService).openEditor(input).catch'));
		assert.ok(commands.includes('editorService.openEditor({ resource: viewModel.model.resultTextModel.uri });'));
		assert.ok(!commands.includes('editorService.openEditor({ resource: viewModel.model.resultTextModel.uri }).catch'));
		assert.ok(commands.includes('openerService.open(viewModel.model.base.uri);'));
		assert.ok(!commands.includes('openerService.open(viewModel.model.base.uri).catch'));
		assert.ok(dev.includes('editorService.openEditor(input);'));
		assert.ok(!dev.includes('editorService.openEditor(input).catch'));
		assert.ok(electronDev.includes('editorService.openEditor(input);'));
		assert.ok(!electronDev.includes('editorService.openEditor(input).catch'));

		assert.ok(model.includes('this.onInitialized = waitForState(this.diffComputingState, state => state === MergeEditorModelState.upToDate).then(async () => {'));
		assert.ok(!model.includes(`this.onInitialized = waitForState(this.diffComputingState, state => state === MergeEditorModelState.upToDate).then(async () => {}${doubleCatch}`));
		assert.ok(inputModel.includes('this._textModelService.createModelReference(args.base).then<IReference<ITextModel>>(v => ({'));
		assert.ok(inputModel.includes('.catch(e => {'));
		assert.ok(!inputModel.includes(`createModelReference(args.base).then<IReference<ITextModel>>(v => ({}${doubleCatch}`));

		assert.ok(model.includes(`initializePromise.then(() => {`));
		assert.ok(model.includes(`}).catch(onUnexpectedError);`));
		assert.ok(!model.includes(`}).catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.ok(diffs.includes(`result.then((result) => {`));
		assert.ok(diffs.includes(`}).catch(onUnexpectedError);`));
		assert.ok(!diffs.includes(`}).catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.strictEqual(countDoubleChains(model), 0);
		assert.strictEqual(countDoubleChains(diffs), 0);

		assert.ok(input.includes('override async resolve(): Promise<IMergeEditorInputModel> {'));
		assert.ok(mergeEditor.includes('const inputModel = await input.resolve();'));
		assert.ok(!input.includes(`this.resolve()${doubleCatch}`));
		assert.ok(!mergeEditor.includes(`input.resolve()${doubleCatch}`));
		assert.ok(input.includes('return this._inputModel?.revert(options);'));
		assert.ok(!input.includes(`return this._inputModel?.revert(options)${doubleCatch}`));
		assert.ok(commands.includes('return this.runWithMergeEditor({'));
		assert.ok(!commands.includes(`return this.runWithMergeEditor({}${doubleCatch}`));
		assert.ok(commands.includes('run(accessor: ServicesAccessor): void {'));
		assert.ok(!commands.includes(`run(accessor: ServicesAccessor)${doubleCatch}`));

		for (const source of [commands, model, diffs, mergeEditor, input, inputModel, dev, electronDev]) {
			assert.strictEqual(countDoubleChains(source), 0);
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
