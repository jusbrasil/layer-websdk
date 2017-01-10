'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

/**
 * Utility methods
 *
 * @class layer.ClientUtils
 */

var LayerParser = require('layer-patch');
var uuid = require('uuid');
var atob = typeof window === 'undefined' ? require('atob') : window.atob;

/* istanbul ignore next */
var LocalFileReader = typeof window === 'undefined' ? require('filereader') : window.FileReader;

/**
 * Generate a random UUID
 *
 * @method
 * @return {string}
 */
exports.generateUUID = uuid.v4;

/**
 * Returns the 'type' portion of a Layer ID.
 *
 *         switch(Utils.typeFromID(id)) {
 *             case 'conversations':
 *                 ...
 *             case 'message':
 *                 ...
 *             case: 'queries':
 *                 ...
 *         }
 *
 * Does not currently handle Layer App IDs.
 *
 * @method
 * @param  {string} id
 * @return {string}
 */
exports.typeFromID = function (id) {
  var matches = id.match(/layer:\/\/\/(.*?)\//);
  return matches ? matches[1] : '';
};

exports.isEmpty = function (obj) {
  return Object.prototype.toString.apply(obj) === '[object Object]' && Object.keys(obj).length === 0;
};

/**
 * Simplified sort method.
 *
 * Provides a function to return the value to compare rather than do the comparison.
 *
 *      sortBy([{v: 3}, {v: 1}, v: 33}], function(value) {
 *          return value.v;
 *      }, false);
 *
 * @method
 * @param  {Mixed[]}   inArray      Array to sort
 * @param  {Function} fn            Function that will return a value to compare
 * @param  {Function} fn.value      Current value from inArray we are comparing, and from which a value should be extracted
 * @param  {boolean}  [reverse=false] Sort ascending (false) or descending (true)
 */
exports.sortBy = function (inArray, fn, reverse) {
  reverse = reverse ? -1 : 1;
  return inArray.sort(function (valueA, valueB) {
    var aa = fn(valueA);
    var bb = fn(valueB);
    if (aa === undefined && bb === undefined) return 0;
    if (aa === undefined && bb !== undefined) return 1;
    if (aa !== undefined && bb === undefined) return -1;
    if (aa > bb) return 1 * reverse;
    if (aa < bb) return -1 * reverse;
    return 0;
  });
};

/**
 * Quick and easy clone method.
 *
 * Does not work on circular references; should not be used
 * on objects with event listeners.
 *
 *      var newObj = Utils.clone(oldObj);
 *
 * @method
 * @param  {Object}     Object to clone
 * @return {Object}     New Object
 */
exports.clone = function (obj) {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Execute this function asynchronously.
 *
 * Defer will use SOME technique to delay execution of your function.
 * Defer() is intended for anything that should be processed after current execution has
 * completed, even if that means 0ms delay.
 *
 *      defer(function() {alert('That wasn't very long now was it!');});
 *
 * TODO: WEB-842: Add a postMessage handler.
 *
 * @method
 * @param  {Function} f
 */
exports.defer = function (func) {
  return setTimeout(func, 0);
};

/**
 * URL Decode a URL Encoded base64 string
 *
 * Copied from https://github.com/auth0-blog/angular-token-auth, but
 * appears in many places on the web.
 */
exports.decode = function (str) {
  var output = str.replace('-', '+').replace('_', '/');
  switch (output.length % 4) {
    case 0:
      break;
    case 2:
      output += '==';
      break;
    case 3:
      output += '=';
      break;
    default:
      throw new Error('Illegal base64url string!');
  }
  return atob(output);
};

/**
 * Returns a delay in seconds needed to follow an exponential
 * backoff pattern of delays for retrying a connection.
 *
 * Algorithm has two motivations:
 *
 * 1. Retry with increasingly long intervals up to some maximum interval
 * 2. Randomize the retry interval enough so that a thousand clients
 * all following the same algorithm at the same time will not hit the
 * server at the exact same times.
 *
 * The following are results before jitter for some values of counter:

      0: 0.1
      1: 0.2
      2: 0.4
      3: 0.8
      4: 1.6
      5: 3.2
      6: 6.4
      7: 12.8
      8: 25.6
      9: 51.2
      10: 102.4
      11. 204.8
      12. 409.6
      13. 819.2
      14. 1638.4 (27 minutes)

 * @method getExponentialBackoffSeconds
 * @param  {number} maxSeconds - This is not the maximum seconds delay, but rather
 * the maximum seconds delay BEFORE adding a randomized value.
 * @param  {number} counter - Current counter to use for calculating the delay; should be incremented up to some reasonable maximum value for each use.
 * @return {number}     Delay in seconds/fractions of a second
 */
exports.getExponentialBackoffSeconds = function getExponentialBackoffSeconds(maxSeconds, counter) {
  var secondsWaitTime = Math.pow(2, counter) / 10,
      secondsOffset = Math.random(); // value between 0-1 seconds.
  if (counter < 2) secondsOffset = secondsOffset / 4; // values less than 0.2 should be offset by 0-0.25 seconds
  else if (counter < 6) secondsOffset = secondsOffset / 2; // values between 0.2 and 1.0 should be offset by 0-0.5 seconds

  if (secondsWaitTime >= maxSeconds) secondsWaitTime = maxSeconds;

  return secondsWaitTime + secondsOffset;
};

/**
 * Is this data a blob?
 *
 * @method isBlob
 * @param {Mixed} value
 * @returns {Boolean} - True if its a blob, false if not.
 */
exports.isBlob = function (value) {
  return typeof Blob !== 'undefined' && value instanceof Blob;
};

/**
 * Given a blob return a base64 string.
 *
 * @method blobToBase64
 * @param {Blob} blob - data to convert to base64
 * @param {Function} callback
 * @param {String} callback.result - Your base64 string result
 */
exports.blobToBase64 = function (blob, callback) {
  var reader = new LocalFileReader();
  reader.readAsDataURL(blob);
  reader.onloadend = function () {
    return callback(reader.result.replace(/^.*?,/, ''));
  };
};

/**
 * Given a base64 string return a blob.
 *
 * @method base64ToBlob
 * @param {String} b64Data - base64 string data without any type prefixes
 * @param {String} contentType - mime type of the data
 * @returns {Blob}
 */
exports.base64ToBlob = function (b64Data, contentType) {
  try {
    var sliceSize = 512;
    var byteCharacters = atob(b64Data);
    var byteArrays = [];
    var offset = void 0;

    for (offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      var i = void 0;
      var slice = byteCharacters.slice(offset, offset + sliceSize);
      var byteNumbers = new Array(slice.length);
      for (i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      var byteArray = new Uint8Array(byteNumbers);

      byteArrays.push(byteArray);
    }

    var blob = new Blob(byteArrays, { type: contentType });
    return blob;
  } catch (e) {
    // noop
  }
  return null;
};

/**
 * Does window.btao() in a unicode-safe way
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/btoa#Unicode_strings
 *
 * @method utoa
 * @param {String} str
 * @return {String}
 */
exports.utoa = function (str) {
  return btoa(unescape(encodeURIComponent(str)));
};

/**
 * Does window.atob() in a way that can decode data from utoa()
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/btoa#Unicode_strings
 *
 * @method atou
 * @param {String} str
 * @return {String}
 */
exports.atou = function (str) {
  return decodeURIComponent(escape(atob(str)));
};

/**
 * Given a File/Blob return a string.
 *
 * Assumes blob represents textual data.
 *
 * @method fetchTextFromFile
 * @param {Blob} file
 * @param {Function} callback
 * @param {String} callback.result
 */
exports.fetchTextFromFile = function (file, callback) {
  if (typeof file === 'string') return callback(file);
  var reader = new LocalFileReader();
  reader.addEventListener('loadend', function () {
    callback(reader.result);
  });
  reader.readAsText(file);
};

var parser = void 0;

/**
 * Creates a LayerParser
 *
 * @method
 * @private
 * @param {Object} request - see layer.ClientUtils.layerParse
 */
function createParser(request) {
  request.client.once('destroy', function () {
    return parser = null;
  });

  parser = new LayerParser({
    camelCase: true,
    getObjectCallback: function getObjectCallback(id) {
      return request.client._getObject(id);
    },
    createObjectCallback: function createObjectCallback(id, obj) {
      return request.client._createObject(obj);
    },
    propertyNameMap: {
      Conversation: {
        unreadMessageCount: 'unreadCount'
      }
    },
    changeCallbacks: {
      Message: {
        all: function all(updateObject, newValue, oldValue, paths) {
          updateObject._handlePatchEvent(newValue, oldValue, paths);
        }
      },
      Conversation: {
        all: function all(updateObject, newValue, oldValue, paths) {
          updateObject._handlePatchEvent(newValue, oldValue, paths);
        }
      }
    }
  });
}

/**
 * Run the Layer Parser on the request.
 *
 * Parameters here
 * are the parameters specied in [Layer-Patch](https://github.com/layerhq/node-layer-patch), plus
 * a client object.
 *
 *      Util.layerParse({
 *          object: conversation,
 *          type: 'Conversation',
 *          operations: layerPatchOperations,
 *          client: client
 *      });
 *
 * @method
 * @param {Object} request - layer-patch parameters
 * @param {Object} request.object - Object being updated  by the operations
 * @param {string} request.type - Type of object being updated
 * @param {Object[]} request.operations - Array of change operations to perform upon the object
 * @param {layer.Client} request.client
 */
exports.layerParse = function (request) {
  if (!parser) createParser(request);
  parser.parse(request);
};

/**
 * Object comparison.
 *
 * Does a recursive traversal of two objects verifying that they are the same.
 * Is able to make metadata-restricted assumptions such as that
 * all values are either plain Objects or strings.
 *
 *      if (Utils.doesObjectMatch(conv1.metadata, conv2.metadata)) {
 *          alert('These two metadata objects are the same');
 *      }
 *
 * @method
 * @param  {Object} requestedData
 * @param  {Object} actualData
 * @return {boolean}
 */
exports.doesObjectMatch = function (requestedData, actualData) {
  if (!requestedData && actualData || requestedData && !actualData) return false;
  var requestedKeys = Object.keys(requestedData).sort();
  var actualKeys = Object.keys(actualData).sort();

  // If there are a different number of keys, fail.
  if (requestedKeys.length !== actualKeys.length) return false;

  // Compare key name and value at each index
  for (var index = 0; index < requestedKeys.length; index++) {
    var k1 = requestedKeys[index];
    var k2 = actualKeys[index];
    var v1 = requestedData[k1];
    var v2 = actualData[k2];
    if (k1 !== k2) return false;
    if (v1 && (typeof v1 === 'undefined' ? 'undefined' : _typeof(v1)) === 'object') {
      // Array comparison is not used by the Web SDK at this time.
      if (Array.isArray(v1)) {
        throw new Error('Array comparison not handled yet');
      } else if (!exports.doesObjectMatch(v1, v2)) {
        return false;
      }
    } else if (v1 !== v2) {
      return false;
    }
  }
  return true;
};

/**
 * Simple array inclusion test
 * @method includes
 * @param {Mixed[]} items
 * @param {Mixed} value
 * @returns {boolean}
 */
exports.includes = function (items, value) {
  return items.indexOf(value) !== -1;
};

/**
 * Some ASCII art when client initializes
 */
exports.asciiInit = function (version) {
  if (!version) return 'Missing version';

  var split = version.split('-');
  var line1 = split[0] || '';
  var line2 = split[1] || '';

  line1 += new Array(13 - line1.length).join(' ');
  line2 += new Array(14 - line2.length).join(' ');

  return '\n    /hNMMMMMMMMMMMMMMMMMMMms.\n  hMMy+/////////////////omMN-        \'oo.\n  MMN                    oMMo        .MM/\n  MMN                    oMMo        .MM/              ....                       ....            ...\n  MMN       Web SDK      oMMo        .MM/           ohdddddddo\' +md.      smy  -sddddddho.   hmosddmm.\n  MMM-                   oMMo        .MM/           ::.\'  \'.mM+ \'hMd\'    +Mm. +Nm/\'   .+Nm-  mMNs-\'.\n  MMMy      v' + line1 + 'oMMo        .MM/             .-:/+yNMs  .mMs   /MN: .MMs///////dMh  mMy\n  MMMMo     ' + line2 + 'oMMo        .MM/          .ymhyso+:hMs   :MM/ -NM/  :MMsooooooooo+  mM+\n  MMMMMy.                oMMo        .MM/          dMy\'    \'dMs    +MN:mM+   \'NMo            mM+\n  MMMMMMNy:\'             oMMo        .MMy++++++++: sMm/---/dNMs     yMMMs     -dMd+:-:/smy\'  mM+\n  NMMMMMMMMmy+:-.\'      \'yMM/        \'yyyyyyyyyyyo  :shhhys:+y/     .MMh       \'-oyhhhys:\'   sy:\n  :dMMMMMMMMMMMMNNNNNNNNNMNs                                        hMd\'\n   -/+++++++++++++++++++:\'                                      sNmdo\'';
};
//# sourceMappingURL=data:application/json;base64,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QVEsS0FBUjtBQUFBLFNBQWtCLE1BQU0sT0FBTixDQUFjLEtBQWQsTUFBeUIsQ0FBQyxDQUE1QztBQUFBLENBQW5COztBQUVBOzs7QUFHQSxRQUFRLFNBQVIsR0FBb0IsVUFBQyxPQUFELEVBQWE7QUFDL0IsTUFBSSxDQUFDLE9BQUwsRUFBYyxPQUFPLGlCQUFQOztBQUVkLE1BQU0sUUFBUSxRQUFRLEtBQVIsQ0FBYyxHQUFkLENBQWQ7QUFDQSxNQUFJLFFBQVEsTUFBTSxDQUFOLEtBQVksRUFBeEI7QUFDQSxNQUFJLFFBQVEsTUFBTSxDQUFOLEtBQVksRUFBeEI7O0FBRUEsV0FBUyxJQUFJLEtBQUosQ0FBVSxLQUFLLE1BQU0sTUFBckIsRUFBNkIsSUFBN0IsQ0FBa0MsR0FBbEMsQ0FBVDtBQUNBLFdBQVMsSUFBSSxLQUFKLENBQVUsS0FBSyxNQUFNLE1BQXJCLEVBQTZCLElBQTdCLENBQWtDLEdBQWxDLENBQVQ7O0FBRUEsK2NBT2EsS0FQYiw2RkFRWSxLQVJaO0FBY0EsQ0F4QkYiLCJmaWxlIjoiY2xpZW50LXV0aWxzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBVdGlsaXR5IG1ldGhvZHNcbiAqXG4gKiBAY2xhc3MgbGF5ZXIuQ2xpZW50VXRpbHNcbiAqL1xuXG5jb25zdCBMYXllclBhcnNlciA9IHJlcXVpcmUoJ2xheWVyLXBhdGNoJyk7XG5jb25zdCB1dWlkID0gcmVxdWlyZSgndXVpZCcpO1xuY29uc3QgYXRvYiA9IHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnID8gcmVxdWlyZSgnYXRvYicpIDogd2luZG93LmF0b2I7XG5cbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5jb25zdCBMb2NhbEZpbGVSZWFkZXIgPSB0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJyA/IHJlcXVpcmUoJ2ZpbGVyZWFkZXInKSA6IHdpbmRvdy5GaWxlUmVhZGVyO1xuXG4vKipcbiAqIEdlbmVyYXRlIGEgcmFuZG9tIFVVSURcbiAqXG4gKiBAbWV0aG9kXG4gKiBAcmV0dXJuIHtzdHJpbmd9XG4gKi9cbmV4cG9ydHMuZ2VuZXJhdGVVVUlEID0gdXVpZC52NDtcblxuXG4vKipcbiAqIFJldHVybnMgdGhlICd0eXBlJyBwb3J0aW9uIG9mIGEgTGF5ZXIgSUQuXG4gKlxuICogICAgICAgICBzd2l0Y2goVXRpbHMudHlwZUZyb21JRChpZCkpIHtcbiAqICAgICAgICAgICAgIGNhc2UgJ2NvbnZlcnNhdGlvbnMnOlxuICogICAgICAgICAgICAgICAgIC4uLlxuICogICAgICAgICAgICAgY2FzZSAnbWVzc2FnZSc6XG4gKiAgICAgICAgICAgICAgICAgLi4uXG4gKiAgICAgICAgICAgICBjYXNlOiAncXVlcmllcyc6XG4gKiAgICAgICAgICAgICAgICAgLi4uXG4gKiAgICAgICAgIH1cbiAqXG4gKiBEb2VzIG5vdCBjdXJyZW50bHkgaGFuZGxlIExheWVyIEFwcCBJRHMuXG4gKlxuICogQG1ldGhvZFxuICogQHBhcmFtICB7c3RyaW5nfSBpZFxuICogQHJldHVybiB7c3RyaW5nfVxuICovXG5leHBvcnRzLnR5cGVGcm9tSUQgPSAoaWQpID0+IHtcbiAgY29uc3QgbWF0Y2hlcyA9IGlkLm1hdGNoKC9sYXllcjpcXC9cXC9cXC8oLio/KVxcLy8pO1xuICByZXR1cm4gbWF0Y2hlcyA/IG1hdGNoZXNbMV0gOiAnJztcbn07XG5cbmV4cG9ydHMuaXNFbXB0eSA9IChvYmopID0+IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuYXBwbHkob2JqKSA9PT0gJ1tvYmplY3QgT2JqZWN0XScgJiYgT2JqZWN0LmtleXMob2JqKS5sZW5ndGggPT09IDA7XG5cbi8qKlxuICogU2ltcGxpZmllZCBzb3J0IG1ldGhvZC5cbiAqXG4gKiBQcm92aWRlcyBhIGZ1bmN0aW9uIHRvIHJldHVybiB0aGUgdmFsdWUgdG8gY29tcGFyZSByYXRoZXIgdGhhbiBkbyB0aGUgY29tcGFyaXNvbi5cbiAqXG4gKiAgICAgIHNvcnRCeShbe3Y6IDN9LCB7djogMX0sIHY6IDMzfV0sIGZ1bmN0aW9uKHZhbHVlKSB7XG4gKiAgICAgICAgICByZXR1cm4gdmFsdWUudjtcbiAqICAgICAgfSwgZmFsc2UpO1xuICpcbiAqIEBtZXRob2RcbiAqIEBwYXJhbSAge01peGVkW119ICAgaW5BcnJheSAgICAgIEFycmF5IHRvIHNvcnRcbiAqIEBwYXJhbSAge0Z1bmN0aW9ufSBmbiAgICAgICAgICAgIEZ1bmN0aW9uIHRoYXQgd2lsbCByZXR1cm4gYSB2YWx1ZSB0byBjb21wYXJlXG4gKiBAcGFyYW0gIHtGdW5jdGlvbn0gZm4udmFsdWUgICAgICBDdXJyZW50IHZhbHVlIGZyb20gaW5BcnJheSB3ZSBhcmUgY29tcGFyaW5nLCBhbmQgZnJvbSB3aGljaCBhIHZhbHVlIHNob3VsZCBiZSBleHRyYWN0ZWRcbiAqIEBwYXJhbSAge2Jvb2xlYW59ICBbcmV2ZXJzZT1mYWxzZV0gU29ydCBhc2NlbmRpbmcgKGZhbHNlKSBvciBkZXNjZW5kaW5nICh0cnVlKVxuICovXG5leHBvcnRzLnNvcnRCeSA9IChpbkFycmF5LCBmbiwgcmV2ZXJzZSkgPT4ge1xuICByZXZlcnNlID0gcmV2ZXJzZSA/IC0xIDogMTtcbiAgcmV0dXJuIGluQXJyYXkuc29ydCgodmFsdWVBLCB2YWx1ZUIpID0+IHtcbiAgICBjb25zdCBhYSA9IGZuKHZhbHVlQSk7XG4gICAgY29uc3QgYmIgPSBmbih2YWx1ZUIpO1xuICAgIGlmIChhYSA9PT0gdW5kZWZpbmVkICYmIGJiID09PSB1bmRlZmluZWQpIHJldHVybiAwO1xuICAgIGlmIChhYSA9PT0gdW5kZWZpbmVkICYmIGJiICE9PSB1bmRlZmluZWQpIHJldHVybiAxO1xuICAgIGlmIChhYSAhPT0gdW5kZWZpbmVkICYmIGJiID09PSB1bmRlZmluZWQpIHJldHVybiAtMTtcbiAgICBpZiAoYWEgPiBiYikgcmV0dXJuIDEgKiByZXZlcnNlO1xuICAgIGlmIChhYSA8IGJiKSByZXR1cm4gLTEgKiByZXZlcnNlO1xuICAgIHJldHVybiAwO1xuICB9KTtcbn07XG5cbi8qKlxuICogUXVpY2sgYW5kIGVhc3kgY2xvbmUgbWV0aG9kLlxuICpcbiAqIERvZXMgbm90IHdvcmsgb24gY2lyY3VsYXIgcmVmZXJlbmNlczsgc2hvdWxkIG5vdCBiZSB1c2VkXG4gKiBvbiBvYmplY3RzIHdpdGggZXZlbnQgbGlzdGVuZXJzLlxuICpcbiAqICAgICAgdmFyIG5ld09iaiA9IFV0aWxzLmNsb25lKG9sZE9iaik7XG4gKlxuICogQG1ldGhvZFxuICogQHBhcmFtICB7T2JqZWN0fSAgICAgT2JqZWN0IHRvIGNsb25lXG4gKiBAcmV0dXJuIHtPYmplY3R9ICAgICBOZXcgT2JqZWN0XG4gKi9cbmV4cG9ydHMuY2xvbmUgPSAob2JqKSA9PiBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KG9iaikpO1xuXG4vKipcbiAqIEV4ZWN1dGUgdGhpcyBmdW5jdGlvbiBhc3luY2hyb25vdXNseS5cbiAqXG4gKiBEZWZlciB3aWxsIHVzZSBTT01FIHRlY2huaXF1ZSB0byBkZWxheSBleGVjdXRpb24gb2YgeW91ciBmdW5jdGlvbi5cbiAqIERlZmVyKCkgaXMgaW50ZW5kZWQgZm9yIGFueXRoaW5nIHRoYXQgc2hvdWxkIGJlIHByb2Nlc3NlZCBhZnRlciBjdXJyZW50IGV4ZWN1dGlvbiBoYXNcbiAqIGNvbXBsZXRlZCwgZXZlbiBpZiB0aGF0IG1lYW5zIDBtcyBkZWxheS5cbiAqXG4gKiAgICAgIGRlZmVyKGZ1bmN0aW9uKCkge2FsZXJ0KCdUaGF0IHdhc24ndCB2ZXJ5IGxvbmcgbm93IHdhcyBpdCEnKTt9KTtcbiAqXG4gKiBUT0RPOiBXRUItODQyOiBBZGQgYSBwb3N0TWVzc2FnZSBoYW5kbGVyLlxuICpcbiAqIEBtZXRob2RcbiAqIEBwYXJhbSAge0Z1bmN0aW9ufSBmXG4gKi9cbmV4cG9ydHMuZGVmZXIgPSAoZnVuYykgPT4gc2V0VGltZW91dChmdW5jLCAwKTtcblxuLyoqXG4gKiBVUkwgRGVjb2RlIGEgVVJMIEVuY29kZWQgYmFzZTY0IHN0cmluZ1xuICpcbiAqIENvcGllZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9hdXRoMC1ibG9nL2FuZ3VsYXItdG9rZW4tYXV0aCwgYnV0XG4gKiBhcHBlYXJzIGluIG1hbnkgcGxhY2VzIG9uIHRoZSB3ZWIuXG4gKi9cbmV4cG9ydHMuZGVjb2RlID0gKHN0cikgPT4ge1xuICBsZXQgb3V0cHV0ID0gc3RyLnJlcGxhY2UoJy0nLCAnKycpLnJlcGxhY2UoJ18nLCAnLycpO1xuICBzd2l0Y2ggKG91dHB1dC5sZW5ndGggJSA0KSB7XG4gICAgY2FzZSAwOlxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAyOlxuICAgICAgb3V0cHV0ICs9ICc9PSc7XG4gICAgICBicmVhaztcbiAgICBjYXNlIDM6XG4gICAgICBvdXRwdXQgKz0gJz0nO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignSWxsZWdhbCBiYXNlNjR1cmwgc3RyaW5nIScpO1xuICB9XG4gIHJldHVybiBhdG9iKG91dHB1dCk7XG59O1xuXG5cbi8qKlxuICogUmV0dXJucyBhIGRlbGF5IGluIHNlY29uZHMgbmVlZGVkIHRvIGZvbGxvdyBhbiBleHBvbmVudGlhbFxuICogYmFja29mZiBwYXR0ZXJuIG9mIGRlbGF5cyBmb3IgcmV0cnlpbmcgYSBjb25uZWN0aW9uLlxuICpcbiAqIEFsZ29yaXRobSBoYXMgdHdvIG1vdGl2YXRpb25zOlxuICpcbiAqIDEuIFJldHJ5IHdpdGggaW5jcmVhc2luZ2x5IGxvbmcgaW50ZXJ2YWxzIHVwIHRvIHNvbWUgbWF4aW11bSBpbnRlcnZhbFxuICogMi4gUmFuZG9taXplIHRoZSByZXRyeSBpbnRlcnZhbCBlbm91Z2ggc28gdGhhdCBhIHRob3VzYW5kIGNsaWVudHNcbiAqIGFsbCBmb2xsb3dpbmcgdGhlIHNhbWUgYWxnb3JpdGhtIGF0IHRoZSBzYW1lIHRpbWUgd2lsbCBub3QgaGl0IHRoZVxuICogc2VydmVyIGF0IHRoZSBleGFjdCBzYW1lIHRpbWVzLlxuICpcbiAqIFRoZSBmb2xsb3dpbmcgYXJlIHJlc3VsdHMgYmVmb3JlIGppdHRlciBmb3Igc29tZSB2YWx1ZXMgb2YgY291bnRlcjpcblxuICAgICAgMDogMC4xXG4gICAgICAxOiAwLjJcbiAgICAgIDI6IDAuNFxuICAgICAgMzogMC44XG4gICAgICA0OiAxLjZcbiAgICAgIDU6IDMuMlxuICAgICAgNjogNi40XG4gICAgICA3OiAxMi44XG4gICAgICA4OiAyNS42XG4gICAgICA5OiA1MS4yXG4gICAgICAxMDogMTAyLjRcbiAgICAgIDExLiAyMDQuOFxuICAgICAgMTIuIDQwOS42XG4gICAgICAxMy4gODE5LjJcbiAgICAgIDE0LiAxNjM4LjQgKDI3IG1pbnV0ZXMpXG5cbiAqIEBtZXRob2QgZ2V0RXhwb25lbnRpYWxCYWNrb2ZmU2Vjb25kc1xuICogQHBhcmFtICB7bnVtYmVyfSBtYXhTZWNvbmRzIC0gVGhpcyBpcyBub3QgdGhlIG1heGltdW0gc2Vjb25kcyBkZWxheSwgYnV0IHJhdGhlclxuICogdGhlIG1heGltdW0gc2Vjb25kcyBkZWxheSBCRUZPUkUgYWRkaW5nIGEgcmFuZG9taXplZCB2YWx1ZS5cbiAqIEBwYXJhbSAge251bWJlcn0gY291bnRlciAtIEN1cnJlbnQgY291bnRlciB0byB1c2UgZm9yIGNhbGN1bGF0aW5nIHRoZSBkZWxheTsgc2hvdWxkIGJlIGluY3JlbWVudGVkIHVwIHRvIHNvbWUgcmVhc29uYWJsZSBtYXhpbXVtIHZhbHVlIGZvciBlYWNoIHVzZS5cbiAqIEByZXR1cm4ge251bWJlcn0gICAgIERlbGF5IGluIHNlY29uZHMvZnJhY3Rpb25zIG9mIGEgc2Vjb25kXG4gKi9cbmV4cG9ydHMuZ2V0RXhwb25lbnRpYWxCYWNrb2ZmU2Vjb25kcyA9IGZ1bmN0aW9uIGdldEV4cG9uZW50aWFsQmFja29mZlNlY29uZHMobWF4U2Vjb25kcywgY291bnRlcikge1xuICBsZXQgc2Vjb25kc1dhaXRUaW1lID0gTWF0aC5wb3coMiwgY291bnRlcikgLyAxMCxcbiAgICBzZWNvbmRzT2Zmc2V0ID0gTWF0aC5yYW5kb20oKTsgLy8gdmFsdWUgYmV0d2VlbiAwLTEgc2Vjb25kcy5cbiAgaWYgKGNvdW50ZXIgPCAyKSBzZWNvbmRzT2Zmc2V0ID0gc2Vjb25kc09mZnNldCAvIDQ7IC8vIHZhbHVlcyBsZXNzIHRoYW4gMC4yIHNob3VsZCBiZSBvZmZzZXQgYnkgMC0wLjI1IHNlY29uZHNcbiAgZWxzZSBpZiAoY291bnRlciA8IDYpIHNlY29uZHNPZmZzZXQgPSBzZWNvbmRzT2Zmc2V0IC8gMjsgLy8gdmFsdWVzIGJldHdlZW4gMC4yIGFuZCAxLjAgc2hvdWxkIGJlIG9mZnNldCBieSAwLTAuNSBzZWNvbmRzXG5cbiAgaWYgKHNlY29uZHNXYWl0VGltZSA+PSBtYXhTZWNvbmRzKSBzZWNvbmRzV2FpdFRpbWUgPSBtYXhTZWNvbmRzO1xuXG4gIHJldHVybiBzZWNvbmRzV2FpdFRpbWUgKyBzZWNvbmRzT2Zmc2V0O1xufTtcblxuLyoqXG4gKiBJcyB0aGlzIGRhdGEgYSBibG9iP1xuICpcbiAqIEBtZXRob2QgaXNCbG9iXG4gKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICogQHJldHVybnMge0Jvb2xlYW59IC0gVHJ1ZSBpZiBpdHMgYSBibG9iLCBmYWxzZSBpZiBub3QuXG4gKi9cbmV4cG9ydHMuaXNCbG9iID0gKHZhbHVlKSA9PiB0eXBlb2YgQmxvYiAhPT0gJ3VuZGVmaW5lZCcgJiYgdmFsdWUgaW5zdGFuY2VvZiBCbG9iO1xuXG4vKipcbiAqIEdpdmVuIGEgYmxvYiByZXR1cm4gYSBiYXNlNjQgc3RyaW5nLlxuICpcbiAqIEBtZXRob2QgYmxvYlRvQmFzZTY0XG4gKiBAcGFyYW0ge0Jsb2J9IGJsb2IgLSBkYXRhIHRvIGNvbnZlcnQgdG8gYmFzZTY0XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICogQHBhcmFtIHtTdHJpbmd9IGNhbGxiYWNrLnJlc3VsdCAtIFlvdXIgYmFzZTY0IHN0cmluZyByZXN1bHRcbiAqL1xuZXhwb3J0cy5ibG9iVG9CYXNlNjQgPSAoYmxvYiwgY2FsbGJhY2spID0+IHtcbiAgY29uc3QgcmVhZGVyID0gbmV3IExvY2FsRmlsZVJlYWRlcigpO1xuICByZWFkZXIucmVhZEFzRGF0YVVSTChibG9iKTtcbiAgcmVhZGVyLm9ubG9hZGVuZCA9ICgpID0+IGNhbGxiYWNrKHJlYWRlci5yZXN1bHQucmVwbGFjZSgvXi4qPywvLCAnJykpO1xufTtcblxuXG4vKipcbiAqIEdpdmVuIGEgYmFzZTY0IHN0cmluZyByZXR1cm4gYSBibG9iLlxuICpcbiAqIEBtZXRob2QgYmFzZTY0VG9CbG9iXG4gKiBAcGFyYW0ge1N0cmluZ30gYjY0RGF0YSAtIGJhc2U2NCBzdHJpbmcgZGF0YSB3aXRob3V0IGFueSB0eXBlIHByZWZpeGVzXG4gKiBAcGFyYW0ge1N0cmluZ30gY29udGVudFR5cGUgLSBtaW1lIHR5cGUgb2YgdGhlIGRhdGFcbiAqIEByZXR1cm5zIHtCbG9ifVxuICovXG5leHBvcnRzLmJhc2U2NFRvQmxvYiA9IChiNjREYXRhLCBjb250ZW50VHlwZSkgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHNsaWNlU2l6ZSA9IDUxMjtcbiAgICBjb25zdCBieXRlQ2hhcmFjdGVycyA9IGF0b2IoYjY0RGF0YSk7XG4gICAgY29uc3QgYnl0ZUFycmF5cyA9IFtdO1xuICAgIGxldCBvZmZzZXQ7XG5cbiAgICBmb3IgKG9mZnNldCA9IDA7IG9mZnNldCA8IGJ5dGVDaGFyYWN0ZXJzLmxlbmd0aDsgb2Zmc2V0ICs9IHNsaWNlU2l6ZSkge1xuICAgICAgbGV0IGk7XG4gICAgICBjb25zdCBzbGljZSA9IGJ5dGVDaGFyYWN0ZXJzLnNsaWNlKG9mZnNldCwgb2Zmc2V0ICsgc2xpY2VTaXplKTtcbiAgICAgIGNvbnN0IGJ5dGVOdW1iZXJzID0gbmV3IEFycmF5KHNsaWNlLmxlbmd0aCk7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgc2xpY2UubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYnl0ZU51bWJlcnNbaV0gPSBzbGljZS5jaGFyQ29kZUF0KGkpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBieXRlQXJyYXkgPSBuZXcgVWludDhBcnJheShieXRlTnVtYmVycyk7XG5cbiAgICAgIGJ5dGVBcnJheXMucHVzaChieXRlQXJyYXkpO1xuICAgIH1cblxuICAgIGNvbnN0IGJsb2IgPSBuZXcgQmxvYihieXRlQXJyYXlzLCB7IHR5cGU6IGNvbnRlbnRUeXBlIH0pO1xuICAgIHJldHVybiBibG9iO1xuICB9IGNhdGNoIChlKSB7XG4gICAgLy8gbm9vcFxuICB9XG4gIHJldHVybiBudWxsO1xufTtcblxuLyoqXG4gKiBEb2VzIHdpbmRvdy5idGFvKCkgaW4gYSB1bmljb2RlLXNhZmUgd2F5XG4gKlxuICogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1dpbmRvd0Jhc2U2NC9idG9hI1VuaWNvZGVfc3RyaW5nc1xuICpcbiAqIEBtZXRob2QgdXRvYVxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5leHBvcnRzLnV0b2EgPSAoc3RyKSA9PiBidG9hKHVuZXNjYXBlKGVuY29kZVVSSUNvbXBvbmVudChzdHIpKSk7XG5cbi8qKlxuICogRG9lcyB3aW5kb3cuYXRvYigpIGluIGEgd2F5IHRoYXQgY2FuIGRlY29kZSBkYXRhIGZyb20gdXRvYSgpXG4gKlxuICogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1dpbmRvd0Jhc2U2NC9idG9hI1VuaWNvZGVfc3RyaW5nc1xuICpcbiAqIEBtZXRob2QgYXRvdVxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5leHBvcnRzLmF0b3UgPSAoc3RyKSA9PiBkZWNvZGVVUklDb21wb25lbnQoZXNjYXBlKGF0b2Ioc3RyKSkpO1xuXG5cbi8qKlxuICogR2l2ZW4gYSBGaWxlL0Jsb2IgcmV0dXJuIGEgc3RyaW5nLlxuICpcbiAqIEFzc3VtZXMgYmxvYiByZXByZXNlbnRzIHRleHR1YWwgZGF0YS5cbiAqXG4gKiBAbWV0aG9kIGZldGNoVGV4dEZyb21GaWxlXG4gKiBAcGFyYW0ge0Jsb2J9IGZpbGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKiBAcGFyYW0ge1N0cmluZ30gY2FsbGJhY2sucmVzdWx0XG4gKi9cbmV4cG9ydHMuZmV0Y2hUZXh0RnJvbUZpbGUgPSAoZmlsZSwgY2FsbGJhY2spID0+IHtcbiAgaWYgKHR5cGVvZiBmaWxlID09PSAnc3RyaW5nJykgcmV0dXJuIGNhbGxiYWNrKGZpbGUpO1xuICBjb25zdCByZWFkZXIgPSBuZXcgTG9jYWxGaWxlUmVhZGVyKCk7XG4gIHJlYWRlci5hZGRFdmVudExpc3RlbmVyKCdsb2FkZW5kJywgKCkgPT4ge1xuICAgIGNhbGxiYWNrKHJlYWRlci5yZXN1bHQpO1xuICB9KTtcbiAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZSk7XG59O1xuXG5cbmxldCBwYXJzZXI7XG5cbi8qKlxuICogQ3JlYXRlcyBhIExheWVyUGFyc2VyXG4gKlxuICogQG1ldGhvZFxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSByZXF1ZXN0IC0gc2VlIGxheWVyLkNsaWVudFV0aWxzLmxheWVyUGFyc2VcbiAqL1xuZnVuY3Rpb24gY3JlYXRlUGFyc2VyKHJlcXVlc3QpIHtcbiAgcmVxdWVzdC5jbGllbnQub25jZSgnZGVzdHJveScsICgpID0+IChwYXJzZXIgPSBudWxsKSk7XG5cbiAgcGFyc2VyID0gbmV3IExheWVyUGFyc2VyKHtcbiAgICBjYW1lbENhc2U6IHRydWUsXG4gICAgZ2V0T2JqZWN0Q2FsbGJhY2s6IChpZCkgPT4gcmVxdWVzdC5jbGllbnQuX2dldE9iamVjdChpZCksXG4gICAgY3JlYXRlT2JqZWN0Q2FsbGJhY2s6IChpZCwgb2JqKSA9PiByZXF1ZXN0LmNsaWVudC5fY3JlYXRlT2JqZWN0KG9iaiksXG4gICAgcHJvcGVydHlOYW1lTWFwOiB7XG4gICAgICBDb252ZXJzYXRpb246IHtcbiAgICAgICAgdW5yZWFkTWVzc2FnZUNvdW50OiAndW5yZWFkQ291bnQnLFxuICAgICAgfSxcbiAgICB9LFxuICAgIGNoYW5nZUNhbGxiYWNrczoge1xuICAgICAgTWVzc2FnZToge1xuICAgICAgICBhbGw6ICh1cGRhdGVPYmplY3QsIG5ld1ZhbHVlLCBvbGRWYWx1ZSwgcGF0aHMpID0+IHtcbiAgICAgICAgICB1cGRhdGVPYmplY3QuX2hhbmRsZVBhdGNoRXZlbnQobmV3VmFsdWUsIG9sZFZhbHVlLCBwYXRocyk7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgQ29udmVyc2F0aW9uOiB7XG4gICAgICAgIGFsbDogKHVwZGF0ZU9iamVjdCwgbmV3VmFsdWUsIG9sZFZhbHVlLCBwYXRocykgPT4ge1xuICAgICAgICAgIHVwZGF0ZU9iamVjdC5faGFuZGxlUGF0Y2hFdmVudChuZXdWYWx1ZSwgb2xkVmFsdWUsIHBhdGhzKTtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSk7XG59XG5cbi8qKlxuICogUnVuIHRoZSBMYXllciBQYXJzZXIgb24gdGhlIHJlcXVlc3QuXG4gKlxuICogUGFyYW1ldGVycyBoZXJlXG4gKiBhcmUgdGhlIHBhcmFtZXRlcnMgc3BlY2llZCBpbiBbTGF5ZXItUGF0Y2hdKGh0dHBzOi8vZ2l0aHViLmNvbS9sYXllcmhxL25vZGUtbGF5ZXItcGF0Y2gpLCBwbHVzXG4gKiBhIGNsaWVudCBvYmplY3QuXG4gKlxuICogICAgICBVdGlsLmxheWVyUGFyc2Uoe1xuICogICAgICAgICAgb2JqZWN0OiBjb252ZXJzYXRpb24sXG4gKiAgICAgICAgICB0eXBlOiAnQ29udmVyc2F0aW9uJyxcbiAqICAgICAgICAgIG9wZXJhdGlvbnM6IGxheWVyUGF0Y2hPcGVyYXRpb25zLFxuICogICAgICAgICAgY2xpZW50OiBjbGllbnRcbiAqICAgICAgfSk7XG4gKlxuICogQG1ldGhvZFxuICogQHBhcmFtIHtPYmplY3R9IHJlcXVlc3QgLSBsYXllci1wYXRjaCBwYXJhbWV0ZXJzXG4gKiBAcGFyYW0ge09iamVjdH0gcmVxdWVzdC5vYmplY3QgLSBPYmplY3QgYmVpbmcgdXBkYXRlZCAgYnkgdGhlIG9wZXJhdGlvbnNcbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0LnR5cGUgLSBUeXBlIG9mIG9iamVjdCBiZWluZyB1cGRhdGVkXG4gKiBAcGFyYW0ge09iamVjdFtdfSByZXF1ZXN0Lm9wZXJhdGlvbnMgLSBBcnJheSBvZiBjaGFuZ2Ugb3BlcmF0aW9ucyB0byBwZXJmb3JtIHVwb24gdGhlIG9iamVjdFxuICogQHBhcmFtIHtsYXllci5DbGllbnR9IHJlcXVlc3QuY2xpZW50XG4gKi9cbmV4cG9ydHMubGF5ZXJQYXJzZSA9IChyZXF1ZXN0KSA9PiB7XG4gIGlmICghcGFyc2VyKSBjcmVhdGVQYXJzZXIocmVxdWVzdCk7XG4gIHBhcnNlci5wYXJzZShyZXF1ZXN0KTtcbn07XG5cbi8qKlxuICogT2JqZWN0IGNvbXBhcmlzb24uXG4gKlxuICogRG9lcyBhIHJlY3Vyc2l2ZSB0cmF2ZXJzYWwgb2YgdHdvIG9iamVjdHMgdmVyaWZ5aW5nIHRoYXQgdGhleSBhcmUgdGhlIHNhbWUuXG4gKiBJcyBhYmxlIHRvIG1ha2UgbWV0YWRhdGEtcmVzdHJpY3RlZCBhc3N1bXB0aW9ucyBzdWNoIGFzIHRoYXRcbiAqIGFsbCB2YWx1ZXMgYXJlIGVpdGhlciBwbGFpbiBPYmplY3RzIG9yIHN0cmluZ3MuXG4gKlxuICogICAgICBpZiAoVXRpbHMuZG9lc09iamVjdE1hdGNoKGNvbnYxLm1ldGFkYXRhLCBjb252Mi5tZXRhZGF0YSkpIHtcbiAqICAgICAgICAgIGFsZXJ0KCdUaGVzZSB0d28gbWV0YWRhdGEgb2JqZWN0cyBhcmUgdGhlIHNhbWUnKTtcbiAqICAgICAgfVxuICpcbiAqIEBtZXRob2RcbiAqIEBwYXJhbSAge09iamVjdH0gcmVxdWVzdGVkRGF0YVxuICogQHBhcmFtICB7T2JqZWN0fSBhY3R1YWxEYXRhXG4gKiBAcmV0dXJuIHtib29sZWFufVxuICovXG5leHBvcnRzLmRvZXNPYmplY3RNYXRjaCA9IChyZXF1ZXN0ZWREYXRhLCBhY3R1YWxEYXRhKSA9PiB7XG4gIGlmICghcmVxdWVzdGVkRGF0YSAmJiBhY3R1YWxEYXRhIHx8IHJlcXVlc3RlZERhdGEgJiYgIWFjdHVhbERhdGEpIHJldHVybiBmYWxzZTtcbiAgY29uc3QgcmVxdWVzdGVkS2V5cyA9IE9iamVjdC5rZXlzKHJlcXVlc3RlZERhdGEpLnNvcnQoKTtcbiAgY29uc3QgYWN0dWFsS2V5cyA9IE9iamVjdC5rZXlzKGFjdHVhbERhdGEpLnNvcnQoKTtcblxuICAvLyBJZiB0aGVyZSBhcmUgYSBkaWZmZXJlbnQgbnVtYmVyIG9mIGtleXMsIGZhaWwuXG4gIGlmIChyZXF1ZXN0ZWRLZXlzLmxlbmd0aCAhPT0gYWN0dWFsS2V5cy5sZW5ndGgpIHJldHVybiBmYWxzZTtcblxuICAvLyBDb21wYXJlIGtleSBuYW1lIGFuZCB2YWx1ZSBhdCBlYWNoIGluZGV4XG4gIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCByZXF1ZXN0ZWRLZXlzLmxlbmd0aDsgaW5kZXgrKykge1xuICAgIGNvbnN0IGsxID0gcmVxdWVzdGVkS2V5c1tpbmRleF07XG4gICAgY29uc3QgazIgPSBhY3R1YWxLZXlzW2luZGV4XTtcbiAgICBjb25zdCB2MSA9IHJlcXVlc3RlZERhdGFbazFdO1xuICAgIGNvbnN0IHYyID0gYWN0dWFsRGF0YVtrMl07XG4gICAgaWYgKGsxICE9PSBrMikgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh2MSAmJiB0eXBlb2YgdjEgPT09ICdvYmplY3QnKSB7XG4gICAgICAvLyBBcnJheSBjb21wYXJpc29uIGlzIG5vdCB1c2VkIGJ5IHRoZSBXZWIgU0RLIGF0IHRoaXMgdGltZS5cbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHYxKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FycmF5IGNvbXBhcmlzb24gbm90IGhhbmRsZWQgeWV0Jyk7XG4gICAgICB9IGVsc2UgaWYgKCFleHBvcnRzLmRvZXNPYmplY3RNYXRjaCh2MSwgdjIpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHYxICE9PSB2Mikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbi8qKlxuICogU2ltcGxlIGFycmF5IGluY2x1c2lvbiB0ZXN0XG4gKiBAbWV0aG9kIGluY2x1ZGVzXG4gKiBAcGFyYW0ge01peGVkW119IGl0ZW1zXG4gKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbmV4cG9ydHMuaW5jbHVkZXMgPSAoaXRlbXMsIHZhbHVlKSA9PiBpdGVtcy5pbmRleE9mKHZhbHVlKSAhPT0gLTE7XG5cbi8qKlxuICogU29tZSBBU0NJSSBhcnQgd2hlbiBjbGllbnQgaW5pdGlhbGl6ZXNcbiAqL1xuZXhwb3J0cy5hc2NpaUluaXQgPSAodmVyc2lvbikgPT4ge1xuICBpZiAoIXZlcnNpb24pIHJldHVybiAnTWlzc2luZyB2ZXJzaW9uJztcblxuICBjb25zdCBzcGxpdCA9IHZlcnNpb24uc3BsaXQoJy0nKTtcbiAgbGV0IGxpbmUxID0gc3BsaXRbMF0gfHwgJyc7XG4gIGxldCBsaW5lMiA9IHNwbGl0WzFdIHx8ICcnO1xuXG4gIGxpbmUxICs9IG5ldyBBcnJheSgxMyAtIGxpbmUxLmxlbmd0aCkuam9pbignICcpO1xuICBsaW5lMiArPSBuZXcgQXJyYXkoMTQgLSBsaW5lMi5sZW5ndGgpLmpvaW4oJyAnKTtcblxuICByZXR1cm4gYFxuICAgIC9oTk1NTU1NTU1NTU1NTU1NTU1NTU1tcy5cbiAgaE1NeSsvLy8vLy8vLy8vLy8vLy8vL29tTU4tICAgICAgICAnb28uXG4gIE1NTiAgICAgICAgICAgICAgICAgICAgb01NbyAgICAgICAgLk1NL1xuICBNTU4gICAgICAgICAgICAgICAgICAgIG9NTW8gICAgICAgIC5NTS8gICAgICAgICAgICAgIC4uLi4gICAgICAgICAgICAgICAgICAgICAgIC4uLi4gICAgICAgICAgICAuLi5cbiAgTU1OICAgICAgIFdlYiBTREsgICAgICBvTU1vICAgICAgICAuTU0vICAgICAgICAgICBvaGRkZGRkZGRvJyArbWQuICAgICAgc215ICAtc2RkZGRkZGhvLiAgIGhtb3NkZG1tLlxuICBNTU0tICAgICAgICAgICAgICAgICAgIG9NTW8gICAgICAgIC5NTS8gICAgICAgICAgIDo6LicgICcubU0rICdoTWQnICAgICtNbS4gK05tLycgICAuK05tLSAgbU1Ocy0nLlxuICBNTU15ICAgICAgdiR7bGluZTF9b01NbyAgICAgICAgLk1NLyAgICAgICAgICAgICAuLTovK3lOTXMgIC5tTXMgICAvTU46IC5NTXMvLy8vLy8vZE1oICBtTXlcbiAgTU1NTW8gICAgICR7bGluZTJ9b01NbyAgICAgICAgLk1NLyAgICAgICAgICAueW1oeXNvKzpoTXMgICA6TU0vIC1OTS8gIDpNTXNvb29vb29vb28rICBtTStcbiAgTU1NTU15LiAgICAgICAgICAgICAgICBvTU1vICAgICAgICAuTU0vICAgICAgICAgIGRNeScgICAgJ2RNcyAgICArTU46bU0rICAgJ05NbyAgICAgICAgICAgIG1NK1xuICBNTU1NTU1OeTonICAgICAgICAgICAgIG9NTW8gICAgICAgIC5NTXkrKysrKysrKzogc01tLy0tLS9kTk1zICAgICB5TU1NcyAgICAgLWRNZCs6LTovc215JyAgbU0rXG4gIE5NTU1NTU1NTW15KzotLicgICAgICAneU1NLyAgICAgICAgJ3l5eXl5eXl5eXl5byAgOnNoaGh5czoreS8gICAgIC5NTWggICAgICAgJy1veWhoaHlzOicgICBzeTpcbiAgOmRNTU1NTU1NTU1NTU1OTk5OTk5OTk5NTnMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaE1kJ1xuICAgLS8rKysrKysrKysrKysrKysrKysrOicgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNObWRvJ2A7XG4gfVxuIl19
