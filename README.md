# Web小説一行化ブックマークレット

**とりあえず使ってみたい方は [実行](#実行) へ。**

## できること
- Web小説を縦一行に表示し、自動スクロールで読むことができます。
- 文字サイズや色の変更ができます。

> [!WARNING]
> - iOSでは自動スクロールとページ切り替えの挙動がうまくいかず、快適な利用は無理そうでした。
> - 自動スクロールでカクつきが発生することがあります。（Chromeを使う、リフレッシュレートを60Hzにする、常時自動スクロールスライダーバーに触れる、などで改善することがあります）

## 作ったきっかけ
- 「一行を読み終え、次の行を読むときに、読むべき行を見失ってしまう」ことが多く、読書に集中できなかったことがきっかけです。
- 「すべてを一行にしてしまえばいいのでは!?」と思い検索し、みもねる氏の記事｢[青空一行文庫ブックマークレット](https://qiita.com/mimonelu/items/26288a6347e958f500af)｣を見つけました。実際に使ってみて、画面スクロールが大変で読めないなと思ったのが最初で、そこからいろいろな機能を追加していきました。
- AIが書いたコードをコピペ、ツギハギして作りました。私は非エンジニアで、作り始めたころは変数のスコープすら理解していませんでした。今も本職の方が見ればおかしなところがたくさんあると思いますが、大目に見てほしいです。（コードの改善はしていきたいと思っています）

## JSファイルについて
- bookmarklet-main.js と novel-window.js の2つがあります。
  - bookmarklet-main.js は、ブックマークレット実行時に直接読み込まれるものです。本文を抽出、整形し、テキスト情報パネルを作成したあと、小説タブを開きます（このとき novel-window.js を `<script src>` で読み込みます）。
  - novel-window.js は、小説タブ側で動作するスクリプトです。小説タブのUI生成や動作を担います。

## 対象サイト
- 対象サイトは青空文庫に加え、「小説家になろう・カクヨム・アルファポリス」です。
- 上記以外のサイトでも使いたい場合や、作者あとがきを含めたくない場合など、自由に改変してください。
  - bookmarklet-main.js 内の`SELECTOR_MAP`によるタグ指定で対応できます。
  - 小説本文のページで右クリックし、「開発者ツール」→「ページのソースを確認」から、縦一行にしたい文章を囲っているタグを確認することができます。

## 実行
- ブックマークレットによる実行です。
  - [こちら](https://kuansy373.github.io/novel-viewer-bookmarklet/)で一応の説明はしていますが、ブラウザや端末(OS)のバージョンが変わると方法も変わることがあると思います。

<pre><code>javascript:(function(){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/kuansy373/novel-viewer-bookmarklet@20ffd694b71e2566e49dd4178d69e6b04aa2142f/js/bookmarklet-main.js';document.body.appendChild(s)})()
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
設定するとこんな感じにできます。左右に伸びてるのは自動スクロールスライダーバーの当たり判定です。<br>
（青タブレット、緑スマホ）
<br><br>
<p align="left">
  <img src="images/photo3.jpg" alt="photo3" width="300">
  <img src="images/photo4.jpg" alt="photo4" width="300">
</p>

## デフォルト設定 JSON
<details>
<summary>JSONを表示する</summary>

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
    "position": 10,
    "width": 70,
    "speedScale": 15,
    "showThumb": true
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

</details>

※ テキスト選択時の検索ショートカットの表示を無くすには、`"searchConfigs": []` と、中身を空にすることで可能です。
  - また、SAVEボタンについては、データをどこかストレージに保存しているのではなく、変数に保持しているだけなので、小説タブを閉じると失われます。タブを離れるときは忘れずにコピー、メモするようにしてください。次回以降、入力欄に貼り付けて反映できます。

## 読み込みについて
- ソースコードが長く、モバイル端末ではブックマークのURL欄に入りきらないため、jsDelivr（CDN）での読み込みになっています。
- 読み込むファイルの指定にはコミットハッシュを使用しています。
- ソースコードを確認する場合は、ブックマークレットコードが参照しているコミットハッシュの bookmarklet-main.js と、 bookmarklet-main.js が`<script src>`で読み込んでいるコミットハッシュの novel-window.js をそれぞれ確認する必要があります。

> [!NOTE]
> - 現在の `javascript:` で読み込まれるのは、
>   - bookmarklet-main.js が [20ffd69][hash1]
>   - novel-window.js が [3cbd701][hash2]
  です。
> - リリースは [v1.0.0][tag] です。

  [hash1]: https://github.com/kuansy373/novel-viewer-bookmarklet/blob/20ffd69/js/bookmarklet-main.js
  [hash2]: https://github.com/kuansy373/novel-viewer-bookmarklet/blob/3cbd701/js/novel-window.js
  [tag]: https://github.com/kuansy373/novel-viewer-bookmarklet/releases/tag/v1.0.0

## 免責
- 本ツールは現状有姿で提供されます。動作を保証するものではありません。
- 利用によって生じたいかなる損害についても、作者は責任を負いません。
- 対象サイトの仕様変更により、予告なく動作しなくなる可能性があります。
- ご利用は自己責任でお願いします。
