/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { PreviewCategory } from './previewCategoryService.js';

/** Local editor terminal. Used when no tips contribution is registered, the engine is disconnected, or the Pty bridge is absent. */
export const previewTerminalLocalCommandId = 'workbench.action.createTerminalEditor';

/** One button on a Preview category empty state. */
export interface IPreviewCategoryEmptyStateAction {
	/** Command to run. `undefined` while the command is not known yet: the click then goes to `runPendingTerminalEmptyState`. */
	readonly id: string | undefined;
	readonly label: string;
	/** Codicon name without the `codicon-` prefix. */
	readonly icon: string;
}

/** Title, description, icon and buttons shown when a Preview category has no editors. */
export interface IPreviewCategoryEmptyState {
	/** Codicon name without the `codicon-` prefix. */
	readonly icon: string;
	readonly title: string;
	readonly description: string;
	readonly actions: readonly IPreviewCategoryEmptyStateAction[];
}

/**
 * Per-watermark state of the tips contribution. Created before the first
 * render of the watermark and disposed with it.
 */
export interface IEditorGroupWatermarkTipsSession extends IDisposable {

	/** Empty state of `category`. `undefined` lets the watermark use its default text. */
	getCategoryEmptyState(category: PreviewCategory): IPreviewCategoryEmptyState | undefined;

	/** Runs the Terminal empty-state command once it is known. Called for an action whose `id` is `undefined`. */
	runPendingTerminalEmptyState(): Promise<void>;
}

/**
 * Product text and command choices for the editor group watermark. The
 * watermark lives in `browser/parts` and must not import `contrib`, so the
 * product registers an implementation here.
 */
export interface IEditorGroupWatermarkTips {

	/**
	 * Creates the session of one watermark. `onDidChange` asks the watermark
	 * to render again; the session may call it at any time before it is disposed.
	 */
	createSession(instantiationService: IInstantiationService, onDidChange: () => void): IEditorGroupWatermarkTipsSession;

	/**
	 * Command id for the Terminal empty state, resolved once for callers
	 * without a watermark (double-click, `+` button). Services must be read
	 * from `accessor` before the first `await`.
	 */
	resolveTerminalEmptyStateCommand(accessor: ServicesAccessor): Promise<string>;
}

let registered: IEditorGroupWatermarkTips | undefined;

/** Registers the tips of the editor group watermark. Disposing restores what was registered before. */
export function registerEditorGroupWatermarkTips(tips: IEditorGroupWatermarkTips): IDisposable {
	return overrideEditorGroupWatermarkTips(tips);
}

/**
 * @internal Exported for unit tests: replaces the registration, including with
 * nothing, to exercise the unregistered state. Disposing restores what was
 * registered before.
 */
export function overrideEditorGroupWatermarkTips(tips: IEditorGroupWatermarkTips | undefined): IDisposable {
	const previous = registered;
	registered = tips;
	return toDisposable(() => {
		if (registered === tips) {
			registered = previous;
		}
	});
}

export function getEditorGroupWatermarkTips(): IEditorGroupWatermarkTips | undefined {
	return registered;
}
