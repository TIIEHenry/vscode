/**
 * GFS-4: concatenate SessionActor implementation sources for domain pin tests.
 * Not part of the public package API.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

const PRODUCTION_FILES = [
	'session-actor.ts',
	'session-actor-chat-outbox.ts',
	'session-actor-local-fact.ts',
	'session-actor-overlay-fold.ts',
	'session-actor-stream-fold.ts',
	'session-actor-timeline-items.ts',
] as const

/** Full SessionActor fold surface (excludes tests and fold-interface types). */
export function readSessionActorProductionSource(): string {
	return PRODUCTION_FILES.map((name) => readFileSync(join(HERE, name), 'utf8')).join('\n\n')
}
