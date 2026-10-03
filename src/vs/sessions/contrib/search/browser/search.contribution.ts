/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { basename, dirname, isEqual } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { KeybindingWeight, KeybindingsRegistry } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ExplorerFolderContext } from '../../../../workbench/contrib/files/common/files.js';
import { IExplorerService } from '../../../../workbench/contrib/files/browser/files.js';
import { OpenEditorCommandId } from '../../../../workbench/contrib/searchEditor/browser/constants.js';
import { resolveResourcesForSearchIncludes } from '../../../../workbench/services/search/common/queryBuilder.js';
import { SESSIONS_FILES_VIEW_ID } from '../../files/browser/filesView.js';

KeybindingsRegistry.registerKeybindingRule({
	id: OpenEditorCommandId,
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyF,
	weight: KeybindingWeight.WorkbenchContrib,
});

MenuRegistry.appendMenuItem(MenuId.ViewTitle, {
	command: {
		id: OpenEditorCommandId,
		title: localize2('openSearch', "Search"),
		icon: Codicon.search,
	},
	group: '1_files',
	order: 0,
	when: ContextKeyExpr.equals('view', SESSIONS_FILES_VIEW_ID),
});

MenuRegistry.appendMenuItem(MenuId.MenubarViewMenu, {
	command: {
		id: OpenEditorCommandId,
		title: localize({ key: 'miSearch', comment: ['&& denotes a mnemonic'] }, "&&Search"),
	},
	group: '4_auxbar',
	order: 1,
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'sessions.files.action.findInFolder',
			title: localize2('findInFolder', "Find in Folder..."),
			menu: {
				id: MenuId.ExplorerContext,
				group: '4_search',
				order: 10,
				when: ExplorerFolderContext,
			},
		});
	}

	async run(accessor: ServicesAccessor, resource?: unknown, forwarded?: unknown) {
		const explorerService = accessor.get(IExplorerService);
		const fileService = accessor.get(IFileService);
		const contextService = accessor.get(IWorkspaceContextService);
		const commandService = accessor.get(ICommandService);
		const notificationService = accessor.get(INotificationService);

		// The explorer menu forwards the clicked arg (a URI, or `{}` when the click missed every row) and the selection.
		// A truthy non-URI must not be stat'd, and a failed or out-of-session folder must not widen to the whole workspace.
		const resources = distinctUris(resolveFindInFolderTargets(resource, forwarded, () =>
			explorerService.getContext(true, true).map(item => item.resource).filter(candidate => URI.isUri(candidate))));
		if (resources.length === 0) {
			notificationService.error(localize('findInFolder.noFolder', "Choose a folder in the Files view to search."));
			return;
		}

		const results = await fileService.resolveAll(resources.map(candidate => ({ resource: candidate })));
		const folders: URI[] = [];
		const failed: URI[] = [];
		for (const [index, result] of results.entries()) {
			const requested = resources[index];
			if (result.success && result.stat) {
				folders.push(result.stat.isDirectory ? result.stat.resource : dirname(result.stat.resource));
			} else if (requested) {
				failed.push(requested);
			}
		}

		const searchable: URI[] = [];
		const outside: URI[] = [];
		for (const folder of distinctUris(folders)) {
			if (contextService.isInsideWorkspace(folder)) {
				searchable.push(folder);
			} else {
				outside.push(folder);
			}
		}

		const skipped = [...failed, ...outside];
		if (searchable.length === 0) {
			notificationService.error(failureMessage(failed, outside, resources));
			return;
		}

		if (skipped.length > 0) {
			notificationService.warn(localize('findInFolder.skipped', "Couldn't search {0}. Searching the other selected folders.", resourceLabels(skipped)));
		}

		const filesToInclude = resolveResourcesForSearchIncludes(searchable, contextService);
		await commandService.executeCommand(OpenEditorCommandId, {
			filesToInclude: filesToInclude.join(', '),
			showIncludesExcludes: true,
			location: 'reuse',
		});
	}
});

function resolveFindInFolderTargets(resource: unknown, forwarded: unknown, explorerResources: () => readonly URI[]): readonly URI[] {
	const forwardedUris = asUris(forwarded);
	const clicked = URI.isUri(resource) ? resource : undefined;
	if (forwardedUris.length > 0) {
		if (clicked && !forwardedUris.some(uri => isEqual(uri, clicked))) {
			return [clicked, ...forwardedUris];
		}
		return forwardedUris;
	}

	if (clicked) {
		const selected = explorerResources();
		if (selected.length > 1 && selected.some(uri => isEqual(uri, clicked))) {
			return selected;
		}
		return [clicked];
	}

	return explorerResources();
}

function asUris(value: unknown): URI[] {
	if (URI.isUri(value)) {
		return [value];
	}
	if (Array.isArray(value)) {
		return value.filter((entry): entry is URI => URI.isUri(entry));
	}
	return [];
}

function distinctUris(uris: readonly URI[]): URI[] {
	const result: URI[] = [];
	for (const uri of uris) {
		if (!result.some(existing => isEqual(existing, uri))) {
			result.push(uri);
		}
	}
	return result;
}

function resourceLabels(resources: readonly URI[]): string {
	return resources.map(resource => basename(resource) || resource.path).join(', ');
}

function failureMessage(failed: readonly URI[], outside: readonly URI[], requested: readonly URI[]): string {
	if (failed.length === 0 && outside.length > 0) {
		return localize('findInFolder.outside', "Couldn't search {0}. It isn't in this session's workspace.", resourceLabels(outside));
	}
	return localize('findInFolder.unreadable', "Couldn't search {0}. It may have been moved or deleted.", resourceLabels(failed.length > 0 ? failed : requested));
}
