---
title: "D1386 叶级身份条源码检查点"
type: reference
status: active
phase: M7
updated: 2026-10-26
summary: "仅源码与静态证据；未运行单测/编译/界面，accepted/open 等待 merge red/green 与独立 after。"
---

# D1386 叶级身份条源码检查点

方案：[Conversation 叶级会话工作根身份条](../../plans/2026-10-26-leaf-session-root-identity.md)，方案 commit `ab142cd`，基线 `5cc987d8ea50ca73af88452a0164386889587988`。D 工位最初 `c6ef5346127` clean，核对祖先关系后仅 ff，保留 `.build/d1382-independent-after`。未改人类/C/J/merge 工位。

## 实际 diff

- `conversationLensReadingColumn.ts` 传原始 bound id；`conversationLens.ts` 重绑同步刷新。
- `conversationIdentityStrip.ts` 用单一解析入口、根代次、菜单请求代次；非活动 `onDidChangeSession`、workspace/SCM/HEAD/connection 刷新；文本/title/aria/readGitSummary/当前项/checkout 同叶；旧菜单 delegate 与晚响应失效；只接受绘制时同一 offer 对象/URI 快照与当前根。
- `conversationIdentityStrip.test.ts` 新增 11 条 D1386 公共行为：真实 Lens DOM + `AgentSessionContext`，checkout recorder，无真实 git checkout；包括两叶不同根、非活动更新、local/engine/none/兼容宿主、根/绑定代次、refs/recents、offer 替换、销毁重建。聚焦后 click 不代表已执行 Enter/Space。
- 未改 Sources、ReviewNav、Preview、mount model/贡献/信任、协议、`src/vs/sessions`。未顺手修 `1 files` Minor。

## 本工位实际验证

- 独立规则16正式方案 peer：C0/I0；状态顺序 Minor 已随 accepted 对齐。
- 独立实施只读 peer：C0/I0；新增 checkout 宽 cast Minor 已改正式 recorder 字段；键盘留独立 after。
- 四个改动 TS：ESLint exit 0，0 errors / 0 warnings。
- `git diff --check` exit 0。
- `generate-docs-status.py --check` exit 0（generated status: OK）。`check-docs-health.py` exit 0，544 markdown，0 errors / 46 links warnings；新方案和本证据未新增断链。不把脚本检查当行为验证。

## merge 必须完成的验证

1. 固定旧三生产 JS 的身份为 `5cc987d8` 源码的既有产物（先核摘要），只更新 fresh 测试。`conversationIdentityStrip.test` 新增 grep `D1386` 取真实 red；逐条记录行为失败/提前失败/未跑，不能仅统计退出码。旧测试也需完整回归。
2. 只刷新三生产文件到本刀源码，跑新增 grep、完整 IdentityStrip 套与 Lens 绑定相关用例；四 TS 定向语义和 ESLint，必要编译仅 merge 负责。运行依赖 out 的单测 D 未执行。
3. 独立非作者默认编辑器 after：真实两叶 A/B 不同 local/engine 根，活动/非活动身份/菜单归属、非活动 workDir、workspace/SCM/connection、绑定与隐藏恢复、stale offer、鼠标与实际 Enter/Space/Tab/Esc、checkout 命令参数；浅/深/高对比、窄叶截图 + DOM。只用隔离 fixture/command spy，无用户仓库 checkout。

本工位禁止编译/typecheck/transpile/out 写入，未运行单测、未新启动 Electron、未做本刀实拍、未连接真实引擎写操作。当前仅可称源码已写；plan accepted / D1386 open，不升 PRD。
