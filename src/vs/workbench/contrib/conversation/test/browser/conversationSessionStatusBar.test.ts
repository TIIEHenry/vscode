/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IStatusbarEntry, IStatusbarService } from '../../../../services/statusbar/browser/statusbar.js';
import { TestEnvironmentService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { IWorkbenchLayoutService } from '../../../../services/layout/browser/layoutService.js';
import {
	ConversationSessionStatusBarContribution,
	registerConversationSessionStatusBar,
} from '../../browser/conversationSessionStatusBar.js';
import { IConversationRosterService } from '../../browser/conversationStubService.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../../common/uaPreferencesPanes.js';

suite('Conversation Session StatusBar', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('engine entry exposes openConnectionPreferences command', () => {
		registerConversationSessionStatusBar();

		const entries = new Map<string, IStatusbarEntry>();
		const statusbarService = {
			addEntry: (entry: IStatusbarEntry, id: string) => {
				entries.set(id, entry);
				return { update: () => { }, dispose: () => { } };
			},
		} as IStatusbarService;

		const stubService = {
			onDidChangeActiveSession: () => ({ dispose: () => { } }),
			onDidChangeSession: () => ({ dispose: () => { } }),
			getActiveSessionId: () => undefined,
			getActiveSession: () => undefined,
		} as IConversationRosterService;

		const layoutService = {
			isVisible: () => false,
			onDidChangePartVisibility: () => ({ dispose: () => { } }),
		} as IWorkbenchLayoutService;

		const instantiationService = workbenchInstantiationService(undefined, store);

		store.add(instantiationService.createInstance(
			ConversationSessionStatusBarContribution,
			stubService,
			statusbarService,
			layoutService,
			TestEnvironmentService,
		));

		const engineEntry = entries.get(ConversationSessionStatusBarContribution.ENGINE_ENTRY_ID);
		assert.ok(engineEntry?.command);
		assert.strictEqual(engineEntry.command!.id, OPEN_CONNECTION_PREFERENCES_COMMAND_ID);
	});
});
