'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The Identity class represents an Identity of a user of your application.
 *
 * Identities are created by the System, never directly by apps.
 *
 * @class layer.Identity
 * @extends layer.Syncable
 */

/*
 * How Identities fit into the system:
 *
 * 1. As part of initialization, load the authenticated user's full Identity record so that the Client knows more than just the `userId` of its user.
 *    client.user = <Identity>
 * 2. Any time we get a Basic Identity via `message.sender` or Conversations, see if we have an Identity for that sender,
 *    and if not create one using the Basic Identity.  There should never be a duplicate Identity.
 * 3. Websocket CHANGE events will update Identity objects, as well as add new Full Identities, and downgrade Full Identities to Basic Identities.
 * 4. The Query API supports querying and paging through Identities
 * 5. The Query API loads Full Identities; these results will update the client._identitiesHash;
 *    upgrading Basic Identities if they match, and adding new Identities if they don't.
 * 6. DbManager will persist only UserIdentities, and only those that are Full Identities.  Basic Identities will be written
 *    to the Messages and Conversations tables anyways as part of those larger objects.
 * 7. API For explicit follows/unfollows
 */

var Syncable = require('./syncable');
var Root = require('./root');
var Constants = require('./const');
var LayerError = require('./layer-error');

var Identity = function (_Syncable) {
  _inherits(Identity, _Syncable);

  function Identity() {
    var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Identity);

    // Make sure the ID from handle fromServer parameter is used by the Root.constructor
    if (options.fromServer) {
      options.id = options.fromServer.id || '-';
    } else if (!options.id && options.userId) {
      options.id = Identity.prefixUUID + encodeURIComponent(options.userId);
    } else if (options.id && !options.userId) {
      options.userId = options.id.substring(Identity.prefixUUID.length);
    }

    // Make sure we have an clientId property
    if (options.client) options.clientId = options.client.appId;
    if (!options.clientId) throw new Error(LayerError.dictionary.clientMissing);

    // The - is here to prevent Root from generating a UUID for an ID.  ID must map to UserID
    // and can't be randomly generated.  This only occurs from Platform API sending with `sender.name` and no identity.
    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Identity).call(this, options));

    if (_this.id === '-') _this.id = '';

    _this.isInitializing = true;

    // If the options contains a full server definition of the object,
    // copy it in with _populateFromServer; this will add the Identity
    // to the Client as well.
    if (options && options.fromServer) {
      _this._populateFromServer(options.fromServer);
    }

    if (!_this.url && _this.id) {
      _this.url = _this.getClient().url + '/' + _this.id.substring(9);
    } else if (!_this.url) {
      _this.url = '';
    }
    _this.getClient()._addIdentity(_this);

    _this.isInitializing = false;
    return _this;
  }

  _createClass(Identity, [{
    key: 'destroy',
    value: function destroy() {
      var client = this.getClient();
      if (client) client._removeIdentity(this);
      _get(Object.getPrototypeOf(Identity.prototype), 'destroy', this).call(this);
    }
  }, {
    key: '_triggerAsync',
    value: function _triggerAsync(evtName, args) {
      this._clearObject();
      _get(Object.getPrototypeOf(Identity.prototype), '_triggerAsync', this).call(this, evtName, args);
    }
  }, {
    key: 'trigger',
    value: function trigger(evtName, args) {
      this._clearObject();
      _get(Object.getPrototypeOf(Identity.prototype), 'trigger', this).call(this, evtName, args);
    }

    /**
     * Populates this instance using server-data.
     *
     * Side effects add this to the Client.
     *
     * @method _populateFromServer
     * @private
     * @param  {Object} identity - Server representation of the identity
     */

  }, {
    key: '_populateFromServer',
    value: function _populateFromServer(identity) {
      var _this2 = this;

      var client = this.getClient();

      // Disable events if creating a new Identity
      // We still want property change events for anything that DOES change
      this._disableEvents = this.syncState === Constants.SYNC_STATE.NEW;

      this._setSynced();

      this.userId = identity.user_id || '';

      this._updateValue('avatarUrl', identity.avatar_url);
      this._updateValue('displayName', identity.display_name);

      var isFullIdentity = 'metadata' in identity;

      // Handle Full Identity vs Basic Identity
      if (isFullIdentity) {
        this.url = identity.url;
        this.type = identity.type;

        this._updateValue('emailAddress', identity.email_address);
        this._updateValue('lastName', identity.last_name);
        this._updateValue('firstName', identity.first_name);
        this._updateValue('metadata', identity.metadata);
        this._updateValue('publicKey', identity.public_key);
        this._updateValue('phoneNumber', identity.phone_number);
        this.isFullIdentity = true;
      }

      if (!this.url && this.id) {
        this.url = this.getClient().url + this.id.substring(8);
      }

      this._disableEvents = false;

      // See if we have the Full Identity Object in database
      if (!this.isFullIdentity && client.isAuthenticated) {
        client.dbManager.getObjects('identities', [this.id], function (result) {
          if (result.length) _this2._populateFromServer(result[0]);
        });
      }
    }

    /**
     * Update the property; trigger a change event, IF the value has changed.
     *
     * @method _updateValue
     * @private
     * @param {string} key - Property name
     * @param {Mixed} value - Property value
     */

  }, {
    key: '_updateValue',
    value: function _updateValue(key, value) {
      if (value === null || value === undefined) value = '';
      if (this[key] !== value) {
        if (!this.isInitializing) {
          this._triggerAsync('identities:change', {
            property: key,
            oldValue: this[key],
            newValue: value
          });
        }
        this[key] = value;
      }
    }

    /**
     * Follow this User.
     *
     * Following a user grants access to their Full Identity,
     * as well as websocket events that update the Identity.
     * @method follow
     */

  }, {
    key: 'follow',
    value: function follow() {
      var _this3 = this;

      if (this.isFullIdentity) return;
      this._xhr({
        method: 'PUT',
        url: this.url.replace(/identities/, 'following/users'),
        syncable: {}
      }, function (result) {
        if (result.success) _this3._load();
      });
    }

    /**
     * Unfollow this User.
     *
     * Unfollowing the user will reduce your access to only having their Basic Identity,
     * and this Basic Identity will only show up when a relevant Message or Conversation has been loaded.
     *
     * Websocket change notifications for this user will not arrive.
     *
     * @method unfollow
     */

  }, {
    key: 'unfollow',
    value: function unfollow() {
      this._xhr({
        url: this.url.replace(/identities/, 'following/users'),
        method: 'DELETE',
        syncable: {}
      });
    }

    /**
    * Update the UserID.
    *
    * This will not only update the User ID, but also the ID,
    * URL, and reregister it with the Client.
    *
    * @method _setUserId
    * @private
    * @param {string} userId
    */

  }, {
    key: '_setUserId',
    value: function _setUserId(userId) {
      var client = this.getClient();
      client._removeIdentity(this);
      this.__userId = userId;
      var encoded = encodeURIComponent(userId);
      this.id = Identity.prefixUUID + encoded;
      this.url = this.getClient().url + '/identities/' + encoded;
      client._addIdentity(this);
    }

    /**
    * __ Methods are automatically called by property setters.
    *
    * Any attempt to execute `this.userId = 'xxx'` will cause an error to be thrown.
    * These are not intended to be writable properties
    *
    * @private
    * @method __adjustUserId
    * @param {string} value - New appId value
    */

  }, {
    key: '__adjustUserId',
    value: function __adjustUserId(userId) {
      if (this.__userId) {
        throw new Error(LayerError.dictionary.cantChangeUserId);
      }
    }

    /**
     * Handle a Websocket DELETE event received from the server.
     *
     * A DELETE event means we have unfollowed this user; and should downgrade to a Basic Identity.
     *
     * @method _handleWebsocketDelete
     * @protected
     * @param {Object} data - Deletion parameters; typically null in this case.
    */
    // Turn a Full Identity into a Basic Identity and delete the Full Identity from the database

  }, {
    key: '_handleWebsocketDelete',
    value: function _handleWebsocketDelete(data) {
      var _this4 = this;

      this.getClient().dbManager.deleteObjects('identities', [this]);
      ['firstName', 'lastName', 'emailAddress', 'phoneNumber', 'metadata', 'publicKey', 'isFullIdentity', 'type'].forEach(function (key) {
        return delete _this4[key];
      });
      this._triggerAsync('identities:unfollow');
    }

    /**
     * Create a new Identity based on a Server description of the user.
     *
     * @method _createFromServer
     * @static
     * @param {Object} identity - Server Identity Object
     * @param {layer.Client} client
     * @returns {layer.Identity}
     */

  }], [{
    key: '_createFromServer',
    value: function _createFromServer(identity, client) {
      return new Identity({
        client: client,
        fromServer: identity,
        _fromDB: identity._fromDB
      });
    }
  }]);

  return Identity;
}(Syncable);

/**
 * Display name for the User or System Identity.
 * @type {string}
 */


Identity.prototype.displayName = '';

/**
 * The Identity matching `layer.Client.user` will have this be true.
 *
 * All other Identities will have this as false.
 * @type {boolean}
 */
Identity.prototype.sessionOwner = false;

/**
 * ID of the Client this Identity is associated with.
 * @type {string}
 */
Identity.prototype.clientId = '';

/**
 * Is this a Full Identity or Basic Identity?
 *
 * Note that Service Identities are always considered to be Basic.
 * @type {boolean}
 */
Identity.prototype.isFullIdentity = false;

/**
 * Unique ID for this User.
 * @type {string}
 */
Identity.prototype.userId = '';

/**
 * Optional URL for the user's icon.
 * @type {string}
 */
Identity.prototype.avatarUrl = '';

/**
 * Optional first name for this user.
 *
 * Full Identities Only.
 *
 * @type {string}
 */
Identity.prototype.firstName = '';

/**
 * Optional last name for this user.
 *
 * Full Identities Only.
 *
 * @type {string}
 */
Identity.prototype.lastName = '';

/**
 * Optional email address for this user.
 *
 * Full Identities Only.
 *
 * @type {string}
 */
Identity.prototype.emailAddress = '';

/**
 * Optional phone number for this user.
 *
 * Full Identities Only.
 *
 * @type {string}
 */
Identity.prototype.phoneNumber = '';

/**
 * Optional metadata for this user.
 *
 * Full Identities Only.
 *
 * @type {Object}
 */
Identity.prototype.metadata = null;

/**
 * Optional public key for encrypting message text for this user.
 *
 * Full Identities Only.
 *
 * @type {string}
 */
Identity.prototype.publicKey = '';

/**
 * @static
 * @type {string} The Identity represents a user.  Value used in the layer.Identity.type field.
 */
Identity.UserType = 'user';

/**
 * @static
 * @type {string} The Identity represents a bot.  Value used in the layer.Identity.type field.
 */
Identity.BotType = 'bot';

/**
 * What type of Identity does this represent?
 *
 * * A bot? Use layer.Identity.BotType
 * * A User? Use layer.Identity.UserType
 * @type {string}
 */
Identity.prototype.type = Identity.UserType;

/**
 * Is this Identity a bot?
 *
 * If the layer.Identity.type field is equal to layer.Identity.BotType then this will return true.
 * @type {boolean}
 */
Object.defineProperty(Identity.prototype, 'isBot', {
  enumerable: true,
  get: function get() {
    return this.type !== Identity.BotType;
  }
});

Identity.inObjectIgnore = Root.inObjectIgnore;

Identity.bubbleEventParent = 'getClient';

Identity._supportedEvents = ['identities:change', 'identities:loaded', 'identities:loaded-error', 'identities:unfollow'].concat(Syncable._supportedEvents);

Identity.eventPrefix = 'identities';
Identity.prefixUUID = 'layer:///identities/';
Identity.enableOpsIfNew = true;

Root.initClass.apply(Identity, [Identity, 'Identity']);
Syncable.subclasses.push(Identity);

module.exports = Identity;
//# sourceMappingURL=data:application/json;base64,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QVAsR0FBaUIsUUFBakIiLCJmaWxlIjoiaWRlbnRpdHkuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRoZSBJZGVudGl0eSBjbGFzcyByZXByZXNlbnRzIGFuIElkZW50aXR5IG9mIGEgdXNlciBvZiB5b3VyIGFwcGxpY2F0aW9uLlxuICpcbiAqIElkZW50aXRpZXMgYXJlIGNyZWF0ZWQgYnkgdGhlIFN5c3RlbSwgbmV2ZXIgZGlyZWN0bHkgYnkgYXBwcy5cbiAqXG4gKiBAY2xhc3MgbGF5ZXIuSWRlbnRpdHlcbiAqIEBleHRlbmRzIGxheWVyLlN5bmNhYmxlXG4gKi9cblxuLypcbiAqIEhvdyBJZGVudGl0aWVzIGZpdCBpbnRvIHRoZSBzeXN0ZW06XG4gKlxuICogMS4gQXMgcGFydCBvZiBpbml0aWFsaXphdGlvbiwgbG9hZCB0aGUgYXV0aGVudGljYXRlZCB1c2VyJ3MgZnVsbCBJZGVudGl0eSByZWNvcmQgc28gdGhhdCB0aGUgQ2xpZW50IGtub3dzIG1vcmUgdGhhbiBqdXN0IHRoZSBgdXNlcklkYCBvZiBpdHMgdXNlci5cbiAqICAgIGNsaWVudC51c2VyID0gPElkZW50aXR5PlxuICogMi4gQW55IHRpbWUgd2UgZ2V0IGEgQmFzaWMgSWRlbnRpdHkgdmlhIGBtZXNzYWdlLnNlbmRlcmAgb3IgQ29udmVyc2F0aW9ucywgc2VlIGlmIHdlIGhhdmUgYW4gSWRlbnRpdHkgZm9yIHRoYXQgc2VuZGVyLFxuICogICAgYW5kIGlmIG5vdCBjcmVhdGUgb25lIHVzaW5nIHRoZSBCYXNpYyBJZGVudGl0eS4gIFRoZXJlIHNob3VsZCBuZXZlciBiZSBhIGR1cGxpY2F0ZSBJZGVudGl0eS5cbiAqIDMuIFdlYnNvY2tldCBDSEFOR0UgZXZlbnRzIHdpbGwgdXBkYXRlIElkZW50aXR5IG9iamVjdHMsIGFzIHdlbGwgYXMgYWRkIG5ldyBGdWxsIElkZW50aXRpZXMsIGFuZCBkb3duZ3JhZGUgRnVsbCBJZGVudGl0aWVzIHRvIEJhc2ljIElkZW50aXRpZXMuXG4gKiA0LiBUaGUgUXVlcnkgQVBJIHN1cHBvcnRzIHF1ZXJ5aW5nIGFuZCBwYWdpbmcgdGhyb3VnaCBJZGVudGl0aWVzXG4gKiA1LiBUaGUgUXVlcnkgQVBJIGxvYWRzIEZ1bGwgSWRlbnRpdGllczsgdGhlc2UgcmVzdWx0cyB3aWxsIHVwZGF0ZSB0aGUgY2xpZW50Ll9pZGVudGl0aWVzSGFzaDtcbiAqICAgIHVwZ3JhZGluZyBCYXNpYyBJZGVudGl0aWVzIGlmIHRoZXkgbWF0Y2gsIGFuZCBhZGRpbmcgbmV3IElkZW50aXRpZXMgaWYgdGhleSBkb24ndC5cbiAqIDYuIERiTWFuYWdlciB3aWxsIHBlcnNpc3Qgb25seSBVc2VySWRlbnRpdGllcywgYW5kIG9ubHkgdGhvc2UgdGhhdCBhcmUgRnVsbCBJZGVudGl0aWVzLiAgQmFzaWMgSWRlbnRpdGllcyB3aWxsIGJlIHdyaXR0ZW5cbiAqICAgIHRvIHRoZSBNZXNzYWdlcyBhbmQgQ29udmVyc2F0aW9ucyB0YWJsZXMgYW55d2F5cyBhcyBwYXJ0IG9mIHRob3NlIGxhcmdlciBvYmplY3RzLlxuICogNy4gQVBJIEZvciBleHBsaWNpdCBmb2xsb3dzL3VuZm9sbG93c1xuICovXG5cbmNvbnN0IFN5bmNhYmxlID0gcmVxdWlyZSgnLi9zeW5jYWJsZScpO1xuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4vcm9vdCcpO1xuY29uc3QgQ29uc3RhbnRzID0gcmVxdWlyZSgnLi9jb25zdCcpO1xuY29uc3QgTGF5ZXJFcnJvciA9IHJlcXVpcmUoJy4vbGF5ZXItZXJyb3InKTtcblxuY2xhc3MgSWRlbnRpdHkgZXh0ZW5kcyBTeW5jYWJsZSB7XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSkge1xuICAgIC8vIE1ha2Ugc3VyZSB0aGUgSUQgZnJvbSBoYW5kbGUgZnJvbVNlcnZlciBwYXJhbWV0ZXIgaXMgdXNlZCBieSB0aGUgUm9vdC5jb25zdHJ1Y3RvclxuICAgIGlmIChvcHRpb25zLmZyb21TZXJ2ZXIpIHtcbiAgICAgIG9wdGlvbnMuaWQgPSBvcHRpb25zLmZyb21TZXJ2ZXIuaWQgfHwgJy0nO1xuICAgIH0gZWxzZSBpZiAoIW9wdGlvbnMuaWQgJiYgb3B0aW9ucy51c2VySWQpIHtcbiAgICAgIG9wdGlvbnMuaWQgPSBJZGVudGl0eS5wcmVmaXhVVUlEICsgZW5jb2RlVVJJQ29tcG9uZW50KG9wdGlvbnMudXNlcklkKTtcbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuaWQgJiYgIW9wdGlvbnMudXNlcklkKSB7XG4gICAgICBvcHRpb25zLnVzZXJJZCA9IG9wdGlvbnMuaWQuc3Vic3RyaW5nKElkZW50aXR5LnByZWZpeFVVSUQubGVuZ3RoKTtcbiAgICB9XG5cbiAgICAvLyBNYWtlIHN1cmUgd2UgaGF2ZSBhbiBjbGllbnRJZCBwcm9wZXJ0eVxuICAgIGlmIChvcHRpb25zLmNsaWVudCkgb3B0aW9ucy5jbGllbnRJZCA9IG9wdGlvbnMuY2xpZW50LmFwcElkO1xuICAgIGlmICghb3B0aW9ucy5jbGllbnRJZCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jbGllbnRNaXNzaW5nKTtcblxuICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgLy8gVGhlIC0gaXMgaGVyZSB0byBwcmV2ZW50IFJvb3QgZnJvbSBnZW5lcmF0aW5nIGEgVVVJRCBmb3IgYW4gSUQuICBJRCBtdXN0IG1hcCB0byBVc2VySURcbiAgICAvLyBhbmQgY2FuJ3QgYmUgcmFuZG9tbHkgZ2VuZXJhdGVkLiAgVGhpcyBvbmx5IG9jY3VycyBmcm9tIFBsYXRmb3JtIEFQSSBzZW5kaW5nIHdpdGggYHNlbmRlci5uYW1lYCBhbmQgbm8gaWRlbnRpdHkuXG4gICAgaWYgKHRoaXMuaWQgPT09ICctJykgdGhpcy5pZCA9ICcnO1xuXG4gICAgdGhpcy5pc0luaXRpYWxpemluZyA9IHRydWU7XG5cbiAgICAvLyBJZiB0aGUgb3B0aW9ucyBjb250YWlucyBhIGZ1bGwgc2VydmVyIGRlZmluaXRpb24gb2YgdGhlIG9iamVjdCxcbiAgICAvLyBjb3B5IGl0IGluIHdpdGggX3BvcHVsYXRlRnJvbVNlcnZlcjsgdGhpcyB3aWxsIGFkZCB0aGUgSWRlbnRpdHlcbiAgICAvLyB0byB0aGUgQ2xpZW50IGFzIHdlbGwuXG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5mcm9tU2VydmVyKSB7XG4gICAgICB0aGlzLl9wb3B1bGF0ZUZyb21TZXJ2ZXIob3B0aW9ucy5mcm9tU2VydmVyKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMudXJsICYmIHRoaXMuaWQpIHtcbiAgICAgIHRoaXMudXJsID0gYCR7dGhpcy5nZXRDbGllbnQoKS51cmx9LyR7dGhpcy5pZC5zdWJzdHJpbmcoOSl9YDtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLnVybCkge1xuICAgICAgdGhpcy51cmwgPSAnJztcbiAgICB9XG4gICAgdGhpcy5nZXRDbGllbnQoKS5fYWRkSWRlbnRpdHkodGhpcyk7XG5cbiAgICB0aGlzLmlzSW5pdGlhbGl6aW5nID0gZmFsc2U7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgaWYgKGNsaWVudCkgY2xpZW50Ll9yZW1vdmVJZGVudGl0eSh0aGlzKTtcbiAgICBzdXBlci5kZXN0cm95KCk7XG4gIH1cblxuICBfdHJpZ2dlckFzeW5jKGV2dE5hbWUsIGFyZ3MpIHtcbiAgICB0aGlzLl9jbGVhck9iamVjdCgpO1xuICAgIHN1cGVyLl90cmlnZ2VyQXN5bmMoZXZ0TmFtZSwgYXJncyk7XG4gIH1cblxuICB0cmlnZ2VyKGV2dE5hbWUsIGFyZ3MpIHtcbiAgICB0aGlzLl9jbGVhck9iamVjdCgpO1xuICAgIHN1cGVyLnRyaWdnZXIoZXZ0TmFtZSwgYXJncyk7XG4gIH1cblxuICAvKipcbiAgICogUG9wdWxhdGVzIHRoaXMgaW5zdGFuY2UgdXNpbmcgc2VydmVyLWRhdGEuXG4gICAqXG4gICAqIFNpZGUgZWZmZWN0cyBhZGQgdGhpcyB0byB0aGUgQ2xpZW50LlxuICAgKlxuICAgKiBAbWV0aG9kIF9wb3B1bGF0ZUZyb21TZXJ2ZXJcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBpZGVudGl0eSAtIFNlcnZlciByZXByZXNlbnRhdGlvbiBvZiB0aGUgaWRlbnRpdHlcbiAgICovXG4gIF9wb3B1bGF0ZUZyb21TZXJ2ZXIoaWRlbnRpdHkpIHtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuXG4gICAgLy8gRGlzYWJsZSBldmVudHMgaWYgY3JlYXRpbmcgYSBuZXcgSWRlbnRpdHlcbiAgICAvLyBXZSBzdGlsbCB3YW50IHByb3BlcnR5IGNoYW5nZSBldmVudHMgZm9yIGFueXRoaW5nIHRoYXQgRE9FUyBjaGFuZ2VcbiAgICB0aGlzLl9kaXNhYmxlRXZlbnRzID0gKHRoaXMuc3luY1N0YXRlID09PSBDb25zdGFudHMuU1lOQ19TVEFURS5ORVcpO1xuXG4gICAgdGhpcy5fc2V0U3luY2VkKCk7XG5cbiAgICB0aGlzLnVzZXJJZCA9IGlkZW50aXR5LnVzZXJfaWQgfHwgJyc7XG5cbiAgICB0aGlzLl91cGRhdGVWYWx1ZSgnYXZhdGFyVXJsJywgaWRlbnRpdHkuYXZhdGFyX3VybCk7XG4gICAgdGhpcy5fdXBkYXRlVmFsdWUoJ2Rpc3BsYXlOYW1lJywgaWRlbnRpdHkuZGlzcGxheV9uYW1lKTtcblxuICAgIGNvbnN0IGlzRnVsbElkZW50aXR5ID0gJ21ldGFkYXRhJyBpbiBpZGVudGl0eTtcblxuICAgIC8vIEhhbmRsZSBGdWxsIElkZW50aXR5IHZzIEJhc2ljIElkZW50aXR5XG4gICAgaWYgKGlzRnVsbElkZW50aXR5KSB7XG4gICAgICB0aGlzLnVybCA9IGlkZW50aXR5LnVybDtcbiAgICAgIHRoaXMudHlwZSA9IGlkZW50aXR5LnR5cGU7XG5cbiAgICAgIHRoaXMuX3VwZGF0ZVZhbHVlKCdlbWFpbEFkZHJlc3MnLCBpZGVudGl0eS5lbWFpbF9hZGRyZXNzKTtcbiAgICAgIHRoaXMuX3VwZGF0ZVZhbHVlKCdsYXN0TmFtZScsIGlkZW50aXR5Lmxhc3RfbmFtZSk7XG4gICAgICB0aGlzLl91cGRhdGVWYWx1ZSgnZmlyc3ROYW1lJywgaWRlbnRpdHkuZmlyc3RfbmFtZSk7XG4gICAgICB0aGlzLl91cGRhdGVWYWx1ZSgnbWV0YWRhdGEnLCBpZGVudGl0eS5tZXRhZGF0YSk7XG4gICAgICB0aGlzLl91cGRhdGVWYWx1ZSgncHVibGljS2V5JywgaWRlbnRpdHkucHVibGljX2tleSk7XG4gICAgICB0aGlzLl91cGRhdGVWYWx1ZSgncGhvbmVOdW1iZXInLCBpZGVudGl0eS5waG9uZV9udW1iZXIpO1xuICAgICAgdGhpcy5pc0Z1bGxJZGVudGl0eSA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnVybCAmJiB0aGlzLmlkKSB7XG4gICAgICB0aGlzLnVybCA9IHRoaXMuZ2V0Q2xpZW50KCkudXJsICsgdGhpcy5pZC5zdWJzdHJpbmcoOCk7XG4gICAgfVxuXG4gICAgdGhpcy5fZGlzYWJsZUV2ZW50cyA9IGZhbHNlO1xuXG4gICAgLy8gU2VlIGlmIHdlIGhhdmUgdGhlIEZ1bGwgSWRlbnRpdHkgT2JqZWN0IGluIGRhdGFiYXNlXG4gICAgaWYgKCF0aGlzLmlzRnVsbElkZW50aXR5ICYmIGNsaWVudC5pc0F1dGhlbnRpY2F0ZWQpIHtcbiAgICAgIGNsaWVudC5kYk1hbmFnZXIuZ2V0T2JqZWN0cygnaWRlbnRpdGllcycsIFt0aGlzLmlkXSwgKHJlc3VsdCkgPT4ge1xuICAgICAgICBpZiAocmVzdWx0Lmxlbmd0aCkgdGhpcy5fcG9wdWxhdGVGcm9tU2VydmVyKHJlc3VsdFswXSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIHRoZSBwcm9wZXJ0eTsgdHJpZ2dlciBhIGNoYW5nZSBldmVudCwgSUYgdGhlIHZhbHVlIGhhcyBjaGFuZ2VkLlxuICAgKlxuICAgKiBAbWV0aG9kIF91cGRhdGVWYWx1ZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30ga2V5IC0gUHJvcGVydHkgbmFtZVxuICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZSAtIFByb3BlcnR5IHZhbHVlXG4gICAqL1xuICBfdXBkYXRlVmFsdWUoa2V5LCB2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB2YWx1ZSA9ICcnO1xuICAgIGlmICh0aGlzW2tleV0gIT09IHZhbHVlKSB7XG4gICAgICBpZiAoIXRoaXMuaXNJbml0aWFsaXppbmcpIHtcbiAgICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdpZGVudGl0aWVzOmNoYW5nZScsIHtcbiAgICAgICAgICBwcm9wZXJ0eToga2V5LFxuICAgICAgICAgIG9sZFZhbHVlOiB0aGlzW2tleV0sXG4gICAgICAgICAgbmV3VmFsdWU6IHZhbHVlLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIHRoaXNba2V5XSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBGb2xsb3cgdGhpcyBVc2VyLlxuICAgKlxuICAgKiBGb2xsb3dpbmcgYSB1c2VyIGdyYW50cyBhY2Nlc3MgdG8gdGhlaXIgRnVsbCBJZGVudGl0eSxcbiAgICogYXMgd2VsbCBhcyB3ZWJzb2NrZXQgZXZlbnRzIHRoYXQgdXBkYXRlIHRoZSBJZGVudGl0eS5cbiAgICogQG1ldGhvZCBmb2xsb3dcbiAgICovXG4gIGZvbGxvdygpIHtcbiAgICBpZiAodGhpcy5pc0Z1bGxJZGVudGl0eSkgcmV0dXJuO1xuICAgIHRoaXMuX3hocih7XG4gICAgICBtZXRob2Q6ICdQVVQnLFxuICAgICAgdXJsOiB0aGlzLnVybC5yZXBsYWNlKC9pZGVudGl0aWVzLywgJ2ZvbGxvd2luZy91c2VycycpLFxuICAgICAgc3luY2FibGU6IHt9LFxuICAgIH0sIChyZXN1bHQpID0+IHtcbiAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgdGhpcy5fbG9hZCgpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFVuZm9sbG93IHRoaXMgVXNlci5cbiAgICpcbiAgICogVW5mb2xsb3dpbmcgdGhlIHVzZXIgd2lsbCByZWR1Y2UgeW91ciBhY2Nlc3MgdG8gb25seSBoYXZpbmcgdGhlaXIgQmFzaWMgSWRlbnRpdHksXG4gICAqIGFuZCB0aGlzIEJhc2ljIElkZW50aXR5IHdpbGwgb25seSBzaG93IHVwIHdoZW4gYSByZWxldmFudCBNZXNzYWdlIG9yIENvbnZlcnNhdGlvbiBoYXMgYmVlbiBsb2FkZWQuXG4gICAqXG4gICAqIFdlYnNvY2tldCBjaGFuZ2Ugbm90aWZpY2F0aW9ucyBmb3IgdGhpcyB1c2VyIHdpbGwgbm90IGFycml2ZS5cbiAgICpcbiAgICogQG1ldGhvZCB1bmZvbGxvd1xuICAgKi9cbiAgdW5mb2xsb3coKSB7XG4gICAgdGhpcy5feGhyKHtcbiAgICAgIHVybDogdGhpcy51cmwucmVwbGFjZSgvaWRlbnRpdGllcy8sICdmb2xsb3dpbmcvdXNlcnMnKSxcbiAgICAgIG1ldGhvZDogJ0RFTEVURScsXG4gICAgICBzeW5jYWJsZToge30sXG4gICAgfSk7XG4gIH1cblxuIC8qKlxuICogVXBkYXRlIHRoZSBVc2VySUQuXG4gKlxuICogVGhpcyB3aWxsIG5vdCBvbmx5IHVwZGF0ZSB0aGUgVXNlciBJRCwgYnV0IGFsc28gdGhlIElELFxuICogVVJMLCBhbmQgcmVyZWdpc3RlciBpdCB3aXRoIHRoZSBDbGllbnQuXG4gKlxuICogQG1ldGhvZCBfc2V0VXNlcklkXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtzdHJpbmd9IHVzZXJJZFxuICovXG4gIF9zZXRVc2VySWQodXNlcklkKSB7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcbiAgICBjbGllbnQuX3JlbW92ZUlkZW50aXR5KHRoaXMpO1xuICAgIHRoaXMuX191c2VySWQgPSB1c2VySWQ7XG4gICAgY29uc3QgZW5jb2RlZCA9IGVuY29kZVVSSUNvbXBvbmVudCh1c2VySWQpO1xuICAgIHRoaXMuaWQgPSBJZGVudGl0eS5wcmVmaXhVVUlEICsgZW5jb2RlZDtcbiAgICB0aGlzLnVybCA9IGAke3RoaXMuZ2V0Q2xpZW50KCkudXJsfS9pZGVudGl0aWVzLyR7ZW5jb2RlZH1gO1xuICAgIGNsaWVudC5fYWRkSWRlbnRpdHkodGhpcyk7XG4gIH1cblxuICAvKipcbiAgKiBfXyBNZXRob2RzIGFyZSBhdXRvbWF0aWNhbGx5IGNhbGxlZCBieSBwcm9wZXJ0eSBzZXR0ZXJzLlxuICAqXG4gICogQW55IGF0dGVtcHQgdG8gZXhlY3V0ZSBgdGhpcy51c2VySWQgPSAneHh4J2Agd2lsbCBjYXVzZSBhbiBlcnJvciB0byBiZSB0aHJvd24uXG4gICogVGhlc2UgYXJlIG5vdCBpbnRlbmRlZCB0byBiZSB3cml0YWJsZSBwcm9wZXJ0aWVzXG4gICpcbiAgKiBAcHJpdmF0ZVxuICAqIEBtZXRob2QgX19hZGp1c3RVc2VySWRcbiAgKiBAcGFyYW0ge3N0cmluZ30gdmFsdWUgLSBOZXcgYXBwSWQgdmFsdWVcbiAgKi9cbiAgX19hZGp1c3RVc2VySWQodXNlcklkKSB7XG4gICAgaWYgKHRoaXMuX191c2VySWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuY2FudENoYW5nZVVzZXJJZCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSBhIFdlYnNvY2tldCBERUxFVEUgZXZlbnQgcmVjZWl2ZWQgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBBIERFTEVURSBldmVudCBtZWFucyB3ZSBoYXZlIHVuZm9sbG93ZWQgdGhpcyB1c2VyOyBhbmQgc2hvdWxkIGRvd25ncmFkZSB0byBhIEJhc2ljIElkZW50aXR5LlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVXZWJzb2NrZXREZWxldGVcbiAgICogQHByb3RlY3RlZFxuICAgKiBAcGFyYW0ge09iamVjdH0gZGF0YSAtIERlbGV0aW9uIHBhcmFtZXRlcnM7IHR5cGljYWxseSBudWxsIGluIHRoaXMgY2FzZS5cbiAgKi9cbiAgLy8gVHVybiBhIEZ1bGwgSWRlbnRpdHkgaW50byBhIEJhc2ljIElkZW50aXR5IGFuZCBkZWxldGUgdGhlIEZ1bGwgSWRlbnRpdHkgZnJvbSB0aGUgZGF0YWJhc2VcbiAgX2hhbmRsZVdlYnNvY2tldERlbGV0ZShkYXRhKSB7XG4gICAgdGhpcy5nZXRDbGllbnQoKS5kYk1hbmFnZXIuZGVsZXRlT2JqZWN0cygnaWRlbnRpdGllcycsIFt0aGlzXSk7XG4gICAgWydmaXJzdE5hbWUnLCAnbGFzdE5hbWUnLCAnZW1haWxBZGRyZXNzJywgJ3Bob25lTnVtYmVyJywgJ21ldGFkYXRhJywgJ3B1YmxpY0tleScsICdpc0Z1bGxJZGVudGl0eScsICd0eXBlJ11cbiAgICAgIC5mb3JFYWNoKGtleSA9PiBkZWxldGUgdGhpc1trZXldKTtcbiAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2lkZW50aXRpZXM6dW5mb2xsb3cnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgSWRlbnRpdHkgYmFzZWQgb24gYSBTZXJ2ZXIgZGVzY3JpcHRpb24gb2YgdGhlIHVzZXIuXG4gICAqXG4gICAqIEBtZXRob2QgX2NyZWF0ZUZyb21TZXJ2ZXJcbiAgICogQHN0YXRpY1xuICAgKiBAcGFyYW0ge09iamVjdH0gaWRlbnRpdHkgLSBTZXJ2ZXIgSWRlbnRpdHkgT2JqZWN0XG4gICAqIEBwYXJhbSB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAgICogQHJldHVybnMge2xheWVyLklkZW50aXR5fVxuICAgKi9cbiAgc3RhdGljIF9jcmVhdGVGcm9tU2VydmVyKGlkZW50aXR5LCBjbGllbnQpIHtcbiAgICByZXR1cm4gbmV3IElkZW50aXR5KHtcbiAgICAgIGNsaWVudCxcbiAgICAgIGZyb21TZXJ2ZXI6IGlkZW50aXR5LFxuICAgICAgX2Zyb21EQjogaWRlbnRpdHkuX2Zyb21EQixcbiAgICB9KTtcbiAgfVxufVxuXG4vKipcbiAqIERpc3BsYXkgbmFtZSBmb3IgdGhlIFVzZXIgb3IgU3lzdGVtIElkZW50aXR5LlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuSWRlbnRpdHkucHJvdG90eXBlLmRpc3BsYXlOYW1lID0gJyc7XG5cbi8qKlxuICogVGhlIElkZW50aXR5IG1hdGNoaW5nIGBsYXllci5DbGllbnQudXNlcmAgd2lsbCBoYXZlIHRoaXMgYmUgdHJ1ZS5cbiAqXG4gKiBBbGwgb3RoZXIgSWRlbnRpdGllcyB3aWxsIGhhdmUgdGhpcyBhcyBmYWxzZS5cbiAqIEB0eXBlIHtib29sZWFufVxuICovXG5JZGVudGl0eS5wcm90b3R5cGUuc2Vzc2lvbk93bmVyID0gZmFsc2U7XG5cbi8qKlxuICogSUQgb2YgdGhlIENsaWVudCB0aGlzIElkZW50aXR5IGlzIGFzc29jaWF0ZWQgd2l0aC5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbklkZW50aXR5LnByb3RvdHlwZS5jbGllbnRJZCA9ICcnO1xuXG4vKipcbiAqIElzIHRoaXMgYSBGdWxsIElkZW50aXR5IG9yIEJhc2ljIElkZW50aXR5P1xuICpcbiAqIE5vdGUgdGhhdCBTZXJ2aWNlIElkZW50aXRpZXMgYXJlIGFsd2F5cyBjb25zaWRlcmVkIHRvIGJlIEJhc2ljLlxuICogQHR5cGUge2Jvb2xlYW59XG4gKi9cbklkZW50aXR5LnByb3RvdHlwZS5pc0Z1bGxJZGVudGl0eSA9IGZhbHNlO1xuXG5cblxuLyoqXG4gKiBVbmlxdWUgSUQgZm9yIHRoaXMgVXNlci5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbklkZW50aXR5LnByb3RvdHlwZS51c2VySWQgPSAnJztcblxuLyoqXG4gKiBPcHRpb25hbCBVUkwgZm9yIHRoZSB1c2VyJ3MgaWNvbi5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbklkZW50aXR5LnByb3RvdHlwZS5hdmF0YXJVcmwgPSAnJztcblxuLyoqXG4gKiBPcHRpb25hbCBmaXJzdCBuYW1lIGZvciB0aGlzIHVzZXIuXG4gKlxuICogRnVsbCBJZGVudGl0aWVzIE9ubHkuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuSWRlbnRpdHkucHJvdG90eXBlLmZpcnN0TmFtZSA9ICcnO1xuXG4vKipcbiAqIE9wdGlvbmFsIGxhc3QgbmFtZSBmb3IgdGhpcyB1c2VyLlxuICpcbiAqIEZ1bGwgSWRlbnRpdGllcyBPbmx5LlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbklkZW50aXR5LnByb3RvdHlwZS5sYXN0TmFtZSA9ICcnO1xuXG4vKipcbiAqIE9wdGlvbmFsIGVtYWlsIGFkZHJlc3MgZm9yIHRoaXMgdXNlci5cbiAqXG4gKiBGdWxsIElkZW50aXRpZXMgT25seS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5JZGVudGl0eS5wcm90b3R5cGUuZW1haWxBZGRyZXNzID0gJyc7XG5cbi8qKlxuICogT3B0aW9uYWwgcGhvbmUgbnVtYmVyIGZvciB0aGlzIHVzZXIuXG4gKlxuICogRnVsbCBJZGVudGl0aWVzIE9ubHkuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuSWRlbnRpdHkucHJvdG90eXBlLnBob25lTnVtYmVyID0gJyc7XG5cbi8qKlxuICogT3B0aW9uYWwgbWV0YWRhdGEgZm9yIHRoaXMgdXNlci5cbiAqXG4gKiBGdWxsIElkZW50aXRpZXMgT25seS5cbiAqXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG5JZGVudGl0eS5wcm90b3R5cGUubWV0YWRhdGEgPSBudWxsO1xuXG4vKipcbiAqIE9wdGlvbmFsIHB1YmxpYyBrZXkgZm9yIGVuY3J5cHRpbmcgbWVzc2FnZSB0ZXh0IGZvciB0aGlzIHVzZXIuXG4gKlxuICogRnVsbCBJZGVudGl0aWVzIE9ubHkuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuSWRlbnRpdHkucHJvdG90eXBlLnB1YmxpY0tleSA9ICcnO1xuXG4vKipcbiAqIEBzdGF0aWNcbiAqIEB0eXBlIHtzdHJpbmd9IFRoZSBJZGVudGl0eSByZXByZXNlbnRzIGEgdXNlci4gIFZhbHVlIHVzZWQgaW4gdGhlIGxheWVyLklkZW50aXR5LnR5cGUgZmllbGQuXG4gKi9cbklkZW50aXR5LlVzZXJUeXBlID0gJ3VzZXInO1xuXG4vKipcbiAqIEBzdGF0aWNcbiAqIEB0eXBlIHtzdHJpbmd9IFRoZSBJZGVudGl0eSByZXByZXNlbnRzIGEgYm90LiAgVmFsdWUgdXNlZCBpbiB0aGUgbGF5ZXIuSWRlbnRpdHkudHlwZSBmaWVsZC5cbiAqL1xuSWRlbnRpdHkuQm90VHlwZSA9ICdib3QnO1xuXG4vKipcbiAqIFdoYXQgdHlwZSBvZiBJZGVudGl0eSBkb2VzIHRoaXMgcmVwcmVzZW50P1xuICpcbiAqICogQSBib3Q/IFVzZSBsYXllci5JZGVudGl0eS5Cb3RUeXBlXG4gKiAqIEEgVXNlcj8gVXNlIGxheWVyLklkZW50aXR5LlVzZXJUeXBlXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5JZGVudGl0eS5wcm90b3R5cGUudHlwZSA9IElkZW50aXR5LlVzZXJUeXBlO1xuXG4vKipcbiAqIElzIHRoaXMgSWRlbnRpdHkgYSBib3Q/XG4gKlxuICogSWYgdGhlIGxheWVyLklkZW50aXR5LnR5cGUgZmllbGQgaXMgZXF1YWwgdG8gbGF5ZXIuSWRlbnRpdHkuQm90VHlwZSB0aGVuIHRoaXMgd2lsbCByZXR1cm4gdHJ1ZS5cbiAqIEB0eXBlIHtib29sZWFufVxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSWRlbnRpdHkucHJvdG90eXBlLCAnaXNCb3QnLCB7XG4gIGVudW1lcmFibGU6IHRydWUsXG4gIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgIHJldHVybiB0aGlzLnR5cGUgIT09IElkZW50aXR5LkJvdFR5cGU7XG4gIH0sXG59KTtcblxuSWRlbnRpdHkuaW5PYmplY3RJZ25vcmUgPSBSb290LmluT2JqZWN0SWdub3JlO1xuXG5JZGVudGl0eS5idWJibGVFdmVudFBhcmVudCA9ICdnZXRDbGllbnQnO1xuXG5JZGVudGl0eS5fc3VwcG9ydGVkRXZlbnRzID0gW1xuICAnaWRlbnRpdGllczpjaGFuZ2UnLFxuICAnaWRlbnRpdGllczpsb2FkZWQnLFxuICAnaWRlbnRpdGllczpsb2FkZWQtZXJyb3InLFxuICAnaWRlbnRpdGllczp1bmZvbGxvdycsXG5dLmNvbmNhdChTeW5jYWJsZS5fc3VwcG9ydGVkRXZlbnRzKTtcblxuSWRlbnRpdHkuZXZlbnRQcmVmaXggPSAnaWRlbnRpdGllcyc7XG5JZGVudGl0eS5wcmVmaXhVVUlEID0gJ2xheWVyOi8vL2lkZW50aXRpZXMvJztcbklkZW50aXR5LmVuYWJsZU9wc0lmTmV3ID0gdHJ1ZTtcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoSWRlbnRpdHksIFtJZGVudGl0eSwgJ0lkZW50aXR5J10pO1xuU3luY2FibGUuc3ViY2xhc3Nlcy5wdXNoKElkZW50aXR5KTtcblxubW9kdWxlLmV4cG9ydHMgPSBJZGVudGl0eTtcbiJdfQ==
