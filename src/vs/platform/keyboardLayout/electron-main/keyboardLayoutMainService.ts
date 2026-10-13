/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as nativeKeymap from 'native-keymap';
import * as platform from '../../../base/common/platform.js';
import { Emitter } from '../../../base/common/event.js';
import { onUnexpectedError } from '../../../base/common/errors.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { IKeyboardLayoutData, INativeKeyboardLayoutService } from '../common/keyboardLayoutService.js';
import { ILifecycleMainService, LifecycleMainPhase } from '../../lifecycle/electron-main/lifecycleMainService.js';

export const IKeyboardLayoutMainService = createDecorator<IKeyboardLayoutMainService>('keyboardLayoutMainService');

export interface IKeyboardLayoutMainService extends INativeKeyboardLayoutService { }

export class KeyboardLayoutMainService extends Disposable implements INativeKeyboardLayoutService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeKeyboardLayout = this._register(new Emitter<IKeyboardLayoutData>());
	readonly onDidChangeKeyboardLayout = this._onDidChangeKeyboardLayout.event;

	private _initPromise: Promise<void> | null;
	private _keyboardLayoutData: IKeyboardLayoutData | null;
	private _keyboardLayoutListenerRegistered = false;

	constructor(
		@ILifecycleMainService lifecycleMainService: ILifecycleMainService
	) {
		super();
		this._initPromise = null;
		this._keyboardLayoutData = null;

		// perf: automatically trigger initialize after windows
		// have opened so that we can do this work in parallel
		// to the window load.
		lifecycleMainService.when(LifecycleMainPhase.AfterWindowOpen).then(() => this._initialize()).catch(onUnexpectedError).catch(onUnexpectedError);
	}

	private _initialize(): Promise<void> {
		if (!this._initPromise) {
			this._initPromise = this._startInitialize();
		}
		return this._initPromise;
	}

	private _startInitialize(): Promise<void> {
		const pending: { promise?: Promise<void> } = {};
		// In-flight callers share this promise. Drop it when init rejects so the next
		// call reads again, but only if the field still points at this attempt.
		const promise = (async () => {
			try {
				await this._doInitialize();
			} catch (error) {
				if (this._initPromise === pending.promise) {
					this._initPromise = null;
				}
				throw error;
			}
		})();
		pending.promise = promise;
		return promise;
	}

	private async _doInitialize(): Promise<void> {
		const nativeKeymapMod = await this._loadNativeKeymap();

		this._keyboardLayoutData = readKeyboardLayoutData(nativeKeymapMod);
		// See https://github.com/microsoft/vscode/issues/152840
		// Do not register the keyboard layout change listener in CI because it doesn't work
		// on the build machines and it just adds noise to the build logs.
		// Set the flag before subscribe so a retry cannot stack another listener.
		if (!platform.isCI && !this._keyboardLayoutListenerRegistered) {
			this._keyboardLayoutListenerRegistered = true;
			nativeKeymapMod.onDidChangeKeyboardLayout(() => {
				this._keyboardLayoutData = readKeyboardLayoutData(nativeKeymapMod);
				this._onDidChangeKeyboardLayout.fire(this._keyboardLayoutData);
			});
		}
	}

	protected _loadNativeKeymap(): Promise<typeof nativeKeymap> {
		return import('native-keymap');
	}

	public async getKeyboardLayoutData(): Promise<IKeyboardLayoutData> {
		await this._initialize();
		return this._keyboardLayoutData!;
	}
}

function readKeyboardLayoutData(nativeKeymapMod: typeof nativeKeymap): IKeyboardLayoutData {
	const keyboardMapping = nativeKeymapMod.getKeyMap();
	const keyboardLayoutInfo = nativeKeymapMod.getCurrentKeyboardLayout();
	return { keyboardMapping, keyboardLayoutInfo };
}
