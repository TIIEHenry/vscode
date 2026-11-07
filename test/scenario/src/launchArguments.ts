/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';

export function withIsolatedSharedDataDirectory(profileRoot: string, extraArgs: readonly string[]): string[] {
	return [`--shared-data-dir=${path.join(profileRoot, 'shared-data')}`, ...extraArgs];
}
