/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const SERVER_ENV_ARG_KEYS = ['host', 'port', 'accept-server-license-terms'] as const;

/**
 * Applies `VSCODE_SERVER_*` environment variables to parsed CLI args when a flag was not set on the command line.
 */
export function applyServerEnvironmentVariablesToParsedArgs(parsedArgs: Record<string, unknown>, env: NodeJS.ProcessEnv): void {
	for (const key of SERVER_ENV_ARG_KEYS) {
		if (!parsedArgs[key]) {
			const envKey = `VSCODE_SERVER_${key.toUpperCase().replace(/-/g, '_')}`;
			const envValue = env[envKey];
			if (envValue) {
				if (key === 'accept-server-license-terms' && envValue === 'true') {
					parsedArgs[key] = true;
				} else {
					parsedArgs[key] = envValue;
				}
			}
		}
	}
}
