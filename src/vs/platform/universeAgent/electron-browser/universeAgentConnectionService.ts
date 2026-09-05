/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerMainProcessRemoteService } from '../../ipc/electron-browser/services.js';
import { UniverseAgentConnectionChannelClient } from '../common/universeAgentConnectionChannelClient.js';
import { IUniverseAgentConnection, universeAgentConnectionChannelName } from '../common/universeAgentConnection.js';

registerMainProcessRemoteService(IUniverseAgentConnection, universeAgentConnectionChannelName, {
	channelClientCtor: UniverseAgentConnectionChannelClient,
});
