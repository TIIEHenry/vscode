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
const EDITORS_REL = 'src/vs/workbench/contrib/customEditor/browser/customEditors.ts';
const MODEL_REL = 'src/vs/workbench/contrib/customEditor/common/customEditorModelManager.ts';
const INPUT_REL = 'src/vs/workbench/contrib/customEditor/browser/customEditorInput.ts';
const DIFF_REL = 'src/vs/workbench/contrib/customEditor/browser/customEditorDiffInput.ts';
const FACTORY_REL = 'src/vs/workbench/contrib/customEditor/browser/customEditorInputFactory.ts';
const TEXT_MODEL_REL = 'src/vs/workbench/contrib/customEditor/common/customTextEditorModel.ts';
const PANEL_REL = 'src/vs/workbench/contrib/webviewPanel/browser/webviewPanel.contribution.ts';
const WEBVIEW_SVC_REL = 'src/vs/workbench/contrib/webviewPanel/browser/webviewWorkbenchService.ts';
const WEBVIEW_EDITOR_REL = 'src/vs/workbench/contrib/webviewPanel/browser/webviewEditor.ts';
const WEBVIEW_COMMANDS_REL = 'src/vs/workbench/contrib/webviewPanel/browser/webviewCommands.ts';
const EDITOR_SVC_REL = 'src/vs/workbench/services/editor/common/editorService.ts';
const GROUPS_REL = 'src/vs/workbench/services/editor/common/editorGroupsService.ts';

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

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const updateCall = 'void this.updateCustomDiffEditorsForDiffConfigurationChange(e)';
const movedCall = 'this.handleMovedFileInOpenedFileEditors(e.resource, this.uriIdentityService.asCanonicalUri(e.target.resource))';
const replaceCall = `					options: {
						preserveFocus: true,
					}
				};
			}), group)`;
const closeCall = 'previousGroup.closeEditor(editor)';

const d768Calls: Array<[string, string, number]> = [
	[EDITORS_REL, updateCall, 1],
	[EDITORS_REL, movedCall, 1],
	[EDITORS_REL, replaceCall, 1],
	[PANEL_REL, closeCall, 1],
];

suite('customEditor leftover remaining overflowed to webviewPanel leftover Promise fire-and-forget catch scan (D768)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('customEditor leftover remaining has fewer than four legal sites so this knife moved to webviewPanel leftover', () => {
		const editors = fs.readFileSync(resolveSource(EDITORS_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(MODEL_REL), 'utf8');
		const customLegal =
			countIncludes(editors, `${updateCall}${doubleCatch}`) +
			countIncludes(editors, `${movedCall}${doubleCatch}`) +
			countIncludes(editors, `${replaceCall}${doubleCatch}`);
		assert.ok(customLegal < 4, `expected customEditor legal leftover <4, got ${customLegal}`);
		assert.strictEqual(customLegal, 3);
		assert.ok(model.includes('return entry.model.then(model => {'));
		assert.ok(!model.includes(`return entry.model.then(model => {${doubleCatch}`));
		assert.ok(model.includes('entry.model.then(x => x.dispose()).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(model.includes('value.model.then(x => x.dispose()).catch(onUnexpectedError).catch(onUnexpectedError);'));
	});

	test('this knife covers four leftover Promise double-chain sites after customEditor leftover remaining overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d768Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 4);
		assert.ok(sites >= 4);
	});

	test('leftover updateCustomDiffEditors / handleMovedFile / replaceEditors voids are Promise double-chain', () => {
		const editors = fs.readFileSync(resolveSource(EDITORS_REL), 'utf8');
		const editorSvc = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');
		assertPromiseSignature(editors, 'private async updateCustomDiffEditorsForDiffConfigurationChange(e: ITextResourceConfigurationChangeEvent): Promise<void> {');
		assertPromiseSignature(editors, 'private async handleMovedFileInOpenedFileEditors(oldResource: URI, newResource: URI): Promise<void> {');
		assertPromiseSignature(editorSvc, 'replaceEditors(replacements: IUntypedEditorReplacement[], group: IEditorGroup | GroupIdentifier): Promise<void>;');
		assert.ok(editors.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(editors, updateCall);
		assertWrapped(editors, movedCall);
		assertWrapped(editors, replaceCall);
		assert.ok(!editors.includes('void this.updateCustomDiffEditorsForDiffConfigurationChange(e);'));
		assert.ok(!editors.includes('this.handleMovedFileInOpenedFileEditors(e.resource, this.uriIdentityService.asCanonicalUri(e.target.resource));'));
		assert.ok(editors.includes('await this.editorService.replaceEditors(replacements, group);'));
		assert.ok(!editors.includes(`await this.editorService.replaceEditors(replacements, group)${doubleCatch}`));
	});

	test('webviewPanel leftover closeEditor is Promise double-chain', () => {
		const panel = fs.readFileSync(resolveSource(PANEL_REL), 'utf8');
		const groups = fs.readFileSync(resolveSource(GROUPS_REL), 'utf8');
		assertPromiseSignature(groups, 'closeEditor(editor?: EditorInput, options?: ICloseEditorOptions): Promise<boolean>;');
		assert.ok(panel.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(panel, closeCall);
		assert.ok(!panel.includes('previousGroup.closeEditor(editor);'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve stay skipped', () => {
		const editors = fs.readFileSync(resolveSource(EDITORS_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(MODEL_REL), 'utf8');
		const input = fs.readFileSync(resolveSource(INPUT_REL), 'utf8');
		const diff = fs.readFileSync(resolveSource(DIFF_REL), 'utf8');
		const factory = fs.readFileSync(resolveSource(FACTORY_REL), 'utf8');
		const textModel = fs.readFileSync(resolveSource(TEXT_MODEL_REL), 'utf8');
		const panel = fs.readFileSync(resolveSource(PANEL_REL), 'utf8');
		const webviewSvc = fs.readFileSync(resolveSource(WEBVIEW_SVC_REL), 'utf8');
		const webviewEditor = fs.readFileSync(resolveSource(WEBVIEW_EDITOR_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(WEBVIEW_COMMANDS_REL), 'utf8');
		const editorSvc = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');

		assertPromiseSignature(editorSvc, 'openEditor(editor: IUntypedEditorInput, group?: PreferredGroup): Promise<IEditorPane | undefined>;');
		assert.ok(webviewSvc.includes('this._editorService.openEditor(webviewInput, {'));
		assert.ok(webviewSvc.includes('}, showOptions.group);'));
		assert.ok(!webviewSvc.includes('}, showOptions.group).catch'));
		assert.ok(webviewSvc.includes('this._editorService.openEditor(topLevelEditor, {'));
		assert.ok(webviewSvc.includes('}, group);'));
		assert.ok(!webviewSvc.includes('}, group).catch'));

		assert.ok(commands.includes('public run(accessor: ServicesAccessor): void {'));
		assert.ok(commands.includes('public async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(!commands.includes(doubleCatch));

		assert.ok(webviewSvc.includes('this._resolvePromise = createCancelablePromise(token => this._webviewWorkbenchService.resolveWebview(this, token));'));
		assert.ok(!webviewSvc.includes(`this._resolvePromise = createCancelablePromise(token => this._webviewWorkbenchService.resolveWebview(this, token))${doubleCatch}`));
		assert.ok(webviewSvc.includes('reviver.resolveWebview(input, token).then(x => resolve.complete(x), err => resolve.error(err)).finally(() => {'));
		assert.ok(!webviewSvc.includes(`reviver.resolveWebview(input, token).then(x => resolve.complete(x), err => resolve.error(err))${doubleCatch}`));

		assert.ok(model.includes('return entry.model.then(model => {'));
		assert.ok(!model.includes(`return entry.model.then(model => {${doubleCatch}`));
		assert.ok(input.includes('public override async resolve(): Promise<null> {'));
		assert.ok(input.includes('await super.resolve();'));
		assert.ok(!input.includes(`super.resolve()${doubleCatch}`));
		assert.ok(diff.includes('override async resolve(): Promise<null> {'));
		assert.ok(webviewEditor.includes('await input.resolve();'));
		assert.ok(!webviewEditor.includes(`input.resolve()${doubleCatch}`));
		assert.ok(webviewSvc.includes('public async resolveWebview(webview: WebviewInput, token: CancellationToken): Promise<void> {'));
		assert.ok(!webviewSvc.includes(`resolveWebview(webview, token)${doubleCatch}`));
		assert.ok(webviewSvc.includes('return this._revivalPool.enqueueForRestoration(webview, token);'));
		assert.ok(!webviewSvc.includes(`return this._revivalPool.enqueueForRestoration(webview, token)${doubleCatch}`));
		assert.ok(textModel.includes('return this.textFileService.save(this.resource, options);'));
		assert.ok(!textModel.includes(`return this.textFileService.save(this.resource, options)${doubleCatch}`));
		assert.ok(factory.includes('async createEditor(workingCopy: IWorkingCopyIdentifier): Promise<EditorInput> {'));
		assert.ok(!factory.includes(doubleCatch));

		for (const source of [editors, model, input, diff, factory, textModel, panel, webviewSvc, webviewEditor, commands]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
