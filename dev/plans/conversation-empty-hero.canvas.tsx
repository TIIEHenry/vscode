/**
 * Cursor canvas snapshot for conversation-empty-hero.md (PRD-015).
 * Not compiled by workbench (`src/tsconfig` does not include `dev/`).
 * Informal visual — layout SSOT is the plan + PRD-015.
 * Live copy beside chat stays in the Cursor `canvases/` directory.
 */
import {
  Button,
  Callout,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  IconButton,
  Pill,
  Row,
  Select,
  Spacer,
  Stack,
  Table,
  Text,
  TextArea,
  useCanvasState,
  useHostTheme,
} from "cursor/canvas";

type Phase = "empty" | "active";
type Layout = "wide" | "narrow";
type Turn = {
  readonly role: "user" | "assistant" | "fold" | "tool";
  readonly text: string;
};
type QueueItem = {
  readonly id: string;
  readonly text: string;
};
type DriveTask = {
  readonly id: string;
  readonly text: string;
  readonly status: "done" | "active" | "pending";
};
type VoiceClip = {
  readonly id: string;
  readonly status: "recording" | "transcribing";
  readonly durationLabel: string;
};
type MenuId = "none" | "add" | "tune" | "more" | "templates";

const LIST_PROMPT = "初始化的不应该有dock悬浮按钮吧";

const SAMPLE_ACTIVE_TURNS: Turn[] = [
  { role: "user", text: LIST_PROMPT },
  { role: "fold", text: "Thought · 6s" },
  { role: "tool", text: "Read chat-input-bar.md" },
  {
    role: "assistant",
    text: "Centered only while PreFirst. After the first send, identity XOR to the column top and the same one-row composer docks.",
  },
  { role: "user", text: "Keep the bottom chrome a single row." },
  { role: "assistant", text: "Left cluster scrolls; Model / Template / Send stay pinned. Menus overlay up." },
];

const SAMPLE_QUEUE: QueueItem[] = [
  { id: "q1", text: "Keep the bottom chrome a single row." },
  { id: "q2", text: LIST_PROMPT },
  { id: "q3", text: "Follow Singularity toolbar anatomy." },
];

const SAMPLE_TASKS: DriveTask[] = [
  { id: "t1", text: "Pin SessionConfig onto the composer row", status: "done" },
  { id: "t2", text: "Split Inbox Task left of MessageQueue", status: "active" },
  { id: "t3", text: "Keep Goal independent of both lists", status: "pending" },
];

const SAMPLE_VOICE: VoiceClip[] = [
  { id: "v1", status: "transcribing", durationLabel: "0:08" },
  { id: "v2", status: "transcribing", durationLabel: "0:05" },
  { id: "v3", status: "recording", durationLabel: "0:03" },
];

const VOICE_PHRASES = [
  "初始化的不应该有dock悬浮按钮吧",
  "输入要复用同一套布局",
  "多段语音拼进同一个输入框",
];

function appendVoiceText(current: string, incoming: string) {
  const next = incoming.trim();
  if (!next) {
    return current;
  }
  const cur = current.replace(/\s+$/g, "");
  return cur.length === 0 ? next : `${cur} ${next}`;
}

function beginOrFinishVoice(
  clips: VoiceClip[],
  setClips: (value: VoiceClip[] | ((prev: VoiceClip[]) => VoiceClip[])) => void,
  setDraft: (value: string | ((prev: string) => string)) => void,
  phraseAt: number,
  setPhraseAt: (value: number | ((prev: number) => number)) => void,
) {
  const rec = clips.find((clip) => clip.status === "recording");
  if (rec) {
    const phrase = VOICE_PHRASES[phraseAt % VOICE_PHRASES.length];
    setClips(clips.map((clip) => (clip.id === rec.id ? { ...clip, status: "transcribing" } : clip)));
    setPhraseAt(phraseAt + 1);
    window.setTimeout(() => {
      setClips((cur) => cur.filter((clip) => clip.id !== rec.id));
      setDraft((cur) => appendVoiceText(cur, phrase));
    }, 1200);
    return;
  }
  setClips([
    ...clips,
    {
      id: `v-${phraseAt}-${clips.length}`,
      status: "recording",
      durationLabel: "0:01",
    },
  ]);
}

const AGENTS = [
  { value: "none", label: "Agent" },
  { value: "coder", label: "coder" },
  { value: "reviewer", label: "reviewer" },
];

const MODELS = [
  { value: "none", label: "Select model" },
  { value: "grok", label: "Grok 4.6" },
  { value: "opus", label: "Claude Opus" },
];

const PERMISSIONS = [
  { value: "ask", label: "Ask" },
  { value: "agent", label: "Agent" },
  { value: "permit", label: "完全访问" },
];

const TOOLS = [
  { value: "all", label: "Tools: all" },
  { value: "readonly", label: "Tools: readonly" },
];

const ROUTES = [
  { value: "none", label: "不路由" },
  { value: "balanced", label: "Balanced" },
  { value: "speed", label: "Speed" },
  { value: "quality", label: "Quality" },
];

function Chip({
  label,
  chevron,
  muted,
  onClick,
}: {
  label: string;
  chevron?: boolean;
  muted?: boolean;
  onClick?: () => void;
}) {
  const theme = useHostTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        maxWidth: "100%",
        padding: "2px 8px",
        borderRadius: 2,
        border: "none",
        background: "transparent",
        color: muted ? theme.text.tertiary : theme.text.secondary,
        fontSize: 11,
        lineHeight: "16px",
        cursor: onClick ? "pointer" : "default",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {label}
      {chevron ? (
        <span style={{ color: theme.text.quaternary, fontSize: 9 }}>▾</span>
      ) : null}
    </button>
  );
}

function CursorGlyph({
  kind,
  color,
}: {
  kind: "send" | "plus" | "mic" | "copy" | "share";
  color: string;
}) {
  if (kind === "send") {
    return (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
        <path
          d="M6.5 10.5V2.5M6.5 2.5L3 6M6.5 2.5L10 6"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "plus") {
    return (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
        <path d="M6.5 2.5v8M2.5 6.5h8" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "mic") {
    return (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
        <rect x="4.6" y="1.6" width="3.8" height="6.2" rx="1.9" stroke={color} strokeWidth="1.3" />
        <path
          d="M2.8 6.4a3.7 3.7 0 007.4 0M6.5 10.1v1.4"
          stroke={color}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === "share") {
    return (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
        <path
          d="M8.2 3.2A2.4 2.4 0 1010.6 5.6L4.8 8.2M8.2 9.8A2.4 2.4 0 1010.6 7.4L4.8 4.8"
          stroke={color}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <rect x="4.2" y="3.4" width="6.2" height="6.2" rx="1.2" stroke={color} strokeWidth="1.3" />
      <path d="M3.2 8.4V4.6c0-.8.6-1.4 1.4-1.4h3.8" stroke={color} strokeWidth="1.3" />
    </svg>
  );
}

const CONTROL = 32;

function CircleControl({
  kind,
  surface = "ghost",
  title,
  onClick,
}: {
  kind: "send" | "plus" | "mic";
  surface?: "ghost" | "soft" | "filled";
  title: string;
  onClick?: () => void;
}) {
  const theme = useHostTheme();
  const filled = surface === "filled";
  const soft = surface === "soft";
  const ink = filled ? theme.bg.elevated : theme.text.secondary;
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: CONTROL,
        height: CONTROL,
        borderRadius: CONTROL / 2,
        border: "none",
        background: filled ? theme.text.primary : soft ? theme.fill.tertiary : "transparent",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        cursor: onClick ? "pointer" : "default",
        flexShrink: 0,
      }}
    >
      <CursorGlyph kind={kind} color={ink} />
    </button>
  );
}

function GhostControl({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick?: () => void;
  children: ReturnType<typeof ToolbarGlyph> | string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: CONTROL,
        height: CONTROL,
        border: "none",
        background: "transparent",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        cursor: onClick ? "pointer" : "default",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function CursorUserCard({ children }: { children: ReturnType<typeof Stack> }) {
  const theme = useHostTheme();
  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${theme.stroke.tertiary}`,
        background: theme.bg.elevated,
        padding: "14px 16px 12px",
      }}
    >
      {children}
    </div>
  );
}

function UserTurnDisplay({
  text,
  onEdit,
}: {
  text: string;
  onEdit?: () => void;
}) {
  return (
    <div
      role={onEdit ? "button" : undefined}
      onClick={onEdit}
      style={{ cursor: onEdit ? "pointer" : "default" }}
    >
      <CursorUserCard>
        <Text>{text}</Text>
      </CursorUserCard>
    </div>
  );
}

function TaskList({
  items,
  onClose,
}: {
  items: DriveTask[];
  onClose: () => void;
}) {
  const theme = useHostTheme();
  return (
    <div style={{ padding: "0 8px 8px" }}>
      <div
        style={{
          borderRadius: 12,
          border: `1px solid ${theme.stroke.secondary}`,
          background: theme.bg.elevated,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "6px 8px" }}>
          <Row align="center">
            <Text size="small" weight="semibold">
              Tasks
            </Text>
            <Spacer />
            <IconButton title="Close task list" size="sm" onClick={onClose}>
              <ToolbarGlyph kind="close" color={theme.text.quaternary} />
            </IconButton>
          </Row>
        </div>
        {items.map((item, i) => (
          <div key={item.id}>
            <div
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                borderTop: `1px solid ${theme.stroke.tertiary}`,
              }}
            >
              <Row align="center" gap={8}>
                <Text size="small" tone="tertiary">
                  {i + 1}
                </Text>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="small">{item.text}</Text>
                </div>
                <Text size="small" tone="secondary">
                  {item.status}
                </Text>
              </Row>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QueueList({
  items,
  editingId,
  onEdit,
  onClose,
}: {
  items: QueueItem[];
  editingId: string | null;
  onEdit: (id: string) => void;
  onClose: () => void;
}) {
  const theme = useHostTheme();
  return (
    <div style={{ padding: "0 8px 8px" }}>
      <div
        style={{
          borderRadius: 12,
          border: `1px solid ${theme.stroke.secondary}`,
          background: theme.bg.elevated,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "6px 8px" }}>
          <Row align="center">
            <Text size="small" weight="semibold">
              MessageQueue
            </Text>
            <Spacer />
            <IconButton title="Close queue list" size="sm" onClick={onClose}>
              <ToolbarGlyph kind="close" color={theme.text.quaternary} />
            </IconButton>
          </Row>
        </div>
        {items.map((item, i) => {
          const editing = item.id === editingId;
          return (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => onEdit(item.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  border: "none",
                  borderTop: `1px solid ${theme.stroke.tertiary}`,
                  background: editing ? theme.fill.secondary : "transparent",
                  cursor: "pointer",
                }}
              >
                <Row align="center" gap={8}>
                  <Text size="small" tone="tertiary">
                    {i + 1}
                  </Text>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text size="small">{item.text}</Text>
                  </div>
                  {editing ? (
                    <Text size="small" tone="secondary">
                      Editing
                    </Text>
                  ) : null}
                </Row>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VoiceQueue({ clips }: { clips: VoiceClip[] }) {
  const theme = useHostTheme();
  if (clips.length === 0) {
    return null;
  }
  return (
    <div style={{ padding: "0 8px 8px" }}>
      <div
        style={{
          borderRadius: 12,
          border: `1px solid ${theme.stroke.tertiary}`,
          background: theme.bg.elevated,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "8px 10px 6px" }}>
          <Text size="small" weight="semibold">
            Voice
          </Text>
        </div>
        {clips.map((clip) => {
          const recording = clip.status === "recording";
          return (
            <div key={clip.id}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderTop: `1px solid ${theme.stroke.tertiary}`,
                }}
              >
                <CircleControl
                  kind="mic"
                  surface={recording ? "filled" : "ghost"}
                  title={recording ? "Recording" : "Transcribing"}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="small" tone={recording ? "primary" : "secondary"}>
                    {recording ? "Recording" : "Transcribing"}
                  </Text>
                  <div>
                    <Text size="small" tone="tertiary">
                      {clip.durationLabel}
                      {recording ? "" : " · text lands in the input when ready"}
                    </Text>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div style={{ padding: "6px 10px 8px" }}>
          <Text size="small" tone="tertiary">
            Stop a clip, then tap mic again without waiting. Segments append in order.
          </Text>
        </div>
      </div>
    </div>
  );
}

function InListInputSection() {
  const theme = useHostTheme();
  const [draft, setDraft] = useCanvasState("listEditDraft", LIST_PROMPT);
  const [queueItems, setQueueItems] = useCanvasState("demoQueueItems", SAMPLE_QUEUE);
  const [editingId, setEditingId] = useCanvasState("demoQueueEditingId", "q2");
  const [queueDraft, setQueueDraft] = useCanvasState("demoQueueDraft", LIST_PROMPT);
  const [agent, setAgent] = useCanvasState("agent", "coder");
  const [model, setModel] = useCanvasState("model", "grok");
  const [permission, setPermission] = useCanvasState("permission", "permit");
  const [tools, setTools] = useCanvasState("tools", "all");
  const [route, setRoute] = useCanvasState("route", "none");
  const [goalOn, setGoalOn] = useCanvasState("goalOn", false);
  const [menu, setMenu] = useCanvasState<MenuId>("demoInputMenu", "none");
  const [voiceClips, setVoiceClips] = useCanvasState<VoiceClip[]>("demoVoiceClips", SAMPLE_VOICE);
  const [voicePhrase, setVoicePhrase] = useCanvasState("demoVoicePhrase", 0);
  const [voiceDraft, setVoiceDraft] = useCanvasState(
    "demoVoiceDraft",
    "初始化的不应该有dock悬浮按钮吧",
  );
  const frame = {
    padding: 28,
    borderRadius: 8,
    background: theme.fill.tertiary,
  };
  const editing = queueItems.find((item) => item.id === editingId);
  const editingIndex = Math.max(0, queueItems.findIndex((item) => item.id === editingId));
  const exitQueueEdit = () => {
    const item = queueItems.find((row) => row.id === editingId);
    if (item) {
      setQueueDraft(item.text);
    }
    setEditingId("");
  };
  const chrome = {
    floating: false as const,
    agent,
    model,
    permission,
    tools,
    route,
    goalOn,
    onAgent: setAgent,
    onModel: setModel,
    onPermission: setPermission,
    onTools: setTools,
    onRoute: setRoute,
    onGoal: setGoalOn,
    menu,
    onMenu: setMenu,
    onVoice: () =>
      beginOrFinishVoice(voiceClips, setVoiceClips, setVoiceDraft, voicePhrase, setVoicePhrase),
    voiceRecording: voiceClips.some((clip) => clip.status === "recording"),
  };
  return (
    <Stack gap={16}>
      <Grid columns={2} gap={16}>
        <Stack gap={8}>
          <H3>Display</H3>
          <div style={frame}>
            <UserTurnDisplay text={LIST_PROMPT} />
            <div style={{ marginTop: 12 }}>
              <Text size="small" tone="tertiary">
                Thinking
              </Text>
            </div>
          </div>
        </Stack>
        <Stack gap={8}>
          <H3>In-list edit</H3>
          <div style={frame}>
            <Composer
              {...chrome}
              policy="turnEdit"
              draft={draft}
              onDraft={setDraft}
              onSend={() => undefined}
              onExit={() => undefined}
            />
          </div>
        </Stack>
      </Grid>
      <Stack gap={8}>
        <H3>Queue edit</H3>
        <div style={frame}>
          <QueueList
            items={queueItems}
            editingId={editingId || null}
            onEdit={(id) => {
              const item = queueItems.find((row) => row.id === id);
              setEditingId(id);
              setQueueDraft(item?.text ?? "");
            }}
            onClose={() => undefined}
          />
          {editing ? (
            <Composer
              {...chrome}
              policy="queueEdit"
              queueLabel={`${editingIndex + 1} of ${queueItems.length}`}
              canSubmit={queueDraft !== editing.text && queueDraft.trim().length > 0}
              draft={queueDraft}
              onDraft={setQueueDraft}
              onSend={() => {
                setQueueItems(
                  queueItems.map((row) => (row.id === editing.id ? { ...row, text: queueDraft } : row)),
                );
                setEditingId("");
              }}
              onExit={exitQueueEdit}
            />
          ) : (
            <div style={{ marginTop: 8 }}>
              <Text size="small" tone="tertiary">
                Click a queued row to edit. Exit releases hold without Send.
              </Text>
            </div>
          )}
        </div>
      </Stack>
      <Stack gap={8}>
        <H3>Voice queue</H3>
        <div style={frame}>
          <VoiceQueue clips={voiceClips} />
          <Composer
            {...chrome}
            draft={voiceDraft}
            onDraft={setVoiceDraft}
            onSend={() => undefined}
          />
        </div>
      </Stack>
    </Stack>
  );
}

function IdentityRow({ connected }: { connected: boolean }) {
  return (
    <Row gap={10} align="center" wrap>
      <Chip
        label={connected ? "vscode" : "No folder"}
        chevron={connected}
        muted={!connected}
        onClick={() => undefined}
      />
      <Chip
        label={connected ? "Local Engine" : "Engine not connected"}
        muted={!connected}
        onClick={() => undefined}
      />
      {connected ? <Chip label="agent-ide" muted /> : null}
    </Row>
  );
}

function ToolbarMenu({
  align,
  title,
  rows,
  onClose,
  tools,
  onTools,
  route,
  onRoute,
}: {
  align: "left" | "right";
  title: string;
  rows?: string[];
  onClose: () => void;
  tools?: string;
  onTools?: (v: string) => void;
  route?: string;
  onRoute?: (v: string) => void;
}) {
  const theme = useHostTheme();
  return (
    <div
      style={{
        position: "absolute",
        bottom: "100%",
        left: align === "left" ? 8 : undefined,
        right: align === "right" ? 8 : undefined,
        marginBottom: 4,
        zIndex: 3,
        minWidth: 220,
        maxWidth: 320,
        padding: 8,
        border: `1px solid ${theme.stroke.secondary}`,
        borderRadius: 12,
        background: theme.bg.elevated,
      }}
    >
      <Row align="center">
        <Text size="small" weight="semibold">
          {title}
        </Text>
        <Spacer />
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </Row>
      {rows ? (
        <Stack gap={4} style={{ marginTop: 6 }}>
          {rows.map((row) => (
            <div key={row}>
              <Text size="small" tone="secondary">
                {row}
              </Text>
            </div>
          ))}
        </Stack>
      ) : null}
      {onTools && tools !== undefined ? (
        <Select value={tools} onChange={onTools} options={TOOLS} style={{ marginTop: 6 }} />
      ) : null}
      {onRoute && route !== undefined ? (
        <Select value={route} onChange={onRoute} options={ROUTES} style={{ marginTop: 6 }} />
      ) : null}
    </div>
  );
}

function ToolbarGlyph({
  kind,
  color,
}: {
  kind: "tune" | "template" | "maximize" | "send" | "close";
  color: string;
}) {
  if (kind === "tune") {
    return (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
        <path d="M2 3.5h9M4.2 2.2v2.6M2 9.5h9M8.8 8.2v2.6" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "template") {
    return (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
        <rect x="2.2" y="2.2" width="8.6" height="8.6" rx="1.2" stroke={color} strokeWidth="1.3" />
        <path d="M4.2 5.2h4.6M4.2 7.6h3.2" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "maximize") {
    return (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
        <path
          d="M3 5.2V3h2.2M10 5.2V3H7.8M3 7.8V10h2.2M10 7.8V10H7.8"
          stroke={color}
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "close") {
    return (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
        <path d="M3.2 3.2l6.6 6.6M9.8 3.2l-6.6 6.6" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path
        d="M6.5 10.2V2.8M6.5 2.8L3.2 6M6.5 2.8L9.8 6"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ComposerSend({ disabled, onClick, title }: { disabled: boolean; onClick: () => void; title: string }) {
  const theme = useHostTheme();
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: CONTROL,
        height: CONTROL,
        borderRadius: CONTROL / 2,
        border: "none",
        background: disabled ? theme.fill.tertiary : theme.text.primary,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        cursor: disabled ? "default" : "pointer",
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <CursorGlyph kind="send" color={disabled ? theme.text.quaternary : theme.bg.elevated} />
    </button>
  );
}

function Composer({
  draft,
  onDraft,
  onSend,
  floating,
  agent,
  model,
  permission,
  tools,
  route,
  goalOn,
  onAgent,
  onModel,
  onPermission,
  onTools,
  onRoute,
  onGoal,
  menu,
  onMenu,
  policy,
  onExit,
  queueLabel,
  canSubmit,
  onVoice,
  voiceRecording,
  showRoute,
  showAgent,
}: {
  draft: string;
  onDraft: (v: string) => void;
  onSend: () => void;
  floating: boolean;
  agent: string;
  model: string;
  permission: string;
  tools: string;
  route: string;
  goalOn: boolean;
  onAgent: (v: string) => void;
  onModel: (v: string) => void;
  onPermission: (v: string) => void;
  onTools: (v: string) => void;
  onRoute: (v: string) => void;
  onGoal: (v: boolean) => void;
  menu: MenuId;
  onMenu: (id: MenuId) => void;
  policy?: "compose" | "queueEdit" | "turnEdit";
  onExit?: () => void;
  queueLabel?: string;
  canSubmit?: boolean;
  onVoice?: () => void;
  voiceRecording?: boolean;
  showRoute?: boolean;
  showAgent?: boolean;
}) {
  const theme = useHostTheme();
  const ghostSelect = {
    height: CONTROL,
    minHeight: CONTROL,
    maxHeight: CONTROL,
    minWidth: 108,
    maxWidth: 148,
    flexShrink: 0,
    border: "none",
    background: "transparent",
    boxShadow: "none",
    padding: 0,
    borderRadius: 0,
    lineHeight: `${CONTROL}px`,
  } as const;
  const toggle = (id: MenuId) => onMenu(menu === id ? "none" : id);
  const mode = policy ?? "compose";
  const enabled =
    canSubmit ??
    (mode === "compose" ? draft.trim().length > 0 && model !== "none" : draft.trim().length > 0);
  const sendTitle = mode === "queueEdit" ? "Save queued message" : "Send";

  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${theme.stroke.tertiary}`,
        background: theme.bg.elevated,
        overflow: "visible",
      }}
    >
      {mode !== "compose" ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px 0",
          }}
        >
          <Text size="small" weight="semibold">
            {mode === "queueEdit" ? `Editing queued · ${queueLabel ?? ""}` : "Editing message"}
          </Text>
          <Spacer />
          <IconButton title="Exit" size="sm" onClick={onExit}>
            <ToolbarGlyph kind="close" color={theme.text.secondary} />
          </IconButton>
        </div>
      ) : null}
      <div style={{ padding: floating ? "14px 14px 8px" : "12px 14px 8px" }}>
        <TextArea
          value={draft}
          onChange={onDraft}
          placeholder="Ask with @ for context, / for commands or skills"
          rows={3}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            borderRadius: 0,
            padding: 0,
            boxShadow: "none",
            outline: "none",
            resize: "none",
          }}
        />
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          flexWrap: "nowrap",
          alignItems: "center",
          gap: 4,
          padding: "0 10px 8px",
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexWrap: "nowrap",
            alignItems: "center",
            gap: 4,
            overflowX: "auto",
            height: CONTROL,
          }}
        >
          <CircleControl kind="plus" surface="soft" title="Add" onClick={() => toggle("add")} />
          <GhostControl title="Tool Options" onClick={() => toggle("tune")}>
            <ToolbarGlyph kind="tune" color={theme.text.secondary} />
          </GhostControl>
          <Select value={permission} onChange={onPermission} options={PERMISSIONS} style={ghostSelect} />
          {showAgent ? (
            <Select value={agent} onChange={onAgent} options={AGENTS} style={ghostSelect} />
          ) : null}
          {showRoute ? (
            <Select value={route} onChange={onRoute} options={ROUTES} style={ghostSelect} />
          ) : null}
          <GhostControl title="More: pin, display" onClick={() => toggle("more")}>
            ⋯
          </GhostControl>
        </div>
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            flexWrap: "nowrap",
            alignItems: "center",
            gap: 4,
            height: CONTROL,
          }}
        >
          <Select value={model} onChange={onModel} options={MODELS} style={ghostSelect} />
          <GhostControl title="Templates" onClick={() => toggle("templates")}>
            <ToolbarGlyph kind="template" color={theme.text.secondary} />
          </GhostControl>
          <GhostControl title="Maximize input">
            <ToolbarGlyph kind="maximize" color={theme.text.secondary} />
          </GhostControl>
          <CircleControl
            kind="mic"
            surface={voiceRecording ? "filled" : "ghost"}
            title={voiceRecording ? "Stop voice clip" : "Voice input"}
            onClick={onVoice}
          />
          <ComposerSend disabled={!enabled} onClick={onSend} title={sendTitle} />
        </div>
        {menu === "add" ? (
          <ToolbarMenu
            align="left"
            title="Add"
            rows={["Attach file", "Clipboard", "Engine skills", "Client skills", "Browse skill store", "Templates"]}
            onClose={() => onMenu("none")}
          />
        ) : null}
        {menu === "tune" ? (
          <ToolbarMenu
            align="left"
            title="Tool Options"
            tools={tools}
            onTools={onTools}
            onClose={() => onMenu("none")}
          />
        ) : null}
        {menu === "more" ? (
          <ToolbarMenu
            align="left"
            title="More"
            rows={["Display", "Pin input", "Unpin input"]}
            onClose={() => onMenu("none")}
          />
        ) : null}
        {menu === "templates" ? (
          <ToolbarMenu
            align="right"
            title="Templates"
            rows={["Explain selection (one-shot)", "Review diff", "Write tests"]}
            onClose={() => onMenu("none")}
          />
        ) : null}
      </div>
    </div>
  );
}

function SessionBar({
  route,
  onRoute,
  showRoute,
}: {
  route?: string;
  onRoute?: (v: string) => void;
  showRoute?: boolean;
}) {
  const theme = useHostTheme();
  const barSelect = {
    height: 18,
    minHeight: 18,
    maxHeight: 18,
    maxWidth: 128,
    border: "none",
    background: "transparent",
    boxShadow: "none",
    padding: 0,
    fontSize: 11,
    lineHeight: "18px",
  } as const;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 22,
        padding: "0 8px",
        borderBottom: `1px solid ${theme.stroke.tertiary}`,
        background: theme.bg.chrome,
        color: theme.text.secondary,
      }}
    >
      <Text as="span" size="small" weight="semibold">
        Conversation
      </Text>
      <div
        style={{
          padding: "1px 6px",
          borderRadius: 2,
          background: theme.fill.tertiary,
          color: theme.text.primary,
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        Conversation
      </div>
      <Text as="span" size="small" tone="tertiary">
        Trajectory
      </Text>
      <Spacer />
      {showRoute && onRoute && route !== undefined ? (
        <Select value={route} onChange={onRoute} options={ROUTES} style={barSelect} />
      ) : null}
      <Text as="span" size="small" weight="semibold">
        Untitled
      </Text>
    </div>
  );
}

function Sidebar() {
  const theme = useHostTheme();
  const item = (label: string, active?: boolean) => (
    <div
      style={{
        padding: "3px 8px",
        borderRadius: 2,
        background: active ? theme.fill.tertiary : "transparent",
        color: active ? theme.text.primary : theme.text.secondary,
        fontSize: 12,
      }}
    >
      {label}
    </div>
  );
  return (
    <div
      style={{
        width: 168,
        flexShrink: 0,
        background: theme.bg.chrome,
        borderRight: `1px solid ${theme.stroke.tertiary}`,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          height: 22,
          padding: "0 8px",
          display: "flex",
          alignItems: "center",
          borderBottom: `1px solid ${theme.stroke.tertiary}`,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: theme.text.secondary,
        }}
      >
        Sessions
      </div>
      <div style={{ padding: 6 }}>
        {item("Untitled", true)}
        {item("Navigator tabs")}
        {item("Composer surface")}
      </div>
    </div>
  );
}

function Timeline({
  turns,
  identity,
  cursorUserTurns,
  editingIndex,
  onEditUser,
  editComposer,
}: {
  turns: Turn[];
  identity?: ReturnType<typeof IdentityRow>;
  cursorUserTurns?: boolean;
  editingIndex?: number;
  onEditUser?: (index: number) => void;
  editComposer?: ReturnType<typeof Composer>;
}) {
  const theme = useHostTheme();
  const empty = turns.length === 0;
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "10px 8px 8px" }}>
      <Stack gap={12}>
        {identity ? identity : null}
        {empty ? <div style={{ minHeight: 24 }} /> : null}
        {turns.map((turn, i) => {
          if (turn.role === "fold" || turn.role === "tool") {
            return (
              <div key={i}>
                <Text size="small" tone="tertiary">
                  {turn.role === "fold" ? turn.text : `Tool · ${turn.text}`}
                </Text>
              </div>
            );
          }
          const isUser = turn.role === "user";
          if (isUser && cursorUserTurns) {
            const editing = editingIndex === i;
            return (
              <div key={i} style={{ maxWidth: 560 }}>
                {editing && editComposer ? (
                  editComposer
                ) : (
                  <UserTurnDisplay
                    text={turn.text}
                    onEdit={() => onEditUser?.(i)}
                  />
                )}
              </div>
            );
          }
          return (
            <div key={i}>
              <Stack gap={4}>
                <Text size="small" weight="semibold" tone={isUser ? "primary" : "secondary"}>
                  {isUser ? "You" : "Agent"}
                </Text>
                <div
                  style={{
                    padding: isUser ? "8px 10px" : 0,
                    borderRadius: 2,
                    background: isUser ? theme.fill.secondary : "transparent",
                    border: isUser ? `1px solid ${theme.stroke.tertiary}` : "none",
                  }}
                >
                  <Text size="small">{turn.text}</Text>
                </div>
              </Stack>
            </div>
          );
        })}
      </Stack>
    </div>
  );
}

function FloatChip({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick?: () => void;
  children: ReturnType<typeof Text> | ReturnType<typeof CursorGlyph> | ReturnType<typeof CtxRing>;
}) {
  const theme = useHostTheme();
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 28,
        height: 24,
        padding: "0 8px",
        borderRadius: 2,
        border: `1px solid ${theme.stroke.tertiary}`,
        background: active ? theme.fill.secondary : theme.bg.elevated,
        color: theme.text.secondary,
        cursor: "pointer",
        pointerEvents: "auto",
      }}
    >
      {children}
    </button>
  );
}

function CtxRing({ pct }: { pct: number }) {
  const theme = useHostTheme();
  const r = 7;
  const c = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle
        cx="11"
        cy="11"
        r={r}
        fill="none"
        stroke={theme.stroke.tertiary}
        strokeWidth="2"
      />
      <circle
        cx="11"
        cy="11"
        r={r}
        fill="none"
        stroke={theme.text.primary}
        strokeWidth="2"
        strokeDasharray={`${filled} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 11 11)"
      />
    </svg>
  );
}

function OverlayDock({
  showInbox,
  showStop,
  showCtx,
  goalOn,
  onGoal,
  taskOpen,
  queueOpen,
  queueEditing,
  onTask,
  onQueue,
}: {
  showInbox: boolean;
  showStop: boolean;
  showCtx?: boolean;
  goalOn: boolean;
  onGoal: (v: boolean) => void;
  taskOpen?: boolean;
  queueOpen?: boolean;
  queueEditing?: boolean;
  onTask?: () => void;
  onQueue?: () => void;
}) {
  const theme = useHostTheme();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 8px 8px",
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {showInbox ? (
          <FloatChip title="Tasks" active={taskOpen} onClick={onTask}>
            <Text as="span" size="small">
              Task 3
            </Text>
          </FloatChip>
        ) : null}
        {showInbox ? (
          <FloatChip
            title="MessageQueue"
            active={queueOpen || queueEditing}
            onClick={onQueue}
          >
            <Text as="span" size="small">
              Queue 3
            </Text>
          </FloatChip>
        ) : null}
        <FloatChip title="Goal" active={goalOn} onClick={() => onGoal(!goalOn)}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M3 10.5V2.2l6.2 1.6v3.4L3 5.6"
              stroke={theme.text.secondary}
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
        </FloatChip>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {showStop ? (
          <FloatChip title="Stop generation">
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect x="1.2" y="1.2" width="7.6" height="7.6" rx="1" fill={theme.text.secondary} />
            </svg>
          </FloatChip>
        ) : null}
        {showCtx === false ? null : (
          <button
            type="button"
            title="Context window"
            style={{
              width: 24,
              height: 24,
              padding: 0,
              border: "none",
              background: "transparent",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              pointerEvents: "auto",
            }}
          >
            <CtxRing pct={42} />
          </button>
        )}
      </div>
    </div>
  );
}

function ConversationPane() {
  const theme = useHostTheme();
  const [phase, setPhase] = useCanvasState<Phase>("phase", "empty");
  const [layout, setLayout] = useCanvasState<Layout>("layout", "wide");
  const [connected, setConnected] = useCanvasState("connected", true);
  const [draft, setDraft] = useCanvasState("draft", "");
  const [agent, setAgent] = useCanvasState("agent", "coder");
  const [model, setModel] = useCanvasState("model", "grok");
  const [permission, setPermission] = useCanvasState("permission", "permit");
  const [tools, setTools] = useCanvasState("tools", "all");
  const [route, setRoute] = useCanvasState("route", "none");
  const [goalOn, setGoalOn] = useCanvasState("goalOn", false);
  const [menu, setMenu] = useCanvasState<MenuId>("menu", "none");
  const [voiceClips, setVoiceClips] = useCanvasState<VoiceClip[]>("initVoiceClips", []);
  const [voicePhrase, setVoicePhrase] = useCanvasState("initVoicePhrase", 0);
  const [turns, setTurns] = useCanvasState<Turn[]>("turns", []);
  const [editingIndex, setEditingIndex] = useCanvasState("initEditingIndex", -1);
  const [editDraft, setEditDraft] = useCanvasState("initEditDraft", LIST_PROMPT);

  const empty = phase === "empty";
  const hero = empty && layout === "wide";
  const paneWidth = layout === "wide" ? 680 : 380;

  const send = () => {
    const text = draft.trim();
    if (!text || model === "none") {
      return;
    }
    setTurns([...turns, { role: "user", text }]);
    setDraft("");
    setMenu("none");
    setPhase("active");
  };

  const reset = () => {
    setPhase("empty");
    setTurns([]);
    setDraft("");
    setMenu("none");
  };

  const identity = <IdentityRow connected={connected} />;
  const composer = (
    <Composer
      draft={draft}
      onDraft={setDraft}
      onSend={send}
      floating={hero}
      agent={agent}
      model={model}
      permission={permission}
      tools={tools}
      route={route}
      goalOn={goalOn}
      onAgent={setAgent}
      onModel={setModel}
      onPermission={setPermission}
      onTools={setTools}
      onRoute={setRoute}
      onGoal={setGoalOn}
      menu={menu}
      onMenu={setMenu}
      onVoice={() =>
        beginOrFinishVoice(voiceClips, setVoiceClips, setDraft, voicePhrase, setVoicePhrase)
      }
      voiceRecording={voiceClips.some((clip) => clip.status === "recording")}
      showRoute={empty}
      showAgent={empty}
    />
  );
  const listEditing = editingIndex >= 0;
  const editComposer = listEditing ? (
    <Composer
      policy="turnEdit"
      onExit={() => setEditingIndex(-1)}
      draft={editDraft}
      onDraft={setEditDraft}
      onSend={() => {
        setTurns(turns.map((turn, i) => (i === editingIndex ? { ...turn, text: editDraft } : turn)));
        setEditingIndex(-1);
      }}
      floating={false}
      agent={agent}
      model={model}
      permission={permission}
      tools={tools}
      route={route}
      goalOn={goalOn}
      onAgent={setAgent}
      onModel={setModel}
      onPermission={setPermission}
      onTools={setTools}
      onRoute={setRoute}
      onGoal={setGoalOn}
      menu={menu}
      onMenu={setMenu}
      onVoice={() =>
        beginOrFinishVoice(voiceClips, setVoiceClips, setEditDraft, voicePhrase, setVoicePhrase)
      }
      voiceRecording={voiceClips.some((clip) => clip.status === "recording")}
    />
  ) : undefined;

  const cluster = (
    <Stack gap={8}>
      {empty ? identity : null}
      {empty ? null : (
        <OverlayDock
          showInbox
          showStop
          goalOn={goalOn}
          onGoal={setGoalOn}
        />
      )}
      <VoiceQueue clips={voiceClips} />
      {listEditing ? null : composer}
    </Stack>
  );

  return (
    <Stack gap={16}>
      <Row gap={8} align="center" wrap>
        <Button variant={empty ? "primary" : "secondary"} onClick={reset}>
          Empty session
        </Button>
        <Button variant={phase === "active" ? "primary" : "secondary"} onClick={() => setPhase("active")}>
          After first send
        </Button>
        <Button variant={layout === "wide" ? "primary" : "ghost"} onClick={() => setLayout("wide")}>
          Wide
        </Button>
        <Button variant={layout === "narrow" ? "primary" : "ghost"} onClick={() => setLayout("narrow")}>
          Narrow ≤720
        </Button>
        <Button variant={connected ? "secondary" : "ghost"} onClick={() => setConnected(!connected)}>
          {connected ? "Engine connected" : "Engine not connected"}
        </Button>
      </Row>

      <div
        style={{
          display: "flex",
          border: `1px solid ${theme.stroke.secondary}`,
          borderRadius: 4,
          overflow: "hidden",
          minHeight: 540,
          background: theme.bg.chrome,
        }}
      >
        <Sidebar />
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            justifyContent: "center",
            background: theme.bg.editor,
          }}
        >
          <div
            style={{
              width: paneWidth,
              maxWidth: "100%",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <SessionBar
              route={route}
              onRoute={setRoute}
              showRoute={!empty}
            />
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              <Timeline
                turns={turns}
                identity={empty ? undefined : identity}
                cursorUserTurns={!empty}
                editingIndex={editingIndex}
                onEditUser={(index) => {
                  setEditingIndex(index);
                  if (index >= 0) {
                    setEditDraft(turns[index]?.text ?? LIST_PROMPT);
                  }
                }}
                editComposer={editComposer}
              />
              {hero ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "24px 16px",
                    pointerEvents: "none",
                  }}
                >
                  <div style={{ width: "100%", maxWidth: 560, pointerEvents: "auto" }}>{cluster}</div>
                </div>
              ) : (
                <div style={{ padding: "0 8px 8px" }}>{cluster}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Stack>
  );
}

function ActiveConversationPane() {
  const theme = useHostTheme();
  const [connected] = useCanvasState("connected", true);
  const [draft, setDraft] = useCanvasState("activeDraft", "");
  const [agent, setAgent] = useCanvasState("agent", "coder");
  const [model, setModel] = useCanvasState("model", "grok");
  const [permission, setPermission] = useCanvasState("permission", "permit");
  const [tools, setTools] = useCanvasState("tools", "all");
  const [route, setRoute] = useCanvasState("route", "none");
  const [goalOn, setGoalOn] = useCanvasState("activeGoalOn", false);
  const [menu, setMenu] = useCanvasState<MenuId>("activeMenu", "none");
  const [turns, setTurns] = useCanvasState<Turn[]>("activeTurns", SAMPLE_ACTIVE_TURNS);
  const [editingIndex, setEditingIndex] = useCanvasState("listEditingIndex", -1);
  const [editDraft, setEditDraft] = useCanvasState("listTimelineDraft", LIST_PROMPT);
  const [queueOpen, setQueueOpen] = useCanvasState("activeQueueOpen", true);
  const [taskOpen, setTaskOpen] = useCanvasState("activeTaskOpen", false);
  const [taskItems] = useCanvasState("activeTaskItems", SAMPLE_TASKS);
  const [queueItems, setQueueItems] = useCanvasState("activeQueueItems", SAMPLE_QUEUE);
  const [queueEditingId, setQueueEditingId] = useCanvasState("activeQueueEditingId", "q2");
  const [queueDraft, setQueueDraft] = useCanvasState("activeQueueDraft", LIST_PROMPT);
  const [voiceClips, setVoiceClips] = useCanvasState<VoiceClip[]>("activeVoiceClips", SAMPLE_VOICE);
  const [voicePhrase, setVoicePhrase] = useCanvasState("activeVoicePhrase", 1);

  const send = () => {
    const text = draft.trim();
    if (!text || model === "none") {
      return;
    }
    setTurns([...turns, { role: "user", text }]);
    setDraft("");
    setMenu("none");
  };

  const listEditing = editingIndex >= 0;
  const queueItem = queueItems.find((row) => row.id === queueEditingId);
  const setLiveDraft = listEditing ? setEditDraft : queueItem ? setQueueDraft : setDraft;
  const chrome = {
    floating: false as const,
    agent,
    model,
    permission,
    tools,
    route,
    goalOn,
    onAgent: setAgent,
    onModel: setModel,
    onPermission: setPermission,
    onTools: setTools,
    onRoute: setRoute,
    onGoal: setGoalOn,
    menu,
    onMenu: setMenu,
    onVoice: () =>
      beginOrFinishVoice(voiceClips, setVoiceClips, setLiveDraft, voicePhrase, setVoicePhrase),
    voiceRecording: voiceClips.some((clip) => clip.status === "recording"),
  };

  return (
    <div
      style={{
        display: "flex",
        border: `1px solid ${theme.stroke.secondary}`,
        borderRadius: 4,
        overflow: "hidden",
        minHeight: 560,
        background: theme.bg.chrome,
      }}
    >
      <Sidebar />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          background: theme.bg.editor,
        }}
      >
        <SessionBar route={route} onRoute={setRoute} showRoute />
        <Timeline
          turns={turns}
          identity={<IdentityRow connected={connected} />}
          cursorUserTurns
          editingIndex={editingIndex}
          onEditUser={(index) => {
            setQueueEditingId("");
            setEditingIndex(index);
            if (index >= 0) {
              setEditDraft(turns[index]?.text ?? LIST_PROMPT);
            }
          }}
          editComposer={
            listEditing ? (
              <Composer
                {...chrome}
                policy="turnEdit"
                onExit={() => setEditingIndex(-1)}
                draft={editDraft}
                onDraft={setEditDraft}
                onSend={() => {
                  setTurns(
                    turns.map((turn, i) => (i === editingIndex ? { ...turn, text: editDraft } : turn)),
                  );
                  setEditingIndex(-1);
                }}
              />
            ) : undefined
          }
        />
        {taskOpen ? (
          <TaskList items={taskItems} onClose={() => setTaskOpen(false)} />
        ) : null}
        {queueOpen ? (
          <QueueList
            items={queueItems}
            editingId={queueEditingId || null}
            onEdit={(id) => {
              const item = queueItems.find((row) => row.id === id);
              setEditingIndex(-1);
              setTaskOpen(false);
              setQueueEditingId(id);
              setQueueDraft(item?.text ?? "");
              setQueueOpen(true);
            }}
            onClose={() => setQueueOpen(false)}
          />
        ) : null}
        <OverlayDock
          showInbox
          showStop
          goalOn={goalOn}
          onGoal={setGoalOn}
          taskOpen={taskOpen}
          queueOpen={queueOpen}
          queueEditing={Boolean(queueEditingId)}
          onTask={() => {
            if (taskOpen) {
              setTaskOpen(false);
              return;
            }
            setQueueOpen(false);
            setQueueEditingId("");
            setTaskOpen(true);
          }}
          onQueue={() => {
            if (queueOpen) {
              setQueueOpen(false);
              return;
            }
            setTaskOpen(false);
            setQueueOpen(true);
          }}
        />
        <VoiceQueue clips={voiceClips} />
        <div style={{ padding: "0 8px 8px" }}>
          {queueItem ? (
            <Composer
              {...chrome}
              policy="queueEdit"
              queueLabel={`${queueItems.findIndex((row) => row.id === queueItem.id) + 1} of ${queueItems.length}`}
              canSubmit={queueDraft !== queueItem.text && queueDraft.trim().length > 0}
              draft={queueDraft}
              onDraft={setQueueDraft}
              onSend={() => {
                setQueueItems(
                  queueItems.map((row) =>
                    row.id === queueItem.id ? { ...row, text: queueDraft } : row,
                  ),
                );
                setQueueEditingId("");
              }}
              onExit={() => {
                setQueueDraft(queueItem.text);
                setQueueEditingId("");
              }}
            />
          ) : listEditing ? null : (
            <Composer
              {...chrome}
              draft={draft}
              onDraft={setDraft}
              onSend={send}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConversationEmptyHero() {
  return (
    <Stack gap={24}>
      <Stack gap={8}>
        <H1>Conversation layout — init vs during</H1>
        <Text tone="secondary">
          Cursor chrome on every composer. Init, During, in-list edit, and queue edit
          all mount the same Composer. List/queue edit XOR the dock — one input at a time.
        </Text>
      </Stack>
      <Callout tone="neutral" title="Demo labels vs vscode icons">
        This canvas is a layout demo. Controls that have a vscode Codicon stay as stand-in
        glyphs here so the map is readable. Product UI reuses workbench IconButton /
        MenuWorkbenchToolBar / ActionBar and Codicon (`add`, `settings-gear` / tune,
        `ellipsis`, `arrowUpCompact` send, template, screen-full maximize). Do not invent
        a second icon set. Named dropdowns (model, permission, agent) stay labeled.
      </Callout>

      <H2>Init — empty session</H2>
      <Text tone="secondary" size="small">
        Quiet canvas. Identity (folder · engine · branch) sits above the card — that is
        chrome, not SessionConfig. Model · Permission · Tools stay on the composer.
        Agent and Route are init-composer only: Agent locks into the session after the
        first send (not SessionBar); Route XOR onto SessionBar. No Task / MessageQueue /
        Goal / Stop overlay.
      </Text>
      <Table
        headers={["Session profile", "Init composer", "Default in this demo"]}
        rows={[
          ["Agent", "Left dropdown after Permission — init composer only", "Locks after first send; system_prompt bound; not SessionBar"],
          ["Model", "Right labeled dropdown", "Grok 4.6 (required before Send)"],
          ["Permission", "Left dropdown · 完全访问", "Permit / ASK / AGENT"],
          ["Tools", "Tune icon · Tool Options popup", "all / readonly scheme"],
          ["Route", "Left dropdown after Agent — init composer only", "XOR to SessionBar after first send; 不路由 · Balanced · Speed · Quality"],
        ]}
      />
      <ConversationPane />

      <H2>During conversation — Active</H2>
      <Text tone="secondary" size="small">
        Identity is one row in the reading column (list header), not SessionBar and not a
        second locked-config line. Agent has locked into the session and left the
        composer — it is not on SessionBar. Route sits on SessionBar. The docked input
        is the same Cursor composer as Init, minus Agent and Route.
        Inbox floats above it. Task sits left of MessageQueue; the two lists XOR.
        Open Queue, click a row to edit that same card; Exit leaves queue-edit.
      </Text>
      <ActiveConversationPane />

      <H2>In-list user turn — display vs edit vs queue</H2>
      <Text tone="secondary" size="small">
        Input layout only. Display is a card with the message text — no buttons. Click the
        card in During to edit; that mounts the same composer. Queue edit also reuses it.
        Voice queue: stop a clip, tap mic again without waiting; transcripts append in order.
      </Text>
      <InListInputSection />
      <Callout tone="neutral" title="Visual vs engine">
        One Cursor composer card for Init, During, in-list edit, and queue edit. Placement
        and Exit/hold change; Route leaves the composer after first send. Queue Exit
        still releases hold. Icons in product reuse vscode Codicon / ActionBar.
      </Callout>

      <Callout tone="info" title="XOR — do not draw both">
        Init: identity above the card, no Goal overlay. Active: identity is a single row
        in the reading column; Inbox floats split left/right above the docked input
        (Task · MessageQueue · Goal | Stop · ctx). Model · Permission · Tools stay on
        the one-row composer. Agent locks after first send and leaves the composer (not
        SessionBar). Route XOR: init composer only, then SessionBar. Bottom chrome is
        one Cursor toolbar row in both.
      </Callout>

      <H3>What moves</H3>
      <Table
        headers={["Surface", "Init (PreFirst)", "During (Active)"]}
        rows={[
          ["Identity (folder · engine · branch)", "Above the centered card", "One row in the reading column"],
          ["Agent profile", "On the init composer, after Permission", "Locked into the session; not SessionBar, not a second locked line"],
          ["Route strategy", "On the init composer, after Agent", "SessionBar action; not on the docked composer"],
          ["Locked SessionConfig", "Not a second line", "Model · Permission · Tools stay on the composer; Agent and Route do not"],
          ["Composer placement", "CenteredHero, same Cursor card", "BottomDocked, same Cursor card"],
          ["In-list user input", "N/A (no turns yet)", "Text-only user card; click it to mount the same composer + Exit"],
          ["Queue item edit", "Absent", "Same composer + Exit; circular send saves; not a second input"],
          ["Process fold / tools", "Absent", "Span overlay in the list, not a dock row"],
          ["Inbox / Goal dock", "Hidden (PreFirst, no Status overlay)", "Left Task·MessageQueue·Goal · Right Stop·ctx; independent floats, no shared bar"],
          ["Voice queue", "Mic available on PreFirst composer", "Above docked composer; independent from Inbox MessageQueue"],
          ["SessionConfig", "Agent · Model · Permission · Tools · Route on input", "Model · Permission · Tools stay; Agent locks away; Route → SessionBar"],
          ["Bottom chrome", "Always one row", "Always one row"],
        ]}
      />

      <H2>Function map — nothing dropped</H2>
      <Table
        headers={["Singularity control", "Where in this demo", "Notes"]}
        rows={[
          ["Multiline input + @ /", "Card body + placeholder", "Slash and mention are input, not extra chrome"],
          ["+ Add menu", "Left · 32px soft circle", "Same height as Send; light fill, no border. Product: Codicon.add"],
          ["Tune / Tool Options", "Left · 32px ghost icon", "No background; same hit height as + / Send"],
          ["Task", "Absent on init", "Leftmost Inbox chip, left of MessageQueue; opens auto_drive_task list; XOR with Queue"],
          ["MessageQueue", "Absent on init", "Inbox chip after Task, before Goal; opens queue list; row click holds item for edit"],
          ["Goal", "Absent on init", "Left Inbox icon after MessageQueue; never on the composer row"],
          ["Queue edit Exit", "Absent", "Close on the same composer card; release hold, restore compose"],
          ["Stop / ctx ring", "Absent on init", "Right Inbox; Stop only in-flight; ctx is a ring not a chip"],
          ["Permission ASK/AGENT/PERMIT", "Left · 32px ghost dropdown", "No chip fill; same row height as + / Send"],
          ["Agent profile", "Init: composer after Permission · Active: gone", "Locks with first send; system_prompt bound; not SessionBar"],
          ["Route strategy", "Init: composer after Agent · Active: SessionBar", "XOR — never on both; Desktop SessionBar owns History/Route"],
          ["More ⋯", "Left overflow · 32px ghost", "Display, pin/unpin only — Route is no longer buried here"],
          ["Model profile", "Right · 32px ghost dropdown", "Labeled; no chip fill; Send disabled until chosen"],
          ["Templates", "Right · 32px ghost", "One-shot wrap, not a send"],
          ["Voice input", "Mic left of Send · 32px ghost", "No background until recording; then filled like Send"],
          ["Voice queue", "Above composer while clips are live", "Recording + transcribing in parallel; text concatenates into the input"],
          ["Input Maximize", "Right, before voice · 32px ghost", "Hides Inbox floats; not a second chrome row"],
          ["Send", "32px filled circle", "Only control with a solid disc; queue-edit uses it as Save"],
          ["In-list edit chrome", "Absent", "Same composer + Exit; not a nested snippet editor"],
          ["Folder · Engine · Branch", "Init: above card · Active: list header", "XOR; never SessionBar, never the input toolbar"],
        ]}
      />

      <H2>Style can change — these cannot</H2>
      <Stack gap={6}>
        <Text size="small" tone="secondary">
          Do not flatten this into a SessionConfig 2×2 card, do not move Model left of +,
          and do not put identity on SessionBar or the Active input. Agent is init-only
          and locks into the session — not SessionBar. Route is init-composer XOR
          SessionBar — never both. Voice sits immediately left of Send. Bottom-row
          controls share one 32px height: + is a soft disc, mic and labels are ghost, only
          Send is filled. Inbox floats split left/right with no shared background bar:
          Task sits left of MessageQueue, then Goal; lists XOR, never fused into one chip.
          Voice queue is transcription, not MessageQueue. Demo glyphs are stand-ins;
          product icons reuse vscode Codicon / ActionBar.
        </Text>
        <Divider />
        <Text size="small" tone="tertiary">
          Init pane: type and Send to watch the transition. During pane already has a live timeline.
        </Text>
      </Stack>
    </Stack>
  );
}
