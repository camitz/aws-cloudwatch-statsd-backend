var util = require('util');

var awssum = require('awssum');
var amazon = awssum.load('amazon/amazon');
var CloudWatch = awssum.load('amazon/cloudwatch').CloudWatch;
var fmt = require('fmt');

function CloudwatchBackend(startupTime, config, emitter){
  var self = this;
  
  config.cloudwatch.region = config.cloudwatch.region ? amazon[config.cloudwatch.region] : null;
  this.config = config.cloudwatch || {};

  // attach
  emitter.on('flush', function(timestamp, metrics) { self.flush(timestamp, metrics); });
};

CloudwatchBackend.prototype.flush = function(timestamp, metrics) {

  var cloudwatch = new CloudWatch(this.config);

console.log(new Date(timestamp*1000).toISOString());

  for (key in counters) {
	 cloudwatch.PutMetricData({
		MetricData : [{
            MetricName : key,
            Unit : 'Count',
			Timestamp: new Date(timestamp*1000).toISOString(),
            Value : counters[key]
        }],
		Namespace  : 'Namespace'
	},
	function(err, data) {
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

	 cloudwatch.PutMetricData({
		MetricData : [{
            MetricName : key,
            Unit : 'Milliseconds',
			Timestamp: new Date(timestamp*1000).toISOString(),
            StatisticValues: {
					Minimum: min,
					Maximum: max,
					Sum: sum,
					SampleCount: count
				}
        }],
		Namespace  : 'Namespace'
	},
	function(err, data) {
	});

  }

  for (key in gauges) {
	 cloudwatch.PutMetricData({
		MetricData : [{
            MetricName : key,
            Unit : 'None',
			Timestamp: new Date(timestamp*1000).toISOString(),
            Value : gauges[key]
        }],
		Namespace  : 'Namespace'
	},
	function(err, data) {
	});
  }

  for (key in sets) {
	 cloudwatch.PutMetricData({
		MetricData : [{
            MetricName : key,
            Unit : 'None',
			Timestamp: new Date(timestamp*1000).toISOString(),
            Value : sets[key].values().length
        }],
		Namespace  : 'Namespace'
	},
	function(err, data) {
	});
    statString += 'stats.sets.' + key + '.count ' + sets[key].values().length + ' ' + ts + "\n";
    numStats += 1;
  }
  

};


exports.init = function(startupTime, config, events) {
  var instance = new CloudwatchBackend(startupTime, config, events);
  return true;
};
