# WEB小説一行化ブックマークレット
## 目次
- [できること](#できること)
- [作ったきっかけ](#作ったきっかけ)
- [最初の注意](#最初の注意)
- [jsファイルの説明](#jsファイルの説明)
- [対象サイト](#対象サイト)
- [実行（ブックマークレットコードと実行方法）](#実行)
- [強み](#強み)
- [弱み](#弱み)
- [デフォルト設定 JSON](#デフォルト設定-json)
- [バージョン大雑把まとめ](#バージョン大雑把まとめ)
- [注意点（パージョンタグとコミットハッシュ）](#注意点)
- [不具合・要望](#不具合要望)

### できること
- WEB小説を縦一行に表示し、スマホでも大きな文字で読むことができます。
- 文字サイズや文字色の設定、自動スクロールができます。

### 作ったきっかけ
- 「一行を読み終え、次の行を読むときに、読むべき行を見失ってしまう」ことが多く、読書に集中できなかったことがきっかけです。
- 「すべてを一行にしてしまえばいいのでは!?」と思い検索し、下記みもねる氏の記事を見つけました。（ブックマークレットの存在を知る）

### 最初の注意
- みもねる氏の｢[青空一行文庫ブックマークレット](https://qiita.com/mimonelu/items/26288a6347e958f500af)｣を知り、使ってみて、｢更にこれが出来たらすごいんじゃないか!?｣と思う機能を付け加えていきました。
- 私は、AIが書いたコードをコピペ、ツギハギして作りました。
- （追記:2025.11/07）AndroidとWindowsでは正常な動作を確認していますが、iOSでは自動スクロールとページ切り替えの挙動がうまくいかず、快適な利用は無理そうでした。

### jsファイルの説明
- bookmarklet-main.js と novel-window.js の2つがあります。
  - bookmarklet-main.js は、ブックマークレット実行時に直接読み込まれます。小説タブのHTMLを生成し、生成されたHTMLが novel-window.js を `<script src>` で読み込みます。
  - novel-window.js は、小説タブ側で動作するスクリプトです。小説タブのUI生成や動作を担います。

### 対象サイト
- 対象サイトは青空文庫に加え、｢小説家になろう・カクヨム・アルファポリス」です。
- 上記以外のサイトでも使いたい場合や、作者あとがきを含めたくない場合など、自由に改変してください。
  - bookmarklet-main.js の`document.querySelectorAll`によるタグ指定で対応できます。
  - 小説本文のページで右クリックし、「開発者ツール」→「ページのソースを確認」から、縦一行にしたい文章を囲っているタグを確認することが出来ます。

### 実行
- ブックマークレットによる実行です。
  - 実行方法はブラウザや端末によって異なるので、詳しくは調べてみてください。
  - [こちら](https://kuansy373.github.io/novel-viewer-bookmarklet/)で一応の説明はしていますが、ブラウザ、端末(OS)のバージョンが変わると方法も変わることがあると思います。

<pre><code>javascript:(function(){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/kuansy373/novel-viewer-bookmarklet@aaa212b755321c731ed3b06afd0917f856a86b33/js/bookmarklet-main.js';document.body.appendChild(s);})();
</code></pre>
<br>
最初実行したときは、このような感じです。
<br><br>
<img src="images/photo1.jpg" alt="photo1" width="300">
<br>
右上、左上にうっすらとある〇や□、△をタップするといろいろ設定できます。
<br><br>
<img src="images/photo2.jpg" alt="photo2" width="300">
<br>
設定するとこんな感じにできます。左右に伸びてるのはスクロールバーの当たり判定です。<br>
（青タブレット、緑スマホ）
<br><br>
<p align="left">
  <img src="images/photo3.jpg" alt="photo3" width="300">
  <img src="images/photo4.jpg" alt="photo4" width="300">
</p>

### 強み
- 自動スクロールができる。色を自由に変えられる。長文に対応してる。

### 弱み
- iOSでは自動スクロールとページ切り替えが正常に使えない。
- カクつく。(Chromeを使う、リフレッシュレートを60fpsにする、常時スクロールバーに触れる、などで改善することがあります)

### デフォルト設定 JSON
```json
{
  "color": "#000000",
  "backgroundColor": "#ffffff",
  "fontSize": "23px",
  "fontWeight": "400",
  "textShadow": 0,
  "fontFamily": "游明朝",
  "scrollSettings": {
    "right": false,
    "left": false,
    "shadow": 0,
    "opacity": 100,
    "border": true,
    "colorIn": false,
    "position": 30,
    "width": 80,
    "speedScale": 10,
    "hideBall": true
  },
  "searchConfigs": [
    {
      "label": "何者",
      "side": "left",
      "offsetY": 0,
      "query": "何者",
      "engine": "https://www.google.com/search?q="
    },
    {
      "label": "元ネタ",
      "side": "left",
      "offsetY": 40,
      "query": "元ネタ",
      "engine": "https://www.google.com/search?q="
    },
    {
      "label": "日本語訳",
      "side": "left",
      "offsetY": 80,
      "query": "日本語訳",
      "engine": "https://www.google.com/search?q="
    },
    {
      "label": "意味",
      "side": "right",
      "offsetY": 0,
      "query": "とは",
      "engine": "https://www.google.com/search?q="
    },
    {
      "label": "読み方",
      "side": "right",
      "offsetY": 40,
      "query": "読み方",
      "engine": "https://www.google.com/search?q="
    },
    {
      "label": "意味 読み方",
      "side": "right",
      "offsetY": 80,
      "query": "意味 読み方",
      "engine": "https://www.google.com/search?q="
    }
  ]
}
```
※ テキスト選択時の検索ショートカットの表示を無くすには、`"searchConfigs": []` と、中身を空にすることで可能です。<br>
  - また、ブックマークレットであるため、データを保存する場所は用意できておらず、JSONをそのままユーザーがメモ帳などに置いておくことを想定しています。つど貼り付けてAPPLYです。

### バージョン大雑把まとめ
- v1.0.0: 縦一行、自動スクロール、色変更、文字サイズ調整。
- v1.1.ｘ: 自動スクロールスライダーの設定UIを追加。ページ切り替えの実装。`font-weight`，`text-shadow`の調整追加。
- v1.2.x: `font-family`の選択を追加。ローカルWEBサーバーによる設定保存を実装（のち削除）。
- v1.3.x: ページ切り替えとJSON保存のconfirmをモーダルUI化。JSONの貼り付け反映を実装。HTMLエスケープ追加。
- v1.4.x: 既存のタブを改変するのではなく、新しいタブに縦一行を開く。ブックマークレット実行後、DOM完成を待つ。ローカルWEBサーバー削除。テキスト情報パネル追加。ルビを数えないようにして文字数カウントのズレを無くした。
- v1.5.0: テキスト選択時に検索ショートカットメニューを表示。
- v1.6.0: onetapUI内を充実。
- v2.0.0: ブックマークレットを実行したページが再読み込みされても小説タブを操作可能にした。

### 注意点
- ソースコードが長く、モバイル端末ではブックマークのURL欄に入りきらないため、jsDelivr（CDN）での読み込みになっています。タグでバージョン管理していますが、ブックマークレットコードと、bookmarklet-main.js ソースコード内からのファイル参照にはコミットハッシュを使用しています。
  - ※コミットハッシュとタグの結びつきを確認したい場合は、「Releases」から、該当コミットハッシュの表示があるタグを確認ください。（現在:コミットハッシュが`@aaa212b`で、タグが`v2.0.1`です）
- このリポジトリの名前は最初「bookmarklet-release」でしたが、「novel-viewer-bookmarklet」に変更しました。（2025.12）

### 不具合・要望
不具合、要望がありましたら、このリポジトリ内で報告するか、この [YouTubeの動画](https://youtu.be/b3lUvSqFgrY?si=7jlP4xZH5-1cneE3) のコメント欄に書き込んでください。可能な範囲で修正し、リリースしてここのタグを更新します。
