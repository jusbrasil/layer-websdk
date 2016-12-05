'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * This class manages a state variable for whether we are online/offline, triggers events
 * when the state changes, and determines when to perform tests to validate our online status.
 *
 * It performs the following tasks:
 *
 * 1. Any time we go more than this.pingFrequency (100 seconds) without any data from the server, flag us as being offline.
 *    Rationale: The websocket manager is calling `getCounter` every 30 seconds; so it would have had to fail to get any response
 *    3 times before we give up.
 * 2. While we are offline, ping the server until we determine we are in fact able to connect to the server
 * 3. Trigger events `connected` and `disconnected` to let the rest of the system know when we are/are not connected.
 *    NOTE: The Websocket manager will use that to reconnect its websocket, and resume its `getCounter` call every 30 seconds.
 *
 * NOTE: Apps that want to be notified of changes to online/offline state should see layer.Client's `online` event.
 *
 * NOTE: One iteration of this class treated navigator.onLine = false as fact.  If onLine is false, then we don't need to test
 * anything.  If its true, then this class verifies it can reach layer's servers.  However, https://code.google.com/p/chromium/issues/detail?id=277372 has replicated multiple times in chrome; this bug causes one tab of chrome to have navigator.onLine=false while all other tabs
 * correctly report navigator.onLine=true.  As a result, we can't rely on this value and this class must continue to poll the server while
 * offline and to ignore values from navigator.onLine.  Future Work: Allow non-chrome browsers to use navigator.onLine.
 *
 * @class  layer.OnlineStateManager
 * @private
 * @extends layer.Root
 *
 */
var Root = require('./root');
var xhr = require('./xhr');
var logger = require('./logger');
var Utils = require('./client-utils');

var _require = require('./const');

var ACCEPT = _require.ACCEPT;

var OnlineStateManager = function (_Root) {
  _inherits(OnlineStateManager, _Root);

  /**
   * Creates a new OnlineStateManager.
   *
   * An Application is expected to only have one of these.
   *
   *      var onlineStateManager = new layer.OnlineStateManager({
   *          socketManager: socketManager,
   *          testUrl: 'https://api.layer.com/nonces'
   *      });
   *
   * @method constructor
   * @param  {Object} options
   * @param  {layer.Websockets.SocketManager} options.socketManager - A websocket manager to monitor for messages
   * @param  {string} options.testUrl - A url to send requests to when testing if we are online
   */
  function OnlineStateManager(options) {
    _classCallCheck(this, OnlineStateManager);

    // Listen to all xhr events and websocket messages for online-status info
    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(OnlineStateManager).call(this, options));

    xhr.addConnectionListener(function (evt) {
      return _this._connectionListener(evt);
    });
    _this.socketManager.on('message', function () {
      return _this._connectionListener({ status: 'connection:success' });
    }, _this);

    // Any change in online status reported by the browser should result in
    // an immediate update to our online/offline state
    /* istanbul ignore else */
    if (typeof window !== 'undefined') {
      window.addEventListener('online', _this._handleOnlineEvent.bind(_this));
      window.addEventListener('offline', _this._handleOnlineEvent.bind(_this));
    }
    return _this;
  }

  /**
   * We don't actually start managing our online state until after the client has authenticated.
   * Call start() when we are ready for the client to start managing our state.
   *
   * The client won't call start() without first validating that we have a valid session, so by definition,
   * calling start means we are online.
   *
   * @method start
   */


  _createClass(OnlineStateManager, [{
    key: 'start',
    value: function start() {
      logger.info('OnlineStateManager: start');
      this.isClientReady = true;
      this.isOnline = true;

      this.checkOnlineStatus();
    }

    /**
     * If the client becomes unauthenticated, stop checking if we are online, and announce that we are offline.
     *
     * @method stop
     */

  }, {
    key: 'stop',
    value: function stop() {
      logger.info('OnlineStateManager: stop');
      this.isClientReady = false;
      this._clearCheck();
      this._changeToOffline();
    }

    /**
     * Schedules our next call to _onlineExpired if online or checkOnlineStatus if offline.
     *
     * @method _scheduleNextOnlineCheck
     * @private
     */

  }, {
    key: '_scheduleNextOnlineCheck',
    value: function _scheduleNextOnlineCheck() {
      logger.debug('OnlineStateManager: skip schedule');
      if (this.isDestroyed || !this.isClientReady) return;

      // Replace any scheduled calls with the newly scheduled call:
      this._clearCheck();

      // If this is called while we are online, then we are using this to detect when we've gone without data for more than pingFrequency.
      // Call this._onlineExpired after pingFrequency of no server responses.
      if (this.isOnline) {
        logger.debug('OnlineStateManager: Scheduled onlineExpired');
        this.onlineCheckId = setTimeout(this._onlineExpired.bind(this), this.pingFrequency);
      }

      // If this is called while we are offline, we're doing exponential backoff pinging the server to see if we've come back online.
      else {
          logger.info('OnlineStateManager: Scheduled checkOnlineStatus');
          var duration = Utils.getExponentialBackoffSeconds(this.maxOfflineWait, Math.min(10, this.offlineCounter++));
          this.onlineCheckId = setTimeout(this.checkOnlineStatus.bind(this), Math.floor(duration * 1000));
        }
    }

    /**
     * Cancels any upcoming calls to checkOnlineStatus
     *
     * @method _clearCheck
     * @private
     */

  }, {
    key: '_clearCheck',
    value: function _clearCheck() {
      if (this.onlineCheckId) {
        clearTimeout(this.onlineCheckId);
        this.onlineCheckId = 0;
      }
    }

    /**
     * Respond to the browser's online/offline events.
     *
     * Our response is not to trust them, but to use them as
     * a trigger to indicate we should immediately do our own
     * validation.
     *
     * @method _handleOnlineEvent
     * @private
     * @param  {Event} evt - Browser online/offline event object
     */

  }, {
    key: '_handleOnlineEvent',
    value: function _handleOnlineEvent(evt) {
      // Reset the counter because our first request may fail as they may not be
      // fully connected yet
      this.offlineCounter = 0;
      this.checkOnlineStatus();
    }

    /**
     * Our online state has expired; we are now offline.
     *
     * If this method gets called, it means that our connection has gone too long without any data
     * and is now considered to be disconnected.  Start scheduling tests to see when we are back online.
     *
     * @method _onlineExpired
     * @private
     */

  }, {
    key: '_onlineExpired',
    value: function _onlineExpired() {
      this._clearCheck();
      this._changeToOffline();
      this._scheduleNextOnlineCheck();
    }

    /**
     * Get a nonce to see if we can reach the server.
     *
     * We don't care about the result,
     * we just care about triggering a 'connection:success' or 'connection:error' event
     * which connectionListener will respond to.
     *
     *      client.onlineManager.checkOnlineStatus(function(result) {
     *          alert(result ? 'We're online!' : 'Doh!');
     *      });
     *
     * @method checkOnlineStatus
     * @param {Function} callback
     * @param {boolean} callback.isOnline - Callback is called with true if online, false if not
     */

  }, {
    key: 'checkOnlineStatus',
    value: function checkOnlineStatus(callback) {
      var _this2 = this;

      this._clearCheck();

      logger.info('OnlineStateManager: Firing XHR for online check');
      this._lastCheckOnlineStatus = new Date();
      // Ping the server and see if we're connected.
      xhr({
        url: this.testUrl,
        method: 'POST',
        headers: {
          accept: ACCEPT
        }
      }, function () {
        // this.isOnline will be updated via _connectionListener prior to this line executing
        if (callback) callback(_this2.isOnline);
      });
    }

    /**
     * On determining that we are offline, handles the state transition and logging.
     *
     * @method _changeToOffline
     * @private
     */

  }, {
    key: '_changeToOffline',
    value: function _changeToOffline() {
      if (this.isOnline) {
        this.isOnline = false;
        this.trigger('disconnected');
        logger.info('OnlineStateManager: Connection lost');
      }
    }

    /**
     * Called whenever a websocket event arrives, or an xhr call completes; updates our isOnline state.
     *
     * Any call to this method will reschedule our next is-online test
     *
     * @method _connectionListener
     * @private
     * @param  {string} evt - Name of the event; either 'connection:success' or 'connection:error'
     */

  }, {
    key: '_connectionListener',
    value: function _connectionListener(evt) {
      // If event is a success, change us to online
      if (evt.status === 'connection:success') {
        var lastTime = this.lastMessageTime;
        this.lastMessageTime = new Date();
        if (!this.isOnline) {
          this.isOnline = true;
          this.offlineCounter = 0;
          this.trigger('connected', { offlineDuration: lastTime ? Date.now() - lastTime : 0 });
          if (this.connectedCounter === undefined) this.connectedCounter = 0;
          this.connectedCounter++;
          logger.info('OnlineStateManager: Connected restored');
        }
      }

      // If event is NOT success, change us to offline.
      else {
          this._changeToOffline();
        }

      this._scheduleNextOnlineCheck();
    }

    /**
     * Cleanup/shutdown
     *
     * @method destroy
     */

  }, {
    key: 'destroy',
    value: function destroy() {
      this._clearCheck();
      this.socketManager = null;
      _get(Object.getPrototypeOf(OnlineStateManager.prototype), 'destroy', this).call(this);
    }
  }]);

  return OnlineStateManager;
}(Root);

OnlineStateManager.prototype.isClientReady = false;

/**
 * URL To fire when testing to see if we are online.
 * @type {String}
 */
OnlineStateManager.prototype.testUrl = '';

/**
 * A Websocket manager whose 'message' event we will listen to
 * in order to know that we are still online.
 * @type {layer.Websockets.SocketManager}
 */
OnlineStateManager.prototype.socketManager = null;

/**
 * Number of testUrl requests we've been offline for.
 *
 * Will stop growing once the number is suitably large (10-20).
 * @type {Number}
 */
OnlineStateManager.prototype.offlineCounter = 0;

/**
 * Maximum wait during exponential backoff while offline.
 *
 * While offline, exponential backoff is used to calculate how long to wait between checking with the server
 * to see if we are online again. This value determines the maximum wait; any higher value returned by exponential backoff
 * are ignored and this value used instead.
 * Value is measured in seconds.
 * @type {Number}
 */
OnlineStateManager.prototype.maxOfflineWait = 5 * 60;

/**
 * Minimum wait between tries in ms.
 * @type {Number}
 */
OnlineStateManager.prototype.minBackoffWait = 100;

/**
 * Time that the last successful message was observed.
 * @type {Date}
 */
OnlineStateManager.prototype.lastMessageTime = null;

/**
 * For debugging, tracks the last time we checked if we are online.
 * @type {Date}
 */
OnlineStateManager.prototype._lastCheckOnlineStatus = null;

/**
 * Are we currently online?
 * @type {Boolean}
 */
OnlineStateManager.prototype.isOnline = false;

/**
 * setTimeoutId for the next checkOnlineStatus() call.
 * @type {Number}
 */
OnlineStateManager.prototype.onlineCheckId = 0;

/**
 * If we are online, how often do we need to ping to verify we are still online.
 *
 * Value is reset any time we observe any messages from the server.
 * Measured in miliseconds. NOTE: Websocket has a separate ping which mostly makes
 * this one unnecessary.  May end up removing this one... though we'd keep the
 * ping for when our state is offline.
 * @type {Number}
 */
OnlineStateManager.prototype.pingFrequency = 100 * 1000;

OnlineStateManager._supportedEvents = [
/**
 * We appear to be online and able to send and receive
 * @event connected
 * @param {number} onlineDuration - Number of miliseconds since we were last known to be online
 */
'connected',

/**
 * We appear to be offline and unable to send or receive
 * @event disconnected
 */
'disconnected'].concat(Root._supportedEvents);
Root.initClass.apply(OnlineStateManager, [OnlineStateManager, 'OnlineStateManager']);
module.exports = OnlineStateManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9vbmxpbmUtc3RhdGUtbWFuYWdlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXlCQSxJQUFNLE9BQU8sUUFBUSxRQUFSLENBQWI7QUFDQSxJQUFNLE1BQU0sUUFBUSxPQUFSLENBQVo7QUFDQSxJQUFNLFNBQVMsUUFBUSxVQUFSLENBQWY7QUFDQSxJQUFNLFFBQVEsUUFBUSxnQkFBUixDQUFkOztlQUNtQixRQUFRLFNBQVIsQzs7SUFBWCxNLFlBQUEsTTs7SUFFRixrQjs7O0FBQ0o7Ozs7Ozs7Ozs7Ozs7OztBQWVBLDhCQUFZLE9BQVosRUFBcUI7QUFBQTs7QUFHbkI7QUFIbUIsc0dBQ2IsT0FEYTs7QUFJbkIsUUFBSSxxQkFBSixDQUEwQjtBQUFBLGFBQU8sTUFBSyxtQkFBTCxDQUF5QixHQUF6QixDQUFQO0FBQUEsS0FBMUI7QUFDQSxVQUFLLGFBQUwsQ0FBbUIsRUFBbkIsQ0FBc0IsU0FBdEIsRUFBaUM7QUFBQSxhQUFNLE1BQUssbUJBQUwsQ0FBeUIsRUFBRSxRQUFRLG9CQUFWLEVBQXpCLENBQU47QUFBQSxLQUFqQzs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxRQUFJLE9BQU8sTUFBUCxLQUFrQixXQUF0QixFQUFtQztBQUNqQyxhQUFPLGdCQUFQLENBQXdCLFFBQXhCLEVBQWtDLE1BQUssa0JBQUwsQ0FBd0IsSUFBeEIsT0FBbEM7QUFDQSxhQUFPLGdCQUFQLENBQXdCLFNBQXhCLEVBQW1DLE1BQUssa0JBQUwsQ0FBd0IsSUFBeEIsT0FBbkM7QUFDRDtBQWJrQjtBQWNwQjs7QUFFRDs7Ozs7Ozs7Ozs7Ozs0QkFTUTtBQUNOLGFBQU8sSUFBUCxDQUFZLDJCQUFaO0FBQ0EsV0FBSyxhQUFMLEdBQXFCLElBQXJCO0FBQ0EsV0FBSyxRQUFMLEdBQWdCLElBQWhCOztBQUVBLFdBQUssaUJBQUw7QUFDRDs7QUFFRDs7Ozs7Ozs7MkJBS087QUFDTCxhQUFPLElBQVAs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bnRlbnQiOlsiLyoqXG4gKiBUaGlzIGNsYXNzIG1hbmFnZXMgYSBzdGF0ZSB2YXJpYWJsZSBmb3Igd2hldGhlciB3ZSBhcmUgb25saW5lL29mZmxpbmUsIHRyaWdnZXJzIGV2ZW50c1xuICogd2hlbiB0aGUgc3RhdGUgY2hhbmdlcywgYW5kIGRldGVybWluZXMgd2hlbiB0byBwZXJmb3JtIHRlc3RzIHRvIHZhbGlkYXRlIG91ciBvbmxpbmUgc3RhdHVzLlxuICpcbiAqIEl0IHBlcmZvcm1zIHRoZSBmb2xsb3dpbmcgdGFza3M6XG4gKlxuICogMS4gQW55IHRpbWUgd2UgZ28gbW9yZSB0aGFuIHRoaXMucGluZ0ZyZXF1ZW5jeSAoMTAwIHNlY29uZHMpIHdpdGhvdXQgYW55IGRhdGEgZnJvbSB0aGUgc2VydmVyLCBmbGFnIHVzIGFzIGJlaW5nIG9mZmxpbmUuXG4gKiAgICBSYXRpb25hbGU6IFRoZSB3ZWJzb2NrZXQgbWFuYWdlciBpcyBjYWxsaW5nIGBnZXRDb3VudGVyYCBldmVyeSAzMCBzZWNvbmRzOyBzbyBpdCB3b3VsZCBoYXZlIGhhZCB0byBmYWlsIHRvIGdldCBhbnkgcmVzcG9uc2VcbiAqICAgIDMgdGltZXMgYmVmb3JlIHdlIGdpdmUgdXAuXG4gKiAyLiBXaGlsZSB3ZSBhcmUgb2ZmbGluZSwgcGluZyB0aGUgc2VydmVyIHVudGlsIHdlIGRldGVybWluZSB3ZSBhcmUgaW4gZmFjdCBhYmxlIHRvIGNvbm5lY3QgdG8gdGhlIHNlcnZlclxuICogMy4gVHJpZ2dlciBldmVudHMgYGNvbm5lY3RlZGAgYW5kIGBkaXNjb25uZWN0ZWRgIHRvIGxldCB0aGUgcmVzdCBvZiB0aGUgc3lzdGVtIGtub3cgd2hlbiB3ZSBhcmUvYXJlIG5vdCBjb25uZWN0ZWQuXG4gKiAgICBOT1RFOiBUaGUgV2Vic29ja2V0IG1hbmFnZXIgd2lsbCB1c2UgdGhhdCB0byByZWNvbm5lY3QgaXRzIHdlYnNvY2tldCwgYW5kIHJlc3VtZSBpdHMgYGdldENvdW50ZXJgIGNhbGwgZXZlcnkgMzAgc2Vjb25kcy5cbiAqXG4gKiBOT1RFOiBBcHBzIHRoYXQgd2FudCB0byBiZSBub3RpZmllZCBvZiBjaGFuZ2VzIHRvIG9ubGluZS9vZmZsaW5lIHN0YXRlIHNob3VsZCBzZWUgbGF5ZXIuQ2xpZW50J3MgYG9ubGluZWAgZXZlbnQuXG4gKlxuICogTk9URTogT25lIGl0ZXJhdGlvbiBvZiB0aGlzIGNsYXNzIHRyZWF0ZWQgbmF2aWdhdG9yLm9uTGluZSA9IGZhbHNlIGFzIGZhY3QuICBJZiBvbkxpbmUgaXMgZmFsc2UsIHRoZW4gd2UgZG9uJ3QgbmVlZCB0byB0ZXN0XG4gKiBhbnl0aGluZy4gIElmIGl0cyB0cnVlLCB0aGVuIHRoaXMgY2xhc3MgdmVyaWZpZXMgaXQgY2FuIHJlYWNoIGxheWVyJ3Mgc2VydmVycy4gIEhvd2V2ZXIsIGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD0yNzczNzIgaGFzIHJlcGxpY2F0ZWQgbXVsdGlwbGUgdGltZXMgaW4gY2hyb21lOyB0aGlzIGJ1ZyBjYXVzZXMgb25lIHRhYiBvZiBjaHJvbWUgdG8gaGF2ZSBuYXZpZ2F0b3Iub25MaW5lPWZhbHNlIHdoaWxlIGFsbCBvdGhlciB0YWJzXG4gKiBjb3JyZWN0bHkgcmVwb3J0IG5hdmlnYXRvci5vbkxpbmU9dHJ1ZS4gIEFzIGEgcmVzdWx0LCB3ZSBjYW4ndCByZWx5IG9uIHRoaXMgdmFsdWUgYW5kIHRoaXMgY2xhc3MgbXVzdCBjb250aW51ZSB0byBwb2xsIHRoZSBzZXJ2ZXIgd2hpbGVcbiAqIG9mZmxpbmUgYW5kIHRvIGlnbm9yZSB2YWx1ZXMgZnJvbSBuYXZpZ2F0b3Iub25MaW5lLiAgRnV0dXJlIFdvcms6IEFsbG93IG5vbi1jaHJvbWUgYnJvd3NlcnMgdG8gdXNlIG5hdmlnYXRvci5vbkxpbmUuXG4gKlxuICogQGNsYXNzICBsYXllci5PbmxpbmVTdGF0ZU1hbmFnZXJcbiAqIEBwcml2YXRlXG4gKiBAZXh0ZW5kcyBsYXllci5Sb290XG4gKlxuICovXG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi9yb290Jyk7XG5jb25zdCB4aHIgPSByZXF1aXJlKCcuL3hocicpO1xuY29uc3QgbG9nZ2VyID0gcmVxdWlyZSgnLi9sb2dnZXInKTtcbmNvbnN0IFV0aWxzID0gcmVxdWlyZSgnLi9jbGllbnQtdXRpbHMnKTtcbmNvbnN0IHsgQUNDRVBUIH0gPSByZXF1aXJlKCcuL2NvbnN0Jyk7XG5cbmNsYXNzIE9ubGluZVN0YXRlTWFuYWdlciBleHRlbmRzIFJvb3Qge1xuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBPbmxpbmVTdGF0ZU1hbmFnZXIuXG4gICAqXG4gICAqIEFuIEFwcGxpY2F0aW9uIGlzIGV4cGVjdGVkIHRvIG9ubHkgaGF2ZSBvbmUgb2YgdGhlc2UuXG4gICAqXG4gICAqICAgICAgdmFyIG9ubGluZVN0YXRlTWFuYWdlciA9IG5ldyBsYXllci5PbmxpbmVTdGF0ZU1hbmFnZXIoe1xuICAgKiAgICAgICAgICBzb2NrZXRNYW5hZ2VyOiBzb2NrZXRNYW5hZ2VyLFxuICAgKiAgICAgICAgICB0ZXN0VXJsOiAnaHR0cHM6Ly9hcGkubGF5ZXIuY29tL25vbmNlcydcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogQG1ldGhvZCBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdGlvbnNcbiAgICogQHBhcmFtICB7bGF5ZXIuV2Vic29ja2V0cy5Tb2NrZXRNYW5hZ2VyfSBvcHRpb25zLnNvY2tldE1hbmFnZXIgLSBBIHdlYnNvY2tldCBtYW5hZ2VyIHRvIG1vbml0b3IgZm9yIG1lc3NhZ2VzXG4gICAqIEBwYXJhbSAge3N0cmluZ30gb3B0aW9ucy50ZXN0VXJsIC0gQSB1cmwgdG8gc2VuZCByZXF1ZXN0cyB0byB3aGVuIHRlc3RpbmcgaWYgd2UgYXJlIG9ubGluZVxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgLy8gTGlzdGVuIHRvIGFsbCB4aHIgZXZlbnRzIGFuZCB3ZWJzb2NrZXQgbWVzc2FnZXMgZm9yIG9ubGluZS1zdGF0dXMgaW5mb1xuICAgIHhoci5hZGRDb25uZWN0aW9uTGlzdGVuZXIoZXZ0ID0+IHRoaXMuX2Nvbm5lY3Rpb25MaXN0ZW5lcihldnQpKTtcbiAgICB0aGlzLnNvY2tldE1hbmFnZXIub24oJ21lc3NhZ2UnLCAoKSA9PiB0aGlzLl9jb25uZWN0aW9uTGlzdGVuZXIoeyBzdGF0dXM6ICdjb25uZWN0aW9uOnN1Y2Nlc3MnIH0pLCB0aGlzKTtcblxuICAgIC8vIEFueSBjaGFuZ2UgaW4gb25saW5lIHN0YXR1cyByZXBvcnRlZCBieSB0aGUgYnJvd3NlciBzaG91bGQgcmVzdWx0IGluXG4gICAgLy8gYW4gaW1tZWRpYXRlIHVwZGF0ZSB0byBvdXIgb25saW5lL29mZmxpbmUgc3RhdGVcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ29ubGluZScsIHRoaXMuX2hhbmRsZU9ubGluZUV2ZW50LmJpbmQodGhpcykpO1xuICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ29mZmxpbmUnLCB0aGlzLl9oYW5kbGVPbmxpbmVFdmVudC5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogV2UgZG9uJ3QgYWN0dWFsbHkgc3RhcnQgbWFuYWdpbmcgb3VyIG9ubGluZSBzdGF0ZSB1bnRpbCBhZnRlciB0aGUgY2xpZW50IGhhcyBhdXRoZW50aWNhdGVkLlxuICAgKiBDYWxsIHN0YXJ0KCkgd2hlbiB3ZSBhcmUgcmVhZHkgZm9yIHRoZSBjbGllbnQgdG8gc3RhcnQgbWFuYWdpbmcgb3VyIHN0YXRlLlxuICAgKlxuICAgKiBUaGUgY2xpZW50IHdvbid0IGNhbGwgc3RhcnQoKSB3aXRob3V0IGZpcnN0IHZhbGlkYXRpbmcgdGhhdCB3ZSBoYXZlIGEgdmFsaWQgc2Vzc2lvbiwgc28gYnkgZGVmaW5pdGlvbixcbiAgICogY2FsbGluZyBzdGFydCBtZWFucyB3ZSBhcmUgb25saW5lLlxuICAgKlxuICAgKiBAbWV0aG9kIHN0YXJ0XG4gICAqL1xuICBzdGFydCgpIHtcbiAgICBsb2dnZXIuaW5mbygnT25saW5lU3RhdGVNYW5hZ2VyOiBzdGFydCcpO1xuICAgIHRoaXMuaXNDbGllbnRSZWFkeSA9IHRydWU7XG4gICAgdGhpcy5pc09ubGluZSA9IHRydWU7XG5cbiAgICB0aGlzLmNoZWNrT25saW5lU3RhdHVzKCk7XG4gIH1cblxuICAvKipcbiAgICogSWYgdGhlIGNsaWVudCBiZWNvbWVzIHVuYXV0aGVudGljYXRlZCwgc3RvcCBjaGVja2luZyBpZiB3ZSBhcmUgb25saW5lLCBhbmQgYW5ub3VuY2UgdGhhdCB3ZSBhcmUgb2ZmbGluZS5cbiAgICpcbiAgICogQG1ldGhvZCBzdG9wXG4gICAqL1xuICBzdG9wKCkge1xuICAgIGxvZ2dlci5pbmZvKCdPbmxpbmVTdGF0ZU1hbmFnZXI6IHN0b3AnKTtcbiAgICB0aGlzLmlzQ2xpZW50UmVhZHkgPSBmYWxzZTtcbiAgICB0aGlzLl9jbGVhckNoZWNrKCk7XG4gICAgdGhpcy5fY2hhbmdlVG9PZmZsaW5lKCk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBTY2hlZHVsZXMgb3VyIG5leHQgY2FsbCB0byBfb25saW5lRXhwaXJlZCBpZiBvbmxpbmUgb3IgY2hlY2tPbmxpbmVTdGF0dXMgaWYgb2ZmbGluZS5cbiAgICpcbiAgICogQG1ldGhvZCBfc2NoZWR1bGVOZXh0T25saW5lQ2hlY2tcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9zY2hlZHVsZU5leHRPbmxpbmVDaGVjaygpIHtcbiAgICBsb2dnZXIuZGVidWcoJ09ubGluZVN0YXRlTWFuYWdlcjogc2tpcCBzY2hlZHVsZScpO1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkIHx8ICF0aGlzLmlzQ2xpZW50UmVhZHkpIHJldHVybjtcblxuICAgIC8vIFJlcGxhY2UgYW55IHNjaGVkdWxlZCBjYWxscyB3aXRoIHRoZSBuZXdseSBzY2hlZHVsZWQgY2FsbDpcbiAgICB0aGlzLl9jbGVhckNoZWNrKCk7XG5cbiAgICAvLyBJZiB0aGlzIGlzIGNhbGxlZCB3aGlsZSB3ZSBhcmUgb25saW5lLCB0aGVuIHdlIGFyZSB1c2luZyB0aGlzIHRvIGRldGVjdCB3aGVuIHdlJ3ZlIGdvbmUgd2l0aG91dCBkYXRhIGZvciBtb3JlIHRoYW4gcGluZ0ZyZXF1ZW5jeS5cbiAgICAvLyBDYWxsIHRoaXMuX29ubGluZUV4cGlyZWQgYWZ0ZXIgcGluZ0ZyZXF1ZW5jeSBvZiBubyBzZXJ2ZXIgcmVzcG9uc2VzLlxuICAgIGlmICh0aGlzLmlzT25saW5lKSB7XG4gICAgICBsb2dnZXIuZGVidWcoJ09ubGluZVN0YXRlTWFuYWdlcjogU2NoZWR1bGVkIG9ubGluZUV4cGlyZWQnKTtcbiAgICAgIHRoaXMub25saW5lQ2hlY2tJZCA9IHNldFRpbWVvdXQodGhpcy5fb25saW5lRXhwaXJlZC5iaW5kKHRoaXMpLCB0aGlzLnBpbmdGcmVxdWVuY3kpO1xuICAgIH1cblxuICAgIC8vIElmIHRoaXMgaXMgY2FsbGVkIHdoaWxlIHdlIGFyZSBvZmZsaW5lLCB3ZSdyZSBkb2luZyBleHBvbmVudGlhbCBiYWNrb2ZmIHBpbmdpbmcgdGhlIHNlcnZlciB0byBzZWUgaWYgd2UndmUgY29tZSBiYWNrIG9ubGluZS5cbiAgICBlbHNlIHtcbiAgICAgIGxvZ2dlci5pbmZvKCdPbmxpbmVTdGF0ZU1hbmFnZXI6IFNjaGVkdWxlZCBjaGVja09ubGluZVN0YXR1cycpO1xuICAgICAgY29uc3QgZHVyYXRpb24gPSBVdGlscy5nZXRFeHBvbmVudGlhbEJhY2tvZmZTZWNvbmRzKHRoaXMubWF4T2ZmbGluZVdhaXQsIE1hdGgubWluKDEwLCB0aGlzLm9mZmxpbmVDb3VudGVyKyspKTtcbiAgICAgIHRoaXMub25saW5lQ2hlY2tJZCA9IHNldFRpbWVvdXQodGhpcy5jaGVja09ubGluZVN0YXR1cy5iaW5kKHRoaXMpLCBNYXRoLmZsb29yKGR1cmF0aW9uICogMTAwMCkpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYW5jZWxzIGFueSB1cGNvbWluZyBjYWxscyB0byBjaGVja09ubGluZVN0YXR1c1xuICAgKlxuICAgKiBAbWV0aG9kIF9jbGVhckNoZWNrXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfY2xlYXJDaGVjaygpIHtcbiAgICBpZiAodGhpcy5vbmxpbmVDaGVja0lkKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5vbmxpbmVDaGVja0lkKTtcbiAgICAgIHRoaXMub25saW5lQ2hlY2tJZCA9IDA7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlc3BvbmQgdG8gdGhlIGJyb3dzZXIncyBvbmxpbmUvb2ZmbGluZSBldmVudHMuXG4gICAqXG4gICAqIE91ciByZXNwb25zZSBpcyBub3QgdG8gdHJ1c3QgdGhlbSwgYnV0IHRvIHVzZSB0aGVtIGFzXG4gICAqIGEgdHJpZ2dlciB0byBpbmRpY2F0ZSB3ZSBzaG91bGQgaW1tZWRpYXRlbHkgZG8gb3VyIG93blxuICAgKiB2YWxpZGF0aW9uLlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVPbmxpbmVFdmVudFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtFdmVudH0gZXZ0IC0gQnJvd3NlciBvbmxpbmUvb2ZmbGluZSBldmVudCBvYmplY3RcbiAgICovXG4gIF9oYW5kbGVPbmxpbmVFdmVudChldnQpIHtcbiAgICAvLyBSZXNldCB0aGUgY291bnRlciBiZWNhdXNlIG91ciBmaXJzdCByZXF1ZXN0IG1heSBmYWlsIGFzIHRoZXkgbWF5IG5vdCBiZVxuICAgIC8vIGZ1bGx5IGNvbm5lY3RlZCB5ZXRcbiAgICB0aGlzLm9mZmxpbmVDb3VudGVyID0gMDtcbiAgICB0aGlzLmNoZWNrT25saW5lU3RhdHVzKCk7XG4gIH1cblxuICAvKipcbiAgICogT3VyIG9ubGluZSBzdGF0ZSBoYXMgZXhwaXJlZDsgd2UgYXJlIG5vdyBvZmZsaW5lLlxuICAgKlxuICAgKiBJZiB0aGlzIG1ldGhvZCBnZXRzIGNhbGxlZCwgaXQgbWVhbnMgdGhhdCBvdXIgY29ubmVjdGlvbiBoYXMgZ29uZSB0b28gbG9uZyB3aXRob3V0IGFueSBkYXRhXG4gICAqIGFuZCBpcyBub3cgY29uc2lkZXJlZCB0byBiZSBkaXNjb25uZWN0ZWQuICBTdGFydCBzY2hlZHVsaW5nIHRlc3RzIHRvIHNlZSB3aGVuIHdlIGFyZSBiYWNrIG9ubGluZS5cbiAgICpcbiAgICogQG1ldGhvZCBfb25saW5lRXhwaXJlZFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX29ubGluZUV4cGlyZWQoKSB7XG4gICAgdGhpcy5fY2xlYXJDaGVjaygpO1xuICAgIHRoaXMuX2NoYW5nZVRvT2ZmbGluZSgpO1xuICAgIHRoaXMuX3NjaGVkdWxlTmV4dE9ubGluZUNoZWNrKCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGEgbm9uY2UgdG8gc2VlIGlmIHdlIGNhbiByZWFjaCB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBXZSBkb24ndCBjYXJlIGFib3V0IHRoZSByZXN1bHQsXG4gICAqIHdlIGp1c3QgY2FyZSBhYm91dCB0cmlnZ2VyaW5nIGEgJ2Nvbm5lY3Rpb246c3VjY2Vzcycgb3IgJ2Nvbm5lY3Rpb246ZXJyb3InIGV2ZW50XG4gICAqIHdoaWNoIGNvbm5lY3Rpb25MaXN0ZW5lciB3aWxsIHJlc3BvbmQgdG8uXG4gICAqXG4gICAqICAgICAgY2xpZW50Lm9ubGluZU1hbmFnZXIuY2hlY2tPbmxpbmVTdGF0dXMoZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAqICAgICAgICAgIGFsZXJ0KHJlc3VsdCA/ICdXZSdyZSBvbmxpbmUhJyA6ICdEb2ghJyk7XG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBtZXRob2QgY2hlY2tPbmxpbmVTdGF0dXNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtIHtib29sZWFufSBjYWxsYmFjay5pc09ubGluZSAtIENhbGxiYWNrIGlzIGNhbGxlZCB3aXRoIHRydWUgaWYgb25saW5lLCBmYWxzZSBpZiBub3RcbiAgICovXG4gIGNoZWNrT25saW5lU3RhdHVzKGNhbGxiYWNrKSB7XG4gICAgdGhpcy5fY2xlYXJDaGVjaygpO1xuXG4gICAgbG9nZ2VyLmluZm8oJ09ubGluZVN0YXRlTWFuYWdlcjogRmlyaW5nIFhIUiBmb3Igb25saW5lIGNoZWNrJyk7XG4gICAgdGhpcy5fbGFzdENoZWNrT25saW5lU3RhdHVzID0gbmV3IERhdGUoKTtcbiAgICAvLyBQaW5nIHRoZSBzZXJ2ZXIgYW5kIHNlZSBpZiB3ZSdyZSBjb25uZWN0ZWQuXG4gICAgeGhyKHtcbiAgICAgIHVybDogdGhpcy50ZXN0VXJsLFxuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIGFjY2VwdDogQUNDRVBULFxuICAgICAgfSxcbiAgICB9LCAoKSA9PiB7XG4gICAgICAvLyB0aGlzLmlzT25saW5lIHdpbGwgYmUgdXBkYXRlZCB2aWEgX2Nvbm5lY3Rpb25MaXN0ZW5lciBwcmlvciB0byB0aGlzIGxpbmUgZXhlY3V0aW5nXG4gICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKHRoaXMuaXNPbmxpbmUpO1xuICAgIH0pO1xuICB9XG5cblxuICAvKipcbiAgICogT24gZGV0ZXJtaW5pbmcgdGhhdCB3ZSBhcmUgb2ZmbGluZSwgaGFuZGxlcyB0aGUgc3RhdGUgdHJhbnNpdGlvbiBhbmQgbG9nZ2luZy5cbiAgICpcbiAgICogQG1ldGhvZCBfY2hhbmdlVG9PZmZsaW5lXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfY2hhbmdlVG9PZmZsaW5lKCkge1xuICAgIGlmICh0aGlzLmlzT25saW5lKSB7XG4gICAgICB0aGlzLmlzT25saW5lID0gZmFsc2U7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2Rpc2Nvbm5lY3RlZCcpO1xuICAgICAgbG9nZ2VyLmluZm8oJ09ubGluZVN0YXRlTWFuYWdlcjogQ29ubmVjdGlvbiBsb3N0Jyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCB3aGVuZXZlciBhIHdlYnNvY2tldCBldmVudCBhcnJpdmVzLCBvciBhbiB4aHIgY2FsbCBjb21wbGV0ZXM7IHVwZGF0ZXMgb3VyIGlzT25saW5lIHN0YXRlLlxuICAgKlxuICAgKiBBbnkgY2FsbCB0byB0aGlzIG1ldGhvZCB3aWxsIHJlc2NoZWR1bGUgb3VyIG5leHQgaXMtb25saW5lIHRlc3RcbiAgICpcbiAgICogQG1ldGhvZCBfY29ubmVjdGlvbkxpc3RlbmVyXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge3N0cmluZ30gZXZ0IC0gTmFtZSBvZiB0aGUgZXZlbnQ7IGVpdGhlciAnY29ubmVjdGlvbjpzdWNjZXNzJyBvciAnY29ubmVjdGlvbjplcnJvcidcbiAgICovXG4gIF9jb25uZWN0aW9uTGlzdGVuZXIoZXZ0KSB7XG4gICAgLy8gSWYgZXZlbnQgaXMgYSBzdWNjZXNzLCBjaGFuZ2UgdXMgdG8gb25saW5lXG4gICAgaWYgKGV2dC5zdGF0dXMgPT09ICdjb25uZWN0aW9uOnN1Y2Nlc3MnKSB7XG4gICAgICBjb25zdCBsYXN0VGltZSA9IHRoaXMubGFzdE1lc3NhZ2VUaW1lO1xuICAgICAgdGhpcy5sYXN0TWVzc2FnZVRpbWUgPSBuZXcgRGF0ZSgpO1xuICAgICAgaWYgKCF0aGlzLmlzT25saW5lKSB7XG4gICAgICAgIHRoaXMuaXNPbmxpbmUgPSB0cnVlO1xuICAgICAgICB0aGlzLm9mZmxpbmVDb3VudGVyID0gMDtcbiAgICAgICAgdGhpcy50cmlnZ2VyKCdjb25uZWN0ZWQnLCB7IG9mZmxpbmVEdXJhdGlvbjogbGFzdFRpbWUgPyBEYXRlLm5vdygpIC0gbGFzdFRpbWUgOiAwIH0pO1xuICAgICAgICBpZiAodGhpcy5jb25uZWN0ZWRDb3VudGVyID09PSB1bmRlZmluZWQpIHRoaXMuY29ubmVjdGVkQ291bnRlciA9IDA7XG4gICAgICAgIHRoaXMuY29ubmVjdGVkQ291bnRlcisrO1xuICAgICAgICBsb2dnZXIuaW5mbygnT25saW5lU3RhdGVNYW5hZ2VyOiBDb25uZWN0ZWQgcmVzdG9yZWQnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiBldmVudCBpcyBOT1Qgc3VjY2VzcywgY2hhbmdlIHVzIHRvIG9mZmxpbmUuXG4gICAgZWxzZSB7XG4gICAgICB0aGlzLl9jaGFuZ2VUb09mZmxpbmUoKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zY2hlZHVsZU5leHRPbmxpbmVDaGVjaygpO1xuICB9XG5cbiAgLyoqXG4gICAqIENsZWFudXAvc2h1dGRvd25cbiAgICpcbiAgICogQG1ldGhvZCBkZXN0cm95XG4gICAqL1xuICBkZXN0cm95KCkge1xuICAgIHRoaXMuX2NsZWFyQ2hlY2soKTtcbiAgICB0aGlzLnNvY2tldE1hbmFnZXIgPSBudWxsO1xuICAgIHN1cGVyLmRlc3Ryb3koKTtcbiAgfVxufVxuXG5PbmxpbmVTdGF0ZU1hbmFnZXIucHJvdG90eXBlLmlzQ2xpZW50UmVhZHkgPSBmYWxzZTtcblxuLyoqXG4gKiBVUkwgVG8gZmlyZSB3aGVuIHRlc3RpbmcgdG8gc2VlIGlmIHdlIGFyZSBvbmxpbmUuXG4gKiBAdHlwZSB7U3RyaW5nfVxuICovXG5PbmxpbmVTdGF0ZU1hbmFnZXIucHJvdG90eXBlLnRlc3RVcmwgPSAnJztcblxuLyoqXG4gKiBBIFdlYnNvY2tldCBtYW5hZ2VyIHdob3NlICdtZXNzYWdlJyBldmVudCB3ZSB3aWxsIGxpc3RlbiB0b1xuICogaW4gb3JkZXIgdG8ga25vdyB0aGF0IHdlIGFyZSBzdGlsbCBvbmxpbmUuXG4gKiBAdHlwZSB7bGF5ZXIuV2Vic29ja2V0cy5Tb2NrZXRNYW5hZ2VyfVxuICovXG5PbmxpbmVTdGF0ZU1hbmFnZXIucHJvdG90eXBlLnNvY2tldE1hbmFnZXIgPSBudWxsO1xuXG4vKipcbiAqIE51bWJlciBvZiB0ZXN0VXJsIHJlcXVlc3RzIHdlJ3ZlIGJlZW4gb2ZmbGluZSBmb3IuXG4gKlxuICogV2lsbCBzdG9wIGdyb3dpbmcgb25jZSB0aGUgbnVtYmVyIGlzIHN1aXRhYmx5IGxhcmdlICgxMC0yMCkuXG4gKiBAdHlwZSB7TnVtYmVyfVxuICovXG5PbmxpbmVTdGF0ZU1hbmFnZXIucHJvdG90eXBlLm9mZmxpbmVDb3VudGVyID0gMDtcblxuLyoqXG4gKiBNYXhpbXVtIHdhaXQgZHVyaW5nIGV4cG9uZW50aWFsIGJhY2tvZmYgd2hpbGUgb2ZmbGluZS5cbiAqXG4gKiBXaGlsZSBvZmZsaW5lLCBleHBvbmVudGlhbCBiYWNrb2ZmIGlzIHVzZWQgdG8gY2FsY3VsYXRlIGhvdyBsb25nIHRvIHdhaXQgYmV0d2VlbiBjaGVja2luZyB3aXRoIHRoZSBzZXJ2ZXJcbiAqIHRvIHNlZSBpZiB3ZSBhcmUgb25saW5lIGFnYWluLiBUaGlzIHZhbHVlIGRldGVybWluZXMgdGhlIG1heGltdW0gd2FpdDsgYW55IGhpZ2hlciB2YWx1ZSByZXR1cm5lZCBieSBleHBvbmVudGlhbCBiYWNrb2ZmXG4gKiBhcmUgaWdub3JlZCBhbmQgdGhpcyB2YWx1ZSB1c2VkIGluc3RlYWQuXG4gKiBWYWx1ZSBpcyBtZWFzdXJlZCBpbiBzZWNvbmRzLlxuICogQHR5cGUge051bWJlcn1cbiAqL1xuT25saW5lU3RhdGVNYW5hZ2VyLnByb3RvdHlwZS5tYXhPZmZsaW5lV2FpdCA9IDUgKiA2MDtcblxuLyoqXG4gKiBNaW5pbXVtIHdhaXQgYmV0d2VlbiB0cmllcyBpbiBtcy5cbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKi9cbk9ubGluZVN0YXRlTWFuYWdlci5wcm90b3R5cGUubWluQmFja29mZldhaXQgPSAxMDA7XG5cbi8qKlxuICogVGltZSB0aGF0IHRoZSBsYXN0IHN1Y2Nlc3NmdWwgbWVzc2FnZSB3YXMgb2JzZXJ2ZWQuXG4gKiBAdHlwZSB7RGF0ZX1cbiAqL1xuT25saW5lU3RhdGVNYW5hZ2VyLnByb3RvdHlwZS5sYXN0TWVzc2FnZVRpbWUgPSBudWxsO1xuXG4vKipcbiAqIEZvciBkZWJ1Z2dpbmcsIHRyYWNrcyB0aGUgbGFzdCB0aW1lIHdlIGNoZWNrZWQgaWYgd2UgYXJlIG9ubGluZS5cbiAqIEB0eXBlIHtEYXRlfVxuICovXG5PbmxpbmVTdGF0ZU1hbmFnZXIucHJvdG90eXBlLl9sYXN0Q2hlY2tPbmxpbmVTdGF0dXMgPSBudWxsO1xuXG4vKipcbiAqIEFyZSB3ZSBjdXJyZW50bHkgb25saW5lP1xuICogQHR5cGUge0Jvb2xlYW59XG4gKi9cbk9ubGluZVN0YXRlTWFuYWdlci5wcm90b3R5cGUuaXNPbmxpbmUgPSBmYWxzZTtcblxuLyoqXG4gKiBzZXRUaW1lb3V0SWQgZm9yIHRoZSBuZXh0IGNoZWNrT25saW5lU3RhdHVzKCkgY2FsbC5cbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKi9cbk9ubGluZVN0YXRlTWFuYWdlci5wcm90b3R5cGUub25saW5lQ2hlY2tJZCA9IDA7XG5cbi8qKlxuICogSWYgd2UgYXJlIG9ubGluZSwgaG93IG9mdGVuIGRvIHdlIG5lZWQgdG8gcGluZyB0byB2ZXJpZnkgd2UgYXJlIHN0aWxsIG9ubGluZS5cbiAqXG4gKiBWYWx1ZSBpcyByZXNldCBhbnkgdGltZSB3ZSBvYnNlcnZlIGFueSBtZXNzYWdlcyBmcm9tIHRoZSBzZXJ2ZXIuXG4gKiBNZWFzdXJlZCBpbiBtaWxpc2Vjb25kcy4gTk9URTogV2Vic29ja2V0IGhhcyBhIHNlcGFyYXRlIHBpbmcgd2hpY2ggbW9zdGx5IG1ha2VzXG4gKiB0aGlzIG9uZSB1bm5lY2Vzc2FyeS4gIE1heSBlbmQgdXAgcmVtb3ZpbmcgdGhpcyBvbmUuLi4gdGhvdWdoIHdlJ2Qga2VlcCB0aGVcbiAqIHBpbmcgZm9yIHdoZW4gb3VyIHN0YXRlIGlzIG9mZmxpbmUuXG4gKiBAdHlwZSB7TnVtYmVyfVxuICovXG5PbmxpbmVTdGF0ZU1hbmFnZXIucHJvdG90eXBlLnBpbmdGcmVxdWVuY3kgPSAxMDAgKiAxMDAwO1xuXG5PbmxpbmVTdGF0ZU1hbmFnZXIuX3N1cHBvcnRlZEV2ZW50cyA9IFtcbiAgLyoqXG4gICAqIFdlIGFwcGVhciB0byBiZSBvbmxpbmUgYW5kIGFibGUgdG8gc2VuZCBhbmQgcmVjZWl2ZVxuICAgKiBAZXZlbnQgY29ubmVjdGVkXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBvbmxpbmVEdXJhdGlvbiAtIE51bWJlciBvZiBtaWxpc2Vjb25kcyBzaW5jZSB3ZSB3ZXJlIGxhc3Qga25vd24gdG8gYmUgb25saW5lXG4gICAqL1xuICAnY29ubmVjdGVkJyxcblxuICAvKipcbiAgICogV2UgYXBwZWFyIHRvIGJlIG9mZmxpbmUgYW5kIHVuYWJsZSB0byBzZW5kIG9yIHJlY2VpdmVcbiAgICogQGV2ZW50IGRpc2Nvbm5lY3RlZFxuICAgKi9cbiAgJ2Rpc2Nvbm5lY3RlZCcsXG5dLmNvbmNhdChSb290Ll9zdXBwb3J0ZWRFdmVudHMpO1xuUm9vdC5pbml0Q2xhc3MuYXBwbHkoT25saW5lU3RhdGVNYW5hZ2VyLCBbT25saW5lU3RhdGVNYW5hZ2VyLCAnT25saW5lU3RhdGVNYW5hZ2VyJ10pO1xubW9kdWxlLmV4cG9ydHMgPSBPbmxpbmVTdGF0ZU1hbmFnZXI7XG4iXX0=
