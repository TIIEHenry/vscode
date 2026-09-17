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
const ONBOARDING_REL = 'src/vs/workbench/contrib/welcomeOnboarding/browser/onboardingVariationA.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/welcomeOnboarding/browser/welcomeOnboarding.contribution.ts';
const COMMANDS_REL = 'src/vs/platform/commands/common/commands.ts';
const THEME_REL = 'src/vs/workbench/services/themes/common/workbenchThemeService.ts';
const CONFIG_REL = 'src/vs/platform/configuration/common/configuration.ts';

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

function assertDoubleChain(source: string, call: string, count: number): void {
	assert.strictEqual((source.match(new RegExp(call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, count, `count mismatch: ${call}`);
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`), `single-chain remains: ${call}`);
}

suite('welcomeOnboarding leftover Promise fire-and-forget catch scan (D776)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover Promise fire-and-forget sites are Promise/async + double-chain; D689 already-double stays', () => {
		const source = fs.readFileSync(resolveSource(ONBOARDING_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		const theme = fs.readFileSync(resolveSource(THEME_REL), 'utf8');
		const config = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		assert.ok(source.includes("import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertPromiseSignature(source, 'private async _handleSignIn(socialProvider?: string): Promise<void> {');
		assertPromiseSignature(source, 'private async _handleEnterpriseSignIn(): Promise<void> {');
		assertPromiseSignature(source, 'private async _selectTheme(theme: IOnboardingThemeOption): Promise<void> {');
		assertPromiseSignature(source, 'private async _applyKeymap(keymapId: string): Promise<void> {');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assertPromiseSignature(theme, 'setColorTheme(themeId: string | undefined | IWorkbenchColorTheme, settingsTarget: ThemeSettingTarget): Promise<IWorkbenchColorTheme | null>;');
		assertPromiseSignature(config, 'updateValue(key: string, value: unknown, target: ConfigurationTarget): Promise<void>;');
		assertDoubleChain(source, 'this._applyKeymap(this.selectedKeymapId)', 1);
		assert.ok(source.includes(`this._handleSignIn()${doubleCatch};`));
		assert.ok(source.includes('await this._handleSignIn();'));
		assert.ok(!source.includes('\t\t\tthis._handleSignIn();\n'));
		assertDoubleChain(source, "this._handleSignIn('google')", 1);
		assertDoubleChain(source, "this._handleSignIn('apple')", 1);
		assertDoubleChain(source, 'void this._handleEnterpriseSignIn()', 1);
		const defaultSetupThen = `this.commandService.executeCommand('workbench.action.chat.triggerSetup', undefined, {
						disableChatViewReveal: true,
						setupStrategy: ChatSetupStrategy.DefaultSetup,
					})`;
		assert.ok(source.includes(`${defaultSetupThen}${doubleCatch};`));
		assert.ok(!source.includes(`${defaultSetupThen};`));
		assert.ok(!source.includes(`${defaultSetupThen}.catch(onUnexpectedError);`));
		assertDoubleChain(source, 'this._selectTheme(theme)', 1);
		assertDoubleChain(source, 'this.themeService.setColorTheme(match.id, ConfigurationTarget.USER)', 1);
		assertDoubleChain(source, "this.configurationService.updateValue('chat.agent.autoFix', false, ConfigurationTarget.USER)", 1);
		assertDoubleChain(source, "this.configurationService.updateValue('chat.agent.autoFix', true, ConfigurationTarget.USER)", 2);
		assertDoubleChain(source, 'this._detectInstalledEditors().then(ids => { this._detectedEditorIds = ids; })', 1);
		assert.strictEqual((source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 12);
	});

	test('opener / D145 / Resolve / Connect / Watch / Pty / Action2.run / already-double / invented proto stay skipped', () => {
		const source = fs.readFileSync(resolveSource(ONBOARDING_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		assert.ok(source.includes("link.rel = 'noopener';"));
		assert.ok(!source.includes(`link.rel = 'noopener'${doubleCatch}`));
		assert.ok(!source.includes('openerService.open('));
		assert.ok(!source.includes('acknowledge('));
		assert.ok(!source.includes('releaseLease('));
		assert.ok(source.includes('this.defaultAccountService.resolveGitHubUrl(GitHubPaths.copilotSettings)'));
		assert.ok(!source.includes(`this.defaultAccountService.resolveGitHubUrl(GitHubPaths.copilotSettings)${doubleCatch}`));
		assert.ok(source.includes('void submitAction.run();'));
		assert.ok(!source.includes(`void submitAction.run()${doubleCatch}`));
		assert.ok(contrib.includes('run(accessor: ServicesAccessor): void {'));
		assert.ok(!contrib.includes(`onboardingService.show()${doubleCatch}`));
		assert.ok(source.includes('await this.commandService.executeCommand<boolean>(\'workbench.action.chat.triggerSetup\', undefined, {'));
		assert.ok(source.includes('await this.configurationService.updateValue(defaultChat.providerUriSetting, resolvedUri, ConfigurationTarget.USER);'));
		assert.ok(!source.includes('Wire('));
		assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
	});
});
