/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';

/** Sources-level load result. Call sites subscribe before open / show. */
export interface ISourcesDiffLoadEvent {
	readonly resource: URI;
	readonly generation: number;
	readonly ok: boolean;
}

let nextLoadGeneration = 0;

/** Call-site generation. It rides on this open's input or show(), not on `matches()`. */
export function allocateSourcesDiffLoadGeneration(): number {
	nextLoadGeneration += 1;
	return nextLoadGeneration;
}

type LoadListener = (event: ISourcesDiffLoadEvent) => void;

const loadListeners = new Set<LoadListener>();

export function onDidSourcesDiffLoad(listener: LoadListener): IDisposable {
	loadListeners.add(listener);
	return {
		dispose(): void {
			loadListeners.delete(listener);
		},
	};
}

export function fireSourcesDiffLoad(event: ISourcesDiffLoadEvent): void {
	for (const listener of [...loadListeners]) {
		listener(event);
	}
}
