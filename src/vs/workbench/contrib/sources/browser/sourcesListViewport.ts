/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DisposableResizeObserver } from '../../../../base/browser/dom.js';
import { Disposable } from '../../../../base/common/lifecycle.js';

interface ISourcesListViewportTarget {
	layout(height: number, width: number): void;
}

/**
 * Keep a Sources list viewport equal to its slot. A virtual list with no
 * layout height paints nothing inside the part.
 */
export class SourcesListViewport extends Disposable {

	private lastWidth = -1;
	private lastHeight = -1;

	constructor(
		private readonly container: HTMLElement,
		private readonly getList: () => ISourcesListViewportTarget | undefined,
	) {
		super();
		const ResizeObserverCtor = this.container.ownerDocument.defaultView?.ResizeObserver;
		if (typeof ResizeObserverCtor !== 'function') {
			return;
		}
		const observer = this._register(new DisposableResizeObserver('SourcesListViewport', () => this.layout()));
		this._register(observer.observe(this.container));
	}

	layout(): void {
		const list = this.getList();
		if (!list || this.container.style.display === 'none') {
			this.lastWidth = -1;
			this.lastHeight = -1;
			return;
		}

		const width = this.container.clientWidth;
		const height = this.container.clientHeight;
		if (width <= 0 || height <= 0 || (width === this.lastWidth && height === this.lastHeight)) {
			return;
		}

		this.lastWidth = width;
		this.lastHeight = height;
		list.layout(height, width);
	}
}

/** Parent directory of a workspace-relative or git path, for row descriptions. */
export function sourcesParentPathLabel(path: string): string {
	const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
	if (slash <= 0) {
		return '';
	}
	return path.slice(0, slash);
}
