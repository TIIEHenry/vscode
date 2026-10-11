/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../base/common/uri.js';
import { IActiveSession } from '../services/sessions/common/sessionsManagement.js';

/**
 * Provisional sessions remain owned by the Agents composer and may be replaced or disposed, so only materialized sessions are safe to share across windows.
 */
export function getChatSessionToOpenInEditor(session: IActiveSession | undefined): URI | undefined {
	return session?.isCreated.get() ? session.resource : undefined;
}

/**
 * Sets the open-in-editor `session` query only for a materialized session.
 * Other query params are left as the caller built them.
 */
export function setOpenInEditorSessionParam(params: URLSearchParams, session: IActiveSession | undefined): void {
	const resource = getChatSessionToOpenInEditor(session);
	if (resource) {
		params.set('session', resource.toString());
	}
}
