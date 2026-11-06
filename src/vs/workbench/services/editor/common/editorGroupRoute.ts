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

let registeredRoute: IEditorGroupRoute | undefined;

/**
 * Registers the single editor-group route. Registering while another route
 * is still registered is a programming error.
 */
export function registerEditorGroupRoute(route: IEditorGroupRoute): IDisposable {
	if (registeredRoute) {
		throw new Error('An editor group route is already registered');
	}

	registeredRoute = route;

	return toDisposable(() => {
		if (registeredRoute === route) {
			registeredRoute = undefined;
		}
	});
}

export function getEditorGroupRoute(): IEditorGroupRoute | undefined {
	return registeredRoute;
}
