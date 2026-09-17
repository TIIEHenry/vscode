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
const EXTENSIONS_REL = 'src/vs/workbench/contrib/extensions/common/extensions.ts';
const FORMAT_MULTIPLE_REL = 'src/vs/workbench/contrib/format/browser/formatActionsMultiple.ts';
const FORMAT_NONE_REL = 'src/vs/workbench/contrib/format/browser/formatActionsNone.ts';
const FORMAT_MODIFIED_REL = 'src/vs/workbench/contrib/format/browser/formatModified.ts';
const FORMAT_CONTRIB_REL = 'src/vs/workbench/contrib/format/browser/format.contribution.ts';

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

const updateConfigCall = 'this._updateConfigValues()';
const persistUpdateCall = `this._configService.updateValue(DefaultFormatter.configName, formatter[pick.index].extensionId!.value, {
			resource: document.uri,
			overrideIdentifier: document.getLanguageId()
		})`;
const pickUpdateCall = 'configService.updateValue(DefaultFormatter.configName, formatters[pick.index].extensionId!.value, overrides)';
const notifyRunCall = 'run: () => this._pickAndPersistDefaultFormatter(formatter, document)';
const openSearchCall = 'extensionsWorkbenchService.openSearch(`category:formatters ${langName}`)';

const d767Calls: Array<[string, string, number]> = [
	[FORMAT_MULTIPLE_REL, updateConfigCall, 1],
	[FORMAT_MULTIPLE_REL, persistUpdateCall, 1],
	[FORMAT_MULTIPLE_REL, pickUpdateCall, 1],
	[FORMAT_MULTIPLE_REL, notifyRunCall, 1],
	[FORMAT_NONE_REL, openSearchCall, 1],
];

suite('Format leftover remaining Promise fire-and-forget catch scan (D767)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers five leftover Promise double-chain sites', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d767Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 5);
		assert.ok(sites >= 4);
	});

	test('format leftover _updateConfigValues / updateValue / notification pickAndPersist are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(FORMAT_MULTIPLE_REL), 'utf8');
		const config = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		assertPromiseSignature(source, 'private async _updateConfigValues(): Promise<void> {');
		assertPromiseSignature(source, 'private async _pickAndPersistDefaultFormatter<T extends FormattingEditProvider>(formatter: T[], document: ITextModel): Promise<T | undefined> {');
		assertPromiseSignature(config, 'updateValue(key: string, value: unknown, overrides: IConfigurationOverrides | IConfigurationUpdateOverrides): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, updateConfigCall);
		assertWrapped(source, persistUpdateCall);
		assertWrapped(source, pickUpdateCall);
		assertWrapped(source, notifyRunCall);
		assert.ok(!source.includes('this._updateConfigValues();'));
		assert.ok(!source.includes(`${pickUpdateCall};`));
	});

	test('format leftover openSearch is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(FORMAT_NONE_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		assertPromiseSignature(extensions, 'openSearch(searchValue: string, focus?: boolean): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, openSearchCall);
		assert.ok(!source.includes(`${openSearchCall};`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Connect / Watch / Resolve / Pty / D145 stay skipped', () => {
		const multiple = fs.readFileSync(resolveSource(FORMAT_MULTIPLE_REL), 'utf8');
		const none = fs.readFileSync(resolveSource(FORMAT_NONE_REL), 'utf8');
		const modified = fs.readFileSync(resolveSource(FORMAT_MODIFIED_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(FORMAT_CONTRIB_REL), 'utf8');

		const analyzeThen = `this._analyzeFormatter(FormattingKind.File, formatter, document).then(result => {
			if (cts.token.isCancellationRequested) {
				return;
			}`;
		assert.ok(multiple.includes(`${analyzeThen}`));
		assert.ok(multiple.includes(`}).catch(onUnexpectedError).catch(onUnexpectedError);`));

		assert.ok(multiple.includes('this._languageStatusStore.add(CommandsRegistry.registerCommand(command.id, () => this._pickAndPersistDefaultFormatter(formatter, document)));'));
		assert.ok(!multiple.includes('registerCommand(command.id, () => this._pickAndPersistDefaultFormatter(formatter, document).catch'));
		assert.ok(multiple.includes('return this._pickAndPersistDefaultFormatter(formatter, document);'));
		assert.ok(!multiple.includes(`return this._pickAndPersistDefaultFormatter(formatter, document)${doubleCatch}`));

		assert.ok(multiple.includes('this._store.add(this._extensionService.onDidChangeExtensions(this._updateConfigValues, this));'));
		assert.ok(multiple.includes('this._store.add(_languageFeaturesService.documentFormattingEditProvider.onDidChange(this._updateConfigValues, this));'));
		assert.ok(multiple.includes('this._store.add(_languageFeaturesService.documentRangeFormattingEditProvider.onDidChange(this._updateConfigValues, this));'));
		assert.ok(!multiple.includes('onDidChangeExtensions(() => this._updateConfigValues()'));

		assert.ok(none.includes("return commandService.executeCommand('editor.action.formatDocument.multiple');"));
		assert.ok(!none.includes(`return commandService.executeCommand('editor.action.formatDocument.multiple')${doubleCatch}`));
		assert.ok(none.includes("return commandService.executeCommand('editor.action.formatDocument');"));
		assert.ok(!none.includes(`return commandService.executeCommand('editor.action.formatDocument')${doubleCatch}`));
		assert.ok(modified.includes('return instaService.invokeFunction('));
		assert.ok(!modified.includes(`return instaService.invokeFunction(${doubleCatch}`));

		assert.ok(multiple.includes('async run(accessor: ServicesAccessor, editor: ICodeEditor, args: unknown): Promise<void> {'));
		assert.ok(none.includes('async run(accessor: ServicesAccessor, editor: ICodeEditor): Promise<void> {'));
		assert.ok(modified.includes('async run(accessor: ServicesAccessor, editor: ICodeEditor): Promise<void> {'));
		assert.ok(!multiple.includes(`async run(accessor: ServicesAccessor, editor: ICodeEditor, args: unknown): Promise<void> {${doubleCatch}`));

		assert.ok(!multiple.includes('.then(') || multiple.includes('.then(result => {'));
		assert.ok(!multiple.includes('.then(undefined,'));
		assert.ok(!none.includes('.then('));
		assert.ok(!modified.includes('.then('));
		assert.ok(!contrib.includes('.then('));
		assert.ok(!multiple.includes('IOpenerService'));
		assert.ok(!none.includes('IOpenerService'));
		assert.ok(!modified.includes('IOpenerService'));

		for (const source of [multiple, none, modified, contrib]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
