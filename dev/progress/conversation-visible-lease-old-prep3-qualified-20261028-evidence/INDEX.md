---
title: "Conversation lease：old prep3 业务红及完整恢复接收"
type: reference
status: accepted
phase: N/A
updated: 2026-10-28
summary: "old prep3唯一driver0/official1达676合格业务红，双target恢复及原保护获root/原AstraC0/I0接收；new40/238与独立默认editor after待。"
---

# Old prep3 业务红及完整恢复接收

本次基于 merge `64934a7772b667c6a3aba9739fc4f935b5aeb115`、src `3dc1205763451e60e70c1a8a84465613990aa526`，只出版事实证据与文档。[主lease §12.12](../../plans/conversation-visible-lease-recovery.md#1212-old-prep3合格业务红与完整恢复root接收2026-10-28)保原79487B前缀和规范；方案仍accepted。runtime13份工具来自固定已出版`5f36ed8809300700cfebf9c140d3e938327c024b`，不从当前工作区隐式取源。原v3 source、prep2失败、I static-only与8033原whole.build FAILED保持。

唯一driver于UTC2026-10-27 21:15:22.224548至21:17:19.763300运行，actual0；六阶段`[0,0,0,0,0,1]`，official actual1。meta过1/L1败1/pending0，实际主断言`catalog ready must restore this visible Pane lease without hide/reveal`，独立VLQ将generated645:14映射固定Reveal676:11；10/10hook，无hook失败或watchdog，lint0errors/4warnings完整保留。driver0只表示记账完整；本次接受businessOldRedQualified=true，失败体不称leak-clean。

Pane42101B/SHA`74b65707aa69404258e9d3b759f93b5808b21ec4a311e1af953132d5c7729629`、Reveal254747B/SHA`dbbfdd84f16399d877f67e736204ba60fc7df71b63273bb2ba2218bb8001a9ea`均自然scriptParsed/getScriptSource，runtime=disk=sealed dry=独立emit。1130loaded和10038manifest-only分列；permit/WAL/各一次out-hook独核，qualified2/union2/restore2/partial0。两target bytes/mode/mtime全复，仅两qualifiedctime差异；12 named/6 poststage/2 poststream guards合格，原4169与所列3281哈希、context119095/external27318/七shared79021精确，未重hash完整5GB闭包。postrun903项/686regular/727069378B，436pins保持。41个PID/start身份quiet、X117 socket/lock消失与两锁unheld/无open FD仅指已接受post-exit采样。

[review/root归因](review-and-root-attribution.json)明确原Astrawhole和outcome均C0/I0/M0由root独核接收，摘要不是原消息raw。固定root receipt12294B/SHA`a5b51b306dcccea9c890dfae652c61f8f4804f4a67b06718ce416eb9b562f13b`及seal1470B/SHA`6a69898edfd237e6b79128f689f504df11069c716abf988a4485a1b5beefef8d`在归档`old-review/root-acceptance-20261027T213134141361Z/`；root再次核验后采用该固定receipt。P和完整D随后封口，不在P补success文件、不重跑consumed包。

## 完整归档与精确metadata

[完整独立tar.gz](old-prep3-accepted-complete-closure.tar.gz)为64360420B，SHA-256`60fc34c0005ed15d0333acb6efdbe2059ce9250dbf443bde85ef07ab9b80c13f`；[archive index](archive-index.json)绑定闭集1034项、813regular/731138064B原字节和每份归档/sidecar身份。解压后两个顶层为`old-package/`和`old-review/`。

[可逆gzip copy-map与精确metadata sidecar](complete-archive-copy-map-and-metadata.v2.json.gz)覆盖每个原路径、archive member、原fullMode/uid/gid/dev/inode/size/mtimeNs/ctimeNs/link text及每regular SHA。原JSON1001699B/SHA`a68418093377d3cb6077882221614d2acdb626735c1a85f7ecf3f054f90c9e21`，gzip90844B/SHA`0c5b93cae962e7533ff82ffc27988b1d61e07fc4ee8cab80a936a76adba9c6cf`。归档bytes与sidecar**联合记录metadata**；TAR浮点时间不保存原纳秒，解压也不重建原dev/inode/ctime。全部成员及regular bytes/hash/mode/uid/gid/link text已回读，精确纳秒由sidecar负责。v2的1034条entries全为archive-member；alternativeComparison仅比较未采用的dedup备选，不描述当前归档组成。原v1派生sidecar及估算留存/sdd，也在本目录作为历史候选保留。

原727MB的P及审查D继续在/sdd原路径；本仓只保留压缩归档和小型sidecar/收据。source13和历史副本只因原包闭集而在归档出现，不另逐份独立复制进仓库。外部去重备选保留在PUB，未复制/home。[预算](publication-budget.json)同时计工作文件、ownGit blobs/trees/index/目录及收据reserve，root按原Astra窄I1将原128MiB数值落帽但保守余量不足的估算调整为144MiB硬帽，并另加至少8MiB contingency；原估算/I1及root调整见[独立归因](narrow-publication-review-and-root-adjustment.json)，不追称原reserve充分。C/F共用objects增长不计本主题。本轮未写Git objects/index/refs、未暂存或提交。

## 审查入口与原始失败

在归档中，`old-package/package-final-audit.json`和`old-review/frozen-package-inventory.json`为prepared0锚；`old-review/authorized-old-once-20261027T211409194358Z/`包含唯一driver actual receipt、完整handoff/finalindex/postrun inventory及独立outcome audit。最终guard为`old-package/guard-after-restore.json`20159527B/SHA`6601c1435fb486deb1cc8815a428a3af7141a35081f8280059f7849d3db135b7`。

全P/D闭集保留初次list/dict inspector错误、phase2实际1及历史c6/current649纠正、continuation原in-flight零字节快照/closure与terminal纠正、phase3 writer SyntaxError/缺源actual2/纠正0，以及root wrapper-reader actual1/纠正0的原有归因。原source/output只有会话记录时，归因明确不伪造raw。[本次自有publication artifacts copy-map](preparation-copy-map-and-metadata.json)及[初次只读路径错误归因](publication-preparation/preparation-initial-reader-error-attribution.json)保留新准备中的失败；[两次归档测量actual](publication-preparation/full-closure-measurement.actual-result.json)和[首轮actual](publication-preparation/archive-preparation.actual-result.json)均0，原保守超帽估算和后续细算分别保存，不改写早期结果。

[当前边界](current-boundaries.json)：新完整40（39＋meta）/238hooks/双fresh/loaded/恢复与独立非作者真实默认编辑器after仍pending；I build/after/ready=false。此出版不是新runtime包、全源码compile或UI-after资格，不准备new mode、不运行Node/driver/after、不集成main/C/F/J。
