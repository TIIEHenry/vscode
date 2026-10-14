/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IDiffComputer as IExternalDiffComputer, createDiffComputer as createExternalDiffComputer } from '@vscode/diff';
import { resolveAmdNodeModulePath } from '../../../amdX.js';
import { LineRange } from '../core/ranges/lineRange.js';
import { OffsetRange } from '../core/ranges/offsetRange.js';
import { StringText } from '../core/text/abstractText.js';
import { ensureDependenciesAreSet } from '../core/text/positionToOffset.js';
import { ILinesDiffComputer, ILinesDiffComputerOptions, LinesDiff, MovedText } from './linesDiffComputer.js';
import { lineRangeMappingFromRangeMappings, LineRangeMapping, RangeMapping } from './rangeMapping.js';

type ExternalDiffModule = { createDiffComputer: typeof createExternalDiffComputer };

/**
 * Shares one in-flight or successful external diff module load.
 * A rejection clears `promise` only while it still points at that attempt,
 * so the next read loads again. A fulfillment stays cached.
 * The returned promise still rejects; this does not start another attempt.
 */
export function shareExternalDiffModule<T>(
	slot: { promise: Promise<T> | undefined },
	load: () => Promise<T>,
): Promise<T> {
	if (slot.promise) {
		return slot.promise;
	}

	const attempt = load();
	slot.promise = attempt;
	// Not assigned. Callers still observe this rejection; the next read loads again.
	void attempt.catch(() => {
		if (slot.promise === attempt) {
			slot.promise = undefined;
		}
	});
	return attempt;
}

const externalModuleSlot: { promise: Promise<ExternalDiffModule> | undefined } = { promise: undefined };
const externalDiffComputerSlot: { promise: Promise<IExternalDiffComputer> | undefined } = { promise: undefined };
const externalWasmDiffComputerSlot: { promise: Promise<IExternalDiffComputer> | undefined } = { promise: undefined };

function loadExternalModule(): Promise<ExternalDiffModule> {
	return shareExternalDiffModule(externalModuleSlot, () => {
		const url = resolveAmdNodeModulePath('@vscode/diff', 'dist/index.js');
		// Use a runtime-computed URL to keep bundlers from rewriting the import.
		return import(/* webpackIgnore: true */ /* @vite-ignore */ `${url}`) as Promise<ExternalDiffModule>;
	});
}

function loadExternalComputer(useWasm: boolean): Promise<IExternalDiffComputer> {
	const slot = useWasm ? externalWasmDiffComputerSlot : externalDiffComputerSlot;
	return shareExternalDiffModule(slot, () => loadExternalModule().then(m => m.createDiffComputer({ useWasm })));
}

export async function getExternalLinesDiffComputer(useWasm: boolean): Promise<ILinesDiffComputer> {
	const computer = await loadExternalComputer(useWasm);
	return new ExternalLinesDiffComputer(computer);
}

class ExternalLinesDiffComputer implements ILinesDiffComputer {
	constructor(private readonly _computer: IExternalDiffComputer) { }

	computeDiff(originalLines: string[], modifiedLines: string[], options: ILinesDiffComputerOptions): LinesDiff {
		ensureDependenciesAreSet();

		const originalText = new StringText(originalLines.join('\n'));
		const modifiedText = new StringText(modifiedLines.join('\n'));

		const result = this._computer.computeDiff(originalText.value, modifiedText.value, {
			// TODO: this currently throws
			ignoreTrimWhitespace: true,
			// ignoreTrimWhitespace: options.ignoreTrimWhitespace,
			// TODO: support this. Currently throws with "Time is not implemented in this environment."
			// maxComputationTimeMs: options.maxComputationTimeMs,
			computeMoves: options.computeMoves,
			extendToSubwords: options.extendToSubwords,
		});

		const originalTransformer = originalText.getTransformer();
		const modifiedTransformer = modifiedText.getTransformer();

		const rangeMappings: RangeMapping[] = [];
		let delta = 0;
		for (const r of result.edits.replacements) {
			const modifiedStart = r.range.start + delta;
			const modifiedEndExclusive = modifiedStart + r.newText.length;
			const originalRange = originalTransformer.getRange(new OffsetRange(r.range.start, r.range.endExclusive));
			const modifiedRange = modifiedTransformer.getRange(new OffsetRange(modifiedStart, modifiedEndExclusive));
			rangeMappings.push(new RangeMapping(originalRange, modifiedRange));
			delta += r.newText.length - (r.range.endExclusive - r.range.start);
		}

		const changes = lineRangeMappingFromRangeMappings(rangeMappings, originalText, modifiedText);

		const moves: MovedText[] = [];
		if (options.computeMoves) {
			for (const move of result.moves) {
				const originalStartPos = originalTransformer.getPosition(move.range.original.start);
				const originalEndPos = originalTransformer.getPosition(move.range.original.endExclusive);
				const modifiedStartPos = modifiedTransformer.getPosition(move.range.modified.start);
				const modifiedEndPos = modifiedTransformer.getPosition(move.range.modified.endExclusive);
				const originalLineRange = new LineRange(originalStartPos.lineNumber, originalEndPos.lineNumber);
				const modifiedLineRange = new LineRange(modifiedStartPos.lineNumber, modifiedEndPos.lineNumber);
				moves.push(new MovedText(new LineRangeMapping(originalLineRange, modifiedLineRange), []));
			}
		}

		return new LinesDiff(changes, moves, result.hitTimeout);
	}
}
