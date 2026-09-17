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
const THEME_REL = 'src/vs/workbench/services/themes/browser/workbenchThemeService.ts';
const NATIVE_REL = 'src/vs/workbench/services/themes/electron-browser/nativeHostColorSchemeService.ts';
const COLOR_DATA_REL = 'src/vs/workbench/services/themes/common/colorThemeData.ts';
const FILE_ICON_REL = 'src/vs/workbench/services/themes/browser/fileIconThemeData.ts';
const PRODUCT_ICON_REL = 'src/vs/workbench/services/themes/browser/productIconThemeData.ts';
const CSS_REL = 'src/vs/workbench/services/themes/browser/cssExtensionPoint.ts';
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const NATIVE_HOST_REL = 'src/vs/platform/native/common/native.ts';
const CONFIG_REL = 'src/vs/platform/configuration/common/configuration.ts';
const ASYNC_REL = 'src/vs/base/common/async.ts';

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

function assertDoubleThen(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch};`) || source.includes(`${call}${doubleCatch})`) || source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

function countDouble(source: string, call: string): number {
	const escaped = `${call}${doubleCatch}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return (source.match(new RegExp(escaped, 'g')) ?? []).length;
}

const extensionsRegisteredThen = `extensionService.whenInstalledExtensionsRegistered().then(_ => {
			this.installConfigurationListener();
			this.installPreferredSchemeListener();
			this.installRegistryListeners().catch(onUnexpectedError).catch(onUnexpectedError);
			this.initialize(previousColorThemeSetting).catch(onUnexpectedError).catch(onUnexpectedError);
		})`;
const osColorSchemeThen = `this.nativeHostService.getOSColorScheme().then(scheme => this.update(scheme))`;
const initializeCall = `this.initialize(previousColorThemeSetting)`;
const installRegistryCall = `this.installRegistryListeners()`;
const setColorThemeCall = `this.setColorTheme(previousTheme.id, 'auto')`;
const updateValueCall = `this.configurationService.updateValue(key, migrated, target)`;
const restoreColorThemeCall = `this.restoreColorTheme()`;
const restoreFileIconThemeCall = `this.restoreFileIconTheme()`;
const restoreProductIconThemeCall = `this.restoreProductIconTheme()`;
const languageReloadCall = `this.languageService.onDidChange(() => this.reloadCurrentFileIconTheme()`;
const colorWatcherCall = `new ThemeFileWatcher(fileService, environmentService, () => this.reloadCurrentColorTheme()`;
const fileIconWatcherCall = `new ThemeFileWatcher(fileService, environmentService, () => this.reloadCurrentFileIconTheme()`;
const productIconWatcherCall = `new ThemeFileWatcher(fileService, environmentService, () => this.reloadCurrentProductIconTheme()`;

suite('workbench/services/themes leftover Promise fire-and-forget catch scan (D751)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers fourteen leftover Promise double-chain sites', () => {
		const theme = fs.readFileSync(resolveSource(THEME_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const d751 = [
			[theme, extensionsRegisteredThen],
			[theme, initializeCall],
			[native, osColorSchemeThen],
			[theme, installRegistryCall],
			[theme, setColorThemeCall],
			[theme, updateValueCall],
			[theme, restoreFileIconThemeCall],
			[theme, restoreProductIconThemeCall],
			[theme, languageReloadCall],
			[theme, colorWatcherCall],
			[theme, fileIconWatcherCall],
			[theme, productIconWatcherCall],
		] as const;
		assert.strictEqual(d751.length, 12);
		for (const [source, call] of d751) {
			assertDoubleThen(source, call);
		}
		assert.strictEqual(countDouble(theme, restoreColorThemeCall), 2);
		assert.ok(!theme.includes(`${restoreColorThemeCall};`));
		assert.ok(!theme.includes(`${restoreColorThemeCall}.catch(onUnexpectedError);`));
	});

	test('leftover whenInstalledExtensionsRegistered then and initialize single-catch are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(THEME_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		assertPromiseSignature(extensions, 'whenInstalledExtensionsRegistered(): Promise<boolean>;');
		assertPromiseSignature(source, 'private async initialize(themePreviousSettingsId: string | undefined): Promise<[');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, extensionsRegisteredThen);
		assertDoubleThen(source, initializeCall);
		assert.ok(!source.includes('errors.onUnexpectedError'));
	});

	test('leftover getOSColorScheme then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const nativeHost = fs.readFileSync(resolveSource(NATIVE_HOST_REL), 'utf8');
		assertPromiseSignature(nativeHost, 'getOSColorScheme(): Promise<IColorScheme>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, osColorSchemeThen);
	});

	test('leftover installRegistryListeners / setColorTheme / updateValue discarded leftovers are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(THEME_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		assertPromiseSignature(source, 'private installRegistryListeners(): Promise<void> {');
		assertPromiseSignature(source, 'public setColorTheme(themeIdOrTheme: string | undefined | IWorkbenchColorTheme, settingsTarget: ThemeSettingTarget): Promise<IWorkbenchColorTheme | null> {');
		assertPromiseSignature(configuration, 'updateValue(key: string, value: unknown, target: ConfigurationTarget): Promise<void>;');
		assertDoubleThen(source, installRegistryCall);
		assertDoubleThen(source, setColorThemeCall);
		assertDoubleThen(source, updateValueCall);
	});

	test('leftover restoreColorTheme / restoreFileIconTheme / restoreProductIconTheme discarded leftovers are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(THEME_REL), 'utf8');
		assertPromiseSignature(source, 'public async restoreColorTheme(): Promise<boolean> {');
		assertPromiseSignature(source, 'public async restoreFileIconTheme(): Promise<boolean> {');
		assertPromiseSignature(source, 'public async restoreProductIconTheme(): Promise<boolean> {');
		assert.strictEqual(countDouble(source, restoreColorThemeCall), 2);
		assertDoubleThen(source, restoreFileIconThemeCall);
		assertDoubleThen(source, restoreProductIconThemeCall);
	});

	test('leftover ThemeFileWatcher / language reload discarded leftovers are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(THEME_REL), 'utf8');
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		assertPromiseSignature(asyncSource, 'queue(factory: ITask<Promise<T>>): Promise<T>');
		assertPromiseSignature(source, 'private async reloadCurrentFileIconTheme() {');
		assertPromiseSignature(source, 'private async reloadCurrentProductIconTheme() {');
		assert.ok(source.includes('private reloadCurrentColorTheme() {'));
		assertDoubleThen(source, languageReloadCall);
		assertDoubleThen(source, colorWatcherCall);
		assertDoubleThen(source, fileIconWatcherCall);
		assertDoubleThen(source, productIconWatcherCall);
	});

	test('assigned then / two-arg then / opener / D145 / Connect / Watch / Resolve / Pty stay skipped', () => {
		const theme = fs.readFileSync(resolveSource(THEME_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const colorData = fs.readFileSync(resolveSource(COLOR_DATA_REL), 'utf8');
		const fileIcon = fs.readFileSync(resolveSource(FILE_ICON_REL), 'utf8');
		const productIcon = fs.readFileSync(resolveSource(PRODUCT_ICON_REL), 'utf8');
		const css = fs.readFileSync(resolveSource(CSS_REL), 'utf8');
		assert.ok(theme.includes('return Promise.all([this.getColorThemes(), this.getFileIconThemes(), this.getProductIconThemes()]).then(([ct, fit, pit]) => {'));
		assert.ok(!theme.includes('getProductIconThemes()]).then(([ct, fit, pit]) => {\n\t\t\tupdateColorThemeConfigurationSchemas(ct);\n\t\t\tupdateFileIconThemeConfigurationSchemas(fit);\n\t\t\tupdateProductIconThemeConfigurationSchemas(pit);\n\t\t}).catch(onUnexpectedError)'));
		assert.ok(colorData.includes('return _loadColorTheme(extensionResourceLoaderService, this.location, result).then(_ => {'));
		assert.ok(!colorData.includes('_loadColorTheme(extensionResourceLoaderService, this.location, result).then(_ => {\n\t\t\tthis.isLoaded = true;\n\t\t\tthis.semanticTokenRules = result.semanticTokenRules;\n\t\t\tthis.colorMap = result.colors;\n\t\t\tthis.themeTokenColors = result.textMateRules;\n\t\t\tthis.themeSemanticHighlighting = result.semanticHighlighting;\n\t\t}).catch(onUnexpectedError)'));
		assert.ok(colorData.includes('return extensionResourceLoaderService.readExtensionResource(themeLocation).then(content => {'));
		assert.ok(colorData.includes('}, error => {'));
		assert.ok(!/\.then\(content => \{[\s\S]*\}, error => \{[\s\S]*\}\)\.catch\(onUnexpectedError\)/.test(colorData));
		assert.ok(fileIcon.includes('return this.loadIconThemeDocument(data.location).then(iconThemeDocument => {'));
		assert.ok(!fileIcon.includes('loadIconThemeDocument(data.location).then(iconThemeDocument => {\n\t\t\tconst result = this.processIconThemeDocument(data.id, data.location!, iconThemeDocument);\n\t\t\tdata.styleSheetContent = result.content;\n\t\t\tdata.hasFileIcons = result.hasFileIcons;\n\t\t\tdata.hasFolderIcons = result.hasFolderIcons;\n\t\t\tdata.hidesExplorerArrows = result.hidesExplorerArrows;\n\t\t\tdata.isLoaded = true;\n\t\t\treturn data.styleSheetContent;\n\t\t}).catch(onUnexpectedError)'));
		assert.ok(fileIcon.includes('return this.fileService.readExtensionResource(location).then((content) => {'));
		assert.ok(!/\.readExtensionResource\(location\)\.then\(\(content\) => \{[\s\S]*?\}\)\.catch\(onUnexpectedError\)/.test(fileIcon));
		assert.ok(productIcon.includes('return fileService.readExtensionResource(location).then((content) => {'));
		assert.ok(!/\.readExtensionResource\(location\)\.then\(\(content\) => \{[\s\S]*?\}\)\.catch\(onUnexpectedError\)/.test(productIcon));
		assert.ok(theme.includes('this.watcherDisposables.add(this.fileService.watch(theme.location));'));
		assert.ok(!theme.includes('fileService.watch(theme.location).catch(onUnexpectedError)'));
		assert.ok(css.includes('disposables.add(this.fileService.watch(uri));'));
		assert.ok(!css.includes('fileService.watch(uri).catch(onUnexpectedError)'));
		assert.ok(theme.includes('this._register(this.colorThemeRegistry.onDidChange(async event => {'));
		assert.ok(theme.includes('this._register(this._register(this.fileIconThemeRegistry.onDidChange(async event => {'));
		assert.ok(theme.includes('this._register(this.productIconThemeRegistry.onDidChange(async event => {'));
		for (const source of [theme, native, colorData, fileIcon, productIcon, css]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!source.includes('Wire('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('openerService.open'));
			assert.ok(!source.includes('IOpenerService'));
		}
	});
});
