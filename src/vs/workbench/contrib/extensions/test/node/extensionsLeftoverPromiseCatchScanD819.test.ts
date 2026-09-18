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
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const WORKBENCH_SVC_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/extensions/browser/extensions.contribution.ts';
const ACTIONS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsActions.ts';
const NOTIFICATION_REL = 'src/vs/workbench/services/notification/common/notificationService.ts';
const PROGRESS_REL = 'src/vs/workbench/services/progress/browser/progressService.ts';
const USER_DATA_REL = 'src/vs/workbench/services/userData/browser/userDataInit.ts';
const TEXT_RES_REL = 'src/vs/workbench/services/textresourceProperties/common/textResourcePropertiesService.ts';
const SECRETS_REL = 'src/vs/workbench/services/secrets/electron-browser/secretStorageService.ts';
const INTEGRITY_REL = 'src/vs/workbench/services/integrity/electron-browser/integrityService.ts';
const LABEL_REL = 'src/vs/workbench/services/label/common/labelService.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const POLICY_REL = 'src/vs/workbench/contrib/policyExport/electron-browser/policyExport.contribution.ts';
const QUICKACCESS_REL = 'src/vs/workbench/contrib/quickaccess/browser/commandsQuickAccess.ts';
const THEMES_TEST_REL = 'src/vs/workbench/contrib/themes/browser/themes.test.contribution.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/electron-browser/lifecycleService.ts';
const USER_ACTIVITY_REL = 'src/vs/workbench/services/userActivity/common/userActivityService.ts';
const CAROUSEL_REL = 'src/vs/workbench/contrib/imageCarousel/browser/imageCarouselEditor.ts';
const TYPE_CONTRIB_REL = 'src/vs/workbench/contrib/typeHierarchy/browser/typeHierarchy.contribution.ts';
const CALL_CONTRIB_REL = 'src/vs/workbench/contrib/callHierarchy/browser/callHierarchy.contribution.ts';

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

function countIncludes(source: string, needle: string): number {
	return (source.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
}

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const autoUpdateCall = 'this.autoUpdateBuiltinExtensions()';
const syncPinnedCall = 'this.syncPinnedBuiltinExtensions()';
const updateRunningAutoCall = 'this.updateRunningExtensions(undefined, true)';
const updateRunningCall = 'this.updateRunningExtensions()';
const syncGalleryFirstPageCall = 'this.syncInstalledExtensionsWithGallery(pager.firstPage)';
const syncGalleryPageCall = 'this.syncInstalledExtensionsWithGallery(page)';
const syncGalleryExtsCall = 'this.syncInstalledExtensionsWithGallery(galleryExtensions)';
const enabledAutoCheckCall = 'this.checkForUpdates(`Enabled auto check updates`)';
const loopCheckThenCall = '.then(() => this.loopCheckForMaliciousExtensions())';
const openViewThenCall = 'this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true))';

const d819Calls: Array<[string, string, number]> = [
	[WORKBENCH_SVC_REL, autoUpdateCall, 2],
	[WORKBENCH_SVC_REL, syncPinnedCall, 1],
	[WORKBENCH_SVC_REL, updateRunningAutoCall, 1],
	[WORKBENCH_SVC_REL, updateRunningCall, 1],
	[WORKBENCH_SVC_REL, syncGalleryFirstPageCall, 1],
	[WORKBENCH_SVC_REL, syncGalleryPageCall, 1],
	[WORKBENCH_SVC_REL, syncGalleryExtsCall, 1],
];

suite('notification leftover remaining moved to extensionsWorkbench leftover Promise fire-and-forget catch scan (D819)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('notification leftover remaining had fewer than four legal unused leftover sites so this knife moved to extensionsWorkbench leftover remaining', () => {
		const notification = fs.readFileSync(resolveSource(NOTIFICATION_REL), 'utf8');
		assert.strictEqual(countDoubleChains(notification), 0);
		assert.ok(!notification.includes('.then('));
		assert.ok(!notification.includes('void this.'));
		const notificationLegal = 0;
		assert.ok(notificationLegal < 4, `expected notification legal leftover <4, got ${notificationLegal}`);
		assert.ok(!notification.includes('D819'));
	});

	test('this knife covers eight leftover Promise double-chain sites after notification leftover remaining moved', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d819Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 8);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(WORKBENCH_SVC_REL) ?? ''), 13);
	});

	test('extensionsWorkbench leftover autoUpdateBuiltin / syncPinned / updateRunning / syncGallery leftover void promises are Promise/async + double-chain', () => {
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		assertPromiseSignature(workbench, 'private async autoUpdateBuiltinExtensions(): Promise<void> {');
		assertPromiseSignature(workbench, 'private async syncPinnedBuiltinExtensions(): Promise<void> {');
		assertPromiseSignature(workbench, 'async updateRunningExtensions(message = nls.localize(\'restart\', "Changing extension enablement"), auto: boolean = false): Promise<void> {');
		assertPromiseSignature(workbench, 'private async syncInstalledExtensionsWithGallery(gallery: IGalleryExtension[], flagExtensionsMissingFromGallery?: IExtensionInfo[]): Promise<void> {');
		assert.ok(workbench.includes("import { CancellationError, getErrorMessage, isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(workbench, autoUpdateCall);
		assertWrapped(workbench, syncPinnedCall);
		assertWrapped(workbench, updateRunningAutoCall);
		assertWrapped(workbench, updateRunningCall);
		assertWrapped(workbench, syncGalleryFirstPageCall);
		assertWrapped(workbench, syncGalleryPageCall);
		assertWrapped(workbench, syncGalleryExtsCall);
		assert.ok(!workbench.includes('\t\t\t\tthis.autoUpdateBuiltinExtensions();\n'));
		assert.ok(!workbench.includes('\t\t\tthis.syncPinnedBuiltinExtensions();\n'));
		assert.ok(!workbench.includes('\t\t\t\tthis.autoUpdateBuiltinExtensions();\n'));
		assert.ok(!workbench.includes('\t\t\t\t\tthis.updateRunningExtensions(undefined, true);\n'));
		assert.ok(!workbench.includes('\t\tthis.syncInstalledExtensionsWithGallery(pager.firstPage);\n'));
		assert.ok(!workbench.includes('\t\t\t\tthis.syncInstalledExtensionsWithGallery(page);\n'));
		assert.ok(!workbench.includes('\t\tthis.syncInstalledExtensionsWithGallery(galleryExtensions);\n'));
		assert.ok(!workbench.includes('\t\t\t\t\t\t\t\tthis.updateRunningExtensions();\n'));
	});

	test('checkForUpdates already-double leftover stays already-double; loopCheck then / openView then stay leftover remaining; await leftover stays skipped', () => {
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		assertWrapped(workbench, enabledAutoCheckCall);
		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(`${openViewThenCall};`));
		assert.ok(!widgets.includes(`${openViewThenCall}${doubleCatch}`));
		assert.ok(workbench.includes('await this.syncInstalledExtensionsWithGallery(galleryExtensions, infos);'));
		assert.ok(!workbench.includes(`await this.syncInstalledExtensionsWithGallery(galleryExtensions, infos)${doubleCatch}`));
		assert.ok(workbench.includes('await this.syncInstalledExtensionsWithGallery(galleryExtensions);'));
		assert.ok(!workbench.includes(`await this.syncInstalledExtensionsWithGallery(galleryExtensions)${doubleCatch}`));
		assert.ok(workbench.includes('await this.checkForUpdates();'));
		assert.ok(!workbench.includes(`await this.checkForUpdates()${doubleCatch}`));
		assert.ok(workbench.includes('await this.checkForUpdates(undefined, true);'));
		assert.ok(!workbench.includes(`await this.checkForUpdates(undefined, true)${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(ACTIONS_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(workbench, 'private async autoUpdateBuiltinExtensions(): Promise<void> {');

		assert.ok(actions.includes("run: () => this.openerService.open(downloadUrl).then(() => {"));
		assert.ok(!actions.includes(`this.openerService.open(downloadUrl)${doubleCatch}`));

		assert.ok(contrib.includes('registerAction2'));
		assert.ok(contrib.includes('async run(accessor: ServicesAccessor): Promise<any> {'));
		assert.ok(!contrib.includes(`async run(accessor: ServicesAccessor): Promise<any> {${doubleCatch}`));

		assert.ok(workbench.includes('this.queryLocal().then(async local => {'));
		assert.ok(workbench.includes('}).then(undefined, error => this.onError(error));'));
		assert.ok(!workbench.includes(`this.queryLocal().then(async local => {${doubleCatch}`));
		assert.ok(!workbench.includes(`}).then(undefined, error => this.onError(error))${doubleCatch}`));

		assert.ok(workbench.includes('return galleryExtensions.map(gallery => this.fromGallery(gallery, extensionsControlManifest));'));
		assert.ok(!workbench.includes(`return this.syncInstalledExtensionsWithGallery(galleryExtensions)${doubleCatch}`));

		for (const source of [workbench, viewlet, widgets, contrib, actions]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D819'));
		}
	});

	test('D815 leftover remaining already-double stays already-double; loopCheck / openView leftover remaining stay leftover remaining; this knife did not overflow into dirty leftover modules', () => {
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const typeContrib = fs.readFileSync(resolveSource(TYPE_CONTRIB_REL), 'utf8');
		const callContrib = fs.readFileSync(resolveSource(CALL_CONTRIB_REL), 'utf8');
		const carousel = fs.readFileSync(resolveSource(CAROUSEL_REL), 'utf8');
		const notification = fs.readFileSync(resolveSource(NOTIFICATION_REL), 'utf8');
		const progress = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		const userData = fs.readFileSync(resolveSource(USER_DATA_REL), 'utf8');
		const textRes = fs.readFileSync(resolveSource(TEXT_RES_REL), 'utf8');
		const secrets = fs.readFileSync(resolveSource(SECRETS_REL), 'utf8');
		const integrity = fs.readFileSync(resolveSource(INTEGRITY_REL), 'utf8');
		const label = fs.readFileSync(resolveSource(LABEL_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const policy = fs.readFileSync(resolveSource(POLICY_REL), 'utf8');
		const quickaccess = fs.readFileSync(resolveSource(QUICKACCESS_REL), 'utf8');
		const themes = fs.readFileSync(resolveSource(THEMES_TEST_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const userActivity = fs.readFileSync(resolveSource(USER_ACTIVITY_REL), 'utf8');

		assert.ok(workbench.includes(`${enabledAutoCheckCall}${doubleCatch}`));
		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(`${openViewThenCall};`));
		assert.ok(!widgets.includes(`${openViewThenCall}${doubleCatch}`));
		assert.ok(typeContrib.includes(doubleCatch));
		assert.ok(callContrib.includes(doubleCatch));
		assert.ok(carousel.includes(`this.updateCurrentImage()${doubleCatch}`));

		for (const [rel, source] of [
			[NOTIFICATION_REL, notification],
			[PROGRESS_REL, progress],
			[USER_DATA_REL, userData],
			[TEXT_RES_REL, textRes],
			[SECRETS_REL, secrets],
			[INTEGRITY_REL, integrity],
			[LABEL_REL, label],
			[TASKS_REL, tasks],
			[POLICY_REL, policy],
			[QUICKACCESS_REL, quickaccess],
			[THEMES_TEST_REL, themes],
			[LIFECYCLE_REL, lifecycle],
			[USER_ACTIVITY_REL, userActivity],
		] as const) {
			assert.ok(!source.includes('D819'), `${rel} should not mention D819`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/notification/test/node/notificationLeftoverPromiseCatchScanD819.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/policyExport/test/node/unusedLeftoverPromiseCatchScanD819.test.ts')));
	});
});
