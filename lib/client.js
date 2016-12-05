'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The Layer Client; this is the top level component for any Layer based application.

    var client = new layer.Client({
      appId: 'layer:///apps/staging/ffffffff-ffff-ffff-ffff-ffffffffffff',
      challenge: function(evt) {
        myAuthenticator({
          nonce: evt.nonce,
          onSuccess: evt.callback
        });
      },
      ready: function(client) {
        alert('I am Client; Server: Serve me!');
      }
    }).connect('Fred')
 *
 * You can also initialize this as

    var client = new layer.Client({
      appId: 'layer:///apps/staging/ffffffff-ffff-ffff-ffff-ffffffffffff'
    });

    client.on('challenge', function(evt) {
      myAuthenticator({
        nonce: evt.nonce,
        onSuccess: evt.callback
      });
    });

    client.on('ready', function(client) {
      alert('I am Client; Server: Serve me!');
    });

    client.connect('Fred');
 *
 * ## API Synopsis:
 *
 * The following Properties, Methods and Events are the most commonly used ones.  See the full API below
 * for the rest of the API.
 *
 * ### Properties:
 *
 * * layer.Client.userId: User ID of the authenticated user
 * * layer.Client.appId: The ID for your application
 *
 *
 * ### Methods:
 *
 * * layer.Client.createConversation(): Create a new layer.Conversation.
 * * layer.Client.createQuery(): Create a new layer.Query.
 * * layer.Client.getMessage(): Input a Message ID, and output a layer.Message or layer.Announcement from cache.
 * * layer.Client.getConversation(): Input a Conversation ID, and output a layer.Conversation from cache.
 * * layer.Client.on() and layer.Conversation.off(): event listeners
 * * layer.Client.destroy(): Cleanup all resources used by this client, including all Messages and Conversations.
 *
 * ### Events:
 *
 * * `challenge`: Provides a nonce and a callback; you call the callback once you have an Identity Token.
 * * `ready`: Your application can now start using the Layer services
 * * `messages:notify`: Used to notify your application of new messages for which a local notification may be suitable.
 *
 * ## Logging:
 *
 * There are two ways to change the log level for Layer's logger:
 *
 *     layer.Client.prototype.logLevel = layer.Constants.LOG.INFO;
 *
 * or
 *
 *     var client = new layer.Client({
 *        appId: 'layer:///apps/staging/ffffffff-ffff-ffff-ffff-ffffffffffff',
 *        logLevel: layer.Constants.LOG.INFO
 *     });
 *
 * @class  layer.Client
 * @extends layer.ClientAuthenticator
 *
 */

var ClientAuth = require('./client-authenticator');
var Conversation = require('./conversation');
var Query = require('./query');
var ErrorDictionary = require('./layer-error').dictionary;
var Syncable = require('./syncable');
var Message = require('./message');
var Announcement = require('./announcement');
var Identity = require('./identity');
var TypingIndicatorListener = require('./typing-indicators/typing-indicator-listener');
var Util = require('./client-utils');
var Root = require('./root');
var ClientRegistry = require('./client-registry');
var logger = require('./logger');

var Client = function (_ClientAuth) {
  _inherits(Client, _ClientAuth);

  /*
   * Adds conversations, messages and websockets on top of the authentication client.
   * jsdocs on parent class constructor.
   */
  function Client(options) {
    _classCallCheck(this, Client);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Client).call(this, options));

    ClientRegistry.register(_this);

    // Initialize Properties
    _this._conversationsHash = {};
    _this._messagesHash = {};
    _this._queriesHash = {};
    _this._identitiesHash = {};
    _this._scheduleCheckAndPurgeCacheItems = [];

    _this._initComponents();

    _this.on('online', _this._connectionRestored.bind(_this));

    logger.info(Util.asciiInit(Client.version));
    return _this;
  }

  /* See parent method docs */


  _createClass(Client, [{
    key: '_initComponents',
    value: function _initComponents() {
      var _this2 = this;

      _get(Object.getPrototypeOf(Client.prototype), '_initComponents', this).call(this);

      this._typingIndicators = new TypingIndicatorListener({
        clientId: this.appId
      });

      // Instantiate Plugins
      Object.keys(Client.plugins).forEach(function (propertyName) {
        _this2[propertyName] = new Client.plugins[propertyName](_this2);
      });
    }

    /**
     * Cleanup all resources (Conversations, Messages, etc...) prior to destroy or reauthentication.
     *
     * @method _cleanup
     * @private
     */

  }, {
    key: '_cleanup',
    value: function _cleanup() {
      var _this3 = this;

      if (this.isDestroyed) return;
      this._inCleanup = true;

      Object.keys(this._conversationsHash).forEach(function (id) {
        var c = _this3._conversationsHash[id];
        if (c && !c.isDestroyed) {
          c.destroy();
        }
      });
      this._conversationsHash = null;

      Object.keys(this._messagesHash).forEach(function (id) {
        var m = _this3._messagesHash[id];
        if (m && !m.isDestroyed) {
          m.destroy();
        }
      });
      this._messagesHash = null;

      Object.keys(this._queriesHash).forEach(function (id) {
        _this3._queriesHash[id].destroy();
      });
      this._queriesHash = null;

      Object.keys(this._identitiesHash).forEach(function (id) {
        var identity = _this3._identitiesHash[id];
        if (identity && !identity.isDestroyed) {
          identity.destroy();
        }
      });
      this._identitiesHash = null;

      if (this.socketManager) this.socketManager.close();
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      var _this4 = this;

      // Cleanup all plugins
      Object.keys(Client.plugins).forEach(function (propertyName) {
        if (_this4[propertyName]) {
          _this4[propertyName].destroy();
          delete _this4[propertyName];
        }
      });

      // Cleanup all resources (Conversations, Messages, etc...)
      this._cleanup();

      this._destroyComponents();

      ClientRegistry.unregister(this);

      _get(Object.getPrototypeOf(Client.prototype), 'destroy', this).call(this);
      this._inCleanup = false;
    }
  }, {
    key: '__adjustAppId',
    value: function __adjustAppId() {
      if (this.appId) throw new Error(ErrorDictionary.appIdImmutable);
    }

    /**
     * Retrieve a conversation by Identifier.
     *
     *      var c = client.getConversation('layer:///conversations/uuid');
     *
     * If there is not a conversation with that id, it will return null.
     *
     * If you want it to load it from cache and then from server if not in cache, use the `canLoad` parameter.
     * If loading from the server, the method will return
     * a layer.Conversation instance that has no data; the `conversations:loaded` / `conversations:loaded-error` events
     * will let you know when the conversation has finished/failed loading from the server.
     *
     *      var c = client.getConversation('layer:///conversations/123', true)
     *      .on('conversations:loaded', function() {
     *          // Render the Conversation with all of its details loaded
     *          myrerender(c);
     *      });
     *      // Render a placeholder for c until the details of c have loaded
     *      myrender(c);
     *
     * Note in the above example that the `conversations:loaded` event will trigger even if the Conversation has previously loaded.
     *
     * @method getConversation
     * @param  {string} id
     * @param  {boolean} [canLoad=false] - Pass true to allow loading a conversation from
     *                                    the server if not found
     * @return {layer.Conversation}
     */

  }, {
    key: 'getConversation',
    value: function getConversation(id, canLoad) {
      if (typeof id !== 'string') throw new Error(ErrorDictionary.idParamRequired);
      if (this._conversationsHash[id]) {
        return this._conversationsHash[id];
      } else if (canLoad) {
        return Conversation.load(id, this);
      }
      return null;
    }

    /**
     * Adds a conversation to the client.
     *
     * Typically, you do not need to call this; the following code
     * automatically calls _addConversation for you:
     *
     *      var conv = new layer.Conversation({
     *          client: client,
     *          participants: ['a', 'b']
     *      });
     *
     *      // OR:
     *      var conv = client.createConversation(['a', 'b']);
     *
     * @method _addConversation
     * @protected
     * @param  {layer.Conversation} c
     */

  }, {
    key: '_addConversation',
    value: function _addConversation(conversation) {
      var id = conversation.id;
      if (!this._conversationsHash[id]) {
        // Register the Conversation
        this._conversationsHash[id] = conversation;

        // Make sure the client is set so that the next event bubbles up
        if (conversation.clientId !== this.appId) conversation.clientId = this.appId;
        this._triggerAsync('conversations:add', { conversations: [conversation] });

        this._scheduleCheckAndPurgeCache(conversation);
      }
    }

    /**
     * Removes a conversation from the client.
     *
     * Typically, you do not need to call this; the following code
     * automatically calls _removeConversation for you:
     *
     *      converation.destroy();
     *
     * @method _removeConversation
     * @protected
     * @param  {layer.Conversation} c
     */

  }, {
    key: '_removeConversation',
    value: function _removeConversation(conversation) {
      var _this5 = this;

      // Insure we do not get any events, such as message:remove
      conversation.off(null, null, this);

      if (this._conversationsHash[conversation.id]) {
        delete this._conversationsHash[conversation.id];
        this._triggerAsync('conversations:remove', { conversations: [conversation] });
      }

      // Remove any Message associated with this Conversation
      Object.keys(this._messagesHash).forEach(function (id) {
        if (_this5._messagesHash[id].conversationId === conversation.id) {
          _this5._messagesHash[id].destroy();
        }
      });
    }

    /**
     * If the Conversation ID changes, we need to reregister the Conversation
     *
     * @method _updateConversationId
     * @protected
     * @param  {layer.Conversation} conversation - Conversation whose ID has changed
     * @param  {string} oldId - Previous ID
     */

  }, {
    key: '_updateConversationId',
    value: function _updateConversationId(conversation, oldId) {
      var _this6 = this;

      if (this._conversationsHash[oldId]) {
        this._conversationsHash[conversation.id] = conversation;
        delete this._conversationsHash[oldId];

        // This is a nasty way to work... but need to find and update all
        // conversationId properties of all Messages or the Query's won't
        // see these as matching the query.
        Object.keys(this._messagesHash).filter(function (id) {
          return _this6._messagesHash[id].conversationId === oldId;
        }).forEach(function (id) {
          return _this6._messagesHash[id].conversationId = conversation.id;
        });
      }
    }

    /**
     * Retrieve the message or announcement id.
     *
     * Useful for finding a message when you have only the ID.
     *
     * If the message is not found, it will return null.
     *
     * If you want it to load it from cache and then from server if not in cache, use the `canLoad` parameter.
     * If loading from the server, the method will return
     * a layer.Message instance that has no data; the messages:loaded/messages:loaded-error events
     * will let you know when the message has finished/failed loading from the server.
     *
     *      var m = client.getMessage('layer:///messages/123', true)
     *      .on('messages:loaded', function() {
     *          // Render the Message with all of its details loaded
     *          myrerender(m);
     *      });
     *      // Render a placeholder for m until the details of m have loaded
     *      myrender(m);
     *
     *
     * @method getMessage
     * @param  {string} id              - layer:///messages/uuid
     * @param  {boolean} [canLoad=false] - Pass true to allow loading a message from the server if not found
     * @return {layer.Message}
     */

  }, {
    key: 'getMessage',
    value: function getMessage(id, canLoad) {
      if (typeof id !== 'string') throw new Error(ErrorDictionary.idParamRequired);

      if (this._messagesHash[id]) {
        return this._messagesHash[id];
      } else if (canLoad) {
        return Syncable.load(id, this);
      }
      return null;
    }

    /**
     * Get a MessagePart by ID
     *
     * ```
     * var part = client.getMessagePart('layer:///messages/6f08acfa-3268-4ae5-83d9-6ca00000000/parts/0');
     * ```
     *
     * @method getMessagePart
     * @param {String} id - ID of the Message Part; layer:///messages/uuid/parts/5
     */

  }, {
    key: 'getMessagePart',
    value: function getMessagePart(id) {
      if (typeof id !== 'string') throw new Error(ErrorDictionary.idParamRequired);

      var messageId = id.replace(/\/parts.*$/, '');
      var message = this.getMessage(messageId);
      if (message) return message.getPartById(id);
      return null;
    }

    /**
     * Registers a message in _messagesHash and triggers events.
     *
     * May also update Conversation.lastMessage.
     *
     * @method _addMessage
     * @protected
     * @param  {layer.Message} message
     */

  }, {
    key: '_addMessage',
    value: function _addMessage(message) {
      if (!this._messagesHash[message.id]) {
        this._messagesHash[message.id] = message;
        this._triggerAsync('messages:add', { messages: [message] });
        if (message._notify) {
          this._triggerAsync('messages:notify', { message: message });
          message._notify = false;
        }

        var conversation = message.getConversation(false);
        if (conversation && (!conversation.lastMessage || conversation.lastMessage.position < message.position)) {
          var lastMessageWas = conversation.lastMessage;
          conversation.lastMessage = message;
          if (lastMessageWas) this._scheduleCheckAndPurgeCache(lastMessageWas);
        } else {
          this._scheduleCheckAndPurgeCache(message);
        }
      }
    }

    /**
     * Removes message from _messagesHash.
     *
     * Accepts IDs or Message instances
     *
     * TODO: Remove support for remove by ID
     *
     * @method _removeMessage
     * @private
     * @param  {layer.Message|string} message or Message ID
     */

  }, {
    key: '_removeMessage',
    value: function _removeMessage(message) {
      var id = typeof message === 'string' ? message : message.id;
      message = this._messagesHash[id];
      if (message) {
        delete this._messagesHash[id];
        if (!this._inCleanup) {
          this._triggerAsync('messages:remove', { messages: [message] });
          var conv = message.getConversation(false);
          if (conv && conv.lastMessage === message) conv.lastMessage = null;
        }
      }
    }

    /**
     * Handles delete from position event from Websocket.
     *
     * A WebSocket may deliver a `delete` Conversation event with a
     * from_position field indicating that all Messages at the specified position
     * and earlier should be deleted.
     *
     * @method _purgeMessagesByPosition
     * @private
     * @param {string} conversationId
     * @param {number} fromPosition
     */

  }, {
    key: '_purgeMessagesByPosition',
    value: function _purgeMessagesByPosition(conversationId, fromPosition) {
      var _this7 = this;

      Object.keys(this._messagesHash).forEach(function (mId) {
        var message = _this7._messagesHash[mId];
        if (message.conversationId === conversationId && message.position <= fromPosition) {
          message.destroy();
        }
      });
    }

    /**
     * Retrieve a identity by Identifier.
     *
     *      var identity = client.getIdentity('layer:///identities/user_id');
     *
     * If there is not an Identity with that id, it will return null.
     *
     * If you want it to load it from cache and then from server if not in cache, use the `canLoad` parameter.
     * This is only supported for User Identities, not Service Identities.
     *
     * If loading from the server, the method will return
     * a layer.Identity instance that has no data; the identities:loaded/identities:loaded-error events
     * will let you know when the identity has finished/failed loading from the server.
     *
     *      var user = client.getIdentity('layer:///identities/123', true)
     *      .on('identities:loaded', function() {
     *          // Render the user list with all of its details loaded
     *          myrerender(user);
     *      });
     *      // Render a placeholder for user until the details of user have loaded
     *      myrender(user);
     *
     * @method getIdentity
     * @param  {string} id - Accepts full Layer ID (layer:///identities/frodo-the-dodo) or just the UserID (frodo-the-dodo).
     * @param  {boolean} [canLoad=false] - Pass true to allow loading an identity from
     *                                    the server if not found
     * @return {layer.Identity}
     */

  }, {
    key: 'getIdentity',
    value: function getIdentity(id, canLoad) {
      if (typeof id !== 'string') throw new Error(ErrorDictionary.idParamRequired);
      if (!Identity.isValidId(id)) {
        id = Identity.prefixUUID + encodeURIComponent(id);
      }

      if (this._identitiesHash[id]) {
        return this._identitiesHash[id];
      } else if (canLoad) {
        return Identity.load(id, this);
      }
      return null;
    }

    /**
     * Takes an array of Identity instances, User IDs, Identity IDs, Identity objects,
     * or Server formatted Identity Objects and returns an array of Identity instances.
     *
     * @method _fixIdentities
     * @private
     * @param {Mixed[]} identities - Something that tells us what Identity to return
     * @return {layer.Identity[]}
     */

  }, {
    key: '_fixIdentities',
    value: function _fixIdentities(identities) {
      var _this8 = this;

      return identities.map(function (identity) {
        if (identity instanceof Identity) return identity;
        if (typeof identity === 'string') {
          return _this8.getIdentity(identity, true);
        } else if (identity && (typeof identity === 'undefined' ? 'undefined' : _typeof(identity)) === 'object') {
          if ('userId' in identity) {
            return _this8.getIdentity(identity.id || identity.userId);
          } else if ('user_id' in identity) {
            return _this8._createObject(identity);
          }
        }
      });
    }

    /**
     * Adds an identity to the client.
     *
     * Typically, you do not need to call this; the Identity constructor will call this.
     *
     * @method _addIdentity
     * @protected
     * @param  {layer.Identity} identity
     *
     * TODO: It should be possible to add an Identity whose userId is populated, but
     * other values are not yet loaded from the server.  Should add to _identitiesHash now
     * but trigger `identities:add` only when its got enough data to be renderable.
     */

  }, {
    key: '_addIdentity',
    value: function _addIdentity(identity) {
      var id = identity.id;
      if (id && !this._identitiesHash[id]) {
        // Register the Identity
        this._identitiesHash[id] = identity;
        this._triggerAsync('identities:add', { identities: [identity] });
      }
    }

    /**
     * Removes an identity from the client.
     *
     * Typically, you do not need to call this; the following code
     * automatically calls _removeIdentity for you:
     *
     *      identity.destroy();
     *
     * @method _removeIdentity
     * @protected
     * @param  {layer.Identity} identity
     */

  }, {
    key: '_removeIdentity',
    value: function _removeIdentity(identity) {
      // Insure we do not get any events, such as message:remove
      identity.off(null, null, this);

      var id = identity.id;
      if (this._identitiesHash[id]) {
        delete this._identitiesHash[id];
        this._triggerAsync('identities:remove', { identities: [identity] });
      }
    }

    /**
     * Follow this user and get Full Identity, and websocket changes on Identity.
     *
     * @method followIdentity
     * @param  {string} id - Accepts full Layer ID (layer:///identities/frodo-the-dodo) or just the UserID (frodo-the-dodo).
     * @returns {layer.Identity}
     */

  }, {
    key: 'followIdentity',
    value: function followIdentity(id) {
      if (!Identity.isValidId(id)) {
        id = Identity.prefixUUID + encodeURIComponent(id);
      }
      var identity = this.getIdentity(id);
      if (!identity) {
        identity = new Identity({
          id: id,
          clientId: this.appId,
          userId: id.substring(20)
        });
      }
      identity.follow();
      return identity;
    }

    /**
     * Unfollow this user and get only Basic Identity, and no websocket changes on Identity.
     *
     * @method unfollowIdentity
     * @param  {string} id - Accepts full Layer ID (layer:///identities/frodo-the-dodo) or just the UserID (frodo-the-dodo).
     * @returns {layer.Identity}
     */

  }, {
    key: 'unfollowIdentity',
    value: function unfollowIdentity(id) {
      if (!Identity.isValidId(id)) {
        id = Identity.prefixUUID + encodeURIComponent(id);
      }
      var identity = this.getIdentity(id);
      if (!identity) {
        identity = new Identity({
          id: id,
          clientId: this.appId,
          userId: id.substring(20)
        });
      }
      identity.unfollow();
      return identity;
    }

    /**
     * Takes as input an object id, and either calls getConversation() or getMessage() as needed.
     *
     * Will only get cached objects, will not get objects from the server.
     *
     * This is not a public method mostly so there's no ambiguity over using getXXX
     * or _getObject.  getXXX typically has an option to load the resource, which this
     * does not.
     *
     * @method _getObject
     * @protected
     * @param  {string} id - Message, Conversation or Query id
     * @return {layer.Message|layer.Conversation|layer.Query}
     */

  }, {
    key: '_getObject',
    value: function _getObject(id) {
      switch (Util.typeFromID(id)) {
        case 'messages':
        case 'announcements':
          return this.getMessage(id);
        case 'conversations':
          return this.getConversation(id);
        case 'queries':
          return this.getQuery(id);
        case 'identities':
          return this.getIdentity(id);
      }
      return null;
    }

    /**
     * Takes an object description from the server and either updates it (if cached)
     * or creates and caches it .
     *
     * @method _createObject
     * @protected
     * @param  {Object} obj - Plain javascript object representing a Message or Conversation
     */

  }, {
    key: '_createObject',
    value: function _createObject(obj) {
      var item = this._getObject(obj.id);
      if (item) {
        item._populateFromServer(obj);
        return item;
      } else {
        switch (Util.typeFromID(obj.id)) {
          case 'messages':
            return Message._createFromServer(obj, this);
          case 'announcements':
            return Announcement._createFromServer(obj, this);
          case 'conversations':
            return Conversation._createFromServer(obj, this);
          case 'identities':
            return Identity._createFromServer(obj, this);
        }
      }
      return null;
    }

    /**
     * Merge events into smaller numbers of more complete events.
     *
     * Before any delayed triggers are fired, fold together all of the conversations:add
     * and conversations:remove events so that 100 conversations:add events can be fired as
     * a single event.
     *
     * @method _processDelayedTriggers
     * @private
     */

  }, {
    key: '_processDelayedTriggers',
    value: function _processDelayedTriggers() {
      if (this.isDestroyed) return;

      var addConversations = this._delayedTriggers.filter(function (evt) {
        return evt[0] === 'conversations:add';
      });
      var removeConversations = this._delayedTriggers.filter(function (evt) {
        return evt[0] === 'conversations:remove';
      });
      this._foldEvents(addConversations, 'conversations', this);
      this._foldEvents(removeConversations, 'conversations', this);

      var addMessages = this._delayedTriggers.filter(function (evt) {
        return evt[0] === 'messages:add';
      });
      var removeMessages = this._delayedTriggers.filter(function (evt) {
        return evt[0] === 'messages:remove';
      });

      this._foldEvents(addMessages, 'messages', this);
      this._foldEvents(removeMessages, 'messages', this);

      var addIdentities = this._delayedTriggers.filter(function (evt) {
        return evt[0] === 'identities:add';
      });
      var removeIdentities = this._delayedTriggers.filter(function (evt) {
        return evt[0] === 'identities:remove';
      });

      this._foldEvents(addIdentities, 'identities', this);
      this._foldEvents(removeIdentities, 'identities', this);

      _get(Object.getPrototypeOf(Client.prototype), '_processDelayedTriggers', this).call(this);
    }
  }, {
    key: 'trigger',
    value: function trigger(eventName, evt) {
      this._triggerLogger(eventName, evt);
      _get(Object.getPrototypeOf(Client.prototype), 'trigger', this).call(this, eventName, evt);
    }

    /**
     * Does logging on all triggered events.
     *
     * All logging is done at `debug` or `info` levels.
     *
     * @method _triggerLogger
     * @private
     */

  }, {
    key: '_triggerLogger',
    value: function _triggerLogger(eventName, evt) {
      var infoEvents = ['conversations:add', 'conversations:remove', 'conversations:change', 'messages:add', 'messages:remove', 'messages:change', 'identities:add', 'identities:remove', 'identities:change', 'challenge', 'ready'];
      if (infoEvents.indexOf(eventName) !== -1) {
        if (evt && evt.isChange) {
          logger.info('Client Event: ' + eventName + ' ' + evt.changes.map(function (change) {
            return change.property;
          }).join(', '));
        } else {
          var text = '';
          if (evt) {
            if (evt.message) text = evt.message.id;
            if (evt.messages) text = evt.messages.length + ' messages';
            if (evt.conversation) text = evt.conversation.id;
            if (evt.conversations) text = evt.conversations.length + ' conversations';
          }
          logger.info('Client Event: ' + eventName + ' ' + text);
        }
        if (evt) logger.debug(evt);
      } else {
        logger.debug(eventName, evt);
      }
    }

    /**
     * Searches locally cached conversations for a matching conversation.
     *
     * Iterates over conversations calling a matching function until
     * the conversation is found or all conversations tested.
     *
     *      var c = client.findConversation(function(conversation) {
     *          if (conversation.participants.indexOf('a') != -1) return true;
     *      });
     *
     * @method findCachedConversation
     * @param  {Function} f - Function to call until we find a match
     * @param  {layer.Conversation} f.conversation - A conversation to test
     * @param  {boolean} f.return - Return true if the conversation is a match
     * @param  {Object} [context] - Optional context for the *this* object
     * @return {layer.Conversation}
     *
     * @deprecated
     * This should be replaced by iterating over your layer.Query data.
     */

  }, {
    key: 'findCachedConversation',
    value: function findCachedConversation(func, context) {
      var test = context ? func.bind(context) : func;
      var list = Object.keys(this._conversationsHash);
      var len = list.length;
      for (var index = 0; index < len; index++) {
        var key = list[index];
        var conversation = this._conversationsHash[key];
        if (test(conversation, index)) return conversation;
      }
      return null;
    }

    /**
     * If the session has been reset, dump all data.
     *
     * @method _resetSession
     * @private
     */

  }, {
    key: '_resetSession',
    value: function _resetSession() {
      this._cleanup();
      this._conversationsHash = {};
      this._messagesHash = {};
      this._queriesHash = {};
      this._identitiesHash = {};
      return _get(Object.getPrototypeOf(Client.prototype), '_resetSession', this).call(this);
    }

    /**
     * This method is recommended way to create a Conversation.
     *
     * There are a few ways to invoke it; note that the default behavior is to create a Distinct Conversation
     * unless otherwise stated via the layer.Conversation.distinct property.
     *
     *         client.createConversation({participants: ['a', 'b']});
     *         client.createConversation({participants: [userIdentityA, userIdentityB]});
     *
     *         client.createConversation({
     *             participants: ['a', 'b'],
     *             distinct: false
     *         });
     *
     *         client.createConversation({
     *             participants: ['a', 'b'],
     *             metadata: {
     *                 title: 'I am a title'
     *             }
     *         });
     *
     * If you try to create a Distinct Conversation that already exists,
     * you will get back an existing Conversation, and any requested metadata
     * will NOT be set; you will get whatever metadata the matching Conversation
     * already had.
     *
     * The default value for distinct is `true`.
     *
     * Whether the Conversation already exists or not, a 'conversations:sent' event
     * will be triggered asynchronously and the Conversation object will be ready
     * at that time.  Further, the event will provide details on the result:
     *
     *       var conversation = client.createConversation({
     *          participants: ['a', 'b'],
     *          metadata: {
     *            title: 'I am a title'
     *          }
     *       });
     *       conversation.on('conversations:sent', function(evt) {
     *           switch(evt.result) {
     *               case Conversation.CREATED:
     *                   alert(conversation.id + ' was created');
     *                   break;
     *               case Conversation.FOUND:
     *                   alert(conversation.id + ' was found');
     *                   break;
     *               case Conversation.FOUND_WITHOUT_REQUESTED_METADATA:
     *                   alert(conversation.id + ' was found but it already has a title so your requested title was not set');
     *                   break;
     *            }
     *       });
     *
     * Warning: This method will throw an error if called when you are not (or are no longer) an authenticated user.
     * That means if authentication has expired, and you have not yet reauthenticated the user, this will throw an error.
     *
     *
     * @method createConversation
     * @param  {Object} options
     * @param {string[]/layer.Identity[]} participants - Array of UserIDs or UserIdentities
     * @param {Boolean} [options.distinct=true] Is this a distinct Converation?
     * @param {Object} [options.metadata={}] Metadata for your Conversation
     * @return {layer.Conversation}
     */

  }, {
    key: 'createConversation',
    value: function createConversation(options) {
      // If we aren't authenticated, then we don't yet have a UserID, and won't create the correct Conversation
      if (!this.isAuthenticated) throw new Error(ErrorDictionary.clientMustBeReady);
      if (!('distinct' in options)) options.distinct = true;
      options.client = this;
      return Conversation.create(options);
    }

    /**
     * Retrieve the query by query id.
     *
     * Useful for finding a Query when you only have the ID
     *
     * @method getQuery
     * @param  {string} id              - layer:///messages/uuid
     * @return {layer.Query}
     */

  }, {
    key: 'getQuery',
    value: function getQuery(id) {
      if (typeof id !== 'string') throw new Error(ErrorDictionary.idParamRequired);
      return this._queriesHash[id] || null;
    }

    /**
     * There are two options to create a new layer.Query instance.
     *
     * The direct way:
     *
     *     var query = client.createQuery({
     *         model: layer.Query.Message,
     *         predicate: 'conversation.id = '' + conv.id + ''',
     *         paginationWindow: 50
     *     });
     *
     * A Builder approach that allows for a simpler syntax:
     *
     *     var qBuilder = QueryBuilder
     *      .messages()
     *      .forConversation('layer:///conversations/ffffffff-ffff-ffff-ffff-ffffffffffff')
     *      .paginationWindow(100);
     *     var query = client.createQuery(qBuilder);
     *
     * @method createQuery
     * @param  {layer.QueryBuilder|Object} options - Either a layer.QueryBuilder instance, or parameters for the layer.Query constructor
     * @return {layer.Query}
     */

  }, {
    key: 'createQuery',
    value: function createQuery(options) {
      var query = void 0;
      if (typeof options.build === 'function') {
        query = new Query(this, options);
      } else {
        options.client = this;
        query = new Query(options);
      }
      this._addQuery(query);
      return query;
    }

    /**
     * Register the layer.Query.
     *
     * @method _addQuery
     * @private
     * @param  {layer.Query} query
     */

  }, {
    key: '_addQuery',
    value: function _addQuery(query) {
      this._queriesHash[query.id] = query;
    }

    /**
     * Deregister the layer.Query.
     *
     * @method _removeQuery
     * @private
     * @param  {layer.Query} query [description]
     */

  }, {
    key: '_removeQuery',
    value: function _removeQuery(query) {
      var _this9 = this;

      if (query) {
        delete this._queriesHash[query.id];
        if (!this._inCleanup) {
          var data = query.data.map(function (obj) {
            return _this9._getObject(obj.id);
          }).filter(function (obj) {
            return obj;
          });
          this._checkAndPurgeCache(data);
        }
        this.off(null, null, query);
      }
    }

    /**
     * Check to see if the specified objects can safely be removed from cache.
     *
     * Removes from cache if an object is not part of any Query's result set.
     *
     * @method _checkAndPurgeCache
     * @private
     * @param  {layer.Root[]} objects - Array of Messages or Conversations
     */

  }, {
    key: '_checkAndPurgeCache',
    value: function _checkAndPurgeCache(objects) {
      var _this10 = this;

      objects.forEach(function (obj) {
        if (!obj.isDestroyed && !_this10._isCachedObject(obj)) {
          if (obj instanceof Root === false) obj = _this10._getObject(obj.id);
          if (obj instanceof Conversation) return;
          if (obj) obj.destroy();
        }
      });
    }

    /**
     * Schedules _runScheduledCheckAndPurgeCache if needed, and adds this object
     * to the list of objects it will validate for uncaching.
     *
     * Note that any object that does not exist on the server (!isSaved()) is an object that the
     * app created and can only be purged by the app and not by the SDK.  Once its been
     * saved, and can be reloaded from the server when needed, its subject to standard caching.
     *
     * @method _scheduleCheckAndPurgeCache
     * @private
     * @param {layer.Root} object
     */

  }, {
    key: '_scheduleCheckAndPurgeCache',
    value: function _scheduleCheckAndPurgeCache(object) {
      var _this11 = this;

      if (object.isSaved()) {
        if (this._scheduleCheckAndPurgeCacheAt < Date.now()) {
          this._scheduleCheckAndPurgeCacheAt = Date.now() + Client.CACHE_PURGE_INTERVAL;
          setTimeout(function () {
            return _this11._runScheduledCheckAndPurgeCache();
          }, Client.CACHE_PURGE_INTERVAL);
        }
        this._scheduleCheckAndPurgeCacheItems.push(object);
      }
    }

    /**
     * Calls _checkAndPurgeCache on accumulated objects and resets its state.
     *
     * @method _runScheduledCheckAndPurgeCache
     * @private
     */

  }, {
    key: '_runScheduledCheckAndPurgeCache',
    value: function _runScheduledCheckAndPurgeCache() {
      var list = this._scheduleCheckAndPurgeCacheItems;
      this._scheduleCheckAndPurgeCacheItems = [];
      this._checkAndPurgeCache(list);
      this._scheduleCheckAndPurgeCacheAt = 0;
    }

    /**
     * Returns true if the specified object should continue to be part of the cache.
     *
     * Result is based on whether the object is part of the data for a Query.
     *
     * @method _isCachedObject
     * @private
     * @param  {layer.Root} obj - A Message or Conversation Instance
     * @return {Boolean}
     */

  }, {
    key: '_isCachedObject',
    value: function _isCachedObject(obj) {
      var list = Object.keys(this._queriesHash);
      for (var i = 0; i < list.length; i++) {
        var query = this._queriesHash[list[i]];
        if (query._getItem(obj.id)) return true;
      }
      return false;
    }

    /**
     * On restoring a connection, determine what steps need to be taken to update our data.
     *
     * A reset boolean property is passed; set based on  layer.ClientAuthenticator.ResetAfterOfflineDuration.
     *
     * Note it is possible for an application to have logic that causes queries to be created/destroyed
     * as a side-effect of layer.Query.reset destroying all data. So we must test to see if queries exist.
     *
     * @method _connectionRestored
     * @private
     * @param {boolean} reset - Should the session reset/reload all data or attempt to resume where it left off?
     */

  }, {
    key: '_connectionRestored',
    value: function _connectionRestored(evt) {
      var _this12 = this;

      if (evt.reset) {
        logger.debug('Client Connection Restored; Resetting all Queries');
        this.dbManager.deleteTables(function () {
          _this12.dbManager._open();
          Object.keys(_this12._queriesHash).forEach(function (id) {
            var query = _this12._queriesHash[id];
            if (query) query.reset();
          });
        });
      }
    }

    /**
     * Remove the specified object from cache
     *
     * @method _removeObject
     * @private
     * @param  {layer.Root}  obj - A Message or Conversation Instance
     */

  }, {
    key: '_removeObject',
    value: function _removeObject(obj) {
      if (obj) obj.destroy();
    }

    /**
     * Creates a layer.TypingIndicators.TypingListener instance
     * bound to the specified dom node.
     *
     *      var typingListener = client.createTypingListener(document.getElementById('myTextBox'));
     *      typingListener.setConversation(mySelectedConversation);
     *
     * Use this method to instantiate a listener, and call
     * layer.TypingIndicators.TypingListener.setConversation every time you want to change which Conversation
     * it reports your user is typing into.
     *
     * @method createTypingListener
     * @param  {HTMLElement} inputNode - Text input to watch for keystrokes
     * @return {layer.TypingIndicators.TypingListener}
     */

  }, {
    key: 'createTypingListener',
    value: function createTypingListener(inputNode) {
      var TypingListener = require('./typing-indicators/typing-listener');
      return new TypingListener({
        clientId: this.appId,
        input: inputNode
      });
    }

    /**
     * Creates a layer.TypingIndicators.TypingPublisher.
     *
     * The TypingPublisher lets you manage your Typing Indicators without using
     * the layer.TypingIndicators.TypingListener.
     *
     *      var typingPublisher = client.createTypingPublisher();
     *      typingPublisher.setConversation(mySelectedConversation);
     *      typingPublisher.setState(layer.TypingIndicators.STARTED);
     *
     * Use this method to instantiate a listener, and call
     * layer.TypingIndicators.TypingPublisher.setConversation every time you want to change which Conversation
     * it reports your user is typing into.
     *
     * Use layer.TypingIndicators.TypingPublisher.setState to inform other users of your current state.
     * Note that the `STARTED` state only lasts for 2.5 seconds, so you
     * must repeatedly call setState for as long as this state should continue.
     * This is typically done by simply calling it every time a user hits
     * a key.
     *
     * @method createTypingPublisher
     * @return {layer.TypingIndicators.TypingPublisher}
     */

  }, {
    key: 'createTypingPublisher',
    value: function createTypingPublisher() {
      var TypingPublisher = require('./typing-indicators/typing-publisher');
      return new TypingPublisher({
        clientId: this.appId
      });
    }

    /**
     * Get the current typing indicator state of a specified Conversation.
     *
     * Typically used to see if anyone is currently typing when first opening a Conversation.
     *
     * @method getTypingState
     * @param {String} conversationId
     */

  }, {
    key: 'getTypingState',
    value: function getTypingState(conversationId) {
      return this._typingIndicators.getState(conversationId);
    }

    /**
     * Accessor for getting a Client by appId.
     *
     * Most apps will only have one client,
     * and will not need this method.
     *
     * @method getClient
     * @static
     * @param  {string} appId
     * @return {layer.Client}
     */

  }], [{
    key: 'getClient',
    value: function getClient(appId) {
      return ClientRegistry.get(appId);
    }
  }, {
    key: 'destroyAllClients',
    value: function destroyAllClients() {
      ClientRegistry.getAll().forEach(function (client) {
        return client.destroy();
      });
    }

    /*
     * Registers a plugin which can add capabilities to the Client.
     *
     * Capabilities must be triggered by Events/Event Listeners.
     *
     * This concept is a bit premature and unused/untested...
     * As implemented, it provides for a plugin that will be
     * instantiated by the Client and passed the Client as its parameter.
     * This allows for a library of plugins that can be shared among
     * different companies/projects but that are outside of the core
     * app logic.
     *
     *      // Define the plugin
     *      function MyPlugin(client) {
     *          this.client = client;
     *          client.on('messages:add', this.onMessagesAdd, this);
     *      }
     *
     *      MyPlugin.prototype.onMessagesAdd = function(event) {
     *          var messages = event.messages;
     *          alert('You now have ' + messages.length  + ' messages');
     *      }
     *
     *      // Register the Plugin
     *      Client.registerPlugin('myPlugin34', MyPlugin);
     *
     *      var client = new Client({appId: 'layer:///apps/staging/uuid'});
     *
     *      // Trigger the plugin's behavior
     *      client.myPlugin34.addMessages({messages:[]});
     *
     * @method registerPlugin
     * @static
     * @param  {string} name     [description]
     * @param  {Function} classDef [description]
     */

  }, {
    key: 'registerPlugin',
    value: function registerPlugin(name, classDef) {
      Client.plugins[name] = classDef;
    }
  }]);

  return Client;
}(ClientAuth);

/**
 * Hash of layer.Conversation objects for quick lookup by id
 *
 * @private
 * @property {Object}
 */


Client.prototype._conversationsHash = null;

/**
 * Hash of layer.Message objects for quick lookup by id
 *
 * @private
 * @type {Object}
 */
Client.prototype._messagesHash = null;

/**
 * Hash of layer.Query objects for quick lookup by id
 *
 * @private
 * @type {Object}
 */
Client.prototype._queriesHash = null;

/**
 * Array of items to be checked to see if they can be uncached.
 *
 * @private
 * @type {layer.Root[]}
 */
Client.prototype._scheduleCheckAndPurgeCacheItems = null;

/**
 * Time that the next call to _runCheckAndPurgeCache() is scheduled for in ms since 1970.
 *
 * @private
 * @type {number}
 */
Client.prototype._scheduleCheckAndPurgeCacheAt = 0;

/**
 * Get the version of the Client library.
 *
 * @static
 * @type {String}
 */
Client.version = '3.0.0';

/**
 * Any Conversation or Message that is part of a Query's results are kept in memory for as long as it
 * remains in that Query.  However, when a websocket event delivers new Messages and Conversations that
 * are NOT part of a Query, how long should they stick around in memory?  Why have them stick around?
 * Perhaps an app wants to post a notification of a new Message or Conversation... and wants to keep
 * the object local for a little while.  Default is 10 minutes before checking to see if
 * the object is part of a Query or can be uncached.  Value is in miliseconds.
 * @static
 * @type {number}
 */
Client.CACHE_PURGE_INTERVAL = 10 * 60 * 1000;

Client._ignoredEvents = ['conversations:loaded', 'conversations:loaded-error'];

Client._supportedEvents = [

/**
 * One or more layer.Conversation objects have been added to the client.
 *
 * They may have been added via the websocket, or via the user creating
 * a new Conversation locally.
 *
 *      client.on('conversations:add', function(evt) {
 *          evt.conversations.forEach(function(conversation) {
 *              myView.addConversation(conversation);
 *          });
 *      });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Conversation[]} evt.conversations - Array of conversations added
 */
'conversations:add',

/**
 * One or more layer.Conversation objects have been removed.
 *
 * A removed Conversation is not necessarily deleted, its just
 * no longer being held in local memory.
 *
 * Note that typically you will want the conversations:delete event
 * rather than conversations:remove.
 *
 *      client.on('conversations:remove', function(evt) {
 *          evt.conversations.forEach(function(conversation) {
 *              myView.removeConversation(conversation);
 *          });
 *      });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Conversation[]} evt.conversations - Array of conversations removed
 */
'conversations:remove',

/**
 * The conversation is now on the server.
 *
 * Called after creating the conversation
 * on the server.  The Result property is one of:
 *
 * * layer.Conversation.CREATED: A new Conversation has been created
 * * layer.Conversation.FOUND: A matching Distinct Conversation has been found
 * * layer.Conversation.FOUND_WITHOUT_REQUESTED_METADATA: A matching Distinct Conversation has been found
 *                       but note that the metadata is NOT what you requested.
 *
 * All of these results will also mean that the updated property values have been
 * copied into your Conversation object.  That means your metadata property may no
 * longer be its initial value; it will be the value found on the server.
 *
 *      client.on('conversations:sent', function(evt) {
 *          switch(evt.result) {
 *              case Conversation.CREATED:
 *                  alert(evt.target.id + ' Created!');
 *                  break;
 *              case Conversation.FOUND:
 *                  alert(evt.target.id + ' Found!');
 *                  break;
 *              case Conversation.FOUND_WITHOUT_REQUESTED_METADATA:
 *                  alert(evt.target.id + ' Found, but does not have the requested metadata!');
 *                  break;
 *          }
 *      });
 *
 * @event
 * @param {layer.LayerEvent} event
 * @param {string} event.result
 * @param {layer.Conversation} target
 */
'conversations:sent',

/**
 * A conversation failed to load or create on the server.
 *
 *      client.on('conversations:sent-error', function(evt) {
 *          alert(evt.data.message);
 *      });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.LayerError} evt.data
 * @param {layer.Conversation} target
 */
'conversations:sent-error',

/**
 * A conversation had a change in its properties.
 *
 * This change may have been delivered from a remote user
 * or as a result of a local operation.
 *
 *      client.on('conversations:change', function(evt) {
 *          var metadataChanges = evt.getChangesFor('metadata');
 *          var participantChanges = evt.getChangesFor('participants');
 *          if (metadataChanges.length) {
 *              myView.renderTitle(evt.target.metadata.title);
 *          }
 *          if (participantChanges.length) {
 *              myView.renderParticipants(evt.target.participants);
 *          }
 *      });
 *
 * NOTE: Typically such rendering is done using Events on layer.Query.
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Conversation} evt.target
 * @param {Object[]} evt.changes
 * @param {Mixed} evt.changes.newValue
 * @param {Mixed} evt.changes.oldValue
 * @param {string} evt.changes.property - Name of the property that has changed
 */
'conversations:change',

/**
 * A call to layer.Conversation.load has completed successfully
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Conversation} evt.target
 */
'conversations:loaded',

/**
 * A new message has been received for which a notification may be suitable.
 *
 * This event is triggered for messages that are:
 *
 * 1. Added via websocket rather than other IO
 * 2. Not yet been marked as read
 * 3. Not sent by this user
 *
        client.on('messages:notify', function(evt) {
            myNotify(evt.message);
        })
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Message} evt.Message
 */
'messages:notify',

/**
 * Messages have been added to a conversation.
 *
 * May also fire when new Announcements are received.
 *
 * This event is triggered on
 *
 * * creating/sending a new message
 * * Receiving a new layer.Message or layer.Announcement via websocket
 * * Querying/downloading a set of Messages
 *
        client.on('messages:add', function(evt) {
            evt.messages.forEach(function(message) {
                myView.addMessage(message);
            });
        });
 *
 * NOTE: Such rendering would typically be done using events on layer.Query.
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Message[]} evt.messages
 */
'messages:add',

/**
 * A message has been removed from a conversation.
 *
 * A removed Message is not necessarily deleted,
 * just no longer being held in memory.
 *
 * Note that typically you will want the messages:delete event
 * rather than messages:remove.
 *
 *      client.on('messages:remove', function(evt) {
 *          evt.messages.forEach(function(message) {
 *              myView.removeMessage(message);
 *          });
 *      });
 *
 * NOTE: Such rendering would typically be done using events on layer.Query.
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Message} evt.message
 */
'messages:remove',

/**
 * A message has been sent.
 *
 *      client.on('messages:sent', function(evt) {
 *          alert(evt.target.getText() + ' has been sent');
 *      });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Message} evt.target
 */
'messages:sent',

/**
 * A message is about to be sent.
 *
 * Useful if you want to
 * add parts to the message before it goes out.
 *
 *      client.on('messages:sending', function(evt) {
 *          evt.target.addPart({
 *              mimeType: 'text/plain',
 *              body: 'this is just a test'
 *          });
 *      });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Message} evt.target
 */
'messages:sending',

/**
 * Server failed to receive a Message.
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.LayerError} evt.error
 */
'messages:sent-error',

/**
 * A message has had a change in its properties.
 *
 * This change may have been delivered from a remote user
 * or as a result of a local operation.
 *
 *      client.on('messages:change', function(evt) {
 *          var recpientStatusChanges = evt.getChangesFor('recipientStatus');
 *          if (recpientStatusChanges.length) {
 *              myView.renderStatus(evt.target);
 *          }
 *      });
 *
 * NOTE: Such rendering would typically be done using events on layer.Query.
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Message} evt.target
 * @param {Object[]} evt.changes
 * @param {Mixed} evt.changes.newValue
 * @param {Mixed} evt.changes.oldValue
 * @param {string} evt.changes.property - Name of the property that has changed
 */
'messages:change',

/**
 * A call to layer.Message.load has completed successfully
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Message} evt.target
 */
'messages:loaded',

/**
 * A Conversation has been deleted from the server.
 *
 * Caused by either a successful call to layer.Conversation.delete() on the Conversation
 * or by a remote user.
 *
 *      client.on('conversations:delete', function(evt) {
 *          myView.removeConversation(evt.target);
 *      });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Conversation} evt.target
 */
'conversations:delete',

/**
 * A Message has been deleted from the server.
 *
 * Caused by either a successful call to layer.Message.delete() on the Message
 * or by a remote user.
 *
 *      client.on('messages:delete', function(evt) {
 *          myView.removeMessage(evt.target);
 *      });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Message} evt.target
 */
'messages:delete',

/**
 * A call to layer.Identity.load has completed successfully
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Message} evt.target
 */
'identities:loaded',

/**
 * An Identity has had a change in its properties.
 *
 * Changes occur when new data arrives from the server.
 *
 *      client.on('identities:change', function(evt) {
 *          var displayNameChanges = evt.getChangesFor('displayName');
 *          if (displayNameChanges.length) {
 *              myView.renderStatus(evt.target);
 *          }
 *      });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Message} evt.target
 * @param {Object[]} evt.changes
 * @param {Mixed} evt.changes.newValue
 * @param {Mixed} evt.changes.oldValue
 * @param {string} evt.changes.property - Name of the property that has changed
 */
'identities:change',

/**
 * Identities have been added to the Client.
 *
 * This event is triggered whenever a new layer.Identity (Full identity or not)
 * has been received by the Client.
 *
        client.on('identities:add', function(evt) {
            evt.identities.forEach(function(identity) {
                myView.addIdentity(identity);
            });
        });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Identity[]} evt.identities
 */
'identities:add',

/**
 * Identities have been removed from the Client.
 *
 * This does not typically occur.
 *
        client.on('identities:remove', function(evt) {
            evt.identities.forEach(function(identity) {
                myView.addIdentity(identity);
            });
        });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Identity[]} evt.identities
 */
'identities:remove',

/**
 * An Identity has been unfollowed or deleted.
 *
 * We do not delete such Identities entirely from the Client as
 * there are still Messages from these Identities to be rendered,
 * but we do downgrade them from Full Identity to Basic Identity.
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.Identity} evt.target
 */
'identities:unfollow',

/**
 * A Typing Indicator state has changed.
 *
 * Either a change has been received
 * from the server, or a typing indicator state has expired.
 *
 *      client.on('typing-indicator-change', function(evt) {
 *          if (evt.conversationId === myConversationId) {
 *              alert(evt.typing.join(', ') + ' are typing');
 *              alert(evt.paused.join(', ') + ' are paused');
 *          }
 *      });
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {string} conversationId - ID of the Conversation users are typing into
 * @param {string[]} typing - Array of user IDs who are currently typing
 * @param {string[]} paused - Array of user IDs who are currently paused;
 *                            A paused user still has text in their text box.
 */
'typing-indicator-change'].concat(ClientAuth._supportedEvents);

Client.plugins = {};

Root.initClass.apply(Client, [Client, 'Client']);
module.exports = Client;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGllbnQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQStFQSxJQUFNLGFBQWEsUUFBUSx3QkFBUixDQUFuQjtBQUNBLElBQU0sZUFBZSxRQUFRLGdCQUFSLENBQXJCO0FBQ0EsSUFBTSxRQUFRLFFBQVEsU0FBUixDQUFkO0FBQ0EsSUFBTSxrQkFBa0IsUUFBUSxlQUFSLEVBQXlCLFVBQWpEO0FBQ0EsSUFBTSxXQUFXLFFBQVEsWUFBUixDQUFqQjtBQUNBLElBQU0sVUFBVSxRQUFRLFdBQVIsQ0FBaEI7QUFDQSxJQUFNLGVBQWUsUUFBUSxnQkFBUixDQUFyQjtBQUNBLElBQU0sV0FBVyxRQUFRLFlBQVIsQ0FBakI7QUFDQSxJQUFNLDBCQUEwQixRQUFRLCtDQUFSLENBQWhDO0FBQ0EsSUFBTSxPQUFPLFFBQVEsZ0JBQVIsQ0FBYjtBQUNBLElBQU0sT0FBTyxRQUFRLFFBQVIsQ0FBYjtBQUNBLElBQU0saUJBQWlCLFFBQVEsbUJBQVIsQ0FBdkI7QUFDQSxJQUFNLFNBQVMsUUFBUSxVQUFSLENBQWY7O0lBRU0sTTs7O0FBRUo7Ozs7QUFJQSxrQkFBWSxPQUFaLEVBQXFCO0FBQUE7O0FBQUEsMEZBQ2IsT0FEYTs7QUFFbkIsbUJBQWUsUUFBZjs7QUFFQTtBQUNBLFVBQUssa0JBQUwsR0FBMEIsRUFBMUI7QUFDQSxVQUFLLGFBQUwsR0FBcUIsRUFBckI7QUFDQSxVQUFLLFlBQUwsR0FBb0IsRUFBcEI7QUFDQSxVQUFLLGVBQUwsR0FBdUIsRUFBdkI7QUFDQSxVQUFLLGdDQUFMLEdBQXdDLEVBQXhDOztBQUVBLFVBQUssZUFBTDs7QUFFQSxVQUFLLEVBQUwsQ0FBUSxRQUFSLEVBQWtCLE1BQUssbUJBQUwsQ0FBeUIsSUFBekIsT0FBbEI7O0FBRUEsV0FBTyxJQUFQLENB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UXdCOztBQXVReEI7Ozs7Ozs7QUFPQSxpQkE5UXdCOztBQWdSeEI7Ozs7Ozs7Ozs7Ozs7O0FBY0Esc0JBOVJ3Qjs7QUFnU3hCOzs7Ozs7Ozs7Ozs7OztBQWNBLGlCQTlTd0I7O0FBZ1R4Qjs7Ozs7OztBQU9BLG1CQXZUd0I7O0FBeVR4Qjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFvQkEsbUJBN1V3Qjs7QUErVXhCOzs7Ozs7Ozs7Ozs7Ozs7O0FBZ0JBLGdCQS9Wd0I7O0FBaVd4Qjs7Ozs7Ozs7Ozs7Ozs7O0FBZUEsbUJBaFh3Qjs7QUFrWHhCOzs7Ozs7Ozs7O0FBVUEscUJBNVh3Qjs7QUErWHhCOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQW9CQSx5QkFuWndCLEVBc1p4QixNQXRad0IsQ0FzWmpCLFdBQVcsZ0JBdFpNLENBQTFCOztBQXdaQSxPQUFPLE9BQVAsR0FBaUIsRUFBakI7O0FBRUEsS0FBSyxTQUFMLENBQWUsS0FBZixDQUFxQixNQUFyQixFQUE2QixDQUFDLE1BQUQsRUFBUyxRQUFULENBQTdCO0FBQ0EsT0FBTyxPQUFQLEdBQWlCLE1BQWpCIiwiZmlsZSI6ImNsaWVudC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVGhlIExheWVyIENsaWVudDsgdGhpcyBpcyB0aGUgdG9wIGxldmVsIGNvbXBvbmVudCBmb3IgYW55IExheWVyIGJhc2VkIGFwcGxpY2F0aW9uLlxuXG4gICAgdmFyIGNsaWVudCA9IG5ldyBsYXllci5DbGllbnQoe1xuICAgICAgYXBwSWQ6ICdsYXllcjovLy9hcHBzL3N0YWdpbmcvZmZmZmZmZmYtZmZmZi1mZmZmLWZmZmYtZmZmZmZmZmZmZmZmJyxcbiAgICAgIGNoYWxsZW5nZTogZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgIG15QXV0aGVudGljYXRvcih7XG4gICAgICAgICAgbm9uY2U6IGV2dC5ub25jZSxcbiAgICAgICAgICBvblN1Y2Nlc3M6IGV2dC5jYWxsYmFja1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgICByZWFkeTogZnVuY3Rpb24oY2xpZW50KSB7XG4gICAgICAgIGFsZXJ0KCdJIGFtIENsaWVudDsgU2VydmVyOiBTZXJ2ZSBtZSEnKTtcbiAgICAgIH1cbiAgICB9KS5jb25uZWN0KCdGcmVkJylcbiAqXG4gKiBZb3UgY2FuIGFsc28gaW5pdGlhbGl6ZSB0aGlzIGFzXG5cbiAgICB2YXIgY2xpZW50ID0gbmV3IGxheWVyLkNsaWVudCh7XG4gICAgICBhcHBJZDogJ2xheWVyOi8vL2FwcHMvc3RhZ2luZy9mZmZmZmZmZi1mZmZmLWZmZmYtZmZmZi1mZmZmZmZmZmZmZmYnXG4gICAgfSk7XG5cbiAgICBjbGllbnQub24oJ2NoYWxsZW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgbXlBdXRoZW50aWNhdG9yKHtcbiAgICAgICAgbm9uY2U6IGV2dC5ub25jZSxcbiAgICAgICAgb25TdWNjZXNzOiBldnQuY2FsbGJhY2tcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgY2xpZW50Lm9uKCdyZWFkeScsIGZ1bmN0aW9uKGNsaWVudCkge1xuICAgICAgYWxlcnQoJ0kgYW0gQ2xpZW50OyBTZXJ2ZXI6IFNlcnZlIG1lIScpO1xuICAgIH0pO1xuXG4gICAgY2xpZW50LmNvbm5lY3QoJ0ZyZWQnKTtcbiAqXG4gKiAjIyBBUEkgU3lub3BzaXM6XG4gKlxuICogVGhlIGZvbGxvd2luZyBQcm9wZXJ0aWVzLCBNZXRob2RzIGFuZCBFdmVudHMgYXJlIHRoZSBtb3N0IGNvbW1vbmx5IHVzZWQgb25lcy4gIFNlZSB0aGUgZnVsbCBBUEkgYmVsb3dcbiAqIGZvciB0aGUgcmVzdCBvZiB0aGUgQVBJLlxuICpcbiAqICMjIyBQcm9wZXJ0aWVzOlxuICpcbiAqICogbGF5ZXIuQ2xpZW50LnVzZXJJZDogVXNlciBJRCBvZiB0aGUgYXV0aGVudGljYXRlZCB1c2VyXG4gKiAqIGxheWVyLkNsaWVudC5hcHBJZDogVGhlIElEIGZvciB5b3VyIGFwcGxpY2F0aW9uXG4gKlxuICpcbiAqICMjIyBNZXRob2RzOlxuICpcbiAqICogbGF5ZXIuQ2xpZW50LmNyZWF0ZUNvbnZlcnNhdGlvbigpOiBDcmVhdGUgYSBuZXcgbGF5ZXIuQ29udmVyc2F0aW9uLlxuICogKiBsYXllci5DbGllbnQuY3JlYXRlUXVlcnkoKTogQ3JlYXRlIGEgbmV3IGxheWVyLlF1ZXJ5LlxuICogKiBsYXllci5DbGllbnQuZ2V0TWVzc2FnZSgpOiBJbnB1dCBhIE1lc3NhZ2UgSUQsIGFuZCBvdXRwdXQgYSBsYXllci5NZXNzYWdlIG9yIGxheWVyLkFubm91bmNlbWVudCBmcm9tIGNhY2hlLlxuICogKiBsYXllci5DbGllbnQuZ2V0Q29udmVyc2F0aW9uKCk6IElucHV0IGEgQ29udmVyc2F0aW9uIElELCBhbmQgb3V0cHV0IGEgbGF5ZXIuQ29udmVyc2F0aW9uIGZyb20gY2FjaGUuXG4gKiAqIGxheWVyLkNsaWVudC5vbigpIGFuZCBsYXllci5Db252ZXJzYXRpb24ub2ZmKCk6IGV2ZW50IGxpc3RlbmVyc1xuICogKiBsYXllci5DbGllbnQuZGVzdHJveSgpOiBDbGVhbnVwIGFsbCByZXNvdXJjZXMgdXNlZCBieSB0aGlzIGNsaWVudCwgaW5jbHVkaW5nIGFsbCBNZXNzYWdlcyBhbmQgQ29udmVyc2F0aW9ucy5cbiAqXG4gKiAjIyMgRXZlbnRzOlxuICpcbiAqICogYGNoYWxsZW5nZWA6IFByb3ZpZGVzIGEgbm9uY2UgYW5kIGEgY2FsbGJhY2s7IHlvdSBjYWxsIHRoZSBjYWxsYmFjayBvbmNlIHlvdSBoYXZlIGFuIElkZW50aXR5IFRva2VuLlxuICogKiBgcmVhZHlgOiBZb3VyIGFwcGxpY2F0aW9uIGNhbiBub3cgc3RhcnQgdXNpbmcgdGhlIExheWVyIHNlcnZpY2VzXG4gKiAqIGBtZXNzYWdlczpub3RpZnlgOiBVc2VkIHRvIG5vdGlmeSB5b3VyIGFwcGxpY2F0aW9uIG9mIG5ldyBtZXNzYWdlcyBmb3Igd2hpY2ggYSBsb2NhbCBub3RpZmljYXRpb24gbWF5IGJlIHN1aXRhYmxlLlxuICpcbiAqICMjIExvZ2dpbmc6XG4gKlxuICogVGhlcmUgYXJlIHR3byB3YXlzIHRvIGNoYW5nZSB0aGUgbG9nIGxldmVsIGZvciBMYXllcidzIGxvZ2dlcjpcbiAqXG4gKiAgICAgbGF5ZXIuQ2xpZW50LnByb3RvdHlwZS5sb2dMZXZlbCA9IGxheWVyLkNvbnN0YW50cy5MT0cuSU5GTztcbiAqXG4gKiBvclxuICpcbiAqICAgICB2YXIgY2xpZW50ID0gbmV3IGxheWVyLkNsaWVudCh7XG4gKiAgICAgICAgYXBwSWQ6ICdsYXllcjovLy9hcHBzL3N0YWdpbmcvZmZmZmZmZmYtZmZmZi1mZmZmLWZmZmYtZmZmZmZmZmZmZmZmJyxcbiAqICAgICAgICBsb2dMZXZlbDogbGF5ZXIuQ29uc3RhbnRzLkxPRy5JTkZPXG4gKiAgICAgfSk7XG4gKlxuICogQGNsYXNzICBsYXllci5DbGllbnRcbiAqIEBleHRlbmRzIGxheWVyLkNsaWVudEF1dGhlbnRpY2F0b3JcbiAqXG4gKi9cblxuY29uc3QgQ2xpZW50QXV0aCA9IHJlcXVpcmUoJy4vY2xpZW50LWF1dGhlbnRpY2F0b3InKTtcbmNvbnN0IENvbnZlcnNhdGlvbiA9IHJlcXVpcmUoJy4vY29udmVyc2F0aW9uJyk7XG5jb25zdCBRdWVyeSA9IHJlcXVpcmUoJy4vcXVlcnknKTtcbmNvbnN0IEVycm9yRGljdGlvbmFyeSA9IHJlcXVpcmUoJy4vbGF5ZXItZXJyb3InKS5kaWN0aW9uYXJ5O1xuY29uc3QgU3luY2FibGUgPSByZXF1aXJlKCcuL3N5bmNhYmxlJyk7XG5jb25zdCBNZXNzYWdlID0gcmVxdWlyZSgnLi9tZXNzYWdlJyk7XG5jb25zdCBBbm5vdW5jZW1lbnQgPSByZXF1aXJlKCcuL2Fubm91bmNlbWVudCcpO1xuY29uc3QgSWRlbnRpdHkgPSByZXF1aXJlKCcuL2lkZW50aXR5Jyk7XG5jb25zdCBUeXBpbmdJbmRpY2F0b3JMaXN0ZW5lciA9IHJlcXVpcmUoJy4vdHlwaW5nLWluZGljYXRvcnMvdHlwaW5nLWluZGljYXRvci1saXN0ZW5lcicpO1xuY29uc3QgVXRpbCA9IHJlcXVpcmUoJy4vY2xpZW50LXV0aWxzJyk7XG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi9yb290Jyk7XG5jb25zdCBDbGllbnRSZWdpc3RyeSA9IHJlcXVpcmUoJy4vY2xpZW50LXJlZ2lzdHJ5Jyk7XG5jb25zdCBsb2dnZXIgPSByZXF1aXJlKCcuL2xvZ2dlcicpO1xuXG5jbGFzcyBDbGllbnQgZXh0ZW5kcyBDbGllbnRBdXRoIHtcblxuICAvKlxuICAgKiBBZGRzIGNvbnZlcnNhdGlvbnMsIG1lc3NhZ2VzIGFuZCB3ZWJzb2NrZXRzIG9uIHRvcCBvZiB0aGUgYXV0aGVudGljYXRpb24gY2xpZW50LlxuICAgKiBqc2RvY3Mgb24gcGFyZW50IGNsYXNzIGNvbnN0cnVjdG9yLlxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIENsaWVudFJlZ2lzdHJ5LnJlZ2lzdGVyKHRoaXMpO1xuXG4gICAgLy8gSW5pdGlhbGl6ZSBQcm9wZXJ0aWVzXG4gICAgdGhpcy5fY29udmVyc2F0aW9uc0hhc2ggPSB7fTtcbiAgICB0aGlzLl9tZXNzYWdlc0hhc2ggPSB7fTtcbiAgICB0aGlzLl9xdWVyaWVzSGFzaCA9IHt9O1xuICAgIHRoaXMuX2lkZW50aXRpZXNIYXNoID0ge307XG4gICAgdGhpcy5fc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGVJdGVtcyA9IFtdO1xuXG4gICAgdGhpcy5faW5pdENvbXBvbmVudHMoKTtcblxuICAgIHRoaXMub24oJ29ubGluZScsIHRoaXMuX2Nvbm5lY3Rpb25SZXN0b3JlZC5iaW5kKHRoaXMpKTtcblxuICAgIGxvZ2dlci5pbmZvKFV0aWwuYXNjaWlJbml0KENsaWVudC52ZXJzaW9uKSk7XG4gIH1cblxuICAvKiBTZWUgcGFyZW50IG1ldGhvZCBkb2NzICovXG4gIF9pbml0Q29tcG9uZW50cygpIHtcbiAgICBzdXBlci5faW5pdENvbXBvbmVudHMoKTtcblxuICAgIHRoaXMuX3R5cGluZ0luZGljYXRvcnMgPSBuZXcgVHlwaW5nSW5kaWNhdG9yTGlzdGVuZXIoe1xuICAgICAgY2xpZW50SWQ6IHRoaXMuYXBwSWQsXG4gICAgfSk7XG5cbiAgICAvLyBJbnN0YW50aWF0ZSBQbHVnaW5zXG4gICAgT2JqZWN0LmtleXMoQ2xpZW50LnBsdWdpbnMpLmZvckVhY2gocHJvcGVydHlOYW1lID0+IHtcbiAgICAgIHRoaXNbcHJvcGVydHlOYW1lXSA9IG5ldyBDbGllbnQucGx1Z2luc1twcm9wZXJ0eU5hbWVdKHRoaXMpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENsZWFudXAgYWxsIHJlc291cmNlcyAoQ29udmVyc2F0aW9ucywgTWVzc2FnZXMsIGV0Yy4uLikgcHJpb3IgdG8gZGVzdHJveSBvciByZWF1dGhlbnRpY2F0aW9uLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jbGVhbnVwXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfY2xlYW51cCgpIHtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCkgcmV0dXJuO1xuICAgIHRoaXMuX2luQ2xlYW51cCA9IHRydWU7XG5cbiAgICBPYmplY3Qua2V5cyh0aGlzLl9jb252ZXJzYXRpb25zSGFzaCkuZm9yRWFjaChpZCA9PiB7XG4gICAgICBjb25zdCBjID0gdGhpcy5fY29udmVyc2F0aW9uc0hhc2hbaWRdO1xuICAgICAgaWYgKGMgJiYgIWMuaXNEZXN0cm95ZWQpIHtcbiAgICAgICAgYy5kZXN0cm95KCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5fY29udmVyc2F0aW9uc0hhc2ggPSBudWxsO1xuXG4gICAgT2JqZWN0LmtleXModGhpcy5fbWVzc2FnZXNIYXNoKS5mb3JFYWNoKGlkID0+IHtcbiAgICAgIGNvbnN0IG0gPSB0aGlzLl9tZXNzYWdlc0hhc2hbaWRdO1xuICAgICAgaWYgKG0gJiYgIW0uaXNEZXN0cm95ZWQpIHtcbiAgICAgICAgbS5kZXN0cm95KCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5fbWVzc2FnZXNIYXNoID0gbnVsbDtcblxuICAgIE9iamVjdC5rZXlzKHRoaXMuX3F1ZXJpZXNIYXNoKS5mb3JFYWNoKGlkID0+IHtcbiAgICAgIHRoaXMuX3F1ZXJpZXNIYXNoW2lkXS5kZXN0cm95KCk7XG4gICAgfSk7XG4gICAgdGhpcy5fcXVlcmllc0hhc2ggPSBudWxsO1xuXG4gICAgT2JqZWN0LmtleXModGhpcy5faWRlbnRpdGllc0hhc2gpLmZvckVhY2goKGlkKSA9PiB7XG4gICAgICBjb25zdCBpZGVudGl0eSA9IHRoaXMuX2lkZW50aXRpZXNIYXNoW2lkXTtcbiAgICAgIGlmIChpZGVudGl0eSAmJiAhaWRlbnRpdHkuaXNEZXN0cm95ZWQpIHtcbiAgICAgICAgaWRlbnRpdHkuZGVzdHJveSgpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuX2lkZW50aXRpZXNIYXNoID0gbnVsbDtcblxuICAgIGlmICh0aGlzLnNvY2tldE1hbmFnZXIpIHRoaXMuc29ja2V0TWFuYWdlci5jbG9zZSgpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICAvLyBDbGVhbnVwIGFsbCBwbHVnaW5zXG4gICAgT2JqZWN0LmtleXMoQ2xpZW50LnBsdWdpbnMpLmZvckVhY2gocHJvcGVydHlOYW1lID0+IHtcbiAgICAgIGlmICh0aGlzW3Byb3BlcnR5TmFtZV0pIHtcbiAgICAgICAgdGhpc1twcm9wZXJ0eU5hbWVdLmRlc3Ryb3koKTtcbiAgICAgICAgZGVsZXRlIHRoaXNbcHJvcGVydHlOYW1lXTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIENsZWFudXAgYWxsIHJlc291cmNlcyAoQ29udmVyc2F0aW9ucywgTWVzc2FnZXMsIGV0Yy4uLilcbiAgICB0aGlzLl9jbGVhbnVwKCk7XG5cbiAgICB0aGlzLl9kZXN0cm95Q29tcG9uZW50cygpO1xuXG4gICAgQ2xpZW50UmVnaXN0cnkudW5yZWdpc3Rlcih0aGlzKTtcblxuICAgIHN1cGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLl9pbkNsZWFudXAgPSBmYWxzZTtcbiAgfVxuXG4gIF9fYWRqdXN0QXBwSWQoKSB7XG4gICAgaWYgKHRoaXMuYXBwSWQpIHRocm93IG5ldyBFcnJvcihFcnJvckRpY3Rpb25hcnkuYXBwSWRJbW11dGFibGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIGEgY29udmVyc2F0aW9uIGJ5IElkZW50aWZpZXIuXG4gICAqXG4gICAqICAgICAgdmFyIGMgPSBjbGllbnQuZ2V0Q29udmVyc2F0aW9uKCdsYXllcjovLy9jb252ZXJzYXRpb25zL3V1aWQnKTtcbiAgICpcbiAgICogSWYgdGhlcmUgaXMgbm90IGEgY29udmVyc2F0aW9uIHdpdGggdGhhdCBpZCwgaXQgd2lsbCByZXR1cm4gbnVsbC5cbiAgICpcbiAgICogSWYgeW91IHdhbnQgaXQgdG8gbG9hZCBpdCBmcm9tIGNhY2hlIGFuZCB0aGVuIGZyb20gc2VydmVyIGlmIG5vdCBpbiBjYWNoZSwgdXNlIHRoZSBgY2FuTG9hZGAgcGFyYW1ldGVyLlxuICAgKiBJZiBsb2FkaW5nIGZyb20gdGhlIHNlcnZlciwgdGhlIG1ldGhvZCB3aWxsIHJldHVyblxuICAgKiBhIGxheWVyLkNvbnZlcnNhdGlvbiBpbnN0YW5jZSB0aGF0IGhhcyBubyBkYXRhOyB0aGUgYGNvbnZlcnNhdGlvbnM6bG9hZGVkYCAvIGBjb252ZXJzYXRpb25zOmxvYWRlZC1lcnJvcmAgZXZlbnRzXG4gICAqIHdpbGwgbGV0IHlvdSBrbm93IHdoZW4gdGhlIGNvbnZlcnNhdGlvbiBoYXMgZmluaXNoZWQvZmFpbGVkIGxvYWRpbmcgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiAgICAgIHZhciBjID0gY2xpZW50LmdldENvbnZlcnNhdGlvbignbGF5ZXI6Ly8vY29udmVyc2F0aW9ucy8xMjMnLCB0cnVlKVxuICAgKiAgICAgIC5vbignY29udmVyc2F0aW9uczpsb2FkZWQnLCBmdW5jdGlvbigpIHtcbiAgICogICAgICAgICAgLy8gUmVuZGVyIHRoZSBDb252ZXJzYXRpb24gd2l0aCBhbGwgb2YgaXRzIGRldGFpbHMgbG9hZGVkXG4gICAqICAgICAgICAgIG15cmVyZW5kZXIoYyk7XG4gICAqICAgICAgfSk7XG4gICAqICAgICAgLy8gUmVuZGVyIGEgcGxhY2Vob2xkZXIgZm9yIGMgdW50aWwgdGhlIGRldGFpbHMgb2YgYyBoYXZlIGxvYWRlZFxuICAgKiAgICAgIG15cmVuZGVyKGMpO1xuICAgKlxuICAgKiBOb3RlIGluIHRoZSBhYm92ZSBleGFtcGxlIHRoYXQgdGhlIGBjb252ZXJzYXRpb25zOmxvYWRlZGAgZXZlbnQgd2lsbCB0cmlnZ2VyIGV2ZW4gaWYgdGhlIENvbnZlcnNhdGlvbiBoYXMgcHJldmlvdXNseSBsb2FkZWQuXG4gICAqXG4gICAqIEBtZXRob2QgZ2V0Q29udmVyc2F0aW9uXG4gICAqIEBwYXJhbSAge3N0cmluZ30gaWRcbiAgICogQHBhcmFtICB7Ym9vbGVhbn0gW2NhbkxvYWQ9ZmFsc2VdIC0gUGFzcyB0cnVlIHRvIGFsbG93IGxvYWRpbmcgYSBjb252ZXJzYXRpb24gZnJvbVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoZSBzZXJ2ZXIgaWYgbm90IGZvdW5kXG4gICAqIEByZXR1cm4ge2xheWVyLkNvbnZlcnNhdGlvbn1cbiAgICovXG4gIGdldENvbnZlcnNhdGlvbihpZCwgY2FuTG9hZCkge1xuICAgIGlmICh0eXBlb2YgaWQgIT09ICdzdHJpbmcnKSB0aHJvdyBuZXcgRXJyb3IoRXJyb3JEaWN0aW9uYXJ5LmlkUGFyYW1SZXF1aXJlZCk7XG4gICAgaWYgKHRoaXMuX2NvbnZlcnNhdGlvbnNIYXNoW2lkXSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NvbnZlcnNhdGlvbnNIYXNoW2lkXTtcbiAgICB9IGVsc2UgaWYgKGNhbkxvYWQpIHtcbiAgICAgIHJldHVybiBDb252ZXJzYXRpb24ubG9hZChpZCwgdGhpcyk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgYSBjb252ZXJzYXRpb24gdG8gdGhlIGNsaWVudC5cbiAgICpcbiAgICogVHlwaWNhbGx5LCB5b3UgZG8gbm90IG5lZWQgdG8gY2FsbCB0aGlzOyB0aGUgZm9sbG93aW5nIGNvZGVcbiAgICogYXV0b21hdGljYWxseSBjYWxscyBfYWRkQ29udmVyc2F0aW9uIGZvciB5b3U6XG4gICAqXG4gICAqICAgICAgdmFyIGNvbnYgPSBuZXcgbGF5ZXIuQ29udmVyc2F0aW9uKHtcbiAgICogICAgICAgICAgY2xpZW50OiBjbGllbnQsXG4gICAqICAgICAgICAgIHBhcnRpY2lwYW50czogWydhJywgJ2InXVxuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiAgICAgIC8vIE9SOlxuICAgKiAgICAgIHZhciBjb252ID0gY2xpZW50LmNyZWF0ZUNvbnZlcnNhdGlvbihbJ2EnLCAnYiddKTtcbiAgICpcbiAgICogQG1ldGhvZCBfYWRkQ29udmVyc2F0aW9uXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtICB7bGF5ZXIuQ29udmVyc2F0aW9ufSBjXG4gICAqL1xuICBfYWRkQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbikge1xuICAgIGNvbnN0IGlkID0gY29udmVyc2F0aW9uLmlkO1xuICAgIGlmICghdGhpcy5fY29udmVyc2F0aW9uc0hhc2hbaWRdKSB7XG4gICAgICAvLyBSZWdpc3RlciB0aGUgQ29udmVyc2F0aW9uXG4gICAgICB0aGlzLl9jb252ZXJzYXRpb25zSGFzaFtpZF0gPSBjb252ZXJzYXRpb247XG5cbiAgICAgIC8vIE1ha2Ugc3VyZSB0aGUgY2xpZW50IGlzIHNldCBzbyB0aGF0IHRoZSBuZXh0IGV2ZW50IGJ1YmJsZXMgdXBcbiAgICAgIGlmIChjb252ZXJzYXRpb24uY2xpZW50SWQgIT09IHRoaXMuYXBwSWQpIGNvbnZlcnNhdGlvbi5jbGllbnRJZCA9IHRoaXMuYXBwSWQ7XG4gICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2NvbnZlcnNhdGlvbnM6YWRkJywgeyBjb252ZXJzYXRpb25zOiBbY29udmVyc2F0aW9uXSB9KTtcblxuICAgICAgdGhpcy5fc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGUoY29udmVyc2F0aW9uKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcyBhIGNvbnZlcnNhdGlvbiBmcm9tIHRoZSBjbGllbnQuXG4gICAqXG4gICAqIFR5cGljYWxseSwgeW91IGRvIG5vdCBuZWVkIHRvIGNhbGwgdGhpczsgdGhlIGZvbGxvd2luZyBjb2RlXG4gICAqIGF1dG9tYXRpY2FsbHkgY2FsbHMgX3JlbW92ZUNvbnZlcnNhdGlvbiBmb3IgeW91OlxuICAgKlxuICAgKiAgICAgIGNvbnZlcmF0aW9uLmRlc3Ryb3koKTtcbiAgICpcbiAgICogQG1ldGhvZCBfcmVtb3ZlQ29udmVyc2F0aW9uXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtICB7bGF5ZXIuQ29udmVyc2F0aW9ufSBjXG4gICAqL1xuICBfcmVtb3ZlQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbikge1xuICAgIC8vIEluc3VyZSB3ZSBkbyBub3QgZ2V0IGFueSBldmVudHMsIHN1Y2ggYXMgbWVzc2FnZTpyZW1vdmVcbiAgICBjb252ZXJzYXRpb24ub2ZmKG51bGwsIG51bGwsIHRoaXMpO1xuXG4gICAgaWYgKHRoaXMuX2NvbnZlcnNhdGlvbnNIYXNoW2NvbnZlcnNhdGlvbi5pZF0pIHtcbiAgICAgIGRlbGV0ZSB0aGlzLl9jb252ZXJzYXRpb25zSGFzaFtjb252ZXJzYXRpb24uaWRdO1xuICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdjb252ZXJzYXRpb25zOnJlbW92ZScsIHsgY29udmVyc2F0aW9uczogW2NvbnZlcnNhdGlvbl0gfSk7XG4gICAgfVxuXG4gICAgLy8gUmVtb3ZlIGFueSBNZXNzYWdlIGFzc29jaWF0ZWQgd2l0aCB0aGlzIENvbnZlcnNhdGlvblxuICAgIE9iamVjdC5rZXlzKHRoaXMuX21lc3NhZ2VzSGFzaCkuZm9yRWFjaChpZCA9PiB7XG4gICAgICBpZiAodGhpcy5fbWVzc2FnZXNIYXNoW2lkXS5jb252ZXJzYXRpb25JZCA9PT0gY29udmVyc2F0aW9uLmlkKSB7XG4gICAgICAgIHRoaXMuX21lc3NhZ2VzSGFzaFtpZF0uZGVzdHJveSgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIElmIHRoZSBDb252ZXJzYXRpb24gSUQgY2hhbmdlcywgd2UgbmVlZCB0byByZXJlZ2lzdGVyIHRoZSBDb252ZXJzYXRpb25cbiAgICpcbiAgICogQG1ldGhvZCBfdXBkYXRlQ29udmVyc2F0aW9uSWRcbiAgICogQHByb3RlY3RlZFxuICAgKiBAcGFyYW0gIHtsYXllci5Db252ZXJzYXRpb259IGNvbnZlcnNhdGlvbiAtIENvbnZlcnNhdGlvbiB3aG9zZSBJRCBoYXMgY2hhbmdlZFxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IG9sZElkIC0gUHJldmlvdXMgSURcbiAgICovXG4gIF91cGRhdGVDb252ZXJzYXRpb25JZChjb252ZXJzYXRpb24sIG9sZElkKSB7XG4gICAgaWYgKHRoaXMuX2NvbnZlcnNhdGlvbnNIYXNoW29sZElkXSkge1xuICAgICAgdGhpcy5fY29udmVyc2F0aW9uc0hhc2hbY29udmVyc2F0aW9uLmlkXSA9IGNvbnZlcnNhdGlvbjtcbiAgICAgIGRlbGV0ZSB0aGlzLl9jb252ZXJzYXRpb25zSGFzaFtvbGRJZF07XG5cbiAgICAgIC8vIFRoaXMgaXMgYSBuYXN0eSB3YXkgdG8gd29yay4uLiBidXQgbmVlZCB0byBmaW5kIGFuZCB1cGRhdGUgYWxsXG4gICAgICAvLyBjb252ZXJzYXRpb25JZCBwcm9wZXJ0aWVzIG9mIGFsbCBNZXNzYWdlcyBvciB0aGUgUXVlcnkncyB3b24ndFxuICAgICAgLy8gc2VlIHRoZXNlIGFzIG1hdGNoaW5nIHRoZSBxdWVyeS5cbiAgICAgIE9iamVjdC5rZXlzKHRoaXMuX21lc3NhZ2VzSGFzaClcbiAgICAgICAgICAgIC5maWx0ZXIoaWQgPT4gdGhpcy5fbWVzc2FnZXNIYXNoW2lkXS5jb252ZXJzYXRpb25JZCA9PT0gb2xkSWQpXG4gICAgICAgICAgICAuZm9yRWFjaChpZCA9PiAodGhpcy5fbWVzc2FnZXNIYXNoW2lkXS5jb252ZXJzYXRpb25JZCA9IGNvbnZlcnNhdGlvbi5pZCkpO1xuICAgIH1cbiAgfVxuXG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIHRoZSBtZXNzYWdlIG9yIGFubm91bmNlbWVudCBpZC5cbiAgICpcbiAgICogVXNlZnVsIGZvciBmaW5kaW5nIGEgbWVzc2FnZSB3aGVuIHlvdSBoYXZlIG9ubHkgdGhlIElELlxuICAgKlxuICAgKiBJZiB0aGUgbWVzc2FnZSBpcyBub3QgZm91bmQsIGl0IHdpbGwgcmV0dXJuIG51bGwuXG4gICAqXG4gICAqIElmIHlvdSB3YW50IGl0IHRvIGxvYWQgaXQgZnJvbSBjYWNoZSBhbmQgdGhlbiBmcm9tIHNlcnZlciBpZiBub3QgaW4gY2FjaGUsIHVzZSB0aGUgYGNhbkxvYWRgIHBhcmFtZXRlci5cbiAgICogSWYgbG9hZGluZyBmcm9tIHRoZSBzZXJ2ZXIsIHRoZSBtZXRob2Qgd2lsbCByZXR1cm5cbiAgICogYSBsYXllci5NZXNzYWdlIGluc3RhbmNlIHRoYXQgaGFzIG5vIGRhdGE7IHRoZSBtZXNzYWdlczpsb2FkZWQvbWVzc2FnZXM6bG9hZGVkLWVycm9yIGV2ZW50c1xuICAgKiB3aWxsIGxldCB5b3Uga25vdyB3aGVuIHRoZSBtZXNzYWdlIGhhcyBmaW5pc2hlZC9mYWlsZWQgbG9hZGluZyBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqICAgICAgdmFyIG0gPSBjbGllbnQuZ2V0TWVzc2FnZSgnbGF5ZXI6Ly8vbWVzc2FnZXMvMTIzJywgdHJ1ZSlcbiAgICogICAgICAub24oJ21lc3NhZ2VzOmxvYWRlZCcsIGZ1bmN0aW9uKCkge1xuICAgKiAgICAgICAgICAvLyBSZW5kZXIgdGhlIE1lc3NhZ2Ugd2l0aCBhbGwgb2YgaXRzIGRldGFpbHMgbG9hZGVkXG4gICAqICAgICAgICAgIG15cmVyZW5kZXIobSk7XG4gICAqICAgICAgfSk7XG4gICAqICAgICAgLy8gUmVuZGVyIGEgcGxhY2Vob2xkZXIgZm9yIG0gdW50aWwgdGhlIGRldGFpbHMgb2YgbSBoYXZlIGxvYWRlZFxuICAgKiAgICAgIG15cmVuZGVyKG0pO1xuICAgKlxuICAgKlxuICAgKiBAbWV0aG9kIGdldE1lc3NhZ2VcbiAgICogQHBhcmFtICB7c3RyaW5nfSBpZCAgICAgICAgICAgICAgLSBsYXllcjovLy9tZXNzYWdlcy91dWlkXG4gICAqIEBwYXJhbSAge2Jvb2xlYW59IFtjYW5Mb2FkPWZhbHNlXSAtIFBhc3MgdHJ1ZSB0byBhbGxvdyBsb2FkaW5nIGEgbWVzc2FnZSBmcm9tIHRoZSBzZXJ2ZXIgaWYgbm90IGZvdW5kXG4gICAqIEByZXR1cm4ge2xheWVyLk1lc3NhZ2V9XG4gICAqL1xuICBnZXRNZXNzYWdlKGlkLCBjYW5Mb2FkKSB7XG4gICAgaWYgKHR5cGVvZiBpZCAhPT0gJ3N0cmluZycpIHRocm93IG5ldyBFcnJvcihFcnJvckRpY3Rpb25hcnkuaWRQYXJhbVJlcXVpcmVkKTtcblxuICAgIGlmICh0aGlzLl9tZXNzYWdlc0hhc2hbaWRdKSB7XG4gICAgICByZXR1cm4gdGhpcy5fbWVzc2FnZXNIYXNoW2lkXTtcbiAgICB9IGVsc2UgaWYgKGNhbkxvYWQpIHtcbiAgICAgIHJldHVybiBTeW5jYWJsZS5sb2FkKGlkLCB0aGlzKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGEgTWVzc2FnZVBhcnQgYnkgSURcbiAgICpcbiAgICogYGBgXG4gICAqIHZhciBwYXJ0ID0gY2xpZW50LmdldE1lc3NhZ2VQYXJ0KCdsYXllcjovLy9tZXNzYWdlcy82ZjA4YWNmYS0zMjY4LTRhZTUtODNkOS02Y2EwMDAwMDAwMC9wYXJ0cy8wJyk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAbWV0aG9kIGdldE1lc3NhZ2VQYXJ0XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBpZCAtIElEIG9mIHRoZSBNZXNzYWdlIFBhcnQ7IGxheWVyOi8vL21lc3NhZ2VzL3V1aWQvcGFydHMvNVxuICAgKi9cbiAgZ2V0TWVzc2FnZVBhcnQoaWQpIHtcbiAgICBpZiAodHlwZW9mIGlkICE9PSAnc3RyaW5nJykgdGhyb3cgbmV3IEVycm9yKEVycm9yRGljdGlvbmFyeS5pZFBhcmFtUmVxdWlyZWQpO1xuXG4gICAgY29uc3QgbWVzc2FnZUlkID0gaWQucmVwbGFjZSgvXFwvcGFydHMuKiQvLCAnJyk7XG4gICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuZ2V0TWVzc2FnZShtZXNzYWdlSWQpO1xuICAgIGlmIChtZXNzYWdlKSByZXR1cm4gbWVzc2FnZS5nZXRQYXJ0QnlJZChpZCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXJzIGEgbWVzc2FnZSBpbiBfbWVzc2FnZXNIYXNoIGFuZCB0cmlnZ2VycyBldmVudHMuXG4gICAqXG4gICAqIE1heSBhbHNvIHVwZGF0ZSBDb252ZXJzYXRpb24ubGFzdE1lc3NhZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgX2FkZE1lc3NhZ2VcbiAgICogQHByb3RlY3RlZFxuICAgKiBAcGFyYW0gIHtsYXllci5NZXNzYWdlfSBtZXNzYWdlXG4gICAqL1xuICBfYWRkTWVzc2FnZShtZXNzYWdlKSB7XG4gICAgaWYgKCF0aGlzLl9tZXNzYWdlc0hhc2hbbWVzc2FnZS5pZF0pIHtcbiAgICAgIHRoaXMuX21lc3NhZ2VzSGFzaFttZXNzYWdlLmlkXSA9IG1lc3NhZ2U7XG4gICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ21lc3NhZ2VzOmFkZCcsIHsgbWVzc2FnZXM6IFttZXNzYWdlXSB9KTtcbiAgICAgIGlmIChtZXNzYWdlLl9ub3RpZnkpIHtcbiAgICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdtZXNzYWdlczpub3RpZnknLCB7IG1lc3NhZ2UgfSk7XG4gICAgICAgIG1lc3NhZ2UuX25vdGlmeSA9IGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb252ZXJzYXRpb24gPSBtZXNzYWdlLmdldENvbnZlcnNhdGlvbihmYWxzZSk7XG4gICAgICBpZiAoY29udmVyc2F0aW9uICYmICghY29udmVyc2F0aW9uLmxhc3RNZXNzYWdlIHx8IGNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZS5wb3NpdGlvbiA8IG1lc3NhZ2UucG9zaXRpb24pKSB7XG4gICAgICAgIGNvbnN0IGxhc3RNZXNzYWdlV2FzID0gY29udmVyc2F0aW9uLmxhc3RNZXNzYWdlO1xuICAgICAgICBjb252ZXJzYXRpb24ubGFzdE1lc3NhZ2UgPSBtZXNzYWdlO1xuICAgICAgICBpZiAobGFzdE1lc3NhZ2VXYXMpIHRoaXMuX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlKGxhc3RNZXNzYWdlV2FzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlKG1lc3NhZ2UpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIG1lc3NhZ2UgZnJvbSBfbWVzc2FnZXNIYXNoLlxuICAgKlxuICAgKiBBY2NlcHRzIElEcyBvciBNZXNzYWdlIGluc3RhbmNlc1xuICAgKlxuICAgKiBUT0RPOiBSZW1vdmUgc3VwcG9ydCBmb3IgcmVtb3ZlIGJ5IElEXG4gICAqXG4gICAqIEBtZXRob2QgX3JlbW92ZU1lc3NhZ2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bGF5ZXIuTWVzc2FnZXxzdHJpbmd9IG1lc3NhZ2Ugb3IgTWVzc2FnZSBJRFxuICAgKi9cbiAgX3JlbW92ZU1lc3NhZ2UobWVzc2FnZSkge1xuICAgIGNvbnN0IGlkID0gKHR5cGVvZiBtZXNzYWdlID09PSAnc3RyaW5nJykgPyBtZXNzYWdlIDogbWVzc2FnZS5pZDtcbiAgICBtZXNzYWdlID0gdGhpcy5fbWVzc2FnZXNIYXNoW2lkXTtcbiAgICBpZiAobWVzc2FnZSkge1xuICAgICAgZGVsZXRlIHRoaXMuX21lc3NhZ2VzSGFzaFtpZF07XG4gICAgICBpZiAoIXRoaXMuX2luQ2xlYW51cCkge1xuICAgICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ21lc3NhZ2VzOnJlbW92ZScsIHsgbWVzc2FnZXM6IFttZXNzYWdlXSB9KTtcbiAgICAgICAgY29uc3QgY29udiA9IG1lc3NhZ2UuZ2V0Q29udmVyc2F0aW9uKGZhbHNlKTtcbiAgICAgICAgaWYgKGNvbnYgJiYgY29udi5sYXN0TWVzc2FnZSA9PT0gbWVzc2FnZSkgY29udi5sYXN0TWVzc2FnZSA9IG51bGw7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZXMgZGVsZXRlIGZyb20gcG9zaXRpb24gZXZlbnQgZnJvbSBXZWJzb2NrZXQuXG4gICAqXG4gICAqIEEgV2ViU29ja2V0IG1heSBkZWxpdmVyIGEgYGRlbGV0ZWAgQ29udmVyc2F0aW9uIGV2ZW50IHdpdGggYVxuICAgKiBmcm9tX3Bvc2l0aW9uIGZpZWxkIGluZGljYXRpbmcgdGhhdCBhbGwgTWVzc2FnZXMgYXQgdGhlIHNwZWNpZmllZCBwb3NpdGlvblxuICAgKiBhbmQgZWFybGllciBzaG91bGQgYmUgZGVsZXRlZC5cbiAgICpcbiAgICogQG1ldGhvZCBfcHVyZ2VNZXNzYWdlc0J5UG9zaXRpb25cbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGNvbnZlcnNhdGlvbklkXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBmcm9tUG9zaXRpb25cbiAgICovXG4gIF9wdXJnZU1lc3NhZ2VzQnlQb3NpdGlvbihjb252ZXJzYXRpb25JZCwgZnJvbVBvc2l0aW9uKSB7XG4gICAgT2JqZWN0LmtleXModGhpcy5fbWVzc2FnZXNIYXNoKS5mb3JFYWNoKG1JZCA9PiB7XG4gICAgICBjb25zdCBtZXNzYWdlID0gdGhpcy5fbWVzc2FnZXNIYXNoW21JZF07XG4gICAgICBpZiAobWVzc2FnZS5jb252ZXJzYXRpb25JZCA9PT0gY29udmVyc2F0aW9uSWQgJiYgbWVzc2FnZS5wb3NpdGlvbiA8PSBmcm9tUG9zaXRpb24pIHtcbiAgICAgICAgbWVzc2FnZS5kZXN0cm95KCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmUgYSBpZGVudGl0eSBieSBJZGVudGlmaWVyLlxuICAgKlxuICAgKiAgICAgIHZhciBpZGVudGl0eSA9IGNsaWVudC5nZXRJZGVudGl0eSgnbGF5ZXI6Ly8vaWRlbnRpdGllcy91c2VyX2lkJyk7XG4gICAqXG4gICAqIElmIHRoZXJlIGlzIG5vdCBhbiBJZGVudGl0eSB3aXRoIHRoYXQgaWQsIGl0IHdpbGwgcmV0dXJuIG51bGwuXG4gICAqXG4gICAqIElmIHlvdSB3YW50IGl0IHRvIGxvYWQgaXQgZnJvbSBjYWNoZSBhbmQgdGhlbiBmcm9tIHNlcnZlciBpZiBub3QgaW4gY2FjaGUsIHVzZSB0aGUgYGNhbkxvYWRgIHBhcmFtZXRlci5cbiAgICogVGhpcyBpcyBvbmx5IHN1cHBvcnRlZCBmb3IgVXNlciBJZGVudGl0aWVzLCBub3QgU2VydmljZSBJZGVudGl0aWVzLlxuICAgKlxuICAgKiBJZiBsb2FkaW5nIGZyb20gdGhlIHNlcnZlciwgdGhlIG1ldGhvZCB3aWxsIHJldHVyblxuICAgKiBhIGxheWVyLklkZW50aXR5IGluc3RhbmNlIHRoYXQgaGFzIG5vIGRhdGE7IHRoZSBpZGVudGl0aWVzOmxvYWRlZC9pZGVudGl0aWVzOmxvYWRlZC1lcnJvciBldmVudHNcbiAgICogd2lsbCBsZXQgeW91IGtub3cgd2hlbiB0aGUgaWRlbnRpdHkgaGFzIGZpbmlzaGVkL2ZhaWxlZCBsb2FkaW5nIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogICAgICB2YXIgdXNlciA9IGNsaWVudC5nZXRJZGVudGl0eSgnbGF5ZXI6Ly8vaWRlbnRpdGllcy8xMjMnLCB0cnVlKVxuICAgKiAgICAgIC5vbignaWRlbnRpdGllczpsb2FkZWQnLCBmdW5jdGlvbigpIHtcbiAgICogICAgICAgICAgLy8gUmVuZGVyIHRoZSB1c2VyIGxpc3Qgd2l0aCBhbGwgb2YgaXRzIGRldGFpbHMgbG9hZGVkXG4gICAqICAgICAgICAgIG15cmVyZW5kZXIodXNlcik7XG4gICAqICAgICAgfSk7XG4gICAqICAgICAgLy8gUmVuZGVyIGEgcGxhY2Vob2xkZXIgZm9yIHVzZXIgdW50aWwgdGhlIGRldGFpbHMgb2YgdXNlciBoYXZlIGxvYWRlZFxuICAgKiAgICAgIG15cmVuZGVyKHVzZXIpO1xuICAgKlxuICAgKiBAbWV0aG9kIGdldElkZW50aXR5XG4gICAqIEBwYXJhbSAge3N0cmluZ30gaWQgLSBBY2NlcHRzIGZ1bGwgTGF5ZXIgSUQgKGxheWVyOi8vL2lkZW50aXRpZXMvZnJvZG8tdGhlLWRvZG8pIG9yIGp1c3QgdGhlIFVzZXJJRCAoZnJvZG8tdGhlLWRvZG8pLlxuICAgKiBAcGFyYW0gIHtib29sZWFufSBbY2FuTG9hZD1mYWxzZV0gLSBQYXNzIHRydWUgdG8gYWxsb3cgbG9hZGluZyBhbiBpZGVudGl0eSBmcm9tXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhlIHNlcnZlciBpZiBub3QgZm91bmRcbiAgICogQHJldHVybiB7bGF5ZXIuSWRlbnRpdHl9XG4gICAqL1xuICBnZXRJZGVudGl0eShpZCwgY2FuTG9hZCkge1xuICAgIGlmICh0eXBlb2YgaWQgIT09ICdzdHJpbmcnKSB0aHJvdyBuZXcgRXJyb3IoRXJyb3JEaWN0aW9uYXJ5LmlkUGFyYW1SZXF1aXJlZCk7XG4gICAgaWYgKCFJZGVudGl0eS5pc1ZhbGlkSWQoaWQpKSB7XG4gICAgICBpZCA9IElkZW50aXR5LnByZWZpeFVVSUQgKyBlbmNvZGVVUklDb21wb25lbnQoaWQpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9pZGVudGl0aWVzSGFzaFtpZF0pIHtcbiAgICAgIHJldHVybiB0aGlzLl9pZGVudGl0aWVzSGFzaFtpZF07XG4gICAgfSBlbHNlIGlmIChjYW5Mb2FkKSB7XG4gICAgICByZXR1cm4gSWRlbnRpdHkubG9hZChpZCwgdGhpcyk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFRha2VzIGFuIGFycmF5IG9mIElkZW50aXR5IGluc3RhbmNlcywgVXNlciBJRHMsIElkZW50aXR5IElEcywgSWRlbnRpdHkgb2JqZWN0cyxcbiAgICogb3IgU2VydmVyIGZvcm1hdHRlZCBJZGVudGl0eSBPYmplY3RzIGFuZCByZXR1cm5zIGFuIGFycmF5IG9mIElkZW50aXR5IGluc3RhbmNlcy5cbiAgICpcbiAgICogQG1ldGhvZCBfZml4SWRlbnRpdGllc1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge01peGVkW119IGlkZW50aXRpZXMgLSBTb21ldGhpbmcgdGhhdCB0ZWxscyB1cyB3aGF0IElkZW50aXR5IHRvIHJldHVyblxuICAgKiBAcmV0dXJuIHtsYXllci5JZGVudGl0eVtdfVxuICAgKi9cbiAgX2ZpeElkZW50aXRpZXMoaWRlbnRpdGllcykge1xuICAgIHJldHVybiBpZGVudGl0aWVzLm1hcCgoaWRlbnRpdHkpID0+IHtcbiAgICAgIGlmIChpZGVudGl0eSBpbnN0YW5jZW9mIElkZW50aXR5KSByZXR1cm4gaWRlbnRpdHk7XG4gICAgICBpZiAodHlwZW9mIGlkZW50aXR5ID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRJZGVudGl0eShpZGVudGl0eSwgdHJ1ZSk7XG4gICAgICB9IGVsc2UgaWYgKGlkZW50aXR5ICYmIHR5cGVvZiBpZGVudGl0eSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgaWYgKCd1c2VySWQnIGluIGlkZW50aXR5KSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0SWRlbnRpdHkoaWRlbnRpdHkuaWQgfHwgaWRlbnRpdHkudXNlcklkKTtcbiAgICAgICAgfSBlbHNlIGlmICgndXNlcl9pZCcgaW4gaWRlbnRpdHkpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5fY3JlYXRlT2JqZWN0KGlkZW50aXR5KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgYW4gaWRlbnRpdHkgdG8gdGhlIGNsaWVudC5cbiAgICpcbiAgICogVHlwaWNhbGx5LCB5b3UgZG8gbm90IG5lZWQgdG8gY2FsbCB0aGlzOyB0aGUgSWRlbnRpdHkgY29uc3RydWN0b3Igd2lsbCBjYWxsIHRoaXMuXG4gICAqXG4gICAqIEBtZXRob2QgX2FkZElkZW50aXR5XG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtICB7bGF5ZXIuSWRlbnRpdHl9IGlkZW50aXR5XG4gICAqXG4gICAqIFRPRE86IEl0IHNob3VsZCBiZSBwb3NzaWJsZSB0byBhZGQgYW4gSWRlbnRpdHkgd2hvc2UgdXNlcklkIGlzIHBvcHVsYXRlZCwgYnV0XG4gICAqIG90aGVyIHZhbHVlcyBhcmUgbm90IHlldCBsb2FkZWQgZnJvbSB0aGUgc2VydmVyLiAgU2hvdWxkIGFkZCB0byBfaWRlbnRpdGllc0hhc2ggbm93XG4gICAqIGJ1dCB0cmlnZ2VyIGBpZGVudGl0aWVzOmFkZGAgb25seSB3aGVuIGl0cyBnb3QgZW5vdWdoIGRhdGEgdG8gYmUgcmVuZGVyYWJsZS5cbiAgICovXG4gIF9hZGRJZGVudGl0eShpZGVudGl0eSkge1xuICAgIGNvbnN0IGlkID0gaWRlbnRpdHkuaWQ7XG4gICAgaWYgKGlkICYmICF0aGlzLl9pZGVudGl0aWVzSGFzaFtpZF0pIHtcbiAgICAgIC8vIFJlZ2lzdGVyIHRoZSBJZGVudGl0eVxuICAgICAgdGhpcy5faWRlbnRpdGllc0hhc2hbaWRdID0gaWRlbnRpdHk7XG4gICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2lkZW50aXRpZXM6YWRkJywgeyBpZGVudGl0aWVzOiBbaWRlbnRpdHldIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIGFuIGlkZW50aXR5IGZyb20gdGhlIGNsaWVudC5cbiAgICpcbiAgICogVHlwaWNhbGx5LCB5b3UgZG8gbm90IG5lZWQgdG8gY2FsbCB0aGlzOyB0aGUgZm9sbG93aW5nIGNvZGVcbiAgICogYXV0b21hdGljYWxseSBjYWxscyBfcmVtb3ZlSWRlbnRpdHkgZm9yIHlvdTpcbiAgICpcbiAgICogICAgICBpZGVudGl0eS5kZXN0cm95KCk7XG4gICAqXG4gICAqIEBtZXRob2QgX3JlbW92ZUlkZW50aXR5XG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtICB7bGF5ZXIuSWRlbnRpdHl9IGlkZW50aXR5XG4gICAqL1xuICBfcmVtb3ZlSWRlbnRpdHkoaWRlbnRpdHkpIHtcbiAgICAvLyBJbnN1cmUgd2UgZG8gbm90IGdldCBhbnkgZXZlbnRzLCBzdWNoIGFzIG1lc3NhZ2U6cmVtb3ZlXG4gICAgaWRlbnRpdHkub2ZmKG51bGwsIG51bGwsIHRoaXMpO1xuXG4gICAgY29uc3QgaWQgPSBpZGVudGl0eS5pZDtcbiAgICBpZiAodGhpcy5faWRlbnRpdGllc0hhc2hbaWRdKSB7XG4gICAgICBkZWxldGUgdGhpcy5faWRlbnRpdGllc0hhc2hbaWRdO1xuICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdpZGVudGl0aWVzOnJlbW92ZScsIHsgaWRlbnRpdGllczogW2lkZW50aXR5XSB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRm9sbG93IHRoaXMgdXNlciBhbmQgZ2V0IEZ1bGwgSWRlbnRpdHksIGFuZCB3ZWJzb2NrZXQgY2hhbmdlcyBvbiBJZGVudGl0eS5cbiAgICpcbiAgICogQG1ldGhvZCBmb2xsb3dJZGVudGl0eVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkIC0gQWNjZXB0cyBmdWxsIExheWVyIElEIChsYXllcjovLy9pZGVudGl0aWVzL2Zyb2RvLXRoZS1kb2RvKSBvciBqdXN0IHRoZSBVc2VySUQgKGZyb2RvLXRoZS1kb2RvKS5cbiAgICogQHJldHVybnMge2xheWVyLklkZW50aXR5fVxuICAgKi9cbiAgZm9sbG93SWRlbnRpdHkoaWQpIHtcbiAgICBpZiAoIUlkZW50aXR5LmlzVmFsaWRJZChpZCkpIHtcbiAgICAgIGlkID0gSWRlbnRpdHkucHJlZml4VVVJRCArIGVuY29kZVVSSUNvbXBvbmVudChpZCk7XG4gICAgfVxuICAgIGxldCBpZGVudGl0eSA9IHRoaXMuZ2V0SWRlbnRpdHkoaWQpO1xuICAgIGlmICghaWRlbnRpdHkpIHtcbiAgICAgIGlkZW50aXR5ID0gbmV3IElkZW50aXR5KHtcbiAgICAgICAgaWQsXG4gICAgICAgIGNsaWVudElkOiB0aGlzLmFwcElkLFxuICAgICAgICB1c2VySWQ6IGlkLnN1YnN0cmluZygyMCksXG4gICAgICB9KTtcbiAgICB9XG4gICAgaWRlbnRpdHkuZm9sbG93KCk7XG4gICAgcmV0dXJuIGlkZW50aXR5O1xuICB9XG5cbiAgLyoqXG4gICAqIFVuZm9sbG93IHRoaXMgdXNlciBhbmQgZ2V0IG9ubHkgQmFzaWMgSWRlbnRpdHksIGFuZCBubyB3ZWJzb2NrZXQgY2hhbmdlcyBvbiBJZGVudGl0eS5cbiAgICpcbiAgICogQG1ldGhvZCB1bmZvbGxvd0lkZW50aXR5XG4gICAqIEBwYXJhbSAge3N0cmluZ30gaWQgLSBBY2NlcHRzIGZ1bGwgTGF5ZXIgSUQgKGxheWVyOi8vL2lkZW50aXRpZXMvZnJvZG8tdGhlLWRvZG8pIG9yIGp1c3QgdGhlIFVzZXJJRCAoZnJvZG8tdGhlLWRvZG8pLlxuICAgKiBAcmV0dXJucyB7bGF5ZXIuSWRlbnRpdHl9XG4gICAqL1xuICB1bmZvbGxvd0lkZW50aXR5KGlkKSB7XG4gICAgaWYgKCFJZGVudGl0eS5pc1ZhbGlkSWQoaWQpKSB7XG4gICAgICBpZCA9IElkZW50aXR5LnByZWZpeFVVSUQgKyBlbmNvZGVVUklDb21wb25lbnQoaWQpO1xuICAgIH1cbiAgICBsZXQgaWRlbnRpdHkgPSB0aGlzLmdldElkZW50aXR5KGlkKTtcbiAgICBpZiAoIWlkZW50aXR5KSB7XG4gICAgICBpZGVudGl0eSA9IG5ldyBJZGVudGl0eSh7XG4gICAgICAgIGlkLFxuICAgICAgICBjbGllbnRJZDogdGhpcy5hcHBJZCxcbiAgICAgICAgdXNlcklkOiBpZC5zdWJzdHJpbmcoMjApLFxuICAgICAgfSk7XG4gICAgfVxuICAgIGlkZW50aXR5LnVuZm9sbG93KCk7XG4gICAgcmV0dXJuIGlkZW50aXR5O1xuICB9XG5cbiAgLyoqXG4gICAqIFRha2VzIGFzIGlucHV0IGFuIG9iamVjdCBpZCwgYW5kIGVpdGhlciBjYWxscyBnZXRDb252ZXJzYXRpb24oKSBvciBnZXRNZXNzYWdlKCkgYXMgbmVlZGVkLlxuICAgKlxuICAgKiBXaWxsIG9ubHkgZ2V0IGNhY2hlZCBvYmplY3RzLCB3aWxsIG5vdCBnZXQgb2JqZWN0cyBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIFRoaXMgaXMgbm90IGEgcHVibGljIG1ldGhvZCBtb3N0bHkgc28gdGhlcmUncyBubyBhbWJpZ3VpdHkgb3ZlciB1c2luZyBnZXRYWFhcbiAgICogb3IgX2dldE9iamVjdC4gIGdldFhYWCB0eXBpY2FsbHkgaGFzIGFuIG9wdGlvbiB0byBsb2FkIHRoZSByZXNvdXJjZSwgd2hpY2ggdGhpc1xuICAgKiBkb2VzIG5vdC5cbiAgICpcbiAgICogQG1ldGhvZCBfZ2V0T2JqZWN0XG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtICB7c3RyaW5nfSBpZCAtIE1lc3NhZ2UsIENvbnZlcnNhdGlvbiBvciBRdWVyeSBpZFxuICAgKiBAcmV0dXJuIHtsYXllci5NZXNzYWdlfGxheWVyLkNvbnZlcnNhdGlvbnxsYXllci5RdWVyeX1cbiAgICovXG4gIF9nZXRPYmplY3QoaWQpIHtcbiAgICBzd2l0Y2ggKFV0aWwudHlwZUZyb21JRChpZCkpIHtcbiAgICAgIGNhc2UgJ21lc3NhZ2VzJzpcbiAgICAgIGNhc2UgJ2Fubm91bmNlbWVudHMnOlxuICAgICAgICByZXR1cm4gdGhpcy5nZXRNZXNzYWdlKGlkKTtcbiAgICAgIGNhc2UgJ2NvbnZlcnNhdGlvbnMnOlxuICAgICAgICByZXR1cm4gdGhpcy5nZXRDb252ZXJzYXRpb24oaWQpO1xuICAgICAgY2FzZSAncXVlcmllcyc6XG4gICAgICAgIHJldHVybiB0aGlzLmdldFF1ZXJ5KGlkKTtcbiAgICAgIGNhc2UgJ2lkZW50aXRpZXMnOlxuICAgICAgICByZXR1cm4gdGhpcy5nZXRJZGVudGl0eShpZCk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cblxuICAvKipcbiAgICogVGFrZXMgYW4gb2JqZWN0IGRlc2NyaXB0aW9uIGZyb20gdGhlIHNlcnZlciBhbmQgZWl0aGVyIHVwZGF0ZXMgaXQgKGlmIGNhY2hlZClcbiAgICogb3IgY3JlYXRlcyBhbmQgY2FjaGVzIGl0IC5cbiAgICpcbiAgICogQG1ldGhvZCBfY3JlYXRlT2JqZWN0XG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvYmogLSBQbGFpbiBqYXZhc2NyaXB0IG9iamVjdCByZXByZXNlbnRpbmcgYSBNZXNzYWdlIG9yIENvbnZlcnNhdGlvblxuICAgKi9cbiAgX2NyZWF0ZU9iamVjdChvYmopIHtcbiAgICBjb25zdCBpdGVtID0gdGhpcy5fZ2V0T2JqZWN0KG9iai5pZCk7XG4gICAgaWYgKGl0ZW0pIHtcbiAgICAgIGl0ZW0uX3BvcHVsYXRlRnJvbVNlcnZlcihvYmopO1xuICAgICAgcmV0dXJuIGl0ZW07XG4gICAgfSBlbHNlIHtcbiAgICAgIHN3aXRjaCAoVXRpbC50eXBlRnJvbUlEKG9iai5pZCkpIHtcbiAgICAgICAgY2FzZSAnbWVzc2FnZXMnOlxuICAgICAgICAgIHJldHVybiBNZXNzYWdlLl9jcmVhdGVGcm9tU2VydmVyKG9iaiwgdGhpcyk7XG4gICAgICAgIGNhc2UgJ2Fubm91bmNlbWVudHMnOlxuICAgICAgICAgIHJldHVybiBBbm5vdW5jZW1lbnQuX2NyZWF0ZUZyb21TZXJ2ZXIob2JqLCB0aGlzKTtcbiAgICAgICAgY2FzZSAnY29udmVyc2F0aW9ucyc6XG4gICAgICAgICAgcmV0dXJuIENvbnZlcnNhdGlvbi5fY3JlYXRlRnJvbVNlcnZlcihvYmosIHRoaXMpO1xuICAgICAgICBjYXNlICdpZGVudGl0aWVzJzpcbiAgICAgICAgICByZXR1cm4gSWRlbnRpdHkuX2NyZWF0ZUZyb21TZXJ2ZXIob2JqLCB0aGlzKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogTWVyZ2UgZXZlbnRzIGludG8gc21hbGxlciBudW1iZXJzIG9mIG1vcmUgY29tcGxldGUgZXZlbnRzLlxuICAgKlxuICAgKiBCZWZvcmUgYW55IGRlbGF5ZWQgdHJpZ2dlcnMgYXJlIGZpcmVkLCBmb2xkIHRvZ2V0aGVyIGFsbCBvZiB0aGUgY29udmVyc2F0aW9uczphZGRcbiAgICogYW5kIGNvbnZlcnNhdGlvbnM6cmVtb3ZlIGV2ZW50cyBzbyB0aGF0IDEwMCBjb252ZXJzYXRpb25zOmFkZCBldmVudHMgY2FuIGJlIGZpcmVkIGFzXG4gICAqIGEgc2luZ2xlIGV2ZW50LlxuICAgKlxuICAgKiBAbWV0aG9kIF9wcm9jZXNzRGVsYXllZFRyaWdnZXJzXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcHJvY2Vzc0RlbGF5ZWRUcmlnZ2VycygpIHtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCkgcmV0dXJuO1xuXG4gICAgY29uc3QgYWRkQ29udmVyc2F0aW9ucyA9IHRoaXMuX2RlbGF5ZWRUcmlnZ2Vycy5maWx0ZXIoKGV2dCkgPT4gZXZ0WzBdID09PSAnY29udmVyc2F0aW9uczphZGQnKTtcbiAgICBjb25zdCByZW1vdmVDb252ZXJzYXRpb25zID0gdGhpcy5fZGVsYXllZFRyaWdnZXJzLmZpbHRlcigoZXZ0KSA9PiBldnRbMF0gPT09ICdjb252ZXJzYXRpb25zOnJlbW92ZScpO1xuICAgIHRoaXMuX2ZvbGRFdmVudHMoYWRkQ29udmVyc2F0aW9ucywgJ2NvbnZlcnNhdGlvbnMnLCB0aGlzKTtcbiAgICB0aGlzLl9mb2xkRXZlbnRzKHJlbW92ZUNvbnZlcnNhdGlvbnMsICdjb252ZXJzYXRpb25zJywgdGhpcyk7XG5cbiAgICBjb25zdCBhZGRNZXNzYWdlcyA9IHRoaXMuX2RlbGF5ZWRUcmlnZ2Vycy5maWx0ZXIoKGV2dCkgPT4gZXZ0WzBdID09PSAnbWVzc2FnZXM6YWRkJyk7XG4gICAgY29uc3QgcmVtb3ZlTWVzc2FnZXMgPSB0aGlzLl9kZWxheWVkVHJpZ2dlcnMuZmlsdGVyKChldnQpID0+IGV2dFswXSA9PT0gJ21lc3NhZ2VzOnJlbW92ZScpO1xuXG4gICAgdGhpcy5fZm9sZEV2ZW50cyhhZGRNZXNzYWdlcywgJ21lc3NhZ2VzJywgdGhpcyk7XG4gICAgdGhpcy5fZm9sZEV2ZW50cyhyZW1vdmVNZXNzYWdlcywgJ21lc3NhZ2VzJywgdGhpcyk7XG5cbiAgICBjb25zdCBhZGRJZGVudGl0aWVzID0gdGhpcy5fZGVsYXllZFRyaWdnZXJzLmZpbHRlcigoZXZ0KSA9PiBldnRbMF0gPT09ICdpZGVudGl0aWVzOmFkZCcpO1xuICAgIGNvbnN0IHJlbW92ZUlkZW50aXRpZXMgPSB0aGlzLl9kZWxheWVkVHJpZ2dlcnMuZmlsdGVyKChldnQpID0+IGV2dFswXSA9PT0gJ2lkZW50aXRpZXM6cmVtb3ZlJyk7XG5cbiAgICB0aGlzLl9mb2xkRXZlbnRzKGFkZElkZW50aXRpZXMsICdpZGVudGl0aWVzJywgdGhpcyk7XG4gICAgdGhpcy5fZm9sZEV2ZW50cyhyZW1vdmVJZGVudGl0aWVzLCAnaWRlbnRpdGllcycsIHRoaXMpO1xuXG4gICAgc3VwZXIuX3Byb2Nlc3NEZWxheWVkVHJpZ2dlcnMoKTtcbiAgfVxuXG4gIHRyaWdnZXIoZXZlbnROYW1lLCBldnQpIHtcbiAgICB0aGlzLl90cmlnZ2VyTG9nZ2VyKGV2ZW50TmFtZSwgZXZ0KTtcbiAgICBzdXBlci50cmlnZ2VyKGV2ZW50TmFtZSwgZXZ0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEb2VzIGxvZ2dpbmcgb24gYWxsIHRyaWdnZXJlZCBldmVudHMuXG4gICAqXG4gICAqIEFsbCBsb2dnaW5nIGlzIGRvbmUgYXQgYGRlYnVnYCBvciBgaW5mb2AgbGV2ZWxzLlxuICAgKlxuICAgKiBAbWV0aG9kIF90cmlnZ2VyTG9nZ2VyXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfdHJpZ2dlckxvZ2dlcihldmVudE5hbWUsIGV2dCkge1xuICAgIGNvbnN0IGluZm9FdmVudHMgPSBbXG4gICAgICAnY29udmVyc2F0aW9uczphZGQnLCAnY29udmVyc2F0aW9uczpyZW1vdmUnLCAnY29udmVyc2F0aW9uczpjaGFuZ2UnLFxuICAgICAgJ21lc3NhZ2VzOmFkZCcsICdtZXNzYWdlczpyZW1vdmUnLCAnbWVzc2FnZXM6Y2hhbmdlJyxcbiAgICAgICdpZGVudGl0aWVzOmFkZCcsICdpZGVudGl0aWVzOnJlbW92ZScsICdpZGVudGl0aWVzOmNoYW5nZScsXG4gICAgICAnY2hhbGxlbmdlJywgJ3JlYWR5JyxcbiAgICBdO1xuICAgIGlmIChpbmZvRXZlbnRzLmluZGV4T2YoZXZlbnROYW1lKSAhPT0gLTEpIHtcbiAgICAgIGlmIChldnQgJiYgZXZ0LmlzQ2hhbmdlKSB7XG4gICAgICAgIGxvZ2dlci5pbmZvKGBDbGllbnQgRXZlbnQ6ICR7ZXZlbnROYW1lfSAke2V2dC5jaGFuZ2VzLm1hcChjaGFuZ2UgPT4gY2hhbmdlLnByb3BlcnR5KS5qb2luKCcsICcpfWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IHRleHQgPSAnJztcbiAgICAgICAgaWYgKGV2dCkge1xuICAgICAgICAgIGlmIChldnQubWVzc2FnZSkgdGV4dCA9IGV2dC5tZXNzYWdlLmlkO1xuICAgICAgICAgIGlmIChldnQubWVzc2FnZXMpIHRleHQgPSBldnQubWVzc2FnZXMubGVuZ3RoICsgJyBtZXNzYWdlcyc7XG4gICAgICAgICAgaWYgKGV2dC5jb252ZXJzYXRpb24pIHRleHQgPSBldnQuY29udmVyc2F0aW9uLmlkO1xuICAgICAgICAgIGlmIChldnQuY29udmVyc2F0aW9ucykgdGV4dCA9IGV2dC5jb252ZXJzYXRpb25zLmxlbmd0aCArICcgY29udmVyc2F0aW9ucyc7XG4gICAgICAgIH1cbiAgICAgICAgbG9nZ2VyLmluZm8oYENsaWVudCBFdmVudDogJHtldmVudE5hbWV9ICR7dGV4dH1gKTtcbiAgICAgIH1cbiAgICAgIGlmIChldnQpIGxvZ2dlci5kZWJ1ZyhldnQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIuZGVidWcoZXZlbnROYW1lLCBldnQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTZWFyY2hlcyBsb2NhbGx5IGNhY2hlZCBjb252ZXJzYXRpb25zIGZvciBhIG1hdGNoaW5nIGNvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogSXRlcmF0ZXMgb3ZlciBjb252ZXJzYXRpb25zIGNhbGxpbmcgYSBtYXRjaGluZyBmdW5jdGlvbiB1bnRpbFxuICAgKiB0aGUgY29udmVyc2F0aW9uIGlzIGZvdW5kIG9yIGFsbCBjb252ZXJzYXRpb25zIHRlc3RlZC5cbiAgICpcbiAgICogICAgICB2YXIgYyA9IGNsaWVudC5maW5kQ29udmVyc2F0aW9uKGZ1bmN0aW9uKGNvbnZlcnNhdGlvbikge1xuICAgKiAgICAgICAgICBpZiAoY29udmVyc2F0aW9uLnBhcnRpY2lwYW50cy5pbmRleE9mKCdhJykgIT0gLTEpIHJldHVybiB0cnVlO1xuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBAbWV0aG9kIGZpbmRDYWNoZWRDb252ZXJzYXRpb25cbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGYgLSBGdW5jdGlvbiB0byBjYWxsIHVudGlsIHdlIGZpbmQgYSBtYXRjaFxuICAgKiBAcGFyYW0gIHtsYXllci5Db252ZXJzYXRpb259IGYuY29udmVyc2F0aW9uIC0gQSBjb252ZXJzYXRpb24gdG8gdGVzdFxuICAgKiBAcGFyYW0gIHtib29sZWFufSBmLnJldHVybiAtIFJldHVybiB0cnVlIGlmIHRoZSBjb252ZXJzYXRpb24gaXMgYSBtYXRjaFxuICAgKiBAcGFyYW0gIHtPYmplY3R9IFtjb250ZXh0XSAtIE9wdGlvbmFsIGNvbnRleHQgZm9yIHRoZSAqdGhpcyogb2JqZWN0XG4gICAqIEByZXR1cm4ge2xheWVyLkNvbnZlcnNhdGlvbn1cbiAgICpcbiAgICogQGRlcHJlY2F0ZWRcbiAgICogVGhpcyBzaG91bGQgYmUgcmVwbGFjZWQgYnkgaXRlcmF0aW5nIG92ZXIgeW91ciBsYXllci5RdWVyeSBkYXRhLlxuICAgKi9cbiAgZmluZENhY2hlZENvbnZlcnNhdGlvbihmdW5jLCBjb250ZXh0KSB7XG4gICAgY29uc3QgdGVzdCA9IGNvbnRleHQgPyBmdW5jLmJpbmQoY29udGV4dCkgOiBmdW5jO1xuICAgIGNvbnN0IGxpc3QgPSBPYmplY3Qua2V5cyh0aGlzLl9jb252ZXJzYXRpb25zSGFzaCk7XG4gICAgY29uc3QgbGVuID0gbGlzdC5sZW5ndGg7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IGxlbjsgaW5kZXgrKykge1xuICAgICAgY29uc3Qga2V5ID0gbGlzdFtpbmRleF07XG4gICAgICBjb25zdCBjb252ZXJzYXRpb24gPSB0aGlzLl9jb252ZXJzYXRpb25zSGFzaFtrZXldO1xuICAgICAgaWYgKHRlc3QoY29udmVyc2F0aW9uLCBpbmRleCkpIHJldHVybiBjb252ZXJzYXRpb247XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIElmIHRoZSBzZXNzaW9uIGhhcyBiZWVuIHJlc2V0LCBkdW1wIGFsbCBkYXRhLlxuICAgKlxuICAgKiBAbWV0aG9kIF9yZXNldFNlc3Npb25cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9yZXNldFNlc3Npb24oKSB7XG4gICAgdGhpcy5fY2xlYW51cCgpO1xuICAgIHRoaXMuX2NvbnZlcnNhdGlvbnNIYXNoID0ge307XG4gICAgdGhpcy5fbWVzc2FnZXNIYXNoID0ge307XG4gICAgdGhpcy5fcXVlcmllc0hhc2ggPSB7fTtcbiAgICB0aGlzLl9pZGVudGl0aWVzSGFzaCA9IHt9O1xuICAgIHJldHVybiBzdXBlci5fcmVzZXRTZXNzaW9uKCk7XG4gIH1cblxuXG5cbiAgLyoqXG4gICAqIFRoaXMgbWV0aG9kIGlzIHJlY29tbWVuZGVkIHdheSB0byBjcmVhdGUgYSBDb252ZXJzYXRpb24uXG4gICAqXG4gICAqIFRoZXJlIGFyZSBhIGZldyB3YXlzIHRvIGludm9rZSBpdDsgbm90ZSB0aGF0IHRoZSBkZWZhdWx0IGJlaGF2aW9yIGlzIHRvIGNyZWF0ZSBhIERpc3RpbmN0IENvbnZlcnNhdGlvblxuICAgKiB1bmxlc3Mgb3RoZXJ3aXNlIHN0YXRlZCB2aWEgdGhlIGxheWVyLkNvbnZlcnNhdGlvbi5kaXN0aW5jdCBwcm9wZXJ0eS5cbiAgICpcbiAgICogICAgICAgICBjbGllbnQuY3JlYXRlQ29udmVyc2F0aW9uKHtwYXJ0aWNpcGFudHM6IFsnYScsICdiJ119KTtcbiAgICogICAgICAgICBjbGllbnQuY3JlYXRlQ29udmVyc2F0aW9uKHtwYXJ0aWNpcGFudHM6IFt1c2VySWRlbnRpdHlBLCB1c2VySWRlbnRpdHlCXX0pO1xuICAgKlxuICAgKiAgICAgICAgIGNsaWVudC5jcmVhdGVDb252ZXJzYXRpb24oe1xuICAgKiAgICAgICAgICAgICBwYXJ0aWNpcGFudHM6IFsnYScsICdiJ10sXG4gICAqICAgICAgICAgICAgIGRpc3RpbmN0OiBmYWxzZVxuICAgKiAgICAgICAgIH0pO1xuICAgKlxuICAgKiAgICAgICAgIGNsaWVudC5jcmVhdGVDb252ZXJzYXRpb24oe1xuICAgKiAgICAgICAgICAgICBwYXJ0aWNpcGFudHM6IFsnYScsICdiJ10sXG4gICAqICAgICAgICAgICAgIG1ldGFkYXRhOiB7XG4gICAqICAgICAgICAgICAgICAgICB0aXRsZTogJ0kgYW0gYSB0aXRsZSdcbiAgICogICAgICAgICAgICAgfVxuICAgKiAgICAgICAgIH0pO1xuICAgKlxuICAgKiBJZiB5b3UgdHJ5IHRvIGNyZWF0ZSBhIERpc3RpbmN0IENvbnZlcnNhdGlvbiB0aGF0IGFscmVhZHkgZXhpc3RzLFxuICAgKiB5b3Ugd2lsbCBnZXQgYmFjayBhbiBleGlzdGluZyBDb252ZXJzYXRpb24sIGFuZCBhbnkgcmVxdWVzdGVkIG1ldGFkYXRhXG4gICAqIHdpbGwgTk9UIGJlIHNldDsgeW91IHdpbGwgZ2V0IHdoYXRldmVyIG1ldGFkYXRhIHRoZSBtYXRjaGluZyBDb252ZXJzYXRpb25cbiAgICogYWxyZWFkeSBoYWQuXG4gICAqXG4gICAqIFRoZSBkZWZhdWx0IHZhbHVlIGZvciBkaXN0aW5jdCBpcyBgdHJ1ZWAuXG4gICAqXG4gICAqIFdoZXRoZXIgdGhlIENvbnZlcnNhdGlvbiBhbHJlYWR5IGV4aXN0cyBvciBub3QsIGEgJ2NvbnZlcnNhdGlvbnM6c2VudCcgZXZlbnRcbiAgICogd2lsbCBiZSB0cmlnZ2VyZWQgYXN5bmNocm9ub3VzbHkgYW5kIHRoZSBDb252ZXJzYXRpb24gb2JqZWN0IHdpbGwgYmUgcmVhZHlcbiAgICogYXQgdGhhdCB0aW1lLiAgRnVydGhlciwgdGhlIGV2ZW50IHdpbGwgcHJvdmlkZSBkZXRhaWxzIG9uIHRoZSByZXN1bHQ6XG4gICAqXG4gICAqICAgICAgIHZhciBjb252ZXJzYXRpb24gPSBjbGllbnQuY3JlYXRlQ29udmVyc2F0aW9uKHtcbiAgICogICAgICAgICAgcGFydGljaXBhbnRzOiBbJ2EnLCAnYiddLFxuICAgKiAgICAgICAgICBtZXRhZGF0YToge1xuICAgKiAgICAgICAgICAgIHRpdGxlOiAnSSBhbSBhIHRpdGxlJ1xuICAgKiAgICAgICAgICB9XG4gICAqICAgICAgIH0pO1xuICAgKiAgICAgICBjb252ZXJzYXRpb24ub24oJ2NvbnZlcnNhdGlvbnM6c2VudCcsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICAgICAgICAgc3dpdGNoKGV2dC5yZXN1bHQpIHtcbiAgICogICAgICAgICAgICAgICBjYXNlIENvbnZlcnNhdGlvbi5DUkVBVEVEOlxuICAgKiAgICAgICAgICAgICAgICAgICBhbGVydChjb252ZXJzYXRpb24uaWQgKyAnIHdhcyBjcmVhdGVkJyk7XG4gICAqICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgKiAgICAgICAgICAgICAgIGNhc2UgQ29udmVyc2F0aW9uLkZPVU5EOlxuICAgKiAgICAgICAgICAgICAgICAgICBhbGVydChjb252ZXJzYXRpb24uaWQgKyAnIHdhcyBmb3VuZCcpO1xuICAgKiAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICogICAgICAgICAgICAgICBjYXNlIENvbnZlcnNhdGlvbi5GT1VORF9XSVRIT1VUX1JFUVVFU1RFRF9NRVRBREFUQTpcbiAgICogICAgICAgICAgICAgICAgICAgYWxlcnQoY29udmVyc2F0aW9uLmlkICsgJyB3YXMgZm91bmQgYnV0IGl0IGFscmVhZHkgaGFzIGEgdGl0bGUgc28geW91ciByZXF1ZXN0ZWQgdGl0bGUgd2FzIG5vdCBzZXQnKTtcbiAgICogICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAqICAgICAgICAgICAgfVxuICAgKiAgICAgICB9KTtcbiAgICpcbiAgICogV2FybmluZzogVGhpcyBtZXRob2Qgd2lsbCB0aHJvdyBhbiBlcnJvciBpZiBjYWxsZWQgd2hlbiB5b3UgYXJlIG5vdCAob3IgYXJlIG5vIGxvbmdlcikgYW4gYXV0aGVudGljYXRlZCB1c2VyLlxuICAgKiBUaGF0IG1lYW5zIGlmIGF1dGhlbnRpY2F0aW9uIGhhcyBleHBpcmVkLCBhbmQgeW91IGhhdmUgbm90IHlldCByZWF1dGhlbnRpY2F0ZWQgdGhlIHVzZXIsIHRoaXMgd2lsbCB0aHJvdyBhbiBlcnJvci5cbiAgICpcbiAgICpcbiAgICogQG1ldGhvZCBjcmVhdGVDb252ZXJzYXRpb25cbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSB7c3RyaW5nW10vbGF5ZXIuSWRlbnRpdHlbXX0gcGFydGljaXBhbnRzIC0gQXJyYXkgb2YgVXNlcklEcyBvciBVc2VySWRlbnRpdGllc1xuICAgKiBAcGFyYW0ge0Jvb2xlYW59IFtvcHRpb25zLmRpc3RpbmN0PXRydWVdIElzIHRoaXMgYSBkaXN0aW5jdCBDb252ZXJhdGlvbj9cbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLm1ldGFkYXRhPXt9XSBNZXRhZGF0YSBmb3IgeW91ciBDb252ZXJzYXRpb25cbiAgICogQHJldHVybiB7bGF5ZXIuQ29udmVyc2F0aW9ufVxuICAgKi9cbiAgY3JlYXRlQ29udmVyc2F0aW9uKG9wdGlvbnMpIHtcbiAgICAvLyBJZiB3ZSBhcmVuJ3QgYXV0aGVudGljYXRlZCwgdGhlbiB3ZSBkb24ndCB5ZXQgaGF2ZSBhIFVzZXJJRCwgYW5kIHdvbid0IGNyZWF0ZSB0aGUgY29ycmVjdCBDb252ZXJzYXRpb25cbiAgICBpZiAoIXRoaXMuaXNBdXRoZW50aWNhdGVkKSB0aHJvdyBuZXcgRXJyb3IoRXJyb3JEaWN0aW9uYXJ5LmNsaWVudE11c3RCZVJlYWR5KTtcbiAgICBpZiAoISgnZGlzdGluY3QnIGluIG9wdGlvbnMpKSBvcHRpb25zLmRpc3RpbmN0ID0gdHJ1ZTtcbiAgICBvcHRpb25zLmNsaWVudCA9IHRoaXM7XG4gICAgcmV0dXJuIENvbnZlcnNhdGlvbi5jcmVhdGUob3B0aW9ucyk7XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmUgdGhlIHF1ZXJ5IGJ5IHF1ZXJ5IGlkLlxuICAgKlxuICAgKiBVc2VmdWwgZm9yIGZpbmRpbmcgYSBRdWVyeSB3aGVuIHlvdSBvbmx5IGhhdmUgdGhlIElEXG4gICAqXG4gICAqIEBtZXRob2QgZ2V0UXVlcnlcbiAgICogQHBhcmFtICB7c3RyaW5nfSBpZCAgICAgICAgICAgICAgLSBsYXllcjovLy9tZXNzYWdlcy91dWlkXG4gICAqIEByZXR1cm4ge2xheWVyLlF1ZXJ5fVxuICAgKi9cbiAgZ2V0UXVlcnkoaWQpIHtcbiAgICBpZiAodHlwZW9mIGlkICE9PSAnc3RyaW5nJykgdGhyb3cgbmV3IEVycm9yKEVycm9yRGljdGlvbmFyeS5pZFBhcmFtUmVxdWlyZWQpO1xuICAgIHJldHVybiB0aGlzLl9xdWVyaWVzSGFzaFtpZF0gfHwgbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGVyZSBhcmUgdHdvIG9wdGlvbnMgdG8gY3JlYXRlIGEgbmV3IGxheWVyLlF1ZXJ5IGluc3RhbmNlLlxuICAgKlxuICAgKiBUaGUgZGlyZWN0IHdheTpcbiAgICpcbiAgICogICAgIHZhciBxdWVyeSA9IGNsaWVudC5jcmVhdGVRdWVyeSh7XG4gICAqICAgICAgICAgbW9kZWw6IGxheWVyLlF1ZXJ5Lk1lc3NhZ2UsXG4gICAqICAgICAgICAgcHJlZGljYXRlOiAnY29udmVyc2F0aW9uLmlkID0gJycgKyBjb252LmlkICsgJycnLFxuICAgKiAgICAgICAgIHBhZ2luYXRpb25XaW5kb3c6IDUwXG4gICAqICAgICB9KTtcbiAgICpcbiAgICogQSBCdWlsZGVyIGFwcHJvYWNoIHRoYXQgYWxsb3dzIGZvciBhIHNpbXBsZXIgc3ludGF4OlxuICAgKlxuICAgKiAgICAgdmFyIHFCdWlsZGVyID0gUXVlcnlCdWlsZGVyXG4gICAqICAgICAgLm1lc3NhZ2VzKClcbiAgICogICAgICAuZm9yQ29udmVyc2F0aW9uKCdsYXllcjovLy9jb252ZXJzYXRpb25zL2ZmZmZmZmZmLWZmZmYtZmZmZi1mZmZmLWZmZmZmZmZmZmZmZicpXG4gICAqICAgICAgLnBhZ2luYXRpb25XaW5kb3coMTAwKTtcbiAgICogICAgIHZhciBxdWVyeSA9IGNsaWVudC5jcmVhdGVRdWVyeShxQnVpbGRlcik7XG4gICAqXG4gICAqIEBtZXRob2QgY3JlYXRlUXVlcnlcbiAgICogQHBhcmFtICB7bGF5ZXIuUXVlcnlCdWlsZGVyfE9iamVjdH0gb3B0aW9ucyAtIEVpdGhlciBhIGxheWVyLlF1ZXJ5QnVpbGRlciBpbnN0YW5jZSwgb3IgcGFyYW1ldGVycyBmb3IgdGhlIGxheWVyLlF1ZXJ5IGNvbnN0cnVjdG9yXG4gICAqIEByZXR1cm4ge2xheWVyLlF1ZXJ5fVxuICAgKi9cbiAgY3JlYXRlUXVlcnkob3B0aW9ucykge1xuICAgIGxldCBxdWVyeTtcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMuYnVpbGQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHF1ZXJ5ID0gbmV3IFF1ZXJ5KHRoaXMsIG9wdGlvbnMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRpb25zLmNsaWVudCA9IHRoaXM7XG4gICAgICBxdWVyeSA9IG5ldyBRdWVyeShvcHRpb25zKTtcbiAgICB9XG4gICAgdGhpcy5fYWRkUXVlcnkocXVlcnkpO1xuICAgIHJldHVybiBxdWVyeTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciB0aGUgbGF5ZXIuUXVlcnkuXG4gICAqXG4gICAqIEBtZXRob2QgX2FkZFF1ZXJ5XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLlF1ZXJ5fSBxdWVyeVxuICAgKi9cbiAgX2FkZFF1ZXJ5KHF1ZXJ5KSB7XG4gICAgdGhpcy5fcXVlcmllc0hhc2hbcXVlcnkuaWRdID0gcXVlcnk7XG4gIH1cblxuICAvKipcbiAgICogRGVyZWdpc3RlciB0aGUgbGF5ZXIuUXVlcnkuXG4gICAqXG4gICAqIEBtZXRob2QgX3JlbW92ZVF1ZXJ5XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLlF1ZXJ5fSBxdWVyeSBbZGVzY3JpcHRpb25dXG4gICAqL1xuICBfcmVtb3ZlUXVlcnkocXVlcnkpIHtcbiAgICBpZiAocXVlcnkpIHtcbiAgICAgIGRlbGV0ZSB0aGlzLl9xdWVyaWVzSGFzaFtxdWVyeS5pZF07XG4gICAgICBpZiAoIXRoaXMuX2luQ2xlYW51cCkge1xuICAgICAgICBjb25zdCBkYXRhID0gcXVlcnkuZGF0YVxuICAgICAgICAgIC5tYXAob2JqID0+IHRoaXMuX2dldE9iamVjdChvYmouaWQpKVxuICAgICAgICAgIC5maWx0ZXIob2JqID0+IG9iaik7XG4gICAgICAgIHRoaXMuX2NoZWNrQW5kUHVyZ2VDYWNoZShkYXRhKTtcbiAgICAgIH1cbiAgICAgIHRoaXMub2ZmKG51bGwsIG51bGwsIHF1ZXJ5KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgdG8gc2VlIGlmIHRoZSBzcGVjaWZpZWQgb2JqZWN0cyBjYW4gc2FmZWx5IGJlIHJlbW92ZWQgZnJvbSBjYWNoZS5cbiAgICpcbiAgICogUmVtb3ZlcyBmcm9tIGNhY2hlIGlmIGFuIG9iamVjdCBpcyBub3QgcGFydCBvZiBhbnkgUXVlcnkncyByZXN1bHQgc2V0LlxuICAgKlxuICAgKiBAbWV0aG9kIF9jaGVja0FuZFB1cmdlQ2FjaGVcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bGF5ZXIuUm9vdFtdfSBvYmplY3RzIC0gQXJyYXkgb2YgTWVzc2FnZXMgb3IgQ29udmVyc2F0aW9uc1xuICAgKi9cbiAgX2NoZWNrQW5kUHVyZ2VDYWNoZShvYmplY3RzKSB7XG4gICAgb2JqZWN0cy5mb3JFYWNoKG9iaiA9PiB7XG4gICAgICBpZiAoIW9iai5pc0Rlc3Ryb3llZCAmJiAhdGhpcy5faXNDYWNoZWRPYmplY3Qob2JqKSkge1xuICAgICAgICBpZiAob2JqIGluc3RhbmNlb2YgUm9vdCA9PT0gZmFsc2UpIG9iaiA9IHRoaXMuX2dldE9iamVjdChvYmouaWQpO1xuICAgICAgICBpZiAob2JqIGluc3RhbmNlb2YgQ29udmVyc2F0aW9uKSByZXR1cm47XG4gICAgICAgIGlmIChvYmopIG9iai5kZXN0cm95KCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU2NoZWR1bGVzIF9ydW5TY2hlZHVsZWRDaGVja0FuZFB1cmdlQ2FjaGUgaWYgbmVlZGVkLCBhbmQgYWRkcyB0aGlzIG9iamVjdFxuICAgKiB0byB0aGUgbGlzdCBvZiBvYmplY3RzIGl0IHdpbGwgdmFsaWRhdGUgZm9yIHVuY2FjaGluZy5cbiAgICpcbiAgICogTm90ZSB0aGF0IGFueSBvYmplY3QgdGhhdCBkb2VzIG5vdCBleGlzdCBvbiB0aGUgc2VydmVyICghaXNTYXZlZCgpKSBpcyBhbiBvYmplY3QgdGhhdCB0aGVcbiAgICogYXBwIGNyZWF0ZWQgYW5kIGNhbiBvbmx5IGJlIHB1cmdlZCBieSB0aGUgYXBwIGFuZCBub3QgYnkgdGhlIFNESy4gIE9uY2UgaXRzIGJlZW5cbiAgICogc2F2ZWQsIGFuZCBjYW4gYmUgcmVsb2FkZWQgZnJvbSB0aGUgc2VydmVyIHdoZW4gbmVlZGVkLCBpdHMgc3ViamVjdCB0byBzdGFuZGFyZCBjYWNoaW5nLlxuICAgKlxuICAgKiBAbWV0aG9kIF9zY2hlZHVsZUNoZWNrQW5kUHVyZ2VDYWNoZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge2xheWVyLlJvb3R9IG9iamVjdFxuICAgKi9cbiAgX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlKG9iamVjdCkge1xuICAgIGlmIChvYmplY3QuaXNTYXZlZCgpKSB7XG4gICAgICBpZiAodGhpcy5fc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGVBdCA8IERhdGUubm93KCkpIHtcbiAgICAgICAgdGhpcy5fc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGVBdCA9IERhdGUubm93KCkgKyBDbGllbnQuQ0FDSEVfUFVSR0VfSU5URVJWQUw7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5fcnVuU2NoZWR1bGVkQ2hlY2tBbmRQdXJnZUNhY2hlKCksIENsaWVudC5DQUNIRV9QVVJHRV9JTlRFUlZBTCk7XG4gICAgICB9XG4gICAgICB0aGlzLl9zY2hlZHVsZUNoZWNrQW5kUHVyZ2VDYWNoZUl0ZW1zLnB1c2gob2JqZWN0KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbHMgX2NoZWNrQW5kUHVyZ2VDYWNoZSBvbiBhY2N1bXVsYXRlZCBvYmplY3RzIGFuZCByZXNldHMgaXRzIHN0YXRlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9ydW5TY2hlZHVsZWRDaGVja0FuZFB1cmdlQ2FjaGVcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9ydW5TY2hlZHVsZWRDaGVja0FuZFB1cmdlQ2FjaGUoKSB7XG4gICAgY29uc3QgbGlzdCA9IHRoaXMuX3NjaGVkdWxlQ2hlY2tBbmRQdXJnZUNhY2hlSXRlbXM7XG4gICAgdGhpcy5fc2NoZWR1bGVDaGVja0FuZFB1cmdlQ2FjaGVJdGVtcyA9IFtdO1xuICAgIHRoaXMuX2NoZWNrQW5kUHVyZ2VDYWNoZShsaXN0KTtcbiAgICB0aGlzLl9zY2hlZHVsZUNoZWNrQW5kUHVyZ2VDYWNoZUF0ID0gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIHNwZWNpZmllZCBvYmplY3Qgc2hvdWxkIGNvbnRpbnVlIHRvIGJlIHBhcnQgb2YgdGhlIGNhY2hlLlxuICAgKlxuICAgKiBSZXN1bHQgaXMgYmFzZWQgb24gd2hldGhlciB0aGUgb2JqZWN0IGlzIHBhcnQgb2YgdGhlIGRhdGEgZm9yIGEgUXVlcnkuXG4gICAqXG4gICAqIEBtZXRob2QgX2lzQ2FjaGVkT2JqZWN0XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLlJvb3R9IG9iaiAtIEEgTWVzc2FnZSBvciBDb252ZXJzYXRpb24gSW5zdGFuY2VcbiAgICogQHJldHVybiB7Qm9vbGVhbn1cbiAgICovXG4gIF9pc0NhY2hlZE9iamVjdChvYmopIHtcbiAgICBjb25zdCBsaXN0ID0gT2JqZWN0LmtleXModGhpcy5fcXVlcmllc0hhc2gpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLl9xdWVyaWVzSGFzaFtsaXN0W2ldXTtcbiAgICAgIGlmIChxdWVyeS5fZ2V0SXRlbShvYmouaWQpKSByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIE9uIHJlc3RvcmluZyBhIGNvbm5lY3Rpb24sIGRldGVybWluZSB3aGF0IHN0ZXBzIG5lZWQgdG8gYmUgdGFrZW4gdG8gdXBkYXRlIG91ciBkYXRhLlxuICAgKlxuICAgKiBBIHJlc2V0IGJvb2xlYW4gcHJvcGVydHkgaXMgcGFzc2VkOyBzZXQgYmFzZWQgb24gIGxheWVyLkNsaWVudEF1dGhlbnRpY2F0b3IuUmVzZXRBZnRlck9mZmxpbmVEdXJhdGlvbi5cbiAgICpcbiAgICogTm90ZSBpdCBpcyBwb3NzaWJsZSBmb3IgYW4gYXBwbGljYXRpb24gdG8gaGF2ZSBsb2dpYyB0aGF0IGNhdXNlcyBxdWVyaWVzIHRvIGJlIGNyZWF0ZWQvZGVzdHJveWVkXG4gICAqIGFzIGEgc2lkZS1lZmZlY3Qgb2YgbGF5ZXIuUXVlcnkucmVzZXQgZGVzdHJveWluZyBhbGwgZGF0YS4gU28gd2UgbXVzdCB0ZXN0IHRvIHNlZSBpZiBxdWVyaWVzIGV4aXN0LlxuICAgKlxuICAgKiBAbWV0aG9kIF9jb25uZWN0aW9uUmVzdG9yZWRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtib29sZWFufSByZXNldCAtIFNob3VsZCB0aGUgc2Vzc2lvbiByZXNldC9yZWxvYWQgYWxsIGRhdGEgb3IgYXR0ZW1wdCB0byByZXN1bWUgd2hlcmUgaXQgbGVmdCBvZmY/XG4gICAqL1xuICBfY29ubmVjdGlvblJlc3RvcmVkKGV2dCkge1xuICAgIGlmIChldnQucmVzZXQpIHtcbiAgICAgIGxvZ2dlci5kZWJ1ZygnQ2xpZW50IENvbm5lY3Rpb24gUmVzdG9yZWQ7IFJlc2V0dGluZyBhbGwgUXVlcmllcycpO1xuICAgICAgdGhpcy5kYk1hbmFnZXIuZGVsZXRlVGFibGVzKCgpID0+IHtcbiAgICAgICAgdGhpcy5kYk1hbmFnZXIuX29wZW4oKTtcbiAgICAgICAgT2JqZWN0LmtleXModGhpcy5fcXVlcmllc0hhc2gpLmZvckVhY2goaWQgPT4ge1xuICAgICAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5fcXVlcmllc0hhc2hbaWRdO1xuICAgICAgICAgIGlmIChxdWVyeSkgcXVlcnkucmVzZXQoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIHRoZSBzcGVjaWZpZWQgb2JqZWN0IGZyb20gY2FjaGVcbiAgICpcbiAgICogQG1ldGhvZCBfcmVtb3ZlT2JqZWN0XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLlJvb3R9ICBvYmogLSBBIE1lc3NhZ2Ugb3IgQ29udmVyc2F0aW9uIEluc3RhbmNlXG4gICAqL1xuICBfcmVtb3ZlT2JqZWN0KG9iaikge1xuICAgIGlmIChvYmopIG9iai5kZXN0cm95KCk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGxheWVyLlR5cGluZ0luZGljYXRvcnMuVHlwaW5nTGlzdGVuZXIgaW5zdGFuY2VcbiAgICogYm91bmQgdG8gdGhlIHNwZWNpZmllZCBkb20gbm9kZS5cbiAgICpcbiAgICogICAgICB2YXIgdHlwaW5nTGlzdGVuZXIgPSBjbGllbnQuY3JlYXRlVHlwaW5nTGlzdGVuZXIoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ215VGV4dEJveCcpKTtcbiAgICogICAgICB0eXBpbmdMaXN0ZW5lci5zZXRDb252ZXJzYXRpb24obXlTZWxlY3RlZENvbnZlcnNhdGlvbik7XG4gICAqXG4gICAqIFVzZSB0aGlzIG1ldGhvZCB0byBpbnN0YW50aWF0ZSBhIGxpc3RlbmVyLCBhbmQgY2FsbFxuICAgKiBsYXllci5UeXBpbmdJbmRpY2F0b3JzLlR5cGluZ0xpc3RlbmVyLnNldENvbnZlcnNhdGlvbiBldmVyeSB0aW1lIHlvdSB3YW50IHRvIGNoYW5nZSB3aGljaCBDb252ZXJzYXRpb25cbiAgICogaXQgcmVwb3J0cyB5b3VyIHVzZXIgaXMgdHlwaW5nIGludG8uXG4gICAqXG4gICAqIEBtZXRob2QgY3JlYXRlVHlwaW5nTGlzdGVuZXJcbiAgICogQHBhcmFtICB7SFRNTEVsZW1lbnR9IGlucHV0Tm9kZSAtIFRleHQgaW5wdXQgdG8gd2F0Y2ggZm9yIGtleXN0cm9rZXNcbiAgICogQHJldHVybiB7bGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5UeXBpbmdMaXN0ZW5lcn1cbiAgICovXG4gIGNyZWF0ZVR5cGluZ0xpc3RlbmVyKGlucHV0Tm9kZSkge1xuICAgIGNvbnN0IFR5cGluZ0xpc3RlbmVyID0gcmVxdWlyZSgnLi90eXBpbmctaW5kaWNhdG9ycy90eXBpbmctbGlzdGVuZXInKTtcbiAgICByZXR1cm4gbmV3IFR5cGluZ0xpc3RlbmVyKHtcbiAgICAgIGNsaWVudElkOiB0aGlzLmFwcElkLFxuICAgICAgaW5wdXQ6IGlucHV0Tm9kZSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5UeXBpbmdQdWJsaXNoZXIuXG4gICAqXG4gICAqIFRoZSBUeXBpbmdQdWJsaXNoZXIgbGV0cyB5b3UgbWFuYWdlIHlvdXIgVHlwaW5nIEluZGljYXRvcnMgd2l0aG91dCB1c2luZ1xuICAgKiB0aGUgbGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5UeXBpbmdMaXN0ZW5lci5cbiAgICpcbiAgICogICAgICB2YXIgdHlwaW5nUHVibGlzaGVyID0gY2xpZW50LmNyZWF0ZVR5cGluZ1B1Ymxpc2hlcigpO1xuICAgKiAgICAgIHR5cGluZ1B1Ymxpc2hlci5zZXRDb252ZXJzYXRpb24obXlTZWxlY3RlZENvbnZlcnNhdGlvbik7XG4gICAqICAgICAgdHlwaW5nUHVibGlzaGVyLnNldFN0YXRlKGxheWVyLlR5cGluZ0luZGljYXRvcnMuU1RBUlRFRCk7XG4gICAqXG4gICAqIFVzZSB0aGlzIG1ldGhvZCB0byBpbnN0YW50aWF0ZSBhIGxpc3RlbmVyLCBhbmQgY2FsbFxuICAgKiBsYXllci5UeXBpbmdJbmRpY2F0b3JzLlR5cGluZ1B1Ymxpc2hlci5zZXRDb252ZXJzYXRpb24gZXZlcnkgdGltZSB5b3Ugd2FudCB0byBjaGFuZ2Ugd2hpY2ggQ29udmVyc2F0aW9uXG4gICAqIGl0IHJlcG9ydHMgeW91ciB1c2VyIGlzIHR5cGluZyBpbnRvLlxuICAgKlxuICAgKiBVc2UgbGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5UeXBpbmdQdWJsaXNoZXIuc2V0U3RhdGUgdG8gaW5mb3JtIG90aGVyIHVzZXJzIG9mIHlvdXIgY3VycmVudCBzdGF0ZS5cbiAgICogTm90ZSB0aGF0IHRoZSBgU1RBUlRFRGAgc3RhdGUgb25seSBsYXN0cyBmb3IgMi41IHNlY29uZHMsIHNvIHlvdVxuICAgKiBtdXN0IHJlcGVhdGVkbHkgY2FsbCBzZXRTdGF0ZSBmb3IgYXMgbG9uZyBhcyB0aGlzIHN0YXRlIHNob3VsZCBjb250aW51ZS5cbiAgICogVGhpcyBpcyB0eXBpY2FsbHkgZG9uZSBieSBzaW1wbHkgY2FsbGluZyBpdCBldmVyeSB0aW1lIGEgdXNlciBoaXRzXG4gICAqIGEga2V5LlxuICAgKlxuICAgKiBAbWV0aG9kIGNyZWF0ZVR5cGluZ1B1Ymxpc2hlclxuICAgKiBAcmV0dXJuIHtsYXllci5UeXBpbmdJbmRpY2F0b3JzLlR5cGluZ1B1Ymxpc2hlcn1cbiAgICovXG4gIGNyZWF0ZVR5cGluZ1B1Ymxpc2hlcigpIHtcbiAgICBjb25zdCBUeXBpbmdQdWJsaXNoZXIgPSByZXF1aXJlKCcuL3R5cGluZy1pbmRpY2F0b3JzL3R5cGluZy1wdWJsaXNoZXInKTtcbiAgICByZXR1cm4gbmV3IFR5cGluZ1B1Ymxpc2hlcih7XG4gICAgICBjbGllbnRJZDogdGhpcy5hcHBJZCxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIGN1cnJlbnQgdHlwaW5nIGluZGljYXRvciBzdGF0ZSBvZiBhIHNwZWNpZmllZCBDb252ZXJzYXRpb24uXG4gICAqXG4gICAqIFR5cGljYWxseSB1c2VkIHRvIHNlZSBpZiBhbnlvbmUgaXMgY3VycmVudGx5IHR5cGluZyB3aGVuIGZpcnN0IG9wZW5pbmcgYSBDb252ZXJzYXRpb24uXG4gICAqXG4gICAqIEBtZXRob2QgZ2V0VHlwaW5nU3RhdGVcbiAgICogQHBhcmFtIHtTdHJpbmd9IGNvbnZlcnNhdGlvbklkXG4gICAqL1xuICBnZXRUeXBpbmdTdGF0ZShjb252ZXJzYXRpb25JZCkge1xuICAgIHJldHVybiB0aGlzLl90eXBpbmdJbmRpY2F0b3JzLmdldFN0YXRlKGNvbnZlcnNhdGlvbklkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBY2Nlc3NvciBmb3IgZ2V0dGluZyBhIENsaWVudCBieSBhcHBJZC5cbiAgICpcbiAgICogTW9zdCBhcHBzIHdpbGwgb25seSBoYXZlIG9uZSBjbGllbnQsXG4gICAqIGFuZCB3aWxsIG5vdCBuZWVkIHRoaXMgbWV0aG9kLlxuICAgKlxuICAgKiBAbWV0aG9kIGdldENsaWVudFxuICAgKiBAc3RhdGljXG4gICAqIEBwYXJhbSAge3N0cmluZ30gYXBwSWRcbiAgICogQHJldHVybiB7bGF5ZXIuQ2xpZW50fVxuICAgKi9cbiAgc3RhdGljIGdldENsaWVudChhcHBJZCkge1xuICAgIHJldHVybiBDbGllbnRSZWdpc3RyeS5nZXQoYXBwSWQpO1xuICB9XG5cbiAgc3RhdGljIGRlc3Ryb3lBbGxDbGllbnRzKCkge1xuICAgIENsaWVudFJlZ2lzdHJ5LmdldEFsbCgpLmZvckVhY2goY2xpZW50ID0+IGNsaWVudC5kZXN0cm95KCkpO1xuICB9XG5cbiAgLypcbiAgICogUmVnaXN0ZXJzIGEgcGx1Z2luIHdoaWNoIGNhbiBhZGQgY2FwYWJpbGl0aWVzIHRvIHRoZSBDbGllbnQuXG4gICAqXG4gICAqIENhcGFiaWxpdGllcyBtdXN0IGJlIHRyaWdnZXJlZCBieSBFdmVudHMvRXZlbnQgTGlzdGVuZXJzLlxuICAgKlxuICAgKiBUaGlzIGNvbmNlcHQgaXMgYSBiaXQgcHJlbWF0dXJlIGFuZCB1bnVzZWQvdW50ZXN0ZWQuLi5cbiAgICogQXMgaW1wbGVtZW50ZWQsIGl0IHByb3ZpZGVzIGZvciBhIHBsdWdpbiB0aGF0IHdpbGwgYmVcbiAgICogaW5zdGFudGlhdGVkIGJ5IHRoZSBDbGllbnQgYW5kIHBhc3NlZCB0aGUgQ2xpZW50IGFzIGl0cyBwYXJhbWV0ZXIuXG4gICAqIFRoaXMgYWxsb3dzIGZvciBhIGxpYnJhcnkgb2YgcGx1Z2lucyB0aGF0IGNhbiBiZSBzaGFyZWQgYW1vbmdcbiAgICogZGlmZmVyZW50IGNvbXBhbmllcy9wcm9qZWN0cyBidXQgdGhhdCBhcmUgb3V0c2lkZSBvZiB0aGUgY29yZVxuICAgKiBhcHAgbG9naWMuXG4gICAqXG4gICAqICAgICAgLy8gRGVmaW5lIHRoZSBwbHVnaW5cbiAgICogICAgICBmdW5jdGlvbiBNeVBsdWdpbihjbGllbnQpIHtcbiAgICogICAgICAgICAgdGhpcy5jbGllbnQgPSBjbGllbnQ7XG4gICAqICAgICAgICAgIGNsaWVudC5vbignbWVzc2FnZXM6YWRkJywgdGhpcy5vbk1lc3NhZ2VzQWRkLCB0aGlzKTtcbiAgICogICAgICB9XG4gICAqXG4gICAqICAgICAgTXlQbHVnaW4ucHJvdG90eXBlLm9uTWVzc2FnZXNBZGQgPSBmdW5jdGlvbihldmVudCkge1xuICAgKiAgICAgICAgICB2YXIgbWVzc2FnZXMgPSBldmVudC5tZXNzYWdlcztcbiAgICogICAgICAgICAgYWxlcnQoJ1lvdSBub3cgaGF2ZSAnICsgbWVzc2FnZXMubGVuZ3RoICArICcgbWVzc2FnZXMnKTtcbiAgICogICAgICB9XG4gICAqXG4gICAqICAgICAgLy8gUmVnaXN0ZXIgdGhlIFBsdWdpblxuICAgKiAgICAgIENsaWVudC5yZWdpc3RlclBsdWdpbignbXlQbHVnaW4zNCcsIE15UGx1Z2luKTtcbiAgICpcbiAgICogICAgICB2YXIgY2xpZW50ID0gbmV3IENsaWVudCh7YXBwSWQ6ICdsYXllcjovLy9hcHBzL3N0YWdpbmcvdXVpZCd9KTtcbiAgICpcbiAgICogICAgICAvLyBUcmlnZ2VyIHRoZSBwbHVnaW4ncyBiZWhhdmlvclxuICAgKiAgICAgIGNsaWVudC5teVBsdWdpbjM0LmFkZE1lc3NhZ2VzKHttZXNzYWdlczpbXX0pO1xuICAgKlxuICAgKiBAbWV0aG9kIHJlZ2lzdGVyUGx1Z2luXG4gICAqIEBzdGF0aWNcbiAgICogQHBhcmFtICB7c3RyaW5nfSBuYW1lICAgICBbZGVzY3JpcHRpb25dXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjbGFzc0RlZiBbZGVzY3JpcHRpb25dXG4gICAqL1xuICBzdGF0aWMgcmVnaXN0ZXJQbHVnaW4obmFtZSwgY2xhc3NEZWYpIHtcbiAgICBDbGllbnQucGx1Z2luc1tuYW1lXSA9IGNsYXNzRGVmO1xuICB9XG5cbn1cblxuLyoqXG4gKiBIYXNoIG9mIGxheWVyLkNvbnZlcnNhdGlvbiBvYmplY3RzIGZvciBxdWljayBsb29rdXAgYnkgaWRcbiAqXG4gKiBAcHJpdmF0ZVxuICogQHByb3BlcnR5IHtPYmplY3R9XG4gKi9cbkNsaWVudC5wcm90b3R5cGUuX2NvbnZlcnNhdGlvbnNIYXNoID0gbnVsbDtcblxuLyoqXG4gKiBIYXNoIG9mIGxheWVyLk1lc3NhZ2Ugb2JqZWN0cyBmb3IgcXVpY2sgbG9va3VwIGJ5IGlkXG4gKlxuICogQHByaXZhdGVcbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cbkNsaWVudC5wcm90b3R5cGUuX21lc3NhZ2VzSGFzaCA9IG51bGw7XG5cbi8qKlxuICogSGFzaCBvZiBsYXllci5RdWVyeSBvYmplY3RzIGZvciBxdWljayBsb29rdXAgYnkgaWRcbiAqXG4gKiBAcHJpdmF0ZVxuICogQHR5cGUge09iamVjdH1cbiAqL1xuQ2xpZW50LnByb3RvdHlwZS5fcXVlcmllc0hhc2ggPSBudWxsO1xuXG4vKipcbiAqIEFycmF5IG9mIGl0ZW1zIHRvIGJlIGNoZWNrZWQgdG8gc2VlIGlmIHRoZXkgY2FuIGJlIHVuY2FjaGVkLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAdHlwZSB7bGF5ZXIuUm9vdFtdfVxuICovXG5DbGllbnQucHJvdG90eXBlLl9zY2hlZHVsZUNoZWNrQW5kUHVyZ2VDYWNoZUl0ZW1zID0gbnVsbDtcblxuLyoqXG4gKiBUaW1lIHRoYXQgdGhlIG5leHQgY2FsbCB0byBfcnVuQ2hlY2tBbmRQdXJnZUNhY2hlKCkgaXMgc2NoZWR1bGVkIGZvciBpbiBtcyBzaW5jZSAxOTcwLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5DbGllbnQucHJvdG90eXBlLl9zY2hlZHVsZUNoZWNrQW5kUHVyZ2VDYWNoZUF0ID0gMDtcblxuLyoqXG4gKiBHZXQgdGhlIHZlcnNpb24gb2YgdGhlIENsaWVudCBsaWJyYXJ5LlxuICpcbiAqIEBzdGF0aWNcbiAqIEB0eXBlIHtTdHJpbmd9XG4gKi9cbkNsaWVudC52ZXJzaW9uID0gJzMuMC4wJztcblxuLyoqXG4gKiBBbnkgQ29udmVyc2F0aW9uIG9yIE1lc3NhZ2UgdGhhdCBpcyBwYXJ0IG9mIGEgUXVlcnkncyByZXN1bHRzIGFyZSBrZXB0IGluIG1lbW9yeSBmb3IgYXMgbG9uZyBhcyBpdFxuICogcmVtYWlucyBpbiB0aGF0IFF1ZXJ5LiAgSG93ZXZlciwgd2hlbiBhIHdlYnNvY2tldCBldmVudCBkZWxpdmVycyBuZXcgTWVzc2FnZXMgYW5kIENvbnZlcnNhdGlvbnMgdGhhdFxuICogYXJlIE5PVCBwYXJ0IG9mIGEgUXVlcnksIGhvdyBsb25nIHNob3VsZCB0aGV5IHN0aWNrIGFyb3VuZCBpbiBtZW1vcnk/ICBXaHkgaGF2ZSB0aGVtIHN0aWNrIGFyb3VuZD9cbiAqIFBlcmhhcHMgYW4gYXBwIHdhbnRzIHRvIHBvc3QgYSBub3RpZmljYXRpb24gb2YgYSBuZXcgTWVzc2FnZSBvciBDb252ZXJzYXRpb24uLi4gYW5kIHdhbnRzIHRvIGtlZXBcbiAqIHRoZSBvYmplY3QgbG9jYWwgZm9yIGEgbGl0dGxlIHdoaWxlLiAgRGVmYXVsdCBpcyAxMCBtaW51dGVzIGJlZm9yZSBjaGVja2luZyB0byBzZWUgaWZcbiAqIHRoZSBvYmplY3QgaXMgcGFydCBvZiBhIFF1ZXJ5IG9yIGNhbiBiZSB1bmNhY2hlZC4gIFZhbHVlIGlzIGluIG1pbGlzZWNvbmRzLlxuICogQHN0YXRpY1xuICogQHR5cGUge251bWJlcn1cbiAqL1xuQ2xpZW50LkNBQ0hFX1BVUkdFX0lOVEVSVkFMID0gMTAgKiA2MCAqIDEwMDA7XG5cbkNsaWVudC5faWdub3JlZEV2ZW50cyA9IFtcbiAgJ2NvbnZlcnNhdGlvbnM6bG9hZGVkJyxcbiAgJ2NvbnZlcnNhdGlvbnM6bG9hZGVkLWVycm9yJyxcbl07XG5cbkNsaWVudC5fc3VwcG9ydGVkRXZlbnRzID0gW1xuXG4gIC8qKlxuICAgKiBPbmUgb3IgbW9yZSBsYXllci5Db252ZXJzYXRpb24gb2JqZWN0cyBoYXZlIGJlZW4gYWRkZWQgdG8gdGhlIGNsaWVudC5cbiAgICpcbiAgICogVGhleSBtYXkgaGF2ZSBiZWVuIGFkZGVkIHZpYSB0aGUgd2Vic29ja2V0LCBvciB2aWEgdGhlIHVzZXIgY3JlYXRpbmdcbiAgICogYSBuZXcgQ29udmVyc2F0aW9uIGxvY2FsbHkuXG4gICAqXG4gICAqICAgICAgY2xpZW50Lm9uKCdjb252ZXJzYXRpb25zOmFkZCcsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICAgICAgICBldnQuY29udmVyc2F0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKGNvbnZlcnNhdGlvbikge1xuICAgKiAgICAgICAgICAgICAgbXlWaWV3LmFkZENvbnZlcnNhdGlvbihjb252ZXJzYXRpb24pO1xuICAgKiAgICAgICAgICB9KTtcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqIEBwYXJhbSB7bGF5ZXIuQ29udmVyc2F0aW9uW119IGV2dC5jb252ZXJzYXRpb25zIC0gQXJyYXkgb2YgY29udmVyc2F0aW9ucyBhZGRlZFxuICAgKi9cbiAgJ2NvbnZlcnNhdGlvbnM6YWRkJyxcblxuICAvKipcbiAgICogT25lIG9yIG1vcmUgbGF5ZXIuQ29udmVyc2F0aW9uIG9iamVjdHMgaGF2ZSBiZWVuIHJlbW92ZWQuXG4gICAqXG4gICAqIEEgcmVtb3ZlZCBDb252ZXJzYXRpb24gaXMgbm90IG5lY2Vzc2FyaWx5IGRlbGV0ZWQsIGl0cyBqdXN0XG4gICAqIG5vIGxvbmdlciBiZWluZyBoZWxkIGluIGxvY2FsIG1lbW9yeS5cbiAgICpcbiAgICogTm90ZSB0aGF0IHR5cGljYWxseSB5b3Ugd2lsbCB3YW50IHRoZSBjb252ZXJzYXRpb25zOmRlbGV0ZSBldmVudFxuICAgKiByYXRoZXIgdGhhbiBjb252ZXJzYXRpb25zOnJlbW92ZS5cbiAgICpcbiAgICogICAgICBjbGllbnQub24oJ2NvbnZlcnNhdGlvbnM6cmVtb3ZlJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgICAgICAgIGV2dC5jb252ZXJzYXRpb25zLmZvckVhY2goZnVuY3Rpb24oY29udmVyc2F0aW9uKSB7XG4gICAqICAgICAgICAgICAgICBteVZpZXcucmVtb3ZlQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbik7XG4gICAqICAgICAgICAgIH0pO1xuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQHBhcmFtIHtsYXllci5Db252ZXJzYXRpb25bXX0gZXZ0LmNvbnZlcnNhdGlvbnMgLSBBcnJheSBvZiBjb252ZXJzYXRpb25zIHJlbW92ZWRcbiAgICovXG4gICdjb252ZXJzYXRpb25zOnJlbW92ZScsXG5cbiAgLyoqXG4gICAqIFRoZSBjb252ZXJzYXRpb24gaXMgbm93IG9uIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIENhbGxlZCBhZnRlciBjcmVhdGluZyB0aGUgY29udmVyc2F0aW9uXG4gICAqIG9uIHRoZSBzZXJ2ZXIuICBUaGUgUmVzdWx0IHByb3BlcnR5IGlzIG9uZSBvZjpcbiAgICpcbiAgICogKiBsYXllci5Db252ZXJzYXRpb24uQ1JFQVRFRDogQSBuZXcgQ29udmVyc2F0aW9uIGhhcyBiZWVuIGNyZWF0ZWRcbiAgICogKiBsYXllci5Db252ZXJzYXRpb24uRk9VTkQ6IEEgbWF0Y2hpbmcgRGlzdGluY3QgQ29udmVyc2F0aW9uIGhhcyBiZWVuIGZvdW5kXG4gICAqICogbGF5ZXIuQ29udmVyc2F0aW9uLkZPVU5EX1dJVEhPVVRfUkVRVUVTVEVEX01FVEFEQVRBOiBBIG1hdGNoaW5nIERpc3RpbmN0IENvbnZlcnNhdGlvbiBoYXMgYmVlbiBmb3VuZFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgYnV0IG5vdGUgdGhhdCB0aGUgbWV0YWRhdGEgaXMgTk9UIHdoYXQgeW91IHJlcXVlc3RlZC5cbiAgICpcbiAgICogQWxsIG9mIHRoZXNlIHJlc3VsdHMgd2lsbCBhbHNvIG1lYW4gdGhhdCB0aGUgdXBkYXRlZCBwcm9wZXJ0eSB2YWx1ZXMgaGF2ZSBiZWVuXG4gICAqIGNvcGllZCBpbnRvIHlvdXIgQ29udmVyc2F0aW9uIG9iamVjdC4gIFRoYXQgbWVhbnMgeW91ciBtZXRhZGF0YSBwcm9wZXJ0eSBtYXkgbm9cbiAgICogbG9uZ2VyIGJlIGl0cyBpbml0aWFsIHZhbHVlOyBpdCB3aWxsIGJlIHRoZSB2YWx1ZSBmb3VuZCBvbiB0aGUgc2VydmVyLlxuICAgKlxuICAgKiAgICAgIGNsaWVudC5vbignY29udmVyc2F0aW9uczpzZW50JywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgICAgICAgIHN3aXRjaChldnQucmVzdWx0KSB7XG4gICAqICAgICAgICAgICAgICBjYXNlIENvbnZlcnNhdGlvbi5DUkVBVEVEOlxuICAgKiAgICAgICAgICAgICAgICAgIGFsZXJ0KGV2dC50YXJnZXQuaWQgKyAnIENyZWF0ZWQhJyk7XG4gICAqICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAqICAgICAgICAgICAgICBjYXNlIENvbnZlcnNhdGlvbi5GT1VORDpcbiAgICogICAgICAgICAgICAgICAgICBhbGVydChldnQudGFyZ2V0LmlkICsgJyBGb3VuZCEnKTtcbiAgICogICAgICAgICAgICAgICAgICBicmVhaztcbiAgICogICAgICAgICAgICAgIGNhc2UgQ29udmVyc2F0aW9uLkZPVU5EX1dJVEhPVVRfUkVRVUVTVEVEX01FVEFEQVRBOlxuICAgKiAgICAgICAgICAgICAgICAgIGFsZXJ0KGV2dC50YXJnZXQuaWQgKyAnIEZvdW5kLCBidXQgZG9lcyBub3QgaGF2ZSB0aGUgcmVxdWVzdGVkIG1ldGFkYXRhIScpO1xuICAgKiAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgKiAgICAgICAgICB9XG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2ZW50XG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudC5yZXN1bHRcbiAgICogQHBhcmFtIHtsYXllci5Db252ZXJzYXRpb259IHRhcmdldFxuICAgKi9cbiAgJ2NvbnZlcnNhdGlvbnM6c2VudCcsXG5cbiAgLyoqXG4gICAqIEEgY29udmVyc2F0aW9uIGZhaWxlZCB0byBsb2FkIG9yIGNyZWF0ZSBvbiB0aGUgc2VydmVyLlxuICAgKlxuICAgKiAgICAgIGNsaWVudC5vbignY29udmVyc2F0aW9uczpzZW50LWVycm9yJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgICAgICAgIGFsZXJ0KGV2dC5kYXRhLm1lc3NhZ2UpO1xuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckVycm9yfSBldnQuZGF0YVxuICAgKiBAcGFyYW0ge2xheWVyLkNvbnZlcnNhdGlvbn0gdGFyZ2V0XG4gICAqL1xuICAnY29udmVyc2F0aW9uczpzZW50LWVycm9yJyxcblxuICAvKipcbiAgICogQSBjb252ZXJzYXRpb24gaGFkIGEgY2hhbmdlIGluIGl0cyBwcm9wZXJ0aWVzLlxuICAgKlxuICAgKiBUaGlzIGNoYW5nZSBtYXkgaGF2ZSBiZWVuIGRlbGl2ZXJlZCBmcm9tIGEgcmVtb3RlIHVzZXJcbiAgICogb3IgYXMgYSByZXN1bHQgb2YgYSBsb2NhbCBvcGVyYXRpb24uXG4gICAqXG4gICAqICAgICAgY2xpZW50Lm9uKCdjb252ZXJzYXRpb25zOmNoYW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICAgICAgICB2YXIgbWV0YWRhdGFDaGFuZ2VzID0gZXZ0LmdldENoYW5nZXNGb3IoJ21ldGFkYXRhJyk7XG4gICAqICAgICAgICAgIHZhciBwYXJ0aWNpcGFudENoYW5nZXMgPSBldnQuZ2V0Q2hhbmdlc0ZvcigncGFydGljaXBhbnRzJyk7XG4gICAqICAgICAgICAgIGlmIChtZXRhZGF0YUNoYW5nZXMubGVuZ3RoKSB7XG4gICAqICAgICAgICAgICAgICBteVZpZXcucmVuZGVyVGl0bGUoZXZ0LnRhcmdldC5tZXRhZGF0YS50aXRsZSk7XG4gICAqICAgICAgICAgIH1cbiAgICogICAgICAgICAgaWYgKHBhcnRpY2lwYW50Q2hhbmdlcy5sZW5ndGgpIHtcbiAgICogICAgICAgICAgICAgIG15Vmlldy5yZW5kZXJQYXJ0aWNpcGFudHMoZXZ0LnRhcmdldC5wYXJ0aWNpcGFudHMpO1xuICAgKiAgICAgICAgICB9XG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIE5PVEU6IFR5cGljYWxseSBzdWNoIHJlbmRlcmluZyBpcyBkb25lIHVzaW5nIEV2ZW50cyBvbiBsYXllci5RdWVyeS5cbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqIEBwYXJhbSB7bGF5ZXIuQ29udmVyc2F0aW9ufSBldnQudGFyZ2V0XG4gICAqIEBwYXJhbSB7T2JqZWN0W119IGV2dC5jaGFuZ2VzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGV2dC5jaGFuZ2VzLm5ld1ZhbHVlXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGV2dC5jaGFuZ2VzLm9sZFZhbHVlXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldnQuY2hhbmdlcy5wcm9wZXJ0eSAtIE5hbWUgb2YgdGhlIHByb3BlcnR5IHRoYXQgaGFzIGNoYW5nZWRcbiAgICovXG4gICdjb252ZXJzYXRpb25zOmNoYW5nZScsXG5cbiAgLyoqXG4gICAqIEEgY2FsbCB0byBsYXllci5Db252ZXJzYXRpb24ubG9hZCBoYXMgY29tcGxldGVkIHN1Y2Nlc3NmdWxseVxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQHBhcmFtIHtsYXllci5Db252ZXJzYXRpb259IGV2dC50YXJnZXRcbiAgICovXG4gICdjb252ZXJzYXRpb25zOmxvYWRlZCcsXG5cbiAgLyoqXG4gICAqIEEgbmV3IG1lc3NhZ2UgaGFzIGJlZW4gcmVjZWl2ZWQgZm9yIHdoaWNoIGEgbm90aWZpY2F0aW9uIG1heSBiZSBzdWl0YWJsZS5cbiAgICpcbiAgICogVGhpcyBldmVudCBpcyB0cmlnZ2VyZWQgZm9yIG1lc3NhZ2VzIHRoYXQgYXJlOlxuICAgKlxuICAgKiAxLiBBZGRlZCB2aWEgd2Vic29ja2V0IHJhdGhlciB0aGFuIG90aGVyIElPXG4gICAqIDIuIE5vdCB5ZXQgYmVlbiBtYXJrZWQgYXMgcmVhZFxuICAgKiAzLiBOb3Qgc2VudCBieSB0aGlzIHVzZXJcbiAgICpcbiAgICAgICAgICBjbGllbnQub24oJ21lc3NhZ2VzOm5vdGlmeScsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICAgICAgICBteU5vdGlmeShldnQubWVzc2FnZSk7XG4gICAgICAgICAgfSlcbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqIEBwYXJhbSB7bGF5ZXIuTWVzc2FnZX0gZXZ0Lk1lc3NhZ2VcbiAgICovXG4gICdtZXNzYWdlczpub3RpZnknLFxuXG4gIC8qKlxuICAgKiBNZXNzYWdlcyBoYXZlIGJlZW4gYWRkZWQgdG8gYSBjb252ZXJzYXRpb24uXG4gICAqXG4gICAqIE1heSBhbHNvIGZpcmUgd2hlbiBuZXcgQW5ub3VuY2VtZW50cyBhcmUgcmVjZWl2ZWQuXG4gICAqXG4gICAqIFRoaXMgZXZlbnQgaXMgdHJpZ2dlcmVkIG9uXG4gICAqXG4gICAqICogY3JlYXRpbmcvc2VuZGluZyBhIG5ldyBtZXNzYWdlXG4gICAqICogUmVjZWl2aW5nIGEgbmV3IGxheWVyLk1lc3NhZ2Ugb3IgbGF5ZXIuQW5ub3VuY2VtZW50IHZpYSB3ZWJzb2NrZXRcbiAgICogKiBRdWVyeWluZy9kb3dubG9hZGluZyBhIHNldCBvZiBNZXNzYWdlc1xuICAgKlxuICAgICAgICAgIGNsaWVudC5vbignbWVzc2FnZXM6YWRkJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgICAgICAgIGV2dC5tZXNzYWdlcy5mb3JFYWNoKGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICAgIG15Vmlldy5hZGRNZXNzYWdlKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICpcbiAgICogTk9URTogU3VjaCByZW5kZXJpbmcgd291bGQgdHlwaWNhbGx5IGJlIGRvbmUgdXNpbmcgZXZlbnRzIG9uIGxheWVyLlF1ZXJ5LlxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQHBhcmFtIHtsYXllci5NZXNzYWdlW119IGV2dC5tZXNzYWdlc1xuICAgKi9cbiAgJ21lc3NhZ2VzOmFkZCcsXG5cbiAgLyoqXG4gICAqIEEgbWVzc2FnZSBoYXMgYmVlbiByZW1vdmVkIGZyb20gYSBjb252ZXJzYXRpb24uXG4gICAqXG4gICAqIEEgcmVtb3ZlZCBNZXNzYWdlIGlzIG5vdCBuZWNlc3NhcmlseSBkZWxldGVkLFxuICAgKiBqdXN0IG5vIGxvbmdlciBiZWluZyBoZWxkIGluIG1lbW9yeS5cbiAgICpcbiAgICogTm90ZSB0aGF0IHR5cGljYWxseSB5b3Ugd2lsbCB3YW50IHRoZSBtZXNzYWdlczpkZWxldGUgZXZlbnRcbiAgICogcmF0aGVyIHRoYW4gbWVzc2FnZXM6cmVtb3ZlLlxuICAgKlxuICAgKiAgICAgIGNsaWVudC5vbignbWVzc2FnZXM6cmVtb3ZlJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgICAgICAgIGV2dC5tZXNzYWdlcy5mb3JFYWNoKGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgICogICAgICAgICAgICAgIG15Vmlldy5yZW1vdmVNZXNzYWdlKG1lc3NhZ2UpO1xuICAgKiAgICAgICAgICB9KTtcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogTk9URTogU3VjaCByZW5kZXJpbmcgd291bGQgdHlwaWNhbGx5IGJlIGRvbmUgdXNpbmcgZXZlbnRzIG9uIGxheWVyLlF1ZXJ5LlxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQHBhcmFtIHtsYXllci5NZXNzYWdlfSBldnQubWVzc2FnZVxuICAgKi9cbiAgJ21lc3NhZ2VzOnJlbW92ZScsXG5cbiAgLyoqXG4gICAqIEEgbWVzc2FnZSBoYXMgYmVlbiBzZW50LlxuICAgKlxuICAgKiAgICAgIGNsaWVudC5vbignbWVzc2FnZXM6c2VudCcsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICAgICAgICBhbGVydChldnQudGFyZ2V0LmdldFRleHQoKSArICcgaGFzIGJlZW4gc2VudCcpO1xuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQHBhcmFtIHtsYXllci5NZXNzYWdlfSBldnQudGFyZ2V0XG4gICAqL1xuICAnbWVzc2FnZXM6c2VudCcsXG5cbiAgLyoqXG4gICAqIEEgbWVzc2FnZSBpcyBhYm91dCB0byBiZSBzZW50LlxuICAgKlxuICAgKiBVc2VmdWwgaWYgeW91IHdhbnQgdG9cbiAgICogYWRkIHBhcnRzIHRvIHRoZSBtZXNzYWdlIGJlZm9yZSBpdCBnb2VzIG91dC5cbiAgICpcbiAgICogICAgICBjbGllbnQub24oJ21lc3NhZ2VzOnNlbmRpbmcnLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgICAgICAgZXZ0LnRhcmdldC5hZGRQYXJ0KHtcbiAgICogICAgICAgICAgICAgIG1pbWVUeXBlOiAndGV4dC9wbGFpbicsXG4gICAqICAgICAgICAgICAgICBib2R5OiAndGhpcyBpcyBqdXN0IGEgdGVzdCdcbiAgICogICAgICAgICAgfSk7XG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKiBAcGFyYW0ge2xheWVyLk1lc3NhZ2V9IGV2dC50YXJnZXRcbiAgICovXG4gICdtZXNzYWdlczpzZW5kaW5nJyxcblxuICAvKipcbiAgICogU2VydmVyIGZhaWxlZCB0byByZWNlaXZlIGEgTWVzc2FnZS5cbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFcnJvcn0gZXZ0LmVycm9yXG4gICAqL1xuICAnbWVzc2FnZXM6c2VudC1lcnJvcicsXG5cbiAgLyoqXG4gICAqIEEgbWVzc2FnZSBoYXMgaGFkIGEgY2hhbmdlIGluIGl0cyBwcm9wZXJ0aWVzLlxuICAgKlxuICAgKiBUaGlzIGNoYW5nZSBtYXkgaGF2ZSBiZWVuIGRlbGl2ZXJlZCBmcm9tIGEgcmVtb3RlIHVzZXJcbiAgICogb3IgYXMgYSByZXN1bHQgb2YgYSBsb2NhbCBvcGVyYXRpb24uXG4gICAqXG4gICAqICAgICAgY2xpZW50Lm9uKCdtZXNzYWdlczpjaGFuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgICAgICAgdmFyIHJlY3BpZW50U3RhdHVzQ2hhbmdlcyA9IGV2dC5nZXRDaGFuZ2VzRm9yKCdyZWNpcGllbnRTdGF0dXMnKTtcbiAgICogICAgICAgICAgaWYgKHJlY3BpZW50U3RhdHVzQ2hhbmdlcy5sZW5ndGgpIHtcbiAgICogICAgICAgICAgICAgIG15Vmlldy5yZW5kZXJTdGF0dXMoZXZ0LnRhcmdldCk7XG4gICAqICAgICAgICAgIH1cbiAgICogICAgICB9KTtcbiAgICpcbiAgICogTk9URTogU3VjaCByZW5kZXJpbmcgd291bGQgdHlwaWNhbGx5IGJlIGRvbmUgdXNpbmcgZXZlbnRzIG9uIGxheWVyLlF1ZXJ5LlxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQHBhcmFtIHtsYXllci5NZXNzYWdlfSBldnQudGFyZ2V0XG4gICAqIEBwYXJhbSB7T2JqZWN0W119IGV2dC5jaGFuZ2VzXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGV2dC5jaGFuZ2VzLm5ld1ZhbHVlXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGV2dC5jaGFuZ2VzLm9sZFZhbHVlXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldnQuY2hhbmdlcy5wcm9wZXJ0eSAtIE5hbWUgb2YgdGhlIHByb3BlcnR5IHRoYXQgaGFzIGNoYW5nZWRcbiAgICovXG4gICdtZXNzYWdlczpjaGFuZ2UnLFxuXG5cbiAgLyoqXG4gICAqIEEgY2FsbCB0byBsYXllci5NZXNzYWdlLmxvYWQgaGFzIGNvbXBsZXRlZCBzdWNjZXNzZnVsbHlcbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqIEBwYXJhbSB7bGF5ZXIuTWVzc2FnZX0gZXZ0LnRhcmdldFxuICAgKi9cbiAgJ21lc3NhZ2VzOmxvYWRlZCcsXG5cbiAgLyoqXG4gICAqIEEgQ29udmVyc2F0aW9uIGhhcyBiZWVuIGRlbGV0ZWQgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBDYXVzZWQgYnkgZWl0aGVyIGEgc3VjY2Vzc2Z1bCBjYWxsIHRvIGxheWVyLkNvbnZlcnNhdGlvbi5kZWxldGUoKSBvbiB0aGUgQ29udmVyc2F0aW9uXG4gICAqIG9yIGJ5IGEgcmVtb3RlIHVzZXIuXG4gICAqXG4gICAqICAgICAgY2xpZW50Lm9uKCdjb252ZXJzYXRpb25zOmRlbGV0ZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICAgICAgICBteVZpZXcucmVtb3ZlQ29udmVyc2F0aW9uKGV2dC50YXJnZXQpO1xuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQHBhcmFtIHtsYXllci5Db252ZXJzYXRpb259IGV2dC50YXJnZXRcbiAgICovXG4gICdjb252ZXJzYXRpb25zOmRlbGV0ZScsXG5cbiAgLyoqXG4gICAqIEEgTWVzc2FnZSBoYXMgYmVlbiBkZWxldGVkIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQ2F1c2VkIGJ5IGVpdGhlciBhIHN1Y2Nlc3NmdWwgY2FsbCB0byBsYXllci5NZXNzYWdlLmRlbGV0ZSgpIG9uIHRoZSBNZXNzYWdlXG4gICAqIG9yIGJ5IGEgcmVtb3RlIHVzZXIuXG4gICAqXG4gICAqICAgICAgY2xpZW50Lm9uKCdtZXNzYWdlczpkZWxldGUnLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgICAgICAgbXlWaWV3LnJlbW92ZU1lc3NhZ2UoZXZ0LnRhcmdldCk7XG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKiBAcGFyYW0ge2xheWVyLk1lc3NhZ2V9IGV2dC50YXJnZXRcbiAgICovXG4gICdtZXNzYWdlczpkZWxldGUnLFxuXG4gIC8qKlxuICAgKiBBIGNhbGwgdG8gbGF5ZXIuSWRlbnRpdHkubG9hZCBoYXMgY29tcGxldGVkIHN1Y2Nlc3NmdWxseVxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQHBhcmFtIHtsYXllci5NZXNzYWdlfSBldnQudGFyZ2V0XG4gICAqL1xuICAnaWRlbnRpdGllczpsb2FkZWQnLFxuXG4gIC8qKlxuICAgKiBBbiBJZGVudGl0eSBoYXMgaGFkIGEgY2hhbmdlIGluIGl0cyBwcm9wZXJ0aWVzLlxuICAgKlxuICAgKiBDaGFuZ2VzIG9jY3VyIHdoZW4gbmV3IGRhdGEgYXJyaXZlcyBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqICAgICAgY2xpZW50Lm9uKCdpZGVudGl0aWVzOmNoYW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICAgICAgICB2YXIgZGlzcGxheU5hbWVDaGFuZ2VzID0gZXZ0LmdldENoYW5nZXNGb3IoJ2Rpc3BsYXlOYW1lJyk7XG4gICAqICAgICAgICAgIGlmIChkaXNwbGF5TmFtZUNoYW5nZXMubGVuZ3RoKSB7XG4gICAqICAgICAgICAgICAgICBteVZpZXcucmVuZGVyU3RhdHVzKGV2dC50YXJnZXQpO1xuICAgKiAgICAgICAgICB9XG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKiBAcGFyYW0ge2xheWVyLk1lc3NhZ2V9IGV2dC50YXJnZXRcbiAgICogQHBhcmFtIHtPYmplY3RbXX0gZXZ0LmNoYW5nZXNcbiAgICogQHBhcmFtIHtNaXhlZH0gZXZ0LmNoYW5nZXMubmV3VmFsdWVcbiAgICogQHBhcmFtIHtNaXhlZH0gZXZ0LmNoYW5nZXMub2xkVmFsdWVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2dC5jaGFuZ2VzLnByb3BlcnR5IC0gTmFtZSBvZiB0aGUgcHJvcGVydHkgdGhhdCBoYXMgY2hhbmdlZFxuICAgKi9cbiAgJ2lkZW50aXRpZXM6Y2hhbmdlJyxcblxuICAvKipcbiAgICogSWRlbnRpdGllcyBoYXZlIGJlZW4gYWRkZWQgdG8gdGhlIENsaWVudC5cbiAgICpcbiAgICogVGhpcyBldmVudCBpcyB0cmlnZ2VyZWQgd2hlbmV2ZXIgYSBuZXcgbGF5ZXIuSWRlbnRpdHkgKEZ1bGwgaWRlbnRpdHkgb3Igbm90KVxuICAgKiBoYXMgYmVlbiByZWNlaXZlZCBieSB0aGUgQ2xpZW50LlxuICAgKlxuICAgICAgICAgIGNsaWVudC5vbignaWRlbnRpdGllczphZGQnLCBmdW5jdGlvbihldnQpIHtcbiAgICAgICAgICAgICAgZXZ0LmlkZW50aXRpZXMuZm9yRWFjaChmdW5jdGlvbihpZGVudGl0eSkge1xuICAgICAgICAgICAgICAgICAgbXlWaWV3LmFkZElkZW50aXR5KGlkZW50aXR5KTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKiBAcGFyYW0ge2xheWVyLklkZW50aXR5W119IGV2dC5pZGVudGl0aWVzXG4gICAqL1xuICAnaWRlbnRpdGllczphZGQnLFxuXG4gIC8qKlxuICAgKiBJZGVudGl0aWVzIGhhdmUgYmVlbiByZW1vdmVkIGZyb20gdGhlIENsaWVudC5cbiAgICpcbiAgICogVGhpcyBkb2VzIG5vdCB0eXBpY2FsbHkgb2NjdXIuXG4gICAqXG4gICAgICAgICAgY2xpZW50Lm9uKCdpZGVudGl0aWVzOnJlbW92ZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgICAgICAgICAgICBldnQuaWRlbnRpdGllcy5mb3JFYWNoKGZ1bmN0aW9uKGlkZW50aXR5KSB7XG4gICAgICAgICAgICAgICAgICBteVZpZXcuYWRkSWRlbnRpdHkoaWRlbnRpdHkpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqIEBwYXJhbSB7bGF5ZXIuSWRlbnRpdHlbXX0gZXZ0LmlkZW50aXRpZXNcbiAgICovXG4gICdpZGVudGl0aWVzOnJlbW92ZScsXG5cbiAgLyoqXG4gICAqIEFuIElkZW50aXR5IGhhcyBiZWVuIHVuZm9sbG93ZWQgb3IgZGVsZXRlZC5cbiAgICpcbiAgICogV2UgZG8gbm90IGRlbGV0ZSBzdWNoIElkZW50aXRpZXMgZW50aXJlbHkgZnJvbSB0aGUgQ2xpZW50IGFzXG4gICAqIHRoZXJlIGFyZSBzdGlsbCBNZXNzYWdlcyBmcm9tIHRoZXNlIElkZW50aXRpZXMgdG8gYmUgcmVuZGVyZWQsXG4gICAqIGJ1dCB3ZSBkbyBkb3duZ3JhZGUgdGhlbSBmcm9tIEZ1bGwgSWRlbnRpdHkgdG8gQmFzaWMgSWRlbnRpdHkuXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKiBAcGFyYW0ge2xheWVyLklkZW50aXR5fSBldnQudGFyZ2V0XG4gICAqL1xuICAnaWRlbnRpdGllczp1bmZvbGxvdycsXG5cblxuICAvKipcbiAgICogQSBUeXBpbmcgSW5kaWNhdG9yIHN0YXRlIGhhcyBjaGFuZ2VkLlxuICAgKlxuICAgKiBFaXRoZXIgYSBjaGFuZ2UgaGFzIGJlZW4gcmVjZWl2ZWRcbiAgICogZnJvbSB0aGUgc2VydmVyLCBvciBhIHR5cGluZyBpbmRpY2F0b3Igc3RhdGUgaGFzIGV4cGlyZWQuXG4gICAqXG4gICAqICAgICAgY2xpZW50Lm9uKCd0eXBpbmctaW5kaWNhdG9yLWNoYW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICAgICAgICBpZiAoZXZ0LmNvbnZlcnNhdGlvbklkID09PSBteUNvbnZlcnNhdGlvbklkKSB7XG4gICAqICAgICAgICAgICAgICBhbGVydChldnQudHlwaW5nLmpvaW4oJywgJykgKyAnIGFyZSB0eXBpbmcnKTtcbiAgICogICAgICAgICAgICAgIGFsZXJ0KGV2dC5wYXVzZWQuam9pbignLCAnKSArICcgYXJlIHBhdXNlZCcpO1xuICAgKiAgICAgICAgICB9XG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKiBAcGFyYW0ge3N0cmluZ30gY29udmVyc2F0aW9uSWQgLSBJRCBvZiB0aGUgQ29udmVyc2F0aW9uIHVzZXJzIGFyZSB0eXBpbmcgaW50b1xuICAgKiBAcGFyYW0ge3N0cmluZ1tdfSB0eXBpbmcgLSBBcnJheSBvZiB1c2VyIElEcyB3aG8gYXJlIGN1cnJlbnRseSB0eXBpbmdcbiAgICogQHBhcmFtIHtzdHJpbmdbXX0gcGF1c2VkIC0gQXJyYXkgb2YgdXNlciBJRHMgd2hvIGFyZSBjdXJyZW50bHkgcGF1c2VkO1xuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICBBIHBhdXNlZCB1c2VyIHN0aWxsIGhhcyB0ZXh0IGluIHRoZWlyIHRleHQgYm94LlxuICAgKi9cbiAgJ3R5cGluZy1pbmRpY2F0b3ItY2hhbmdlJyxcblxuXG5dLmNvbmNhdChDbGllbnRBdXRoLl9zdXBwb3J0ZWRFdmVudHMpO1xuXG5DbGllbnQucGx1Z2lucyA9IHt9O1xuXG5Sb290LmluaXRDbGFzcy5hcHBseShDbGllbnQsIFtDbGllbnQsICdDbGllbnQnXSk7XG5tb2R1bGUuZXhwb3J0cyA9IENsaWVudDtcblxuIl19
