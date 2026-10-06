/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AddressInfo } from 'net';

export type ServerListenErrorAction =
	| { readonly kind: 'exit'; readonly exitCode: number }
	| { readonly kind: 'handleServerError' };

/**
 * Decides how to react to an HTTP server `error` event before listen has assigned `address`.
 */
export function resolveServerListenErrorAction(address: string | AddressInfo | null): ServerListenErrorAction {
	if (address === null) {
		return { kind: 'exit', exitCode: 1 };
	}
	return { kind: 'handleServerError' };
}
