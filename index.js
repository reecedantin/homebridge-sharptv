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

  accessory.log('starting set');

  var client = new net.Socket();
  client.setTimeout(5000, function(err){
      accessory.log('Timed out connecting to ' + host + ':' + port);

  });
  client.connect(port, host, function() {
      accessory.log('CONNECTED TO: ' + host + ':' + port);
  });

  client.on('data', function(data) {
      client.write(command + '\r\n');
  });

  client.on('close', function() {
    accessory.log('Set ' + accessory.name + ' to ' + state);
    callback(null);
  });

  client.on('error', function (err) {
    accessory.log('Error: ' + err);
    client.destroy();
    callback(err || new Error('Error setting ' + accessory.name + ' to ' + state));
  });

  client.on('timeout', function () {
    client.destroy();
    callback(new Error('Error setting ' + accessory.name + ' to ' + state + ' -timedout'));
  });
}

SharpTVAccessory.prototype.getState = function(callback) {
  var accessory = this;
  var command = accessory['stateCommand'];
  var host = this.host;
  var port = this.port;
  var state;

  var client = new net.Socket();
  client.setTimeout(5000, function(err){
      accessory.log('Timed out connecting to ' + host + ':' + port);

  });
  client.connect(port, host, function() {
      client.write(command + '\r\n');
  });

  client.on('data', function(data) {
      state = data.toString('utf-8').trim();
      client.end();
  });

  client.on('close', function() {
    accessory.log('State of ' + accessory.name + ' is: ' + state);
    callback(null, accessory.matchesString(state));
  });

  client.on('error', function (err) {
    accessory.log('Error: ' + err);
    client.destroy();
  });

  client.on('timeout', function () {
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
