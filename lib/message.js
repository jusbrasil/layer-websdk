'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The Message Class represents Messages sent amongst participants
 * of of a Conversation.
 *
 * The simplest way to create and send a message is:
 *
 *      var m = conversation.createMessage('Hello there').send();
 *
 * For conversations that involve notifications (primarily for Android and IOS), the more common pattern is:
 *
 *      var m = conversation.createMessage('Hello there').send({text: "Message from Fred: Hello there"});
 *
 * Typically, rendering would be done as follows:
 *
 *      // Create a layer.Query that loads Messages for the
 *      // specified Conversation.
 *      var query = client.createQuery({
 *        model: Query.Message,
 *        predicate: 'conversation = "' + conversation.id + '"'
 *      });
 *
 *      // Any time the Query's data changes the 'change'
 *      // event will fire.
 *      query.on('change', function(layerEvt) {
 *        renderNewMessages(query.data);
 *      });
 *
 *      // This will call will cause the above event handler to receive
 *      // a change event, and will update query.data.
 *      conversation.createMessage('Hello there').send();
 *
 * The above code will trigger the following events:
 *
 *  * Message Instance fires
 *    * messages:sending: An event that lets you modify the message prior to sending
 *    * messages:sent: The message was received by the server
 *  * Query Instance fires
 *    * change: The query has received a new Message
 *    * change:add: Same as the change event but does not receive other types of change events
 *
 * When creating a Message there are a number of ways to structure it.
 * All of these are valid and create the same exact Message:
 *
 *      // Full API style:
 *      var m = conversation.createMessage({
 *          parts: [new layer.MessagePart({
 *              body: 'Hello there',
 *              mimeType: 'text/plain'
 *          })]
 *      });
 *
 *      // Option 1: Pass in an Object instead of an array of layer.MessageParts
 *      var m = conversation.createMessage({
 *          parts: {
 *              body: 'Hello there',
 *              mimeType: 'text/plain'
 *          }
 *      });
 *
 *      // Option 2: Pass in an array of Objects instead of an array of layer.MessageParts
 *      var m = conversation.createMessage({
 *          parts: [{
 *              body: 'Hello there',
 *              mimeType: 'text/plain'
 *          }]
 *      });
 *
 *      // Option 3: Pass in a string (automatically assumes mimeType is text/plain)
 *      // instead of an array of objects.
 *      var m = conversation.createMessage({
 *          parts: 'Hello'
 *      });
 *
 *      // Option 4: Pass in an array of strings (automatically assumes mimeType is text/plain)
 *      var m = conversation.createMessage({
 *          parts: ['Hello']
 *      });
 *
 *      // Option 5: Pass in just a string and nothing else
 *      var m = conversation.createMessage('Hello');
 *
 *      // Option 6: Use addPart.
 *      var m = converseation.createMessage();
 *      m.addPart({body: "hello", mimeType: "text/plain"});
 *
 * Key methods, events and properties for getting started:
 *
 * Properties:
 *
 * * layer.Message.id: this property is worth being familiar with; it identifies the
 *   Message and can be used in `client.getMessage(id)` to retrieve it
 *   at any time.
 * * layer.Message.internalId: This property makes for a handy unique ID for use in dom nodes.
 *   It is gaurenteed not to change during this session.
 * * layer.Message.isRead: Indicates if the Message has been read yet; set `m.isRead = true`
 *   to tell the client and server that the message has been read.
 * * layer.Message.parts: An array of layer.MessagePart classes representing the contents of the Message.
 * * layer.Message.sentAt: Date the message was sent
 * * layer.Message.sender `userId`: Conversation participant who sent the Message. You may
 *   need to do a lookup on this id in your own servers to find a
 *   displayable name for it.
 *
 * Methods:
 *
 * * layer.Message.send(): Sends the message to the server and the other participants.
 * * layer.Message.on() and layer.Message.off(); event listeners built on top of the `backbone-events-standalone` npm project
 *
 * Events:
 *
 * * `messages:sent`: The message has been received by the server. Can also subscribe to
 *   this event from the layer.Client which is usually simpler.
 *
 * @class  layer.Message
 * @extends layer.Syncable
 */

var Root = require('./root');
var Syncable = require('./syncable');
var MessagePart = require('./message-part');
var LayerError = require('./layer-error');
var Constants = require('./const');
var Util = require('./client-utils');
var ClientRegistry = require('./client-registry');
var Identity = require('./identity');

var Message = function (_Syncable) {
  _inherits(Message, _Syncable);

  /**
   * See layer.Conversation.createMessage()
   *
   * @method constructor
   * @return {layer.Message}
   */
  function Message() {
    var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Message);

    // Unless this is a server representation, this is a developer's shorthand;
    // fill in the missing properties around isRead/isUnread before initializing.
    if (!options.fromServer) {
      if ('isUnread' in options) {
        options.isRead = !options.isUnread && !options.is_unread;
      } else {
        options.isRead = true;
      }
    } else {
      options.id = options.fromServer.id;
    }

    if (options.client) options.clientId = options.client.appId;
    if (!options.clientId) throw new Error('clientId property required to create a Message');
    if (options.conversation) options.conversationId = options.conversation.id;

    // Insure __adjustParts is set AFTER clientId is set.
    var parts = options.parts;
    options.parts = null;

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Message).call(this, options));

    _this.parts = parts;

    var client = _this.getClient();
    _this.isInitializing = true;
    if (options && options.fromServer) {
      _this._populateFromServer(options.fromServer);
    } else {
      if (client) _this.sender = client.user;
      _this.sentAt = new Date();
    }

    if (!_this.parts) _this.parts = [];

    _this._disableEvents = true;
    if (!options.fromServer) _this.recipientStatus = {};else _this.__updateRecipientStatus(_this.recipientStatus);
    _this._disableEvents = false;

    _this.isInitializing = false;
    if (options && options.fromServer) {
      client._addMessage(_this);
      var status = _this.recipientStatus[client.user.id];
      if (status && status !== Constants.RECEIPT_STATE.READ && status !== Constants.RECEIPT_STATE.DELIVERED) {
        Util.defer(function () {
          return _this._sendReceipt('delivery');
        });
      }
    }
    return _this;
  }

  /**
   * Get the layer.Conversation associated with this layer.Message.
   *
   * Uses the layer.Message.conversationId.
   *
   * @method getConversation
   * @return {layer.Conversation}
   */


  _createClass(Message, [{
    key: 'getConversation',
    value: function getConversation(load) {
      if (this.conversationId) {
        return ClientRegistry.get(this.clientId).getConversation(this.conversationId, load);
      }
      return null;
    }

    /**
     * Turn input into valid layer.MessageParts.
     *
     * This method is automatically called any time the parts
     * property is set (including during intialization).  This
     * is where we convert strings into MessageParts, and instances
     * into arrays.
     *
     * @method __adjustParts
     * @private
     * @param  {Mixed} parts -- Could be a string, array, object or MessagePart instance
     * @return {layer.MessagePart[]}
     */

  }, {
    key: '__adjustParts',
    value: function __adjustParts(parts) {
      var _this2 = this;

      if (typeof parts === 'string') {
        return [new MessagePart({
          body: parts,
          mimeType: 'text/plain',
          clientId: this.clientId
        })];
      } else if (Array.isArray(parts)) {
        return parts.map(function (part) {
          var result = void 0;
          if (part instanceof MessagePart) {
            result = part;
          } else {
            result = new MessagePart(part);
          }
          result.clientId = _this2.clientId;
          return result;
        });
      } else if (parts && (typeof parts === 'undefined' ? 'undefined' : _typeof(parts)) === 'object') {
        parts.clientId = this.clientId;
        return [new MessagePart(parts)];
      }
    }

    /**
     * Add a layer.MessagePart to this Message.
     *
     * Should only be called on an unsent Message.
     *
     * ```
     * message.addPart({mimeType: 'text/plain', body: 'Frodo really is a Dodo'});
     *
     * // OR
     * message.addPart(new layer.MessagePart({mimeType: 'text/plain', body: 'Frodo really is a Dodo'}));
     * ```
     *
     * @method addPart
     * @param  {layer.MessagePart/Object} part - A layer.MessagePart instance or a `{mimeType: 'text/plain', body: 'Hello'}` formatted Object.
     * @returns {layer.Message} this
     */

  }, {
    key: 'addPart',
    value: function addPart(part) {
      if (part) {
        part.clientId = this.clientId;
        if ((typeof part === 'undefined' ? 'undefined' : _typeof(part)) === 'object') {
          this.parts.push(new MessagePart(part));
        } else if (part instanceof MessagePart) {
          this.parts.push(part);
        }
      }
      return this;
    }

    /**
     * Accessor called whenever the app accesses `message.recipientStatus`.
     *
     * Insures that participants who haven't yet been sent the Message are marked as layer.Constants.RECEIPT_STATE.PENDING
     *
     * @method __getRecipientStatus
     * @param {string} pKey - The actual property key where the value is stored
     * @private
     * @return {Object}
     */

  }, {
    key: '__getRecipientStatus',
    value: function __getRecipientStatus(pKey) {
      var _this3 = this;

      var value = this[pKey] || {};
      var client = this.getClient();
      if (client) {
        (function () {
          var id = client.user.id;
          var conversation = _this3.getConversation(false);
          if (conversation) {
            conversation.participants.forEach(function (participant) {
              if (!value[participant.id]) {
                value[participant.id] = participant.id === id ? Constants.RECEIPT_STATE.READ : Constants.RECEIPT_STATE.PENDING;
              }
            });
          }
        })();
      }
      return value;
    }

    /**
     * Handle changes to the recipientStatus property.
     *
     * Any time the recipientStatus property is set,
     * Recalculate all of the receipt related properties:
     *
     * 1. isRead
     * 2. readStatus
     * 3. deliveryStatus
     *
     * @method __updateRecipientStatus
     * @private
     * @param  {Object} status - Object describing the delivered/read/sent value for each participant
     *
     */

  }, {
    key: '__updateRecipientStatus',
    value: function __updateRecipientStatus(status, oldStatus) {
      var conversation = this.getConversation(false);
      var client = this.getClient();

      if (!conversation || Util.doesObjectMatch(status, oldStatus)) return;

      var id = client.user.id;
      var isSender = this.sender.sessionOwner;
      var userHasRead = status[id] === Constants.RECEIPT_STATE.READ;

      try {
        // -1 so we don't count this user
        var userCount = conversation.participants.length - 1;

        // If sent by this user or read by this user, update isRead/unread
        if (!this.__isRead && (isSender || userHasRead)) {
          this.__isRead = true; // no __updateIsRead event fired
        }

        // Update the readStatus/deliveryStatus properties

        var _getReceiptStatus2 = this._getReceiptStatus(status, id);

        var readCount = _getReceiptStatus2.readCount;
        var deliveredCount = _getReceiptStatus2.deliveredCount;

        this._setReceiptStatus(readCount, deliveredCount, userCount);
      } catch (error) {}
      // Do nothing


      // Only trigger an event
      // 1. we're not initializing a new Message
      // 2. the user's state has been updated to read; we don't care about updates from other users if we aren't the sender.
      //    We also don't care about state changes to delivered; these do not inform rendering as the fact we are processing it
      //    proves its delivered.
      // 3. The user is the sender; in that case we do care about rendering receipts from other users
      if (!this.isInitializing && oldStatus) {
        var usersStateUpdatedToRead = userHasRead && oldStatus[id] !== Constants.RECEIPT_STATE.READ;
        if (usersStateUpdatedToRead || isSender) {
          this._triggerAsync('messages:change', {
            oldValue: oldStatus,
            newValue: status,
            property: 'recipientStatus'
          });
        }
      }
    }

    /**
     * Get the number of participants who have read and been delivered
     * this Message
     *
     * @method _getReceiptStatus
     * @private
     * @param  {Object} status - Object describing the delivered/read/sent value for each participant
     * @param  {string} id - Identity ID for this user; not counted when reporting on how many people have read/received.
     * @return {Object} result
     * @return {number} result.readCount
     * @return {number} result.deliveredCount
     */

  }, {
    key: '_getReceiptStatus',
    value: function _getReceiptStatus(status, id) {
      var readCount = 0,
          deliveredCount = 0;
      Object.keys(status).filter(function (participant) {
        return participant !== id;
      }).forEach(function (participant) {
        if (status[participant] === Constants.RECEIPT_STATE.READ) {
          readCount++;
          deliveredCount++;
        } else if (status[participant] === Constants.RECEIPT_STATE.DELIVERED) {
          deliveredCount++;
        }
      });

      return {
        readCount: readCount,
        deliveredCount: deliveredCount
      };
    }

    /**
     * Sets the layer.Message.readStatus and layer.Message.deliveryStatus properties.
     *
     * @method _setReceiptStatus
     * @private
     * @param  {number} readCount
     * @param  {number} deliveredCount
     * @param  {number} userCount
     */

  }, {
    key: '_setReceiptStatus',
    value: function _setReceiptStatus(readCount, deliveredCount, userCount) {
      if (readCount === userCount) {
        this.readStatus = Constants.RECIPIENT_STATE.ALL;
      } else if (readCount > 0) {
        this.readStatus = Constants.RECIPIENT_STATE.SOME;
      } else {
        this.readStatus = Constants.RECIPIENT_STATE.NONE;
      }
      if (deliveredCount === userCount) {
        this.deliveryStatus = Constants.RECIPIENT_STATE.ALL;
      } else if (deliveredCount > 0) {
        this.deliveryStatus = Constants.RECIPIENT_STATE.SOME;
      } else {
        this.deliveryStatus = Constants.RECIPIENT_STATE.NONE;
      }
    }

    /**
     * Handle changes to the isRead property.
     *
     * If someone called m.isRead = true, AND
     * if it was previously false, AND
     * if the call didn't come from layer.Message.__updateRecipientStatus,
     * Then notify the server that the message has been read.
     *
     *
     * @method __updateIsRead
     * @private
     * @param  {boolean} value - True if isRead is true.
     */

  }, {
    key: '__updateIsRead',
    value: function __updateIsRead(value) {
      if (value) {
        if (!this._inPopulateFromServer) {
          this._sendReceipt(Constants.RECEIPT_STATE.READ);
        }
        this._triggerMessageRead();
        var conversation = this.getConversation(false);
        if (conversation) conversation.unreadCount--;
      }
    }

    /**
     * Trigger events indicating changes to the isRead/isUnread properties.
     *
     * @method _triggerMessageRead
     * @private
     */

  }, {
    key: '_triggerMessageRead',
    value: function _triggerMessageRead() {
      var value = this.isRead;
      this._triggerAsync('messages:change', {
        property: 'isRead',
        oldValue: !value,
        newValue: value
      });
      this._triggerAsync('messages:change', {
        property: 'isUnread',
        oldValue: value,
        newValue: !value
      });
    }

    /**
     * Send a Read or Delivery Receipt to the server.
     *
     * For Read Receipt, you can also just write:
     *
     * ```
     * message.isRead = true;
     * ```
     *
     * You can retract a Delivery or Read Receipt; once marked as Delivered or Read, it can't go back.
     *
     * ```
     * messsage.sendReceipt(layer.Constants.RECEIPT_STATE.READ);
     * ```
     *
     * @method sendReceipt
     * @param {string} [type=layer.Constants.RECEIPT_STATE.READ] - One of layer.Constants.RECEIPT_STATE.READ or layer.Constants.RECEIPT_STATE.DELIVERY
     * @return {layer.Message} this
     */

  }, {
    key: 'sendReceipt',
    value: function sendReceipt() {
      var type = arguments.length <= 0 || arguments[0] === undefined ? Constants.RECEIPT_STATE.READ : arguments[0];

      if (type === Constants.RECEIPT_STATE.READ) {
        if (this.isRead) {
          return this;
        } else {
          // Without triggering the event, clearObject isn't called,
          // which means those using the toObject() data will have an isRead that doesn't match
          // this instance.  Which typically leads to lots of extra attempts
          // to mark the message as read.
          this.__isRead = true;
          this._triggerMessageRead();
          var conversation = this.getConversation(false);
          if (conversation) conversation.unreadCount--;
        }
      }
      this._sendReceipt(type);
      return this;
    }

    /**
     * Send a Read or Delivery Receipt to the server.
     *
     * This bypasses any validation and goes direct to sending to the server.
     *
     * NOTE: Server errors are not handled; the local receipt state is suitable even
     * if out of sync with the server.
     *
     * @method _sendReceipt
     * @private
     * @param {string} [type=read] - One of layer.Constants.RECEIPT_STATE.READ or layer.Constants.RECEIPT_STATE.DELIVERY
     */

  }, {
    key: '_sendReceipt',
    value: function _sendReceipt(type) {
      var _this4 = this;

      // This little test exists so that we don't send receipts on Conversations we are no longer
      // participants in (participants = [] if we are not a participant)
      var conversation = this.getConversation(false);
      if (conversation && conversation.participants.length === 0) return;

      this._setSyncing();
      this._xhr({
        url: '/receipts',
        method: 'POST',
        data: {
          type: type
        },
        sync: {
          // This should not be treated as a POST/CREATE request on the Message
          operation: 'RECEIPT'
        }
      }, function () {
        return _this4._setSynced();
      });
    }

    /**
     * Send the message to all participants of the Conversation.
     *
     * Message must have parts and a valid conversation to send successfully.
     *
     * The send method takes a `notification` object. In normal use, it provides the same notification to ALL
     * recipients, but you can customize notifications on a per recipient basis, as well as embed actions into the notification.
     * For the Full API, see https://developer.layer.com/docs/platform/messages#notification-customization.
     *
     * For the Full API, see [Server Docs](https://developer.layer.com/docs/platform/messages#notification-customization).
     *
     * ```
     * message.send({
     *    title: "New Hobbit Message",
     *    text: "Frodo-the-Dodo: Hello Sam, what say we waltz into Mordor like we own the place?",
     *    sound: "whinyhobbit.aiff"
     * });
     * ```
     *
     * @method send
     * @param {Object} [notification] - Parameters for controling how the phones manage notifications of the new Message.
     *                          See IOS and Android docs for details.
     * @param {string} [notification.title] - Title to show on lock screen and notification bar
     * @param {string} [notification.text] - Text of your notification
     * @param {string} [notification.sound] - Name of an audio file or other sound-related hint
     * @return {layer.Message} this
     */

  }, {
    key: 'send',
    value: function send(notification) {
      var _this5 = this;

      var client = this.getClient();
      if (!client) {
        throw new Error(LayerError.dictionary.clientMissing);
      }

      var conversation = this.getConversation(true);

      if (!conversation) {
        throw new Error(LayerError.dictionary.conversationMissing);
      }

      if (this.syncState !== Constants.SYNC_STATE.NEW) {
        throw new Error(LayerError.dictionary.alreadySent);
      }

      if (conversation.isLoading) {
        conversation.once('conversations:loaded', function () {
          return _this5.send(notification);
        });
        return this;
      }

      if (!this.parts || !this.parts.length) {
        throw new Error(LayerError.dictionary.partsMissing);
      }

      this._setSyncing();

      // Make sure that the Conversation has been created on the server
      // and update the lastMessage property
      conversation.send(this);

      // If we are sending any File/Blob objects, and their Mime Types match our test,
      // wait until the body is updated to be a string rather than File before calling _addMessage
      // which will add it to the Query Results and pass this on to a renderer that expects "text/plain" to be a string
      // rather than a blob.
      this._readAllBlobs(function () {
        // Calling this will add this to any listening Queries... so position needs to have been set first;
        // handled in conversation.send(this)
        client._addMessage(_this5);

        // allow for modification of message before sending
        _this5.trigger('messages:sending');

        var data = {
          parts: new Array(_this5.parts.length),
          id: _this5.id
        };
        if (notification) data.notification = notification;

        _this5._preparePartsForSending(data);
      });
      return this;
    }

    /**
     * Any MessagePart that contains a textual blob should contain a string before we send.
     *
     * If a MessagePart with a Blob or File as its body were to be added to the Client,
     * The Query would receive this, deliver it to apps and the app would crash.
     * Most rendering code expecting text/plain would expect a string not a File.
     *
     * When this user is sending a file, and that file is textual, make sure
     * its actual text delivered to the UI.
     *
     * @method _readAllBlobs
     * @private
     */

  }, {
    key: '_readAllBlobs',
    value: function _readAllBlobs(callback) {
      var count = 0;
      var parts = this.parts.filter(function (part) {
        return Util.isBlob(part.body) && part.isTextualMimeType();
      });
      parts.forEach(function (part) {
        Util.fetchTextFromFile(part.body, function (text) {
          part.body = text;
          count++;
          if (count === parts.length) callback();
        });
      });
      if (!parts.length) callback();
    }

    /**
     * Insures that each part is ready to send before actually sending the Message.
     *
     * @method _preparePartsForSending
     * @private
     * @param  {Object} structure to be sent to the server
     */

  }, {
    key: '_preparePartsForSending',
    value: function _preparePartsForSending(data) {
      var _this6 = this;

      var client = this.getClient();
      var count = 0;
      this.parts.forEach(function (part, index) {
        part.once('parts:send', function (evt) {
          data.parts[index] = {
            mime_type: evt.mime_type
          };
          if (evt.content) data.parts[index].content = evt.content;
          if (evt.body) data.parts[index].body = evt.body;
          if (evt.encoding) data.parts[index].encoding = evt.encoding;

          count++;
          if (count === _this6.parts.length) {
            _this6._send(data);
          }
        }, _this6);
        part._send(client);
      });
    }

    /**
     * Handle the actual sending.
     *
     * layer.Message.send has some potentially asynchronous
     * preprocessing to do before sending (Rich Content); actual sending
     * is done here.
     *
     * @method _send
     * @private
     */

  }, {
    key: '_send',
    value: function _send(data) {
      var _this7 = this;

      var client = this.getClient();
      var conversation = this.getConversation(false);

      this.sentAt = new Date();
      client.sendSocketRequest({
        method: 'POST',
        body: {
          method: 'Message.create',
          object_id: conversation.id,
          data: data
        },
        sync: {
          depends: [this.conversationId, this.id],
          target: this.id
        }
      }, function (success, socketData) {
        return _this7._sendResult(success, socketData);
      });
    }
  }, {
    key: '_getSendData',
    value: function _getSendData(data) {
      data.object_id = this.conversationId;
      return data;
    }

    /**
      * layer.Message.send() Success Callback.
      *
      * If successfully sending the message; triggers a 'sent' event,
      * and updates the message.id/url
      *
      * @method _sendResult
      * @private
      * @param {Object} messageData - Server description of the message
      */

  }, {
    key: '_sendResult',
    value: function _sendResult(_ref) {
      var success = _ref.success;
      var data = _ref.data;

      if (this.isDestroyed) return;

      if (success) {
        this._populateFromServer(data);
        this._triggerAsync('messages:sent');
      } else {
        this.trigger('messages:sent-error', { error: data });
        this.destroy();
      }
      this._setSynced();
    }

    /* NOT FOR JSDUCK
     * Standard `on()` provided by layer.Root.
     *
     * Adds some special handling of 'messages:loaded' so that calls such as
     *
     *      var m = client.getMessage('layer:///messages/123', true)
     *      .on('messages:loaded', function() {
     *          myrerender(m);
     *      });
     *      myrender(m); // render a placeholder for m until the details of m have loaded
     *
     * can fire their callback regardless of whether the client loads or has
     * already loaded the Message.
     *
     * @method on
     * @param  {string} eventName
     * @param  {Function} eventHandler
     * @param  {Object} context
     * @return {layer.Message} this
     */

  }, {
    key: 'on',
    value: function on(name, callback, context) {
      var hasLoadedEvt = name === 'messages:loaded' || name && (typeof name === 'undefined' ? 'undefined' : _typeof(name)) === 'object' && name['messages:loaded'];

      if (hasLoadedEvt && !this.isLoading) {
        (function () {
          var callNow = name === 'messages:loaded' ? callback : name['messages:loaded'];
          Util.defer(function () {
            return callNow.apply(context);
          });
        })();
      }
      _get(Object.getPrototypeOf(Message.prototype), 'on', this).call(this, name, callback, context);
      return this;
    }

    /**
     * Delete the Message from the server.
     *
     * This call will support various deletion modes.  Calling without a deletion mode is deprecated.
     *
     * Deletion Modes:
     *
     * * layer.Constants.DELETION_MODE.ALL: This deletes the local copy immediately, and attempts to also
     *   delete the server's copy.
     * * layer.Constants.DELETION_MODE.MY_DEVICES: Deletes this Message from all of my devices; no effect on other users.
     *
     * @method delete
     * @param {String} deletionMode
     */

  }, {
    key: 'delete',
    value: function _delete(mode) {
      if (this.isDestroyed) throw new Error(LayerError.dictionary.isDestroyed);

      var queryStr = void 0;
      switch (mode) {
        case Constants.DELETION_MODE.ALL:
        case true:
          queryStr = 'mode=all_participants';
          break;
        case Constants.DELETION_MODE.MY_DEVICES:
          queryStr = 'mode=my_devices';
          break;
        default:
          throw new Error(LayerError.dictionary.deletionModeUnsupported);
      }

      var id = this.id;
      var client = this.getClient();
      this._xhr({
        url: '?' + queryStr,
        method: 'DELETE'
      }, function (result) {
        if (!result.success && (!result.data || result.data.id !== 'not_found')) Message.load(id, client);
      });

      this._deleted();
      this.destroy();
    }

    /**
     * Remove this Message from the system.
     *
     * This will deregister the Message, remove all events
     * and allow garbage collection.
     *
     * @method destroy
     */

  }, {
    key: 'destroy',
    value: function destroy() {
      var client = this.getClient();
      if (client) client._removeMessage(this);
      this.parts.forEach(function (part) {
        return part.destroy();
      });
      this.__parts = null;

      _get(Object.getPrototypeOf(Message.prototype), 'destroy', this).call(this);
    }

    /**
     * Populates this instance with the description from the server.
     *
     * Can be used for creating or for updating the instance.
     *
     * @method _populateFromServer
     * @protected
     * @param  {Object} m - Server description of the message
     */

  }, {
    key: '_populateFromServer',
    value: function _populateFromServer(message) {
      var _this8 = this;

      this._inPopulateFromServer = true;
      var client = this.getClient();

      this.id = message.id;
      this.url = message.url;
      var oldPosition = this.position;
      this.position = message.position;

      // Assign IDs to preexisting Parts so that we can call getPartById()
      if (this.parts) {
        this.parts.forEach(function (part, index) {
          if (!part.id) part.id = _this8.id + '/parts/' + index;
        });
      }

      this.parts = message.parts.map(function (part) {
        var existingPart = _this8.getPartById(part.id);
        if (existingPart) {
          existingPart._populateFromServer(part);
          return existingPart;
        } else {
          return MessagePart._createFromServer(part);
        }
      });

      this.recipientStatus = message.recipient_status || {};

      this.isRead = !message.is_unread;

      this.sentAt = new Date(message.sent_at);
      this.receivedAt = message.received_at ? new Date(message.received_at) : undefined;

      var sender = void 0;
      if (message.sender.id) {
        sender = client.getIdentity(message.sender.id);
      }

      // Because there may be no ID, we have to bypass client._createObject and its switch statement.
      if (!sender) {
        sender = Identity._createFromServer(message.sender, client);
      }
      this.sender = sender;

      this._setSynced();

      if (oldPosition && oldPosition !== this.position) {
        this._triggerAsync('messages:change', {
          oldValue: oldPosition,
          newValue: this.position,
          property: 'position'
        });
      }
      this._inPopulateFromServer = false;
    }

    /**
     * Returns the Message's layer.MessagePart with the specified the part ID.
     *
     * ```
     * var part = client.getMessagePart('layer:///messages/6f08acfa-3268-4ae5-83d9-6ca00000000/parts/0');
     * ```
     *
     * @method getPartById
     * @param {string} partId
     * @return {layer.MessagePart}
     */

  }, {
    key: 'getPartById',
    value: function getPartById(partId) {
      var part = this.parts ? this.parts.filter(function (aPart) {
        return aPart.id === partId;
      })[0] : null;
      return part || null;
    }

    /**
     * Accepts json-patch operations for modifying recipientStatus.
     *
     * @method _handlePatchEvent
     * @private
     * @param  {Object[]} data - Array of operations
     */

  }, {
    key: '_handlePatchEvent',
    value: function _handlePatchEvent(newValue, oldValue, paths) {
      this._inLayerParser = false;
      if (paths[0].indexOf('recipient_status') === 0) {
        this.__updateRecipientStatus(this.recipientStatus, oldValue);
      }
      this._inLayerParser = true;
    }

    /**
     * Returns absolute URL for this resource.
     * Used by sync manager because the url may not be known
     * at the time the sync request is enqueued.
     *
     * @method _getUrl
     * @param {String} url - relative url and query string parameters
     * @return {String} full url
     * @private
     */

  }, {
    key: '_getUrl',
    value: function _getUrl(url) {
      return this.url + (url || '');
    }
  }, {
    key: '_setupSyncObject',
    value: function _setupSyncObject(sync) {
      if (sync !== false) {
        sync = _get(Object.getPrototypeOf(Message.prototype), '_setupSyncObject', this).call(this, sync);
        if (!sync.depends) {
          sync.depends = [this.conversationId];
        } else if (sync.depends.indexOf(this.id) === -1) {
          sync.depends.push(this.conversationId);
        }
      }
      return sync;
    }

    /**
     * Get all text parts of the Message.
     *
     * Utility method for extracting all of the text/plain parts
     * and concatenating all of their bodys together into a single string.
     *
     * @method getText
     * @param {string} [joinStr='.  '] If multiple message parts of type text/plain, how do you want them joined together?
     * @return {string}
     */

  }, {
    key: 'getText',
    value: function getText() {
      var joinStr = arguments.length <= 0 || arguments[0] === undefined ? '. ' : arguments[0];

      var textArray = this.parts.filter(function (part) {
        return part.mimeType === 'text/plain';
      }).map(function (part) {
        return part.body;
      });
      textArray = textArray.filter(function (data) {
        return data;
      });
      return textArray.join(joinStr);
    }

    /**
     * Returns a plain object.
     *
     * Object will have all the same public properties as this
     * Message instance.  New object is returned any time
     * any of this object's properties change.
     *
     * @method toObject
     * @return {Object} POJO version of this object.
     */

  }, {
    key: 'toObject',
    value: function toObject() {
      if (!this._toObject) {
        this._toObject = _get(Object.getPrototypeOf(Message.prototype), 'toObject', this).call(this);
        this._toObject.recipientStatus = Util.clone(this.recipientStatus);
      }
      return this._toObject;
    }
  }, {
    key: '_triggerAsync',
    value: function _triggerAsync(evtName, args) {
      this._clearObject();
      _get(Object.getPrototypeOf(Message.prototype), '_triggerAsync', this).call(this, evtName, args);
    }
  }, {
    key: 'trigger',
    value: function trigger(evtName, args) {
      this._clearObject();
      _get(Object.getPrototypeOf(Message.prototype), 'trigger', this).call(this, evtName, args);
    }

    /**
     * Creates a message from the server's representation of a message.
     *
     * Similar to _populateFromServer, however, this method takes a
     * message description and returns a new message instance using _populateFromServer
     * to setup the values.
     *
     * @method _createFromServer
     * @protected
     * @static
     * @param  {Object} message - Server's representation of the message
     * @param  {layer.Client} client
     * @return {layer.Message}
     */

  }, {
    key: '_loaded',
    value: function _loaded(data) {
      this.conversationId = data.conversation.id;
      this.getClient()._addMessage(this);
    }

    /**
     * Identifies whether a Message receiving the specified patch data should be loaded from the server.
     *
     * Applies only to Messages that aren't already loaded; used to indicate if a change event is
     * significant enough to load the Message and trigger change events on that Message.
     *
     * At this time there are no properties that are patched on Messages via websockets
     * that would justify loading the Message from the server so as to notify the app.
     *
     * Only recipient status changes and maybe is_unread changes are sent;
     * neither of which are relevant to an app that isn't rendering that message.
     *
     * @method _loadResourceForPatch
     * @static
     * @private
     */

  }], [{
    key: '_createFromServer',
    value: function _createFromServer(message, client) {
      var fromWebsocket = message.fromWebsocket;
      return new Message({
        conversationId: message.conversation.id,
        fromServer: message,
        clientId: client.appId,
        _fromDB: message._fromDB,
        _notify: fromWebsocket && message.is_unread && message.sender.user_id !== client.user.userId
      });
    }
  }, {
    key: '_loadResourceForPatch',
    value: function _loadResourceForPatch(patchData) {
      return false;
    }
  }]);

  return Message;
}(Syncable);

/**
 * Client that the Message belongs to.
 *
 * Actual value of this string matches the appId.
 * @type {string}
 * @readonly
 */


Message.prototype.clientId = '';

/**
 * Conversation that this Message belongs to.
 *
 * Actual value is the ID of the Conversation's ID.
 *
 * @type {string}
 * @readonly
 */
Message.prototype.conversationId = '';

/**
 * Array of layer.MessagePart objects.
 *
 * Use layer.Message.addPart to modify this array.
 *
 * @type {layer.MessagePart[]}
 * @readonly
 */
Message.prototype.parts = null;

/**
 * Time that the message was sent.
 *
 *  Note that a locally created layer.Message will have a `sentAt` value even
 * though its not yet sent; this is so that any rendering code doesn't need
 * to account for `null` values.  Sending the Message may cause a slight change
 * in the `sentAt` value.
 *
 * @type {Date}
 * @readonly
 */
Message.prototype.sentAt = null;

/**
 * Time that the first delivery receipt was sent by your
 * user acknowledging receipt of the message.
 * @type {Date}
 * @readonly
 */
Message.prototype.receivedAt = null;

/**
 * Identity object representing the sender of the Message.
 *
 * Most commonly used properties of Identity are:
 * * displayName: A name for your UI
 * * userId: Name for the user as represented on your system
 * * name: Represents the name of a service if the sender was an automated system.
 *
 *      <span class='sent-by'>
 *        {message.sender.displayName || message.sender.name}
 *      </span>
 *
 * @type {layer.Identity}
 * @readonly
 */
Message.prototype.sender = null;

/**
 * Position of this message within the conversation.
 *
 * NOTES:
 *
 * 1. Deleting a message does not affect position of other Messages.
 * 2. A position is not gaurenteed to be unique (multiple messages sent at the same time could
 * all claim the same position)
 * 3. Each successive message within a conversation should expect a higher position.
 *
 * @type {Number}
 * @readonly
 */
Message.prototype.position = 0;

/**
 * Hint used by layer.Client on whether to trigger a messages:notify event.
 *
 * @type {boolean}
 * @private
 */
Message.prototype._notify = false;

/* Recipient Status */

/**
 * Read/delivery State of all participants.
 *
 * This is an object containing keys for each participant,
 * and a value of:
 * * layer.RECEIPT_STATE.SENT
 * * layer.RECEIPT_STATE.DELIVERED
 * * layer.RECEIPT_STATE.READ
 * * layer.RECEIPT_STATE.PENDING
 *
 * @type {Object}
 */
Message.prototype.recipientStatus = null;

/**
 * True if this Message has been read by this user.
 *
 * You can change isRead programatically
 *
 *      m.isRead = true;
 *
 * This will automatically notify the server that the message was read by your user.
 * @type {Boolean}
 */
Message.prototype.isRead = false;

/**
 * This property is here for convenience only; it will always be the opposite of isRead.
 * @type {Boolean}
 * @readonly
 */
Object.defineProperty(Message.prototype, 'isUnread', {
  enumerable: true,
  get: function get() {
    return !this.isRead;
  }
});

/**
 * Have the other participants read this Message yet.
 *
 * This value is one of:
 *
 *  * layer.Constants.RECIPIENT_STATE.ALL
 *  * layer.Constants.RECIPIENT_STATE.SOME
 *  * layer.Constants.RECIPIENT_STATE.NONE
 *
 *  This value is updated any time recipientStatus changes.
 *
 * See layer.Message.recipientStatus for a more detailed report.
 *
 * @type {String}
 */
Message.prototype.readStatus = Constants.RECIPIENT_STATE.NONE;

/**
 * Have the other participants received this Message yet.
 *
  * This value is one of:
 *
 *  * layer.Constants.RECIPIENT_STATE.ALL
 *  * layer.Constants.RECIPIENT_STATE.SOME
 *  * layer.Constants.RECIPIENT_STATE.NONE
 *
 *  This value is updated any time recipientStatus changes.
 *
 * See layer.Message.recipientStatus for a more detailed report.
 *
 *
 * @type {String}
 */
Message.prototype.deliveryStatus = Constants.RECIPIENT_STATE.NONE;

Message.prototype._toObject = null;

Message.prototype._inPopulateFromServer = false;

Message.eventPrefix = 'messages';

Message.eventPrefix = 'messages';

Message.prefixUUID = 'layer:///messages/';

Message.inObjectIgnore = Syncable.inObjectIgnore;

Message.bubbleEventParent = 'getClient';

Message.imageTypes = ['image/gif', 'image/png', 'image/jpeg', 'image/jpg'];

Message._supportedEvents = [

/**
 * Message has been loaded from the server.
 *
 * Note that this is only used in response to the layer.Message.load() method.
 *
 * ```
 * var m = client.getMessage('layer:///messages/123', true)
 *    .on('messages:loaded', function() {
 *        myrerender(m);
 *    });
 * myrender(m); // render a placeholder for m until the details of m have loaded
 * ```
 *
 * @event
 * @param {layer.LayerEvent} evt
 */
'messages:loaded',

/**
 * The load method failed to load the message from the server.
 *
 * Note that this is only used in response to the layer.Message.load() method.
 * @event
 * @param {layer.LayerEvent} evt
 */
'messages:loaded-error',

/**
 * Message deleted from the server.
 *
 * Caused by a call to layer.Message.delete() or a websocket event.
 * @param {layer.LayerEvent} evt
 * @event
 */
'messages:delete',

/**
 * Message is about to be sent.
 *
 * Last chance to modify or validate the message prior to sending.
 *
 *     message.on('messages:sending', function(evt) {
 *        message.addPart({mimeType: 'application/location', body: JSON.stringify(getGPSLocation())});
 *     });
 *
 * Typically, you would listen to this event more broadly using `client.on('messages:sending')`
 * which would trigger before sending ANY Messages.
 *
 * @event
 * @param {layer.LayerEvent} evt
 */
'messages:sending',

/**
 * Message has been received by the server.
 *
 * It does NOT indicate delivery to other users.
 *
 * It does NOT indicate messages sent by other users.
 *
 * @event
 * @param {layer.LayerEvent} evt
 */
'messages:sent',

/**
 * Server failed to receive the Message.
 *
 * Message will be deleted immediately after firing this event.
 *
 * @event
 * @param {layer.LayerEvent} evt
 * @param {layer.LayerError} evt.error
 */
'messages:sent-error',

/**
 * The recipientStatus property has changed.
 *
 * This happens in response to an update
 * from the server... but is also caused by marking the current user as having read
 * or received the message.
 * @event
 * @param {layer.LayerEvent} evt
 */
'messages:change'].concat(Syncable._supportedEvents);

Root.initClass.apply(Message, [Message, 'Message']);
Syncable.subclasses.push(Message);
module.exports = Message;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9tZXNzYWdlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBb0hBLElBQU0sT0FBTyxRQUFRLFFBQVIsQ0FBYjtBQUNBLElBQU0sV0FBVyxRQUFRLFlBQVIsQ0FBakI7QUFDQSxJQUFNLGNBQWMsUUFBUSxnQkFBUixDQUFwQjtBQUNBLElBQU0sYUFBYSxRQUFRLGVBQVIsQ0FBbkI7QUFDQSxJQUFNLFlBQVksUUFBUSxTQUFSLENBQWxCO0FBQ0EsSUFBTSxPQUFPLFFBQVEsZ0JBQVIsQ0FBYjtBQUNBLElBQU0saUJBQWlCLFFBQVEsbUJBQVIsQ0FBdkI7QUFDQSxJQUFNLFdBQVcsUUFBUSxZQUFSLENBQWpCOztJQUVNLE87OztBQUNKOzs7Ozs7QUFNQSxxQkFBMEI7QUFBQSxRQUFkLE9BQWMseURBQUosRUFBSTs7QUFBQTs7QUFDeEI7QUFDQTtBQUNBLFFBQUksQ0FBQyxRQUFRLFVBQWIsRUFBeUI7QUFDdkIsVUFBSSxjQUFjLE9BQWxCLEVBQTJCO0FBQ3pCLGdCQUFRLE1BQVIsR0FBaUIsQ0FBQyxRQUFRLFFBQVQsSUFBcUIsQ0FBQyxRQUFRLFNBQS9DO0FBQ0QsT0FGRCxNQUVPO0FBQ0wsZ0JBQVEsTUFBUixHQUFpQixJQUFqQjtBQUNEO0FBQ0YsS0FORCxNQU1PO0FBQ0wsY0FBUSxFQUFSLEdBQWEsUUFBUSxVQUFSLENBQW1CLEVBQWhDO0FBQ0Q7O0FBRUQsUUFBSSxRQUFRLE1BQVosRUFBb0IsUUFBUSxRQUFSLEdBQW1CLFFBQVEsTUFBUixDQUFlLEtBQWxDO0FBQ3BCLFFBQUksQ0FBQyxRQUFRLFFBQWIsRUFBdUIsTUFBTSxJQUFJLEtBQUosQ0FBVSxnREFBVixDQUFOO0FBQ3ZCLFFBQUksUUFB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QUExQzs7QUFFQSxRQUFRLFdBQVIsR0FBc0IsVUFBdEI7O0FBRUEsUUFBUSxXQUFSLEdBQXNCLFVBQXRCOztBQUVBLFFBQVEsVUFBUixHQUFxQixvQkFBckI7O0FBRUEsUUFBUSxjQUFSLEdBQXlCLFNBQVMsY0FBbEM7O0FBRUEsUUFBUSxpQkFBUixHQUE0QixXQUE1Qjs7QUFFQSxRQUFRLFVBQVIsR0FBcUIsQ0FDbkIsV0FEbUIsRUFFbkIsV0FGbUIsRUFHbkIsWUFIbUIsRUFJbkIsV0FKbUIsQ0FBckI7O0FBT0EsUUFBUSxnQkFBUixHQUEyQjs7QUFFekI7Ozs7Ozs7Ozs7Ozs7Ozs7QUFnQkEsaUJBbEJ5Qjs7QUFvQnpCOzs7Ozs7O0FBT0EsdUJBM0J5Qjs7QUE2QnpCOzs7Ozs7O0FBT0EsaUJBcEN5Qjs7QUFzQ3pCOzs7Ozs7Ozs7Ozs7Ozs7QUFlQSxrQkFyRHlCOztBQXVEekI7Ozs7Ozs7Ozs7QUFVQSxlQWpFeUI7O0FBbUV6Qjs7Ozs7Ozs7O0FBU0EscUJBNUV5Qjs7QUE4RXpCOzs7Ozs7Ozs7QUFTQSxpQkF2RnlCLEVBMEZ6QixNQTFGeUIsQ0EwRmxCLFNBQVMsZ0JBMUZTLENBQTNCOztBQTRGQSxLQUFLLFNBQUwsQ0FBZSxLQUFmLENBQXFCLE9BQXJCLEVBQThCLENBQUMsT0FBRCxFQUFVLFNBQVYsQ0FBOUI7QUFDQSxTQUFTLFVBQVQsQ0FBb0IsSUFBcEIsQ0FBeUIsT0FBekI7QUFDQSxPQUFPLE9BQVAsR0FBaUIsT0FBakIiLCJmaWxlIjoibWVzc2FnZS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVGhlIE1lc3NhZ2UgQ2xhc3MgcmVwcmVzZW50cyBNZXNzYWdlcyBzZW50IGFtb25nc3QgcGFydGljaXBhbnRzXG4gKiBvZiBvZiBhIENvbnZlcnNhdGlvbi5cbiAqXG4gKiBUaGUgc2ltcGxlc3Qgd2F5IHRvIGNyZWF0ZSBhbmQgc2VuZCBhIG1lc3NhZ2UgaXM6XG4gKlxuICogICAgICB2YXIgbSA9IGNvbnZlcnNhdGlvbi5jcmVhdGVNZXNzYWdlKCdIZWxsbyB0aGVyZScpLnNlbmQoKTtcbiAqXG4gKiBGb3IgY29udmVyc2F0aW9ucyB0aGF0IGludm9sdmUgbm90aWZpY2F0aW9ucyAocHJpbWFyaWx5IGZvciBBbmRyb2lkIGFuZCBJT1MpLCB0aGUgbW9yZSBjb21tb24gcGF0dGVybiBpczpcbiAqXG4gKiAgICAgIHZhciBtID0gY29udmVyc2F0aW9uLmNyZWF0ZU1lc3NhZ2UoJ0hlbGxvIHRoZXJlJykuc2VuZCh7dGV4dDogXCJNZXNzYWdlIGZyb20gRnJlZDogSGVsbG8gdGhlcmVcIn0pO1xuICpcbiAqIFR5cGljYWxseSwgcmVuZGVyaW5nIHdvdWxkIGJlIGRvbmUgYXMgZm9sbG93czpcbiAqXG4gKiAgICAgIC8vIENyZWF0ZSBhIGxheWVyLlF1ZXJ5IHRoYXQgbG9hZHMgTWVzc2FnZXMgZm9yIHRoZVxuICogICAgICAvLyBzcGVjaWZpZWQgQ29udmVyc2F0aW9uLlxuICogICAgICB2YXIgcXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkoe1xuICogICAgICAgIG1vZGVsOiBRdWVyeS5NZXNzYWdlLFxuICogICAgICAgIHByZWRpY2F0ZTogJ2NvbnZlcnNhdGlvbiA9IFwiJyArIGNvbnZlcnNhdGlvbi5pZCArICdcIidcbiAqICAgICAgfSk7XG4gKlxuICogICAgICAvLyBBbnkgdGltZSB0aGUgUXVlcnkncyBkYXRhIGNoYW5nZXMgdGhlICdjaGFuZ2UnXG4gKiAgICAgIC8vIGV2ZW50IHdpbGwgZmlyZS5cbiAqICAgICAgcXVlcnkub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGxheWVyRXZ0KSB7XG4gKiAgICAgICAgcmVuZGVyTmV3TWVzc2FnZXMocXVlcnkuZGF0YSk7XG4gKiAgICAgIH0pO1xuICpcbiAqICAgICAgLy8gVGhpcyB3aWxsIGNhbGwgd2lsbCBjYXVzZSB0aGUgYWJvdmUgZXZlbnQgaGFuZGxlciB0byByZWNlaXZlXG4gKiAgICAgIC8vIGEgY2hhbmdlIGV2ZW50LCBhbmQgd2lsbCB1cGRhdGUgcXVlcnkuZGF0YS5cbiAqICAgICAgY29udmVyc2F0aW9uLmNyZWF0ZU1lc3NhZ2UoJ0hlbGxvIHRoZXJlJykuc2VuZCgpO1xuICpcbiAqIFRoZSBhYm92ZSBjb2RlIHdpbGwgdHJpZ2dlciB0aGUgZm9sbG93aW5nIGV2ZW50czpcbiAqXG4gKiAgKiBNZXNzYWdlIEluc3RhbmNlIGZpcmVzXG4gKiAgICAqIG1lc3NhZ2VzOnNlbmRpbmc6IEFuIGV2ZW50IHRoYXQgbGV0cyB5b3UgbW9kaWZ5IHRoZSBtZXNzYWdlIHByaW9yIHRvIHNlbmRpbmdcbiAqICAgICogbWVzc2FnZXM6c2VudDogVGhlIG1lc3NhZ2Ugd2FzIHJlY2VpdmVkIGJ5IHRoZSBzZXJ2ZXJcbiAqICAqIFF1ZXJ5IEluc3RhbmNlIGZpcmVzXG4gKiAgICAqIGNoYW5nZTogVGhlIHF1ZXJ5IGhhcyByZWNlaXZlZCBhIG5ldyBNZXNzYWdlXG4gKiAgICAqIGNoYW5nZTphZGQ6IFNhbWUgYXMgdGhlIGNoYW5nZSBldmVudCBidXQgZG9lcyBub3QgcmVjZWl2ZSBvdGhlciB0eXBlcyBvZiBjaGFuZ2UgZXZlbnRzXG4gKlxuICogV2hlbiBjcmVhdGluZyBhIE1lc3NhZ2UgdGhlcmUgYXJlIGEgbnVtYmVyIG9mIHdheXMgdG8gc3RydWN0dXJlIGl0LlxuICogQWxsIG9mIHRoZXNlIGFyZSB2YWxpZCBhbmQgY3JlYXRlIHRoZSBzYW1lIGV4YWN0IE1lc3NhZ2U6XG4gKlxuICogICAgICAvLyBGdWxsIEFQSSBzdHlsZTpcbiAqICAgICAgdmFyIG0gPSBjb252ZXJzYXRpb24uY3JlYXRlTWVzc2FnZSh7XG4gKiAgICAgICAgICBwYXJ0czogW25ldyBsYXllci5NZXNzYWdlUGFydCh7XG4gKiAgICAgICAgICAgICAgYm9keTogJ0hlbGxvIHRoZXJlJyxcbiAqICAgICAgICAgICAgICBtaW1lVHlwZTogJ3RleHQvcGxhaW4nXG4gKiAgICAgICAgICB9KV1cbiAqICAgICAgfSk7XG4gKlxuICogICAgICAvLyBPcHRpb24gMTogUGFzcyBpbiBhbiBPYmplY3QgaW5zdGVhZCBvZiBhbiBhcnJheSBvZiBsYXllci5NZXNzYWdlUGFydHNcbiAqICAgICAgdmFyIG0gPSBjb252ZXJzYXRpb24uY3JlYXRlTWVzc2FnZSh7XG4gKiAgICAgICAgICBwYXJ0czoge1xuICogICAgICAgICAgICAgIGJvZHk6ICdIZWxsbyB0aGVyZScsXG4gKiAgICAgICAgICAgICAgbWltZVR5cGU6ICd0ZXh0L3BsYWluJ1xuICogICAgICAgICAgfVxuICogICAgICB9KTtcbiAqXG4gKiAgICAgIC8vIE9wdGlvbiAyOiBQYXNzIGluIGFuIGFycmF5IG9mIE9iamVjdHMgaW5zdGVhZCBvZiBhbiBhcnJheSBvZiBsYXllci5NZXNzYWdlUGFydHNcbiAqICAgICAgdmFyIG0gPSBjb252ZXJzYXRpb24uY3JlYXRlTWVzc2FnZSh7XG4gKiAgICAgICAgICBwYXJ0czogW3tcbiAqICAgICAgICAgICAgICBib2R5OiAnSGVsbG8gdGhlcmUnLFxuICogICAgICAgICAgICAgIG1pbWVUeXBlOiAndGV4dC9wbGFpbidcbiAqICAgICAgICAgIH1dXG4gKiAgICAgIH0pO1xuICpcbiAqICAgICAgLy8gT3B0aW9uIDM6IFBhc3MgaW4gYSBzdHJpbmcgKGF1dG9tYXRpY2FsbHkgYXNzdW1lcyBtaW1lVHlwZSBpcyB0ZXh0L3BsYWluKVxuICogICAgICAvLyBpbnN0ZWFkIG9mIGFuIGFycmF5IG9mIG9iamVjdHMuXG4gKiAgICAgIHZhciBtID0gY29udmVyc2F0aW9uLmNyZWF0ZU1lc3NhZ2Uoe1xuICogICAgICAgICAgcGFydHM6ICdIZWxsbydcbiAqICAgICAgfSk7XG4gKlxuICogICAgICAvLyBPcHRpb24gNDogUGFzcyBpbiBhbiBhcnJheSBvZiBzdHJpbmdzIChhdXRvbWF0aWNhbGx5IGFzc3VtZXMgbWltZVR5cGUgaXMgdGV4dC9wbGFpbilcbiAqICAgICAgdmFyIG0gPSBjb252ZXJzYXRpb24uY3JlYXRlTWVzc2FnZSh7XG4gKiAgICAgICAgICBwYXJ0czogWydIZWxsbyddXG4gKiAgICAgIH0pO1xuICpcbiAqICAgICAgLy8gT3B0aW9uIDU6IFBhc3MgaW4ganVzdCBhIHN0cmluZyBhbmQgbm90aGluZyBlbHNlXG4gKiAgICAgIHZhciBtID0gY29udmVyc2F0aW9uLmNyZWF0ZU1lc3NhZ2UoJ0hlbGxvJyk7XG4gKlxuICogICAgICAvLyBPcHRpb24gNjogVXNlIGFkZFBhcnQuXG4gKiAgICAgIHZhciBtID0gY29udmVyc2VhdGlvbi5jcmVhdGVNZXNzYWdlKCk7XG4gKiAgICAgIG0uYWRkUGFydCh7Ym9keTogXCJoZWxsb1wiLCBtaW1lVHlwZTogXCJ0ZXh0L3BsYWluXCJ9KTtcbiAqXG4gKiBLZXkgbWV0aG9kcywgZXZlbnRzIGFuZCBwcm9wZXJ0aWVzIGZvciBnZXR0aW5nIHN0YXJ0ZWQ6XG4gKlxuICogUHJvcGVydGllczpcbiAqXG4gKiAqIGxheWVyLk1lc3NhZ2UuaWQ6IHRoaXMgcHJvcGVydHkgaXMgd29ydGggYmVpbmcgZmFtaWxpYXIgd2l0aDsgaXQgaWRlbnRpZmllcyB0aGVcbiAqICAgTWVzc2FnZSBhbmQgY2FuIGJlIHVzZWQgaW4gYGNsaWVudC5nZXRNZXNzYWdlKGlkKWAgdG8gcmV0cmlldmUgaXRcbiAqICAgYXQgYW55IHRpbWUuXG4gKiAqIGxheWVyLk1lc3NhZ2UuaW50ZXJuYWxJZDogVGhpcyBwcm9wZXJ0eSBtYWtlcyBmb3IgYSBoYW5keSB1bmlxdWUgSUQgZm9yIHVzZSBpbiBkb20gbm9kZXMuXG4gKiAgIEl0IGlzIGdhdXJlbnRlZWQgbm90IHRvIGNoYW5nZSBkdXJpbmcgdGhpcyBzZXNzaW9uLlxuICogKiBsYXllci5NZXNzYWdlLmlzUmVhZDogSW5kaWNhdGVzIGlmIHRoZSBNZXNzYWdlIGhhcyBiZWVuIHJlYWQgeWV0OyBzZXQgYG0uaXNSZWFkID0gdHJ1ZWBcbiAqICAgdG8gdGVsbCB0aGUgY2xpZW50IGFuZCBzZXJ2ZXIgdGhhdCB0aGUgbWVzc2FnZSBoYXMgYmVlbiByZWFkLlxuICogKiBsYXllci5NZXNzYWdlLnBhcnRzOiBBbiBhcnJheSBvZiBsYXllci5NZXNzYWdlUGFydCBjbGFzc2VzIHJlcHJlc2VudGluZyB0aGUgY29udGVudHMgb2YgdGhlIE1lc3NhZ2UuXG4gKiAqIGxheWVyLk1lc3NhZ2Uuc2VudEF0OiBEYXRlIHRoZSBtZXNzYWdlIHdhcyBzZW50XG4gKiAqIGxheWVyLk1lc3NhZ2Uuc2VuZGVyIGB1c2VySWRgOiBDb252ZXJzYXRpb24gcGFydGljaXBhbnQgd2hvIHNlbnQgdGhlIE1lc3NhZ2UuIFlvdSBtYXlcbiAqICAgbmVlZCB0byBkbyBhIGxvb2t1cCBvbiB0aGlzIGlkIGluIHlvdXIgb3duIHNlcnZlcnMgdG8gZmluZCBhXG4gKiAgIGRpc3BsYXlhYmxlIG5hbWUgZm9yIGl0LlxuICpcbiAqIE1ldGhvZHM6XG4gKlxuICogKiBsYXllci5NZXNzYWdlLnNlbmQoKTogU2VuZHMgdGhlIG1lc3NhZ2UgdG8gdGhlIHNlcnZlciBhbmQgdGhlIG90aGVyIHBhcnRpY2lwYW50cy5cbiAqICogbGF5ZXIuTWVzc2FnZS5vbigpIGFuZCBsYXllci5NZXNzYWdlLm9mZigpOyBldmVudCBsaXN0ZW5lcnMgYnVpbHQgb24gdG9wIG9mIHRoZSBgYmFja2JvbmUtZXZlbnRzLXN0YW5kYWxvbmVgIG5wbSBwcm9qZWN0XG4gKlxuICogRXZlbnRzOlxuICpcbiAqICogYG1lc3NhZ2VzOnNlbnRgOiBUaGUgbWVzc2FnZSBoYXMgYmVlbiByZWNlaXZlZCBieSB0aGUgc2VydmVyLiBDYW4gYWxzbyBzdWJzY3JpYmUgdG9cbiAqICAgdGhpcyBldmVudCBmcm9tIHRoZSBsYXllci5DbGllbnQgd2hpY2ggaXMgdXN1YWxseSBzaW1wbGVyLlxuICpcbiAqIEBjbGFzcyAgbGF5ZXIuTWVzc2FnZVxuICogQGV4dGVuZHMgbGF5ZXIuU3luY2FibGVcbiAqL1xuXG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi9yb290Jyk7XG5jb25zdCBTeW5jYWJsZSA9IHJlcXVpcmUoJy4vc3luY2FibGUnKTtcbmNvbnN0IE1lc3NhZ2VQYXJ0ID0gcmVxdWlyZSgnLi9tZXNzYWdlLXBhcnQnKTtcbmNvbnN0IExheWVyRXJyb3IgPSByZXF1aXJlKCcuL2xheWVyLWVycm9yJyk7XG5jb25zdCBDb25zdGFudHMgPSByZXF1aXJlKCcuL2NvbnN0Jyk7XG5jb25zdCBVdGlsID0gcmVxdWlyZSgnLi9jbGllbnQtdXRpbHMnKTtcbmNvbnN0IENsaWVudFJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi9jbGllbnQtcmVnaXN0cnknKTtcbmNvbnN0IElkZW50aXR5ID0gcmVxdWlyZSgnLi9pZGVudGl0eScpO1xuXG5jbGFzcyBNZXNzYWdlIGV4dGVuZHMgU3luY2FibGUge1xuICAvKipcbiAgICogU2VlIGxheWVyLkNvbnZlcnNhdGlvbi5jcmVhdGVNZXNzYWdlKClcbiAgICpcbiAgICogQG1ldGhvZCBjb25zdHJ1Y3RvclxuICAgKiBAcmV0dXJuIHtsYXllci5NZXNzYWdlfVxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gVW5sZXNzIHRoaXMgaXMgYSBzZXJ2ZXIgcmVwcmVzZW50YXRpb24sIHRoaXMgaXMgYSBkZXZlbG9wZXIncyBzaG9ydGhhbmQ7XG4gICAgLy8gZmlsbCBpbiB0aGUgbWlzc2luZyBwcm9wZXJ0aWVzIGFyb3VuZCBpc1JlYWQvaXNVbnJlYWQgYmVmb3JlIGluaXRpYWxpemluZy5cbiAgICBpZiAoIW9wdGlvbnMuZnJvbVNlcnZlcikge1xuICAgICAgaWYgKCdpc1VucmVhZCcgaW4gb3B0aW9ucykge1xuICAgICAgICBvcHRpb25zLmlzUmVhZCA9ICFvcHRpb25zLmlzVW5yZWFkICYmICFvcHRpb25zLmlzX3VucmVhZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wdGlvbnMuaXNSZWFkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucy5pZCA9IG9wdGlvbnMuZnJvbVNlcnZlci5pZDtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5jbGllbnQpIG9wdGlvbnMuY2xpZW50SWQgPSBvcHRpb25zLmNsaWVudC5hcHBJZDtcbiAgICBpZiAoIW9wdGlvbnMuY2xpZW50SWQpIHRocm93IG5ldyBFcnJvcignY2xpZW50SWQgcHJvcGVydHkgcmVxdWlyZWQgdG8gY3JlYXRlIGEgTWVzc2FnZScpO1xuICAgIGlmIChvcHRpb25zLmNvbnZlcnNhdGlvbikgb3B0aW9ucy5jb252ZXJzYXRpb25JZCA9IG9wdGlvbnMuY29udmVyc2F0aW9uLmlkO1xuXG4gICAgLy8gSW5zdXJlIF9fYWRqdXN0UGFydHMgaXMgc2V0IEFGVEVSIGNsaWVudElkIGlzIHNldC5cbiAgICBjb25zdCBwYXJ0cyA9IG9wdGlvbnMucGFydHM7XG4gICAgb3B0aW9ucy5wYXJ0cyA9IG51bGw7XG5cbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLnBhcnRzID0gcGFydHM7XG5cbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIHRoaXMuaXNJbml0aWFsaXppbmcgPSB0cnVlO1xuICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMuZnJvbVNlcnZlcikge1xuICAgICAgdGhpcy5fcG9wdWxhdGVGcm9tU2VydmVyKG9wdGlvbnMuZnJvbVNlcnZlcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChjbGllbnQpIHRoaXMuc2VuZGVyID0gY2xpZW50LnVzZXI7XG4gICAgICB0aGlzLnNlbnRBdCA9IG5ldyBEYXRlKCk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnBhcnRzKSB0aGlzLnBhcnRzID0gW107XG5cbiAgICB0aGlzLl9kaXNhYmxlRXZlbnRzID0gdHJ1ZTtcbiAgICBpZiAoIW9wdGlvbnMuZnJvbVNlcnZlcikgdGhpcy5yZWNpcGllbnRTdGF0dXMgPSB7fTtcbiAgICBlbHNlIHRoaXMuX191cGRhdGVSZWNpcGllbnRTdGF0dXModGhpcy5yZWNpcGllbnRTdGF0dXMpO1xuICAgIHRoaXMuX2Rpc2FibGVFdmVudHMgPSBmYWxzZTtcblxuICAgIHRoaXMuaXNJbml0aWFsaXppbmcgPSBmYWxzZTtcbiAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmZyb21TZXJ2ZXIpIHtcbiAgICAgIGNsaWVudC5fYWRkTWVzc2FnZSh0aGlzKTtcbiAgICAgIGNvbnN0IHN0YXR1cyA9IHRoaXMucmVjaXBpZW50U3RhdHVzW2NsaWVudC51c2VyLmlkXTtcbiAgICAgIGlmIChzdGF0dXMgJiYgc3RhdHVzICE9PSBDb25zdGFudHMuUkVDRUlQVF9TVEFURS5SRUFEICYmIHN0YXR1cyAhPT0gQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuREVMSVZFUkVEKSB7XG4gICAgICAgIFV0aWwuZGVmZXIoKCkgPT4gdGhpcy5fc2VuZFJlY2VpcHQoJ2RlbGl2ZXJ5JykpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIGxheWVyLkNvbnZlcnNhdGlvbiBhc3NvY2lhdGVkIHdpdGggdGhpcyBsYXllci5NZXNzYWdlLlxuICAgKlxuICAgKiBVc2VzIHRoZSBsYXllci5NZXNzYWdlLmNvbnZlcnNhdGlvbklkLlxuICAgKlxuICAgKiBAbWV0aG9kIGdldENvbnZlcnNhdGlvblxuICAgKiBAcmV0dXJuIHtsYXllci5Db252ZXJzYXRpb259XG4gICAqL1xuICBnZXRDb252ZXJzYXRpb24obG9hZCkge1xuICAgIGlmICh0aGlzLmNvbnZlcnNhdGlvbklkKSB7XG4gICAgICByZXR1cm4gQ2xpZW50UmVnaXN0cnkuZ2V0KHRoaXMuY2xpZW50SWQpLmdldENvbnZlcnNhdGlvbih0aGlzLmNvbnZlcnNhdGlvbklkLCBsb2FkKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogVHVybiBpbnB1dCBpbnRvIHZhbGlkIGxheWVyLk1lc3NhZ2VQYXJ0cy5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgaXMgYXV0b21hdGljYWxseSBjYWxsZWQgYW55IHRpbWUgdGhlIHBhcnRzXG4gICAqIHByb3BlcnR5IGlzIHNldCAoaW5jbHVkaW5nIGR1cmluZyBpbnRpYWxpemF0aW9uKS4gIFRoaXNcbiAgICogaXMgd2hlcmUgd2UgY29udmVydCBzdHJpbmdzIGludG8gTWVzc2FnZVBhcnRzLCBhbmQgaW5zdGFuY2VzXG4gICAqIGludG8gYXJyYXlzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9fYWRqdXN0UGFydHNcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7TWl4ZWR9IHBhcnRzIC0tIENvdWxkIGJlIGEgc3RyaW5nLCBhcnJheSwgb2JqZWN0IG9yIE1lc3NhZ2VQYXJ0IGluc3RhbmNlXG4gICAqIEByZXR1cm4ge2xheWVyLk1lc3NhZ2VQYXJ0W119XG4gICAqL1xuICBfX2FkanVzdFBhcnRzKHBhcnRzKSB7XG4gICAgaWYgKHR5cGVvZiBwYXJ0cyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiBbbmV3IE1lc3NhZ2VQYXJ0KHtcbiAgICAgICAgYm9keTogcGFydHMsXG4gICAgICAgIG1pbWVUeXBlOiAndGV4dC9wbGFpbicsXG4gICAgICAgIGNsaWVudElkOiB0aGlzLmNsaWVudElkLFxuICAgICAgfSldO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShwYXJ0cykpIHtcbiAgICAgIHJldHVybiBwYXJ0cy5tYXAocGFydCA9PiB7XG4gICAgICAgIGxldCByZXN1bHQ7XG4gICAgICAgIGlmIChwYXJ0IGluc3RhbmNlb2YgTWVzc2FnZVBhcnQpIHtcbiAgICAgICAgICByZXN1bHQgPSBwYXJ0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc3VsdCA9IG5ldyBNZXNzYWdlUGFydChwYXJ0KTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQuY2xpZW50SWQgPSB0aGlzLmNsaWVudElkO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmIChwYXJ0cyAmJiB0eXBlb2YgcGFydHMgPT09ICdvYmplY3QnKSB7XG4gICAgICBwYXJ0cy5jbGllbnRJZCA9IHRoaXMuY2xpZW50SWQ7XG4gICAgICByZXR1cm4gW25ldyBNZXNzYWdlUGFydChwYXJ0cyldO1xuICAgIH1cbiAgfVxuXG5cbiAgLyoqXG4gICAqIEFkZCBhIGxheWVyLk1lc3NhZ2VQYXJ0IHRvIHRoaXMgTWVzc2FnZS5cbiAgICpcbiAgICogU2hvdWxkIG9ubHkgYmUgY2FsbGVkIG9uIGFuIHVuc2VudCBNZXNzYWdlLlxuICAgKlxuICAgKiBgYGBcbiAgICogbWVzc2FnZS5hZGRQYXJ0KHttaW1lVHlwZTogJ3RleHQvcGxhaW4nLCBib2R5OiAnRnJvZG8gcmVhbGx5IGlzIGEgRG9kbyd9KTtcbiAgICpcbiAgICogLy8gT1JcbiAgICogbWVzc2FnZS5hZGRQYXJ0KG5ldyBsYXllci5NZXNzYWdlUGFydCh7bWltZVR5cGU6ICd0ZXh0L3BsYWluJywgYm9keTogJ0Zyb2RvIHJlYWxseSBpcyBhIERvZG8nfSkpO1xuICAgKiBgYGBcbiAgICpcbiAgICogQG1ldGhvZCBhZGRQYXJ0XG4gICAqIEBwYXJhbSAge2xheWVyLk1lc3NhZ2VQYXJ0L09iamVjdH0gcGFydCAtIEEgbGF5ZXIuTWVzc2FnZVBhcnQgaW5zdGFuY2Ugb3IgYSBge21pbWVUeXBlOiAndGV4dC9wbGFpbicsIGJvZHk6ICdIZWxsbyd9YCBmb3JtYXR0ZWQgT2JqZWN0LlxuICAgKiBAcmV0dXJucyB7bGF5ZXIuTWVzc2FnZX0gdGhpc1xuICAgKi9cbiAgYWRkUGFydChwYXJ0KSB7XG4gICAgaWYgKHBhcnQpIHtcbiAgICAgIHBhcnQuY2xpZW50SWQgPSB0aGlzLmNsaWVudElkO1xuICAgICAgaWYgKHR5cGVvZiBwYXJ0ID09PSAnb2JqZWN0Jykge1xuICAgICAgICB0aGlzLnBhcnRzLnB1c2gobmV3IE1lc3NhZ2VQYXJ0KHBhcnQpKTtcbiAgICAgIH0gZWxzZSBpZiAocGFydCBpbnN0YW5jZW9mIE1lc3NhZ2VQYXJ0KSB7XG4gICAgICAgIHRoaXMucGFydHMucHVzaChwYXJ0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQWNjZXNzb3IgY2FsbGVkIHdoZW5ldmVyIHRoZSBhcHAgYWNjZXNzZXMgYG1lc3NhZ2UucmVjaXBpZW50U3RhdHVzYC5cbiAgICpcbiAgICogSW5zdXJlcyB0aGF0IHBhcnRpY2lwYW50cyB3aG8gaGF2ZW4ndCB5ZXQgYmVlbiBzZW50IHRoZSBNZXNzYWdlIGFyZSBtYXJrZWQgYXMgbGF5ZXIuQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuUEVORElOR1xuICAgKlxuICAgKiBAbWV0aG9kIF9fZ2V0UmVjaXBpZW50U3RhdHVzXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwS2V5IC0gVGhlIGFjdHVhbCBwcm9wZXJ0eSBrZXkgd2hlcmUgdGhlIHZhbHVlIGlzIHN0b3JlZFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAqL1xuICBfX2dldFJlY2lwaWVudFN0YXR1cyhwS2V5KSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzW3BLZXldIHx8IHt9O1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgaWYgKGNsaWVudCkge1xuICAgICAgY29uc3QgaWQgPSBjbGllbnQudXNlci5pZDtcbiAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHRoaXMuZ2V0Q29udmVyc2F0aW9uKGZhbHNlKTtcbiAgICAgIGlmIChjb252ZXJzYXRpb24pIHtcbiAgICAgICAgY29udmVyc2F0aW9uLnBhcnRpY2lwYW50cy5mb3JFYWNoKHBhcnRpY2lwYW50ID0+IHtcbiAgICAgICAgICBpZiAoIXZhbHVlW3BhcnRpY2lwYW50LmlkXSkge1xuICAgICAgICAgICAgdmFsdWVbcGFydGljaXBhbnQuaWRdID0gcGFydGljaXBhbnQuaWQgPT09IGlkID9cbiAgICAgICAgICAgICAgQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuUkVBRCA6IENvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlBFTkRJTkc7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSBjaGFuZ2VzIHRvIHRoZSByZWNpcGllbnRTdGF0dXMgcHJvcGVydHkuXG4gICAqXG4gICAqIEFueSB0aW1lIHRoZSByZWNpcGllbnRTdGF0dXMgcHJvcGVydHkgaXMgc2V0LFxuICAgKiBSZWNhbGN1bGF0ZSBhbGwgb2YgdGhlIHJlY2VpcHQgcmVsYXRlZCBwcm9wZXJ0aWVzOlxuICAgKlxuICAgKiAxLiBpc1JlYWRcbiAgICogMi4gcmVhZFN0YXR1c1xuICAgKiAzLiBkZWxpdmVyeVN0YXR1c1xuICAgKlxuICAgKiBAbWV0aG9kIF9fdXBkYXRlUmVjaXBpZW50U3RhdHVzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gc3RhdHVzIC0gT2JqZWN0IGRlc2NyaWJpbmcgdGhlIGRlbGl2ZXJlZC9yZWFkL3NlbnQgdmFsdWUgZm9yIGVhY2ggcGFydGljaXBhbnRcbiAgICpcbiAgICovXG4gIF9fdXBkYXRlUmVjaXBpZW50U3RhdHVzKHN0YXR1cywgb2xkU3RhdHVzKSB7XG4gICAgY29uc3QgY29udmVyc2F0aW9uID0gdGhpcy5nZXRDb252ZXJzYXRpb24oZmFsc2UpO1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG5cbiAgICBpZiAoIWNvbnZlcnNhdGlvbiB8fCBVdGlsLmRvZXNPYmplY3RNYXRjaChzdGF0dXMsIG9sZFN0YXR1cykpIHJldHVybjtcblxuICAgIGNvbnN0IGlkID0gY2xpZW50LnVzZXIuaWQ7XG4gICAgY29uc3QgaXNTZW5kZXIgPSB0aGlzLnNlbmRlci5zZXNzaW9uT3duZXI7XG4gICAgY29uc3QgdXNlckhhc1JlYWQgPSBzdGF0dXNbaWRdID09PSBDb25zdGFudHMuUkVDRUlQVF9TVEFURS5SRUFEO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIC0xIHNvIHdlIGRvbid0IGNvdW50IHRoaXMgdXNlclxuICAgICAgY29uc3QgdXNlckNvdW50ID0gY29udmVyc2F0aW9uLnBhcnRpY2lwYW50cy5sZW5ndGggLSAxO1xuXG4gICAgICAvLyBJZiBzZW50IGJ5IHRoaXMgdXNlciBvciByZWFkIGJ5IHRoaXMgdXNlciwgdXBkYXRlIGlzUmVhZC91bnJlYWRcbiAgICAgIGlmICghdGhpcy5fX2lzUmVhZCAmJiAoaXNTZW5kZXIgfHwgdXNlckhhc1JlYWQpKSB7XG4gICAgICAgIHRoaXMuX19pc1JlYWQgPSB0cnVlOyAvLyBubyBfX3VwZGF0ZUlzUmVhZCBldmVudCBmaXJlZFxuICAgICAgfVxuXG4gICAgICAvLyBVcGRhdGUgdGhlIHJlYWRTdGF0dXMvZGVsaXZlcnlTdGF0dXMgcHJvcGVydGllc1xuICAgICAgY29uc3QgeyByZWFkQ291bnQsIGRlbGl2ZXJlZENvdW50IH0gPSB0aGlzLl9nZXRSZWNlaXB0U3RhdHVzKHN0YXR1cywgaWQpO1xuICAgICAgdGhpcy5fc2V0UmVjZWlwdFN0YXR1cyhyZWFkQ291bnQsIGRlbGl2ZXJlZENvdW50LCB1c2VyQ291bnQpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAvLyBEbyBub3RoaW5nXG4gICAgfVxuXG4gICAgLy8gT25seSB0cmlnZ2VyIGFuIGV2ZW50XG4gICAgLy8gMS4gd2UncmUgbm90IGluaXRpYWxpemluZyBhIG5ldyBNZXNzYWdlXG4gICAgLy8gMi4gdGhlIHVzZXIncyBzdGF0ZSBoYXMgYmVlbiB1cGRhdGVkIHRvIHJlYWQ7IHdlIGRvbid0IGNhcmUgYWJvdXQgdXBkYXRlcyBmcm9tIG90aGVyIHVzZXJzIGlmIHdlIGFyZW4ndCB0aGUgc2VuZGVyLlxuICAgIC8vICAgIFdlIGFsc28gZG9uJ3QgY2FyZSBhYm91dCBzdGF0ZSBjaGFuZ2VzIHRvIGRlbGl2ZXJlZDsgdGhlc2UgZG8gbm90IGluZm9ybSByZW5kZXJpbmcgYXMgdGhlIGZhY3Qgd2UgYXJlIHByb2Nlc3NpbmcgaXRcbiAgICAvLyAgICBwcm92ZXMgaXRzIGRlbGl2ZXJlZC5cbiAgICAvLyAzLiBUaGUgdXNlciBpcyB0aGUgc2VuZGVyOyBpbiB0aGF0IGNhc2Ugd2UgZG8gY2FyZSBhYm91dCByZW5kZXJpbmcgcmVjZWlwdHMgZnJvbSBvdGhlciB1c2Vyc1xuICAgIGlmICghdGhpcy5pc0luaXRpYWxpemluZyAmJiBvbGRTdGF0dXMpIHtcbiAgICAgIGNvbnN0IHVzZXJzU3RhdGVVcGRhdGVkVG9SZWFkID0gdXNlckhhc1JlYWQgJiYgb2xkU3RhdHVzW2lkXSAhPT0gQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuUkVBRDtcbiAgICAgIGlmICh1c2Vyc1N0YXRlVXBkYXRlZFRvUmVhZCB8fCBpc1NlbmRlcikge1xuICAgICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ21lc3NhZ2VzOmNoYW5nZScsIHtcbiAgICAgICAgICBvbGRWYWx1ZTogb2xkU3RhdHVzLFxuICAgICAgICAgIG5ld1ZhbHVlOiBzdGF0dXMsXG4gICAgICAgICAgcHJvcGVydHk6ICdyZWNpcGllbnRTdGF0dXMnLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBudW1iZXIgb2YgcGFydGljaXBhbnRzIHdobyBoYXZlIHJlYWQgYW5kIGJlZW4gZGVsaXZlcmVkXG4gICAqIHRoaXMgTWVzc2FnZVxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRSZWNlaXB0U3RhdHVzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gc3RhdHVzIC0gT2JqZWN0IGRlc2NyaWJpbmcgdGhlIGRlbGl2ZXJlZC9yZWFkL3NlbnQgdmFsdWUgZm9yIGVhY2ggcGFydGljaXBhbnRcbiAgICogQHBhcmFtICB7c3RyaW5nfSBpZCAtIElkZW50aXR5IElEIGZvciB0aGlzIHVzZXI7IG5vdCBjb3VudGVkIHdoZW4gcmVwb3J0aW5nIG9uIGhvdyBtYW55IHBlb3BsZSBoYXZlIHJlYWQvcmVjZWl2ZWQuXG4gICAqIEByZXR1cm4ge09iamVjdH0gcmVzdWx0XG4gICAqIEByZXR1cm4ge251bWJlcn0gcmVzdWx0LnJlYWRDb3VudFxuICAgKiBAcmV0dXJuIHtudW1iZXJ9IHJlc3VsdC5kZWxpdmVyZWRDb3VudFxuICAgKi9cbiAgX2dldFJlY2VpcHRTdGF0dXMoc3RhdHVzLCBpZCkge1xuICAgIGxldCByZWFkQ291bnQgPSAwLFxuICAgICAgZGVsaXZlcmVkQ291bnQgPSAwO1xuICAgIE9iamVjdC5rZXlzKHN0YXR1cylcbiAgICAgIC5maWx0ZXIocGFydGljaXBhbnQgPT4gcGFydGljaXBhbnQgIT09IGlkKVxuICAgICAgLmZvckVhY2gocGFydGljaXBhbnQgPT4ge1xuICAgICAgICBpZiAoc3RhdHVzW3BhcnRpY2lwYW50XSA9PT0gQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuUkVBRCkge1xuICAgICAgICAgIHJlYWRDb3VudCsrO1xuICAgICAgICAgIGRlbGl2ZXJlZENvdW50Kys7XG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdHVzW3BhcnRpY2lwYW50XSA9PT0gQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuREVMSVZFUkVEKSB7XG4gICAgICAgICAgZGVsaXZlcmVkQ291bnQrKztcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgcmVhZENvdW50LFxuICAgICAgZGVsaXZlcmVkQ291bnQsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBsYXllci5NZXNzYWdlLnJlYWRTdGF0dXMgYW5kIGxheWVyLk1lc3NhZ2UuZGVsaXZlcnlTdGF0dXMgcHJvcGVydGllcy5cbiAgICpcbiAgICogQG1ldGhvZCBfc2V0UmVjZWlwdFN0YXR1c1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtudW1iZXJ9IHJlYWRDb3VudFxuICAgKiBAcGFyYW0gIHtudW1iZXJ9IGRlbGl2ZXJlZENvdW50XG4gICAqIEBwYXJhbSAge251bWJlcn0gdXNlckNvdW50XG4gICAqL1xuICBfc2V0UmVjZWlwdFN0YXR1cyhyZWFkQ291bnQsIGRlbGl2ZXJlZENvdW50LCB1c2VyQ291bnQpIHtcbiAgICBpZiAocmVhZENvdW50ID09PSB1c2VyQ291bnQpIHtcbiAgICAgIHRoaXMucmVhZFN0YXR1cyA9IENvbnN0YW50cy5SRUNJUElFTlRfU1RBVEUuQUxMO1xuICAgIH0gZWxzZSBpZiAocmVhZENvdW50ID4gMCkge1xuICAgICAgdGhpcy5yZWFkU3RhdHVzID0gQ29uc3RhbnRzLlJFQ0lQSUVOVF9TVEFURS5TT01FO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJlYWRTdGF0dXMgPSBDb25zdGFudHMuUkVDSVBJRU5UX1NUQVRFLk5PTkU7XG4gICAgfVxuICAgIGlmIChkZWxpdmVyZWRDb3VudCA9PT0gdXNlckNvdW50KSB7XG4gICAgICB0aGlzLmRlbGl2ZXJ5U3RhdHVzID0gQ29uc3RhbnRzLlJFQ0lQSUVOVF9TVEFURS5BTEw7XG4gICAgfSBlbHNlIGlmIChkZWxpdmVyZWRDb3VudCA+IDApIHtcbiAgICAgIHRoaXMuZGVsaXZlcnlTdGF0dXMgPSBDb25zdGFudHMuUkVDSVBJRU5UX1NUQVRFLlNPTUU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVsaXZlcnlTdGF0dXMgPSBDb25zdGFudHMuUkVDSVBJRU5UX1NUQVRFLk5PTkU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSBjaGFuZ2VzIHRvIHRoZSBpc1JlYWQgcHJvcGVydHkuXG4gICAqXG4gICAqIElmIHNvbWVvbmUgY2FsbGVkIG0uaXNSZWFkID0gdHJ1ZSwgQU5EXG4gICAqIGlmIGl0IHdhcyBwcmV2aW91c2x5IGZhbHNlLCBBTkRcbiAgICogaWYgdGhlIGNhbGwgZGlkbid0IGNvbWUgZnJvbSBsYXllci5NZXNzYWdlLl9fdXBkYXRlUmVjaXBpZW50U3RhdHVzLFxuICAgKiBUaGVuIG5vdGlmeSB0aGUgc2VydmVyIHRoYXQgdGhlIG1lc3NhZ2UgaGFzIGJlZW4gcmVhZC5cbiAgICpcbiAgICpcbiAgICogQG1ldGhvZCBfX3VwZGF0ZUlzUmVhZFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtib29sZWFufSB2YWx1ZSAtIFRydWUgaWYgaXNSZWFkIGlzIHRydWUuXG4gICAqL1xuICBfX3VwZGF0ZUlzUmVhZCh2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSkge1xuICAgICAgaWYgKCF0aGlzLl9pblBvcHVsYXRlRnJvbVNlcnZlcikge1xuICAgICAgICB0aGlzLl9zZW5kUmVjZWlwdChDb25zdGFudHMuUkVDRUlQVF9TVEFURS5SRUFEKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3RyaWdnZXJNZXNzYWdlUmVhZCgpO1xuICAgICAgY29uc3QgY29udmVyc2F0aW9uID0gdGhpcy5nZXRDb252ZXJzYXRpb24oZmFsc2UpO1xuICAgICAgaWYgKGNvbnZlcnNhdGlvbikgY29udmVyc2F0aW9uLnVucmVhZENvdW50LS07XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRyaWdnZXIgZXZlbnRzIGluZGljYXRpbmcgY2hhbmdlcyB0byB0aGUgaXNSZWFkL2lzVW5yZWFkIHByb3BlcnRpZXMuXG4gICAqXG4gICAqIEBtZXRob2QgX3RyaWdnZXJNZXNzYWdlUmVhZFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3RyaWdnZXJNZXNzYWdlUmVhZCgpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMuaXNSZWFkO1xuICAgIHRoaXMuX3RyaWdnZXJBc3luYygnbWVzc2FnZXM6Y2hhbmdlJywge1xuICAgICAgcHJvcGVydHk6ICdpc1JlYWQnLFxuICAgICAgb2xkVmFsdWU6ICF2YWx1ZSxcbiAgICAgIG5ld1ZhbHVlOiB2YWx1ZSxcbiAgICB9KTtcbiAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ21lc3NhZ2VzOmNoYW5nZScsIHtcbiAgICAgIHByb3BlcnR5OiAnaXNVbnJlYWQnLFxuICAgICAgb2xkVmFsdWU6IHZhbHVlLFxuICAgICAgbmV3VmFsdWU6ICF2YWx1ZSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kIGEgUmVhZCBvciBEZWxpdmVyeSBSZWNlaXB0IHRvIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEZvciBSZWFkIFJlY2VpcHQsIHlvdSBjYW4gYWxzbyBqdXN0IHdyaXRlOlxuICAgKlxuICAgKiBgYGBcbiAgICogbWVzc2FnZS5pc1JlYWQgPSB0cnVlO1xuICAgKiBgYGBcbiAgICpcbiAgICogWW91IGNhbiByZXRyYWN0IGEgRGVsaXZlcnkgb3IgUmVhZCBSZWNlaXB0OyBvbmNlIG1hcmtlZCBhcyBEZWxpdmVyZWQgb3IgUmVhZCwgaXQgY2FuJ3QgZ28gYmFjay5cbiAgICpcbiAgICogYGBgXG4gICAqIG1lc3NzYWdlLnNlbmRSZWNlaXB0KGxheWVyLkNvbnN0YW50cy5SRUNFSVBUX1NUQVRFLlJFQUQpO1xuICAgKiBgYGBcbiAgICpcbiAgICogQG1ldGhvZCBzZW5kUmVjZWlwdFxuICAgKiBAcGFyYW0ge3N0cmluZ30gW3R5cGU9bGF5ZXIuQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuUkVBRF0gLSBPbmUgb2YgbGF5ZXIuQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuUkVBRCBvciBsYXllci5Db25zdGFudHMuUkVDRUlQVF9TVEFURS5ERUxJVkVSWVxuICAgKiBAcmV0dXJuIHtsYXllci5NZXNzYWdlfSB0aGlzXG4gICAqL1xuICBzZW5kUmVjZWlwdCh0eXBlID0gQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuUkVBRCkge1xuICAgIGlmICh0eXBlID09PSBDb25zdGFudHMuUkVDRUlQVF9TVEFURS5SRUFEKSB7XG4gICAgICBpZiAodGhpcy5pc1JlYWQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBXaXRob3V0IHRyaWdnZXJpbmcgdGhlIGV2ZW50LCBjbGVhck9iamVjdCBpc24ndCBjYWxsZWQsXG4gICAgICAgIC8vIHdoaWNoIG1lYW5zIHRob3NlIHVzaW5nIHRoZSB0b09iamVjdCgpIGRhdGEgd2lsbCBoYXZlIGFuIGlzUmVhZCB0aGF0IGRvZXNuJ3QgbWF0Y2hcbiAgICAgICAgLy8gdGhpcyBpbnN0YW5jZS4gIFdoaWNoIHR5cGljYWxseSBsZWFkcyB0byBsb3RzIG9mIGV4dHJhIGF0dGVtcHRzXG4gICAgICAgIC8vIHRvIG1hcmsgdGhlIG1lc3NhZ2UgYXMgcmVhZC5cbiAgICAgICAgdGhpcy5fX2lzUmVhZCA9IHRydWU7XG4gICAgICAgIHRoaXMuX3RyaWdnZXJNZXNzYWdlUmVhZCgpO1xuICAgICAgICBjb25zdCBjb252ZXJzYXRpb24gPSB0aGlzLmdldENvbnZlcnNhdGlvbihmYWxzZSk7XG4gICAgICAgIGlmIChjb252ZXJzYXRpb24pIGNvbnZlcnNhdGlvbi51bnJlYWRDb3VudC0tO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLl9zZW5kUmVjZWlwdCh0eXBlKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kIGEgUmVhZCBvciBEZWxpdmVyeSBSZWNlaXB0IHRvIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIFRoaXMgYnlwYXNzZXMgYW55IHZhbGlkYXRpb24gYW5kIGdvZXMgZGlyZWN0IHRvIHNlbmRpbmcgdG8gdGhlIHNlcnZlci5cbiAgICpcbiAgICogTk9URTogU2VydmVyIGVycm9ycyBhcmUgbm90IGhhbmRsZWQ7IHRoZSBsb2NhbCByZWNlaXB0IHN0YXRlIGlzIHN1aXRhYmxlIGV2ZW5cbiAgICogaWYgb3V0IG9mIHN5bmMgd2l0aCB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBAbWV0aG9kIF9zZW5kUmVjZWlwdFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gW3R5cGU9cmVhZF0gLSBPbmUgb2YgbGF5ZXIuQ29uc3RhbnRzLlJFQ0VJUFRfU1RBVEUuUkVBRCBvciBsYXllci5Db25zdGFudHMuUkVDRUlQVF9TVEFURS5ERUxJVkVSWVxuICAgKi9cbiAgX3NlbmRSZWNlaXB0KHR5cGUpIHtcbiAgICAvLyBUaGlzIGxpdHRsZSB0ZXN0IGV4aXN0cyBzbyB0aGF0IHdlIGRvbid0IHNlbmQgcmVjZWlwdHMgb24gQ29udmVyc2F0aW9ucyB3ZSBhcmUgbm8gbG9uZ2VyXG4gICAgLy8gcGFydGljaXBhbnRzIGluIChwYXJ0aWNpcGFudHMgPSBbXSBpZiB3ZSBhcmUgbm90IGEgcGFydGljaXBhbnQpXG4gICAgY29uc3QgY29udmVyc2F0aW9uID0gdGhpcy5nZXRDb252ZXJzYXRpb24oZmFsc2UpO1xuICAgIGlmIChjb252ZXJzYXRpb24gJiYgY29udmVyc2F0aW9uLnBhcnRpY2lwYW50cy5sZW5ndGggPT09IDApIHJldHVybjtcblxuICAgIHRoaXMuX3NldFN5bmNpbmcoKTtcbiAgICB0aGlzLl94aHIoe1xuICAgICAgdXJsOiAnL3JlY2VpcHRzJyxcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgZGF0YToge1xuICAgICAgICB0eXBlLFxuICAgICAgfSxcbiAgICAgIHN5bmM6IHtcbiAgICAgICAgLy8gVGhpcyBzaG91bGQgbm90IGJlIHRyZWF0ZWQgYXMgYSBQT1NUL0NSRUFURSByZXF1ZXN0IG9uIHRoZSBNZXNzYWdlXG4gICAgICAgIG9wZXJhdGlvbjogJ1JFQ0VJUFQnLFxuICAgICAgfSxcbiAgICB9LCAoKSA9PiB0aGlzLl9zZXRTeW5jZWQoKSk7XG4gIH1cblxuICAvKipcbiAgICogU2VuZCB0aGUgbWVzc2FnZSB0byBhbGwgcGFydGljaXBhbnRzIG9mIHRoZSBDb252ZXJzYXRpb24uXG4gICAqXG4gICAqIE1lc3NhZ2UgbXVzdCBoYXZlIHBhcnRzIGFuZCBhIHZhbGlkIGNvbnZlcnNhdGlvbiB0byBzZW5kIHN1Y2Nlc3NmdWxseS5cbiAgICpcbiAgICogVGhlIHNlbmQgbWV0aG9kIHRha2VzIGEgYG5vdGlmaWNhdGlvbmAgb2JqZWN0LiBJbiBub3JtYWwgdXNlLCBpdCBwcm92aWRlcyB0aGUgc2FtZSBub3RpZmljYXRpb24gdG8gQUxMXG4gICAqIHJlY2lwaWVudHMsIGJ1dCB5b3UgY2FuIGN1c3RvbWl6ZSBub3RpZmljYXRpb25zIG9uIGEgcGVyIHJlY2lwaWVudCBiYXNpcywgYXMgd2VsbCBhcyBlbWJlZCBhY3Rpb25zIGludG8gdGhlIG5vdGlmaWNhdGlvbi5cbiAgICogRm9yIHRoZSBGdWxsIEFQSSwgc2VlIGh0dHBzOi8vZGV2ZWxvcGVyLmxheWVyLmNvbS9kb2NzL3BsYXRmb3JtL21lc3NhZ2VzI25vdGlmaWNhdGlvbi1jdXN0b21pemF0aW9uLlxuICAgKlxuICAgKiBGb3IgdGhlIEZ1bGwgQVBJLCBzZWUgW1NlcnZlciBEb2NzXShodHRwczovL2RldmVsb3Blci5sYXllci5jb20vZG9jcy9wbGF0Zm9ybS9tZXNzYWdlcyNub3RpZmljYXRpb24tY3VzdG9taXphdGlvbikuXG4gICAqXG4gICAqIGBgYFxuICAgKiBtZXNzYWdlLnNlbmQoe1xuICAgKiAgICB0aXRsZTogXCJOZXcgSG9iYml0IE1lc3NhZ2VcIixcbiAgICogICAgdGV4dDogXCJGcm9kby10aGUtRG9kbzogSGVsbG8gU2FtLCB3aGF0IHNheSB3ZSB3YWx0eiBpbnRvIE1vcmRvciBsaWtlIHdlIG93biB0aGUgcGxhY2U/XCIsXG4gICAqICAgIHNvdW5kOiBcIndoaW55aG9iYml0LmFpZmZcIlxuICAgKiB9KTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBtZXRob2Qgc2VuZFxuICAgKiBAcGFyYW0ge09iamVjdH0gW25vdGlmaWNhdGlvbl0gLSBQYXJhbWV0ZXJzIGZvciBjb250cm9saW5nIGhvdyB0aGUgcGhvbmVzIG1hbmFnZSBub3RpZmljYXRpb25zIG9mIHRoZSBuZXcgTWVzc2FnZS5cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgIFNlZSBJT1MgYW5kIEFuZHJvaWQgZG9jcyBmb3IgZGV0YWlscy5cbiAgICogQHBhcmFtIHtzdHJpbmd9IFtub3RpZmljYXRpb24udGl0bGVdIC0gVGl0bGUgdG8gc2hvdyBvbiBsb2NrIHNjcmVlbiBhbmQgbm90aWZpY2F0aW9uIGJhclxuICAgKiBAcGFyYW0ge3N0cmluZ30gW25vdGlmaWNhdGlvbi50ZXh0XSAtIFRleHQgb2YgeW91ciBub3RpZmljYXRpb25cbiAgICogQHBhcmFtIHtzdHJpbmd9IFtub3RpZmljYXRpb24uc291bmRdIC0gTmFtZSBvZiBhbiBhdWRpbyBmaWxlIG9yIG90aGVyIHNvdW5kLXJlbGF0ZWQgaGludFxuICAgKiBAcmV0dXJuIHtsYXllci5NZXNzYWdlfSB0aGlzXG4gICAqL1xuICBzZW5kKG5vdGlmaWNhdGlvbikge1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgaWYgKCFjbGllbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuY2xpZW50TWlzc2luZyk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udmVyc2F0aW9uID0gdGhpcy5nZXRDb252ZXJzYXRpb24odHJ1ZSk7XG5cbiAgICBpZiAoIWNvbnZlcnNhdGlvbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jb252ZXJzYXRpb25NaXNzaW5nKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zeW5jU3RhdGUgIT09IENvbnN0YW50cy5TWU5DX1NUQVRFLk5FVykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5hbHJlYWR5U2VudCk7XG4gICAgfVxuXG5cbiAgICBpZiAoY29udmVyc2F0aW9uLmlzTG9hZGluZykge1xuICAgICAgY29udmVyc2F0aW9uLm9uY2UoJ2NvbnZlcnNhdGlvbnM6bG9hZGVkJywgKCkgPT4gdGhpcy5zZW5kKG5vdGlmaWNhdGlvbikpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnBhcnRzIHx8ICF0aGlzLnBhcnRzLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5wYXJ0c01pc3NpbmcpO1xuICAgIH1cblxuICAgIHRoaXMuX3NldFN5bmNpbmcoKTtcblxuICAgIC8vIE1ha2Ugc3VyZSB0aGF0IHRoZSBDb252ZXJzYXRpb24gaGFzIGJlZW4gY3JlYXRlZCBvbiB0aGUgc2VydmVyXG4gICAgLy8gYW5kIHVwZGF0ZSB0aGUgbGFzdE1lc3NhZ2UgcHJvcGVydHlcbiAgICBjb252ZXJzYXRpb24uc2VuZCh0aGlzKTtcblxuICAgIC8vIElmIHdlIGFyZSBzZW5kaW5nIGFueSBGaWxlL0Jsb2Igb2JqZWN0cywgYW5kIHRoZWlyIE1pbWUgVHlwZXMgbWF0Y2ggb3VyIHRlc3QsXG4gICAgLy8gd2FpdCB1bnRpbCB0aGUgYm9keSBpcyB1cGRhdGVkIHRvIGJlIGEgc3RyaW5nIHJhdGhlciB0aGFuIEZpbGUgYmVmb3JlIGNhbGxpbmcgX2FkZE1lc3NhZ2VcbiAgICAvLyB3aGljaCB3aWxsIGFkZCBpdCB0byB0aGUgUXVlcnkgUmVzdWx0cyBhbmQgcGFzcyB0aGlzIG9uIHRvIGEgcmVuZGVyZXIgdGhhdCBleHBlY3RzIFwidGV4dC9wbGFpblwiIHRvIGJlIGEgc3RyaW5nXG4gICAgLy8gcmF0aGVyIHRoYW4gYSBibG9iLlxuICAgIHRoaXMuX3JlYWRBbGxCbG9icygoKSA9PiB7XG4gICAgICAvLyBDYWxsaW5nIHRoaXMgd2lsbCBhZGQgdGhpcyB0byBhbnkgbGlzdGVuaW5nIFF1ZXJpZXMuLi4gc28gcG9zaXRpb24gbmVlZHMgdG8gaGF2ZSBiZWVuIHNldCBmaXJzdDtcbiAgICAgIC8vIGhhbmRsZWQgaW4gY29udmVyc2F0aW9uLnNlbmQodGhpcylcbiAgICAgIGNsaWVudC5fYWRkTWVzc2FnZSh0aGlzKTtcblxuICAgICAgLy8gYWxsb3cgZm9yIG1vZGlmaWNhdGlvbiBvZiBtZXNzYWdlIGJlZm9yZSBzZW5kaW5nXG4gICAgICB0aGlzLnRyaWdnZXIoJ21lc3NhZ2VzOnNlbmRpbmcnKTtcblxuICAgICAgY29uc3QgZGF0YSA9IHtcbiAgICAgICAgcGFydHM6IG5ldyBBcnJheSh0aGlzLnBhcnRzLmxlbmd0aCksXG4gICAgICAgIGlkOiB0aGlzLmlkLFxuICAgICAgfTtcbiAgICAgIGlmIChub3RpZmljYXRpb24pIGRhdGEubm90aWZpY2F0aW9uID0gbm90aWZpY2F0aW9uO1xuXG4gICAgICB0aGlzLl9wcmVwYXJlUGFydHNGb3JTZW5kaW5nKGRhdGEpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEFueSBNZXNzYWdlUGFydCB0aGF0IGNvbnRhaW5zIGEgdGV4dHVhbCBibG9iIHNob3VsZCBjb250YWluIGEgc3RyaW5nIGJlZm9yZSB3ZSBzZW5kLlxuICAgKlxuICAgKiBJZiBhIE1lc3NhZ2VQYXJ0IHdpdGggYSBCbG9iIG9yIEZpbGUgYXMgaXRzIGJvZHkgd2VyZSB0byBiZSBhZGRlZCB0byB0aGUgQ2xpZW50LFxuICAgKiBUaGUgUXVlcnkgd291bGQgcmVjZWl2ZSB0aGlzLCBkZWxpdmVyIGl0IHRvIGFwcHMgYW5kIHRoZSBhcHAgd291bGQgY3Jhc2guXG4gICAqIE1vc3QgcmVuZGVyaW5nIGNvZGUgZXhwZWN0aW5nIHRleHQvcGxhaW4gd291bGQgZXhwZWN0IGEgc3RyaW5nIG5vdCBhIEZpbGUuXG4gICAqXG4gICAqIFdoZW4gdGhpcyB1c2VyIGlzIHNlbmRpbmcgYSBmaWxlLCBhbmQgdGhhdCBmaWxlIGlzIHRleHR1YWwsIG1ha2Ugc3VyZVxuICAgKiBpdHMgYWN0dWFsIHRleHQgZGVsaXZlcmVkIHRvIHRoZSBVSS5cbiAgICpcbiAgICogQG1ldGhvZCBfcmVhZEFsbEJsb2JzXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcmVhZEFsbEJsb2JzKGNhbGxiYWNrKSB7XG4gICAgbGV0IGNvdW50ID0gMDtcbiAgICBjb25zdCBwYXJ0cyA9IHRoaXMucGFydHMuZmlsdGVyKHBhcnQgPT4gVXRpbC5pc0Jsb2IocGFydC5ib2R5KSAmJiBwYXJ0LmlzVGV4dHVhbE1pbWVUeXBlKCkpO1xuICAgIHBhcnRzLmZvckVhY2goKHBhcnQpID0+IHtcbiAgICAgIFV0aWwuZmV0Y2hUZXh0RnJvbUZpbGUocGFydC5ib2R5LCAodGV4dCkgPT4ge1xuICAgICAgICBwYXJ0LmJvZHkgPSB0ZXh0O1xuICAgICAgICBjb3VudCsrO1xuICAgICAgICBpZiAoY291bnQgPT09IHBhcnRzLmxlbmd0aCkgY2FsbGJhY2soKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIGlmICghcGFydHMubGVuZ3RoKSBjYWxsYmFjaygpO1xuICB9XG5cbiAgLyoqXG4gICAqIEluc3VyZXMgdGhhdCBlYWNoIHBhcnQgaXMgcmVhZHkgdG8gc2VuZCBiZWZvcmUgYWN0dWFsbHkgc2VuZGluZyB0aGUgTWVzc2FnZS5cbiAgICpcbiAgICogQG1ldGhvZCBfcHJlcGFyZVBhcnRzRm9yU2VuZGluZ1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IHN0cnVjdHVyZSB0byBiZSBzZW50IHRvIHRoZSBzZXJ2ZXJcbiAgICovXG4gIF9wcmVwYXJlUGFydHNGb3JTZW5kaW5nKGRhdGEpIHtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIGxldCBjb3VudCA9IDA7XG4gICAgdGhpcy5wYXJ0cy5mb3JFYWNoKChwYXJ0LCBpbmRleCkgPT4ge1xuICAgICAgcGFydC5vbmNlKCdwYXJ0czpzZW5kJywgZXZ0ID0+IHtcbiAgICAgICAgZGF0YS5wYXJ0c1tpbmRleF0gPSB7XG4gICAgICAgICAgbWltZV90eXBlOiBldnQubWltZV90eXBlLFxuICAgICAgICB9O1xuICAgICAgICBpZiAoZXZ0LmNvbnRlbnQpIGRhdGEucGFydHNbaW5kZXhdLmNvbnRlbnQgPSBldnQuY29udGVudDtcbiAgICAgICAgaWYgKGV2dC5ib2R5KSBkYXRhLnBhcnRzW2luZGV4XS5ib2R5ID0gZXZ0LmJvZHk7XG4gICAgICAgIGlmIChldnQuZW5jb2RpbmcpIGRhdGEucGFydHNbaW5kZXhdLmVuY29kaW5nID0gZXZ0LmVuY29kaW5nO1xuXG4gICAgICAgIGNvdW50Kys7XG4gICAgICAgIGlmIChjb3VudCA9PT0gdGhpcy5wYXJ0cy5sZW5ndGgpIHtcbiAgICAgICAgICB0aGlzLl9zZW5kKGRhdGEpO1xuICAgICAgICB9XG4gICAgICB9LCB0aGlzKTtcbiAgICAgIHBhcnQuX3NlbmQoY2xpZW50KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGUgdGhlIGFjdHVhbCBzZW5kaW5nLlxuICAgKlxuICAgKiBsYXllci5NZXNzYWdlLnNlbmQgaGFzIHNvbWUgcG90ZW50aWFsbHkgYXN5bmNocm9ub3VzXG4gICAqIHByZXByb2Nlc3NpbmcgdG8gZG8gYmVmb3JlIHNlbmRpbmcgKFJpY2ggQ29udGVudCk7IGFjdHVhbCBzZW5kaW5nXG4gICAqIGlzIGRvbmUgaGVyZS5cbiAgICpcbiAgICogQG1ldGhvZCBfc2VuZFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3NlbmQoZGF0YSkge1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuZ2V0Q2xpZW50KCk7XG4gICAgY29uc3QgY29udmVyc2F0aW9uID0gdGhpcy5nZXRDb252ZXJzYXRpb24oZmFsc2UpO1xuXG4gICAgdGhpcy5zZW50QXQgPSBuZXcgRGF0ZSgpO1xuICAgIGNsaWVudC5zZW5kU29ja2V0UmVxdWVzdCh7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGJvZHk6IHtcbiAgICAgICAgbWV0aG9kOiAnTWVzc2FnZS5jcmVhdGUnLFxuICAgICAgICBvYmplY3RfaWQ6IGNvbnZlcnNhdGlvbi5pZCxcbiAgICAgICAgZGF0YSxcbiAgICAgIH0sXG4gICAgICBzeW5jOiB7XG4gICAgICAgIGRlcGVuZHM6IFt0aGlzLmNvbnZlcnNhdGlvbklkLCB0aGlzLmlkXSxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLmlkLFxuICAgICAgfSxcbiAgICB9LCAoc3VjY2Vzcywgc29ja2V0RGF0YSkgPT4gdGhpcy5fc2VuZFJlc3VsdChzdWNjZXNzLCBzb2NrZXREYXRhKSk7XG4gIH1cblxuICBfZ2V0U2VuZERhdGEoZGF0YSkge1xuICAgIGRhdGEub2JqZWN0X2lkID0gdGhpcy5jb252ZXJzYXRpb25JZDtcbiAgICByZXR1cm4gZGF0YTtcbiAgfVxuXG4gIC8qKlxuICAgICogbGF5ZXIuTWVzc2FnZS5zZW5kKCkgU3VjY2VzcyBDYWxsYmFjay5cbiAgICAqXG4gICAgKiBJZiBzdWNjZXNzZnVsbHkgc2VuZGluZyB0aGUgbWVzc2FnZTsgdHJpZ2dlcnMgYSAnc2VudCcgZXZlbnQsXG4gICAgKiBhbmQgdXBkYXRlcyB0aGUgbWVzc2FnZS5pZC91cmxcbiAgICAqXG4gICAgKiBAbWV0aG9kIF9zZW5kUmVzdWx0XG4gICAgKiBAcHJpdmF0ZVxuICAgICogQHBhcmFtIHtPYmplY3R9IG1lc3NhZ2VEYXRhIC0gU2VydmVyIGRlc2NyaXB0aW9uIG9mIHRoZSBtZXNzYWdlXG4gICAgKi9cbiAgX3NlbmRSZXN1bHQoeyBzdWNjZXNzLCBkYXRhIH0pIHtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCkgcmV0dXJuO1xuXG4gICAgaWYgKHN1Y2Nlc3MpIHtcbiAgICAgIHRoaXMuX3BvcHVsYXRlRnJvbVNlcnZlcihkYXRhKTtcbiAgICAgIHRoaXMuX3RyaWdnZXJBc3luYygnbWVzc2FnZXM6c2VudCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnRyaWdnZXIoJ21lc3NhZ2VzOnNlbnQtZXJyb3InLCB7IGVycm9yOiBkYXRhIH0pO1xuICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgfVxuICAgIHRoaXMuX3NldFN5bmNlZCgpO1xuICB9XG5cbiAgLyogTk9UIEZPUiBKU0RVQ0tcbiAgICogU3RhbmRhcmQgYG9uKClgIHByb3ZpZGVkIGJ5IGxheWVyLlJvb3QuXG4gICAqXG4gICAqIEFkZHMgc29tZSBzcGVjaWFsIGhhbmRsaW5nIG9mICdtZXNzYWdlczpsb2FkZWQnIHNvIHRoYXQgY2FsbHMgc3VjaCBhc1xuICAgKlxuICAgKiAgICAgIHZhciBtID0gY2xpZW50LmdldE1lc3NhZ2UoJ2xheWVyOi8vL21lc3NhZ2VzLzEyMycsIHRydWUpXG4gICAqICAgICAgLm9uKCdtZXNzYWdlczpsb2FkZWQnLCBmdW5jdGlvbigpIHtcbiAgICogICAgICAgICAgbXlyZXJlbmRlcihtKTtcbiAgICogICAgICB9KTtcbiAgICogICAgICBteXJlbmRlcihtKTsgLy8gcmVuZGVyIGEgcGxhY2Vob2xkZXIgZm9yIG0gdW50aWwgdGhlIGRldGFpbHMgb2YgbSBoYXZlIGxvYWRlZFxuICAgKlxuICAgKiBjYW4gZmlyZSB0aGVpciBjYWxsYmFjayByZWdhcmRsZXNzIG9mIHdoZXRoZXIgdGhlIGNsaWVudCBsb2FkcyBvciBoYXNcbiAgICogYWxyZWFkeSBsb2FkZWQgdGhlIE1lc3NhZ2UuXG4gICAqXG4gICAqIEBtZXRob2Qgb25cbiAgICogQHBhcmFtICB7c3RyaW5nfSBldmVudE5hbWVcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGV2ZW50SGFuZGxlclxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGNvbnRleHRcbiAgICogQHJldHVybiB7bGF5ZXIuTWVzc2FnZX0gdGhpc1xuICAgKi9cbiAgb24obmFtZSwgY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgICBjb25zdCBoYXNMb2FkZWRFdnQgPSBuYW1lID09PSAnbWVzc2FnZXM6bG9hZGVkJyB8fFxuICAgICAgbmFtZSAmJiB0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcgJiYgbmFtZVsnbWVzc2FnZXM6bG9hZGVkJ107XG5cbiAgICBpZiAoaGFzTG9hZGVkRXZ0ICYmICF0aGlzLmlzTG9hZGluZykge1xuICAgICAgY29uc3QgY2FsbE5vdyA9IG5hbWUgPT09ICdtZXNzYWdlczpsb2FkZWQnID8gY2FsbGJhY2sgOiBuYW1lWydtZXNzYWdlczpsb2FkZWQnXTtcbiAgICAgIFV0aWwuZGVmZXIoKCkgPT4gY2FsbE5vdy5hcHBseShjb250ZXh0KSk7XG4gICAgfVxuICAgIHN1cGVyLm9uKG5hbWUsIGNhbGxiYWNrLCBjb250ZXh0KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWxldGUgdGhlIE1lc3NhZ2UgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBUaGlzIGNhbGwgd2lsbCBzdXBwb3J0IHZhcmlvdXMgZGVsZXRpb24gbW9kZXMuICBDYWxsaW5nIHdpdGhvdXQgYSBkZWxldGlvbiBtb2RlIGlzIGRlcHJlY2F0ZWQuXG4gICAqXG4gICAqIERlbGV0aW9uIE1vZGVzOlxuICAgKlxuICAgKiAqIGxheWVyLkNvbnN0YW50cy5ERUxFVElPTl9NT0RFLkFMTDogVGhpcyBkZWxldGVzIHRoZSBsb2NhbCBjb3B5IGltbWVkaWF0ZWx5LCBhbmQgYXR0ZW1wdHMgdG8gYWxzb1xuICAgKiAgIGRlbGV0ZSB0aGUgc2VydmVyJ3MgY29weS5cbiAgICogKiBsYXllci5Db25zdGFudHMuREVMRVRJT05fTU9ERS5NWV9ERVZJQ0VTOiBEZWxldGVzIHRoaXMgTWVzc2FnZSBmcm9tIGFsbCBvZiBteSBkZXZpY2VzOyBubyBlZmZlY3Qgb24gb3RoZXIgdXNlcnMuXG4gICAqXG4gICAqIEBtZXRob2QgZGVsZXRlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBkZWxldGlvbk1vZGVcbiAgICovXG4gIGRlbGV0ZShtb2RlKSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuaXNEZXN0cm95ZWQpO1xuXG4gICAgbGV0IHF1ZXJ5U3RyO1xuICAgIHN3aXRjaCAobW9kZSkge1xuICAgICAgY2FzZSBDb25zdGFudHMuREVMRVRJT05fTU9ERS5BTEw6XG4gICAgICBjYXNlIHRydWU6XG4gICAgICAgIHF1ZXJ5U3RyID0gJ21vZGU9YWxsX3BhcnRpY2lwYW50cyc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBDb25zdGFudHMuREVMRVRJT05fTU9ERS5NWV9ERVZJQ0VTOlxuICAgICAgICBxdWVyeVN0ciA9ICdtb2RlPW15X2RldmljZXMnO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuZGVsZXRpb25Nb2RlVW5zdXBwb3J0ZWQpO1xuICAgIH1cblxuICAgIGNvbnN0IGlkID0gdGhpcy5pZDtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIHRoaXMuX3hocih7XG4gICAgICB1cmw6ICc/JyArIHF1ZXJ5U3RyLFxuICAgICAgbWV0aG9kOiAnREVMRVRFJyxcbiAgICB9LCByZXN1bHQgPT4ge1xuICAgICAgaWYgKCFyZXN1bHQuc3VjY2VzcyAmJiAoIXJlc3VsdC5kYXRhIHx8IHJlc3VsdC5kYXRhLmlkICE9PSAnbm90X2ZvdW5kJykpIE1lc3NhZ2UubG9hZChpZCwgY2xpZW50KTtcbiAgICB9KTtcblxuICAgIHRoaXMuX2RlbGV0ZWQoKTtcbiAgICB0aGlzLmRlc3Ryb3koKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgdGhpcyBNZXNzYWdlIGZyb20gdGhlIHN5c3RlbS5cbiAgICpcbiAgICogVGhpcyB3aWxsIGRlcmVnaXN0ZXIgdGhlIE1lc3NhZ2UsIHJlbW92ZSBhbGwgZXZlbnRzXG4gICAqIGFuZCBhbGxvdyBnYXJiYWdlIGNvbGxlY3Rpb24uXG4gICAqXG4gICAqIEBtZXRob2QgZGVzdHJveVxuICAgKi9cbiAgZGVzdHJveSgpIHtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIGlmIChjbGllbnQpIGNsaWVudC5fcmVtb3ZlTWVzc2FnZSh0aGlzKTtcbiAgICB0aGlzLnBhcnRzLmZvckVhY2gocGFydCA9PiBwYXJ0LmRlc3Ryb3koKSk7XG4gICAgdGhpcy5fX3BhcnRzID0gbnVsbDtcblxuICAgIHN1cGVyLmRlc3Ryb3koKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQb3B1bGF0ZXMgdGhpcyBpbnN0YW5jZSB3aXRoIHRoZSBkZXNjcmlwdGlvbiBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIENhbiBiZSB1c2VkIGZvciBjcmVhdGluZyBvciBmb3IgdXBkYXRpbmcgdGhlIGluc3RhbmNlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9wb3B1bGF0ZUZyb21TZXJ2ZXJcbiAgICogQHByb3RlY3RlZFxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG0gLSBTZXJ2ZXIgZGVzY3JpcHRpb24gb2YgdGhlIG1lc3NhZ2VcbiAgICovXG4gIF9wb3B1bGF0ZUZyb21TZXJ2ZXIobWVzc2FnZSkge1xuICAgIHRoaXMuX2luUG9wdWxhdGVGcm9tU2VydmVyID0gdHJ1ZTtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuXG4gICAgdGhpcy5pZCA9IG1lc3NhZ2UuaWQ7XG4gICAgdGhpcy51cmwgPSBtZXNzYWdlLnVybDtcbiAgICBjb25zdCBvbGRQb3NpdGlvbiA9IHRoaXMucG9zaXRpb247XG4gICAgdGhpcy5wb3NpdGlvbiA9IG1lc3NhZ2UucG9zaXRpb247XG5cblxuICAgIC8vIEFzc2lnbiBJRHMgdG8gcHJlZXhpc3RpbmcgUGFydHMgc28gdGhhdCB3ZSBjYW4gY2FsbCBnZXRQYXJ0QnlJZCgpXG4gICAgaWYgKHRoaXMucGFydHMpIHtcbiAgICAgIHRoaXMucGFydHMuZm9yRWFjaCgocGFydCwgaW5kZXgpID0+IHtcbiAgICAgICAgaWYgKCFwYXJ0LmlkKSBwYXJ0LmlkID0gYCR7dGhpcy5pZH0vcGFydHMvJHtpbmRleH1gO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdGhpcy5wYXJ0cyA9IG1lc3NhZ2UucGFydHMubWFwKHBhcnQgPT4ge1xuICAgICAgY29uc3QgZXhpc3RpbmdQYXJ0ID0gdGhpcy5nZXRQYXJ0QnlJZChwYXJ0LmlkKTtcbiAgICAgIGlmIChleGlzdGluZ1BhcnQpIHtcbiAgICAgICAgZXhpc3RpbmdQYXJ0Ll9wb3B1bGF0ZUZyb21TZXJ2ZXIocGFydCk7XG4gICAgICAgIHJldHVybiBleGlzdGluZ1BhcnQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gTWVzc2FnZVBhcnQuX2NyZWF0ZUZyb21TZXJ2ZXIocGFydCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLnJlY2lwaWVudFN0YXR1cyA9IG1lc3NhZ2UucmVjaXBpZW50X3N0YXR1cyB8fCB7fTtcblxuICAgIHRoaXMuaXNSZWFkID0gIW1lc3NhZ2UuaXNfdW5yZWFkO1xuXG4gICAgdGhpcy5zZW50QXQgPSBuZXcgRGF0ZShtZXNzYWdlLnNlbnRfYXQpO1xuICAgIHRoaXMucmVjZWl2ZWRBdCA9IG1lc3NhZ2UucmVjZWl2ZWRfYXQgPyBuZXcgRGF0ZShtZXNzYWdlLnJlY2VpdmVkX2F0KSA6IHVuZGVmaW5lZDtcblxuICAgIGxldCBzZW5kZXI7XG4gICAgaWYgKG1lc3NhZ2Uuc2VuZGVyLmlkKSB7XG4gICAgICBzZW5kZXIgPSBjbGllbnQuZ2V0SWRlbnRpdHkobWVzc2FnZS5zZW5kZXIuaWQpO1xuICAgIH1cblxuICAgIC8vIEJlY2F1c2UgdGhlcmUgbWF5IGJlIG5vIElELCB3ZSBoYXZlIHRvIGJ5cGFzcyBjbGllbnQuX2NyZWF0ZU9iamVjdCBhbmQgaXRzIHN3aXRjaCBzdGF0ZW1lbnQuXG4gICAgaWYgKCFzZW5kZXIpIHtcbiAgICAgIHNlbmRlciA9IElkZW50aXR5Ll9jcmVhdGVGcm9tU2VydmVyKG1lc3NhZ2Uuc2VuZGVyLCBjbGllbnQpO1xuICAgIH1cbiAgICB0aGlzLnNlbmRlciA9IHNlbmRlcjtcblxuXG4gICAgdGhpcy5fc2V0U3luY2VkKCk7XG5cbiAgICBpZiAob2xkUG9zaXRpb24gJiYgb2xkUG9zaXRpb24gIT09IHRoaXMucG9zaXRpb24pIHtcbiAgICAgIHRoaXMuX3RyaWdnZXJBc3luYygnbWVzc2FnZXM6Y2hhbmdlJywge1xuICAgICAgICBvbGRWYWx1ZTogb2xkUG9zaXRpb24sXG4gICAgICAgIG5ld1ZhbHVlOiB0aGlzLnBvc2l0aW9uLFxuICAgICAgICBwcm9wZXJ0eTogJ3Bvc2l0aW9uJyxcbiAgICAgIH0pO1xuICAgIH1cbiAgICB0aGlzLl9pblBvcHVsYXRlRnJvbVNlcnZlciA9IGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIE1lc3NhZ2UncyBsYXllci5NZXNzYWdlUGFydCB3aXRoIHRoZSBzcGVjaWZpZWQgdGhlIHBhcnQgSUQuXG4gICAqXG4gICAqIGBgYFxuICAgKiB2YXIgcGFydCA9IGNsaWVudC5nZXRNZXNzYWdlUGFydCgnbGF5ZXI6Ly8vbWVzc2FnZXMvNmYwOGFjZmEtMzI2OC00YWU1LTgzZDktNmNhMDAwMDAwMDAvcGFydHMvMCcpO1xuICAgKiBgYGBcbiAgICpcbiAgICogQG1ldGhvZCBnZXRQYXJ0QnlJZFxuICAgKiBAcGFyYW0ge3N0cmluZ30gcGFydElkXG4gICAqIEByZXR1cm4ge2xheWVyLk1lc3NhZ2VQYXJ0fVxuICAgKi9cbiAgZ2V0UGFydEJ5SWQocGFydElkKSB7XG4gICAgY29uc3QgcGFydCA9IHRoaXMucGFydHMgPyB0aGlzLnBhcnRzLmZpbHRlcihhUGFydCA9PiBhUGFydC5pZCA9PT0gcGFydElkKVswXSA6IG51bGw7XG4gICAgcmV0dXJuIHBhcnQgfHwgbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBY2NlcHRzIGpzb24tcGF0Y2ggb3BlcmF0aW9ucyBmb3IgbW9kaWZ5aW5nIHJlY2lwaWVudFN0YXR1cy5cbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlUGF0Y2hFdmVudFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3RbXX0gZGF0YSAtIEFycmF5IG9mIG9wZXJhdGlvbnNcbiAgICovXG4gIF9oYW5kbGVQYXRjaEV2ZW50KG5ld1ZhbHVlLCBvbGRWYWx1ZSwgcGF0aHMpIHtcbiAgICB0aGlzLl9pbkxheWVyUGFyc2VyID0gZmFsc2U7XG4gICAgaWYgKHBhdGhzWzBdLmluZGV4T2YoJ3JlY2lwaWVudF9zdGF0dXMnKSA9PT0gMCkge1xuICAgICAgdGhpcy5fX3VwZGF0ZVJlY2lwaWVudFN0YXR1cyh0aGlzLnJlY2lwaWVudFN0YXR1cywgb2xkVmFsdWUpO1xuICAgIH1cbiAgICB0aGlzLl9pbkxheWVyUGFyc2VyID0gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGFic29sdXRlIFVSTCBmb3IgdGhpcyByZXNvdXJjZS5cbiAgICogVXNlZCBieSBzeW5jIG1hbmFnZXIgYmVjYXVzZSB0aGUgdXJsIG1heSBub3QgYmUga25vd25cbiAgICogYXQgdGhlIHRpbWUgdGhlIHN5bmMgcmVxdWVzdCBpcyBlbnF1ZXVlZC5cbiAgICpcbiAgICogQG1ldGhvZCBfZ2V0VXJsXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB1cmwgLSByZWxhdGl2ZSB1cmwgYW5kIHF1ZXJ5IHN0cmluZyBwYXJhbWV0ZXJzXG4gICAqIEByZXR1cm4ge1N0cmluZ30gZnVsbCB1cmxcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9nZXRVcmwodXJsKSB7XG4gICAgcmV0dXJuIHRoaXMudXJsICsgKHVybCB8fCAnJyk7XG4gIH1cblxuICBfc2V0dXBTeW5jT2JqZWN0KHN5bmMpIHtcbiAgICBpZiAoc3luYyAhPT0gZmFsc2UpIHtcbiAgICAgIHN5bmMgPSBzdXBlci5fc2V0dXBTeW5jT2JqZWN0KHN5bmMpO1xuICAgICAgaWYgKCFzeW5jLmRlcGVuZHMpIHtcbiAgICAgICAgc3luYy5kZXBlbmRzID0gW3RoaXMuY29udmVyc2F0aW9uSWRdO1xuICAgICAgfSBlbHNlIGlmIChzeW5jLmRlcGVuZHMuaW5kZXhPZih0aGlzLmlkKSA9PT0gLTEpIHtcbiAgICAgICAgc3luYy5kZXBlbmRzLnB1c2godGhpcy5jb252ZXJzYXRpb25JZCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzeW5jO1xuICB9XG5cblxuICAvKipcbiAgICogR2V0IGFsbCB0ZXh0IHBhcnRzIG9mIHRoZSBNZXNzYWdlLlxuICAgKlxuICAgKiBVdGlsaXR5IG1ldGhvZCBmb3IgZXh0cmFjdGluZyBhbGwgb2YgdGhlIHRleHQvcGxhaW4gcGFydHNcbiAgICogYW5kIGNvbmNhdGVuYXRpbmcgYWxsIG9mIHRoZWlyIGJvZHlzIHRvZ2V0aGVyIGludG8gYSBzaW5nbGUgc3RyaW5nLlxuICAgKlxuICAgKiBAbWV0aG9kIGdldFRleHRcbiAgICogQHBhcmFtIHtzdHJpbmd9IFtqb2luU3RyPScuICAnXSBJZiBtdWx0aXBsZSBtZXNzYWdlIHBhcnRzIG9mIHR5cGUgdGV4dC9wbGFpbiwgaG93IGRvIHlvdSB3YW50IHRoZW0gam9pbmVkIHRvZ2V0aGVyP1xuICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAqL1xuICBnZXRUZXh0KGpvaW5TdHIgPSAnLiAnKSB7XG4gICAgbGV0IHRleHRBcnJheSA9IHRoaXMucGFydHNcbiAgICAgIC5maWx0ZXIocGFydCA9PiBwYXJ0Lm1pbWVUeXBlID09PSAndGV4dC9wbGFpbicpXG4gICAgICAubWFwKHBhcnQgPT4gcGFydC5ib2R5KTtcbiAgICB0ZXh0QXJyYXkgPSB0ZXh0QXJyYXkuZmlsdGVyKGRhdGEgPT4gZGF0YSk7XG4gICAgcmV0dXJuIHRleHRBcnJheS5qb2luKGpvaW5TdHIpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBwbGFpbiBvYmplY3QuXG4gICAqXG4gICAqIE9iamVjdCB3aWxsIGhhdmUgYWxsIHRoZSBzYW1lIHB1YmxpYyBwcm9wZXJ0aWVzIGFzIHRoaXNcbiAgICogTWVzc2FnZSBpbnN0YW5jZS4gIE5ldyBvYmplY3QgaXMgcmV0dXJuZWQgYW55IHRpbWVcbiAgICogYW55IG9mIHRoaXMgb2JqZWN0J3MgcHJvcGVydGllcyBjaGFuZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgdG9PYmplY3RcbiAgICogQHJldHVybiB7T2JqZWN0fSBQT0pPIHZlcnNpb24gb2YgdGhpcyBvYmplY3QuXG4gICAqL1xuICB0b09iamVjdCgpIHtcbiAgICBpZiAoIXRoaXMuX3RvT2JqZWN0KSB7XG4gICAgICB0aGlzLl90b09iamVjdCA9IHN1cGVyLnRvT2JqZWN0KCk7XG4gICAgICB0aGlzLl90b09iamVjdC5yZWNpcGllbnRTdGF0dXMgPSBVdGlsLmNsb25lKHRoaXMucmVjaXBpZW50U3RhdHVzKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3RvT2JqZWN0O1xuICB9XG5cbiAgX3RyaWdnZXJBc3luYyhldnROYW1lLCBhcmdzKSB7XG4gICAgdGhpcy5fY2xlYXJPYmplY3QoKTtcbiAgICBzdXBlci5fdHJpZ2dlckFzeW5jKGV2dE5hbWUsIGFyZ3MpO1xuICB9XG5cbiAgdHJpZ2dlcihldnROYW1lLCBhcmdzKSB7XG4gICAgdGhpcy5fY2xlYXJPYmplY3QoKTtcbiAgICBzdXBlci50cmlnZ2VyKGV2dE5hbWUsIGFyZ3MpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBtZXNzYWdlIGZyb20gdGhlIHNlcnZlcidzIHJlcHJlc2VudGF0aW9uIG9mIGEgbWVzc2FnZS5cbiAgICpcbiAgICogU2ltaWxhciB0byBfcG9wdWxhdGVGcm9tU2VydmVyLCBob3dldmVyLCB0aGlzIG1ldGhvZCB0YWtlcyBhXG4gICAqIG1lc3NhZ2UgZGVzY3JpcHRpb24gYW5kIHJldHVybnMgYSBuZXcgbWVzc2FnZSBpbnN0YW5jZSB1c2luZyBfcG9wdWxhdGVGcm9tU2VydmVyXG4gICAqIHRvIHNldHVwIHRoZSB2YWx1ZXMuXG4gICAqXG4gICAqIEBtZXRob2QgX2NyZWF0ZUZyb21TZXJ2ZXJcbiAgICogQHByb3RlY3RlZFxuICAgKiBAc3RhdGljXG4gICAqIEBwYXJhbSAge09iamVjdH0gbWVzc2FnZSAtIFNlcnZlcidzIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBtZXNzYWdlXG4gICAqIEBwYXJhbSAge2xheWVyLkNsaWVudH0gY2xpZW50XG4gICAqIEByZXR1cm4ge2xheWVyLk1lc3NhZ2V9XG4gICAqL1xuICBzdGF0aWMgX2NyZWF0ZUZyb21TZXJ2ZXIobWVzc2FnZSwgY2xpZW50KSB7XG4gICAgY29uc3QgZnJvbVdlYnNvY2tldCA9IG1lc3NhZ2UuZnJvbVdlYnNvY2tldDtcbiAgICByZXR1cm4gbmV3IE1lc3NhZ2Uoe1xuICAgICAgY29udmVyc2F0aW9uSWQ6IG1lc3NhZ2UuY29udmVyc2F0aW9uLmlkLFxuICAgICAgZnJvbVNlcnZlcjogbWVzc2FnZSxcbiAgICAgIGNsaWVudElkOiBjbGllbnQuYXBwSWQsXG4gICAgICBfZnJvbURCOiBtZXNzYWdlLl9mcm9tREIsXG4gICAgICBfbm90aWZ5OiBmcm9tV2Vic29ja2V0ICYmIG1lc3NhZ2UuaXNfdW5yZWFkICYmIG1lc3NhZ2Uuc2VuZGVyLnVzZXJfaWQgIT09IGNsaWVudC51c2VyLnVzZXJJZCxcbiAgICB9KTtcbiAgfVxuXG4gIF9sb2FkZWQoZGF0YSkge1xuICAgIHRoaXMuY29udmVyc2F0aW9uSWQgPSBkYXRhLmNvbnZlcnNhdGlvbi5pZDtcbiAgICB0aGlzLmdldENsaWVudCgpLl9hZGRNZXNzYWdlKHRoaXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIElkZW50aWZpZXMgd2hldGhlciBhIE1lc3NhZ2UgcmVjZWl2aW5nIHRoZSBzcGVjaWZpZWQgcGF0Y2ggZGF0YSBzaG91bGQgYmUgbG9hZGVkIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQXBwbGllcyBvbmx5IHRvIE1lc3NhZ2VzIHRoYXQgYXJlbid0IGFscmVhZHkgbG9hZGVkOyB1c2VkIHRvIGluZGljYXRlIGlmIGEgY2hhbmdlIGV2ZW50IGlzXG4gICAqIHNpZ25pZmljYW50IGVub3VnaCB0byBsb2FkIHRoZSBNZXNzYWdlIGFuZCB0cmlnZ2VyIGNoYW5nZSBldmVudHMgb24gdGhhdCBNZXNzYWdlLlxuICAgKlxuICAgKiBBdCB0aGlzIHRpbWUgdGhlcmUgYXJlIG5vIHByb3BlcnRpZXMgdGhhdCBhcmUgcGF0Y2hlZCBvbiBNZXNzYWdlcyB2aWEgd2Vic29ja2V0c1xuICAgKiB0aGF0IHdvdWxkIGp1c3RpZnkgbG9hZGluZyB0aGUgTWVzc2FnZSBmcm9tIHRoZSBzZXJ2ZXIgc28gYXMgdG8gbm90aWZ5IHRoZSBhcHAuXG4gICAqXG4gICAqIE9ubHkgcmVjaXBpZW50IHN0YXR1cyBjaGFuZ2VzIGFuZCBtYXliZSBpc191bnJlYWQgY2hhbmdlcyBhcmUgc2VudDtcbiAgICogbmVpdGhlciBvZiB3aGljaCBhcmUgcmVsZXZhbnQgdG8gYW4gYXBwIHRoYXQgaXNuJ3QgcmVuZGVyaW5nIHRoYXQgbWVzc2FnZS5cbiAgICpcbiAgICogQG1ldGhvZCBfbG9hZFJlc291cmNlRm9yUGF0Y2hcbiAgICogQHN0YXRpY1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgc3RhdGljIF9sb2FkUmVzb3VyY2VGb3JQYXRjaChwYXRjaERhdGEpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuLyoqXG4gKiBDbGllbnQgdGhhdCB0aGUgTWVzc2FnZSBiZWxvbmdzIHRvLlxuICpcbiAqIEFjdHVhbCB2YWx1ZSBvZiB0aGlzIHN0cmluZyBtYXRjaGVzIHRoZSBhcHBJZC5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAcmVhZG9ubHlcbiAqL1xuTWVzc2FnZS5wcm90b3R5cGUuY2xpZW50SWQgPSAnJztcblxuLyoqXG4gKiBDb252ZXJzYXRpb24gdGhhdCB0aGlzIE1lc3NhZ2UgYmVsb25ncyB0by5cbiAqXG4gKiBBY3R1YWwgdmFsdWUgaXMgdGhlIElEIG9mIHRoZSBDb252ZXJzYXRpb24ncyBJRC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQHJlYWRvbmx5XG4gKi9cbk1lc3NhZ2UucHJvdG90eXBlLmNvbnZlcnNhdGlvbklkID0gJyc7XG5cbi8qKlxuICogQXJyYXkgb2YgbGF5ZXIuTWVzc2FnZVBhcnQgb2JqZWN0cy5cbiAqXG4gKiBVc2UgbGF5ZXIuTWVzc2FnZS5hZGRQYXJ0IHRvIG1vZGlmeSB0aGlzIGFycmF5LlxuICpcbiAqIEB0eXBlIHtsYXllci5NZXNzYWdlUGFydFtdfVxuICogQHJlYWRvbmx5XG4gKi9cbk1lc3NhZ2UucHJvdG90eXBlLnBhcnRzID0gbnVsbDtcblxuLyoqXG4gKiBUaW1lIHRoYXQgdGhlIG1lc3NhZ2Ugd2FzIHNlbnQuXG4gKlxuICogIE5vdGUgdGhhdCBhIGxvY2FsbHkgY3JlYXRlZCBsYXllci5NZXNzYWdlIHdpbGwgaGF2ZSBhIGBzZW50QXRgIHZhbHVlIGV2ZW5cbiAqIHRob3VnaCBpdHMgbm90IHlldCBzZW50OyB0aGlzIGlzIHNvIHRoYXQgYW55IHJlbmRlcmluZyBjb2RlIGRvZXNuJ3QgbmVlZFxuICogdG8gYWNjb3VudCBmb3IgYG51bGxgIHZhbHVlcy4gIFNlbmRpbmcgdGhlIE1lc3NhZ2UgbWF5IGNhdXNlIGEgc2xpZ2h0IGNoYW5nZVxuICogaW4gdGhlIGBzZW50QXRgIHZhbHVlLlxuICpcbiAqIEB0eXBlIHtEYXRlfVxuICogQHJlYWRvbmx5XG4gKi9cbk1lc3NhZ2UucHJvdG90eXBlLnNlbnRBdCA9IG51bGw7XG5cbi8qKlxuICogVGltZSB0aGF0IHRoZSBmaXJzdCBkZWxpdmVyeSByZWNlaXB0IHdhcyBzZW50IGJ5IHlvdXJcbiAqIHVzZXIgYWNrbm93bGVkZ2luZyByZWNlaXB0IG9mIHRoZSBtZXNzYWdlLlxuICogQHR5cGUge0RhdGV9XG4gKiBAcmVhZG9ubHlcbiAqL1xuTWVzc2FnZS5wcm90b3R5cGUucmVjZWl2ZWRBdCA9IG51bGw7XG5cbi8qKlxuICogSWRlbnRpdHkgb2JqZWN0IHJlcHJlc2VudGluZyB0aGUgc2VuZGVyIG9mIHRoZSBNZXNzYWdlLlxuICpcbiAqIE1vc3QgY29tbW9ubHkgdXNlZCBwcm9wZXJ0aWVzIG9mIElkZW50aXR5IGFyZTpcbiAqICogZGlzcGxheU5hbWU6IEEgbmFtZSBmb3IgeW91ciBVSVxuICogKiB1c2VySWQ6IE5hbWUgZm9yIHRoZSB1c2VyIGFzIHJlcHJlc2VudGVkIG9uIHlvdXIgc3lzdGVtXG4gKiAqIG5hbWU6IFJlcHJlc2VudHMgdGhlIG5hbWUgb2YgYSBzZXJ2aWNlIGlmIHRoZSBzZW5kZXIgd2FzIGFuIGF1dG9tYXRlZCBzeXN0ZW0uXG4gKlxuICogICAgICA8c3BhbiBjbGFzcz0nc2VudC1ieSc+XG4gKiAgICAgICAge21lc3NhZ2Uuc2VuZGVyLmRpc3BsYXlOYW1lIHx8IG1lc3NhZ2Uuc2VuZGVyLm5hbWV9XG4gKiAgICAgIDwvc3Bhbj5cbiAqXG4gKiBAdHlwZSB7bGF5ZXIuSWRlbnRpdHl9XG4gKiBAcmVhZG9ubHlcbiAqL1xuTWVzc2FnZS5wcm90b3R5cGUuc2VuZGVyID0gbnVsbDtcblxuLyoqXG4gKiBQb3NpdGlvbiBvZiB0aGlzIG1lc3NhZ2Ugd2l0aGluIHRoZSBjb252ZXJzYXRpb24uXG4gKlxuICogTk9URVM6XG4gKlxuICogMS4gRGVsZXRpbmcgYSBtZXNzYWdlIGRvZXMgbm90IGFmZmVjdCBwb3NpdGlvbiBvZiBvdGhlciBNZXNzYWdlcy5cbiAqIDIuIEEgcG9zaXRpb24gaXMgbm90IGdhdXJlbnRlZWQgdG8gYmUgdW5pcXVlIChtdWx0aXBsZSBtZXNzYWdlcyBzZW50IGF0IHRoZSBzYW1lIHRpbWUgY291bGRcbiAqIGFsbCBjbGFpbSB0aGUgc2FtZSBwb3NpdGlvbilcbiAqIDMuIEVhY2ggc3VjY2Vzc2l2ZSBtZXNzYWdlIHdpdGhpbiBhIGNvbnZlcnNhdGlvbiBzaG91bGQgZXhwZWN0IGEgaGlnaGVyIHBvc2l0aW9uLlxuICpcbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKiBAcmVhZG9ubHlcbiAqL1xuTWVzc2FnZS5wcm90b3R5cGUucG9zaXRpb24gPSAwO1xuXG4vKipcbiAqIEhpbnQgdXNlZCBieSBsYXllci5DbGllbnQgb24gd2hldGhlciB0byB0cmlnZ2VyIGEgbWVzc2FnZXM6bm90aWZ5IGV2ZW50LlxuICpcbiAqIEB0eXBlIHtib29sZWFufVxuICogQHByaXZhdGVcbiAqL1xuTWVzc2FnZS5wcm90b3R5cGUuX25vdGlmeSA9IGZhbHNlO1xuXG4vKiBSZWNpcGllbnQgU3RhdHVzICovXG5cbi8qKlxuICogUmVhZC9kZWxpdmVyeSBTdGF0ZSBvZiBhbGwgcGFydGljaXBhbnRzLlxuICpcbiAqIFRoaXMgaXMgYW4gb2JqZWN0IGNvbnRhaW5pbmcga2V5cyBmb3IgZWFjaCBwYXJ0aWNpcGFudCxcbiAqIGFuZCBhIHZhbHVlIG9mOlxuICogKiBsYXllci5SRUNFSVBUX1NUQVRFLlNFTlRcbiAqICogbGF5ZXIuUkVDRUlQVF9TVEFURS5ERUxJVkVSRURcbiAqICogbGF5ZXIuUkVDRUlQVF9TVEFURS5SRUFEXG4gKiAqIGxheWVyLlJFQ0VJUFRfU1RBVEUuUEVORElOR1xuICpcbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cbk1lc3NhZ2UucHJvdG90eXBlLnJlY2lwaWVudFN0YXR1cyA9IG51bGw7XG5cbi8qKlxuICogVHJ1ZSBpZiB0aGlzIE1lc3NhZ2UgaGFzIGJlZW4gcmVhZCBieSB0aGlzIHVzZXIuXG4gKlxuICogWW91IGNhbiBjaGFuZ2UgaXNSZWFkIHByb2dyYW1hdGljYWxseVxuICpcbiAqICAgICAgbS5pc1JlYWQgPSB0cnVlO1xuICpcbiAqIFRoaXMgd2lsbCBhdXRvbWF0aWNhbGx5IG5vdGlmeSB0aGUgc2VydmVyIHRoYXQgdGhlIG1lc3NhZ2Ugd2FzIHJlYWQgYnkgeW91ciB1c2VyLlxuICogQHR5cGUge0Jvb2xlYW59XG4gKi9cbk1lc3NhZ2UucHJvdG90eXBlLmlzUmVhZCA9IGZhbHNlO1xuXG4vKipcbiAqIFRoaXMgcHJvcGVydHkgaXMgaGVyZSBmb3IgY29udmVuaWVuY2Ugb25seTsgaXQgd2lsbCBhbHdheXMgYmUgdGhlIG9wcG9zaXRlIG9mIGlzUmVhZC5cbiAqIEB0eXBlIHtCb29sZWFufVxuICogQHJlYWRvbmx5XG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShNZXNzYWdlLnByb3RvdHlwZSwgJ2lzVW5yZWFkJywge1xuICBlbnVtZXJhYmxlOiB0cnVlLFxuICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICByZXR1cm4gIXRoaXMuaXNSZWFkO1xuICB9LFxufSk7XG5cbi8qKlxuICogSGF2ZSB0aGUgb3RoZXIgcGFydGljaXBhbnRzIHJlYWQgdGhpcyBNZXNzYWdlIHlldC5cbiAqXG4gKiBUaGlzIHZhbHVlIGlzIG9uZSBvZjpcbiAqXG4gKiAgKiBsYXllci5Db25zdGFudHMuUkVDSVBJRU5UX1NUQVRFLkFMTFxuICogICogbGF5ZXIuQ29uc3RhbnRzLlJFQ0lQSUVOVF9TVEFURS5TT01FXG4gKiAgKiBsYXllci5Db25zdGFudHMuUkVDSVBJRU5UX1NUQVRFLk5PTkVcbiAqXG4gKiAgVGhpcyB2YWx1ZSBpcyB1cGRhdGVkIGFueSB0aW1lIHJlY2lwaWVudFN0YXR1cyBjaGFuZ2VzLlxuICpcbiAqIFNlZSBsYXllci5NZXNzYWdlLnJlY2lwaWVudFN0YXR1cyBmb3IgYSBtb3JlIGRldGFpbGVkIHJlcG9ydC5cbiAqXG4gKiBAdHlwZSB7U3RyaW5nfVxuICovXG5NZXNzYWdlLnByb3RvdHlwZS5yZWFkU3RhdHVzID0gQ29uc3RhbnRzLlJFQ0lQSUVOVF9TVEFURS5OT05FO1xuXG4vKipcbiAqIEhhdmUgdGhlIG90aGVyIHBhcnRpY2lwYW50cyByZWNlaXZlZCB0aGlzIE1lc3NhZ2UgeWV0LlxuICpcbiAgKiBUaGlzIHZhbHVlIGlzIG9uZSBvZjpcbiAqXG4gKiAgKiBsYXllci5Db25zdGFudHMuUkVDSVBJRU5UX1NUQVRFLkFMTFxuICogICogbGF5ZXIuQ29uc3RhbnRzLlJFQ0lQSUVOVF9TVEFURS5TT01FXG4gKiAgKiBsYXllci5Db25zdGFudHMuUkVDSVBJRU5UX1NUQVRFLk5PTkVcbiAqXG4gKiAgVGhpcyB2YWx1ZSBpcyB1cGRhdGVkIGFueSB0aW1lIHJlY2lwaWVudFN0YXR1cyBjaGFuZ2VzLlxuICpcbiAqIFNlZSBsYXllci5NZXNzYWdlLnJlY2lwaWVudFN0YXR1cyBmb3IgYSBtb3JlIGRldGFpbGVkIHJlcG9ydC5cbiAqXG4gKlxuICogQHR5cGUge1N0cmluZ31cbiAqL1xuTWVzc2FnZS5wcm90b3R5cGUuZGVsaXZlcnlTdGF0dXMgPSBDb25zdGFudHMuUkVDSVBJRU5UX1NUQVRFLk5PTkU7XG5cbk1lc3NhZ2UucHJvdG90eXBlLl90b09iamVjdCA9IG51bGw7XG5cbk1lc3NhZ2UucHJvdG90eXBlLl9pblBvcHVsYXRlRnJvbVNlcnZlciA9IGZhbHNlO1xuXG5NZXNzYWdlLmV2ZW50UHJlZml4ID0gJ21lc3NhZ2VzJztcblxuTWVzc2FnZS5ldmVudFByZWZpeCA9ICdtZXNzYWdlcyc7XG5cbk1lc3NhZ2UucHJlZml4VVVJRCA9ICdsYXllcjovLy9tZXNzYWdlcy8nO1xuXG5NZXNzYWdlLmluT2JqZWN0SWdub3JlID0gU3luY2FibGUuaW5PYmplY3RJZ25vcmU7XG5cbk1lc3NhZ2UuYnViYmxlRXZlbnRQYXJlbnQgPSAnZ2V0Q2xpZW50JztcblxuTWVzc2FnZS5pbWFnZVR5cGVzID0gW1xuICAnaW1hZ2UvZ2lmJyxcbiAgJ2ltYWdlL3BuZycsXG4gICdpbWFnZS9qcGVnJyxcbiAgJ2ltYWdlL2pwZycsXG5dO1xuXG5NZXNzYWdlLl9zdXBwb3J0ZWRFdmVudHMgPSBbXG5cbiAgLyoqXG4gICAqIE1lc3NhZ2UgaGFzIGJlZW4gbG9hZGVkIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogTm90ZSB0aGF0IHRoaXMgaXMgb25seSB1c2VkIGluIHJlc3BvbnNlIHRvIHRoZSBsYXllci5NZXNzYWdlLmxvYWQoKSBtZXRob2QuXG4gICAqXG4gICAqIGBgYFxuICAgKiB2YXIgbSA9IGNsaWVudC5nZXRNZXNzYWdlKCdsYXllcjovLy9tZXNzYWdlcy8xMjMnLCB0cnVlKVxuICAgKiAgICAub24oJ21lc3NhZ2VzOmxvYWRlZCcsIGZ1bmN0aW9uKCkge1xuICAgKiAgICAgICAgbXlyZXJlbmRlcihtKTtcbiAgICogICAgfSk7XG4gICAqIG15cmVuZGVyKG0pOyAvLyByZW5kZXIgYSBwbGFjZWhvbGRlciBmb3IgbSB1bnRpbCB0aGUgZGV0YWlscyBvZiBtIGhhdmUgbG9hZGVkXG4gICAqIGBgYFxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICovXG4gICdtZXNzYWdlczpsb2FkZWQnLFxuXG4gIC8qKlxuICAgKiBUaGUgbG9hZCBtZXRob2QgZmFpbGVkIHRvIGxvYWQgdGhlIG1lc3NhZ2UgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBpcyBvbmx5IHVzZWQgaW4gcmVzcG9uc2UgdG8gdGhlIGxheWVyLk1lc3NhZ2UubG9hZCgpIG1ldGhvZC5cbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICAnbWVzc2FnZXM6bG9hZGVkLWVycm9yJyxcblxuICAvKipcbiAgICogTWVzc2FnZSBkZWxldGVkIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQ2F1c2VkIGJ5IGEgY2FsbCB0byBsYXllci5NZXNzYWdlLmRlbGV0ZSgpIG9yIGEgd2Vic29ja2V0IGV2ZW50LlxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKiBAZXZlbnRcbiAgICovXG4gICdtZXNzYWdlczpkZWxldGUnLFxuXG4gIC8qKlxuICAgKiBNZXNzYWdlIGlzIGFib3V0IHRvIGJlIHNlbnQuXG4gICAqXG4gICAqIExhc3QgY2hhbmNlIHRvIG1vZGlmeSBvciB2YWxpZGF0ZSB0aGUgbWVzc2FnZSBwcmlvciB0byBzZW5kaW5nLlxuICAgKlxuICAgKiAgICAgbWVzc2FnZS5vbignbWVzc2FnZXM6c2VuZGluZycsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICAgICAgbWVzc2FnZS5hZGRQYXJ0KHttaW1lVHlwZTogJ2FwcGxpY2F0aW9uL2xvY2F0aW9uJywgYm9keTogSlNPTi5zdHJpbmdpZnkoZ2V0R1BTTG9jYXRpb24oKSl9KTtcbiAgICogICAgIH0pO1xuICAgKlxuICAgKiBUeXBpY2FsbHksIHlvdSB3b3VsZCBsaXN0ZW4gdG8gdGhpcyBldmVudCBtb3JlIGJyb2FkbHkgdXNpbmcgYGNsaWVudC5vbignbWVzc2FnZXM6c2VuZGluZycpYFxuICAgKiB3aGljaCB3b3VsZCB0cmlnZ2VyIGJlZm9yZSBzZW5kaW5nIEFOWSBNZXNzYWdlcy5cbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICAnbWVzc2FnZXM6c2VuZGluZycsXG5cbiAgLyoqXG4gICAqIE1lc3NhZ2UgaGFzIGJlZW4gcmVjZWl2ZWQgYnkgdGhlIHNlcnZlci5cbiAgICpcbiAgICogSXQgZG9lcyBOT1QgaW5kaWNhdGUgZGVsaXZlcnkgdG8gb3RoZXIgdXNlcnMuXG4gICAqXG4gICAqIEl0IGRvZXMgTk9UIGluZGljYXRlIG1lc3NhZ2VzIHNlbnQgYnkgb3RoZXIgdXNlcnMuXG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dFxuICAgKi9cbiAgJ21lc3NhZ2VzOnNlbnQnLFxuXG4gIC8qKlxuICAgKiBTZXJ2ZXIgZmFpbGVkIHRvIHJlY2VpdmUgdGhlIE1lc3NhZ2UuXG4gICAqXG4gICAqIE1lc3NhZ2Ugd2lsbCBiZSBkZWxldGVkIGltbWVkaWF0ZWx5IGFmdGVyIGZpcmluZyB0aGlzIGV2ZW50LlxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckVycm9yfSBldnQuZXJyb3JcbiAgICovXG4gICdtZXNzYWdlczpzZW50LWVycm9yJyxcblxuICAvKipcbiAgICogVGhlIHJlY2lwaWVudFN0YXR1cyBwcm9wZXJ0eSBoYXMgY2hhbmdlZC5cbiAgICpcbiAgICogVGhpcyBoYXBwZW5zIGluIHJlc3BvbnNlIHRvIGFuIHVwZGF0ZVxuICAgKiBmcm9tIHRoZSBzZXJ2ZXIuLi4gYnV0IGlzIGFsc28gY2F1c2VkIGJ5IG1hcmtpbmcgdGhlIGN1cnJlbnQgdXNlciBhcyBoYXZpbmcgcmVhZFxuICAgKiBvciByZWNlaXZlZCB0aGUgbWVzc2FnZS5cbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICAnbWVzc2FnZXM6Y2hhbmdlJyxcblxuXG5dLmNvbmNhdChTeW5jYWJsZS5fc3VwcG9ydGVkRXZlbnRzKTtcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoTWVzc2FnZSwgW01lc3NhZ2UsICdNZXNzYWdlJ10pO1xuU3luY2FibGUuc3ViY2xhc3Nlcy5wdXNoKE1lc3NhZ2UpO1xubW9kdWxlLmV4cG9ydHMgPSBNZXNzYWdlO1xuIl19
