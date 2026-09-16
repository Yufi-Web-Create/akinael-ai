# 公開前SEOチェックリスト

この確認用サイトは、正式住所・電話番号・地図位置・公開URLが未確定です。誤ったローカル情報のインデックス登録を防ぐため、現在は `noindex, nofollow` を設定しています。

公開承認前に、店舗から提供・掲載許可された情報で次を反映し、確認します。

- [ ] 本番HTTPS URLを `canonical`、`og:url`、構造化データの `url` に同一値で設定する。
- [ ] 本番URLで配信する1200×630px以上のOGP画像を `og:image` に絶対URLで設定する。
- [ ] 正式な番地を含む住所を画面、`PostalAddress.streetAddress`、地図リンクで一致させる。
- [ ] 掲載許可済み電話番号を画面、`tel:` リンク、構造化データの `telephone` で一致させる。
- [ ] 正確な地図URLまたは埋め込みを設定し、住所との一致とキーボード操作を確認する。
- [ ] `noindex, nofollow` を削除し、本番用の `robots.txt` と `sitemap.xml` を公開URLで作成する。
- [ ] Rich Results TestとSearch Consoleで構造化データ・canonical・robotsの到達性を再確認する。
