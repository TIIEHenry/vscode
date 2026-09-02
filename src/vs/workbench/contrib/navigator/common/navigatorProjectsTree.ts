/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basename } from '../../../../base/common/path.js';
import { localize } from '../../../../nls.js';
import type { IWindowOpenable } from '../../../../platform/window/common/window.js';
import { URI } from '../../../../base/common/uri.js';
import type { ConversationStubSession } from '../../conversation/browser/conversationStubModel.js';
import type { NavigatorCapabilitySupport } from './navigatorEngineBridge.js';

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

export function buildNavigatorProjectsTree(input: {
	readonly engineConnected: boolean;
	readonly wasEverConnected: boolean;
	readonly transportFailed: boolean;
	readonly sessionListCapability: NavigatorCapabilitySupport;
	readonly workDir?: string;
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
				label: localize('navigatorProjects.transportFailed', "连接失败 · 显示为断开前快照"),
			});
		} else if (input.sessionListCapability === 'UNSUPPORTED') {
			engineChildren.push({
				id: 'engine:session-list-unsupported',
				kind: 'note',
				label: localize('navigatorProjects.sessionListUnsupported', "当前引擎不提供会话列表"),
			});
		} else if (input.engineConnected && input.sessions.length === 0 && input.sessionListCapability === 'UNKNOWN') {
			engineChildren.push({
				id: 'engine:session-list-loading',
				kind: 'note',
				label: localize('navigatorProjects.loadingSessions', "正在读取…"),
			});
		} else {
			const workDirLabel = input.workDir
				? basename(input.workDir.replace(/\\/g, '/'))
				: localize('navigatorProjects.defaultWorkDir', "工作目录");
			const sessionNodes: INavigatorProjectsTreeNode[] = input.sessions.map(session => ({
				id: `session:${session.id}`,
				kind: 'session',
				label: session.title,
				sessionId: session.id,
			}));
			engineChildren.push({
				id: `workdir:${input.workDir ?? 'default'}`,
				kind: 'workdir',
				label: workDirLabel,
				description: input.workDir,
				children: sessionNodes,
			});
		}

		nodes.push({
			id: 'engine:root',
			kind: 'engine-root',
			label: localize('navigatorProjects.engineRoot', "引擎"),
			children: engineChildren,
		});
	}

	if (input.localFolders.length > 0) {
		nodes.push({
			id: 'local:group',
			kind: 'local-group',
			label: localize('navigatorProjects.localFolders', "本地文件夹"),
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
