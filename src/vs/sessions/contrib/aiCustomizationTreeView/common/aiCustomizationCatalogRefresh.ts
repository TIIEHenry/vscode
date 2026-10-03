/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';

/**
 * Prompt-service events that invalidate the customization tree and overview.
 * Instruction files and agent instruction files (AGENTS.md, CLAUDE.md,
 * copilot-instructions.md) do not fire the agent or slash-command events.
 * Hook changes are overview-only; the tree has no hook nodes.
 */
export interface IAiCustomizationCatalogRefreshSource {
	readonly onDidChangeCustomAgents: Event<void>;
	readonly onDidChangeSlashCommands: Event<void>;
	readonly onDidChangeInstructions: Event<void>;
	readonly onDidChangeAgentInstructions: Event<void>;
	readonly onDidChangeHooks: Event<void>;
}

export interface IAiCustomizationCatalogRefreshOptions {
	/** Overview counts hooks. The file tree does not list them. */
	readonly hooks?: boolean;
}

export function registerAiCustomizationCatalogRefresh(
	source: IAiCustomizationCatalogRefreshSource,
	add: (disposable: IDisposable) => void,
	refresh: () => void,
	options?: IAiCustomizationCatalogRefreshOptions,
): void {
	add(source.onDidChangeCustomAgents(refresh));
	add(source.onDidChangeSlashCommands(refresh));
	add(source.onDidChangeInstructions(refresh));
	add(source.onDidChangeAgentInstructions(refresh));
	if (options?.hooks) {
		add(source.onDidChangeHooks(refresh));
	}
}
