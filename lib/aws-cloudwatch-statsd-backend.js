var util = require('util');
var AWS = require('aws-sdk');

function CloudwatchBackend(startupTime, config, emitter){
  var self = this;

  this.config = config || {};
  AWS.config = this.config;

  function setEmitter() {
    self.cloudwatch = new AWS.CloudWatch(self.config);
    emitter.on('flush', function(timestamp, metrics) { self.flush(timestamp, metrics); });
  }

  // if iamRole is set attempt to fetch credentials from the Metadata Service
  if(this.config.iamRole) {
    if (this.config.iamRole == 'any') {
      // If the iamRole is set to any, then attempt to fetch any available credentials
      ms = new AWS.EC2MetadataCredentials();
      ms.refresh(function(err) {
        if(err) { console.log('Failed to fetch IAM role credentials: '+err); }
        self.config.credentials = ms;
        setEmitter();
      });
    } else {
      // however if it's set to specify a role, query it specifically.
      ms = new AWS.MetadataService();
      ms.request('/latest/meta-data/iam/security-credentials/'+this.config.iamRole, function(err, rdata) {
        var data = JSON.parse(rdata);

        if(err) { console.log('Failed to fetch IAM role credentials: '+err); }
        self.config.credentials = new AWS.Credentials(data.AccessKeyId, data.SecretAccessKey, data.Token);
        setEmitter();
      });
    }
  } else {
    setEmitter();
  }
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
  var mapFn = this.config.mapNameToDimensionsFn;

  for (key in counters) {
	  if (key.indexOf('statsd.') == 0)
		  continue;

        if(this.config.whitelist && this.config.whitelist.length >0 && this.config.whitelist.indexOf(key) == -1) {
                console.log("Key (counter) "+key+" not in whitelist");
                continue;
        }
	 
    var names = this.config.processKeyForNamespace ? this.processKey(key) : {};
    var namespace = this.config.namespace || names.namespace || "AwsCloudWatchStatsdBackend";
    var metricName = this.config.metricName || names.metricName || key;
    var metricDimensions = [];
    var mapRes;

    if (mapFn) {
        mapRes = mapFn(metricName, "count");
        if (!mapRes) // skip this
            continue;

        metricName = mapRes.metricName;
        metricDimensions = mapRes.metricDimensions;
    }

    this.cloudwatch.putMetricData({
      MetricData : [{
      MetricName : metricName,
      Dimensions: metricDimensions,
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

        if(this.config.whitelist && this.config.whitelist.length >0 && this.config.whitelist.indexOf(key) == -1) {
                console.log("Key (counter) "+key+" not in whitelist");
                continue;
        }

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
      var metricDimensions = [];
      var message = "";

      var key2;

      sum = cumulativeValues[count-1];
      mean = sum / count;

      var names = this.config.processKeyForNamespace ? this.processKey(key) : {};
      var namespace = this.config.namespace || names.namespace || "AwsCloudWatchStatsdBackend";
      var metricName = this.config.metricName || names.metricName || key;

      if (mapFn) {
        mapRes = mapFn(metricName, "timer");

        if (!mapRes) // skip this
          continue;

        metricName = mapRes.metricName;
        metricDimensions = mapRes.metricDimensions;
      }

      this.cloudwatch.putMetricData({
        MetricData : [{
          MetricName : metricName,
          Dimensions: metricDimensions,
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

        if(this.config.whitelist && this.config.whitelist.length >0 && this.config.whitelist.indexOf(key) == -1) {
                console.log("Key (counter) "+key+" not in whitelist");
                continue;
        }

    var names = this.config.processKeyForNamespace ? this.processKey(key) : {};
    var namespace = this.config.namespace || names.namespace || "AwsCloudWatchStatsdBackend";
    var metricName = this.config.metricName || names.metricName || key;
    var metricDimensions = [];

    if (mapFn) {
        mapRes = mapFn(metricName, "gauge");
        if (!mapRes) // skip this
          continue;

      metricName = mapRes.metricName;
      metricDimensions = mapRes.metricDimensions;
    }

    this.cloudwatch.putMetricData({
      MetricData : [{
      MetricName : metricName,
      Dimensions: metricDimensions,
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

        if(this.config.whitelist && this.config.whitelist.length >0 && this.config.whitelist.indexOf(key) == -1) {
                console.log("Key (counter) "+key+" not in whitelist");
                continue;
        }

    var names = this.config.processKeyForNamespace ? this.processKey(key) : {};
    var namespace = this.config.namespace || names.namespace || "AwsCloudWatchStatsdBackend";
    var metricName = this.config.metricName || names.metricName || key;
    var metricDimensions = [];

    if (mapFn) {
      mapRes = mapFn(metricName, "set");
      if (!mapRes) // skip this
        continue;

      metricName = mapRes.metricName;
      metricDimensions = mapRes.metricDimensions;
    }

    this.cloudwatch.putMetricData({
      MetricData : [{
      MetricName : metricName,
      Dimensions: metricDimensions,
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
  var cloudwatch = config.cloudwatch || {};
  var instances = cloudwatch.instances || [cloudwatch];
  for (key in instances) {
    instanceConfig = instances[key];
    console.log("Starting cloudwatch reporter instance in region:", instanceConfig.region);
    var instance = new CloudwatchBackend(startupTime, instanceConfig, events);
  }
  return true;
};
