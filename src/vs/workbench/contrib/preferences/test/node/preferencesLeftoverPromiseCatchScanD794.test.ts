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
const CONFIG_REL = 'src/vs/platform/configuration/common/configuration.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const FILES_REL = 'src/vs/platform/files/common/files.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const PREFERENCES_IFACE_REL = 'src/vs/workbench/services/preferences/common/preferences.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const RENDERERS_REL = 'src/vs/workbench/contrib/preferences/browser/preferencesRenderers.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/preferences/browser/preferences.contribution.ts';
const ACTIONS_REL = 'src/vs/workbench/contrib/preferences/browser/preferencesActions.ts';
const TREE_REL = 'src/vs/workbench/contrib/preferences/browser/settingsTree.ts';
const KEYBINDINGS_EDITOR_REL = 'src/vs/workbench/contrib/preferences/browser/keybindingsEditor.ts';
const KEYBINDINGS_CONTRIB_REL = 'src/vs/workbench/contrib/preferences/browser/keybindingsEditorContribution.ts';
const LAYOUT_PICKER_REL = 'src/vs/workbench/contrib/preferences/browser/keyboardLayoutPicker.ts';
const SERVICE_REL = 'src/vs/workbench/services/preferences/browser/preferencesService.ts';

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

const clickThenCall = `p.then(() => {
				this.onDidClickSetting(evt, true);
			})`;
const updateThenCall = `.then(() => this.onSettingUpdated(source))`;
const registeredThenCall = `this.extensionService.whenInstalledExtensionsRegistered()
			.then(() => {
				const remoteAuthority = this.environmentService.remoteAuthority;
				const hostLabel = this.labelService.getHostLabel(Schemas.vscodeRemote, remoteAuthority) || remoteAuthority;
				this._register(registerAction2(class extends Action2 {
					constructor() {
						super({
							id: 'workbench.action.openRemoteSettings',
							title: nls.localize2('openRemoteSettings', "Open Remote Settings ({0})", hostLabel),
							category,
							menu: {
								id: MenuId.CommandPalette,
								when: RemoteNameContext.notEqualsTo('')
							}
						});
					}
					run(accessor: ServicesAccessor, args?: IOpenSettingsActionOptions) {
						args = sanitizeOpenSettingsArgs(args);
						return accessor.get(IPreferencesService).openRemoteSettings(args);
					}
				}));
				this._register(registerAction2(class extends Action2 {
					constructor() {
						super({
							id: 'workbench.action.openRemoteSettingsFile',
							title: nls.localize2('openRemoteSettingsJSON', "Open Remote Settings (JSON) ({0})", hostLabel),
							category,
							menu: {
								id: MenuId.CommandPalette,
								when: RemoteNameContext.notEqualsTo('')
							}
						});
					}
					run(accessor: ServicesAccessor, args?: IOpenSettingsActionOptions) {
						args = sanitizeOpenSettingsArgs(args);
						return accessor.get(IPreferencesService).openRemoteSettings({ jsonEditor: true, ...args });
					}
				}));
			})`;
const openRemoteCall = 'this.open(environment.settingsPath, options)';
const openSettingsBareCall = 'this.openSettings()';
const openSettingsOptionsCall = 'this.openSettings(openSettingsOptions)';

const d794Calls: Array<[string, string, number]> = [
	[SETTINGS_REL, clickThenCall, 1],
	[RENDERERS_REL, updateThenCall, 1],
	[CONTRIB_REL, registeredThenCall, 1],
	[SERVICE_REL, openRemoteCall, 1],
	[SERVICE_REL, openSettingsBareCall, 1],
	[SERVICE_REL, openSettingsOptionsCall, 1],
];

suite('preferences leftover remaining overflowed to services/preferences leftover remaining catch scan (D794)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('preferences leftover remaining has fewer than four legal sites so this knife moved to services/preferences leftover remaining', () => {
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const renderers = fs.readFileSync(resolveSource(RENDERERS_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const tree = fs.readFileSync(resolveSource(TREE_REL), 'utf8');
		const contribLegal =
			countIncludes(settings, `${clickThenCall}${doubleCatch}`) +
			countIncludes(renderers, `${updateThenCall}${doubleCatch}`) +
			countIncludes(contrib, `${registeredThenCall}${doubleCatch}`);
		assert.ok(contribLegal < 4, `expected preferences legal leftover <4, got ${contribLegal}`);
		assert.strictEqual(contribLegal, 3);
		assert.ok(tree.includes('this._openerService.open(content, { allowCommands: true }).catch(onUnexpectedError);'));
		assert.ok(tree.includes('this._openerService.open(content).catch(onUnexpectedError);'));
		assert.ok(!tree.includes(`this._openerService.open(content, { allowCommands: true })${doubleCatch}`));
		assert.ok(!tree.includes(`this._openerService.open(content)${doubleCatch}`));
	});

	test('this knife covers six leftover Promise double-chain sites after preferences leftover remaining overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d794Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 6);
		assert.ok(sites >= 4);
	});

	test('preferences leftover click then / updatePreference then / whenInstalledExtensionsRegistered then are Promise double-chain', () => {
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const renderers = fs.readFileSync(resolveSource(RENDERERS_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const config = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		assertPromiseSignature(settings, 'private async triggerSearch(query: string, expandResults: boolean): Promise<void> {');
		assertPromiseSignature(config, 'updateValue(key: string, value: unknown, overrides: IConfigurationOverrides | IConfigurationUpdateOverrides, target: ConfigurationTarget, options?: IConfigurationUpdateOptions): Promise<void>;');
		assertPromiseSignature(extensions, 'whenInstalledExtensionsRegistered(): Promise<boolean>;');
		assert.ok(settings.includes("import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(renderers.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(contrib.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(settings, clickThenCall);
		assertWrapped(renderers, updateThenCall);
		assertWrapped(contrib, registeredThenCall);
		assert.ok(settings.includes(`this.onConfigUpdate(undefined, true).then(() => {`));
		assert.ok(settings.includes(`})${doubleCatch};`));
		assert.ok(settings.includes('this.onConfigUpdate(undefined, true, true);'));
		assert.ok(!settings.includes(`this.onConfigUpdate(undefined, true, true)${doubleCatch}`));
	});

	test('services/preferences leftover remaining open / openSettings fire-and-forget are Promise double-chain', () => {
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(PREFERENCES_IFACE_REL), 'utf8');
		assertPromiseSignature(iface, 'openSettings(options?: IOpenSettingsOptions): Promise<IEditorPane | undefined>;');
		assertPromiseSignature(service, 'private open(settingsResource: URI, options: IOpenSettingsOptions): Promise<IEditorPane | undefined> {');
		assertPromiseSignature(service, 'async openRemoteSettings(options: IOpenSettingsOptions = {}): Promise<IEditorPane | undefined> {');
		assertPromiseSignature(service, 'async handleURL(uri: URI): Promise<boolean> {');
		assert.ok(service.includes("import { getErrorMessage, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(service, openRemoteCall);
		assertWrapped(service, openSettingsBareCall);
		assertWrapped(service, openSettingsOptionsCall);
		assert.ok(service.includes('await this.openSettings({ focusSearch: false });'));
		assert.ok(!service.includes(`await this.openSettings({ focusSearch: false })${doubleCatch}`));
		assert.ok(service.includes('return this.open(this.userSettingsResource, options);'));
		assert.ok(!service.includes(`return this.open(this.userSettingsResource, options)${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Watch / Resolve / Pty / Connect / D145 stay skipped', () => {
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const renderers = fs.readFileSync(resolveSource(RENDERERS_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(ACTIONS_REL), 'utf8');
		const tree = fs.readFileSync(resolveSource(TREE_REL), 'utf8');
		const keybindingsEditor = fs.readFileSync(resolveSource(KEYBINDINGS_EDITOR_REL), 'utf8');
		const keybindingsContrib = fs.readFileSync(resolveSource(KEYBINDINGS_CONTRIB_REL), 'utf8');
		const layoutPicker = fs.readFileSync(resolveSource(LAYOUT_PICKER_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assert.ok(files.includes('watch(resource: URI, options?: IWatchOptionsWithoutCorrelation): IDisposable;'));
		assertPromiseSignature(files, 'resolve(resource: URI, options?: IResolveFileOptions): Promise<IFileStat>;');

		assert.ok(tree.includes('this._openerService.open(content, { allowCommands: true }).catch(onUnexpectedError);'));
		assert.ok(tree.includes('this._openerService.open(content).catch(onUnexpectedError);'));
		assert.ok(!tree.includes(`this._openerService.open(content, { allowCommands: true })${doubleCatch}`));
		assert.ok(!tree.includes(`this._openerService.open(content)${doubleCatch}`));

		assert.ok(keybindingsContrib.includes('this._defineWidget.start().then(keybinding => this._onAccepted(keybinding)).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(settings.includes('return this.doAiSearch(query, token).then((results) => {'));
		assert.ok(!settings.includes(`return this.doAiSearch(query, token).then((results) => {}${doubleCatch}`));
		assert.ok(settings.includes('return this.configurationService.updateValue(key, value, overrides, configurationTarget, { handleDirtyFile: \'save\' })'));
		assert.ok(tree.includes('return Promise.all(processPromises).then(() => {'));
		assert.ok(!tree.includes(`return Promise.all(processPromises).then(() => {}${doubleCatch}`));
		assert.ok(keybindingsEditor.includes('return super.setInput(input, options, context, token)'));
		assert.ok(keybindingsEditor.includes('.then(() => this.render(!!(options && options.preserveFocus)));'));
		assert.ok(!keybindingsEditor.includes(`.then(() => this.render(!!(options && options.preserveFocus)))${doubleCatch}`));
		assert.ok(actions.includes('await this.quickInputService.pick(picks, { placeHolder: nls.localize(\'pickLanguage\', "Select Language") })'));
		assert.ok(!actions.includes(doubleCatch));
		assert.ok(layoutPicker.includes('await fileService.stat(file).then(undefined, () => {'));
		assert.ok(!layoutPicker.includes(`fileService.stat(file).then(undefined, () => {}${doubleCatch}`));
		assert.ok(contrib.includes('run(accessor: ServicesAccessor, args?: IOpenSettingsActionOptions) {'));
		assert.ok(contrib.includes('return accessor.get(IPreferencesService).openRemoteSettings(args);'));
		assert.ok(!contrib.includes(`return accessor.get(IPreferencesService).openRemoteSettings(args)${doubleCatch}`));

		for (const source of [settings, renderers, contrib, actions, tree, keybindingsEditor, keybindingsContrib, layoutPicker, service]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
