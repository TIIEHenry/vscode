/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { ProfileResourceType } from '../../../../../platform/userDataProfile/common/userDataProfile.js';
import { TreeItemCollapsibleState } from '../../../../common/views.js';
import { IProfileResourceTreeItem } from '../../common/userDataProfile.js';
import { UserDataProfileImportExportState } from '../../browser/userDataProfileImportExportService.js';

suite('UserDataProfileImportExportState getRoots', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	class TestRootsState extends UserDataProfileImportExportState {
		fetchCount = 0;
		private readonly pending: Array<{
			resolve: (roots: IProfileResourceTreeItem[]) => void;
			reject: (reason: Error) => void;
		}> = [];

		constructor() {
			super({} as IQuickInputService);
		}

		protected override fetchRoots(): Promise<IProfileResourceTreeItem[]> {
			this.fetchCount++;
			return new Promise((resolve, reject) => {
				this.pending.push({ resolve, reject });
			});
		}

		resolveNext(roots: IProfileResourceTreeItem[]): void {
			const next = this.pending.shift();
			assert.ok(next);
			next.resolve(roots);
		}

		rejectNext(error: Error): void {
			const next = this.pending.shift();
			assert.ok(next);
			next.reject(error);
		}
	}

	function createState(): TestRootsState {
		return disposables.add(new TestRootsState());
	}

	function root(label: string): IProfileResourceTreeItem {
		return {
			handle: label,
			collapsibleState: TreeItemCollapsibleState.None,
			label: { label },
			type: ProfileResourceType.Settings,
			isFromDefaultProfile: () => false,
			getChildren: async () => undefined,
			getContent: async () => '',
		};
	}

	test('a rejected getRoots is fetched again', async () => {
		const state = createState();
		const error = new Error('fetch failed');
		const first = state.getRoots();
		state.rejectNext(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(state.fetchCount, 1);

		const roots = [root('Settings')];
		const second = state.getRoots();
		assert.strictEqual(state.fetchCount, 2);
		state.resolveNext(roots);
		assert.strictEqual(await second, roots);
	});

	test('in-flight getRoots calls share one fetch and a success stays cached', async () => {
		const state = createState();
		const first = state.getRoots();
		const second = state.getRoots();
		assert.strictEqual(state.fetchCount, 1);

		const roots = [root('Settings')];
		state.resolveNext(roots);
		assert.strictEqual(await first, roots);
		assert.strictEqual(await second, roots);

		assert.strictEqual(await state.getRoots(), roots);
		assert.strictEqual(state.fetchCount, 1);
	});

	test('getChildren without an element forces a new fetch', async () => {
		const state = createState();
		const cached = [root('Settings')];
		const first = state.getRoots();
		state.resolveNext(cached);
		assert.strictEqual(await first, cached);
		assert.strictEqual(state.fetchCount, 1);

		const refreshedRoots = [root('Keybindings')];
		const refreshed = state.getChildren();
		assert.strictEqual(state.fetchCount, 2);
		const shared = state.getRoots();
		assert.strictEqual(state.fetchCount, 2);
		state.resolveNext(refreshedRoots);
		assert.strictEqual(await refreshed, refreshedRoots);
		assert.strictEqual(await shared, refreshedRoots);
	});

	test('a failed attempt does not drop the refresh that replaced it', async () => {
		const state = createState();
		const error = new Error('stale fetch failed');
		const first = state.getRoots();
		const refreshed = state.getChildren();
		assert.strictEqual(state.fetchCount, 2);

		state.rejectNext(error);
		await assert.rejects(first, (reason: unknown) => reason === error);

		const roots = [root('Settings')];
		const joined = state.getRoots();
		assert.strictEqual(state.fetchCount, 2);
		state.resolveNext(roots);
		assert.strictEqual(await refreshed, roots);
		assert.strictEqual(await joined, roots);
	});
});
