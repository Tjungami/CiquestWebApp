export const stores = [
  {
    id: 'cafe-liberta',
    name: 'カフェ・リベルタ',
    description: '学生に人気のカフェ',
    distance: 250,
    tag: 'カフェ',
    lat: 36.557,
    lon: 139.883,
  },
  {
    id: 'gyoza-kan',
    name: '宇都宮餃子館',
    description: '名物餃子クエスト開催中',
    distance: 800,
    tag: 'ラーメン',
    lat: 36.556,
    lon: 139.907,
  },
  {
    id: 'book-chill',
    name: 'Book & Chill',
    description: '静かに読書ができる喫茶店',
    distance: 500,
    tag: 'カフェ',
    lat: 36.554,
    lon: 139.885,
  },
  {
    id: 'yakitori',
    name: '夜風焼き鳥',
    description: '地元で評判の焼き鳥店',
    distance: 700,
    tag: '居酒屋',
    lat: 36.553,
    lon: 139.881,
  },
];

export const coupons = {
  points: 120,
  owned: [
    { id: 'cp-1', title: 'カフェ・リベルタ 100円OFF', desc: 'ドリンク1杯につき100円割引', used: false },
    { id: 'cp-2', title: '宇都宮餃子館 10%OFF', desc: 'お会計から10%割引', used: true },
  ],
  exchangeable: [
    { id: 'ex-1', title: '100円クーポン', desc: 'ポイント交換！100pt', cost: 100 },
    { id: 'ex-2', title: '200円クーポン', desc: 'ポイント交換！90pt', cost: 90 },
  ],
};

export const userProfile = {
  name: 'Ciquestユーザー',
  rank: 'ブロンズ',
  points: 120,
  badges: ['🏆', '🥇', '🎯', '🍜'],
};
