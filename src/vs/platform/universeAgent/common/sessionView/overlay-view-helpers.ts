/**
 * Overlay block helpers (Renderer-safe, no platform/electron dependency).
 * Pure, idempotent, type-safe utilities for block ordering and deduplication.
 */
import type { OverlayBlockView } from './types.js'

export function sortOverlayBlocksByOrderKey(
	blocks: readonly OverlayBlockView[],
): readonly OverlayBlockView[] {
	if (!Array.isArray(blocks)) return []
	return [...blocks].sort((a, b) => {
		const aKey = a.orderKey ?? ''
		const bKey = b.orderKey ?? ''
		return aKey.localeCompare(bKey)
	})
}

export function deduplicateOverlayBlocks(
	blocks: readonly OverlayBlockView[],
): readonly OverlayBlockView[] {
	if (!Array.isArray(blocks)) return []
	const seen = new Set<string>()
	const result: OverlayBlockView[] = []
	for (const block of blocks) {
		if (seen.has(block.blockId)) continue
		seen.add(block.blockId)
		result.push(block)
	}
	return result
}
