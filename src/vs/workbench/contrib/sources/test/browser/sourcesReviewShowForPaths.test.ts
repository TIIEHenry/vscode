/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IWorkbenchLayoutService, Parts } from '../../../../services/layout/browser/layoutService.js';
import { IQuickDiffService } from '../../../scm/common/quickDiff.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { sourcesGitDiffOpenFailureMessage } from '../../common/sourcesChangesGitRead.js';
import { ISourcesDiffPanelService } from '../../common/sourcesDiffPanelService.js';
import { ISourcesReviewHostService, ISourcesReviewListHost } from '../../common/sourcesReviewHostService.js';
import { ISourcesReviewProgressService } from '../../common/sourcesReviewProgress.js';
import { SourcesReviewHostService } from '../../browser/sourcesReviewHostService.js';
import { SOURCES_REVIEW_SHOW_FOR_PATHS_COMMAND } from '../../browser/sourcesReview.contribution.js';
import {
	SOURCES_REVIEW_MARK_ALL_REVIEWED_COMMAND,
	SOURCES_REVIEW_OPEN_SELECTED_COMMAND,
	SOURCES_REVIEW_TOGGLE_REVIEWED_SELECTED_COMMAND,
} from '../../browser/sourcesReviewCommands.contribution.js';
import '../../browser/sourcesReview.contribution.js';
import '../../browser/sourcesReviewCommands.contribution.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { SourcesTabId } from '../../common/sourcesTabs.js';

suite('Sources - review showForPaths', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function stubReviewListHost(overrides: Partial<ISourcesReviewListHost> = {}): ISourcesReviewListHost {
		return {
			selectReviewTab: () => { },
			setPathFilter: () => { },
			getSelectedEntry: () => undefined,
			toggleReviewedSelected: () => { },
			markAllReviewed: () => { },
			setStatusMessage: () => { },
			...overrides,
		};
	}

	test('showForPaths selects review tab and applies path-set', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		let selectedTab: SourcesTabId | undefined;
		let pathFilter: typeof resource[] | undefined = ['initial'] as unknown as typeof resource[];

		const hostService = store.add(new SourcesReviewHostService());
		hostService.registerReviewListHost(stubReviewListHost({
			selectReviewTab: () => { selectedTab = SourcesTabId.Review; },
			setPathFilter: (paths: URI[] | undefined) => { pathFilter = paths; },
		}));

		hostService.showForPaths([resource]);

		assert.strictEqual(selectedTab, SourcesTabId.Review);
		assert.strictEqual(pathFilter?.length, 1);
		assert.strictEqual(pathFilter?.[0].toString(), resource.toString());
	});

	test('command shows hidden Sources part before navigating', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		const setPartHiddenCalls: { hidden: boolean; part: Parts }[] = [];

		const layoutService = {
			isVisible: (part: Parts) => part === Parts.SOURCES_PART ? false : true,
			setPartHidden: (hidden: boolean, part: Parts) => {
				setPartHiddenCalls.push({ hidden, part });
			},
		} as unknown as IWorkbenchLayoutService;

		const hostService = store.add(new SourcesReviewHostService());
		let pathFilter: URI[] | undefined;
		hostService.registerReviewListHost(stubReviewListHost({
			setPathFilter: (paths: URI[] | undefined) => { pathFilter = paths; },
		}));

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IWorkbenchLayoutService, layoutService);
		instantiationService.stub(ISourcesReviewHostService, hostService);

		await CommandsRegistry.getCommand(SOURCES_REVIEW_SHOW_FOR_PATHS_COMMAND)?.handler?.({
			get: (id: unknown) => {
				if (id === IWorkbenchLayoutService) {
					return layoutService;
				}
				if (id === ISourcesReviewHostService) {
					return hostService;
				}
				throw new Error(`unexpected service ${String(id)}`);
			},
			 
		} as any, [resource]);

		assert.deepStrictEqual(setPartHiddenCalls, [{ hidden: false, part: Parts.SOURCES_PART }]);
		assert.strictEqual(pathFilter?.length, 1);
	});

	test('clear path-set passes undefined', () => {
		const hostService = store.add(new SourcesReviewHostService());
		let pathFilter: unknown = 'unset';
		hostService.registerReviewListHost(stubReviewListHost({
			setPathFilter: paths => { pathFilter = paths; },
		}));

		hostService.showForPaths([]);
		assert.strictEqual(pathFilter, undefined);
	});

	test('getSelectedEntry and markAllReviewed forward through the registered host', function () {
		const resource = toResource.call(this, '/project/a.ts');
		const entry = {
			resource,
			name: 'a.ts',
			description: 'Changes',
			groupId: 'workingTree',
		};
		let markedAll = false;
		let toggled = false;

		const hostService = store.add(new SourcesReviewHostService());
		hostService.registerReviewListHost(stubReviewListHost({
			getSelectedEntry: () => entry,
			toggleReviewedSelected: () => { toggled = true; },
			markAllReviewed: () => { markedAll = true; },
		}));

		assert.strictEqual(hostService.getReviewListHost()?.getSelectedEntry()?.resource.toString(), resource.toString());
		hostService.getReviewListHost()?.toggleReviewedSelected();
		hostService.getReviewListHost()?.markAllReviewed();
		assert.strictEqual(toggled, true);
		assert.strictEqual(markedAll, true);
	});

	test('review row commands are registered', () => {
		assert.ok(CommandsRegistry.getCommand(SOURCES_REVIEW_OPEN_SELECTED_COMMAND));
		assert.ok(CommandsRegistry.getCommand(SOURCES_REVIEW_TOGGLE_REVIEWED_SELECTED_COMMAND));
		assert.ok(CommandsRegistry.getCommand(SOURCES_REVIEW_MARK_ALL_REVIEWED_COMMAND));
	});

	test('toggle and markAll commands no-op without a host and forward when registered', async function () {
		const hostService = store.add(new SourcesReviewHostService());
		let toggled = 0;
		let markedAll = 0;
		const accessor = {
			get: (id: unknown) => {
				if (id === ISourcesReviewHostService) {
					return hostService;
				}
				throw new Error(`unexpected service ${String(id)}`);
			},
			 
		} as any;

		await CommandsRegistry.getCommand(SOURCES_REVIEW_TOGGLE_REVIEWED_SELECTED_COMMAND)?.handler?.(accessor);
		await CommandsRegistry.getCommand(SOURCES_REVIEW_MARK_ALL_REVIEWED_COMMAND)?.handler?.(accessor);
		assert.strictEqual(toggled, 0);
		assert.strictEqual(markedAll, 0);

		hostService.registerReviewListHost(stubReviewListHost({
			toggleReviewedSelected: () => { toggled += 1; },
			markAllReviewed: () => { markedAll += 1; },
		}));

		await CommandsRegistry.getCommand(SOURCES_REVIEW_TOGGLE_REVIEWED_SELECTED_COMMAND)?.handler?.(accessor);
		await CommandsRegistry.getCommand(SOURCES_REVIEW_MARK_ALL_REVIEWED_COMMAND)?.handler?.(accessor);
		assert.strictEqual(toggled, 1);
		assert.strictEqual(markedAll, 1);
	});

	const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../..');

	test('Open Selected catch surfaces open-diff failure the same way as Review list', () => {
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesReviewCommands.contribution.ts'), 'utf8');
		const openStart = source.indexOf('class SourcesReviewOpenSelectedAction');
		const openEnd = source.indexOf('class SourcesReviewToggleReviewedSelectedAction', openStart);
		assert.ok(openStart >= 0 && openEnd > openStart);
		const openAction = source.slice(openStart, openEnd);
		assert.ok(openAction.includes('markReviewedAfterSuccessfulOpen'));
		assert.ok(openAction.includes('} catch (error)'));
		assert.ok(openAction.includes('sourcesGitDiffOpenFailureMessage'));
		assert.ok(openAction.includes('setStatusMessage'));
		assert.ok(!openAction.includes('} catch {'));
	});

	test('openSelected surfaces open-diff failure on review status and does not mark reviewed', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		const entry = {
			resource,
			name: 'a.ts',
			description: 'Changes',
			groupId: 'workingTree',
		};
		let status: string | undefined;
		let marked = 0;

		const hostService = store.add(new SourcesReviewHostService());
		hostService.registerReviewListHost(stubReviewListHost({
			getSelectedEntry: () => entry,
			setStatusMessage: message => { status = message; },
		}));

		const accessor = {
			get: (id: unknown) => {
				if (id === ISourcesReviewHostService) {
					return hostService;
				}
				if (id === ISourcesReviewProgressService) {
					return {
						resolveKey: async () => ({ scopeKeyId: 'root', path: resource.toString(), contentHash: 'etag' }),
						markReviewed: () => { marked += 1; },
					};
				}
				if (id === IEditorService) {
					return {};
				}
				if (id === IQuickDiffService) {
					return {
						getQuickDiffs: async () => { throw new Error('boom'); },
					};
				}
				if (id === IConfigurationService) {
					return { getValue: () => 'preview' };
				}
				if (id === IInstantiationService) {
					return {};
				}
				if (id === ISourcesDiffPanelService) {
					return {};
				}
				throw new Error(`unexpected service ${String(id)}`);
			},
			 
		} as any;

		await CommandsRegistry.getCommand(SOURCES_REVIEW_OPEN_SELECTED_COMMAND)?.handler?.(accessor);

		assert.strictEqual(status, sourcesGitDiffOpenFailureMessage(new Error('boom')));
		assert.ok(status?.includes('Unable to open diff'));
		assert.ok(status?.includes('boom'));
		assert.strictEqual(marked, 0);
	});
});
