/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { Context } from '../../../../../platform/contextkey/browser/contextKeyService.js';
import { Menus } from '../../../../browser/menus.js';
import { SessionHasCachedChangesContext, SessionHasChangesContext, SessionHasWorkspaceContext } from '../../../../common/contextkeys.js';
import { ISessionFileChange } from '../../../../services/sessions/common/session.js';
import { ChangesContextKeys, VIEW_SESSION_CHANGES_COMMAND_ID } from '../../common/changes.js';
import { changesetOperationFileTargets, changesetResourceOperationMenuWhen, sessionChangesOpenFileTarget } from '../../browser/changesActions.js';
import { IDocumentDiffItem } from '../../../../../editor/browser/widget/multiDiffEditor/model.js';

suite('Changes Actions', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('changes pill stays out of the pill row for a session without a workspace folder', () => {
		const item = MenuRegistry.getMenuItems(Menus.SessionHeaderMeta)
			.filter(isIMenuItem)
			.find(item => item.command.id === VIEW_SESSION_CHANGES_COMMAND_ID);

		assert.ok(item, 'expected the changes pill on the session metadata menu');
		const evaluate = (state: { changes?: boolean; cachedChanges?: boolean; workspace?: boolean }) => {
			const context = new Context(1, null);
			context.setValue(SessionHasChangesContext.key, state.changes ?? false);
			context.setValue(SessionHasCachedChangesContext.key, state.cachedChanges ?? false);
			context.setValue(SessionHasWorkspaceContext.key, state.workspace ?? false);
			return item.when?.evaluate(context) ?? false;
		};

		assert.deepStrictEqual({
			folderlessChatWithChanges: evaluate({ changes: true }),
			folderlessChatWithCachedChanges: evaluate({ cachedChanges: true }),
			workspaceSessionWithChanges: evaluate({ changes: true, workspace: true }),
			workspaceSessionWithCachedChanges: evaluate({ cachedChanges: true, workspace: true }),
			workspaceSessionWithoutChanges: evaluate({ workspace: true }),
		}, {
			folderlessChatWithChanges: false,
			folderlessChatWithCachedChanges: false,
			workspaceSessionWithChanges: true,
			workspaceSessionWithCachedChanges: true,
			workspaceSessionWithoutChanges: false,
		});
	});

	test('resource operations use workspace files, not the session or a delete snapshot', () => {
		const sessionUri = URI.from({ scheme: 'local-agent-host', path: '/session-1' });
		const kept = URI.file('/workspace/kept.ts');
		const gone = URI.file('/workspace/gone.ts');
		const snapshot = URI.from({ scheme: 'git-blob', path: '/workspace/gone.ts', query: 'sha=abc' });
		const changes: readonly ISessionFileChange[] = [
			{ uri: kept, modifiedUri: kept, insertions: 1, deletions: 0 },
			{ uri: gone, originalUri: snapshot, insertions: 0, deletions: 4 },
		];

		assert.deepStrictEqual(changesetOperationFileTargets([sessionUri, '', kept, gone], changes).map(uri => uri.toString()), [
			kept.toString(),
			gone.toString(),
		]);
		assert.deepStrictEqual(changesetOperationFileTargets([snapshot], changes).map(uri => uri.toString()), [gone.toString()]);
		assert.deepStrictEqual(changesetOperationFileTargets([sessionUri, ''], changes), []);
		assert.deepStrictEqual(changesetOperationFileTargets([URI.file('/workspace/other.ts')], changes), []);
	});

	test('diff-row open file uses the workspace path, not the git diff side', () => {
		const workspaceUri = URI.file('/workspace/kept.ts');
		const gitSide = URI.from({ scheme: 'git', path: '/workspace/kept.ts', query: JSON.stringify({ ref: 'abc' }) });
		const snapshot = URI.from({ scheme: 'git-blob', path: '/workspace/gone.ts', query: 'sha=abc' });
		const gone = URI.file('/workspace/gone.ts');

		const modified = { multiDiffEditorItem: { modifiedUri: gitSide, goToFileUri: workspaceUri } } as IDocumentDiffItem;
		const deleted = { multiDiffEditorItem: { goToFileUri: gone } } as IDocumentDiffItem;

		assert.deepStrictEqual({
			modified: sessionChangesOpenFileTarget(gitSide, modified).toString(),
			deleted: sessionChangesOpenFileTarget(snapshot, deleted).toString(),
			unknown: sessionChangesOpenFileTarget(gitSide, undefined).toString(),
		}, {
			modified: workspaceUri.toString(),
			deleted: snapshot.toString(),
			unknown: gitSide.toString(),
		});
	});

	test('resource operations stay off the changes root row and on a file or diff row', () => {
		const evaluate = (changeKind: string | undefined) => {
			const context = new Context(1, null);
			if (changeKind !== undefined) {
				context.setValue(ChangesContextKeys.ChangeKind.key, changeKind);
			}
			return changesetResourceOperationMenuWhen.evaluate(context);
		};

		assert.deepStrictEqual({
			root: evaluate('root'),
			folder: evaluate('folder'),
			file: evaluate('file'),
			diffEditor: evaluate(undefined),
		}, {
			root: false,
			folder: true,
			file: true,
			diffEditor: true,
		});
	});
});
