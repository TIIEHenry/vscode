/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { URI } from '../../../../../../base/common/uri.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { IPathService } from '../../../../../services/path/common/pathService.js';
import { AICustomizationSources, IAICustomizationWorkspaceService } from '../../../common/aiCustomizationWorkspaceService.js';
import { ICustomizationItem, ICustomizationItemProvider } from '../../../common/customizationHarnessService.js';
import { PromptsType } from '../../../common/promptSyntax/promptTypes.js';
import { IPromptsService } from '../../../common/promptSyntax/service/promptsService.js';
import { AICustomizationItemNormalizer, ItemProviderItemSource } from '../../../browser/aiCustomization/aiCustomizationItemSource.js';

suite('ItemProviderItemSource', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('fetches again after the first provide rejects, and does not refetch a success', async () => {
		const sessionResource = URI.parse('test:///session');
		const item: ICustomizationItem = {
			uri: URI.parse('test:///skills/repo/SKILL.md'),
			type: PromptsType.skill,
			name: 'repo',
			source: AICustomizationSources.local,
			extensionId: undefined,
			pluginUri: undefined,
		};
		let calls = 0;
		const provider: ICustomizationItemProvider = {
			onDidChange: Event.None,
			provideChatSessionCustomizations: () => {
				calls++;
				if (calls === 1) {
					return Promise.reject(new Error('unavailable'));
				}
				return Promise.resolve([item]);
			},
		};
		const source = disposables.add(new ItemProviderItemSource(
			sessionResource,
			provider,
			{ onDidChangeSkills: Event.None } as IPromptsService,
			{} as IAICustomizationWorkspaceService,
			{} as IFileService,
			{} as IPathService,
			{} as AICustomizationItemNormalizer,
		));

		await assert.rejects(() => source.fetchProviderItems(), /unavailable/);
		assert.strictEqual(calls, 1, 'a rejected read must not call the provider again inside the same fetch');

		const first = await source.fetchProviderItems();
		assert.strictEqual(calls, 2, 'the next fetch must call the provider again');
		assert.deepStrictEqual(first, [item]);

		const second = await source.fetchProviderItems();
		assert.strictEqual(calls, 2, 'a successful result stays cached');
		assert.deepStrictEqual(second, [item]);
	});
});
