/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export type NormalizedHost = string & { readonly __brand: 'NormalizedHost' };
export type NormalizedUrl = string & { readonly __brand: 'NormalizedUrl' };
