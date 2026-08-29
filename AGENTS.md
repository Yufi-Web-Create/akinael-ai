# AGENTS.md

このリポジトリは、AIエージェントが自律的に開発・検証できることを前提とする。

## Source of truth

作業前に、対象に応じて以下を確認する。

- 事業・AIチーム構成: `docs/akinael-ai-team-structure.md`
- 事業概要: `docs/business-concept-summary.md`
- Web制作システム: `docs/web-production/README.md`
- Web制作QA: `docs/web-production/QA_STANDARD.md`
- コピー基準: `docs/web-production/COPY_STANDARD.md`
- レビューパイプライン: `docs/web-production/REVIEW_PIPELINE.md`

案件固有の仕様が存在する場合は、共通ルールより案件固有仕様を優先する。ただし、セキュリティ・法務・承認ゲート・テスト基準を勝手に弱めてはならない。

## Required workflow

1. 関連仕様を読む。
2. 現在の実装とテストを確認する。
3. 変更範囲とAcceptance Criteriaを特定する。
4. 実装する。
5. 利用可能なテスト、lint、typecheck、buildを実行する。
6. UI変更は実ブラウザと複数viewportで確認する。
7. FAILがあれば原因を修正し、再検証する。
8. Acceptance Criteriaを満たすまで繰り返す。

## Non-negotiable rules

- テストを削除、skip、条件緩和してPASS扱いにしない。
- 架空の事業情報、実績、顧客、料金、レビューを作らない。
- 既存仕様を、実装しやすさを理由に勝手に変更しない。
- APIキー、secret、個人情報をコードやログへ埋め込まない。
- 公開、課金、返金、削除など不可逆操作は既存の人間承認ゲートを守る。
- UIは「コードを書いた」だけで完了としない。実画面確認を必須とする。
- 問題を発見した場合、合理的に修正可能なら質問せず修正・再検証する。

## Completion definition

完了とは、実装が存在することではない。

- Acceptance Criteriaを満たしている
- 必須QAがPASSしている
- 既知の重大エラーがない
- 人間判断が必要な残件が明示されている

以上を満たして初めて完了とする。
