/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IUntypedEditorInput } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';

/**
 * How the registered route sees an editor input when the finder resolves a
 * Conversation target.
 *
 * - `exclusive`: the input belongs to a Conversation leaf and must name one.
 * - `foreign`: the input must stay out of Conversation leaves and lands in
 *   the main Preview part instead.
 *
 * `getEditorGroupRoute()` returning `undefined` is the third state: nothing
 * is registered, so the finder neither throws nor treats any input as
 * `exclusive`.
 */
export type EditorGroupRouteKind = 'exclusive' | 'foreign';

/**
 * Registration point through which the conversation contribution tells the
 * editor-group core how to route inputs. `editorGroupFinder` and `EditorParts`
 * read it; the core never imports the contribution.
 */
export interface IEditorGroupRoute {

	classify(input: EditorInput | IUntypedEditorInput): EditorGroupRouteKind;

	/**
	 * Whether an open editor counts as an extension tab inside a Conversation
	 * leaf, i.e. a tab beyond the default root that should make the tabs bar
	 * show.
	 */
	isExtensionTab(input: EditorInput): boolean;

	/**
	 * Creates the default root editor that a freshly created Conversation
	 * leaf opens. The caller owns the returned input.
	 */
	createDefaultRoot(instantiationService: IInstantiationService, sessionKey: string): EditorInput;
}

/**
 * Holds at most one route. The workbench uses a single process-wide
 * instance (see {@link registerEditorGroupRoute}); tests may construct their
 * own to exercise the lifecycle without touching the global one.
 */
export class EditorGroupRouteRegistry {

	private route: IEditorGroupRoute | undefined;

	/**
	 * Registers the single route. Registering while another route is still
	 * registered is a programming error. Disposing the returned handle
	 * unregisters the route; a stale handle never unregisters a newer route.
	 */
	register(route: IEditorGroupRoute): IDisposable {
		if (this.route) {
			throw new Error('An editor group route is already registered');
		}

		this.route = route;

		return toDisposable(() => {
			if (this.route === route) {
				this.route = undefined;
			}
		});
	}

	get(): IEditorGroupRoute | undefined {
		return this.route;
	}
}

const registry = new EditorGroupRouteRegistry();

/**
 * Registers the process-wide editor-group route. The registering module
 * owns the returned handle; in the product the conversation contribution
 * keeps it for the lifetime of the process and marks it as a singleton.
 */
export function registerEditorGroupRoute(route: IEditorGroupRoute): IDisposable {
	return registry.register(route);
}

export function getEditorGroupRoute(): IEditorGroupRoute | undefined {
	return registry.get();
}
