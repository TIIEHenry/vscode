/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEncryptionMainService } from '../../encryption/common/encryptionService.js';
import { IApplicationStorageMainService } from '../../storage/electron-main/storageMainService.js';
import { ClientIdentityStore } from '../node/clientIdentityStore.js';
import { ConnectionProfileStore } from '../node/connectionProfileStore.js';
import { createConnectionResolver } from '../node/connectionResolver.js';
import { EngineTrustStore } from '../node/engineTrustStore.js';
import { HubSessionStore } from '../node/hubSessionStore.js';
import { UniverseAgentConnectionService as UniverseAgentConnectionServiceBase } from '../node/universeAgentConnectionService.js';

/**
 * Electron-main Hub client host: wires encrypted secret stores (§3.5 / §3.6)
 * and keeps {@link InMemoryHubSessionStore} as the test-only fallback in node/.
 */
export class UniverseAgentConnectionService extends UniverseAgentConnectionServiceBase {

	constructor(
		@IEncryptionMainService encryptionService: IEncryptionMainService,
		@IApplicationStorageMainService applicationStorage: IApplicationStorageMainService,
	) {
		const hubSessionStore = new HubSessionStore(encryptionService, applicationStorage);
		const clientIdentityStore = new ClientIdentityStore(encryptionService, applicationStorage);
		const connectionProfileStore = new ConnectionProfileStore(applicationStorage);
		const engineTrustStore = new EngineTrustStore(applicationStorage);
		super({
			hubSessionStore,
			clientIdentityStore,
			connectionProfileStore,
			engineTrustStore,
			storageReady: applicationStorage.whenReady,
			connectionResolver: createConnectionResolver({
				connectionProfileStore,
				hubSessionStore,
				clientIdentityStore,
				http: { fetch: globalThis.fetch.bind(globalThis) },
			}),
		});
	}
}
