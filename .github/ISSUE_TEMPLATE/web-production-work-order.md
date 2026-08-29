---
name: AI Web Production Work Order
about: AI制作チームへWeb制作・改修を依頼する標準仕事票
title: "[WEB] "
labels: []
assignees: []
---

## Goal

この作業でユーザーが最終的にできるようになることを1つ記載する。

## Request

依頼内容。

## Source of truth

- [ ] `AGENTS.md`
- [ ] `docs/web-production/QA_STANDARD.md`
- [ ] 案件の `PROJECT_SPEC.md`
- [ ] 案件の `DESIGN_SYSTEM.md`
- [ ] 案件の `COPY_GUIDE.md`
- [ ] 関連する既存実装

## Scope

変更してよい範囲。

## Out of scope

今回変更しない範囲。

## Acceptance Criteria

### Functional
- [ ]

### Visual / Responsive
- [ ]

### Copy
- [ ]

### Backend / Integration
- [ ]

### SEO / Accessibility
- [ ]

## Required verification

- [ ] automated QA
- [ ] build
- [ ] real-browser verification
- [ ] viewport matrix
- [ ] visual review
- [ ] copy review
- [ ] technical review

## Autonomous execution rule

合理的に判断できる実装・修正について人間承認を待たない。

FAILの場合:

`diagnose -> fix -> retest -> rereview`

をRelease GateがPASSするまで繰り返す。

テスト削除、skip、条件緩和で合格させてはならない。

## Human decision blockers

仕様矛盾、存在しない事業情報、料金・契約、不可逆な外部操作、法務・重大リスクのみ記載する。
