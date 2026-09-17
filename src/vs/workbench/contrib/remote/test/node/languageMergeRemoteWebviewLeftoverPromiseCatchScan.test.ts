/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const LANGUAGE_REL = 'src/vs/workbench/contrib/codeEditor/common/languageConfigurationExtensionPoint.ts';
const MERGE_MODEL_REL = 'src/vs/workbench/contrib/mergeEditor/browser/model/mergeEditorModel.ts';
const TEXT_DIFFS_REL = 'src/vs/workbench/contrib/mergeEditor/browser/model/textModelDiffs.ts';
const DIFF_COMPUTER_REL = 'src/vs/workbench/contrib/mergeEditor/browser/model/diffComputer.ts';
const REMOTE_REL = 'src/vs/workbench/contrib/remote/browser/remote.ts';
const REMOTE_EXPLORER_REL = 'src/vs/workbench/contrib/remote/browser/remoteExplorer.ts';
const REMOTE_CONTRIB_REL = 'src/vs/workbench/contrib/remote/common/remote.contribution.ts';
const WEBVIEW_REL = 'src/vs/workbench/contrib/webview/browser/webviewElement.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const REMOTE_AGENT_REL = 'src/vs/workbench/services/remote/common/remoteAgentService.ts';
const DIALOGS_REL = 'src/vs/platform/dialogs/common/dialogs.ts';
const CONFIG_REL = 'src/vs/workbench/services/configuration/common/configuration.ts';
const IFRAME_REL = 'src/vs/base/browser/iframe.ts';

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

suite('language/merge/remote/webview leftover Promise fire-and-forget catch scan (D692)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('language leftover whenInstalledExtensionsRegistered then is Promise double-chain; onDidChange load stays skipped', () => {
		const source = fs.readFileSync(resolveSource(LANGUAGE_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		assertPromiseSignature(extensions, 'whenInstalledExtensionsRegistered(): Promise<boolean>');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const registeredThen = `this._extensionService.whenInstalledExtensionsRegistered().then(() => {
				this._loadConfigurationsForMode(languageIdentifier);
			})`;
		assert.ok(source.includes(`${registeredThen}${doubleCatch};`));
		assert.ok(!source.includes(`${registeredThen};`));
		assert.ok(!source.includes(`${registeredThen}.catch(onUnexpectedError);`));
		assert.ok(source.includes('private async _loadConfigurationsForMode(languageId: string): Promise<void> {'));
		assert.ok(source.includes('\t\t\t\tthis._loadConfigurationsForMode(languageId);'));
		assert.ok(!source.includes('this._loadConfigurationsForMode(languageId).catch'));
	});

	test('merge leftover initializePromise / computeDiff thens are Promise double-chain; sync void _recompute stays skipped', () => {
		const merge = fs.readFileSync(resolveSource(MERGE_MODEL_REL), 'utf8');
		const diffs = fs.readFileSync(resolveSource(TEXT_DIFFS_REL), 'utf8');
		const computer = fs.readFileSync(resolveSource(DIFF_COMPUTER_REL), 'utf8');
		assertPromiseSignature(merge, 'private async initialize(): Promise<void> {');
		assertPromiseSignature(computer, 'computeDiff(textModel1: ITextModel, textModel2: ITextModel, reader: IReader): Promise<IMergeDiffComputerResult>;');
		assert.ok(merge.includes('import { BugIndicatingError, onUnexpectedError } from \'../../../../../base/common/errors.js\';'));
		assert.ok(diffs.includes('import { BugIndicatingError, onUnexpectedError } from \'../../../../../base/common/errors.js\';'));
		assert.ok(merge.includes(`initializePromise.then(() => {
			let shouldRecomputeHandledFromAccepted = true;`));
		assert.ok(merge.includes(`				)
			);
		})${doubleCatch};`));
		assert.ok(!merge.includes(`				)
			);
		});
	}

	private async initialize(): Promise<void> {`));
		assert.ok(diffs.includes(`result.then((result) => {
			if (this._isDisposed) {
				return;
			}`));
		assert.ok(diffs.includes(`				this._isInitializing = false;
			});
		})${doubleCatch};`));
		assert.ok(!diffs.includes(`				this._isInitializing = false;
			});
		});
	}

	private ensureUpToDate(): void {`));
		assert.ok(diffs.includes('private _recompute(reader: IReader): void {'));
		assert.ok(diffs.includes('\t\t\tthis._recompute(reader);'));
		assert.ok(!diffs.includes('this._recompute(reader).catch'));
	});

	test('remote leftover getEnvironment / confirm / whenRemoteConfigurationLoaded thens are Promise double-chain', () => {
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		const explorer = fs.readFileSync(resolveSource(REMOTE_EXPLORER_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(REMOTE_CONTRIB_REL), 'utf8');
		const agent = fs.readFileSync(resolveSource(REMOTE_AGENT_REL), 'utf8');
		const dialogs = fs.readFileSync(resolveSource(DIALOGS_REL), 'utf8');
		const config = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		assertPromiseSignature(agent, 'getEnvironment(): Promise<IRemoteAgentEnvironment | null>;');
		assertPromiseSignature(dialogs, 'confirm(confirmation: IConfirmation): Promise<IConfirmationResult>;');
		assertPromiseSignature(config, 'whenRemoteConfigurationLoaded(): Promise<void>;');
		assert.ok(remote.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(explorer.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(contrib.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const markersThen = `remoteAgentService.getEnvironment().then(remoteEnv => {
			if (remoteEnv) {
				timerService.setPerformanceMarks('server', remoteEnv.marks);
			}
		})`;
		assert.ok(remote.includes(`${markersThen}${doubleCatch};`));
		assert.ok(!remote.includes(`${markersThen};`));
		assert.ok(!remote.includes(`${markersThen}.catch(onUnexpectedError);`));
		const confirmThen = `dialogService.confirm({
								type: Severity.Error,
								message: nls.localize('reconnectionPermanentFailure', "Cannot reconnect. Please reload the window."),
								primaryButton: nls.localize({ key: 'reloadWindow.dialog', comment: ['&& denotes a mnemonic'] }, "&&Reload Window")
							}).then(result => {
								if (result.confirmed) {
									commandService.executeCommand(ReloadWindowAction.ID);
								}
							})`;
		assert.ok(remote.includes(`${confirmThen}${doubleCatch};`));
		assert.ok(!remote.includes(`${confirmThen};`));
		assert.ok(!remote.includes(`${confirmThen}.catch(onUnexpectedError);`));
		const explorerThen = `configurationService.whenRemoteConfigurationLoaded().then(() => remoteAgentService.getEnvironment()).then(environment => {
			this.setup(environment);
			this._register(configurationService.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration(PORT_AUTO_SOURCE_SETTING)) {
					this.setup(environment);
				} else if (e.affectsConfiguration(PORT_AUTO_FALLBACK_SETTING) && !this.portListener) {
					this.listenForPorts();
				}
			}));
		})`;
		assert.ok(explorer.includes(`${explorerThen}${doubleCatch};`));
		assert.ok(!explorer.includes(`${explorerThen};`));
		assert.ok(!explorer.includes(`${explorerThen}.catch(onUnexpectedError);`));
		assert.ok(contrib.includes('this.remoteAgentService.getEnvironment().then(remoteEnvironment => {'));
		assert.ok(contrib.includes(`			}
		})${doubleCatch};`));
		assert.ok(!contrib.includes(`			}
		});
	}
}

class RemoteChannelsContribution`));
		assert.strictEqual((contrib.match(/this\.remoteAgentService\.getEnvironment\(\)\.then\(remoteEnvironment => \{/g) ?? []).length, 1);
		const detectorThen = `remoteAgentService.getEnvironment().then(remoteEnv => {
				if (remoteEnv) {
					// we use the presence of \`remoteEnv\` to figure out
					// if we got a healthy remote connection
					// (see https://github.com/microsoft/vscode/issues/135331)
					this.validateRemoteWorkspace();
				}
			})`;
		assert.ok(contrib.includes(`${detectorThen}${doubleCatch};`));
		assert.ok(!contrib.includes(`${detectorThen};`));
		assert.ok(!contrib.includes(`${detectorThen}.catch(onUnexpectedError);`));
	});

	test('webview leftover origin Promise then is double-chain', () => {
		const source = fs.readFileSync(resolveSource(WEBVIEW_REL), 'utf8');
		const iframe = fs.readFileSync(resolveSource(IFRAME_REL), 'utf8');
		assertPromiseSignature(source, 'private _encodedWebviewOriginPromise?: Promise<string>;');
		assertPromiseSignature(iframe, 'export async function parentOriginHash(parentOrigin: string, salt: string): Promise<string> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const originThen = `this._encodedWebviewOriginPromise.then(encodedWebviewOrigin => {
			if (!this._disposed) {
				this._initElement(encodedWebviewOrigin, this.extension, this._options, targetWindow);
			}
		})`;
		assert.ok(source.includes(`${originThen}${doubleCatch};`));
		assert.ok(!source.includes(`${originThen};`));
		assert.ok(!source.includes(`${originThen}.catch(onUnexpectedError);`));
	});

	test('opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty stay skipped', () => {
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		const explorer = fs.readFileSync(resolveSource(REMOTE_EXPLORER_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(REMOTE_CONTRIB_REL), 'utf8');
		const diffs = fs.readFileSync(resolveSource(TEXT_DIFFS_REL), 'utf8');
		assert.ok(remote.includes('this.openerService.open(urlOrWalkthroughId, { allowCommands: true });'));
		assert.ok(!remote.includes('this.openerService.open(urlOrWalkthroughId, { allowCommands: true }).catch'));
		assert.ok(remote.includes('await this.openerService.open(URI.parse(url), { allowCommands: true });'));
		assert.ok(!remote.includes(`this.openerService.open(URI.parse(url), { allowCommands: true })${doubleCatch}`));
		assert.ok(explorer.includes('await OpenPortInBrowserAction.run(this.remoteExplorerService.tunnelModel, this.openerService, address);'));
		assert.ok(!explorer.includes(`this.openerService.open${doubleCatch}`));
		assert.ok(!remote.includes('acknowledge('));
		assert.ok(!remote.includes('releaseLease('));
		assert.ok(!explorer.includes('acknowledge('));
		assert.ok(!contrib.includes('acknowledge('));
		assert.ok(diffs.includes('private _recompute(reader: IReader): void {'));
		assert.ok(diffs.includes('\t\t\tthis._recompute(reader);'));
		assert.ok(!diffs.includes('this._recompute(reader).catch'));
		for (const source of [remote, explorer, contrib]) {
			assert.ok(!source.includes('Wire('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
