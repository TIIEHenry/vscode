/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { DeviceAuthTranscriptInput } from './deviceGrant/device-grant-crypto.js';

export type ClientIdentityMaterial = {
	readonly clientIdentityId: string;
	readonly clientPublicKey: Uint8Array;
	readonly privateKeyPkcs8: Uint8Array;
};

export type ClientIdentityStoreState =
	| { readonly kind: 'ready'; readonly identity: ClientIdentityMaterial }
	| { readonly kind: 'encryption_unavailable' }
	| { readonly kind: 'corrupt'; readonly reason: string };

export interface IClientIdentityStore {
	getState(): Promise<ClientIdentityStoreState>;
	getOrCreateIdentity(): Promise<ClientIdentityStoreState>;
	createSigner(): Promise<((input: DeviceAuthTranscriptInput) => Uint8Array) | undefined>;
}
