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
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const KEYBINDINGS_REL = 'src/vs/workbench/contrib/preferences/browser/keybindingsEditorContribution.ts';
const WELCOME_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts';
const WELCOME_SERVICE_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStartedService.ts';
const STARTUP_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/startupPage.ts';
const ONBOARDING_REL = 'src/vs/workbench/contrib/welcomeOnboarding/browser/onboardingVariationA.ts';

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

function assertDoubleChain(source: string, call: string, count: number): void {
	assert.strictEqual((source.match(new RegExp(call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, count);
	assert.ok(source.includes(`${call}${doubleCatch};`));
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

suite('tasks/preferences/welcome leftover Promise fire-and-forget catch scan (D689)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('tasks abstractTaskService leftover registerCommands / reconnect thens are double-chain', () => {
		const source = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		assert.ok(source.includes("import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleChain(source, 'this._registerCommands().then(() => TaskCommandsRegistered.bindTo(this._contextKeyService).set(true))', 1);
		const reconnectThen = `this.getWorkspaceTasks(TaskRunSource.Reconnect).then(async () => {
			this._tasksReconnected = await this._reconnectTasks();
			this._log(nls.localize('TaskService.reconnected', 'Reconnected to running tasks.'), true);
			this._onDidReconnectToTasks.fire();
		})`;
		assert.ok(source.includes(`${reconnectThen}${doubleCatch};`));
		assert.ok(!source.includes(`${reconnectThen};`));
		assert.ok(!source.includes(`${reconnectThen}.catch(onUnexpectedError);`));
	});

	test('preferences leftover onConfigUpdate / defineWidget.start thens are double-chain', () => {
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const keybindings = fs.readFileSync(resolveSource(KEYBINDINGS_REL), 'utf8');
		assert.ok(settings.includes("import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(keybindings.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const configThen = `this.onConfigUpdate(undefined, true).then(() => {
			// This event runs when the editor closes.
			this.inputChangeListener.value = input.onWillDispose(() => {
				this.searchWidget.setValue('');
			});

			// Init TOC selection
			this.updateTreeScrollSync();
		})`;
		assert.ok(settings.includes(`${configThen}${doubleCatch};`));
		assert.ok(!settings.includes(`${configThen};`));
		assert.ok(!settings.includes(`${configThen}.catch(onUnexpectedError);`));
		assertDoubleChain(keybindings, 'this._defineWidget.start().then(keybinding => this._onAccepted(keybinding))', 1);
	});

	test('welcome leftover getEnvironment / getInstalled / detectEditors / run are double-chain; Resolve stays skipped', () => {
		const contribution = fs.readFileSync(resolveSource(WELCOME_CONTRIB_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(WELCOME_SERVICE_REL), 'utf8');
		const startup = fs.readFileSync(resolveSource(STARTUP_REL), 'utf8');
		const onboarding = fs.readFileSync(resolveSource(ONBOARDING_REL), 'utf8');
		assert.ok(contribution.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(service.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(startup.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(onboarding.includes("import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		const envThen = `this.remoteAgentService.getEnvironment().then(env => {
			const remoteOS = env?.os;

			const remotePlatform = remoteOS === OS.Macintosh ? 'mac'
				: remoteOS === OS.Windows ? 'windows'
					: remoteOS === OS.Linux ? 'linux'
						: undefined;

			if (remotePlatform) {
				WorkspacePlatform.bindTo(this.contextService).set(remotePlatform);
			} else if (this.extensionManagementServerService.localExtensionManagementServer) {
				if (isMacintosh) {
					WorkspacePlatform.bindTo(this.contextService).set('mac');
				} else if (isLinux) {
					WorkspacePlatform.bindTo(this.contextService).set('linux');
				} else if (isWindows) {
					WorkspacePlatform.bindTo(this.contextService).set('windows');
				}
			} else if (this.extensionManagementServerService.webExtensionManagementServer) {
				WorkspacePlatform.bindTo(this.contextService).set('webworker');
			} else {
				console.error('Error: Unable to detect workspace platform');
			}
		})`;
		assert.ok(contribution.includes(`${envThen}${doubleCatch};`));
		assert.ok(!contribution.includes(`${envThen};`));
		assert.ok(!contribution.includes(`${envThen}.catch(onUnexpectedError);`));
		const installedThen = `this.extensionManagementService.getInstalled().then(installed => {
			installed.forEach(ext => this.progressByEvent(\`extensionInstalled:\${ext.identifier.id.toLowerCase()}\`));
		})`;
		assert.ok(service.includes(`${installedThen}${doubleCatch};`));
		assert.ok(!service.includes(`${installedThen};`));
		assert.ok(!service.includes(`${installedThen}.catch(onUnexpectedError);`));
		assertDoubleChain(onboarding, 'this._detectInstalledEditors().then(ids => { this._detectedEditorIds = ids; })', 1);
		assertDoubleChain(startup, 'this.run()', 1);
		assert.ok(!startup.includes('this.run().then(undefined, onUnexpectedError);'));
		assert.ok(startup.includes('const folderStat = await this.fileService.resolve(folderUri).catch(onUnexpectedError);'));
		assert.ok(!startup.includes('this.fileService.resolve(folderUri).catch(onUnexpectedError).catch(onUnexpectedError)'));
	});
});
