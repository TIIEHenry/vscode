/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';

/**
 * Sessions sidebar empty chrome. New session is a real local action; this
 * must not advertise a stub conversation or invent an engine session.
 */
export const conversationSessionsViewEmptyMessage = localize(
	'conversationSessionsView.empty',
	"No sessions — use New session to start one.",
);
