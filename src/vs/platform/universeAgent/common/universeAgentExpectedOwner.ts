/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationError } from '../../../base/common/errors.js';

/** IDE-only intent owner. Never part of an engine request or protobuf payload. */
export interface UniverseAgentExpectedOwner {
	readonly engineIdentityId: string;
	readonly linkId: number;
}

/** The main-process published fields needed before dispatching an owned call. */
export interface UniverseAgentPublishedOwner {
	readonly engineIdentityId?: string;
	readonly linkId?: number;
	readonly pairingPending: boolean;
}

/** Validate an owner received across IPC without coercing missing or invalid fields. */
export function isUniverseAgentExpectedOwner(value: unknown): value is UniverseAgentExpectedOwner {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return false;
	}
	const owner = value as Partial<UniverseAgentExpectedOwner>;
	return Object.keys(owner).length === 2 && Object.hasOwn(owner, 'engineIdentityId') && Object.hasOwn(owner, 'linkId')
		&& typeof owner.engineIdentityId === 'string' && owner.engineIdentityId.length > 0
		&& typeof owner.linkId === 'number' && Number.isSafeInteger(owner.linkId) && owner.linkId > 0;
}

/** Synchronous, fail-closed validation before a target method or transport is selected. */
export function assertUniverseAgentExpectedOwner(
	expectedOwner: unknown,
	publishedOwner: UniverseAgentPublishedOwner,
	connected: boolean,
): asserts expectedOwner is UniverseAgentExpectedOwner {
	if (!isUniverseAgentExpectedOwner(expectedOwner) || !connected || publishedOwner.pairingPending
		|| expectedOwner.engineIdentityId !== publishedOwner.engineIdentityId
		|| expectedOwner.linkId !== publishedOwner.linkId) {
		throw new CancellationError();
	}
}
