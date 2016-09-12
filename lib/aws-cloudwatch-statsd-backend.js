var util = require('util');
var AWS = require('aws-sdk');

function CloudwatchBackend(startupTime, config, emitter) {
  var self = this;

  this.config = config || {};
  AWS.config = this.config;

  function setEmitter() {
    self.cloudwatch = new AWS.CloudWatch(self.config);
    emitter.on('flush', function(timestamp, metrics) { self.flush(timestamp, metrics); });
  }

  // if iamRole is set attempt to fetch credentials from the Metadata Service
  if (this.config.iamRole) {
    if (this.config.iamRole == 'any') {
      // If the iamRole is set to any, then attempt to fetch any available credentials
      ms = new AWS.EC2MetadataCredentials();
      ms.refresh(function(err) {
        if (err) { console.log('Failed to fetch IAM role credentials: ' + err); }
        self.config.credentials = ms;
        setEmitter();
      });
    } else {
      // however if it's set to specify a role, query it specifically.
      ms = new AWS.MetadataService();
      ms.request('/latest/meta-data/iam/security-credentials/' + this.config.iamRole, function(err, rdata) {
        var data = JSON.parse(rdata);

        if (err) { console.log('Failed to fetch IAM role credentials: ' + err); }
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
    metricName: parts[parts.length - 1],
    namespace: parts.length > 1 ? parts.splice(0, parts.length - 1).join("/") : null
  };
};

CloudwatchBackend.prototype.flush = function(timestamp, metrics) {

  console.log('Flushing metrics at ' + new Date(timestamp * 1000).toISOString());

  var counters = metrics.counters;
  var gauges = metrics.gauges;
  var timers = metrics.timers;
  var sets = metrics.sets;

  // put all currently accumulated counter metrics into an array
  var currentCounterMetrics = [];
  var namespace = "AwsCloudWatchStatsdBackend";
  for (key in counters) {
    if (key.indexOf('statsd.') == 0)
      continue;

    if (this.config.whitelist && this.config.whitelist.length > 0 && this.config.whitelist.indexOf(key) == -1) {
      console.log("Key (counter) " + key + " not in whitelist");
      continue;
    }

    var names = this.config.processKeyForNamespace ? this.processKey(key) : {};
    namespace = this.config.namespace || names.namespace || "AwsCloudWatchStatsdBackend";
    var metricName = this.config.metricName || names.metricName || key;

    currentCounterMetrics.push({
      MetricName: metricName,
      Unit: 'Count',
      Timestamp: new Date(timestamp * 1000).toISOString(),
      Value: counters[key]
    });
  }

  // send off the array (instead of one at a time)
  if (currentCounterMetrics.length > 0) {
    this.cloudwatch.putMetricData({
      MetricData: currentCounterMetrics,
      Namespace: namespace
    }, function(err, data) {
      if (err) {
        // log an error
        console.log(util.inspect(err));
      } else {
        // Success
        // console.log(util.inspect(data));
      }
    });
  }

  // put all currently accumulated timer metrics into an array
  var currentTimerMetrics = [];
  for (key in timers) {
    if (timers[key].length > 0) {

      if (this.config.whitelist && this.config.whitelist.length > 0 && this.config.whitelist.indexOf(key) == -1) {
        console.log("Key (counter) " + key + " not in whitelist");
        continue;
      }

      var values = timers[key].sort(function(a, b) {
        return a - b;
      });
      var count = values.length;
      var min = values[0];
      var max = values[count - 1];

      var cumulativeValues = [min];
      for (var i = 1; i < count; i++) {
        cumulativeValues.push(values[i] + cumulativeValues[i - 1]);
      }

      var sum = min;
      var mean = min;
      var maxAtThreshold = max;

      var message = "";

      var key2;

      sum = cumulativeValues[count - 1];
      mean = sum / count;

      var names = this.config.processKeyForNamespace ? this.processKey(key) : {};
      namespace = this.config.namespace || names.namespace || "AwsCloudWatchStatsdBackend";
      var metricName = this.config.metricName || names.metricName || key;

      currentTimerMetrics.push({
        MetricName: metricName,
        Unit: 'Milliseconds',
        Timestamp: new Date(timestamp * 1000).toISOString(),
        StatisticValues: {
          Minimum: min,
          Maximum: max,
          Sum: sum,
          SampleCount: count
        }
      });
    }
  }

  // send off the array (instead of one at a time)  
  if (currentTimerMetrics.length > 0) {
    this.cloudwatch.putMetricData({
      MetricData: currentTimerMetrics,
      Namespace: namespace
    }, function(err, data) {
      if (err) {
        // log an error
        console.log(util.inspect(err));
      } else {
        // Success
        // console.log(util.inspect(data));
      }
    });
  }

  // put all currently accumulated gauge metrics into an array
  var currentGaugeMetrics = [];
  for (key in gauges) {

    if (this.config.whitelist && this.config.whitelist.length > 0 && this.config.whitelist.indexOf(key) == -1) {
      console.log("Key (counter) " + key + " not in whitelist");
      continue;
    }

    var names = this.config.processKeyForNamespace ? this.processKey(key) : {};
    namespace = this.config.namespace || names.namespace || "AwsCloudWatchStatsdBackend";
    var metricName = this.config.metricName || names.metricName || key;

    currentGaugeMetrics.push({
      MetricName: metricName,
      Unit: 'None',
      Timestamp: new Date(timestamp * 1000).toISOString(),
      Value: gauges[key]
    });
  }

  // send off the array (instead of one at a time)
  if (currentGaugeMetrics.length > 0) {
    this.cloudwatch.putMetricData({
      MetricData: currentGaugeMetrics,
      Namespace: namespace
    }, function(err, data) {
      if (err) {
        // log an error
        console.log(util.inspect(err));
      } else {
        // Success
        // console.log(util.inspect(data));
      }
    });
  }

  // put all currently accumulated set metrics into an array
  var currentSetMetrics = [];
  for (key in sets) {

    if (this.config.whitelist && this.config.whitelist.length > 0 && this.config.whitelist.indexOf(key) == -1) {
      console.log("Key (counter) " + key + " not in whitelist");
      continue;
    }

    var names = this.config.processKeyForNamespace ? this.processKey(key) : {};
    namespace = this.config.namespace || names.namespace || "AwsCloudWatchStatsdBackend";
    var metricName = this.config.metricName || names.metricName || key;

    currentSetMetrics.push({
      MetricName: metricName,
      Unit: 'None',
      Timestamp: new Date(timestamp * 1000).toISOString(),
      Value: sets[key].values().length
    });
  }

  // send off the array (instead of one at a time)
  if (currentSetMetrics.length > 0) {
    this.cloudwatch.putMetricData({
      MetricData: currentSetMetrics,
      Namespace: namespace
    }, function(err, data) {
      if (err) {
        // log an error
        console.log(util.inspect(err));
      } else {
        // Success
        // console.log(util.inspect(data));
      }
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
