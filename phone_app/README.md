# Ciquest React Native (Expo)

ウェブ版のモック（マップ/検索/スキャン/クーポン/マイページ）のイメージをReact Native + Expoで再現したサンプルです。API連携はまだ行っておらず、ダミーデータで表示しています。

## セットアップ

```bash
cd app
cp .env.example .env    # API_BASE_URL を必要に応じて修正
npm install
npm run start           # Expo Metro バンドラー起動
```

## 画面構成
- ホーム: 空色グラデーションの疑似マップと店舗カード。Googleマップへ遷移ボタンあり（ダミーデータ）。
- 検索: キーワード + タグフィルタでリストを絞り込み。
- スキャン: カメラ枠のダミー表示と手動入力フィールド（本番では Expo Camera + jsQR を想定）。
- クーポン: 保有ポイントと所持/交換可能クーポンのカード。
- マイページ: プロフィール、バッジ、設定（ログアウト/ヘルプ）。

## API メモ
- `app.config.js` で `extra.apiBaseUrl` に `API_BASE_URL` を注入。`src/api/client.js` で Axios を初期化（`withCredentials` は残してある）。
- エラーハンドリング・CSRF 取得などは未実装なので、Django 側の仕様に合わせて `client` のインターセプターを拡張してください。
