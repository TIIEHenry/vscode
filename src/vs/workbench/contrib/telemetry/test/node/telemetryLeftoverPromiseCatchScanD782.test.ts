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
const TELEMETRY_IFACE_REL = 'src/vs/platform/telemetry/common/telemetry.ts';
const LOG_IFACE_REL = 'src/vs/platform/log/common/log.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const LANGUAGE_PACKS_REL = 'src/vs/platform/languagePacks/common/languagePacks.ts';
const OUTPUT_IFACE_REL = 'src/vs/workbench/services/output/common/output.ts';
const LOCALE_IFACE_REL = 'src/vs/workbench/services/localization/common/locale.ts';
const TELEMETRY_REL = 'src/vs/workbench/contrib/telemetry/browser/telemetry.contribution.ts';
const LOCALIZATION_NATIVE_REL = 'src/vs/workbench/contrib/localization/electron-browser/localization.contribution.ts';
const LOCALIZATION_WEB_REL = 'src/vs/workbench/contrib/localization/browser/localization.contribution.ts';
const LOCALIZATION_COMMON_REL = 'src/vs/workbench/contrib/localization/common/localization.contribution.ts';
const LOCALIZATION_ACTIONS_REL = 'src/vs/workbench/contrib/localization/common/localizationsActions.ts';

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

const handleVisibilityCall = 'this.handleTelemetryOutputVisibility()';
const checkAndInstallCall = 'this.checkAndInstall()';
const onDidInstallCall = 'this.onDidInstallExtensions(e)';
const onDidUninstallCall = 'this.onDidUninstallExtension(e)';
const setLocaleEnCall = `this.localeService.setLocale({
				id: 'en',
				label: 'English'
			})`;

const d782Calls: Array<[string, string, number]> = [
	[TELEMETRY_REL, handleVisibilityCall, 1],
	[LOCALIZATION_NATIVE_REL, checkAndInstallCall, 1],
	[LOCALIZATION_NATIVE_REL, onDidInstallCall, 1],
	[LOCALIZATION_NATIVE_REL, onDidUninstallCall, 1],
	[LOCALIZATION_NATIVE_REL, setLocaleEnCall, 1],
];

suite('telemetry leftover remaining overflowed to localization leftover Promise fire-and-forget catch scan (D782)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('telemetry leftover remaining has fewer than four legal sites so this knife moved to localization leftover remaining', () => {
		const telemetry = fs.readFileSync(resolveSource(TELEMETRY_REL), 'utf8');
		const telemetryLegal = countWrapped(telemetry, handleVisibilityCall);
		assert.ok(telemetryLegal < 4, `expected telemetry legal leftover <4, got ${telemetryLegal}`);
		assert.strictEqual(telemetryLegal, 1);
		assert.ok(telemetry.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(telemetry, handleVisibilityCall);
		assert.ok(!telemetry.includes('this.handleTelemetryOutputVisibility();'));
		assert.ok(telemetry.includes('that.outputService.showChannel(TelemetryLogGroup.id);'));
		assert.ok(!telemetry.includes(`that.outputService.showChannel(TelemetryLogGroup.id)${doubleCatch}`));
		assert.ok(telemetry.includes('this.telemetryService.publicLog2<'));
		assert.ok(!telemetry.includes(`publicLog2${doubleCatch}`));
	});

	test('this knife covers five leftover Promise double-chain sites after telemetry leftover remaining overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d782Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countWrapped(source, call);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 5);
		assert.ok(sites >= 4);
	});

	test('telemetry leftover handleTelemetryOutputVisibility is Promise double-chain; Action2 showChannel / publicLog2 / setVisibility stay skipped', () => {
		const telemetry = fs.readFileSync(resolveSource(TELEMETRY_REL), 'utf8');
		const output = fs.readFileSync(resolveSource(OUTPUT_IFACE_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(TELEMETRY_IFACE_REL), 'utf8');
		const log = fs.readFileSync(resolveSource(LOG_IFACE_REL), 'utf8');
		assertPromiseSignature(telemetry, 'private async handleTelemetryOutputVisibility(): Promise<void> {');
		assertPromiseSignature(output, 'showChannel(id: string, preserveFocus?: boolean): Promise<void>;');
		assert.ok(iface.includes('publicLog2<E extends ClassifiedEvent<OmitMetadata<T>> = never, T extends IGDPRProperty = never>(eventName: string, data?: StrictPropertyCheck<T, E>): void;'));
		assert.ok(log.includes('setVisibility(resourceOrId: URI | string, visible: boolean): void;'));
		assert.ok(telemetry.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(telemetry, handleVisibilityCall);
		assert.ok(telemetry.includes('async run(): Promise<void> {'));
		assert.ok(telemetry.includes('that.outputService.showChannel(TelemetryLogGroup.id);'));
		assert.ok(!telemetry.includes('that.outputService.showChannel(TelemetryLogGroup.id).catch'));
		assert.ok(telemetry.includes('that.loggerService.setVisibility(logger.resource, true);'));
		assert.ok(!telemetry.includes(`that.loggerService.setVisibility(logger.resource, true)${doubleCatch}`));
		assert.ok(telemetry.includes('await Event.toPromise(Event.filter(this.loggerService.onDidChangeLoggers, e => [...e.added].some(logger => logger.id === telemetryLogId)));'));
		assert.ok(!telemetry.includes(`Event.toPromise(Event.filter(this.loggerService.onDidChangeLoggers, e => [...e.added].some(logger => logger.id === telemetryLogId)))${doubleCatch}`));
	});

	test('localization leftover checkAndInstall / onDidInstallExtensions / onDidUninstallExtension / setLocale en are Promise double-chain', () => {
		const native = fs.readFileSync(resolveSource(LOCALIZATION_NATIVE_REL), 'utf8');
		const locale = fs.readFileSync(resolveSource(LOCALE_IFACE_REL), 'utf8');
		assertPromiseSignature(native, 'private async checkAndInstall(): Promise<void> {');
		assertPromiseSignature(native, 'private async onDidInstallExtensions(results: readonly InstallExtensionResult[]): Promise<void> {');
		assertPromiseSignature(native, 'private async onDidUninstallExtension(_event: DidUninstallExtensionEvent): Promise<void> {');
		assertPromiseSignature(locale, 'setLocale(languagePackItem: ILanguagePackItem, skipDialog?: boolean): Promise<void>;');
		assert.ok(native.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(native, checkAndInstallCall);
		assertWrapped(native, onDidInstallCall);
		assertWrapped(native, onDidUninstallCall);
		assertWrapped(native, setLocaleEnCall);
		assert.ok(!native.includes('this.checkAndInstall();'));
		assert.ok(!native.includes('e => this.onDidInstallExtensions(e)));'));
		assert.ok(!native.includes('e => this.onDidUninstallExtension(e)));'));
		assert.ok(native.includes(`await this.localeService.setLocale({
						id: languageId,`));
		assert.ok(!native.includes(`await this.localeService.setLocale({
						id: languageId,${doubleCatch}`));
		assert.ok(native.includes(`await this.localeService.setLocale({
					id: locale,`));
		assert.ok(!native.includes(`await this.localeService.setLocale({
					id: locale,${doubleCatch}`));
		assert.ok(native.includes('await this.extensionsWorkbenchService.openSearch(`tag:lp-${locale}`);'));
		assert.ok(!native.includes(`openSearch(\`tag:lp-\${locale}\`)${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Watch / Resolve / Pty / Connect / D145 stay skipped', () => {
		const telemetry = fs.readFileSync(resolveSource(TELEMETRY_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(LOCALIZATION_NATIVE_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(LOCALIZATION_ACTIONS_REL), 'utf8');
		const common = fs.readFileSync(resolveSource(LOCALIZATION_COMMON_REL), 'utf8');
		const web = fs.readFileSync(resolveSource(LOCALIZATION_WEB_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const languagePacks = fs.readFileSync(resolveSource(LANGUAGE_PACKS_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(languagePacks, 'getAvailableLanguages(): Promise<Array<ILanguagePackItem>>;');
		assertPromiseSignature(actions, 'public async run(accessor: ServicesAccessor): Promise<void> {');

		assert.ok(actions.includes(`languagePackService.getAvailableLanguages().then(availableLanguages => {`));
		assert.ok(actions.includes(`})${doubleCatch};`));
		assert.ok(actions.includes('public async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(actions.includes('await localeService.setLocale(selectedLanguage);'));
		assert.ok(!actions.includes(`await localeService.setLocale(selectedLanguage)${doubleCatch}`));
		assert.ok(actions.includes('await extensionWorkbenchService.open(e.item.extensionId);'));
		assert.ok(!actions.includes(`await extensionWorkbenchService.open(e.item.extensionId)${doubleCatch}`));
		assert.ok(actions.includes('await localeService.clearLocalePreference();'));
		assert.ok(!actions.includes(`await localeService.clearLocalePreference()${doubleCatch}`));

		assert.ok(telemetry.includes('async run(): Promise<void> {'));
		assert.ok(telemetry.includes('that.outputService.showChannel(TelemetryLogGroup.id);'));
		assert.ok(!telemetry.includes('that.outputService.showChannel(TelemetryLogGroup.id).catch'));
		assert.ok(!telemetry.includes('IOpenerService'));
		assert.ok(!native.includes('IOpenerService'));
		assert.ok(!native.includes('.then('));
		assert.ok(!native.includes('.then(undefined,'));
		assert.ok(!common.includes(doubleCatch));
		assert.ok(!web.includes(doubleCatch));

		for (const source of [telemetry, native, actions, common, web]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
