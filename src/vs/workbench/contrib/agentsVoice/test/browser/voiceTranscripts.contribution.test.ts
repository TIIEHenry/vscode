/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { Extensions as ViewExtensions, IViewContainersRegistry, IViewsRegistry } from '../../../../common/views.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { VoiceTranscriptsViewPane } from '../../browser/transcriptsView/voiceTranscriptsView.js';

import '../../browser/transcriptsView/voiceTranscripts.contribution.js';

const CONTAINER_ID = 'workbench.view.voiceTranscriptsContainer';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

suite('VoiceTranscriptsContribution - default window Activity', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Voice Transcripts sidebar view is gated to Agents Window', () => {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry);

		const viewContainer = viewContainersRegistry.get(CONTAINER_ID);
		assert.ok(viewContainer, 'Voice Transcripts view container should remain registered');
		assert.strictEqual(viewContainer.hideIfEmpty, true, 'Voice Transcripts sidebar container should hide when empty');
		assert.strictEqual(viewContainer.order, 10, 'Voice Transcripts sidebar container should keep order 10');

		const view = viewsRegistry.getView(VoiceTranscriptsViewPane.ID);
		assert.ok(view, 'Voice Transcripts view should remain registered');
		assert.ok(view.when, 'Voice Transcripts view should have a when clause');

		const defaultWindowShowRequested = {
			[IsSessionsWindowContext.key]: false,
			'voiceTranscripts.showView': true,
		};
		const agentsWindowHidden = {
			[IsSessionsWindowContext.key]: true,
			'voiceTranscripts.showView': false,
		};
		const agentsWindowShowRequested = {
			[IsSessionsWindowContext.key]: true,
			'voiceTranscripts.showView': true,
		};

		assert.strictEqual(
			evalWhen(view.when, defaultWindowShowRequested),
			false,
			'default Code window must hide Voice Transcripts from Activity sidebar even when showView is true'
		);
		assert.strictEqual(
			evalWhen(view.when, agentsWindowHidden),
			false,
			'Agents Window hides Voice Transcripts until showView is set'
		);
		assert.strictEqual(
			evalWhen(view.when, agentsWindowShowRequested),
			true,
			'Agents Window may show Voice Transcripts in Activity sidebar when showView is true'
		);
	});
});
