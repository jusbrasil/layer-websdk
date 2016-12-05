'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The Syncable abstract clas represents resources that are syncable with the server.
 * This is currently used for Messages and Conversations.
 * It represents the state of the object's sync, as one of:
 *
 *  * layer.Constants.SYNC_STATE.NEW: Newly created; local only.
 *  * layer.Constants.SYNC_STATE.SAVING: Newly created; being sent to the server
 *  * layer.Constants.SYNC_STATE.SYNCING: Exists on both client and server, but changes are being sent to server.
 *  * layer.Constants.SYNC_STATE.SYNCED: Exists on both client and server and is synced.
 *  * layer.Constants.SYNC_STATE.LOADING: Exists on server; loading it into client.
 *
 * @class layer.Syncable
 * @extends layer.Root
 * @abstract
 */

var Root = require('./root');

var _require = require('./const');

var SYNC_STATE = _require.SYNC_STATE;

var LayerError = require('./layer-error');
var ClientRegistry = require('./client-registry');
var Constants = require('./const');

var Syncable = function (_Root) {
  _inherits(Syncable, _Root);

  function Syncable() {
    var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Syncable);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Syncable).call(this, options));

    _this.localCreatedAt = new Date();
    return _this;
  }

  /**
   * Get the client associated with this Object.
   *
   * @method getClient
   * @return {layer.Client}
   */


  _createClass(Syncable, [{
    key: 'getClient',
    value: function getClient() {
      return ClientRegistry.get(this.clientId);
    }

    /**
     * Fire an XHR request using the URL for this resource.
     *
     * For more info on xhr method parameters see {@link layer.ClientAuthenticator#xhr}
     *
     * @method _xhr
     * @protected
     * @return {layer.Syncable} this
     */

  }, {
    key: '_xhr',
    value: function _xhr(options, callback) {
      var _this2 = this;

      // initialize
      if (!options.url) options.url = '';
      if (!options.method) options.method = 'GET';
      var client = this.getClient();

      // Validatation
      if (this.isDestroyed) throw new Error(LayerError.dictionary.isDestroyed);
      if (!client) throw new Error(LayerError.dictionary.clientMissing);
      if (!this.constructor.enableOpsIfNew && options.method !== 'POST' && options.method !== 'GET' && this.syncState === Constants.SYNC_STATE.NEW) return this;

      if (!options.url.match(/^http(s):\/\//)) {
        if (options.url && !options.url.match(/^(\/|\?)/)) options.url = '/' + options.url;
        if (!options.sync) options.url = this.url + options.url;
      }

      // Setup sync structure
      options.sync = this._setupSyncObject(options.sync);

      if (options.method !== 'GET') {
        this._setSyncing();
      }

      client.xhr(options, function (result) {
        if (result.success && options.method !== 'GET' && !_this2.isDestroyed) {
          _this2._setSynced();
        }
        if (callback) callback(result);
      });
      return this;
    }

    /**
     * Setup an object to pass in the `sync` parameter for any sync requests.
     *
     * @method _setupSyncObject
     * @private
     * @param {Object} sync - Known parameters of the sync object to be returned; or null.
     * @return {Object} fleshed out sync object
     */

  }, {
    key: '_setupSyncObject',
    value: function _setupSyncObject(sync) {
      if (sync !== false) {
        if (!sync) sync = {};
        if (!sync.target) sync.target = this.id;
      }
      return sync;
    }

    /**
     * A websocket event has been received specifying that this resource
     * has been deleted.
     *
     * @method handleWebsocketDelete
     * @protected
     * @param {Object} data
     */

  }, {
    key: '_handleWebsocketDelete',
    value: function _handleWebsocketDelete(data) {
      this._deleted();
      this.destroy();
    }

    /**
     * The Object has been deleted.
     *
     * Destroy must be called separately, and handles most cleanup.
     *
     * @method _deleted
     * @protected
     */

  }, {
    key: '_deleted',
    value: function _deleted() {
      this.trigger(this.constructor.eventPrefix + ':delete');
    }

    /**
     * Load the resource identified via a Layer ID.
     *
     * Will load the requested resource from persistence or server as needed,
     * and trigger `type-name:loaded` when its loaded.  Instance returned by this
     * method will have only ID and URL properties, all others are unset until
     * the `conversations:loaded`, `messages:loaded`, etc... event has fired.
     *
     * ```
     * var message = layer.Message.load(messageId, client);
     * message.once('messages:loaded', function(evt) {
     *    alert("Message loaded");
     * });
     * ```
     *
     * @method load
     * @static
     * @param {string} id - `layer:///messages/UUID`
     * @param {layer.Client} client
     * @return {layer.Syncable} - Returns an empty object that will be populated once data is loaded.
     */

  }, {
    key: '_load',


    /**
     * Load this resource from the server.
     *
     * Called from the static layer.Syncable.load() method
     *
     * @method _load
     * @private
     */
    value: function _load() {
      var _this3 = this;

      this.syncState = SYNC_STATE.LOADING;
      this._xhr({
        method: 'GET',
        sync: false
      }, function (result) {
        return _this3._loadResult(result);
      });
    }
  }, {
    key: '_loadResult',
    value: function _loadResult(result) {
      var _this4 = this;

      var prefix = this.constructor.eventPrefix;
      if (!result.success) {
        this.syncState = SYNC_STATE.NEW;
        this._triggerAsync(prefix + ':loaded-error', { error: result.data });
        setTimeout(function () {
          return _this4.destroy();
        }, 100); // Insure destroyed AFTER loaded-error event has triggered
      } else {
        this._populateFromServer(result.data);
        this._loaded(result.data);
        this.trigger(prefix + ':loaded');
      }
    }

    /**
     * Processing the result of a _load() call.
     *
     * Typically used to register the object and cleanup any properties not handled by _populateFromServer.
     *
     * @method _loaded
     * @private
     * @param  {Object} data - Response data from server
     */

  }, {
    key: '_loaded',
    value: function _loaded(data) {}

    /**
     * Object is new, and is queued for syncing, but does not yet exist on the server.
     *
     * That means it is currently out of sync with the server.
     *
     * @method _setSyncing
     * @private
     */

  }, {
    key: '_setSyncing',
    value: function _setSyncing() {
      this._clearObject();
      switch (this.syncState) {
        case SYNC_STATE.SYNCED:
          this.syncState = SYNC_STATE.SYNCING;
          break;
        case SYNC_STATE.NEW:
          this.syncState = SYNC_STATE.SAVING;
          break;
      }
      this._syncCounter++;
    }

    /**
     * Object is synced with the server and up to date.
     *
     * @method _setSynced
     * @private
     */

  }, {
    key: '_setSynced',
    value: function _setSynced() {
      this._clearObject();
      if (this._syncCounter > 0) this._syncCounter--;

      this.syncState = this._syncCounter === 0 ? SYNC_STATE.SYNCED : SYNC_STATE.SYNCING;
      this.isSending = false;
    }

    /**
     * Any time the instance changes, we should clear the cached toObject value
     *
     * @method _clearObject
     * @private
     */

  }, {
    key: '_clearObject',
    value: function _clearObject() {
      this._toObject = null;
    }

    /**
     * Returns a plain object.
     *
     * Object will have all the same public properties as this
     * Syncable instance.  New object is returned any time
     * any of this object's properties change.
     *
     * @method toObject
     * @return {Object} POJO version of this object.
     */

  }, {
    key: 'toObject',
    value: function toObject() {
      if (!this._toObject) {
        this._toObject = _get(Object.getPrototypeOf(Syncable.prototype), 'toObject', this).call(this);
        this._toObject.isNew = this.isNew();
        this._toObject.isSaving = this.isSaving();
        this._toObject.isSaved = this.isSaved();
        this._toObject.isSynced = this.isSynced();
      }
      return this._toObject;
    }

    /**
     * Object is new, and is not yet queued for syncing
     *
     * @method isNew
     * @returns {boolean}
     */

  }, {
    key: 'isNew',
    value: function isNew() {
      return this.syncState === SYNC_STATE.NEW;
    }

    /**
     * Object is new, and is queued for syncing
     *
     * @method isSaving
     * @returns {boolean}
     */

  }, {
    key: 'isSaving',
    value: function isSaving() {
      return this.syncState === SYNC_STATE.SAVING;
    }

    /**
     * Object exists on server.
     *
     * @method isSaved
     * @returns {boolean}
     */

  }, {
    key: 'isSaved',
    value: function isSaved() {
      return !(this.isNew() || this.isSaving());
    }

    /**
     * Object is fully synced.
     *
     * As best we know, server and client have the same values.
     *
     * @method isSynced
     * @returns {boolean}
     */

  }, {
    key: 'isSynced',
    value: function isSynced() {
      return this.syncState === SYNC_STATE.SYNCED;
    }
  }], [{
    key: 'load',
    value: function load(id, client) {
      if (!client || !(client instanceof Root)) throw new Error(LayerError.dictionary.clientMissing);

      var obj = {
        id: id,
        url: client.url + id.substring(8),
        clientId: client.appId
      };

      var ConstructorClass = Syncable.subclasses.filter(function (aClass) {
        return obj.id.indexOf(aClass.prefixUUID) === 0;
      })[0];
      var syncItem = new ConstructorClass(obj);
      var typeName = ConstructorClass.eventPrefix;

      if (typeName) {
        client.dbManager.getObject(typeName, id, function (item) {
          if (syncItem.isDestroyed) return;
          if (item) {
            syncItem._populateFromServer(item);
            syncItem.trigger(typeName + ':loaded');
          } else {
            syncItem._load();
          }
        });
      } else {
        syncItem._load();
      }

      syncItem.syncState = SYNC_STATE.LOADING;
      return syncItem;
    }
  }]);

  return Syncable;
}(Root);

/**
 * Unique identifier.
 *
 * @type {string}
 */


Syncable.prototype.id = '';

/**
 * URL to access the object on the server.
 *
 * @type {string}
 * @readonly
 * @protected
 */
Syncable.prototype.url = '';

/**
 * The time that this client created this instance.
 *
 * This value is not tied to when it was first created on the server.  Creating a new instance
 * based on server data will result in a new `localCreateAt` value.
 *
 * @type {Date}
 */
Syncable.prototype.localCreatedAt = null;

/**
 * layer.Client that the object belongs to.
 *
 * Actual value of this string matches the appId.
 * @type {string}
 * @protected
 * @readonly
 */
Syncable.prototype.clientId = '';

/**
 * Temporary property indicating that the instance was loaded from local database rather than server.
 *
 * @type {boolean}
 * @private
 */
Syncable.prototype._fromDB = false;

/**
 * The current sync state of this object.
 *
 * Possible values are:
 *
 *  * layer.Constants.SYNC_STATE.NEW: Newly created; local only.
 *  * layer.Constants.SYNC_STATE.SAVING: Newly created; being sent to the server
 *  * layer.Constants.SYNC_STATE.SYNCING: Exists on both client and server, but changes are being sent to server.
 *  * layer.Constants.SYNC_STATE.SYNCED: Exists on both client and server and is synced.
 *  * layer.Constants.SYNC_STATE.LOADING: Exists on server; loading it into client.
 *
 * @type {string}
 */
Syncable.prototype.syncState = SYNC_STATE.NEW;

/**
 * Number of sync requests that have been requested.
 *
 * Counts down to zero; once it reaches zero, all sync
 * requests have been completed.
 *
 * @type {Number}
 * @private
 */
Syncable.prototype._syncCounter = 0;

/**
 * Prefix to use when triggering events
 * @private
 * @static
 */
Syncable.eventPrefix = '';

Syncable.enableOpsIfNew = false;

/**
 * Is the object loading from the server?
 *
 * @type {boolean}
 */
Object.defineProperty(Syncable.prototype, 'isLoading', {
  enumerable: true,
  get: function get() {
    return this.syncState === SYNC_STATE.LOADING;
  }
});

/**
 * Array of classes that are subclasses of Syncable.
 *
 * Used by Factory function.
 * @private
 */
Syncable.subclasses = [];

Syncable._supportedEvents = [].concat(Root._supportedEvents);
Syncable.inObjectIgnore = Root.inObjectIgnore;
module.exports = Syncable;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zeW5jYWJsZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7OztBQWdCQSxJQUFNLE9BQU8sUUFBUSxRQUFSLENBQWI7O2VBQ3VCLFFBQVEsU0FBUixDOztJQUFmLFUsWUFBQSxVOztBQUNSLElBQU0sYUFBYSxRQUFRLGVBQVIsQ0FBbkI7QUFDQSxJQUFNLGlCQUFpQixRQUFRLG1CQUFSLENBQXZCO0FBQ0EsSUFBTSxZQUFZLFFBQVEsU0FBUixDQUFsQjs7SUFFTSxROzs7QUFDSixzQkFBMEI7QUFBQSxRQUFkLE9BQWMseURBQUosRUFBSTs7QUFBQTs7QUFBQSw0RkFDbEIsT0FEa0I7O0FBRXhCLFVBQUssY0FBTCxHQUFzQixJQUFJLElBQUosRUFBdEI7QUFGd0I7QUFHekI7O0FBRUQ7Ozs7Ozs7Ozs7Z0NBTVk7QUFDVixhQUFPLGVBQWUsR0FBZixDQUFtQixLQUFLLFFBQXhCLENBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7O3lCQVNLLE8sRUFBUyxRLEVBQVU7QUFBQTs7QUFDdEI7QUFDQSxVQUFJLENBQUMsUUFBUSxHQUFiLEVBQWtCLFFBQVEsR0FBUixHQUFjLEVBQWQ7QUFDbEIsVUFBSSxDQUFDLFFBQVEsTUFBYixFQUFxQixRQUFRLE1BQVIsR0FBaUIsS0FBakI7QUFDckIsVUFBTSxTQUFTLEtBQUssU0FBTCxFQUFmOztBQUVBO0FBQ0EsVUFBSSxLQUFLLFdBQVQsRUFBc0IsTUFBTSxJQUFJLEtBQUosQ0FBVSxXQUFXLFVBQVgsQ0FBc0IsV0FBaEMsQ0FBTjtBQUN0QixVQUFJLENBQUMsTUFBTCxFQUFhLE1BQU0sSUFBSSxLQUFKLENBQVUsV0FBVyxVQUFYLENBQXNCLGFBQWhDLENBQU47QUFDYixVQUFJLENBQUMsS0FBSyxXQUFMLENBQWlCLGNBQWxCLElBQ0YsUUFBUSxNQUFSLEtBQW1CLE1BRGpCLElBQzJCLFFBQVEsTUFBUixLQUFtQixLQUQ5QyxJQUVGLEtBQUssU0FBTCxLQUFtQixVQUFVLFVBQVYsQ0FBcUIsR0FGMUMsRUFFK0MsT0FBTyxJQUFQOztBQUUvQyxVQUFJLENBQUMsUUFBUSxHQUFSLENBQVksS0FBWixDQUFrQixlQUFsQixDQUFMLEVBQXlDO0FBQ3ZDLFlBQUksUUFBUSxHQUFSLElBQWUsQ0FBQyxRQUFRLEdBQVIsQ0FBWSxLQUFaLENBQWtCLFVBQWxCLENBQXBCLEVBQW1ELFFBQVEsR0FBUixHQUFjLE1BQU0sUUFBUSxHQUE1QjtBQUNuRCxZQUFJLENBQUMsUUFBUSxJQUFiLEVBQW1CLFFBQVEsR0FBUixHQUFjLEtBQUssR0FBTCxHQUFXLFFBQVEsR0FBakM7QUFDcEI7O0FBRUQ7QUFDQSxjQUFRLElBQVIsR0FBZSxLQUFLLGdCQUFMLENBQXNCLFFBQVEsSUFBOUIsQ0FBZjs7QUFFQSxVQUFJLFFBQVEsTUFBUixLQUFtQixLQUF2QixFQUE4QjtBQUM1QixhQUFLLFdBQUw7QUFDRDs7QUFFRCxhQUFPLEdBQVAsQ0FBVyxPQUFYLEVBQW9CLFVBQUMsTUFBRCxFQUFZO0FBQzlCLFlBQUksT0FBTyxPQUFQLElBQWtCLFFBQVEsTUFBUixLQUFtQixLQUFyQyxJQUE4QyxDQUFDLE9BQUssV0FBeEQsRUFBcUU7QUFDbkUsaUJBQUssVUFBTDtBQUNEO0FBQ0QsWUFBSSxRQUFKLEVBQWMsU0FBUyxNQUFUO0FBQ2YsT0FMRDtBQU1BLGFBQU8sSUFBUDtBQUNEOztBQUVEOzs7Ozs7Ozs7OztxQ0FRaUIsSSxFQUFNO0FBQ3JCLFVBQUksU0FBUyxLQUFiLEVBQW9CO0FBQ2xCLFlBQUksQ0FBQyxJQUFMLEVBQVcsT0FBTyxFQUFQO0FBQ1gsWUFBSSxDQUFDLEtBQUssTUFBVixFQUFrQixLQUFLLE1BQUwsR0FBYyxLQUFLLEVBQW5CO0FBQ25CO0FBQ0QsYUFBTyxJQUFQO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7OzJDQVF1QixJLEVBQU07QUFDM0IsV0FBSyxRQUFMO0FBQ0EsV0FBSyxPQUFMO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7OytCQVFXO0FBQ1QsV0FBSyxPQUFMLENBQWEsS0FBSyxXQUFMLENBQWlCLFdBQWpCLEdBQStCLFNBQTVDO0FBQ0Q7O0FBR0Q7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBb0RBOzs7Ozs7Ozs0QkFRUTtBQUFBOztBQUNOLFdBQUssU0FBTCxHQUFpQixXQUFXLE9BQTVCO0FBQ0EsV0FBSyxJQUFMLENBQVU7QUFDUixnQkFBUSxLQURBO0FBRVIsY0FBTTtBQUZFLE9BQVYsRUFHRztBQUFBLGVBQVUsT0FBSyxXQUFMLENBQWlCLE1BQWpCLENBQVY7QUFBQSxPQUhIO0FBSUQ7OztnQ0FHVyxNLEVBQVE7QUFBQTs7QUFDbEIsVUFBTSxTQUFTLEtBQUssV0FBTCxDQUFpQixXQUFoQztBQUNBLFVBQUksQ0FBQyxPQUFPLE9BQVosRUFBcUI7QUFDbkIsYUFBSyxTQUFMLEdBQWlCLFdBQVcsR0FBNUI7QUFDQSxhQUFLLGFBQUwsQ0FBbUIsU0FBUyxlQUE1QixFQUE2QyxFQUFFLE9BQU8sT0FBTyxJQUFoQixFQUE3QztBQUNBLG1CQUFXO0FBQUEsaUJBQU0sT0FBSyxPQUFMLEVBQU47QUFBQSxTQUFYLEVBQWlDLEdBQWpDLEVBSG1CLENBR29CO0FBQ3hDLE9BSkQsTUFJTztBQUNMLGFBQUssbUJBQUwsQ0FBeUIsT0FBTyxJQUFoQztBQUNBLGFBQUssT0FBTCxDQUFhLE9BQU8sSUFBcEI7QUFDQSxhQUFLLE9BQUwsQ0FBYSxTQUFTLFNBQXRCO0FBQ0Q7QUFDRjs7QUFFRDs7Ozs7Ozs7Ozs7OzRCQVNRLEksRUFBTSxDQUViOztBQUVEOzs7Ozs7Ozs7OztrQ0FRYztBQUNaLFdBQUssWUFBTDtBQUNBLGNBQVEsS0FBSyxTQUFiO0FBQ0UsYUFBSyxXQUFXLE1BQWhCO0FBQ0UsZUFBSyxTQUFMLEdBQWlCLFdBQVcsT0FBNUI7QUFDQTtBQUNGLGFBQUssV0FBVyxHQUFoQjtBQUNFLGVBQUssU0FBTCxHQUFpQixXQUFXLE1BQTVCO0FBQ0E7QUFOSjtBQVFBLFdBQUssWUFBTDtBQUNEOztBQUVEOzs7Ozs7Ozs7aUNBTWE7QUFDWCxXQUFLLFlBQUw7QUFDQSxVQUFJLEtBQUssWUFBTCxHQUFvQixDQUF4QixFQUEyQixLQUFLLFlBQUw7O0FBRTNCLFdBQUssU0FBTCxHQUFpQixLQUFLLFlBQUwsS0FBc0IsQ0FBdEIsR0FBMEIsV0FBVyxNQUFyQyxHQUNLLFdBQVcsT0FEakM7QUFFQSxXQUFLLFNBQUwsR0FBaUIsS0FBakI7QUFDRDs7QUFFRDs7Ozs7Ozs7O21DQU1lO0FBQ2IsV0FBSyxTQUFMLEdBQWlCLElBQWpCO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7K0JBVVc7QUFDVCxVQUFJLENBQUMsS0FBSyxTQUFWLEVBQXFCO0FBQ25CLGFBQUssU0FBTDtBQUNBLGFBQUssU0FBTCxDQUFlLEtBQWYsR0FBdUIsS0FBSyxLQUFMLEVBQXZCO0FBQ0EsYUFBSyxTQUFMLENBQWUsUUFBZixHQUEwQixLQUFLLFFBQUwsRUFBMUI7QUFDQSxhQUFLLFNBQUwsQ0FBZSxPQUFmLEdBQXlCLEtBQUssT0FBTCxFQUF6QjtBQUNBLGFBQUssU0FBTCxDQUFlLFFBQWYsR0FBMEIsS0FBSyxRQUFMLEVBQTFCO0FBQ0Q7QUFDRCxhQUFPLEtBQUssU0FBWjtBQUNEOztBQUVEOzs7Ozs7Ozs7NEJBTVE7QUFDTixhQUFPLEtBQUssU0FBTCxLQUFtQixXQUFXLEdBQXJDO0FBQ0Q7O0FBRUQ7Ozs7Ozs7OzsrQkFNVztBQUNULGFBQU8sS0FBSyxTQUFMLEtBQW1CLFdBQVcsTUFBckM7QUFDRDs7QUFFRDs7Ozs7Ozs7OzhCQU1VO0FBQ1IsYUFBTyxFQUFFLEtBQUssS0FBTCxNQUFnQixLQUFLLFFBQUwsRUFBbEIsQ0FBUDtBQUNEOztBQUVEOzs7Ozs7Ozs7OzsrQkFRVztBQUNULGFBQU8sS0FBSyxTQUFMLEtBQW1CLFdBQVcsTUFBckM7QUFDRDs7O3lCQXJMVyxFLEVBQUksTSxFQUFRO0FBQ3RCLFVBQUksQ0FBQyxNQUFELElBQVcsRUFBRSxrQkFBa0IsSUFBcEIsQ0FBZixFQUEwQyxNQUFNLElBQUksS0FBSixDQUFVLFdBQVcsVUFBWCxDQUFzQixhQUFoQyxDQUFOOztBQUUxQyxVQUFNLE1BQU07QUFDVixjQURVO0FBRVYsYUFBSyxPQUFPLEdBQVAsR0FBYSxHQUFHLFNBQUgsQ0FBYSxDQUFiLENBRlI7QUFHVixrQkFBVSxPQUFPO0FBSFAsT0FBWjs7QUFNQSxVQUFNLG1CQUFtQixTQUFTLFVBQVQsQ0FBb0IsTUFBcEIsQ0FBMkI7QUFBQSxlQUFVLElBQUksRUFBSixDQUFPLE9BQVAsQ0FBZSxPQUFPLFVBQXRCLE1BQXNDLENBQWhEO0FBQUEsT0FBM0IsRUFBOEUsQ0FBOUUsQ0FBekI7QUFDQSxVQUFNLFdBQVcsSUFBSSxnQkFBSixDQUFxQixHQUFyQixDQUFqQjtBQUNBLFVBQU0sV0FBVyxpQkFBaUIsV0FBbEM7O0FBRUEsVUFBSSxRQUFKLEVBQWM7QUFDWixlQUFPLFNBQVAsQ0FBaUIsU0FBakIsQ0FBMkIsUUFBM0IsRUFBcUMsRUFBckMsRUFBeUMsVUFBQyxJQUFELEVBQVU7QUFDakQsY0FBSSxTQUFTLFdBQWIsRUFBMEI7QUFDMUIsY0FBSSxJQUFKLEVBQVU7QUFDUixxQkFBUyxtQkFBVCxDQUE2QixJQUE3QjtBQUNBLHFCQUFTLE9BQVQsQ0FBaUIsV0FBVyxTQUE1QjtBQUNELFdBSEQsTUFHTztBQUNMLHFCQUFTLEtBQVQ7QUFDRDtBQUNGLFNBUkQ7QUFTRCxPQVZELE1BVU87QUFDTCxpQkFBUyxLQUFUO0FBQ0Q7O0FBRUQsZUFBUyxTQUFULEdBQXFCLFdBQVcsT0FBaEM7QUFDQSxhQUFPLFFBQVA7QUFDRDs7OztFQXZKb0IsSTs7QUFrVHZCOzs7Ozs7O0FBS0EsU0FBUyxTQUFULENBQW1CLEVBQW5CLEdBQXdCLEVBQXhCOztBQUVBOzs7Ozs7O0FBT0EsU0FBUyxTQUFULENBQW1CLEdBQW5CLEdBQXlCLEVBQXpCOztBQUVBOzs7Ozs7OztBQVFBLFNBQVMsU0FBVCxDQUFtQixjQUFuQixHQUFvQyxJQUFwQzs7QUFHQTs7Ozs7Ozs7QUFRQSxTQUFTLFNBQVQsQ0FBbUIsUUFBbkIsR0FBOEIsRUFBOUI7O0FBRUE7Ozs7OztBQU1BLFNBQVMsU0FBVCxDQUFtQixPQUFuQixHQUE2QixLQUE3Qjs7QUFFQTs7Ozs7Ozs7Ozs7OztBQWFBLFNBQVMsU0FBVCxDQUFtQixTQUFuQixHQUErQixXQUFXLEdBQTFDOztBQUVBOzs7Ozs7Ozs7QUFTQSxTQUFTLFNBQVQsQ0FBbUIsWUFBbkIsR0FBa0MsQ0FBbEM7O0FBRUE7Ozs7O0FBS0EsU0FBUyxXQUFULEdBQXVCLEVBQXZCOztBQUVBLFNBQVMsY0FBVCxHQUEwQixLQUExQjs7QUFFQTs7Ozs7QUFLQSxPQUFPLGNBQVAsQ0FBc0IsU0FBUyxTQUEvQixFQUEwQyxXQUExQyxFQUF1RDtBQUNyRCxjQUFZLElBRHlDO0FBRXJELE9BQUssU0FBUyxHQUFULEdBQWU7QUFDbEIsV0FBTyxLQUFLLFNBQUwsS0FBbUIsV0FBVyxPQUFyQztBQUNEO0FBSm9ELENBQXZEOztBQU9BOzs7Ozs7QUFNQSxTQUFTLFVBQVQsR0FBc0IsRUFBdEI7O0FBRUEsU0FBUyxnQkFBVCxHQUE0QixHQUFHLE1BQUgsQ0FBVSxLQUFLLGdCQUFmLENBQTVCO0FBQ0EsU0FBUyxjQUFULEdBQTBCLEtBQUssY0FBL0I7QUFDQSxPQUFPLE9BQVAsR0FBaUIsUUFBakIiLCJmaWxlIjoic3luY2FibGUuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRoZSBTeW5jYWJsZSBhYnN0cmFjdCBjbGFzIHJlcHJlc2VudHMgcmVzb3VyY2VzIHRoYXQgYXJlIHN5bmNhYmxlIHdpdGggdGhlIHNlcnZlci5cbiAqIFRoaXMgaXMgY3VycmVudGx5IHVzZWQgZm9yIE1lc3NhZ2VzIGFuZCBDb252ZXJzYXRpb25zLlxuICogSXQgcmVwcmVzZW50cyB0aGUgc3RhdGUgb2YgdGhlIG9iamVjdCdzIHN5bmMsIGFzIG9uZSBvZjpcbiAqXG4gKiAgKiBsYXllci5Db25zdGFudHMuU1lOQ19TVEFURS5ORVc6IE5ld2x5IGNyZWF0ZWQ7IGxvY2FsIG9ubHkuXG4gKiAgKiBsYXllci5Db25zdGFudHMuU1lOQ19TVEFURS5TQVZJTkc6IE5ld2x5IGNyZWF0ZWQ7IGJlaW5nIHNlbnQgdG8gdGhlIHNlcnZlclxuICogICogbGF5ZXIuQ29uc3RhbnRzLlNZTkNfU1RBVEUuU1lOQ0lORzogRXhpc3RzIG9uIGJvdGggY2xpZW50IGFuZCBzZXJ2ZXIsIGJ1dCBjaGFuZ2VzIGFyZSBiZWluZyBzZW50IHRvIHNlcnZlci5cbiAqICAqIGxheWVyLkNvbnN0YW50cy5TWU5DX1NUQVRFLlNZTkNFRDogRXhpc3RzIG9uIGJvdGggY2xpZW50IGFuZCBzZXJ2ZXIgYW5kIGlzIHN5bmNlZC5cbiAqICAqIGxheWVyLkNvbnN0YW50cy5TWU5DX1NUQVRFLkxPQURJTkc6IEV4aXN0cyBvbiBzZXJ2ZXI7IGxvYWRpbmcgaXQgaW50byBjbGllbnQuXG4gKlxuICogQGNsYXNzIGxheWVyLlN5bmNhYmxlXG4gKiBAZXh0ZW5kcyBsYXllci5Sb290XG4gKiBAYWJzdHJhY3RcbiAqL1xuXG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi9yb290Jyk7XG5jb25zdCB7IFNZTkNfU1RBVEUgfSA9IHJlcXVpcmUoJy4vY29uc3QnKTtcbmNvbnN0IExheWVyRXJyb3IgPSByZXF1aXJlKCcuL2xheWVyLWVycm9yJyk7XG5jb25zdCBDbGllbnRSZWdpc3RyeSA9IHJlcXVpcmUoJy4vY2xpZW50LXJlZ2lzdHJ5Jyk7XG5jb25zdCBDb25zdGFudHMgPSByZXF1aXJlKCcuL2NvbnN0Jyk7XG5cbmNsYXNzIFN5bmNhYmxlIGV4dGVuZHMgUm9vdCB7XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSkge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMubG9jYWxDcmVhdGVkQXQgPSBuZXcgRGF0ZSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgY2xpZW50IGFzc29jaWF0ZWQgd2l0aCB0aGlzIE9iamVjdC5cbiAgICpcbiAgICogQG1ldGhvZCBnZXRDbGllbnRcbiAgICogQHJldHVybiB7bGF5ZXIuQ2xpZW50fVxuICAgKi9cbiAgZ2V0Q2xpZW50KCkge1xuICAgIHJldHVybiBDbGllbnRSZWdpc3RyeS5nZXQodGhpcy5jbGllbnRJZCk7XG4gIH1cblxuICAvKipcbiAgICogRmlyZSBhbiBYSFIgcmVxdWVzdCB1c2luZyB0aGUgVVJMIGZvciB0aGlzIHJlc291cmNlLlxuICAgKlxuICAgKiBGb3IgbW9yZSBpbmZvIG9uIHhociBtZXRob2QgcGFyYW1ldGVycyBzZWUge0BsaW5rIGxheWVyLkNsaWVudEF1dGhlbnRpY2F0b3IjeGhyfVxuICAgKlxuICAgKiBAbWV0aG9kIF94aHJcbiAgICogQHByb3RlY3RlZFxuICAgKiBAcmV0dXJuIHtsYXllci5TeW5jYWJsZX0gdGhpc1xuICAgKi9cbiAgX3hocihvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIC8vIGluaXRpYWxpemVcbiAgICBpZiAoIW9wdGlvbnMudXJsKSBvcHRpb25zLnVybCA9ICcnO1xuICAgIGlmICghb3B0aW9ucy5tZXRob2QpIG9wdGlvbnMubWV0aG9kID0gJ0dFVCc7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcblxuICAgIC8vIFZhbGlkYXRhdGlvblxuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkKSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmlzRGVzdHJveWVkKTtcbiAgICBpZiAoIWNsaWVudCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jbGllbnRNaXNzaW5nKTtcbiAgICBpZiAoIXRoaXMuY29uc3RydWN0b3IuZW5hYmxlT3BzSWZOZXcgJiZcbiAgICAgIG9wdGlvbnMubWV0aG9kICE9PSAnUE9TVCcgJiYgb3B0aW9ucy5tZXRob2QgIT09ICdHRVQnICYmXG4gICAgICB0aGlzLnN5bmNTdGF0ZSA9PT0gQ29uc3RhbnRzLlNZTkNfU1RBVEUuTkVXKSByZXR1cm4gdGhpcztcblxuICAgIGlmICghb3B0aW9ucy51cmwubWF0Y2goL15odHRwKHMpOlxcL1xcLy8pKSB7XG4gICAgICBpZiAob3B0aW9ucy51cmwgJiYgIW9wdGlvbnMudXJsLm1hdGNoKC9eKFxcL3xcXD8pLykpIG9wdGlvbnMudXJsID0gJy8nICsgb3B0aW9ucy51cmw7XG4gICAgICBpZiAoIW9wdGlvbnMuc3luYykgb3B0aW9ucy51cmwgPSB0aGlzLnVybCArIG9wdGlvbnMudXJsO1xuICAgIH1cblxuICAgIC8vIFNldHVwIHN5bmMgc3RydWN0dXJlXG4gICAgb3B0aW9ucy5zeW5jID0gdGhpcy5fc2V0dXBTeW5jT2JqZWN0KG9wdGlvbnMuc3luYyk7XG5cbiAgICBpZiAob3B0aW9ucy5tZXRob2QgIT09ICdHRVQnKSB7XG4gICAgICB0aGlzLl9zZXRTeW5jaW5nKCk7XG4gICAgfVxuXG4gICAgY2xpZW50LnhocihvcHRpb25zLCAocmVzdWx0KSA9PiB7XG4gICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MgJiYgb3B0aW9ucy5tZXRob2QgIT09ICdHRVQnICYmICF0aGlzLmlzRGVzdHJveWVkKSB7XG4gICAgICAgIHRoaXMuX3NldFN5bmNlZCgpO1xuICAgICAgfVxuICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhyZXN1bHQpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHVwIGFuIG9iamVjdCB0byBwYXNzIGluIHRoZSBgc3luY2AgcGFyYW1ldGVyIGZvciBhbnkgc3luYyByZXF1ZXN0cy5cbiAgICpcbiAgICogQG1ldGhvZCBfc2V0dXBTeW5jT2JqZWN0XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBzeW5jIC0gS25vd24gcGFyYW1ldGVycyBvZiB0aGUgc3luYyBvYmplY3QgdG8gYmUgcmV0dXJuZWQ7IG9yIG51bGwuXG4gICAqIEByZXR1cm4ge09iamVjdH0gZmxlc2hlZCBvdXQgc3luYyBvYmplY3RcbiAgICovXG4gIF9zZXR1cFN5bmNPYmplY3Qoc3luYykge1xuICAgIGlmIChzeW5jICE9PSBmYWxzZSkge1xuICAgICAgaWYgKCFzeW5jKSBzeW5jID0ge307XG4gICAgICBpZiAoIXN5bmMudGFyZ2V0KSBzeW5jLnRhcmdldCA9IHRoaXMuaWQ7XG4gICAgfVxuICAgIHJldHVybiBzeW5jO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgd2Vic29ja2V0IGV2ZW50IGhhcyBiZWVuIHJlY2VpdmVkIHNwZWNpZnlpbmcgdGhhdCB0aGlzIHJlc291cmNlXG4gICAqIGhhcyBiZWVuIGRlbGV0ZWQuXG4gICAqXG4gICAqIEBtZXRob2QgaGFuZGxlV2Vic29ja2V0RGVsZXRlXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtIHtPYmplY3R9IGRhdGFcbiAgICovXG4gIF9oYW5kbGVXZWJzb2NrZXREZWxldGUoZGF0YSkge1xuICAgIHRoaXMuX2RlbGV0ZWQoKTtcbiAgICB0aGlzLmRlc3Ryb3koKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgT2JqZWN0IGhhcyBiZWVuIGRlbGV0ZWQuXG4gICAqXG4gICAqIERlc3Ryb3kgbXVzdCBiZSBjYWxsZWQgc2VwYXJhdGVseSwgYW5kIGhhbmRsZXMgbW9zdCBjbGVhbnVwLlxuICAgKlxuICAgKiBAbWV0aG9kIF9kZWxldGVkXG4gICAqIEBwcm90ZWN0ZWRcbiAgICovXG4gIF9kZWxldGVkKCkge1xuICAgIHRoaXMudHJpZ2dlcih0aGlzLmNvbnN0cnVjdG9yLmV2ZW50UHJlZml4ICsgJzpkZWxldGUnKTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIExvYWQgdGhlIHJlc291cmNlIGlkZW50aWZpZWQgdmlhIGEgTGF5ZXIgSUQuXG4gICAqXG4gICAqIFdpbGwgbG9hZCB0aGUgcmVxdWVzdGVkIHJlc291cmNlIGZyb20gcGVyc2lzdGVuY2Ugb3Igc2VydmVyIGFzIG5lZWRlZCxcbiAgICogYW5kIHRyaWdnZXIgYHR5cGUtbmFtZTpsb2FkZWRgIHdoZW4gaXRzIGxvYWRlZC4gIEluc3RhbmNlIHJldHVybmVkIGJ5IHRoaXNcbiAgICogbWV0aG9kIHdpbGwgaGF2ZSBvbmx5IElEIGFuZCBVUkwgcHJvcGVydGllcywgYWxsIG90aGVycyBhcmUgdW5zZXQgdW50aWxcbiAgICogdGhlIGBjb252ZXJzYXRpb25zOmxvYWRlZGAsIGBtZXNzYWdlczpsb2FkZWRgLCBldGMuLi4gZXZlbnQgaGFzIGZpcmVkLlxuICAgKlxuICAgKiBgYGBcbiAgICogdmFyIG1lc3NhZ2UgPSBsYXllci5NZXNzYWdlLmxvYWQobWVzc2FnZUlkLCBjbGllbnQpO1xuICAgKiBtZXNzYWdlLm9uY2UoJ21lc3NhZ2VzOmxvYWRlZCcsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICBhbGVydChcIk1lc3NhZ2UgbG9hZGVkXCIpO1xuICAgKiB9KTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBtZXRob2QgbG9hZFxuICAgKiBAc3RhdGljXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBpZCAtIGBsYXllcjovLy9tZXNzYWdlcy9VVUlEYFxuICAgKiBAcGFyYW0ge2xheWVyLkNsaWVudH0gY2xpZW50XG4gICAqIEByZXR1cm4ge2xheWVyLlN5bmNhYmxlfSAtIFJldHVybnMgYW4gZW1wdHkgb2JqZWN0IHRoYXQgd2lsbCBiZSBwb3B1bGF0ZWQgb25jZSBkYXRhIGlzIGxvYWRlZC5cbiAgICovXG4gIHN0YXRpYyBsb2FkKGlkLCBjbGllbnQpIHtcbiAgICBpZiAoIWNsaWVudCB8fCAhKGNsaWVudCBpbnN0YW5jZW9mIFJvb3QpKSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmNsaWVudE1pc3NpbmcpO1xuXG4gICAgY29uc3Qgb2JqID0ge1xuICAgICAgaWQsXG4gICAgICB1cmw6IGNsaWVudC51cmwgKyBpZC5zdWJzdHJpbmcoOCksXG4gICAgICBjbGllbnRJZDogY2xpZW50LmFwcElkLFxuICAgIH07XG5cbiAgICBjb25zdCBDb25zdHJ1Y3RvckNsYXNzID0gU3luY2FibGUuc3ViY2xhc3Nlcy5maWx0ZXIoYUNsYXNzID0+IG9iai5pZC5pbmRleE9mKGFDbGFzcy5wcmVmaXhVVUlEKSA9PT0gMClbMF07XG4gICAgY29uc3Qgc3luY0l0ZW0gPSBuZXcgQ29uc3RydWN0b3JDbGFzcyhvYmopO1xuICAgIGNvbnN0IHR5cGVOYW1lID0gQ29uc3RydWN0b3JDbGFzcy5ldmVudFByZWZpeDtcblxuICAgIGlmICh0eXBlTmFtZSkge1xuICAgICAgY2xpZW50LmRiTWFuYWdlci5nZXRPYmplY3QodHlwZU5hbWUsIGlkLCAoaXRlbSkgPT4ge1xuICAgICAgICBpZiAoc3luY0l0ZW0uaXNEZXN0cm95ZWQpIHJldHVybjtcbiAgICAgICAgaWYgKGl0ZW0pIHtcbiAgICAgICAgICBzeW5jSXRlbS5fcG9wdWxhdGVGcm9tU2VydmVyKGl0ZW0pO1xuICAgICAgICAgIHN5bmNJdGVtLnRyaWdnZXIodHlwZU5hbWUgKyAnOmxvYWRlZCcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN5bmNJdGVtLl9sb2FkKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBzeW5jSXRlbS5fbG9hZCgpO1xuICAgIH1cblxuICAgIHN5bmNJdGVtLnN5bmNTdGF0ZSA9IFNZTkNfU1RBVEUuTE9BRElORztcbiAgICByZXR1cm4gc3luY0l0ZW07XG4gIH1cblxuICAvKipcbiAgICogTG9hZCB0aGlzIHJlc291cmNlIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQ2FsbGVkIGZyb20gdGhlIHN0YXRpYyBsYXllci5TeW5jYWJsZS5sb2FkKCkgbWV0aG9kXG4gICAqXG4gICAqIEBtZXRob2QgX2xvYWRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9sb2FkKCkge1xuICAgIHRoaXMuc3luY1N0YXRlID0gU1lOQ19TVEFURS5MT0FESU5HO1xuICAgIHRoaXMuX3hocih7XG4gICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgc3luYzogZmFsc2UsXG4gICAgfSwgcmVzdWx0ID0+IHRoaXMuX2xvYWRSZXN1bHQocmVzdWx0KSk7XG4gIH1cblxuXG4gIF9sb2FkUmVzdWx0KHJlc3VsdCkge1xuICAgIGNvbnN0IHByZWZpeCA9IHRoaXMuY29uc3RydWN0b3IuZXZlbnRQcmVmaXg7XG4gICAgaWYgKCFyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgdGhpcy5zeW5jU3RhdGUgPSBTWU5DX1NUQVRFLk5FVztcbiAgICAgIHRoaXMuX3RyaWdnZXJBc3luYyhwcmVmaXggKyAnOmxvYWRlZC1lcnJvcicsIHsgZXJyb3I6IHJlc3VsdC5kYXRhIH0pO1xuICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLmRlc3Ryb3koKSwgMTAwKTsgLy8gSW5zdXJlIGRlc3Ryb3llZCBBRlRFUiBsb2FkZWQtZXJyb3IgZXZlbnQgaGFzIHRyaWdnZXJlZFxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9wb3B1bGF0ZUZyb21TZXJ2ZXIocmVzdWx0LmRhdGEpO1xuICAgICAgdGhpcy5fbG9hZGVkKHJlc3VsdC5kYXRhKTtcbiAgICAgIHRoaXMudHJpZ2dlcihwcmVmaXggKyAnOmxvYWRlZCcpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzaW5nIHRoZSByZXN1bHQgb2YgYSBfbG9hZCgpIGNhbGwuXG4gICAqXG4gICAqIFR5cGljYWxseSB1c2VkIHRvIHJlZ2lzdGVyIHRoZSBvYmplY3QgYW5kIGNsZWFudXAgYW55IHByb3BlcnRpZXMgbm90IGhhbmRsZWQgYnkgX3BvcHVsYXRlRnJvbVNlcnZlci5cbiAgICpcbiAgICogQG1ldGhvZCBfbG9hZGVkXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gZGF0YSAtIFJlc3BvbnNlIGRhdGEgZnJvbSBzZXJ2ZXJcbiAgICovXG4gIF9sb2FkZWQoZGF0YSkge1xuXG4gIH1cblxuICAvKipcbiAgICogT2JqZWN0IGlzIG5ldywgYW5kIGlzIHF1ZXVlZCBmb3Igc3luY2luZywgYnV0IGRvZXMgbm90IHlldCBleGlzdCBvbiB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBUaGF0IG1lYW5zIGl0IGlzIGN1cnJlbnRseSBvdXQgb2Ygc3luYyB3aXRoIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEBtZXRob2QgX3NldFN5bmNpbmdcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9zZXRTeW5jaW5nKCkge1xuICAgIHRoaXMuX2NsZWFyT2JqZWN0KCk7XG4gICAgc3dpdGNoICh0aGlzLnN5bmNTdGF0ZSkge1xuICAgICAgY2FzZSBTWU5DX1NUQVRFLlNZTkNFRDpcbiAgICAgICAgdGhpcy5zeW5jU3RhdGUgPSBTWU5DX1NUQVRFLlNZTkNJTkc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTWU5DX1NUQVRFLk5FVzpcbiAgICAgICAgdGhpcy5zeW5jU3RhdGUgPSBTWU5DX1NUQVRFLlNBVklORztcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHRoaXMuX3N5bmNDb3VudGVyKys7XG4gIH1cblxuICAvKipcbiAgICogT2JqZWN0IGlzIHN5bmNlZCB3aXRoIHRoZSBzZXJ2ZXIgYW5kIHVwIHRvIGRhdGUuXG4gICAqXG4gICAqIEBtZXRob2QgX3NldFN5bmNlZFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3NldFN5bmNlZCgpIHtcbiAgICB0aGlzLl9jbGVhck9iamVjdCgpO1xuICAgIGlmICh0aGlzLl9zeW5jQ291bnRlciA+IDApIHRoaXMuX3N5bmNDb3VudGVyLS07XG5cbiAgICB0aGlzLnN5bmNTdGF0ZSA9IHRoaXMuX3N5bmNDb3VudGVyID09PSAwID8gU1lOQ19TVEFURS5TWU5DRUQgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICBTWU5DX1NUQVRFLlNZTkNJTkc7XG4gICAgdGhpcy5pc1NlbmRpbmcgPSBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBbnkgdGltZSB0aGUgaW5zdGFuY2UgY2hhbmdlcywgd2Ugc2hvdWxkIGNsZWFyIHRoZSBjYWNoZWQgdG9PYmplY3QgdmFsdWVcbiAgICpcbiAgICogQG1ldGhvZCBfY2xlYXJPYmplY3RcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9jbGVhck9iamVjdCgpIHtcbiAgICB0aGlzLl90b09iamVjdCA9IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhIHBsYWluIG9iamVjdC5cbiAgICpcbiAgICogT2JqZWN0IHdpbGwgaGF2ZSBhbGwgdGhlIHNhbWUgcHVibGljIHByb3BlcnRpZXMgYXMgdGhpc1xuICAgKiBTeW5jYWJsZSBpbnN0YW5jZS4gIE5ldyBvYmplY3QgaXMgcmV0dXJuZWQgYW55IHRpbWVcbiAgICogYW55IG9mIHRoaXMgb2JqZWN0J3MgcHJvcGVydGllcyBjaGFuZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgdG9PYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSBQT0pPIHZlcnNpb24gb2YgdGhpcyBvYmplY3QuXG4gICAqL1xuICB0b09iamVjdCgpIHtcbiAgICBpZiAoIXRoaXMuX3RvT2JqZWN0KSB7XG4gICAgICB0aGlzLl90b09iamVjdCA9IHN1cGVyLnRvT2JqZWN0KCk7XG4gICAgICB0aGlzLl90b09iamVjdC5pc05ldyA9IHRoaXMuaXNOZXcoKTtcbiAgICAgIHRoaXMuX3RvT2JqZWN0LmlzU2F2aW5nID0gdGhpcy5pc1NhdmluZygpO1xuICAgICAgdGhpcy5fdG9PYmplY3QuaXNTYXZlZCA9IHRoaXMuaXNTYXZlZCgpO1xuICAgICAgdGhpcy5fdG9PYmplY3QuaXNTeW5jZWQgPSB0aGlzLmlzU3luY2VkKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl90b09iamVjdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBPYmplY3QgaXMgbmV3LCBhbmQgaXMgbm90IHlldCBxdWV1ZWQgZm9yIHN5bmNpbmdcbiAgICpcbiAgICogQG1ldGhvZCBpc05ld1xuICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICovXG4gIGlzTmV3KCkge1xuICAgIHJldHVybiB0aGlzLnN5bmNTdGF0ZSA9PT0gU1lOQ19TVEFURS5ORVc7XG4gIH1cblxuICAvKipcbiAgICogT2JqZWN0IGlzIG5ldywgYW5kIGlzIHF1ZXVlZCBmb3Igc3luY2luZ1xuICAgKlxuICAgKiBAbWV0aG9kIGlzU2F2aW5nXG4gICAqIEByZXR1cm5zIHtib29sZWFufVxuICAgKi9cbiAgaXNTYXZpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3luY1N0YXRlID09PSBTWU5DX1NUQVRFLlNBVklORztcbiAgfVxuXG4gIC8qKlxuICAgKiBPYmplY3QgZXhpc3RzIG9uIHNlcnZlci5cbiAgICpcbiAgICogQG1ldGhvZCBpc1NhdmVkXG4gICAqIEByZXR1cm5zIHtib29sZWFufVxuICAgKi9cbiAgaXNTYXZlZCgpIHtcbiAgICByZXR1cm4gISh0aGlzLmlzTmV3KCkgfHwgdGhpcy5pc1NhdmluZygpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBPYmplY3QgaXMgZnVsbHkgc3luY2VkLlxuICAgKlxuICAgKiBBcyBiZXN0IHdlIGtub3csIHNlcnZlciBhbmQgY2xpZW50IGhhdmUgdGhlIHNhbWUgdmFsdWVzLlxuICAgKlxuICAgKiBAbWV0aG9kIGlzU3luY2VkXG4gICAqIEByZXR1cm5zIHtib29sZWFufVxuICAgKi9cbiAgaXNTeW5jZWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3luY1N0YXRlID09PSBTWU5DX1NUQVRFLlNZTkNFRDtcbiAgfVxufVxuXG4vKipcbiAqIFVuaXF1ZSBpZGVudGlmaWVyLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cblN5bmNhYmxlLnByb3RvdHlwZS5pZCA9ICcnO1xuXG4vKipcbiAqIFVSTCB0byBhY2Nlc3MgdGhlIG9iamVjdCBvbiB0aGUgc2VydmVyLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAcmVhZG9ubHlcbiAqIEBwcm90ZWN0ZWRcbiAqL1xuU3luY2FibGUucHJvdG90eXBlLnVybCA9ICcnO1xuXG4vKipcbiAqIFRoZSB0aW1lIHRoYXQgdGhpcyBjbGllbnQgY3JlYXRlZCB0aGlzIGluc3RhbmNlLlxuICpcbiAqIFRoaXMgdmFsdWUgaXMgbm90IHRpZWQgdG8gd2hlbiBpdCB3YXMgZmlyc3QgY3JlYXRlZCBvbiB0aGUgc2VydmVyLiAgQ3JlYXRpbmcgYSBuZXcgaW5zdGFuY2VcbiAqIGJhc2VkIG9uIHNlcnZlciBkYXRhIHdpbGwgcmVzdWx0IGluIGEgbmV3IGBsb2NhbENyZWF0ZUF0YCB2YWx1ZS5cbiAqXG4gKiBAdHlwZSB7RGF0ZX1cbiAqL1xuU3luY2FibGUucHJvdG90eXBlLmxvY2FsQ3JlYXRlZEF0ID0gbnVsbDtcblxuXG4vKipcbiAqIGxheWVyLkNsaWVudCB0aGF0IHRoZSBvYmplY3QgYmVsb25ncyB0by5cbiAqXG4gKiBBY3R1YWwgdmFsdWUgb2YgdGhpcyBzdHJpbmcgbWF0Y2hlcyB0aGUgYXBwSWQuXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQHByb3RlY3RlZFxuICogQHJlYWRvbmx5XG4gKi9cblN5bmNhYmxlLnByb3RvdHlwZS5jbGllbnRJZCA9ICcnO1xuXG4vKipcbiAqIFRlbXBvcmFyeSBwcm9wZXJ0eSBpbmRpY2F0aW5nIHRoYXQgdGhlIGluc3RhbmNlIHdhcyBsb2FkZWQgZnJvbSBsb2NhbCBkYXRhYmFzZSByYXRoZXIgdGhhbiBzZXJ2ZXIuXG4gKlxuICogQHR5cGUge2Jvb2xlYW59XG4gKiBAcHJpdmF0ZVxuICovXG5TeW5jYWJsZS5wcm90b3R5cGUuX2Zyb21EQiA9IGZhbHNlO1xuXG4vKipcbiAqIFRoZSBjdXJyZW50IHN5bmMgc3RhdGUgb2YgdGhpcyBvYmplY3QuXG4gKlxuICogUG9zc2libGUgdmFsdWVzIGFyZTpcbiAqXG4gKiAgKiBsYXllci5Db25zdGFudHMuU1lOQ19TVEFURS5ORVc6IE5ld2x5IGNyZWF0ZWQ7IGxvY2FsIG9ubHkuXG4gKiAgKiBsYXllci5Db25zdGFudHMuU1lOQ19TVEFURS5TQVZJTkc6IE5ld2x5IGNyZWF0ZWQ7IGJlaW5nIHNlbnQgdG8gdGhlIHNlcnZlclxuICogICogbGF5ZXIuQ29uc3RhbnRzLlNZTkNfU1RBVEUuU1lOQ0lORzogRXhpc3RzIG9uIGJvdGggY2xpZW50IGFuZCBzZXJ2ZXIsIGJ1dCBjaGFuZ2VzIGFyZSBiZWluZyBzZW50IHRvIHNlcnZlci5cbiAqICAqIGxheWVyLkNvbnN0YW50cy5TWU5DX1NUQVRFLlNZTkNFRDogRXhpc3RzIG9uIGJvdGggY2xpZW50IGFuZCBzZXJ2ZXIgYW5kIGlzIHN5bmNlZC5cbiAqICAqIGxheWVyLkNvbnN0YW50cy5TWU5DX1NUQVRFLkxPQURJTkc6IEV4aXN0cyBvbiBzZXJ2ZXI7IGxvYWRpbmcgaXQgaW50byBjbGllbnQuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuU3luY2FibGUucHJvdG90eXBlLnN5bmNTdGF0ZSA9IFNZTkNfU1RBVEUuTkVXO1xuXG4vKipcbiAqIE51bWJlciBvZiBzeW5jIHJlcXVlc3RzIHRoYXQgaGF2ZSBiZWVuIHJlcXVlc3RlZC5cbiAqXG4gKiBDb3VudHMgZG93biB0byB6ZXJvOyBvbmNlIGl0IHJlYWNoZXMgemVybywgYWxsIHN5bmNcbiAqIHJlcXVlc3RzIGhhdmUgYmVlbiBjb21wbGV0ZWQuXG4gKlxuICogQHR5cGUge051bWJlcn1cbiAqIEBwcml2YXRlXG4gKi9cblN5bmNhYmxlLnByb3RvdHlwZS5fc3luY0NvdW50ZXIgPSAwO1xuXG4vKipcbiAqIFByZWZpeCB0byB1c2Ugd2hlbiB0cmlnZ2VyaW5nIGV2ZW50c1xuICogQHByaXZhdGVcbiAqIEBzdGF0aWNcbiAqL1xuU3luY2FibGUuZXZlbnRQcmVmaXggPSAnJztcblxuU3luY2FibGUuZW5hYmxlT3BzSWZOZXcgPSBmYWxzZTtcblxuLyoqXG4gKiBJcyB0aGUgb2JqZWN0IGxvYWRpbmcgZnJvbSB0aGUgc2VydmVyP1xuICpcbiAqIEB0eXBlIHtib29sZWFufVxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU3luY2FibGUucHJvdG90eXBlLCAnaXNMb2FkaW5nJywge1xuICBlbnVtZXJhYmxlOiB0cnVlLFxuICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICByZXR1cm4gdGhpcy5zeW5jU3RhdGUgPT09IFNZTkNfU1RBVEUuTE9BRElORztcbiAgfSxcbn0pO1xuXG4vKipcbiAqIEFycmF5IG9mIGNsYXNzZXMgdGhhdCBhcmUgc3ViY2xhc3NlcyBvZiBTeW5jYWJsZS5cbiAqXG4gKiBVc2VkIGJ5IEZhY3RvcnkgZnVuY3Rpb24uXG4gKiBAcHJpdmF0ZVxuICovXG5TeW5jYWJsZS5zdWJjbGFzc2VzID0gW107XG5cblN5bmNhYmxlLl9zdXBwb3J0ZWRFdmVudHMgPSBbXS5jb25jYXQoUm9vdC5fc3VwcG9ydGVkRXZlbnRzKTtcblN5bmNhYmxlLmluT2JqZWN0SWdub3JlID0gUm9vdC5pbk9iamVjdElnbm9yZTtcbm1vZHVsZS5leHBvcnRzID0gU3luY2FibGU7XG4iXX0=
