'use strict';
// drpy2 前端模板库 —— 来源：用户 Desktop/tvbox/tv/lib/模板.js 中的 getMubans()。
// 每个模板对应一套苹果CMS 常见前端主题（myui / stui / fed / hl / module / 短视 等）。
// detect 时用 classes/paths 反推目标站用的是哪套主题，generate 时套用其 url/选择器骨架。
// 字段说明：url/searchUrl 用 fyclass/fypage/** 占位符；一级/二级/搜索/推荐 为 drpy2 选择器语法。

const TEMPLATES = {
  mxpro: {
    label: 'mxpro（module 主题）',
    detect: { classes: ['module-item', 'module-poster', 'module-tab', 'module-play-list', 'module-vodlist'], paths: [] },
    url: '/vodshow/fyclass--------fypage---.html',
    searchUrl: '/vodsearch/**----------fypage---.html',
    searchable: 2, quickSearch: 0, filterable: 0,
    headers: { 'User-Agent': 'MOBILE_UA' },
    class_parse: '.navbar-items li:gt(2):lt(8);a&&Text;a&&href;/(\\d+).html',
    play_parse: true, lazy: '', limit: 6, double: true,
    推荐: '.tab-list.active;a.module-poster-item.module-item;.module-poster-item-title&&Text;.lazyload&&data-original;.module-item-note&&Text;a&&href',
    一级: 'body a.module-poster-item.module-item;a&&title;.lazyload&&data-original;.module-item-note&&Text;a&&href',
    二级: {
      title: 'h1&&Text;.module-info-tag&&Text',
      img: '.lazyload&&data-original',
      desc: '.module-info-item:eq(1)&&Text;.module-info-item:eq(2)&&Text;.module-info-item:eq(3)&&Text',
      content: '.module-info-introduction&&Text',
      tabs: '.module-tab-item',
      lists: '.module-play-list:eq(#id) a'
    },
    搜索: 'body .module-item;.module-card-item-title&&Text;.lazyload&&data-original;.module-item-note&&Text;a&&href;.module-info-item-content&&Text'
  },

  首图: {
    label: '首图（myui 主题）',
    detect: { classes: ['myui-vodlist', 'myui-content', 'myui-header', 'myui-'], paths: ['/vodshow/'] },
    url: '/vodshow/fyclass--------fypage---/',
    searchUrl: '/vodsearch/**----------fypage---.html',
    searchable: 2, quickSearch: 0, filterable: 0,
    headers: { 'User-Agent': 'MOBILE_UA' },
    class_parse: '.myui-header__menu li.hidden-sm:gt(0):lt(5);a&&Text;a&&href;/(\\d+).html',
    play_parse: true, lazy: '', limit: 6, double: true,
    推荐: 'ul.myui-vodlist.clearfix;li;a&&title;a&&data-original;.pic-text&&Text;a&&href',
    一级: '.myui-vodlist li;a&&title;a&&data-original;.pic-text&&Text;a&&href',
    二级: {
      title: '.myui-content__detail .title&&Text;.myui-content__detail p:eq(-2)&&Text',
      img: '.myui-content__thumb .lazyload&&data-original',
      desc: '.myui-content__detail p:eq(0)&&Text;.myui-content__detail p:eq(1)&&Text;.myui-content__detail p:eq(2)&&Text',
      content: '.content&&Text',
      tabs: '.nav-tabs:eq(0) li',
      lists: '.myui-content__list:eq(#id) li'
    },
    搜索: '#searchList li;a&&title;.lazyload&&data-original;.text-muted&&Text;a&&href;.text-muted:eq(-1)&&Text'
  },

  首图2: {
    label: '首图2（stui 主题）',
    detect: { classes: ['stui-vodlist', 'stui-content', 'stui-header', 'stui-'], paths: ['/list/'] },
    url: '/list/fyclass-fypage.html',
    searchUrl: '/vodsearch/**----------fypage---.html',
    searchable: 2, quickSearch: 0, filterable: 0,
    headers: { 'User-Agent': 'UC_UA' },
    class_parse: '.stui-header__menu li:gt(0):lt(7);a&&Text;a&&href;.*/(.*?).html',
    play_parse: true, lazy: '', limit: 6, double: true,
    推荐: 'ul.stui-vodlist.clearfix;li;a&&title;.lazyload&&data-original;.pic-text&&Text;a&&href',
    一级: '.stui-vodlist li;a&&title;a&&data-original;.pic-text&&Text;a&&href',
    二级: {
      title: '.stui-content__detail .title&&Text;.stui-content__detail p:eq(-2)&&Text',
      img: '.stui-content__thumb .lazyload&&data-original',
      desc: '.stui-content__detail p:eq(0)&&Text;.stui-content__detail p:eq(1)&&Text;.stui-content__detail p:eq(2)&&Text',
      content: '.detail&&Text',
      tabs: '.stui-vodlist__head h3',
      lists: '.stui-content__playlist:eq(#id) li'
    },
    搜索: 'ul.stui-vodlist__media:eq(0) li,ul.stui-vodlist:eq(0) li,#searchList li;a&&title;.lazyload&&data-original;.text-muted&&Text;a&&href;.text-muted:eq(-1)&&Text'
  },

  vfed: {
    label: 'vfed（fed 主题）',
    detect: { classes: ['fed-list-info', 'fed-part', 'fed-pops', 'fed-'], paths: ['/index.php/vod/'] },
    url: '/index.php/vod/show/id/fyclass/page/fypage.html',
    searchUrl: '/index.php/vod/search/page/fypage/wd/**.html',
    searchable: 2, quickSearch: 0, filterable: 0,
    headers: { 'User-Agent': 'UC_UA' },
    class_parse: '.fed-pops-navbar&&ul.fed-part-rows&&a;a&&Text;a&&href;.*/(.*?).html',
    play_parse: true, lazy: '', limit: 6, double: true,
    推荐: 'ul.fed-list-info.fed-part-rows;li;a.fed-list-title&&Text;a&&data-original;.fed-list-remarks&&Text;a&&href',
    一级: '.fed-list-info&&li;a.fed-list-title&&Text;a&&data-original;.fed-list-remarks&&Text;a&&href',
    二级: {
      title: 'h1.fed-part-eone&&Text;.fed-deta-content&&.fed-part-rows&&li&&Text',
      img: '.fed-list-info&&a&&data-original',
      desc: '.fed-deta-content&&.fed-part-rows&&li:eq(1)&&Text;.fed-deta-content&&.fed-part-rows&&li:eq(2)&&Text;.fed-deta-content&&.fed-part-rows&&li:eq(3)&&Text',
      content: '.fed-part-esan&&Text',
      tabs: '.fed-drop-boxs&&.fed-part-rows&&li',
      lists: '.fed-play-item:eq(#id)&&ul:eq(1)&&li'
    },
    搜索: '.fed-deta-info;h1&&Text;.lazyload&&data-original;.fed-list-remarks&&Text;a&&href;.fed-deta-content&&Text'
  },

  海螺3: {
    label: '海螺3（hl 主题 / vod_____show）',
    detect: { classes: ['hl-vod-list', 'hl-nav', 'hl-infos', 'hl-'], paths: ['/vod_____show/'] },
    url: '/vod_____show/fyclass--------fypage---.html',
    searchUrl: '/v_search/**----------fypage---.html',
    searchable: 2, quickSearch: 0, filterable: 0,
    headers: { 'User-Agent': 'MOBILE_UA' },
    timeout: 5000,
    class_parse: 'body&&.hl-nav li:gt(0);a&&Text;a&&href;.*/(.*?).html',
    cate_exclude: '明星|专题|最新|排行',
    play_parse: true, lazy: '', limit: 40, double: true,
    推荐: '.hl-vod-list;li;a&&title;a&&data-original;.remarks&&Text;a&&href',
    一级: '.hl-vod-list&&.hl-list-item;a&&title;a&&data-original;.remarks&&Text;a&&href',
    二级: {
      title: '.hl-infos-title&&Text;.hl-text-conch&&Text',
      img: '.hl-lazy&&data-original',
      desc: '.hl-infos-content&&.hl-text-conch&&Text',
      content: '.hl-content-text&&Text',
      tabs: '.hl-tabs&&a',
      lists: '.hl-plays-list:eq(#id)&&li'
    },
    搜索: '.hl-list-item;a&&title;a&&data-original;.remarks&&Text;a&&href'
  },

  海螺2: {
    label: '海螺2（hl 主题 / index.php/vod）',
    detect: { classes: ['list-a', 'deployment', 'play_list_box', 'hl-list-item'], paths: ['/index.php/vod/show/'] },
    url: '/index.php/vod/show/id/fyclass/page/fypage/',
    searchUrl: '/index.php/vod/search/page/fypage/wd/**/',
    searchable: 2, quickSearch: 0, filterable: 0,
    headers: { 'User-Agent': 'MOBILE_UA' },
    timeout: 5000,
    class_parse: '#nav-bar li;a&&Text;a&&href;id/(.*?)/',
    play_parse: true, lazy: '', limit: 40, double: true,
    推荐: '.list-a.size;li;a&&title;.lazy&&data-original;.bt&&Text;a&&href',
    一级: '.list-a&&li;a&&title;.lazy&&data-original;.list-remarks&&Text;a&&href',
    二级: {
      title: 'h2&&Text;.deployment&&Text',
      img: '.lazy&&data-original',
      desc: '.deployment&&Text',
      content: '.ec-show&&Text',
      tabs: '#tag&&a',
      lists: '.play_list_box:eq(#id)&&li'
    },
    搜索: '.search-list;a&&title;.lazy&&data-original;.deployment&&Text;a&&href'
  },

  短视: {
    label: '短视（短视频主题）',
    detect: { classes: ['indexShowBox', 'pic-list', 'menu_bottom', 'sr_lists'], paths: ['/channel/', '/search.html'] },
    url: '/channel/fyclass-fypage.html',
    searchUrl: '/search.html?wd=**',
    searchable: 2, quickSearch: 0, filterable: 0,
    headers: { 'User-Agent': 'MOBILE_UA' },
    class_parse: '.menu_bottom ul li;a&&Text;a&&href;.*/(.*?).html',
    cate_exclude: '解析|动态',
    play_parse: true, lazy: '', limit: 6, double: true,
    推荐: '.indexShowBox;ul&&li;a&&title;img&&data-src;.s1&&Text;a&&href',
    一级: '.pic-list&&li;a&&title;img&&data-src;.s1&&Text;a&&href',
    二级: {
      title: 'h1&&Text;.content-rt&&p:eq(0)&&Text',
      img: '.img&&img&&data-src',
      desc: '.content-rt&&p:eq(1)&&Text;.content-rt&&p:eq(2)&&Text;.content-rt&&p:eq(3)&&Text;.content-rt&&p:eq(4)&&Text;.content-rt&&p:eq(5)&&Text',
      content: '.zkjj_a&&Text',
      tabs: '.py-tabs&&option',
      lists: '.player:eq(#id) li'
    },
    搜索: '.sr_lists&&ul&&li;h3&&Text;img&&data-src;.int&&p:eq(0)&&Text;a&&href'
  },

  默认: {
    label: '默认（无明确主题，需微调）',
    detect: { classes: [], paths: [] },
    url: '/vodshow/fyclass--------fypage---.html',
    searchUrl: '/vodsearch/-------------.html?wd=**',
    searchable: 2, quickSearch: 0, filterable: 0,
    headers: { 'User-Agent': 'MOBILE_UA' },
    class_parse: '',
    play_parse: true, lazy: '', limit: 6, double: true,
    推荐: '',
    一级: '',
    二级: null,
    搜索: ''
  }
};

// 模板显示顺序（前端下拉用）
const ORDER = ['首图', '首图2', '海螺3', '海螺2', 'vfed', 'mxpro', '短视', '默认'];

module.exports = { TEMPLATES, ORDER };
