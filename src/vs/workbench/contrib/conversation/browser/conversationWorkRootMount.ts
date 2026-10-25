/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { isTemporaryWorkspace, isUntitledWorkspace } from '../../../../platform/workspace/common/workspace.js';

/**
 * Why the session folder is waiting for a click.
 * `trust`: the workspace is trusted and this folder is not, so the click opens the trust dialog.
 * `confirm`: the click adds the folder without that dialog (a saved workspace file, or a workspace that is already untrusted).
 */
export type WorkRootMountOfferReason = 'trust' | 'confirm';

export interface IWorkRootMountOffer {
	readonly uri: URI;
	readonly reason: WorkRootMountOfferReason;
}

export const IConversationWorkRootMount = createDecorator<IConversationWorkRootMount>('conversationWorkRootMount');

export interface IConversationWorkRootMount {
	readonly _serviceBrand: undefined;
	readonly onDidChangeOffer: Event<void>;
	getOffer(): IWorkRootMountOffer | undefined;
	acceptOffer(): Promise<void>;
	/**
	 * Contribution-owned. Same offer does not fire again.
	 * `accept` runs when the user clicks the identity-strip button.
	 */
	setOffer(offer: IWorkRootMountOffer | undefined, accept: (() => Promise<void>) | undefined): void;
}

/**
 * A saved `.code-workspace` is the user's file. Empty, single-folder, untitled,
 * and temporary workspaces have nothing of theirs to rewrite.
 */
export function workspaceBlocksAutoMount(configuration: URI | null | undefined, environmentService: IEnvironmentService): boolean {
	if (!configuration || isTemporaryWorkspace(configuration)) {
		return false;
	}
	return !isUntitledWorkspace(configuration, environmentService);
}

export class ConversationWorkRootMountModel extends Disposable implements IConversationWorkRootMount {

	declare readonly _serviceBrand: undefined;

	private offer: IWorkRootMountOffer | undefined;
	private acceptImpl: (() => Promise<void>) | undefined;
	private readonly _onDidChangeOffer = this._register(new Emitter<void>());
	readonly onDidChangeOffer = this._onDidChangeOffer.event;

	getOffer(): IWorkRootMountOffer | undefined {
		return this.offer;
	}

	setOffer(offer: IWorkRootMountOffer | undefined, accept: (() => Promise<void>) | undefined): void {
		const same = this.offer?.reason === offer?.reason && this.offer?.uri.toString() === offer?.uri.toString();
		this.acceptImpl = accept;
		if (same) {
			return;
		}
		this.offer = offer;
		this._onDidChangeOffer.fire();
	}

	acceptOffer(): Promise<void> {
		return this.acceptImpl ? this.acceptImpl() : Promise.resolve();
	}
}

registerSingleton(IConversationWorkRootMount, ConversationWorkRootMountModel, InstantiationType.Delayed);
