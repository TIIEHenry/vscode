---
title: "Sources Accept 读后授权：accepted 方案接入证明"
type: progress
status: active
phase: M7
updated: 2026-10-27
summary: "精确5c0916b accepted方案真实双亲合入a2f1430；8路径与全树保留，254+额外2 pair及12554文件/2946目录冻结守卫；仅文档接入，无运行或out释放。"
---

# Sources Accept 读后授权：accepted 方案接入证明

[已签收方案](../plans/sources-accept-post-read-authorization.md) · [作者与规则16原记录](sources-accept-post-read-authorization-checkpoint.md) · [原字节证明](sources-accept-post-read-authorization-integration-proof.json) · [文档门禁实测](sources-accept-post-read-authorization-integration-docs-validation.json)

## 接入身份与实际保留

root 只授权接入不可变 `5c0916b71070c5f75742fcbd831cd8c31be0bd34`；其 parent 为独立 draft `4b0d3d62e65e54e71d3b1748f100fac7ca5f6ce3`。从 clean `c7fefd780bd9720f3889e310d4706210189a3fc7` 实际执行 `git merge --no-ff --no-edit`，exit 0，生成 `a2f1430e446b82181e0f456942fb84d9d310e6ac`，两个 parent 精确为 c7 与 5c0916b。没有冲突或 hunk resolution。

父级随后独立实核两 parent、8 条 incoming changed paths，以及 merge tree = incoming tree = `589548888fd3fd42e2f4125747b330532f1d883f` / src a2c。该项是 root 工具回传的摘要，没有另造 raw log。

按实际 merge-base c7 求 changed union，只有下列 8 路径；逐项 mode/type/blob 和完整 43,725 bytes binary diff 均精确等 incoming。合并树的 22,247 个 tracked mode/type/blob 条目全部等于 incoming；union 以外 22,239 条旧路径保持。accepted plan 原 bytes SHA-256 为 `5d5c2a72fcb9d555b15d0442d0c7d47ae9238998cea2eb25b4b7917af8362e61`。

- `dev/parallel/INDEX.md`
- `dev/parallel/active/sources-accept-post-read-authorization.md`
- `dev/plans/INDEX.md`
- `dev/plans/sources-accept-post-read-authorization.md`
- `dev/progress/INDEX.md`
- `dev/progress/sources-accept-post-read-authorization-checkpoint.md`
- `dev/progress/sources-accept-post-read-authorization-dispatch-checkpoint.json`
- `dev/progress/status.md`

本证明是之后独立的 docs commit：新增本页、proof JSON、审计脚本与文档门禁 JSON，只在 progress INDEX 增加入口、status 原首条同一行追加本页链接。它不改变上述真实 merge 树的 8 路径精确结论。accepted plan、作者 checkpoint、dispatch JSON 与其他 incoming 路径仍逐字保持；原 accepted status 首条完整保存于下节。

## 冻结与证据边界

在 `/tmp/vscode-compile.lock` 下，合并前与合并后实核：254 份既有 source/native/mode/blob 对、额外 controller / Pane.test 的 2 对原字节与 mode、12,554 个 out 文件和 2,946 个 out 目录的全 metadata、四份 v4 freeze 原件及三条原 cache symlink 均精确相同。额外两对仅为当前 bytes 保留，不授予既有 scoped253/254 中不存在的生产者 credit。全局 competing compiler/watch 扫描在取锁前与锁内均为零。

`src` 仍为 `a2c34649ee88df907c03b70c9ec3235cb1b4a9d9`。历史 v4 继续指向其原 `7ffe4d9869a0caea76bab537d8d49f08e0776ecd` 身份，252 compile10 + 2 fresh 的混合来源和 `fullCompileOfFinalSourceTree=false` 不变；文档新 HEAD 不替换历史 sourceHead。没有编译、checker、transpile、业务测试、Electron/UI/fake 启动、out/freeze/cache 写入或 cache 迁移。

方案 C0/I0/M2 与两 Minor 采纳仅是静态签收；本 scope 的新源码、A1 双宿主业务旧红、A2 成功正控、新绿与完整相关 suites 均不由本次文档接入证明。D 的源码实施另轨推进，本 lane 仍唯一且等待明确 candidate/output release。历史 314/3、317/0、J425 连续性等原结论不重跑、不改写，也不转作本 scope 运行证据。D1387 closed、旧两窄 plan implemented、PRD/宽 Sources 的既定状态全部保持；overall goal active。

[审计脚本](sources-accept-post-read-authorization-integration-audit.py)保留实际命令与采样方法；以下只读复核使用仓库内持久化的原采样，不依赖临时日志：

```bash
rtk proxy python3 dev/progress/sources-accept-post-read-authorization-integration-audit.py guard dev/progress/sources-accept-post-read-authorization-integration-proof.json
```

## 文档门禁

实际状态生成 exit 0 且未改任何 tracked 内容；生成状态 `--check` exit 0。docs health 实查 600 Markdown、0 errors / 46 warnings，全部 warning 明细与前次 R3 原件完全相同；diff-check exit 0，status 200 行。原始 stdout/stderr、命令及冻结复核结果保存在上方文档门禁 JSON。

## accepted status 原首条逐字保留

来源：真实合并提交 `a2f1430e446b82181e0f456942fb84d9d310e6ac:dev/progress/status.md`。含末尾换行的 SHA-256 为 `53b417f9b4f95c19cf11d6bd120ee9687bb3e4115f5198a09ba28674b39182c7`；本次只在当前首条同一行末尾追加集成链接，保持总行数 200，其余 status 原文不动。

```markdown
- **Sources Accept 读后写前授权方案签收（2026-10-27）**：原draft4b0d3d经父逐路径核验与Astra规则16 C0/I0/M2，input独立销毁/统一UI存活门、catalog Session/List与Git Changes read-failed分控两Minor已实改，[方案accepted](../plans/sources-accept-post-read-authorization.md)；只签方案，未实施/运行，srca2c/out冻结、baseline唯一lane。旧R3/draft首条均[逐字保留](sources-accept-post-read-authorization-checkpoint.md)，D1387/旧plan/PRD保持，lease/local notice后续候选。
```
