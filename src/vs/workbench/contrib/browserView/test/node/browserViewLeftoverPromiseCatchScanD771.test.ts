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
const BROWSER_VIEW_REL = 'src/vs/workbench/contrib/browserView/common/browserView.ts';
const EDITOR_INPUT_REL = 'src/vs/workbench/contrib/browserView/common/browserEditorInput.ts';
const PLATFORM_BROWSER_REL = 'src/vs/platform/browserView/common/browserView.ts';
const LAYOUT_REL = 'src/vs/platform/layout/browser/layoutService.ts';
const GROUPS_REL = 'src/vs/workbench/services/editor/common/editorGroupsService.ts';
const PREFERENCES_REL = 'src/vs/workbench/services/preferences/common/preferences.ts';
const EDITOR_SERVICE_REL = 'src/vs/workbench/services/editor/common/editorService.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const HISTORY_REL = 'src/vs/workbench/contrib/browserView/electron-browser/features/browserHistoryFeature.ts';
const PERMISSIONS_REL = 'src/vs/workbench/contrib/browserView/electron-browser/features/browserPermissionsFeature.ts';
const URLBAR_REL = 'src/vs/workbench/contrib/browserView/electron-browser/widgets/browserUrlBarWidget.ts';
const EDITOR_REL = 'src/vs/workbench/contrib/browserView/electron-browser/browserEditor.ts';
const WORKBENCH_REL = 'src/vs/workbench/contrib/browserView/electron-browser/browserViewWorkbenchService.ts';
const NAV_REL = 'src/vs/workbench/contrib/browserView/electron-browser/features/browserNavigationFeatures.ts';
const CHAT_REL = 'src/vs/workbench/contrib/browserView/electron-browser/features/browserEditorChatFeatures.ts';
const EMULATION_REL = 'src/vs/workbench/contrib/browserView/electron-browser/features/browserEditorEmulationFeatures.ts';
const FIND_REL = 'src/vs/workbench/contrib/browserView/electron-browser/features/browserEditorFindFeature.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/browserView/electron-browser/browserView.contribution.ts';
const TOOLS_REL = 'src/vs/workbench/contrib/browserView/electron-browser/tools/browserTools.contribution.ts';
const RELOAD_REL = 'src/vs/workbench/contrib/browserView/electron-browser/features/browserAutoReloadFeatures.ts';
const WEBCONTENTS_REL = 'src/vs/workbench/contrib/browserView/electron-browser/features/webContentsViewRendererFeature.ts';

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
	assert.ok(signature.includes('Promise<') || signature.includes('async ') || signature.includes('PromiseLike'));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

function countWrapped(source: string, call: string): number {
	return (source.match(new RegExp(`${call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${doubleCatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) ?? []).length;
}

const deleteHistoryBare = 'void model.deleteHistory()';
const deleteHistoryDay = 'void model.deleteHistory((separator as HistorySeparator).entryIds)';
const deleteHistoryItem = 'void model.deleteHistory([item.entryId])';
const requestPermission = 'void this._onDidRequestPermission(e.origin, e.category)';
const setPermissionsResult = 'void model.setPermissions(origin, [{ category, state: result }])';
const setPermissionsNull = 'void model.setPermissions(origin, [{ category, state: null }])';
const selectDevice = 'void model.selectDevice(request.requestId, deviceId)';
const setPermissionsGrants = 'void model.setPermissions(origin, grants)';
const applyDefault = 'void Promise.resolve(defaultItem.apply(input))';
const actionRun = 'void Promise.resolve(action.run(input))';
const applyActive = 'void Promise.resolve(active.apply(input))';
const zoomForce = `void this.setBrowserZoomIndex(
				this.zoomService.getEffectiveZoomIndex(this._zoomHost, this._isEphemeral),
				true
			)`;
const destroyView = 'void this.browserViewService.destroyBrowserView(this.id)';
const closeEditorLike = 'void Promise.resolve(this.group?.closeEditor(this.input))';
const stylesThen = 'whenContainerStylesLoaded.then(() => this.layoutBrowserContainer())';
const modelLayout = `void this._model.layout({
			windowId: this.group.windowId,
			x: wrapperRect.left + left,
			y: wrapperRect.top + top,
			width: layout.width,
			height: layout.height,
			zoomFactor: getZoomFactor(this.window),
			cornerRadius,
			emulation: layout.emulation,
		})`;
const updateWindow = `void this._browserViewService.updateWindowConfiguration(this._mainWindowId, {
			theme: this._getTheme(),
			keybindings: this._getKeybindings(),
			aiFeaturesDisabled: !this.contextKeyService.contextMatchesRules(ChatContextKeys.enabled),
			maxHistoryEntries: this.configurationService.getValue<number>(BrowserMaxHistoryEntriesSettingId),
			proxyInfo: this._remoteProxyInfo,
			trustedFileRoots: this._getTrustedFileRoots(),
			trustAllFiles: !this.workspaceTrustEnablementService.isWorkspaceTrustEnabled(),
		})`;
const openSettings = 'void this._preferencesService.openSettings({ query: `@id:${BrowserSearchEngineSettingId}` })';
const toggleShare = 'void this._toggleShareWithAgent()';
const toggleSelection = 'void this.editor.model.toggleElementSelection(false)';
const commentsPending = 'void browserModel.setElementComments({ comments, pendingCommentIdsToDiscard })';
const commentsEmpty = 'void browserModel.setElementComments({ comments: [] })';
const areaOff = 'void model.toggleAreaSelection(false)';
const areaOn = 'void model.toggleAreaSelection(true)';
const deviceWH = 'void model.setDevice({ ...device, width, height })';
const deviceDpr = 'void model.setDevice({ ...device, deviceScaleFactor: next })';
const deviceLast = 'void model.setDevice({ ...lastSettings.device })';
const deviceOff = 'void Promise.resolve(model?.setDevice(undefined))';
const devicePreset = 'void model.setDevice(preset.device ?? {})';
const deviceEmpty = 'void model.setDevice({})';
const deviceUA = 'void model.setDevice({ ...(device ?? {}), userAgent: next })';
const deviceSwap = 'void model.setDevice({ ...device, width: device.height, height: device.width })';
const deviceMobile = 'void model.setDevice({ ...(device ?? {}), mobile: !device?.mobile })';
const deviceDragW = 'void Promise.resolve(this.editor.model?.setDevice({ ...device, width: Math.max(50, Math.round(w / drag.scale)) }))';
const deviceDragH = 'void Promise.resolve(this.editor.model?.setDevice({ ...device, height: Math.max(50, Math.round(h / drag.scale)) }))';
const deviceReset = `void model.setDevice(axis === 'x'
			? { ...device, width: undefined }
			: { ...device, height: undefined })`;

const d771Calls: Array<[string, string, number]> = [
	[HISTORY_REL, deleteHistoryBare, 1],
	[HISTORY_REL, deleteHistoryDay, 1],
	[HISTORY_REL, deleteHistoryItem, 1],
	[PERMISSIONS_REL, requestPermission, 1],
	[PERMISSIONS_REL, setPermissionsResult, 1],
	[PERMISSIONS_REL, setPermissionsNull, 1],
	[PERMISSIONS_REL, selectDevice, 1],
	[PERMISSIONS_REL, setPermissionsGrants, 1],
	[URLBAR_REL, applyDefault, 1],
	[URLBAR_REL, actionRun, 3],
	[URLBAR_REL, applyActive, 1],
	[BROWSER_VIEW_REL, zoomForce, 1],
	[BROWSER_VIEW_REL, destroyView, 1],
	[EDITOR_REL, closeEditorLike, 1],
	[EDITOR_REL, stylesThen, 1],
	[EDITOR_REL, modelLayout, 1],
	[WORKBENCH_REL, updateWindow, 1],
	[NAV_REL, openSettings, 1],
	[CHAT_REL, toggleShare, 1],
	[CHAT_REL, toggleSelection, 1],
	[CHAT_REL, commentsPending, 1],
	[CHAT_REL, commentsEmpty, 1],
	[CHAT_REL, areaOff, 1],
	[CHAT_REL, areaOn, 1],
	[EMULATION_REL, deviceWH, 1],
	[EMULATION_REL, deviceDpr, 1],
	[EMULATION_REL, deviceLast, 1],
	[EMULATION_REL, deviceOff, 1],
	[EMULATION_REL, devicePreset, 1],
	[EMULATION_REL, deviceEmpty, 1],
	[EMULATION_REL, deviceUA, 1],
	[EMULATION_REL, deviceSwap, 1],
	[EMULATION_REL, deviceMobile, 1],
	[EMULATION_REL, deviceDragW, 1],
	[EMULATION_REL, deviceDragH, 1],
	[EMULATION_REL, deviceReset, 1],
];

suite('browserView leftover remaining Promise fire-and-forget catch scan (D771)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers thirty-eight leftover Promise double-chain sites', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d771Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countWrapped(source, call);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 38);
		assert.ok(sites >= 4);
	});

	test('leftover deleteHistory / permission / Promise.resolve fire-and-forgets are Promise double-chain', () => {
		const history = fs.readFileSync(resolveSource(HISTORY_REL), 'utf8');
		const permissions = fs.readFileSync(resolveSource(PERMISSIONS_REL), 'utf8');
		const urlbar = fs.readFileSync(resolveSource(URLBAR_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(BROWSER_VIEW_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		assertPromiseSignature(model, 'deleteHistory(entryIds?: readonly number[]): Promise<void>;');
		assertPromiseSignature(model, 'setPermissions(origin: string, grants: readonly IPermissionCategoryState[]): Promise<void>;');
		assertPromiseSignature(model, 'selectDevice(requestId: string, deviceId: string | null): Promise<void>;');
		assertPromiseSignature(permissions, 'private async _onDidRequestPermission(origin: string, category: PermissionCategory): Promise<void> {');
		assertPromiseSignature(editor, 'apply(input: BrowserEditorInput): void | Promise<void>;');
		assertPromiseSignature(editor, 'run(input: BrowserEditorInput): void | Promise<void>;');
		assert.ok(history.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(permissions.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(urlbar.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assertWrapped(history, deleteHistoryBare);
		assertWrapped(history, deleteHistoryDay);
		assertWrapped(history, deleteHistoryItem);
		assertWrapped(permissions, requestPermission);
		assertWrapped(permissions, setPermissionsResult);
		assertWrapped(permissions, setPermissionsNull);
		assertWrapped(permissions, selectDevice);
		assertWrapped(permissions, setPermissionsGrants);
		assertWrapped(urlbar, applyDefault);
		assert.strictEqual(countWrapped(urlbar, actionRun), 3);
		assertWrapped(urlbar, applyActive);
	});

	test('leftover zoom / destroy / layout / styles then / updateWindow / openSettings fire-and-forgets are Promise double-chain', () => {
		const model = fs.readFileSync(resolveSource(BROWSER_VIEW_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_REL), 'utf8');
		const nav = fs.readFileSync(resolveSource(NAV_REL), 'utf8');
		const platform = fs.readFileSync(resolveSource(PLATFORM_BROWSER_REL), 'utf8');
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const groups = fs.readFileSync(resolveSource(GROUPS_REL), 'utf8');
		const preferences = fs.readFileSync(resolveSource(PREFERENCES_REL), 'utf8');
		assertPromiseSignature(model, 'private async setBrowserZoomIndex(zoomIndex: number, forceApply = false): Promise<void> {');
		assertPromiseSignature(platform, 'destroyBrowserView(id: string): Promise<void>;');
		assertPromiseSignature(platform, 'updateWindowConfiguration(windowId: number, config: IBrowserViewWindowConfiguration): Promise<void>;');
		assertPromiseSignature(model, 'layout(bounds: IBrowserViewBounds): Promise<void>;');
		assertPromiseSignature(layout, 'whenContainerStylesLoaded(window: Window): Promise<void> | undefined;');
		assertPromiseSignature(groups, 'closeEditor(editor?: EditorInput, options?: ICloseEditorOptions): Promise<boolean>;');
		assertPromiseSignature(preferences, 'openSettings(options?: IOpenSettingsOptions): Promise<IEditorPane | undefined>;');
		assert.ok(model.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(editor.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(workbench.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(nav.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assertWrapped(model, zoomForce);
		assertWrapped(model, destroyView);
		assertWrapped(editor, closeEditorLike);
		assertWrapped(editor, stylesThen);
		assertWrapped(editor, modelLayout);
		assertWrapped(workbench, updateWindow);
		assertWrapped(nav, openSettings);
	});

	test('leftover share / comments / area / setDevice fire-and-forgets are Promise double-chain', () => {
		const chat = fs.readFileSync(resolveSource(CHAT_REL), 'utf8');
		const emulation = fs.readFileSync(resolveSource(EMULATION_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(BROWSER_VIEW_REL), 'utf8');
		assertPromiseSignature(chat, 'private async _toggleShareWithAgent(): Promise<void> {');
		assertPromiseSignature(model, 'toggleElementSelection(enabled?: boolean, options?: IBrowserElementSelectionOptions): Promise<void>;');
		assertPromiseSignature(model, 'setElementComments(update: IBrowserElementCommentsUpdate): Promise<void>;');
		assertPromiseSignature(model, 'toggleAreaSelection(enabled?: boolean): Promise<void>;');
		assertPromiseSignature(model, 'setDevice(device: IBrowserDeviceProfile | undefined): Promise<void>;');
		assert.ok(chat.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(emulation.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assertWrapped(chat, toggleShare);
		assertWrapped(chat, toggleSelection);
		assertWrapped(chat, commentsPending);
		assertWrapped(chat, commentsEmpty);
		assertWrapped(chat, areaOff);
		assertWrapped(chat, areaOn);
		assertWrapped(emulation, deviceWH);
		assertWrapped(emulation, deviceDpr);
		assertWrapped(emulation, deviceLast);
		assertWrapped(emulation, deviceOff);
		assertWrapped(emulation, devicePreset);
		assertWrapped(emulation, deviceEmpty);
		assertWrapped(emulation, deviceUA);
		assertWrapped(emulation, deviceSwap);
		assertWrapped(emulation, deviceMobile);
		assertWrapped(emulation, deviceDragW);
		assertWrapped(emulation, deviceDragH);
		assertWrapped(emulation, deviceReset);
	});

	test('opener / D145 / Action2.run / assigned then / two-arg then / loadURL / Resolve / already-double stay skipped', () => {
		const history = fs.readFileSync(resolveSource(HISTORY_REL), 'utf8');
		const urlbar = fs.readFileSync(resolveSource(URLBAR_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(BROWSER_VIEW_REL), 'utf8');
		const input = fs.readFileSync(resolveSource(EDITOR_INPUT_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_REL), 'utf8');
		const nav = fs.readFileSync(resolveSource(NAV_REL), 'utf8');
		const chat = fs.readFileSync(resolveSource(CHAT_REL), 'utf8');
		const find = fs.readFileSync(resolveSource(FIND_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const tools = fs.readFileSync(resolveSource(TOOLS_REL), 'utf8');
		const reload = fs.readFileSync(resolveSource(RELOAD_REL), 'utf8');
		const webcontents = fs.readFileSync(resolveSource(WEBCONTENTS_REL), 'utf8');
		const editorService = fs.readFileSync(resolveSource(EDITOR_SERVICE_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(model, 'loadURL(url: string, options?: INavigateOptions): Promise<void>;');
		assertPromiseSignature(editorService, 'openEditor(editor: IUntypedEditorInput, group?: PreferredGroup): Promise<IEditorPane | undefined>;');
		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');

		assert.ok(history.includes('void model.loadURL(selected.entryUrl);'));
		assert.ok(!history.includes(`void model.loadURL(selected.entryUrl)${doubleCatch}`));
		assert.ok(input.includes('void this._model.loadURL(destination, options);'));
		assert.ok(!input.includes(`void this._model.loadURL(destination, options)${doubleCatch}`));

		assert.ok(contrib.includes('void browserInput.resolve();'));
		assert.ok(!contrib.includes(`void browserInput.resolve()${doubleCatch}`));

		assert.ok(workbench.includes('void this.editorService.openEditor(view, editorOptions, group);'));
		assert.ok(!workbench.includes(`void this.editorService.openEditor(view, editorOptions, group)${doubleCatch}`));
		assert.ok(nav.includes('await openerService.open(url, {'));
		assert.ok(!nav.includes(`openerService.open(url, {${doubleCatch}`));

		assert.ok(urlbar.includes('void provider.getSuggestions({ text: currentValue, input }, cts.token).then('));
		assert.ok(urlbar.includes('() => { /* keep prior cached suggestions on error */ }'));
		assert.ok(!urlbar.includes(`void provider.getSuggestions({ text: currentValue, input }, cts.token).then(${doubleCatch}`));

		assert.ok(workbench.includes('this._dedicatedWindowGroupPromise = this.editorGroupsService.createAuxiliaryEditorPart()'));
		assert.ok(workbench.includes('.then(part => {'));
		assert.ok(!workbench.includes(`createAuxiliaryEditorPart()${doubleCatch}`));

		assert.ok(find.includes('run(accessor: ServicesAccessor, browserEditor = accessor.get(IEditorService).activeEditorPane): void {'));
		assert.ok(find.includes('void browserEditor.getContribution(BrowserEditorFindContribution)?.showFind();'));
		assert.ok(!find.includes(`void browserEditor.getContribution(BrowserEditorFindContribution)?.showFind()${doubleCatch}`));
		assert.ok(chat.includes('void model.toggleElementSelection(!isActiveMode, { ...options, continuous: false, mode: BrowserElementSelectionMode.Select });'));
		assert.ok(!chat.includes(`void model.toggleElementSelection(!isActiveMode, { ...options, continuous: false, mode: BrowserElementSelectionMode.Select })${doubleCatch}`));
		assert.ok(chat.includes('void model.toggleElementSelection(!isActiveMode, { ...options, continuous: true, mode: BrowserElementSelectionMode.Comment });'));
		assert.ok(!chat.includes(`void model.toggleElementSelection(!isActiveMode, { ...options, continuous: true, mode: BrowserElementSelectionMode.Comment })${doubleCatch}`));
		assert.ok(chat.includes('void browserEditor.model?.toggleElementSelection(false);'));
		assert.ok(!chat.includes(`void browserEditor.model?.toggleElementSelection(false)${doubleCatch}`));

		assert.ok(model.includes('void this.setBrowserZoomIndex(effectiveZoomIndex).catch(e => {'));
		assert.ok(!model.includes(`void this.setBrowserZoomIndex(effectiveZoomIndex)${doubleCatch}`));
		assert.ok(workbench.includes('void this._initializeExistingViews().catch(e => {'));
		assert.ok(!workbench.includes(`void this._initializeExistingViews()${doubleCatch}`));
		assert.ok(tools.includes('void this.playwrightService.disposeSession(resource.toString()).catch(() => { });'));
		assert.ok(!tools.includes(`void this.playwrightService.disposeSession(resource.toString())${doubleCatch}`));

		assert.ok(reload.includes(`this._model.reload()${doubleCatch};`));
		assert.ok(webcontents.includes(`void this._doScreenshot()${doubleCatch}`));
		assert.ok(history.includes('run: () => model.deleteHistory([entry.id]),'));
		assert.ok(!history.includes(`run: () => model.deleteHistory([entry.id])${doubleCatch}`));
	});

	test('Connect / Watch / Resolve / Pty / invented proto stay skipped', () => {
		const files = [HISTORY_REL, PERMISSIONS_REL, URLBAR_REL, BROWSER_VIEW_REL, EDITOR_REL, WORKBENCH_REL, NAV_REL, CHAT_REL, EMULATION_REL];
		for (const rel of files) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
