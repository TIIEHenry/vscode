/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as http from 'http';
import { requestHasValidConnectionToken, ServerConnectionToken } from './serverConnectionToken.js';

export const delayShutdownPathname = '/delay-shutdown';

export type RouteDelayShutdownResult = 'not-matched' | 'forbidden' | 'ok';

/**
 * Routes `GET /delay-shutdown` with connection-token validation.
 * When the token is invalid, `delay` is not invoked.
 */
export function routeDelayShutdown(
	pathname: string,
	connectionToken: ServerConnectionToken,
	req: Pick<http.IncomingMessage, 'headers'>,
	searchParams: URLSearchParams,
	delay: () => void,
): RouteDelayShutdownResult {
	if (pathname !== delayShutdownPathname) {
		return 'not-matched';
	}
	if (!requestHasValidConnectionToken(connectionToken, req, searchParams)) {
		return 'forbidden';
	}
	delay();
	return 'ok';
}

/**
 * Handles `GET /delay-shutdown` after connection-token validation has succeeded.
 */
export function routeDelayShutdownAfterAuth(pathname: string, delay: () => void): boolean {
	if (pathname !== delayShutdownPathname) {
		return false;
	}
	delay();
	return true;
}
