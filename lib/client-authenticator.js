'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Layer Client.  Access the layer by calling create and receiving it
 * from the "ready" callback.

  var client = new layer.Client({
    appId: "layer:///apps/staging/ffffffff-ffff-ffff-ffff-ffffffffffff",
    isTrustedDevice: false,
    challenge: function(evt) {
      myAuthenticator({
        nonce: evt.nonce,
        onSuccess: evt.callback
      });
    },
    ready: function(client) {
      alert("Yay, I finally got my client!");
    }
  }).connect("sampleuserId");

 * The Layer Client/ClientAuthenticator classes have been divided into:
 *
 * 1. ClientAuthenticator: Manages all authentication and connectivity related issues
 * 2. Client: Manages access to Conversations, Queries, Messages, Events, etc...
 *
 * @class layer.ClientAuthenticator
 * @private
 * @extends layer.Root
 * @author Michael Kantor
 *
 */

var xhr = require('./xhr');
var Root = require('./root');
var SocketManager = require('./websockets/socket-manager');
var WebsocketChangeManager = require('./websockets/change-manager');
var WebsocketRequestManager = require('./websockets/request-manager');
var LayerError = require('./layer-error');
var OnlineManager = require('./online-state-manager');
var SyncManager = require('./sync-manager');
var DbManager = require('./db-manager');
var Identity = require('./identity');

var _require = require('./sync-event');

var XHRSyncEvent = _require.XHRSyncEvent;
var WebsocketSyncEvent = _require.WebsocketSyncEvent;

var _require2 = require('./const');

var ACCEPT = _require2.ACCEPT;
var LOCALSTORAGE_KEYS = _require2.LOCALSTORAGE_KEYS;

var logger = require('./logger');
var Util = require('./client-utils');

var MAX_XHR_RETRIES = 3;

var ClientAuthenticator = function (_Root) {
  _inherits(ClientAuthenticator, _Root);

  /**
   * Create a new Client.
   *
   * The appId is the only required parameter:
   *
   *      var client = new Client({
   *          appId: "layer:///apps/staging/uuid"
   *      });
   *
   * For trusted devices, you can enable storage of data to indexedDB and localStorage with the `isTrustedDevice` and `isPersistenceEnabled` property:
   *
   *      var client = new Client({
   *          appId: "layer:///apps/staging/uuid",
   *          isTrustedDevice: true,
   *          isPersistenceEnabled: true
   *      });
   *
   * @method constructor
   * @param  {Object} options
   * @param  {string} options.appId           - "layer:///apps/production/uuid"; Identifies what
   *                                            application we are connecting to.
   * @param  {string} [options.url=https://api.layer.com] - URL to log into a different REST server
   * @param {number} [options.logLevel=ERROR] - Provide a log level that is one of layer.Constants.LOG.NONE, layer.Constants.LOG.ERROR,
   *                                            layer.Constants.LOG.WARN, layer.Constants.LOG.INFO, layer.Constants.LOG.DEBUG
   * @param {boolean} [options.isTrustedDevice=false] - If this is not a trusted device, no data will be written to indexedDB nor localStorage,
   *                                            regardless of any values in layer.Client.persistenceFeatures.
   * @param {Object} [options.isPersistenceEnabled=false] If layer.Client.isPersistenceEnabled is true, then indexedDB will be used to manage a cache
   *                                            allowing Query results, messages sent, and all local modifications to be persisted between page reloads.
   */
  function ClientAuthenticator(options) {
    _classCallCheck(this, ClientAuthenticator);

    // Validate required parameters
    if (!options.appId) throw new Error(LayerError.dictionary.appIdMissing);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(ClientAuthenticator).call(this, options));
  }

  /**
   * Initialize the subcomponents of the ClientAuthenticator
   *
   * @method _initComponents
   * @private
   */


  _createClass(ClientAuthenticator, [{
    key: '_initComponents',
    value: function _initComponents() {
      // Setup the websocket manager; won't connect until we trigger an authenticated event
      this.socketManager = new SocketManager({
        client: this
      });

      this.socketChangeManager = new WebsocketChangeManager({
        client: this,
        socketManager: this.socketManager
      });

      this.socketRequestManager = new WebsocketRequestManager({
        client: this,
        socketManager: this.socketManager
      });

      this.onlineManager = new OnlineManager({
        socketManager: this.socketManager,
        testUrl: this.url + '/nonces?connection-test',
        connected: this._handleOnlineChange.bind(this),
        disconnected: this._handleOnlineChange.bind(this)
      });

      this.syncManager = new SyncManager({
        onlineManager: this.onlineManager,
        socketManager: this.socketManager,
        requestManager: this.socketRequestManager,
        client: this
      });
    }

    /**
     * Destroy the subcomponents of the ClientAuthenticator
     *
     * @method _destroyComponents
     * @private
     */

  }, {
    key: '_destroyComponents',
    value: function _destroyComponents() {
      this.syncManager.destroy();
      this.onlineManager.destroy();
      this.socketManager.destroy();
      this.socketChangeManager.destroy();
      this.socketRequestManager.destroy();
      if (this.dbManager) this.dbManager.destroy();
    }

    /**
     * Is Persisted Session Tokens disabled?
     *
     * @method _isPersistedSessionsDisabled
     * @returns {Boolean}
     * @private
     */

  }, {
    key: '_isPersistedSessionsDisabled',
    value: function _isPersistedSessionsDisabled() {
      return !global.localStorage || this.persistenceFeatures && !this.persistenceFeatures.sessionToken;
    }

    /**
     * Restore the sessionToken from localStorage.
     *
     * This sets the sessionToken rather than returning the token.
     *
     * @method _restoreLastSession
     * @private
     */

  }, {
    key: '_restoreLastSession',
    value: function _restoreLastSession() {
      if (this._isPersistedSessionsDisabled()) return;
      try {
        var sessionData = global.localStorage[LOCALSTORAGE_KEYS.SESSIONDATA + this.appId];
        if (!sessionData) return;
        var parsedData = JSON.parse(sessionData);
        if (parsedData.expires < Date.now()) {
          global.localStorage.removeItem(LOCALSTORAGE_KEYS.SESSIONDATA + this.appId);
        } else {
          this.sessionToken = parsedData.sessionToken;
        }
      } catch (error) {
        // No-op
      }
    }

    /**
       * Restore the Identity for the session owner from localStorage.
       *
       * @method _restoreLastSession
       * @private
       * @return {layer.Identity}
       */

  }, {
    key: '_restoreLastUser',
    value: function _restoreLastUser() {
      try {
        var sessionData = global.localStorage[LOCALSTORAGE_KEYS.SESSIONDATA + this.appId];
        if (!sessionData) return null;
        var userObj = JSON.parse(sessionData).user;
        return new Identity({
          clientId: this.appId,
          sessionOwner: true,
          fromServer: userObj
        });
      } catch (error) {
        return null;
      }
    }

    /**
     * Has the userID changed since the last login?
     *
     * @method _hasUserIdChanged
     * @param {string} userId
     * @returns {boolean}
     * @private
     */

  }, {
    key: '_hasUserIdChanged',
    value: function _hasUserIdChanged(userId) {
      try {
        var sessionData = global.localStorage[LOCALSTORAGE_KEYS.SESSIONDATA + this.appId];
        if (!sessionData) return true;
        return JSON.parse(sessionData).user.user_id !== userId;
      } catch (error) {
        return true;
      }
    }

    /**
     * Initiates the connection.
     *
     * Called by constructor().
     *
     * Will either attempt to validate the cached sessionToken by getting converations,
     * or if no sessionToken, will call /nonces to start process of getting a new one.
     *
     * ```javascript
     * var client = new layer.Client({appId: myAppId});
     * client.connect('Frodo-the-Dodo');
     * ```
     *
     * @method connect
     * @param {string} userId - User ID of the user you are logging in as
     * @returns {layer.ClientAuthenticator} this
     */

  }, {
    key: 'connect',
    value: function connect() {
      var _this2 = this;

      var userId = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];

      var user = void 0;
      this.isConnected = false;
      this.user = null;
      this.onlineManager.start();
      if (!this.isTrustedDevice || !userId || this._isPersistedSessionsDisabled() || this._hasUserIdChanged(userId)) {
        this._clearStoredData();
      }

      if (this.isTrustedDevice && userId) {
        this._restoreLastSession(userId);
        user = this._restoreLastUser();
        if (user) this.user = user;
      }

      if (!this.user) {
        this.user = new Identity({
          userId: userId,
          sessionOwner: true,
          clientId: this.appId,
          id: userId ? Identity.prefixUUID + encodeURIComponent(userId) : ''
        });
      }

      if (this.sessionToken && this.user.userId) {
        this._sessionTokenRestored();
      } else {
        this.xhr({
          url: '/nonces',
          method: 'POST',
          sync: false
        }, function (result) {
          return _this2._connectionResponse(result);
        });
      }
      return this;
    }

    /**
     * Initiates the connection with a session token.
     *
     * This call is for use when you have received a Session Token from some other source; such as your server,
     * and wish to use that instead of doing a full auth process.
     *
     * The Client will presume the token to be valid, and will asynchronously trigger the `ready` event.
     * If the token provided is NOT valid, this won't be detected until a request is made using this token,
     * at which point the `challenge` method will trigger.
     *
     * NOTE: The `connected` event will not be triggered on this path.
     *
     * ```javascript
     * var client = new layer.Client({appId: myAppId});
     * client.connectWithSession('Frodo-the-Dodo', mySessionToken);
     * ```
     *
     * @method connectWithSession
     * @param {String} userId
     * @param {String} sessionToken
     * @returns {layer.ClientAuthenticator} this
     */

  }, {
    key: 'connectWithSession',
    value: function connectWithSession(userId, sessionToken) {
      var _this3 = this;

      var user = void 0;
      this.user = null;
      if (!userId || !sessionToken) throw new Error(LayerError.dictionary.sessionAndUserRequired);
      if (!this.isTrustedDevice || this._isPersistedSessionsDisabled() || this._hasUserIdChanged(userId)) {
        this._clearStoredData();
      }
      if (this.isTrustedDevice) {
        user = this._restoreLastUser();
        if (user) this.user = user;
      }

      this.onlineManager.start();

      if (!this.user) {
        this.user = new Identity({
          userId: userId,
          sessionOwner: true,
          clientId: this.appId,
          id: Identity.prefixUUID + encodeURIComponent(userId)
        });
      }

      this.isConnected = true;
      setTimeout(function () {
        return _this3._authComplete({ session_token: sessionToken }, false);
      }, 1);
      return this;
    }

    /**
     * Called when our request for a nonce gets a response.
     *
     * If there is an error, calls _connectionError.
     *
     * If there is nonce, calls _connectionComplete.
     *
     * @method _connectionResponse
     * @private
     * @param  {Object} result
     */

  }, {
    key: '_connectionResponse',
    value: function _connectionResponse(result) {
      if (!result.success) {
        this._connectionError(result.data);
      } else {
        this._connectionComplete(result.data);
      }
    }

    /**
     * We are now connected (we have a nonce).
     *
     * If we have successfully retrieved a nonce, then
     * we have entered a "connected" but not "authenticated" state.
     * Set the state, trigger any events, and then start authentication.
     *
     * @method _connectionComplete
     * @private
     * @param  {Object} result
     * @param  {string} result.nonce - The nonce provided by the server
     *
     * @fires connected
     */

  }, {
    key: '_connectionComplete',
    value: function _connectionComplete(result) {
      this.isConnected = true;
      this.trigger('connected');
      this._authenticate(result.nonce);
    }

    /**
     * Called when we fail to get a nonce.
     *
     * @method _connectionError
     * @private
     * @param  {layer.LayerError} err
     *
     * @fires connected-error
     */

  }, {
    key: '_connectionError',
    value: function _connectionError(error) {
      this.trigger('connected-error', { error: error });
    }

    /* CONNECT METHODS END */

    /* AUTHENTICATE METHODS BEGIN */

    /**
     * Start the authentication step.
     *
     * We start authentication by triggering a "challenge" event that
     * tells the app to use the nonce to obtain an identity_token.
     *
     * @method _authenticate
     * @private
     * @param  {string} nonce - The nonce to provide your identity provider service
     *
     * @fires challenge
     */

  }, {
    key: '_authenticate',
    value: function _authenticate(nonce) {
      if (nonce) {
        this.trigger('challenge', {
          nonce: nonce,
          callback: this.answerAuthenticationChallenge.bind(this)
        });
      }
    }

    /**
     * Accept an identityToken and use it to create a session.
     *
     * Typically, this method is called using the function pointer provided by
     * the challenge event, but it can also be called directly.
     *
     *      getIdentityToken(nonce, function(identityToken) {
     *          client.answerAuthenticationChallenge(identityToken);
     *      });
     *
     * @method answerAuthenticationChallenge
     * @param  {string} identityToken - Identity token provided by your identity provider service
     */

  }, {
    key: 'answerAuthenticationChallenge',
    value: function answerAuthenticationChallenge(identityToken) {
      var _this4 = this;

      // Report an error if no identityToken provided
      if (!identityToken) {
        throw new Error(LayerError.dictionary.identityTokenMissing);
      } else {
        var userData = Util.decode(identityToken.split('.')[1]);
        var identityObj = JSON.parse(userData);

        if (this.user.userId && this.user.userId !== identityObj.prn) throw new Error(LayerError.dictionary.invalidUserIdChange);

        this.user._setUserId(identityObj.prn);

        if (identityObj.display_name) this.user.displayName = identityObj.display_name;
        if (identityObj.avatar_url) this.user.avatarUrl = identityObj.avatar_url;

        this.xhr({
          url: '/sessions',
          method: 'POST',
          sync: false,
          data: {
            identity_token: identityToken,
            app_id: this.appId
          }
        }, function (result) {
          return _this4._authResponse(result, identityToken);
        });
      }
    }

    /**
     * Called when our request for a sessionToken receives a response.
     *
     * @private
     * @method _authResponse
     * @param  {Object} result
     * @param  {string} identityToken
     */

  }, {
    key: '_authResponse',
    value: function _authResponse(result, identityToken) {
      if (!result.success) {
        this._authError(result.data, identityToken);
      } else {
        this._authComplete(result.data, false);
      }
    }

    /**
     * Authentication is completed, update state and trigger events.
     *
     * @method _authComplete
     * @private
     * @param  {Object} result
     * @param  {Boolean} fromPersistence
     * @param  {string} result.session_token - Session token received from the server
     *
     * @fires authenticated
     */

  }, {
    key: '_authComplete',
    value: function _authComplete(result, fromPersistence) {
      if (!result || !result.session_token) {
        throw new Error(LayerError.dictionary.sessionTokenMissing);
      }
      this.sessionToken = result.session_token;

      // If _authComplete was called because we accepted an auth loaded from storage
      // we don't need to update storage.
      if (!this._isPersistedSessionsDisabled() && !fromPersistence) {
        try {
          global.localStorage[LOCALSTORAGE_KEYS.SESSIONDATA + this.appId] = JSON.stringify({
            sessionToken: this.sessionToken || '',
            user: DbManager.prototype._getIdentityData([this.user], true)[0],
            expires: Date.now() + 30 * 60 * 60 * 24 * 1000
          });
        } catch (e) {
          // Do nothing
        }
      }

      this._clientAuthenticated();
    }

    /**
     * Authentication has failed.
     *
     * @method _authError
     * @private
     * @param  {layer.LayerError} result
     * @param  {string} identityToken Not currently used
     *
     * @fires authenticated-error
     */

  }, {
    key: '_authError',
    value: function _authError(error, identityToken) {
      this.trigger('authenticated-error', { error: error });
    }

    /**
     * Sets state and triggers events for both connected and authenticated.
     *
     * If reusing a sessionToken cached in localStorage,
     * use this method rather than _authComplete.
     *
     * @method _sessionTokenRestored
     * @private
     *
     * @fires connected, authenticated
     */

  }, {
    key: '_sessionTokenRestored',
    value: function _sessionTokenRestored() {
      this.isConnected = true;
      this.trigger('connected');
      this._clientAuthenticated();
    }

    /**
     * The client is now authenticated, and doing some setup
     * before calling _clientReady.
     *
     * @method _clientAuthenticated
     * @private
     */

  }, {
    key: '_clientAuthenticated',
    value: function _clientAuthenticated() {
      var _this5 = this;

      // Update state and trigger the event
      this.isAuthenticated = true;
      this.trigger('authenticated');

      if (!this.isTrustedDevice) this.isPersistenceEnabled = false;

      // If no persistenceFeatures are specified, set them all
      // to true or false to match isTrustedDevice.
      if (!this.persistenceFeatures || !this.isPersistenceEnabled) {
        var sessionToken = void 0;
        if (this.persistenceFeatures && 'sessionToken' in this.persistenceFeatures) {
          sessionToken = Boolean(this.persistenceFeatures.sessionToken);
        } else {
          sessionToken = this.isTrustedDevice;
        }
        this.persistenceFeatures = {
          conversations: this.isPersistenceEnabled,
          messages: this.isPersistenceEnabled,
          syncQueue: this.isPersistenceEnabled,
          sessionToken: sessionToken
        };
      }

      // Setup the Database Manager
      if (!this.dbManager) {
        this.dbManager = new DbManager({
          client: this,
          tables: this.persistenceFeatures
        });
      }

      // Before calling _clientReady, load the session owner's full Identity.
      if (this.isPersistenceEnabled) {
        this.dbManager.onOpen(function () {
          return _this5._loadUser();
        });
      } else {
        this._loadUser();
      }
    }

    /**
     * Load the session owner's full identity.
     *
     * Note that failure to load the identity will not prevent
     * _clientReady, but is certainly not a desired outcome.
     *
     * @method _loadUser
     */

  }, {
    key: '_loadUser',
    value: function _loadUser() {
      var _this6 = this;

      // We're done if we got the full identity from localStorage.
      if (this.user.isFullIdentity) {
        this._clientReady();
      } else {
        // load the user's full Identity and update localStorage
        this.user._load();
        this.user.once('identities:loaded', function () {
          if (!_this6._isPersistedSessionsDisabled()) {
            try {
              // Update the session data in localStorage with our full Identity.
              var sessionData = JSON.parse(global.localStorage[LOCALSTORAGE_KEYS.SESSIONDATA + _this6.appId]);
              sessionData.user = DbManager.prototype._getIdentityData([_this6.user])[0];
              global.localStorage[LOCALSTORAGE_KEYS.SESSIONDATA + _this6.appId] = JSON.stringify(sessionData);
            } catch (e) {
              // no-op
            }
          }
          _this6._clientReady();
        }).once('identities:loaded-error', function () {
          if (!_this6.user.displayName) _this6.user.displayName = _this6.defaultOwnerDisplayName;
          _this6._clientReady();
        });
      }
    }

    /**
     * Called to flag the client as ready for action.
     *
     * This method is called after authenication AND
     * after initial conversations have been loaded.
     *
     * @method _clientReady
     * @private
     * @fires ready
     */

  }, {
    key: '_clientReady',
    value: function _clientReady() {
      if (!this.isReady) {
        this.isReady = true;
        this.trigger('ready');
      }
    }

    /* CONNECT METHODS END */

    /* START SESSION MANAGEMENT METHODS */

    /**
     * Deletes your sessionToken from the server, and removes all user data from the Client.
     * Call `client.connect()` to restart the authentication process.
     *
     * This call is asynchronous; some browsers (ahem, safari...) may not have completed the deletion of
     * persisted data if you
     * navigate away from the page.  Use the callback to determine when all necessary cleanup has completed
     * prior to navigating away.
     *
     * Note that while all data should be purged from the browser/device, if you are offline when this is called,
     * your session token will NOT be deleted from the web server.  Why not? Because it would involve retaining the
     * request after all of the user's data has been deleted, or NOT deleting the user's data until we are online.
     *
     * @method logout
     * @param {Function} callback
     * @return {layer.ClientAuthenticator} this
     */

  }, {
    key: 'logout',
    value: function logout(callback) {
      var callbackCount = 1,
          counter = 0;
      if (this.isAuthenticated) {
        callbackCount++;
        this.xhr({
          method: 'DELETE',
          url: '/sessions/' + escape(this.sessionToken),
          sync: false
        }, function () {
          counter++;
          if (counter === callbackCount && callback) callback();
        });
      }

      // Clear data even if isAuthenticated is false
      // Session may have expired, but data still cached.
      this._clearStoredData(function () {
        counter++;
        if (counter === callbackCount && callback) callback();
      });

      this._resetSession();
      return this;
    }
  }, {
    key: '_clearStoredData',
    value: function _clearStoredData(callback) {
      if (global.localStorage) localStorage.removeItem(LOCALSTORAGE_KEYS.SESSIONDATA + this.appId);
      if (this.dbManager) {
        this.dbManager.deleteTables(callback);
      } else if (callback) {
        callback();
      }
    }

    /**
     * Log out/clear session information.
     *
     * Use this to clear the sessionToken and all information from this session.
     *
     * @method _resetSession
     * @private
     */

  }, {
    key: '_resetSession',
    value: function _resetSession() {
      this.isReady = false;
      if (this.sessionToken) {
        this.sessionToken = '';
        if (global.localStorage) {
          localStorage.removeItem(LOCALSTORAGE_KEYS.SESSIONDATA + this.appId);
        }
      }

      this.isConnected = false;
      this.isAuthenticated = false;

      this.trigger('deauthenticated');
      this.onlineManager.stop();
    }

    /**
     * Register your IOS device to receive notifications.
     * For use with native code only (Cordova, React Native, Titanium, etc...)
     *
     * @method registerIOSPushToken
     * @param {Object} options
     * @param {string} options.deviceId - Your IOS device's device ID
     * @param {string} options.iosVersion - Your IOS device's version number
     * @param {string} options.token - Your Apple APNS Token
     * @param {string} [options.bundleId] - Your Apple APNS Bundle ID ("com.layer.bundleid")
     * @param {Function} [callback=null] - Optional callback
     * @param {layer.LayerError} callback.error - LayerError if there was an error; null if successful
     */

  }, {
    key: 'registerIOSPushToken',
    value: function registerIOSPushToken(options, callback) {
      this.xhr({
        url: 'push_tokens',
        method: 'POST',
        sync: false,
        data: {
          token: options.token,
          type: 'apns',
          device_id: options.deviceId,
          ios_version: options.iosVersion,
          apns_bundle_id: options.bundleId
        }
      }, function (result) {
        return callback(result.data);
      });
    }

    /**
     * Register your Android device to receive notifications.
     * For use with native code only (Cordova, React Native, Titanium, etc...)
     *
     * @method registerAndroidPushToken
     * @param {Object} options
     * @param {string} options.deviceId - Your IOS device's device ID
     * @param {string} options.token - Your GCM push Token
     * @param {string} options.senderId - Your GCM Sender ID/Project Number
     * @param {Function} [callback=null] - Optional callback
     * @param {layer.LayerError} callback.error - LayerError if there was an error; null if successful
     */

  }, {
    key: 'registerAndroidPushToken',
    value: function registerAndroidPushToken(options, callback) {
      this.xhr({
        url: 'push_tokens',
        method: 'POST',
        sync: false,
        data: {
          token: options.token,
          type: 'gcm',
          device_id: options.deviceId,
          gcm_sender_id: options.senderId
        }
      }, function (result) {
        return callback(result.data);
      });
    }

    /**
     * Register your Android device to receive notifications.
     * For use with native code only (Cordova, React Native, Titanium, etc...)
     *
     * @method unregisterPushToken
     * @param {string} deviceId - Your IOS device's device ID
     * @param {Function} [callback=null] - Optional callback
     * @param {layer.LayerError} callback.error - LayerError if there was an error; null if successful
     */

  }, {
    key: 'unregisterPushToken',
    value: function unregisterPushToken(deviceId, callback) {
      this.xhr({
        url: 'push_tokens/' + deviceId,
        method: 'DELETE'
      }, function (result) {
        return callback(result.data);
      });
    }

    /* SESSION MANAGEMENT METHODS END */

    /* ACCESSOR METHODS BEGIN */

    /**
     * __ Methods are automatically called by property setters.
     *
     * Any attempt to execute `this.userAppId = 'xxx'` will cause an error to be thrown
     * if the client is already connected.
     *
     * @private
     * @method __adjustAppId
     * @param {string} value - New appId value
     */

  }, {
    key: '__adjustAppId',
    value: function __adjustAppId() {
      if (this.isConnected) throw new Error(LayerError.dictionary.cantChangeIfConnected);
    }

    /**
     * __ Methods are automatically called by property setters.
     *
     * Any attempt to execute `this.user = userIdentity` will cause an error to be thrown
     * if the client is already connected.
     *
     * @private
     * @method __adjustUser
     * @param {string} user - new Identity object
     */

  }, {
    key: '__adjustUser',
    value: function __adjustUser(user) {
      if (this.isConnected) {
        throw new Error(LayerError.dictionary.cantChangeIfConnected);
      }
    }

    // Virtual methods

  }, {
    key: '_addIdentity',
    value: function _addIdentity(identity) {}
  }, {
    key: '_removeIdentity',
    value: function _removeIdentity(identity) {}

    /* ACCESSOR METHODS END */

    /* COMMUNICATIONS METHODS BEGIN */

  }, {
    key: 'sendSocketRequest',
    value: function sendSocketRequest(params, callback) {
      if (params.sync) {
        var target = params.sync.target;
        var depends = params.sync.depends;
        if (target && !depends) depends = [target];

        this.syncManager.request(new WebsocketSyncEvent({
          data: params.body,
          operation: params.method,
          target: target,
          depends: depends,
          callback: callback
        }));
      } else {
        if (typeof params.data === 'function') params.data = params.data();
        this.socketRequestManager.sendRequest(params, callback);
      }
    }

    /**
     * This event handler receives events from the Online State Manager and generates an event for those subscribed
     * to client.on('online')
     *
     * @method _handleOnlineChange
     * @private
     * @param {layer.LayerEvent} evt
     */

  }, {
    key: '_handleOnlineChange',
    value: function _handleOnlineChange(evt) {
      if (!this.isAuthenticated) return;
      var duration = evt.offlineDuration;
      var isOnline = evt.eventName === 'connected';
      var obj = { isOnline: isOnline };
      if (isOnline) {
        obj.reset = duration > ClientAuthenticator.ResetAfterOfflineDuration;
      }
      this.trigger('online', obj);
    }

    /**
     * Main entry point for sending xhr requests or for queing them in the syncManager.
     *
     * This call adjust arguments for our REST server.
     *
     * @method xhr
     * @protected
     * @param  {Object}   options
     * @param  {string}   options.url - URL relative client's url: "/conversations"
     * @param  {Function} callback
     * @param  {Object}   callback.result
     * @param  {Mixed}    callback.result.data - If an error occurred, this is a layer.LayerError;
     *                                          If the response was application/json, this will be an object
     *                                          If the response was text/empty, this will be text/empty
     * @param  {XMLHttpRequest} callback.result.xhr - Native xhr request object for detailed analysis
     * @param  {Object}         callback.result.Links - Hash of Link headers
     * @return {layer.ClientAuthenticator} this
     */

  }, {
    key: 'xhr',
    value: function xhr(options, callback) {
      if (!options.sync || !options.sync.target) {
        options.url = this._xhrFixRelativeUrls(options.url || '');
      }

      options.withCredentials = true;
      if (!options.method) options.method = 'GET';
      if (!options.headers) options.headers = {};
      this._xhrFixHeaders(options.headers);
      this._xhrFixAuth(options.headers);

      // Note: this is not sync vs async; this is syncManager vs fire it now
      if (options.sync === false) {
        this._nonsyncXhr(options, callback, 0);
      } else {
        this._syncXhr(options, callback);
      }
      return this;
    }

    /**
     * For xhr calls that go through the sync manager, queue it up.
     *
     * @method _syncXhr
     * @private
     * @param  {Object}   options
     * @param  {Function} callback
     */

  }, {
    key: '_syncXhr',
    value: function _syncXhr(options, callback) {
      var _this7 = this;

      if (!options.sync) options.sync = {};
      var innerCallback = function innerCallback(result) {
        _this7._xhrResult(result, callback);
      };
      var target = options.sync.target;
      var depends = options.sync.depends;
      if (target && !depends) depends = [target];

      this.syncManager.request(new XHRSyncEvent({
        url: options.url,
        data: options.data,
        method: options.method,
        operation: options.sync.operation || options.method,
        headers: options.headers,
        callback: innerCallback,
        target: target,
        depends: depends
      }));
    }

    /**
     * For xhr calls that don't go through the sync manager,
     * fire the request, and if it fails, refire it up to 3 tries
     * before reporting an error.  1 second delay between requests
     * so whatever issue is occuring is a tiny bit more likely to resolve,
     * and so we don't hammer the server every time there's a problem.
     *
     * @method _nonsyncXhr
     * @private
     * @param  {Object}   options
     * @param  {Function} callback
     * @param  {number}   retryCount
     */

  }, {
    key: '_nonsyncXhr',
    value: function _nonsyncXhr(options, callback, retryCount) {
      var _this8 = this;

      xhr(options, function (result) {
        if ([502, 503, 504].indexOf(result.status) !== -1 && retryCount < MAX_XHR_RETRIES) {
          setTimeout(function () {
            return _this8._nonsyncXhr(options, callback, retryCount + 1);
          }, 1000);
        } else {
          _this8._xhrResult(result, callback);
        }
      });
    }

    /**
     * Fix authentication header for an xhr request
     *
     * @method _xhrFixAuth
     * @private
     * @param  {Object} headers
     */

  }, {
    key: '_xhrFixAuth',
    value: function _xhrFixAuth(headers) {
      if (this.sessionToken && !headers.Authorization) {
        headers.authorization = 'Layer session-token="' + this.sessionToken + '"'; // eslint-disable-line
      }
    }

    /**
     * Fix relative URLs to create absolute URLs needed for CORS requests.
     *
     * @method _xhrFixRelativeUrls
     * @private
     * @param  {string} relative or absolute url
     * @return {string} absolute url
     */

  }, {
    key: '_xhrFixRelativeUrls',
    value: function _xhrFixRelativeUrls(url) {
      var result = url;
      if (url.indexOf('https://') === -1) {
        if (url[0] === '/') {
          result = this.url + url;
        } else {
          result = this.url + '/' + url;
        }
      }
      return result;
    }

    /**
     * Fixup all headers in preparation for an xhr call.
     *
     * 1. All headers use lower case names for standard/easy lookup
     * 2. Set the accept header
     * 3. If needed, set the content-type header
     *
     * @method _xhrFixHeaders
     * @private
     * @param  {Object} headers
     */

  }, {
    key: '_xhrFixHeaders',
    value: function _xhrFixHeaders(headers) {
      // Replace all headers in arbitrary case with all lower case
      // for easy matching.
      var headerNameList = Object.keys(headers);
      headerNameList.forEach(function (headerName) {
        if (headerName !== headerName.toLowerCase()) {
          headers[headerName.toLowerCase()] = headers[headerName];
          delete headers[headerName];
        }
      });

      if (!headers.accept) headers.accept = ACCEPT;

      if (!headers['content-type']) headers['content-type'] = 'application/json';
    }

    /**
     * Handle the result of an xhr call
     *
     * @method _xhrResult
     * @private
     * @param  {Object}   result     Standard xhr response object from the xhr lib
     * @param  {Function} [callback] Callback on completion
     */

  }, {
    key: '_xhrResult',
    value: function _xhrResult(result, callback) {
      if (this.isDestroyed) return;

      if (!result.success) {
        // Replace the response with a LayerError instance
        if (result.data && _typeof(result.data) === 'object') {
          this._generateError(result);
        }

        // If its an authentication error, reauthenticate
        // don't call _resetSession as that wipes all data and screws with UIs, and the user
        // is still authenticated on the customer's app even if not on Layer.
        if (result.status === 401 && this.isAuthenticated) {
          logger.warn('SESSION EXPIRED!');
          this.isAuthenticated = false;
          if (global.localStorage) localStorage.removeItem(LOCALSTORAGE_KEYS.SESSIONDATA + this.appId);
          this.trigger('deauthenticated');
          this._authenticate(result.data.getNonce());
        }
      }
      if (callback) callback(result);
    }

    /**
     * Transforms xhr error response into a layer.LayerError instance.
     *
     * Adds additional information to the result object including
     *
     * * url
     * * data
     *
     * @method _generateError
     * @private
     * @param  {Object} result - Result of the xhr call
     */

  }, {
    key: '_generateError',
    value: function _generateError(result) {
      result.data = new LayerError(result.data);
      if (!result.data.httpStatus) result.data.httpStatus = result.status;
      result.data.log();
    }

    /* END COMMUNICATIONS METHODS */

  }]);

  return ClientAuthenticator;
}(Root);

/**
 * State variable; indicates that client is currently authenticated by the server.
 * Should never be true if isConnected is false.
 * @type {Boolean}
 * @readonly
 */


ClientAuthenticator.prototype.isAuthenticated = false;

/**
 * State variable; indicates that client is currently connected to server
 * (may not be authenticated yet)
 * @type {Boolean}
 * @readonly
 */
ClientAuthenticator.prototype.isConnected = false;

/**
 * State variable; indicates that client is ready for the app to use.
 * Use the 'ready' event to be notified when this value changes to true.
 *
 * @type {boolean}
 * @readonly
 */
ClientAuthenticator.prototype.isReady = false;

/**
 * Your Layer Application ID. This value can not be changed once connected.
 * To find your Layer Application ID, see your Layer Developer Dashboard.
 *
 * @type {String}
 */
ClientAuthenticator.prototype.appId = '';

/**
 * Identity information about the authenticated user.
 *
 * @type {layer.Identity}
 */
ClientAuthenticator.prototype.user = null;

/**
 * Your current session token that authenticates your requests.
 *
 * @type {String}
 * @readonly
 */
ClientAuthenticator.prototype.sessionToken = '';

/**
 * URL to Layer's Web API server.
 *
 * Only muck with this if told to by Layer Staff.
 * @type {String}
 */
ClientAuthenticator.prototype.url = 'https://api.layer.com';

/**
 * URL to Layer's Websocket server.
 *
 * Only muck with this if told to by Layer Staff.
 * @type {String}
 */
ClientAuthenticator.prototype.websocketUrl = 'wss://websockets.layer.com';

/**
 * Web Socket Manager
 * @type {layer.Websockets.SocketManager}
 */
ClientAuthenticator.prototype.socketManager = null;

/**
 * Web Socket Request Manager
* @type {layer.Websockets.RequestManager}
 */
ClientAuthenticator.prototype.socketRequestManager = null;

/**
 * Web Socket Manager
 * @type {layer.Websockets.ChangeManager}
 */
ClientAuthenticator.prototype.socketChangeManager = null;

/**
 * Service for managing online as well as offline server requests
 * @type {layer.SyncManager}
 */
ClientAuthenticator.prototype.syncManager = null;

/**
 * Service for managing online/offline state and events
 * @type {layer.OnlineStateManager}
 */
ClientAuthenticator.prototype.onlineManager = null;

/**
 * If this is a trusted device, then we can write personal data to persistent memory.
 * @type {boolean}
 */
ClientAuthenticator.prototype.isTrustedDevice = false;

/**
 * To enable indexedDB storage of query data, set this true.  Experimental.
 *
 * @property {boolean}
 */
ClientAuthenticator.prototype.isPersistenceEnabled = false;

/**
 * If this layer.Client.isTrustedDevice is true, then you can control which types of data are persisted.
 *
 * Note that values here are ignored if `isPersistenceEnabled` hasn't been set to `true`.
 *
 * Properties of this Object can be:
 *
 * * identities: Write identities to indexedDB? This allows for faster initialization.
 * * conversations: Write conversations to indexedDB? This allows for faster rendering
 *                  of a Conversation List
 * * messages: Write messages to indexedDB? This allows for full offline access
 * * syncQueue: Write requests made while offline to indexedDB?  This allows the app
 *              to complete sending messages after being relaunched.
 * * sessionToken: Write the session token to localStorage for quick reauthentication on relaunching the app.
 *
 *      new layer.Client({
 *        isTrustedDevice: true,
 *        persistenceFeatures: {
 *          conversations: true,
 *          identities: true,
 *          messages: false,
 *          syncQueue: false,
 *          sessionToken: true
 *        }
 *      });
 *
 * @type {Object}
 */
ClientAuthenticator.prototype.persistenceFeatures = null;

/**
 * Database Manager for read/write to IndexedDB
 * @type {layer.DbManager}
 */
ClientAuthenticator.prototype.dbManager = null;

/**
 * If a display name is not loaded for the session owner, use this name.
 *
 * @type {string}
 */
ClientAuthenticator.prototype.defaultOwnerDisplayName = 'You';

/**
 * Is true if the client is authenticated and connected to the server;
 *
 * Typically used to determine if there is a connection to the server.
 *
 * Typically used in conjunction with the `online` event.
 *
 * @type {boolean}
 */
Object.defineProperty(ClientAuthenticator.prototype, 'isOnline', {
  enumerable: true,
  get: function get() {
    return this.onlineManager && this.onlineManager.isOnline;
  }
});

/**
 * Log levels; one of:
 *
 *    * layer.Constants.LOG.NONE
 *    * layer.Constants.LOG.ERROR
 *    * layer.Constants.LOG.WARN
 *    * layer.Constants.LOG.INFO
 *    * layer.Constants.LOG.DEBUG
 *
 * @type {number}
 */
Object.defineProperty(ClientAuthenticator.prototype, 'logLevel', {
  enumerable: false,
  get: function get() {
    return logger.level;
  },
  set: function set(value) {
    logger.level = value;
  }
});

/**
 * Short hand for getting the userId of the authenticated user.
 *
 * Could also just use client.user.userId
 *
 * @type {string} userId
 */
Object.defineProperty(ClientAuthenticator.prototype, 'userId', {
  enumerable: true,
  get: function get() {
    return this.user ? this.user.userId : '';
  },
  set: function set() {}
});

/**
 * Time to be offline after which we don't do a WebSocket Events.replay,
 * but instead just refresh all our Query data.  Defaults to 30 hours.
 *
 * @type {number}
 * @static
 */
ClientAuthenticator.ResetAfterOfflineDuration = 1000 * 60 * 60 * 30;

/**
 * List of events supported by this class
 * @static
 * @protected
 * @type {string[]}
 */
ClientAuthenticator._supportedEvents = [
/**
 * The client is ready for action
 *
 *      client.on('ready', function(evt) {
 *          renderMyUI();
 *      });
 *
 * @event
 */
'ready',

/**
 * Fired when connected to the server.
 * Currently just means we have a nonce.
 * Not recommended for typical applications.
 * @event connected
 */
'connected',

/**
 * Fired when unsuccessful in obtaining a nonce.
 *
 * Not recommended for typical applications.
 * @event connected-error
 * @param {Object} event
 * @param {layer.LayerError} event.error
 */
'connected-error',

/**
 * We now have a session and any requests we send aught to work.
 * Typically you should use the ready event instead of the authenticated event.
 * @event authenticated
 */
'authenticated',

/**
 * Failed to authenticate your client.
 *
 * Either your identity-token was invalid, or something went wrong
 * using your identity-token.
 *
 * @event authenticated-error
 * @param {Object} event
 * @param {layer.LayerError} event.error
 */
'authenticated-error',

/**
 * This event fires when a session has expired or when `layer.Client.logout` is called.
 * Typically, it is enough to subscribe to the challenge event
 * which will let you reauthenticate; typical applications do not need
 * to subscribe to this.
 *
 * @event deauthenticated
 */
'deauthenticated',

/**
 * @event challenge
 * Verify the user's identity.
 *
 * This event is where you verify that the user is who we all think the user is,
 * and provide an identity token to validate that.
 *
 * ```javascript
 * client.on('challenge', function(evt) {
 *    myGetIdentityForNonce(evt.nonce, function(identityToken) {
 *      evt.callback(identityToken);
 *    });
 * });
 * ```
 *
 * @param {Object} event
 * @param {string} event.nonce - A nonce for you to provide to your identity provider
 * @param {Function} event.callback - Call this once you have an identity-token
 * @param {string} event.callback.identityToken - Identity token provided by your identity provider service
 */
'challenge',

/**
 * @event session-terminated
 * If your session has been terminated in such a way as to prevent automatic reconnect,
 *
 * this event will fire.  Common scenario: user has two tabs open;
 * one tab the user logs out (or you call client.logout()).
 * The other tab will detect that the sessionToken has been removed,
 * and will terminate its session as well.  In this scenario we do not want
 * to automatically trigger a challenge and restart the login process.
 */
'session-terminated',

/**
 * @event online
 *
 * This event is used to detect when the client is online (connected to the server)
 * or offline (still able to accept API calls but no longer able to sync to the server).
 *
 *      client.on('online', function(evt) {
 *         if (evt.isOnline) {
 *             statusDiv.style.backgroundColor = 'green';
 *         } else {
 *             statusDiv.style.backgroundColor = 'red';
 *         }
 *      });
 *
 * @param {Object} event
 * @param {boolean} event.isOnline
 */
'online'].concat(Root._supportedEvents);

Root.initClass.apply(ClientAuthenticator, [ClientAuthenticator, 'ClientAuthenticator']);

module.exports = ClientAuthenticator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGllbnQtYXV0aGVudGljYXRvci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBOEJBLElBQU0sTUFBTSxRQUFRLE9BQVIsQ0FBWjtBQUNBLElBQU0sT0FBTyxRQUFRLFFBQVIsQ0FBYjtBQUNBLElBQU0sZ0JBQWdCLFFBQVEsNkJBQVIsQ0FBdEI7QUFDQSxJQUFNLHlCQUF5QixRQUFRLDZCQUFSLENBQS9CO0FBQ0EsSUFBTSwwQkFBMEIsUUFBUSw4QkFBUixDQUFoQztBQUNBLElBQU0sYUFBYSxRQUFRLGVBQVIsQ0FBbkI7QUFDQSxJQUFNLGdCQUFnQixRQUFRLHdCQUFSLENBQXRCO0FBQ0EsSUFBTSxjQUFjLFFBQVEsZ0JBQVIsQ0FBcEI7QUFDQSxJQUFNLFlBQVksUUFBUSxjQUFSLENBQWxCO0FBQ0EsSUFBTSxXQUFXLFFBQVEsWUFBUixDQUFqQjs7ZUFDNkMsUUFBUSxjQUFSLEM7O0lBQXJDLFksWUFBQSxZO0lBQWMsa0IsWUFBQSxrQjs7Z0JBQ2dCLFFBQVEsU0FBUixDOztJQUE5QixNLGFBQUEsTTtJQUFRLGlCLGFBQUEsaUI7O0FBQ2hCLElBQU0sU0FBUyxRQUFRLFVBQVIsQ0FBZjtBQUNBLElBQU0sT0FBTyxRQUFRLGdCQUFSLENBQWI7O0FBRUEsSUFBTSxrQkFBa0IsQ0FBeEI7O0lBRU0sbUI7OztBQUVKOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQTZCQSwrQkFBWSxPQUFaLEVBQXFCO0FBQUE7O0FBQ25CO0FBQ0EsUUFBSSxDQUFDLFFBQVEsS0FBYixFQUFvQixNQUFNLElBQUksS0FBSixDQUFVLFdBQVcsVUFBWCxDQUFzQixZQUFoQyxDQUFOOztBQUZELGtHQUliLE9BSmE7QUFLcEI7O0FBRUQ7Ozs7Ozs7Ozs7c0NBTWtCO0FBQ2hCO0FBQ0EsV0FBSyxhQUFMLEdBQXFCLElBQUksYUFBSixDQUFrQjtBQUNyQyxnQkFBUTtBQUQ2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dUI7QUFIYSxDQUFqRTs7QUFNQTs7Ozs7OztBQU9BLE9BQU8sY0FBUCxDQUFzQixvQkFBb0IsU0FBMUMsRUFBcUQsUUFBckQsRUFBK0Q7QUFDN0QsY0FBWSxJQURpRDtBQUU3RCxPQUFLLFNBQVMsR0FBVCxHQUFlO0FBQ2xCLFdBQU8sS0FBSyxJQUFMLEdBQVksS0FBSyxJQUFMLENBQVUsTUFBdEIsR0FBK0IsRUFBdEM7QUFDRCxHQUo0RDtBQUs3RCxPQUFLLFNBQVMsR0FBVCxHQUFlLENBQUU7QUFMdUMsQ0FBL0Q7O0FBUUE7Ozs7Ozs7QUFPQSxvQkFBb0IseUJBQXBCLEdBQWdELE9BQU8sRUFBUCxHQUFZLEVBQVosR0FBaUIsRUFBakU7O0FBRUE7Ozs7OztBQU1BLG9CQUFvQixnQkFBcEIsR0FBdUM7QUFDckM7Ozs7Ozs7OztBQVNBLE9BVnFDOztBQVlyQzs7Ozs7O0FBTUEsV0FsQnFDOztBQW9CckM7Ozs7Ozs7O0FBUUEsaUJBNUJxQzs7QUE4QnJDOzs7OztBQUtBLGVBbkNxQzs7QUFxQ3JDOzs7Ozs7Ozs7O0FBVUEscUJBL0NxQzs7QUFpRHJDOzs7Ozs7OztBQVFBLGlCQXpEcUM7O0FBMkRyQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFvQkEsV0EvRXFDOztBQWlGckM7Ozs7Ozs7Ozs7QUFVQSxvQkEzRnFDOztBQTZGckM7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBaUJBLFFBOUdxQyxFQStHckMsTUEvR3FDLENBK0c5QixLQUFLLGdCQS9HeUIsQ0FBdkM7O0FBaUhBLEtBQUssU0FBTCxDQUFlLEtBQWYsQ0FBcUIsbUJBQXJCLEVBQTBDLENBQUMsbUJBQUQsRUFBc0IscUJBQXRCLENBQTFDOztBQUVBLE9BQU8sT0FBUCxHQUFpQixtQkFBakIiLCJmaWxlIjoiY2xpZW50LWF1dGhlbnRpY2F0b3IuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIExheWVyIENsaWVudC4gIEFjY2VzcyB0aGUgbGF5ZXIgYnkgY2FsbGluZyBjcmVhdGUgYW5kIHJlY2VpdmluZyBpdFxuICogZnJvbSB0aGUgXCJyZWFkeVwiIGNhbGxiYWNrLlxuXG4gIHZhciBjbGllbnQgPSBuZXcgbGF5ZXIuQ2xpZW50KHtcbiAgICBhcHBJZDogXCJsYXllcjovLy9hcHBzL3N0YWdpbmcvZmZmZmZmZmYtZmZmZi1mZmZmLWZmZmYtZmZmZmZmZmZmZmZmXCIsXG4gICAgaXNUcnVzdGVkRGV2aWNlOiBmYWxzZSxcbiAgICBjaGFsbGVuZ2U6IGZ1bmN0aW9uKGV2dCkge1xuICAgICAgbXlBdXRoZW50aWNhdG9yKHtcbiAgICAgICAgbm9uY2U6IGV2dC5ub25jZSxcbiAgICAgICAgb25TdWNjZXNzOiBldnQuY2FsbGJhY2tcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgcmVhZHk6IGZ1bmN0aW9uKGNsaWVudCkge1xuICAgICAgYWxlcnQoXCJZYXksIEkgZmluYWxseSBnb3QgbXkgY2xpZW50IVwiKTtcbiAgICB9XG4gIH0pLmNvbm5lY3QoXCJzYW1wbGV1c2VySWRcIik7XG5cbiAqIFRoZSBMYXllciBDbGllbnQvQ2xpZW50QXV0aGVudGljYXRvciBjbGFzc2VzIGhhdmUgYmVlbiBkaXZpZGVkIGludG86XG4gKlxuICogMS4gQ2xpZW50QXV0aGVudGljYXRvcjogTWFuYWdlcyBhbGwgYXV0aGVudGljYXRpb24gYW5kIGNvbm5lY3Rpdml0eSByZWxhdGVkIGlzc3Vlc1xuICogMi4gQ2xpZW50OiBNYW5hZ2VzIGFjY2VzcyB0byBDb252ZXJzYXRpb25zLCBRdWVyaWVzLCBNZXNzYWdlcywgRXZlbnRzLCBldGMuLi5cbiAqXG4gKiBAY2xhc3MgbGF5ZXIuQ2xpZW50QXV0aGVudGljYXRvclxuICogQHByaXZhdGVcbiAqIEBleHRlbmRzIGxheWVyLlJvb3RcbiAqIEBhdXRob3IgTWljaGFlbCBLYW50b3JcbiAqXG4gKi9cblxuY29uc3QgeGhyID0gcmVxdWlyZSgnLi94aHInKTtcbmNvbnN0IFJvb3QgPSByZXF1aXJlKCcuL3Jvb3QnKTtcbmNvbnN0IFNvY2tldE1hbmFnZXIgPSByZXF1aXJlKCcuL3dlYnNvY2tldHMvc29ja2V0LW1hbmFnZXInKTtcbmNvbnN0IFdlYnNvY2tldENoYW5nZU1hbmFnZXIgPSByZXF1aXJlKCcuL3dlYnNvY2tldHMvY2hhbmdlLW1hbmFnZXInKTtcbmNvbnN0IFdlYnNvY2tldFJlcXVlc3RNYW5hZ2VyID0gcmVxdWlyZSgnLi93ZWJzb2NrZXRzL3JlcXVlc3QtbWFuYWdlcicpO1xuY29uc3QgTGF5ZXJFcnJvciA9IHJlcXVpcmUoJy4vbGF5ZXItZXJyb3InKTtcbmNvbnN0IE9ubGluZU1hbmFnZXIgPSByZXF1aXJlKCcuL29ubGluZS1zdGF0ZS1tYW5hZ2VyJyk7XG5jb25zdCBTeW5jTWFuYWdlciA9IHJlcXVpcmUoJy4vc3luYy1tYW5hZ2VyJyk7XG5jb25zdCBEYk1hbmFnZXIgPSByZXF1aXJlKCcuL2RiLW1hbmFnZXInKTtcbmNvbnN0IElkZW50aXR5ID0gcmVxdWlyZSgnLi9pZGVudGl0eScpO1xuY29uc3QgeyBYSFJTeW5jRXZlbnQsIFdlYnNvY2tldFN5bmNFdmVudCB9ID0gcmVxdWlyZSgnLi9zeW5jLWV2ZW50Jyk7XG5jb25zdCB7IEFDQ0VQVCwgTE9DQUxTVE9SQUdFX0tFWVMgfSA9IHJlcXVpcmUoJy4vY29uc3QnKTtcbmNvbnN0IGxvZ2dlciA9IHJlcXVpcmUoJy4vbG9nZ2VyJyk7XG5jb25zdCBVdGlsID0gcmVxdWlyZSgnLi9jbGllbnQtdXRpbHMnKTtcblxuY29uc3QgTUFYX1hIUl9SRVRSSUVTID0gMztcblxuY2xhc3MgQ2xpZW50QXV0aGVudGljYXRvciBleHRlbmRzIFJvb3Qge1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgQ2xpZW50LlxuICAgKlxuICAgKiBUaGUgYXBwSWQgaXMgdGhlIG9ubHkgcmVxdWlyZWQgcGFyYW1ldGVyOlxuICAgKlxuICAgKiAgICAgIHZhciBjbGllbnQgPSBuZXcgQ2xpZW50KHtcbiAgICogICAgICAgICAgYXBwSWQ6IFwibGF5ZXI6Ly8vYXBwcy9zdGFnaW5nL3V1aWRcIlxuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBGb3IgdHJ1c3RlZCBkZXZpY2VzLCB5b3UgY2FuIGVuYWJsZSBzdG9yYWdlIG9mIGRhdGEgdG8gaW5kZXhlZERCIGFuZCBsb2NhbFN0b3JhZ2Ugd2l0aCB0aGUgYGlzVHJ1c3RlZERldmljZWAgYW5kIGBpc1BlcnNpc3RlbmNlRW5hYmxlZGAgcHJvcGVydHk6XG4gICAqXG4gICAqICAgICAgdmFyIGNsaWVudCA9IG5ldyBDbGllbnQoe1xuICAgKiAgICAgICAgICBhcHBJZDogXCJsYXllcjovLy9hcHBzL3N0YWdpbmcvdXVpZFwiLFxuICAgKiAgICAgICAgICBpc1RydXN0ZWREZXZpY2U6IHRydWUsXG4gICAqICAgICAgICAgIGlzUGVyc2lzdGVuY2VFbmFibGVkOiB0cnVlXG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBtZXRob2QgY29uc3RydWN0b3JcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSAge3N0cmluZ30gb3B0aW9ucy5hcHBJZCAgICAgICAgICAgLSBcImxheWVyOi8vL2FwcHMvcHJvZHVjdGlvbi91dWlkXCI7IElkZW50aWZpZXMgd2hhdFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwbGljYXRpb24gd2UgYXJlIGNvbm5lY3RpbmcgdG8uXG4gICAqIEBwYXJhbSAge3N0cmluZ30gW29wdGlvbnMudXJsPWh0dHBzOi8vYXBpLmxheWVyLmNvbV0gLSBVUkwgdG8gbG9nIGludG8gYSBkaWZmZXJlbnQgUkVTVCBzZXJ2ZXJcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmxvZ0xldmVsPUVSUk9SXSAtIFByb3ZpZGUgYSBsb2cgbGV2ZWwgdGhhdCBpcyBvbmUgb2YgbGF5ZXIuQ29uc3RhbnRzLkxPRy5OT05FLCBsYXllci5Db25zdGFudHMuTE9HLkVSUk9SLFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIuQ29uc3RhbnRzLkxPRy5XQVJOLCBsYXllci5Db25zdGFudHMuTE9HLklORk8sIGxheWVyLkNvbnN0YW50cy5MT0cuREVCVUdcbiAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5pc1RydXN0ZWREZXZpY2U9ZmFsc2VdIC0gSWYgdGhpcyBpcyBub3QgYSB0cnVzdGVkIGRldmljZSwgbm8gZGF0YSB3aWxsIGJlIHdyaXR0ZW4gdG8gaW5kZXhlZERCIG5vciBsb2NhbFN0b3JhZ2UsXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWdhcmRsZXNzIG9mIGFueSB2YWx1ZXMgaW4gbGF5ZXIuQ2xpZW50LnBlcnNpc3RlbmNlRmVhdHVyZXMuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5pc1BlcnNpc3RlbmNlRW5hYmxlZD1mYWxzZV0gSWYgbGF5ZXIuQ2xpZW50LmlzUGVyc2lzdGVuY2VFbmFibGVkIGlzIHRydWUsIHRoZW4gaW5kZXhlZERCIHdpbGwgYmUgdXNlZCB0byBtYW5hZ2UgYSBjYWNoZVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWxsb3dpbmcgUXVlcnkgcmVzdWx0cywgbWVzc2FnZXMgc2VudCwgYW5kIGFsbCBsb2NhbCBtb2RpZmljYXRpb25zIHRvIGJlIHBlcnNpc3RlZCBiZXR3ZWVuIHBhZ2UgcmVsb2Fkcy5cbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICAvLyBWYWxpZGF0ZSByZXF1aXJlZCBwYXJhbWV0ZXJzXG4gICAgaWYgKCFvcHRpb25zLmFwcElkKSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmFwcElkTWlzc2luZyk7XG5cbiAgICBzdXBlcihvcHRpb25zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplIHRoZSBzdWJjb21wb25lbnRzIG9mIHRoZSBDbGllbnRBdXRoZW50aWNhdG9yXG4gICAqXG4gICAqIEBtZXRob2QgX2luaXRDb21wb25lbnRzXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfaW5pdENvbXBvbmVudHMoKSB7XG4gICAgLy8gU2V0dXAgdGhlIHdlYnNvY2tldCBtYW5hZ2VyOyB3b24ndCBjb25uZWN0IHVudGlsIHdlIHRyaWdnZXIgYW4gYXV0aGVudGljYXRlZCBldmVudFxuICAgIHRoaXMuc29ja2V0TWFuYWdlciA9IG5ldyBTb2NrZXRNYW5hZ2VyKHtcbiAgICAgIGNsaWVudDogdGhpcyxcbiAgICB9KTtcblxuICAgIHRoaXMuc29ja2V0Q2hhbmdlTWFuYWdlciA9IG5ldyBXZWJzb2NrZXRDaGFuZ2VNYW5hZ2VyKHtcbiAgICAgIGNsaWVudDogdGhpcyxcbiAgICAgIHNvY2tldE1hbmFnZXI6IHRoaXMuc29ja2V0TWFuYWdlcixcbiAgICB9KTtcblxuICAgIHRoaXMuc29ja2V0UmVxdWVzdE1hbmFnZXIgPSBuZXcgV2Vic29ja2V0UmVxdWVzdE1hbmFnZXIoe1xuICAgICAgY2xpZW50OiB0aGlzLFxuICAgICAgc29ja2V0TWFuYWdlcjogdGhpcy5zb2NrZXRNYW5hZ2VyLFxuICAgIH0pO1xuXG4gICAgdGhpcy5vbmxpbmVNYW5hZ2VyID0gbmV3IE9ubGluZU1hbmFnZXIoe1xuICAgICAgc29ja2V0TWFuYWdlcjogdGhpcy5zb2NrZXRNYW5hZ2VyLFxuICAgICAgdGVzdFVybDogdGhpcy51cmwgKyAnL25vbmNlcz9jb25uZWN0aW9uLXRlc3QnLFxuICAgICAgY29ubmVjdGVkOiB0aGlzLl9oYW5kbGVPbmxpbmVDaGFuZ2UuYmluZCh0aGlzKSxcbiAgICAgIGRpc2Nvbm5lY3RlZDogdGhpcy5faGFuZGxlT25saW5lQ2hhbmdlLmJpbmQodGhpcyksXG4gICAgfSk7XG5cbiAgICB0aGlzLnN5bmNNYW5hZ2VyID0gbmV3IFN5bmNNYW5hZ2VyKHtcbiAgICAgIG9ubGluZU1hbmFnZXI6IHRoaXMub25saW5lTWFuYWdlcixcbiAgICAgIHNvY2tldE1hbmFnZXI6IHRoaXMuc29ja2V0TWFuYWdlcixcbiAgICAgIHJlcXVlc3RNYW5hZ2VyOiB0aGlzLnNvY2tldFJlcXVlc3RNYW5hZ2VyLFxuICAgICAgY2xpZW50OiB0aGlzLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIERlc3Ryb3kgdGhlIHN1YmNvbXBvbmVudHMgb2YgdGhlIENsaWVudEF1dGhlbnRpY2F0b3JcbiAgICpcbiAgICogQG1ldGhvZCBfZGVzdHJveUNvbXBvbmVudHNcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9kZXN0cm95Q29tcG9uZW50cygpIHtcbiAgICB0aGlzLnN5bmNNYW5hZ2VyLmRlc3Ryb3koKTtcbiAgICB0aGlzLm9ubGluZU1hbmFnZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuc29ja2V0TWFuYWdlci5kZXN0cm95KCk7XG4gICAgdGhpcy5zb2NrZXRDaGFuZ2VNYW5hZ2VyLmRlc3Ryb3koKTtcbiAgICB0aGlzLnNvY2tldFJlcXVlc3RNYW5hZ2VyLmRlc3Ryb3koKTtcbiAgICBpZiAodGhpcy5kYk1hbmFnZXIpIHRoaXMuZGJNYW5hZ2VyLmRlc3Ryb3koKTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIElzIFBlcnNpc3RlZCBTZXNzaW9uIFRva2VucyBkaXNhYmxlZD9cbiAgICpcbiAgICogQG1ldGhvZCBfaXNQZXJzaXN0ZWRTZXNzaW9uc0Rpc2FibGVkXG4gICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2lzUGVyc2lzdGVkU2Vzc2lvbnNEaXNhYmxlZCgpIHtcbiAgICByZXR1cm4gIWdsb2JhbC5sb2NhbFN0b3JhZ2UgfHwgdGhpcy5wZXJzaXN0ZW5jZUZlYXR1cmVzICYmICF0aGlzLnBlcnNpc3RlbmNlRmVhdHVyZXMuc2Vzc2lvblRva2VuO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlc3RvcmUgdGhlIHNlc3Npb25Ub2tlbiBmcm9tIGxvY2FsU3RvcmFnZS5cbiAgICpcbiAgICogVGhpcyBzZXRzIHRoZSBzZXNzaW9uVG9rZW4gcmF0aGVyIHRoYW4gcmV0dXJuaW5nIHRoZSB0b2tlbi5cbiAgICpcbiAgICogQG1ldGhvZCBfcmVzdG9yZUxhc3RTZXNzaW9uXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcmVzdG9yZUxhc3RTZXNzaW9uKCkge1xuICAgIGlmICh0aGlzLl9pc1BlcnNpc3RlZFNlc3Npb25zRGlzYWJsZWQoKSkgcmV0dXJuO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzZXNzaW9uRGF0YSA9IGdsb2JhbC5sb2NhbFN0b3JhZ2VbTE9DQUxTVE9SQUdFX0tFWVMuU0VTU0lPTkRBVEEgKyB0aGlzLmFwcElkXTtcbiAgICAgIGlmICghc2Vzc2lvbkRhdGEpIHJldHVybjtcbiAgICAgIGNvbnN0IHBhcnNlZERhdGEgPSBKU09OLnBhcnNlKHNlc3Npb25EYXRhKTtcbiAgICAgIGlmIChwYXJzZWREYXRhLmV4cGlyZXMgPCBEYXRlLm5vdygpKSB7XG4gICAgICAgIGdsb2JhbC5sb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShMT0NBTFNUT1JBR0VfS0VZUy5TRVNTSU9OREFUQSArIHRoaXMuYXBwSWQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zZXNzaW9uVG9rZW4gPSBwYXJzZWREYXRhLnNlc3Npb25Ub2tlbjtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgLy8gTm8tb3BcbiAgICB9XG4gIH1cblxuLyoqXG4gICAqIFJlc3RvcmUgdGhlIElkZW50aXR5IGZvciB0aGUgc2Vzc2lvbiBvd25lciBmcm9tIGxvY2FsU3RvcmFnZS5cbiAgICpcbiAgICogQG1ldGhvZCBfcmVzdG9yZUxhc3RTZXNzaW9uXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm4ge2xheWVyLklkZW50aXR5fVxuICAgKi9cbiAgX3Jlc3RvcmVMYXN0VXNlcigpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc2Vzc2lvbkRhdGEgPSBnbG9iYWwubG9jYWxTdG9yYWdlW0xPQ0FMU1RPUkFHRV9LRVlTLlNFU1NJT05EQVRBICsgdGhpcy5hcHBJZF07XG4gICAgICBpZiAoIXNlc3Npb25EYXRhKSByZXR1cm4gbnVsbDtcbiAgICAgIGNvbnN0IHVzZXJPYmogPSBKU09OLnBhcnNlKHNlc3Npb25EYXRhKS51c2VyO1xuICAgICAgcmV0dXJuIG5ldyBJZGVudGl0eSh7XG4gICAgICAgIGNsaWVudElkOiB0aGlzLmFwcElkLFxuICAgICAgICBzZXNzaW9uT3duZXI6IHRydWUsXG4gICAgICAgIGZyb21TZXJ2ZXI6IHVzZXJPYmosXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEhhcyB0aGUgdXNlcklEIGNoYW5nZWQgc2luY2UgdGhlIGxhc3QgbG9naW4/XG4gICAqXG4gICAqIEBtZXRob2QgX2hhc1VzZXJJZENoYW5nZWRcbiAgICogQHBhcmFtIHtzdHJpbmd9IHVzZXJJZFxuICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9oYXNVc2VySWRDaGFuZ2VkKHVzZXJJZCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzZXNzaW9uRGF0YSA9IGdsb2JhbC5sb2NhbFN0b3JhZ2VbTE9DQUxTVE9SQUdFX0tFWVMuU0VTU0lPTkRBVEEgKyB0aGlzLmFwcElkXTtcbiAgICAgIGlmICghc2Vzc2lvbkRhdGEpIHJldHVybiB0cnVlO1xuICAgICAgcmV0dXJuIEpTT04ucGFyc2Uoc2Vzc2lvbkRhdGEpLnVzZXIudXNlcl9pZCAhPT0gdXNlcklkO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW5pdGlhdGVzIHRoZSBjb25uZWN0aW9uLlxuICAgKlxuICAgKiBDYWxsZWQgYnkgY29uc3RydWN0b3IoKS5cbiAgICpcbiAgICogV2lsbCBlaXRoZXIgYXR0ZW1wdCB0byB2YWxpZGF0ZSB0aGUgY2FjaGVkIHNlc3Npb25Ub2tlbiBieSBnZXR0aW5nIGNvbnZlcmF0aW9ucyxcbiAgICogb3IgaWYgbm8gc2Vzc2lvblRva2VuLCB3aWxsIGNhbGwgL25vbmNlcyB0byBzdGFydCBwcm9jZXNzIG9mIGdldHRpbmcgYSBuZXcgb25lLlxuICAgKlxuICAgKiBgYGBqYXZhc2NyaXB0XG4gICAqIHZhciBjbGllbnQgPSBuZXcgbGF5ZXIuQ2xpZW50KHthcHBJZDogbXlBcHBJZH0pO1xuICAgKiBjbGllbnQuY29ubmVjdCgnRnJvZG8tdGhlLURvZG8nKTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBtZXRob2QgY29ubmVjdFxuICAgKiBAcGFyYW0ge3N0cmluZ30gdXNlcklkIC0gVXNlciBJRCBvZiB0aGUgdXNlciB5b3UgYXJlIGxvZ2dpbmcgaW4gYXNcbiAgICogQHJldHVybnMge2xheWVyLkNsaWVudEF1dGhlbnRpY2F0b3J9IHRoaXNcbiAgICovXG4gIGNvbm5lY3QodXNlcklkID0gJycpIHtcbiAgICBsZXQgdXNlcjtcbiAgICB0aGlzLmlzQ29ubmVjdGVkID0gZmFsc2U7XG4gICAgdGhpcy51c2VyID0gbnVsbDtcbiAgICB0aGlzLm9ubGluZU1hbmFnZXIuc3RhcnQoKTtcbiAgICBpZiAoIXRoaXMuaXNUcnVzdGVkRGV2aWNlIHx8ICF1c2VySWQgfHwgdGhpcy5faXNQZXJzaXN0ZWRTZXNzaW9uc0Rpc2FibGVkKCkgfHwgdGhpcy5faGFzVXNlcklkQ2hhbmdlZCh1c2VySWQpKSB7XG4gICAgICB0aGlzLl9jbGVhclN0b3JlZERhdGEoKTtcbiAgICB9XG5cblxuICAgIGlmICh0aGlzLmlzVHJ1c3RlZERldmljZSAmJiB1c2VySWQpIHtcbiAgICAgIHRoaXMuX3Jlc3RvcmVMYXN0U2Vzc2lvbih1c2VySWQpO1xuICAgICAgdXNlciA9IHRoaXMuX3Jlc3RvcmVMYXN0VXNlcigpO1xuICAgICAgaWYgKHVzZXIpIHRoaXMudXNlciA9IHVzZXI7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnVzZXIpIHtcbiAgICAgIHRoaXMudXNlciA9IG5ldyBJZGVudGl0eSh7XG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgc2Vzc2lvbk93bmVyOiB0cnVlLFxuICAgICAgICBjbGllbnRJZDogdGhpcy5hcHBJZCxcbiAgICAgICAgaWQ6IHVzZXJJZCA/IElkZW50aXR5LnByZWZpeFVVSUQgKyBlbmNvZGVVUklDb21wb25lbnQodXNlcklkKSA6ICcnLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuc2Vzc2lvblRva2VuICYmIHRoaXMudXNlci51c2VySWQpIHtcbiAgICAgIHRoaXMuX3Nlc3Npb25Ub2tlblJlc3RvcmVkKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMueGhyKHtcbiAgICAgICAgdXJsOiAnL25vbmNlcycsXG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBzeW5jOiBmYWxzZSxcbiAgICAgIH0sIChyZXN1bHQpID0+IHRoaXMuX2Nvbm5lY3Rpb25SZXNwb25zZShyZXN1bHQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogSW5pdGlhdGVzIHRoZSBjb25uZWN0aW9uIHdpdGggYSBzZXNzaW9uIHRva2VuLlxuICAgKlxuICAgKiBUaGlzIGNhbGwgaXMgZm9yIHVzZSB3aGVuIHlvdSBoYXZlIHJlY2VpdmVkIGEgU2Vzc2lvbiBUb2tlbiBmcm9tIHNvbWUgb3RoZXIgc291cmNlOyBzdWNoIGFzIHlvdXIgc2VydmVyLFxuICAgKiBhbmQgd2lzaCB0byB1c2UgdGhhdCBpbnN0ZWFkIG9mIGRvaW5nIGEgZnVsbCBhdXRoIHByb2Nlc3MuXG4gICAqXG4gICAqIFRoZSBDbGllbnQgd2lsbCBwcmVzdW1lIHRoZSB0b2tlbiB0byBiZSB2YWxpZCwgYW5kIHdpbGwgYXN5bmNocm9ub3VzbHkgdHJpZ2dlciB0aGUgYHJlYWR5YCBldmVudC5cbiAgICogSWYgdGhlIHRva2VuIHByb3ZpZGVkIGlzIE5PVCB2YWxpZCwgdGhpcyB3b24ndCBiZSBkZXRlY3RlZCB1bnRpbCBhIHJlcXVlc3QgaXMgbWFkZSB1c2luZyB0aGlzIHRva2VuLFxuICAgKiBhdCB3aGljaCBwb2ludCB0aGUgYGNoYWxsZW5nZWAgbWV0aG9kIHdpbGwgdHJpZ2dlci5cbiAgICpcbiAgICogTk9URTogVGhlIGBjb25uZWN0ZWRgIGV2ZW50IHdpbGwgbm90IGJlIHRyaWdnZXJlZCBvbiB0aGlzIHBhdGguXG4gICAqXG4gICAqIGBgYGphdmFzY3JpcHRcbiAgICogdmFyIGNsaWVudCA9IG5ldyBsYXllci5DbGllbnQoe2FwcElkOiBteUFwcElkfSk7XG4gICAqIGNsaWVudC5jb25uZWN0V2l0aFNlc3Npb24oJ0Zyb2RvLXRoZS1Eb2RvJywgbXlTZXNzaW9uVG9rZW4pO1xuICAgKiBgYGBcbiAgICpcbiAgICogQG1ldGhvZCBjb25uZWN0V2l0aFNlc3Npb25cbiAgICogQHBhcmFtIHtTdHJpbmd9IHVzZXJJZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gc2Vzc2lvblRva2VuXG4gICAqIEByZXR1cm5zIHtsYXllci5DbGllbnRBdXRoZW50aWNhdG9yfSB0aGlzXG4gICAqL1xuICBjb25uZWN0V2l0aFNlc3Npb24odXNlcklkLCBzZXNzaW9uVG9rZW4pIHtcbiAgICBsZXQgdXNlcjtcbiAgICB0aGlzLnVzZXIgPSBudWxsO1xuICAgIGlmICghdXNlcklkIHx8ICFzZXNzaW9uVG9rZW4pIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuc2Vzc2lvbkFuZFVzZXJSZXF1aXJlZCk7XG4gICAgaWYgKCF0aGlzLmlzVHJ1c3RlZERldmljZSB8fCB0aGlzLl9pc1BlcnNpc3RlZFNlc3Npb25zRGlzYWJsZWQoKSB8fCB0aGlzLl9oYXNVc2VySWRDaGFuZ2VkKHVzZXJJZCkpIHtcbiAgICAgIHRoaXMuX2NsZWFyU3RvcmVkRGF0YSgpO1xuICAgIH1cbiAgICBpZiAodGhpcy5pc1RydXN0ZWREZXZpY2UpIHtcbiAgICAgIHVzZXIgPSB0aGlzLl9yZXN0b3JlTGFzdFVzZXIoKTtcbiAgICAgIGlmICh1c2VyKSB0aGlzLnVzZXIgPSB1c2VyO1xuICAgIH1cblxuICAgIHRoaXMub25saW5lTWFuYWdlci5zdGFydCgpO1xuXG4gICAgaWYgKCF0aGlzLnVzZXIpIHtcbiAgICAgIHRoaXMudXNlciA9IG5ldyBJZGVudGl0eSh7XG4gICAgICAgIHVzZXJJZCxcbiAgICAgICAgc2Vzc2lvbk93bmVyOiB0cnVlLFxuICAgICAgICBjbGllbnRJZDogdGhpcy5hcHBJZCxcbiAgICAgICAgaWQ6IElkZW50aXR5LnByZWZpeFVVSUQgKyBlbmNvZGVVUklDb21wb25lbnQodXNlcklkKSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMuaXNDb25uZWN0ZWQgPSB0cnVlO1xuICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5fYXV0aENvbXBsZXRlKHsgc2Vzc2lvbl90b2tlbjogc2Vzc2lvblRva2VuIH0sIGZhbHNlKSwgMSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGVkIHdoZW4gb3VyIHJlcXVlc3QgZm9yIGEgbm9uY2UgZ2V0cyBhIHJlc3BvbnNlLlxuICAgKlxuICAgKiBJZiB0aGVyZSBpcyBhbiBlcnJvciwgY2FsbHMgX2Nvbm5lY3Rpb25FcnJvci5cbiAgICpcbiAgICogSWYgdGhlcmUgaXMgbm9uY2UsIGNhbGxzIF9jb25uZWN0aW9uQ29tcGxldGUuXG4gICAqXG4gICAqIEBtZXRob2QgX2Nvbm5lY3Rpb25SZXNwb25zZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IHJlc3VsdFxuICAgKi9cbiAgX2Nvbm5lY3Rpb25SZXNwb25zZShyZXN1bHQpIHtcbiAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICB0aGlzLl9jb25uZWN0aW9uRXJyb3IocmVzdWx0LmRhdGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9jb25uZWN0aW9uQ29tcGxldGUocmVzdWx0LmRhdGEpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBXZSBhcmUgbm93IGNvbm5lY3RlZCAod2UgaGF2ZSBhIG5vbmNlKS5cbiAgICpcbiAgICogSWYgd2UgaGF2ZSBzdWNjZXNzZnVsbHkgcmV0cmlldmVkIGEgbm9uY2UsIHRoZW5cbiAgICogd2UgaGF2ZSBlbnRlcmVkIGEgXCJjb25uZWN0ZWRcIiBidXQgbm90IFwiYXV0aGVudGljYXRlZFwiIHN0YXRlLlxuICAgKiBTZXQgdGhlIHN0YXRlLCB0cmlnZ2VyIGFueSBldmVudHMsIGFuZCB0aGVuIHN0YXJ0IGF1dGhlbnRpY2F0aW9uLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jb25uZWN0aW9uQ29tcGxldGVcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHRcbiAgICogQHBhcmFtICB7c3RyaW5nfSByZXN1bHQubm9uY2UgLSBUaGUgbm9uY2UgcHJvdmlkZWQgYnkgdGhlIHNlcnZlclxuICAgKlxuICAgKiBAZmlyZXMgY29ubmVjdGVkXG4gICAqL1xuICBfY29ubmVjdGlvbkNvbXBsZXRlKHJlc3VsdCkge1xuICAgIHRoaXMuaXNDb25uZWN0ZWQgPSB0cnVlO1xuICAgIHRoaXMudHJpZ2dlcignY29ubmVjdGVkJyk7XG4gICAgdGhpcy5fYXV0aGVudGljYXRlKHJlc3VsdC5ub25jZSk7XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGVkIHdoZW4gd2UgZmFpbCB0byBnZXQgYSBub25jZS5cbiAgICpcbiAgICogQG1ldGhvZCBfY29ubmVjdGlvbkVycm9yXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLkxheWVyRXJyb3J9IGVyclxuICAgKlxuICAgKiBAZmlyZXMgY29ubmVjdGVkLWVycm9yXG4gICAqL1xuICBfY29ubmVjdGlvbkVycm9yKGVycm9yKSB7XG4gICAgdGhpcy50cmlnZ2VyKCdjb25uZWN0ZWQtZXJyb3InLCB7IGVycm9yIH0pO1xuICB9XG5cblxuICAvKiBDT05ORUNUIE1FVEhPRFMgRU5EICovXG5cbiAgLyogQVVUSEVOVElDQVRFIE1FVEhPRFMgQkVHSU4gKi9cblxuICAvKipcbiAgICogU3RhcnQgdGhlIGF1dGhlbnRpY2F0aW9uIHN0ZXAuXG4gICAqXG4gICAqIFdlIHN0YXJ0IGF1dGhlbnRpY2F0aW9uIGJ5IHRyaWdnZXJpbmcgYSBcImNoYWxsZW5nZVwiIGV2ZW50IHRoYXRcbiAgICogdGVsbHMgdGhlIGFwcCB0byB1c2UgdGhlIG5vbmNlIHRvIG9idGFpbiBhbiBpZGVudGl0eV90b2tlbi5cbiAgICpcbiAgICogQG1ldGhvZCBfYXV0aGVudGljYXRlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge3N0cmluZ30gbm9uY2UgLSBUaGUgbm9uY2UgdG8gcHJvdmlkZSB5b3VyIGlkZW50aXR5IHByb3ZpZGVyIHNlcnZpY2VcbiAgICpcbiAgICogQGZpcmVzIGNoYWxsZW5nZVxuICAgKi9cbiAgX2F1dGhlbnRpY2F0ZShub25jZSkge1xuICAgIGlmIChub25jZSkge1xuICAgICAgdGhpcy50cmlnZ2VyKCdjaGFsbGVuZ2UnLCB7XG4gICAgICAgIG5vbmNlLFxuICAgICAgICBjYWxsYmFjazogdGhpcy5hbnN3ZXJBdXRoZW50aWNhdGlvbkNoYWxsZW5nZS5iaW5kKHRoaXMpLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFjY2VwdCBhbiBpZGVudGl0eVRva2VuIGFuZCB1c2UgaXQgdG8gY3JlYXRlIGEgc2Vzc2lvbi5cbiAgICpcbiAgICogVHlwaWNhbGx5LCB0aGlzIG1ldGhvZCBpcyBjYWxsZWQgdXNpbmcgdGhlIGZ1bmN0aW9uIHBvaW50ZXIgcHJvdmlkZWQgYnlcbiAgICogdGhlIGNoYWxsZW5nZSBldmVudCwgYnV0IGl0IGNhbiBhbHNvIGJlIGNhbGxlZCBkaXJlY3RseS5cbiAgICpcbiAgICogICAgICBnZXRJZGVudGl0eVRva2VuKG5vbmNlLCBmdW5jdGlvbihpZGVudGl0eVRva2VuKSB7XG4gICAqICAgICAgICAgIGNsaWVudC5hbnN3ZXJBdXRoZW50aWNhdGlvbkNoYWxsZW5nZShpZGVudGl0eVRva2VuKTtcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogQG1ldGhvZCBhbnN3ZXJBdXRoZW50aWNhdGlvbkNoYWxsZW5nZVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkZW50aXR5VG9rZW4gLSBJZGVudGl0eSB0b2tlbiBwcm92aWRlZCBieSB5b3VyIGlkZW50aXR5IHByb3ZpZGVyIHNlcnZpY2VcbiAgICovXG4gIGFuc3dlckF1dGhlbnRpY2F0aW9uQ2hhbGxlbmdlKGlkZW50aXR5VG9rZW4pIHtcbiAgICAvLyBSZXBvcnQgYW4gZXJyb3IgaWYgbm8gaWRlbnRpdHlUb2tlbiBwcm92aWRlZFxuICAgIGlmICghaWRlbnRpdHlUb2tlbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5pZGVudGl0eVRva2VuTWlzc2luZyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHVzZXJEYXRhID0gVXRpbC5kZWNvZGUoaWRlbnRpdHlUb2tlbi5zcGxpdCgnLicpWzFdKTtcbiAgICAgIGNvbnN0IGlkZW50aXR5T2JqID0gSlNPTi5wYXJzZSh1c2VyRGF0YSk7XG5cbiAgICAgIGlmICh0aGlzLnVzZXIudXNlcklkICYmIHRoaXMudXNlci51c2VySWQgIT09IGlkZW50aXR5T2JqLnBybikgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5pbnZhbGlkVXNlcklkQ2hhbmdlKTtcblxuICAgICAgdGhpcy51c2VyLl9zZXRVc2VySWQoaWRlbnRpdHlPYmoucHJuKTtcblxuICAgICAgaWYgKGlkZW50aXR5T2JqLmRpc3BsYXlfbmFtZSkgdGhpcy51c2VyLmRpc3BsYXlOYW1lID0gaWRlbnRpdHlPYmouZGlzcGxheV9uYW1lO1xuICAgICAgaWYgKGlkZW50aXR5T2JqLmF2YXRhcl91cmwpIHRoaXMudXNlci5hdmF0YXJVcmwgPSBpZGVudGl0eU9iai5hdmF0YXJfdXJsO1xuXG4gICAgICB0aGlzLnhocih7XG4gICAgICAgIHVybDogJy9zZXNzaW9ucycsXG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBzeW5jOiBmYWxzZSxcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIGlkZW50aXR5X3Rva2VuOiBpZGVudGl0eVRva2VuLFxuICAgICAgICAgIGFwcF9pZDogdGhpcy5hcHBJZCxcbiAgICAgICAgfSxcbiAgICAgIH0sIChyZXN1bHQpID0+IHRoaXMuX2F1dGhSZXNwb25zZShyZXN1bHQsIGlkZW50aXR5VG9rZW4pKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGVkIHdoZW4gb3VyIHJlcXVlc3QgZm9yIGEgc2Vzc2lvblRva2VuIHJlY2VpdmVzIGEgcmVzcG9uc2UuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBtZXRob2QgX2F1dGhSZXNwb25zZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IHJlc3VsdFxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkZW50aXR5VG9rZW5cbiAgICovXG4gIF9hdXRoUmVzcG9uc2UocmVzdWx0LCBpZGVudGl0eVRva2VuKSB7XG4gICAgaWYgKCFyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgdGhpcy5fYXV0aEVycm9yKHJlc3VsdC5kYXRhLCBpZGVudGl0eVRva2VuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fYXV0aENvbXBsZXRlKHJlc3VsdC5kYXRhLCBmYWxzZSk7XG4gICAgfVxuICB9XG5cblxuICAvKipcbiAgICogQXV0aGVudGljYXRpb24gaXMgY29tcGxldGVkLCB1cGRhdGUgc3RhdGUgYW5kIHRyaWdnZXIgZXZlbnRzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9hdXRoQ29tcGxldGVcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHRcbiAgICogQHBhcmFtICB7Qm9vbGVhbn0gZnJvbVBlcnNpc3RlbmNlXG4gICAqIEBwYXJhbSAge3N0cmluZ30gcmVzdWx0LnNlc3Npb25fdG9rZW4gLSBTZXNzaW9uIHRva2VuIHJlY2VpdmVkIGZyb20gdGhlIHNlcnZlclxuICAgKlxuICAgKiBAZmlyZXMgYXV0aGVudGljYXRlZFxuICAgKi9cbiAgX2F1dGhDb21wbGV0ZShyZXN1bHQsIGZyb21QZXJzaXN0ZW5jZSkge1xuICAgIGlmICghcmVzdWx0IHx8ICFyZXN1bHQuc2Vzc2lvbl90b2tlbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5zZXNzaW9uVG9rZW5NaXNzaW5nKTtcbiAgICB9XG4gICAgdGhpcy5zZXNzaW9uVG9rZW4gPSByZXN1bHQuc2Vzc2lvbl90b2tlbjtcblxuICAgIC8vIElmIF9hdXRoQ29tcGxldGUgd2FzIGNhbGxlZCBiZWNhdXNlIHdlIGFjY2VwdGVkIGFuIGF1dGggbG9hZGVkIGZyb20gc3RvcmFnZVxuICAgIC8vIHdlIGRvbid0IG5lZWQgdG8gdXBkYXRlIHN0b3JhZ2UuXG4gICAgaWYgKCF0aGlzLl9pc1BlcnNpc3RlZFNlc3Npb25zRGlzYWJsZWQoKSAmJiAhZnJvbVBlcnNpc3RlbmNlKSB7XG4gICAgICB0cnkge1xuICAgICAgICBnbG9iYWwubG9jYWxTdG9yYWdlW0xPQ0FMU1RPUkFHRV9LRVlTLlNFU1NJT05EQVRBICsgdGhpcy5hcHBJZF0gPSBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgc2Vzc2lvblRva2VuOiB0aGlzLnNlc3Npb25Ub2tlbiB8fCAnJyxcbiAgICAgICAgICB1c2VyOiBEYk1hbmFnZXIucHJvdG90eXBlLl9nZXRJZGVudGl0eURhdGEoW3RoaXMudXNlcl0sIHRydWUpWzBdLFxuICAgICAgICAgIGV4cGlyZXM6IERhdGUubm93KCkgKyAzMCAqIDYwICogNjAgKiAyNCAqIDEwMDAsXG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBEbyBub3RoaW5nXG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fY2xpZW50QXV0aGVudGljYXRlZCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEF1dGhlbnRpY2F0aW9uIGhhcyBmYWlsZWQuXG4gICAqXG4gICAqIEBtZXRob2QgX2F1dGhFcnJvclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5MYXllckVycm9yfSByZXN1bHRcbiAgICogQHBhcmFtICB7c3RyaW5nfSBpZGVudGl0eVRva2VuIE5vdCBjdXJyZW50bHkgdXNlZFxuICAgKlxuICAgKiBAZmlyZXMgYXV0aGVudGljYXRlZC1lcnJvclxuICAgKi9cbiAgX2F1dGhFcnJvcihlcnJvciwgaWRlbnRpdHlUb2tlbikge1xuICAgIHRoaXMudHJpZ2dlcignYXV0aGVudGljYXRlZC1lcnJvcicsIHsgZXJyb3IgfSk7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyBzdGF0ZSBhbmQgdHJpZ2dlcnMgZXZlbnRzIGZvciBib3RoIGNvbm5lY3RlZCBhbmQgYXV0aGVudGljYXRlZC5cbiAgICpcbiAgICogSWYgcmV1c2luZyBhIHNlc3Npb25Ub2tlbiBjYWNoZWQgaW4gbG9jYWxTdG9yYWdlLFxuICAgKiB1c2UgdGhpcyBtZXRob2QgcmF0aGVyIHRoYW4gX2F1dGhDb21wbGV0ZS5cbiAgICpcbiAgICogQG1ldGhvZCBfc2Vzc2lvblRva2VuUmVzdG9yZWRcbiAgICogQHByaXZhdGVcbiAgICpcbiAgICogQGZpcmVzIGNvbm5lY3RlZCwgYXV0aGVudGljYXRlZFxuICAgKi9cbiAgX3Nlc3Npb25Ub2tlblJlc3RvcmVkKCkge1xuICAgIHRoaXMuaXNDb25uZWN0ZWQgPSB0cnVlO1xuICAgIHRoaXMudHJpZ2dlcignY29ubmVjdGVkJyk7XG4gICAgdGhpcy5fY2xpZW50QXV0aGVudGljYXRlZCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBjbGllbnQgaXMgbm93IGF1dGhlbnRpY2F0ZWQsIGFuZCBkb2luZyBzb21lIHNldHVwXG4gICAqIGJlZm9yZSBjYWxsaW5nIF9jbGllbnRSZWFkeS5cbiAgICpcbiAgICogQG1ldGhvZCBfY2xpZW50QXV0aGVudGljYXRlZFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2NsaWVudEF1dGhlbnRpY2F0ZWQoKSB7XG4gICAgLy8gVXBkYXRlIHN0YXRlIGFuZCB0cmlnZ2VyIHRoZSBldmVudFxuICAgIHRoaXMuaXNBdXRoZW50aWNhdGVkID0gdHJ1ZTtcbiAgICB0aGlzLnRyaWdnZXIoJ2F1dGhlbnRpY2F0ZWQnKTtcblxuICAgIGlmICghdGhpcy5pc1RydXN0ZWREZXZpY2UpIHRoaXMuaXNQZXJzaXN0ZW5jZUVuYWJsZWQgPSBmYWxzZTtcblxuXG4gICAgLy8gSWYgbm8gcGVyc2lzdGVuY2VGZWF0dXJlcyBhcmUgc3BlY2lmaWVkLCBzZXQgdGhlbSBhbGxcbiAgICAvLyB0byB0cnVlIG9yIGZhbHNlIHRvIG1hdGNoIGlzVHJ1c3RlZERldmljZS5cbiAgICBpZiAoIXRoaXMucGVyc2lzdGVuY2VGZWF0dXJlcyB8fCAhdGhpcy5pc1BlcnNpc3RlbmNlRW5hYmxlZCkge1xuICAgICAgbGV0IHNlc3Npb25Ub2tlbjtcbiAgICAgIGlmICh0aGlzLnBlcnNpc3RlbmNlRmVhdHVyZXMgJiYgJ3Nlc3Npb25Ub2tlbicgaW4gdGhpcy5wZXJzaXN0ZW5jZUZlYXR1cmVzKSB7XG4gICAgICAgIHNlc3Npb25Ub2tlbiA9IEJvb2xlYW4odGhpcy5wZXJzaXN0ZW5jZUZlYXR1cmVzLnNlc3Npb25Ub2tlbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZXNzaW9uVG9rZW4gPSB0aGlzLmlzVHJ1c3RlZERldmljZTtcbiAgICAgIH1cbiAgICAgIHRoaXMucGVyc2lzdGVuY2VGZWF0dXJlcyA9IHtcbiAgICAgICAgY29udmVyc2F0aW9uczogdGhpcy5pc1BlcnNpc3RlbmNlRW5hYmxlZCxcbiAgICAgICAgbWVzc2FnZXM6IHRoaXMuaXNQZXJzaXN0ZW5jZUVuYWJsZWQsXG4gICAgICAgIHN5bmNRdWV1ZTogdGhpcy5pc1BlcnNpc3RlbmNlRW5hYmxlZCxcbiAgICAgICAgc2Vzc2lvblRva2VuLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBTZXR1cCB0aGUgRGF0YWJhc2UgTWFuYWdlclxuICAgIGlmICghdGhpcy5kYk1hbmFnZXIpIHtcbiAgICAgIHRoaXMuZGJNYW5hZ2VyID0gbmV3IERiTWFuYWdlcih7XG4gICAgICAgIGNsaWVudDogdGhpcyxcbiAgICAgICAgdGFibGVzOiB0aGlzLnBlcnNpc3RlbmNlRmVhdHVyZXMsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBCZWZvcmUgY2FsbGluZyBfY2xpZW50UmVhZHksIGxvYWQgdGhlIHNlc3Npb24gb3duZXIncyBmdWxsIElkZW50aXR5LlxuICAgIGlmICh0aGlzLmlzUGVyc2lzdGVuY2VFbmFibGVkKSB7XG4gICAgICB0aGlzLmRiTWFuYWdlci5vbk9wZW4oKCkgPT4gdGhpcy5fbG9hZFVzZXIoKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2xvYWRVc2VyKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIExvYWQgdGhlIHNlc3Npb24gb3duZXIncyBmdWxsIGlkZW50aXR5LlxuICAgKlxuICAgKiBOb3RlIHRoYXQgZmFpbHVyZSB0byBsb2FkIHRoZSBpZGVudGl0eSB3aWxsIG5vdCBwcmV2ZW50XG4gICAqIF9jbGllbnRSZWFkeSwgYnV0IGlzIGNlcnRhaW5seSBub3QgYSBkZXNpcmVkIG91dGNvbWUuXG4gICAqXG4gICAqIEBtZXRob2QgX2xvYWRVc2VyXG4gICAqL1xuICBfbG9hZFVzZXIoKSB7XG4gICAgLy8gV2UncmUgZG9uZSBpZiB3ZSBnb3QgdGhlIGZ1bGwgaWRlbnRpdHkgZnJvbSBsb2NhbFN0b3JhZ2UuXG4gICAgaWYgKHRoaXMudXNlci5pc0Z1bGxJZGVudGl0eSkge1xuICAgICAgdGhpcy5fY2xpZW50UmVhZHkoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gbG9hZCB0aGUgdXNlcidzIGZ1bGwgSWRlbnRpdHkgYW5kIHVwZGF0ZSBsb2NhbFN0b3JhZ2VcbiAgICAgIHRoaXMudXNlci5fbG9hZCgpO1xuICAgICAgdGhpcy51c2VyLm9uY2UoJ2lkZW50aXRpZXM6bG9hZGVkJywgKCkgPT4ge1xuICAgICAgICBpZiAoIXRoaXMuX2lzUGVyc2lzdGVkU2Vzc2lvbnNEaXNhYmxlZCgpKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgc2Vzc2lvbiBkYXRhIGluIGxvY2FsU3RvcmFnZSB3aXRoIG91ciBmdWxsIElkZW50aXR5LlxuICAgICAgICAgICAgY29uc3Qgc2Vzc2lvbkRhdGEgPSBKU09OLnBhcnNlKGdsb2JhbC5sb2NhbFN0b3JhZ2VbTE9DQUxTVE9SQUdFX0tFWVMuU0VTU0lPTkRBVEEgKyB0aGlzLmFwcElkXSk7XG4gICAgICAgICAgICBzZXNzaW9uRGF0YS51c2VyID0gRGJNYW5hZ2VyLnByb3RvdHlwZS5fZ2V0SWRlbnRpdHlEYXRhKFt0aGlzLnVzZXJdKVswXTtcbiAgICAgICAgICAgIGdsb2JhbC5sb2NhbFN0b3JhZ2VbTE9DQUxTVE9SQUdFX0tFWVMuU0VTU0lPTkRBVEEgKyB0aGlzLmFwcElkXSA9IEpTT04uc3RyaW5naWZ5KHNlc3Npb25EYXRhKTtcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAvLyBuby1vcFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jbGllbnRSZWFkeSgpO1xuICAgICAgfSlcbiAgICAgIC5vbmNlKCdpZGVudGl0aWVzOmxvYWRlZC1lcnJvcicsICgpID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLnVzZXIuZGlzcGxheU5hbWUpIHRoaXMudXNlci5kaXNwbGF5TmFtZSA9IHRoaXMuZGVmYXVsdE93bmVyRGlzcGxheU5hbWU7XG4gICAgICAgIHRoaXMuX2NsaWVudFJlYWR5KCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGVkIHRvIGZsYWcgdGhlIGNsaWVudCBhcyByZWFkeSBmb3IgYWN0aW9uLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBpcyBjYWxsZWQgYWZ0ZXIgYXV0aGVuaWNhdGlvbiBBTkRcbiAgICogYWZ0ZXIgaW5pdGlhbCBjb252ZXJzYXRpb25zIGhhdmUgYmVlbiBsb2FkZWQuXG4gICAqXG4gICAqIEBtZXRob2QgX2NsaWVudFJlYWR5XG4gICAqIEBwcml2YXRlXG4gICAqIEBmaXJlcyByZWFkeVxuICAgKi9cbiAgX2NsaWVudFJlYWR5KCkge1xuICAgIGlmICghdGhpcy5pc1JlYWR5KSB7XG4gICAgICB0aGlzLmlzUmVhZHkgPSB0cnVlO1xuICAgICAgdGhpcy50cmlnZ2VyKCdyZWFkeScpO1xuICAgIH1cbiAgfVxuXG5cbiAgLyogQ09OTkVDVCBNRVRIT0RTIEVORCAqL1xuXG5cbiAgLyogU1RBUlQgU0VTU0lPTiBNQU5BR0VNRU5UIE1FVEhPRFMgKi9cblxuICAvKipcbiAgICogRGVsZXRlcyB5b3VyIHNlc3Npb25Ub2tlbiBmcm9tIHRoZSBzZXJ2ZXIsIGFuZCByZW1vdmVzIGFsbCB1c2VyIGRhdGEgZnJvbSB0aGUgQ2xpZW50LlxuICAgKiBDYWxsIGBjbGllbnQuY29ubmVjdCgpYCB0byByZXN0YXJ0IHRoZSBhdXRoZW50aWNhdGlvbiBwcm9jZXNzLlxuICAgKlxuICAgKiBUaGlzIGNhbGwgaXMgYXN5bmNocm9ub3VzOyBzb21lIGJyb3dzZXJzIChhaGVtLCBzYWZhcmkuLi4pIG1heSBub3QgaGF2ZSBjb21wbGV0ZWQgdGhlIGRlbGV0aW9uIG9mXG4gICAqIHBlcnNpc3RlZCBkYXRhIGlmIHlvdVxuICAgKiBuYXZpZ2F0ZSBhd2F5IGZyb20gdGhlIHBhZ2UuICBVc2UgdGhlIGNhbGxiYWNrIHRvIGRldGVybWluZSB3aGVuIGFsbCBuZWNlc3NhcnkgY2xlYW51cCBoYXMgY29tcGxldGVkXG4gICAqIHByaW9yIHRvIG5hdmlnYXRpbmcgYXdheS5cbiAgICpcbiAgICogTm90ZSB0aGF0IHdoaWxlIGFsbCBkYXRhIHNob3VsZCBiZSBwdXJnZWQgZnJvbSB0aGUgYnJvd3Nlci9kZXZpY2UsIGlmIHlvdSBhcmUgb2ZmbGluZSB3aGVuIHRoaXMgaXMgY2FsbGVkLFxuICAgKiB5b3VyIHNlc3Npb24gdG9rZW4gd2lsbCBOT1QgYmUgZGVsZXRlZCBmcm9tIHRoZSB3ZWIgc2VydmVyLiAgV2h5IG5vdD8gQmVjYXVzZSBpdCB3b3VsZCBpbnZvbHZlIHJldGFpbmluZyB0aGVcbiAgICogcmVxdWVzdCBhZnRlciBhbGwgb2YgdGhlIHVzZXIncyBkYXRhIGhhcyBiZWVuIGRlbGV0ZWQsIG9yIE5PVCBkZWxldGluZyB0aGUgdXNlcidzIGRhdGEgdW50aWwgd2UgYXJlIG9ubGluZS5cbiAgICpcbiAgICogQG1ldGhvZCBsb2dvdXRcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHJldHVybiB7bGF5ZXIuQ2xpZW50QXV0aGVudGljYXRvcn0gdGhpc1xuICAgKi9cbiAgbG9nb3V0KGNhbGxiYWNrKSB7XG4gICAgbGV0IGNhbGxiYWNrQ291bnQgPSAxLFxuICAgICAgIGNvdW50ZXIgPSAwO1xuICAgIGlmICh0aGlzLmlzQXV0aGVudGljYXRlZCkge1xuICAgICAgY2FsbGJhY2tDb3VudCsrO1xuICAgICAgdGhpcy54aHIoe1xuICAgICAgICBtZXRob2Q6ICdERUxFVEUnLFxuICAgICAgICB1cmw6ICcvc2Vzc2lvbnMvJyArIGVzY2FwZSh0aGlzLnNlc3Npb25Ub2tlbiksXG4gICAgICAgIHN5bmM6IGZhbHNlLFxuICAgICAgfSwgKCkgPT4ge1xuICAgICAgICBjb3VudGVyKys7XG4gICAgICAgIGlmIChjb3VudGVyID09PSBjYWxsYmFja0NvdW50ICYmIGNhbGxiYWNrKSBjYWxsYmFjaygpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQ2xlYXIgZGF0YSBldmVuIGlmIGlzQXV0aGVudGljYXRlZCBpcyBmYWxzZVxuICAgIC8vIFNlc3Npb24gbWF5IGhhdmUgZXhwaXJlZCwgYnV0IGRhdGEgc3RpbGwgY2FjaGVkLlxuICAgIHRoaXMuX2NsZWFyU3RvcmVkRGF0YSgoKSA9PiB7XG4gICAgICBjb3VudGVyKys7XG4gICAgICBpZiAoY291bnRlciA9PT0gY2FsbGJhY2tDb3VudCAmJiBjYWxsYmFjaykgY2FsbGJhY2soKTtcbiAgICB9KTtcblxuICAgIHRoaXMuX3Jlc2V0U2Vzc2lvbigpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cblxuICBfY2xlYXJTdG9yZWREYXRhKGNhbGxiYWNrKSB7XG4gICAgaWYgKGdsb2JhbC5sb2NhbFN0b3JhZ2UpIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKExPQ0FMU1RPUkFHRV9LRVlTLlNFU1NJT05EQVRBICsgdGhpcy5hcHBJZCk7XG4gICAgaWYgKHRoaXMuZGJNYW5hZ2VyKSB7XG4gICAgICB0aGlzLmRiTWFuYWdlci5kZWxldGVUYWJsZXMoY2FsbGJhY2spO1xuICAgIH0gZWxzZSBpZiAoY2FsbGJhY2spIHtcbiAgICAgIGNhbGxiYWNrKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIExvZyBvdXQvY2xlYXIgc2Vzc2lvbiBpbmZvcm1hdGlvbi5cbiAgICpcbiAgICogVXNlIHRoaXMgdG8gY2xlYXIgdGhlIHNlc3Npb25Ub2tlbiBhbmQgYWxsIGluZm9ybWF0aW9uIGZyb20gdGhpcyBzZXNzaW9uLlxuICAgKlxuICAgKiBAbWV0aG9kIF9yZXNldFNlc3Npb25cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9yZXNldFNlc3Npb24oKSB7XG4gICAgdGhpcy5pc1JlYWR5ID0gZmFsc2U7XG4gICAgaWYgKHRoaXMuc2Vzc2lvblRva2VuKSB7XG4gICAgICB0aGlzLnNlc3Npb25Ub2tlbiA9ICcnO1xuICAgICAgaWYgKGdsb2JhbC5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oTE9DQUxTVE9SQUdFX0tFWVMuU0VTU0lPTkRBVEEgKyB0aGlzLmFwcElkKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmlzQ29ubmVjdGVkID0gZmFsc2U7XG4gICAgdGhpcy5pc0F1dGhlbnRpY2F0ZWQgPSBmYWxzZTtcblxuICAgIHRoaXMudHJpZ2dlcignZGVhdXRoZW50aWNhdGVkJyk7XG4gICAgdGhpcy5vbmxpbmVNYW5hZ2VyLnN0b3AoKTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIHlvdXIgSU9TIGRldmljZSB0byByZWNlaXZlIG5vdGlmaWNhdGlvbnMuXG4gICAqIEZvciB1c2Ugd2l0aCBuYXRpdmUgY29kZSBvbmx5IChDb3Jkb3ZhLCBSZWFjdCBOYXRpdmUsIFRpdGFuaXVtLCBldGMuLi4pXG4gICAqXG4gICAqIEBtZXRob2QgcmVnaXN0ZXJJT1NQdXNoVG9rZW5cbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAgICogQHBhcmFtIHtzdHJpbmd9IG9wdGlvbnMuZGV2aWNlSWQgLSBZb3VyIElPUyBkZXZpY2UncyBkZXZpY2UgSURcbiAgICogQHBhcmFtIHtzdHJpbmd9IG9wdGlvbnMuaW9zVmVyc2lvbiAtIFlvdXIgSU9TIGRldmljZSdzIHZlcnNpb24gbnVtYmVyXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBvcHRpb25zLnRva2VuIC0gWW91ciBBcHBsZSBBUE5TIFRva2VuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5idW5kbGVJZF0gLSBZb3VyIEFwcGxlIEFQTlMgQnVuZGxlIElEIChcImNvbS5sYXllci5idW5kbGVpZFwiKVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2s9bnVsbF0gLSBPcHRpb25hbCBjYWxsYmFja1xuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXJyb3J9IGNhbGxiYWNrLmVycm9yIC0gTGF5ZXJFcnJvciBpZiB0aGVyZSB3YXMgYW4gZXJyb3I7IG51bGwgaWYgc3VjY2Vzc2Z1bFxuICAgKi9cbiAgcmVnaXN0ZXJJT1NQdXNoVG9rZW4ob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICB0aGlzLnhocih7XG4gICAgICB1cmw6ICdwdXNoX3Rva2VucycsXG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIHN5bmM6IGZhbHNlLFxuICAgICAgZGF0YToge1xuICAgICAgICB0b2tlbjogb3B0aW9ucy50b2tlbixcbiAgICAgICAgdHlwZTogJ2FwbnMnLFxuICAgICAgICBkZXZpY2VfaWQ6IG9wdGlvbnMuZGV2aWNlSWQsXG4gICAgICAgIGlvc192ZXJzaW9uOiBvcHRpb25zLmlvc1ZlcnNpb24sXG4gICAgICAgIGFwbnNfYnVuZGxlX2lkOiBvcHRpb25zLmJ1bmRsZUlkLFxuICAgICAgfSxcbiAgICB9LCAocmVzdWx0KSA9PiBjYWxsYmFjayhyZXN1bHQuZGF0YSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIHlvdXIgQW5kcm9pZCBkZXZpY2UgdG8gcmVjZWl2ZSBub3RpZmljYXRpb25zLlxuICAgKiBGb3IgdXNlIHdpdGggbmF0aXZlIGNvZGUgb25seSAoQ29yZG92YSwgUmVhY3QgTmF0aXZlLCBUaXRhbml1bSwgZXRjLi4uKVxuICAgKlxuICAgKiBAbWV0aG9kIHJlZ2lzdGVyQW5kcm9pZFB1c2hUb2tlblxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0ge3N0cmluZ30gb3B0aW9ucy5kZXZpY2VJZCAtIFlvdXIgSU9TIGRldmljZSdzIGRldmljZSBJRFxuICAgKiBAcGFyYW0ge3N0cmluZ30gb3B0aW9ucy50b2tlbiAtIFlvdXIgR0NNIHB1c2ggVG9rZW5cbiAgICogQHBhcmFtIHtzdHJpbmd9IG9wdGlvbnMuc2VuZGVySWQgLSBZb3VyIEdDTSBTZW5kZXIgSUQvUHJvamVjdCBOdW1iZXJcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrPW51bGxdIC0gT3B0aW9uYWwgY2FsbGJhY2tcbiAgICogQHBhcmFtIHtsYXllci5MYXllckVycm9yfSBjYWxsYmFjay5lcnJvciAtIExheWVyRXJyb3IgaWYgdGhlcmUgd2FzIGFuIGVycm9yOyBudWxsIGlmIHN1Y2Nlc3NmdWxcbiAgICovXG4gIHJlZ2lzdGVyQW5kcm9pZFB1c2hUb2tlbihvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIHRoaXMueGhyKHtcbiAgICAgIHVybDogJ3B1c2hfdG9rZW5zJyxcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgc3luYzogZmFsc2UsXG4gICAgICBkYXRhOiB7XG4gICAgICAgIHRva2VuOiBvcHRpb25zLnRva2VuLFxuICAgICAgICB0eXBlOiAnZ2NtJyxcbiAgICAgICAgZGV2aWNlX2lkOiBvcHRpb25zLmRldmljZUlkLFxuICAgICAgICBnY21fc2VuZGVyX2lkOiBvcHRpb25zLnNlbmRlcklkLFxuICAgICAgfSxcbiAgICB9LCAocmVzdWx0KSA9PiBjYWxsYmFjayhyZXN1bHQuZGF0YSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIHlvdXIgQW5kcm9pZCBkZXZpY2UgdG8gcmVjZWl2ZSBub3RpZmljYXRpb25zLlxuICAgKiBGb3IgdXNlIHdpdGggbmF0aXZlIGNvZGUgb25seSAoQ29yZG92YSwgUmVhY3QgTmF0aXZlLCBUaXRhbml1bSwgZXRjLi4uKVxuICAgKlxuICAgKiBAbWV0aG9kIHVucmVnaXN0ZXJQdXNoVG9rZW5cbiAgICogQHBhcmFtIHtzdHJpbmd9IGRldmljZUlkIC0gWW91ciBJT1MgZGV2aWNlJ3MgZGV2aWNlIElEXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFjaz1udWxsXSAtIE9wdGlvbmFsIGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFcnJvcn0gY2FsbGJhY2suZXJyb3IgLSBMYXllckVycm9yIGlmIHRoZXJlIHdhcyBhbiBlcnJvcjsgbnVsbCBpZiBzdWNjZXNzZnVsXG4gICAqL1xuICB1bnJlZ2lzdGVyUHVzaFRva2VuKGRldmljZUlkLCBjYWxsYmFjaykge1xuICAgIHRoaXMueGhyKHtcbiAgICAgIHVybDogJ3B1c2hfdG9rZW5zLycgKyBkZXZpY2VJZCxcbiAgICAgIG1ldGhvZDogJ0RFTEVURScsXG4gICAgfSwgKHJlc3VsdCkgPT4gY2FsbGJhY2socmVzdWx0LmRhdGEpKTtcbiAgfVxuXG4gIC8qIFNFU1NJT04gTUFOQUdFTUVOVCBNRVRIT0RTIEVORCAqL1xuXG5cbiAgLyogQUNDRVNTT1IgTUVUSE9EUyBCRUdJTiAqL1xuXG4gIC8qKlxuICAgKiBfXyBNZXRob2RzIGFyZSBhdXRvbWF0aWNhbGx5IGNhbGxlZCBieSBwcm9wZXJ0eSBzZXR0ZXJzLlxuICAgKlxuICAgKiBBbnkgYXR0ZW1wdCB0byBleGVjdXRlIGB0aGlzLnVzZXJBcHBJZCA9ICd4eHgnYCB3aWxsIGNhdXNlIGFuIGVycm9yIHRvIGJlIHRocm93blxuICAgKiBpZiB0aGUgY2xpZW50IGlzIGFscmVhZHkgY29ubmVjdGVkLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAbWV0aG9kIF9fYWRqdXN0QXBwSWRcbiAgICogQHBhcmFtIHtzdHJpbmd9IHZhbHVlIC0gTmV3IGFwcElkIHZhbHVlXG4gICAqL1xuICBfX2FkanVzdEFwcElkKCkge1xuICAgIGlmICh0aGlzLmlzQ29ubmVjdGVkKSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmNhbnRDaGFuZ2VJZkNvbm5lY3RlZCk7XG4gIH1cblxuIC8qKlxuICAqIF9fIE1ldGhvZHMgYXJlIGF1dG9tYXRpY2FsbHkgY2FsbGVkIGJ5IHByb3BlcnR5IHNldHRlcnMuXG4gICpcbiAgKiBBbnkgYXR0ZW1wdCB0byBleGVjdXRlIGB0aGlzLnVzZXIgPSB1c2VySWRlbnRpdHlgIHdpbGwgY2F1c2UgYW4gZXJyb3IgdG8gYmUgdGhyb3duXG4gICogaWYgdGhlIGNsaWVudCBpcyBhbHJlYWR5IGNvbm5lY3RlZC5cbiAgKlxuICAqIEBwcml2YXRlXG4gICogQG1ldGhvZCBfX2FkanVzdFVzZXJcbiAgKiBAcGFyYW0ge3N0cmluZ30gdXNlciAtIG5ldyBJZGVudGl0eSBvYmplY3RcbiAgKi9cbiAgX19hZGp1c3RVc2VyKHVzZXIpIHtcbiAgICBpZiAodGhpcy5pc0Nvbm5lY3RlZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jYW50Q2hhbmdlSWZDb25uZWN0ZWQpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFZpcnR1YWwgbWV0aG9kc1xuICBfYWRkSWRlbnRpdHkoaWRlbnRpdHkpIHt9XG4gIF9yZW1vdmVJZGVudGl0eShpZGVudGl0eSkge31cblxuXG4gIC8qIEFDQ0VTU09SIE1FVEhPRFMgRU5EICovXG5cblxuICAvKiBDT01NVU5JQ0FUSU9OUyBNRVRIT0RTIEJFR0lOICovXG4gIHNlbmRTb2NrZXRSZXF1ZXN0KHBhcmFtcywgY2FsbGJhY2spIHtcbiAgICBpZiAocGFyYW1zLnN5bmMpIHtcbiAgICAgIGNvbnN0IHRhcmdldCA9IHBhcmFtcy5zeW5jLnRhcmdldDtcbiAgICAgIGxldCBkZXBlbmRzID0gcGFyYW1zLnN5bmMuZGVwZW5kcztcbiAgICAgIGlmICh0YXJnZXQgJiYgIWRlcGVuZHMpIGRlcGVuZHMgPSBbdGFyZ2V0XTtcblxuICAgICAgdGhpcy5zeW5jTWFuYWdlci5yZXF1ZXN0KG5ldyBXZWJzb2NrZXRTeW5jRXZlbnQoe1xuICAgICAgICBkYXRhOiBwYXJhbXMuYm9keSxcbiAgICAgICAgb3BlcmF0aW9uOiBwYXJhbXMubWV0aG9kLFxuICAgICAgICB0YXJnZXQsXG4gICAgICAgIGRlcGVuZHMsXG4gICAgICAgIGNhbGxiYWNrLFxuICAgICAgfSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodHlwZW9mIHBhcmFtcy5kYXRhID09PSAnZnVuY3Rpb24nKSBwYXJhbXMuZGF0YSA9IHBhcmFtcy5kYXRhKCk7XG4gICAgICB0aGlzLnNvY2tldFJlcXVlc3RNYW5hZ2VyLnNlbmRSZXF1ZXN0KHBhcmFtcywgY2FsbGJhY2spO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUaGlzIGV2ZW50IGhhbmRsZXIgcmVjZWl2ZXMgZXZlbnRzIGZyb20gdGhlIE9ubGluZSBTdGF0ZSBNYW5hZ2VyIGFuZCBnZW5lcmF0ZXMgYW4gZXZlbnQgZm9yIHRob3NlIHN1YnNjcmliZWRcbiAgICogdG8gY2xpZW50Lm9uKCdvbmxpbmUnKVxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVPbmxpbmVDaGFuZ2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICovXG4gIF9oYW5kbGVPbmxpbmVDaGFuZ2UoZXZ0KSB7XG4gICAgaWYgKCF0aGlzLmlzQXV0aGVudGljYXRlZCkgcmV0dXJuO1xuICAgIGNvbnN0IGR1cmF0aW9uID0gZXZ0Lm9mZmxpbmVEdXJhdGlvbjtcbiAgICBjb25zdCBpc09ubGluZSA9IGV2dC5ldmVudE5hbWUgPT09ICdjb25uZWN0ZWQnO1xuICAgIGNvbnN0IG9iaiA9IHsgaXNPbmxpbmUgfTtcbiAgICBpZiAoaXNPbmxpbmUpIHtcbiAgICAgIG9iai5yZXNldCA9IGR1cmF0aW9uID4gQ2xpZW50QXV0aGVudGljYXRvci5SZXNldEFmdGVyT2ZmbGluZUR1cmF0aW9uO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ29ubGluZScsIG9iaik7XG4gIH1cblxuICAvKipcbiAgICogTWFpbiBlbnRyeSBwb2ludCBmb3Igc2VuZGluZyB4aHIgcmVxdWVzdHMgb3IgZm9yIHF1ZWluZyB0aGVtIGluIHRoZSBzeW5jTWFuYWdlci5cbiAgICpcbiAgICogVGhpcyBjYWxsIGFkanVzdCBhcmd1bWVudHMgZm9yIG91ciBSRVNUIHNlcnZlci5cbiAgICpcbiAgICogQG1ldGhvZCB4aHJcbiAgICogQHByb3RlY3RlZFxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgb3B0aW9uc1xuICAgKiBAcGFyYW0gIHtzdHJpbmd9ICAgb3B0aW9ucy51cmwgLSBVUkwgcmVsYXRpdmUgY2xpZW50J3MgdXJsOiBcIi9jb252ZXJzYXRpb25zXCJcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSAge09iamVjdH0gICBjYWxsYmFjay5yZXN1bHRcbiAgICogQHBhcmFtICB7TWl4ZWR9ICAgIGNhbGxiYWNrLnJlc3VsdC5kYXRhIC0gSWYgYW4gZXJyb3Igb2NjdXJyZWQsIHRoaXMgaXMgYSBsYXllci5MYXllckVycm9yO1xuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIElmIHRoZSByZXNwb25zZSB3YXMgYXBwbGljYXRpb24vanNvbiwgdGhpcyB3aWxsIGJlIGFuIG9iamVjdFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIElmIHRoZSByZXNwb25zZSB3YXMgdGV4dC9lbXB0eSwgdGhpcyB3aWxsIGJlIHRleHQvZW1wdHlcbiAgICogQHBhcmFtICB7WE1MSHR0cFJlcXVlc3R9IGNhbGxiYWNrLnJlc3VsdC54aHIgLSBOYXRpdmUgeGhyIHJlcXVlc3Qgb2JqZWN0IGZvciBkZXRhaWxlZCBhbmFseXNpc1xuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICAgY2FsbGJhY2sucmVzdWx0LkxpbmtzIC0gSGFzaCBvZiBMaW5rIGhlYWRlcnNcbiAgICogQHJldHVybiB7bGF5ZXIuQ2xpZW50QXV0aGVudGljYXRvcn0gdGhpc1xuICAgKi9cbiAgeGhyKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCFvcHRpb25zLnN5bmMgfHwgIW9wdGlvbnMuc3luYy50YXJnZXQpIHtcbiAgICAgIG9wdGlvbnMudXJsID0gdGhpcy5feGhyRml4UmVsYXRpdmVVcmxzKG9wdGlvbnMudXJsIHx8ICcnKTtcbiAgICB9XG5cbiAgICBvcHRpb25zLndpdGhDcmVkZW50aWFscyA9IHRydWU7XG4gICAgaWYgKCFvcHRpb25zLm1ldGhvZCkgb3B0aW9ucy5tZXRob2QgPSAnR0VUJztcbiAgICBpZiAoIW9wdGlvbnMuaGVhZGVycykgb3B0aW9ucy5oZWFkZXJzID0ge307XG4gICAgdGhpcy5feGhyRml4SGVhZGVycyhvcHRpb25zLmhlYWRlcnMpO1xuICAgIHRoaXMuX3hockZpeEF1dGgob3B0aW9ucy5oZWFkZXJzKTtcblxuXG4gICAgLy8gTm90ZTogdGhpcyBpcyBub3Qgc3luYyB2cyBhc3luYzsgdGhpcyBpcyBzeW5jTWFuYWdlciB2cyBmaXJlIGl0IG5vd1xuICAgIGlmIChvcHRpb25zLnN5bmMgPT09IGZhbHNlKSB7XG4gICAgICB0aGlzLl9ub25zeW5jWGhyKG9wdGlvbnMsIGNhbGxiYWNrLCAwKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fc3luY1hocihvcHRpb25zLCBjYWxsYmFjayk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvciB4aHIgY2FsbHMgdGhhdCBnbyB0aHJvdWdoIHRoZSBzeW5jIG1hbmFnZXIsIHF1ZXVlIGl0IHVwLlxuICAgKlxuICAgKiBAbWV0aG9kIF9zeW5jWGhyXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gICBvcHRpb25zXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKi9cbiAgX3N5bmNYaHIob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBpZiAoIW9wdGlvbnMuc3luYykgb3B0aW9ucy5zeW5jID0ge307XG4gICAgY29uc3QgaW5uZXJDYWxsYmFjayA9IChyZXN1bHQpID0+IHtcbiAgICAgIHRoaXMuX3hoclJlc3VsdChyZXN1bHQsIGNhbGxiYWNrKTtcbiAgICB9O1xuICAgIGNvbnN0IHRhcmdldCA9IG9wdGlvbnMuc3luYy50YXJnZXQ7XG4gICAgbGV0IGRlcGVuZHMgPSBvcHRpb25zLnN5bmMuZGVwZW5kcztcbiAgICBpZiAodGFyZ2V0ICYmICFkZXBlbmRzKSBkZXBlbmRzID0gW3RhcmdldF07XG5cbiAgICB0aGlzLnN5bmNNYW5hZ2VyLnJlcXVlc3QobmV3IFhIUlN5bmNFdmVudCh7XG4gICAgICB1cmw6IG9wdGlvbnMudXJsLFxuICAgICAgZGF0YTogb3B0aW9ucy5kYXRhLFxuICAgICAgbWV0aG9kOiBvcHRpb25zLm1ldGhvZCxcbiAgICAgIG9wZXJhdGlvbjogb3B0aW9ucy5zeW5jLm9wZXJhdGlvbiB8fCBvcHRpb25zLm1ldGhvZCxcbiAgICAgIGhlYWRlcnM6IG9wdGlvbnMuaGVhZGVycyxcbiAgICAgIGNhbGxiYWNrOiBpbm5lckNhbGxiYWNrLFxuICAgICAgdGFyZ2V0LFxuICAgICAgZGVwZW5kcyxcbiAgICB9KSk7XG4gIH1cblxuICAvKipcbiAgICogRm9yIHhociBjYWxscyB0aGF0IGRvbid0IGdvIHRocm91Z2ggdGhlIHN5bmMgbWFuYWdlcixcbiAgICogZmlyZSB0aGUgcmVxdWVzdCwgYW5kIGlmIGl0IGZhaWxzLCByZWZpcmUgaXQgdXAgdG8gMyB0cmllc1xuICAgKiBiZWZvcmUgcmVwb3J0aW5nIGFuIGVycm9yLiAgMSBzZWNvbmQgZGVsYXkgYmV0d2VlbiByZXF1ZXN0c1xuICAgKiBzbyB3aGF0ZXZlciBpc3N1ZSBpcyBvY2N1cmluZyBpcyBhIHRpbnkgYml0IG1vcmUgbGlrZWx5IHRvIHJlc29sdmUsXG4gICAqIGFuZCBzbyB3ZSBkb24ndCBoYW1tZXIgdGhlIHNlcnZlciBldmVyeSB0aW1lIHRoZXJlJ3MgYSBwcm9ibGVtLlxuICAgKlxuICAgKiBAbWV0aG9kIF9ub25zeW5jWGhyXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gICBvcHRpb25zXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0gIHtudW1iZXJ9ICAgcmV0cnlDb3VudFxuICAgKi9cbiAgX25vbnN5bmNYaHIob3B0aW9ucywgY2FsbGJhY2ssIHJldHJ5Q291bnQpIHtcbiAgICB4aHIob3B0aW9ucywgcmVzdWx0ID0+IHtcbiAgICAgIGlmIChbNTAyLCA1MDMsIDUwNF0uaW5kZXhPZihyZXN1bHQuc3RhdHVzKSAhPT0gLTEgJiYgcmV0cnlDb3VudCA8IE1BWF9YSFJfUkVUUklFUykge1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuX25vbnN5bmNYaHIob3B0aW9ucywgY2FsbGJhY2ssIHJldHJ5Q291bnQgKyAxKSwgMTAwMCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl94aHJSZXN1bHQocmVzdWx0LCBjYWxsYmFjayk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogRml4IGF1dGhlbnRpY2F0aW9uIGhlYWRlciBmb3IgYW4geGhyIHJlcXVlc3RcbiAgICpcbiAgICogQG1ldGhvZCBfeGhyRml4QXV0aFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGhlYWRlcnNcbiAgICovXG4gIF94aHJGaXhBdXRoKGhlYWRlcnMpIHtcbiAgICBpZiAodGhpcy5zZXNzaW9uVG9rZW4gJiYgIWhlYWRlcnMuQXV0aG9yaXphdGlvbikge1xuICAgICAgaGVhZGVycy5hdXRob3JpemF0aW9uID0gJ0xheWVyIHNlc3Npb24tdG9rZW49XCInICsgIHRoaXMuc2Vzc2lvblRva2VuICsgJ1wiJzsgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBGaXggcmVsYXRpdmUgVVJMcyB0byBjcmVhdGUgYWJzb2x1dGUgVVJMcyBuZWVkZWQgZm9yIENPUlMgcmVxdWVzdHMuXG4gICAqXG4gICAqIEBtZXRob2QgX3hockZpeFJlbGF0aXZlVXJsc1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IHJlbGF0aXZlIG9yIGFic29sdXRlIHVybFxuICAgKiBAcmV0dXJuIHtzdHJpbmd9IGFic29sdXRlIHVybFxuICAgKi9cbiAgX3hockZpeFJlbGF0aXZlVXJscyh1cmwpIHtcbiAgICBsZXQgcmVzdWx0ID0gdXJsO1xuICAgIGlmICh1cmwuaW5kZXhPZignaHR0cHM6Ly8nKSA9PT0gLTEpIHtcbiAgICAgIGlmICh1cmxbMF0gPT09ICcvJykge1xuICAgICAgICByZXN1bHQgPSB0aGlzLnVybCArIHVybDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdCA9IHRoaXMudXJsICsgJy8nICsgdXJsO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLyoqXG4gICAqIEZpeHVwIGFsbCBoZWFkZXJzIGluIHByZXBhcmF0aW9uIGZvciBhbiB4aHIgY2FsbC5cbiAgICpcbiAgICogMS4gQWxsIGhlYWRlcnMgdXNlIGxvd2VyIGNhc2UgbmFtZXMgZm9yIHN0YW5kYXJkL2Vhc3kgbG9va3VwXG4gICAqIDIuIFNldCB0aGUgYWNjZXB0IGhlYWRlclxuICAgKiAzLiBJZiBuZWVkZWQsIHNldCB0aGUgY29udGVudC10eXBlIGhlYWRlclxuICAgKlxuICAgKiBAbWV0aG9kIF94aHJGaXhIZWFkZXJzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gaGVhZGVyc1xuICAgKi9cbiAgX3hockZpeEhlYWRlcnMoaGVhZGVycykge1xuICAgIC8vIFJlcGxhY2UgYWxsIGhlYWRlcnMgaW4gYXJiaXRyYXJ5IGNhc2Ugd2l0aCBhbGwgbG93ZXIgY2FzZVxuICAgIC8vIGZvciBlYXN5IG1hdGNoaW5nLlxuICAgIGNvbnN0IGhlYWRlck5hbWVMaXN0ID0gT2JqZWN0LmtleXMoaGVhZGVycyk7XG4gICAgaGVhZGVyTmFtZUxpc3QuZm9yRWFjaChoZWFkZXJOYW1lID0+IHtcbiAgICAgIGlmIChoZWFkZXJOYW1lICE9PSBoZWFkZXJOYW1lLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgICAgaGVhZGVyc1toZWFkZXJOYW1lLnRvTG93ZXJDYXNlKCldID0gaGVhZGVyc1toZWFkZXJOYW1lXTtcbiAgICAgICAgZGVsZXRlIGhlYWRlcnNbaGVhZGVyTmFtZV07XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoIWhlYWRlcnMuYWNjZXB0KSBoZWFkZXJzLmFjY2VwdCA9IEFDQ0VQVDtcblxuICAgIGlmICghaGVhZGVyc1snY29udGVudC10eXBlJ10pIGhlYWRlcnNbJ2NvbnRlbnQtdHlwZSddID0gJ2FwcGxpY2F0aW9uL2pzb24nO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSB0aGUgcmVzdWx0IG9mIGFuIHhociBjYWxsXG4gICAqXG4gICAqIEBtZXRob2QgX3hoclJlc3VsdFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgcmVzdWx0ICAgICBTdGFuZGFyZCB4aHIgcmVzcG9uc2Ugb2JqZWN0IGZyb20gdGhlIHhociBsaWJcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IFtjYWxsYmFja10gQ2FsbGJhY2sgb24gY29tcGxldGlvblxuICAgKi9cbiAgX3hoclJlc3VsdChyZXN1bHQsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHJldHVybjtcblxuICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgIC8vIFJlcGxhY2UgdGhlIHJlc3BvbnNlIHdpdGggYSBMYXllckVycm9yIGluc3RhbmNlXG4gICAgICBpZiAocmVzdWx0LmRhdGEgJiYgdHlwZW9mIHJlc3VsdC5kYXRhID09PSAnb2JqZWN0Jykge1xuICAgICAgICB0aGlzLl9nZW5lcmF0ZUVycm9yKHJlc3VsdCk7XG4gICAgICB9XG5cbiAgICAgIC8vIElmIGl0cyBhbiBhdXRoZW50aWNhdGlvbiBlcnJvciwgcmVhdXRoZW50aWNhdGVcbiAgICAgIC8vIGRvbid0IGNhbGwgX3Jlc2V0U2Vzc2lvbiBhcyB0aGF0IHdpcGVzIGFsbCBkYXRhIGFuZCBzY3Jld3Mgd2l0aCBVSXMsIGFuZCB0aGUgdXNlclxuICAgICAgLy8gaXMgc3RpbGwgYXV0aGVudGljYXRlZCBvbiB0aGUgY3VzdG9tZXIncyBhcHAgZXZlbiBpZiBub3Qgb24gTGF5ZXIuXG4gICAgICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gNDAxICYmIHRoaXMuaXNBdXRoZW50aWNhdGVkKSB7XG4gICAgICAgIGxvZ2dlci53YXJuKCdTRVNTSU9OIEVYUElSRUQhJyk7XG4gICAgICAgIHRoaXMuaXNBdXRoZW50aWNhdGVkID0gZmFsc2U7XG4gICAgICAgIGlmIChnbG9iYWwubG9jYWxTdG9yYWdlKSBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShMT0NBTFNUT1JBR0VfS0VZUy5TRVNTSU9OREFUQSArIHRoaXMuYXBwSWQpO1xuICAgICAgICB0aGlzLnRyaWdnZXIoJ2RlYXV0aGVudGljYXRlZCcpO1xuICAgICAgICB0aGlzLl9hdXRoZW50aWNhdGUocmVzdWx0LmRhdGEuZ2V0Tm9uY2UoKSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2socmVzdWx0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUcmFuc2Zvcm1zIHhociBlcnJvciByZXNwb25zZSBpbnRvIGEgbGF5ZXIuTGF5ZXJFcnJvciBpbnN0YW5jZS5cbiAgICpcbiAgICogQWRkcyBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIHRvIHRoZSByZXN1bHQgb2JqZWN0IGluY2x1ZGluZ1xuICAgKlxuICAgKiAqIHVybFxuICAgKiAqIGRhdGFcbiAgICpcbiAgICogQG1ldGhvZCBfZ2VuZXJhdGVFcnJvclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IHJlc3VsdCAtIFJlc3VsdCBvZiB0aGUgeGhyIGNhbGxcbiAgICovXG4gIF9nZW5lcmF0ZUVycm9yKHJlc3VsdCkge1xuICAgIHJlc3VsdC5kYXRhID0gbmV3IExheWVyRXJyb3IocmVzdWx0LmRhdGEpO1xuICAgIGlmICghcmVzdWx0LmRhdGEuaHR0cFN0YXR1cykgcmVzdWx0LmRhdGEuaHR0cFN0YXR1cyA9IHJlc3VsdC5zdGF0dXM7XG4gICAgcmVzdWx0LmRhdGEubG9nKCk7XG4gIH1cblxuICAvKiBFTkQgQ09NTVVOSUNBVElPTlMgTUVUSE9EUyAqL1xuXG59XG5cbi8qKlxuICogU3RhdGUgdmFyaWFibGU7IGluZGljYXRlcyB0aGF0IGNsaWVudCBpcyBjdXJyZW50bHkgYXV0aGVudGljYXRlZCBieSB0aGUgc2VydmVyLlxuICogU2hvdWxkIG5ldmVyIGJlIHRydWUgaWYgaXNDb25uZWN0ZWQgaXMgZmFsc2UuXG4gKiBAdHlwZSB7Qm9vbGVhbn1cbiAqIEByZWFkb25seVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5pc0F1dGhlbnRpY2F0ZWQgPSBmYWxzZTtcblxuLyoqXG4gKiBTdGF0ZSB2YXJpYWJsZTsgaW5kaWNhdGVzIHRoYXQgY2xpZW50IGlzIGN1cnJlbnRseSBjb25uZWN0ZWQgdG8gc2VydmVyXG4gKiAobWF5IG5vdCBiZSBhdXRoZW50aWNhdGVkIHlldClcbiAqIEB0eXBlIHtCb29sZWFufVxuICogQHJlYWRvbmx5XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLmlzQ29ubmVjdGVkID0gZmFsc2U7XG5cbi8qKlxuICogU3RhdGUgdmFyaWFibGU7IGluZGljYXRlcyB0aGF0IGNsaWVudCBpcyByZWFkeSBmb3IgdGhlIGFwcCB0byB1c2UuXG4gKiBVc2UgdGhlICdyZWFkeScgZXZlbnQgdG8gYmUgbm90aWZpZWQgd2hlbiB0aGlzIHZhbHVlIGNoYW5nZXMgdG8gdHJ1ZS5cbiAqXG4gKiBAdHlwZSB7Ym9vbGVhbn1cbiAqIEByZWFkb25seVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5pc1JlYWR5ID0gZmFsc2U7XG5cbi8qKlxuICogWW91ciBMYXllciBBcHBsaWNhdGlvbiBJRC4gVGhpcyB2YWx1ZSBjYW4gbm90IGJlIGNoYW5nZWQgb25jZSBjb25uZWN0ZWQuXG4gKiBUbyBmaW5kIHlvdXIgTGF5ZXIgQXBwbGljYXRpb24gSUQsIHNlZSB5b3VyIExheWVyIERldmVsb3BlciBEYXNoYm9hcmQuXG4gKlxuICogQHR5cGUge1N0cmluZ31cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUuYXBwSWQgPSAnJztcblxuLyoqXG4gKiBJZGVudGl0eSBpbmZvcm1hdGlvbiBhYm91dCB0aGUgYXV0aGVudGljYXRlZCB1c2VyLlxuICpcbiAqIEB0eXBlIHtsYXllci5JZGVudGl0eX1cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUudXNlciA9IG51bGw7XG5cbi8qKlxuICogWW91ciBjdXJyZW50IHNlc3Npb24gdG9rZW4gdGhhdCBhdXRoZW50aWNhdGVzIHlvdXIgcmVxdWVzdHMuXG4gKlxuICogQHR5cGUge1N0cmluZ31cbiAqIEByZWFkb25seVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5zZXNzaW9uVG9rZW4gPSAnJztcblxuLyoqXG4gKiBVUkwgdG8gTGF5ZXIncyBXZWIgQVBJIHNlcnZlci5cbiAqXG4gKiBPbmx5IG11Y2sgd2l0aCB0aGlzIGlmIHRvbGQgdG8gYnkgTGF5ZXIgU3RhZmYuXG4gKiBAdHlwZSB7U3RyaW5nfVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS51cmwgPSAnaHR0cHM6Ly9hcGkubGF5ZXIuY29tJztcblxuLyoqXG4gKiBVUkwgdG8gTGF5ZXIncyBXZWJzb2NrZXQgc2VydmVyLlxuICpcbiAqIE9ubHkgbXVjayB3aXRoIHRoaXMgaWYgdG9sZCB0byBieSBMYXllciBTdGFmZi5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLndlYnNvY2tldFVybCA9ICd3c3M6Ly93ZWJzb2NrZXRzLmxheWVyLmNvbSc7XG5cbi8qKlxuICogV2ViIFNvY2tldCBNYW5hZ2VyXG4gKiBAdHlwZSB7bGF5ZXIuV2Vic29ja2V0cy5Tb2NrZXRNYW5hZ2VyfVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5zb2NrZXRNYW5hZ2VyID0gbnVsbDtcblxuLyoqXG4gKiBXZWIgU29ja2V0IFJlcXVlc3QgTWFuYWdlclxuKiBAdHlwZSB7bGF5ZXIuV2Vic29ja2V0cy5SZXF1ZXN0TWFuYWdlcn1cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUuc29ja2V0UmVxdWVzdE1hbmFnZXIgPSBudWxsO1xuXG4vKipcbiAqIFdlYiBTb2NrZXQgTWFuYWdlclxuICogQHR5cGUge2xheWVyLldlYnNvY2tldHMuQ2hhbmdlTWFuYWdlcn1cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUuc29ja2V0Q2hhbmdlTWFuYWdlciA9IG51bGw7XG5cbi8qKlxuICogU2VydmljZSBmb3IgbWFuYWdpbmcgb25saW5lIGFzIHdlbGwgYXMgb2ZmbGluZSBzZXJ2ZXIgcmVxdWVzdHNcbiAqIEB0eXBlIHtsYXllci5TeW5jTWFuYWdlcn1cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUuc3luY01hbmFnZXIgPSBudWxsO1xuXG4vKipcbiAqIFNlcnZpY2UgZm9yIG1hbmFnaW5nIG9ubGluZS9vZmZsaW5lIHN0YXRlIGFuZCBldmVudHNcbiAqIEB0eXBlIHtsYXllci5PbmxpbmVTdGF0ZU1hbmFnZXJ9XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLm9ubGluZU1hbmFnZXIgPSBudWxsO1xuXG4vKipcbiAqIElmIHRoaXMgaXMgYSB0cnVzdGVkIGRldmljZSwgdGhlbiB3ZSBjYW4gd3JpdGUgcGVyc29uYWwgZGF0YSB0byBwZXJzaXN0ZW50IG1lbW9yeS5cbiAqIEB0eXBlIHtib29sZWFufVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5pc1RydXN0ZWREZXZpY2UgPSBmYWxzZTtcblxuLyoqXG4gKiBUbyBlbmFibGUgaW5kZXhlZERCIHN0b3JhZ2Ugb2YgcXVlcnkgZGF0YSwgc2V0IHRoaXMgdHJ1ZS4gIEV4cGVyaW1lbnRhbC5cbiAqXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59XG4gKi9cbkNsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLmlzUGVyc2lzdGVuY2VFbmFibGVkID0gZmFsc2U7XG5cbi8qKlxuICogSWYgdGhpcyBsYXllci5DbGllbnQuaXNUcnVzdGVkRGV2aWNlIGlzIHRydWUsIHRoZW4geW91IGNhbiBjb250cm9sIHdoaWNoIHR5cGVzIG9mIGRhdGEgYXJlIHBlcnNpc3RlZC5cbiAqXG4gKiBOb3RlIHRoYXQgdmFsdWVzIGhlcmUgYXJlIGlnbm9yZWQgaWYgYGlzUGVyc2lzdGVuY2VFbmFibGVkYCBoYXNuJ3QgYmVlbiBzZXQgdG8gYHRydWVgLlxuICpcbiAqIFByb3BlcnRpZXMgb2YgdGhpcyBPYmplY3QgY2FuIGJlOlxuICpcbiAqICogaWRlbnRpdGllczogV3JpdGUgaWRlbnRpdGllcyB0byBpbmRleGVkREI/IFRoaXMgYWxsb3dzIGZvciBmYXN0ZXIgaW5pdGlhbGl6YXRpb24uXG4gKiAqIGNvbnZlcnNhdGlvbnM6IFdyaXRlIGNvbnZlcnNhdGlvbnMgdG8gaW5kZXhlZERCPyBUaGlzIGFsbG93cyBmb3IgZmFzdGVyIHJlbmRlcmluZ1xuICogICAgICAgICAgICAgICAgICBvZiBhIENvbnZlcnNhdGlvbiBMaXN0XG4gKiAqIG1lc3NhZ2VzOiBXcml0ZSBtZXNzYWdlcyB0byBpbmRleGVkREI/IFRoaXMgYWxsb3dzIGZvciBmdWxsIG9mZmxpbmUgYWNjZXNzXG4gKiAqIHN5bmNRdWV1ZTogV3JpdGUgcmVxdWVzdHMgbWFkZSB3aGlsZSBvZmZsaW5lIHRvIGluZGV4ZWREQj8gIFRoaXMgYWxsb3dzIHRoZSBhcHBcbiAqICAgICAgICAgICAgICB0byBjb21wbGV0ZSBzZW5kaW5nIG1lc3NhZ2VzIGFmdGVyIGJlaW5nIHJlbGF1bmNoZWQuXG4gKiAqIHNlc3Npb25Ub2tlbjogV3JpdGUgdGhlIHNlc3Npb24gdG9rZW4gdG8gbG9jYWxTdG9yYWdlIGZvciBxdWljayByZWF1dGhlbnRpY2F0aW9uIG9uIHJlbGF1bmNoaW5nIHRoZSBhcHAuXG4gKlxuICogICAgICBuZXcgbGF5ZXIuQ2xpZW50KHtcbiAqICAgICAgICBpc1RydXN0ZWREZXZpY2U6IHRydWUsXG4gKiAgICAgICAgcGVyc2lzdGVuY2VGZWF0dXJlczoge1xuICogICAgICAgICAgY29udmVyc2F0aW9uczogdHJ1ZSxcbiAqICAgICAgICAgIGlkZW50aXRpZXM6IHRydWUsXG4gKiAgICAgICAgICBtZXNzYWdlczogZmFsc2UsXG4gKiAgICAgICAgICBzeW5jUXVldWU6IGZhbHNlLFxuICogICAgICAgICAgc2Vzc2lvblRva2VuOiB0cnVlXG4gKiAgICAgICAgfVxuICogICAgICB9KTtcbiAqXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5wZXJzaXN0ZW5jZUZlYXR1cmVzID0gbnVsbDtcblxuLyoqXG4gKiBEYXRhYmFzZSBNYW5hZ2VyIGZvciByZWFkL3dyaXRlIHRvIEluZGV4ZWREQlxuICogQHR5cGUge2xheWVyLkRiTWFuYWdlcn1cbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5wcm90b3R5cGUuZGJNYW5hZ2VyID0gbnVsbDtcblxuLyoqXG4gKiBJZiBhIGRpc3BsYXkgbmFtZSBpcyBub3QgbG9hZGVkIGZvciB0aGUgc2Vzc2lvbiBvd25lciwgdXNlIHRoaXMgbmFtZS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZS5kZWZhdWx0T3duZXJEaXNwbGF5TmFtZSA9ICdZb3UnO1xuXG4vKipcbiAqIElzIHRydWUgaWYgdGhlIGNsaWVudCBpcyBhdXRoZW50aWNhdGVkIGFuZCBjb25uZWN0ZWQgdG8gdGhlIHNlcnZlcjtcbiAqXG4gKiBUeXBpY2FsbHkgdXNlZCB0byBkZXRlcm1pbmUgaWYgdGhlcmUgaXMgYSBjb25uZWN0aW9uIHRvIHRoZSBzZXJ2ZXIuXG4gKlxuICogVHlwaWNhbGx5IHVzZWQgaW4gY29uanVuY3Rpb24gd2l0aCB0aGUgYG9ubGluZWAgZXZlbnQuXG4gKlxuICogQHR5cGUge2Jvb2xlYW59XG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShDbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZSwgJ2lzT25saW5lJywge1xuICBlbnVtZXJhYmxlOiB0cnVlLFxuICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICByZXR1cm4gdGhpcy5vbmxpbmVNYW5hZ2VyICYmIHRoaXMub25saW5lTWFuYWdlci5pc09ubGluZTtcbiAgfSxcbn0pO1xuXG4vKipcbiAqIExvZyBsZXZlbHM7IG9uZSBvZjpcbiAqXG4gKiAgICAqIGxheWVyLkNvbnN0YW50cy5MT0cuTk9ORVxuICogICAgKiBsYXllci5Db25zdGFudHMuTE9HLkVSUk9SXG4gKiAgICAqIGxheWVyLkNvbnN0YW50cy5MT0cuV0FSTlxuICogICAgKiBsYXllci5Db25zdGFudHMuTE9HLklORk9cbiAqICAgICogbGF5ZXIuQ29uc3RhbnRzLkxPRy5ERUJVR1xuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShDbGllbnRBdXRoZW50aWNhdG9yLnByb3RvdHlwZSwgJ2xvZ0xldmVsJywge1xuICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7IHJldHVybiBsb2dnZXIubGV2ZWw7IH0sXG4gIHNldDogZnVuY3Rpb24gc2V0KHZhbHVlKSB7IGxvZ2dlci5sZXZlbCA9IHZhbHVlOyB9LFxufSk7XG5cbi8qKlxuICogU2hvcnQgaGFuZCBmb3IgZ2V0dGluZyB0aGUgdXNlcklkIG9mIHRoZSBhdXRoZW50aWNhdGVkIHVzZXIuXG4gKlxuICogQ291bGQgYWxzbyBqdXN0IHVzZSBjbGllbnQudXNlci51c2VySWRcbiAqXG4gKiBAdHlwZSB7c3RyaW5nfSB1c2VySWRcbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KENsaWVudEF1dGhlbnRpY2F0b3IucHJvdG90eXBlLCAndXNlcklkJywge1xuICBlbnVtZXJhYmxlOiB0cnVlLFxuICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICByZXR1cm4gdGhpcy51c2VyID8gdGhpcy51c2VyLnVzZXJJZCA6ICcnO1xuICB9LFxuICBzZXQ6IGZ1bmN0aW9uIHNldCgpIHt9LFxufSk7XG5cbi8qKlxuICogVGltZSB0byBiZSBvZmZsaW5lIGFmdGVyIHdoaWNoIHdlIGRvbid0IGRvIGEgV2ViU29ja2V0IEV2ZW50cy5yZXBsYXksXG4gKiBidXQgaW5zdGVhZCBqdXN0IHJlZnJlc2ggYWxsIG91ciBRdWVyeSBkYXRhLiAgRGVmYXVsdHMgdG8gMzAgaG91cnMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBzdGF0aWNcbiAqL1xuQ2xpZW50QXV0aGVudGljYXRvci5SZXNldEFmdGVyT2ZmbGluZUR1cmF0aW9uID0gMTAwMCAqIDYwICogNjAgKiAzMDtcblxuLyoqXG4gKiBMaXN0IG9mIGV2ZW50cyBzdXBwb3J0ZWQgYnkgdGhpcyBjbGFzc1xuICogQHN0YXRpY1xuICogQHByb3RlY3RlZFxuICogQHR5cGUge3N0cmluZ1tdfVxuICovXG5DbGllbnRBdXRoZW50aWNhdG9yLl9zdXBwb3J0ZWRFdmVudHMgPSBbXG4gIC8qKlxuICAgKiBUaGUgY2xpZW50IGlzIHJlYWR5IGZvciBhY3Rpb25cbiAgICpcbiAgICogICAgICBjbGllbnQub24oJ3JlYWR5JywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgICAgICAgIHJlbmRlck15VUkoKTtcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogQGV2ZW50XG4gICAqL1xuICAncmVhZHknLFxuXG4gIC8qKlxuICAgKiBGaXJlZCB3aGVuIGNvbm5lY3RlZCB0byB0aGUgc2VydmVyLlxuICAgKiBDdXJyZW50bHkganVzdCBtZWFucyB3ZSBoYXZlIGEgbm9uY2UuXG4gICAqIE5vdCByZWNvbW1lbmRlZCBmb3IgdHlwaWNhbCBhcHBsaWNhdGlvbnMuXG4gICAqIEBldmVudCBjb25uZWN0ZWRcbiAgICovXG4gICdjb25uZWN0ZWQnLFxuXG4gIC8qKlxuICAgKiBGaXJlZCB3aGVuIHVuc3VjY2Vzc2Z1bCBpbiBvYnRhaW5pbmcgYSBub25jZS5cbiAgICpcbiAgICogTm90IHJlY29tbWVuZGVkIGZvciB0eXBpY2FsIGFwcGxpY2F0aW9ucy5cbiAgICogQGV2ZW50IGNvbm5lY3RlZC1lcnJvclxuICAgKiBAcGFyYW0ge09iamVjdH0gZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckVycm9yfSBldmVudC5lcnJvclxuICAgKi9cbiAgJ2Nvbm5lY3RlZC1lcnJvcicsXG5cbiAgLyoqXG4gICAqIFdlIG5vdyBoYXZlIGEgc2Vzc2lvbiBhbmQgYW55IHJlcXVlc3RzIHdlIHNlbmQgYXVnaHQgdG8gd29yay5cbiAgICogVHlwaWNhbGx5IHlvdSBzaG91bGQgdXNlIHRoZSByZWFkeSBldmVudCBpbnN0ZWFkIG9mIHRoZSBhdXRoZW50aWNhdGVkIGV2ZW50LlxuICAgKiBAZXZlbnQgYXV0aGVudGljYXRlZFxuICAgKi9cbiAgJ2F1dGhlbnRpY2F0ZWQnLFxuXG4gIC8qKlxuICAgKiBGYWlsZWQgdG8gYXV0aGVudGljYXRlIHlvdXIgY2xpZW50LlxuICAgKlxuICAgKiBFaXRoZXIgeW91ciBpZGVudGl0eS10b2tlbiB3YXMgaW52YWxpZCwgb3Igc29tZXRoaW5nIHdlbnQgd3JvbmdcbiAgICogdXNpbmcgeW91ciBpZGVudGl0eS10b2tlbi5cbiAgICpcbiAgICogQGV2ZW50IGF1dGhlbnRpY2F0ZWQtZXJyb3JcbiAgICogQHBhcmFtIHtPYmplY3R9IGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFcnJvcn0gZXZlbnQuZXJyb3JcbiAgICovXG4gICdhdXRoZW50aWNhdGVkLWVycm9yJyxcblxuICAvKipcbiAgICogVGhpcyBldmVudCBmaXJlcyB3aGVuIGEgc2Vzc2lvbiBoYXMgZXhwaXJlZCBvciB3aGVuIGBsYXllci5DbGllbnQubG9nb3V0YCBpcyBjYWxsZWQuXG4gICAqIFR5cGljYWxseSwgaXQgaXMgZW5vdWdoIHRvIHN1YnNjcmliZSB0byB0aGUgY2hhbGxlbmdlIGV2ZW50XG4gICAqIHdoaWNoIHdpbGwgbGV0IHlvdSByZWF1dGhlbnRpY2F0ZTsgdHlwaWNhbCBhcHBsaWNhdGlvbnMgZG8gbm90IG5lZWRcbiAgICogdG8gc3Vic2NyaWJlIHRvIHRoaXMuXG4gICAqXG4gICAqIEBldmVudCBkZWF1dGhlbnRpY2F0ZWRcbiAgICovXG4gICdkZWF1dGhlbnRpY2F0ZWQnLFxuXG4gIC8qKlxuICAgKiBAZXZlbnQgY2hhbGxlbmdlXG4gICAqIFZlcmlmeSB0aGUgdXNlcidzIGlkZW50aXR5LlxuICAgKlxuICAgKiBUaGlzIGV2ZW50IGlzIHdoZXJlIHlvdSB2ZXJpZnkgdGhhdCB0aGUgdXNlciBpcyB3aG8gd2UgYWxsIHRoaW5rIHRoZSB1c2VyIGlzLFxuICAgKiBhbmQgcHJvdmlkZSBhbiBpZGVudGl0eSB0b2tlbiB0byB2YWxpZGF0ZSB0aGF0LlxuICAgKlxuICAgKiBgYGBqYXZhc2NyaXB0XG4gICAqIGNsaWVudC5vbignY2hhbGxlbmdlJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgIG15R2V0SWRlbnRpdHlGb3JOb25jZShldnQubm9uY2UsIGZ1bmN0aW9uKGlkZW50aXR5VG9rZW4pIHtcbiAgICogICAgICBldnQuY2FsbGJhY2soaWRlbnRpdHlUb2tlbik7XG4gICAqICAgIH0pO1xuICAgKiB9KTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBldmVudFxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnQubm9uY2UgLSBBIG5vbmNlIGZvciB5b3UgdG8gcHJvdmlkZSB0byB5b3VyIGlkZW50aXR5IHByb3ZpZGVyXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGV2ZW50LmNhbGxiYWNrIC0gQ2FsbCB0aGlzIG9uY2UgeW91IGhhdmUgYW4gaWRlbnRpdHktdG9rZW5cbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50LmNhbGxiYWNrLmlkZW50aXR5VG9rZW4gLSBJZGVudGl0eSB0b2tlbiBwcm92aWRlZCBieSB5b3VyIGlkZW50aXR5IHByb3ZpZGVyIHNlcnZpY2VcbiAgICovXG4gICdjaGFsbGVuZ2UnLFxuXG4gIC8qKlxuICAgKiBAZXZlbnQgc2Vzc2lvbi10ZXJtaW5hdGVkXG4gICAqIElmIHlvdXIgc2Vzc2lvbiBoYXMgYmVlbiB0ZXJtaW5hdGVkIGluIHN1Y2ggYSB3YXkgYXMgdG8gcHJldmVudCBhdXRvbWF0aWMgcmVjb25uZWN0LFxuICAgKlxuICAgKiB0aGlzIGV2ZW50IHdpbGwgZmlyZS4gIENvbW1vbiBzY2VuYXJpbzogdXNlciBoYXMgdHdvIHRhYnMgb3BlbjtcbiAgICogb25lIHRhYiB0aGUgdXNlciBsb2dzIG91dCAob3IgeW91IGNhbGwgY2xpZW50LmxvZ291dCgpKS5cbiAgICogVGhlIG90aGVyIHRhYiB3aWxsIGRldGVjdCB0aGF0IHRoZSBzZXNzaW9uVG9rZW4gaGFzIGJlZW4gcmVtb3ZlZCxcbiAgICogYW5kIHdpbGwgdGVybWluYXRlIGl0cyBzZXNzaW9uIGFzIHdlbGwuICBJbiB0aGlzIHNjZW5hcmlvIHdlIGRvIG5vdCB3YW50XG4gICAqIHRvIGF1dG9tYXRpY2FsbHkgdHJpZ2dlciBhIGNoYWxsZW5nZSBhbmQgcmVzdGFydCB0aGUgbG9naW4gcHJvY2Vzcy5cbiAgICovXG4gICdzZXNzaW9uLXRlcm1pbmF0ZWQnLFxuXG4gIC8qKlxuICAgKiBAZXZlbnQgb25saW5lXG4gICAqXG4gICAqIFRoaXMgZXZlbnQgaXMgdXNlZCB0byBkZXRlY3Qgd2hlbiB0aGUgY2xpZW50IGlzIG9ubGluZSAoY29ubmVjdGVkIHRvIHRoZSBzZXJ2ZXIpXG4gICAqIG9yIG9mZmxpbmUgKHN0aWxsIGFibGUgdG8gYWNjZXB0IEFQSSBjYWxscyBidXQgbm8gbG9uZ2VyIGFibGUgdG8gc3luYyB0byB0aGUgc2VydmVyKS5cbiAgICpcbiAgICogICAgICBjbGllbnQub24oJ29ubGluZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICAgICAgIGlmIChldnQuaXNPbmxpbmUpIHtcbiAgICogICAgICAgICAgICAgc3RhdHVzRGl2LnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICdncmVlbic7XG4gICAqICAgICAgICAgfSBlbHNlIHtcbiAgICogICAgICAgICAgICAgc3RhdHVzRGl2LnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICdyZWQnO1xuICAgKiAgICAgICAgIH1cbiAgICogICAgICB9KTtcbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IGV2ZW50XG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gZXZlbnQuaXNPbmxpbmVcbiAgICovXG4gICdvbmxpbmUnLFxuXS5jb25jYXQoUm9vdC5fc3VwcG9ydGVkRXZlbnRzKTtcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoQ2xpZW50QXV0aGVudGljYXRvciwgW0NsaWVudEF1dGhlbnRpY2F0b3IsICdDbGllbnRBdXRoZW50aWNhdG9yJ10pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IENsaWVudEF1dGhlbnRpY2F0b3I7XG4iXX0=
