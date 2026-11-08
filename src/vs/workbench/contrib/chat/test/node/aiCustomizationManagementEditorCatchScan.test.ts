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
const EDITOR_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts';

function editorSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), EDITOR_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts'),
		path.join(thisDir, '../../../../../../../', EDITOR_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `aiCustomizationManagementEditor.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('AICustomizationManagementEditor leftover fire-and-forget catch scan (D566/D574)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('migration refresh / migrate / reveal voids single-catch onUnexpectedError', () => {
		const source = fs.readFileSync(editorSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const singleRefresh = `void this.refreshCustomizationMigrationInfo()${singleCatch}`;
		const singleMigrate = `void this.migrateSelectedCustomizations(category, selectedCustomizations)${singleCatch};`;
		const singleReveal = `void this.revealMigratedCustomizations(migratedCustomizations)${singleCatch};`;

		assert.ok(source.includes("import { getErrorMessage, onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\.refreshCustomizationMigrationInfo\(\)\.catch\(onUnexpectedError\)/g) ?? []).length, 6);
		assert.strictEqual((source.match(/void this\.migrateSelectedCustomizations\(category, selectedCustomizations\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\.revealMigratedCustomizations\(migratedCustomizations\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.ok(source.includes(singleRefresh));
		assert.ok(source.includes(singleMigrate));
		assert.ok(source.includes(singleReveal));
		assert.ok(source.includes(`() => ${singleRefresh},`));
		assert.ok(source.includes('await this.refreshCustomizationMigrationInfo();'));
		assert.ok(!source.includes('void this.refreshCustomizationMigrationInfo();'));
		assert.ok(!source.includes('void this.refreshCustomizationMigrationInfo(),'));
		assert.ok(!source.includes('void this.migrateSelectedCustomizations(category, selectedCustomizations);'));
		assert.ok(!source.includes('void this.revealMigratedCustomizations(migratedCustomizations);'));
		assert.ok(!source.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));
	});

	test('listWidget.setSection / showEmbeddedEditor leftover voids single-catch onUnexpectedError (D574)', () => {
		const source = fs.readFileSync(editorSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const singleSelectedSection = `void this.listWidget.setSection(this.selectedSection)${singleCatch};`;
		const singleSection = `void this.listWidget.setSection(section)${singleCatch};`;
		const singleSectionId = `void this.listWidget.setSection(sectionId)${singleCatch};`;
		const singleShowEmbeddedEditor = `void this.showEmbeddedEditor(\n\t\t\t\tcustomization.uri,\n\t\t\t\tcustomization.name ?? basename(customization.uri),\n\t\t\t\tcustomization.type,\n\t\t\t\tcustomization.storage,\n\t\t\t\tisWorkspaceFile,\n\t\t\t)${singleCatch};`;

		assert.strictEqual((source.match(/void this\.listWidget\.setSection\([^)]+\)\.catch\(onUnexpectedError\);/g) ?? []).length, 3);
		assert.ok(source.includes(singleSelectedSection));
		assert.ok(source.includes(singleSection));
		assert.ok(source.includes(singleSectionId));
		assert.ok(source.includes(singleShowEmbeddedEditor));
		assert.strictEqual((source.match(/void this\.showEmbeddedEditor\(\n\t\t\t\tcustomization\.uri,/g) ?? []).length, 1);
		assert.ok(source.includes('await this.listWidget.setSection(section);'));
		assert.ok(source.includes('await this.showEmbeddedEditor(fileUri, fileName, PromptsType.instructions, PromptsStorage.local, true);'));
		assert.ok(!source.includes('void this.listWidget.setSection(this.selectedSection);'));
		assert.ok(!source.includes('void this.listWidget.setSection(section);'));
		assert.ok(!source.includes('void this.listWidget.setSection(sectionId);'));
		assert.ok(!source.includes('void this.showEmbeddedEditor(\n\t\t\t\tcustomization.uri,\n\t\t\t\tcustomization.name ?? basename(customization.uri),\n\t\t\t\tcustomization.type,\n\t\t\t\tcustomization.storage,\n\t\t\t\tisWorkspaceFile,\n\t\t\t);'));
		assert.ok(!source.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));
	});
});

suite('AICustomizationManagementEditor leftover save / editor-action catch scan (D582)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('handleEditorActionButton / saveExistingCustomization / saveBuiltinPromptCopy rejection paths single-catch onUnexpectedError', () => {
		const source = fs.readFileSync(editorSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const singleHandle = `void this.handleEditorActionButton()${singleCatch};`;
		const singleSaveExisting = `void this.saveExistingCustomization(saveRequest)${singleCatch};`;

		assert.ok(source.includes("import { getErrorMessage, onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\.handleEditorActionButton\(\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\.saveExistingCustomization\(saveRequest\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.ok(source.includes(singleHandle));
		assert.ok(source.includes(singleSaveExisting));
		assert.ok(source.includes('await this.saveBuiltinPromptCopy(saveRequest);'));
		assert.ok(source.includes('void this.listWidget?.refresh();'));
		assert.ok(!source.includes('void this.handleEditorActionButton().catch(error => {'));
		assert.ok(!source.includes('void this.saveExistingCustomization(saveRequest).catch(error => {'));
		assert.ok(!source.includes("console.error('Failed to handle editor back action:'"));
		assert.ok(!source.includes("console.error('Failed to save customization changes on exit:'"));
		assert.ok(!source.includes(', error => {\n\t\t\t\t\tconsole.error(\'Failed to save built-in override:\''));
		assert.ok(source.includes("console.error('Failed to save built-in override:', error);"));
		assert.ok(source.includes("console.error('Failed to load model for embedded editor:', error);"));
		assert.strictEqual((source.match(/void this\.refreshCustomizationMigrationInfo\(\)\.catch\(onUnexpectedError\)/g) ?? []).length, 6);
		assert.strictEqual((source.match(/void this\.listWidget\.setSection\([^)]+\)\.catch\(onUnexpectedError\);/g) ?? []).length, 3);
		assert.ok(!source.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));
	});
});

suite('AICustomizationManagementEditor leftover showEmbeddedEditor select/plugin catch scan (D590)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onDidSelectItem / openPromptsItemFromPluginDetail showEmbeddedEditor leftover voids single-catch onUnexpectedError', () => {
		const source = fs.readFileSync(editorSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const singleItemShow = `void this.showEmbeddedEditor(item.uri, item.name, item.promptType, source ?? AICustomizationSources.builtin, isWorkspaceFile, isReadOnly)${singleCatch};`;

		assert.strictEqual((source.match(/void this\.showEmbeddedEditor\(item\.uri, item\.name, item\.promptType, source \?\? AICustomizationSources\.builtin, isWorkspaceFile, isReadOnly\)\.catch\(onUnexpectedError\);/g) ?? []).length, 2);
		assert.ok(source.includes(singleItemShow));
		assert.strictEqual((source.match(/void this\.showEmbeddedEditor\(/g) ?? []).length, 3);
		assert.ok(source.includes('await this.showEmbeddedEditor(fileUri, fileName, PromptsType.instructions, PromptsStorage.local, true);'));
		assert.ok(!source.includes('\n\t\t\tthis.showEmbeddedEditor(item.uri, item.name, item.promptType, source ?? AICustomizationSources.builtin, isWorkspaceFile, isReadOnly);'));
		assert.ok(!source.includes('\n\t\t\t\tthis.showEmbeddedEditor(item.uri, item.name, item.promptType, source ?? AICustomizationSources.builtin, isWorkspaceFile, isReadOnly);'));
		assert.ok(!source.includes('void this.showEmbeddedEditor(item.uri, item.name, item.promptType, source ?? AICustomizationSources.builtin, isWorkspaceFile, isReadOnly);'));
		assert.strictEqual((source.match(/void this\.refreshCustomizationMigrationInfo\(\)\.catch\(onUnexpectedError\)/g) ?? []).length, 6);
		assert.strictEqual((source.match(/void this\.listWidget\.setSection\([^)]+\)\.catch\(onUnexpectedError\);/g) ?? []).length, 3);
		assert.strictEqual((source.match(/void this\.handleEditorActionButton\(\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.ok(!source.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));
	});
});

suite('AICustomizationManagementEditor leftover create catch scan (D598)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onDidRequestCreate / onDidRequestCreateManual leftover voids single-catch onUnexpectedError', () => {
		const source = fs.readFileSync(editorSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const singleCreateAI = `void this.createNewItemWithAI(promptType)${singleCatch};`;
		const singleCreateManual = `void this.createNewItemManual(type, target, rootFileName)${singleCatch};`;

		assert.strictEqual((source.match(/void this\.createNewItemWithAI\(promptType\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\.createNewItemManual\(type, target, rootFileName\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.ok(source.includes(singleCreateAI));
		assert.ok(source.includes(singleCreateManual));
		assert.ok(!source.includes('\n\t\t\tthis.createNewItemWithAI(promptType);'));
		assert.ok(!source.includes('\n\t\t\tthis.createNewItemManual(type, target, rootFileName);'));
		assert.ok(!source.includes('void this.createNewItemWithAI(promptType);'));
		assert.ok(!source.includes('void this.createNewItemManual(type, target, rootFileName);'));
		// refresh(): void — .catch on the return value would throw at runtime.
		assert.strictEqual((source.match(/void this\.listWidget\?\.refresh\(\);/g) ?? []).length, 2);
		assert.ok(!source.includes('void this.listWidget?.refresh().catch(onUnexpectedError)'));
		assert.strictEqual((source.match(/void this\.refreshCustomizationMigrationInfo\(\)\.catch\(onUnexpectedError\)/g) ?? []).length, 6);
		assert.strictEqual((source.match(/void this\.listWidget\.setSection\([^)]+\)\.catch\(onUnexpectedError\);/g) ?? []).length, 3);
		assert.strictEqual((source.match(/void this\.handleEditorActionButton\(\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\.showEmbeddedEditor\(item\.uri, item\.name, item\.promptType, source \?\? AICustomizationSources\.builtin, isWorkspaceFile, isReadOnly\)\.catch\(onUnexpectedError\);/g) ?? []).length, 2);
		assert.ok(!source.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));
	});
});
