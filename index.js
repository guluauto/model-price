var path = require('path');
var xlsx = require('node-xlsx');
var fs = require('fs');
var iconv = require('iconv-lite');
var req = require('./lib/req');
var Pooler = require('./lib/pooler');
var config = require('./data');
var _ = require('lodash');

var models = xlsx.parse(config.models_file);

models = models[0].data;
header = models.shift();

header.push('最低价');
header.push('最高价');
header.push('备注');
header.push('查询参数');
header.push('查询串');

var data = [header];
var err_data = [];
var blacklist = [];

function decode(s) {
  var content = iconv.decode(s, 'GBK');

  return content.replace(/Sou.Autocomplate.bindAutocomplate\('(.+)'\);/, function(m, $1) {
    return $1
  });
}

function handler(rs, item, qu, qs) {
  var ra = rs.split(',');
  var len = ra.length;

  if (len < 1 || rs.indexOf(':') === -1) {
    return false;
  }

  var r = ra.find(function(r) {
    return r.indexOf(':') !== -1;
  });

  if (!r) {
    return;
  }

  var tmp = r.split(':');

  var min = tmp[2];
  var max = tmp[3];

  item.push(min);
  item.push(max);
  item.push(r);
  item.push(qu);
  item.push(qs);

  data.push(item);

  return true;
}

var total = models.length;
var complete = 0;

function run(models, repeat) {
  models.forEach(function(model) {
    var brand = model[0];
    var series = model[1].replace(brand, '');
    var item = [].concat(model);
    if (repeat) {
      item[1] = item[1] + '(进口)';
    }

    var url = config.build_url(series);
    Pooler.add({
      url: url,
      callback: function(body) {
        if (body) {
          var flag = handler(decode(body), item, url.split('=')[1], series);

          if (flag) {
            complete++;
            return;
          }
        }

        var _url = config.build_url(model[1]);
        Pooler.add({
          url: _url,
          callback: function(body) {
            if (body) {
              var rs = decode(body);
              var param = _url.split('=')[1];
              var flag = handler(rs, item, param, model[1]);

              if (!flag) {
                console.log('***** 获取价格失败: ' + model[1]);

                item.push(null);
                item.push(null);
                item.push(rs);
                item.push(param);
                item.push(item[1]);

                (repeat ? blacklist : err_data).push(item);
              } else {
                complete++;
              }

              return;
            }
          }
        });
      }
    });
  });
}

var timer;

Pooler.proxys_done = function() {
  timer = setInterval(function() {
    console.log('***** 完成总量: ' + complete);
    console.log('***** 处理进度: ' + Math.round(complete / total * 100) + '%');
  }, 100);
}

Pooler.done = function() {
  console.log('===== 车型总量: ' + total);
  console.log('===== 完成总量: ' + complete);

  var part_data = _.remove(err_data, function(item) {
    return item[1].indexOf('(进口)') !== -1;
  });

  console.log('+++++++++++++++++++++++++++++');
  console.log(part_data.length);
  console.log(JSON.stringify(part_data));
  console.log('+++++++++++++++++++++++++++++');

  if (part_data.length) {
    part_data.forEach(function(item) {
      item.splice(2, item.length - 2);
      item[1] = item[1].replace('(进口)', '');
    });

    run(part_data, true);
    Pooler.run();

  }

  clearInterval(timer);

  data = data.concat(err_data).concat(blacklist);

  var buffer = xlsx.build([{
    name: "车型价格表",
    data: data
  }]);

  fs.writeFileSync(config.excel_file, buffer, 'binary');
}

Pooler.opts = {
  encoding: null
};

run(models);
Pooler.run();
