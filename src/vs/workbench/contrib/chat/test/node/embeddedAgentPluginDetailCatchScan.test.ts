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
const DETAIL_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/embeddedAgentPluginDetail.ts';

function embeddedAgentPluginDetailSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), DETAIL_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/aiCustomization/embeddedAgentPluginDetail.ts'),
		path.join(thisDir, '../../../../../../../', DETAIL_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `embeddedAgentPluginDetail.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('EmbeddedAgentPluginDetail leftover fire-and-forget catch scan (D593)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('install / uninstall / copy / open onDidClick IIFEs double-catch onUnexpectedError; bare async gone in this file only', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(embeddedAgentPluginDetailSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		assert.ok(source.includes("import { getErrorMessage, isCancellationError, onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void \(async \(\) => \{/g) ?? []).length, 4);
		assert.strictEqual((source.match(/\)\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 4);
		assert.ok(source.includes(`})()${doubleCatch};`));
		assert.ok(source.includes('await this.pluginInstallService.installPlugin(marketplacePlugin);'));
		assert.ok(source.includes("localize('pluginInstallFailed', \"Unable to install plugin: {0}\", getErrorMessage(error))"));
		assert.ok(source.includes('await uninstallAction.runAndGetResult();'));
		assert.ok(source.includes("localize('pluginUninstallFailed', \"Unable to uninstall plugin: {0}\", getErrorMessage(error))"));
		assert.ok(source.includes('await this.clipboardService.writeText(uri.fsPath || uri.toString());'));
		assert.ok(source.includes("await this.commandService.executeCommand('revealFileInOS', uri);"));
		assert.ok(source.includes('await this.openerService.open(dirname(uri));'));
		assert.ok(source.includes('button.onDidClick(() => action.run())'));
		assert.ok(source.includes('splitButton.onDidClick(() => setEnablement(getPluginEnablementActionState(item.plugin.enablement.get()).primaryState))'));
		assert.ok(!source.includes('onDidClick(async () => {'));
		assert.ok(!source.includes('installButton.onDidClick(async () => {'));
		assert.ok(!source.includes('uninstallButton.onDidClick(async () => {'));
		assert.ok(!source.includes('copyButton.onDidClick(async () => {'));
		assert.ok(!source.includes('openButton.onDidClick(async () => {'));
		assert.ok(!source.includes('})().catch(onUnexpectedError);'));
	});
});
