/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../base/common/lifecycle.js';
import * as path from '../../../base/common/path.js';
import * as process from '../../../base/common/process.js';
import { URI } from '../../../base/common/uri.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { IExtHostDocumentsAndEditors } from './extHostDocumentsAndEditors.js';
import { IExtHostEditorTabs } from './extHostEditorTabs.js';
import { IExtHostExtensionService } from './extHostExtensionService.js';
import { CustomEditorTabInput, NotebookDiffEditorTabInput, NotebookEditorTabInput, TextDiffTabInput, TextTabInput } from './extHostTypes.js';
import { IExtHostWorkspace } from './extHostWorkspace.js';
import { IConfigurationResolverService } from '../../services/configurationResolver/common/configurationResolver.js';
import { AbstractVariableResolverService } from '../../services/configurationResolver/common/variableResolver.js';
import * as vscode from 'vscode';
import { ExtHostConfigProvider, IExtHostConfiguration } from './extHostConfiguration.js';

export interface IExtHostVariableResolverProvider {
	readonly _serviceBrand: undefined;
	getResolver(): Promise<IConfigurationResolverService>;
}

export const IExtHostVariableResolverProvider = createDecorator<IExtHostVariableResolverProvider>('IExtHostVariableResolverProvider');

interface DynamicContext {
	folders: vscode.WorkspaceFolder[];
}

class ExtHostVariableResolverService extends AbstractVariableResolverService {

	constructor(
		extensionService: IExtHostExtensionService,
		workspaceService: IExtHostWorkspace,
		editorService: IExtHostDocumentsAndEditors,
		editorTabs: IExtHostEditorTabs,
		configProvider: ExtHostConfigProvider,
		context: DynamicContext,
		homeDir: string | undefined,
	) {
		function getActiveUri(): URI | undefined {
			if (editorService) {
				const activeEditor = editorService.activeEditor();
				if (activeEditor) {
					return activeEditor.document.uri;
				}
				const activeTab = editorTabs.tabGroups.all.find(group => group.isActive)?.activeTab;
				if (activeTab !== undefined) {
					// Resolve a resource from the tab
					if (activeTab.input instanceof TextDiffTabInput || activeTab.input instanceof NotebookDiffEditorTabInput) {
						return activeTab.input.modified;
					} else if (activeTab.input instanceof TextTabInput || activeTab.input instanceof NotebookEditorTabInput || activeTab.input instanceof CustomEditorTabInput) {
						return activeTab.input.uri;
					}
				}
			}
			return undefined;
		}

		super({
			getFolderUri: (folderName: string): URI | undefined => {
				const found = context.folders.filter(f => f.name === folderName);
				if (found && found.length > 0) {
					return found[0].uri;
				}
				return undefined;
			},
			getWorkspaceFolderCount: (): number => {
				return context.folders.length;
			},
			getConfigurationValue: (folderUri: URI | undefined, section: string): string | undefined => {
				return configProvider.getConfiguration(undefined, folderUri).get<string>(section);
			},
			getAppRoot: (): string | undefined => {
				return process.cwd();
			},
			getExecPath: (): string | undefined => {
				return process.env['VSCODE_EXEC_PATH'];
			},
			getFilePath: (): string | undefined => {
				const activeUri = getActiveUri();
				if (activeUri) {
					return path.normalize(activeUri.fsPath);
				}
				return undefined;
			},
			getWorkspaceFolderPathForFile: (): string | undefined => {
				if (workspaceService) {
					const activeUri = getActiveUri();
					if (activeUri) {
						const ws = workspaceService.getWorkspaceFolder(activeUri);
						if (ws) {
							return path.normalize(ws.uri.fsPath);
						}
					}
				}
				return undefined;
			},
			getSelectedText: (): string | undefined => {
				if (editorService) {
					const activeEditor = editorService.activeEditor();
					if (activeEditor && !activeEditor.selection.isEmpty) {
						return activeEditor.document.getText(activeEditor.selection);
					}
				}
				return undefined;
			},
			getLineNumber: (): string | undefined => {
				if (editorService) {
					const activeEditor = editorService.activeEditor();
					if (activeEditor) {
						return String(activeEditor.selection.end.line + 1);
					}
				}
				return undefined;
			},
			getColumnNumber: (): string | undefined => {
				if (editorService) {
					const activeEditor = editorService.activeEditor();
					if (activeEditor) {
						return String(activeEditor.selection.end.character + 1);
					}
				}
				return undefined;
			},
			getExtension: (id) => {
				return extensionService.getExtension(id);
			},
		}, undefined, homeDir ? Promise.resolve(homeDir) : undefined, Promise.resolve(process.env));
	}
}

/**
 * Shares one in-flight or successful extension-host variable resolver.
 * A rejection clears `promise` only while it still points at that attempt,
 * so the next call creates the resolver again. A fulfillment stays cached.
 * The returned promise still rejects; this does not start another attempt.
 */
export function shareExtHostVariableResolver<T>(
	slot: { promise: Promise<T> | undefined },
	create: () => Promise<T>,
): Promise<T> {
	if (slot.promise) {
		return slot.promise;
	}

	const attempt = create();
	slot.promise = attempt;
	// Not assigned. Callers still observe this rejection; the next call creates again.
	void attempt.catch(() => {
		if (slot.promise === attempt) {
			slot.promise = undefined;
		}
	});
	return attempt;
}

export class ExtHostVariableResolverProviderService extends Disposable implements IExtHostVariableResolverProvider {
	declare readonly _serviceBrand: undefined;

	private readonly _resolverSlot: { promise: Promise<IConfigurationResolverService> | undefined } = { promise: undefined };

	constructor(
		@IExtHostExtensionService private readonly extensionService: IExtHostExtensionService,
		@IExtHostWorkspace private readonly workspaceService: IExtHostWorkspace,
		@IExtHostDocumentsAndEditors private readonly editorService: IExtHostDocumentsAndEditors,
		@IExtHostConfiguration private readonly configurationService: IExtHostConfiguration,
		@IExtHostEditorTabs private readonly editorTabs: IExtHostEditorTabs,
	) {
		super();
	}

	public getResolver(): Promise<IConfigurationResolverService> {
		return shareExtHostVariableResolver(this._resolverSlot, () => this.createResolver());
	}

	private async createResolver(): Promise<IConfigurationResolverService> {
		const configProvider = await this.configurationService.getConfigProvider();
		const folders = await this.workspaceService.getWorkspaceFolders2() || [];

		const dynamic: DynamicContext = { folders };
		const resolver = new ExtHostVariableResolverService(
			this.extensionService,
			this.workspaceService,
			this.editorService,
			this.editorTabs,
			configProvider,
			dynamic,
			this.homeDir(),
		);
		this._register(this.workspaceService.onDidChangeWorkspace(async () => {
			dynamic.folders = await this.workspaceService.getWorkspaceFolders2() || [];
		}));
		return resolver;
	}

	protected homeDir(): string | undefined {
		return undefined;
	}
}
