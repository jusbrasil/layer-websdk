'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * @class  layer.SyncManager
 * @extends layer.Root
 * @protected
 *
 * This class manages
 *
 * 1. a queue of requests that need to be made
 * 2. when a request should be fired, based on authentication state, online state, websocket connection state, and position in the queue
 * 3. when a request should be aborted
 * 4. triggering any request callbacks
 *
 * TODO: In the event of a DNS error, we may have a valid websocket receiving events and telling us we are online,
 * and be unable to create a REST call.  This will be handled wrong because evidence will suggest that we are online.
 * This issue goes away when we use bidirectional websockets for all requests.
 *
 * Applications do not typically interact with this class, but may subscribe to its events
 * to get richer detailed information than is available from the layer.Client instance.
 */
var Root = require('./root');

var _require = require('./sync-event');

var WebsocketSyncEvent = _require.WebsocketSyncEvent;

var xhr = require('./xhr');
var logger = require('./logger');
var Utils = require('./client-utils');

var MAX_RECEIPT_CONNECTIONS = 4;

var SyncManager = function (_Root) {
  _inherits(SyncManager, _Root);

  /**
   * Creates a new SyncManager.
   *
   * An Application is expected to only have one SyncManager.
   *
   *      var socketManager = new layer.Websockets.SocketManager({client: client});
   *      var requestManager = new layer.Websockets.RequestManager({client: client, socketManager: socketManager});
   *
   *      var onlineManager = new layer.OnlineManager({
   *          socketManager: socketManager
   *      });
   *
   *      // Now we can instantiate this thing...
   *      var SyncManager = new layer.SyncManager({
   *          client: client,
   *          onlineManager: onlineManager,
   *          socketManager: socketManager,
   *          requestManager: requestManager
   *      });
   *
   * @method constructor
   * @param  {Object} options
   * @param {layer.OnlineStateManager} options.onlineManager
   * @param {layer.Websockets.RequestManager} options.requestManager
   * @param {layer.Client} options.client
   */
  function SyncManager(options) {
    _classCallCheck(this, SyncManager);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(SyncManager).call(this, options));

    _this.client = options.client;

    // Note we do not store a pointer to client... it is not needed.
    if (_this.client) {
      _this.client.on('ready', function () {
        _this._processNextRequest();
        _this._loadPersistedQueue();
      }, _this);
    }
    _this.queue = [];
    _this.receiptQueue = [];

    _this.onlineManager.on('disconnected', _this._onlineStateChange, _this);
    _this.socketManager.on('connected disconnected', _this._onlineStateChange, _this);
    return _this;
  }

  /**
   * Returns whether the Client is online/offline.
   *
   * For internal use; applications should use layer.Client.isOnline.
   *
   * @method isOnline
   * @returns {Boolean}
   */


  _createClass(SyncManager, [{
    key: 'isOnline',
    value: function isOnline() {
      return this.onlineManager.isOnline;
    }

    /**
     * Process sync request when connection is restored.
     *
     * Any time we go back online (as signaled by the onlineStateManager),
     * Process the next Sync Event (will do nothing if one is already firing)
     *
     * @method _onlineStateChange
     * @private
     * @param  {string} evtName - 'connected' or 'disconnected'
     * @param  {layer.LayerEvent} evt
     */

  }, {
    key: '_onlineStateChange',
    value: function _onlineStateChange(evt) {
      var _this2 = this;

      if (evt.eventName === 'connected') {
        if (this.queue.length) this.queue[0].returnToOnlineCount++;
        setTimeout(function () {
          return _this2._processNextRequest();
        }, 100);
      } else if (evt.eventName === 'disconnected') {
        if (this.queue.length) {
          this.queue[0].isFiring = false;
        }
        if (this.receiptQueue.length) {
          this.receiptQueue.forEach(function (syncEvt) {
            syncEvt.isFiring = false;
          });
        }
      }
    }

    /**
     * Adds a new xhr request to the queue.
     *
     * If the queue is empty, this will be fired immediately; else it will be added to the queue and wait its turn.
     *
     * If its a read/delivery receipt request, it will typically be fired immediately unless there are many receipt
     * requests already in-flight.
     *
     * @method request
     * @param  {layer.SyncEvent} requestEvt - A SyncEvent specifying the request to be made
     */

  }, {
    key: 'request',
    value: function request(requestEvt) {
      // If its a PATCH request on an object that isn't yet created,
      // do not add it to the queue.
      if (requestEvt.operation !== 'PATCH' || !this._findUnfiredCreate(requestEvt)) {
        logger.info('Sync Manager Request ' + requestEvt.operation + ' on target ' + requestEvt.target, requestEvt.toObject());
        if (requestEvt.operation === 'RECEIPT') {
          this.receiptQueue.push(requestEvt);
        } else {
          this.queue.push(requestEvt);
        }
        this.trigger('sync:add', {
          request: requestEvt,
          target: requestEvt.target
        });
      } else {
        logger.info('Sync Manager Request PATCH ' + requestEvt.target + ' request ignored; create request still enqueued', requestEvt.toObject());
      }

      // If its a DELETE request, purge all other requests on that target.
      if (requestEvt.operation === 'DELETE') {
        this._purgeOnDelete(requestEvt);
      }

      this._processNextRequest(requestEvt);
    }
  }, {
    key: '_processNextRequest',
    value: function _processNextRequest(requestEvt) {
      var _this3 = this;

      // Fire the request if there aren't any existing requests already firing
      if (this.queue.length && !this.queue[0].isFiring) {
        if (requestEvt) {
          this.client.dbManager.writeSyncEvents([requestEvt], function () {
            return _this3._processNextStandardRequest();
          });
        } else {
          this._processNextStandardRequest();
        }
      }

      // If we have anything in the receipts queue, fire it
      if (this.receiptQueue.length) {
        this._processNextReceiptRequest();
      }
    }

    /**
     * Find create request for this resource.
     *
     * Determine if the given target has a POST request waiting to create
     * the resource, and return any matching requests. Used
     * for folding PATCH requests into an unfired CREATE/POST request.
     *
     * @method _findUnfiredCreate
     * @private
     * @param  {layer.SyncEvent} requestEvt
     * @return {Boolean}
     */

  }, {
    key: '_findUnfiredCreate',
    value: function _findUnfiredCreate(requestEvt) {
      return Boolean(this.queue.filter(function (evt) {
        return evt.target === requestEvt.target && evt.operation === 'POST' && !evt.isFiring;
      }).length);
    }

    /**
     * Process the next request in the queue.
     *
     * Request is dequeued on completing the process.
     * If the first request in the queue is firing, do nothing.
     *
     * @method _processNextRequest
     * @private
     */

  }, {
    key: '_processNextStandardRequest',
    value: function _processNextStandardRequest() {
      var _this4 = this;

      if (this.isDestroyed || !this.client.isAuthenticated) return;
      var requestEvt = this.queue[0];
      if (this.isOnline() && requestEvt && !requestEvt.isFiring && !requestEvt._isValidating) {
        requestEvt._isValidating = true;
        this._validateRequest(requestEvt, function (isValid) {
          requestEvt._isValidating = false;
          if (!isValid) {
            _this4._removeRequest(requestEvt, false);
            return _this4._processNextStandardRequest();
          } else {
            _this4._fireRequest(requestEvt);
          }
        });
      }
    }

    /**
     * Process up to MAX_RECEIPT_CONNECTIONS worth of receipts.
     *
     * These requests have no interdependencies. Just fire them all
     * as fast as we can, in parallel.
     *
     * @method _processNextReceiptRequest
     * @private
     */

  }, {
    key: '_processNextReceiptRequest',
    value: function _processNextReceiptRequest() {
      var _this5 = this;

      var firingReceipts = 0;
      this.receiptQueue.forEach(function (receiptEvt) {
        if (_this5.isOnline() && receiptEvt) {
          if (receiptEvt.isFiring || receiptEvt._isValidating) {
            firingReceipts++;
          } else if (firingReceipts < MAX_RECEIPT_CONNECTIONS) {
            firingReceipts++;
            receiptEvt._isValidating = true;
            _this5._validateRequest(receiptEvt, function (isValid) {
              receiptEvt._isValidating = false;
              if (!isValid) {
                var index = _this5.receiptQueue.indexOf(receiptEvt);
                if (index !== -1) _this5.receiptQueue.splice(index, 1);
              } else {
                _this5._fireRequest(receiptEvt);
              }
            });
          }
        }
      });
    }

    /**
     * Directly fire this sync request.
     *
     * This is intended to be called only after careful analysis of our state to make sure its safe to send the request.
     * See `_processNextRequest()`
     *
     * @method _fireRequest
     * @private
     * @param {layer.SyncEvent} requestEvt
     */

  }, {
    key: '_fireRequest',
    value: function _fireRequest(requestEvt) {
      if (requestEvt instanceof WebsocketSyncEvent) {
        this._fireRequestWebsocket(requestEvt);
      } else {
        this._fireRequestXHR(requestEvt);
      }
    }

    /**
     * Directly fire this XHR Sync request.
     *
     * @method _fireRequestXHR
     * @private
     * @param {layer.SyncEvent.XHRSyncEvent} requestEvt
     */

  }, {
    key: '_fireRequestXHR',
    value: function _fireRequestXHR(requestEvt) {
      var _this6 = this;

      requestEvt.isFiring = true;
      if (!requestEvt.headers) requestEvt.headers = {};
      requestEvt.headers.authorization = 'Layer session-token="' + this.client.sessionToken + '"';
      logger.debug('Sync Manager XHR Request Firing ' + requestEvt.operation + ' ' + requestEvt.target, requestEvt.toObject());
      xhr(requestEvt._getRequestData(this.client), function (result) {
        return _this6._xhrResult(result, requestEvt);
      });
    }

    /**
     * Directly fire this Websocket Sync request.
     *
     * @method _fireRequestWebsocket
     * @private
     * @param {layer.SyncEvent.WebsocketSyncEvent} requestEvt
     */

  }, {
    key: '_fireRequestWebsocket',
    value: function _fireRequestWebsocket(requestEvt) {
      var _this7 = this;

      if (this.socketManager && this.socketManager._isOpen()) {
        logger.debug('Sync Manager Websocket Request Firing ' + requestEvt.operation + ' on target ' + requestEvt.target, requestEvt.toObject());
        requestEvt.isFiring = true;
        this.requestManager.sendRequest(requestEvt._getRequestData(this.client), function (result) {
          return _this7._xhrResult(result, requestEvt);
        });
      } else {
        logger.debug('Sync Manager Websocket Request skipped; socket closed');
      }
    }

    /**
     * Is the syncEvent still valid?
     *
     * This method specifically tests to see if some other tab has already sent this request.
     * If persistence of the syncQueue is not enabled, then the callback is immediately called with true.
     * If another tab has already sent the request, then the entry will no longer be in indexedDB and the callback
     * will call false.
     *
     * @method _validateRequest
     * @param {layer.SyncEvent} syncEvent
     * @param {Function} callback
     * @param {Function} callback.isValid - The request is still valid
     * @private
     */

  }, {
    key: '_validateRequest',
    value: function _validateRequest(syncEvent, callback) {
      this.client.dbManager.claimSyncEvent(syncEvent, function (isFound) {
        return callback(isFound);
      });
    }

    /**
     * Turn deduplication errors into success messages.
     *
     * If this request has already been made but we failed to get a response the first time and we retried the request,
     * we will reissue the request.  If the prior request was successful we'll get back a deduplication error
     * with the created object. As far as the WebSDK is concerned, this is a success.
     *
     * @method _handleDeduplicationErrors
     * @private
     */

  }, {
    key: '_handleDeduplicationErrors',
    value: function _handleDeduplicationErrors(result) {
      if (result.data && result.data.id === 'id_in_use' && result.data.data && result.data.data.id === result.request._getCreateId()) {
        result.success = true;
        result.data = result.data.data;
      }
    }

    /**
     * Process the result of an xhr call, routing it to the appropriate handler.
     *
     * @method _xhrResult
     * @private
     * @param  {Object} result  - Response object returned by xhr call
     * @param  {layer.SyncEvent} requestEvt - Request object
     */

  }, {
    key: '_xhrResult',
    value: function _xhrResult(result, requestEvt) {
      if (this.isDestroyed) return;
      result.request = requestEvt;
      requestEvt.isFiring = false;
      this._handleDeduplicationErrors(result);
      if (!result.success) {
        this._xhrError(result);
      } else {
        this._xhrSuccess(result);
      }
    }

    /**
     * Categorize the error for handling.
     *
     * @method _getErrorState
     * @private
     * @param  {Object} result  - Response object returned by xhr call
     * @param  {layer.SyncEvent} requestEvt - Request object
     * @param  {boolean} isOnline - Is our app state set to online
     * @returns {String}
     */

  }, {
    key: '_getErrorState',
    value: function _getErrorState(result, requestEvt, isOnline) {
      var errId = result.data ? result.data.id : '';
      if (!isOnline) {
        // CORS errors look identical to offline; but if our online state has transitioned from false to true repeatedly while processing this request,
        // thats a hint that that its a CORS error
        if (requestEvt.returnToOnlineCount >= SyncManager.MAX_RETRIES_BEFORE_CORS_ERROR) {
          return 'CORS';
        } else {
          return 'offline';
        }
      } else if (errId === 'not_found') {
        return 'notFound';
      } else if (errId === 'id_in_use') {
        return 'invalidId'; // This only fires if we get `id_in_use` but no Resource, which means the UUID was used by another user/app.
      } else if (result.status === 408 || errId === 'request_timeout') {
        if (requestEvt.retryCount >= SyncManager.MAX_RETRIES) {
          return 'tooManyFailuresWhileOnline';
        } else {
          return 'validateOnlineAndRetry';
        }
      } else if ([502, 503, 504].indexOf(result.status) !== -1) {
        if (requestEvt.retryCount >= SyncManager.MAX_RETRIES) {
          return 'tooManyFailuresWhileOnline';
        } else {
          return 'serverUnavailable';
        }
      } else if (errId === 'authentication_required' && result.data.data && result.data.data.nonce) {
        return 'reauthorize';
      } else {
        return 'serverRejectedRequest';
      }
    }

    /**
     * Handle failed requests.
     *
     * 1. If there was an error from the server, then the request has problems
     * 2. If we determine we are not in fact online, call the connectionError handler
     * 3. If we think we are online, verify we are online and then determine how to handle it.
     *
     * @method _xhrError
     * @private
     * @param  {Object} result  - Response object returned by xhr call
     * @param  {layer.SyncEvent} requestEvt - Request object
     */

  }, {
    key: '_xhrError',
    value: function _xhrError(result) {
      var requestEvt = result.request;

      logger.warn('Sync Manager ' + (requestEvt instanceof WebsocketSyncEvent ? 'Websocket' : 'XHR') + ' ' + (requestEvt.operation + ' Request on target ' + requestEvt.target + ' has Failed'), requestEvt.toObject());

      var errState = this._getErrorState(result, requestEvt, this.isOnline());
      logger.warn('Sync Manager Error State: ' + errState);
      switch (errState) {
        case 'tooManyFailuresWhileOnline':
          this._xhrHandleServerError(result, 'Sync Manager Server Unavailable Too Long; removing request', false);
          break;
        case 'notFound':
          this._xhrHandleServerError(result, 'Resource not found; presumably deleted', false);
          break;
        case 'invalidId':
          this._xhrHandleServerError(result, 'ID was not unique; request failed', false);
          break;
        case 'validateOnlineAndRetry':
          // Server appears to be hung but will eventually recover.
          // Retry a few times and then error out.
          this._xhrValidateIsOnline(requestEvt);
          break;
        case 'serverUnavailable':
          // Server is in a bad state but will eventually recover;
          // keep retrying.
          this._xhrHandleServerUnavailableError(requestEvt);
          break;
        case 'reauthorize':
          // sessionToken appears to no longer be valid; forward response
          // on to client-authenticator to process.
          // Do not retry nor advance to next request.
          if (requestEvt.callback) requestEvt.callback(result);

          break;
        case 'serverRejectedRequest':
          // Server presumably did not like the arguments to this call
          // or the url was invalid.  Do not retry; trigger the callback
          // and let the caller handle it.
          this._xhrHandleServerError(result, 'Sync Manager Server Rejects Request; removing request', true);
          break;
        case 'CORS':
          // A pattern of offline-like failures that suggests its actually a CORs error
          this._xhrHandleServerError(result, 'Sync Manager Server detects CORS-like errors; removing request', false);
          break;
        case 'offline':
          this._xhrHandleConnectionError();
          break;
      }

      // Write the sync event back to the database if we haven't completed processing it
      if (this.queue.indexOf(requestEvt) !== -1 || this.receiptQueue.indexOf(requestEvt) !== -1) {
        this.client.dbManager.writeSyncEvents([requestEvt]);
      }
    }

    /**
     * Handle a server unavailable error.
     *
     * In the event of a 502 (Bad Gateway), 503 (service unavailable)
     * or 504 (gateway timeout) error from the server
     * assume we have an error that is self correcting on the server.
     * Use exponential backoff to retry the request.
     *
     * Note that each call will increment retryCount; there is a maximum
     * of MAX_RETRIES before it is treated as an error
     *
     * @method  _xhrHandleServerUnavailableError
     * @private
     * @param {layer.SyncEvent} request
     */

  }, {
    key: '_xhrHandleServerUnavailableError',
    value: function _xhrHandleServerUnavailableError(request) {
      var maxDelay = SyncManager.MAX_UNAVAILABLE_RETRY_WAIT;
      var delay = Utils.getExponentialBackoffSeconds(maxDelay, Math.min(15, request.retryCount++));
      logger.warn('Sync Manager Server Unavailable; retry count ' + request.retryCount + '; retrying in ' + delay + ' seconds');
      setTimeout(this._processNextRequest.bind(this), delay * 1000);
    }

    /**
     * Handle a server error in response to firing sync event.
     *
     * If there is a server error, its presumably non-recoverable/non-retryable error, so
     * we're going to abort this request.
     *
     * 1. If a callback was provided, call it to handle the error
     * 2. If a rollback call is provided, call it to undo any patch/delete/etc... changes
     * 3. If the request was to create a resource, remove from the queue all requests
     *    that depended upon that resource.
     * 4. Advance to next request
     *
     * @method _xhrHandleServerError
     * @private
     * @param  {Object} result  - Response object returned by xhr call
     * @param  {string} logMsg - Message to display in console
     * @param  {boolean} stringify - log object for quick debugging
     *
     */

  }, {
    key: '_xhrHandleServerError',
    value: function _xhrHandleServerError(result, logMsg, stringify) {
      // Execute all callbacks provided by the request
      if (result.request.callback) result.request.callback(result);
      if (stringify) {
        logger.error(logMsg + '\nREQUEST: ' + JSON.stringify(result.request.toObject(), null, 4) + '\nRESPONSE: ' + JSON.stringify(result.data, null, 4));
      } else {
        logger.error(logMsg, result);
      }
      this.trigger('sync:error', {
        target: result.request.target,
        request: result.request,
        error: result.data
      });

      result.request.success = false;

      // If a POST request fails, all requests that depend upon this object
      // must be purged
      if (result.request.operation === 'POST') {
        this._purgeDependentRequests(result.request);
      }

      // Remove this request as well (side-effect: rolls back the operation)
      this._removeRequest(result.request, true);

      // And finally, we are ready to try the next request
      this._processNextRequest();
    }

    /**
     * If there is a connection error, wait for retry.
     *
     * In the event of what appears to be a connection error,
     * Wait until a 'connected' event before processing the next request (actually reprocessing the current event)
     *
     * @method _xhrHandleConnectionError
     * @private
     */

  }, {
    key: '_xhrHandleConnectionError',
    value: function _xhrHandleConnectionError() {}
    // Nothing to be done; we already have the below event handler setup
    // this.onlineManager.once('connected', () => this._processNextRequest());


    /**
     * Verify that we are online and retry request.
     *
     * This method is called when we think we're online, but
     * have determined we need to validate that assumption.
     *
     * Test that we have a connection; if we do,
     * retry the request once, and if it fails again,
     * _xhrError() will determine it to have failed and remove it from the queue.
     *
     * If we are offline, then let _xhrHandleConnectionError handle it.
     *
     * @method _xhrValidateIsOnline
     * @private
     */

  }, {
    key: '_xhrValidateIsOnline',
    value: function _xhrValidateIsOnline(requestEvt) {
      var _this8 = this;

      logger.debug('Sync Manager verifying online state');
      this.onlineManager.checkOnlineStatus(function (isOnline) {
        return _this8._xhrValidateIsOnlineCallback(isOnline, requestEvt);
      });
    }

    /**
     * If we have verified we are online, retry request.
     *
     * We should have received a response to our /nonces call
     * which assuming the server is actually alive,
     * will tell us if the connection is working.
     *
     * If we are offline, flag us as offline and let the ConnectionError handler handle this
     * If we are online, give the request a single retry (there is never more than one retry)
     *
     * @method _xhrValidateIsOnlineCallback
     * @private
     * @param  {boolean} isOnline  - Response object returned by xhr call
     * @param {layer.SyncEvent} requestEvt - The request that failed triggering this call
     */

  }, {
    key: '_xhrValidateIsOnlineCallback',
    value: function _xhrValidateIsOnlineCallback(isOnline, requestEvt) {
      logger.debug('Sync Manager online check result is ' + isOnline);
      if (!isOnline) {
        // Treat this as a Connection Error
        this._xhrHandleConnectionError();
      } else {
        // Retry the request in case we were offline, but are now online.
        // Of course, if this fails, give it up entirely.
        requestEvt.retryCount++;
        this._processNextRequest();
      }
    }

    /**
     * The XHR request was successful.
     *
     * Any xhr request that actually succedes:
     *
     * 1. Remove it from the queue
     * 2. Call any callbacks
     * 3. Advance to next request
     *
     * @method _xhrSuccess
     * @private
     * @param  {Object} result  - Response object returned by xhr call
     * @param  {layer.SyncEvent} requestEvt - Request object
     */

  }, {
    key: '_xhrSuccess',
    value: function _xhrSuccess(result) {
      var requestEvt = result.request;
      logger.debug('Sync Manager ' + (requestEvt instanceof WebsocketSyncEvent ? 'Websocket' : 'XHR') + ' ' + (requestEvt.operation + ' Request on target ' + requestEvt.target + ' has Succeeded'), requestEvt.toObject());
      if (result.data) logger.debug(result.data);
      requestEvt.success = true;
      this._removeRequest(requestEvt, true);
      if (requestEvt.callback) requestEvt.callback(result);
      this._processNextRequest();

      this.trigger('sync:success', {
        target: requestEvt.target,
        request: requestEvt,
        response: result.data
      });
    }

    /**
     * Remove the SyncEvent request from the queue.
     *
     * @method _removeRequest
     * @private
     * @param  {layer.SyncEvent} requestEvt - SyncEvent Request to remove
     * @param {Boolean} deleteDB - Delete from indexedDB
     */

  }, {
    key: '_removeRequest',
    value: function _removeRequest(requestEvt, deleteDB) {
      var queue = requestEvt.operation === 'RECEIPT' ? this.receiptQueue : this.queue;
      var index = queue.indexOf(requestEvt);
      if (index !== -1) queue.splice(index, 1);
      if (deleteDB) this.client.dbManager.deleteObjects('syncQueue', [requestEvt]);
    }

    /**
     * Remove requests from queue that depend on specified resource.
     *
     * If there is a POST request to create a new resource, and there are PATCH, DELETE, etc...
     * requests on that resource, if the POST request fails, then all PATCH, DELETE, etc
     * requests must be removed from the queue.
     *
     * Note that we do not call the rollback on these dependent requests because the expected
     * rollback is to destroy the thing that was created, which means any other rollback has no effect.
     *
     * @method _purgeDependentRequests
     * @private
     * @param  {layer.SyncEvent} request - Request whose target is no longer valid
     */

  }, {
    key: '_purgeDependentRequests',
    value: function _purgeDependentRequests(request) {
      this.queue = this.queue.filter(function (evt) {
        return evt.depends.indexOf(request.target) === -1 || evt === request;
      });
      this.receiptQueue = this.receiptQueue.filter(function (evt) {
        return evt.depends.indexOf(request.target) === -1 || evt === request;
      });
    }

    /**
     * Remove from queue all events that operate upon the deleted object.
     *
     * @method _purgeOnDelete
     * @private
     * @param  {layer.SyncEvent} evt - Delete event that requires removal of other events
     */

  }, {
    key: '_purgeOnDelete',
    value: function _purgeOnDelete(evt) {
      var _this9 = this;

      this.queue.filter(function (request) {
        return request.depends.indexOf(evt.target) !== -1 && evt !== request;
      }).forEach(function (requestEvt) {
        _this9.trigger('sync:abort', {
          target: requestEvt.target,
          request: requestEvt
        });
        _this9._removeRequest(requestEvt, true);
      });
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      this.queue.forEach(function (evt) {
        return evt.destroy();
      });
      this.queue = null;
      this.receiptQueue.forEach(function (evt) {
        return evt.destroy();
      });
      this.receiptQueue = null;
      _get(Object.getPrototypeOf(SyncManager.prototype), 'destroy', this).call(this);
    }

    /**
     * Load any unsent requests from indexedDB.
     *
     * If persistence is disabled, nothing will happen;
     * else all requests found in the database will be added to the queue.
     * @method _loadPersistedQueue
     * @private
     */

  }, {
    key: '_loadPersistedQueue',
    value: function _loadPersistedQueue() {
      var _this10 = this;

      this.client.dbManager.loadSyncQueue(function (data) {
        if (data.length) {
          _this10.queue = _this10.queue.concat(data);
          _this10._processNextRequest();
        }
      });
    }
  }]);

  return SyncManager;
}(Root);

/**
 * Websocket Manager for getting socket state.
 * @type {layer.Websockets.SocketManager}
 */


SyncManager.prototype.socketManager = null;

/**
 * Websocket Request Manager for sending requests.
 * @type {layer.Websockets.RequestManager}
 */
SyncManager.prototype.requestManager = null;

/**
 * Reference to the Online State Manager.
 *
 * Sync Manager uses online status to determine if it can fire sync-requests.
 * @private
 * @type {layer.OnlineStateManager}
 */
SyncManager.prototype.onlineManager = null;

/**
 * The array of layer.SyncEvent instances awaiting to be fired.
 * @type {layer.SyncEvent[]}
 */
SyncManager.prototype.queue = null;

/**
 * The array of layer.SyncEvent instances awaiting to be fired.
 *
 * Receipts can generally just be fired off all at once without much fretting about ordering or dependencies.
 * @type {layer.SyncEvent[]}
 */
SyncManager.prototype.receiptQueue = null;

/**
 * Reference to the Client so that we can pass it to SyncEvents  which may need to lookup their targets
 */
SyncManager.prototype.client = null;

/**
 * Maximum exponential backoff wait.
 *
 * If the server is returning 502, 503 or 504 errors, exponential backoff
 * should never wait longer than this number of seconds (15 minutes)
 * @type {Number}
 * @static
 */
SyncManager.MAX_UNAVAILABLE_RETRY_WAIT = 60 * 15;

/**
 * Retries before suspect CORS error.
 *
 * How many times can we transition from offline to online state
 * with this request at the front of the queue before we conclude
 * that the reason we keep thinking we're going offline is
 * a CORS error returning a status of 0.  If that pattern
 * shows 3 times in a row, there is likely a CORS error.
 * Note that CORS errors appear to javascript as a status=0 error,
 * which is the same as if the client were offline.
 * @type {number}
 * @static
 */
SyncManager.MAX_RETRIES_BEFORE_CORS_ERROR = 3;

/**
 * Abort request after this number of retries.
 *
 * @type {number}
 * @static
 */
SyncManager.MAX_RETRIES = 20;

SyncManager._supportedEvents = [
/**
 * A sync request has failed.
 *
 * ```
 * client.syncManager.on('sync:error', function(evt) {
 *    console.error(evt.target.id + ' failed to send changes to server: ', result.data.message);
 *    console.log('Request Event:', requestEvt);
 *    console.log('Server Response:', result.data);
 * });
 * ```
 *
 * @event
 * @param {layer.SyncEvent} evt - The request object
 * @param {Object} result
 * @param {string} result.target - ID of the message/conversation/etc. being operated upon
 * @param {layer.SyncEvent} result.request - The original request
 * @param {Object} result.error - The error object {id, code, message, url}
 */
'sync:error',

/**
 * A sync layer request has completed successfully.
 *
 * ```
 * client.syncManager.on('sync:success', function(evt) {
 *    console.log(evt.target.id + ' changes sent to server successfully');
 *    console.log('Request Event:', requestEvt);
 *    console.log('Server Response:', result.data);
 * });
 * ```
 *
 * @event
 * @param {Object} result
 * @param {string} result.target - ID of the message/conversation/etc. being operated upon
 * @param {layer.SyncEvent} result.request - The original request
 * @param {Object} result.data - null or any data returned by the call
 */
'sync:success',

/**
 * A new sync request has been added.
 *
 * ```
 * client.syncManager.on('sync:add', function(evt) {
 *    console.log(evt.target.id + ' has changes queued for the server');
 *    console.log('Request Event:', requestEvt);
 * });
 * ```
 *
 * @event
 * @param {Object} result
 * @param {string} result.target - ID of the message/conversation/etc. being operated upon
 * @param {layer.SyncEvent} evt - The request object
 */
'sync:add',

/**
 * A sync request has been canceled.
 *
 * Typically caused by a new SyncEvent that deletes the target of this SyncEvent
 *
 * @event
 * @param {layer.SyncEvent} evt - The request object
 * @param {Object} result
 * @param {string} result.target - ID of the message/conversation/etc. being operated upon
 * @param {layer.SyncEvent} result.request - The original request
 */
'sync:abort'].concat(Root._supportedEvents);

Root.initClass(SyncManager);
module.exports = SyncManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zeW5jLW1hbmFnZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFtQkEsSUFBTSxPQUFPLFFBQVEsUUFBUixDQUFiOztlQUMrQixRQUFRLGNBQVIsQzs7SUFBdkIsa0IsWUFBQSxrQjs7QUFDUixJQUFNLE1BQU0sUUFBUSxPQUFSLENBQVo7QUFDQSxJQUFNLFNBQVMsUUFBUSxVQUFSLENBQWY7QUFDQSxJQUFNLFFBQVEsUUFBUSxnQkFBUixDQUFkOztBQUVBLElBQU0sMEJBQTBCLENBQWhDOztJQUVNLFc7OztBQUNKOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQTBCQSx1QkFBWSxPQUFaLEVBQXFCO0FBQUE7O0FBQUEsK0ZBQ2IsT0FEYTs7QUFFbkIsVUFBSyxNQUFMLEdBQWMsUUFBUSxNQUF0Qjs7QUFFQTtBQUNBLFFBQUksTUFBSyxNQUFULEVBQWlCO0FBQ2YsWUFBSyxNQUFMLENBQVksRUFBWixDQUFlLE9BQWYsRUFBd0IsWUFBTTtBQUM1QixjQUFLLG1CQUFMO0FBQ0EsY0FBSyxtQkFBTDtBQUNELE9BSEQ7QUFJRDtBQUNELFVBQUssS0FBTCxHQUFhLEVBQWI7QUFDQSxVQUFLLFlBQUwsR0FBb0IsRUFBcEI7O0FBRUEsVUFBSyxhQUFMLENBQW1CLEVBQW5CLENBQXNCLGNBQXRCLEVBQXNDLE1BQUssa0JBQTNDO0FBQ0EsVUFBSyxhQUFMLENBQW1CLEVBQW5CLENBQXNCLHdCQUF0QixFQUFnRCxNQUFLLGtCQUFyRDtBQWZtQjtBQWdCcEI7O0FBRUQ7Ozs7Ozs7Ozs7OzsrQkFRVztBQUNULGFBQU8sS0FBSyxhQUFMLENBQW1CLFFBQTFCO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7O3VDQVdtQixHLEVBQUs7QUFBQTs7QUFDdEIsVUFBSSxJQUFJLFNBQUosS0FBa0IsV0FBdEIsRUFBbUM7QUFDakMsWUFBSSxLQUFLLEtBQUwsQ0FBVyxNQUFmLEVBQXVCLEtBQUssS0FB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QXRDNkI7O0FBd0M3Qjs7Ozs7Ozs7Ozs7Ozs7O0FBZUEsVUF2RDZCOztBQXlEN0I7Ozs7Ozs7Ozs7O0FBV0EsWUFwRTZCLEVBcUU3QixNQXJFNkIsQ0FxRXRCLEtBQUssZ0JBckVpQixDQUEvQjs7QUF1RUEsS0FBSyxTQUFMLENBQWUsV0FBZjtBQUNBLE9BQU8sT0FBUCxHQUFpQixXQUFqQiIsImZpbGUiOiJzeW5jLW1hbmFnZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBjbGFzcyAgbGF5ZXIuU3luY01hbmFnZXJcbiAqIEBleHRlbmRzIGxheWVyLlJvb3RcbiAqIEBwcm90ZWN0ZWRcbiAqXG4gKiBUaGlzIGNsYXNzIG1hbmFnZXNcbiAqXG4gKiAxLiBhIHF1ZXVlIG9mIHJlcXVlc3RzIHRoYXQgbmVlZCB0byBiZSBtYWRlXG4gKiAyLiB3aGVuIGEgcmVxdWVzdCBzaG91bGQgYmUgZmlyZWQsIGJhc2VkIG9uIGF1dGhlbnRpY2F0aW9uIHN0YXRlLCBvbmxpbmUgc3RhdGUsIHdlYnNvY2tldCBjb25uZWN0aW9uIHN0YXRlLCBhbmQgcG9zaXRpb24gaW4gdGhlIHF1ZXVlXG4gKiAzLiB3aGVuIGEgcmVxdWVzdCBzaG91bGQgYmUgYWJvcnRlZFxuICogNC4gdHJpZ2dlcmluZyBhbnkgcmVxdWVzdCBjYWxsYmFja3NcbiAqXG4gKiBUT0RPOiBJbiB0aGUgZXZlbnQgb2YgYSBETlMgZXJyb3IsIHdlIG1heSBoYXZlIGEgdmFsaWQgd2Vic29ja2V0IHJlY2VpdmluZyBldmVudHMgYW5kIHRlbGxpbmcgdXMgd2UgYXJlIG9ubGluZSxcbiAqIGFuZCBiZSB1bmFibGUgdG8gY3JlYXRlIGEgUkVTVCBjYWxsLiAgVGhpcyB3aWxsIGJlIGhhbmRsZWQgd3JvbmcgYmVjYXVzZSBldmlkZW5jZSB3aWxsIHN1Z2dlc3QgdGhhdCB3ZSBhcmUgb25saW5lLlxuICogVGhpcyBpc3N1ZSBnb2VzIGF3YXkgd2hlbiB3ZSB1c2UgYmlkaXJlY3Rpb25hbCB3ZWJzb2NrZXRzIGZvciBhbGwgcmVxdWVzdHMuXG4gKlxuICogQXBwbGljYXRpb25zIGRvIG5vdCB0eXBpY2FsbHkgaW50ZXJhY3Qgd2l0aCB0aGlzIGNsYXNzLCBidXQgbWF5IHN1YnNjcmliZSB0byBpdHMgZXZlbnRzXG4gKiB0byBnZXQgcmljaGVyIGRldGFpbGVkIGluZm9ybWF0aW9uIHRoYW4gaXMgYXZhaWxhYmxlIGZyb20gdGhlIGxheWVyLkNsaWVudCBpbnN0YW5jZS5cbiAqL1xuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4vcm9vdCcpO1xuY29uc3QgeyBXZWJzb2NrZXRTeW5jRXZlbnQgfSA9IHJlcXVpcmUoJy4vc3luYy1ldmVudCcpO1xuY29uc3QgeGhyID0gcmVxdWlyZSgnLi94aHInKTtcbmNvbnN0IGxvZ2dlciA9IHJlcXVpcmUoJy4vbG9nZ2VyJyk7XG5jb25zdCBVdGlscyA9IHJlcXVpcmUoJy4vY2xpZW50LXV0aWxzJyk7XG5cbmNvbnN0IE1BWF9SRUNFSVBUX0NPTk5FQ1RJT05TID0gNDtcblxuY2xhc3MgU3luY01hbmFnZXIgZXh0ZW5kcyBSb290IHtcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgU3luY01hbmFnZXIuXG4gICAqXG4gICAqIEFuIEFwcGxpY2F0aW9uIGlzIGV4cGVjdGVkIHRvIG9ubHkgaGF2ZSBvbmUgU3luY01hbmFnZXIuXG4gICAqXG4gICAqICAgICAgdmFyIHNvY2tldE1hbmFnZXIgPSBuZXcgbGF5ZXIuV2Vic29ja2V0cy5Tb2NrZXRNYW5hZ2VyKHtjbGllbnQ6IGNsaWVudH0pO1xuICAgKiAgICAgIHZhciByZXF1ZXN0TWFuYWdlciA9IG5ldyBsYXllci5XZWJzb2NrZXRzLlJlcXVlc3RNYW5hZ2VyKHtjbGllbnQ6IGNsaWVudCwgc29ja2V0TWFuYWdlcjogc29ja2V0TWFuYWdlcn0pO1xuICAgKlxuICAgKiAgICAgIHZhciBvbmxpbmVNYW5hZ2VyID0gbmV3IGxheWVyLk9ubGluZU1hbmFnZXIoe1xuICAgKiAgICAgICAgICBzb2NrZXRNYW5hZ2VyOiBzb2NrZXRNYW5hZ2VyXG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqICAgICAgLy8gTm93IHdlIGNhbiBpbnN0YW50aWF0ZSB0aGlzIHRoaW5nLi4uXG4gICAqICAgICAgdmFyIFN5bmNNYW5hZ2VyID0gbmV3IGxheWVyLlN5bmNNYW5hZ2VyKHtcbiAgICogICAgICAgICAgY2xpZW50OiBjbGllbnQsXG4gICAqICAgICAgICAgIG9ubGluZU1hbmFnZXI6IG9ubGluZU1hbmFnZXIsXG4gICAqICAgICAgICAgIHNvY2tldE1hbmFnZXI6IHNvY2tldE1hbmFnZXIsXG4gICAqICAgICAgICAgIHJlcXVlc3RNYW5hZ2VyOiByZXF1ZXN0TWFuYWdlclxuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBAbWV0aG9kIGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0ge2xheWVyLk9ubGluZVN0YXRlTWFuYWdlcn0gb3B0aW9ucy5vbmxpbmVNYW5hZ2VyXG4gICAqIEBwYXJhbSB7bGF5ZXIuV2Vic29ja2V0cy5SZXF1ZXN0TWFuYWdlcn0gb3B0aW9ucy5yZXF1ZXN0TWFuYWdlclxuICAgKiBAcGFyYW0ge2xheWVyLkNsaWVudH0gb3B0aW9ucy5jbGllbnRcbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLmNsaWVudCA9IG9wdGlvbnMuY2xpZW50O1xuXG4gICAgLy8gTm90ZSB3ZSBkbyBub3Qgc3RvcmUgYSBwb2ludGVyIHRvIGNsaWVudC4uLiBpdCBpcyBub3QgbmVlZGVkLlxuICAgIGlmICh0aGlzLmNsaWVudCkge1xuICAgICAgdGhpcy5jbGllbnQub24oJ3JlYWR5JywgKCkgPT4ge1xuICAgICAgICB0aGlzLl9wcm9jZXNzTmV4dFJlcXVlc3QoKTtcbiAgICAgICAgdGhpcy5fbG9hZFBlcnNpc3RlZFF1ZXVlKCk7XG4gICAgICB9LCB0aGlzKTtcbiAgICB9XG4gICAgdGhpcy5xdWV1ZSA9IFtdO1xuICAgIHRoaXMucmVjZWlwdFF1ZXVlID0gW107XG5cbiAgICB0aGlzLm9ubGluZU1hbmFnZXIub24oJ2Rpc2Nvbm5lY3RlZCcsIHRoaXMuX29ubGluZVN0YXRlQ2hhbmdlLCB0aGlzKTtcbiAgICB0aGlzLnNvY2tldE1hbmFnZXIub24oJ2Nvbm5lY3RlZCBkaXNjb25uZWN0ZWQnLCB0aGlzLl9vbmxpbmVTdGF0ZUNoYW5nZSwgdGhpcyk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB3aGV0aGVyIHRoZSBDbGllbnQgaXMgb25saW5lL29mZmxpbmUuXG4gICAqXG4gICAqIEZvciBpbnRlcm5hbCB1c2U7IGFwcGxpY2F0aW9ucyBzaG91bGQgdXNlIGxheWVyLkNsaWVudC5pc09ubGluZS5cbiAgICpcbiAgICogQG1ldGhvZCBpc09ubGluZVxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICovXG4gIGlzT25saW5lKCkge1xuICAgIHJldHVybiB0aGlzLm9ubGluZU1hbmFnZXIuaXNPbmxpbmU7XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyBzeW5jIHJlcXVlc3Qgd2hlbiBjb25uZWN0aW9uIGlzIHJlc3RvcmVkLlxuICAgKlxuICAgKiBBbnkgdGltZSB3ZSBnbyBiYWNrIG9ubGluZSAoYXMgc2lnbmFsZWQgYnkgdGhlIG9ubGluZVN0YXRlTWFuYWdlciksXG4gICAqIFByb2Nlc3MgdGhlIG5leHQgU3luYyBFdmVudCAod2lsbCBkbyBub3RoaW5nIGlmIG9uZSBpcyBhbHJlYWR5IGZpcmluZylcbiAgICpcbiAgICogQG1ldGhvZCBfb25saW5lU3RhdGVDaGFuZ2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7c3RyaW5nfSBldnROYW1lIC0gJ2Nvbm5lY3RlZCcgb3IgJ2Rpc2Nvbm5lY3RlZCdcbiAgICogQHBhcmFtICB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICBfb25saW5lU3RhdGVDaGFuZ2UoZXZ0KSB7XG4gICAgaWYgKGV2dC5ldmVudE5hbWUgPT09ICdjb25uZWN0ZWQnKSB7XG4gICAgICBpZiAodGhpcy5xdWV1ZS5sZW5ndGgpIHRoaXMucXVldWVbMF0ucmV0dXJuVG9PbmxpbmVDb3VudCsrO1xuICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLl9wcm9jZXNzTmV4dFJlcXVlc3QoKSwgMTAwKTtcbiAgICB9IGVsc2UgaWYgKGV2dC5ldmVudE5hbWUgPT09ICdkaXNjb25uZWN0ZWQnKSB7XG4gICAgICBpZiAodGhpcy5xdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5xdWV1ZVswXS5pc0ZpcmluZyA9IGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMucmVjZWlwdFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICB0aGlzLnJlY2VpcHRRdWV1ZS5mb3JFYWNoKHN5bmNFdnQgPT4geyBzeW5jRXZ0LmlzRmlyaW5nID0gZmFsc2U7IH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgbmV3IHhociByZXF1ZXN0IHRvIHRoZSBxdWV1ZS5cbiAgICpcbiAgICogSWYgdGhlIHF1ZXVlIGlzIGVtcHR5LCB0aGlzIHdpbGwgYmUgZmlyZWQgaW1tZWRpYXRlbHk7IGVsc2UgaXQgd2lsbCBiZSBhZGRlZCB0byB0aGUgcXVldWUgYW5kIHdhaXQgaXRzIHR1cm4uXG4gICAqXG4gICAqIElmIGl0cyBhIHJlYWQvZGVsaXZlcnkgcmVjZWlwdCByZXF1ZXN0LCBpdCB3aWxsIHR5cGljYWxseSBiZSBmaXJlZCBpbW1lZGlhdGVseSB1bmxlc3MgdGhlcmUgYXJlIG1hbnkgcmVjZWlwdFxuICAgKiByZXF1ZXN0cyBhbHJlYWR5IGluLWZsaWdodC5cbiAgICpcbiAgICogQG1ldGhvZCByZXF1ZXN0XG4gICAqIEBwYXJhbSAge2xheWVyLlN5bmNFdmVudH0gcmVxdWVzdEV2dCAtIEEgU3luY0V2ZW50IHNwZWNpZnlpbmcgdGhlIHJlcXVlc3QgdG8gYmUgbWFkZVxuICAgKi9cbiAgcmVxdWVzdChyZXF1ZXN0RXZ0KSB7XG4gICAgLy8gSWYgaXRzIGEgUEFUQ0ggcmVxdWVzdCBvbiBhbiBvYmplY3QgdGhhdCBpc24ndCB5ZXQgY3JlYXRlZCxcbiAgICAvLyBkbyBub3QgYWRkIGl0IHRvIHRoZSBxdWV1ZS5cbiAgICBpZiAocmVxdWVzdEV2dC5vcGVyYXRpb24gIT09ICdQQVRDSCcgfHwgIXRoaXMuX2ZpbmRVbmZpcmVkQ3JlYXRlKHJlcXVlc3RFdnQpKSB7XG4gICAgICBsb2dnZXIuaW5mbyhgU3luYyBNYW5hZ2VyIFJlcXVlc3QgJHtyZXF1ZXN0RXZ0Lm9wZXJhdGlvbn0gb24gdGFyZ2V0ICR7cmVxdWVzdEV2dC50YXJnZXR9YCwgcmVxdWVzdEV2dC50b09iamVjdCgpKTtcbiAgICAgIGlmIChyZXF1ZXN0RXZ0Lm9wZXJhdGlvbiA9PT0gJ1JFQ0VJUFQnKSB7XG4gICAgICAgIHRoaXMucmVjZWlwdFF1ZXVlLnB1c2gocmVxdWVzdEV2dCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnF1ZXVlLnB1c2gocmVxdWVzdEV2dCk7XG4gICAgICB9XG4gICAgICB0aGlzLnRyaWdnZXIoJ3N5bmM6YWRkJywge1xuICAgICAgICByZXF1ZXN0OiByZXF1ZXN0RXZ0LFxuICAgICAgICB0YXJnZXQ6IHJlcXVlc3RFdnQudGFyZ2V0LFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci5pbmZvKGBTeW5jIE1hbmFnZXIgUmVxdWVzdCBQQVRDSCAke3JlcXVlc3RFdnQudGFyZ2V0fSByZXF1ZXN0IGlnbm9yZWQ7IGNyZWF0ZSByZXF1ZXN0IHN0aWxsIGVucXVldWVkYCwgcmVxdWVzdEV2dC50b09iamVjdCgpKTtcbiAgICB9XG5cbiAgICAvLyBJZiBpdHMgYSBERUxFVEUgcmVxdWVzdCwgcHVyZ2UgYWxsIG90aGVyIHJlcXVlc3RzIG9uIHRoYXQgdGFyZ2V0LlxuICAgIGlmIChyZXF1ZXN0RXZ0Lm9wZXJhdGlvbiA9PT0gJ0RFTEVURScpIHtcbiAgICAgIHRoaXMuX3B1cmdlT25EZWxldGUocmVxdWVzdEV2dCk7XG4gICAgfVxuXG4gICAgdGhpcy5fcHJvY2Vzc05leHRSZXF1ZXN0KHJlcXVlc3RFdnQpO1xuICB9XG5cbiAgX3Byb2Nlc3NOZXh0UmVxdWVzdChyZXF1ZXN0RXZ0KSB7XG4gICAgLy8gRmlyZSB0aGUgcmVxdWVzdCBpZiB0aGVyZSBhcmVuJ3QgYW55IGV4aXN0aW5nIHJlcXVlc3RzIGFscmVhZHkgZmlyaW5nXG4gICAgaWYgKHRoaXMucXVldWUubGVuZ3RoICYmICF0aGlzLnF1ZXVlWzBdLmlzRmlyaW5nKSB7XG4gICAgICBpZiAocmVxdWVzdEV2dCkge1xuICAgICAgICB0aGlzLmNsaWVudC5kYk1hbmFnZXIud3JpdGVTeW5jRXZlbnRzKFtyZXF1ZXN0RXZ0XSwgKCkgPT4gdGhpcy5fcHJvY2Vzc05leHRTdGFuZGFyZFJlcXVlc3QoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9wcm9jZXNzTmV4dFN0YW5kYXJkUmVxdWVzdCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElmIHdlIGhhdmUgYW55dGhpbmcgaW4gdGhlIHJlY2VpcHRzIHF1ZXVlLCBmaXJlIGl0XG4gICAgaWYgKHRoaXMucmVjZWlwdFF1ZXVlLmxlbmd0aCkge1xuICAgICAgdGhpcy5fcHJvY2Vzc05leHRSZWNlaXB0UmVxdWVzdCgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kIGNyZWF0ZSByZXF1ZXN0IGZvciB0aGlzIHJlc291cmNlLlxuICAgKlxuICAgKiBEZXRlcm1pbmUgaWYgdGhlIGdpdmVuIHRhcmdldCBoYXMgYSBQT1NUIHJlcXVlc3Qgd2FpdGluZyB0byBjcmVhdGVcbiAgICogdGhlIHJlc291cmNlLCBhbmQgcmV0dXJuIGFueSBtYXRjaGluZyByZXF1ZXN0cy4gVXNlZFxuICAgKiBmb3IgZm9sZGluZyBQQVRDSCByZXF1ZXN0cyBpbnRvIGFuIHVuZmlyZWQgQ1JFQVRFL1BPU1QgcmVxdWVzdC5cbiAgICpcbiAgICogQG1ldGhvZCBfZmluZFVuZmlyZWRDcmVhdGVcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bGF5ZXIuU3luY0V2ZW50fSByZXF1ZXN0RXZ0XG4gICAqIEByZXR1cm4ge0Jvb2xlYW59XG4gICAqL1xuICBfZmluZFVuZmlyZWRDcmVhdGUocmVxdWVzdEV2dCkge1xuICAgIHJldHVybiBCb29sZWFuKHRoaXMucXVldWUuZmlsdGVyKGV2dCA9PlxuICAgICAgZXZ0LnRhcmdldCA9PT0gcmVxdWVzdEV2dC50YXJnZXQgJiYgZXZ0Lm9wZXJhdGlvbiA9PT0gJ1BPU1QnICYmICFldnQuaXNGaXJpbmcpLmxlbmd0aFxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyB0aGUgbmV4dCByZXF1ZXN0IGluIHRoZSBxdWV1ZS5cbiAgICpcbiAgICogUmVxdWVzdCBpcyBkZXF1ZXVlZCBvbiBjb21wbGV0aW5nIHRoZSBwcm9jZXNzLlxuICAgKiBJZiB0aGUgZmlyc3QgcmVxdWVzdCBpbiB0aGUgcXVldWUgaXMgZmlyaW5nLCBkbyBub3RoaW5nLlxuICAgKlxuICAgKiBAbWV0aG9kIF9wcm9jZXNzTmV4dFJlcXVlc3RcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9wcm9jZXNzTmV4dFN0YW5kYXJkUmVxdWVzdCgpIHtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCB8fCAhdGhpcy5jbGllbnQuaXNBdXRoZW50aWNhdGVkKSByZXR1cm47XG4gICAgY29uc3QgcmVxdWVzdEV2dCA9IHRoaXMucXVldWVbMF07XG4gICAgaWYgKHRoaXMuaXNPbmxpbmUoKSAmJiByZXF1ZXN0RXZ0ICYmICFyZXF1ZXN0RXZ0LmlzRmlyaW5nICYmICFyZXF1ZXN0RXZ0Ll9pc1ZhbGlkYXRpbmcpIHtcbiAgICAgIHJlcXVlc3RFdnQuX2lzVmFsaWRhdGluZyA9IHRydWU7XG4gICAgICB0aGlzLl92YWxpZGF0ZVJlcXVlc3QocmVxdWVzdEV2dCwgKGlzVmFsaWQpID0+IHtcbiAgICAgICAgcmVxdWVzdEV2dC5faXNWYWxpZGF0aW5nID0gZmFsc2U7XG4gICAgICAgIGlmICghaXNWYWxpZCkge1xuICAgICAgICAgIHRoaXMuX3JlbW92ZVJlcXVlc3QocmVxdWVzdEV2dCwgZmFsc2UpO1xuICAgICAgICAgIHJldHVybiB0aGlzLl9wcm9jZXNzTmV4dFN0YW5kYXJkUmVxdWVzdCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuX2ZpcmVSZXF1ZXN0KHJlcXVlc3RFdnQpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyB1cCB0byBNQVhfUkVDRUlQVF9DT05ORUNUSU9OUyB3b3J0aCBvZiByZWNlaXB0cy5cbiAgICpcbiAgICogVGhlc2UgcmVxdWVzdHMgaGF2ZSBubyBpbnRlcmRlcGVuZGVuY2llcy4gSnVzdCBmaXJlIHRoZW0gYWxsXG4gICAqIGFzIGZhc3QgYXMgd2UgY2FuLCBpbiBwYXJhbGxlbC5cbiAgICpcbiAgICogQG1ldGhvZCBfcHJvY2Vzc05leHRSZWNlaXB0UmVxdWVzdFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3Byb2Nlc3NOZXh0UmVjZWlwdFJlcXVlc3QoKSB7XG4gICAgbGV0IGZpcmluZ1JlY2VpcHRzID0gMDtcbiAgICB0aGlzLnJlY2VpcHRRdWV1ZS5mb3JFYWNoKChyZWNlaXB0RXZ0KSA9PiB7XG4gICAgICBpZiAodGhpcy5pc09ubGluZSgpICYmIHJlY2VpcHRFdnQpIHtcbiAgICAgICAgaWYgKHJlY2VpcHRFdnQuaXNGaXJpbmcgfHwgcmVjZWlwdEV2dC5faXNWYWxpZGF0aW5nKSB7XG4gICAgICAgICAgZmlyaW5nUmVjZWlwdHMrKztcbiAgICAgICAgfSBlbHNlIGlmIChmaXJpbmdSZWNlaXB0cyA8IE1BWF9SRUNFSVBUX0NPTk5FQ1RJT05TKSB7XG4gICAgICAgICAgZmlyaW5nUmVjZWlwdHMrKztcbiAgICAgICAgICByZWNlaXB0RXZ0Ll9pc1ZhbGlkYXRpbmcgPSB0cnVlO1xuICAgICAgICAgIHRoaXMuX3ZhbGlkYXRlUmVxdWVzdChyZWNlaXB0RXZ0LCAoaXNWYWxpZCkgPT4ge1xuICAgICAgICAgICAgcmVjZWlwdEV2dC5faXNWYWxpZGF0aW5nID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAoIWlzVmFsaWQpIHtcbiAgICAgICAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLnJlY2VpcHRRdWV1ZS5pbmRleE9mKHJlY2VpcHRFdnQpO1xuICAgICAgICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB0aGlzLnJlY2VpcHRRdWV1ZS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhpcy5fZmlyZVJlcXVlc3QocmVjZWlwdEV2dCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEaXJlY3RseSBmaXJlIHRoaXMgc3luYyByZXF1ZXN0LlxuICAgKlxuICAgKiBUaGlzIGlzIGludGVuZGVkIHRvIGJlIGNhbGxlZCBvbmx5IGFmdGVyIGNhcmVmdWwgYW5hbHlzaXMgb2Ygb3VyIHN0YXRlIHRvIG1ha2Ugc3VyZSBpdHMgc2FmZSB0byBzZW5kIHRoZSByZXF1ZXN0LlxuICAgKiBTZWUgYF9wcm9jZXNzTmV4dFJlcXVlc3QoKWBcbiAgICpcbiAgICogQG1ldGhvZCBfZmlyZVJlcXVlc3RcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnR9IHJlcXVlc3RFdnRcbiAgICovXG4gIF9maXJlUmVxdWVzdChyZXF1ZXN0RXZ0KSB7XG4gICAgaWYgKHJlcXVlc3RFdnQgaW5zdGFuY2VvZiBXZWJzb2NrZXRTeW5jRXZlbnQpIHtcbiAgICAgIHRoaXMuX2ZpcmVSZXF1ZXN0V2Vic29ja2V0KHJlcXVlc3RFdnQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9maXJlUmVxdWVzdFhIUihyZXF1ZXN0RXZ0KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGlyZWN0bHkgZmlyZSB0aGlzIFhIUiBTeW5jIHJlcXVlc3QuXG4gICAqXG4gICAqIEBtZXRob2QgX2ZpcmVSZXF1ZXN0WEhSXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7bGF5ZXIuU3luY0V2ZW50LlhIUlN5bmNFdmVudH0gcmVxdWVzdEV2dFxuICAgKi9cbiAgX2ZpcmVSZXF1ZXN0WEhSKHJlcXVlc3RFdnQpIHtcbiAgICByZXF1ZXN0RXZ0LmlzRmlyaW5nID0gdHJ1ZTtcbiAgICBpZiAoIXJlcXVlc3RFdnQuaGVhZGVycykgcmVxdWVzdEV2dC5oZWFkZXJzID0ge307XG4gICAgcmVxdWVzdEV2dC5oZWFkZXJzLmF1dGhvcml6YXRpb24gPSAnTGF5ZXIgc2Vzc2lvbi10b2tlbj1cIicgKyB0aGlzLmNsaWVudC5zZXNzaW9uVG9rZW4gKyAnXCInO1xuICAgIGxvZ2dlci5kZWJ1ZyhgU3luYyBNYW5hZ2VyIFhIUiBSZXF1ZXN0IEZpcmluZyAke3JlcXVlc3RFdnQub3BlcmF0aW9ufSAke3JlcXVlc3RFdnQudGFyZ2V0fWAsXG4gICAgICByZXF1ZXN0RXZ0LnRvT2JqZWN0KCkpO1xuICAgIHhocihyZXF1ZXN0RXZ0Ll9nZXRSZXF1ZXN0RGF0YSh0aGlzLmNsaWVudCksIHJlc3VsdCA9PiB0aGlzLl94aHJSZXN1bHQocmVzdWx0LCByZXF1ZXN0RXZ0KSk7XG4gIH1cblxuICAvKipcbiAgICogRGlyZWN0bHkgZmlyZSB0aGlzIFdlYnNvY2tldCBTeW5jIHJlcXVlc3QuXG4gICAqXG4gICAqIEBtZXRob2QgX2ZpcmVSZXF1ZXN0V2Vic29ja2V0XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7bGF5ZXIuU3luY0V2ZW50LldlYnNvY2tldFN5bmNFdmVudH0gcmVxdWVzdEV2dFxuICAgKi9cbiAgX2ZpcmVSZXF1ZXN0V2Vic29ja2V0KHJlcXVlc3RFdnQpIHtcbiAgICBpZiAodGhpcy5zb2NrZXRNYW5hZ2VyICYmIHRoaXMuc29ja2V0TWFuYWdlci5faXNPcGVuKCkpIHtcbiAgICAgIGxvZ2dlci5kZWJ1ZyhgU3luYyBNYW5hZ2VyIFdlYnNvY2tldCBSZXF1ZXN0IEZpcmluZyAke3JlcXVlc3RFdnQub3BlcmF0aW9ufSBvbiB0YXJnZXQgJHtyZXF1ZXN0RXZ0LnRhcmdldH1gLFxuICAgICAgICByZXF1ZXN0RXZ0LnRvT2JqZWN0KCkpO1xuICAgICAgcmVxdWVzdEV2dC5pc0ZpcmluZyA9IHRydWU7XG4gICAgICB0aGlzLnJlcXVlc3RNYW5hZ2VyLnNlbmRSZXF1ZXN0KHJlcXVlc3RFdnQuX2dldFJlcXVlc3REYXRhKHRoaXMuY2xpZW50KSxcbiAgICAgICAgICByZXN1bHQgPT4gdGhpcy5feGhyUmVzdWx0KHJlc3VsdCwgcmVxdWVzdEV2dCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIuZGVidWcoJ1N5bmMgTWFuYWdlciBXZWJzb2NrZXQgUmVxdWVzdCBza2lwcGVkOyBzb2NrZXQgY2xvc2VkJyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIElzIHRoZSBzeW5jRXZlbnQgc3RpbGwgdmFsaWQ/XG4gICAqXG4gICAqIFRoaXMgbWV0aG9kIHNwZWNpZmljYWxseSB0ZXN0cyB0byBzZWUgaWYgc29tZSBvdGhlciB0YWIgaGFzIGFscmVhZHkgc2VudCB0aGlzIHJlcXVlc3QuXG4gICAqIElmIHBlcnNpc3RlbmNlIG9mIHRoZSBzeW5jUXVldWUgaXMgbm90IGVuYWJsZWQsIHRoZW4gdGhlIGNhbGxiYWNrIGlzIGltbWVkaWF0ZWx5IGNhbGxlZCB3aXRoIHRydWUuXG4gICAqIElmIGFub3RoZXIgdGFiIGhhcyBhbHJlYWR5IHNlbnQgdGhlIHJlcXVlc3QsIHRoZW4gdGhlIGVudHJ5IHdpbGwgbm8gbG9uZ2VyIGJlIGluIGluZGV4ZWREQiBhbmQgdGhlIGNhbGxiYWNrXG4gICAqIHdpbGwgY2FsbCBmYWxzZS5cbiAgICpcbiAgICogQG1ldGhvZCBfdmFsaWRhdGVSZXF1ZXN0XG4gICAqIEBwYXJhbSB7bGF5ZXIuU3luY0V2ZW50fSBzeW5jRXZlbnRcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2suaXNWYWxpZCAtIFRoZSByZXF1ZXN0IGlzIHN0aWxsIHZhbGlkXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfdmFsaWRhdGVSZXF1ZXN0KHN5bmNFdmVudCwgY2FsbGJhY2spIHtcbiAgICB0aGlzLmNsaWVudC5kYk1hbmFnZXIuY2xhaW1TeW5jRXZlbnQoc3luY0V2ZW50LCBpc0ZvdW5kID0+IGNhbGxiYWNrKGlzRm91bmQpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUdXJuIGRlZHVwbGljYXRpb24gZXJyb3JzIGludG8gc3VjY2VzcyBtZXNzYWdlcy5cbiAgICpcbiAgICogSWYgdGhpcyByZXF1ZXN0IGhhcyBhbHJlYWR5IGJlZW4gbWFkZSBidXQgd2UgZmFpbGVkIHRvIGdldCBhIHJlc3BvbnNlIHRoZSBmaXJzdCB0aW1lIGFuZCB3ZSByZXRyaWVkIHRoZSByZXF1ZXN0LFxuICAgKiB3ZSB3aWxsIHJlaXNzdWUgdGhlIHJlcXVlc3QuICBJZiB0aGUgcHJpb3IgcmVxdWVzdCB3YXMgc3VjY2Vzc2Z1bCB3ZSdsbCBnZXQgYmFjayBhIGRlZHVwbGljYXRpb24gZXJyb3JcbiAgICogd2l0aCB0aGUgY3JlYXRlZCBvYmplY3QuIEFzIGZhciBhcyB0aGUgV2ViU0RLIGlzIGNvbmNlcm5lZCwgdGhpcyBpcyBhIHN1Y2Nlc3MuXG4gICAqXG4gICAqIEBtZXRob2QgX2hhbmRsZURlZHVwbGljYXRpb25FcnJvcnNcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9oYW5kbGVEZWR1cGxpY2F0aW9uRXJyb3JzKHJlc3VsdCkge1xuICAgIGlmIChyZXN1bHQuZGF0YSAmJiByZXN1bHQuZGF0YS5pZCA9PT0gJ2lkX2luX3VzZScgJiZcbiAgICAgICAgcmVzdWx0LmRhdGEuZGF0YSAmJiByZXN1bHQuZGF0YS5kYXRhLmlkID09PSByZXN1bHQucmVxdWVzdC5fZ2V0Q3JlYXRlSWQoKSkge1xuICAgICAgcmVzdWx0LnN1Y2Nlc3MgPSB0cnVlO1xuICAgICAgcmVzdWx0LmRhdGEgPSByZXN1bHQuZGF0YS5kYXRhO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIHRoZSByZXN1bHQgb2YgYW4geGhyIGNhbGwsIHJvdXRpbmcgaXQgdG8gdGhlIGFwcHJvcHJpYXRlIGhhbmRsZXIuXG4gICAqXG4gICAqIEBtZXRob2QgX3hoclJlc3VsdFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IHJlc3VsdCAgLSBSZXNwb25zZSBvYmplY3QgcmV0dXJuZWQgYnkgeGhyIGNhbGxcbiAgICogQHBhcmFtICB7bGF5ZXIuU3luY0V2ZW50fSByZXF1ZXN0RXZ0IC0gUmVxdWVzdCBvYmplY3RcbiAgICovXG4gIF94aHJSZXN1bHQocmVzdWx0LCByZXF1ZXN0RXZ0KSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHJldHVybjtcbiAgICByZXN1bHQucmVxdWVzdCA9IHJlcXVlc3RFdnQ7XG4gICAgcmVxdWVzdEV2dC5pc0ZpcmluZyA9IGZhbHNlO1xuICAgIHRoaXMuX2hhbmRsZURlZHVwbGljYXRpb25FcnJvcnMocmVzdWx0KTtcbiAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICB0aGlzLl94aHJFcnJvcihyZXN1bHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl94aHJTdWNjZXNzKHJlc3VsdCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhdGVnb3JpemUgdGhlIGVycm9yIGZvciBoYW5kbGluZy5cbiAgICpcbiAgICogQG1ldGhvZCBfZ2V0RXJyb3JTdGF0ZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IHJlc3VsdCAgLSBSZXNwb25zZSBvYmplY3QgcmV0dXJuZWQgYnkgeGhyIGNhbGxcbiAgICogQHBhcmFtICB7bGF5ZXIuU3luY0V2ZW50fSByZXF1ZXN0RXZ0IC0gUmVxdWVzdCBvYmplY3RcbiAgICogQHBhcmFtICB7Ym9vbGVhbn0gaXNPbmxpbmUgLSBJcyBvdXIgYXBwIHN0YXRlIHNldCB0byBvbmxpbmVcbiAgICogQHJldHVybnMge1N0cmluZ31cbiAgICovXG4gIF9nZXRFcnJvclN0YXRlKHJlc3VsdCwgcmVxdWVzdEV2dCwgaXNPbmxpbmUpIHtcbiAgICBjb25zdCBlcnJJZCA9IHJlc3VsdC5kYXRhID8gcmVzdWx0LmRhdGEuaWQgOiAnJztcbiAgICBpZiAoIWlzT25saW5lKSB7XG4gICAgICAvLyBDT1JTIGVycm9ycyBsb29rIGlkZW50aWNhbCB0byBvZmZsaW5lOyBidXQgaWYgb3VyIG9ubGluZSBzdGF0ZSBoYXMgdHJhbnNpdGlvbmVkIGZyb20gZmFsc2UgdG8gdHJ1ZSByZXBlYXRlZGx5IHdoaWxlIHByb2Nlc3NpbmcgdGhpcyByZXF1ZXN0LFxuICAgICAgLy8gdGhhdHMgYSBoaW50IHRoYXQgdGhhdCBpdHMgYSBDT1JTIGVycm9yXG4gICAgICBpZiAocmVxdWVzdEV2dC5yZXR1cm5Ub09ubGluZUNvdW50ID49IFN5bmNNYW5hZ2VyLk1BWF9SRVRSSUVTX0JFRk9SRV9DT1JTX0VSUk9SKSB7XG4gICAgICAgIHJldHVybiAnQ09SUyc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gJ29mZmxpbmUnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXJySWQgPT09ICdub3RfZm91bmQnKSB7XG4gICAgICByZXR1cm4gJ25vdEZvdW5kJztcbiAgICB9IGVsc2UgaWYgKGVycklkID09PSAnaWRfaW5fdXNlJykge1xuICAgICAgcmV0dXJuICdpbnZhbGlkSWQnOyAvLyBUaGlzIG9ubHkgZmlyZXMgaWYgd2UgZ2V0IGBpZF9pbl91c2VgIGJ1dCBubyBSZXNvdXJjZSwgd2hpY2ggbWVhbnMgdGhlIFVVSUQgd2FzIHVzZWQgYnkgYW5vdGhlciB1c2VyL2FwcC5cbiAgICB9IGVsc2UgaWYgKHJlc3VsdC5zdGF0dXMgPT09IDQwOCB8fCBlcnJJZCA9PT0gJ3JlcXVlc3RfdGltZW91dCcpIHtcbiAgICAgIGlmIChyZXF1ZXN0RXZ0LnJldHJ5Q291bnQgPj0gU3luY01hbmFnZXIuTUFYX1JFVFJJRVMpIHtcbiAgICAgICAgcmV0dXJuICd0b29NYW55RmFpbHVyZXNXaGlsZU9ubGluZSc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gJ3ZhbGlkYXRlT25saW5lQW5kUmV0cnknO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoWzUwMiwgNTAzLCA1MDRdLmluZGV4T2YocmVzdWx0LnN0YXR1cykgIT09IC0xKSB7XG4gICAgICBpZiAocmVxdWVzdEV2dC5yZXRyeUNvdW50ID49IFN5bmNNYW5hZ2VyLk1BWF9SRVRSSUVTKSB7XG4gICAgICAgIHJldHVybiAndG9vTWFueUZhaWx1cmVzV2hpbGVPbmxpbmUnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICdzZXJ2ZXJVbmF2YWlsYWJsZSc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChlcnJJZCA9PT0gJ2F1dGhlbnRpY2F0aW9uX3JlcXVpcmVkJyAmJiByZXN1bHQuZGF0YS5kYXRhICYmIHJlc3VsdC5kYXRhLmRhdGEubm9uY2UpIHtcbiAgICAgIHJldHVybiAncmVhdXRob3JpemUnO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gJ3NlcnZlclJlamVjdGVkUmVxdWVzdCc7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSBmYWlsZWQgcmVxdWVzdHMuXG4gICAqXG4gICAqIDEuIElmIHRoZXJlIHdhcyBhbiBlcnJvciBmcm9tIHRoZSBzZXJ2ZXIsIHRoZW4gdGhlIHJlcXVlc3QgaGFzIHByb2JsZW1zXG4gICAqIDIuIElmIHdlIGRldGVybWluZSB3ZSBhcmUgbm90IGluIGZhY3Qgb25saW5lLCBjYWxsIHRoZSBjb25uZWN0aW9uRXJyb3IgaGFuZGxlclxuICAgKiAzLiBJZiB3ZSB0aGluayB3ZSBhcmUgb25saW5lLCB2ZXJpZnkgd2UgYXJlIG9ubGluZSBhbmQgdGhlbiBkZXRlcm1pbmUgaG93IHRvIGhhbmRsZSBpdC5cbiAgICpcbiAgICogQG1ldGhvZCBfeGhyRXJyb3JcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHQgIC0gUmVzcG9uc2Ugb2JqZWN0IHJldHVybmVkIGJ5IHhociBjYWxsXG4gICAqIEBwYXJhbSAge2xheWVyLlN5bmNFdmVudH0gcmVxdWVzdEV2dCAtIFJlcXVlc3Qgb2JqZWN0XG4gICAqL1xuICBfeGhyRXJyb3IocmVzdWx0KSB7XG4gICAgY29uc3QgcmVxdWVzdEV2dCA9IHJlc3VsdC5yZXF1ZXN0O1xuXG4gICAgbG9nZ2VyLndhcm4oYFN5bmMgTWFuYWdlciAke3JlcXVlc3RFdnQgaW5zdGFuY2VvZiBXZWJzb2NrZXRTeW5jRXZlbnQgPyAnV2Vic29ja2V0JyA6ICdYSFInfSBgICtcbiAgICAgIGAke3JlcXVlc3RFdnQub3BlcmF0aW9ufSBSZXF1ZXN0IG9uIHRhcmdldCAke3JlcXVlc3RFdnQudGFyZ2V0fSBoYXMgRmFpbGVkYCwgcmVxdWVzdEV2dC50b09iamVjdCgpKTtcblxuXG4gICAgY29uc3QgZXJyU3RhdGUgPSB0aGlzLl9nZXRFcnJvclN0YXRlKHJlc3VsdCwgcmVxdWVzdEV2dCwgdGhpcy5pc09ubGluZSgpKTtcbiAgICBsb2dnZXIud2FybignU3luYyBNYW5hZ2VyIEVycm9yIFN0YXRlOiAnICsgZXJyU3RhdGUpO1xuICAgIHN3aXRjaCAoZXJyU3RhdGUpIHtcbiAgICAgIGNhc2UgJ3Rvb01hbnlGYWlsdXJlc1doaWxlT25saW5lJzpcbiAgICAgICAgdGhpcy5feGhySGFuZGxlU2VydmVyRXJyb3IocmVzdWx0LCAnU3luYyBNYW5hZ2VyIFNlcnZlciBVbmF2YWlsYWJsZSBUb28gTG9uZzsgcmVtb3ZpbmcgcmVxdWVzdCcsIGZhbHNlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdub3RGb3VuZCc6XG4gICAgICAgIHRoaXMuX3hockhhbmRsZVNlcnZlckVycm9yKHJlc3VsdCwgJ1Jlc291cmNlIG5vdCBmb3VuZDsgcHJlc3VtYWJseSBkZWxldGVkJywgZmFsc2UpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2ludmFsaWRJZCc6XG4gICAgICAgIHRoaXMuX3hockhhbmRsZVNlcnZlckVycm9yKHJlc3VsdCwgJ0lEIHdhcyBub3QgdW5pcXVlOyByZXF1ZXN0IGZhaWxlZCcsIGZhbHNlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICd2YWxpZGF0ZU9ubGluZUFuZFJldHJ5JzpcbiAgICAgICAgLy8gU2VydmVyIGFwcGVhcnMgdG8gYmUgaHVuZyBidXQgd2lsbCBldmVudHVhbGx5IHJlY292ZXIuXG4gICAgICAgIC8vIFJldHJ5IGEgZmV3IHRpbWVzIGFuZCB0aGVuIGVycm9yIG91dC5cbiAgICAgICAgdGhpcy5feGhyVmFsaWRhdGVJc09ubGluZShyZXF1ZXN0RXZ0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdzZXJ2ZXJVbmF2YWlsYWJsZSc6XG4gICAgICAgIC8vIFNlcnZlciBpcyBpbiBhIGJhZCBzdGF0ZSBidXQgd2lsbCBldmVudHVhbGx5IHJlY292ZXI7XG4gICAgICAgIC8vIGtlZXAgcmV0cnlpbmcuXG4gICAgICAgIHRoaXMuX3hockhhbmRsZVNlcnZlclVuYXZhaWxhYmxlRXJyb3IocmVxdWVzdEV2dCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAncmVhdXRob3JpemUnOlxuICAgICAgICAvLyBzZXNzaW9uVG9rZW4gYXBwZWFycyB0byBubyBsb25nZXIgYmUgdmFsaWQ7IGZvcndhcmQgcmVzcG9uc2VcbiAgICAgICAgLy8gb24gdG8gY2xpZW50LWF1dGhlbnRpY2F0b3IgdG8gcHJvY2Vzcy5cbiAgICAgICAgLy8gRG8gbm90IHJldHJ5IG5vciBhZHZhbmNlIHRvIG5leHQgcmVxdWVzdC5cbiAgICAgICAgaWYgKHJlcXVlc3RFdnQuY2FsbGJhY2spIHJlcXVlc3RFdnQuY2FsbGJhY2socmVzdWx0KTtcblxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3NlcnZlclJlamVjdGVkUmVxdWVzdCc6XG4gICAgICAgIC8vIFNlcnZlciBwcmVzdW1hYmx5IGRpZCBub3QgbGlrZSB0aGUgYXJndW1lbnRzIHRvIHRoaXMgY2FsbFxuICAgICAgICAvLyBvciB0aGUgdXJsIHdhcyBpbnZhbGlkLiAgRG8gbm90IHJldHJ5OyB0cmlnZ2VyIHRoZSBjYWxsYmFja1xuICAgICAgICAvLyBhbmQgbGV0IHRoZSBjYWxsZXIgaGFuZGxlIGl0LlxuICAgICAgICB0aGlzLl94aHJIYW5kbGVTZXJ2ZXJFcnJvcihyZXN1bHQsICdTeW5jIE1hbmFnZXIgU2VydmVyIFJlamVjdHMgUmVxdWVzdDsgcmVtb3ZpbmcgcmVxdWVzdCcsIHRydWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ0NPUlMnOlxuICAgICAgICAvLyBBIHBhdHRlcm4gb2Ygb2ZmbGluZS1saWtlIGZhaWx1cmVzIHRoYXQgc3VnZ2VzdHMgaXRzIGFjdHVhbGx5IGEgQ09ScyBlcnJvclxuICAgICAgICB0aGlzLl94aHJIYW5kbGVTZXJ2ZXJFcnJvcihyZXN1bHQsICdTeW5jIE1hbmFnZXIgU2VydmVyIGRldGVjdHMgQ09SUy1saWtlIGVycm9yczsgcmVtb3ZpbmcgcmVxdWVzdCcsIGZhbHNlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdvZmZsaW5lJzpcbiAgICAgICAgdGhpcy5feGhySGFuZGxlQ29ubmVjdGlvbkVycm9yKCk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIC8vIFdyaXRlIHRoZSBzeW5jIGV2ZW50IGJhY2sgdG8gdGhlIGRhdGFiYXNlIGlmIHdlIGhhdmVuJ3QgY29tcGxldGVkIHByb2Nlc3NpbmcgaXRcbiAgICBpZiAodGhpcy5xdWV1ZS5pbmRleE9mKHJlcXVlc3RFdnQpICE9PSAtMSB8fCB0aGlzLnJlY2VpcHRRdWV1ZS5pbmRleE9mKHJlcXVlc3RFdnQpICE9PSAtMSkge1xuICAgICAgdGhpcy5jbGllbnQuZGJNYW5hZ2VyLndyaXRlU3luY0V2ZW50cyhbcmVxdWVzdEV2dF0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGUgYSBzZXJ2ZXIgdW5hdmFpbGFibGUgZXJyb3IuXG4gICAqXG4gICAqIEluIHRoZSBldmVudCBvZiBhIDUwMiAoQmFkIEdhdGV3YXkpLCA1MDMgKHNlcnZpY2UgdW5hdmFpbGFibGUpXG4gICAqIG9yIDUwNCAoZ2F0ZXdheSB0aW1lb3V0KSBlcnJvciBmcm9tIHRoZSBzZXJ2ZXJcbiAgICogYXNzdW1lIHdlIGhhdmUgYW4gZXJyb3IgdGhhdCBpcyBzZWxmIGNvcnJlY3Rpbmcgb24gdGhlIHNlcnZlci5cbiAgICogVXNlIGV4cG9uZW50aWFsIGJhY2tvZmYgdG8gcmV0cnkgdGhlIHJlcXVlc3QuXG4gICAqXG4gICAqIE5vdGUgdGhhdCBlYWNoIGNhbGwgd2lsbCBpbmNyZW1lbnQgcmV0cnlDb3VudDsgdGhlcmUgaXMgYSBtYXhpbXVtXG4gICAqIG9mIE1BWF9SRVRSSUVTIGJlZm9yZSBpdCBpcyB0cmVhdGVkIGFzIGFuIGVycm9yXG4gICAqXG4gICAqIEBtZXRob2QgIF94aHJIYW5kbGVTZXJ2ZXJVbmF2YWlsYWJsZUVycm9yXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7bGF5ZXIuU3luY0V2ZW50fSByZXF1ZXN0XG4gICAqL1xuICBfeGhySGFuZGxlU2VydmVyVW5hdmFpbGFibGVFcnJvcihyZXF1ZXN0KSB7XG4gICAgY29uc3QgbWF4RGVsYXkgPSBTeW5jTWFuYWdlci5NQVhfVU5BVkFJTEFCTEVfUkVUUllfV0FJVDtcbiAgICBjb25zdCBkZWxheSA9IFV0aWxzLmdldEV4cG9uZW50aWFsQmFja29mZlNlY29uZHMobWF4RGVsYXksIE1hdGgubWluKDE1LCByZXF1ZXN0LnJldHJ5Q291bnQrKykpO1xuICAgIGxvZ2dlci53YXJuKGBTeW5jIE1hbmFnZXIgU2VydmVyIFVuYXZhaWxhYmxlOyByZXRyeSBjb3VudCAke3JlcXVlc3QucmV0cnlDb3VudH07IHJldHJ5aW5nIGluICR7ZGVsYXl9IHNlY29uZHNgKTtcbiAgICBzZXRUaW1lb3V0KHRoaXMuX3Byb2Nlc3NOZXh0UmVxdWVzdC5iaW5kKHRoaXMpLCBkZWxheSAqIDEwMDApO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSBhIHNlcnZlciBlcnJvciBpbiByZXNwb25zZSB0byBmaXJpbmcgc3luYyBldmVudC5cbiAgICpcbiAgICogSWYgdGhlcmUgaXMgYSBzZXJ2ZXIgZXJyb3IsIGl0cyBwcmVzdW1hYmx5IG5vbi1yZWNvdmVyYWJsZS9ub24tcmV0cnlhYmxlIGVycm9yLCBzb1xuICAgKiB3ZSdyZSBnb2luZyB0byBhYm9ydCB0aGlzIHJlcXVlc3QuXG4gICAqXG4gICAqIDEuIElmIGEgY2FsbGJhY2sgd2FzIHByb3ZpZGVkLCBjYWxsIGl0IHRvIGhhbmRsZSB0aGUgZXJyb3JcbiAgICogMi4gSWYgYSByb2xsYmFjayBjYWxsIGlzIHByb3ZpZGVkLCBjYWxsIGl0IHRvIHVuZG8gYW55IHBhdGNoL2RlbGV0ZS9ldGMuLi4gY2hhbmdlc1xuICAgKiAzLiBJZiB0aGUgcmVxdWVzdCB3YXMgdG8gY3JlYXRlIGEgcmVzb3VyY2UsIHJlbW92ZSBmcm9tIHRoZSBxdWV1ZSBhbGwgcmVxdWVzdHNcbiAgICogICAgdGhhdCBkZXBlbmRlZCB1cG9uIHRoYXQgcmVzb3VyY2UuXG4gICAqIDQuIEFkdmFuY2UgdG8gbmV4dCByZXF1ZXN0XG4gICAqXG4gICAqIEBtZXRob2QgX3hockhhbmRsZVNlcnZlckVycm9yXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gcmVzdWx0ICAtIFJlc3BvbnNlIG9iamVjdCByZXR1cm5lZCBieSB4aHIgY2FsbFxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGxvZ01zZyAtIE1lc3NhZ2UgdG8gZGlzcGxheSBpbiBjb25zb2xlXG4gICAqIEBwYXJhbSAge2Jvb2xlYW59IHN0cmluZ2lmeSAtIGxvZyBvYmplY3QgZm9yIHF1aWNrIGRlYnVnZ2luZ1xuICAgKlxuICAgKi9cbiAgX3hockhhbmRsZVNlcnZlckVycm9yKHJlc3VsdCwgbG9nTXNnLCBzdHJpbmdpZnkpIHtcbiAgICAvLyBFeGVjdXRlIGFsbCBjYWxsYmFja3MgcHJvdmlkZWQgYnkgdGhlIHJlcXVlc3RcbiAgICBpZiAocmVzdWx0LnJlcXVlc3QuY2FsbGJhY2spIHJlc3VsdC5yZXF1ZXN0LmNhbGxiYWNrKHJlc3VsdCk7XG4gICAgaWYgKHN0cmluZ2lmeSkge1xuICAgICAgbG9nZ2VyLmVycm9yKGxvZ01zZyArXG4gICAgICAgICdcXG5SRVFVRVNUOiAnICsgSlNPTi5zdHJpbmdpZnkocmVzdWx0LnJlcXVlc3QudG9PYmplY3QoKSwgbnVsbCwgNCkgK1xuICAgICAgICAnXFxuUkVTUE9OU0U6ICcgKyBKU09OLnN0cmluZ2lmeShyZXN1bHQuZGF0YSwgbnVsbCwgNCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIuZXJyb3IobG9nTXNnLCByZXN1bHQpO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ3N5bmM6ZXJyb3InLCB7XG4gICAgICB0YXJnZXQ6IHJlc3VsdC5yZXF1ZXN0LnRhcmdldCxcbiAgICAgIHJlcXVlc3Q6IHJlc3VsdC5yZXF1ZXN0LFxuICAgICAgZXJyb3I6IHJlc3VsdC5kYXRhLFxuICAgIH0pO1xuXG4gICAgcmVzdWx0LnJlcXVlc3Quc3VjY2VzcyA9IGZhbHNlO1xuXG4gICAgLy8gSWYgYSBQT1NUIHJlcXVlc3QgZmFpbHMsIGFsbCByZXF1ZXN0cyB0aGF0IGRlcGVuZCB1cG9uIHRoaXMgb2JqZWN0XG4gICAgLy8gbXVzdCBiZSBwdXJnZWRcbiAgICBpZiAocmVzdWx0LnJlcXVlc3Qub3BlcmF0aW9uID09PSAnUE9TVCcpIHtcbiAgICAgIHRoaXMuX3B1cmdlRGVwZW5kZW50UmVxdWVzdHMocmVzdWx0LnJlcXVlc3QpO1xuICAgIH1cblxuICAgIC8vIFJlbW92ZSB0aGlzIHJlcXVlc3QgYXMgd2VsbCAoc2lkZS1lZmZlY3Q6IHJvbGxzIGJhY2sgdGhlIG9wZXJhdGlvbilcbiAgICB0aGlzLl9yZW1vdmVSZXF1ZXN0KHJlc3VsdC5yZXF1ZXN0LCB0cnVlKTtcblxuICAgIC8vIEFuZCBmaW5hbGx5LCB3ZSBhcmUgcmVhZHkgdG8gdHJ5IHRoZSBuZXh0IHJlcXVlc3RcbiAgICB0aGlzLl9wcm9jZXNzTmV4dFJlcXVlc3QoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJZiB0aGVyZSBpcyBhIGNvbm5lY3Rpb24gZXJyb3IsIHdhaXQgZm9yIHJldHJ5LlxuICAgKlxuICAgKiBJbiB0aGUgZXZlbnQgb2Ygd2hhdCBhcHBlYXJzIHRvIGJlIGEgY29ubmVjdGlvbiBlcnJvcixcbiAgICogV2FpdCB1bnRpbCBhICdjb25uZWN0ZWQnIGV2ZW50IGJlZm9yZSBwcm9jZXNzaW5nIHRoZSBuZXh0IHJlcXVlc3QgKGFjdHVhbGx5IHJlcHJvY2Vzc2luZyB0aGUgY3VycmVudCBldmVudClcbiAgICpcbiAgICogQG1ldGhvZCBfeGhySGFuZGxlQ29ubmVjdGlvbkVycm9yXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfeGhySGFuZGxlQ29ubmVjdGlvbkVycm9yKCkge1xuICAgIC8vIE5vdGhpbmcgdG8gYmUgZG9uZTsgd2UgYWxyZWFkeSBoYXZlIHRoZSBiZWxvdyBldmVudCBoYW5kbGVyIHNldHVwXG4gICAgLy8gdGhpcy5vbmxpbmVNYW5hZ2VyLm9uY2UoJ2Nvbm5lY3RlZCcsICgpID0+IHRoaXMuX3Byb2Nlc3NOZXh0UmVxdWVzdCgpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBWZXJpZnkgdGhhdCB3ZSBhcmUgb25saW5lIGFuZCByZXRyeSByZXF1ZXN0LlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBpcyBjYWxsZWQgd2hlbiB3ZSB0aGluayB3ZSdyZSBvbmxpbmUsIGJ1dFxuICAgKiBoYXZlIGRldGVybWluZWQgd2UgbmVlZCB0byB2YWxpZGF0ZSB0aGF0IGFzc3VtcHRpb24uXG4gICAqXG4gICAqIFRlc3QgdGhhdCB3ZSBoYXZlIGEgY29ubmVjdGlvbjsgaWYgd2UgZG8sXG4gICAqIHJldHJ5IHRoZSByZXF1ZXN0IG9uY2UsIGFuZCBpZiBpdCBmYWlscyBhZ2FpbixcbiAgICogX3hockVycm9yKCkgd2lsbCBkZXRlcm1pbmUgaXQgdG8gaGF2ZSBmYWlsZWQgYW5kIHJlbW92ZSBpdCBmcm9tIHRoZSBxdWV1ZS5cbiAgICpcbiAgICogSWYgd2UgYXJlIG9mZmxpbmUsIHRoZW4gbGV0IF94aHJIYW5kbGVDb25uZWN0aW9uRXJyb3IgaGFuZGxlIGl0LlxuICAgKlxuICAgKiBAbWV0aG9kIF94aHJWYWxpZGF0ZUlzT25saW5lXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfeGhyVmFsaWRhdGVJc09ubGluZShyZXF1ZXN0RXZ0KSB7XG4gICAgbG9nZ2VyLmRlYnVnKCdTeW5jIE1hbmFnZXIgdmVyaWZ5aW5nIG9ubGluZSBzdGF0ZScpO1xuICAgIHRoaXMub25saW5lTWFuYWdlci5jaGVja09ubGluZVN0YXR1cyhpc09ubGluZSA9PiB0aGlzLl94aHJWYWxpZGF0ZUlzT25saW5lQ2FsbGJhY2soaXNPbmxpbmUsIHJlcXVlc3RFdnQpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJZiB3ZSBoYXZlIHZlcmlmaWVkIHdlIGFyZSBvbmxpbmUsIHJldHJ5IHJlcXVlc3QuXG4gICAqXG4gICAqIFdlIHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgcmVzcG9uc2UgdG8gb3VyIC9ub25jZXMgY2FsbFxuICAgKiB3aGljaCBhc3N1bWluZyB0aGUgc2VydmVyIGlzIGFjdHVhbGx5IGFsaXZlLFxuICAgKiB3aWxsIHRlbGwgdXMgaWYgdGhlIGNvbm5lY3Rpb24gaXMgd29ya2luZy5cbiAgICpcbiAgICogSWYgd2UgYXJlIG9mZmxpbmUsIGZsYWcgdXMgYXMgb2ZmbGluZSBhbmQgbGV0IHRoZSBDb25uZWN0aW9uRXJyb3IgaGFuZGxlciBoYW5kbGUgdGhpc1xuICAgKiBJZiB3ZSBhcmUgb25saW5lLCBnaXZlIHRoZSByZXF1ZXN0IGEgc2luZ2xlIHJldHJ5ICh0aGVyZSBpcyBuZXZlciBtb3JlIHRoYW4gb25lIHJldHJ5KVxuICAgKlxuICAgKiBAbWV0aG9kIF94aHJWYWxpZGF0ZUlzT25saW5lQ2FsbGJhY2tcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7Ym9vbGVhbn0gaXNPbmxpbmUgIC0gUmVzcG9uc2Ugb2JqZWN0IHJldHVybmVkIGJ5IHhociBjYWxsXG4gICAqIEBwYXJhbSB7bGF5ZXIuU3luY0V2ZW50fSByZXF1ZXN0RXZ0IC0gVGhlIHJlcXVlc3QgdGhhdCBmYWlsZWQgdHJpZ2dlcmluZyB0aGlzIGNhbGxcbiAgICovXG4gIF94aHJWYWxpZGF0ZUlzT25saW5lQ2FsbGJhY2soaXNPbmxpbmUsIHJlcXVlc3RFdnQpIHtcbiAgICBsb2dnZXIuZGVidWcoJ1N5bmMgTWFuYWdlciBvbmxpbmUgY2hlY2sgcmVzdWx0IGlzICcgKyBpc09ubGluZSk7XG4gICAgaWYgKCFpc09ubGluZSkge1xuICAgICAgLy8gVHJlYXQgdGhpcyBhcyBhIENvbm5lY3Rpb24gRXJyb3JcbiAgICAgIHRoaXMuX3hockhhbmRsZUNvbm5lY3Rpb25FcnJvcigpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBSZXRyeSB0aGUgcmVxdWVzdCBpbiBjYXNlIHdlIHdlcmUgb2ZmbGluZSwgYnV0IGFyZSBub3cgb25saW5lLlxuICAgICAgLy8gT2YgY291cnNlLCBpZiB0aGlzIGZhaWxzLCBnaXZlIGl0IHVwIGVudGlyZWx5LlxuICAgICAgcmVxdWVzdEV2dC5yZXRyeUNvdW50Kys7XG4gICAgICB0aGlzLl9wcm9jZXNzTmV4dFJlcXVlc3QoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVGhlIFhIUiByZXF1ZXN0IHdhcyBzdWNjZXNzZnVsLlxuICAgKlxuICAgKiBBbnkgeGhyIHJlcXVlc3QgdGhhdCBhY3R1YWxseSBzdWNjZWRlczpcbiAgICpcbiAgICogMS4gUmVtb3ZlIGl0IGZyb20gdGhlIHF1ZXVlXG4gICAqIDIuIENhbGwgYW55IGNhbGxiYWNrc1xuICAgKiAzLiBBZHZhbmNlIHRvIG5leHQgcmVxdWVzdFxuICAgKlxuICAgKiBAbWV0aG9kIF94aHJTdWNjZXNzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gcmVzdWx0ICAtIFJlc3BvbnNlIG9iamVjdCByZXR1cm5lZCBieSB4aHIgY2FsbFxuICAgKiBAcGFyYW0gIHtsYXllci5TeW5jRXZlbnR9IHJlcXVlc3RFdnQgLSBSZXF1ZXN0IG9iamVjdFxuICAgKi9cbiAgX3hoclN1Y2Nlc3MocmVzdWx0KSB7XG4gICAgY29uc3QgcmVxdWVzdEV2dCA9IHJlc3VsdC5yZXF1ZXN0O1xuICAgIGxvZ2dlci5kZWJ1ZyhgU3luYyBNYW5hZ2VyICR7cmVxdWVzdEV2dCBpbnN0YW5jZW9mIFdlYnNvY2tldFN5bmNFdmVudCA/ICdXZWJzb2NrZXQnIDogJ1hIUid9IGAgK1xuICAgICAgYCR7cmVxdWVzdEV2dC5vcGVyYXRpb259IFJlcXVlc3Qgb24gdGFyZ2V0ICR7cmVxdWVzdEV2dC50YXJnZXR9IGhhcyBTdWNjZWVkZWRgLCByZXF1ZXN0RXZ0LnRvT2JqZWN0KCkpO1xuICAgIGlmIChyZXN1bHQuZGF0YSkgbG9nZ2VyLmRlYnVnKHJlc3VsdC5kYXRhKTtcbiAgICByZXF1ZXN0RXZ0LnN1Y2Nlc3MgPSB0cnVlO1xuICAgIHRoaXMuX3JlbW92ZVJlcXVlc3QocmVxdWVzdEV2dCwgdHJ1ZSk7XG4gICAgaWYgKHJlcXVlc3RFdnQuY2FsbGJhY2spIHJlcXVlc3RFdnQuY2FsbGJhY2socmVzdWx0KTtcbiAgICB0aGlzLl9wcm9jZXNzTmV4dFJlcXVlc3QoKTtcblxuICAgIHRoaXMudHJpZ2dlcignc3luYzpzdWNjZXNzJywge1xuICAgICAgdGFyZ2V0OiByZXF1ZXN0RXZ0LnRhcmdldCxcbiAgICAgIHJlcXVlc3Q6IHJlcXVlc3RFdnQsXG4gICAgICByZXNwb25zZTogcmVzdWx0LmRhdGEsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIHRoZSBTeW5jRXZlbnQgcmVxdWVzdCBmcm9tIHRoZSBxdWV1ZS5cbiAgICpcbiAgICogQG1ldGhvZCBfcmVtb3ZlUmVxdWVzdFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5TeW5jRXZlbnR9IHJlcXVlc3RFdnQgLSBTeW5jRXZlbnQgUmVxdWVzdCB0byByZW1vdmVcbiAgICogQHBhcmFtIHtCb29sZWFufSBkZWxldGVEQiAtIERlbGV0ZSBmcm9tIGluZGV4ZWREQlxuICAgKi9cbiAgX3JlbW92ZVJlcXVlc3QocmVxdWVzdEV2dCwgZGVsZXRlREIpIHtcbiAgICBjb25zdCBxdWV1ZSA9IHJlcXVlc3RFdnQub3BlcmF0aW9uID09PSAnUkVDRUlQVCcgPyB0aGlzLnJlY2VpcHRRdWV1ZSA6IHRoaXMucXVldWU7XG4gICAgY29uc3QgaW5kZXggPSBxdWV1ZS5pbmRleE9mKHJlcXVlc3RFdnQpO1xuICAgIGlmIChpbmRleCAhPT0gLTEpIHF1ZXVlLnNwbGljZShpbmRleCwgMSk7XG4gICAgaWYgKGRlbGV0ZURCKSB0aGlzLmNsaWVudC5kYk1hbmFnZXIuZGVsZXRlT2JqZWN0cygnc3luY1F1ZXVlJywgW3JlcXVlc3RFdnRdKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgcmVxdWVzdHMgZnJvbSBxdWV1ZSB0aGF0IGRlcGVuZCBvbiBzcGVjaWZpZWQgcmVzb3VyY2UuXG4gICAqXG4gICAqIElmIHRoZXJlIGlzIGEgUE9TVCByZXF1ZXN0IHRvIGNyZWF0ZSBhIG5ldyByZXNvdXJjZSwgYW5kIHRoZXJlIGFyZSBQQVRDSCwgREVMRVRFLCBldGMuLi5cbiAgICogcmVxdWVzdHMgb24gdGhhdCByZXNvdXJjZSwgaWYgdGhlIFBPU1QgcmVxdWVzdCBmYWlscywgdGhlbiBhbGwgUEFUQ0gsIERFTEVURSwgZXRjXG4gICAqIHJlcXVlc3RzIG11c3QgYmUgcmVtb3ZlZCBmcm9tIHRoZSBxdWV1ZS5cbiAgICpcbiAgICogTm90ZSB0aGF0IHdlIGRvIG5vdCBjYWxsIHRoZSByb2xsYmFjayBvbiB0aGVzZSBkZXBlbmRlbnQgcmVxdWVzdHMgYmVjYXVzZSB0aGUgZXhwZWN0ZWRcbiAgICogcm9sbGJhY2sgaXMgdG8gZGVzdHJveSB0aGUgdGhpbmcgdGhhdCB3YXMgY3JlYXRlZCwgd2hpY2ggbWVhbnMgYW55IG90aGVyIHJvbGxiYWNrIGhhcyBubyBlZmZlY3QuXG4gICAqXG4gICAqIEBtZXRob2QgX3B1cmdlRGVwZW5kZW50UmVxdWVzdHNcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bGF5ZXIuU3luY0V2ZW50fSByZXF1ZXN0IC0gUmVxdWVzdCB3aG9zZSB0YXJnZXQgaXMgbm8gbG9uZ2VyIHZhbGlkXG4gICAqL1xuICBfcHVyZ2VEZXBlbmRlbnRSZXF1ZXN0cyhyZXF1ZXN0KSB7XG4gICAgdGhpcy5xdWV1ZSA9IHRoaXMucXVldWUuZmlsdGVyKGV2dCA9PiBldnQuZGVwZW5kcy5pbmRleE9mKHJlcXVlc3QudGFyZ2V0KSA9PT0gLTEgfHwgZXZ0ID09PSByZXF1ZXN0KTtcbiAgICB0aGlzLnJlY2VpcHRRdWV1ZSA9IHRoaXMucmVjZWlwdFF1ZXVlLmZpbHRlcihldnQgPT4gZXZ0LmRlcGVuZHMuaW5kZXhPZihyZXF1ZXN0LnRhcmdldCkgPT09IC0xIHx8IGV2dCA9PT0gcmVxdWVzdCk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBSZW1vdmUgZnJvbSBxdWV1ZSBhbGwgZXZlbnRzIHRoYXQgb3BlcmF0ZSB1cG9uIHRoZSBkZWxldGVkIG9iamVjdC5cbiAgICpcbiAgICogQG1ldGhvZCBfcHVyZ2VPbkRlbGV0ZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5TeW5jRXZlbnR9IGV2dCAtIERlbGV0ZSBldmVudCB0aGF0IHJlcXVpcmVzIHJlbW92YWwgb2Ygb3RoZXIgZXZlbnRzXG4gICAqL1xuICBfcHVyZ2VPbkRlbGV0ZShldnQpIHtcbiAgICB0aGlzLnF1ZXVlLmZpbHRlcihyZXF1ZXN0ID0+IHJlcXVlc3QuZGVwZW5kcy5pbmRleE9mKGV2dC50YXJnZXQpICE9PSAtMSAmJiBldnQgIT09IHJlcXVlc3QpXG4gICAgICAuZm9yRWFjaChyZXF1ZXN0RXZ0ID0+IHtcbiAgICAgICAgdGhpcy50cmlnZ2VyKCdzeW5jOmFib3J0Jywge1xuICAgICAgICAgIHRhcmdldDogcmVxdWVzdEV2dC50YXJnZXQsXG4gICAgICAgICAgcmVxdWVzdDogcmVxdWVzdEV2dCxcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3JlbW92ZVJlcXVlc3QocmVxdWVzdEV2dCwgdHJ1ZSk7XG4gICAgICB9KTtcbiAgfVxuXG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLnF1ZXVlLmZvckVhY2goZXZ0ID0+IGV2dC5kZXN0cm95KCkpO1xuICAgIHRoaXMucXVldWUgPSBudWxsO1xuICAgIHRoaXMucmVjZWlwdFF1ZXVlLmZvckVhY2goZXZ0ID0+IGV2dC5kZXN0cm95KCkpO1xuICAgIHRoaXMucmVjZWlwdFF1ZXVlID0gbnVsbDtcbiAgICBzdXBlci5kZXN0cm95KCk7XG4gIH1cblxuICAvKipcbiAgICogTG9hZCBhbnkgdW5zZW50IHJlcXVlc3RzIGZyb20gaW5kZXhlZERCLlxuICAgKlxuICAgKiBJZiBwZXJzaXN0ZW5jZSBpcyBkaXNhYmxlZCwgbm90aGluZyB3aWxsIGhhcHBlbjtcbiAgICogZWxzZSBhbGwgcmVxdWVzdHMgZm91bmQgaW4gdGhlIGRhdGFiYXNlIHdpbGwgYmUgYWRkZWQgdG8gdGhlIHF1ZXVlLlxuICAgKiBAbWV0aG9kIF9sb2FkUGVyc2lzdGVkUXVldWVcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9sb2FkUGVyc2lzdGVkUXVldWUoKSB7XG4gICAgdGhpcy5jbGllbnQuZGJNYW5hZ2VyLmxvYWRTeW5jUXVldWUoZGF0YSA9PiB7XG4gICAgICBpZiAoZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5xdWV1ZSA9IHRoaXMucXVldWUuY29uY2F0KGRhdGEpO1xuICAgICAgICB0aGlzLl9wcm9jZXNzTmV4dFJlcXVlc3QoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuXG4vKipcbiAqIFdlYnNvY2tldCBNYW5hZ2VyIGZvciBnZXR0aW5nIHNvY2tldCBzdGF0ZS5cbiAqIEB0eXBlIHtsYXllci5XZWJzb2NrZXRzLlNvY2tldE1hbmFnZXJ9XG4gKi9cblN5bmNNYW5hZ2VyLnByb3RvdHlwZS5zb2NrZXRNYW5hZ2VyID0gbnVsbDtcblxuLyoqXG4gKiBXZWJzb2NrZXQgUmVxdWVzdCBNYW5hZ2VyIGZvciBzZW5kaW5nIHJlcXVlc3RzLlxuICogQHR5cGUge2xheWVyLldlYnNvY2tldHMuUmVxdWVzdE1hbmFnZXJ9XG4gKi9cblN5bmNNYW5hZ2VyLnByb3RvdHlwZS5yZXF1ZXN0TWFuYWdlciA9IG51bGw7XG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIHRoZSBPbmxpbmUgU3RhdGUgTWFuYWdlci5cbiAqXG4gKiBTeW5jIE1hbmFnZXIgdXNlcyBvbmxpbmUgc3RhdHVzIHRvIGRldGVybWluZSBpZiBpdCBjYW4gZmlyZSBzeW5jLXJlcXVlc3RzLlxuICogQHByaXZhdGVcbiAqIEB0eXBlIHtsYXllci5PbmxpbmVTdGF0ZU1hbmFnZXJ9XG4gKi9cblN5bmNNYW5hZ2VyLnByb3RvdHlwZS5vbmxpbmVNYW5hZ2VyID0gbnVsbDtcblxuLyoqXG4gKiBUaGUgYXJyYXkgb2YgbGF5ZXIuU3luY0V2ZW50IGluc3RhbmNlcyBhd2FpdGluZyB0byBiZSBmaXJlZC5cbiAqIEB0eXBlIHtsYXllci5TeW5jRXZlbnRbXX1cbiAqL1xuU3luY01hbmFnZXIucHJvdG90eXBlLnF1ZXVlID0gbnVsbDtcblxuLyoqXG4gKiBUaGUgYXJyYXkgb2YgbGF5ZXIuU3luY0V2ZW50IGluc3RhbmNlcyBhd2FpdGluZyB0byBiZSBmaXJlZC5cbiAqXG4gKiBSZWNlaXB0cyBjYW4gZ2VuZXJhbGx5IGp1c3QgYmUgZmlyZWQgb2ZmIGFsbCBhdCBvbmNlIHdpdGhvdXQgbXVjaCBmcmV0dGluZyBhYm91dCBvcmRlcmluZyBvciBkZXBlbmRlbmNpZXMuXG4gKiBAdHlwZSB7bGF5ZXIuU3luY0V2ZW50W119XG4gKi9cblN5bmNNYW5hZ2VyLnByb3RvdHlwZS5yZWNlaXB0UXVldWUgPSBudWxsO1xuXG4vKipcbiAqIFJlZmVyZW5jZSB0byB0aGUgQ2xpZW50IHNvIHRoYXQgd2UgY2FuIHBhc3MgaXQgdG8gU3luY0V2ZW50cyAgd2hpY2ggbWF5IG5lZWQgdG8gbG9va3VwIHRoZWlyIHRhcmdldHNcbiAqL1xuU3luY01hbmFnZXIucHJvdG90eXBlLmNsaWVudCA9IG51bGw7XG5cbi8qKlxuICogTWF4aW11bSBleHBvbmVudGlhbCBiYWNrb2ZmIHdhaXQuXG4gKlxuICogSWYgdGhlIHNlcnZlciBpcyByZXR1cm5pbmcgNTAyLCA1MDMgb3IgNTA0IGVycm9ycywgZXhwb25lbnRpYWwgYmFja29mZlxuICogc2hvdWxkIG5ldmVyIHdhaXQgbG9uZ2VyIHRoYW4gdGhpcyBudW1iZXIgb2Ygc2Vjb25kcyAoMTUgbWludXRlcylcbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKiBAc3RhdGljXG4gKi9cblN5bmNNYW5hZ2VyLk1BWF9VTkFWQUlMQUJMRV9SRVRSWV9XQUlUID0gNjAgKiAxNTtcblxuLyoqXG4gKiBSZXRyaWVzIGJlZm9yZSBzdXNwZWN0IENPUlMgZXJyb3IuXG4gKlxuICogSG93IG1hbnkgdGltZXMgY2FuIHdlIHRyYW5zaXRpb24gZnJvbSBvZmZsaW5lIHRvIG9ubGluZSBzdGF0ZVxuICogd2l0aCB0aGlzIHJlcXVlc3QgYXQgdGhlIGZyb250IG9mIHRoZSBxdWV1ZSBiZWZvcmUgd2UgY29uY2x1ZGVcbiAqIHRoYXQgdGhlIHJlYXNvbiB3ZSBrZWVwIHRoaW5raW5nIHdlJ3JlIGdvaW5nIG9mZmxpbmUgaXNcbiAqIGEgQ09SUyBlcnJvciByZXR1cm5pbmcgYSBzdGF0dXMgb2YgMC4gIElmIHRoYXQgcGF0dGVyblxuICogc2hvd3MgMyB0aW1lcyBpbiBhIHJvdywgdGhlcmUgaXMgbGlrZWx5IGEgQ09SUyBlcnJvci5cbiAqIE5vdGUgdGhhdCBDT1JTIGVycm9ycyBhcHBlYXIgdG8gamF2YXNjcmlwdCBhcyBhIHN0YXR1cz0wIGVycm9yLFxuICogd2hpY2ggaXMgdGhlIHNhbWUgYXMgaWYgdGhlIGNsaWVudCB3ZXJlIG9mZmxpbmUuXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQHN0YXRpY1xuICovXG5TeW5jTWFuYWdlci5NQVhfUkVUUklFU19CRUZPUkVfQ09SU19FUlJPUiA9IDM7XG5cbi8qKlxuICogQWJvcnQgcmVxdWVzdCBhZnRlciB0aGlzIG51bWJlciBvZiByZXRyaWVzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAc3RhdGljXG4gKi9cblN5bmNNYW5hZ2VyLk1BWF9SRVRSSUVTID0gMjA7XG5cblxuU3luY01hbmFnZXIuX3N1cHBvcnRlZEV2ZW50cyA9IFtcbiAgLyoqXG4gICAqIEEgc3luYyByZXF1ZXN0IGhhcyBmYWlsZWQuXG4gICAqXG4gICAqIGBgYFxuICAgKiBjbGllbnQuc3luY01hbmFnZXIub24oJ3N5bmM6ZXJyb3InLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgY29uc29sZS5lcnJvcihldnQudGFyZ2V0LmlkICsgJyBmYWlsZWQgdG8gc2VuZCBjaGFuZ2VzIHRvIHNlcnZlcjogJywgcmVzdWx0LmRhdGEubWVzc2FnZSk7XG4gICAqICAgIGNvbnNvbGUubG9nKCdSZXF1ZXN0IEV2ZW50OicsIHJlcXVlc3RFdnQpO1xuICAgKiAgICBjb25zb2xlLmxvZygnU2VydmVyIFJlc3BvbnNlOicsIHJlc3VsdC5kYXRhKTtcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnR9IGV2dCAtIFRoZSByZXF1ZXN0IG9iamVjdFxuICAgKiBAcGFyYW0ge09iamVjdH0gcmVzdWx0XG4gICAqIEBwYXJhbSB7c3RyaW5nfSByZXN1bHQudGFyZ2V0IC0gSUQgb2YgdGhlIG1lc3NhZ2UvY29udmVyc2F0aW9uL2V0Yy4gYmVpbmcgb3BlcmF0ZWQgdXBvblxuICAgKiBAcGFyYW0ge2xheWVyLlN5bmNFdmVudH0gcmVzdWx0LnJlcXVlc3QgLSBUaGUgb3JpZ2luYWwgcmVxdWVzdFxuICAgKiBAcGFyYW0ge09iamVjdH0gcmVzdWx0LmVycm9yIC0gVGhlIGVycm9yIG9iamVjdCB7aWQsIGNvZGUsIG1lc3NhZ2UsIHVybH1cbiAgICovXG4gICdzeW5jOmVycm9yJyxcblxuICAvKipcbiAgICogQSBzeW5jIGxheWVyIHJlcXVlc3QgaGFzIGNvbXBsZXRlZCBzdWNjZXNzZnVsbHkuXG4gICAqXG4gICAqIGBgYFxuICAgKiBjbGllbnQuc3luY01hbmFnZXIub24oJ3N5bmM6c3VjY2VzcycsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICBjb25zb2xlLmxvZyhldnQudGFyZ2V0LmlkICsgJyBjaGFuZ2VzIHNlbnQgdG8gc2VydmVyIHN1Y2Nlc3NmdWxseScpO1xuICAgKiAgICBjb25zb2xlLmxvZygnUmVxdWVzdCBFdmVudDonLCByZXF1ZXN0RXZ0KTtcbiAgICogICAgY29uc29sZS5sb2coJ1NlcnZlciBSZXNwb25zZTonLCByZXN1bHQuZGF0YSk7XG4gICAqIH0pO1xuICAgKiBgYGBcbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7T2JqZWN0fSByZXN1bHRcbiAgICogQHBhcmFtIHtzdHJpbmd9IHJlc3VsdC50YXJnZXQgLSBJRCBvZiB0aGUgbWVzc2FnZS9jb252ZXJzYXRpb24vZXRjLiBiZWluZyBvcGVyYXRlZCB1cG9uXG4gICAqIEBwYXJhbSB7bGF5ZXIuU3luY0V2ZW50fSByZXN1bHQucmVxdWVzdCAtIFRoZSBvcmlnaW5hbCByZXF1ZXN0XG4gICAqIEBwYXJhbSB7T2JqZWN0fSByZXN1bHQuZGF0YSAtIG51bGwgb3IgYW55IGRhdGEgcmV0dXJuZWQgYnkgdGhlIGNhbGxcbiAgICovXG4gICdzeW5jOnN1Y2Nlc3MnLFxuXG4gIC8qKlxuICAgKiBBIG5ldyBzeW5jIHJlcXVlc3QgaGFzIGJlZW4gYWRkZWQuXG4gICAqXG4gICAqIGBgYFxuICAgKiBjbGllbnQuc3luY01hbmFnZXIub24oJ3N5bmM6YWRkJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgIGNvbnNvbGUubG9nKGV2dC50YXJnZXQuaWQgKyAnIGhhcyBjaGFuZ2VzIHF1ZXVlZCBmb3IgdGhlIHNlcnZlcicpO1xuICAgKiAgICBjb25zb2xlLmxvZygnUmVxdWVzdCBFdmVudDonLCByZXF1ZXN0RXZ0KTtcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtPYmplY3R9IHJlc3VsdFxuICAgKiBAcGFyYW0ge3N0cmluZ30gcmVzdWx0LnRhcmdldCAtIElEIG9mIHRoZSBtZXNzYWdlL2NvbnZlcnNhdGlvbi9ldGMuIGJlaW5nIG9wZXJhdGVkIHVwb25cbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnR9IGV2dCAtIFRoZSByZXF1ZXN0IG9iamVjdFxuICAgKi9cbiAgJ3N5bmM6YWRkJyxcblxuICAvKipcbiAgICogQSBzeW5jIHJlcXVlc3QgaGFzIGJlZW4gY2FuY2VsZWQuXG4gICAqXG4gICAqIFR5cGljYWxseSBjYXVzZWQgYnkgYSBuZXcgU3luY0V2ZW50IHRoYXQgZGVsZXRlcyB0aGUgdGFyZ2V0IG9mIHRoaXMgU3luY0V2ZW50XG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLlN5bmNFdmVudH0gZXZ0IC0gVGhlIHJlcXVlc3Qgb2JqZWN0XG4gICAqIEBwYXJhbSB7T2JqZWN0fSByZXN1bHRcbiAgICogQHBhcmFtIHtzdHJpbmd9IHJlc3VsdC50YXJnZXQgLSBJRCBvZiB0aGUgbWVzc2FnZS9jb252ZXJzYXRpb24vZXRjLiBiZWluZyBvcGVyYXRlZCB1cG9uXG4gICAqIEBwYXJhbSB7bGF5ZXIuU3luY0V2ZW50fSByZXN1bHQucmVxdWVzdCAtIFRoZSBvcmlnaW5hbCByZXF1ZXN0XG4gICAqL1xuICAnc3luYzphYm9ydCcsXG5dLmNvbmNhdChSb290Ll9zdXBwb3J0ZWRFdmVudHMpO1xuXG5Sb290LmluaXRDbGFzcyhTeW5jTWFuYWdlcik7XG5tb2R1bGUuZXhwb3J0cyA9IFN5bmNNYW5hZ2VyO1xuIl19
