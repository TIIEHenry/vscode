---
title: "Conversation lease guard-v2：源码纠正与 prep1 整包拒绝"
type: reference
status: accepted
phase: N/A
updated: 2026-10-28
summary: "prep1 whole C0/I1/root拒绝原样保留；guard-v2 source C0/I0/root采纳，仅关源码I1，下一prep2须3238库存/whole peer/runtime。"
---

# Guard-v2 源码与 prep1 整包拒绝

本目录只出版源码与证据，父a930/source3dc。[主lease §12](../../plans/conversation-visible-lease-recovery.md#129-prep1整包i1与guard-v2源码纠正2026-10-28)仍accepted；§1–11及既有§12规范/历史正文不改，没有新规范amendment或规则16门。source-v2只关闭I1源码层，尚未准备fresh prep2或激活release。

- [prep1 whole peer/root拒绝](prep1-whole-peer-root-rejection-summary.json)：C0/I1/M0。旧2018/eight roots漏底层consumed557＋同系prep1 385；静态库存pins不等于逐stage保护原件。原215文件/89281471B、63目录/278项、213pins，[audit](prep1/package-final-audit.original.json)103943B/SHA7d286fc1c0e82163ba3a3a6602adf767f1094d79565634e5ec1db3f1f85f11db与[外完整inventory](prep1/frozen-package-inventory.original.json)102010B/SHA9431a3fe46e5c7ab8cbf821994c7f8dbce1231ef713479504774655d91c4ed3b保持，release false/false、调用0。
- [原Astra guard-v2窄source peer/root采纳](original-astra-guard-v2-source-peer-root-summary.json)：C0/I0/M0。两份审查均为原reviewer direct FINAL经root转交概述，不是terminal raw/verbatim或消息原字节。原包I1不因此变成通过。
- [13-source freeze](source-evidence/source-freeze.json)8156B/SHA4adcf7ca2b2d5ba77aa396ca7bc413f2194080a929409fdecd9a4c30a12bfc46：仅guard.py preserve_fixed_inputs改，guard15463B/SHA5d845f0e284c9354bbe1dcae0f5b8cdc2c8fe85846764adf27072e0d625b4ccd，其余12=dfe。source/下11工具为.raw、两JSON为inert contract，不是运行授权。
- 完整[正向diff](source-evidence/guard-forward.diff.raw.gz)/[逆向diff](source-evidence/guard-inverse.diff.raw.gz)各4456B原字节由gzip保留；[全raw UTF8](source-evidence/complete-diff-byte-replays.json)及[全文件ndiff正逆](source-evidence/guard-complete-text-replay.json)可重建整旧/新文件，不截断、不编辑原diff空白。原raw留home原处。
- [唯一AST summary](source-evidence/syntax-exactly-once-summary.json)、[stdout](source-evidence/guard.ast.stdout.raw)/[stderr](source-evidence/guard.ast.stderr.raw)：改变guard恰一次ast.parse actual0，stdout262B/SHA9a53f0fd2314eb83a1c20d0a51b5879f62198aa040d81a497c272b7c5a7b04a9，stderr0；其他syntax/import/execute/selftest0。本次出版不重复语法。
- source-v2[定向715前](source-evidence/targeted-715-protection-before.json)/[后](source-evidence/targeted-715-protection-after.json)均actual0。只核列明metadata/native/tools/原件，每次2901文件/1663054951B，明确不重复整份context/external数GB内容闭包；历史whole-build失败、official1及failed-body/采样边界不升级。
- [最终source-only handoff](source-evidence/final-source-v2-handoff.json)原25670B/SHA40d429673fb452aca4a8b5ddbfaefbdb374c673c52803f7ae585a4b55f031ebf；home source目录22项/290663B，[字节关联](copy-and-source-byte-association.json)与[原路径/完整库存引用](original-paths-and-inventory-references.json)区分实际复制和大原件引用，原处保留。
- [native最窄两字段归因](prep1/narrow-native-manifest-provenance.original.json)：最终8627331B/SHA1139d88acc3f53af2e3656145aac5351815e0afaa83376aa294ec311a1ada538只替Reveal两current-source值，其余11167行/顶层/native/producer/manifest-only资格不改，逆向整原SHAa3a1f0c947708792006a0657a8160650b42c2ba306130de5b9da4c27eba4b196。[较宽中间态历史](prep1/intermediate-native-descriptions-history.original.json)保8629542B与10755496B原bytes/可用metadata在原处，不称两中间态总差异仅两字段，pre原工作lstat未采明确unknown，不补造时间。
- [下一prep2/after边界](next-prep2-data-and-after-boundaries.json)：3238=2018 legacy＋557＋385＋拒绝原包278（不是2960），新增inclusive1220/三root独立于旧分类。future new仍须root接收old恢复receipt，source不替新包whole peer/独立release。I仅既有候选，独立src/out/.build与共享只读责任C/F/J已接受，未reserve/配置/ready；E/D不改。/sdd持久路由仅未来可另授，当前未创建/probe，C/F/J仍无merge授权。

原[dfe133 live source证据及139路径出版快照](../conversation-visible-lease-business-semantic-source-20261028-evidence/INDEX.md)、[原source-peer历史](../conversation-visible-lease-business-semantic-peer-accepted-20261028-evidence/INDEX.md)不追改旧manifest。历史pending按当时保留，后续采纳另记。publication/含本次门禁与定向保护；最终source-publication-index.json绑定全部Included路径/bytes/SHA/Git blob，仅自排除内容行以免self-hash循环。出版前recorder的scope变量被metadata根循环复用而误印status字段，原raw与独立git-clean纠正说明同存；保护断言本身均实际通过，候选源码未变。
