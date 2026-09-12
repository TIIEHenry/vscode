/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basename } from '../../../../base/common/path.js';
import { localize } from '../../../../nls.js';
import type { IWindowOpenable } from '../../../../platform/window/common/window.js';
import { URI } from '../../../../base/common/uri.js';
import type { ConversationStubSession } from '../../conversation/browser/conversationStubModel.js';
import { NAVIGATOR_STALE_SNAPSHOT_COPY } from '../common/navigatorAgentTreeEmptyState.js';
import type { NavigatorCapabilitySupport } from '../common/navigatorEngineBridge.js';

export type NavigatorProjectsNodeKind =
	| 'engine-root'
	| 'workdir'
	| 'session'
	| 'local-group'
	| 'local-folder'
	| 'note';

export interface INavigatorProjectsTreeNode {
	readonly id: string;
	readonly kind: NavigatorProjectsNodeKind;
	readonly label: string;
	readonly description?: string;
	readonly sessionId?: string;
	readonly resource?: URI;
	readonly openable?: IWindowOpenable;
	readonly remoteAuthority?: string;
	readonly currentWorkspace?: boolean;
	readonly children?: readonly INavigatorProjectsTreeNode[];
}

export interface INavigatorLocalFolderEntry {
	readonly id: string;
	readonly resource: URI;
	readonly name: string;
	readonly description?: string;
	readonly openable: IWindowOpenable;
	readonly remoteAuthority?: string;
}

export function normalizeNavigatorWorkDirKey(workDir: string | undefined): string {
	if (!workDir) {
		return '';
	}
	const normalized = workDir.replace(/\\/g, '/').replace(/\/+$/, '');
	return normalized || '/';
}

export function isNavigatorCurrentWorkspace(workDir: string | undefined, workspaceRoots: readonly string[]): boolean {
	const key = normalizeNavigatorWorkDirKey(workDir);
	if (!key) {
		return false;
	}
	return workspaceRoots.some(root => normalizeNavigatorWorkDirKey(root) === key);
}

function workDirGroupLabel(workDir: string | undefined, currentWorkspace: boolean): string {
	const base = workDir
		? basename(workDir.replace(/\\/g, '/'))
		: localize('navigatorProjects.defaultWorkDir', "Working directory");
	return currentWorkspace
		? localize('navigatorProjects.currentWorkspaceWorkDir', "{0} · current workspace", base)
		: base;
}

function buildWorkDirGroups(
	sessions: readonly ConversationStubSession[],
	fallbackWorkDir: string | undefined,
	workspaceRoots: readonly string[],
): INavigatorProjectsTreeNode[] {
	const buckets = new Map<string, { readonly workDir?: string; readonly sessions: ConversationStubSession[] }>();
	for (const session of sessions) {
		const workDir = session.workDir || fallbackWorkDir;
		const key = normalizeNavigatorWorkDirKey(workDir) || 'default';
		const existing = buckets.get(key);
		if (existing) {
			existing.sessions.push(session);
		} else {
			buckets.set(key, { workDir, sessions: [session] });
		}
	}
	if (buckets.size === 0) {
		const currentWorkspace = isNavigatorCurrentWorkspace(fallbackWorkDir, workspaceRoots);
		return [{
			id: `workdir:${fallbackWorkDir ?? 'default'}`,
			kind: 'workdir',
			label: workDirGroupLabel(fallbackWorkDir, currentWorkspace),
			description: fallbackWorkDir,
			currentWorkspace,
			children: [],
		}];
	}
	return [...buckets.entries()]
		.sort(([keyA, a], [keyB, b]) => {
			const aCurrent = isNavigatorCurrentWorkspace(a.workDir, workspaceRoots) ? 0 : 1;
			const bCurrent = isNavigatorCurrentWorkspace(b.workDir, workspaceRoots) ? 0 : 1;
			if (aCurrent !== bCurrent) {
				return aCurrent - bCurrent;
			}
			return keyA.localeCompare(keyB);
		})
		.map(([, group]) => {
			const currentWorkspace = isNavigatorCurrentWorkspace(group.workDir, workspaceRoots);
			return {
				id: `workdir:${group.workDir ?? 'default'}`,
				kind: 'workdir' as const,
				label: workDirGroupLabel(group.workDir, currentWorkspace),
				description: group.workDir,
				currentWorkspace,
				children: group.sessions.map(session => ({
					id: `session:${session.id}`,
					kind: 'session' as const,
					label: session.title,
					sessionId: session.id,
				})),
			};
		});
}

export function buildNavigatorProjectsTree(input: {
	readonly engineConnected: boolean;
	readonly wasEverConnected: boolean;
	readonly transportFailed: boolean;
	readonly sessionListCapability: NavigatorCapabilitySupport;
	readonly workDir?: string;
	readonly workspaceRoots?: readonly string[];
	readonly sessions: readonly ConversationStubSession[];
	readonly localFolders: readonly INavigatorLocalFolderEntry[];
}): INavigatorProjectsTreeNode[] {
	const nodes: INavigatorProjectsTreeNode[] = [];

	if (input.engineConnected || input.wasEverConnected) {
		const engineChildren: INavigatorProjectsTreeNode[] = [];

		if (input.transportFailed) {
			engineChildren.push({
				id: 'engine:transport-failed',
				kind: 'note',
				label: localize('navigatorProjects.transportFailed', "Connection failed · Showing snapshot from before disconnect"),
			});
		} else if (input.sessionListCapability === 'UNSUPPORTED') {
			engineChildren.push({
				id: 'engine:session-list-unsupported',
				kind: 'note',
				label: localize('navigatorProjects.sessionListUnsupported', "Current engine does not provide a session list"),
			});
		} else if (input.engineConnected && input.sessions.length === 0 && input.sessionListCapability === 'UNKNOWN') {
			engineChildren.push({
				id: 'engine:session-list-loading',
				kind: 'note',
				label: localize('navigatorProjects.loadingSessions', "Reading…"),
			});
		} else {
			if (!input.engineConnected && input.wasEverConnected) {
				engineChildren.push({
					id: 'engine:stale-snapshot',
					kind: 'note',
					label: NAVIGATOR_STALE_SNAPSHOT_COPY,
				});
			}
			engineChildren.push(...buildWorkDirGroups(input.sessions, input.workDir, input.workspaceRoots ?? []));
		}

		nodes.push({
			id: 'engine:root',
			kind: 'engine-root',
			label: localize('navigatorProjects.engineRoot', "Engine"),
			children: engineChildren,
		});
	}

	if (input.localFolders.length > 0) {
		nodes.push({
			id: 'local:group',
			kind: 'local-group',
			label: localize('navigatorProjects.localFolders', "Local folders"),
			children: input.localFolders.map(folder => ({
				id: folder.id,
				kind: 'local-folder',
				label: folder.name,
				description: folder.description,
				resource: folder.resource,
				openable: folder.openable,
				remoteAuthority: folder.remoteAuthority,
			})),
		});
	}

	return nodes;
}

export function flattenLocalFolderEntries(nodes: readonly INavigatorProjectsTreeNode[]): INavigatorLocalFolderEntry[] {
	const folders: INavigatorLocalFolderEntry[] = [];
	for (const node of nodes) {
		if (node.kind === 'local-group') {
			for (const child of node.children ?? []) {
				if (child.kind === 'local-folder' && child.openable && child.resource) {
					folders.push({
						id: child.id,
						resource: child.resource,
						name: child.label,
						description: child.description,
						openable: child.openable,
						remoteAuthority: child.remoteAuthority,
					});
				}
			}
		}
	}
	return folders;
}

export function countLocalFolders(nodes: readonly INavigatorProjectsTreeNode[]): number {
	return flattenLocalFolderEntries(nodes).length;
}
