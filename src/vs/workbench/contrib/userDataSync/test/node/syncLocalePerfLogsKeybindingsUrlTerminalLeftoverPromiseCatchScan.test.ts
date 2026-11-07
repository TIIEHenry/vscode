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
const SYNC_INIT_REL = 'src/vs/workbench/services/userDataSync/browser/userDataSyncInit.ts';
const LOCALE_REL = 'src/vs/workbench/contrib/localization/common/localizationsActions.ts';
const RENDERER_REL = 'src/vs/workbench/contrib/performance/electron-browser/rendererAutoProfiler.ts';
const STARTUP_REL = 'src/vs/workbench/contrib/performance/electron-browser/startupProfiler.ts';
const TIMER_REL = 'src/vs/workbench/services/timer/browser/timerService.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/common/lifecycle.ts';
const LOGS_REL = 'src/vs/workbench/contrib/logs/common/logsDataCleaner.ts';
const KEYBINDINGS_REL = 'src/vs/workbench/contrib/keybindings/browser/keybindings.contribution.ts';
const URL_VALIDATOR_REL = 'src/vs/workbench/contrib/url/browser/trustedDomainsValidator.ts';
const URL_CONTRIB_REL = 'src/vs/workbench/contrib/url/browser/url.contribution.ts';
const TERMINAL_ELECTRON_REL = 'src/vs/workbench/contrib/externalTerminal/electron-browser/externalTerminal.contribution.ts';
const TERMINAL_BROWSER_REL = 'src/vs/workbench/contrib/externalTerminal/browser/externalTerminal.contribution.ts';
const STARTUP_TIMINGS_REL = 'src/vs/workbench/contrib/performance/electron-browser/startupTimings.ts';

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

suite('userDataSync/localization/performance/logs/keybindings/url/externalTerminal leftover Promise fire-and-forget catch scan (D694)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers eight leftover Promise double-chain sites', () => {
		const files = [
			SYNC_INIT_REL, LOCALE_REL, RENDERER_REL, STARTUP_REL,
			LOGS_REL, KEYBINDINGS_REL, URL_VALIDATOR_REL, TERMINAL_ELECTRON_REL,
		];
		let sites = 0;
		for (const rel of files) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			sites += (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		}
		assert.strictEqual(files.length, 8);
		assert.strictEqual(sites, 8);
	});

	test('userDataSync leftover createUserDataSyncStoreClient then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(SYNC_INIT_REL), 'utf8');
		assertPromiseSignature(source, 'private createUserDataSyncStoreClient(): Promise<UserDataSyncStoreClient | undefined> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const thenCall = `this.createUserDataSyncStoreClient().then(userDataSyncStoreClient => {
			if (!userDataSyncStoreClient) {
				this.initializationFinished.open();
			}
		})`;
		assert.ok(source.includes(`${thenCall}${doubleCatch};`));
		assert.ok(!source.includes(`${thenCall};`));
		assert.ok(!source.includes(`${thenCall}.catch(onUnexpectedError);`));
	});

	test('performance leftover perfBaseline / Promise.all thens are Promise double-chain; opener and sync void stay skipped', () => {
		const renderer = fs.readFileSync(resolveSource(RENDERER_REL), 'utf8');
		const startup = fs.readFileSync(resolveSource(STARTUP_REL), 'utf8');
		const timer = fs.readFileSync(resolveSource(TIMER_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		assertPromiseSignature(timer, 'perfBaseline: Promise<number>;');
		assertPromiseSignature(extensions, 'whenInstalledExtensionsRegistered(): Promise<boolean>;');
		assertPromiseSignature(lifecycle, 'when(phase: LifecyclePhase): Promise<void>;');
		assert.ok(renderer.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(startup.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(renderer.includes('timerService.perfBaseline.then(perfBaseline => {'));
		assert.ok(renderer.includes(`		}).catch(onUnexpectedError).catch(onUnexpectedError);
	}`));
		assert.ok(!renderer.includes(`			this._observer = obs;

		});
	}`));
		const allThen = `Promise.all([
			lifecycleService.when(LifecyclePhase.Eventually),
			extensionService.whenInstalledExtensionsRegistered()
		]).then(() => {
			this._stopProfiling();
		})`;
		assert.ok(startup.includes(`${allThen}${doubleCatch};`));
		assert.ok(!startup.includes(`${allThen};`));
		assert.ok(!startup.includes(`${allThen}.catch(onUnexpectedError);`));
		assert.ok(startup.includes('private _stopProfiling(): void {'));
		assert.ok(!startup.includes('this._stopProfiling().catch'));
		assert.ok(startup.includes('this._openerService.open(URI.parse(`${baseUrl}${queryStringPrefix}body=${encodeURIComponent(body)}`));'));
		assert.ok(!startup.includes('this._openerService.open(URI.parse(`${baseUrl}${queryStringPrefix}body=${encodeURIComponent(body)}`)).catch'));
	});

	test('opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty stay skipped; already dual-chained startupTimings untouched as leftover target', () => {
		const startup = fs.readFileSync(resolveSource(STARTUP_REL), 'utf8');
		const timings = fs.readFileSync(resolveSource(STARTUP_TIMINGS_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(URL_CONTRIB_REL), 'utf8');
		const browser = fs.readFileSync(resolveSource(TERMINAL_BROWSER_REL), 'utf8');
		assert.ok(startup.includes('this._openerService.open(URI.parse(`${baseUrl}${queryStringPrefix}body=${encodeURIComponent(body)}`));'));
		assert.ok(!startup.includes('this._openerService.open(URI.parse(`${baseUrl}${queryStringPrefix}body=${encodeURIComponent(body)}`)).catch'));
		assert.ok(startup.includes('private _stopProfiling(): void {'));
		assert.ok(!startup.includes('this._stopProfiling().catch'));
		assert.ok(contrib.includes('urlService.open(uri, { originalUrl: input });'));
		assert.ok(!contrib.includes('urlService.open(uri, { originalUrl: input }).catch'));
		assert.ok(browser.includes('return fileService.resolveAll(resources.map(r => ({ resource: r }))).then(async stats => {'));
		assert.ok(!browser.includes(`resolveAll${doubleCatch}`));
		assert.ok(timings.includes('this._report().catch(onUnexpectedError).catch(onUnexpectedError);'));
		for (const source of [startup, contrib, browser]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!source.includes('Wire('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
