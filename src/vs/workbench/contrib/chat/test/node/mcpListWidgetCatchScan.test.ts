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
const MCP_LIST_WIDGET_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/mcpListWidget.ts';

function mcpListWidgetSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), MCP_LIST_WIDGET_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/aiCustomization/mcpListWidget.ts'),
		path.join(thisDir, '../../../../../../../', MCP_LIST_WIDGET_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `mcpListWidget.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('McpListWidget leftover fire-and-forget catch scan', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('mcpListWidget async refresh / query voids double-catch onUnexpectedError', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(mcpListWidgetSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleRefresh = `void this.refresh()${doubleCatch};`;
		const doubleQuerySearch = `void this.queryMcpSearch()${doubleCatch};`;
		const doubleGallery = `void this.queryGallerySnapshot()${doubleCatch};`;
		const doubleGalleryReveal = `void this.queryGallerySnapshot(true)${doubleCatch};`;
		const doubleDelayedSearch = `void this.delayedGallerySearch.trigger(() => this.queryMcpSearch())${doubleCatch};`;
		const doubleDelayedGallery = `void this.delayedGallerySearch.trigger(() => this.queryGallerySnapshot())${doubleCatch};`;

		assert.strictEqual((source.match(/void this\.refresh\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 6);
		assert.ok(source.includes(doubleRefresh));
		assert.ok(source.includes(doubleQuerySearch));
		assert.ok(source.includes(doubleGallery));
		assert.ok(source.includes(doubleGalleryReveal));
		assert.ok(source.includes(doubleDelayedSearch));
		assert.ok(source.includes(doubleDelayedGallery));

		assert.ok(!source.includes('void this.refresh();'));
		assert.ok(!source.includes('void this.queryMcpSearch();'));
		assert.ok(!source.includes('void this.queryGallerySnapshot();'));
		assert.ok(!source.includes('void this.queryGallerySnapshot(true);'));
		assert.ok(!source.includes('void this.refresh().catch(onUnexpectedError);'));
		assert.ok(!source.includes('void this.queryMcpSearch().catch(onUnexpectedError);'));
		assert.ok(!source.includes('void this.queryGallerySnapshot().catch(onUnexpectedError);'));
		assert.ok(!source.includes('void this.queryGallerySnapshot(true).catch(onUnexpectedError);'));
		assert.ok(!source.includes('this.delayedGallerySearch.trigger(() => this.queryMcpSearch());'));
		assert.ok(!source.includes('this.delayedGallerySearch.trigger(() => this.queryGallerySnapshot());'));
		assert.ok(!source.replaceAll(doubleRefresh, '').includes('\t\t\tthis.refresh();'));
		assert.ok(!source.includes('.catch(() => undefined)'));
	});

	test('mcpListWidget leftover async action / installMarketplaceServer voids double-catch onUnexpectedError', () => {
		const source = fs.readFileSync(mcpListWidgetSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleInstall = `void this.installMarketplaceServer(server, install)${doubleCatch}`;

		assert.ok(!source.includes('void action();'));
		assert.ok(source.includes('const result = action();'));
		assert.ok(source.includes(`if (result instanceof Promise) {\n\t\t\tvoid result${doubleCatch};\n\t\t}`));
		assert.strictEqual((source.match(/void this\.installMarketplaceServer\(server, install\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 2);
		assert.ok(source.includes(doubleInstall));
		assert.ok(!source.includes('install.onDidClick(() => this.installMarketplaceServer(server, install));'));
		assert.ok(!source.includes('void this.installMarketplaceServer(server, install).catch(onUnexpectedError);'));
		assert.ok(!source.includes('void result.catch(onUnexpectedError);'));
	});

	test('mcpListWidget leftover executeCommand click voids double-catch onUnexpectedError', () => {
		const source = fs.readFileSync(mcpListWidgetSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleAddConfiguration = `void this.commandService.executeCommand(McpCommandIds.AddConfiguration)${doubleCatch}`;
		const doubleOpenSettings = `void this.commandService.executeCommand('workbench.action.openSettings', \`@id:\${mcpAccessConfig}\`)${doubleCatch}`;

		assert.strictEqual((source.match(/void this\.commandService\.executeCommand\(McpCommandIds\.AddConfiguration\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 2);
		assert.ok(source.includes(doubleAddConfiguration));
		assert.ok(source.includes(doubleOpenSettings));
		assert.ok(source.includes(`onDidClick(() => ${doubleAddConfiguration})`));
		assert.ok(!source.includes('onDidClick(() => this.commandService.executeCommand(McpCommandIds.AddConfiguration));'));
		assert.ok(!source.includes("this.commandService.executeCommand('workbench.action.openSettings', `@id:${mcpAccessConfig}`);"));
		assert.ok(!source.includes(`void this.commandService.executeCommand(McpCommandIds.AddConfiguration).catch(onUnexpectedError);`));
		assert.ok(!source.includes(`void this.commandService.executeCommand('workbench.action.openSettings', \`@id:\${mcpAccessConfig}\`).catch(onUnexpectedError);`));
	});
});
