/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ISCMResource } from '../../scm/common/scm.js';

/** SCM identity captured when a preview diff was opened. */
export interface ISourcesDiffOpenIdentity {
	readonly groupId: string;
	readonly scmResource?: ISCMResource;
}

const openIdentities = new WeakMap<object, ISourcesDiffOpenIdentity>();

export function rememberSourcesDiffOpenIdentity(input: unknown, identity: ISourcesDiffOpenIdentity): void {
	if (!input || typeof input !== 'object') {
		return;
	}
	openIdentities.set(input, identity);
}

export function sourcesDiffOpenIdentity(input: object): ISourcesDiffOpenIdentity | undefined {
	return openIdentities.get(input);
}
