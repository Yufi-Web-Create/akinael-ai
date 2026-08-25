export const businessConfig = {
  currency: 'JPY',
  taxIncluded: true,
  pricingPolicyVersion: '2026-08-25',
  pricingPolicyPriority: 'formal',
  pricing: {
    trial: {
      name: 'お試し',
      amount: 0,
      billing: 'free',
      includes: ['AIへの簡易相談', '簡易な集客相談', 'SNS投稿案', 'キャッチコピー案', '簡易Webサイト改善提案', '簡易リサーチ', '店舗・事業の課題整理', 'Webサイト簡易試作', '実現できる施策の提案'],
      excludes: ['Webサイトの本番公開', '本格的なSEO施工', '本格競合分析', '継続的なSNS運用', '外部サービス連携', '大量の画像・文章制作', '高負荷な調査', '自動化', '広告配信'],
      limits: ['利用回数', '制作量', '処理量']
    },
    mini: {
      name: '本契約ミニ',
      monthlyAmount: 3980,
      positioning: '気軽に使える、お店のAI相談役',
      includes: ['経営・集客・商品企画・イベント企画・キャンペーン相談', 'Web・SNS・価格設定・ターゲット整理', 'SNS投稿文・メール・お知らせ・ブログ構成・簡易記事', '商品説明・メニュー説明・FAQ・キャッチコピー・求人文章', 'Web検索・簡易競合確認・地域情報・トレンド・簡易キーワード調査', '少量の画像生成・簡易画像編集・SNS/Web用素材'],
      excludes: ['継続的なWebサイト運用', '本格SEO継続運用', 'SNSデータ分析', '継続競合監視', '本格的なアクセス分析', '自動化', 'CRM', '高度な外部API連携', '広告配信']
    },
    operations: {
      name: 'しっかり運用',
      monthlyAmount: 7980,
      positioning: 'Web・SNS・SEO・集客を継続的に育てる運用担当',
      includes: ['本契約ミニの全内容', 'Webサイト更新・小規模ページ改善', 'CTA・問い合わせ導線改善', '基本SEO・AEO・GEO・LLMO改善', 'Search Console・Analytics・検索クエリ分析', '月間SNS投稿企画・文章・画像案・結果分析', '継続競合チェック・口コミ分析・差別化提案', 'アクセス・問い合わせ導線・コンバージョン改善', '軽度の業務改善'],
      excludes: ['大規模なWeb開発', '高度な外部API連携', 'CRM構築', '本格的な業務自動化', 'Instagram広告の実配信', '大規模システム開発']
    },
    advanced: {
      name: '発展運用',
      monthlyAmount: 17800,
      positioning: '分析・改善・広告・自動化まで。集客と業務を本格的に動かす最上位基本プラン',
      includes: ['しっかり運用の全内容', '売上・商品・顧客・来店・Web・SNS・広告・競合分析', '複数データ統合分析・リピーター分析・LTV分析', 'キャンペーン戦略・ペルソナ・顧客セグメント・年間販促計画', '問い合わせ分類・自動メール・予約確認・リマインド', '顧客データ連携・簡易CRM・一部API連携・AI業務改善', 'Instagram広告運用の利用資格'],
      excludes: []
    },
    instagramAds: {
      name: 'Instagram広告運用',
      eligiblePlan: 'advanced',
      feeRate: 0.2,
      minimumMonthlyFee: 5500,
      adSpendPaidByCustomer: true,
      includes: ['広告戦略', 'ターゲット・地域・年齢・興味関心設定', '広告コピー・クリエイティブ', '配信設定', '効果確認・調整・改善', 'LPとの連動改善']
    },
    websiteProduction: {
      name: 'Webサイト正式制作・公開',
      startingAmount: 19800,
      standardScope: ['最大5ページ程度', 'スマートフォン対応', 'レスポンシブデザイン', '基本SEO', 'AEO/GEO/LLMOを意識した構造', '基本的な構造化データ', 'Google Map', '問い合わせフォーム', '基本的な画像制作', '公開作業'],
      additionalQuoteExamples: ['大量のページ追加', 'LP', 'CMS', 'ブログシステム', '予約システム', 'EC', '会員機能', '顧客マイページ', '管理画面', '高度なAPI連携', '独自Webシステム']
    },
    options: {
      examples: ['ページ追加', 'LP制作', 'CMS', 'EC', '予約機能', '会員ページ', '管理画面', '大規模サイト', 'チラシ', 'メニュー', 'パンフレット', '大量のSNSクリエイティブ', 'ブランド設計', '大規模競合調査', '市場調査', 'SEO集中改善', 'SNS戦略設計', '集客戦略設計', 'LINE連携', '外部API連携', 'CRM', 'AIチャットボット', '高度な業務自動化', '独自Webアプリ'],
      proposalOnlyUntilApproved: true
    },
    decisionCategories: ['プラン内', 'オプション', '上位プラン推奨', '個別見積'],
    approvalRequiredFor: ['オプション申込み', 'プラン変更', '有料作業への同意', '追加料金への同意', 'Webサイト本番公開', 'SNS投稿', 'メール送信', '広告配信', '広告費変更', '外部サービス連携', '自動化の有効化', '顧客データ変更', '決済関連操作', '公開情報変更'],
    explicitApprovalExamples: ['その金額でお願いします', 'このオプションで進めてください', '発展運用に変更してください', '19,800円でお願いします', '申し込みます'],
    ambiguousApprovalExamples: ['いいですね', 'なるほど', '考えておきます', 'それもありですね', 'できるならやりたい', 'どんな感じ？'],
    externalCosts: ['独自ドメイン', '広告費', 'Google Workspace', '有料予約サービス', 'LINE公式アカウント', '有料素材', '特殊API', '大量メール配信', '顧客専用SaaS'],
    guarantees: ['SEO順位', 'Google検索1位', '売上増加', '問い合わせ増加', '来店増加', 'SNSのバズ', 'フォロワー増加数', '広告ROAS', '広告成果', 'AI検索での引用', 'ChatGPT等への掲載'],
    defaultAction: 'proposal_only',
    pendingApprovalStatus: 'PENDING_APPROVAL',
    customerFacingInternalMetrics: false
  },
  refundPolicy: {
    title: '返金・解約ポリシー',
    items: [
      'お試しは0円です。',
      '月額プランの解約条件、返金条件は契約時に明示します。',
      '外部サービス料金、広告費、顧客専用SaaSなどの顧客固有費用は原則として顧客負担です。',
      '返金条件は提供方法と契約形態に応じて契約書へ反映し、販売開始前に法務確認を行います。'
    ]
  },
  termsNotice: 'この料金体系を正式かつ最優先の料金ルールとします。相談だけで料金は発生しません。追加料金が必要な場合は、内容と料金を先に説明し、顧客の明確な承認後に作業を開始します。',
  pricingDecisionRule: '相談内容をプラン内、オプション、上位プラン推奨、個別見積のいずれかに分類し、顧客の明確な承認なしにプラン変更・追加課金・有料処理・本制作・広告配信を開始しない。',
  humanApprovalRule: '料金への同意と外部影響のある実行承認を分離し、公開・課金・返金・削除などの不可逆操作は人間承認を必須とする。'
};
