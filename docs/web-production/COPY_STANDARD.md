# COPY_STANDARD.md

## Purpose

「AIっぽくしない」という曖昧な指示を、具体的な判定基準へ変換する。

## Core rules

1. 具体的な事実を優先する。
2. その会社固有の情報がなくても成立する文章は疑う。
3. 大げさな価値表現より、何をしてくれるかを先に説明する。
4. 日本語として会話で自然か確認する。
5. 同じ語尾・構文・言い換えの反復を避ける。
6. 存在しない実績、利用者評価、数字を作らない。

## Default NG patterns

文脈上の必然性がない限り、以下のようなgeneric表現を使わない。

- 想いを形に
- 未来を創る
- 新しい可能性
- 一歩先へ
- 寄り添います
- ビジネスを加速
- 最適なソリューション
- 革新的な
- シームレスな
- 価値を提供
- 〜を実現します の連続

## Specificity test

各主要コピーについて次を確認する。

> 固有名詞とサービス名を別会社名へ置き換えても、そのまま使えるか？

YESなら原則書き直す。

## Information priority

ユーザーが知りたい順序を優先する。

- 何のサービスか
- 誰向けか
- 何をしてくれるか
- 料金や利用条件
- 他との違い
- 利用手順
- 運営者・信頼材料
- 次に何をすればいいか

## Voice profile per project

案件ごとの `COPY_GUIDE.md` に以下を保存する。

- sentence length
- formality
- warmth
- directness
- preferred vocabulary
- avoided vocabulary
- confirmed good examples
- rejected examples and reason

顧客修正が発生した場合、修正後の文だけでなく「なぜ修正されたか」を記録し、次の生成へ反映する。

## Review format

Copy Reviewerは各指摘を以下で記録する。

| severity | location | current | problem | rewrite direction |
|---|---|---|---|---|

重大な事実誤認・架空情報はBLOCKER。
不自然な日本語、generic copy、冗長性は原則FAILとしてBuilder/Content Editorへ差し戻す。
