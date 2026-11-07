/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Replaces the closing brace of the top-level object in `argv.json` with
 * `additionalContent`, which is expected to end with its own closing brace.
 */
export function appendToArgvJson(argvString: string, additionalContent: string): string {
	// The file may end with `\r\n`, several line breaks or none at all.
	const closingBraceIndex = argvString.lastIndexOf('}');
	if (closingBraceIndex === -1) {
		throw new Error('Unable to find the end of the argv.json object');
	}

	return argvString.substring(0, closingBraceIndex).concat(',\n', additionalContent);
}
