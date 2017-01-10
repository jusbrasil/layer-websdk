'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * This class represents a Layer Error.
 *
 * At this point, a LayerError is only used in response to an error from the server.
 * It may be extended to report on internal errors... but typically internal errors
 * are reported via `throw new Error(...);`
 *
 * Layer Error is passed as part of the layer.LayerEvent's data property.
 *
 * Throw an error:
 *
 *     object.trigger('xxx-error', new LayerEvent({
 *       data: new LayerError()
 *     }));
 *
 *  Receive an Error:
 *
 *     conversation.on('loaded-error', function(errEvt) {
 *        var error = errEvt.data;
 *        console.error(error.message);
 *     });
 *
 * @class layer.LayerError
 */
var Logger = require('./logger');

var LayerError = function () {
  function LayerError(options) {
    var _this = this;

    _classCallCheck(this, LayerError);

    if (options instanceof LayerError) {
      options = {
        errType: options.errType,
        httpStatus: options.httpStatus,
        message: options.message,
        code: options.code,
        url: options.url,
        data: options.data
      };
    } else if (options && (typeof options === 'undefined' ? 'undefined' : _typeof(options)) === 'object') {
      options.errType = options.id;
    } else {
      options = {
        message: options
      };
    }

    Object.keys(options).forEach(function (name) {
      return _this[name] = options[name];
    });
    if (!this.data) this.data = {};
  }

  /**
   * Returns either '' or a nonce.
   *
   * If a nonce has been returned
   * by the server as part of a session-expiration error,
   * then this method will return that nonce.
   *
   * @method getNonce
   * @return {string} nonce
   */


  _createClass(LayerError, [{
    key: 'getNonce',
    value: function getNonce() {
      return this.data && this.data.nonce ? this.data.nonce : '';
    }

    /**
     * String representation of the error
     *
     * @method toString
     * @return {string}
     */

  }, {
    key: 'toString',
    value: function toString() {
      return this.code + ' (' + this.id + '): ' + this.message + '; (see ' + this.url + ')';
    }

    /**
     * Log the errors
     *
     * @method log
     * @deprecated see layer.Logger
     */

  }, {
    key: 'log',
    value: function log() {
      Logger.error('Layer-Error: ' + this.toString());
    }
  }]);

  return LayerError;
}();

/**
 * A string name for the event; these names are paired with codes.
 *
 * Codes can be looked up at https://github.com/layerhq/docs/blob/web-api/specs/rest-api.md#client-errors
 * @type {String}
 */


LayerError.prototype.errType = '';

/**
 * Numerical error code.
 *
 * https://developer.layer.com/docs/client/rest#full-list
 * @type {Number}
 */
LayerError.prototype.code = 0;

/**
 * URL to go to for more information on this error.
 * @type {String}
 */
LayerError.prototype.url = '';

/**
 * Detailed description of the error.
 * @type {String}
 */
LayerError.prototype.message = '';

/**
 * Http error code; no value if its a websocket response.
 * @type {Number}
 */
LayerError.prototype.httpStatus = 0;

/**
 * Contains data from the xhr request object.
 *
 *  * url: the url to the service endpoint
 *  * data: xhr.data,
 *  * xhr: XMLHttpRequest object
 *
 * @type {Object}
 */
LayerError.prototype.request = null;

/**
 * Any additional details about the error sent as additional properties.
 * @type {Object}
 */
LayerError.prototype.data = null;

/**
 * Pointer to the xhr object that fired the actual request and contains the response.
 * @type {XMLHttpRequest}
 */
LayerError.prototype.xhr = null;

/**
 * Dictionary of error messages
 * @property {Object} [dictionary={}]
 */
LayerError.dictionary = {
  appIdMissing: 'Property missing: appId is required',
  identityTokenMissing: 'Identity Token missing: answerAuthenticationChallenge requires an identity token',
  sessionTokenMissing: 'Session Token missing: _authComplete requires a {session_token: value} input',
  clientMissing: 'Property missing: client is required',
  conversationMissing: 'Property missing: conversation is required',
  partsMissing: 'Property missing: parts is required',
  moreParticipantsRequired: 'Conversation needs participants other than the current user',
  isDestroyed: 'Object is destroyed',
  urlRequired: 'Object needs a url property',
  invalidUrl: 'URL is invalid',
  invalidId: 'Identifier is invalid',
  idParamRequired: 'The ID Parameter is required',
  wrongClass: 'Parameter class error; should be: ',
  inProgress: 'Operation already in progress',
  cantChangeIfConnected: 'You can not change value after connecting',
  cantChangeUserId: 'You can not change the userId property',
  alreadySent: 'Already sent or sending',
  contentRequired: 'MessagePart requires rich content for this call',
  alreadyDestroyed: 'This object has already been destroyed',
  deletionModeUnsupported: 'Call to deletion was made with an unsupported deletion mode',
  sessionAndUserRequired: 'connectWithSession requires both a userId and a sessionToken',
  invalidUserIdChange: 'The prn field in the Identity Token must match the requested UserID',
  predicateNotSupported: 'The predicate is not supported for this value of model',
  invalidPredicate: 'The predicate does not match the expected format',
  appIdImmutable: 'The appId property cannot be changed',
  clientMustBeReady: 'The Client must have triggered its "ready" event before you can call this'
};

module.exports = LayerError;
//# sourceMappingURL=data:application/json;base64,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O0FBc0J0Qix1QkFBcUIscUVBdEJDO0FBdUJ0Qix5QkFBdUIsd0RBdkJEO0FBd0J0QixvQkFBa0Isa0RBeEJJO0FBeUJ0QixrQkFBZ0Isc0NBekJNO0FBMEJ0QixxQkFBbUI7QUExQkcsQ0FBeEI7O0FBNkJBLE9BQU8sT0FBUCxHQUFpQixVQUFqQiIsImZpbGUiOiJsYXllci1lcnJvci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVGhpcyBjbGFzcyByZXByZXNlbnRzIGEgTGF5ZXIgRXJyb3IuXG4gKlxuICogQXQgdGhpcyBwb2ludCwgYSBMYXllckVycm9yIGlzIG9ubHkgdXNlZCBpbiByZXNwb25zZSB0byBhbiBlcnJvciBmcm9tIHRoZSBzZXJ2ZXIuXG4gKiBJdCBtYXkgYmUgZXh0ZW5kZWQgdG8gcmVwb3J0IG9uIGludGVybmFsIGVycm9ycy4uLiBidXQgdHlwaWNhbGx5IGludGVybmFsIGVycm9yc1xuICogYXJlIHJlcG9ydGVkIHZpYSBgdGhyb3cgbmV3IEVycm9yKC4uLik7YFxuICpcbiAqIExheWVyIEVycm9yIGlzIHBhc3NlZCBhcyBwYXJ0IG9mIHRoZSBsYXllci5MYXllckV2ZW50J3MgZGF0YSBwcm9wZXJ0eS5cbiAqXG4gKiBUaHJvdyBhbiBlcnJvcjpcbiAqXG4gKiAgICAgb2JqZWN0LnRyaWdnZXIoJ3h4eC1lcnJvcicsIG5ldyBMYXllckV2ZW50KHtcbiAqICAgICAgIGRhdGE6IG5ldyBMYXllckVycm9yKClcbiAqICAgICB9KSk7XG4gKlxuICogIFJlY2VpdmUgYW4gRXJyb3I6XG4gKlxuICogICAgIGNvbnZlcnNhdGlvbi5vbignbG9hZGVkLWVycm9yJywgZnVuY3Rpb24oZXJyRXZ0KSB7XG4gKiAgICAgICAgdmFyIGVycm9yID0gZXJyRXZ0LmRhdGE7XG4gKiAgICAgICAgY29uc29sZS5lcnJvcihlcnJvci5tZXNzYWdlKTtcbiAqICAgICB9KTtcbiAqXG4gKiBAY2xhc3MgbGF5ZXIuTGF5ZXJFcnJvclxuICovXG5jb25zdCBMb2dnZXIgPSByZXF1aXJlKCcuL2xvZ2dlcicpO1xuY2xhc3MgTGF5ZXJFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucyBpbnN0YW5jZW9mIExheWVyRXJyb3IpIHtcbiAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgIGVyclR5cGU6IG9wdGlvbnMuZXJyVHlwZSxcbiAgICAgICAgaHR0cFN0YXR1czogb3B0aW9ucy5odHRwU3RhdHVzLFxuICAgICAgICBtZXNzYWdlOiBvcHRpb25zLm1lc3NhZ2UsXG4gICAgICAgIGNvZGU6IG9wdGlvbnMuY29kZSxcbiAgICAgICAgdXJsOiBvcHRpb25zLnVybCxcbiAgICAgICAgZGF0YTogb3B0aW9ucy5kYXRhLFxuICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMgJiYgdHlwZW9mIG9wdGlvbnMgPT09ICdvYmplY3QnKSB7XG4gICAgICBvcHRpb25zLmVyclR5cGUgPSBvcHRpb25zLmlkO1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRpb25zID0ge1xuICAgICAgICBtZXNzYWdlOiBvcHRpb25zLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBPYmplY3Qua2V5cyhvcHRpb25zKS5mb3JFYWNoKG5hbWUgPT4gdGhpc1tuYW1lXSA9IG9wdGlvbnNbbmFtZV0pO1xuICAgIGlmICghdGhpcy5kYXRhKSB0aGlzLmRhdGEgPSB7fTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGVpdGhlciAnJyBvciBhIG5vbmNlLlxuICAgKlxuICAgKiBJZiBhIG5vbmNlIGhhcyBiZWVuIHJldHVybmVkXG4gICAqIGJ5IHRoZSBzZXJ2ZXIgYXMgcGFydCBvZiBhIHNlc3Npb24tZXhwaXJhdGlvbiBlcnJvcixcbiAgICogdGhlbiB0aGlzIG1ldGhvZCB3aWxsIHJldHVybiB0aGF0IG5vbmNlLlxuICAgKlxuICAgKiBAbWV0aG9kIGdldE5vbmNlXG4gICAqIEByZXR1cm4ge3N0cmluZ30gbm9uY2VcbiAgICovXG4gIGdldE5vbmNlKCkge1xuICAgIHJldHVybiAodGhpcy5kYXRhICYmIHRoaXMuZGF0YS5ub25jZSkgPyB0aGlzLmRhdGEubm9uY2UgOiAnJztcbiAgfVxuXG4gIC8qKlxuICAgKiBTdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIGVycm9yXG4gICAqXG4gICAqIEBtZXRob2QgdG9TdHJpbmdcbiAgICogQHJldHVybiB7c3RyaW5nfVxuICAgKi9cbiAgdG9TdHJpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29kZSArICcgKCcgKyB0aGlzLmlkICsgJyk6ICcgKyB0aGlzLm1lc3NhZ2UgKyAnOyAoc2VlICcgKyB0aGlzLnVybCArICcpJztcbiAgfVxuXG4gIC8qKlxuICAgKiBMb2cgdGhlIGVycm9yc1xuICAgKlxuICAgKiBAbWV0aG9kIGxvZ1xuICAgKiBAZGVwcmVjYXRlZCBzZWUgbGF5ZXIuTG9nZ2VyXG4gICAqL1xuICBsb2coKSB7XG4gICAgTG9nZ2VyLmVycm9yKCdMYXllci1FcnJvcjogJyArIHRoaXMudG9TdHJpbmcoKSk7XG4gIH1cblxufVxuXG4vKipcbiAqIEEgc3RyaW5nIG5hbWUgZm9yIHRoZSBldmVudDsgdGhlc2UgbmFtZXMgYXJlIHBhaXJlZCB3aXRoIGNvZGVzLlxuICpcbiAqIENvZGVzIGNhbiBiZSBsb29rZWQgdXAgYXQgaHR0cHM6Ly9naXRodWIuY29tL2xheWVyaHEvZG9jcy9ibG9iL3dlYi1hcGkvc3BlY3MvcmVzdC1hcGkubWQjY2xpZW50LWVycm9yc1xuICogQHR5cGUge1N0cmluZ31cbiAqL1xuTGF5ZXJFcnJvci5wcm90b3R5cGUuZXJyVHlwZSA9ICcnO1xuXG4vKipcbiAqIE51bWVyaWNhbCBlcnJvciBjb2RlLlxuICpcbiAqIGh0dHBzOi8vZGV2ZWxvcGVyLmxheWVyLmNvbS9kb2NzL2NsaWVudC9yZXN0I2Z1bGwtbGlzdFxuICogQHR5cGUge051bWJlcn1cbiAqL1xuTGF5ZXJFcnJvci5wcm90b3R5cGUuY29kZSA9IDA7XG5cbi8qKlxuICogVVJMIHRvIGdvIHRvIGZvciBtb3JlIGluZm9ybWF0aW9uIG9uIHRoaXMgZXJyb3IuXG4gKiBAdHlwZSB7U3RyaW5nfVxuICovXG5MYXllckVycm9yLnByb3RvdHlwZS51cmwgPSAnJztcblxuLyoqXG4gKiBEZXRhaWxlZCBkZXNjcmlwdGlvbiBvZiB0aGUgZXJyb3IuXG4gKiBAdHlwZSB7U3RyaW5nfVxuICovXG5MYXllckVycm9yLnByb3RvdHlwZS5tZXNzYWdlID0gJyc7XG5cbi8qKlxuICogSHR0cCBlcnJvciBjb2RlOyBubyB2YWx1ZSBpZiBpdHMgYSB3ZWJzb2NrZXQgcmVzcG9uc2UuXG4gKiBAdHlwZSB7TnVtYmVyfVxuICovXG5MYXllckVycm9yLnByb3RvdHlwZS5odHRwU3RhdHVzID0gMDtcblxuLyoqXG4gKiBDb250YWlucyBkYXRhIGZyb20gdGhlIHhociByZXF1ZXN0IG9iamVjdC5cbiAqXG4gKiAgKiB1cmw6IHRoZSB1cmwgdG8gdGhlIHNlcnZpY2UgZW5kcG9pbnRcbiAqICAqIGRhdGE6IHhoci5kYXRhLFxuICogICogeGhyOiBYTUxIdHRwUmVxdWVzdCBvYmplY3RcbiAqXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG5MYXllckVycm9yLnByb3RvdHlwZS5yZXF1ZXN0ID0gbnVsbDtcblxuLyoqXG4gKiBBbnkgYWRkaXRpb25hbCBkZXRhaWxzIGFib3V0IHRoZSBlcnJvciBzZW50IGFzIGFkZGl0aW9uYWwgcHJvcGVydGllcy5cbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cbkxheWVyRXJyb3IucHJvdG90eXBlLmRhdGEgPSBudWxsO1xuXG4vKipcbiAqIFBvaW50ZXIgdG8gdGhlIHhociBvYmplY3QgdGhhdCBmaXJlZCB0aGUgYWN0dWFsIHJlcXVlc3QgYW5kIGNvbnRhaW5zIHRoZSByZXNwb25zZS5cbiAqIEB0eXBlIHtYTUxIdHRwUmVxdWVzdH1cbiAqL1xuTGF5ZXJFcnJvci5wcm90b3R5cGUueGhyID0gbnVsbDtcblxuLyoqXG4gKiBEaWN0aW9uYXJ5IG9mIGVycm9yIG1lc3NhZ2VzXG4gKiBAcHJvcGVydHkge09iamVjdH0gW2RpY3Rpb25hcnk9e31dXG4gKi9cbkxheWVyRXJyb3IuZGljdGlvbmFyeSA9IHtcbiAgYXBwSWRNaXNzaW5nOiAnUHJvcGVydHkgbWlzc2luZzogYXBwSWQgaXMgcmVxdWlyZWQnLFxuICBpZGVudGl0eVRva2VuTWlzc2luZzogJ0lkZW50aXR5IFRva2VuIG1pc3Npbmc6IGFuc3dlckF1dGhlbnRpY2F0aW9uQ2hhbGxlbmdlIHJlcXVpcmVzIGFuIGlkZW50aXR5IHRva2VuJyxcbiAgc2Vzc2lvblRva2VuTWlzc2luZzogJ1Nlc3Npb24gVG9rZW4gbWlzc2luZzogX2F1dGhDb21wbGV0ZSByZXF1aXJlcyBhIHtzZXNzaW9uX3Rva2VuOiB2YWx1ZX0gaW5wdXQnLFxuICBjbGllbnRNaXNzaW5nOiAnUHJvcGVydHkgbWlzc2luZzogY2xpZW50IGlzIHJlcXVpcmVkJyxcbiAgY29udmVyc2F0aW9uTWlzc2luZzogJ1Byb3BlcnR5IG1pc3Npbmc6IGNvbnZlcnNhdGlvbiBpcyByZXF1aXJlZCcsXG4gIHBhcnRzTWlzc2luZzogJ1Byb3BlcnR5IG1pc3Npbmc6IHBhcnRzIGlzIHJlcXVpcmVkJyxcbiAgbW9yZVBhcnRpY2lwYW50c1JlcXVpcmVkOiAnQ29udmVyc2F0aW9uIG5lZWRzIHBhcnRpY2lwYW50cyBvdGhlciB0aGFuIHRoZSBjdXJyZW50IHVzZXInLFxuICBpc0Rlc3Ryb3llZDogJ09iamVjdCBpcyBkZXN0cm95ZWQnLFxuICB1cmxSZXF1aXJlZDogJ09iamVjdCBuZWVkcyBhIHVybCBwcm9wZXJ0eScsXG4gIGludmFsaWRVcmw6ICdVUkwgaXMgaW52YWxpZCcsXG4gIGludmFsaWRJZDogJ0lkZW50aWZpZXIgaXMgaW52YWxpZCcsXG4gIGlkUGFyYW1SZXF1aXJlZDogJ1RoZSBJRCBQYXJhbWV0ZXIgaXMgcmVxdWlyZWQnLFxuICB3cm9uZ0NsYXNzOiAnUGFyYW1ldGVyIGNsYXNzIGVycm9yOyBzaG91bGQgYmU6ICcsXG4gIGluUHJvZ3Jlc3M6ICdPcGVyYXRpb24gYWxyZWFkeSBpbiBwcm9ncmVzcycsXG4gIGNhbnRDaGFuZ2VJZkNvbm5lY3RlZDogJ1lvdSBjYW4gbm90IGNoYW5nZSB2YWx1ZSBhZnRlciBjb25uZWN0aW5nJyxcbiAgY2FudENoYW5nZVVzZXJJZDogJ1lvdSBjYW4gbm90IGNoYW5nZSB0aGUgdXNlcklkIHByb3BlcnR5JyxcbiAgYWxyZWFkeVNlbnQ6ICdBbHJlYWR5IHNlbnQgb3Igc2VuZGluZycsXG4gIGNvbnRlbnRSZXF1aXJlZDogJ01lc3NhZ2VQYXJ0IHJlcXVpcmVzIHJpY2ggY29udGVudCBmb3IgdGhpcyBjYWxsJyxcbiAgYWxyZWFkeURlc3Ryb3llZDogJ1RoaXMgb2JqZWN0IGhhcyBhbHJlYWR5IGJlZW4gZGVzdHJveWVkJyxcbiAgZGVsZXRpb25Nb2RlVW5zdXBwb3J0ZWQ6ICdDYWxsIHRvIGRlbGV0aW9uIHdhcyBtYWRlIHdpdGggYW4gdW5zdXBwb3J0ZWQgZGVsZXRpb24gbW9kZScsXG4gIHNlc3Npb25BbmRVc2VyUmVxdWlyZWQ6ICdjb25uZWN0V2l0aFNlc3Npb24gcmVxdWlyZXMgYm90aCBhIHVzZXJJZCBhbmQgYSBzZXNzaW9uVG9rZW4nLFxuICBpbnZhbGlkVXNlcklkQ2hhbmdlOiAnVGhlIHBybiBmaWVsZCBpbiB0aGUgSWRlbnRpdHkgVG9rZW4gbXVzdCBtYXRjaCB0aGUgcmVxdWVzdGVkIFVzZXJJRCcsXG4gIHByZWRpY2F0ZU5vdFN1cHBvcnRlZDogJ1RoZSBwcmVkaWNhdGUgaXMgbm90IHN1cHBvcnRlZCBmb3IgdGhpcyB2YWx1ZSBvZiBtb2RlbCcsXG4gIGludmFsaWRQcmVkaWNhdGU6ICdUaGUgcHJlZGljYXRlIGRvZXMgbm90IG1hdGNoIHRoZSBleHBlY3RlZCBmb3JtYXQnLFxuICBhcHBJZEltbXV0YWJsZTogJ1RoZSBhcHBJZCBwcm9wZXJ0eSBjYW5ub3QgYmUgY2hhbmdlZCcsXG4gIGNsaWVudE11c3RCZVJlYWR5OiAnVGhlIENsaWVudCBtdXN0IGhhdmUgdHJpZ2dlcmVkIGl0cyBcInJlYWR5XCIgZXZlbnQgYmVmb3JlIHlvdSBjYW4gY2FsbCB0aGlzJyxcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTGF5ZXJFcnJvcjtcbiJdfQ==
