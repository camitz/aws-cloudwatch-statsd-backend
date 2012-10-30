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

CloudwatchBackend.prototype.processKey = function(key) {
	var parts = key.split(/[\.\/]/);
	return { 
		metricName: parts[parts.length-1],
		namespace: parts.length > 1 ? parts.splice(0, parts.length-1) : null
	};
}

CloudwatchBackend.prototype.flush = function(timestamp, metrics) {

  var cloudwatch = new CloudWatch(this.config);

console.log(new Date(timestamp*1000).toISOString());


  var counters = metrics.counters;
  var gauges = metrics.gauges;
  var timers = metrics.timers;
  var sets = metrics.sets;
 
  for (key in counters) {
	  if (key.indexOf('statsd.') == 0)
		  continue;
	 
	 names = this.processKey(key);
	 var namespace = this.config.namespace || names.namespace || "AwsCloudWatchStatsdBackend";
	 var metricName = this.config.metricName || names.metricName;
	 
	 cloudwatch.PutMetricData({
		MetricData : [{
            MetricName : metricName,
            Unit : 'Count',
			Timestamp: new Date(timestamp*1000).toISOString(),
            Value : counters[key]
        }],
		Namespace  : namespace
	},
	function(err, data) {
			fmt.dump(err, 'Err');
			fmt.dump(data, 'Data');
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
		Namespace  : namespace
	   },
	   function(err, data) {
			fmt.dump(err, 'Err');
			fmt.dump(data, 'Data');
	   });

	}
  }

  for (key in gauges) {
	 cloudwatch.PutMetricData({
		MetricData : [{
            MetricName : key,
            Unit : 'None',
			Timestamp: new Date(timestamp*1000).toISOString(),
            Value : gauges[key]
        }],
		Namespace  : namespace
	},
	function(err, data) {
			fmt.dump(err, 'Err');
			fmt.dump(data, 'Data');
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
		Namespace  : namespace
	},
	function(err, data) {
			fmt.dump(err, 'Err');
			fmt.dump(data, 'Data');
	});

	statString += 'stats.sets.' + key + '.count ' + sets[key].values().length + ' ' + ts + "\n";
    numStats += 1;
  }
  

};



exports.init = function(startupTime, config, events) {
  var instance = new CloudwatchBackend(startupTime, config, events);
  return true;
};
