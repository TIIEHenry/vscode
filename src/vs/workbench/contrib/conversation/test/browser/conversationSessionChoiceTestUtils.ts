/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { markAsSingleton, type IDisposable } from '../../../../../base/common/lifecycle.js';
import type { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import type { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { ConversationSessionChoiceService, IConversationSessionChoiceService, type ConversationSessionConfigSelection } from '../../browser/conversationSessionChoiceService.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';

class TestConversationSessionChoiceService extends ConversationSessionChoiceService {
	constructor(
		connection: IUniverseAgentConnection,
		public override readonly sessionConfigBySessionId: Map<string, ConversationSessionConfigSelection>,
		public override readonly modelProfileIdBySessionId: Map<string, string>,
	) {
		super(connection);
	}
}

/** Session choice service over the given maps, so a test can keep asserting on its own map. */
export function createTestSessionChoiceService(store: { add<T extends IDisposable>(disposable: T): T }, options: {
	readonly sessionConfigBySessionId?: Map<string, ConversationSessionConfigSelection>;
	readonly modelProfileIdBySessionId?: Map<string, string>;
	readonly connection?: IUniverseAgentConnection;
} = {}): ConversationSessionChoiceService {
	return store.add(new TestConversationSessionChoiceService(
		options.connection ?? createConversationConnectionTestStub(),
		options.sessionConfigBySessionId ?? new Map(),
		options.modelProfileIdBySessionId ?? new Map(),
	));
}

/**
 * Harness-wide session choice service for tests that build real lenses. One
 * instance per harness, like the production singleton; never follows a link.
 */
export function stubConversationSessionChoiceService(instantiationService: TestInstantiationService): ConversationSessionChoiceService {
	const service = markAsSingleton(new ConversationSessionChoiceService({
		getConnectionSnapshot: () => ({}),
		onDidChangeConnection: Event.None,
	} as unknown as IUniverseAgentConnection));
	instantiationService.stub(IConversationSessionChoiceService, service);
	return service;
}
