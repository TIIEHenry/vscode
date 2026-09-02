/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { IWorkbenchLayoutService, Parts } from '../../../../services/layout/browser/layoutService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ISourcesReviewHostService } from '../../common/sourcesReviewHostService.js';
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

	test('showForPaths selects review tab and applies path-set', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		let selectedTab: SourcesTabId | undefined;
		let pathFilter: typeof resource[] | undefined = ['initial'] as unknown as typeof resource[];

		const hostService = store.add(new SourcesReviewHostService());
		hostService.registerReviewListHost({
			selectReviewTab: () => { selectedTab = SourcesTabId.Review; },
			setPathFilter: (paths: URI[] | undefined) => { pathFilter = paths; },
			getSelectedEntry: () => undefined,
			toggleReviewedSelected: () => { },
			markAllReviewed: () => { },
		});

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
		hostService.registerReviewListHost({
			selectReviewTab: () => { },
			setPathFilter: (paths: URI[] | undefined) => { pathFilter = paths; },
			getSelectedEntry: () => undefined,
			toggleReviewedSelected: () => { },
			markAllReviewed: () => { },
		});

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
			// eslint-disable-next-line local/code-no-any-casts
		} as any, [resource]);

		assert.deepStrictEqual(setPartHiddenCalls, [{ hidden: false, part: Parts.SOURCES_PART }]);
		assert.strictEqual(pathFilter?.length, 1);
	});

	test('clear path-set passes undefined', () => {
		const hostService = store.add(new SourcesReviewHostService());
		let pathFilter: unknown = 'unset';
		hostService.registerReviewListHost({
			selectReviewTab: () => { },
			setPathFilter: paths => { pathFilter = paths; },
			getSelectedEntry: () => undefined,
			toggleReviewedSelected: () => { },
			markAllReviewed: () => { },
		});

		hostService.showForPaths([]);
		assert.strictEqual(pathFilter, undefined);
	});

	test('getSelectedEntry and markAllReviewed forward through the registered host', () => {
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
		hostService.registerReviewListHost({
			selectReviewTab: () => { },
			setPathFilter: () => { },
			getSelectedEntry: () => entry,
			toggleReviewedSelected: () => { toggled = true; },
			markAllReviewed: () => { markedAll = true; },
		});

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
			// eslint-disable-next-line local/code-no-any-casts
		} as any;

		await CommandsRegistry.getCommand(SOURCES_REVIEW_TOGGLE_REVIEWED_SELECTED_COMMAND)?.handler?.(accessor);
		await CommandsRegistry.getCommand(SOURCES_REVIEW_MARK_ALL_REVIEWED_COMMAND)?.handler?.(accessor);
		assert.strictEqual(toggled, 0);
		assert.strictEqual(markedAll, 0);

		hostService.registerReviewListHost({
			selectReviewTab: () => { },
			setPathFilter: () => { },
			getSelectedEntry: () => undefined,
			toggleReviewedSelected: () => { toggled += 1; },
			markAllReviewed: () => { markedAll += 1; },
		});

		await CommandsRegistry.getCommand(SOURCES_REVIEW_TOGGLE_REVIEWED_SELECTED_COMMAND)?.handler?.(accessor);
		await CommandsRegistry.getCommand(SOURCES_REVIEW_MARK_ALL_REVIEWED_COMMAND)?.handler?.(accessor);
		assert.strictEqual(toggled, 1);
		assert.strictEqual(markedAll, 1);
	});
});
