/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { constObservable } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock, upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IEditorService } from '../../../../../workbench/services/editor/common/editorService.js';
import { ISession, ISessionChangeset, ISessionFileChange } from '../../../../services/sessions/common/session.js';
import { ISessionsManagementService } from '../../../../services/sessions/common/sessionsManagement.js';
import { ChangesetReviewAction } from '../../browser/changesetReviewActions.js';
import { ISessionChangesService } from '../../browser/sessionChangesService.js';
import { IChangesViewService } from '../../common/changesViewService.js';

suite('ChangesetReviewAction', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	interface ISetReviewStateCall {
		readonly resources: readonly URI[];
		readonly reviewed: boolean;
	}

	function createInstantiationService(changes: readonly ISessionFileChange[], setReviewStateCalls: ISetReviewStateCall[]): TestInstantiationService {
		const changesViewService = new class extends mock<IChangesViewService>() {
			override readonly activeSessionChangesetObs = constObservable(upcastPartial<ISessionChangeset>({ capabilities: { review: true } }));
			override readonly activeSessionChangesObs = constObservable(changes);
			override setChangesetFilesReviewState(resources: readonly URI[], reviewed: boolean): void {
				setReviewStateCalls.push({ resources, reviewed });
			}
		}();
		const editorService = new class extends mock<IEditorService>() {
			override readonly activeEditorPane = undefined;
		}();
		return disposables.add(new TestInstantiationService(new ServiceCollection(
			[IChangesViewService, changesViewService],
			[IEditorService, editorService],
			[ISessionChangesService, new class extends mock<ISessionChangesService>() {
				override getSessionResource(): undefined { return undefined; }
			}()],
			[ISessionsManagementService, new class extends mock<ISessionsManagementService>() {
				override getSession(): undefined { return undefined; }
			}()],
		)));
	}

	test('ignores a resource that is not part of the active changeset', () => {
		const setReviewStateCalls: ISetReviewStateCall[] = [];
		const instantiationService = createInstantiationService(
			[{ modifiedUri: URI.file('/workspace/current.ts'), insertions: 1, deletions: 0, reviewed: false }],
			setReviewStateCalls,
		);

		// A middle-click can forward a stale row's resource (e.g. mid session switch);
		// it must not be dispatched to a changeset it no longer belongs to.
		new ChangesetReviewAction().run(instantiationService, URI.file('/workspace/stale.ts'));

		assert.deepStrictEqual(setReviewStateCalls, []);
	});

	test('toggles the review state for a resource in the active changeset', () => {
		const resource = URI.file('/workspace/current.ts');
		const setReviewStateCalls: ISetReviewStateCall[] = [];
		const instantiationService = createInstantiationService(
			[{ modifiedUri: resource, insertions: 1, deletions: 0, reviewed: false }],
			setReviewStateCalls,
		);

		new ChangesetReviewAction().run(instantiationService, resource);

		assert.deepStrictEqual(setReviewStateCalls, [{ resources: [resource], reviewed: true }]);
	});

	test('unmarks a reviewed deletion when the row is the workspace file, not the snapshot', () => {
		const workspaceUri = URI.file('/workspace/gone.ts');
		const snapshotUri = URI.from({ scheme: 'git-blob', path: '/workspace/gone.ts', query: 'sha=abc' });
		const setReviewStateCalls: ISetReviewStateCall[] = [];
		const instantiationService = createInstantiationService(
			[{
				uri: workspaceUri,
				originalUri: snapshotUri,
				insertions: 0,
				deletions: 4,
				reviewed: true,
			}],
			setReviewStateCalls,
		);

		// The diff row's file key is the workspace path. The content snapshot is only the original side.
		new ChangesetReviewAction().run(instantiationService, workspaceUri);

		assert.deepStrictEqual(setReviewStateCalls, [{ resources: [snapshotUri], reviewed: false }]);
	});

	test('writes review state to the editor session, not the globally active one', () => {
		const resource = URI.file('/workspace/shared.ts');
		const editorSession = URI.parse('session://a');
		const activeSession = URI.parse('session://b');
		const calls: { session: URI; resources: readonly URI[]; reviewed: boolean }[] = [];
		const changesViewService = new class extends mock<IChangesViewService>() {
			override readonly activeSessionChangesetObs = constObservable(upcastPartial<ISessionChangeset>({ capabilities: { review: true } }));
			override readonly activeSessionChangesObs = constObservable<readonly ISessionFileChange[]>([{ modifiedUri: resource, insertions: 1, deletions: 0, reviewed: false }]);
			override setChangesetFilesReviewState(resources: readonly URI[], reviewed: boolean): void {
				calls.push({ session: activeSession, resources, reviewed });
			}
			override setSessionChangesetFilesReviewState(session: URI, resources: readonly URI[], reviewed: boolean): void {
				calls.push({ session, resources, reviewed });
			}
		}();
		const editorChanges: ISessionFileChange[] = [{ modifiedUri: resource, insertions: 1, deletions: 0, reviewed: false }];
		const editorChangeset = upcastPartial<ISessionChangeset>({ capabilities: { review: true }, changes: constObservable(editorChanges) });
		const session = upcastPartial<ISession>({ changes: constObservable(editorChanges), changesets: constObservable([editorChangeset]) });
		const instantiationService = disposables.add(new TestInstantiationService(new ServiceCollection(
			[IChangesViewService, changesViewService],
			[IEditorService, new class extends mock<IEditorService>() {
				override readonly activeEditorPane = { input: { resource: URI.parse('changes-multi-diff-source:/a') } } as unknown as IEditorService['activeEditorPane'];
			}()],
			[ISessionChangesService, new class extends mock<ISessionChangesService>() {
				override getSessionResource(): URI { return editorSession; }
			}()],
			[ISessionsManagementService, new class extends mock<ISessionsManagementService>() {
				override getSession(): ISession { return session; }
			}()],
		)));

		new ChangesetReviewAction().run(instantiationService, resource);

		assert.deepStrictEqual(calls, [{ session: editorSession, resources: [resource], reviewed: true }]);
	});
});
