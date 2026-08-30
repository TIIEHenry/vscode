/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { Extensions as ViewContainerExtensions, IViewContainersRegistry, ViewContainerLocation } from '../../../../common/views.js';
import { ChatViewContainerId } from '../../browser/chat.js';
import '../../browser/chatParticipant.contribution.js';

suite('ChatParticipantContribution - Auxiliary Bar default', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Chat view container is registered on Auxiliary Bar but is not the default container', () => {
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
		const auxiliaryBarContainers = viewContainersRegistry.getViewContainers(ViewContainerLocation.AuxiliaryBar);
		const defaultAuxiliaryBarContainers = viewContainersRegistry.getDefaultViewContainers(ViewContainerLocation.AuxiliaryBar);

		assert.ok(
			auxiliaryBarContainers.some(container => container.id === ChatViewContainerId),
			'Chat view container should remain registered on the Auxiliary Bar for donor/debug access'
		);
		assert.ok(
			!defaultAuxiliaryBarContainers.some(container => container.id === ChatViewContainerId),
			'Chat view container must not be the default Auxiliary Bar surface (INV-052 / product Conversation is CONVERSATION_PART)'
		);
	});
});
