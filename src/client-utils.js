/**
 * Utility methods
 *
 * @class layer.ClientUtils
 */

const LayerParser = require('layer-patch');
const uuid = require('uuid');
const atob = typeof window === 'undefined' ? require('atob') : window.atob;

/* istanbul ignore next */
const LocalFileReader = typeof window === 'undefined' ? require('filereader') : FileReader;

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
exports.typeFromID = (id) => {
  const matches = id.match(/layer:\/\/\/(.*?)\//);
  return matches ? matches[1] : '';
};

exports.isEmpty = (obj) => Object.prototype.toString.apply(obj) === '[object Object]' && Object.keys(obj).length === 0;

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
exports.sortBy = (inArray, fn, reverse) => {
  reverse = reverse ? -1 : 1;
  return inArray.sort((valueA, valueB) => {
    const aa = fn(valueA);
    const bb = fn(valueB);
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
exports.clone = (obj) => JSON.parse(JSON.stringify(obj));

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
exports.defer = (func) => setTimeout(func, 0);

/**
 * URL Decode a URL Encoded base64 string
 *
 * Copied from https://github.com/auth0-blog/angular-token-auth, but
 * appears in many places on the web.
 */
exports.decode = (str) => {
  let output = str.replace('-', '+').replace('_', '/');
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
  let secondsWaitTime = Math.pow(2, counter) / 10,
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
 * @returns {Boolan} - True if its a blob, false if not.
 */
exports.isBlob = (value) => typeof Blob !== 'undefined' && value instanceof Blob;

/**
 * Given a blob return a base64 string.
 *
 * @method blobToBase64
 * @param {Blob} blob - data to convert to base64
 * @param {Function} callback
 * @param {String} callback.result - Your base64 string result
 */
exports.blobToBase64 = (blob, callback) => {
  const reader = new LocalFileReader();
  reader.readAsDataURL(blob);
  reader.onloadend = () => callback(reader.result.replace(/^.*?,/, ''));
};


/**
 * Given a base64 string return a blob.
 *
 * @method base64ToBlob
 * @param {String} b64Data - base64 string data without any type prefixes
 * @param {String} contentType - mime type of the data
 * @returns {Blob}
 */
exports.base64ToBlob = (b64Data, contentType) => {
  try {
    const sliceSize = 512;
    const byteCharacters = atob(b64Data);
    const byteArrays = [];
    let offset;

    for (offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      let i;
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);

      byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, { type: contentType });
    return blob;
  } catch (e) {
    // noop
  }
  return null;
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
exports.fetchTextFromFile = (file, callback) => {
  if (typeof file === 'string') return callback(file);
  const reader = new LocalFileReader();
  reader.addEventListener('loadend', () => {
    callback(reader.result);
  });
  reader.readAsText(file);
};


let parser;

/**
 * Creates a LayerParser
 *
 * @method
 * @private
 * @param {Object} request - see layer.ClientUtils.layerParse
 */
function createParser(request) {
  request.client.once('destroy', () => (parser = null));

  parser = new LayerParser({
    camelCase: true,
    getObjectCallback: (id) => request.client._getObject(id),
    createObjectCallback: (id, obj) => request.client._createObject(obj),
    propertyNameMap: {
      Conversation: {
        unreadMessageCount: 'unreadCount',
      },
    },
    changeCallbacks: {
      Message: {
        all: (updateObject, newValue, oldValue, paths) => {
          updateObject._handlePatchEvent(newValue, oldValue, paths);
        },
      },
      Conversation: {
        all: (updateObject, newValue, oldValue, paths) => {
          updateObject._handlePatchEvent(newValue, oldValue, paths);
        },
      },
    },
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
exports.layerParse = (request) => {
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
exports.doesObjectMatch = (requestedData, actualData) => {
  if (!requestedData && actualData || requestedData && !actualData) return false;
  const requestedKeys = Object.keys(requestedData).sort();
  const actualKeys = Object.keys(actualData).sort();

  // If there are a different number of keys, fail.
  if (requestedKeys.length !== actualKeys.length) return false;

  // Compare key name and value at each index
  for (let index = 0; index < requestedKeys.length; index++) {
    const k1 = requestedKeys[index];
    const k2 = actualKeys[index];
    const v1 = requestedData[k1];
    const v2 = actualData[k2];
    if (k1 !== k2) return false;
    if (v1 && typeof v1 === 'object') {
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
exports.includes = (items, value) => items.indexOf(value) !== -1;

/**
 * Some ASCII art when client initializes
 */
exports.asciiInit = (version) => {
  if (!version || version == '{{GRUNT_REPLACE_VERSION}}') return 'Missing version';

  const split = version.split('-');
  let line1 = split[0] || '';
  let line2 = split[1] || '';

  line1 = line1 + new Array(12 - line1.length).join(' ')
  line2 = line2 + new Array(13 - line2.length).join(' ')

  return `
  =BBBBBBBBBBBBBBBBB@
  ]BM               "BB
  8BH    Layer       BB
  8BH                BB
  8BN    WebSDK      BB
  8BBw   v${line1}BB
  8BBBw  ${line2}BB
  8BBBBBw            BB
  jBBBBBBBBK@===,,,,gBB
   'MMMMMMMMMMMMMMMMM'`;
 }
