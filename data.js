var path = require('path');
var root = __dirname;

module.exports = {
  root: root,
  models_file: path.resolve(root, './tmp/models.xlsx'),
  excel_file: path.resolve(root, './tmp/result.xlsx'),
  proxys_file: path.resolve(root, './tmp/ips.json'),
  // 抓取代理页面需要翻墙.....
  proxy: 'http://192.168.0.109:1080',

  build_url: function (s) {
    return 'http://sou.autohome.com.cn/Api/Suggest/search?q=' + escape(s);
  }
}
