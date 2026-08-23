export const businessConfig = {
  currency: 'JPY',
  taxIncluded: true,
  pricing: {
    trialPack: {
      name: 'お試し改善パック',
      standardAmount: 29800,
      monitorAmount: 19800,
      monitorSlots: 3,
      includes: ['現状診断', '改善提案', '紹介文', 'FAQ', '簡易LPまたはキャンペーンページ', '修正2回'],
      excludes: ['独自予約システム', '広告運用', '撮影', '複雑なコード', '無制限修正']
    },
    improvementTeam: {
      name: 'AI改善チーム',
      monthlyAmount: 19800,
      concurrentProjects: 1,
      expectedMonthlyDeliverables: 4,
      renewal: 'monthly'
    }
  },
  refundPolicy: {
    title: '返金・解約ポリシー（初期設定）',
    items: [
      'お試し改善パックは、要件確定前のキャンセルは全額返金します。要件確定後または制作開始後は、実施済み作業分を控除して返金額を算定します。',
      '納品物が合意した受入条件を満たさない場合は、まず契約範囲内で修正を行います。修正で解決できない場合は、未実施分を返金します。',
      'AI改善チームは次回更新日の前日までに解約申請できます。すでに開始した月の月額料金は、原則として日割り返金しません。',
      '外部サービス料金、顧客都合による作業停止、権利確認できない素材への対応など、事前に対象外とした費用は返金対象外です。',
      '返金条件は提供方法と契約形態に応じて最終契約書へ反映し、販売開始前に法務確認を行います。'
    ]
  },
  termsNotice: '料金、契約、返金条件は初期設定です。販売開始前に実際の提供方法と最新の法令に合わせて確定します。'
};
