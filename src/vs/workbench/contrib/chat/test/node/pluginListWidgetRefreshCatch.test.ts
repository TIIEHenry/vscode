/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

suite('pluginListWidget refresh fire-and-forget (D556)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('pluginListWidget fire-and-forget refresh voids double-catch onUnexpectedError', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = readPluginListWidgetSource();
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleRefresh = `void this.refresh()${doubleCatch};`;
		assert.strictEqual((source.match(/void this\.refresh\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 7);
		assert.ok(source.includes(doubleRefresh));
		assert.ok(source.includes('onUnexpectedError'));
		assert.ok(!source.includes('void this.refresh();'));
		assert.ok(!source.includes('void this.refresh().catch(onUnexpectedError);'));
	});

	test('pluginListWidget fire-and-forget queryMarketplace voids double-catch onUnexpectedError (D564)', () => {
		const source = readPluginListWidgetSource();
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleSnapshot = `void this.queryMarketplaceSnapshot()${doubleCatch};`;
		const doubleQuery = `void this.queryMarketplace()${doubleCatch};`;
		assert.strictEqual((source.match(/void this\.queryMarketplaceSnapshot\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 2);
		assert.strictEqual((source.match(/void this\.queryMarketplace\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.ok(source.includes(doubleSnapshot));
		assert.ok(source.includes(doubleQuery));
		assert.ok(!source.includes('void this.queryMarketplaceSnapshot();'));
		assert.ok(!source.includes('void this.queryMarketplace();'));
		assert.ok(!source.includes('void this.queryMarketplaceSnapshot().catch(onUnexpectedError);'));
		assert.ok(!source.includes('void this.queryMarketplace().catch(onUnexpectedError);'));
	});

	test('pluginListWidget fire-and-forget filterPlugins voids double-catch onUnexpectedError (D572)', () => {
		const source = readPluginListWidgetSource();
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleFilter = `void this.filterPlugins()${doubleCatch};`;
		assert.strictEqual((source.match(/void this\.filterPlugins\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 2);
		assert.ok(source.includes(doubleFilter));
		assert.ok(!source.includes('void this.filterPlugins();'));
		assert.ok(!source.includes('void this.filterPlugins().catch(onUnexpectedError);'));
	});

	test('pluginListWidget leftover installMarketplacePlugin voids double-catch onUnexpectedError (D580)', () => {
		const source = readPluginListWidgetSource();
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleInstall = `void this.installMarketplacePlugin(item, install)${doubleCatch}`;
		assert.strictEqual((source.match(/void this\.installMarketplacePlugin\(item, install\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 2);
		assert.ok(source.includes(doubleInstall));
		assert.ok(!source.includes('install.onDidClick(() => this.installMarketplacePlugin(item, install));'));
		assert.ok(!source.includes('void this.installMarketplacePlugin(item, install).catch(onUnexpectedError);'));
	});

	test('pluginListWidget leftover list-renderer Install onDidClick voids double-catch onUnexpectedError (D588)', () => {
		const source = readPluginListWidgetSource();
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		assert.strictEqual((source.match(/void \(async \(\) => \{/g) ?? []).length, 1);
		assert.strictEqual((source.match(/\)\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.ok(source.includes(`})()${doubleCatch};`));
		assert.ok(source.includes('await this.pluginInstallService.installPlugin({'));
		assert.ok(!source.includes('installButton.onDidClick(async () => {'));
		assert.ok(!source.includes('onDidClick(async () => {'));
		assert.ok(!source.includes('})().catch(onUnexpectedError);'));
	});

	test('pluginListWidget leftover Delayer triggers void double-catch onUnexpectedError (D596)', () => {
		const source = readPluginListWidgetSource();
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleMarketplace = `void this.delayedMarketplaceSearch.trigger(() => this.queryMarketplace())${doubleCatch};`;
		const doublePluginSearch = `void this.delayedMarketplaceSearch.trigger(() => this.queryPluginSearch())${doubleCatch};`;
		const doubleFilter = `void this.delayedFilter.trigger(() => this.filterPlugins())${doubleCatch};`;
		assert.strictEqual((source.match(/void this\.delayedMarketplaceSearch\.trigger\(\(\) => this\.queryMarketplace\(\)\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\.delayedMarketplaceSearch\.trigger\(\(\) => this\.queryPluginSearch\(\)\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\.delayedFilter\.trigger\(\(\) => this\.filterPlugins\(\)\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.ok(source.includes(doubleMarketplace));
		assert.ok(source.includes(doublePluginSearch));
		assert.ok(source.includes(doubleFilter));
		assert.ok(!source.includes('this.delayedMarketplaceSearch.trigger(() => this.queryMarketplace());'));
		assert.ok(!source.includes('this.delayedMarketplaceSearch.trigger(() => this.queryPluginSearch());'));
		assert.ok(!source.includes('this.delayedFilter.trigger(() => this.filterPlugins());'));
		assert.ok(!source.includes('void this.delayedMarketplaceSearch.trigger(() => this.queryMarketplace()).catch(onUnexpectedError);'));
		assert.ok(!source.includes('void this.delayedMarketplaceSearch.trigger(() => this.queryPluginSearch()).catch(onUnexpectedError);'));
		assert.ok(!source.includes('void this.delayedFilter.trigger(() => this.filterPlugins()).catch(onUnexpectedError);'));
	});

	test('pluginListWidget refresh awaits leftover filterPlugins (D612)', () => {
		const source = readPluginListWidgetSource();
		const refresh = source.match(/private async refresh\(\): Promise<void> \{[\s\S]*?\n\t\}/);
		assert.ok(refresh, 'refresh() method not found');
		assert.ok(refresh[0].includes('await this.filterPlugins();'));
		assert.ok(refresh[0].includes('await this.queryMarketplace();'));
		assert.ok(refresh[0].includes('await this.queryPluginSearch();'));
		assert.ok(!/^\t+this\.filterPlugins\(\);$/m.test(refresh[0]));
		assert.ok(!/^\t+this\.filterPlugins\(\);$/m.test(source));
		assert.strictEqual((source.match(/await this\.filterPlugins\(\);/g) ?? []).length, 3);
		assert.strictEqual((source.match(/void this\.filterPlugins\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 2);
	});
});

function readPluginListWidgetSource(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const relative = 'src/vs/workbench/contrib/chat/browser/aiCustomization/pluginListWidget.ts';
	const candidates = [
		path.join(process.cwd(), relative),
		path.join(thisDir, '../../../../../../../', relative),
	];
	const filePath = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(filePath, 'pluginListWidget.ts not found from cwd or import.meta');
	return fs.readFileSync(filePath, 'utf8');
}
