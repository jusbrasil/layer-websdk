'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * @class  layer.Websockets.RequestManager
 * @private
 *
 * This class allows one to send requests to the websocket server, and provide a callback,
 * And have that callback either called by the correct websocket server response, or
 * be called with a timeout.
 */
var Utils = require('../client-utils');
var logger = require('../logger');
var LayerError = require('../layer-error');

// Wait 15 seconds for a response and then give up
var DELAY_UNTIL_TIMEOUT = 15 * 1000;

var WebsocketRequestManager = function () {
  /**
   * Create a new websocket change manager
   *
   *      var websocketRequestManager = new layer.Websockets.RequestManager({
   *          client: client,
   *          socketManager: client.Websockets.SocketManager
   *      });
   *
   * @method
   * @param  {Object} options
   * @param {layer.Client} client
   * @param {layer.Websockets.SocketManager} socketManager
   * @returns {layer.Websockets.RequestManager}
   */
  function WebsocketRequestManager(options) {
    _classCallCheck(this, WebsocketRequestManager);

    this.client = options.client;
    this.socketManager = options.socketManager;
    this.socketManager.on({
      message: this._handleResponse,
      disconnected: this._reset
    }, this);

    this._requestCallbacks = {};
  }

  _createClass(WebsocketRequestManager, [{
    key: '_reset',
    value: function _reset() {
      this._requestCallbacks = {};
    }

    /**
     * Handle a response to a request.
     *
     * @method _handleResponse
     * @private
     * @param  {layer.LayerEvent} evt
     */

  }, {
    key: '_handleResponse',
    value: function _handleResponse(evt) {
      if (evt.data.type === 'response') {
        var msg = evt.data.body;
        var requestId = msg.request_id;
        var data = msg.success ? msg.data : new LayerError(msg.data);
        logger.debug('Websocket response ' + requestId + ' ' + (msg.success ? 'Successful' : 'Failed'));
        if (requestId && this._requestCallbacks[requestId]) {
          this._requestCallbacks[requestId].callback({
            success: msg.success,
            fullData: evt.data,
            data: data
          });
          delete this._requestCallbacks[requestId];
        }
      }
    }

    /**
     * Shortcut for sending a request; builds in handling for callbacks
     *
     *    manager.sendRequest({
     *      operation: "delete",
     *      object: {id: "layer:///conversations/uuid"},
     *      data: {deletion_mode: "all_participants"}
     *    }, function(result) {
     *        alert(result.success ? "Yay" : "Boo");
     *    });
     *
     * @method sendRequest
     * @param  {Object} data - Data to send to the server
     * @param  {Function} callback - Handler for success/failure callback
     */

  }, {
    key: 'sendRequest',
    value: function sendRequest(data, callback) {
      if (!this._isOpen()) {
        return !callback ? undefined : callback(new LayerError({
          success: false,
          data: { id: 'not_connected', code: 0, message: 'WebSocket not connected' }
        }));
      }
      var body = Utils.clone(data);
      body.request_id = 'r' + this._nextRequestId++;
      logger.debug('Request ' + body.request_id + ' is sending');
      if (callback) {
        this._requestCallbacks[body.request_id] = {
          date: Date.now(),
          callback: callback
        };
      }

      this.socketManager.send({
        type: 'request',
        body: body
      });
      this._scheduleCallbackCleanup();
    }

    /**
     * Flags a request as having failed if no response within 2 minutes
     *
     * @method _scheduleCallbackCleanup
     * @private
     */

  }, {
    key: '_scheduleCallbackCleanup',
    value: function _scheduleCallbackCleanup() {
      if (!this._callbackCleanupId) {
        this._callbackCleanupId = setTimeout(this._runCallbackCleanup.bind(this), DELAY_UNTIL_TIMEOUT + 50);
      }
    }

    /**
     * Calls callback with an error.
     *
     * NOTE: Because we call requests that expect responses serially instead of in parallel,
     * currently there should only ever be a single entry in _requestCallbacks.  This may change in the future.
     *
     * @method _runCallbackCleanup
     * @private
     */

  }, {
    key: '_runCallbackCleanup',
    value: function _runCallbackCleanup() {
      var _this = this;

      this._callbackCleanupId = 0;
      // If the websocket is closed, ignore all callbacks.  The Sync Manager will reissue these requests as soon as it gets
      // a 'connected' event... they have not failed.  May need to rethink this for cases where third parties are directly
      // calling the websocket manager bypassing the sync manager.
      if (this.isDestroyed || !this._isOpen()) return;
      var count = 0;
      var now = Date.now();
      Object.keys(this._requestCallbacks).forEach(function (requestId) {
        var callbackConfig = _this._requestCallbacks[requestId];
        // If the request hasn't expired, we'll need to reschedule callback cleanup; else if its expired...
        if (callbackConfig && now < callbackConfig.date + DELAY_UNTIL_TIMEOUT) {
          count++;
        } else {
          // If there has been no data from the server, there's probably a problem with the websocket; reconnect.
          if (now > _this.socketManager._lastDataFromServerTimestamp + DELAY_UNTIL_TIMEOUT) {
            _this.socketManager._reconnect(false);
            _this._scheduleCallbackCleanup();
            return;
          } else {
            // The request isn't responding and the socket is good; fail the request.
            _this._timeoutRequest(requestId);
          }
        }
      });
      if (count) this._scheduleCallbackCleanup();
    }
  }, {
    key: '_timeoutRequest',
    value: function _timeoutRequest(requestId) {
      try {
        logger.warn('Websocket request timeout');
        this._requestCallbacks[requestId].callback({
          success: false,
          data: new LayerError({
            id: 'request_timeout',
            message: 'The server is not responding. We know how much that sucks.',
            url: 'https:/developer.layer.com/docs/websdk',
            code: 0,
            status: 408,
            httpStatus: 408
          })
        });
      } catch (err) {
        // Do nothing
      }
      delete this._requestCallbacks[requestId];
    }
  }, {
    key: '_isOpen',
    value: function _isOpen() {
      return this.socketManager._isOpen();
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      this.isDestroyed = true;
      if (this._callbackCleanupId) clearTimeout(this._callbackCleanupId);
      this._requestCallbacks = null;
    }
  }]);

  return WebsocketRequestManager;
}();

WebsocketRequestManager.prototype._nextRequestId = 1;

/**
 * The Client that owns this.
 * @type {layer.Client}
 */
WebsocketRequestManager.prototype.client = null;

WebsocketRequestManager.prototype._requestCallbacks = null;

WebsocketRequestManager.prototype._callbackCleanupId = 0;

WebsocketRequestManager.prototype.socketManager = null;

module.exports = WebsocketRequestManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy93ZWJzb2NrZXRzL3JlcXVlc3QtbWFuYWdlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7Ozs7Ozs7QUFRQSxJQUFNLFFBQVEsUUFBUSxpQkFBUixDQUFkO0FBQ0EsSUFBTSxTQUFTLFFBQVEsV0FBUixDQUFmO0FBQ0EsSUFBTSxhQUFhLFFBQVEsZ0JBQVIsQ0FBbkI7O0FBRUE7QUFDQSxJQUFNLHNCQUFzQixLQUFLLElBQWpDOztJQUVNLHVCO0FBQ0o7Ozs7Ozs7Ozs7Ozs7O0FBY0EsbUNBQVksT0FBWixFQUFxQjtBQUFBOztBQUNuQixTQUFLLE1BQUwsR0FBYyxRQUFRLE1BQXRCO0FBQ0EsU0FBSyxhQUFMLEdBQXFCLFFBQVEsYUFBN0I7QUFDQSxTQUFLLGFBQUwsQ0FBbUIsRUFBbkIsQ0FBc0I7QUFDcEIsZUFBUyxLQUFLLGVBRE07QUFFcEIsb0JBQWMsS0FBSztBQUZDLEtBQXRCLEVBR0csSUFISDs7QUFLQSxTQUFLLGlCQUFMLEdBQXlCLEVBQXpCO0FBQ0Q7Ozs7NkJBRVE7QUFDUCxXQUFLLGlCQUFMLEdBQXlCLEVBQXpCO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7b0NBT2dCLEcsRUFBSztBQUNuQixVQUFJLElBQUksSUFBSixDQUFTLElBQVQsS0FBa0IsVUFBdEIsRUFBa0M7QUFDaEMsWUFBTSxNQUFNLElBQUksSUFBSixDQUFTLElBQXJCO0FBQ0EsWUFBTSxZQUFZLElBQUksVUFBdEI7QUFDQSxZQUFNLE9BQU8sSUFBSSxPQUFKLEdBQWMsSUFBSSxJQUFsQixHQUF5QixJQUFJLFVBQUosQ0FBZSxJQUFJLElBQW5CLENBQXRDO0FBQ0EsZUFBTyxLQUFQLHlCQUFtQyxTQUFuQyxVQUFnRCxJQUFJLE9BQUosR0FBYyxZQUFkLEdBQTZCLFFBQTdFO0FBQ0EsWUFBSSxhQUFhLEtBQUssaUJBQUwsQ0FBdUIsU0FBdkIsQ0FBakIsRUFBb0Q7QUFDbEQsZUFBSyxpQkFBTCxDQUF1QixTQUF2QixFQUFrQyxRQUFsQyxD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QUwsQ0FBbUIsT0FBbkIsRUFBUDtBQUNEOzs7OEJBRVM7QUFDUixXQUFLLFdBQUwsR0FBbUIsSUFBbkI7QUFDQSxVQUFJLEtBQUssa0JBQVQsRUFBNkIsYUFBYSxLQUFLLGtCQUFsQjtBQUM3QixXQUFLLGlCQUFMLEdBQXlCLElBQXpCO0FBQ0Q7Ozs7OztBQUdILHdCQUF3QixTQUF4QixDQUFrQyxjQUFsQyxHQUFtRCxDQUFuRDs7QUFFQTs7OztBQUlBLHdCQUF3QixTQUF4QixDQUFrQyxNQUFsQyxHQUEyQyxJQUEzQzs7QUFFQSx3QkFBd0IsU0FBeEIsQ0FBa0MsaUJBQWxDLEdBQXNELElBQXREOztBQUVBLHdCQUF3QixTQUF4QixDQUFrQyxrQkFBbEMsR0FBdUQsQ0FBdkQ7O0FBRUEsd0JBQXdCLFNBQXhCLENBQWtDLGFBQWxDLEdBQWtELElBQWxEOztBQUVBLE9BQU8sT0FBUCxHQUFpQix1QkFBakIiLCJmaWxlIjoicmVxdWVzdC1tYW5hZ2VyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAY2xhc3MgIGxheWVyLldlYnNvY2tldHMuUmVxdWVzdE1hbmFnZXJcbiAqIEBwcml2YXRlXG4gKlxuICogVGhpcyBjbGFzcyBhbGxvd3Mgb25lIHRvIHNlbmQgcmVxdWVzdHMgdG8gdGhlIHdlYnNvY2tldCBzZXJ2ZXIsIGFuZCBwcm92aWRlIGEgY2FsbGJhY2ssXG4gKiBBbmQgaGF2ZSB0aGF0IGNhbGxiYWNrIGVpdGhlciBjYWxsZWQgYnkgdGhlIGNvcnJlY3Qgd2Vic29ja2V0IHNlcnZlciByZXNwb25zZSwgb3JcbiAqIGJlIGNhbGxlZCB3aXRoIGEgdGltZW91dC5cbiAqL1xuY29uc3QgVXRpbHMgPSByZXF1aXJlKCcuLi9jbGllbnQtdXRpbHMnKTtcbmNvbnN0IGxvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlcicpO1xuY29uc3QgTGF5ZXJFcnJvciA9IHJlcXVpcmUoJy4uL2xheWVyLWVycm9yJyk7XG5cbi8vIFdhaXQgMTUgc2Vjb25kcyBmb3IgYSByZXNwb25zZSBhbmQgdGhlbiBnaXZlIHVwXG5jb25zdCBERUxBWV9VTlRJTF9USU1FT1VUID0gMTUgKiAxMDAwO1xuXG5jbGFzcyBXZWJzb2NrZXRSZXF1ZXN0TWFuYWdlciB7XG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgd2Vic29ja2V0IGNoYW5nZSBtYW5hZ2VyXG4gICAqXG4gICAqICAgICAgdmFyIHdlYnNvY2tldFJlcXVlc3RNYW5hZ2VyID0gbmV3IGxheWVyLldlYnNvY2tldHMuUmVxdWVzdE1hbmFnZXIoe1xuICAgKiAgICAgICAgICBjbGllbnQ6IGNsaWVudCxcbiAgICogICAgICAgICAgc29ja2V0TWFuYWdlcjogY2xpZW50LldlYnNvY2tldHMuU29ja2V0TWFuYWdlclxuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBAbWV0aG9kXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0ge2xheWVyLkNsaWVudH0gY2xpZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuV2Vic29ja2V0cy5Tb2NrZXRNYW5hZ2VyfSBzb2NrZXRNYW5hZ2VyXG4gICAqIEByZXR1cm5zIHtsYXllci5XZWJzb2NrZXRzLlJlcXVlc3RNYW5hZ2VyfVxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIHRoaXMuY2xpZW50ID0gb3B0aW9ucy5jbGllbnQ7XG4gICAgdGhpcy5zb2NrZXRNYW5hZ2VyID0gb3B0aW9ucy5zb2NrZXRNYW5hZ2VyO1xuICAgIHRoaXMuc29ja2V0TWFuYWdlci5vbih7XG4gICAgICBtZXNzYWdlOiB0aGlzLl9oYW5kbGVSZXNwb25zZSxcbiAgICAgIGRpc2Nvbm5lY3RlZDogdGhpcy5fcmVzZXQsXG4gICAgfSwgdGhpcyk7XG5cbiAgICB0aGlzLl9yZXF1ZXN0Q2FsbGJhY2tzID0ge307XG4gIH1cblxuICBfcmVzZXQoKSB7XG4gICAgdGhpcy5fcmVxdWVzdENhbGxiYWNrcyA9IHt9O1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSBhIHJlc3BvbnNlIHRvIGEgcmVxdWVzdC5cbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlUmVzcG9uc2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICBfaGFuZGxlUmVzcG9uc2UoZXZ0KSB7XG4gICAgaWYgKGV2dC5kYXRhLnR5cGUgPT09ICdyZXNwb25zZScpIHtcbiAgICAgIGNvbnN0IG1zZyA9IGV2dC5kYXRhLmJvZHk7XG4gICAgICBjb25zdCByZXF1ZXN0SWQgPSBtc2cucmVxdWVzdF9pZDtcbiAgICAgIGNvbnN0IGRhdGEgPSBtc2cuc3VjY2VzcyA/IG1zZy5kYXRhIDogbmV3IExheWVyRXJyb3IobXNnLmRhdGEpO1xuICAgICAgbG9nZ2VyLmRlYnVnKGBXZWJzb2NrZXQgcmVzcG9uc2UgJHtyZXF1ZXN0SWR9ICR7bXNnLnN1Y2Nlc3MgPyAnU3VjY2Vzc2Z1bCcgOiAnRmFpbGVkJ31gKTtcbiAgICAgIGlmIChyZXF1ZXN0SWQgJiYgdGhpcy5fcmVxdWVzdENhbGxiYWNrc1tyZXF1ZXN0SWRdKSB7XG4gICAgICAgIHRoaXMuX3JlcXVlc3RDYWxsYmFja3NbcmVxdWVzdElkXS5jYWxsYmFjayh7XG4gICAgICAgICAgc3VjY2VzczogbXNnLnN1Y2Nlc3MsXG4gICAgICAgICAgZnVsbERhdGE6IGV2dC5kYXRhLFxuICAgICAgICAgIGRhdGEsXG4gICAgICAgIH0pO1xuICAgICAgICBkZWxldGUgdGhpcy5fcmVxdWVzdENhbGxiYWNrc1tyZXF1ZXN0SWRdO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTaG9ydGN1dCBmb3Igc2VuZGluZyBhIHJlcXVlc3Q7IGJ1aWxkcyBpbiBoYW5kbGluZyBmb3IgY2FsbGJhY2tzXG4gICAqXG4gICAqICAgIG1hbmFnZXIuc2VuZFJlcXVlc3Qoe1xuICAgKiAgICAgIG9wZXJhdGlvbjogXCJkZWxldGVcIixcbiAgICogICAgICBvYmplY3Q6IHtpZDogXCJsYXllcjovLy9jb252ZXJzYXRpb25zL3V1aWRcIn0sXG4gICAqICAgICAgZGF0YToge2RlbGV0aW9uX21vZGU6IFwiYWxsX3BhcnRpY2lwYW50c1wifVxuICAgKiAgICB9LCBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICogICAgICAgIGFsZXJ0KHJlc3VsdC5zdWNjZXNzID8gXCJZYXlcIiA6IFwiQm9vXCIpO1xuICAgKiAgICB9KTtcbiAgICpcbiAgICogQG1ldGhvZCBzZW5kUmVxdWVzdFxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgLSBEYXRhIHRvIHNlbmQgdG8gdGhlIHNlcnZlclxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gY2FsbGJhY2sgLSBIYW5kbGVyIGZvciBzdWNjZXNzL2ZhaWx1cmUgY2FsbGJhY2tcbiAgICovXG4gIHNlbmRSZXF1ZXN0KGRhdGEsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCF0aGlzLl9pc09wZW4oKSkge1xuICAgICAgcmV0dXJuICFjYWxsYmFjayA/IHVuZGVmaW5lZCA6IGNhbGxiYWNrKG5ldyBMYXllckVycm9yKHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIGRhdGE6IHsgaWQ6ICdub3RfY29ubmVjdGVkJywgY29kZTogMCwgbWVzc2FnZTogJ1dlYlNvY2tldCBub3QgY29ubmVjdGVkJyB9LFxuICAgICAgfSkpO1xuICAgIH1cbiAgICBjb25zdCBib2R5ID0gVXRpbHMuY2xvbmUoZGF0YSk7XG4gICAgYm9keS5yZXF1ZXN0X2lkID0gJ3InICsgdGhpcy5fbmV4dFJlcXVlc3RJZCsrO1xuICAgIGxvZ2dlci5kZWJ1ZyhgUmVxdWVzdCAke2JvZHkucmVxdWVzdF9pZH0gaXMgc2VuZGluZ2ApO1xuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgdGhpcy5fcmVxdWVzdENhbGxiYWNrc1tib2R5LnJlcXVlc3RfaWRdID0ge1xuICAgICAgICBkYXRlOiBEYXRlLm5vdygpLFxuICAgICAgICBjYWxsYmFjayxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgdGhpcy5zb2NrZXRNYW5hZ2VyLnNlbmQoe1xuICAgICAgdHlwZTogJ3JlcXVlc3QnLFxuICAgICAgYm9keSxcbiAgICB9KTtcbiAgICB0aGlzLl9zY2hlZHVsZUNhbGxiYWNrQ2xlYW51cCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEZsYWdzIGEgcmVxdWVzdCBhcyBoYXZpbmcgZmFpbGVkIGlmIG5vIHJlc3BvbnNlIHdpdGhpbiAyIG1pbnV0ZXNcbiAgICpcbiAgICogQG1ldGhvZCBfc2NoZWR1bGVDYWxsYmFja0NsZWFudXBcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9zY2hlZHVsZUNhbGxiYWNrQ2xlYW51cCgpIHtcbiAgICBpZiAoIXRoaXMuX2NhbGxiYWNrQ2xlYW51cElkKSB7XG4gICAgICB0aGlzLl9jYWxsYmFja0NsZWFudXBJZCA9IHNldFRpbWVvdXQodGhpcy5fcnVuQ2FsbGJhY2tDbGVhbnVwLmJpbmQodGhpcyksIERFTEFZX1VOVElMX1RJTUVPVVQgKyA1MCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxzIGNhbGxiYWNrIHdpdGggYW4gZXJyb3IuXG4gICAqXG4gICAqIE5PVEU6IEJlY2F1c2Ugd2UgY2FsbCByZXF1ZXN0cyB0aGF0IGV4cGVjdCByZXNwb25zZXMgc2VyaWFsbHkgaW5zdGVhZCBvZiBpbiBwYXJhbGxlbCxcbiAgICogY3VycmVudGx5IHRoZXJlIHNob3VsZCBvbmx5IGV2ZXIgYmUgYSBzaW5nbGUgZW50cnkgaW4gX3JlcXVlc3RDYWxsYmFja3MuICBUaGlzIG1heSBjaGFuZ2UgaW4gdGhlIGZ1dHVyZS5cbiAgICpcbiAgICogQG1ldGhvZCBfcnVuQ2FsbGJhY2tDbGVhbnVwXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcnVuQ2FsbGJhY2tDbGVhbnVwKCkge1xuICAgIHRoaXMuX2NhbGxiYWNrQ2xlYW51cElkID0gMDtcbiAgICAvLyBJZiB0aGUgd2Vic29ja2V0IGlzIGNsb3NlZCwgaWdub3JlIGFsbCBjYWxsYmFja3MuICBUaGUgU3luYyBNYW5hZ2VyIHdpbGwgcmVpc3N1ZSB0aGVzZSByZXF1ZXN0cyBhcyBzb29uIGFzIGl0IGdldHNcbiAgICAvLyBhICdjb25uZWN0ZWQnIGV2ZW50Li4uIHRoZXkgaGF2ZSBub3QgZmFpbGVkLiAgTWF5IG5lZWQgdG8gcmV0aGluayB0aGlzIGZvciBjYXNlcyB3aGVyZSB0aGlyZCBwYXJ0aWVzIGFyZSBkaXJlY3RseVxuICAgIC8vIGNhbGxpbmcgdGhlIHdlYnNvY2tldCBtYW5hZ2VyIGJ5cGFzc2luZyB0aGUgc3luYyBtYW5hZ2VyLlxuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkIHx8ICF0aGlzLl9pc09wZW4oKSkgcmV0dXJuO1xuICAgIGxldCBjb3VudCA9IDA7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICBPYmplY3Qua2V5cyh0aGlzLl9yZXF1ZXN0Q2FsbGJhY2tzKS5mb3JFYWNoKHJlcXVlc3RJZCA9PiB7XG4gICAgICBjb25zdCBjYWxsYmFja0NvbmZpZyA9IHRoaXMuX3JlcXVlc3RDYWxsYmFja3NbcmVxdWVzdElkXTtcbiAgICAgIC8vIElmIHRoZSByZXF1ZXN0IGhhc24ndCBleHBpcmVkLCB3ZSdsbCBuZWVkIHRvIHJlc2NoZWR1bGUgY2FsbGJhY2sgY2xlYW51cDsgZWxzZSBpZiBpdHMgZXhwaXJlZC4uLlxuICAgICAgaWYgKGNhbGxiYWNrQ29uZmlnICYmIG5vdyA8IGNhbGxiYWNrQ29uZmlnLmRhdGUgKyBERUxBWV9VTlRJTF9USU1FT1VUKSB7XG4gICAgICAgIGNvdW50Kys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBJZiB0aGVyZSBoYXMgYmVlbiBubyBkYXRhIGZyb20gdGhlIHNlcnZlciwgdGhlcmUncyBwcm9iYWJseSBhIHByb2JsZW0gd2l0aCB0aGUgd2Vic29ja2V0OyByZWNvbm5lY3QuXG4gICAgICAgIGlmIChub3cgPiB0aGlzLnNvY2tldE1hbmFnZXIuX2xhc3REYXRhRnJvbVNlcnZlclRpbWVzdGFtcCArIERFTEFZX1VOVElMX1RJTUVPVVQpIHtcbiAgICAgICAgICB0aGlzLnNvY2tldE1hbmFnZXIuX3JlY29ubmVjdChmYWxzZSk7XG4gICAgICAgICAgdGhpcy5fc2NoZWR1bGVDYWxsYmFja0NsZWFudXAoKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gVGhlIHJlcXVlc3QgaXNuJ3QgcmVzcG9uZGluZyBhbmQgdGhlIHNvY2tldCBpcyBnb29kOyBmYWlsIHRoZSByZXF1ZXN0LlxuICAgICAgICAgIHRoaXMuX3RpbWVvdXRSZXF1ZXN0KHJlcXVlc3RJZCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoY291bnQpIHRoaXMuX3NjaGVkdWxlQ2FsbGJhY2tDbGVhbnVwKCk7XG4gIH1cblxuICBfdGltZW91dFJlcXVlc3QocmVxdWVzdElkKSB7XG4gICAgdHJ5IHtcbiAgICAgIGxvZ2dlci53YXJuKCdXZWJzb2NrZXQgcmVxdWVzdCB0aW1lb3V0Jyk7XG4gICAgICB0aGlzLl9yZXF1ZXN0Q2FsbGJhY2tzW3JlcXVlc3RJZF0uY2FsbGJhY2soe1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgZGF0YTogbmV3IExheWVyRXJyb3Ioe1xuICAgICAgICAgIGlkOiAncmVxdWVzdF90aW1lb3V0JyxcbiAgICAgICAgICBtZXNzYWdlOiAnVGhlIHNlcnZlciBpcyBub3QgcmVzcG9uZGluZy4gV2Uga25vdyBob3cgbXVjaCB0aGF0IHN1Y2tzLicsXG4gICAgICAgICAgdXJsOiAnaHR0cHM6L2RldmVsb3Blci5sYXllci5jb20vZG9jcy93ZWJzZGsnLFxuICAgICAgICAgIGNvZGU6IDAsXG4gICAgICAgICAgc3RhdHVzOiA0MDgsXG4gICAgICAgICAgaHR0cFN0YXR1czogNDA4LFxuICAgICAgICB9KSxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgLy8gRG8gbm90aGluZ1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fcmVxdWVzdENhbGxiYWNrc1tyZXF1ZXN0SWRdO1xuICB9XG5cbiAgX2lzT3BlbigpIHtcbiAgICByZXR1cm4gdGhpcy5zb2NrZXRNYW5hZ2VyLl9pc09wZW4oKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5pc0Rlc3Ryb3llZCA9IHRydWU7XG4gICAgaWYgKHRoaXMuX2NhbGxiYWNrQ2xlYW51cElkKSBjbGVhclRpbWVvdXQodGhpcy5fY2FsbGJhY2tDbGVhbnVwSWQpO1xuICAgIHRoaXMuX3JlcXVlc3RDYWxsYmFja3MgPSBudWxsO1xuICB9XG59XG5cbldlYnNvY2tldFJlcXVlc3RNYW5hZ2VyLnByb3RvdHlwZS5fbmV4dFJlcXVlc3RJZCA9IDE7XG5cbi8qKlxuICogVGhlIENsaWVudCB0aGF0IG93bnMgdGhpcy5cbiAqIEB0eXBlIHtsYXllci5DbGllbnR9XG4gKi9cbldlYnNvY2tldFJlcXVlc3RNYW5hZ2VyLnByb3RvdHlwZS5jbGllbnQgPSBudWxsO1xuXG5XZWJzb2NrZXRSZXF1ZXN0TWFuYWdlci5wcm90b3R5cGUuX3JlcXVlc3RDYWxsYmFja3MgPSBudWxsO1xuXG5XZWJzb2NrZXRSZXF1ZXN0TWFuYWdlci5wcm90b3R5cGUuX2NhbGxiYWNrQ2xlYW51cElkID0gMDtcblxuV2Vic29ja2V0UmVxdWVzdE1hbmFnZXIucHJvdG90eXBlLnNvY2tldE1hbmFnZXIgPSBudWxsO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFdlYnNvY2tldFJlcXVlc3RNYW5hZ2VyO1xuXG4iXX0=
