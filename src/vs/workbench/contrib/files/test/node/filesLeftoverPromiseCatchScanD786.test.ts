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
const TEXTFILES_REL = 'src/vs/workbench/services/textfile/common/textfiles.ts';
const EDITOR_SVC_REL = 'src/vs/workbench/services/editor/common/editorService.ts';
const EDITOR_GROUPS_REL = 'src/vs/workbench/services/editor/common/editorGroupsService.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/host.ts';
const EXPLORER_IFACE_REL = 'src/vs/workbench/contrib/files/browser/files.ts';
const EXPLORER_SVC_REL = 'src/vs/workbench/contrib/files/browser/explorerService.ts';
const EXPLORER_VIEW_REL = 'src/vs/workbench/contrib/files/browser/views/explorerView.ts';
const EXPLORER_VIEWER_REL = 'src/vs/workbench/contrib/files/browser/views/explorerViewer.ts';
const OPEN_EDITORS_REL = 'src/vs/workbench/contrib/files/browser/views/openEditorsView.ts';
const IMPORT_REL = 'src/vs/workbench/contrib/files/browser/fileImportExport.ts';
const COMMANDS_REL = 'src/vs/workbench/contrib/files/browser/fileCommands.ts';
const ACTIONS_REL = 'src/vs/workbench/contrib/files/browser/fileActions.ts';
const TRACKER_REL = 'src/vs/workbench/contrib/files/browser/editors/textFileEditorTracker.ts';
const TEXT_EDITOR_REL = 'src/vs/workbench/contrib/files/browser/editors/textFileEditor.ts';
const WATCHER_REL = 'src/vs/workbench/contrib/files/browser/workspaceWatcher.ts';

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

const onDidRunOperationCall = 'this.onDidRunOperation(e)';
const selectRevealCall = 'this.select(resource, autoReveal)';
const selectForceCall = "this.explorerService.select(resource, 'force')";
const selectActiveFileCall = 'this.selectActiveFile()';
const selectActiveFileTrueCall = 'this.selectActiveFile(true)';
const refreshCall = 'this.explorerService.refresh()';
const importOpenCall = 'this.editorService.openEditor({ resource: item.resource, options: { pinned: true } })';
const compareOpenCall = `editorService.openEditor({
				original: { resource: globalResourceToCompare },
				modified: { resource: rightResource },
				options: { pinned: true }
			})`;
const dirtyOpenEditorsCall = `this.editorService.openEditors(resources.map(resource => ({
			resource,
			options: { inactive: true, pinned: true, preserveFocus: true }
		})))`;
const replaceEditorsCall = `this.editorService.replaceEditors([{
			editor,
			replacement: { resource: editor.resource, options: { ...editorOptions, override: editorId } }
		}], group)`;
const groupOpenCall = 'group.openEditor(editor, editorOptions)';
const targetGroupOpenCall = 'targetGroup.openEditor(element.editor, options)';
const reloadCall = 'this.hostService.reload()';

const d786Calls: Array<[string, string, number]> = [
	[EXPLORER_SVC_REL, onDidRunOperationCall, 1],
	[EXPLORER_SVC_REL, selectRevealCall, 1],
	[EXPLORER_VIEW_REL, selectForceCall, 1],
	[EXPLORER_VIEW_REL, selectActiveFileCall, 1],
	[EXPLORER_VIEW_REL, selectActiveFileTrueCall, 1],
	[EXPLORER_VIEWER_REL, refreshCall, 1],
	[IMPORT_REL, importOpenCall, 1],
	[COMMANDS_REL, compareOpenCall, 1],
	[TRACKER_REL, dirtyOpenEditorsCall, 1],
	[TEXT_EDITOR_REL, replaceEditorsCall, 1],
	[TEXT_EDITOR_REL, groupOpenCall, 1],
	[OPEN_EDITORS_REL, targetGroupOpenCall, 1],
	[WATCHER_REL, reloadCall, 1],
];

suite('files leftover Promise fire-and-forget catch scan (D786)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers thirteen leftover Promise double-chain sites in files only', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d786Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 13);
		assert.ok(sites >= 4);
	});

	test('files leftover onDidRunOperation / select / selectActiveFile / refresh are Promise double-chain', () => {
		const service = fs.readFileSync(resolveSource(EXPLORER_SVC_REL), 'utf8');
		const view = fs.readFileSync(resolveSource(EXPLORER_VIEW_REL), 'utf8');
		const viewer = fs.readFileSync(resolveSource(EXPLORER_VIEWER_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(EXPLORER_IFACE_REL), 'utf8');

		assertPromiseSignature(service, 'private async onDidRunOperation(e: FileOperationEvent): Promise<void> {');
		assertPromiseSignature(service, 'async select(resource: URI, reveal?: boolean | string): Promise<void> {');
		assertPromiseSignature(iface, 'select(resource: URI, reveal?: boolean | string): Promise<void>;');
		assertPromiseSignature(view, 'private async selectActiveFile(reveal = this._autoReveal): Promise<void> {');
		assertPromiseSignature(iface, 'refresh(): Promise<void>;');

		assert.ok(service.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(view.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(viewer.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));

		assertWrapped(service, onDidRunOperationCall);
		assertWrapped(service, selectRevealCall);
		assertWrapped(view, selectForceCall);
		assertWrapped(view, selectActiveFileCall);
		assertWrapped(view, selectActiveFileTrueCall);
		assertWrapped(viewer, refreshCall);

		assert.ok(!service.includes('this.fileService.onDidRunOperation(e => this.onDidRunOperation(e));'));
		assert.ok(!service.includes('this.select(resource, autoReveal);'));
		assert.ok(!view.includes("this.explorerService.select(resource, 'force');"));
		assert.ok(!view.includes('this.selectActiveFile();'));
		assert.ok(!view.includes('this.selectActiveFile(true);'));
		assert.ok(!viewer.includes('this.explorerService.refresh();'));
	});

	test('files leftover openEditor / openEditors / replaceEditors / reload are Promise double-chain', () => {
		const imported = fs.readFileSync(resolveSource(IMPORT_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		const tracker = fs.readFileSync(resolveSource(TRACKER_REL), 'utf8');
		const textEditor = fs.readFileSync(resolveSource(TEXT_EDITOR_REL), 'utf8');
		const openEditors = fs.readFileSync(resolveSource(OPEN_EDITORS_REL), 'utf8');
		const watcher = fs.readFileSync(resolveSource(WATCHER_REL), 'utf8');
		const editorSvc = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');
		const groups = fs.readFileSync(resolveSource(EDITOR_GROUPS_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');

		assertPromiseSignature(editorSvc, 'openEditor(editor: IResourceEditorInput, group?: PreferredGroup): Promise<IEditorPane | undefined>;');
		assertPromiseSignature(editorSvc, 'openEditors(editors: IUntypedEditorInput[], group?: PreferredGroup, options?: IOpenEditorsOptions): Promise<readonly IEditorPane[]>;');
		assertPromiseSignature(editorSvc, 'replaceEditors(replacements: IUntypedEditorReplacement[], group: IEditorGroup | GroupIdentifier): Promise<void>;');
		assertPromiseSignature(groups, 'openEditor(editor: EditorInput, options?: IEditorOptions): Promise<IEditorPane | undefined>;');
		assertPromiseSignature(host, 'reload(options?: { disableExtensions?: boolean }): Promise<void>;');

		assert.ok(imported.includes("import { canceled, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(commands.includes("import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(tracker.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(textEditor.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(openEditors.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(watcher.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));

		assertWrapped(imported, importOpenCall);
		assertWrapped(commands, compareOpenCall);
		assertWrapped(tracker, dirtyOpenEditorsCall);
		assertWrapped(textEditor, replaceEditorsCall);
		assertWrapped(textEditor, groupOpenCall);
		assertWrapped(openEditors, targetGroupOpenCall);
		assertWrapped(watcher, reloadCall);

		assert.ok(!imported.includes('this.editorService.openEditor({ resource: item.resource, options: { pinned: true } });'));
		assert.ok(!commands.includes(`editorService.openEditor({
				original: { resource: globalResourceToCompare },
				modified: { resource: rightResource },
				options: { pinned: true }
			});`));
		assert.ok(!textEditor.includes('group.openEditor(editor, editorOptions);'));
		assert.ok(!openEditors.includes('targetGroup.openEditor(element.editor, options);'));
		assert.ok(!watcher.includes('run: () => this.hostService.reload()\n'));
	});

	test('opener / Action2.run / two-arg then / assigned then / returned Promise / already-double / Watch / Resolve / Pty / D145 stay skipped', () => {
		const view = fs.readFileSync(resolveSource(EXPLORER_VIEW_REL), 'utf8');
		const viewer = fs.readFileSync(resolveSource(EXPLORER_VIEWER_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(ACTIONS_REL), 'utf8');
		const tracker = fs.readFileSync(resolveSource(TRACKER_REL), 'utf8');
		const watcher = fs.readFileSync(resolveSource(WATCHER_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(EXPLORER_SVC_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const textfiles = fs.readFileSync(resolveSource(TEXTFILES_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assert.ok(files.includes('watch(resource: URI, options?: IWatchOptionsWithoutCorrelation): IDisposable;'));
		assertPromiseSignature(textfiles, 'resolve(resource: URI, options?: ITextFileEditorModelResolveOrCreateOptions): Promise<ITextFileEditorModel>;');

		assert.ok(watcher.includes("run: () => this.openerService.open(URI.parse('https://go.microsoft.com/fwlink/?linkid=867693'))"));
		assert.ok(!watcher.includes(`openerService.open(URI.parse('https://go.microsoft.com/fwlink/?linkid=867693'))${doubleCatch}`));

		assert.ok(view.includes('run(accessor: ServicesAccessor): void {'));
		assert.ok(view.includes('\t\tcommandService.executeCommand(NEW_FILE_COMMAND_ID);\n'));
		assert.ok(!view.includes(`\t\tcommandService.executeCommand(NEW_FILE_COMMAND_ID)${doubleCatch}`));
		assert.ok(view.includes('\t\tcommandService.executeCommand(NEW_FOLDER_COMMAND_ID);\n'));
		assert.ok(!view.includes(`\t\tcommandService.executeCommand(NEW_FOLDER_COMMAND_ID)${doubleCatch}`));

		assert.ok(actions.includes('override async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(actions.includes(`					editorService.openEditor({
						original: { resource: activeResource },
						modified: { resource: resource },
						options: { pinned: true }
					});`));
		assert.ok(!actions.includes(`editorService.openEditor({
						original: { resource: activeResource },
						modified: { resource: resource },
						options: { pinned: true }
					})${doubleCatch}`));
		assert.ok(actions.includes('commandService.executeCommand(REVEAL_IN_EXPLORER_COMMAND_ID, resource);'));
		assert.ok(!actions.includes(`commandService.executeCommand(REVEAL_IN_EXPLORER_COMMAND_ID, resource)${doubleCatch}`));

		assert.ok(commands.includes('return editorService.openEditor({'));
		assert.ok(commands.includes('return editorService.openEditor({ resource: uri, options: { override: EditorResolution.PICK, source: EditorOpenSource.USER } });'));
		assert.ok(!commands.includes(`return editorService.openEditor({ resource: uri, options: { override: EditorResolution.PICK, source: EditorOpenSource.USER } })${doubleCatch}`));
		assert.ok(actions.includes('return this.commandService.executeCommand(SAVE_ALL_IN_GROUP_COMMAND_ID, {}, context);'));
		assert.ok(!actions.includes(`return this.commandService.executeCommand(SAVE_ALL_IN_GROUP_COMMAND_ID, {}, context)${doubleCatch}`));

		assert.ok(view.includes('const promise = this.setTreeInputPromise = this.tree.setInput(input, viewState).then(async () => {'));
		assert.ok(!view.includes(`this.tree.setInput(input, viewState).then(async () => {${doubleCatch}`));
		assert.ok(viewer.includes('const promise = children.then('));
		assert.ok(!viewer.includes(`children.then(${doubleCatch}`));

		assert.ok(service.includes('void this.view?.setTreeInput()?.catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(service.includes('void this.refresh(false).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(view.includes('void this.commandService.executeCommand(NEW_FILE_COMMAND_ID).catch(onUnexpectedError).catch(onUnexpectedError);'));

		assert.ok(watcher.includes('disposables.add(this.fileService.watch(pathToWatch, { recursive: true, excludes }));'));
		assert.ok(!watcher.includes(`fileService.watch(pathToWatch, { recursive: true, excludes })${doubleCatch}`));
		assert.ok(tracker.includes(').forEach(model => this.textFileService.files.resolve(model.resource, { reload: { async: true } }));'));
		assert.ok(!tracker.includes(`files.resolve(model.resource, { reload: { async: true } })${doubleCatch}`));

		for (const source of [service, view, viewer, commands, actions, tracker, watcher]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
