/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { constObservable, IObservable } from '../../../../../base/common/observable.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILogService, NullLogService } from '../../../../../platform/log/common/log.js';
import { InMemoryStorageService, IStorageService } from '../../../../../platform/storage/common/storage.js';
import { AbstractCustomView, ICustomViewDescriptor } from '../../browser/customView.js';
import { CustomViewService } from '../../browser/customViewService.js';

class TestCustomView extends AbstractCustomView {
	readonly title: IObservable<string> = constObservable('test');
	render(): void { }
	layout(): void { }
}

suite('Sessions - CustomViewService', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	function createService(): CustomViewService {
		return disposables.add(new CustomViewService(new NullLogService(), disposables.add(new InMemoryStorageService())));
	}

	function descriptor(id: string): ICustomViewDescriptor {
		return { id, ctor: new SyncDescriptor(TestCustomView) };
	}

	test('shows, replaces and hides registered views', () => {
		const service = createService();
		const first = descriptor('first');
		const second = descriptor('second');
		disposables.add(service.registerCustomView(first));
		disposables.add(service.registerCustomView(second));

		const initial = service.activeCustomView.get();
		service.showCustomView('first');
		const shown = service.activeCustomView.get();
		service.showCustomView('second');
		const replaced = service.activeCustomView.get();
		service.hideCustomView();

		assert.deepStrictEqual({
			initial,
			shown,
			replaced,
			hidden: service.activeCustomView.get(),
		}, {
			initial: undefined,
			shown: first,
			replaced: second,
			hidden: undefined,
		});
	});

	test('ignores an unknown id and drops the active view when it is unregistered', () => {
		const service = createService();
		const registration = service.registerCustomView(descriptor('first'));

		service.showCustomView('unknown');
		const afterUnknown = service.activeCustomView.get();
		service.showCustomView('first');
		registration.dispose();

		assert.deepStrictEqual({
			afterUnknown,
			afterUnregister: service.activeCustomView.get(),
		}, {
			afterUnknown: undefined,
			afterUnregister: undefined,
		});
	});

	test('rejects a duplicate registration', () => {
		const service = createService();
		disposables.add(service.registerCustomView(descriptor('first')));

		assert.throws(() => service.registerCustomView(descriptor('first')));
	});

	test('restores the active custom view after reload', () => {
		const instantiationService = disposables.add(new TestInstantiationService());
		instantiationService.stub(IStorageService, disposables.add(new InMemoryStorageService()));
		instantiationService.stub(ILogService, new NullLogService());

		const firstService = disposables.add(instantiationService.createInstance(CustomViewService));
		disposables.add(firstService.registerCustomView(descriptor('automations')));
		firstService.showCustomView('automations');

		const restoredService = disposables.add(instantiationService.createInstance(CustomViewService));
		const restoredDescriptor = descriptor('automations');
		disposables.add(restoredService.registerCustomView(restoredDescriptor));

		assert.strictEqual(restoredService.activeCustomView.get(), restoredDescriptor);
	});

	test('explicit hide prevents a pending view from restoring', () => {
		const storageService = disposables.add(new InMemoryStorageService());
		const firstService = disposables.add(new CustomViewService(new NullLogService(), storageService));
		disposables.add(firstService.registerCustomView(descriptor('automations')));
		firstService.showCustomView('automations');

		const restoredService = disposables.add(new CustomViewService(new NullLogService(), storageService));
		restoredService.hideCustomView();
		disposables.add(restoredService.registerCustomView(descriptor('automations')));

		assert.strictEqual(restoredService.activeCustomView.get(), undefined);
	});

	test('ineligible registration clears only its matching restoration intent', () => {
		const storageService = disposables.add(new InMemoryStorageService());
		const firstService = disposables.add(new CustomViewService(new NullLogService(), storageService));
		disposables.add(firstService.registerCustomView(descriptor('automations')));
		firstService.showCustomView('automations');

		const restoredService = disposables.add(new CustomViewService(new NullLogService(), storageService));
		disposables.add(restoredService.registerCustomView(descriptor('other'), { restore: false }));
		disposables.add(restoredService.registerCustomView(descriptor('automations'), { restore: false }));

		const nextService = disposables.add(new CustomViewService(new NullLogService(), storageService));
		disposables.add(nextService.registerCustomView(descriptor('automations')));

		assert.deepStrictEqual({
			restored: restoredService.activeCustomView.get(),
			nextReload: nextService.activeCustomView.get(),
		}, {
			restored: undefined,
			nextReload: undefined,
		});
	});

	test('unregistering clears the effective view but preserves restoration intent', () => {
		const storageService = disposables.add(new InMemoryStorageService());
		const service = disposables.add(new CustomViewService(new NullLogService(), storageService));
		const registration = service.registerCustomView(descriptor('automations'));
		service.showCustomView('automations');
		registration.dispose();

		const restoredDescriptor = descriptor('automations');
		disposables.add(service.registerCustomView(restoredDescriptor));

		assert.strictEqual(service.activeCustomView.get(), restoredDescriptor);
	});

	test('deferred ineligible registration keeps the view until it may be shown', () => {
		const storageService = disposables.add(new InMemoryStorageService());
		const firstService = disposables.add(new CustomViewService(new NullLogService(), storageService));
		disposables.add(firstService.registerCustomView(descriptor('automations')));
		firstService.showCustomView('automations');

		const restoredService = disposables.add(new CustomViewService(new NullLogService(), storageService));
		const restoredDescriptor = descriptor('automations');
		disposables.add(restoredService.registerCustomView(restoredDescriptor, { restore: false, preserve: true }));
		const beforeReveal = restoredService.activeCustomView.get();
		restoredService.revealRestoredView('other');
		const afterOther = restoredService.activeCustomView.get();
		restoredService.revealRestoredView('automations');

		const nextService = disposables.add(new CustomViewService(new NullLogService(), storageService));
		const nextDescriptor = descriptor('automations');
		disposables.add(nextService.registerCustomView(nextDescriptor));

		assert.deepStrictEqual({
			beforeReveal,
			afterOther,
			revealed: restoredService.activeCustomView.get(),
			nextReload: nextService.activeCustomView.get(),
		}, {
			beforeReveal: undefined,
			afterOther: undefined,
			revealed: restoredDescriptor,
			nextReload: nextDescriptor,
		});
	});

	test('explicit hide still blocks a preserved view from being revealed', () => {
		const storageService = disposables.add(new InMemoryStorageService());
		const firstService = disposables.add(new CustomViewService(new NullLogService(), storageService));
		disposables.add(firstService.registerCustomView(descriptor('automations')));
		firstService.showCustomView('automations');

		const restoredService = disposables.add(new CustomViewService(new NullLogService(), storageService));
		disposables.add(restoredService.registerCustomView(descriptor('automations'), { restore: false, preserve: true }));
		restoredService.hideCustomView();
		restoredService.revealRestoredView('automations');

		const nextService = disposables.add(new CustomViewService(new NullLogService(), storageService));
		disposables.add(nextService.registerCustomView(descriptor('automations')));

		assert.deepStrictEqual({
			revealed: restoredService.activeCustomView.get(),
			nextReload: nextService.activeCustomView.get(),
		}, {
			revealed: undefined,
			nextReload: undefined,
		});
	});

	test('showing an unknown view preserves the last valid restoration intent', () => {
		const storageService = disposables.add(new InMemoryStorageService());
		const firstService = disposables.add(new CustomViewService(new NullLogService(), storageService));
		disposables.add(firstService.registerCustomView(descriptor('automations')));
		firstService.showCustomView('automations');
		firstService.showCustomView('unknown');

		const restoredService = disposables.add(new CustomViewService(new NullLogService(), storageService));
		const restoredDescriptor = descriptor('automations');
		disposables.add(restoredService.registerCustomView(restoredDescriptor));

		assert.strictEqual(restoredService.activeCustomView.get(), restoredDescriptor);
	});
});
