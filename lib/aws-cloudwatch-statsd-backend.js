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

var metricDatum = {
            MetricName : 'Gorets',
            Unit : 'Count',
            Value : metrics.counters.gorets,
			Timestamp: new Date(timestamp*1000).toISOString()
        };

cloudwatch.PutMetricData({
		MetricData : [metricDatum],
		Namespace  : 'Gorets'
	},
	function(err, data) {
		fmt.msg("Putting metrics");
		fmt.dump(err, 'Error');
		fmt.dump(data, 'Data');
	});
};

exports.init = function(startupTime, config, events) {
  var instance = new CloudwatchBackend(startupTime, config, events);
  return true;
};
