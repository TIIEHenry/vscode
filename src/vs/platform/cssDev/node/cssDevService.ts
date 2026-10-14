/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn } from 'child_process';
import { relative } from '../../../base/common/path.js';
import { FileAccess } from '../../../base/common/network.js';
import { rgDiskPath } from '../../../base/node/ripgrep.js';
import { StopWatch } from '../../../base/common/stopwatch.js';
import { IEnvironmentService } from '../../environment/common/environment.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { ILogService } from '../../log/common/log.js';

export const ICSSDevelopmentService = createDecorator<ICSSDevelopmentService>('ICSSDevelopmentService');

export interface ICSSDevelopmentService {
	_serviceBrand: undefined;
	isEnabled: boolean;
	getCssModules(): Promise<string[]>;
}

/**
 * Shares one in-flight or successful CSS module computation.
 * A rejection clears the slot only while it still points at that attempt,
 * so the next read calls `load` again. A fulfillment stays cached.
 * The returned promise still rejects; this does not start another attempt.
 */
export function shareCssModules<T>(
	slot: { promise: Promise<T> | undefined },
	load: () => Promise<T>,
): Promise<T> {
	if (slot.promise) {
		return slot.promise;
	}

	const attempt = load();
	slot.promise = attempt;
	// Not assigned. Callers still observe this rejection; the next read calls load again.
	void attempt.catch(() => {
		if (slot.promise === attempt) {
			slot.promise = undefined;
		}
	});
	return attempt;
}

export class CSSDevelopmentService implements ICSSDevelopmentService {

	declare _serviceBrand: undefined;

	private readonly _cssModulesSlot: { promise: Promise<string[]> | undefined } = { promise: undefined };

	constructor(
		@IEnvironmentService private readonly envService: IEnvironmentService,
		@ILogService private readonly logService: ILogService
	) { }

	get isEnabled(): boolean {
		return !this.envService.isBuilt;
	}

	getCssModules(): Promise<string[]> {
		return shareCssModules(this._cssModulesSlot, () => this.computeCssModules());
	}

	private async computeCssModules(): Promise<string[]> {
		if (!this.isEnabled) {
			return [];
		}

		const rgBinPath = await rgDiskPath();
		return await new Promise<string[]>((resolve) => {

			const sw = StopWatch.create();

			const chunks: Buffer[] = [];
			const basePath = FileAccess.asFileUri('').fsPath;
			const process = spawn(rgBinPath, ['-g', '**/*.css', '--files', '--no-ignore', basePath], {});

			process.stdout.on('data', data => {
				chunks.push(data);
			});
			process.on('error', err => {
				this.logService.error('[CSS_DEV] FAILED to compute CSS data', err);
				resolve([]);
			});
			process.on('close', () => {
				const data = Buffer.concat(chunks).toString('utf8');
				const result = data.split('\n').filter(Boolean).map(path => relative(basePath, path).replace(/\\/g, '/')).filter(Boolean).sort();
				if (result.some(path => path.indexOf('vs/') !== 0)) {
					this.logService.error(`[CSS_DEV] Detected invalid paths in css modules, raw output: ${data}`);
				}
				resolve(result);
				this.logService.info(`[CSS_DEV] DONE, ${result.length} css modules (${Math.round(sw.elapsed())}ms)`);
			});
		});
	}
}
