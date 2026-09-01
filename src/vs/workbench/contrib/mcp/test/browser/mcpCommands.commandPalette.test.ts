/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { Extensions as QuickAccessExtensions, IQuickAccessRegistry } from '../../../../../platform/quickinput/common/quickAccess.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { ActiveEditorContext, IsSessionsWindowContext, RemoteNameContext, ResourceContextKey, WorkbenchStateContext, WorkspaceFolderCountContext } from '../../../../common/contextkeys.js';
import { extensionsFilterSubMenu } from '../../../extensions/common/extensions.js';
import { ChatContextKeys } from '../../../chat/common/actions/chatContextKeys.js';
import { TEXT_FILE_EDITOR_ID } from '../../../files/common/files.js';
import { McpCommandIds } from '../../common/mcpCommandIds.js';
import { McpContextKeys } from '../../common/mcpContextKeys.js';
import { HasInstalledMcpServersContext } from '../../common/mcpTypes.js';
import { McpResourceQuickAccess } from '../../browser/mcpResourceQuickAccess.js';

import '../../browser/mcp.contribution.js';
import '../../../authentication/browser/authentication.contribution.js';
import '../../../chat/browser/agentPluginsView.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

function findCommandPaletteItem(commandId: string) {
	return MenuRegistry.getMenuItems(MenuId.CommandPalette)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId);
}

function findExtensionsFilterItem(commandId: string) {
	return MenuRegistry.getMenuItems(extensionsFilterSubMenu)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId);
}

function findEditorContentItem(commandId: string) {
	return MenuRegistry.getMenuItems(MenuId.EditorContent)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId);
}

const chatSetupReady: Record<string, ContextKeyValue> = {
	[ChatContextKeys.Setup.hidden.key]: false,
	[ChatContextKeys.Setup.disabledInWorkspace.key]: false,
};

const chatEnabled: Record<string, ContextKeyValue> = {
	...chatSetupReady,
	[ChatContextKeys.enabled.key]: true,
};

const mcpJsonEditor: Record<string, ContextKeyValue> = {
	[ResourceContextKey.Path.key]: '/project/.vscode/mcp.json',
	[ActiveEditorContext.key]: TEXT_FILE_EDITOR_ID,
};

const defaultWindow: Record<string, ContextKeyValue> = {
	...chatSetupReady,
	[IsSessionsWindowContext.key]: false,
};

const agentsWindow: Record<string, ContextKeyValue> = {
	...defaultWindow,
	[IsSessionsWindowContext.key]: true,
};

const agentsWindowMcpReady: Record<string, ContextKeyValue> = {
	...agentsWindow,
	[McpContextKeys.toolsCount.key]: 1,
	[McpContextKeys.serverCount.key]: 1,
	[HasInstalledMcpServersContext.key]: true,
	[RemoteNameContext.key]: 'ssh-remote',
	[WorkspaceFolderCountContext.key]: 1,
	[WorkbenchStateContext.key]: 'workspace',
};

const sessionsWindowOnlyPaletteCommandIds = [
	McpCommandIds.ListServer,
	McpCommandIds.ResetTrust,
	McpCommandIds.ResetCachedTools,
	McpCommandIds.AddConfiguration,
	McpCommandIds.InstallFromManifest,
	McpCommandIds.Browse,
	McpCommandIds.ShowInstalled,
	McpCommandIds.OpenUserMcp,
	McpCommandIds.OpenRemoteUserMcp,
	McpCommandIds.OpenWorkspaceFolderMcp,
	McpCommandIds.OpenWorkspaceMcp,
	McpCommandIds.BrowseResources,
	'_manageTrustedMCPServersForAccount',
];

suite('McpCommands - default window Command Palette and Extensions filters', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('MCP F1 commands stay in Command Palette for Agents Window only', () => {
		for (const commandId of sessionsWindowOnlyPaletteCommandIds) {
			const item = findCommandPaletteItem(commandId);
			assert.ok(item, `${commandId} should remain registered for Agents Window`);
			assert.ok(item.when, `${commandId} Command Palette item should have a when clause`);

			assert.strictEqual(
				evalWhen(item.when, defaultWindow),
				false,
				`default Code window must hide ${commandId} in Command Palette`
			);
			assert.strictEqual(
				evalWhen(item.when, agentsWindowMcpReady),
				true,
				`Agents Window may list ${commandId} in Command Palette`
			);
		}
	});

	test('MCP Servers and Agent Plugins Extensions filters stay gated to Agents Window', () => {
		const mcpFilter = findExtensionsFilterItem(McpCommandIds.Browse);
		const agentPluginsFilter = findExtensionsFilterItem('workbench.agentPlugins.browse');

		assert.ok(mcpFilter, 'MCP Servers Extensions filter should remain registered');
		assert.ok(agentPluginsFilter, 'Agent Plugins Extensions filter should remain registered');
		assert.ok(mcpFilter.when, 'MCP Servers Extensions filter should have a when clause');
		assert.ok(agentPluginsFilter.when, 'Agent Plugins Extensions filter should have a when clause');

		for (const [label, item] of [
			['MCP Servers', mcpFilter],
			['Agent Plugins', agentPluginsFilter],
		] as const) {
			assert.strictEqual(
				evalWhen(item.when, defaultWindow),
				false,
				`default Code window must hide ${label} Extensions filter`
			);
			assert.strictEqual(
				evalWhen(item.when, agentsWindow),
				true,
				`Agents Window may show ${label} Extensions filter`
			);
		}
	});

	test('MCP Server Resources quick access stays gated to Agents Window', () => {
		const quickAccessRegistry = Registry.as<IQuickAccessRegistry>(QuickAccessExtensions.Quickaccess);
		const mockContextKeyService = { contextMatchesRules: () => true } as unknown as IContextKeyService;
		const provider = quickAccessRegistry.getQuickAccessProvider(McpResourceQuickAccess.PREFIX, mockContextKeyService);

		assert.ok(provider, 'MCP Server Resources quick access provider should remain registered');
		assert.ok(provider.when, 'MCP Server Resources quick access provider should have a when clause');

		assert.strictEqual(
			evalWhen(provider.when, { ...chatEnabled, [IsSessionsWindowContext.key]: false }),
			false,
			'default Code window must hide MCP Server Resources from quick access'
		);
		assert.strictEqual(
			evalWhen(provider.when, { ...chatEnabled, [IsSessionsWindowContext.key]: true }),
			true,
			'Agents Window may show MCP Server Resources in quick access'
		);
	});

	test('mcp.json Add Server editor action stays gated to Agents Window', () => {
		const item = findEditorContentItem(McpCommandIds.AddConfiguration);

		assert.ok(item, 'Add Server editor action should remain registered');
		assert.ok(item.when, 'Add Server editor action should have a when clause');

		const defaultWindowMcpJson = { ...defaultWindow, ...mcpJsonEditor };
		const agentsWindowMcpJson = { ...agentsWindow, ...mcpJsonEditor };

		assert.strictEqual(
			evalWhen(item.when, defaultWindowMcpJson),
			false,
			'default Code window must hide Add Server in mcp.json editor'
		);
		assert.strictEqual(
			evalWhen(item.when, agentsWindowMcpJson),
			true,
			'Agents Window may show Add Server in mcp.json editor'
		);
	});
});
