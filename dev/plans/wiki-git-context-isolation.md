---
title: "Wiki Git 主仓与外仓上下文隔离"
type: plan
status: implemented
phase: N/A
created: 2026-11-02
updated: 2026-11-02
summary: "承接 D 的窄修，统一 Git 子进程上下文，保留真实暂存索引并隔离子仓、嵌套与 verify 命令。"
---

# Wiki Git 主仓与外仓上下文隔离
状态：已完成。负责：agent:codex。范围：D1394 本地代码与自动层；完整18项真实Git矩阵、文档门与综合OV已通过，主题本地提交后仍待产品分支集成。

覆盖需求：无（仓库文档工具正确性与提交工作流维护）。

## 1. 证据、已有候选与范围

[D1394](../progress/deferred-gaps.md) 真实提交钩子继承主 worktree 的 GIT_DIR 等定位环境，子模块 `git -C` 因而仍读取父仓，staged check 误报 28 条链接。普通工作区 check 绿不能证明 staged 绿；现有仓外 wrapper 保留 absolute index 才使原 hooks 完整通过，不能长期依靠它。

新波集成基线 `0ac6a61fe86087ed5fa690764ae98178239276b0` 已验证 source 与 `51e790607b0` compile 绿相同。D 候选 `9d4719459aa6a4cf1ceec7c394dca8f3068606f6` 已窄修三个 foreign 调用点并带四项测试，但不覆盖完整残余合同。B 在编码前先真三路 merge 此原 commit，保留其身份与有效修复；文档逐段保双方意图，旧槽快照不能覆盖 D1393 或本波。不得复制 C 整树；C 不含 f370 全链修复且有其他 WIP。

生产主要 `scripts/wiki/wiki.py`；扩充既有 `scripts/tests/test_wiki_git_environment.py`，知识入口 `scripts/wiki/README.md` 与 `scripts/wiki/reference.md`。不改 dev/loop、全局 Git 配置、用户钩子或忽略真实 index 来绕过检查。

## 2. 单一 Git 子进程入口

建立返回 CompletedProcess 的统一低级 runner，保留 input bytes、returncode、stdout/stderr；run_git 继续承担原 bytes/业务异常包装。统一现五处绕过封装的 Git 调用：Snapshot HEAD probe、head_baseline、has_head、message_trailers、hook_status，并承接 git_text/git_state 等调用。保留合法 unborn、baseline 缺文件 None、non-Git 工作目录、0/1 返回码与 trailers stdin bytes 的既有语义，不把所有非零状态一律升级硬错误。foreign 的局部变量清单发现或必需身份探测失败必须显式报告，不能静默 fallback 带污染环境。hook_status 必须按实际 effective core.hooksPath 的 Git 语义解析相对/绝对路径，支持 gitfile worktree 与 selected-root，不能只检查默认 .git/hooks；验证报告 HEAD/dirty 同样来自 primary 及真实 alternate index。

上下文显式分 primary 与 foreign，不靠“目录位于 root 内”判断同仓：submodule/nested repository 和另一 linked worktree 即使 common-dir 相同也属于 foreign。Snapshot 先捕获调用入口的 primary 环境、原 cwd 及实际主 worktree 身份，再以清局部环境的 probe 核定选定 root 的规范 Git-dir 与 top-level。普通 subdir 若仍同一 primary worktree，保留真实 alternate index；root 直接指 child/独立 nested/另一 linked worktree 时必须 foreign，不能被 inherited parent GIT_DIR 吸回父仓。分类完成后才作 HEAD/ls-files/tree/blob 读取。继承路径型 GIT_DIR/GIT_WORK_TREE/GIT_COMMON_DIR/GIT_INDEX_FILE 按原 cwd 规范成绝对值。上下文缓存同时绑定捕获环境与真实仓库身份，不能只以 root 字符串缓存或比较 common-dir。

foreign 从捕获环境副本移除 Git `--local-env-vars` 的仓库局部集合，包括 INDEX/OBJECT_DIRECTORY/ALTERNATE_OBJECT_DIRECTORIES/SHALLOW/replace/config/prefix 等；GIT_CONFIG_COUNT 与编号 KEY/VALUE 必须成组处理，不能只删 COUNT 或残留编号值。保留 PATH、HOME、locale、SSH 等非仓库环境，不修改 os.environ。只对具有单一路径语义的变量按原解析基准规范路径；GIT_ALTERNATE_OBJECT_DIRECTORIES 等多路径、带引用/转义值必须遵循 Git 语义，禁止把整串无差别 abspath。Git 局部变量清单与身份探测按捕获上下文缓存，不全局缓存环境；发现失败显式报错，不带污染环境回退。

## 3. 固定 Snapshot 与错误诚实

root repository 身份先按第2节无污染 probe 分类，不能无条件把传入 root 当 primary；同 primary 的 root ls-files/HEAD/ls-tree/blob 才继承其真实 index，foreign root 用隔离上下文。gitlink 展开以及 blob_roots/head_blob_roots 标识的 child/nested ls-tree 与 cat-file 显式 foreign；始终读取父 index/HEAD 捕获的固定 oid，不借 child 当前 HEAD/index/worktree 字节。selected-root 已剥 prefix 的相对 gitlink 路径应从 self.root/name 定位，不能错用 self.repository/name。

现 [reference 暂存检查](../../scripts/wiki/reference.md#暂存检查) 明文规定“子模块未检出或提交不在本地均保持 gitlink、内部链接算断链”。本方案有意收紧其中已初始化但 pin 不可读的分支，不能声称旧规范本已要求硬错误：

| Gitlink 状态 | 新合同 |
| --- | --- |
| 未初始化/未 checkout | 保留旧 gitlink 记录，内部链接仍按既有合同处理 |
| 已有 child repository 但固定 pin 缺失或不可读 | 报精确 child 路径与固定 oid，经现 CLI WikiError 转 incomplete/input-unavailable/exit 2；不吞成未 checkout、不退到当前 HEAD/工作区 |
| index 冲突或必需 root 输入不可读 | 保持原诚实失败，不 fallback |

实现同主题必须同步 reference 的该段规范，避免只改代码使工具文档失真。

## 4. Verify 命令环境覆盖合同

verify_report 会运行任意配置命令，不应仅按 argv[0] 是否 git 判断，因为脚本内部也可调用 Git。先用清 repo-local env 的只读 rev-parse 探测 command cwd 身份，以规范化 worktree Git-dir 加 top-level 确认同一 worktree，不能只比 common-dir，再由显式上下文构造子进程环境。真正 non-Git cwd 的普通命令仍可运行，但清 inherited repo-local；损坏配置或探测失败不能伪装成 non-Git。

这是对现有 verify 直接继承工具进程环境并 overlay command.env 的规范收紧，必须同步 reference 的 verify 说明和覆盖表；不能声称旧规范本已隔离。

| 命令 cwd/显式 env | 继承环境处理 | 显式覆盖 |
| --- | --- | --- |
| selected root 或普通子目录，解析为同一 primary worktree 的 Git-dir 与 worktree identity | 保留已绝对化的真实 hook/alternate index | 普通 command.env 最后覆盖 |
| submodule/nested repo/另一个 linked worktree | 清父仓局部变量整组，保普通环境 | command.env 最后覆盖，不能仅凭 shared common-dir 认 primary |
| 显式 DIR/WORK_TREE/COMMON_DIR 等定位变量意图切换 Git 上下文 | 先清 inherited 定位/index/object 等 repo-local 整组，不混 parent INDEX 与 child DIR | 再应用显式组；相对显式路径按 command cwd |
| 已确认 primary 且仅显式 GIT_INDEX_FILE | 保留主仓其余合法环境 | 尊重其 alternate index，不自动判 foreign |
| command.env 显式 config COUNT/编号 KEY/VALUE | 按完整配置组覆盖；若影响定位，清旧定位组并重做身份分类 | 编号和 COUNT 一致，不混入 inherited 半组；普通 env 最后 overlay |
| 普通 non-Git cwd | 清 inherited repo-local，普通命令可执行 | 显式配置仍优先，配置错误不能掩为 non-Git |

继承相对路径按工具原启动 cwd 解释，用户显式路径按 command cwd 解释；不改用户配置，不偷偷清其显式 env。完整设计合同和正式本文规则16修订后均获 Astra C0/I0/M0；不能先整体清空 verify 环境再称兼容。

## 5. 四步实施

1. B 真三路接入 9d471 原窄修，核双方意图与固定源码差异；用真实临时 Git 仓锁定主仓 alternate-index 和 foreign pin 行为，原失败与复现保留。
2. 统一 primary/foreign runner 与环境捕获，归口 raw Git，补 selected-root/nested 固定 oid 及诚实 input-unavailable；原 0/1/None 语义保持。
3. 依表落实 verify cwd 身份探测、显式覆盖与 per-context 缓存，补真实 hooks 正常/alternate index commit，不用 mock subprocess 或仅断言 env 字典代替业务效果。
4. 唯一验证者串行执行该 Python 工具测试、文档健康、wiki working/staged checks 和原 hooks；非作者 OV，代码/测试/知识/status 同主题提交，双域终态后集成。D1394 有完整证据后才关闭，D 候选四项测试不充当整个合同通过。

## 6. 真实回归矩阵与 DoD

临时 parent + child + nested child 与 worktree A 使用真实 `.git` 文件/目录和固定 gitlink。父 HEAD、默认 index、absolute alternate index、dirty worktree 各用可区分文本；child pin1、当前 HEAD/index/worktree pin2/dirty：

- primary staged 只读真实 alternate blob，dirty worktree 的相反内容不影响；alternate 好/default 坏必须通过，alternate 坏/default 好必须失败，证明未丢 index。相对 DIR/WORK_TREE/COMMON_DIR/INDEX 以原调用 cwd 解析，multi-path 引用/转义与 config 组按 Git 语义校验。
- 直接 `Snapshot(root=child)` 或 `Snapshot(root=另一 linked worktree)` 继承 parent DIR/INDEX 时仍读取该 foreign root 的真实对象/index；普通 primary subdir 对照保留父 alternate index。foreign 即使继承父 DIR/INDEX/OBJECT 等仍读固定 child pin1，nested 与 selected-root 子树正确；root added_files/head_read 与对象/index 前后不变。
- 未 checkout 与已初始化缺 pin 分别符合新旧合同，错误含 child path+oid，无 workspace fallback。
- unborn/HEAD、head_baseline、trailers bytes 保持业务语义；hook_status 在相对/绝对 core.hooksPath、gitfile、selected-root 场景反映实际 hook；report HEAD/dirty 保持 primary/alternate-index。
- verify 在 primary/subdir/child/另一个 linked worktree/non-Git cwd 的真实 Git 行为符合表；普通 env、显式 selection、primary 单独 INDEX、相对路径、COUNT/KEY/VALUE 组与配置错误分别验证。foreign 名单发现失败必须报 unavailable，不假装无仓库或回退。
- 安装原 pre-commit/commit-msg 到临时 worktree，正常与 alternate-index 两路真实 commit 无 wrapper 通过，好 index 的提交树等于真实 index，坏 alternate 即使默认 index 正常也被真实 hook 拒绝；父默认 index、child HEAD/dirty、dev/loop/config/global hooks 前后不变。保留 D 9d471 原四例和历史，新增完整组合证据另行记录。

所有检查只经 integration 唯一通道，开发者不自跑并发检查。命令、固定输入、hash、退出码及限制写[本波看板](../parallel/active/tools-wiki-wave-2026-11-02.md)。本工具主题无用户产品界面变化，不借此升任何产品 PRD 验收。

## 7. 审查门

规则16已经执行：Astra 首轮 C0/I1/M0 指出 root 不能直接认 primary；integration 改入调用入口捕获、clean probe 真实 root 身份及直接 child/另一 worktree 对照回归。固定修订正文 513e312… 获 Astra C0/I0/M0 APPROVED，父调度完整采纳。本文 accepted 不代表 D1394 已关闭；方案独立提交后才准 B 真三路承接 9d471 并实施残余，仍需完整工具回归与独立 OV。

## 8. 实施证据与待收尾

B 真三路保留原 D `9d4719459aa` 为 `db36339ae0f` 后实施。最终候选 wiki.py SHA256 `cfb50ec4c2db10fd292012dc1cece43df43f493918fd46e6e09f8c98023f206a`、测试 `d46c361d233cb7bb691d117405202cd5a5340d178703fe468cd117efacd6fc3b`，唯一通道完整 18 方法运行 exit 0，含临时真实 hooks/alternate index 提交、child HEAD/index/dirty 前后不变、CLI 后项非法 env 时首项 sentinel 不执行。首轮 15/17 与两项窄诊断失败保留，config 身份期待经 Astra 按原生 Git 对照修正，non-Git fixture 显式证明外部目录不可发现父仓，不放宽生产语义。

全选中命令先环境预检再任何 exec 的必要增量及点名测试、explicit missing baseline 路径与 linked child 不变证明已纳入候选；reference 同主题承认缺 pin 和 verify 环境的两项规范收紧。运行原件在仓外 `.coordination-20261102/newwave-b-full-matrix-3.log/.exit`；本波看板记录完整前序。Astra 综合 OV PASS C0/I0/M1、CommitGate READY，父调度采纳；唯一 Minor 已将 reference 报告 HEAD/dirty 改为 selected root 实际所属仓库、primary 时保真实 alternate index。18 项真实矩阵、文档门通过，D1394 本地代码/自动层关闭，本文 implemented 仅表示此工具主题，未声称已合入产品分支。原 hooks 在主题提交时正常执行，不用 wrapper。
