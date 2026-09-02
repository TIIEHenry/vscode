/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Schemas } from '../../../../base/common/network.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ISCMService } from '../../scm/common/scm.js';
import {
	buildSourcesReviewProgressKey,
	ISourcesReviewProgressKey,
	ISourcesReviewProgressService,
} from '../common/sourcesReviewProgress.js';

export class SourcesReviewProgressService extends Disposable implements ISourcesReviewProgressService {

	declare readonly _serviceBrand: undefined;

	private readonly reviewed = new Map<string, { reviewedAt: number }>();

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@ISCMService private readonly scmService: ISCMService,
	) {
		super();

		this._register(this.fileService.onDidFilesChange(e => {
			for (const resource of e.rawUpdated) {
				this.invalidateResource(resource);
			}
			for (const resource of e.rawAdded) {
				this.invalidateResource(resource);
			}
		}));
	}

	isReviewed(key: ISourcesReviewProgressKey): boolean {
		return this.reviewed.has(buildSourcesReviewProgressKey(key));
	}

	markReviewed(key: ISourcesReviewProgressKey): void {
		const mapKey = buildSourcesReviewProgressKey(key);
		if (this.reviewed.has(mapKey)) {
			return;
		}
		this.reviewed.set(mapKey, { reviewedAt: Date.now() });
		this._onDidChange.fire();
	}

	markUnreviewed(key: ISourcesReviewProgressKey): void {
		if (this.reviewed.delete(buildSourcesReviewProgressKey(key))) {
			this._onDidChange.fire();
		}
	}

	markAllReviewed(keys: readonly ISourcesReviewProgressKey[]): void {
		let changed = false;
		for (const key of keys) {
			const mapKey = buildSourcesReviewProgressKey(key);
			if (!this.reviewed.has(mapKey)) {
				this.reviewed.set(mapKey, { reviewedAt: Date.now() });
				changed = true;
			}
		}
		if (changed) {
			this._onDidChange.fire();
		}
	}

	async resolveKey(resource: URI): Promise<ISourcesReviewProgressKey> {
		return {
			scopeKeyId: this.getScopeKeyId(resource),
			path: resource.toString(),
			contentHash: await this.resolveContentHash(resource),
		};
	}

	pruneMissingKeys(activeKeys: ReadonlySet<string>): void {
		let changed = false;
		for (const key of this.reviewed.keys()) {
			if (!activeKeys.has(key)) {
				this.reviewed.delete(key);
				changed = true;
			}
		}
		if (changed) {
			this._onDidChange.fire();
		}
	}

	private getScopeKeyId(resource: URI): string {
		const repository = this.scmService.getRepository(resource);
		return repository?.provider.rootUri?.toString() ?? '';
	}

	private async resolveContentHash(resource: URI): Promise<string> {
		if (resource.scheme !== Schemas.file) {
			return '';
		}

		try {
			const stat = await this.fileService.stat(resource);
			return stat.etag ?? '';
		} catch {
			return '';
		}
	}

	private async invalidateResource(resource: URI): Promise<void> {
		const scopeKeyId = this.getScopeKeyId(resource);
		const path = resource.toString();
		const prefix = `${scopeKeyId}\0${path}\0`;
		const newHash = await this.resolveContentHash(resource);

		let changed = false;
		for (const key of [...this.reviewed.keys()]) {
			if (!key.startsWith(prefix)) {
				continue;
			}
			const storedHash = key.slice(prefix.length);
			if (storedHash !== newHash) {
				this.reviewed.delete(key);
				changed = true;
			}
		}

		if (changed) {
			this._onDidChange.fire();
		}
	}
}

registerSingleton(ISourcesReviewProgressService, SourcesReviewProgressService, InstantiationType.Delayed);
