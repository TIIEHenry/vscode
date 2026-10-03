/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../base/common/uri.js';
import { ILogService } from '../../log/common/log.js';
import { AuthInfo, Credentials } from '../../request/common/request.js';

export type ShowProxyCredentialsDialog = (
	authInfo: AuthInfo,
	authInfoHash: string,
	storedUsername: string | undefined,
	storedPassword: string | undefined,
) => Promise<Credentials | undefined>;

export interface DoResolveProxyCredentialsDeps {
	logService: Pick<ILogService, 'trace' | 'error'>;
	extensionTestsLocationURI: URI | undefined;
	getHttpProxyUrl: () => string | undefined;
	getStoredCredentials: (authInfoHash: string) => Promise<Credentials | undefined>;
	showProxyCredentialsDialog: ShowProxyCredentialsDialog;
}

export interface DoResolveProxyCredentialsState {
	sessionCredentials: Map<string, Credentials | undefined>;
	currentDialog: Promise<Credentials | undefined> | undefined;
}

export async function doResolveProxyCredentials(
	authInfo: AuthInfo,
	authInfoHash: string,
	deps: DoResolveProxyCredentialsDeps,
	state: DoResolveProxyCredentialsState,
): Promise<Credentials | undefined> {
	deps.logService.trace('auth#doResolveProxyCredentials - enter', authInfo);

	// For testing.
	if (deps.extensionTestsLocationURI) {
		try {
			const decodedRealm = Buffer.from(authInfo.realm, 'base64').toString('utf-8');
			if (decodedRealm.startsWith('{')) {
				return JSON.parse(decodedRealm);
			}
		} catch {
			// ignore
		}
		return undefined;
	}

	// Reply with manually supplied credentials. Fail if they are wrong.
	const newHttpProxy = deps.getHttpProxyUrl();

	if (newHttpProxy?.indexOf('@') !== -1) {
		const uri = URI.parse(newHttpProxy!);
		const i = uri.authority.indexOf('@');
		if (i !== -1) {
			if (authInfo.attempt > 1) {
				deps.logService.trace('auth#doResolveProxyCredentials (proxy) - exit - ignoring previously used config/envvar credentials');
			} else {
				deps.logService.trace('auth#doResolveProxyCredentials (proxy) - exit - found config/envvar credentials to use');
				const credentials = uri.authority.substring(0, i);
				const j = credentials.indexOf(':');
				if (j !== -1) {
					return {
						username: credentials.substring(0, j),
						password: credentials.substring(j + 1)
					};
				} else {
					return {
						username: credentials,
						password: ''
					};
				}
			}
		}
	}

	// Reply with session credentials unless we used them already.
	// In that case we need to show a login dialog again because
	// they seem invalid.
	const sessionCredentials = authInfo.attempt === 1 && state.sessionCredentials.get(authInfoHash);
	if (sessionCredentials) {
		deps.logService.trace('auth#doResolveProxyCredentials (proxy) - exit - found session credentials to use');

		const { username, password } = sessionCredentials;
		return { username, password };
	}

	let storedUsername: string | undefined;
	let storedPassword: string | undefined;
	try {
		const stored = await deps.getStoredCredentials(authInfoHash);
		if (stored) {
			storedUsername = stored.username;
			storedPassword = stored.password;
		}
	} catch (error) {
		deps.logService.error(error); // handle errors by asking user for login via dialog
	}

	// Reply with stored credentials unless we used them already.
	// In that case we need to show a login dialog again because
	// they seem invalid.
	if (authInfo.attempt === 1 && typeof storedUsername === 'string' && typeof storedPassword === 'string') {
		deps.logService.trace('auth#doResolveProxyCredentials (proxy) - exit - found stored credentials to use');

		state.sessionCredentials.set(authInfoHash, { username: storedUsername, password: storedPassword });
		return { username: storedUsername, password: storedPassword };
	}

	const previousDialog = state.currentDialog;
	// The async function reads `currentDialog` only after its first await, which
	// is after this assignment completes.
	let currentDialog!: Promise<Credentials | undefined>;
	currentDialog = state.currentDialog = (async () => {
		await previousDialog;
		const credentials = await deps.showProxyCredentialsDialog(authInfo, authInfoHash, storedUsername, storedPassword);
		if (state.currentDialog === currentDialog) {
			state.currentDialog = undefined;
		}
		return credentials;
	})();
	return currentDialog;
}
