var Service;
var Characteristic;

var net = require('net');

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory("homebridge-sharptv", "SharpTV", SharpTVAccessory);
}

function SharpTVAccessory(log, config) {
  this.log = log;
  this.service = 'Switch';

  this.name		       = config['name'];
  this.onCommand	   = config['on'];
  this.offCommand	   = config['off'];
  this.stateCommand	 = config['state'];
  this.onValue		   = config['on_value'];
  this.onValue	   	 = this.onValue.trim();
  this.exactMatch	   = config['exact_match'] || true;
  this.host          = config['host'];
  this.port          = config['port'];
}

SharpTVAccessory.prototype.matchesString = function(match) {
  if(this.exactMatch) {
    return (match === this.onValue);
  }
  else {
    return (match.indexOf(this.onValue) > -1);
  }
}

SharpTVAccessory.prototype.setState = function(powerOn, callback) {
  var accessory = this;
  var state = powerOn ? 'on' : 'off';
  var prop = state + 'Command';
  var command = accessory[prop];
  var host = this.host;
  var port = this.port;
  var error;

  var client = new net.Socket();
  client.setTimeout(10000, function(err){
      accessory.log('Timed out connecting to ' + host + ':' + port);
  });
  client.connect(port, host, function() {
      client.write(command + '\r\n');
  });

  client.on('data', function(data) {
      client.end();
  });

  client.on('close', function() {
     if(!error){
         accessory.log('Set ' + accessory.name + ' to ' + state);
         callback(null);
     }
  });

  client.on('error', function (err) {
    accessory.log('Error: ' + err);
    error = err;
    client.destroy();
    callback(err || new Error('Error setting ' + accessory.name + ' to ' + state));
  });

  client.on('timeout', function () {
    error = "timedout";
    client.destroy();
    callback(new Error('Error setting ' + accessory.name + ' to ' + state + ' -timedout'));
  });
}

SharpTVAccessory.prototype.getState = function(callback) {
  var accessory = this;
  var command = accessory['stateCommand'];
  var host = this.host;
  var port = this.port;
  var state = "0";
  var error;

  var client = new net.Socket();
  client.setTimeout(1000, function(err){
      accessory.log('Timed out connecting to ' + host + ':' + port);

  });
  client.connect(port, host, function() {
      client.write(command + '\r\n');
  });

  client.on('data', function(data) {
      var input = data.toString('utf-8').trim();
      if(input !== "ERR") {
          if(input[0] === "1") {
              state = "1";
              client.end();
          } else {
              state = "0";
              client.end();
          }
      }
  });

  client.on('close', function() {
    //accessory.log('State of ' + accessory.name + ' is: ' + state);
    if(!error) {
        callback(null, accessory.matchesString("" + state));
    }
  });

  client.on('error', function (err) {
    accessory.log('Error: ' + err);
    client.destroy();
  });

  client.on('timeout', function () {
      error = "timedout";
      client.destroy();
      callback(new Error('Error setting ' + accessory.name + ' to ' + state + ' -timedout'));
  });
}

SharpTVAccessory.prototype.getServices = function() {
  var informationService = new Service.AccessoryInformation();
  var switchService = new Service.Switch(this.name);

  informationService
  .setCharacteristic(Characteristic.Manufacturer, 'SharpTV Manufacturer')
  .setCharacteristic(Characteristic.Model, 'SharpTV Model')
  .setCharacteristic(Characteristic.SerialNumber, 'SharpTV Serial Number');

  var characteristic = switchService.getCharacteristic(Characteristic.On)
  .on('set', this.setState.bind(this));

  if (this.stateCommand) {
    characteristic.on('get', this.getState.bind(this))
  };

  return [switchService];
}
