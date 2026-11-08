/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ConversationEngineSnapshotsList, conversationLensSnapshotsButtonClass, conversationLensSnapshotsOverlayClass } from '../../browser/conversationEngineSnapshotsList.js';
import { IConversationRosterService } from '../../browser/conversationStubService.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';

suite('ConversationEngineSnapshotsList ARIA', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mountList(): { readonly list: ConversationEngineSnapshotsList; readonly buttonParent: HTMLElement; readonly overlayParent: HTMLElement } {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
		instantiationService.stub(IConversationRosterService, {
			getActiveSessionId: () => 'session-aria',
			onDidChangeActiveSession: Event.None,
			onDidChangeSession: Event.None,
			onDidChangeEngineConnection: Event.None,
		} as IConversationRosterService);
		const buttonParent = document.createElement('div');
		const overlayParent = document.createElement('div');
		document.body.append(buttonParent, overlayParent);
		store.add({ dispose: () => { buttonParent.remove(); overlayParent.remove(); } });
		const list = store.add(instantiationService.createInstance(ConversationEngineSnapshotsList, buttonParent, overlayParent, undefined));
		return { list, buttonParent, overlayParent };
	}

	test('snapshots trigger controls its dialog through a stable id across open and close', () => {
		const { list, buttonParent, overlayParent } = mountList();
		const button = buttonParent.querySelector(`.${conversationLensSnapshotsButtonClass} .monaco-button`) as HTMLElement;
		const overlay = overlayParent.querySelector(`.${conversationLensSnapshotsOverlayClass}`) as HTMLElement;
		assert.ok(button);
		assert.ok(overlay);
		assert.ok(overlay.id);
		assert.strictEqual(button.getAttribute('aria-controls'), overlay.id);
		assert.strictEqual(button.getAttribute('aria-expanded'), 'false');
		assert.strictEqual(overlay.hidden, true);

		list.show();
		assert.strictEqual(button.getAttribute('aria-expanded'), 'true');
		assert.strictEqual(button.getAttribute('aria-controls'), overlay.id);
		assert.strictEqual(overlay.hidden, false);

		list.close();
		assert.strictEqual(button.getAttribute('aria-expanded'), 'false');
		assert.strictEqual(button.getAttribute('aria-controls'), overlay.id);
		assert.strictEqual(overlay.hidden, true);
	});
});
