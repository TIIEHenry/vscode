/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { BannerPart } from '../../../../browser/parts/banner/bannerPart.js';
import { IBannerItem } from '../../../../services/banner/browser/bannerService.js';
import { workbenchInstantiationService } from '../../workbenchTestServices.js';
import { Link } from '../../../../../platform/opener/browser/link.js';

suite('BannerPart', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createBannerPart() {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const parent = document.createElement('div');
		const bannerPart = store.add(instantiationService.createInstance(BannerPart));
		bannerPart.create(parent);
		return { bannerPart, parent, instantiationService };
	}

	test('same id with changed message rebuilds DOM and disposes previous Link', () => {
		const { bannerPart, parent, instantiationService } = createBannerPart();

		let firstLink: Link | undefined;
		const origCreateInstance = instantiationService.createInstance.bind(instantiationService);
		instantiationService.createInstance = function (ctor: any, ...args: any[]) {
			const instance = origCreateInstance(ctor, ...args);
			if (ctor === Link && !firstLink) {
				firstLink = instance as Link;
			}
			return instance;
		};

		const item1: IBannerItem = {
			id: 'banner-1',
			icon: undefined,
			message: 'First Message',
			actions: [{ label: 'Action 1', href: 'https://example.com/1' }]
		};
		bannerPart.show(item1);

		const messageContainer = parent.querySelector('.message-container') as HTMLElement;
		assert.strictEqual(messageContainer.textContent, 'First Message');
		assert.ok(firstLink);
		assert.strictEqual((firstLink as any)._store.isDisposed, false);

		const item2: IBannerItem = {
			id: 'banner-1',
			icon: undefined,
			message: 'Second Message',
			actions: [{ label: 'Action 1', href: 'https://example.com/1' }]
		};
		bannerPart.show(item2);

		const updatedMessageContainer = parent.querySelector('.message-container') as HTMLElement;
		assert.strictEqual(updatedMessageContainer.textContent, 'Second Message');
		assert.strictEqual((firstLink as any)._store.isDisposed, true);
	});

	test('same id with changed actions updates links in messageActionsContainer', () => {
		const { bannerPart, parent } = createBannerPart();

		const item1: IBannerItem = {
			id: 'banner-1',
			icon: undefined,
			message: 'Test Message',
			actions: [{ label: 'Action 1', href: 'https://example.com/1' }]
		};
		bannerPart.show(item1);

		let linkElement = parent.querySelector('.message-actions-container a') as HTMLAnchorElement;
		assert.strictEqual(linkElement.textContent, 'Action 1');
		assert.strictEqual(linkElement.getAttribute('href'), 'https://example.com/1');

		const item2: IBannerItem = {
			id: 'banner-1',
			icon: undefined,
			message: 'Test Message',
			actions: [{ label: 'Action 2', href: 'https://example.com/2' }]
		};
		bannerPart.show(item2);

		linkElement = parent.querySelector('.message-actions-container a') as HTMLAnchorElement;
		assert.strictEqual(linkElement.textContent, 'Action 2');
		assert.strictEqual(linkElement.getAttribute('href'), 'https://example.com/2');
	});

	test('same id with identical display properties re-shows without rebuilding DOM', () => {
		const { bannerPart, parent } = createBannerPart();

		const item1: IBannerItem = {
			id: 'banner-1',
			icon: undefined,
			message: 'Test Message',
			actions: []
		};
		bannerPart.show(item1);

		const firstMessageChild = parent.querySelector('.message-container')?.firstChild;
		assert.ok(firstMessageChild);

		bannerPart.hide('banner-1');

		const item2: IBannerItem = {
			id: 'banner-1',
			icon: undefined,
			message: 'Test Message',
			actions: undefined
		};
		bannerPart.show(item2);

		const secondMessageChild = parent.querySelector('.message-container')?.firstChild;
		assert.strictEqual(firstMessageChild, secondMessageChild);
		assert.strictEqual(parent.querySelector('.message-container')?.textContent, 'Test Message');
	});

	test('changing message when already visible resets focusedActionIndex to -1', () => {
		const { bannerPart } = createBannerPart();

		const item1: IBannerItem = {
			id: 'banner-1',
			icon: undefined,
			message: 'First Message',
			actions: [{ label: 'Action 1', href: 'https://example.com/1' }]
		};
		bannerPart.show(item1);

		bannerPart.focusNextAction();
		assert.notStrictEqual((bannerPart as any).focusedActionIndex, -1);

		const item2: IBannerItem = {
			id: 'banner-1',
			icon: undefined,
			message: 'Second Message',
			actions: [{ label: 'Action 1', href: 'https://example.com/1' }]
		};
		bannerPart.show(item2);

		assert.strictEqual((bannerPart as any).focusedActionIndex, -1);
	});
});
