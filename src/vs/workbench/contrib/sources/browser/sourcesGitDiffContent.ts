/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { IModelService } from '../../../../editor/common/services/model.js';

export const SOURCES_GIT_DIFF_SCHEME = 'sources-git-diff';

interface ISourcesGitDiffText {
	readonly text: string;
	readonly generation: number;
}

/**
 * Text and generation for `sources-git-diff:` URIs. Does not own `ITextModel`s.
 * A `put` older than the URI's generation is dropped and does not `updateModel`.
 */
export class SourcesGitDiffContentStore {
	private readonly generationByUri = new Map<string, number>();
	private readonly textByUri = new Map<string, ISourcesGitDiffText>();

	/** Next generation shared by every URI in this read. Older in-flight reads lose. */
	begin(resources: readonly URI[]): number {
		let max = 0;
		for (const resource of resources) {
			max = Math.max(max, this.generationByUri.get(resource.toString()) ?? 0);
		}
		const next = max + 1;
		for (const resource of resources) {
			this.generationByUri.set(resource.toString(), next);
		}
		return next;
	}

	generation(resource: URI): number {
		return this.generationByUri.get(resource.toString()) ?? 0;
	}

	get(resource: URI): ISourcesGitDiffText | undefined {
		return this.textByUri.get(resource.toString());
	}

	/**
	 * @returns false when `generation` is older than the URI's current generation.
	 * A live model is updated here; `provideTextContent` is not called again while a reference is held.
	 */
	put(resource: URI, text: string, generation: number, modelService: IModelService): boolean {
		const current = this.generationByUri.get(resource.toString()) ?? 0;
		if (generation < current) {
			return false;
		}
		this.generationByUri.set(resource.toString(), generation);
		this.textByUri.set(resource.toString(), { text, generation });
		const existing = liveModel(modelService, resource);
		if (existing) {
			modelService.updateModel(existing, text);
		}
		return true;
	}

	/** Test isolation. Production reads only move the generation forward. */
	resetForTests(): void {
		this.generationByUri.clear();
		this.textByUri.clear();
	}
}

export const sourcesGitDiffContentStore = new SourcesGitDiffContentStore();

export function sourcesGitDiffModelUri(side: 'original' | 'modified', path: string, indexState: string): URI {
	return URI.from({
		scheme: SOURCES_GIT_DIFF_SCHEME,
		path: `/${side}/${encodeURIComponent(path)}/${encodeURIComponent(indexState)}`,
	});
}

export function provideSourcesGitDiffTextContent(resource: URI, modelService: IModelService): ITextModel | null {
	if (resource.scheme !== SOURCES_GIT_DIFF_SCHEME) {
		return null;
	}
	const cached = sourcesGitDiffContentStore.get(resource);
	if (!cached) {
		return null;
	}
	const existing = liveModel(modelService, resource);
	if (existing) {
		if (existing.getValue() !== cached.text) {
			modelService.updateModel(existing, cached.text);
		}
		return existing;
	}
	return modelService.createModel(cached.text, null, resource);
}

function liveModel(modelService: IModelService, resource: URI): ITextModel | null {
	const existing = modelService.getModel(resource);
	if (!existing || existing.isDisposed()) {
		return null;
	}
	return existing;
}
