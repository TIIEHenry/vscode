/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IUniverseAgentConnection, UniverseAgentNavigatorCapabilityKey } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentCapabilitySupport } from '../../../../platform/universeAgent/common/universeAgentTypes.js';

export type NavigatorCapabilitySupport = UniverseAgentCapabilitySupport;

export type NavigatorCapabilityKey = UniverseAgentNavigatorCapabilityKey;

export function getNavigatorCapability(
	connection: IUniverseAgentConnection,
	key: NavigatorCapabilityKey,
): NavigatorCapabilitySupport {
	return connection.getNavigatorCapability(key);
}
