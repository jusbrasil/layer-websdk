'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * This component manages
 *
 * 1. recieving websocket events
 * 2. Processing them
 * 3. Triggering events on completing them
 * 4. Sending them
 *
 * Applications typically do not interact with this component, but may subscribe
 * to the `message` event if they want richer event information than is available
 * through the layer.Client class.
 *
 * @class  layer.Websockets.SocketManager
 * @extends layer.Root
 * @private
 */
var Root = require('../root');
var Utils = require('../client-utils');
var logger = require('../logger');

var _require = require('../const');

var WEBSOCKET_PROTOCOL = _require.WEBSOCKET_PROTOCOL;

var SocketManager = function (_Root) {
  _inherits(SocketManager, _Root);

  /**
   * Create a new websocket manager
   *
   *      var socketManager = new layer.Websockets.SocketManager({
   *          client: client,
   *      });
   *
   * @method
   * @param  {Object} options
   * @param {layer.Client} client
   * @return {layer.Websockets.SocketManager}
   */
  function SocketManager(options) {
    _classCallCheck(this, SocketManager);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(SocketManager).call(this, options));

    if (!_this.client) throw new Error('SocketManager requires a client');

    // Insure that on/off methods don't need to call bind, therefore making it easy
    // to add/remove functions as event listeners.
    _this._onMessage = _this._onMessage.bind(_this);
    _this._onOpen = _this._onOpen.bind(_this);
    _this._onSocketClose = _this._onSocketClose.bind(_this);
    _this._onError = _this._onError.bind(_this);

    // If the client is authenticated, start it up.
    if (_this.client.isAuthenticated && _this.client.onlineManager.isOnline) {
      _this.connect();
    }

    _this.client.on('online', _this._onlineStateChange, _this);

    // Any time the Client triggers a ready event we need to reconnect.
    _this.client.on('authenticated', _this.connect, _this);

    _this._lastTimestamp = Date.now();
    return _this;
  }

  /**
   * Call this when we want to reset all websocket state; this would be done after a lengthy period
   * of being disconnected.  This prevents Event.replay from being called on reconnecting.
   *
   * @method _reset
   * @private
   */


  _createClass(SocketManager, [{
    key: '_reset',
    value: function _reset() {
      this._lastTimestamp = 0;
      this._lastDataFromServerTimestamp = 0;
      this._lastCounter = null;
      this._hasCounter = false;

      this._inReplay = false;
      this._needsReplayFrom = null;
    }

    /**
     * Event handler is triggered any time the client's online state changes.
     * If going online we need to reconnect (i.e. will close any existing websocket connections and then open a new connection)
     * If going offline, close the websocket as its no longer useful/relevant.
     * @method _onlineStateChange
     * @private
     * @param {layer.LayerEvent} evt
     */

  }, {
    key: '_onlineStateChange',
    value: function _onlineStateChange(evt) {
      if (!this.client.isAuthenticated) return;
      if (evt.isOnline) {
        this._reconnect(evt.reset);
      } else {
        this.close();
      }
    }

    /**
     * Reconnect to the server, optionally resetting all data if needed.
     * @method _reconnect
     * @private
     * @param {boolean} reset
     */

  }, {
    key: '_reconnect',
    value: function _reconnect(reset) {
      // The sync manager will reissue any requests once it receives a 'connect' event from the websocket manager.
      // There is no need to have an error callback at this time.
      // Note that calls that come from sources other than the sync manager may suffer from this.
      // Once the websocket implements retry rather than the sync manager, we may need to enable it
      // to trigger a callback after sufficient time.  Just delete all callbacks.
      this.close();
      if (reset) this._reset();
      this.connect();
    }

    /**
     * Connect to the websocket server
     *
     * @method connect
     * @param  {layer.SyncEvent} evt - Ignored parameter
     */

  }, {
    key: 'connect',
    value: function connect(evt) {
      if (this.client.isDestroyed || !this.client.isOnline) return;

      this._closing = false;

      this._lastCounter = -1;

      // Load up our websocket component or shim
      /* istanbul ignore next */
      var WS = typeof WebSocket === 'undefined' ? require('websocket').w3cwebsocket : WebSocket;

      // Get the URL and connect to it
      var url = this.client.websocketUrl + '/?session_token=' + this.client.sessionToken;

      this._socket = new WS(url, WEBSOCKET_PROTOCOL);

      // If its the shim, set the event hanlers
      /* istanbul ignore if */
      if (typeof WebSocket === 'undefined') {
        this._socket.onmessage = this._onMessage;
        this._socket.onclose = this._onSocketClose;
        this._socket.onopen = this._onOpen;
        this._socket.onerror = this._onError;
      }

      // If its a real websocket, add the event handlers
      else {
          this._socket.addEventListener('message', this._onMessage);
          this._socket.addEventListener('close', this._onSocketClose);
          this._socket.addEventListener('open', this._onOpen);
          this._socket.addEventListener('error', this._onError);
        }

      // Trigger a failure if it takes >= 5 seconds to establish a connection
      this._connectionFailedId = setTimeout(this._connectionFailed.bind(this), 5000);
    }

    /**
     * Clears the scheduled call to _connectionFailed that is used to insure the websocket does not get stuck
     * in CONNECTING state. This call is used after the call has completed or failed.
     *
     * @method _clearConnectionFailed
     * @private
     */

  }, {
    key: '_clearConnectionFailed',
    value: function _clearConnectionFailed() {
      if (this._connectionFailedId) {
        clearTimeout(this._connectionFailedId);
        this._connectionFailedId = 0;
      }
    }

    /**
     * Called after 5 seconds of entering CONNECTING state without getting an error or a connection.
     * Calls _onError which will cause this attempt to be stopped and another connection attempt to be scheduled.
     *
     * @method _connectionFailed
     * @private
     */

  }, {
    key: '_connectionFailed',
    value: function _connectionFailed() {
      this._connectionFailedId = 0;
      var msg = 'Websocket failed to connect to server';
      logger.warn(msg);

      // TODO: At this time there is little information on what happens when closing a websocket connection that is stuck in
      // readyState=CONNECTING.  Does it throw an error?  Does it call the onClose or onError event handlers?
      // Remove all event handlers so that calling close won't trigger any calls.
      try {
        this.isOpen = false;
        this._removeSocketEvents();
        if (this._socket) {
          this._socket.close();
          this._socket = null;
        }
      } catch (e) {}
      // No-op


      // Now we can call our error handler.
      this._onError(new Error(msg));
    }

    /**
     * The websocket connection is reporting that its now open.
     *
     * @method _onOpen
     * @private
     */

  }, {
    key: '_onOpen',
    value: function _onOpen() {
      this._clearConnectionFailed();
      if (this._isOpen()) {
        this._lostConnectionCount = 0;
        this.isOpen = true;
        this.trigger('connected');
        logger.debug('Websocket Connected');
        if (this._hasCounter) {
          this.replayEvents(this._lastTimestamp, true);
        } else {
          this._reschedulePing();
        }
      }
    }

    /**
     * Tests to see if the websocket connection is open.  Use the isOpen property
     * for external tests.
     * @method _isOpen
     * @private
     * @returns {Boolean}
     */

  }, {
    key: '_isOpen',
    value: function _isOpen() {
      if (!this._socket) return false;
      /* istanbul ignore if */
      if (typeof WebSocket === 'undefined') return true;
      return this._socket && this._socket.readyState === WebSocket.OPEN;
    }

    /**
     * If not isOpen, presumably failed to connect
     * Any other error can be ignored... if the connection has
     * failed, onClose will handle it.
     *
     * @method _onError
     * @private
     * @param  {Error} err - Websocket error
     */

  }, {
    key: '_onError',
    value: function _onError(err) {
      if (this._closing) return;
      this._clearConnectionFailed();
      logger.debug('Websocket Error causing websocket to close', err);
      if (!this.isOpen) {
        this._removeSocketEvents();
        this._lostConnectionCount++;
        this._scheduleReconnect();
      } else {
        this._onSocketClose();
        this._socket.close();
        this._socket = null;
      }
    }

    /**
     * Shortcut method for sending a signal
     *
     *    manager.sendSignal({
            'type': 'typing_indicator',
            'object': {
              'id': this.conversation.id
            },
            'data': {
              'action': state
            }
          });
     *
     * @method sendSignal
     * @param  {Object} body - Signal body
     */

  }, {
    key: 'sendSignal',
    value: function sendSignal(body) {
      if (this._isOpen()) {
        this._socket.send(JSON.stringify({
          type: 'signal',
          body: body
        }));
      }
    }

    /**
     * Shortcut to sending a Counter.read request
     *
     * @method getCounter
     * @param  {Function} callback
     * @param {boolean} callback.success
     * @param {number} callback.lastCounter
     * @param {number} callback.newCounter
     */

  }, {
    key: 'getCounter',
    value: function getCounter(callback) {
      logger.debug('Websocket request: getCounter');
      this.client.socketRequestManager.sendRequest({
        method: 'Counter.read'
      }, function (result) {
        logger.debug('Websocket response: getCounter ' + result.data.counter);
        if (callback) {
          if (result.success) {
            callback(true, result.data.counter, result.fullData.counter);
          } else {
            callback(false);
          }
        }
      });
    }

    /**
     * Replays all missed change packets since the specified timestamp
     *
     * @method replayEvents
     * @param  {string|number}   timestamp - Iso formatted date string; if number will be transformed into formatted date string.
     * @param  {boolean} [force=false] - if true, cancel any in progress replayEvents and start a new one
     * @param  {Function} [callback] - Optional callback for completion
     */

  }, {
    key: 'replayEvents',
    value: function replayEvents(timestamp, force, callback) {
      var _this2 = this;

      if (!timestamp) return;
      if (force) this._inReplay = false;
      if (typeof timestamp === 'number') timestamp = new Date(timestamp).toISOString();

      // If we are already waiting for a replay to complete, record the timestamp from which we
      // need to replay on our next replay request
      // If we are simply unable to replay because we're disconnected, capture the _needsReplayFrom
      if (this._inReplay || !this._isOpen()) {
        if (!this._needsReplayFrom) {
          logger.debug('Websocket request: replayEvents updating _needsReplayFrom');
          this._needsReplayFrom = timestamp;
        }
      } else {
        this._inReplay = true;
        logger.info('Websocket request: replayEvents');
        this.client.socketRequestManager.sendRequest({
          method: 'Event.replay',
          data: {
            from_timestamp: timestamp
          }
        }, function (result) {
          return _this2._replayEventsComplete(timestamp, callback, result.success);
        });
      }
    }

    /**
     * Callback for handling completion of replay.
     *
     * @method _replayEventsComplete
     * @private
     * @param  {Date}     timestamp
     * @param  {Function} callback
     * @param  {Boolean}   success
     */

  }, {
    key: '_replayEventsComplete',
    value: function _replayEventsComplete(timestamp, callback, success) {
      var _this3 = this;

      this._inReplay = false;

      if (success) {

        // If replay was completed, and no other requests for replay, then trigger synced;
        // we're done.
        if (!this._needsReplayFrom) {
          logger.info('Websocket replay complete');
          this.trigger('synced');
          if (callback) callback();
        }

        // If replayEvents was called during a replay, then replay
        // from the given timestamp.  If request failed, then we need to retry from _lastTimestamp
        else if (this._needsReplayFrom) {
            logger.info('Websocket replay partially complete');
            var t = this._needsReplayFrom;
            this._needsReplayFrom = null;
            this.replayEvents(t);
          }
      }

      // We never got a done event; but either got an error from the server or the request timed out.
      // Use exponential backoff incremented integers that getExponentialBackoffSeconds mapping to roughly
      // 0.4 seconds - 12.8 seconds, and then stops retrying.
      else if (this._replayRetryCount < 8) {
          var maxDelay = 20;
          var delay = Utils.getExponentialBackoffSeconds(maxDelay, Math.min(15, this._replayRetryCount + 2));
          logger.info('Websocket replay retry in ' + delay + ' seconds');
          setTimeout(function () {
            return _this3.replayEvents(timestamp);
          }, delay * 1000);
          this._replayRetryCount++;
        } else {
          logger.error('Websocket Event.replay has failed');
        }
    }

    /**
     * Handles a new websocket packet from the server
     *
     * @method _onMessage
     * @private
     * @param  {Object} evt - Message from the server
     */

  }, {
    key: '_onMessage',
    value: function _onMessage(evt) {
      this._lostConnectionCount = 0;
      try {
        var msg = JSON.parse(evt.data);
        var skippedCounter = this._lastCounter + 1 !== msg.counter;
        this._hasCounter = true;
        this._lastCounter = msg.counter;
        this._lastDataFromServerTimestamp = Date.now();

        // If we've missed a counter, replay to get; note that we had to update _lastCounter
        // for replayEvents to work correctly.
        if (skippedCounter) {
          this.replayEvents(this._lastTimestamp);
        } else {
          this._lastTimestamp = new Date(msg.timestamp).getTime();
        }

        this.trigger('message', {
          data: msg
        });

        this._reschedulePing();
      } catch (err) {
        logger.error('Layer-Websocket: Failed to handle websocket message: ' + err + '\n', evt.data);
      }
    }

    /**
     * Reschedule a ping request which helps us verify that the connection is still alive,
     * and that we haven't missed any events.
     *
     * @method _reschedulePing
     * @private
     */

  }, {
    key: '_reschedulePing',
    value: function _reschedulePing() {
      if (this._nextPingId) {
        clearTimeout(this._nextPingId);
      }
      this._nextPingId = setTimeout(this._ping.bind(this), this.pingFrequency);
    }

    /**
     * Send a counter request to the server to verify that we are still connected and
     * have not missed any events.
     *
     * @method _ping
     * @private
     */

  }, {
    key: '_ping',
    value: function _ping() {
      logger.debug('Websocket ping');
      this._nextPingId = 0;
      if (this._isOpen()) {
        // NOTE: onMessage will already have called reschedulePing, but if there was no response, then the error handler would NOT have called it.
        this.getCounter(this._reschedulePing.bind(this));
      }
    }

    /**
     * Close the websocket.
     *
     * @method close
     */

  }, {
    key: 'close',
    value: function close() {
      logger.debug('Websocket close requested');
      this._closing = true;
      this.isOpen = false;
      if (this._socket) {
        // Close all event handlers and set socket to null
        // without waiting for browser event to call
        // _onSocketClose as the next command after close
        // might require creating a new socket
        this._onSocketClose();
        this._socket.close();
        this._socket = null;
      }
    }

    /**
     * Send a packet across the websocket
     * @method send
     * @param {Object} obj
     */

  }, {
    key: 'send',
    value: function send(obj) {
      this._socket.send(JSON.stringify(obj));
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      this.close();
      if (this._nextPingId) clearTimeout(this._nextPingId);
      _get(Object.getPrototypeOf(SocketManager.prototype), 'destroy', this).call(this);
    }

    /**
     * If the socket has closed (or if the close method forces it closed)
     * Remove all event handlers and if appropriate, schedule a retry.
     *
     * @method _onSocketClose
     * @private
     */

  }, {
    key: '_onSocketClose',
    value: function _onSocketClose() {
      logger.debug('Websocket closed');
      this.isOpen = false;
      if (!this._closing) {
        this._scheduleReconnect();
      }

      this._removeSocketEvents();
      this.trigger('disconnected');
    }

    /**
     * Removes all event handlers on the current socket.
     *
     * @method _removeSocketEvents
     * @private
     */

  }, {
    key: '_removeSocketEvents',
    value: function _removeSocketEvents() {
      /* istanbul ignore if */
      if (typeof WebSocket !== 'undefined' && this._socket) {
        this._socket.removeEventListener('message', this._onMessage);
        this._socket.removeEventListener('close', this._onSocketClose);
        this._socket.removeEventListener('open', this._onOpen);
        this._socket.removeEventListener('error', this._onError);
      } else if (this._socket) {
        this._socket.onmessage = null;
        this._socket.onclose = null;
        this._socket.onopen = null;
        this._socket.onerror = null;
      }
    }

    /**
     * Schedule an attempt to reconnect to the server.  If the onlineManager
     * declares us to be offline, don't bother reconnecting.  A reconnect
     * attempt will be triggered as soon as the online manager reports we are online again.
     *
     * Note that the duration of our delay can not excede the onlineManager's ping frequency
     * or it will declare us to be offline while we attempt a reconnect.
     *
     * @method _scheduleReconnect
     * @private
     */

  }, {
    key: '_scheduleReconnect',
    value: function _scheduleReconnect() {
      if (this.isDestroyed || !this.client.isOnline) return;

      var maxDelay = (this.client.onlineManager.pingFrequency - 1000) / 1000;
      var delay = Utils.getExponentialBackoffSeconds(maxDelay, Math.min(15, this._lostConnectionCount));
      logger.debug('Websocket Reconnect in ' + delay + ' seconds');
      this._reconnectId = setTimeout(this._validateSessionBeforeReconnect.bind(this), delay * 1000);
    }

    /**
     * Before the scheduled reconnect can call `connect()` validate that we didn't lose the websocket
     * due to loss of authentication.
     *
     * @method _validateSessionBeforeReconnect
     * @private
     */

  }, {
    key: '_validateSessionBeforeReconnect',
    value: function _validateSessionBeforeReconnect() {
      var _this4 = this;

      if (this.isDestroyed || !this.client.isOnline) return;

      this.client.xhr({
        url: '/',
        method: 'GET',
        sync: false
      }, function (result) {
        if (result.success) _this4.connect();
        // if not successful, the this.client.xhr will handle reauthentication
      });
    }
  }]);

  return SocketManager;
}(Root);

/**
 * Is the websocket connection currently open?
 * @type {Boolean}
 */


SocketManager.prototype.isOpen = false;

/**
 * setTimeout ID for calling connect()
 * @private
 * @type {Number}
 */
SocketManager.prototype._reconnectId = 0;

/**
 * setTimeout ID for calling _connectionFailed()
 * @private
 * @type {Number}
 */
SocketManager.prototype._connectionFailedId = 0;

SocketManager.prototype._lastTimestamp = 0;
SocketManager.prototype._lastDataFromServerTimestamp = 0;
SocketManager.prototype._lastCounter = null;
SocketManager.prototype._hasCounter = false;

SocketManager.prototype._inReplay = false;
SocketManager.prototype._needsReplayFrom = null;

SocketManager.prototype._replayRetryCount = 0;

/**
 * Frequency with which the websocket checks to see if any websocket notifications
 * have been missed.
 * @type {Number}
 */
SocketManager.prototype.pingFrequency = 30000;

/**
 * The Client that owns this.
 * @type {layer.Client}
 */
SocketManager.prototype.client = null;

/**
 * The Socket Connection instance
 * @type {Websocket}
 */
SocketManager.prototype._socket = null;

/**
 * Is the websocket connection being closed by a call to close()?
 * If so, we can ignore any errors that signal the socket as closing.
 * @type {Boolean}
 */
SocketManager.prototype._closing = false;

/**
 * Number of failed attempts to reconnect.
 * @type {Number}
 */
SocketManager.prototype._lostConnectionCount = 0;

SocketManager._supportedEvents = [
/**
 * A data packet has been received from the server.
 * @event message
 * @param {layer.LayerEvent} layerEvent
 * @param {Object} layerEvent.data - The data that was received from the server
 */
'message',

/**
 * The websocket is now connected.
 * @event connected
 * @protected
 */
'connected',

/**
 * The websocket is no longer connected
 * @event disconnected
 * @protected
 */
'disconnected',

/**
 * Websocket events were missed; we are resyncing with the server
 * @event replay-begun
 */
'syncing',

/**
 * Websocket events were missed; we resynced with the server and are now done
 * @event replay-begun
 */
'synced'].concat(Root._supportedEvents);
Root.initClass.apply(SocketManager, [SocketManager, 'SocketManager']);
module.exports = SocketManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy93ZWJzb2NrZXRzL3NvY2tldC1tYW5hZ2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7Ozs7Ozs7O0FBZ0JBLElBQU0sT0FBTyxRQUFRLFNBQVIsQ0FBYjtBQUNBLElBQU0sUUFBUSxRQUFRLGlCQUFSLENBQWQ7QUFDQSxJQUFNLFNBQVMsUUFBUSxXQUFSLENBQWY7O2VBQytCLFFBQVEsVUFBUixDOztJQUF2QixrQixZQUFBLGtCOztJQUVGLGE7OztBQUNKOzs7Ozs7Ozs7Ozs7QUFZQSx5QkFBWSxPQUFaLEVBQXFCO0FBQUE7O0FBQUEsaUdBQ2IsT0FEYTs7QUFFbkIsUUFBSSxDQUFDLE1BQUssTUFBVixFQUFrQixNQUFNLElBQUksS0FBSixDQUFVLGlDQUFWLENBQU47O0FBRWxCO0FBQ0E7QUFDQSxVQUFLLFVBQUwsR0FBa0IsTUFBSyxVQUFMLENBQWdCLElBQWhCLE9BQWxCO0FBQ0EsVUFBSyxPQUFMLEdBQWUsTUFBSyxPQUFMLENBQWEsSUFBYixPQUFmO0FBQ0EsVUFBSyxjQUFMLEdBQXNCLE1BQUssY0FBTCxDQUFvQixJQUFwQixPQUF0QjtBQUNBLFVBQUssUUFBTCxHQUFnQixNQUFLLFFBQUwsQ0FBYyxJQUFkLE9BQWhCOztBQUVBO0FBQ0EsUUFBSSxNQUFLLE1BQUwsQ0FBWSxlQUFaLElBQStCLE1BQUssTUFBTCxDQUFZLGFBQVosQ0FBMEIsUUFBN0QsRUFBdUU7QUFDckUsWUFBSyxPQUFMO0FBQ0Q7O0FBRUQsVUFBSyxNQUFMLENBQVksRUFBWixDQUFlLFFBQWYsRUFBeUIsTUFBSyxrQkFBOUI7O0FBRUE7QUFDQSxVQUFLLE1BQUwsQ0FBWSxFQUFaLENBQWUsZUFBZixFQUFnQyxNQUFLLE9BQXJDOztBQUVBLFVBQUssY0FBTCxHQUFzQixLQUFLLEdBQUwsRUFBdEI7QUFyQm1CO0FBc0JwQjs7QUFFRDs7Ozs7Ozs7Ozs7NkJBT1M7QUFDUCxXQUFLLGNBQUwsR0FBc0IsQ0FBdEI7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aWxlIjoic29ja2V0LW1hbmFnZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRoaXMgY29tcG9uZW50IG1hbmFnZXNcbiAqXG4gKiAxLiByZWNpZXZpbmcgd2Vic29ja2V0IGV2ZW50c1xuICogMi4gUHJvY2Vzc2luZyB0aGVtXG4gKiAzLiBUcmlnZ2VyaW5nIGV2ZW50cyBvbiBjb21wbGV0aW5nIHRoZW1cbiAqIDQuIFNlbmRpbmcgdGhlbVxuICpcbiAqIEFwcGxpY2F0aW9ucyB0eXBpY2FsbHkgZG8gbm90IGludGVyYWN0IHdpdGggdGhpcyBjb21wb25lbnQsIGJ1dCBtYXkgc3Vic2NyaWJlXG4gKiB0byB0aGUgYG1lc3NhZ2VgIGV2ZW50IGlmIHRoZXkgd2FudCByaWNoZXIgZXZlbnQgaW5mb3JtYXRpb24gdGhhbiBpcyBhdmFpbGFibGVcbiAqIHRocm91Z2ggdGhlIGxheWVyLkNsaWVudCBjbGFzcy5cbiAqXG4gKiBAY2xhc3MgIGxheWVyLldlYnNvY2tldHMuU29ja2V0TWFuYWdlclxuICogQGV4dGVuZHMgbGF5ZXIuUm9vdFxuICogQHByaXZhdGVcbiAqL1xuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4uL3Jvb3QnKTtcbmNvbnN0IFV0aWxzID0gcmVxdWlyZSgnLi4vY2xpZW50LXV0aWxzJyk7XG5jb25zdCBsb2dnZXIgPSByZXF1aXJlKCcuLi9sb2dnZXInKTtcbmNvbnN0IHsgV0VCU09DS0VUX1BST1RPQ09MIH0gPSByZXF1aXJlKCcuLi9jb25zdCcpO1xuXG5jbGFzcyBTb2NrZXRNYW5hZ2VyIGV4dGVuZHMgUm9vdCB7XG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgd2Vic29ja2V0IG1hbmFnZXJcbiAgICpcbiAgICogICAgICB2YXIgc29ja2V0TWFuYWdlciA9IG5ldyBsYXllci5XZWJzb2NrZXRzLlNvY2tldE1hbmFnZXIoe1xuICAgKiAgICAgICAgICBjbGllbnQ6IGNsaWVudCxcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogQG1ldGhvZFxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdGlvbnNcbiAgICogQHBhcmFtIHtsYXllci5DbGllbnR9IGNsaWVudFxuICAgKiBAcmV0dXJuIHtsYXllci5XZWJzb2NrZXRzLlNvY2tldE1hbmFnZXJ9XG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgaWYgKCF0aGlzLmNsaWVudCkgdGhyb3cgbmV3IEVycm9yKCdTb2NrZXRNYW5hZ2VyIHJlcXVpcmVzIGEgY2xpZW50Jyk7XG5cbiAgICAvLyBJbnN1cmUgdGhhdCBvbi9vZmYgbWV0aG9kcyBkb24ndCBuZWVkIHRvIGNhbGwgYmluZCwgdGhlcmVmb3JlIG1ha2luZyBpdCBlYXN5XG4gICAgLy8gdG8gYWRkL3JlbW92ZSBmdW5jdGlvbnMgYXMgZXZlbnQgbGlzdGVuZXJzLlxuICAgIHRoaXMuX29uTWVzc2FnZSA9IHRoaXMuX29uTWVzc2FnZS5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX29uT3BlbiA9IHRoaXMuX29uT3Blbi5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX29uU29ja2V0Q2xvc2UgPSB0aGlzLl9vblNvY2tldENsb3NlLmJpbmQodGhpcyk7XG4gICAgdGhpcy5fb25FcnJvciA9IHRoaXMuX29uRXJyb3IuYmluZCh0aGlzKTtcblxuICAgIC8vIElmIHRoZSBjbGllbnQgaXMgYXV0aGVudGljYXRlZCwgc3RhcnQgaXQgdXAuXG4gICAgaWYgKHRoaXMuY2xpZW50LmlzQXV0aGVudGljYXRlZCAmJiB0aGlzLmNsaWVudC5vbmxpbmVNYW5hZ2VyLmlzT25saW5lKSB7XG4gICAgICB0aGlzLmNvbm5lY3QoKTtcbiAgICB9XG5cbiAgICB0aGlzLmNsaWVudC5vbignb25saW5lJywgdGhpcy5fb25saW5lU3RhdGVDaGFuZ2UsIHRoaXMpO1xuXG4gICAgLy8gQW55IHRpbWUgdGhlIENsaWVudCB0cmlnZ2VycyBhIHJlYWR5IGV2ZW50IHdlIG5lZWQgdG8gcmVjb25uZWN0LlxuICAgIHRoaXMuY2xpZW50Lm9uKCdhdXRoZW50aWNhdGVkJywgdGhpcy5jb25uZWN0LCB0aGlzKTtcblxuICAgIHRoaXMuX2xhc3RUaW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGwgdGhpcyB3aGVuIHdlIHdhbnQgdG8gcmVzZXQgYWxsIHdlYnNvY2tldCBzdGF0ZTsgdGhpcyB3b3VsZCBiZSBkb25lIGFmdGVyIGEgbGVuZ3RoeSBwZXJpb2RcbiAgICogb2YgYmVpbmcgZGlzY29ubmVjdGVkLiAgVGhpcyBwcmV2ZW50cyBFdmVudC5yZXBsYXkgZnJvbSBiZWluZyBjYWxsZWQgb24gcmVjb25uZWN0aW5nLlxuICAgKlxuICAgKiBAbWV0aG9kIF9yZXNldFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3Jlc2V0KCkge1xuICAgIHRoaXMuX2xhc3RUaW1lc3RhbXAgPSAwO1xuICAgIHRoaXMuX2xhc3REYXRhRnJvbVNlcnZlclRpbWVzdGFtcCA9IDA7XG4gICAgdGhpcy5fbGFzdENvdW50ZXIgPSBudWxsO1xuICAgIHRoaXMuX2hhc0NvdW50ZXIgPSBmYWxzZTtcblxuICAgIHRoaXMuX2luUmVwbGF5ID0gZmFsc2U7XG4gICAgdGhpcy5fbmVlZHNSZXBsYXlGcm9tID0gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBFdmVudCBoYW5kbGVyIGlzIHRyaWdnZXJlZCBhbnkgdGltZSB0aGUgY2xpZW50J3Mgb25saW5lIHN0YXRlIGNoYW5nZXMuXG4gICAqIElmIGdvaW5nIG9ubGluZSB3ZSBuZWVkIHRvIHJlY29ubmVjdCAoaS5lLiB3aWxsIGNsb3NlIGFueSBleGlzdGluZyB3ZWJzb2NrZXQgY29ubmVjdGlvbnMgYW5kIHRoZW4gb3BlbiBhIG5ldyBjb25uZWN0aW9uKVxuICAgKiBJZiBnb2luZyBvZmZsaW5lLCBjbG9zZSB0aGUgd2Vic29ja2V0IGFzIGl0cyBubyBsb25nZXIgdXNlZnVsL3JlbGV2YW50LlxuICAgKiBAbWV0aG9kIF9vbmxpbmVTdGF0ZUNoYW5nZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKi9cbiAgX29ubGluZVN0YXRlQ2hhbmdlKGV2dCkge1xuICAgIGlmICghdGhpcy5jbGllbnQuaXNBdXRoZW50aWNhdGVkKSByZXR1cm47XG4gICAgaWYgKGV2dC5pc09ubGluZSkge1xuICAgICAgdGhpcy5fcmVjb25uZWN0KGV2dC5yZXNldCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVjb25uZWN0IHRvIHRoZSBzZXJ2ZXIsIG9wdGlvbmFsbHkgcmVzZXR0aW5nIGFsbCBkYXRhIGlmIG5lZWRlZC5cbiAgICogQG1ldGhvZCBfcmVjb25uZWN0XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gcmVzZXRcbiAgICovXG4gIF9yZWNvbm5lY3QocmVzZXQpIHtcbiAgICAvLyBUaGUgc3luYyBtYW5hZ2VyIHdpbGwgcmVpc3N1ZSBhbnkgcmVxdWVzdHMgb25jZSBpdCByZWNlaXZlcyBhICdjb25uZWN0JyBldmVudCBmcm9tIHRoZSB3ZWJzb2NrZXQgbWFuYWdlci5cbiAgICAvLyBUaGVyZSBpcyBubyBuZWVkIHRvIGhhdmUgYW4gZXJyb3IgY2FsbGJhY2sgYXQgdGhpcyB0aW1lLlxuICAgIC8vIE5vdGUgdGhhdCBjYWxscyB0aGF0IGNvbWUgZnJvbSBzb3VyY2VzIG90aGVyIHRoYW4gdGhlIHN5bmMgbWFuYWdlciBtYXkgc3VmZmVyIGZyb20gdGhpcy5cbiAgICAvLyBPbmNlIHRoZSB3ZWJzb2NrZXQgaW1wbGVtZW50cyByZXRyeSByYXRoZXIgdGhhbiB0aGUgc3luYyBtYW5hZ2VyLCB3ZSBtYXkgbmVlZCB0byBlbmFibGUgaXRcbiAgICAvLyB0byB0cmlnZ2VyIGEgY2FsbGJhY2sgYWZ0ZXIgc3VmZmljaWVudCB0aW1lLiAgSnVzdCBkZWxldGUgYWxsIGNhbGxiYWNrcy5cbiAgICB0aGlzLmNsb3NlKCk7XG4gICAgaWYgKHJlc2V0KSB0aGlzLl9yZXNldCgpO1xuICAgIHRoaXMuY29ubmVjdCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbm5lY3QgdG8gdGhlIHdlYnNvY2tldCBzZXJ2ZXJcbiAgICpcbiAgICogQG1ldGhvZCBjb25uZWN0XG4gICAqIEBwYXJhbSAge2xheWVyLlN5bmNFdmVudH0gZXZ0IC0gSWdub3JlZCBwYXJhbWV0ZXJcbiAgICovXG4gIGNvbm5lY3QoZXZ0KSB7XG4gICAgaWYgKHRoaXMuY2xpZW50LmlzRGVzdHJveWVkIHx8ICF0aGlzLmNsaWVudC5pc09ubGluZSkgcmV0dXJuO1xuXG4gICAgdGhpcy5fY2xvc2luZyA9IGZhbHNlO1xuXG4gICAgdGhpcy5fbGFzdENvdW50ZXIgPSAtMTtcblxuICAgIC8vIExvYWQgdXAgb3VyIHdlYnNvY2tldCBjb21wb25lbnQgb3Igc2hpbVxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgY29uc3QgV1MgPSB0eXBlb2YgV2ViU29ja2V0ID09PSAndW5kZWZpbmVkJyA/IHJlcXVpcmUoJ3dlYnNvY2tldCcpLnczY3dlYnNvY2tldCA6IFdlYlNvY2tldDtcblxuICAgIC8vIEdldCB0aGUgVVJMIGFuZCBjb25uZWN0IHRvIGl0XG4gICAgY29uc3QgdXJsID0gYCR7dGhpcy5jbGllbnQud2Vic29ja2V0VXJsfS8/c2Vzc2lvbl90b2tlbj0ke3RoaXMuY2xpZW50LnNlc3Npb25Ub2tlbn1gO1xuXG4gICAgdGhpcy5fc29ja2V0ID0gbmV3IFdTKHVybCwgV0VCU09DS0VUX1BST1RPQ09MKTtcblxuICAgIC8vIElmIGl0cyB0aGUgc2hpbSwgc2V0IHRoZSBldmVudCBoYW5sZXJzXG4gICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgaWYgKHR5cGVvZiBXZWJTb2NrZXQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aGlzLl9zb2NrZXQub25tZXNzYWdlID0gdGhpcy5fb25NZXNzYWdlO1xuICAgICAgdGhpcy5fc29ja2V0Lm9uY2xvc2UgPSB0aGlzLl9vblNvY2tldENsb3NlO1xuICAgICAgdGhpcy5fc29ja2V0Lm9ub3BlbiA9IHRoaXMuX29uT3BlbjtcbiAgICAgIHRoaXMuX3NvY2tldC5vbmVycm9yID0gdGhpcy5fb25FcnJvcjtcbiAgICB9XG5cbiAgICAvLyBJZiBpdHMgYSByZWFsIHdlYnNvY2tldCwgYWRkIHRoZSBldmVudCBoYW5kbGVyc1xuICAgIGVsc2Uge1xuICAgICAgdGhpcy5fc29ja2V0LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCB0aGlzLl9vbk1lc3NhZ2UpO1xuICAgICAgdGhpcy5fc29ja2V0LmFkZEV2ZW50TGlzdGVuZXIoJ2Nsb3NlJywgdGhpcy5fb25Tb2NrZXRDbG9zZSk7XG4gICAgICB0aGlzLl9zb2NrZXQuYWRkRXZlbnRMaXN0ZW5lcignb3BlbicsIHRoaXMuX29uT3Blbik7XG4gICAgICB0aGlzLl9zb2NrZXQuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLl9vbkVycm9yKTtcbiAgICB9XG5cbiAgICAvLyBUcmlnZ2VyIGEgZmFpbHVyZSBpZiBpdCB0YWtlcyA+PSA1IHNlY29uZHMgdG8gZXN0YWJsaXNoIGEgY29ubmVjdGlvblxuICAgIHRoaXMuX2Nvbm5lY3Rpb25GYWlsZWRJZCA9IHNldFRpbWVvdXQodGhpcy5fY29ubmVjdGlvbkZhaWxlZC5iaW5kKHRoaXMpLCA1MDAwKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbGVhcnMgdGhlIHNjaGVkdWxlZCBjYWxsIHRvIF9jb25uZWN0aW9uRmFpbGVkIHRoYXQgaXMgdXNlZCB0byBpbnN1cmUgdGhlIHdlYnNvY2tldCBkb2VzIG5vdCBnZXQgc3R1Y2tcbiAgICogaW4gQ09OTkVDVElORyBzdGF0ZS4gVGhpcyBjYWxsIGlzIHVzZWQgYWZ0ZXIgdGhlIGNhbGwgaGFzIGNvbXBsZXRlZCBvciBmYWlsZWQuXG4gICAqXG4gICAqIEBtZXRob2QgX2NsZWFyQ29ubmVjdGlvbkZhaWxlZFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2NsZWFyQ29ubmVjdGlvbkZhaWxlZCgpIHtcbiAgICBpZiAodGhpcy5fY29ubmVjdGlvbkZhaWxlZElkKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fY29ubmVjdGlvbkZhaWxlZElkKTtcbiAgICAgIHRoaXMuX2Nvbm5lY3Rpb25GYWlsZWRJZCA9IDA7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCBhZnRlciA1IHNlY29uZHMgb2YgZW50ZXJpbmcgQ09OTkVDVElORyBzdGF0ZSB3aXRob3V0IGdldHRpbmcgYW4gZXJyb3Igb3IgYSBjb25uZWN0aW9uLlxuICAgKiBDYWxscyBfb25FcnJvciB3aGljaCB3aWxsIGNhdXNlIHRoaXMgYXR0ZW1wdCB0byBiZSBzdG9wcGVkIGFuZCBhbm90aGVyIGNvbm5lY3Rpb24gYXR0ZW1wdCB0byBiZSBzY2hlZHVsZWQuXG4gICAqXG4gICAqIEBtZXRob2QgX2Nvbm5lY3Rpb25GYWlsZWRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9jb25uZWN0aW9uRmFpbGVkKCkge1xuICAgIHRoaXMuX2Nvbm5lY3Rpb25GYWlsZWRJZCA9IDA7XG4gICAgY29uc3QgbXNnID0gJ1dlYnNvY2tldCBmYWlsZWQgdG8gY29ubmVjdCB0byBzZXJ2ZXInO1xuICAgIGxvZ2dlci53YXJuKG1zZyk7XG5cbiAgICAvLyBUT0RPOiBBdCB0aGlzIHRpbWUgdGhlcmUgaXMgbGl0dGxlIGluZm9ybWF0aW9uIG9uIHdoYXQgaGFwcGVucyB3aGVuIGNsb3NpbmcgYSB3ZWJzb2NrZXQgY29ubmVjdGlvbiB0aGF0IGlzIHN0dWNrIGluXG4gICAgLy8gcmVhZHlTdGF0ZT1DT05ORUNUSU5HLiAgRG9lcyBpdCB0aHJvdyBhbiBlcnJvcj8gIERvZXMgaXQgY2FsbCB0aGUgb25DbG9zZSBvciBvbkVycm9yIGV2ZW50IGhhbmRsZXJzP1xuICAgIC8vIFJlbW92ZSBhbGwgZXZlbnQgaGFuZGxlcnMgc28gdGhhdCBjYWxsaW5nIGNsb3NlIHdvbid0IHRyaWdnZXIgYW55IGNhbGxzLlxuICAgIHRyeSB7XG4gICAgICB0aGlzLmlzT3BlbiA9IGZhbHNlO1xuICAgICAgdGhpcy5fcmVtb3ZlU29ja2V0RXZlbnRzKCk7XG4gICAgICBpZiAodGhpcy5fc29ja2V0KSB7XG4gICAgICAgIHRoaXMuX3NvY2tldC5jbG9zZSgpO1xuICAgICAgICB0aGlzLl9zb2NrZXQgPSBudWxsO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIE5vLW9wXG4gICAgfVxuXG4gICAgLy8gTm93IHdlIGNhbiBjYWxsIG91ciBlcnJvciBoYW5kbGVyLlxuICAgIHRoaXMuX29uRXJyb3IobmV3IEVycm9yKG1zZykpO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSB3ZWJzb2NrZXQgY29ubmVjdGlvbiBpcyByZXBvcnRpbmcgdGhhdCBpdHMgbm93IG9wZW4uXG4gICAqXG4gICAqIEBtZXRob2QgX29uT3BlblxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX29uT3BlbigpIHtcbiAgICB0aGlzLl9jbGVhckNvbm5lY3Rpb25GYWlsZWQoKTtcbiAgICBpZiAodGhpcy5faXNPcGVuKCkpIHtcbiAgICAgIHRoaXMuX2xvc3RDb25uZWN0aW9uQ291bnQgPSAwO1xuICAgICAgdGhpcy5pc09wZW4gPSB0cnVlO1xuICAgICAgdGhpcy50cmlnZ2VyKCdjb25uZWN0ZWQnKTtcbiAgICAgIGxvZ2dlci5kZWJ1ZygnV2Vic29ja2V0IENvbm5lY3RlZCcpO1xuICAgICAgaWYgKHRoaXMuX2hhc0NvdW50ZXIpIHtcbiAgICAgICAgdGhpcy5yZXBsYXlFdmVudHModGhpcy5fbGFzdFRpbWVzdGFtcCwgdHJ1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9yZXNjaGVkdWxlUGluZygpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUZXN0cyB0byBzZWUgaWYgdGhlIHdlYnNvY2tldCBjb25uZWN0aW9uIGlzIG9wZW4uICBVc2UgdGhlIGlzT3BlbiBwcm9wZXJ0eVxuICAgKiBmb3IgZXh0ZXJuYWwgdGVzdHMuXG4gICAqIEBtZXRob2QgX2lzT3BlblxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICovXG4gIF9pc09wZW4oKSB7XG4gICAgaWYgKCF0aGlzLl9zb2NrZXQpIHJldHVybiBmYWxzZTtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAodHlwZW9mIFdlYlNvY2tldCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiB0cnVlO1xuICAgIHJldHVybiB0aGlzLl9zb2NrZXQgJiYgdGhpcy5fc29ja2V0LnJlYWR5U3RhdGUgPT09IFdlYlNvY2tldC5PUEVOO1xuICB9XG5cbiAgLyoqXG4gICAqIElmIG5vdCBpc09wZW4sIHByZXN1bWFibHkgZmFpbGVkIHRvIGNvbm5lY3RcbiAgICogQW55IG90aGVyIGVycm9yIGNhbiBiZSBpZ25vcmVkLi4uIGlmIHRoZSBjb25uZWN0aW9uIGhhc1xuICAgKiBmYWlsZWQsIG9uQ2xvc2Ugd2lsbCBoYW5kbGUgaXQuXG4gICAqXG4gICAqIEBtZXRob2QgX29uRXJyb3JcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7RXJyb3J9IGVyciAtIFdlYnNvY2tldCBlcnJvclxuICAgKi9cbiAgX29uRXJyb3IoZXJyKSB7XG4gICAgaWYgKHRoaXMuX2Nsb3NpbmcpIHJldHVybjtcbiAgICB0aGlzLl9jbGVhckNvbm5lY3Rpb25GYWlsZWQoKTtcbiAgICBsb2dnZXIuZGVidWcoJ1dlYnNvY2tldCBFcnJvciBjYXVzaW5nIHdlYnNvY2tldCB0byBjbG9zZScsIGVycik7XG4gICAgaWYgKCF0aGlzLmlzT3Blbikge1xuICAgICAgdGhpcy5fcmVtb3ZlU29ja2V0RXZlbnRzKCk7XG4gICAgICB0aGlzLl9sb3N0Q29ubmVjdGlvbkNvdW50Kys7XG4gICAgICB0aGlzLl9zY2hlZHVsZVJlY29ubmVjdCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9vblNvY2tldENsb3NlKCk7XG4gICAgICB0aGlzLl9zb2NrZXQuY2xvc2UoKTtcbiAgICAgIHRoaXMuX3NvY2tldCA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNob3J0Y3V0IG1ldGhvZCBmb3Igc2VuZGluZyBhIHNpZ25hbFxuICAgKlxuICAgKiAgICBtYW5hZ2VyLnNlbmRTaWduYWwoe1xuICAgICAgICAgICd0eXBlJzogJ3R5cGluZ19pbmRpY2F0b3InLFxuICAgICAgICAgICdvYmplY3QnOiB7XG4gICAgICAgICAgICAnaWQnOiB0aGlzLmNvbnZlcnNhdGlvbi5pZFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJ2RhdGEnOiB7XG4gICAgICAgICAgICAnYWN0aW9uJzogc3RhdGVcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgKlxuICAgKiBAbWV0aG9kIHNlbmRTaWduYWxcbiAgICogQHBhcmFtICB7T2JqZWN0fSBib2R5IC0gU2lnbmFsIGJvZHlcbiAgICovXG4gIHNlbmRTaWduYWwoYm9keSkge1xuICAgIGlmICh0aGlzLl9pc09wZW4oKSkge1xuICAgICAgdGhpcy5fc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICB0eXBlOiAnc2lnbmFsJyxcbiAgICAgICAgYm9keSxcbiAgICAgIH0pKTtcbiAgICB9XG4gIH1cblxuXG5cbiAgLyoqXG4gICAqIFNob3J0Y3V0IHRvIHNlbmRpbmcgYSBDb3VudGVyLnJlYWQgcmVxdWVzdFxuICAgKlxuICAgKiBAbWV0aG9kIGdldENvdW50ZXJcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gY2FsbGJhY2suc3VjY2Vzc1xuICAgKiBAcGFyYW0ge251bWJlcn0gY2FsbGJhY2subGFzdENvdW50ZXJcbiAgICogQHBhcmFtIHtudW1iZXJ9IGNhbGxiYWNrLm5ld0NvdW50ZXJcbiAgICovXG4gIGdldENvdW50ZXIoY2FsbGJhY2spIHtcbiAgICBsb2dnZXIuZGVidWcoJ1dlYnNvY2tldCByZXF1ZXN0OiBnZXRDb3VudGVyJyk7XG4gICAgdGhpcy5jbGllbnQuc29ja2V0UmVxdWVzdE1hbmFnZXIuc2VuZFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiAnQ291bnRlci5yZWFkJyxcbiAgICB9LCAocmVzdWx0KSA9PiB7XG4gICAgICBsb2dnZXIuZGVidWcoJ1dlYnNvY2tldCByZXNwb25zZTogZ2V0Q291bnRlciAnICsgcmVzdWx0LmRhdGEuY291bnRlcik7XG4gICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgY2FsbGJhY2sodHJ1ZSwgcmVzdWx0LmRhdGEuY291bnRlciwgcmVzdWx0LmZ1bGxEYXRhLmNvdW50ZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNhbGxiYWNrKGZhbHNlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlcGxheXMgYWxsIG1pc3NlZCBjaGFuZ2UgcGFja2V0cyBzaW5jZSB0aGUgc3BlY2lmaWVkIHRpbWVzdGFtcFxuICAgKlxuICAgKiBAbWV0aG9kIHJlcGxheUV2ZW50c1xuICAgKiBAcGFyYW0gIHtzdHJpbmd8bnVtYmVyfSAgIHRpbWVzdGFtcCAtIElzbyBmb3JtYXR0ZWQgZGF0ZSBzdHJpbmc7IGlmIG51bWJlciB3aWxsIGJlIHRyYW5zZm9ybWVkIGludG8gZm9ybWF0dGVkIGRhdGUgc3RyaW5nLlxuICAgKiBAcGFyYW0gIHtib29sZWFufSBbZm9yY2U9ZmFsc2VdIC0gaWYgdHJ1ZSwgY2FuY2VsIGFueSBpbiBwcm9ncmVzcyByZXBsYXlFdmVudHMgYW5kIHN0YXJ0IGEgbmV3IG9uZVxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSAtIE9wdGlvbmFsIGNhbGxiYWNrIGZvciBjb21wbGV0aW9uXG4gICAqL1xuICByZXBsYXlFdmVudHModGltZXN0YW1wLCBmb3JjZSwgY2FsbGJhY2spIHtcbiAgICBpZiAoIXRpbWVzdGFtcCkgcmV0dXJuO1xuICAgIGlmIChmb3JjZSkgdGhpcy5faW5SZXBsYXkgPSBmYWxzZTtcbiAgICBpZiAodHlwZW9mIHRpbWVzdGFtcCA9PT0gJ251bWJlcicpIHRpbWVzdGFtcCA9IG5ldyBEYXRlKHRpbWVzdGFtcCkudG9JU09TdHJpbmcoKTtcblxuICAgIC8vIElmIHdlIGFyZSBhbHJlYWR5IHdhaXRpbmcgZm9yIGEgcmVwbGF5IHRvIGNvbXBsZXRlLCByZWNvcmQgdGhlIHRpbWVzdGFtcCBmcm9tIHdoaWNoIHdlXG4gICAgLy8gbmVlZCB0byByZXBsYXkgb24gb3VyIG5leHQgcmVwbGF5IHJlcXVlc3RcbiAgICAvLyBJZiB3ZSBhcmUgc2ltcGx5IHVuYWJsZSB0byByZXBsYXkgYmVjYXVzZSB3ZSdyZSBkaXNjb25uZWN0ZWQsIGNhcHR1cmUgdGhlIF9uZWVkc1JlcGxheUZyb21cbiAgICBpZiAodGhpcy5faW5SZXBsYXkgfHwgIXRoaXMuX2lzT3BlbigpKSB7XG4gICAgICBpZiAoIXRoaXMuX25lZWRzUmVwbGF5RnJvbSkge1xuICAgICAgICBsb2dnZXIuZGVidWcoJ1dlYnNvY2tldCByZXF1ZXN0OiByZXBsYXlFdmVudHMgdXBkYXRpbmcgX25lZWRzUmVwbGF5RnJvbScpO1xuICAgICAgICB0aGlzLl9uZWVkc1JlcGxheUZyb20gPSB0aW1lc3RhbXA7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2luUmVwbGF5ID0gdHJ1ZTtcbiAgICAgIGxvZ2dlci5pbmZvKCdXZWJzb2NrZXQgcmVxdWVzdDogcmVwbGF5RXZlbnRzJyk7XG4gICAgICB0aGlzLmNsaWVudC5zb2NrZXRSZXF1ZXN0TWFuYWdlci5zZW5kUmVxdWVzdCh7XG4gICAgICAgIG1ldGhvZDogJ0V2ZW50LnJlcGxheScsXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICBmcm9tX3RpbWVzdGFtcDogdGltZXN0YW1wLFxuICAgICAgICB9LFxuICAgICAgfSwgcmVzdWx0ID0+IHRoaXMuX3JlcGxheUV2ZW50c0NvbXBsZXRlKHRpbWVzdGFtcCwgY2FsbGJhY2ssIHJlc3VsdC5zdWNjZXNzKSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrIGZvciBoYW5kbGluZyBjb21wbGV0aW9uIG9mIHJlcGxheS5cbiAgICpcbiAgICogQG1ldGhvZCBfcmVwbGF5RXZlbnRzQ29tcGxldGVcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7RGF0ZX0gICAgIHRpbWVzdGFtcFxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtICB7Qm9vbGVhbn0gICBzdWNjZXNzXG4gICAqL1xuICBfcmVwbGF5RXZlbnRzQ29tcGxldGUodGltZXN0YW1wLCBjYWxsYmFjaywgc3VjY2Vzcykge1xuICAgIHRoaXMuX2luUmVwbGF5ID0gZmFsc2U7XG5cblxuICAgIGlmIChzdWNjZXNzKSB7XG5cbiAgICAgIC8vIElmIHJlcGxheSB3YXMgY29tcGxldGVkLCBhbmQgbm8gb3RoZXIgcmVxdWVzdHMgZm9yIHJlcGxheSwgdGhlbiB0cmlnZ2VyIHN5bmNlZDtcbiAgICAgIC8vIHdlJ3JlIGRvbmUuXG4gICAgICBpZiAoIXRoaXMuX25lZWRzUmVwbGF5RnJvbSkge1xuICAgICAgICBsb2dnZXIuaW5mbygnV2Vic29ja2V0IHJlcGxheSBjb21wbGV0ZScpO1xuICAgICAgICB0aGlzLnRyaWdnZXIoJ3N5bmNlZCcpO1xuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIElmIHJlcGxheUV2ZW50cyB3YXMgY2FsbGVkIGR1cmluZyBhIHJlcGxheSwgdGhlbiByZXBsYXlcbiAgICAgIC8vIGZyb20gdGhlIGdpdmVuIHRpbWVzdGFtcC4gIElmIHJlcXVlc3QgZmFpbGVkLCB0aGVuIHdlIG5lZWQgdG8gcmV0cnkgZnJvbSBfbGFzdFRpbWVzdGFtcFxuICAgICAgZWxzZSBpZiAodGhpcy5fbmVlZHNSZXBsYXlGcm9tKSB7XG4gICAgICAgIGxvZ2dlci5pbmZvKCdXZWJzb2NrZXQgcmVwbGF5IHBhcnRpYWxseSBjb21wbGV0ZScpO1xuICAgICAgICBjb25zdCB0ID0gdGhpcy5fbmVlZHNSZXBsYXlGcm9tO1xuICAgICAgICB0aGlzLl9uZWVkc1JlcGxheUZyb20gPSBudWxsO1xuICAgICAgICB0aGlzLnJlcGxheUV2ZW50cyh0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBXZSBuZXZlciBnb3QgYSBkb25lIGV2ZW50OyBidXQgZWl0aGVyIGdvdCBhbiBlcnJvciBmcm9tIHRoZSBzZXJ2ZXIgb3IgdGhlIHJlcXVlc3QgdGltZWQgb3V0LlxuICAgIC8vIFVzZSBleHBvbmVudGlhbCBiYWNrb2ZmIGluY3JlbWVudGVkIGludGVnZXJzIHRoYXQgZ2V0RXhwb25lbnRpYWxCYWNrb2ZmU2Vjb25kcyBtYXBwaW5nIHRvIHJvdWdobHlcbiAgICAvLyAwLjQgc2Vjb25kcyAtIDEyLjggc2Vjb25kcywgYW5kIHRoZW4gc3RvcHMgcmV0cnlpbmcuXG4gICAgZWxzZSBpZiAodGhpcy5fcmVwbGF5UmV0cnlDb3VudCA8IDgpIHtcbiAgICAgIGNvbnN0IG1heERlbGF5ID0gMjA7XG4gICAgICBjb25zdCBkZWxheSA9IFV0aWxzLmdldEV4cG9uZW50aWFsQmFja29mZlNlY29uZHMobWF4RGVsYXksIE1hdGgubWluKDE1LCB0aGlzLl9yZXBsYXlSZXRyeUNvdW50ICsgMikpO1xuICAgICAgbG9nZ2VyLmluZm8oJ1dlYnNvY2tldCByZXBsYXkgcmV0cnkgaW4gJyArIGRlbGF5ICsgJyBzZWNvbmRzJyk7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMucmVwbGF5RXZlbnRzKHRpbWVzdGFtcCksIGRlbGF5ICogMTAwMCk7XG4gICAgICB0aGlzLl9yZXBsYXlSZXRyeUNvdW50Kys7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci5lcnJvcignV2Vic29ja2V0IEV2ZW50LnJlcGxheSBoYXMgZmFpbGVkJyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZXMgYSBuZXcgd2Vic29ja2V0IHBhY2tldCBmcm9tIHRoZSBzZXJ2ZXJcbiAgICpcbiAgICogQG1ldGhvZCBfb25NZXNzYWdlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gZXZ0IC0gTWVzc2FnZSBmcm9tIHRoZSBzZXJ2ZXJcbiAgICovXG4gIF9vbk1lc3NhZ2UoZXZ0KSB7XG4gICAgdGhpcy5fbG9zdENvbm5lY3Rpb25Db3VudCA9IDA7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IG1zZyA9IEpTT04ucGFyc2UoZXZ0LmRhdGEpO1xuICAgICAgY29uc3Qgc2tpcHBlZENvdW50ZXIgPSB0aGlzLl9sYXN0Q291bnRlciArIDEgIT09IG1zZy5jb3VudGVyO1xuICAgICAgdGhpcy5faGFzQ291bnRlciA9IHRydWU7XG4gICAgICB0aGlzLl9sYXN0Q291bnRlciA9IG1zZy5jb3VudGVyO1xuICAgICAgdGhpcy5fbGFzdERhdGFGcm9tU2VydmVyVGltZXN0YW1wID0gRGF0ZS5ub3coKTtcblxuICAgICAgLy8gSWYgd2UndmUgbWlzc2VkIGEgY291bnRlciwgcmVwbGF5IHRvIGdldDsgbm90ZSB0aGF0IHdlIGhhZCB0byB1cGRhdGUgX2xhc3RDb3VudGVyXG4gICAgICAvLyBmb3IgcmVwbGF5RXZlbnRzIHRvIHdvcmsgY29ycmVjdGx5LlxuICAgICAgaWYgKHNraXBwZWRDb3VudGVyKSB7XG4gICAgICAgIHRoaXMucmVwbGF5RXZlbnRzKHRoaXMuX2xhc3RUaW1lc3RhbXApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fbGFzdFRpbWVzdGFtcCA9IG5ldyBEYXRlKG1zZy50aW1lc3RhbXApLmdldFRpbWUoKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy50cmlnZ2VyKCdtZXNzYWdlJywge1xuICAgICAgICBkYXRhOiBtc2csXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5fcmVzY2hlZHVsZVBpbmcoKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGxvZ2dlci5lcnJvcignTGF5ZXItV2Vic29ja2V0OiBGYWlsZWQgdG8gaGFuZGxlIHdlYnNvY2tldCBtZXNzYWdlOiAnICsgZXJyICsgJ1xcbicsIGV2dC5kYXRhKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVzY2hlZHVsZSBhIHBpbmcgcmVxdWVzdCB3aGljaCBoZWxwcyB1cyB2ZXJpZnkgdGhhdCB0aGUgY29ubmVjdGlvbiBpcyBzdGlsbCBhbGl2ZSxcbiAgICogYW5kIHRoYXQgd2UgaGF2ZW4ndCBtaXNzZWQgYW55IGV2ZW50cy5cbiAgICpcbiAgICogQG1ldGhvZCBfcmVzY2hlZHVsZVBpbmdcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9yZXNjaGVkdWxlUGluZygpIHtcbiAgICBpZiAodGhpcy5fbmV4dFBpbmdJZCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX25leHRQaW5nSWQpO1xuICAgIH1cbiAgICB0aGlzLl9uZXh0UGluZ0lkID0gc2V0VGltZW91dCh0aGlzLl9waW5nLmJpbmQodGhpcyksIHRoaXMucGluZ0ZyZXF1ZW5jeSk7XG4gIH1cblxuICAvKipcbiAgICogU2VuZCBhIGNvdW50ZXIgcmVxdWVzdCB0byB0aGUgc2VydmVyIHRvIHZlcmlmeSB0aGF0IHdlIGFyZSBzdGlsbCBjb25uZWN0ZWQgYW5kXG4gICAqIGhhdmUgbm90IG1pc3NlZCBhbnkgZXZlbnRzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9waW5nXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcGluZygpIHtcbiAgICBsb2dnZXIuZGVidWcoJ1dlYnNvY2tldCBwaW5nJyk7XG4gICAgdGhpcy5fbmV4dFBpbmdJZCA9IDA7XG4gICAgaWYgKHRoaXMuX2lzT3BlbigpKSB7XG4gICAgICAvLyBOT1RFOiBvbk1lc3NhZ2Ugd2lsbCBhbHJlYWR5IGhhdmUgY2FsbGVkIHJlc2NoZWR1bGVQaW5nLCBidXQgaWYgdGhlcmUgd2FzIG5vIHJlc3BvbnNlLCB0aGVuIHRoZSBlcnJvciBoYW5kbGVyIHdvdWxkIE5PVCBoYXZlIGNhbGxlZCBpdC5cbiAgICAgIHRoaXMuZ2V0Q291bnRlcih0aGlzLl9yZXNjaGVkdWxlUGluZy5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH1cblxuXG4gIC8qKlxuICAgKiBDbG9zZSB0aGUgd2Vic29ja2V0LlxuICAgKlxuICAgKiBAbWV0aG9kIGNsb3NlXG4gICAqL1xuICBjbG9zZSgpIHtcbiAgICBsb2dnZXIuZGVidWcoJ1dlYnNvY2tldCBjbG9zZSByZXF1ZXN0ZWQnKTtcbiAgICB0aGlzLl9jbG9zaW5nID0gdHJ1ZTtcbiAgICB0aGlzLmlzT3BlbiA9IGZhbHNlO1xuICAgIGlmICh0aGlzLl9zb2NrZXQpIHtcbiAgICAgIC8vIENsb3NlIGFsbCBldmVudCBoYW5kbGVycyBhbmQgc2V0IHNvY2tldCB0byBudWxsXG4gICAgICAvLyB3aXRob3V0IHdhaXRpbmcgZm9yIGJyb3dzZXIgZXZlbnQgdG8gY2FsbFxuICAgICAgLy8gX29uU29ja2V0Q2xvc2UgYXMgdGhlIG5leHQgY29tbWFuZCBhZnRlciBjbG9zZVxuICAgICAgLy8gbWlnaHQgcmVxdWlyZSBjcmVhdGluZyBhIG5ldyBzb2NrZXRcbiAgICAgIHRoaXMuX29uU29ja2V0Q2xvc2UoKTtcbiAgICAgIHRoaXMuX3NvY2tldC5jbG9zZSgpO1xuICAgICAgdGhpcy5fc29ja2V0ID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU2VuZCBhIHBhY2tldCBhY3Jvc3MgdGhlIHdlYnNvY2tldFxuICAgKiBAbWV0aG9kIHNlbmRcbiAgICogQHBhcmFtIHtPYmplY3R9IG9ialxuICAgKi9cbiAgc2VuZChvYmopIHtcbiAgICB0aGlzLl9zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeShvYmopKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5jbG9zZSgpO1xuICAgIGlmICh0aGlzLl9uZXh0UGluZ0lkKSBjbGVhclRpbWVvdXQodGhpcy5fbmV4dFBpbmdJZCk7XG4gICAgc3VwZXIuZGVzdHJveSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIElmIHRoZSBzb2NrZXQgaGFzIGNsb3NlZCAob3IgaWYgdGhlIGNsb3NlIG1ldGhvZCBmb3JjZXMgaXQgY2xvc2VkKVxuICAgKiBSZW1vdmUgYWxsIGV2ZW50IGhhbmRsZXJzIGFuZCBpZiBhcHByb3ByaWF0ZSwgc2NoZWR1bGUgYSByZXRyeS5cbiAgICpcbiAgICogQG1ldGhvZCBfb25Tb2NrZXRDbG9zZVxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX29uU29ja2V0Q2xvc2UoKSB7XG4gICAgbG9nZ2VyLmRlYnVnKCdXZWJzb2NrZXQgY2xvc2VkJyk7XG4gICAgdGhpcy5pc09wZW4gPSBmYWxzZTtcbiAgICBpZiAoIXRoaXMuX2Nsb3NpbmcpIHtcbiAgICAgIHRoaXMuX3NjaGVkdWxlUmVjb25uZWN0KCk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmVtb3ZlU29ja2V0RXZlbnRzKCk7XG4gICAgdGhpcy50cmlnZ2VyKCdkaXNjb25uZWN0ZWQnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIGFsbCBldmVudCBoYW5kbGVycyBvbiB0aGUgY3VycmVudCBzb2NrZXQuXG4gICAqXG4gICAqIEBtZXRob2QgX3JlbW92ZVNvY2tldEV2ZW50c1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3JlbW92ZVNvY2tldEV2ZW50cygpIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAodHlwZW9mIFdlYlNvY2tldCAhPT0gJ3VuZGVmaW5lZCcgJiYgdGhpcy5fc29ja2V0KSB7XG4gICAgICB0aGlzLl9zb2NrZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIHRoaXMuX29uTWVzc2FnZSk7XG4gICAgICB0aGlzLl9zb2NrZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2xvc2UnLCB0aGlzLl9vblNvY2tldENsb3NlKTtcbiAgICAgIHRoaXMuX3NvY2tldC5yZW1vdmVFdmVudExpc3RlbmVyKCdvcGVuJywgdGhpcy5fb25PcGVuKTtcbiAgICAgIHRoaXMuX3NvY2tldC5yZW1vdmVFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMuX29uRXJyb3IpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fc29ja2V0KSB7XG4gICAgICB0aGlzLl9zb2NrZXQub25tZXNzYWdlID0gbnVsbDtcbiAgICAgIHRoaXMuX3NvY2tldC5vbmNsb3NlID0gbnVsbDtcbiAgICAgIHRoaXMuX3NvY2tldC5vbm9wZW4gPSBudWxsO1xuICAgICAgdGhpcy5fc29ja2V0Lm9uZXJyb3IgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTY2hlZHVsZSBhbiBhdHRlbXB0IHRvIHJlY29ubmVjdCB0byB0aGUgc2VydmVyLiAgSWYgdGhlIG9ubGluZU1hbmFnZXJcbiAgICogZGVjbGFyZXMgdXMgdG8gYmUgb2ZmbGluZSwgZG9uJ3QgYm90aGVyIHJlY29ubmVjdGluZy4gIEEgcmVjb25uZWN0XG4gICAqIGF0dGVtcHQgd2lsbCBiZSB0cmlnZ2VyZWQgYXMgc29vbiBhcyB0aGUgb25saW5lIG1hbmFnZXIgcmVwb3J0cyB3ZSBhcmUgb25saW5lIGFnYWluLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhlIGR1cmF0aW9uIG9mIG91ciBkZWxheSBjYW4gbm90IGV4Y2VkZSB0aGUgb25saW5lTWFuYWdlcidzIHBpbmcgZnJlcXVlbmN5XG4gICAqIG9yIGl0IHdpbGwgZGVjbGFyZSB1cyB0byBiZSBvZmZsaW5lIHdoaWxlIHdlIGF0dGVtcHQgYSByZWNvbm5lY3QuXG4gICAqXG4gICAqIEBtZXRob2QgX3NjaGVkdWxlUmVjb25uZWN0XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfc2NoZWR1bGVSZWNvbm5lY3QoKSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQgfHwgIXRoaXMuY2xpZW50LmlzT25saW5lKSByZXR1cm47XG5cbiAgICBjb25zdCBtYXhEZWxheSA9ICh0aGlzLmNsaWVudC5vbmxpbmVNYW5hZ2VyLnBpbmdGcmVxdWVuY3kgLSAxMDAwKSAvIDEwMDA7XG4gICAgY29uc3QgZGVsYXkgPSBVdGlscy5nZXRFeHBvbmVudGlhbEJhY2tvZmZTZWNvbmRzKG1heERlbGF5LCBNYXRoLm1pbigxNSwgdGhpcy5fbG9zdENvbm5lY3Rpb25Db3VudCkpO1xuICAgIGxvZ2dlci5kZWJ1ZygnV2Vic29ja2V0IFJlY29ubmVjdCBpbiAnICsgZGVsYXkgKyAnIHNlY29uZHMnKTtcbiAgICB0aGlzLl9yZWNvbm5lY3RJZCA9IHNldFRpbWVvdXQodGhpcy5fdmFsaWRhdGVTZXNzaW9uQmVmb3JlUmVjb25uZWN0LmJpbmQodGhpcyksIGRlbGF5ICogMTAwMCk7XG4gIH1cblxuICAvKipcbiAgICogQmVmb3JlIHRoZSBzY2hlZHVsZWQgcmVjb25uZWN0IGNhbiBjYWxsIGBjb25uZWN0KClgIHZhbGlkYXRlIHRoYXQgd2UgZGlkbid0IGxvc2UgdGhlIHdlYnNvY2tldFxuICAgKiBkdWUgdG8gbG9zcyBvZiBhdXRoZW50aWNhdGlvbi5cbiAgICpcbiAgICogQG1ldGhvZCBfdmFsaWRhdGVTZXNzaW9uQmVmb3JlUmVjb25uZWN0XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfdmFsaWRhdGVTZXNzaW9uQmVmb3JlUmVjb25uZWN0KCkge1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkIHx8ICF0aGlzLmNsaWVudC5pc09ubGluZSkgcmV0dXJuO1xuXG4gICAgdGhpcy5jbGllbnQueGhyKHtcbiAgICAgIHVybDogJy8nLFxuICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgIHN5bmM6IGZhbHNlLFxuICAgIH0sIChyZXN1bHQpID0+IHtcbiAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgdGhpcy5jb25uZWN0KCk7XG4gICAgICAvLyBpZiBub3Qgc3VjY2Vzc2Z1bCwgdGhlIHRoaXMuY2xpZW50LnhociB3aWxsIGhhbmRsZSByZWF1dGhlbnRpY2F0aW9uXG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gKiBJcyB0aGUgd2Vic29ja2V0IGNvbm5lY3Rpb24gY3VycmVudGx5IG9wZW4/XG4gKiBAdHlwZSB7Qm9vbGVhbn1cbiAqL1xuU29ja2V0TWFuYWdlci5wcm90b3R5cGUuaXNPcGVuID0gZmFsc2U7XG5cbi8qKlxuICogc2V0VGltZW91dCBJRCBmb3IgY2FsbGluZyBjb25uZWN0KClcbiAqIEBwcml2YXRlXG4gKiBAdHlwZSB7TnVtYmVyfVxuICovXG5Tb2NrZXRNYW5hZ2VyLnByb3RvdHlwZS5fcmVjb25uZWN0SWQgPSAwO1xuXG4vKipcbiAqIHNldFRpbWVvdXQgSUQgZm9yIGNhbGxpbmcgX2Nvbm5lY3Rpb25GYWlsZWQoKVxuICogQHByaXZhdGVcbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKi9cblNvY2tldE1hbmFnZXIucHJvdG90eXBlLl9jb25uZWN0aW9uRmFpbGVkSWQgPSAwO1xuXG5Tb2NrZXRNYW5hZ2VyLnByb3RvdHlwZS5fbGFzdFRpbWVzdGFtcCA9IDA7XG5Tb2NrZXRNYW5hZ2VyLnByb3RvdHlwZS5fbGFzdERhdGFGcm9tU2VydmVyVGltZXN0YW1wID0gMDtcblNvY2tldE1hbmFnZXIucHJvdG90eXBlLl9sYXN0Q291bnRlciA9IG51bGw7XG5Tb2NrZXRNYW5hZ2VyLnByb3RvdHlwZS5faGFzQ291bnRlciA9IGZhbHNlO1xuXG5Tb2NrZXRNYW5hZ2VyLnByb3RvdHlwZS5faW5SZXBsYXkgPSBmYWxzZTtcblNvY2tldE1hbmFnZXIucHJvdG90eXBlLl9uZWVkc1JlcGxheUZyb20gPSBudWxsO1xuXG5Tb2NrZXRNYW5hZ2VyLnByb3RvdHlwZS5fcmVwbGF5UmV0cnlDb3VudCA9IDA7XG5cbi8qKlxuICogRnJlcXVlbmN5IHdpdGggd2hpY2ggdGhlIHdlYnNvY2tldCBjaGVja3MgdG8gc2VlIGlmIGFueSB3ZWJzb2NrZXQgbm90aWZpY2F0aW9uc1xuICogaGF2ZSBiZWVuIG1pc3NlZC5cbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKi9cblNvY2tldE1hbmFnZXIucHJvdG90eXBlLnBpbmdGcmVxdWVuY3kgPSAzMDAwMDtcblxuLyoqXG4gKiBUaGUgQ2xpZW50IHRoYXQgb3ducyB0aGlzLlxuICogQHR5cGUge2xheWVyLkNsaWVudH1cbiAqL1xuU29ja2V0TWFuYWdlci5wcm90b3R5cGUuY2xpZW50ID0gbnVsbDtcblxuLyoqXG4gKiBUaGUgU29ja2V0IENvbm5lY3Rpb24gaW5zdGFuY2VcbiAqIEB0eXBlIHtXZWJzb2NrZXR9XG4gKi9cblNvY2tldE1hbmFnZXIucHJvdG90eXBlLl9zb2NrZXQgPSBudWxsO1xuXG4vKipcbiAqIElzIHRoZSB3ZWJzb2NrZXQgY29ubmVjdGlvbiBiZWluZyBjbG9zZWQgYnkgYSBjYWxsIHRvIGNsb3NlKCk/XG4gKiBJZiBzbywgd2UgY2FuIGlnbm9yZSBhbnkgZXJyb3JzIHRoYXQgc2lnbmFsIHRoZSBzb2NrZXQgYXMgY2xvc2luZy5cbiAqIEB0eXBlIHtCb29sZWFufVxuICovXG5Tb2NrZXRNYW5hZ2VyLnByb3RvdHlwZS5fY2xvc2luZyA9IGZhbHNlO1xuXG4vKipcbiAqIE51bWJlciBvZiBmYWlsZWQgYXR0ZW1wdHMgdG8gcmVjb25uZWN0LlxuICogQHR5cGUge051bWJlcn1cbiAqL1xuU29ja2V0TWFuYWdlci5wcm90b3R5cGUuX2xvc3RDb25uZWN0aW9uQ291bnQgPSAwO1xuXG5cblNvY2tldE1hbmFnZXIuX3N1cHBvcnRlZEV2ZW50cyA9IFtcbiAgLyoqXG4gICAqIEEgZGF0YSBwYWNrZXQgaGFzIGJlZW4gcmVjZWl2ZWQgZnJvbSB0aGUgc2VydmVyLlxuICAgKiBAZXZlbnQgbWVzc2FnZVxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGxheWVyRXZlbnRcbiAgICogQHBhcmFtIHtPYmplY3R9IGxheWVyRXZlbnQuZGF0YSAtIFRoZSBkYXRhIHRoYXQgd2FzIHJlY2VpdmVkIGZyb20gdGhlIHNlcnZlclxuICAgKi9cbiAgJ21lc3NhZ2UnLFxuXG4gIC8qKlxuICAgKiBUaGUgd2Vic29ja2V0IGlzIG5vdyBjb25uZWN0ZWQuXG4gICAqIEBldmVudCBjb25uZWN0ZWRcbiAgICogQHByb3RlY3RlZFxuICAgKi9cbiAgJ2Nvbm5lY3RlZCcsXG5cbiAgLyoqXG4gICAqIFRoZSB3ZWJzb2NrZXQgaXMgbm8gbG9uZ2VyIGNvbm5lY3RlZFxuICAgKiBAZXZlbnQgZGlzY29ubmVjdGVkXG4gICAqIEBwcm90ZWN0ZWRcbiAgICovXG4gICdkaXNjb25uZWN0ZWQnLFxuXG4gIC8qKlxuICAgKiBXZWJzb2NrZXQgZXZlbnRzIHdlcmUgbWlzc2VkOyB3ZSBhcmUgcmVzeW5jaW5nIHdpdGggdGhlIHNlcnZlclxuICAgKiBAZXZlbnQgcmVwbGF5LWJlZ3VuXG4gICAqL1xuICAnc3luY2luZycsXG5cbiAgLyoqXG4gICAqIFdlYnNvY2tldCBldmVudHMgd2VyZSBtaXNzZWQ7IHdlIHJlc3luY2VkIHdpdGggdGhlIHNlcnZlciBhbmQgYXJlIG5vdyBkb25lXG4gICAqIEBldmVudCByZXBsYXktYmVndW5cbiAgICovXG4gICdzeW5jZWQnLFxuXS5jb25jYXQoUm9vdC5fc3VwcG9ydGVkRXZlbnRzKTtcblJvb3QuaW5pdENsYXNzLmFwcGx5KFNvY2tldE1hbmFnZXIsIFtTb2NrZXRNYW5hZ2VyLCAnU29ja2V0TWFuYWdlciddKTtcbm1vZHVsZS5leHBvcnRzID0gU29ja2V0TWFuYWdlcjtcbiJdfQ==
