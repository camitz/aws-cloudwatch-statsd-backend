# StatsD backend for AWS CloudWatch

## Overview

[StatsD](https://github.com/etsy/statsd) is a smart Node.js package that collects and aggregates statistics from differents apps sent over the UDP protocol. At a set time interval it forwards the aggregated data to a configured backend. It is pluggable with several backends available, the most popular being [Graphite](https://github.com/graphite-project/graphite-web), a python/django monitoring tool.

With **aws-cloudwatch-statsd-backend** you can replace Graphite in favour of [AWS Cloudwatch](http://aws.amazon.com/cloudwatch/) for your monitoring purposes, appropriate for sites on the Amazon EC2 cloud.

Counters, timers, gauges and sets are all supported.

## Installation

You need node.js installed on your system aswell as StatsD. Follow the instructions on their sites or see this [blog post/tutorial](http://blog.simpletask.se/aws-clouwadwatch-statsd-backend/) on how to install these components on a Windows system.

The CloudWatch backend is an npm package that can be installed with the npm command which comes with your installation of node.js. Go to the [npm site](https://npmjs.org/) for more information.

    npm install aws-cloudwatch-statsd-backend

The package has two depdencies that should be installed automatically, [awssum](https://npmjs.org/package/awssum) and [fmt](https://npmjs.org/package/fmt). Awssum is a node.js package encapsulating the AWS API.

## Configuration

The StatsD and its backends are configured in a json object placed in a file supplied to StatsD at the command line. For example, start StatsD with the following.

    node ./stats.js ./myConfig.js

The following demonstrates the minimum config for the CloudWatch backend.

    {
        backends: [ "aws-cloudwatch-statsd-backend" ],
        cloudwatch: 
        {
            accessKeyId: 'YOUR_ACCESS_KEY_ID', 
            secretAccessKey:'YOUR_SECRET_ACCESS_KEY', 
            region:"YOUR_REGION"
        }
    }

The access keys can be you personal credentials to AWS but it is highly recommended to create an ad hoc user via Amazon's IAM service and use those credentials.

The region is for example `EU_WEST_1` or `US_EAST_1`. Region should be in capital letter and separated by `_` instead of `-`.

The above will create a metric with the default namespace, AwsCloudWatchStatsdBackend, and send an http request to CloudWatch via awssum.

See the CloudWatch [documentation](http://docs.amazonwebservices.com/AmazonCloudWatch/latest/DeveloperGuide/cloudwatch_concepts.html) for more information on these concepts.

The metric name, unit and value depends on what you send StatsD with your UDP request. For example, given

    gorets:1|c

the Unit will be Counter, the metric name gorets. The value will be the aggregated count as calculated by StatsD.

*ms* corresponds the unit *Milliseconds*. *s and *g* to *None*.

**Warning** Indescriminate use of CloudWatch metrics can quickly become costly. Amazon charges 50 cents for each combination of namepace, metric name and dimension per month. However, the 10 first per month are free.

## Additional configuration options

The cloudwatch backend provides ways to override the name and namespace by cofiguration. It can also capture these components from the bucket name.

The following overrides the default and any provided namespace or metric name with the specified.

    {
        backends: [ "aws-cloudwatch-statsd-backend" ],
        cloudwatch: 
        {
            accessKeyId: 'YOUR_ACCESS_KEY_ID', 
            secretAccessKey: 'YOUR_SECRET_ACCESS_KEY', 
            region: 'YOUR_REGION',
            namespace: 'App/Controller/Action', 
            metricName: 'Request'
        }
    }

Using the option *processKeyForNamespace* (default is false) you can parse the bucket name for namespace in addition to metric name. The backend will use the last component of a bucket name comprised of slash (/), dot (.) or dash (-) separated parts as the metric name. The remaining leading parts will be used as namespace. Separators will be replaced with slashes (/).

    {
        backends: [ "aws-cloudwatch-statsd-backend" ],
        cloudwatch: 
        {
            accessKeyId: 'YOUR_ACCESS_KEY_ID', 
            secretAccessKey: 'YOUR_SECRET_ACCESS_KEY', 
            region: 'YOUR_REGION',
            processKeyForNames:true
        }
    }

For example, sending StatsD the following

    App.Controller.Action.Request:1|c

is will produce the equivalent to the former configuration example. Note that both will be suppressed if overriden as in the former configuration example.

## Whitelisting Metrics

Using cloudwatch will incur a cost for each metric sent. In order to control your costs, you can optionally whitelist (by full metric name) those metrics sent to cloudwatch. For example:

    {
        backends: [ "aws-cloudwatch-statsd-backend" ],
        cloudwatch: 
        {
            accessKeyId: 'YOUR_ACCESS_KEY_ID', 
            secretAccessKey: 'YOUR_SECRET_ACCESS_KEY', 
            region: 'YOUR_REGION',
            whitelist: ['YOUR_FULL_METRIC_NAME']
        }
    }

The above configuration would only sent the metric named 'YOUR_FULL_METRIC_NAME' to cloudwatch. As this is an array, you can specify multiple metrics. This is useful if you are using multiple backends e.g. mysql backend and want to send some metrics cloudwatch (due to the associated cost) and all the metrics together to another backend. It is also useful if you want to limit the metrics you use in cloudwatch to those that raise alarms as part of your wider AWS hosted system.

## Using AWS Roles to obtain credentials

A preferable approach to obtaining account credentials is instead to query the Metadata Service to obtain IAM security credentials for a given role. If iamRole is set to 'any' then any available credentials found on the metadata service will instead be used. For example:

    {
        backends: [ "aws-cloudwatch-statsd-backend" ],
        cloudwatch:
        {
            iamRole: 'YOUR_ROLE_NAME',
            region: 'YOUR_REGION',
            whitelist: ['YOUR_FULL_METRIC_NAME']
        }
    }

## Multi-region support

If you wish to send cloudwatch metrics to multiple regions at once, instead of 

    {
        backends: [ "aws-cloudwatch-statsd-backend" ],
        cloudwatch: 
        {
            accessKeyId: 'YOUR_ACCESS_KEY_ID', 
            secretAccessKey:'YOUR_SECRET_ACCESS_KEY', 
            region:"YOUR_REGION"
        }
    }
    
you can use the `instances` key under `cloudwatch` to configure a list of configurations.

    {
        backends: ["aws-cloudwatch-statsd-backend"],
        cloudwatch: {
            instances: [{
                accessKeyId: 'YOUR_ACCESS_KEY_ID',
                secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
                region: "YOUR_REGION_1",
                whitelist: ['YOUR_FULL_METRIC_NAME1']
            }, {
                accessKeyId: 'YOUR_ACCESS_KEY_ID',
                secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
                region: "YOUR_REGION_2",
                whitelist: ['YOUR_FULL_METRIC_NAME2']
            }]
        }
    }


## Tutorial

This project was launched with a following [blog post/tutorial](http://blog.simpletask.se/post/aggregating-monitoring-statistics-for-aws-cloudwatch) describing the implementation chain from log4net to Cloudwatch on a Windows system.

Also in the series:

[Improving the CloudWatch Appender](http://blog.simpletask.se/post/improving-cloudwatch-appender)

[A CloudWatch Appender for log4net](http://blog.simpletask.se/post/awscloudwatch-log4net-appender)

[![endorse](http://api.coderwall.com/camitz/endorsecount.png)](http://coderwall.com/camitz)
