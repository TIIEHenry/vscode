/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerMainProcessRemoteService } from '../../ipc/electron-browser/services.js';
import { IUniverseAgentHubService, universeAgentHubChannelName } from '../common/hub.js';

/** Hub control-plane surface proxies through the existing UniverseAgent main-process channel (H4a). */
registerMainProcessRemoteService(IUniverseAgentHubService, universeAgentHubChannelName);
