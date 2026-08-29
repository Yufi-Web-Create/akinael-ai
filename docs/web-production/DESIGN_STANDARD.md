# DESIGN_STANDARD.md

## Purpose

見た目をAIの感覚に任せず、観測可能な基準と参照例で制御する。

## 1. Design tokens required per project

各案件の `DESIGN_SYSTEM.md` で最低限以下を確定する。

- content max width
- desktop / tablet / mobile gutters
- section spacing scale
- typography scale
- line-height
- color roles
- border / radius
- shadow policy
- grid policy
- breakpoints
- header / navigation behavior
- button variants
- form states
- image aspect-ratio policy

固定値を大量に散在させず、tokens/CSS variables等で一元化する。

## 2. Responsive principle

PC版の縮小をレスポンシブとみなさない。

最低確認viewport:

- 360x800
- 375x812
- 390x844
- 430x932
- 768x1024
- 1024x768
- 1280x800
- 1440x900

画面幅に応じ、必要なら並び順、列数、ナビゲーション、CTA位置、画像cropを変更する。

## 3. Automatic visual failure conditions

以下は原則FAIL。

- body幅を超える横スクロール
- viewport外へ主要操作要素がはみ出す
- Header/Navが操作不能
- CTAが他要素に隠れる
- 主要テキストの意図しないclip/overflow
- mobileでタップ領域が極端に小さい
- fixed/sticky要素が本文やフォームを恒常的に遮る
- desktop/tablet/mobileのいずれかだけ明らかに異なるデザインルールになる

## 4. AI-looking pattern check

理由なく以下へ寄せない。

- 全セクションのカード化
- 大量の角丸カード＋shadow
- generic gradient hero
- 巨大な中央揃えH1
- 3カラムのicon/title/text反復
- 意味のない英語ラベル
- 装飾目的だけのglassmorphism
- 不自然に広い空白
- 過剰なmotion

使用する場合は、情報設計上の理由を `DESIGN_SYSTEM.md` に説明できること。

## 5. Canonical examples

各案件は可能なら `references/` にDesktop/Mobileの参考画像を置く。

参考画像は完全コピーではなく、次を明示する。

- adopt: 余白、密度、写真比率、文字組み等
- avoid: 配色、固有UI、コピー等

## 6. Visual review output

Visual Reviewerは `PASS` / `FAIL` を最初に出し、FAIL時は以下の形式で記録する。

| viewport | severity | location | problem | expected fix |
|---|---|---|---|---|

抽象的な「もっと洗練」を禁止し、位置・問題・期待状態を記述する。
