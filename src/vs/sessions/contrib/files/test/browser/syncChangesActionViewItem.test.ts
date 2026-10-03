/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Action } from '../../../../../base/common/actions.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ISettableObservable, observableValue } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Command } from '../../../../../editor/common/languages.js';
import { IWorkspace, IWorkspaceContextService, IWorkspaceFoldersChangeEvent } from '../../../../../platform/workspace/common/workspace.js';
import { ISCMRepository, ISCMService } from '../../../../../workbench/contrib/scm/common/scm.js';
import { SyncChangesActionViewItem } from '../../browser/syncChangesActionViewItem.js';

suite('SyncChangesActionViewItem', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	class FakeScm extends Disposable {
		private readonly repos: ISCMRepository[] = [];
		private readonly _onDidAddRepository = this._register(new Emitter<ISCMRepository>());
		private readonly _onDidRemoveRepository = this._register(new Emitter<ISCMRepository>());
		readonly onDidAddRepository = this._onDidAddRepository.event;
		readonly onDidRemoveRepository = this._onDidRemoveRepository.event;
		get repositories(): Iterable<ISCMRepository> { return this.repos; }

		add(repository: ISCMRepository): void {
			this.repos.push(repository);
			this._onDidAddRepository.fire(repository);
		}

		remove(repository: ISCMRepository): void {
			const index = this.repos.indexOf(repository);
			if (index >= 0) {
				this.repos.splice(index, 1);
				this._onDidRemoveRepository.fire(repository);
			}
		}
	}

	class FakeWorkspace extends Disposable {
		private folders: { uri: URI }[] = [];
		private readonly _onDidChangeWorkspaceFolders = this._register(new Emitter<IWorkspaceFoldersChangeEvent>());
		readonly onDidChangeWorkspaceFolders = this._onDidChangeWorkspaceFolders.event;

		getWorkspace(): IWorkspace {
			return { id: 'test', folders: this.folders } as IWorkspace;
		}

		setFolders(folders: { uri: URI }[]): void {
			this.folders = folders;
			this._onDidChangeWorkspaceFolders.fire({ added: [], removed: [], changed: [] });
		}
	}

	function repository(root: URI, title: string, tooltip: string, isHidden = false): { repository: ISCMRepository; commands: ISettableObservable<readonly Command[] | undefined> } {
		const commands = observableValue<readonly Command[] | undefined>('syncCommands', [{ id: 'git.sync', title, tooltip }]);
		return {
			commands,
			repository: { provider: { rootUri: root, isHidden, statusBarCommands: commands } } as ISCMRepository,
		};
	}

	function render(scm: FakeScm, workspace: FakeWorkspace): { container: HTMLElement; label: HTMLElement } {
		const action = disposables.add(new Action('sessions.files.action.syncChanges', 'Sync Changes'));
		const item = disposables.add(new SyncChangesActionViewItem(action, undefined, scm as unknown as ISCMService, workspace as unknown as IWorkspaceContextService));
		const container = document.createElement('div');
		item.render(container);
		const label = container.querySelector('.sync-changes-action-view-item');
		assert.ok(label instanceof HTMLElement);
		return { container, label };
	}

	test('paints the sync title when the repository appears after the toolbar', () => {
		const scm = disposables.add(new FakeScm());
		const workspace = disposables.add(new FakeWorkspace());
		const folder = URI.file('/repo');
		workspace.setFolders([{ uri: folder }]);
		const { container, label } = render(scm, workspace);

		assert.strictEqual(label.querySelector('.codicon-sync'), null);
		assert.strictEqual(label.getAttribute('aria-label'), 'Sync Changes');

		const other = repository(URI.file('/other'), '$(sync) 9↓', 'other');
		scm.add(other.repository);
		const hidden = repository(folder, '$(sync) 9↓', 'hidden', true);
		scm.add(hidden.repository);
		assert.strictEqual(label.querySelector('.codicon-sync'), null);

		const visible = repository(folder, '$(sync) 2↑', 'Sync with origin/main');
		scm.add(visible.repository);
		assert.ok(label.querySelector('.codicon-sync'));
		assert.ok(label.textContent?.includes('2↑'));
		assert.strictEqual(label.getAttribute('aria-label'), 'Sync with origin/main');

		visible.commands.set([{ id: '', title: '$(sync~spin)', tooltip: 'Synchronizing Changes...' }], undefined, undefined);
		assert.ok(label.querySelector('.codicon-modifier-spin'));
		assert.ok(!label.textContent?.includes('2↑'));
		assert.strictEqual(label.getAttribute('aria-label'), 'Synchronizing Changes...');

		scm.remove(visible.repository);
		assert.strictEqual(label.querySelector('.codicon-sync'), null);
		assert.strictEqual(label.getAttribute('aria-label'), 'Sync Changes');
	});

	test('follows the workspace folder instead of the repository captured at render', () => {
		const scm = disposables.add(new FakeScm());
		const workspace = disposables.add(new FakeWorkspace());
		const folderA = URI.file('/repo-a');
		const folderB = URI.file('/repo-b');
		const repoA = repository(folderA, '$(sync) 1↓', 'Sync A');
		const repoB = repository(folderB, '$(sync) 4↑', 'Sync B');
		scm.add(repoA.repository);
		scm.add(repoB.repository);
		workspace.setFolders([{ uri: folderA }]);

		const { container, label } = render(scm, workspace);
		assert.ok(label.textContent?.includes('1↓'));
		assert.strictEqual(label.getAttribute('aria-label'), 'Sync A');

		workspace.setFolders([{ uri: folderB }]);
		assert.ok(!label.textContent?.includes('1↓'));
		assert.ok(label.textContent?.includes('4↑'));
		assert.strictEqual(label.getAttribute('aria-label'), 'Sync B');

		workspace.setFolders([]);
		assert.strictEqual(label.querySelector('.codicon-sync'), null);
		assert.strictEqual(label.getAttribute('aria-label'), 'Sync Changes');
	});

	test('paints publish instead of a blank button when the branch has no upstream', () => {
		const scm = disposables.add(new FakeScm());
		const workspace = disposables.add(new FakeWorkspace());
		const folder = URI.file('/repo');
		const published = repository(folder, '$(cloud-upload)', 'Publish Branch');
		published.commands.set([
			{ id: 'git.checkout', title: '$(git-branch) main', tooltip: 'main, Checkout Branch/Tag...' },
			{ id: 'git.publish', title: '$(cloud-upload)', tooltip: 'Publish Branch' },
		], undefined, undefined);
		scm.add(published.repository);
		workspace.setFolders([{ uri: folder }]);

		const { container, label } = render(scm, workspace);
		assert.ok(label.querySelector('.codicon-cloud-upload'));
		assert.strictEqual(label.querySelector('.codicon-git-branch'), null);
		assert.ok(!label.textContent?.includes('main'));
		assert.strictEqual(label.getAttribute('aria-label'), 'Publish Branch');

		published.commands.set([{ id: '', title: '$(sync~spin)', tooltip: 'Synchronizing Changes...' }], undefined, undefined);
		assert.ok(label.querySelector('.codicon-modifier-spin'));
		assert.strictEqual(label.querySelector('.codicon-cloud-upload'), null);
		assert.strictEqual(label.getAttribute('aria-label'), 'Synchronizing Changes...');
	});
});
