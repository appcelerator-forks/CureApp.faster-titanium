"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _fileServer = require('./file-server');

var _fileServer2 = _interopRequireDefault(_fileServer);

var _fileWatcher = require('./file-watcher');

var _fileWatcher2 = _interopRequireDefault(_fileWatcher);

var _notificationServer = require('./notification-server');

var _notificationServer2 = _interopRequireDefault(_notificationServer);

var _contentResponder = require('./content-responder');

var _contentResponder2 = _interopRequireDefault(_contentResponder);

var _alloyCompiler = require('./alloy-compiler');

var _alloyCompiler2 = _interopRequireDefault(_alloyCompiler);

var _preferences = require('../common/preferences');

var _preferences2 = _interopRequireDefault(_preferences);

var _util = require('../common/util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var wait = function wait(msec) {
    return new Promise(function (y) {
        return setTimeout(y, msec);
    });
};
var ____ = (0, _debug2.default)('faster-titanium:MainProcess');
var ___x = function ___x(e) {
    return (0, _debug2.default)('faster-titanium:MainProcess:error')(e) || (0, _debug2.default)('faster-titanium:MainProcess:error')(e.stack);
};

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
});

/**
 * main process
 */

var MainProcess = function () {

    /**
     * @param {string} projDir
     * @param {Object} [options={}]
     * @param {number} fPort port number of the file server
     * @param {number} nPort port number of the notification server
     * @param {string} host host name or IP Address
     * @param {string} platform platform name (ios|android|mobileweb|windows)
     */

    function MainProcess(projDir) {
        var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

        _classCallCheck(this, MainProcess);

        var fPort = options.fPort;
        var nPort = options.nPort;
        var host = options.host;
        var platform = options.platform;

        /** @type {string} project dir */

        this.projDir = projDir;
        /** @type {string} hostname or IP Address */
        this.host = host;
        /** @type {string} platform os name of the Titanium App */
        this.platform = platform;
        /** @type {Preferences} */
        this.prefs = new _preferences2.default();
        /** @type {FileServer} */
        this.fServer = new _fileServer2.default(fPort, this.routes);
        /** @type {FileWatcher} */
        this.watcher = new _fileWatcher2.default(this.projDir);
        /** @type {NotificationServer} */
        this.nServer = new _notificationServer2.default(nPort);
        /** @type {number} #ongoing alloy compilation */
        this.alloyCompilations = 0;

        this.registerListeners();
    }

    /** @type {string} */


    _createClass(MainProcess, [{
        key: 'registerListeners',


        /**
         * register event listeners.
         * called only once in constructor
         * @private
         */
        value: function registerListeners() {

            this.fServer.on('error', ___x);
            this.nServer.on('error', ___x);
            this.watcher.on('error', ___x);

            this.watcher.on('change:Resources', this.onResourceFileChanged.bind(this));
            this.watcher.on('change:alloy', this.onAlloyFileChanged.bind(this));
        }

        /**
         * launch file server and notification server
         * @return {Promise}
         * @public
         */

    }, {
        key: 'launchServers',
        value: function launchServers() {
            ____('launching servers');
            return Promise.all([this.fServer.listen(), this.nServer.listen()]).catch(___x);
        }

        /**
         * starting file watching
         * @public
         */

    }, {
        key: 'watch',
        value: function watch() {
            ____('starting file watcher');
            this.watcher.watch();
        }

        /**
         * close servers and stop watching
         * @public
         */

    }, {
        key: 'end',
        value: function end() {
            ____('terminating servers');
            Promise.all([this.fServer.close(), this.nServer.close(), this.watcher.close()]);
        }

        /**
         * called when files in Resources directory changed
         * @param {string} path
         * @private
         */

    }, {
        key: 'onResourceFileChanged',
        value: function onResourceFileChanged(path) {
            if (this.alloyCompilations > 0) return;

            ____('changed: ' + path);

            this.sendEvent({ timer: 1000, names: [(0, _util.modNameByPath)(path, this.projDir, this.platform)] });
        }

        /**
         * Called when files in app directory (Alloy project) changed
         * Compile alloy. During compilation, unwatch Resources directory.
         * @param {string} path
         * @private
         */

    }, {
        key: 'onAlloyFileChanged',
        value: function onAlloyFileChanged(path) {
            var _this = this;

            ____('changed:alloy ' + path);

            this.send({ event: 'alloy-compilation' });

            this.alloyCompilations++;

            var changedFiles = []; // files in Resources changed by alloy compilation
            var poolChanged = function poolChanged(path) {
                return changedFiles.push((0, _util.modNameByPath)(path, _this.projDir, _this.platform));
            };

            this.watcher.on('change:Resources', poolChanged);

            /** @type {AlloyCompiler} */
            var compiler = new _alloyCompiler2.default(this.projDir, this.platform);
            return compiler.compile(path).catch(___x).then(function (x) {
                return _this.send({ event: 'alloy-compilation-done' });
            }).then(function (x) {
                return wait(100);
            }) // waiting for all change:Resources events are emitted
            .then(function (x) {
                return _this.sendEvent({ names: changedFiles });
            }).catch(___x).then(function (x) {
                return _this.watcher.removeListener('change:Resources', poolChanged);
            }).then(function (x) {
                return _this.alloyCompilations--;
            });
        }

        /**
         * send message to the client of notification server
         * @param {Object} payload
         * @param {string} payload.event event name. oneof alloy-compilation|alloy-compilation-done|reload|reflect
         */

    }, {
        key: 'send',
        value: function send(payload) {
            console.assert(payload && payload.event);
            this.nServer.send(payload);
        }

        /**
         * send reload|reflect event to the titanium client
         * @param {Object} [options={}]
         * @return {Promise}
         * @private
         */

    }, {
        key: 'sendEvent',
        value: function sendEvent() {
            var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

            var eventName = undefined;

            switch (this.prefs.style) {
                case 'manual':
                    return;
                case 'auto-reload':
                    eventName = 'reload';
                    break;
                case 'auto-reflect':
                    eventName = 'reflect';
                    break;
            }

            var payload = _extends({}, { event: eventName }, options);

            this.send(payload);
        }
    }, {
        key: 'url',
        get: function get() {
            return 'http://' + this.host + ':' + this.fPort + '/';
        }

        /** @type {number} */

    }, {
        key: 'fPort',
        get: function get() {
            return this.fServer.port;
        }

        /** @type {number} */

    }, {
        key: 'nPort',
        get: function get() {
            return this.nServer.port;
        }
    }, {
        key: 'routes',
        get: function get() {
            var _this2 = this;

            var responder = new _contentResponder2.default();
            return [['/', function (url) {
                return responder.webUI();
            }], ['/info', function (url) {
                return responder.respondJSON(_this2.info);
            }], ['/kill', function (url) {
                process.nextTick(_this2.end.bind(_this2));
                return responder.respond();
            }], ['/reload', function (url) {
                _this2.send({ event: 'reload', force: true });
                return responder.respond();
            }], ['/faster-titanium-web-js/main.js', function (url) {
                return responder.webJS();
            }], [/\/loading-style\/[0-9]$/, function (url) {
                var newValue = parseInt(url.slice(-1));
                var expression = _preferences2.default.expressions[newValue];
                if (!expression) {
                    return responder.notFound(url);
                }
                _this2.prefs.loadStyleNum = newValue;
                return responder.respondJSON({ newValue: newValue, expression: expression });
            }], [/^\//, function (url) {
                return (// any URL
                    responder.resource(url, _this2.projDir, _this2.platform)
                );
            }]];
        }

        /**
         * information of FasterTitanium process
         * @type {Object}
         */

    }, {
        key: 'info',
        get: function get() {
            return {
                'project root': this.projdir,
                'notification server port': this.nPort,
                'process uptime': process.uptime() + ' [sec]',
                'platform': this.platform,
                'loading style': this.prefs.style
            };
        }
    }]);

    return MainProcess;
}();

exports.default = MainProcess;