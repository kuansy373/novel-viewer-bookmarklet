# Web小説一行化ブックマークレット

## 対応サイト
- **青空文庫・小説家になろう・カクヨム・アルファポリス**

## できること
- 小説本文を縦一行に表示し、自動スクロールで読むことができます。
- 右上、左上にうっすらとある`〇`や`□`、`△`ボタンから文字サイズや色の変更ができます。

> [!WARNING]
> 1. iOSでは自動スクロールとページ切り替えの挙動がうまくいかず、快適な利用は無理そうでした。
> 2. 自動スクロールでカクつきが発生する場合は、以下を試してみてください。
>   - Chromeを使う
>   - リフレッシュレートを60Hzにする
>   - `text-shadow`を付けない
>   - 常時自動スクロールスライダーバーに触れる

## 実行
ブックマークレットによる実行です。
<details><summary>方法について</summary>

- [index.md](https://kuansy373.github.io/novel-viewer-bookmarklet/) でブックマークレットの作成、実行方法を説明しています。ただしブラウザや端末によって違いがあるので、各自の方法を調べるのが確実です。
- [bookmarklet.js](dist/bookmarklet.js) をクリップボードへコピーし、ブックマークのURL欄に貼り付けて先頭に`javascript:`を書くことでもできますが、Androidでは [単一行の文字数制限5000文字](https://developer.android.com/reference/android/widget/TextView#setSingleLine(boolean)) によりできないことがあります。この場合、以下の`javascript:`コードはCDN経由で読み込むものなので、できるようになると思います。

</details>

<pre><code>javascript:(()=>{var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/kuansy373/novel-viewer-bookmarklet@commitHash/dist/bookmarklet.js';s.onerror=()=>alert('読み込みに失敗しました');document.body.appendChild(s)})()
</code></pre>

## スタイルのJSONについて
- プロパティについて
  - `themeColor`は、モバイル端末などでアドレスバーなどの色を背景色に追従させるかの真偽値です。
  - テキスト選択時の検索ショートカットを非表示にするには、`"searchConfigs": []` と、キーを残したまま中身を空にします。
  - `fontFamily` にGoogle Fontsの名前（例: [URL](https://fonts.google.com/specimen/Rampart+One?lang=ja_Jpan&preview.lang=ja_Jpan)の該当部分 `Rampart+One` ）を指定すると、使用できます。
    - [一覧はこちら](https://fonts.google.com/?lang=ja_Jpan&preview.layout=sample)

- 保存について
  - `localStorage`に保存されます。タブを閉じても保持されます。異なるサイト（オリジン）間では共有できません。

## 作ったきっかけ
- 「一行を読み終え、次の行を読むときに、読むべき行を見失ってしまう」ことが多く、読書に集中できなかったことがきっかけです。
- 「すべてを一行にしてしまえばいいのでは!?」と思い検索し、みもねる氏の記事｢[青空一行文庫ブックマークレット](https://qiita.com/mimonelu/items/26288a6347e958f500af)｣を見つけました。実際に使ってみて、画面スクロールが大変で読めないなと思ったのが最初で、そこからいろいろな機能を追加していきました。

## 作成にはAIを使用しています
- 質問: ChatGPT,Gemini
- コーディング: Claude Sonnet 4.6~5.5

## 免責
- 本ツールは現状有姿で提供されます。動作を保証するものではありません。
- 対象サイトの仕様変更により、予告なく動作しなくなる可能性があります。
- 利用によって生じたいかなる損害についても、作者は責任を負いません。
- ご利用は自己責任でお願いします。
