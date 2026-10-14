/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IExtensionTipsService, IExecutableBasedExtensionTip } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { ExtensionRecommendations, ExtensionRecommendation } from './extensionRecommendations.js';
import { localize } from '../../../../nls.js';
import { ExtensionRecommendationReason } from '../../../services/extensionRecommendations/common/extensionRecommendations.js';

/**
 * Shares one in-flight or successful important executable-based recommendation fetch.
 * A rejection clears `promise` only while it still points at that attempt,
 * so the next read fetches again. A fulfillment stays cached.
 * The returned promise still rejects; this does not start another attempt.
 */
export function shareImportantExeBasedRecommendations<T>(
	slot: { promise: Promise<T> | undefined },
	load: () => Promise<T>,
): Promise<T> {
	if (slot.promise) {
		return slot.promise;
	}

	const attempt = load();
	slot.promise = attempt;
	// Not assigned. Callers still observe this rejection; the next read fetches again.
	void attempt.catch(() => {
		if (slot.promise === attempt) {
			slot.promise = undefined;
		}
	});
	return attempt;
}

export class ExeBasedRecommendations extends ExtensionRecommendations {

	private _otherTips: IExecutableBasedExtensionTip[] = [];
	private _importantTips: IExecutableBasedExtensionTip[] = [];

	get otherRecommendations(): ReadonlyArray<ExtensionRecommendation> { return this._otherTips.map(tip => this.toExtensionRecommendation(tip)); }
	get importantRecommendations(): ReadonlyArray<ExtensionRecommendation> { return this._importantTips.map(tip => this.toExtensionRecommendation(tip)); }

	get recommendations(): ReadonlyArray<ExtensionRecommendation> { return [...this.importantRecommendations, ...this.otherRecommendations]; }

	constructor(
		@IExtensionTipsService private readonly extensionTipsService: IExtensionTipsService,
	) {
		super();
	}

	getRecommendations(exe: string): { important: ExtensionRecommendation[]; others: ExtensionRecommendation[] } {
		const important = this._importantTips
			.filter(tip => tip.exeName.toLowerCase() === exe.toLowerCase())
			.map(tip => this.toExtensionRecommendation(tip));

		const others = this._otherTips
			.filter(tip => tip.exeName.toLowerCase() === exe.toLowerCase())
			.map(tip => this.toExtensionRecommendation(tip));

		return { important, others };
	}

	protected async doActivate(): Promise<void> {
		this._otherTips = await this.extensionTipsService.getOtherExecutableBasedTips();
		await this.fetchImportantExeBasedRecommendations();
	}

	private readonly _importantExeBasedRecommendations: { promise: Promise<Map<string, IExecutableBasedExtensionTip>> | undefined } = { promise: undefined };
	private fetchImportantExeBasedRecommendations(): Promise<Map<string, IExecutableBasedExtensionTip>> {
		return shareImportantExeBasedRecommendations(this._importantExeBasedRecommendations, () => this.doFetchImportantExeBasedRecommendations());
	}

	private async doFetchImportantExeBasedRecommendations(): Promise<Map<string, IExecutableBasedExtensionTip>> {
		const importantExeBasedRecommendations = new Map<string, IExecutableBasedExtensionTip>();
		this._importantTips = await this.extensionTipsService.getImportantExecutableBasedTips();
		this._importantTips.forEach(tip => importantExeBasedRecommendations.set(tip.extensionId.toLowerCase(), tip));
		return importantExeBasedRecommendations;
	}

	private toExtensionRecommendation(tip: IExecutableBasedExtensionTip): ExtensionRecommendation {
		return {
			extension: tip.extensionId.toLowerCase(),
			reason: {
				reasonId: ExtensionRecommendationReason.Executable,
				reasonText: localize('exeBasedRecommendation', "This extension is recommended because you have {0} installed.", tip.exeFriendlyName)
			}
		};
	}

}

