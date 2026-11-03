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

	test('pluginListWidget fire-and-forget refresh voids catch onUnexpectedError', () => {
		const source = readPluginListWidgetSource();
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const singleRefresh = `void this.refresh()${singleCatch};`;
		assert.strictEqual((source.match(/void this\.refresh\(\)\.catch\(onUnexpectedError\);/g) ?? []).length, 7);
		assert.ok(source.includes(singleRefresh));
		assert.ok(source.includes('onUnexpectedError'));
		assert.ok(!source.includes('void this.refresh();'));
		assert.ok(!source.includes(`void this.refresh()${doubleCatch};`));
	});

	test('pluginListWidget fire-and-forget queryMarketplace voids catch onUnexpectedError (D564)', () => {
		const source = readPluginListWidgetSource();
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const singleSnapshot = `void this.queryMarketplaceSnapshot()${singleCatch};`;
		const singleQuery = `void this.queryMarketplace()${singleCatch};`;
		assert.strictEqual((source.match(/void this\.queryMarketplaceSnapshot\(\)\.catch\(onUnexpectedError\);/g) ?? []).length, 2);
		assert.strictEqual((source.match(/void this\.queryMarketplace\(\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.ok(source.includes(singleSnapshot));
		assert.ok(source.includes(singleQuery));
		assert.ok(!source.includes('void this.queryMarketplaceSnapshot();'));
		assert.ok(!source.includes('void this.queryMarketplace();'));
		assert.ok(!source.includes(`void this.queryMarketplaceSnapshot()${doubleCatch};`));
		assert.ok(!source.includes(`void this.queryMarketplace()${doubleCatch};`));
	});

	test('pluginListWidget fire-and-forget filterPlugins voids catch onUnexpectedError (D572)', () => {
		const source = readPluginListWidgetSource();
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const singleFilter = `void this.filterPlugins()${singleCatch};`;
		assert.strictEqual((source.match(/void this\.filterPlugins\(\)\.catch\(onUnexpectedError\);/g) ?? []).length, 2);
		assert.ok(source.includes(singleFilter));
		assert.ok(!source.includes('void this.filterPlugins();'));
		assert.ok(!source.includes(`void this.filterPlugins()${doubleCatch};`));
	});

	test('pluginListWidget leftover installMarketplacePlugin voids catch onUnexpectedError (D580)', () => {
		const source = readPluginListWidgetSource();
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const singleInstall = `void this.installMarketplacePlugin(item, install)${singleCatch}`;
		assert.strictEqual((source.match(/void this\.installMarketplacePlugin\(item, install\)\.catch\(onUnexpectedError\)/g) ?? []).length, 2);
		assert.ok(source.includes(singleInstall));
		assert.ok(!source.includes('install.onDidClick(() => this.installMarketplacePlugin(item, install));'));
		assert.ok(!source.includes(`void this.installMarketplacePlugin(item, install)${doubleCatch}`));
	});

	test('pluginListWidget leftover list-renderer Install onDidClick voids catch onUnexpectedError (D588)', () => {
		const source = readPluginListWidgetSource();
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		assert.strictEqual((source.match(/void \(async \(\) => \{/g) ?? []).length, 1);
		assert.strictEqual((source.match(/\)\(\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.ok(source.includes(`})()${singleCatch};`));
		assert.ok(!source.includes(`})()${doubleCatch};`));
		assert.ok(source.includes('await this.pluginInstallService.installPlugin({'));
		assert.ok(!source.includes('installButton.onDidClick(async () => {'));
		assert.ok(!source.includes('onDidClick(async () => {'));
	});

	test('pluginListWidget leftover Delayer triggers void catch onUnexpectedError (D596)', () => {
		const source = readPluginListWidgetSource();
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const singleMarketplace = `void this.delayedMarketplaceSearch.trigger(() => this.queryMarketplace())${singleCatch};`;
		const singlePluginSearch = `void this.delayedMarketplaceSearch.trigger(() => this.queryPluginSearch())${singleCatch};`;
		const singleFilter = `void this.delayedFilter.trigger(() => this.filterPlugins())${singleCatch};`;
		assert.strictEqual((source.match(/void this\.delayedMarketplaceSearch\.trigger\(\(\) => this\.queryMarketplace\(\)\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\.delayedMarketplaceSearch\.trigger\(\(\) => this\.queryPluginSearch\(\)\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\.delayedFilter\.trigger\(\(\) => this\.filterPlugins\(\)\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.ok(source.includes(singleMarketplace));
		assert.ok(source.includes(singlePluginSearch));
		assert.ok(source.includes(singleFilter));
		assert.ok(!source.includes('this.delayedMarketplaceSearch.trigger(() => this.queryMarketplace());'));
		assert.ok(!source.includes('this.delayedMarketplaceSearch.trigger(() => this.queryPluginSearch());'));
		assert.ok(!source.includes('this.delayedFilter.trigger(() => this.filterPlugins());'));
		assert.ok(!source.includes(`void this.delayedMarketplaceSearch.trigger(() => this.queryMarketplace())${doubleCatch};`));
		assert.ok(!source.includes(`void this.delayedMarketplaceSearch.trigger(() => this.queryPluginSearch())${doubleCatch};`));
		assert.ok(!source.includes(`void this.delayedFilter.trigger(() => this.filterPlugins())${doubleCatch};`));
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
		assert.strictEqual((source.match(/void this\.filterPlugins\(\)\.catch\(onUnexpectedError\);/g) ?? []).length, 2);
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
