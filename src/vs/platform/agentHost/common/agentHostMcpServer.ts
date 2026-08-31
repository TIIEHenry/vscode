/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../base/common/uri.js';
import { type CustomizationDisabledReason } from './customizationEnablement.js';
import { type CustomizationEnablement, McpServerStatus, type McpServerState, type TextRange } from './state/protocol/state.js';

/**
 * A rich view of a single MCP server exposed by an agent host session.
 * Encapsulates the dispatch plumbing so consumers can present and toggle
 * servers without depending on the low-level protocol action surface.
 */
export interface IAgentHostMcpServer {
	readonly id: string;
	readonly name: string;
	readonly enabled: boolean;
	readonly enablement?: readonly CustomizationEnablement[];
	readonly isPluginProvided?: boolean;
	readonly isClientBundled?: boolean;
	readonly owningPluginClientId?: string;
	readonly disabledReason?: CustomizationDisabledReason;
	readonly status: McpServerStatus;
	readonly state: McpServerState;
	readonly sourceUri?: URI;
	readonly sourceRange?: TextRange;
	readonly logOutputChannelId?: string;
	/** Starts or restarts the server. Providers that cannot control lifecycle may no-op. */
	start(): Promise<void>;
	/** Stops the server. Providers that cannot control lifecycle may no-op. */
	stop(): Promise<void>;
	setEnabled(enabled: boolean): void;
}
