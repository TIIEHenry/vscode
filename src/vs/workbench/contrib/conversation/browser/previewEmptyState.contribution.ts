/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IUniverseAgentPty, previewUniverseAgentPtyEditorCommandId } from '../../../../platform/universeAgent/common/universeAgentPty.js';
import { IEditorGroupWatermarkTipsSession, IPreviewCategoryEmptyState, IPreviewCategoryEmptyStateAction, previewTerminalLocalCommandId, registerEditorGroupWatermarkTips } from '../../../services/editor/common/editorGroupWatermarkTips.js';
import { PreviewCategory } from '../../../services/editor/common/previewCategoryService.js';

/**
 * Preview Terminal empty state: engine editor pty when connected and the
 * main-process bridge is available; otherwise the local editor terminal.
 */
export function previewTerminalEmptyStateCommand(connected: boolean, bridgeAvailable: boolean): string {
	if (connected && bridgeAvailable) {
		return previewUniverseAgentPtyEditorCommandId;
	}
	return previewTerminalLocalCommandId;
}

function getCategoryIconClass(category: PreviewCategory): string | undefined {
	switch (category) {
		case PreviewCategory.Overview:
			return 'home';
		case PreviewCategory.Terminal:
			return 'terminal';
		case PreviewCategory.Code:
			return 'code';
		case PreviewCategory.Web:
			return 'globe';
		case PreviewCategory.Planning:
			return 'checklist';
		case PreviewCategory.History:
			return 'history';
		case PreviewCategory.Artifacts:
			return 'package';
		default:
			return undefined;
	}
}

function getCategoryEmptyTitle(category: PreviewCategory): string | undefined {
	switch (category) {
		case PreviewCategory.Overview:
			return localize('previewEmpty.overview.title', "Workspace Overview");
		case PreviewCategory.Terminal:
			return localize('previewEmpty.terminal.title', "No Active Terminal");
		case PreviewCategory.Code:
			return localize('previewEmpty.code.title', "No Open Code Editors");
		case PreviewCategory.Web:
			return localize('previewEmpty.web.title', "No Web Preview");
		case PreviewCategory.Planning:
			return localize('previewEmpty.planning.title', "No Planning Documents");
		case PreviewCategory.History:
			return localize('previewEmpty.history.title', "No History Records");
		case PreviewCategory.Artifacts:
			return localize('previewEmpty.artifacts.title', "No Generated Artifacts");
		default:
			return undefined;
	}
}

function getCategoryEmptyDesc(category: PreviewCategory): string | undefined {
	switch (category) {
		case PreviewCategory.Overview:
			return localize('previewEmpty.overview.desc', "The Welcome page and walkthroughs open here.");
		case PreviewCategory.Terminal:
			return localize('previewEmpty.terminal.desc', "Terminals open in the bottom panel by default. Terminals you open or move into the editor area appear here.");
		case PreviewCategory.Code:
			return localize('previewEmpty.code.desc', "Select files from the Sources file tree or jump directly from conversation references.");
		case PreviewCategory.Web:
			return localize('previewEmpty.web.desc', "Start local dev servers or launch web applications to inspect preview results.");
		case PreviewCategory.Planning:
			return localize('previewEmpty.planning.desc', "The todo list of the active agent session opens here.");
		case PreviewCategory.History:
			return localize('previewEmpty.history.desc', "Read-only past versions open here: files and diffs from earlier commits, and local history snapshots.");
		case PreviewCategory.Artifacts:
			return localize('previewEmpty.artifacts.desc', "No content source is connected to this category yet.");
		default:
			return undefined;
	}
}

/**
 * Per-watermark state: whether the Pty bridge is usable on the current
 * engine connection, and the Terminal empty-state command derived from it.
 */
class PreviewEmptyStateTipsSession extends Disposable implements IEditorGroupWatermarkTipsSession {

	// undefined: not confirmed on this connection (probe in flight, or the last probe was rejected).
	// false: confirmed unavailable, including when the engine is disconnected.
	private bridgeAvailable: boolean | undefined = false;
	private bridgeQueryGeneration = 0;
	private bridgeProbe: Promise<void> | undefined;
	private bridgeProbeGeneration = 0;

	constructor(
		private readonly onDidChange: () => void,
		@ICommandService private readonly commandService: ICommandService,
		@IUniverseAgentConnection private readonly universeAgentConnection: IUniverseAgentConnection,
		@IUniverseAgentPty private readonly universeAgentPty: IUniverseAgentPty,
	) {
		super();

		this._register(this.universeAgentConnection.onDidChangeConnection(() => {
			if (!this.isEngineConnected()) {
				this.bridgeQueryGeneration++;
				this.bridgeAvailable = false;
				this.bridgeProbe = undefined;
				this.bridgeProbeGeneration = 0;
				this.onDidChange();
			} else {
				// Unknown before paint, so a click during the probe is not the local command.
				void this.queryBridgeAvailable();
				this.onDidChange();
			}
		}));

		if (this.isEngineConnected()) {
			// Marks the bridge unknown before the first paint.
			void this.queryBridgeAvailable();
		}
	}

	override dispose(): void {
		this.bridgeQueryGeneration++;
		this.bridgeProbe = undefined;
		this.bridgeProbeGeneration = 0;
		super.dispose();
	}

	getCategoryEmptyState(category: PreviewCategory): IPreviewCategoryEmptyState | undefined {
		const icon = getCategoryIconClass(category);
		const title = getCategoryEmptyTitle(category);
		const description = getCategoryEmptyDesc(category);
		if (icon === undefined || title === undefined || description === undefined) {
			return undefined;
		}
		return { icon, title, description, actions: this.getCategoryActions(category) };
	}

	async runPendingTerminalEmptyState(): Promise<void> {
		// A still-connected change retires the probe captured at entry and leaves
		// bridgeAvailable unknown. Follow that replacement; do not start another query.
		let waited = this.bridgeProbe;
		if (waited) {
			await waited;
		} else {
			waited = this.queryBridgeAvailable();
			await waited;
		}

		while (!this._store.isDisposed && this.bridgeAvailable === undefined) {
			const newer = this.bridgeProbe;
			if (!newer || newer === waited) {
				return;
			}
			waited = newer;
			await waited;
		}

		const bridgeAvailable = this.bridgeAvailable;
		if (this._store.isDisposed || bridgeAvailable === undefined) {
			return;
		}

		const connected = this.isEngineConnected();
		void this.commandService.executeCommand(previewTerminalEmptyStateCommand(connected, bridgeAvailable));
	}

	private isEngineConnected(): boolean {
		return !!this.universeAgentConnection?.isEngineConnected();
	}

	private queryBridgeAvailable(): Promise<void> {
		if (this._store.isDisposed) {
			return Promise.resolve();
		}

		const generation = ++this.bridgeQueryGeneration;
		if (!this.isEngineConnected()) {
			this.bridgeAvailable = false;
			this.bridgeProbe = undefined;
			this.bridgeProbeGeneration = 0;
			return Promise.resolve();
		}

		this.bridgeAvailable = undefined;
		this.bridgeProbeGeneration = generation;
		const promise = this.finishBridgeQuery(generation);
		// A probe that already settled (synchronous throw) must not stay in flight.
		if (this.bridgeProbeGeneration === generation) {
			this.bridgeProbe = promise;
		}
		return promise;
	}

	private async finishBridgeQuery(generation: number): Promise<void> {
		let rejected = false;
		let result = false;
		try {
			result = this.universeAgentPty ? await this.universeAgentPty.isBridgeAvailable() : false;
		} catch {
			// Rejection is not confirmed-unavailable. The next click on this connection probes again.
			rejected = true;
		}

		if (this.bridgeProbeGeneration === generation) {
			this.bridgeProbeGeneration = 0;
			this.bridgeProbe = undefined;
		}

		if (this._store.isDisposed || generation !== this.bridgeQueryGeneration) {
			return;
		}

		if (!this.isEngineConnected()) {
			return;
		}

		if (rejected) {
			this.bridgeAvailable = undefined;
			return;
		}

		this.bridgeAvailable = result;
		this.onDidChange();
	}

	private terminalEmptyStateCommandId(): string | undefined {
		const connected = this.isEngineConnected();
		if (!connected) {
			return previewTerminalEmptyStateCommand(false, false);
		}
		const bridgeAvailable = this.bridgeAvailable;
		if (bridgeAvailable === undefined) {
			return undefined;
		}
		return previewTerminalEmptyStateCommand(true, bridgeAvailable);
	}

	private getCategoryActions(category: PreviewCategory): readonly IPreviewCategoryEmptyStateAction[] {
		switch (category) {
			case PreviewCategory.Terminal:
				return [
					{ id: this.terminalEmptyStateCommandId(), label: localize('previewAction.newTerminalEditor', "New Terminal"), icon: 'terminal' },
				];
			case PreviewCategory.Code:
				return [
					{ id: 'workbench.action.files.openFile', label: localize('previewAction.openFile', "Open File"), icon: 'file' },
					{ id: 'workbench.action.files.newUntitledFile', label: localize('previewAction.newFile', "New File"), icon: 'new-file' },
				];
			case PreviewCategory.Web:
				return [
					{ id: 'workbench.action.browser.open', label: localize('previewAction.openBrowser', "Open Browser"), icon: 'globe' },
				];
			case PreviewCategory.Planning:
				return [
					{ id: 'workbench.action.planning.openTodos', label: localize('previewAction.openPlanningTodos', "Open Planning Todos"), icon: 'checklist' },
				];
			default:
				return [];
		}
	}
}

registerEditorGroupWatermarkTips({
	createSession(instantiationService: IInstantiationService, onDidChange: () => void): IEditorGroupWatermarkTipsSession {
		return instantiationService.createInstance(PreviewEmptyStateTipsSession, onDidChange);
	},
	async resolveTerminalEmptyStateCommand(accessor: ServicesAccessor): Promise<string> {
		const connection = accessor.get(IUniverseAgentConnection);
		const pty = accessor.get(IUniverseAgentPty);
		const connected = connection.isEngineConnected();
		let bridgeAvailable = false;
		if (connected) {
			try {
				bridgeAvailable = await pty.isBridgeAvailable();
			} catch {
				bridgeAvailable = false;
			}
		}
		return previewTerminalEmptyStateCommand(connected, bridgeAvailable);
	},
});
