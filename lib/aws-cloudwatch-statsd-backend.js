var util = require('util');

var awssum = require('awssum');
var amazon = awssum.load('amazon/amazon');
var CloudWatch = awssum.load('amazon/cloudwatch').CloudWatch;
var fmt = require('fmt');

function CloudwatchBackend(startupTime, config, emitter){
  var self = this;
  this.lastFlush = startupTime;
  this.lastException = startupTime;
  
  config.cloudwatch.region = config.cloudwatch.region ? amazon[config.cloudwatch.region] : null;
  this.config = config.cloudwatch || {};

  this.statsCache = {
    counters: {},
    timers: {}
  };

  // attach
  emitter.on('flush', function(timestamp, metrics) { self.flush(timestamp, metrics); });
  emitter.on('status', function(callback) { self.status(callback); });
};

CloudwatchBackend.prototype.flush = function(timestamp, metrics) {
  var self = this;
  console.log('Flushing stats at', new Date(timestamp * 1000).toString());

  // merge with previously sent values
  Object.keys(self.statsCache).forEach(function(type) {
    if(!metrics[type]) return;
    Object.keys(metrics[type]).forEach(function(name) {
      var value = metrics[type][name];
      self.statsCache[type][name] || (self.statsCache[type][name] = 0);
      self.statsCache[type][name] += value;
    });
  });

  var out = {
    counter: this.statsCache.counters,
    timers: this.statsCache.timers,
    gauges: metrics.gauges,
    sets: function (vals) {
      var ret = {};
      for (val in vals) {
        ret[val] = vals[val].values();
      }
      return ret;
    }(metrics.sets),
    pctThreshold: metrics.pctThreshold
  };

  if(this.config.prettyprint) {
    console.log(util.inspect(out, false, 5, true));
  } else {
    console.log(out);
  }

  var cloudwatch = new CloudWatch(this.config);

console.log(new Date(timestamp*1000).toISOString());
var metricDatum = {
            MetricName : 'CloudWatchAppender',
            Unit : 'Count',
            Value : metrics.counters.gorets,
			Timestamp: new Date(timestamp*1000).toISOString()/*,
            Dimensions : [
                { Name : 'InstanceId',   Value : 'i-aaba32d5', },
                { Name : 'InstanceType', Value : 'm1.micro',    },
            ],*/
        };

cloudwatch.PutMetricData({
		MetricData : [metricDatum],
		Namespace  : 'CloudWatchAppender'
	},
	function(err, data) {
		fmt.msg("Putting metrics");
		fmt.dump(err, 'Error');
		fmt.dump(data, 'Data');
	});
};

CloudwatchBackend.prototype.status = function(write) {
  ['lastFlush', 'lastException'].forEach(function(key) {
    write(null, 'console', key, this[key]);
  }, this);
};

exports.init = function(startupTime, config, events) {
  var instance = new CloudwatchBackend(startupTime, config, events);
  return true;
};
