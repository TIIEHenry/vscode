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
const ELECTRON_REL = 'src/vs/workbench/contrib/remote/electron-browser/remote.contribution.ts';
const TUNNEL_REL = 'src/vs/workbench/contrib/remote/browser/tunnelView.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/common/lifecycle.ts';
const NATIVE_REL = 'src/vs/platform/native/common/native.ts';
const AGENT_REL = 'src/vs/workbench/services/remote/common/remoteAgentService.ts';
const EXPLORER_REL = 'src/vs/workbench/services/remote/common/remoteExplorerService.ts';
const REMOTE_REL = 'src/vs/workbench/contrib/remote/browser/remote.ts';
const REMOTE_EXPLORER_REL = 'src/vs/workbench/contrib/remote/browser/remoteExplorer.ts';
const REMOTE_CONTRIB_REL = 'src/vs/workbench/contrib/remote/common/remote.contribution.ts';

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

suite('remote electron-browser / tunnel leftover Promise fire-and-forget catch scan (D702)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers six leftover Promise double-chain sites', () => {
		const electron = fs.readFileSync(resolveSource(ELECTRON_REL), 'utf8');
		const tunnel = fs.readFileSync(resolveSource(TUNNEL_REL), 'utf8');
		const sites = (electron.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length
			+ (tunnel.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		assert.strictEqual(sites, 6);
	});

	test('electron leftover when / nested hasWSLFeatureInstalled thens are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(ELECTRON_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		assertPromiseSignature(lifecycle, 'when(phase: LifecyclePhase): Promise<void>;');
		assertPromiseSignature(native, 'hasWSLFeatureInstalled(): Promise<boolean>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const whenThen = `lifecycleService.when(LifecyclePhase.Eventually).then(async () => {
				nativeHostService.hasWSLFeatureInstalled().then(res => {
					if (res) {
						contextKey.set(true);
						// once detected, set to true
						storageService.store(storageKey, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
					}
				}).catch(onUnexpectedError).catch(onUnexpectedError);
			})`;
		assert.ok(source.includes(`${whenThen}${doubleCatch};`));
		assert.ok(!source.includes(`${whenThen};`));
		assert.ok(!source.includes(`${whenThen}.catch(onUnexpectedError);`));
		const innerThen = `nativeHostService.hasWSLFeatureInstalled().then(res => {
					if (res) {
						contextKey.set(true);
						// once detected, set to true
						storageService.store(storageKey, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
					}
				})`;
		assert.ok(source.includes(`${innerThen}${doubleCatch};`));
		assert.ok(!source.includes(`${innerThen};`));
		assert.ok(!source.includes(`${innerThen}.catch(onUnexpectedError);`));
	});

	test('electron leftover updateRemoteTelemetryEnablement calls are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(ELECTRON_REL), 'utf8');
		const agent = fs.readFileSync(resolveSource(AGENT_REL), 'utf8');
		assertPromiseSignature(source, 'private updateRemoteTelemetryEnablement(): Promise<void> {');
		assertPromiseSignature(agent, 'updateTelemetryLevel(telemetryLevel: TelemetryLevel): Promise<void>;');
		const call = 'this.updateRemoteTelemetryEnablement()';
		assert.strictEqual((source.match(/this\.updateRemoteTelemetryEnablement\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 2);
		assert.ok(source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
	});

	test('tunnelView leftover forward thens are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(TUNNEL_REL), 'utf8');
		const explorer = fs.readFileSync(resolveSource(EXPLORER_REL), 'utf8');
		assertPromiseSignature(explorer, 'forward(tunnelProperties: TunnelProperties, attributes?: Attributes | null): Promise<RemoteTunnel | string | undefined>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const inlineThen = `remoteExplorerService.forward({
							remote: { host: parsed.host, port: parsed.port },
							elevateIfNeeded: true
						}).then(tunnelOrError => error(notificationService, tunnelOrError, parsed!.host, parsed!.port))`;
		assert.ok(source.includes(`${inlineThen}${doubleCatch};`));
		assert.ok(!source.includes(`${inlineThen};`));
		assert.ok(!source.includes(`${inlineThen}.catch(onUnexpectedError);`));
		const paletteThen = `remoteExplorerService.forward({
					remote: { host: parsed.host, port: parsed.port },
					elevateIfNeeded: true
				}).then(tunnel => error(notificationService, tunnel, parsed!.host, parsed!.port))`;
		assert.ok(source.includes(`${paletteThen}${doubleCatch};`));
		assert.ok(!source.includes(`${paletteThen};`));
		assert.ok(!source.includes(`${paletteThen}.catch(onUnexpectedError);`));
	});

	test('opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty stay skipped; D692 already-double sites untouched', () => {
		const electron = fs.readFileSync(resolveSource(ELECTRON_REL), 'utf8');
		const tunnel = fs.readFileSync(resolveSource(TUNNEL_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		const explorer = fs.readFileSync(resolveSource(REMOTE_EXPLORER_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(REMOTE_CONTRIB_REL), 'utf8');
		assert.ok(tunnel.includes('return openerService.open(tunnel.localUri, { allowContributedOpeners: false });'));
		assert.ok(!tunnel.includes('return openerService.open(tunnel.localUri, { allowContributedOpeners: false }).catch'));
		assert.ok(tunnel.includes('return openerService.open(tunnel.localUri);'));
		assert.ok(!tunnel.includes('return openerService.open(tunnel.localUri).catch'));
		assert.ok(electron.includes('remoteAuthorityResolverService.resolveAuthority(remoteAuthority).then(() => {'));
		assert.ok(!electron.includes(`remoteAuthorityResolverService.resolveAuthority(remoteAuthority).then(() => {${doubleCatch}`));
		assert.ok(!/resolveAuthority\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(electron));
		assert.ok(electron.includes('.then(info => {'));
		assert.ok(electron.includes('.catch(e => {'));
		assert.ok(!electron.includes('acknowledge('));
		assert.ok(!electron.includes('releaseLease('));
		assert.ok(remote.includes(`remoteAgentService.getEnvironment().then(remoteEnv => {
			if (remoteEnv) {
				timerService.setPerformanceMarks('server', remoteEnv.marks);
			}
		})${doubleCatch};`));
		assert.ok(explorer.includes('}).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(contrib.includes('}).catch(onUnexpectedError).catch(onUnexpectedError);'));
		for (const source of [electron, tunnel]) {
			assert.ok(!source.includes('Wire('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
