/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const wildcardBindAddresses = new Set(['0.0.0.0', '::']);

export function formatWebUiAvailableUrl(bindAddress: string, port: number): string {
	const host = wildcardBindAddresses.has(bindAddress) ? 'localhost' : formatHttpAuthorityHost(bindAddress);
	const portPart = port === 80 ? '' : `:${port}`;
	return `http://${host}${portPart}`;
}

function formatHttpAuthorityHost(address: string): string {
	if (address.includes(':') && !(address.startsWith('[') && address.endsWith(']'))) {
		return `[${address}]`;
	}
	return address;
}
