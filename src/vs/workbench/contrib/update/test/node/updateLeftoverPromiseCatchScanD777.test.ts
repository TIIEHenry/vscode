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
const ASYNC_REL = 'src/vs/base/common/async.ts';
const CONFIG_REL = 'src/vs/platform/configuration/common/configuration.ts';
const COMMANDS_REL = 'src/vs/platform/commands/common/commands.ts';
const CLIPBOARD_REL = 'src/vs/platform/clipboard/common/clipboardService.ts';
const DIALOGS_REL = 'src/vs/platform/dialogs/common/dialogs.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/host.ts';
const OUTLINE_IFACE_REL = 'src/vs/workbench/services/outline/browser/outline.ts';
const OUTLINE_PANE_REL = 'src/vs/workbench/contrib/outline/browser/outlinePane.ts';
const OUTLINE_ACTIONS_REL = 'src/vs/workbench/contrib/outline/browser/outlineActions.ts';
const OUTLINE_CONTRIB_REL = 'src/vs/workbench/contrib/outline/browser/outline.contribution.ts';
const OUTLINE_STATE_REL = 'src/vs/workbench/contrib/outline/browser/outlineViewState.ts';
const MARKDOWN_SETTING_REL = 'src/vs/workbench/contrib/markdown/browser/markdownSettingRenderer.ts';
const UPDATE_REL = 'src/vs/workbench/contrib/update/browser/update.ts';
const UPDATE_TITLE_REL = 'src/vs/workbench/contrib/update/browser/updateTitleBarEntry.ts';
const UPDATE_POST_REL = 'src/vs/workbench/contrib/update/browser/postUpdateWidget.ts';
const UPDATE_NOTES_REL = 'src/vs/workbench/contrib/update/browser/releaseNotesEditor.ts';
const UPDATE_TOOLTIP_REL = 'src/vs/workbench/contrib/update/browser/updateTooltip.ts';
const UPDATE_CONTRIB_REL = 'src/vs/workbench/contrib/update/browser/update.contribution.ts';

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

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

function countWrapped(source: string, call: string): number {
	const needle = `${call}${doubleCatch}`;
	return (source.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
}

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

const outlineOpenCall = `void Promise.resolve((async () => {
				const myId = ++idPool;
				const isDoubleClick = e.browserEvent?.type === 'dblclick';
				if (!isDoubleClick) {
					// workaround for https://github.com/microsoft/vscode/issues/206424
					await timeout(150);
					if (myId !== idPool) {
						return;
					}
				}
				await newOutline.reveal(e.element, e.editorOptions, e.sideBySide, isDoubleClick);
			})())`;
const onStateChangeCall = 'this.onStateChange()';
const onStateChangeStartup = 'void this.onStateChange(true)';
const tryShowCall = 'void this.tryShowOnStartup()';
const executePostCall = 'void this.commandService.executeCommand(commandId, ...(args ?? []))';
const onUpdateStateCall = 'this.onUpdateStateChange(this.updateService.state)';
const dialogInfoCall = `this.dialogService.info(nls.localize('noUpdatesAvailable', "There are currently no updates available."))`;
const invokeShowCall = 'this.instantiationService.invokeFunction(accessor => showReleaseNotes(accessor, productVersion))';
const queueOrgCall = 'this.throttler.queue(() => this.updateService.setInternalOrg(this.#internalOrg))';
const queueRefreshCall = 'this.throttler.queue(() => this.doRefresh())';
const updateValueCall = `this._configurationService.updateValue('update.showReleaseNotes', e.message.value)`;
const updateSettingCall = 'this._simpleSettingRenderer.updateSetting(URI.parse(e.message.value.uri), x, y)';
const writeTextCall = 'this.clipboardService.writeText(copyValue.value)';
const executeTooltipCall = 'this.commandService.executeCommand(command, ...args)';

const d770Calls: Array<[string, string, number]> = [
	[OUTLINE_PANE_REL, outlineOpenCall, 1],
	[UPDATE_TITLE_REL, onStateChangeCall, 2],
	[UPDATE_TITLE_REL, onStateChangeStartup, 1],
	[UPDATE_POST_REL, tryShowCall, 1],
	[UPDATE_POST_REL, executePostCall, 1],
	[UPDATE_REL, onUpdateStateCall, 1],
	[UPDATE_REL, dialogInfoCall, 1],
	[UPDATE_REL, invokeShowCall, 1],
	[UPDATE_REL, queueOrgCall, 1],
	[UPDATE_REL, queueRefreshCall, 1],
	[UPDATE_NOTES_REL, updateValueCall, 1],
	[UPDATE_NOTES_REL, updateSettingCall, 1],
	[UPDATE_TOOLTIP_REL, writeTextCall, 1],
	[UPDATE_TOOLTIP_REL, executeTooltipCall, 1],
];

suite('outline leftover remaining overflowed to update leftover Promise fire-and-forget catch scan (D777)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('outline leftover remaining has fewer than four legal sites so this knife moved to update leftover remaining', () => {
		const pane = fs.readFileSync(resolveSource(OUTLINE_PANE_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(OUTLINE_ACTIONS_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(OUTLINE_CONTRIB_REL), 'utf8');
		const state = fs.readFileSync(resolveSource(OUTLINE_STATE_REL), 'utf8');
		assert.ok(pane.includes(`this._editorControlChangePromise.then(() => {
			super.focus();
			this._tree?.domFocus();
		})${doubleCatch};`));
		assert.ok(pane.includes('this._editorControlChangePromise = this._handleEditorControlChanged(pane);'));
		assert.ok(!pane.includes(`this._editorControlChangePromise = this._handleEditorControlChanged(pane)${doubleCatch}`));
		assert.ok(actions.includes('runInView(_accessor: ServicesAccessor, view: IOutlinePane) {'));
		assert.ok(!actions.includes(doubleCatch));
		assert.ok(!contrib.includes(doubleCatch));
		assert.ok(state.includes('persist(storageService: IStorageService): void {'));
		assert.ok(state.includes('restore(storageService: IStorageService): void {'));
		assert.ok(!state.includes(doubleCatch));
		const outlineLegal = countWrapped(pane, outlineOpenCall);
		assert.ok(outlineLegal < 4, `expected outline legal leftover <4, got ${outlineLegal}`);
		assert.strictEqual(outlineLegal, 1);
		assert.strictEqual(countDoubleChains(pane), 2);
	});

	test('this knife covers fifteen leftover Promise double-chain sites after outline leftover remaining overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d770Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countWrapped(source, call);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 15);
		assert.ok(sites >= 4);
	});

	test('outline leftover onDidOpen PromiseLike reveal is Promise double-chain; assigned handleEditor / already-double focus stay skipped', () => {
		const pane = fs.readFileSync(resolveSource(OUTLINE_PANE_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(OUTLINE_IFACE_REL), 'utf8');
		assertPromiseSignature(iface, 'reveal(entry: E, options: IEditorOptions, sideBySide: boolean, select: boolean): Promise<void> | void;');
		assertPromiseSignature(iface, 'createOutline(editor: IEditorPane, target: OutlineTarget, token: CancellationToken): Promise<IOutline<any> | undefined>;');
		assert.ok(pane.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(pane, outlineOpenCall);
		assert.ok(!pane.includes('this._editorControlDisposables.add(tree.onDidOpen(async e => {'));
		assert.ok(pane.includes(`this._editorControlChangePromise.then(() => {
			super.focus();
			this._tree?.domFocus();
		})${doubleCatch};`));
		assert.ok(pane.includes('this._editorControlChangePromise = this._handleEditorControlChanged(pane);'));
		assert.ok(!pane.includes(`this._editorControlChangePromise = this._handleEditorControlChanged(pane)${doubleCatch}`));
	});

	test('update leftover onStateChange / tryShowOnStartup voids are Promise double-chain; title-bar entry onStateChange stays sync void', () => {
		const title = fs.readFileSync(resolveSource(UPDATE_TITLE_REL), 'utf8');
		const post = fs.readFileSync(resolveSource(UPDATE_POST_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		assertPromiseSignature(title, 'private async onStateChange(startup = false)');
		assertPromiseSignature(post, 'private async tryShowOnStartup()');
		assertPromiseSignature(host, 'hadLastFocus(): Promise<boolean>;');
		assert.ok(title.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(post.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual(countWrapped(title, onStateChangeCall), 2);
		assertWrapped(title, onStateChangeStartup);
		assertWrapped(post, tryShowCall);
		assert.ok(!title.includes('void this.onStateChange(true);'));
		assert.ok(!post.includes('void this.tryShowOnStartup();'));
		assert.ok(title.includes('private onStateChange(state: State) {'));
		assert.ok(title.includes('this.onStateChange(this.updateService.state);'));
		assert.ok(!title.includes(`this.onStateChange(this.updateService.state)${doubleCatch}`));
	});

	test('update leftover onUpdateStateChange / dialog info / invokeFunction / throttler queue are Promise double-chain', () => {
		const update = fs.readFileSync(resolveSource(UPDATE_REL), 'utf8');
		const dialogs = fs.readFileSync(resolveSource(DIALOGS_REL), 'utf8');
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		assertPromiseSignature(update, 'private async onUpdateStateChange(state: UpdateState): Promise<void> {');
		assertPromiseSignature(update, 'async function showReleaseNotes(accessor: ServicesAccessor, version: string)');
		assertPromiseSignature(dialogs, 'info(message: string, detail?: string): Promise<void>;');
		assertPromiseSignature(asyncSource, 'queue<T>(promiseFactory: ICancellableTask<Promise<T>>): Promise<T> {');
		assert.ok(update.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(update, onUpdateStateCall);
		assertWrapped(update, dialogInfoCall);
		assertWrapped(update, invokeShowCall);
		assertWrapped(update, queueOrgCall);
		assertWrapped(update, queueRefreshCall);
		assert.ok(!update.includes('this.onUpdateStateChange(this.updateService.state);'));
		assert.ok(!update.includes('this.throttler.queue(() => this.doRefresh());'));
	});

	test('update leftover updateValue / updateSetting / writeText / executeCommand voids are Promise double-chain', () => {
		const notes = fs.readFileSync(resolveSource(UPDATE_NOTES_REL), 'utf8');
		const tooltip = fs.readFileSync(resolveSource(UPDATE_TOOLTIP_REL), 'utf8');
		const post = fs.readFileSync(resolveSource(UPDATE_POST_REL), 'utf8');
		const config = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		const clipboard = fs.readFileSync(resolveSource(CLIPBOARD_REL), 'utf8');
		const setting = fs.readFileSync(resolveSource(MARKDOWN_SETTING_REL), 'utf8');
		assertPromiseSignature(config, 'updateValue(key: string, value: unknown): Promise<void>;');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assertPromiseSignature(clipboard, 'writeText(text: string, type?: string): Promise<void>;');
		assertPromiseSignature(setting, 'async updateSetting(uri: URI, x: number, y: number)');
		assert.ok(notes.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(tooltip.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(notes, updateValueCall);
		assertWrapped(notes, updateSettingCall);
		assertWrapped(tooltip, writeTextCall);
		assertWrapped(tooltip, executeTooltipCall);
		assertWrapped(post, executePostCall);
		assert.ok(!notes.includes(`this._configurationService.updateValue('update.showReleaseNotes', e.message.value);`));
		assert.ok(!tooltip.includes('this.clipboardService.writeText(copyValue.value);'));
		assert.ok(!tooltip.includes('this.commandService.executeCommand(command, ...args);'));
		assert.ok(!post.includes('void this.commandService.executeCommand(commandId, ...(args ?? []));'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Watch / Resolve / Pty / Connect / D145 stay skipped', () => {
		const pane = fs.readFileSync(resolveSource(OUTLINE_PANE_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(OUTLINE_ACTIONS_REL), 'utf8');
		const update = fs.readFileSync(resolveSource(UPDATE_REL), 'utf8');
		const notes = fs.readFileSync(resolveSource(UPDATE_NOTES_REL), 'utf8');
		const title = fs.readFileSync(resolveSource(UPDATE_TITLE_REL), 'utf8');
		const post = fs.readFileSync(resolveSource(UPDATE_POST_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(UPDATE_CONTRIB_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');

		assert.ok(update.includes(`hostService.hadLastFocus().then(async hadLastFocus => {`));
		assert.ok(update.includes(`		})${doubleCatch};`));
		assert.ok(update.includes('showReleaseNotesInEditor(instantiationService, productService.version, false)\n\t\t\t\t\t.then(undefined, () => {'));
		assert.ok(!update.includes(`showReleaseNotesInEditor(instantiationService, productService.version, false)${doubleCatch}`));
		assert.ok(update.includes('openerService.open(uri);'));
		assert.ok(!update.includes('openerService.open(uri).catch'));
		assert.ok(update.includes('return showReleaseNotesManager.show(version, useCurrentFile);') || update.includes('return releaseNotesManager.show(version, useCurrentFile);'));
		assert.ok(!update.includes(`return releaseNotesManager.show(version, useCurrentFile)${doubleCatch}`));
		assert.ok(update.includes('this._register(updateService.onStateChange(this.onUpdateStateChange, this));'));
		assert.ok(!update.includes(`this._register(updateService.onStateChange(this.onUpdateStateChange, this)${doubleCatch}`));

		assert.ok(notes.includes('.then(undefined, onUnexpectedError);'));
		assert.ok(!notes.includes(`.then(undefined, onUnexpectedError)${doubleCatch}`));
		assert.ok(notes.includes('return this.updateHtml();'));
		assert.ok(!notes.includes(`return this.updateHtml()${doubleCatch}`));

		assert.ok(contrib.includes('async run(accessor: ServicesAccessor, version?: string): Promise<void> {'));
		assert.ok(contrib.includes('openerService.open(URI.parse(productService.downloadUrl));'));
		assert.ok(!contrib.includes('openerService.open(URI.parse(productService.downloadUrl)).catch'));
		assert.ok(!contrib.includes(doubleCatch));

		assert.ok(title.includes('override async run() { }'));
		assert.ok(title.includes('this.action.run = () => this.runAction();'));
		assert.ok(!title.includes(`this.action.run = () => this.runAction()${doubleCatch}`));

		assert.ok(post.includes('this._register(CommandsRegistry.registerCommand(\'_update.showUpdateInfo\', (_accessor, markdown?: string) => this.showUpdateInfo(markdown)));'));
		assert.ok(!post.includes(`this.showUpdateInfo(markdown)${doubleCatch}`));
		assert.ok(post.includes('openLinkFromMarkdown(this.openerService, link, mdStr.isTrusted);'));
		assert.ok(!post.includes(`openLinkFromMarkdown(this.openerService, link, mdStr.isTrusted)${doubleCatch}`));

		assert.ok(actions.includes('runInView(_accessor: ServicesAccessor, view: IOutlinePane) {'));
		assert.ok(!actions.includes(doubleCatch));
		assert.ok(pane.includes('this._editorControlChangePromise = this._handleEditorControlChanged(pane);'));
		assert.ok(!pane.includes(`this._editorControlChangePromise = this._handleEditorControlChanged(pane)${doubleCatch}`));

		for (const source of [pane, actions, update, notes, title, post, contrib]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
