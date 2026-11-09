/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { NullCommandService } from '../../../../../platform/commands/test/common/nullCommandService.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { Parts } from '../../../../services/layout/browser/layoutService.js';
import { IQuickDiffService } from '../../../scm/common/quickDiff.js';
import { ConversationDiffReviewInput } from '../../browser/conversationDiffReviewInput.js';
import { ISourcesChangeEntryOpenDeps, openSourcesChangeInConversation } from '../../browser/sourcesChangeEntryOpen.js';
import { ISourcesDiffPanelService } from '../../common/sourcesDiffPanelService.js';
import { createSourcesConversationOpenHarness } from './sourcesConversationOpenHarness.js';

suite('Sources - open change in Conversation', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('a hidden Conversation region is shown before the diff opens into it', async () => {
		const calls: string[] = [];
		let conversationVisible = false;
		const harness = createSourcesConversationOpenHarness(store, {
			openEditor: async input => {
				store.add(input);
				calls.push(`open:${conversationVisible ? 'visible' : 'hidden'}`);
				return undefined;
			},
		});
		const deps: ISourcesChangeEntryOpenDeps = {
			commandService: NullCommandService,
			editorService: {} as IEditorService,
			quickDiffService: {} as IQuickDiffService,
			configurationService: new TestConfigurationService(),
			instantiationService: {
				createInstance: (_ctor: unknown, ...args: unknown[]) => {
					const [modified, original, groupId, identity] = args as ConstructorParameters<typeof ConversationDiffReviewInput>;
					return store.add(new ConversationDiffReviewInput(modified, original, groupId ?? '', identity));
				},
			} as unknown as ISourcesChangeEntryOpenDeps['instantiationService'],
			sourcesDiffPanelService: {} as ISourcesDiffPanelService,
			editorGroupsService: harness.editorGroupsService,
			session: harness.session,
			layoutService: {
				isVisible: (part: Parts) => part === Parts.CONVERSATION_PART ? conversationVisible : true,
				setPartHidden: (hidden: boolean, part: Parts) => {
					calls.push(`setPartHidden:${hidden}:${part}`);
					if (part === Parts.CONVERSATION_PART) {
						conversationVisible = !hidden;
					}
				},
			} as ISourcesChangeEntryOpenDeps['layoutService'],
		};

		await openSourcesChangeInConversation({
			modified: URI.file('/project/src/a.ts'),
			original: URI.file('/project/src/a.ts.git'),
			groupId: 'workingTree',
		}, deps, {});

		assert.deepStrictEqual(calls, [`setPartHidden:false:${Parts.CONVERSATION_PART}`, 'open:visible']);
	});
});
