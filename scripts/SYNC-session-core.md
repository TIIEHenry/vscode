# Universe Agent session-core sync

Vendored copy of Desktop [`session-core`](../../UniverseAgentDesktop/packages/session-core) into `platform/universeAgent`.

| Destination | Upstream |
|-------------|----------|
| `src/vs/platform/universeAgent/common/sessionView/` | `packages/session-core/src/view/**` (except `index.ts`) |
| `src/vs/platform/universeAgent/node/sessionCore/` | remaining production sources |

Run:

```bash
./scripts/sync-session-core.sh
# or
npx tsx scripts/sync-universe-agent-session-core.ts
```

Environment:

- `UA_DESKTOP_REPO` — override Desktop checkout path (default: sibling `../UniverseAgentDesktop`).

After sync, maintain `common/sessionView/index.ts` manually. Do not vendor upstream `view/index.ts` (it re-exports Actor-side `pending-actions-bound`).

See [conversation-stream-timeline S1](../dev/plans/conversation-stream-timeline.md#3-架构与落点).
