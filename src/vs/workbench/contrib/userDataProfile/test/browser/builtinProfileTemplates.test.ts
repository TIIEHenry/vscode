/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { bufferToStream, VSBuffer } from '../../../../../base/common/buffer.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Event } from '../../../../../base/common/event.js';
import { IRequestContext, IRequestOptions } from '../../../../../base/parts/request/common/request.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IProfileTemplateInfo } from '../../../../services/userDataProfile/common/userDataProfile.js';
import { UserDataProfileManagementService } from '../../../../services/userDataProfile/browser/userDataProfileManagement.js';
import { UserDataProfilesEditorModel } from '../../browser/userDataProfilesEditorModel.js';

const TEMPLATES_URL = 'https://example.test/profile-templates';

suite('Builtin profile templates', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function jsonResponse(body: string, statusCode = 200): IRequestContext {
		return {
			res: { statusCode, headers: {} },
			stream: bufferToStream(VSBuffer.fromString(body)),
		};
	}

	function createManagementService(request: (options: IRequestOptions, token: CancellationToken) => Promise<IRequestContext>, profileTemplatesUrl?: string): { service: UserDataProfileManagementService; errors: unknown[][] } {
		const errors: unknown[][] = [];
		const service = store.add(new UserDataProfileManagementService(
			{ onDidChangeProfiles: Event.None } as never,
			{ onDidChangeCurrentProfile: Event.None } as never,
			undefined as never,
			undefined as never,
			undefined as never,
			undefined as never,
			undefined as never,
			{ profileTemplatesUrl } as never,
			{ request } as never,
			undefined as never,
			undefined as never,
			{ error: (...args: unknown[]) => { errors.push(args); } } as never,
		));
		return { service, errors };
	}

	function countBuiltinReads(service: UserDataProfileManagementService): () => number {
		let reads = 0;
		const getBuiltinProfileTemplates = service.getBuiltinProfileTemplates.bind(service);
		service.getBuiltinProfileTemplates = () => {
			reads++;
			return getBuiltinProfileTemplates();
		};
		return () => reads;
	}

	function createEditorModel(service: UserDataProfileManagementService): UserDataProfilesEditorModel {
		return store.add(new UserDataProfilesEditorModel(
			undefined as never,
			{ profiles: [], onDidChangeProfiles: Event.None } as never,
			service,
			undefined as never,
			undefined as never,
			undefined as never,
			undefined as never,
			undefined as never,
			undefined as never,
			undefined as never,
		));
	}

	function templatesField(model: UserDataProfilesEditorModel): { templates: Promise<readonly IProfileTemplateInfo[]> | undefined } {
		return model as unknown as { templates: Promise<readonly IProfileTemplateInfo[]> | undefined };
	}

	suite('UserDataProfileManagementService.getBuiltinProfileTemplates', () => {

		test('missing template url resolves to [] and does not request', async () => {
			let requests = 0;
			const { service, errors } = createManagementService(async () => {
				requests++;
				return jsonResponse('[]');
			});

			assert.deepStrictEqual(await service.getBuiltinProfileTemplates(), []);
			assert.strictEqual(requests, 0);
			assert.deepStrictEqual(errors, []);
		});

		test('HTTP 200 with an empty list resolves to []', async () => {
			const { service, errors } = createManagementService(async options => {
				assert.strictEqual(options.type, 'GET');
				assert.strictEqual(options.url, TEMPLATES_URL);
				assert.strictEqual(options.callSite, 'userDataProfileManagement.getProfileTemplates');
				return jsonResponse('[]');
			}, TEMPLATES_URL);

			assert.deepStrictEqual(await service.getBuiltinProfileTemplates(), []);
			assert.deepStrictEqual(errors, []);
		});

		test('HTTP 200 with JSON null resolves to []', async () => {
			const { service, errors } = createManagementService(async () => jsonResponse('null'), TEMPLATES_URL);

			assert.deepStrictEqual(await service.getBuiltinProfileTemplates(), []);
			assert.deepStrictEqual(errors, []);
		});

		test('HTTP 200 returns the parsed templates', async () => {
			const templates = [{ name: 'Java', url: 'https://example.test/java' }];
			const { service } = createManagementService(async (_options, token) => {
				assert.strictEqual(token, CancellationToken.None);
				return jsonResponse(JSON.stringify(templates));
			}, TEMPLATES_URL);

			assert.deepStrictEqual(await service.getBuiltinProfileTemplates(), templates);
		});

		test('non-200 status rejects after logging and does not become []', async () => {
			const { service, errors } = createManagementService(async () => jsonResponse('missing', 404), TEMPLATES_URL);

			await assert.rejects(service.getBuiltinProfileTemplates(), /Could not get profile templates: 404/);
			assert.deepStrictEqual(errors, [['Could not get profile templates.', 404]]);
		});

		test('request failure rejects after logging the same error', async () => {
			const failure = new Error('network down');
			const { service, errors } = createManagementService(async () => { throw failure; }, TEMPLATES_URL);

			await assert.rejects(service.getBuiltinProfileTemplates(), error => {
				assert.strictEqual(error, failure);
				return true;
			});
			assert.deepStrictEqual(errors, [[failure]]);
		});

		test('HTTP 200 with invalid JSON rejects the parse error', async () => {
			const { service } = createManagementService(async () => jsonResponse('{'), TEMPLATES_URL);

			await assert.rejects(service.getBuiltinProfileTemplates(), (error: unknown) => {
				assert.ok(error instanceof SyntaxError);
				assert.ok(error.message.includes('{'));
				return true;
			});
		});
	});

	suite('UserDataProfilesEditorModel.getTemplates', () => {

		test('missing template url is cached and the next open does not request', async () => {
			let requests = 0;
			const { service } = createManagementService(async () => {
				requests++;
				return jsonResponse('[]');
			});
			const reads = countBuiltinReads(service);
			const model = createEditorModel(service);

			const first = model.getTemplates();
			assert.deepStrictEqual(await first, []);
			const second = model.getTemplates();

			assert.strictEqual(second, first);
			assert.deepStrictEqual(await second, []);
			assert.strictEqual(reads(), 1);
			assert.strictEqual(requests, 0);
		});

		test('HTTP 200 empty list is cached and the service is called once', async () => {
			let requests = 0;
			const { service } = createManagementService(async () => {
				requests++;
				return jsonResponse('[]');
			}, TEMPLATES_URL);
			const reads = countBuiltinReads(service);
			const model = createEditorModel(service);

			const first = model.getTemplates();
			assert.deepStrictEqual(await first, []);
			const second = model.getTemplates();

			assert.strictEqual(second, first);
			assert.deepStrictEqual(await second, []);
			assert.strictEqual(reads(), 1);
			assert.strictEqual(requests, 1);
		});

		test('in-flight getTemplates calls share one promise', async () => {
			let resolveRequest!: (context: IRequestContext) => void;
			let requests = 0;
			const { service } = createManagementService(() => {
				requests++;
				return new Promise(resolve => { resolveRequest = resolve; });
			}, TEMPLATES_URL);
			const reads = countBuiltinReads(service);
			const model = createEditorModel(service);

			const first = model.getTemplates();
			const second = model.getTemplates();
			assert.strictEqual(first, second);
			assert.strictEqual(reads(), 1);
			assert.strictEqual(requests, 1);

			resolveRequest(jsonResponse('[]'));
			assert.deepStrictEqual(await first, []);
			assert.deepStrictEqual(await second, []);
			assert.strictEqual(model.getTemplates(), first);
			assert.strictEqual(reads(), 1);
			assert.strictEqual(requests, 1);
		});

		test('non-200 drops the cached promise so the next getTemplates requests again', async () => {
			const responses = [jsonResponse('missing', 503), jsonResponse('[]')];
			let requests = 0;
			const { service, errors } = createManagementService(async () => {
				requests++;
				return responses.shift()!;
			}, TEMPLATES_URL);
			const reads = countBuiltinReads(service);
			const model = createEditorModel(service);

			const first = model.getTemplates();
			await assert.rejects(first, /Could not get profile templates: 503/);
			assert.strictEqual(templatesField(model).templates, undefined);
			assert.deepStrictEqual(errors, [['Could not get profile templates.', 503]]);

			const second = model.getTemplates();
			assert.notStrictEqual(second, first);
			assert.deepStrictEqual(await second, []);
			assert.strictEqual(model.getTemplates(), second);
			assert.strictEqual(reads(), 2);
			assert.strictEqual(requests, 2);
		});

		test('thrown request drops the cached promise so the next getTemplates requests again', async () => {
			const failure = new Error('network down');
			const responses: Array<IRequestContext | Error> = [failure, jsonResponse('[]')];
			let requests = 0;
			const { service, errors } = createManagementService(async () => {
				requests++;
				const next = responses.shift();
				if (next instanceof Error) {
					throw next;
				}
				return next!;
			}, TEMPLATES_URL);
			const reads = countBuiltinReads(service);
			const model = createEditorModel(service);

			const first = model.getTemplates();
			await assert.rejects(first, error => {
				assert.strictEqual(error, failure);
				return true;
			});
			assert.strictEqual(templatesField(model).templates, undefined);
			assert.deepStrictEqual(errors, [[failure]]);

			const second = model.getTemplates();
			assert.notStrictEqual(second, first);
			assert.deepStrictEqual(await second, []);
			assert.strictEqual(reads(), 2);
			assert.strictEqual(requests, 2);
		});

		test('a rejected promise does not clear a replacement already stored on the model', async () => {
			let rejectRequest!: (error: Error) => void;
			let requests = 0;
			const { service } = createManagementService(() => {
				requests++;
				return new Promise((_resolve, reject) => { rejectRequest = reject; });
			}, TEMPLATES_URL);
			const reads = countBuiltinReads(service);
			const model = createEditorModel(service);

			const first = model.getTemplates();
			const replacement = Promise.resolve<readonly IProfileTemplateInfo[]>([{ name: 'Kept', url: 'https://example.test/kept' }]);
			templatesField(model).templates = replacement;
			rejectRequest(new Error('stale'));

			await assert.rejects(first, /stale/);
			assert.strictEqual(model.getTemplates(), replacement);
			assert.deepStrictEqual(await model.getTemplates(), [{ name: 'Kept', url: 'https://example.test/kept' }]);
			assert.strictEqual(reads(), 1);
			assert.strictEqual(requests, 1);
		});
	});
});
