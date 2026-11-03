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

	test('mcpListWidget async refresh / query voids single-catch onUnexpectedError', () => {
		const source = fs.readFileSync(mcpListWidgetSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const singleRefresh = `void this.refresh()${singleCatch};`;
		const singleQuerySearch = `void this.queryMcpSearch()${singleCatch};`;
		const singleGallery = `void this.queryGallerySnapshot()${singleCatch};`;
		const singleGalleryReveal = `void this.queryGallerySnapshot(true)${singleCatch};`;
		const singleDelayedSearch = `void this.delayedGallerySearch.trigger(() => this.queryMcpSearch())${singleCatch};`;
		const singleDelayedGallery = `void this.delayedGallerySearch.trigger(() => this.queryGallerySnapshot())${singleCatch};`;

		assert.strictEqual((source.match(/void this\.refresh\(\)\.catch\(onUnexpectedError\);/g) ?? []).length, 6);
		assert.ok(source.includes(singleRefresh));
		assert.ok(source.includes(singleQuerySearch));
		assert.ok(source.includes(singleGallery));
		assert.ok(source.includes(singleGalleryReveal));
		assert.ok(source.includes(singleDelayedSearch));
		assert.ok(source.includes(singleDelayedGallery));

		assert.ok(!source.includes('void this.refresh();'));
		assert.ok(!source.includes('void this.queryMcpSearch();'));
		assert.ok(!source.includes('void this.queryGallerySnapshot();'));
		assert.ok(!source.includes('void this.queryGallerySnapshot(true);'));
		assert.ok(!source.includes('this.delayedGallerySearch.trigger(() => this.queryMcpSearch());'));
		assert.ok(!source.includes('this.delayedGallerySearch.trigger(() => this.queryGallerySnapshot());'));
		assert.ok(!source.replaceAll(singleRefresh, '').includes('\t\t\tthis.refresh();'));
		assert.ok(!source.includes('.catch(() => undefined)'));
		assert.ok(!source.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));
	});

	test('mcpListWidget leftover async action / installMarketplaceServer voids single-catch onUnexpectedError', () => {
		const source = fs.readFileSync(mcpListWidgetSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const singleInstall = `void this.installMarketplaceServer(server, install)${singleCatch}`;

		assert.ok(!source.includes('void action();'));
		assert.ok(source.includes('const result = action();'));
		assert.ok(source.includes(`if (result instanceof Promise) {\n\t\t\tvoid result${singleCatch};\n\t\t}`));
		assert.strictEqual((source.match(/void this\.installMarketplaceServer\(server, install\)\.catch\(onUnexpectedError\)/g) ?? []).length, 2);
		assert.ok(source.includes(singleInstall));
		assert.ok(!source.includes('install.onDidClick(() => this.installMarketplaceServer(server, install));'));
		assert.ok(!source.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));
	});

	test('mcpListWidget leftover executeCommand click voids single-catch onUnexpectedError', () => {
		const source = fs.readFileSync(mcpListWidgetSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const singleAddConfiguration = `void this.commandService.executeCommand(McpCommandIds.AddConfiguration)${singleCatch}`;
		const singleOpenSettings = `void this.commandService.executeCommand('workbench.action.openSettings', \`@id:\${mcpAccessConfig}\`)${singleCatch}`;

		assert.strictEqual((source.match(/void this\.commandService\.executeCommand\(McpCommandIds\.AddConfiguration\)\.catch\(onUnexpectedError\)/g) ?? []).length, 2);
		assert.ok(source.includes(singleAddConfiguration));
		assert.ok(source.includes(singleOpenSettings));
		assert.ok(!source.includes('onDidClick(() => this.commandService.executeCommand(McpCommandIds.AddConfiguration));'));
		assert.ok(!source.includes("this.commandService.executeCommand('workbench.action.openSettings', `@id:${mcpAccessConfig}`);"));
		assert.ok(!source.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));
	});

	test('mcpListWidget leftover delayedFilter.trigger Promise is single-caught (D600)', () => {
		const source = fs.readFileSync(mcpListWidgetSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const singleFilter = `void this.delayedFilter.trigger(() => this.filterServers())${singleCatch};`;
		assert.strictEqual((source.match(/this\.delayedFilter\.trigger\(/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\.delayedFilter\.trigger\(\(\) => this\.filterServers\(\)\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.ok(source.includes(singleFilter));
		assert.ok(!source.includes('this.delayedFilter.trigger(() => this.filterServers());'));
		assert.ok(!source.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));
	});
});
