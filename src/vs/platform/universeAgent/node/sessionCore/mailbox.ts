/**
 * Bounded FIFO mailbox. Overflow does not drop an accepted message — the offer fails
 * so the caller can fail-closed the subscription (ADR-009 §2 / INV-SPC-8 intake note).
 */

export class BoundedMailbox<T> {
	private readonly items: T[] = []

	constructor(readonly capacity: number) {
		if (!Number.isSafeInteger(capacity) || capacity < 1) {
			throw new Error('mailbox capacity must be a safe integer >= 1')
		}
	}

	get size(): number {
		return this.items.length
	}

	get isEmpty(): boolean {
		return this.items.length === 0
	}

	/** Enqueue if capacity allows. Returns false when full (message not stored). */
	offer(item: T): boolean {
		if (this.items.length >= this.capacity) {
			return false
		}
		this.items.push(item)
		return true
	}

	poll(): T | undefined {
		return this.items.shift()
	}

	clear(): void {
		this.items.length = 0
	}
}
