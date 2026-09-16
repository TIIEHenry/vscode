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

	test('migration refresh / migrate / reveal voids double-catch onUnexpectedError', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(editorSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleRefresh = `void this.refreshCustomizationMigrationInfo()${doubleCatch}`;
		const doubleMigrate = `void this.migrateSelectedCustomizations(category, selectedCustomizations)${doubleCatch};`;
		const doubleReveal = `void this.revealMigratedCustomizations(migratedCustomizations)${doubleCatch};`;

		assert.ok(source.includes("import { getErrorMessage, onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\.refreshCustomizationMigrationInfo\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 6);
		assert.strictEqual((source.match(/void this\.migrateSelectedCustomizations\(category, selectedCustomizations\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\.revealMigratedCustomizations\(migratedCustomizations\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.ok(source.includes(doubleRefresh));
		assert.ok(source.includes(doubleMigrate));
		assert.ok(source.includes(doubleReveal));
		assert.ok(source.includes(`() => ${doubleRefresh},`));
		assert.ok(source.includes('await this.refreshCustomizationMigrationInfo();'));
		assert.ok(!source.includes('void this.refreshCustomizationMigrationInfo();'));
		assert.ok(!source.includes('void this.refreshCustomizationMigrationInfo(),'));
		assert.ok(!source.includes('void this.migrateSelectedCustomizations(category, selectedCustomizations);'));
		assert.ok(!source.includes('void this.revealMigratedCustomizations(migratedCustomizations);'));
		assert.ok(!source.includes('void this.refreshCustomizationMigrationInfo().catch(onUnexpectedError);'));
		assert.ok(!source.includes('void this.migrateSelectedCustomizations(category, selectedCustomizations).catch(onUnexpectedError);'));
		assert.ok(!source.includes('void this.revealMigratedCustomizations(migratedCustomizations).catch(onUnexpectedError);'));
		assert.ok(!source.includes('await this.refreshCustomizationMigrationInfo().catch(onUnexpectedError)'));
	});

	test('listWidget.setSection / showEmbeddedEditor leftover voids double-catch onUnexpectedError (D574)', () => {
		const source = fs.readFileSync(editorSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleSelectedSection = `void this.listWidget.setSection(this.selectedSection)${doubleCatch};`;
		const doubleSection = `void this.listWidget.setSection(section)${doubleCatch};`;
		const doubleSectionId = `void this.listWidget.setSection(sectionId)${doubleCatch};`;
		const doubleShowEmbeddedEditor = `void this.showEmbeddedEditor(\n\t\t\t\tcustomization.uri,\n\t\t\t\tcustomization.name ?? basename(customization.uri),\n\t\t\t\tcustomization.type,\n\t\t\t\tcustomization.storage,\n\t\t\t\tisWorkspaceFile,\n\t\t\t)${doubleCatch};`;

		assert.strictEqual((source.match(/void this\.listWidget\.setSection\([^)]+\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 3);
		assert.ok(source.includes(doubleSelectedSection));
		assert.ok(source.includes(doubleSection));
		assert.ok(source.includes(doubleSectionId));
		assert.ok(source.includes(doubleShowEmbeddedEditor));
		assert.strictEqual((source.match(/void this\.showEmbeddedEditor\(/g) ?? []).length, 1);
		assert.ok(source.includes('await this.listWidget.setSection(section);'));
		assert.ok(source.includes('await this.showEmbeddedEditor(fileUri, fileName, PromptsType.instructions, PromptsStorage.local, true);'));
		assert.ok(!source.includes('void this.listWidget.setSection(this.selectedSection);'));
		assert.ok(!source.includes('void this.listWidget.setSection(section);'));
		assert.ok(!source.includes('void this.listWidget.setSection(sectionId);'));
		assert.ok(!source.includes('void this.listWidget.setSection(this.selectedSection).catch(onUnexpectedError);'));
		assert.ok(!source.includes('void this.listWidget.setSection(section).catch(onUnexpectedError);'));
		assert.ok(!source.includes('void this.listWidget.setSection(sectionId).catch(onUnexpectedError);'));
		assert.ok(!source.includes('void this.showEmbeddedEditor(\n\t\t\t\tcustomization.uri,\n\t\t\t\tcustomization.name ?? basename(customization.uri),\n\t\t\t\tcustomization.type,\n\t\t\t\tcustomization.storage,\n\t\t\t\tisWorkspaceFile,\n\t\t\t);'));
		assert.ok(!source.includes('await this.listWidget.setSection(section).catch(onUnexpectedError)'));
		assert.ok(!source.includes('await this.showEmbeddedEditor(fileUri, fileName, PromptsType.instructions, PromptsStorage.local, true).catch(onUnexpectedError)'));
	});
});

suite('AICustomizationManagementEditor leftover save / editor-action catch scan (D582)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('handleEditorActionButton / saveExistingCustomization / saveBuiltinPromptCopy rejection paths double-catch onUnexpectedError', () => {
		// Single-layer console.error+notification still leaks when mocha's unexpected handler warn-then-rethrows.
		const source = fs.readFileSync(editorSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleHandle = `void this.handleEditorActionButton()${doubleCatch};`;
		const doubleSaveExisting = `void this.saveExistingCustomization(saveRequest)${doubleCatch};`;
		const doubleSaveBuiltin = `void this.saveBuiltinPromptCopy(saveRequest).then(() => {\n\t\t\t\t\tvoid this.listWidget?.refresh();\n\t\t\t\t})${doubleCatch};`;

		assert.ok(source.includes("import { getErrorMessage, onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\.handleEditorActionButton\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\.saveExistingCustomization\(saveRequest\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\.saveBuiltinPromptCopy\(saveRequest\)\.then\(\(\) => \{\s*void this\.listWidget\?\.refresh\(\);\s*\}\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.ok(source.includes(doubleHandle));
		assert.ok(source.includes(doubleSaveExisting));
		assert.ok(source.includes(doubleSaveBuiltin));
		assert.ok(source.includes('await this.saveBuiltinPromptCopy(saveRequest);'));
		assert.ok(source.includes('void this.listWidget?.refresh();'));
		assert.ok(!source.includes('void this.handleEditorActionButton().catch(error => {'));
		assert.ok(!source.includes('void this.saveExistingCustomization(saveRequest).catch(error => {'));
		assert.ok(!source.includes('void this.handleEditorActionButton().catch(onUnexpectedError);'));
		assert.ok(!source.includes('void this.saveExistingCustomization(saveRequest).catch(onUnexpectedError);'));
		assert.ok(!source.includes("console.error('Failed to handle editor back action:'"));
		assert.ok(!source.includes("console.error('Failed to save customization changes on exit:'"));
		assert.ok(!source.includes(', error => {\n\t\t\t\t\tconsole.error(\'Failed to save built-in override:\''));
		assert.ok(source.includes("console.error('Failed to save built-in override:', error);"));
		assert.ok(source.includes("console.error('Failed to load model for embedded editor:', error);"));
		assert.strictEqual((source.match(/void this\.refreshCustomizationMigrationInfo\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 6);
		assert.strictEqual((source.match(/void this\.listWidget\.setSection\([^)]+\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 3);
	});
});
