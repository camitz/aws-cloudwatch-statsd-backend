var util = require('util');
var AWS = require('aws-sdk');

function CloudwatchBackend(startupTime, config, emitter){
  var self = this;

  config.cloudwatch.region = config.cloudwatch.region ? amazon[config.cloudwatch.region] : null;
  this.config = config.cloudwatch || {};
  this.cloudwatch = new AWS.CloudWatch(config.cloudwatch);

  // attach
  emitter.on('flush', function(timestamp, metrics) { self.flush(timestamp, metrics); });
};

CloudwatchBackend.prototype.processKey = function(key) {
	var parts = key.split(/[\.\/-]/);

	return {
		metricName: parts[parts.length-1],
		namespace: parts.length > 1 ? parts.splice(0, parts.length-1).join("/") : null
	};
}

CloudwatchBackend.prototype.flush = function(timestamp, metrics) {

  console.log('Flushing metrics at ' + new Date(timestamp*1000).toISOString());

  var counters = metrics.counters;
  var gauges = metrics.gauges;
  var timers = metrics.timers;
  var sets = metrics.sets;

  for (key in counters) {
	  if (key.indexOf('statsd.') == 0)
		  continue;

    var names = this.config.processKeyForNamespace ? this.processKey(key) : {};
    var namespace = this.config.namespace || names.namespace || "AwsCloudWatchStatsdBackend";
    var metricName = this.config.metricName || names.metricName || key;

    this.cloudwatch.putMetricData({
      MetricData : [{
                     MetricName : metricName,
      Unit : 'Count',
      Timestamp: new Date(timestamp*1000).toISOString(),
      Value : counters[key]
                   }],
      Namespace  : namespace
    },
    function(err, data) {
      console.log(util.inspect(err));
      console.log(util.inspect(data));
    });
  }

  for (key in timers) {
    if (timers[key].length > 0) {
      var values = timers[key].sort(function (a,b) { return a-b; });
      var count = values.length;
      var min = values[0];
      var max = values[count - 1];

      var cumulativeValues = [min];
      for (var i = 1; i < count; i++) {
        cumulativeValues.push(values[i] + cumulativeValues[i-1]);
      }

      var sum = min;
      var mean = min;
      var maxAtThreshold = max;

      var message = "";

      var key2;

      sum = cumulativeValues[count-1];
      mean = sum / count;

      var names = this.config.processKeyForNamespace ? this.processKey(key) : {};
      var namespace = this.config.namespace || names.namespace || "AwsCloudWatchStatsdBackend";
      var metricName = this.config.metricName || names.metricName || key;

      this.cloudwatch.putMetricData({
        MetricData : [{
          MetricName : metricName,
          Unit : 'Milliseconds',
          Timestamp: new Date(timestamp*1000).toISOString(),
          StatisticValues: {
            Minimum: min,
            Maximum: max,
            Sum: sum,
            SampleCount: count
          }
                     }],
        Namespace  : namespace
      },
      function(err, data) {
        console.log(util.inspect(err));
        console.log(util.inspect(data));
      });
   	}
  }

  for (key in gauges) {
    var names = this.config.processKeyForNamespace ? this.processKey(key) : {};
    var namespace = this.config.namespace || names.namespace || "AwsCloudWatchStatsdBackend";
    var metricName = this.config.metricName || names.metricName || key;

    this.cloudwatch.putMetricData({
      MetricData : [{
                     MetricName : metricName,
      Unit : 'None',
      Timestamp: new Date(timestamp*1000).toISOString(),
      Value : gauges[key]
                   }],
      Namespace  : namespace
    },

    function(err, data) {
      console.log(util.inspect(err));
      console.log(util.inspect(data));
    });
  }

  for (key in sets) {
    var names = this.config.processKeyForNamespace ? this.processKey(key) : {};
    var namespace = this.config.namespace || names.namespace || "AwsCloudWatchStatsdBackend";
    var metricName = this.config.metricName || names.metricName || key;

    this.cloudwatch.putMetricData({
      MetricData : [{
                     MetricName : metricName,
      Unit : 'None',
      Timestamp: new Date(timestamp*1000).toISOString(),
      Value : sets[key].values().length
                   }],
      Namespace  : namespace
    },

    function(err, data) {
      console.log(util.inspect(err));
      console.log(util.inspect(data));
    });
  }
};

exports.init = function(startupTime, config, events) {
  var instance = new CloudwatchBackend(startupTime, config, events);
  return true;
};
