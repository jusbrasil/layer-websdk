'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * @class layer.Logger
 * @private
 *
 */
var _require$LOG = require('./const').LOG;

var DEBUG = _require$LOG.DEBUG;
var INFO = _require$LOG.INFO;
var WARN = _require$LOG.WARN;
var ERROR = _require$LOG.ERROR;
var NONE = _require$LOG.NONE;

var _require = require('./client-utils');

var isEmpty = _require.isEmpty;

// Pretty arbitrary test that IE/edge fails and others don't.  Yes I could do a more direct
// test for IE/edge but its hoped that MS will fix this around the time they cleanup their internal console object.

var supportsConsoleFormatting = Boolean(console.assert && console.assert.toString().match(/assert/));
var LayerCss = 'color: #888; font-weight: bold;';
var Black = 'color: black';
/* istanbulify ignore next */

var Logger = function () {
  function Logger() {
    _classCallCheck(this, Logger);
  }

  _createClass(Logger, [{
    key: 'log',
    value: function log(msg, obj, type, color) {
      /* istanbul ignore else */
      if ((typeof msg === 'undefined' ? 'undefined' : _typeof(msg)) === 'object') {
        obj = msg;
        msg = '';
      }
      var timestamp = new Date().toLocaleTimeString();
      var op;
      switch (type) {
        case DEBUG:
          op = 'debug';
          break;
        case INFO:
          op = 'info';
          break;
        case WARN:
          op = 'warn';
          break;
        case ERROR:
          op = 'error';
          break;
        default:
          op = 'log';
      }
      if (obj) {
        if (supportsConsoleFormatting) {
          console[op]('%cLayer%c ' + op.toUpperCase() + '%c [' + timestamp + ']: ' + msg, LayerCss, 'color: ' + color, Black, obj);
        } else {
          console[op]('Layer ' + op.toUpperCase() + ' [' + timestamp + ']: ' + msg, obj);
        }
      } else {
        if (supportsConsoleFormatting) {
          console[op]('%cLayer%c ' + op.toUpperCase() + '%c [' + timestamp + ']: ' + msg, LayerCss, 'color: ' + color, Black);
        } else {
          console[op]('Layer ' + op.toUpperCase() + ' [' + timestamp + ']: ' + msg);
        }
      }
    }
  }, {
    key: 'debug',
    value: function debug(msg, obj) {
      /* istanbul ignore next */
      if (this.level >= DEBUG) this.log(msg, obj, DEBUG, '#888');
    }
  }, {
    key: 'info',
    value: function info(msg, obj) {
      /* istanbul ignore next */
      if (this.level >= INFO) this.log(msg, obj, INFO, 'black');
    }
  }, {
    key: 'warn',
    value: function warn(msg, obj) {
      /* istanbul ignore next */
      if (this.level >= WARN) this.log(msg, obj, WARN, 'orange');
    }
  }, {
    key: 'error',
    value: function error(msg, obj) {
      /* istanbul ignore next */
      if (this.level >= ERROR) this.log(msg, obj, ERROR, 'red');
    }
  }]);

  return Logger;
}();

/* istanbul ignore next */


Logger.prototype.level = typeof jasmine === 'undefined' ? ERROR : NONE;

var logger = new Logger();

module.exports = logger;
//# sourceMappingURL=data:application/json;base64,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LEdBQXlDLElBQWxFOztBQUVBLElBQU0sU0FBUyxJQUFJLE1BQUosRUFBZjs7QUFFQSxPQUFPLE9BQVAsR0FBaUIsTUFBakIiLCJmaWxlIjoibG9nZ2VyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAY2xhc3MgbGF5ZXIuTG9nZ2VyXG4gKiBAcHJpdmF0ZVxuICpcbiAqL1xuY29uc3QgeyBERUJVRywgSU5GTywgV0FSTiwgRVJST1IsIE5PTkUgfSA9IHJlcXVpcmUoJy4vY29uc3QnKS5MT0c7XG5jb25zdCB7IGlzRW1wdHkgfSA9IHJlcXVpcmUoJy4vY2xpZW50LXV0aWxzJyk7XG5cbi8vIFByZXR0eSBhcmJpdHJhcnkgdGVzdCB0aGF0IElFL2VkZ2UgZmFpbHMgYW5kIG90aGVycyBkb24ndC4gIFllcyBJIGNvdWxkIGRvIGEgbW9yZSBkaXJlY3Rcbi8vIHRlc3QgZm9yIElFL2VkZ2UgYnV0IGl0cyBob3BlZCB0aGF0IE1TIHdpbGwgZml4IHRoaXMgYXJvdW5kIHRoZSB0aW1lIHRoZXkgY2xlYW51cCB0aGVpciBpbnRlcm5hbCBjb25zb2xlIG9iamVjdC5cbmNvbnN0IHN1cHBvcnRzQ29uc29sZUZvcm1hdHRpbmcgPSBCb29sZWFuKGNvbnNvbGUuYXNzZXJ0ICYmIGNvbnNvbGUuYXNzZXJ0LnRvU3RyaW5nKCkubWF0Y2goL2Fzc2VydC8pKTtcbmNvbnN0IExheWVyQ3NzID0gJ2NvbG9yOiAjODg4OyBmb250LXdlaWdodDogYm9sZDsnO1xuY29uc3QgQmxhY2sgPSAnY29sb3I6IGJsYWNrJztcbi8qIGlzdGFuYnVsaWZ5IGlnbm9yZSBuZXh0ICovXG5jbGFzcyBMb2dnZXIge1xuICBsb2cobXNnLCBvYmosIHR5cGUsIGNvbG9yKSB7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cbiAgICBpZiAodHlwZW9mIG1zZyA9PT0gJ29iamVjdCcpIHtcbiAgICAgIG9iaiA9IG1zZztcbiAgICAgIG1zZyA9ICcnO1xuICAgIH1cbiAgICBjb25zdCB0aW1lc3RhbXAgPSBuZXcgRGF0ZSgpLnRvTG9jYWxlVGltZVN0cmluZygpO1xuICAgIHZhciBvcDtcbiAgICBzd2l0Y2godHlwZSkge1xuICAgICAgY2FzZSBERUJVRzpcbiAgICAgICAgb3AgPSAnZGVidWcnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgSU5GTzpcbiAgICAgICAgb3AgPSAnaW5mbyc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBXQVJOOlxuICAgICAgICBvcCA9ICd3YXJuJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEVSUk9SOlxuICAgICAgICBvcCA9ICdlcnJvcic7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgb3AgPSAnbG9nJztcbiAgICB9XG4gICAgaWYgKG9iaikge1xuICAgICAgaWYgKHN1cHBvcnRzQ29uc29sZUZvcm1hdHRpbmcpIHtcbiAgICAgICAgY29uc29sZVtvcF0oYCVjTGF5ZXIlYyAke29wLnRvVXBwZXJDYXNlKCl9JWMgWyR7dGltZXN0YW1wfV06ICR7bXNnfWAsIExheWVyQ3NzLCBgY29sb3I6ICR7Y29sb3J9YCwgQmxhY2ssIG9iaik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlW29wXShgTGF5ZXIgJHtvcC50b1VwcGVyQ2FzZSgpfSBbJHt0aW1lc3RhbXB9XTogJHttc2d9YCwgb2JqKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHN1cHBvcnRzQ29uc29sZUZvcm1hdHRpbmcpIHtcbiAgICAgICAgY29uc29sZVtvcF0oYCVjTGF5ZXIlYyAke29wLnRvVXBwZXJDYXNlKCl9JWMgWyR7dGltZXN0YW1wfV06ICR7bXNnfWAsIExheWVyQ3NzLCBgY29sb3I6ICR7Y29sb3J9YCwgQmxhY2spO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZVtvcF0oYExheWVyICR7b3AudG9VcHBlckNhc2UoKX0gWyR7dGltZXN0YW1wfV06ICR7bXNnfWApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG5cbiAgZGVidWcobXNnLCBvYmopIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGlmICh0aGlzLmxldmVsID49IERFQlVHKSB0aGlzLmxvZyhtc2csIG9iaiwgREVCVUcsICcjODg4Jyk7XG4gIH1cblxuICBpbmZvKG1zZywgb2JqKSB7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICBpZiAodGhpcy5sZXZlbCA+PSBJTkZPKSB0aGlzLmxvZyhtc2csIG9iaiwgSU5GTywgJ2JsYWNrJyk7XG4gIH1cblxuICB3YXJuKG1zZywgb2JqKSB7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICBpZiAodGhpcy5sZXZlbCA+PSBXQVJOKSB0aGlzLmxvZyhtc2csIG9iaiwgV0FSTiwgJ29yYW5nZScpO1xuICB9XG5cbiAgZXJyb3IobXNnLCBvYmopIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGlmICh0aGlzLmxldmVsID49IEVSUk9SKSB0aGlzLmxvZyhtc2csIG9iaiwgRVJST1IsICdyZWQnKTtcbiAgfVxufVxuXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuTG9nZ2VyLnByb3RvdHlwZS5sZXZlbCA9IHR5cGVvZiBqYXNtaW5lID09PSAndW5kZWZpbmVkJyA/IEVSUk9SIDogTk9ORTtcblxuY29uc3QgbG9nZ2VyID0gbmV3IExvZ2dlcigpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGxvZ2dlcjtcbiJdfQ==
