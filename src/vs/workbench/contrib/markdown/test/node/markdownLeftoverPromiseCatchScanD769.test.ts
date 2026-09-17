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
const CLIPBOARD_REL = 'src/vs/platform/clipboard/common/clipboardService.ts';
const CONFIG_REL = 'src/vs/platform/configuration/common/configuration.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const PREFERENCES_REL = 'src/vs/workbench/services/preferences/common/preferences.ts';
const MARKDOWN_RENDERER_REL = 'src/vs/workbench/contrib/markdown/browser/markdownSettingRenderer.ts';
const MARKDOWN_DOC_REL = 'src/vs/workbench/contrib/markdown/browser/markdownDocumentRenderer.ts';
const MARKDOWN_CONTRIB_REL = 'src/vs/workbench/contrib/markdown/browser/markdown.contribution.ts';
const OPENERS_STORE_REL = 'src/vs/workbench/contrib/externalUriOpener/common/contributedOpeners.ts';
const OPENER_SVC_REL = 'src/vs/workbench/contrib/externalUriOpener/common/externalUriOpenerService.ts';
const OPENER_CONTRIB_REL = 'src/vs/workbench/contrib/externalUriOpener/common/externalUriOpener.contribution.ts';

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
	return (source.match(new RegExp(`${call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${doubleCatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) ?? []).length;
}

const setSettingCall = 'this.setSetting(settingId, currentSettingValue, newSettingValue)';
const writeTextCall = 'this._clipboardService.writeText(settingId)';
const invalidateCall = 'this.invalidateOpenersOnExtensionsChanged()';

const d769Calls: Array<[string, string, number]> = [
	[MARKDOWN_RENDERER_REL, setSettingCall, 1],
	[MARKDOWN_RENDERER_REL, writeTextCall, 1],
	[OPENERS_STORE_REL, invalidateCall, 3],
];

suite('markdown leftover remaining overflowed to externalUriOpener leftover Promise fire-and-forget catch scan (D769)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('markdown leftover remaining has fewer than four legal sites so this knife moved to externalUriOpener leftover', () => {
		const renderer = fs.readFileSync(resolveSource(MARKDOWN_RENDERER_REL), 'utf8');
		const doc = fs.readFileSync(resolveSource(MARKDOWN_DOC_REL), 'utf8');
		const markdownLegal =
			countWrapped(renderer, setSettingCall) +
			countWrapped(renderer, writeTextCall);
		assert.ok(markdownLegal < 4, `expected markdown legal leftover <4, got ${markdownLegal}`);
		assert.strictEqual(markdownLegal, 2);
		assert.ok(doc.includes('return Promise.resolve(options.highlight(token.text, token.lang)).then(updateToken(token));'));
		assert.ok(!doc.includes(`return Promise.resolve(options.highlight(token.text, token.lang)).then(updateToken(token))${doubleCatch}`));
		assert.ok(!doc.includes(doubleCatch));
	});

	test('this knife covers five leftover Promise double-chain sites after markdown leftover remaining overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d769Calls) {
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

	test('markdown leftover setSetting / writeText voids are Promise double-chain; returned restore / openApplicationSettings / highlight then stay skipped', () => {
		const source = fs.readFileSync(resolveSource(MARKDOWN_RENDERER_REL), 'utf8');
		const clipboard = fs.readFileSync(resolveSource(CLIPBOARD_REL), 'utf8');
		const config = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const preferences = fs.readFileSync(resolveSource(PREFERENCES_REL), 'utf8');
		const doc = fs.readFileSync(resolveSource(MARKDOWN_DOC_REL), 'utf8');
		assertPromiseSignature(source, 'async setSetting(settingId: string, currentSettingValue: unknown, newSettingValue: unknown): Promise<void> {');
		assertPromiseSignature(source, 'async restoreSetting(settingId: string): Promise<void> {');
		assertPromiseSignature(clipboard, 'writeText(text: string, type?: string): Promise<void>;');
		assertPromiseSignature(config, 'updateValue(key: string, value: unknown): Promise<void>;');
		assertPromiseSignature(preferences, 'openApplicationSettings(options?: IOpenSettingsOptions): Promise<IEditorPane | undefined>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, setSettingCall);
		assertWrapped(source, writeTextCall);
		assert.ok(!source.includes(`${setSettingCall};`));
		assert.ok(!source.includes(`${writeTextCall};`));
		assert.ok(source.includes('return this.restoreSetting(settingId);'));
		assert.ok(!source.includes(`return this.restoreSetting(settingId)${doubleCatch}`));
		assert.ok(source.includes('return this._preferencesService.openApplicationSettings({ query: `@id:${settingId}` });'));
		assert.ok(!source.includes(`return this._preferencesService.openApplicationSettings({ query: \`@id:\${settingId}\` })${doubleCatch}`));
		assert.ok(doc.includes('return Promise.resolve(options.highlight(token.text, token.lang)).then(updateToken(token));'));
		assert.ok(!doc.includes(`return Promise.resolve(options.highlight(token.text, token.lang)).then(updateToken(token))${doubleCatch}`));
	});

	test('externalUriOpener leftover invalidateOpenersOnExtensionsChanged voids are Promise double-chain; opener call sites stay skipped', () => {
		const source = fs.readFileSync(resolveSource(OPENERS_STORE_REL), 'utf8');
		const openerSvc = fs.readFileSync(resolveSource(OPENER_SVC_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		const preferences = fs.readFileSync(resolveSource(PREFERENCES_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		assertPromiseSignature(source, 'private async invalidateOpenersOnExtensionsChanged() {');
		assertPromiseSignature(extensions, 'whenInstalledExtensionsRegistered(): Promise<boolean>;');
		assertPromiseSignature(openerSvc, 'openExternalUri(uri: URI, ctx: { sourceUri: URI }, token: CancellationToken): Promise<boolean>;');
		assertPromiseSignature(preferences, 'openUserSettings(options?: IOpenSettingsOptions): Promise<IEditorPane | undefined>;');
		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, invalidateCall);
		assert.strictEqual(countWrapped(source, invalidateCall), 3);
		assert.ok(!source.includes('\t\tthis.invalidateOpenersOnExtensionsChanged();'));
		assert.ok(!source.includes('() => this.invalidateOpenersOnExtensionsChanged())'));
		assert.ok(openerSvc.includes('return allOpeners[0].openExternalUri(targetUri, ctx, token);'));
		assert.ok(!openerSvc.includes(`return allOpeners[0].openExternalUri(targetUri, ctx, token)${doubleCatch}`));
		assert.ok(openerSvc.includes('return picked.opener.openExternalUri(targetUri, ctx, token);'));
		assert.ok(!openerSvc.includes(`return picked.opener.openExternalUri(targetUri, ctx, token)${doubleCatch}`));
		assert.ok(openerSvc.includes('await this.preferencesService.openUserSettings({'));
		assert.ok(!openerSvc.includes(`openUserSettings({${doubleCatch}`));
		assert.ok(!openerSvc.includes(doubleCatch));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / Watch / Resolve / Pty / Connect / D145 stay skipped', () => {
		const renderer = fs.readFileSync(resolveSource(MARKDOWN_RENDERER_REL), 'utf8');
		const doc = fs.readFileSync(resolveSource(MARKDOWN_DOC_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(MARKDOWN_CONTRIB_REL), 'utf8');
		const openerSvc = fs.readFileSync(resolveSource(OPENER_SVC_REL), 'utf8');
		const openerContrib = fs.readFileSync(resolveSource(OPENER_CONTRIB_REL), 'utf8');
		assert.ok(doc.includes('return Promise.resolve(options.highlight(token.text, token.lang)).then(updateToken(token));'));
		assert.ok(!doc.includes(doubleCatch));
		assert.ok(renderer.includes('return this.restoreSetting(settingId);'));
		assert.ok(!renderer.includes(`return this.restoreSetting(settingId)${doubleCatch}`));
		assert.ok(renderer.includes('return this._preferencesService.openApplicationSettings({ query: `@id:${settingId}` });'));
		assert.ok(!renderer.includes(`openApplicationSettings({ query: \`@id:\${settingId}\` })${doubleCatch}`));
		assert.ok(!contrib.includes('Action2'));
		assert.ok(!contrib.includes('async run('));
		assert.ok(!openerContrib.includes('Action2'));
		assert.ok(!openerContrib.includes(doubleCatch));
		assert.ok(openerSvc.includes('return allOpeners[0].openExternalUri(targetUri, ctx, token);'));
		assert.ok(!openerSvc.includes('openExternalUri(targetUri, ctx, token).catch'));
		assert.ok(!renderer.includes(' = ') || !renderer.includes(` = ${setSettingCall}${doubleCatch}`));
		assert.ok(!doc.includes('.then(') || !doc.includes('.then(undefined,'));
		for (const source of [renderer, doc, contrib, openerSvc, openerContrib]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
