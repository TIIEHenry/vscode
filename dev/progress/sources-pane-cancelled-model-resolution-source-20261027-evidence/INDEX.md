---
title: "Sources Pane 首 await 取消解析源码候选"
type: progress
status: draft
phase: M7
updated: 2026-10-27
summary: "固定df44仅四行首await guard与10项真实resolver回归源码；各一次parse0/一次双TS无缓存lint0，旧test/D代码与J本地metadata保留；源码peer及运行待。"
---

# Sources Pane 首 await 取消解析源码候选

root 已独核采纳 D→J 集成 `df44ca0fb53f96898d5b3052ea68ecfa272da681` / src `7ab5d7221e63e8acda88bab4c36e28d063f06b7e`，再授权本窄源码切片；本轮重新核 J clean 后开始。本页所在单亲 commit 为固定 source candidate，先交 root 独核，再交原 Astra 源码 peer。[方案](../../plans/sources-pane-cancelled-model-resolution.md)仍 **accepted / runtime pending**；未执行 compiler/checker/Program、transpile/emit、业务测试、UI/引擎或运行准备，不把新增源码计为旧 red/新 green。

## Included 与 Excluded

Included：Pane 生产文件、同文件测试必要 imports/独立 nested suite，以及本方案、方案/进度索引、status、当前看板、工位池和本证据目录，在同一 scoped commit 交付。[文件清单](included-inventory.json)记录每个其他 Included 文件的 bytes/SHA；清单自身由最终交付 SHA 与 parent 复核，避免自引用。

Excluded：Panel、provider/引擎、lease/Reveal、modified-only、setInput 外层检查与事件、D 的 runGitAction 与全部原测试/114 静态矩阵、其他方案设计；不触及 D/E/main/merge、共享 out/cache、冻结 prep2 或外部绑定输入。lease 唯一 lane 优先与独立 after 合同、已完成四窄 Sources 范围保持。

## 源码与最小逆向

生产仅在 original await 后增加完整 `_store/input/token/generation` 失效检查；失效时只释放该局部 original 并 return false，停止申请 modified。第二 await/check/catch/install 保持。实际后果边界是停止多余解析与局部引用/旧 setInput 收束拖延，已有旧代码仍会最终清理与阻止陈旧安装，不称永久泄漏或陈旧画面必然覆盖。

| 文件 | Candidate bytes | SHA-256 |
| --- | ---: | --- |
| `conversationDiffReviewPane.ts` | 34927 | `f47c6edfb62dc6a5563c8cc7282c1f7f763ab835c0a3851d74336074c2d97985` |
| `conversationDiffReviewPane.test.ts` | 49388 | `33fa30838cd665787e1ee5700a7c347f5a5a34d1323a59832cb5c480f32f4956` |

[最小生产逆向 patch](minimal-production-inverse.patch)仅移除四行 guard，可还原整个 df44 生产文件。[完整保留证明](source-preservation.json)还记录：删除唯一新增 suite、CancellationTokenSource specifier 与新 load-signal import 后，**整个**测试文件恢复 df44 且等于 D22d；旧 factory/Accept/D suite 全字节不变。两 host 的 runGitAction 同时等于 df44/D22d；Panel 两整文件、Reveal 整测试分别 byte-exact。方案 §1–§4 为 10665B / SHA `a6db032762368957042ccdf3d015adac0723ef24b552410ef82eea591862bb89`，正文完整保留。

## 10 项源码合同

唯一新增 nested suite `Cancelled original model resolution`，静态展开 **4×2+2=10**：clearInput/dispose/replacement/token-only × original late success/reject；当前正常双 ref；当前 modified provider reject。

真实 TextModelResolverService 经薄包装记录请求与成功 ref 的转发 dispose；注册独有 scheme 的真实 provider，以 started/release Deferred 控制解析，真实 IModelService 创建模型，不 keeper-pin refs。失效前先到 original provider；late completion 后由旧操作完成与 modified-started 竞争给出确定性业务判据。replacement 先装好 successor 并保留控件/模型身份、内容、refs 与准确 load 事件；token-only 只取消同 input 的 token。公开 editor service/模型 URI、resource/generation 事件和释放计数参与断言；finally 放开所有自有门、等待已启动操作、清理控件/provider/监听，保留原 leak tracker。以上均是**未运行源码**，未宣称 fixture 资格或实际释放结果。

## 一次性源码门禁与 metadata

[源码验证原输出](validation-results.json)：恰好两个 createSourceFile 调用，各 parseDiagnostics=[] / exit0；恰好一次双 TS `--no-cache --no-fix` ESLint exit0/stdout与stderr空。`NODE_DISABLE_COMPILE_CACHE=1`，子环境移除 NODE_COMPILE_CACHE；没有 Program/checker/transpile/emit、语义或业务信用。后续源码未改，不重复本门禁。

[前 metadata](protected-metadata-before.json.gz)与[后 metadata](protected-metadata-after.json.gz)是可无损解压的 JSON，覆盖 J 本地 lstat 15250 项：out 14995、.build 249、node_modules symlink 1 与五个缺失根。含 mode/size/mtime/ctime/device/inode，排除 atime，不跟随 symlink；**不证明共享 symlink 目标或外部/冻结输入 metadata**。[比较结果](protected-metadata-comparison.json)记录前后差异；本轮没有写那些外部范围。这里的源码 Node 读取不是独占运行 lane。

[文档门禁](documentation-gates.json)另存 docs health 与 git diff-check 的真实 stdout/stderr/exit。方案 frontmatter 仍 accepted，生成状态列未改变，无须生成器状态翻转；索引描述与行动层已同步，status 保持 200 行，原 board 完整前缀保留。知识层设计未变，无需同步产品需求/规格。源码 peer、匹配产物与旧 red/新 green/必要完整 Pane 运行由 root 另授，作者交固定 SHA 后停止；不 push 或自行合回。
