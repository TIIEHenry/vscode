/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { parseSavedSearchEditor, parseSerializedSearchEditor } from './searchEditorSerialization.js';
import { IWorkingCopyBackupService } from '../../../services/workingCopy/common/workingCopyBackup.js';
import { SearchConfiguration, SearchEditorWorkingCopyTypeId } from './constants.js';
import { assertReturnsDefined } from '../../../../base/common/types.js';
import { createTextBufferFactoryFromStream } from '../../../../editor/common/model/textModel.js';
import { Emitter } from '../../../../base/common/event.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { SEARCH_RESULT_LANGUAGE_ID } from '../../../services/search/common/search.js';

/**
 * Shares one in-flight or successful search editor model resolve.
 * A rejection clears the slot only while it still points at that attempt,
 * so the next resolve starts again. A fulfillment stays cached.
 * The returned promise still rejects; this does not start another attempt.
 */
export function shareSearchEditorModelResolve<T>(
	slot: { promise: Promise<T> | undefined },
	load: () => Promise<T>,
): Promise<T> {
	if (slot.promise) {
		return slot.promise;
	}

	const attempt = load();
	slot.promise = attempt;
	// Not assigned. Callers still observe this rejection; the next resolve starts again.
	void attempt.catch(() => {
		if (slot.promise === attempt) {
			slot.promise = undefined;
		}
	});
	return attempt;
}

export type SearchEditorData = { resultsModel: ITextModel; configurationModel: SearchConfigurationModel };

export class SearchConfigurationModel {
	private _onConfigDidUpdate = new Emitter<SearchConfiguration>();
	public readonly onConfigDidUpdate = this._onConfigDidUpdate.event;

	constructor(public config: Readonly<SearchConfiguration>) { }
	updateConfig(config: SearchConfiguration) { this.config = config; this._onConfigDidUpdate.fire(config); }
}

export class SearchEditorModel {
	constructor(
		private resource: URI,
	) { }

	async resolve(): Promise<SearchEditorData> {
		return assertReturnsDefined(searchEditorModelFactory.models.get(this.resource)).resolve();
	}
}

class SearchEditorModelFactory {
	models = new ResourceMap<{ resolve: () => Promise<SearchEditorData> }>();

	constructor() { }

	initializeModelFromExistingModel(accessor: ServicesAccessor, resource: URI, config: SearchConfiguration) {
		if (this.models.has(resource)) {
			throw Error('Unable to contruct model for resource that already exists');
		}

		const languageService = accessor.get(ILanguageService);
		const modelService = accessor.get(IModelService);
		const instantiationService = accessor.get(IInstantiationService);
		const workingCopyBackupService = accessor.get(IWorkingCopyBackupService);

		const resolveSlot: { promise: Promise<SearchEditorData> | undefined } = { promise: undefined };

		this.models.set(resource, {
			resolve: () => shareSearchEditorModelResolve(resolveSlot, async () => {
				const backup = await this.tryFetchModelFromBackupService(resource, languageService, modelService, workingCopyBackupService, instantiationService);
				if (backup) {
					return backup;
				}

				return {
					resultsModel: modelService.getModel(resource) ?? modelService.createModel('', languageService.createById(SEARCH_RESULT_LANGUAGE_ID), resource),
					configurationModel: new SearchConfigurationModel(config)
				};
			}),
		});
	}

	initializeModelFromRawData(accessor: ServicesAccessor, resource: URI, config: SearchConfiguration, contents: string | undefined) {
		if (this.models.has(resource)) {
			throw Error('Unable to contruct model for resource that already exists');
		}

		const languageService = accessor.get(ILanguageService);
		const modelService = accessor.get(IModelService);
		const instantiationService = accessor.get(IInstantiationService);
		const workingCopyBackupService = accessor.get(IWorkingCopyBackupService);

		const resolveSlot: { promise: Promise<SearchEditorData> | undefined } = { promise: undefined };

		this.models.set(resource, {
			resolve: () => shareSearchEditorModelResolve(resolveSlot, async () => {
				const backup = await this.tryFetchModelFromBackupService(resource, languageService, modelService, workingCopyBackupService, instantiationService);
				if (backup) {
					return backup;
				}

				return {
					resultsModel: modelService.createModel(contents ?? '', languageService.createById(SEARCH_RESULT_LANGUAGE_ID), resource),
					configurationModel: new SearchConfigurationModel(config)
				};
			}),
		});
	}

	initializeModelFromExistingFile(accessor: ServicesAccessor, resource: URI, existingFile: URI) {
		if (this.models.has(resource)) {
			throw Error('Unable to contruct model for resource that already exists');
		}

		const languageService = accessor.get(ILanguageService);
		const modelService = accessor.get(IModelService);
		const instantiationService = accessor.get(IInstantiationService);
		const workingCopyBackupService = accessor.get(IWorkingCopyBackupService);

		const resolveSlot: { promise: Promise<SearchEditorData> | undefined } = { promise: undefined };

		this.models.set(resource, {
			resolve: () => shareSearchEditorModelResolve(resolveSlot, async () => {
				const backup = await this.tryFetchModelFromBackupService(resource, languageService, modelService, workingCopyBackupService, instantiationService);
				if (backup) {
					return backup;
				}

				const { text, config } = await instantiationService.invokeFunction(parseSavedSearchEditor, existingFile);
				return {
					resultsModel: modelService.createModel(text ?? '', languageService.createById(SEARCH_RESULT_LANGUAGE_ID), resource),
					configurationModel: new SearchConfigurationModel(config)
				};
			}),
		});
	}

	private async tryFetchModelFromBackupService(resource: URI, languageService: ILanguageService, modelService: IModelService, workingCopyBackupService: IWorkingCopyBackupService, instantiationService: IInstantiationService): Promise<SearchEditorData | undefined> {
		const backup = await workingCopyBackupService.resolve({ resource, typeId: SearchEditorWorkingCopyTypeId });

		let model = modelService.getModel(resource);
		if (!model && backup) {
			const factory = await createTextBufferFactoryFromStream(backup.value);

			model = modelService.createModel(factory, languageService.createById(SEARCH_RESULT_LANGUAGE_ID), resource);
		}

		if (model) {
			const existingFile = model.getValue();
			const { text, config } = parseSerializedSearchEditor(existingFile);
			modelService.destroyModel(resource);
			return ({
				resultsModel: modelService.createModel(text ?? '', languageService.createById(SEARCH_RESULT_LANGUAGE_ID), resource),
				configurationModel: new SearchConfigurationModel(config)
			});
		}
		else {
			return undefined;
		}
	}
}

export const searchEditorModelFactory = new SearchEditorModelFactory();
