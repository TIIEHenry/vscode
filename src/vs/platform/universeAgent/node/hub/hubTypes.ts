/**
 * Minimal branded host/url types for vendored host-normalize (Desktop engine/types.ts excerpt).
 */
export type NormalizedHost = string & { readonly __brand: 'NormalizedHost' }
export type NormalizedUrl = string & { readonly __brand: 'NormalizedUrl' }
