/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI, UriComponents } from '../../../base/common/uri.js';
import { Emitter } from '../../../base/common/event.js';
import { IDisposable, combinedDisposable, dispose } from '../../../base/common/lifecycle.js';
import { ExtHostContext, MainContext, MainThreadDecorationsShape, ExtHostDecorationsShape, DecorationData, DecorationRequest } from '../common/extHost.protocol.js';
import { extHostNamedCustomer, IExtHostContext } from '../../services/extensions/common/extHostCustomers.js';
import { IDecorationsService, IDecorationData } from '../../services/decorations/common/decorations.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { DeferredPromise } from '../../../base/common/async.js';
import { CancellationError, onUnexpectedError } from '../../../base/common/errors.js';

class DecorationRequestsQueue implements IDisposable {

	private _idPool = 0;
	private _requests = new Map<number, DecorationRequest>();
	private _resolver = new Map<number, DeferredPromise<DecorationData>>();

	private _timer: Timeout | undefined;
	private _isDisposed = false;

	constructor(
		private readonly _proxy: ExtHostDecorationsShape,
		private readonly _handle: number
	) {
		//
	}

	dispose(): void {
		this._isDisposed = true;
		if (this._timer !== undefined) {
			clearTimeout(this._timer);
			this._timer = undefined;
		}
		for (const [, defer] of this._resolver) {
			defer.error(new CancellationError());
		}
		this._requests.clear();
		this._resolver.clear();
	}

	enqueue(uri: URI, token: CancellationToken): Promise<DecorationData> {
		if (this._isDisposed) {
			return Promise.reject(new CancellationError());
		}

		const id = ++this._idPool;

		const defer = new DeferredPromise<DecorationData>();
		this._requests.set(id, { id, uri });
		this._resolver.set(id, defer);
		this._processQueue();

		const sub = token.onCancellationRequested(() => {
			this._requests.delete(id);
			this._resolver.delete(id);
			defer.error(new CancellationError());
		});
		return defer.p.finally(() => sub.dispose());
	}

	private _processQueue(): void {
		if (this._isDisposed || this._timer !== undefined) {
			// already queued or disposed
			return;
		}
		this._timer = setTimeout(() => {
			if (this._isDisposed) {
				return;
			}
			// make request
			const requests = this._requests;
			const resolver = this._resolver;
			this._proxy.$provideDecorations(this._handle, [...requests.values()], CancellationToken.None).then(data => {
				for (const [id, defer] of resolver) {
					defer.complete(data[id]);
				}
			}).catch(onUnexpectedError);

			// reset
			this._requests = new Map();
			this._resolver = new Map();
			this._timer = undefined;
		}, 0);
	}
}

@extHostNamedCustomer(MainContext.MainThreadDecorations)
export class MainThreadDecorations implements MainThreadDecorationsShape {

	private readonly _provider = new Map<number, [Emitter<URI[]>, IDisposable]>();
	private readonly _proxy: ExtHostDecorationsShape;
	private _isDisposed = false;

	constructor(
		context: IExtHostContext,
		@IDecorationsService private readonly _decorationsService: IDecorationsService
	) {
		this._proxy = context.getProxy(ExtHostContext.ExtHostDecorations);
	}

	dispose() {
		this._isDisposed = true;
		this._provider.forEach(value => dispose(value));
		this._provider.clear();
	}

	$registerDecorationProvider(handle: number, label: string): void {
		if (this._isDisposed) {
			return;
		}
		const emitter = new Emitter<URI[]>();
		const queue = new DecorationRequestsQueue(this._proxy, handle);
		const registration = this._decorationsService.registerDecorationsProvider({
			label,
			onDidChange: emitter.event,
			provideDecorations: async (uri, token): Promise<IDecorationData | undefined> => {
				const data = await queue.enqueue(uri, token);
				if (!data) {
					return undefined;
				}
				const [bubble, tooltip, letter, themeColor] = data;
				return {
					weight: 10,
					bubble: bubble ?? false,
					color: themeColor?.id,
					tooltip,
					letter
				};
			}
		});
		this._provider.set(handle, [emitter, combinedDisposable(registration, queue)]);
	}

	$onDidChange(handle: number, resources: UriComponents[]): void {
		if (this._isDisposed) {
			return;
		}
		const provider = this._provider.get(handle);
		if (provider) {
			const [emitter] = provider;
			emitter.fire(resources && resources.map(r => URI.revive(r)));
		}
	}

	$unregisterDecorationProvider(handle: number): void {
		const provider = this._provider.get(handle);
		if (provider) {
			dispose(provider);
			this._provider.delete(handle);
		}
	}
}
