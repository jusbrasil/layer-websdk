'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * A Conversation object represents a dialog amongst a set
 * of participants.
 *
 * Create a Conversation using the client:
 *
 *      var conversation = client.createConversation({
 *          participants: ['a','b'],
 *          distinct: true
 *      });
 *
 * NOTE:   Do not create a conversation with new layer.Conversation(...),
 *         This will fail to handle the distinct property short of going to the server for evaluation.
 *
 * NOTE:   Creating a Conversation is a local action.  A Conversation will not be
 *         sent to the server until either:
 *
 * 1. A message is sent on that Conversation
 * 2. `Conversation.send()` is called (not recommended as mobile clients
 *    expect at least one layer.Message in a Conversation)
 *
 * Key methods, events and properties for getting started:
 *
 * Properties:
 *
 * * layer.Conversation.id: this property is worth being familiar with; it identifies the
 *   Conversation and can be used in `client.getConversation(id)` to retrieve it.
 * * layer.Conversation.lastMessage: This property makes it easy to show info about the most recent Message
 *    when rendering a list of Conversations.
 * * layer.Conversation.metadata: Custom data for your Conversation; commonly used to store a 'title' property
 *    to name your Conversation.
 *
 * Methods:
 *
 * * layer.Conversation.addParticipants and layer.Conversation.removeParticipants: Change the participants of the Conversation
 * * layer.Conversation.setMetadataProperties: Set metadata.title to 'My Conversation with Layer Support' (uh oh)
 * * layer.Conversation.on() and layer.Conversation.off(): event listeners built on top of the `backbone-events-standalone` npm project
 * * layer.Conversation.leave() to leave the Conversation
 * * layer.Conversation.delete() to delete the Conversation for all users (or for just this user)
 *
 * Events:
 *
 * * `conversations:change`: Useful for observing changes to participants and metadata
 *   and updating rendering of your open Conversation
 *
 * Finally, to access a list of Messages in a Conversation, see layer.Query.
 *
 * @class  layer.Conversation
 * @extends layer.Syncable
 * @author  Michael Kantor
 */

var Syncable = require('./syncable');
var Message = require('./message');
var LayerError = require('./layer-error');
var Util = require('./client-utils');
var Constants = require('./const');
var Root = require('./root');
var LayerEvent = require('./layer-event');

var Conversation = function (_Syncable) {
  _inherits(Conversation, _Syncable);

  /**
   * Create a new conversation.
   *
   * The static `layer.Conversation.create()` method
   * will correctly lookup distinct Conversations and
   * return them; `new layer.Conversation()` will not.
   *
   * Developers should use `layer.Conversation.create()`.
   *
   * @method constructor
   * @protected
   * @param  {Object} options
   * @param {string[]/layer.Identity[]} options.participants - Array of Participant IDs or layer.Identity instances
   * @param {boolean} [options.distinct=true] - Is the conversation distinct
   * @param {Object} [options.metadata] - An object containing Conversation Metadata.
   * @return {layer.Conversation}
   */
  function Conversation() {
    var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Conversation);

    // Setup default values
    if (!options.participants) options.participants = [];
    if (!options.metadata) options.metadata = {};

    // Make sure the ID from handle fromServer parameter is used by the Root.constructor
    if (options.fromServer) options.id = options.fromServer.id;

    // Make sure we have an clientId property
    if (options.client) options.clientId = options.client.appId;

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Conversation).call(this, options));

    _this.isInitializing = true;
    var client = _this.getClient();

    // If the options contains a full server definition of the object,
    // copy it in with _populateFromServer; this will add the Conversation
    // to the Client as well.
    if (options && options.fromServer) {
      _this._populateFromServer(options.fromServer);
    }

    // Setup participants
    else {
        _this.participants = client._fixIdentities(_this.participants);

        if (_this.participants.indexOf(client.user) === -1) {
          _this.participants.push(client.user);
        }
      }

    if (!_this.createdAt) {
      _this.createdAt = new Date();
    }

    client._addConversation(_this);
    _this.isInitializing = false;
    return _this;
  }

  /**
   * Destroy the local copy of this Conversation, cleaning up all resources
   * it consumes.
   *
   * @method destroy
   */


  _createClass(Conversation, [{
    key: 'destroy',
    value: function destroy() {
      this.lastMessage = null;

      // Client fires 'conversations:remove' and then removes the Conversation.
      if (this.clientId) this.getClient()._removeConversation(this);

      _get(Object.getPrototypeOf(Conversation.prototype), 'destroy', this).call(this);

      this.participants = null;
      this.metadata = null;
    }

    /**
     * Create this Conversation on the server.
     *
     * On completion, this instance will receive
     * an id, url and createdAt.  It may also receive metadata
     * if there was a FOUND_WITHOUT_REQUESTED_METADATA result.
     *
     * Note that the optional Message parameter should NOT be used except
     * by the layer.Message class itself.
     *
     * Note that recommended practice is to send the Conversation by sending a Message in the Conversation,
     * and NOT by calling Conversation.send.
     *
     *      client.createConversation({
     *          participants: ['a', 'b'],
     *          distinct: false
     *      })
     *      .send()
     *      .on('conversations:sent', function(evt) {
     *          alert('Done');
     *      });
     *
     * @method send
     * @param {layer.Message} [message] Tells the Conversation what its last_message will be
     * @return {layer.Conversation} this
     */

  }, {
    key: 'send',
    value: function send(message) {
      var _this2 = this;

      var client = this.getClient();
      if (!client) throw new Error(LayerError.dictionary.clientMissing);

      // If this is part of a create({distinct:true}).send() call where
      // the distinct conversation was found, just trigger the cached event and exit
      var wasLocalDistinct = Boolean(this._sendDistinctEvent);
      if (this._sendDistinctEvent) this._handleLocalDistinctConversation();

      // If a message is passed in, then that message is being sent, and is our
      // new lastMessage (until the websocket tells us otherwise)
      if (message) {
        // Setting a position is required if its going to get sorted correctly by query.
        // The correct position will be written by _populateFromServer when the object
        // is returned from the server.  We increment the position by the time since the prior lastMessage was sent
        // so that if multiple tabs are sending messages and writing them to indexedDB, they will have positions in correct chronological order.
        // WARNING: The query will NOT be resorted using the server's position value.
        var position = void 0;
        if (this.lastMessage) {
          position = this.lastMessage.position + Date.now() - this.lastMessage.sentAt.getTime();
          if (position === this.lastMessage.position) position++;
        } else {
          position = 0;
        }
        message.position = position;
        this.lastMessage = message;
      }

      // If the Conversation is already on the server, don't send.
      if (wasLocalDistinct || this.syncState !== Constants.SYNC_STATE.NEW) return this;

      // Make sure this user is a participant (server does this for us, but
      // this insures the local copy is correct until we get a response from
      // the server
      if (this.participants.indexOf(client.user) === -1) {
        this.participants.push(client.user);
      }

      // If there is only one participant, its client.user.userId.  Not enough
      // for us to have a good Conversation on the server.  Abort.
      if (this.participants.length === 1) {
        throw new Error(LayerError.dictionary.moreParticipantsRequired);
      }

      this.createdAt = new Date();

      // Update the syncState
      this._setSyncing();

      client.sendSocketRequest({
        method: 'POST',
        body: {}, // see _getSendData
        sync: {
          depends: this.id,
          target: this.id
        }
      }, function (result) {
        return _this2._createResult(result);
      });
      return this;
    }

    /**
     * Handles the case where a Distinct Create Conversation found a local match.
     *
     * When an app calls client.createConversation([...])
     * and requests a Distinct Conversation (default setting),
     * and the Conversation already exists, what do we do to help
     * them access it?
     *
     *      client.createConversation(["fred"]).on("conversations:sent", function(evt) {
     *        render();
     *      });
     *
     * Under normal conditions, calling `c.send()` on a matching distinct Conversation
     * would either throw an error or just be a no-op.  We use this method to trigger
     * the expected "conversations:sent" event even though its already been sent and
     * we did nothing.  Use the evt.result property if you want to know whether the
     * result was a new conversation or matching one.
     *
     * @method _handleLocalDistinctConversation
     * @private
     */

  }, {
    key: '_handleLocalDistinctConversation',
    value: function _handleLocalDistinctConversation() {
      var evt = this._sendDistinctEvent;
      this._sendDistinctEvent = null;

      // delay so there is time to setup an event listener on this conversation
      this._triggerAsync('conversations:sent', evt);
      return this;
    }

    /**
     * Gets the data for a Create request.
     *
     * The layer.SyncManager needs a callback to create the Conversation as it
     * looks NOW, not back when `send()` was called.  This method is called
     * by the layer.SyncManager to populate the POST data of the call.
     *
     * @method _getSendData
     * @private
     * @return {Object} Websocket data for the request
     */

  }, {
    key: '_getSendData',
    value: function _getSendData(data) {
      var isMetadataEmpty = Util.isEmpty(this.metadata);
      return {
        method: 'Conversation.create',
        data: {
          participants: this.participants.map(function (identity) {
            return identity.id;
          }),
          distinct: this.distinct,
          metadata: isMetadataEmpty ? null : this.metadata,
          id: this.id
        }
      };
    }

    /**
     * Process result of send method.
     *
     * Note that we use _triggerAsync so that
     * events reporting changes to the layer.Conversation.id can
     * be applied before reporting on it being sent.
     *
     * Example: Query will now have the resolved Distinct IDs rather than the proposed ID
     * when this event is triggered.
     *
     * @method _createResult
     * @private
     * @param  {Object} result
     */

  }, {
    key: '_createResult',
    value: function _createResult(_ref) {
      var success = _ref.success;
      var data = _ref.data;

      if (this.isDestroyed) return;
      if (success) {
        this._createSuccess(data);
      } else if (data.id === 'conflict') {
        this._populateFromServer(data.data);
        this._triggerAsync('conversations:sent', {
          result: Conversation.FOUND_WITHOUT_REQUESTED_METADATA
        });
      } else {
        this.trigger('conversations:sent-error', { error: data });
        this.destroy();
      }
    }

    /**
     * Process the successful result of a create call
     *
     * @method _createSuccess
     * @private
     * @param  {Object} data Server description of Conversation
     */

  }, {
    key: '_createSuccess',
    value: function _createSuccess(data) {
      this._populateFromServer(data);
      if (!this.distinct) {
        this._triggerAsync('conversations:sent', {
          result: Conversation.CREATED
        });
      } else {
        // Currently the websocket does not tell us if its
        // returning an existing Conversation.  So guess...
        // if there is no lastMessage, then most likely, there was
        // no existing Conversation.  Sadly, API-834; last_message is currently
        // always null.
        this._triggerAsync('conversations:sent', {
          result: !this.lastMessage ? Conversation.CREATED : Conversation.FOUND
        });
      }
    }

    /**
     * Populates this instance using server-data.
     *
     * Side effects add this to the Client.
     *
     * @method _populateFromServer
     * @private
     * @param  {Object} conversation - Server representation of the conversation
     */

  }, {
    key: '_populateFromServer',
    value: function _populateFromServer(conversation) {
      var client = this.getClient();

      // Disable events if creating a new Conversation
      // We still want property change events for anything that DOES change
      this._disableEvents = this.syncState === Constants.SYNC_STATE.NEW;

      this._setSynced();

      var id = this.id;
      this.id = conversation.id;

      // IDs change if the server returns a matching Distinct Conversation
      if (id !== this.id) {
        client._updateConversationId(this, id);
        this._triggerAsync('conversations:change', {
          oldValue: id,
          newValue: this.id,
          property: 'id'
        });
      }

      this.url = conversation.url;
      this.participants = client._fixIdentities(conversation.participants);
      this.distinct = conversation.distinct;
      this.createdAt = new Date(conversation.created_at);
      this.metadata = conversation.metadata;
      this.unreadCount = conversation.unread_message_count;
      this.isCurrentParticipant = this.participants.indexOf(client.user) !== -1;

      client._addConversation(this);

      if (typeof conversation.last_message === 'string') {
        this.lastMessage = client.getMessage(conversation.last_message);
      } else if (conversation.last_message) {
        this.lastMessage = client._createObject(conversation.last_message);
      } else {
        this.lastMessage = null;
      }

      this._disableEvents = false;
    }

    /**
     * Add an array of participant ids to the conversation.
     *
     *      conversation.addParticipants(['a', 'b']);
     *
     * New participants will immediately show up in the Conversation,
     * but may not have synced with the server yet.
     *
     * TODO WEB-967: Roll participants back on getting a server error
     *
     * @method addParticipants
     * @param  {string[]/layer.Identity[]} participants - Array of Participant IDs or Identity objects
     * @returns {layer.Conversation} this
     */

  }, {
    key: 'addParticipants',
    value: function addParticipants(participants) {
      var _this3 = this;

      // Only add those that aren't already in the list.
      var client = this.getClient();
      var identities = client._fixIdentities(participants);
      var adding = identities.filter(function (identity) {
        return _this3.participants.indexOf(identity) === -1;
      });
      this._patchParticipants({ add: adding, remove: [] });
      return this;
    }

    /**
     * Removes an array of participant ids from the conversation.
     *
     *      conversation.removeParticipants(['a', 'b']);
     *
     * Removed participants will immediately be removed from this Conversation,
     * but may not have synced with the server yet.
     *
     * Throws error if you attempt to remove ALL participants.
     *
     * TODO  WEB-967: Roll participants back on getting a server error
     *
     * @method removeParticipants
     * @param  {string[]/layer.Identity[]} participants - Array of Participant IDs or Identity objects
     * @returns {layer.Conversation} this
     */

  }, {
    key: 'removeParticipants',
    value: function removeParticipants(participants) {
      var currentParticipants = {};
      this.participants.forEach(function (participant) {
        return currentParticipants[participant.id] = true;
      });
      var client = this.getClient();
      var identities = client._fixIdentities(participants);

      var removing = identities.filter(function (participant) {
        return currentParticipants[participant.id];
      });
      if (removing.length === 0) return this;
      if (removing.length === this.participants.length) {
        throw new Error(LayerError.dictionary.moreParticipantsRequired);
      }
      this._patchParticipants({ add: [], remove: removing });
      return this;
    }

    /**
     * Replaces all participants with a new array of of participant ids.
     *
     *      conversation.replaceParticipants(['a', 'b']);
     *
     * Changed participants will immediately show up in the Conversation,
     * but may not have synced with the server yet.
     *
     * TODO WEB-967: Roll participants back on getting a server error
     *
     * @method replaceParticipants
     * @param  {string[]/layer.Identity[]} participants - Array of Participant IDs or Identity objects
     * @returns {layer.Conversation} this
     */

  }, {
    key: 'replaceParticipants',
    value: function replaceParticipants(participants) {
      if (!participants || !participants.length) {
        throw new Error(LayerError.dictionary.moreParticipantsRequired);
      }

      var client = this.getClient();
      var identities = client._fixIdentities(participants);

      var change = this._getParticipantChange(identities, this.participants);
      this._patchParticipants(change);
      return this;
    }

    /**
     * Update the server with the new participant list.
     *
     * Executes as follows:
     *
     * 1. Updates the participants property of the local object
     * 2. Triggers a conversations:change event
     * 3. Submits a request to be sent to the server to update the server's object
     * 4. If there is an error, no errors are fired except by layer.SyncManager, but another
     *    conversations:change event is fired as the change is rolled back.
     *
     * @method _patchParticipants
     * @private
     * @param  {Object[]} operations - Array of JSON patch operation
     * @param  {Object} eventData - Data describing the change for use in an event
     */

  }, {
    key: '_patchParticipants',
    value: function _patchParticipants(change) {
      var _this4 = this;

      this._applyParticipantChange(change);
      this.isCurrentParticipant = this.participants.indexOf(this.getClient().user) !== -1;

      var ops = [];
      change.remove.forEach(function (participant) {
        ops.push({
          operation: 'remove',
          property: 'participants',
          id: participant.id
        });
      });

      change.add.forEach(function (participant) {
        ops.push({
          operation: 'add',
          property: 'participants',
          id: participant.id
        });
      });

      this._xhr({
        url: '',
        method: 'PATCH',
        data: JSON.stringify(ops),
        headers: {
          'content-type': 'application/vnd.layer-patch+json'
        }
      }, function (result) {
        if (!result.success) _this4._load();
      });
    }

    /**
     * Internally we use `{add: [], remove: []}` instead of LayerOperations.
     *
     * So control is handed off to this method to actually apply the changes
     * to the participants array.
     *
     * @method _applyParticipantChange
     * @private
     * @param  {Object} change
     * @param  {layer.Identity[]} change.add - Array of userids to add
     * @param  {layer.Identity[]} change.remove - Array of userids to remove
     */

  }, {
    key: '_applyParticipantChange',
    value: function _applyParticipantChange(change) {
      var participants = [].concat(this.participants);
      change.add.forEach(function (participant) {
        if (participants.indexOf(participant) === -1) participants.push(participant);
      });
      change.remove.forEach(function (participant) {
        var index = participants.indexOf(participant);
        if (index !== -1) participants.splice(index, 1);
      });
      this.participants = participants;
    }

    /**
     * Delete the Conversation from the server and removes this user as a participant.
     *
     * @method leave
     */

  }, {
    key: 'leave',
    value: function leave() {
      if (this.isDestroyed) throw new Error(LayerError.dictionary.isDestroyed);
      this._delete('mode=' + Constants.DELETION_MODE.MY_DEVICES + '&leave=true');
    }

    /**
     * Delete the Conversation from the server, but deletion mode may cause user to remain a participant.
     *
     * This call will support various deletion modes.
     *
     * Deletion Modes:
     *
     * * layer.Constants.DELETION_MODE.ALL: This deletes the local copy immediately, and attempts to also
     *   delete the server's copy.
     * * layer.Constants.DELETION_MODE.MY_DEVICES: Deletes the local copy immediately, and attempts to delete it from all
     *   of my devices.  Other users retain access.
     * * true: For backwards compatibility thi is the same as ALL.
     *
     * MY_DEVICES does not remove this user as a participant.  That means a new Message on this Conversation will recreate the
     * Conversation for this user.  See layer.Conversation.leave() instead.
     *
     * Executes as follows:
     *
     * 1. Submits a request to be sent to the server to delete the server's object
     * 2. Delete's the local object
     * 3. If there is an error, no errors are fired except by layer.SyncManager, but the Conversation will be reloaded from the server,
     *    triggering a conversations:add event.
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
          queryStr = 'mode=' + Constants.DELETION_MODE.ALL;
          break;
        case Constants.DELETION_MODE.MY_DEVICES:
          queryStr = 'mode=' + Constants.DELETION_MODE.MY_DEVICES + '&leave=false';
          break;
        default:
          throw new Error(LayerError.dictionary.deletionModeUnsupported);
      }

      this._delete(queryStr);
    }

    /**
     * Delete the Conversation from the server (internal version).
     *
     * This version of Delete takes a Query String that is packaged up by
     * layer.Conversation.delete and layer.Conversation.leave.
     *
     * @method _delete
     * @private
     * @param {string} queryStr - Query string for the DELETE request
     */

  }, {
    key: '_delete',
    value: function _delete(queryStr) {
      var id = this.id;
      var client = this.getClient();
      this._xhr({
        method: 'DELETE',
        url: '?' + queryStr
      }, function (result) {
        if (!result.success && (!result.data || result.data.id !== 'not_found')) Conversation.load(id, client);
      });

      this._deleted();
      this.destroy();
    }
  }, {
    key: '_handleWebsocketDelete',
    value: function _handleWebsocketDelete(data) {
      if (data.mode === Constants.DELETION_MODE.MY_DEVICES && data.from_position) {
        this.getClient()._purgeMessagesByPosition(this.id, data.from_position);
      } else {
        _get(Object.getPrototypeOf(Conversation.prototype), '_handleWebsocketDelete', this).call(this);
      }
    }

    /**
     * Create a new layer.Message instance within this conversation
     *
     *      var message = conversation.createMessage('hello');
     *
     *      var message = conversation.createMessage({
     *          parts: [new layer.MessagePart({
     *                      body: 'hello',
     *                      mimeType: 'text/plain'
     *                  })]
     *      });
     *
     * See layer.Message for more options for creating the message.
     *
     * @method createMessage
     * @param  {string|Object} options - If its a string, a MessagePart is created around that string.
     * @param {layer.MessagePart[]} options.parts - An array of MessageParts.  There is some tolerance for
     *                                               it not being an array, or for it being a string to be turned
     *                                               into a MessagePart.
     * @return {layer.Message}
     */

  }, {
    key: 'createMessage',
    value: function createMessage() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var messageConfig = typeof options === 'string' ? {
        parts: [{ body: options, mimeType: 'text/plain' }]
      } : options;
      messageConfig.clientId = this.clientId;
      messageConfig.conversationId = this.id;

      return new Message(messageConfig);
    }

    /**
     * LayerPatch will call this after changing any properties.
     *
     * Trigger any cleanup or events needed after these changes.
     *
     * @method _handlePatchEvent
     * @private
     * @param  {Mixed} newValue - New value of the property
     * @param  {Mixed} oldValue - Prior value of the property
     * @param  {string[]} paths - Array of paths specifically modified: ['participants'], ['metadata.keyA', 'metadata.keyB']
     */

  }, {
    key: '_handlePatchEvent',
    value: function _handlePatchEvent(newValue, oldValue, paths) {
      var _this5 = this;

      // Certain types of __update handlers are disabled while values are being set by
      // layer patch parser because the difference between setting a value (triggers an event)
      // and change a property of a value (triggers only this callback) result in inconsistent
      // behaviors.  Enable them long enough to allow __update calls to be made
      this._inLayerParser = false;
      try {
        var events = this._disableEvents;
        this._disableEvents = false;
        if (paths[0].indexOf('metadata') === 0) {
          this.__updateMetadata(newValue, oldValue, paths);
        } else if (paths[0] === 'participants') {
          (function () {
            var client = _this5.getClient();
            // oldValue/newValue come as a Basic Identity POJO; lets deliver events with actual instances
            oldValue = oldValue.map(function (identity) {
              return client.getIdentity(identity.id);
            });
            newValue = newValue.map(function (identity) {
              return client.getIdentity(identity.id);
            });
            _this5.__updateParticipants(newValue, oldValue);
          })();
        }
        this._disableEvents = events;
      } catch (err) {
        // do nothing
      }
      this._inLayerParser = true;
    }

    /**
     * Given the oldValue and newValue for participants,
     * generate a list of whom was added and whom was removed.
     *
     * @method _getParticipantChange
     * @private
     * @param  {layer.Identity[]} newValue
     * @param  {layer.Identity[]} oldValue
     * @return {Object} Returns changes in the form of `{add: [...], remove: [...]}`
     */

  }, {
    key: '_getParticipantChange',
    value: function _getParticipantChange(newValue, oldValue) {
      var change = {};
      change.add = newValue.filter(function (participant) {
        return oldValue.indexOf(participant) === -1;
      });
      change.remove = oldValue.filter(function (participant) {
        return newValue.indexOf(participant) === -1;
      });
      return change;
    }

    /**
     * Updates specified metadata keys.
     *
     * Updates the local object's metadata and syncs the change to the server.
     *
     *      conversation.setMetadataProperties({
     *          'title': 'I am a title',
     *          'colors.background': 'red',
     *          'colors.text': {
     *              'fill': 'blue',
     *              'shadow': 'black'
     *           },
     *           'colors.title.fill': 'red'
     *      });
     *
     * Use setMetadataProperties to specify the path to a property, and a new value for that property.
     * Multiple properties can be changed this way.  Whatever value was there before is
     * replaced with the new value; so in the above example, whatever other keys may have
     * existed under `colors.text` have been replaced by the new object `{fill: 'blue', shadow: 'black'}`.
     *
     * Note also that only string and subobjects are accepted as values.
     *
     * Keys with '.' will update a field of an object (and create an object if it wasn't there):
     *
     * Initial metadata: {}
     *
     *      conversation.setMetadataProperties({
     *          'colors.background': 'red',
     *      });
     *
     * Metadata is now: `{colors: {background: 'red'}}`
     *
     *      conversation.setMetadataProperties({
     *          'colors.foreground': 'black',
     *      });
     *
     * Metadata is now: `{colors: {background: 'red', foreground: 'black'}}`
     *
     * Executes as follows:
     *
     * 1. Updates the metadata property of the local object
     * 2. Triggers a conversations:change event
     * 3. Submits a request to be sent to the server to update the server's object
     * 4. If there is an error, no errors are fired except by layer.SyncManager, but another
     *    conversations:change event is fired as the change is rolled back.
     *
     * @method setMetadataProperties
     * @param  {Object} properties
     * @return {layer.Conversation} this
     *
     */

  }, {
    key: 'setMetadataProperties',
    value: function setMetadataProperties(props) {
      var _this6 = this;

      var layerPatchOperations = [];
      Object.keys(props).forEach(function (name) {
        var fullName = name;
        if (name) {
          if (name !== 'metadata' && name.indexOf('metadata.') !== 0) {
            fullName = 'metadata.' + name;
          }
          layerPatchOperations.push({
            operation: 'set',
            property: fullName,
            value: props[name]
          });
        }
      });

      this._inLayerParser = true;

      // Do this before setSyncing as if there are any errors, we should never even
      // start setting up a request.
      Util.layerParse({
        object: this,
        type: 'Conversation',
        operations: layerPatchOperations,
        client: this.getClient()
      });
      this._inLayerParser = false;

      this._xhr({
        url: '',
        method: 'PATCH',
        data: JSON.stringify(layerPatchOperations),
        headers: {
          'content-type': 'application/vnd.layer-patch+json'
        }
      }, function (result) {
        if (!result.success && !_this6.isDestroyed) _this6._load();
      });

      return this;
    }

    /**
     * Deletes specified metadata keys.
     *
     * Updates the local object's metadata and syncs the change to the server.
     *
     *      conversation.deleteMetadataProperties(
     *          ['title', 'colors.background', 'colors.title.fill']
     *      );
     *
     * Use deleteMetadataProperties to specify paths to properties to be deleted.
     * Multiple properties can be deleted.
     *
     * Executes as follows:
     *
     * 1. Updates the metadata property of the local object
     * 2. Triggers a conversations:change event
     * 3. Submits a request to be sent to the server to update the server's object
     * 4. If there is an error, no errors are fired except by layer.SyncManager, but another
     *    conversations:change event is fired as the change is rolled back.
     *
     * @method deleteMetadataProperties
     * @param  {string[]} properties
     * @return {layer.Conversation} this
     */

  }, {
    key: 'deleteMetadataProperties',
    value: function deleteMetadataProperties(props) {
      var _this7 = this;

      var layerPatchOperations = [];
      props.forEach(function (property) {
        if (property !== 'metadata' && property.indexOf('metadata.') !== 0) {
          property = 'metadata.' + property;
        }
        layerPatchOperations.push({
          operation: 'delete',
          property: property
        });
      }, this);

      this._inLayerParser = true;

      // Do this before setSyncing as if there are any errors, we should never even
      // start setting up a request.
      Util.layerParse({
        object: this,
        type: 'Conversation',
        operations: layerPatchOperations,
        client: this.getClient()
      });
      this._inLayerParser = false;

      this._xhr({
        url: '',
        method: 'PATCH',
        data: JSON.stringify(layerPatchOperations),
        headers: {
          'content-type': 'application/vnd.layer-patch+json'
        }
      }, function (result) {
        if (!result.success) _this7._load();
      });

      return this;
    }
  }, {
    key: '_getUrl',
    value: function _getUrl(url) {
      return this.url + (url || '');
    }
  }, {
    key: '_loaded',
    value: function _loaded(data) {
      this.getClient()._addConversation(this);
    }

    /**
     * Standard `on()` provided by layer.Root.
     *
     * Adds some special handling of 'conversations:loaded' so that calls such as
     *
     *      var c = client.getConversation('layer:///conversations/123', true)
     *      .on('conversations:loaded', function() {
     *          myrerender(c);
     *      });
     *      myrender(c); // render a placeholder for c until the details of c have loaded
     *
     * can fire their callback regardless of whether the client loads or has
     * already loaded the Conversation.
     *
     * @method on
     * @param  {string} eventName
     * @param  {Function} callback
     * @param  {Object} context
     * @return {layer.Conversation} this
     */

  }, {
    key: 'on',
    value: function on(name, callback, context) {
      var hasLoadedEvt = name === 'conversations:loaded' || name && (typeof name === 'undefined' ? 'undefined' : _typeof(name)) === 'object' && name['conversations:loaded'];

      if (hasLoadedEvt && !this.isLoading) {
        (function () {
          var callNow = name === 'conversations:loaded' ? callback : name['conversations:loaded'];
          Util.defer(function () {
            return callNow.apply(context);
          });
        })();
      }
      _get(Object.getPrototypeOf(Conversation.prototype), 'on', this).call(this, name, callback, context);

      return this;
    }

    /*
     * Insure that conversation.unreadCount-- can never reduce the value to negative values.
     */

  }, {
    key: '__adjustUnreadCount',
    value: function __adjustUnreadCount(newValue) {
      if (newValue < 0) return 0;
    }

    /**
     * __ Methods are automatically called by property setters.
     *
     * Any change in the unreadCount property will call this method and fire a
     * change event.
     *
     * Any triggering of this from a websocket patch unread_message_count should wait a second before firing any events
     * so that if there are a series of these updates, we don't see a lot of jitter.
     *
     * NOTE: _oldUnreadCount is used to pass data to _updateUnreadCountEvent because this method can be called many times
     * a second, and we only want to trigger this with a summary of changes rather than each individual change.
     *
     * @method __updateUnreadCount
     * @private
     * @param  {number} newValue
     * @param  {number} oldValue
     */

  }, {
    key: '__updateUnreadCount',
    value: function __updateUnreadCount(newValue, oldValue) {
      var _this8 = this;

      if (this._inLayerParser) {
        if (this._oldUnreadCount === undefined) this._oldUnreadCount = oldValue;
        if (this._updateUnreadCountTimeout) clearTimeout(this._updateUnreadCountTimeout);
        this._updateUnreadCountTimeout = setTimeout(function () {
          return _this8._updateUnreadCountEvent();
        }, 1000);
      } else {
        this._updateUnreadCountEvent();
      }
    }

    /**
     * Fire events related to changes to unreadCount
     *
     * @method _updateUnreadCountEvent
     * @private
     */

  }, {
    key: '_updateUnreadCountEvent',
    value: function _updateUnreadCountEvent() {
      if (this.isDestroyed) return;
      var oldValue = this._oldUnreadCount;
      var newValue = this.__unreadCount;
      this._oldUnreadCount = undefined;

      if (newValue === oldValue) return;
      this._triggerAsync('conversations:change', {
        newValue: newValue,
        oldValue: oldValue,
        property: 'unreadCount'
      });
    }

    /**
     * __ Methods are automatically called by property setters.
     *
     * Any change in the lastMessage pointer will call this method and fire a
     * change event.  Changes to properties within the lastMessage object will
     * not trigger this call.
     *
     * @method __updateLastMessage
     * @private
     * @param  {layer.Message} newValue
     * @param  {layer.Message} oldValue
     */

  }, {
    key: '__updateLastMessage',
    value: function __updateLastMessage(newValue, oldValue) {
      if (newValue && oldValue && newValue.id === oldValue.id) return;
      this._triggerAsync('conversations:change', {
        property: 'lastMessage',
        newValue: newValue,
        oldValue: oldValue
      });
    }

    /**
     * __ Methods are automatically called by property setters.
     *
     * Any change in the participants property will call this method and fire a
     * change event.  Changes to the participants array that don't replace the array
     * with a new array will require directly calling this method.
     *
     * @method __updateParticipants
     * @private
     * @param  {string[]} newValue
     * @param  {string[]} oldValue
     */

  }, {
    key: '__updateParticipants',
    value: function __updateParticipants(newValue, oldValue) {
      if (this._inLayerParser) return;
      var change = this._getParticipantChange(newValue, oldValue);
      if (change.add.length || change.remove.length) {
        change.property = 'participants';
        change.oldValue = oldValue;
        change.newValue = newValue;
        this._triggerAsync('conversations:change', change);
      }
    }

    /**
     * __ Methods are automatically called by property setters.
     *
     * Any change in the metadata property will call this method and fire a
     * change event.  Changes to the metadata object that don't replace the object
     * with a new object will require directly calling this method.
     *
     * @method __updateMetadata
     * @private
     * @param  {Object} newValue
     * @param  {Object} oldValue
     */

  }, {
    key: '__updateMetadata',
    value: function __updateMetadata(newValue, oldValue, paths) {
      if (this._inLayerParser) return;
      if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
        this._triggerAsync('conversations:change', {
          property: 'metadata',
          newValue: newValue,
          oldValue: oldValue,
          paths: paths
        });
      }
    }

    /**
     * Returns a plain object.
     *
     * Object will have all the same public properties as this
     * Conversation instance.  New object is returned any time
     * any of this object's properties change.
     *
     * @method toObject
     * @return {Object} POJO version of this.
     */

  }, {
    key: 'toObject',
    value: function toObject() {
      if (!this._toObject) {
        this._toObject = _get(Object.getPrototypeOf(Conversation.prototype), 'toObject', this).call(this);
        this._toObject.metadata = Util.clone(this.metadata);
      }
      return this._toObject;
    }
  }, {
    key: '_triggerAsync',
    value: function _triggerAsync(evtName, args) {
      this._clearObject();
      _get(Object.getPrototypeOf(Conversation.prototype), '_triggerAsync', this).call(this, evtName, args);
    }
  }, {
    key: 'trigger',
    value: function trigger(evtName, args) {
      this._clearObject();
      _get(Object.getPrototypeOf(Conversation.prototype), 'trigger', this).call(this, evtName, args);
    }

    /**
     * Create a conversation instance from a server representation of the conversation.
     *
     * If the Conversation already exists, will update the existing copy with
     * presumably newer values.
     *
     * @method _createFromServer
     * @protected
     * @static
     * @param  {Object} conversation - Server representation of a Conversation
     * @param  {layer.Client} client
     * @return {layer.Conversation}
     */

  }], [{
    key: '_createFromServer',
    value: function _createFromServer(conversation, client) {
      return new Conversation({
        client: client,
        fromServer: conversation,
        _fromDB: conversation._fromDB
      });
    }

    /**
     * Find or create a new converation.
     *
     *      var conversation = layer.Conversation.create({
     *          participants: ['a', 'b'],
     *          distinct: true,
     *          metadata: {
     *              title: 'I am not a title!'
     *          },
     *          client: client,
     *          'conversations:loaded': function(evt) {
     *
     *          }
     *      });
     *
     * Only tries to find a Conversation if its a Distinct Conversation.
     * Distinct defaults to true.
     *
     * Recommend using `client.createConversation({...})`
     * instead of `Conversation.create({...})`.
     *
     * @method create
     * @static
     * @protected
     * @param  {Object} options
     * @param  {layer.Client} options.client
     * @param  {string[]/layer.Identity[]} options.participants - Array of Participant IDs or layer.Identity objects to create a conversation with.
     * @param {boolean} [options.distinct=true] - Create a distinct conversation
     * @param {Object} [options.metadata={}] - Initial metadata for Conversation
     * @return {layer.Conversation}
     */

  }, {
    key: 'create',
    value: function create(options) {
      if (!options.client) throw new Error(LayerError.dictionary.clientMissing);
      var newOptions = {
        distinct: options.distinct,
        participants: options.client._fixIdentities(options.participants),
        metadata: options.metadata,
        client: options.client
      };
      if (newOptions.distinct) {
        var conv = this._createDistinct(newOptions);
        if (conv) return conv;
      }
      return new Conversation(newOptions);
    }

    /**
     * Create or Find a Distinct Conversation.
     *
     * If the static Conversation.create method gets a request for a Distinct Conversation,
     * see if we have one cached.
     *
     * Will fire the 'conversations:loaded' event if one is provided in this call,
     * and a Conversation is found.
     *
     * @method _createDistinct
     * @static
     * @private
     * @param  {Object} options - See layer.Conversation.create options; participants must be layer.Identity[]
     * @return {layer.Conversation}
     */

  }, {
    key: '_createDistinct',
    value: function _createDistinct(options) {
      if (options.participants.indexOf(options.client.user) === -1) {
        options.participants.push(options.client.user);
      }

      var participantsHash = {};
      options.participants.forEach(function (participant) {
        participantsHash[participant.id] = participant;
      });

      var conv = options.client.findCachedConversation(function (aConv) {
        if (aConv.distinct && aConv.participants.length === options.participants.length) {
          for (var index = 0; index < aConv.participants.length; index++) {
            if (!participantsHash[aConv.participants[index].id]) return false;
          }
          return true;
        }
      });

      if (conv) {
        conv._sendDistinctEvent = new LayerEvent({
          target: conv,
          result: !options.metadata || Util.doesObjectMatch(options.metadata, conv.metadata) ? Conversation.FOUND : Conversation.FOUND_WITHOUT_REQUESTED_METADATA
        }, 'conversations:sent');
        return conv;
      }
    }

    /**
     * Identifies whether a Conversation receiving the specified patch data should be loaded from the server.
     *
     * Any change to a Conversation indicates that the Conversation is active and of potential interest; go ahead and load that
     * Conversation in case the app has need of it.  In the future we may ignore changes to unread count.  Only relevant
     * when we get Websocket events for a Conversation that has not been loaded/cached on Client.
     *
     * @method _loadResourceForPatch
     * @static
     * @private
     */

  }, {
    key: '_loadResourceForPatch',
    value: function _loadResourceForPatch(patchData) {
      return true;
    }
  }]);

  return Conversation;
}(Syncable);

/**
 * Array of participant ids.
 *
 * Do not directly manipulate;
 * use addParticipants, removeParticipants and replaceParticipants
 * to manipulate the array.
 *
 * @type {layer.Identity[]}
 */


Conversation.prototype.participants = null;

/**
 * Time that the conversation was created on the server.
 *
 * @type {Date}
 */
Conversation.prototype.createdAt = null;

/**
 * Number of unread messages in the conversation.
 *
 * @type {number}
 */
Conversation.prototype.unreadCount = 0;

/**
 * This is a Distinct Conversation.
 *
 * You can have 1 distinct conversation among a set of participants.
 * There are no limits to how many non-distinct Conversations you have have
 * among a set of participants.
 *
 * @type {boolean}
 */
Conversation.prototype.distinct = true;

/**
 * Metadata for the conversation.
 *
 * Metadata values can be plain objects and strings, but
 * no arrays, numbers, booleans or dates.
 * @type {Object}
 */
Conversation.prototype.metadata = null;

/**
 * The authenticated user is a current participant in this Conversation.
 *
 * Set to false if the authenticated user has been removed from this conversation.
 *
 * A removed user can see messages up to the time they were removed,
 * but can no longer interact with the conversation.
 *
 * A removed user can no longer see the participant list.
 *
 * Read and Delivery receipts will fail on any Message in such a Conversation.
 *
 * @type {Boolean}
 */
Conversation.prototype.isCurrentParticipant = true;

/**
 * The last layer.Message to be sent/received for this Conversation.
 *
 * Value may be a Message that has been locally created but not yet received by server.
 * @type {layer.Message}
 */
Conversation.prototype.lastMessage = null;

/**
 * Caches last result of toObject()
 * @type {Object}
 * @private
 */
Conversation.prototype._toObject = null;

Conversation.eventPrefix = 'conversations';

/**
 * Cache's a Distinct Event.
 *
 * On creating a Distinct Conversation that already exists,
 * when the send() method is called, we should trigger
 * specific events detailing the results.  Results
 * may be determined locally or on the server, but same Event may be needed.
 *
 * @type {layer.LayerEvent}
 * @private
 */
Conversation.prototype._sendDistinctEvent = null;

/**
 * Prefix to use when generating an ID for instances of this class
 * @type {String}
 * @static
 * @private
 */
Conversation.prefixUUID = 'layer:///conversations/';

/**
 * Property to look for when bubbling up events.
 * @type {String}
 * @static
 * @private
 */
Conversation.bubbleEventParent = 'getClient';

/**
 * The Conversation that was requested has been created.
 *
 * Used in `conversations:sent` events.
 * @type {String}
 * @static
 */
Conversation.CREATED = 'Created';

/**
 * The Conversation that was requested has been found.
 *
 * This means that it did not need to be created.
 *
 * Used in `conversations:sent` events.
 * @type {String}
 * @static
 */
Conversation.FOUND = 'Found';

/**
 * The Conversation that was requested has been found, but there was a mismatch in metadata.
 *
 * If the createConversation request contained metadata and it did not match the Distinct Conversation
 * that matched the requested participants, then this value is passed to notify your app that the Conversation
 * was returned but does not exactly match your request.
 *
 * Used in `conversations:sent` events.
 * @type {String}
 * @static
 */
Conversation.FOUND_WITHOUT_REQUESTED_METADATA = 'FoundMismatch';

Conversation._supportedEvents = [

/**
 * The conversation is now on the server.
 *
 * Called after successfully creating the conversation
 * on the server.  The Result property is one of:
 *
 * * Conversation.CREATED: A new Conversation has been created
 * * Conversation.FOUND: A matching Distinct Conversation has been found
 * * Conversation.FOUND_WITHOUT_REQUESTED_METADATA: A matching Distinct Conversation has been found
 *                       but note that the metadata is NOT what you requested.
 *
 * All of these results will also mean that the updated property values have been
 * copied into your Conversation object.  That means your metadata property may no
 * longer be its initial value; it may be the value found on the server.
 *
 * @event
 * @param {layer.LayerEvent} event
 * @param {string} event.result
 */
'conversations:sent',

/**
 * An attempt to send this conversation to the server has failed.
 * @event
 * @param {layer.LayerEvent} event
 * @param {layer.LayerError} event.error
 */
'conversations:sent-error',

/**
 * The conversation is now loaded from the server.
 *
 * Note that this is only used in response to the layer.Conversation.load() method.
 * from the server.
 * @event
 * @param {layer.LayerEvent} event
 */
'conversations:loaded',

/**
 * An attempt to load this conversation from the server has failed.
 *
 * Note that this is only used in response to the layer.Conversation.load() method.
 * @event
 * @param {layer.LayerEvent} event
 * @param {layer.LayerError} event.error
 */
'conversations:loaded-error',

/**
 * The conversation has been deleted from the server.
 *
 * Caused by either a successful call to delete() on this instance
 * or by a remote user.
 * @event
 * @param {layer.LayerEvent} event
 */
'conversations:delete',

/**
 * This conversation has changed.
 *
 * @event
 * @param {layer.LayerEvent} event
 * @param {Object[]} event.changes - Array of changes reported by this event
 * @param {Mixed} event.changes.newValue
 * @param {Mixed} event.changes.oldValue
 * @param {string} event.changes.property - Name of the property that changed
 * @param {layer.Conversation} event.target
 */
'conversations:change'].concat(Syncable._supportedEvents);

Root.initClass.apply(Conversation, [Conversation, 'Conversation']);
Syncable.subclasses.push(Conversation);
module.exports = Conversation;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jb252ZXJzYXRpb24uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQW9EQSxJQUFNLFdBQVcsUUFBUSxZQUFSLENBQWpCO0FBQ0EsSUFBTSxVQUFVLFFBQVEsV0FBUixDQUFoQjtBQUNBLElBQU0sYUFBYSxRQUFRLGVBQVIsQ0FBbkI7QUFDQSxJQUFNLE9BQU8sUUFBUSxnQkFBUixDQUFiO0FBQ0EsSUFBTSxZQUFZLFFBQVEsU0FBUixDQUFsQjtBQUNBLElBQU0sT0FBTyxRQUFRLFFBQVIsQ0FBYjtBQUNBLElBQU0sYUFBYSxRQUFRLGVBQVIsQ0FBbkI7O0lBRU0sWTs7O0FBRUo7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBaUJBLDBCQUEwQjtBQUFBLFFBQWQsT0FBYyx5REFBSixFQUFJOztBQUFBOztBQUN4QjtBQUNBLFFBQUksQ0FBQyxRQUFRLFlBQWIsRUFBMkIsUUFBUSxZQUFSLEdBQXVCLEVBQXZCO0FBQzNCLFFBQUksQ0FBQyxRQUFRLFFBQWIsRUFBdUIsUUFBUSxRQUFSLEdBQW1CLEVBQW5COztBQUV2QjtBQUNBLFFBQUksUUFBUSxVQUFaLEVBQXdCLFFBQVEsRUFBUixHQUFhLFFBQVEsVUFBUixDQUFtQixFQUFoQzs7QUFFeEI7QUFDQSxRQUFJLFFBQVEsTUFBWixFQUFvQixRQUFRLFFBQVIsR0FBbUIsUUFBUSxNQUFSLENBQWUsS0FBbEM7O0FBVEksZ0dBV2xCLE9BWGtCOztBQWN4QixVQUFLLGNBQUwsR0FBc0IsSUFBdEI7QUFDQSxRQUFNLFNBQVMsTUFBSyxTQUFMLEVBQWY7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsUUFBSSxXQUFXLFFBQVEsVUFBdkIsRUFBbUM7QUFDakMsWUFBSyxtQkFBTCxDQUF5QixRQUFRLFVBQWpDO0FBQ0Q7O0FBRUQ7QUFKQSxTQUtLO0FBQ0gsY0FBSyxZQUFMLEdBQW9CLE9BQU8sY0FBUCxDQUFzQixNQUFLLFlBQTNCLENBQXBCOztBQUVBLFlBQUksTUFBSyxZQUFMLENBQWtCLE9BQWxCLENBQTBCLE9BQU8sSUFBakMsTUFBMkMsQ0FBQyxDQUFoRCxFQUFtRDtBQUNqRCxnQkFBSyxZQUFMLENBQWtCLElBQWxCLENBQXVCLE9BQU8sSUFBOUI7QUFDRDtBQUNGOztBQUVELFFBQUksQ0FBQyxNQUFLLFNBQVYsRUFBcUI7QUFDbkIsWUFBSyxTQUFMLEdBQWlCLElBQUksSUFBSixFQUFqQjtBQUNEOztBQUVELFdBQU8sZ0JBQVA7QUFDQSxVQUFLLGNBQUwsR0FBc0IsS0FBdEI7QUF0Q3dCO0FBdUN6Qjs7QUFFRDs7Ozs7Ozs7Ozs4QkFNVTtBQUNSLFdBQUssV0FBTCxHQUFtQixJQUFuQjs7QUFFQTtBQUNBLFVBQUksS0FBSyxRQUFULEVBQW1CLEtBQUssU0FBTCxHQUFpQixtQkFBakIsQ0FBcUMsSUFBckM7O0FBRW5COztBQUVBLFdBQUssWUFBTCxHQUFvQixJQUFwQjtBQUNBLFdBQUssUUFBTCxHQUFnQixJQUFoQjtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozt5QkEwQkssTyxFQUFTO0FBQUE7O0FBQ1osVUFBTSxTQUFTLEtBQUssU0FBTCxFQUFmO0FBQ0EsVUFBSSxDQUFDLE1BQUwsRUFBYSxNQUFNLElBQUksS0FBSixDQUFVLFdBQVcsVUFBWCxDQUFzQixhQUFoQyxDQUFOOztBQUViO0FBQ0E7QUFDQSxVQUFNLG1CQUFtQixRQUFRLEtBQUssa0JBQWIsQ0FBekI7QUFDQSxVQUFJLEtBQUssa0JBQVQsRUFBNkIsS0FBSyxnQ0FBTDs7QUFFN0I7QUFDQTtBQUNBLFVBQUksT0FBSixFQUFhO0FBQ1g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFlBQUksaUJBQUo7QUFDQSxZQUFJLEtBQUssV0FBVCxFQUFzQjtBQUNwQixxQkFBVyxLQUFLLFdBQUwsQ0FBaUIsUUFBakIsR0FBNEIsS0FBSyxHQUFMLEVBQTVCLEdBQXlDLEtBQUssV0FBTCxDQUFpQixNQUFqQixDQUF3QixPQUF4QixFQUFwRDtBQUNBLGNBQUksYUFBYSxLQUFLLFdBQUwsQ0FBaUIsUUFBbEMsRUFBNEM7QUFDN0MsU0FIRCxNQUdPO0FBQ0wscUJBQVcsQ0FBWDtBQUNEO0FBQ0QsZ0JBQVEsUUFBUixHQUFtQixRQUFuQjtBQUNBLGFBQUssV0FBTCxHQUFtQixPQUFuQjtBQUNEOztBQUVEO0FBQ0EsVUFBSSxvQkFBb0IsS0FBSyxTQUFMLEtBQW1CLFVBQVUsVUFBVixDQUFxQixHQUFoRSxFQUFxRSxPQUFPLElBQVA7O0FBRXJFO0FBQ0E7QUFDQTtBQUNBLFVBQUksS0FBSyxZQUFMLENBQWtCLE9BQWxCLENBQTBCLE9BQU8sSUFBakMsTUFBMkMsQ0FBQyxDQUFoRCxFQUFtRDtBQUNqRCxhQUFLLFlBQUwsQ0FBa0IsSUFBbEIsQ0FBdUIsT0FBTyxJQUE5QjtBQUNEOztBQUVEO0FBQ0E7QUFDQSxVQUFJLEtBQUssWUFBTCxDQUFrQixNQUFsQixLQUE2QixDQUFqQyxFQUFvQztBQUNsQyxjQUFNLElBQUksS0FBSixDQUFVLFdBQVcsVUFBWCxDQUFzQix3QkFBaEMsQ0FBTjtBQUNEOztBQUVELFdBQUssU0FBTCxHQUFpQixJQUFJLElBQUosRUFBakI7O0FBRUE7QUFDQSxXQUFLLFdBQUw7O0FBRUEsYUFBTyxpQkFBUCxDQUF5QjtBQUN2QixnQkFBUSxNQURlO0FBRXZCLGNBQU0sRUFGaUIsRUFFYjtBQUNWLGNBQU07QUFDSixtQkFBUyxLQUFLLEVBRFY7QUFFSixrQkFBUSxLQUFLO0FBRlQ7QUFIaUIsT0FBekIsRUFPRyxVQUFDLE1BQUQ7QUFBQSxlQUFZLE9BQUssYUFBTCxDQUFtQixNQUFuQixDQUFaO0FBQUEsT0FQSDtBQVFBLGFBQU8sSUFBUDtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7dURBcUJtQztBQUNqQyxVQUFNLE1BQU0sS0FBSyxrQkFBakI7QUFDQSxXQUFLLGtCQUFMLEdBQTBCLElBQTFCOztBQUVBO0FBQ0EsV0FBSyxhQUFMLENBQW1CLG9CQUFuQixFQUF5QyxHQUF6QztBQUNBLGFBQU8sSUFBUDtBQUNEOztBQUdEOzs7Ozs7Ozs7Ozs7OztpQ0FXYSxJLEVBQU07QUFDakIsVUFBTSxrQkFBa0IsS0FBSyxPQUFMLENBQWEsS0FBSyxRQUFsQixDQUF4QjtBQUNBLGFBQU87QUFDTCxnQkFBUSxxQkFESDtBQUVMLGNBQU07QUFDSix3QkFBYyxLQUFLLFlBQUwsQ0FBa0IsR0FBbEIsQ0FBc0I7QUFBQSxtQkFBWSxTQUFTLEVBQXJCO0FBQUEsV0FBdEIsQ0FEVjtBQUVKLG9CQUFVLEtBQUssUUFGWDtBQUdKLG9CQUFVLGtCQUFrQixJQUFsQixHQUF5QixLQUFLLFFBSHBDO0FBSUosY0FBSSxLQUFLO0FBSkw7QUFGRCxPQUFQO0FBU0Q7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7O3dDQWNpQztBQUFBLFVBQWpCLE9BQWlCLFFBQWpCLE9BQWlCO0FBQUEsVUFBUixJQUFRLFFBQVIsSUFBUTs7QUFDL0IsVUFBSSxLQUFLLFdBQVQsRUFBc0I7QUFDdEIsVUFBSSxPQUFKLEVBQWE7QUFDWCxhQUFLLGNBQUwsQ0FBb0IsSUFBcEI7QUFDRCxPQUZELE1BRU8sSUFBSSxLQUFLLEVBQUwsS0FBWSxVQUFoQixFQUE0QjtBQUNqQyxhQUFLLG1CQUFMLENBQXlCLEtBQUssSUFBOUI7QUFDQSxhQUFLLGFBQUwsQ0FBbUIsb0JBQW5CLEVBQXlDO0FBQ3ZDLGtCQUFRLGFBQWE7QUFEa0IsU0FBekM7QUFHRCxPQUxNLE1BS0E7QUFDTCxhQUFLLE9BQUwsQ0FBYSwwQkFBYixFQUF5QyxFQUFFLE9BQU8sSUFBVCxFQUF6QztBQUNBLGFBQUssT0FBTDtBQUNEO0FBQ0Y7O0FBRUQ7Ozs7Ozs7Ozs7bUNBT2UsSSxFQUFNO0FBQ25CLFdBQUssbUJBQUwsQ0FBeUIsSUFBekI7QUFDQSxVQUFJLENBQUMsS0FBSyxRQUFWLEVBQW9CO0FBQ2xCLGFBQUssYUFBTCxDQUFtQixvQkFBbkIsRUFBeUM7QUFDdkMsa0JBQVEsYUFBYTtBQURrQixTQUF6QztBQUdELE9BSkQsTUFJTztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxhQUFLLGFBQUwsQ0FBbUIsb0JBQW5CLEVBQXlDO0FBQ3ZDLGtCQUFRLENBQUMsS0FBSyxXQUFOLEdBQW9CLGFBQWEsT0FBakMsR0FBMkMsYUFBYTtBQUR6QixTQUF6QztBQUdEO0FBQ0Y7O0FBRUQ7Ozs7Ozs7Ozs7Ozt3Q0FTb0IsWSxFQUFjO0FBQ2hDLFVBQU0sU0FBUyxLQUFLLFNBQUwsRUFBZjs7QUFFQTtBQUNBO0FBQ0EsV0FBSyxjQUFMLEdBQXVCLEtBQUssU0FBTCxLQUFtQixVQUFVLFVBQVYsQ0FBcUIsR0FBL0Q7O0FBRUEsV0FBSyxVQUFMOztBQUVBLFVBQU0sS0FBSyxLQUFLLEVBQWhCO0FBQ0EsV0FBSyxFQUFMLEdBQVUsYUFBYSxFQUF2Qjs7QUFFQTtBQUNBLFVBQUksT0FBTyxLQUFLLEVBQWhCLEVBQW9CO0FBQ2xCLGVBQU8scUJBQVAsQ0FBNkIsSUFBN0IsRUFBbUMsRUFBbkM7QUFDQSxhQUFLLGFBQUwsQ0FBbUIsc0JBQW5CLEVBQTJDO0FBQ3pDLG9CQUFVLEVBRCtCO0FBRXpDLG9CQUFVLEtBQUssRUFGMEI7QUFHekMsb0JBQVU7QUFIK0IsU0FBM0M7QUFLRDs7QUFFRCxXQUFLLEdBQUwsR0FBVyxhQUFhLEdBQXhCO0FBQ0EsV0FBSyxZQUFMLEdBQW9CLE9BQU8sY0FBUCxDQUFzQixhQUFhLFlBQW5DLENBQXBCO0FBQ0EsV0FBSyxRQUFMLEdBQWdCLGFBQWEsUUFBN0I7QUFDQSxXQUFLLFNBQUwsR0FBaUIsSUFBSSxJQUFKLENBQVMsYUFBYSxVQUF0QixDQUFqQjtBQUNBLFdBQUssUUFBTCxHQUFnQixhQUFhLFFBQTdCO0FBQ0EsV0FBSyxXQUFMLEdBQW1CLGFBQWEsb0JBQWhDO0FBQ0EsV0FBSyxvQkFBTCxHQUE0QixLQUFLLFlBQUwsQ0FBa0IsT0FBbEIsQ0FBMEIsT0FBTyxJQUFqQyxNQUEyQyxDQUFDLENBQXhFOztBQUVBLGFBQU8sZ0JBQVAsQ0FBd0IsSUFBeEI7O0FBRUEsVUFBSSxPQUFPLGFBQWEsWUFBcEIsS0FBcUMsUUFBekMsRUFBbUQ7QUFDakQsYUFBSyxXQUFMLEdBQW1CLE9BQU8sVUFBUCxDQUFrQixhQUFhLFlBQS9CLENBQW5CO0FBQ0QsT0FGRCxNQUVPLElBQUksYUFBYSxZQUFqQixFQUErQjtBQUNwQyxhQUFLLFdBQUwsR0FBbUIsT0FBTyxhQUFQLENBQXFCLGFBQWEsWUFBbEMsQ0FBbkI7QUFDRCxPQUZNLE1BRUE7QUFDTCxhQUFLLFdBQUwsR0FBbUIsSUFBbkI7QUFDRDs7QUFFRCxXQUFLLGNBQUwsR0FBc0IsS0FBdEI7QUFDRDs7QUFHRDs7Ozs7Ozs7Ozs7Ozs7Ozs7b0NBY2dCLFksRUFBYztBQUFBOztBQUM1QjtBQUNBLFVBQU0sU0FBUyxLQUFLLFNBQUwsRUFBZjtBQUNBLFVBQU0sYUFBYSxPQUFPLGNBQVAsQ0FBc0IsWUFBdEIsQ0FBbkI7QUFDQSxVQUFNLFNBQVMsV0FBVyxNQUFYLENBQWtCO0FBQUEsZUFBWSxPQUFLLFlBQUwsQ0FBa0IsT0FBbEIsQ0FBMEIsUUFBMUIsTUFBd0MsQ0FBQyxDQUFyRDtBQUFBLE9BQWxCLENBQWY7QUFDQSxXQUFLLGtCQUFMLENBQXdCLEVBQUUsS0FBSyxNQUFQLEVBQWUsUUFBUSxFQUF2QixFQUF4QjtBQUNBLGFBQU8sSUFBUDtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O3VDQWdCbUIsWSxFQUFjO0FBQy9CLFVBQU0sc0JBQXNCLEVBQTVCO0FBQ0EsV0FBSyxZQUFMLENBQWtCLE9BQWxCLENBQTBCO0FBQUEsZUFBZ0Isb0JBQW9CLFlBQVksRUFBaEMsSUFBc0MsSUFBdEQ7QUFBQSxPQUExQjtBQUNBLFVBQU0sU0FBUyxLQUFLLFNBQUwsRUFBZjtBQUNBLFVBQU0sYUFBYSxPQUFPLGNBQVAsQ0FBc0IsWUFBdEIsQ0FBbkI7O0FBRUEsVUFBTSxXQUFXLFdBQVcsTUFBWCxDQUFrQjtBQUFBLGVBQWUsb0JBQW9CLFlBQVksRUFBaEMsQ0FBZjtBQUFBLE9BQWxCLENBQWpCO0FBQ0EsVUFBSSxTQUFTLE1BQVQsS0FBb0IsQ0FBeEIsRUFBMkIsT0FBTyxJQUFQO0FBQzNCLFVBQUksU0FBUyxNQUFULEtBQW9CLEtBQUssWUFBTCxDQUFrQixNQUExQyxFQUFrRDtBQUNoRCxjQUFNLElBQUksS0FBSixDQUFVLFdBQVcsVUFBWCxDQUFzQix3QkFBaEMsQ0FBTjtBQUNEO0FBQ0QsV0FBSyxrQkFBTCxDQUF3QixFQUFFLEtBQUssRUFBUCxFQUFXLFFBQVEsUUFBbkIsRUFBeEI7QUFDQSxhQUFPLElBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7d0NBY29CLFksRUFBYztBQUNoQyxVQUFJLENBQUMsWUFBRCxJQUFpQixDQUFDLGFBQWEsTUFBbkMsRUFBMkM7QUFDekMsY0FBTSxJQUFJLEtBQUosQ0FBVSxXQUFXLFVBQVgsQ0FBc0Isd0JBQWhDLENBQU47QUFDRDs7QUFFRCxVQUFNLFNBQVMsS0FBSyxTQUFMLEVBQWY7QUFDQSxVQUFNLGFBQWEsT0FBTyxjQUFQLENBQXNCLFlBQXRCLENBQW5COztBQUVBLFVBQU0sU0FBUyxLQUFLLHFCQUFMLENBQTJCLFVBQTNCLEVBQXVDLEtBQUssWUFBNUMsQ0FBZjtBQUNBLFdBQUssa0JBQUwsQ0FBd0IsTUFBeEI7QUFDQSxhQUFPLElBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozt1Q0FnQm1CLE0sRUFBUTtBQUFBOztBQUN6QixXQUFLLHVCQUFMLENBQTZCLE1BQTdCO0FBQ0EsV0FBSyxvQkFBTCxHQUE0QixLQUFLLFlBQUwsQ0FBa0IsT0FBbEIsQ0FBMEIsS0FBSyxTQUFMLEdBQWlCLElBQTNDLE1BQXFELENBQUMsQ0FBbEY7O0FBRUEsVUFBTSxNQUFNLEVBQVo7QUFDQSxhQUFPLE1BQVAsQ0FBYyxPQUFkLENBQXNCLHVCQUFlO0FBQ25DLFlBQUksSUFBSixDQUFTO0FBQ1AscUJBQVcsUUFESjtBQUVQLG9CQUFVLGNBRkg7QUFHUCxjQUFJLFlBQVk7QUFIVCxTQUFUO0FBS0QsT0FORDs7QUFRQSxhQUFPLEdBQVAsQ0FBVyxPQUFYLENBQW1CLHVCQUFlO0FBQ2hDLFlBQUksSUFBSixDQUFTO0FBQ1AscUJBQVcsS0FESjtBQUVQLG9CQUFVLGNBRkg7QUFHUCxjQUFJLFlBQVk7QUFIVCxTQUFUO0FBS0QsT0FORDs7QUFRQSxXQUFLLElBQUwsQ0FBVTtBQUNSLGFBQUssRUFERztBQUVSLGdCQUFRLE9BRkE7QUFHUixjQUFNLEtBQUssU0FBTCxDQUFlLEdBQWYsQ0FIRTtBQUlSLGlCQUFTO0FBQ1AsMEJBQWdCO0FBRFQ7QUFKRCxPQUFWLEVBT0csa0JBQVU7QUFDWCxZQUFJLENBQUMsT0FBTyxPQUFaLEVBQXFCLE9BQUssS0FBTDtBQUN0QixPQVREO0FBVUQ7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs0Q0FZd0IsTSxFQUFRO0FBQzlCLFVBQU0sZUFBZSxHQUFHLE1BQUgsQ0FBVSxLQUFLLFlBQWYsQ0FBckI7QUFDQSxhQUFPLEdBQVAsQ0FBVyxPQUFYLENBQW1CLHVCQUFlO0FBQ2hDLFlBQUksYUFBYSxPQUFiLENBQXFCLFdBQXJCLE1BQXNDLENBQUMsQ0FBM0MsRUFBOEMsYUFBYSxJQUFiLENBQWtCLFdBQWxCO0FBQy9DLE9BRkQ7QUFHQSxhQUFPLE1BQVAsQ0FBYyxPQUFkLENBQXNCLHVCQUFlO0FBQ25DLFlBQU0sUUFBUSxhQUFhLE9BQWIsQ0FBcUIsV0FBckIsQ0FBZDtBQUNBLFlBQUksVUFBVSxDQUFDLENBQWYsRUFBa0IsYUFBYSxNQUFiLENBQW9CLEtBQXBCLEVBQTJCLENBQTNCO0FBQ25CLE9BSEQ7QUFJQSxXQUFLLFlBQUwsR0FBb0IsWUFBcEI7QUFDRDs7QUFFRDs7Ozs7Ozs7NEJBS1E7QUFDTixVQUFJLEtBQUssV0FBVCxFQUFzQixNQUFNLElBQUksS0FBSixDQUFVLFdBQVcsVUFBWCxDQUFzQixXQUFoQyxDQUFOO0FBQ3RCLFdBQUssT0FBTCxXQUFxQixVQUFVLGFBQVYsQ0FBd0IsVUFBN0M7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7NEJBMEJPLEksRUFBTTtBQUNYLFVBQUksS0FBSyxXQUFULEVBQXNCLE1BQU0sSUFBSSxLQUFKLENBQVUsV0FBVyxVQUFYLENBQXNCLFdBQWhDLENBQU47O0FBRXRCLFVBQUksaUJBQUo7QUFDQSxjQUFRLElBQVI7QUFDRSxhQUFLLFVBQVUsYUFBVixDQUF3QixHQUE3QjtBQUNBLGFBQUssSUFBTDtBQUNFLCtCQUFtQixVQUFVLGFBQVYsQ0FBd0IsR0FBM0M7QUFDQTtBQUNGLGFBQUssVUFBVSxhQUFWLENBQXdCLFVBQTdCO0FBQ0UsK0JBQW1CLFVBQVUsYUFBVixDQUF3QixVQUEzQztBQUNBO0FBQ0Y7QUFDRSxnQkFBTSxJQUFJLEtBQUosQ0FBVSxXQUFXLFVBQVgsQ0FBc0IsdUJBQWhDLENBQU47QUFUSjs7QUFZQSxXQUFLLE9BQUwsQ0FBYSxRQUFiO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7NEJBVVEsUSxFQUFVO0FBQ2hCLFVBQU0sS0FBSyxLQUFLLEVBQWhCO0FBQ0EsVUFBTSxTQUFTLEtBQUssU0FBTCxFQUFmO0FBQ0EsV0FBSyxJQUFMLENBQVU7QUFDUixnQkFBUSxRQURBO0FBRVIsYUFBSyxNQUFNO0FBRkgsT0FBVixFQUdHLGtCQUFVO0FBQ1gsWUFBSSxDQUFDLE9BQU8sT0FBUixLQUFvQixDQUFDLE9BQU8sSUFBUixJQUFnQixPQUFPLElBQVAsQ0FBWSxFQUFaLEtBQW1CLFdBQXZELENBQUosRUFBeUUsYUFBYSxJQUFiLENBQWtCLEVBQWxCLEVBQXNCLE1BQXRCO0FBQzFFLE9BTEQ7O0FBT0EsV0FBSyxRQUFMO0FBQ0EsV0FBSyxPQUFMO0FBQ0Q7OzsyQ0FFc0IsSSxFQUFNO0FBQzNCLFVBQUksS0FBSyxJQUFMLEtBQWMsVUFBVSxhQUFWLENBQXdCLFVBQXRDLElBQW9ELEtBQUssYUFBN0QsRUFBNEU7QUFDMUUsYUFBSyxTQUFMLEdBQWlCLHdCQUFqQixDQUEwQyxLQUFLLEVBQS9DLEVBQW1ELEtBQUssYUFBeEQ7QUFDRCxPQUZELE1BRU87QUFDTDtBQUNEO0FBQ0Y7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztvQ0FxQjRCO0FBQUEsVUFBZCxPQUFjLHlEQUFKLEVBQUk7O0FBQzFCLFVBQU0sZ0JBQWlCLE9BQU8sT0FBUCxLQUFtQixRQUFwQixHQUFnQztBQUNwRCxlQUFPLENBQUMsRUFBRSxNQUFNLE9BQVIsRUFBaUIsVUFBVSxZQUEzQixFQUFEO0FBRDZDLE9BQWhDLEdBRWxCLE9BRko7QUFHQSxvQkFBYyxRQUFkLEdBQXlCLEtBQUssUUFBOUI7QUFDQSxvQkFBYyxjQUFkLEdBQStCLEtBQUssRUFBcEM7O0FBRUEsYUFBTyxJQUFJLE9BQUosQ0FBWSxhQUFaLENBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7c0NBV2tCLFEsRUFBVSxRLEVBQVUsSyxFQUFPO0FBQUE7O0FBQzNDO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsV0FBSyxjQUFMLEdBQXNCLEtBQXRCO0FBQ0EsVUFBSTtBQUNGLFlBQU0sU0FBUyxLQUFLLGNBQXBCO0FBQ0EsYUFBSyxjQUFMLEdBQXNCLEtBQXRCO0FBQ0EsWUFBSSxNQUFNLENBQU4sRUFBUyxPQUFULENBQWlCLFVBQWpCLE1BQWlDLENBQXJDLEVBQXdDO0FBQ3RDLGVBQUssZ0JBQUwsQ0FBc0IsUUFBdEIsRUFBZ0MsUUFBaEMsRUFBMEMsS0FBMUM7QUFDRCxTQUZELE1BRU8sSUFBSSxNQUFNLENBQU4sTUFBYSxjQUFqQixFQUFpQztBQUFBO0FBQ3RDLGdCQUFNLFNBQVMsT0FBSyxTQUFMLEVBQWY7QUFDQTtBQUNBLHVCQUFXLFNBQVMsR0FBVCxDQUFhO0FBQUEscUJBQVksT0FBTyxXQUFQLENBQW1CLFNBQVMsRUFBNUIsQ0FBWjtBQUFBLGFBQWIsQ0FBWDtBQUNBLHVCQUFXLFNBQVMsR0FBVCxDQUFhO0FBQUEscUJBQVksT0FBTyxXQUFQLENBQW1CLFNBQVMsRUFBNUIsQ0FBWjtBQUFBLGFBQWIsQ0FBWDtBQUNBLG1CQUFLLG9CQUFMLENBQTBCLFFBQTFCLEVBQW9DLFFBQXBDO0FBTHNDO0FBTXZDO0FBQ0QsYUFBSyxjQUFMLEdBQXNCLE1BQXRCO0FBQ0QsT0FiRCxDQWFFLE9BQU8sR0FBUCxFQUFZO0FBQ1o7QUFDRDtBQUNELFdBQUssY0FBTCxHQUFzQixJQUF0QjtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7OzBDQVVzQixRLEVBQVUsUSxFQUFVO0FBQ3hDLFVBQU0sU0FBUyxFQUFmO0FBQ0EsYUFBTyxHQUFQLEdBQWEsU0FBUyxNQUFULENBQWdCO0FBQUEsZUFBZSxTQUFTLE9BQVQsQ0FBaUIsV0FBakIsTUFBa0MsQ0FBQyxDQUFsRDtBQUFBLE9BQWhCLENBQWI7QUFDQSxhQUFPLE1BQVAsR0FBZ0IsU0FBUyxNQUFULENBQWdCO0FBQUEsZUFBZSxTQUFTLE9BQVQsQ0FBaUIsV0FBakIsTUFBa0MsQ0FBQyxDQUFsRDtBQUFBLE9BQWhCLENBQWhCO0FBQ0EsYUFBTyxNQUFQO0FBQ0Q7O0FBSUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzswQ0FtRHNCLEssRUFBTztBQUFBOztBQUMzQixVQUFNLHVCQUF1QixFQUE3QjtBQUNBLGFBQU8sSUFBUCxDQUFZLEtBQVosRUFBbUIsT0FBbkIsQ0FBMkIsZ0JBQVE7QUFDakMsWUFBSSxXQUFXLElBQWY7QUFDQSxZQUFJLElBQUosRUFBVTtBQUNSLGNBQUksU0FBUyxVQUFULElBQXVCLEtBQUssT0FBTCxDQUFhLFdBQWIsTUFBOEIsQ0FBekQsRUFBNEQ7QUFDMUQsdUJBQVcsY0FBYyxJQUF6QjtBQUNEO0FBQ0QsK0JBQXFCLElBQXJCLENBQTBCO0FBQ3hCLHVCQUFXLEtBRGE7QUFFeEIsc0JBQVUsUUFGYztBQUd4QixtQkFBTyxNQUFNLElBQU47QUFIaUIsV0FBMUI7QUFLRDtBQUNGLE9BWkQ7O0FBY0EsV0FBSyxjQUFMLEdBQXNCLElBQXRCOztBQUVBO0FBQ0E7QUFDQSxXQUFLLFVBQUwsQ0FBZ0I7QUFDZCxnQkFBUSxJQURNO0FBRWQsY0FBTSxjQUZRO0FBR2Qsb0JBQVksb0JBSEU7QUFJZCxnQkFBUSxLQUFLLFNBQUw7QUFKTSxPQUFoQjtBQU1BLFdBQUssY0FBTCxHQUFzQixLQUF0Qjs7QUFFQSxXQUFLLElBQUwsQ0FBVTtBQUNSLGFBQUssRUFERztBQUVSLGdCQUFRLE9BRkE7QUFHUixjQUFNLEtBQUssU0FBTCxDQUFlLG9CQUFmLENBSEU7QUFJUixpQkFBUztBQUNQLDBCQUFnQjtBQURUO0FBSkQsT0FBVixFQU9HLGtCQUFVO0FBQ1gsWUFBSSxDQUFDLE9BQU8sT0FBUixJQUFtQixDQUFDLE9BQUssV0FBN0IsRUFBMEMsT0FBSyxLQUFMO0FBQzNDLE9BVEQ7O0FBV0EsYUFBTyxJQUFQO0FBQ0Q7O0FBR0Q7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs2Q0F3QnlCLEssRUFBTztBQUFBOztBQUM5QixVQUFNLHVCQUF1QixFQUE3QjtBQUNBLFlBQU0sT0FBTixDQUFjLG9CQUFZO0FBQ3hCLFlBQUksYUFBYSxVQUFiLElBQTJCLFNBQVMsT0FBVCxDQUFpQixXQUFqQixNQUFrQyxDQUFqRSxFQUFvRTtBQUNsRSxxQkFBVyxjQUFjLFFBQXpCO0FBQ0Q7QUFDRCw2QkFBcUIsSUFBckIsQ0FBMEI7QUFDeEIscUJBQVcsUUFEYTtBQUV4QjtBQUZ3QixTQUExQjtBQUlELE9BUkQsRUFRRyxJQVJIOztBQVVBLFdBQUssY0FBTCxHQUFzQixJQUF0Qjs7QUFFQTtBQUNBO0FBQ0EsV0FBSyxVQUFMLENBQWdCO0FBQ2QsZ0JBQVEsSUFETTtBQUVkLGNBQU0sY0FGUTtBQUdkLG9CQUFZLG9CQUhFO0FBSWQsZ0JBQVEsS0FBSyxTQUFMO0FBSk0sT0FBaEI7QUFNQSxXQUFLLGNBQUwsR0FBc0IsS0FBdEI7O0FBRUEsV0FBSyxJQUFMLENBQVU7QUFDUixhQUFLLEVBREc7QUFFUixnQkFBUSxPQUZBO0FBR1IsY0FBTSxLQUFLLFNBQUwsQ0FBZSxvQkFBZixDQUhFO0FBSVIsaUJBQVM7QUFDUCwwQkFBZ0I7QUFEVDtBQUpELE9BQVYsRUFPRyxrQkFBVTtBQUNYLFlBQUksQ0FBQyxPQUFPLE9BQVosRUFBcUIsT0FBSyxLQUFMO0FBQ3RCLE9BVEQ7O0FBV0EsYUFBTyxJQUFQO0FBQ0Q7Ozs0QkFFTyxHLEVBQUs7QUFDWCxhQUFPLEtBQUssR0FBTCxJQUFZLE9BQU8sRUFBbkIsQ0FBUDtBQUNEOzs7NEJBRU8sSSxFQUFNO0FBQ1osV0FBSyxTQUFMLEdBQWlCLGdCQUFqQixDQUFrQyxJQUFsQztBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozt1QkFvQkcsSSxFQUFNLFEsRUFBVSxPLEVBQVM7QUFDMUIsVUFBTSxlQUFlLFNBQVMsc0JBQVQsSUFDbkIsUUFBUSxRQUFPLElBQVAseUNBQU8sSUFBUCxPQUFnQixRQUF4QixJQUFvQyxLQUFLLHNCQUFMLENBRHRDOztBQUdBLFVBQUksZ0JBQWdCLENBQUMsS0FBSyxTQUExQixFQUFxQztBQUFBO0FBQ25DLGNBQU0sVUFBVSxTQUFTLHNCQUFULEdBQWtDLFFBQWxDLEdBQTZDLEtBQUssc0JBQUwsQ0FBN0Q7QUFDQSxlQUFLLEtBQUwsQ0FBVztBQUFBLG1CQUFNLFFBQVEsS0FBUixDQUFjLE9BQWQsQ0FBTjtBQUFBLFdBQVg7QUFGbUM7QUFHcEM7QUFDRCxpRkFBUyxJQUFULEVBQWUsUUFBZixFQUF5QixPQUF6Qjs7QUFFQSxhQUFPLElBQVA7QUFDRDs7QUFFRDs7Ozs7O3dDQUdvQixRLEVBQVU7QUFDNUIsVUFBSSxXQUFXLENBQWYsRUFBa0IsT0FBTyxDQUFQO0FBQ25COztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozt3Q0FpQm9CLFEsRUFBVSxRLEVBQVU7QUFBQTs7QUFDdEMsVUFBSSxLQUFLLGNBQVQsRUFBeUI7QUFDdkIsWUFBSSxLQUFLLGVBQUwsS0FBeUIsU0FBN0IsRUFBd0MsS0FBSyxlQUFMLEdBQXVCLFFBQXZCO0FBQ3hDLFlBQUksS0FBSyx5QkFBVCxFQUFvQyxhQUFhLEtBQUsseUJBQWxCO0FBQ3BDLGFBQUsseUJBQUwsR0FBaUMsV0FBVztBQUFBLGlCQUFNLE9BQUssdUJBQUwsRUFBTjtBQUFBLFNBQVgsRUFBaUQsSUFBakQsQ0FBakM7QUFDRCxPQUpELE1BSU87QUFDTCxhQUFLLHVCQUFMO0FBQ0Q7QUFDRjs7QUFFRDs7Ozs7Ozs7OzhDQU0wQjtBQUN4QixVQUFJLEtBQUssV0FBVCxFQUFzQjtBQUN0QixVQUFNLFdBQVcsS0FBSyxlQUF0QjtBQUNBLFVBQU0sV0FBVyxLQUFLLGFBQXRCO0FBQ0EsV0FBSyxlQUFMLEdBQXVCLFNBQXZCOztBQUVBLFVBQUksYUFBYSxRQUFqQixFQUEyQjtBQUMzQixXQUFLLGFBQUwsQ0FBbUIsc0JBQW5CLEVBQTJDO0FBQ3pDLDBCQUR5QztBQUV6QywwQkFGeUM7QUFHekMsa0JBQVU7QUFIK0IsT0FBM0M7QUFLRDs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7O3dDQVlvQixRLEVBQVUsUSxFQUFVO0FBQ3RDLFVBQUksWUFBWSxRQUFaLElBQXdCLFNBQVMsRUFBVCxLQUFnQixTQUFTLEVBQXJELEVBQXlEO0FBQ3pELFdBQUssYUFBTCxDQUFtQixzQkFBbkIsRUFBMkM7QUFDekMsa0JBQVUsYUFEK0I7QUFFekMsMEJBRnlDO0FBR3pDO0FBSHlDLE9BQTNDO0FBS0Q7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozt5Q0FZcUIsUSxFQUFVLFEsRUFBVTtBQUN2QyxVQUFJLEtBQUssY0FBVCxFQUF5QjtBQUN6QixVQUFNLFNBQVMsS0FBSyxxQkFBTCxDQUEyQixRQUEzQixFQUFxQyxRQUFyQyxDQUFmO0FBQ0EsVUFBSSxPQUFPLEdBQVAsQ0FBVyxNQUFYLElBQXFCLE9BQU8sTUFBUCxDQUFjLE1BQXZDLEVBQStDO0FBQzdDLGVBQU8sUUFBUCxHQUFrQixjQUFsQjtBQUNBLGVBQU8sUUFBUCxHQUFrQixRQUFsQjtBQUNBLGVBQU8sUUFBUCxHQUFrQixRQUFsQjtBQUNBLGFBQUssYUFBTCxDQUFtQixzQkFBbkIsRUFBMkMsTUFBM0M7QUFDRDtBQUNGOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7cUNBWWlCLFEsRUFBVSxRLEVBQVUsSyxFQUFPO0FBQzFDLFVBQUksS0FBSyxjQUFULEVBQXlCO0FBQ3pCLFVBQUksS0FBSyxTQUFMLENBQWUsUUFBZixNQUE2QixLQUFLLFNBQUwsQ0FBZSxRQUFmLENBQWpDLEVBQTJEO0FBQ3pELGFBQUssYUFBTCxDQUFtQixzQkFBbkIsRUFBMkM7QUFDekMsb0JBQVUsVUFEK0I7QUFFekMsNEJBRnlDO0FBR3pDLDRCQUh5QztBQUl6QztBQUp5QyxTQUEzQztBQU1EO0FBQ0Y7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7K0JBVVc7QUFDVCxVQUFJLENBQUMsS0FBSyxTQUFWLEVBQXFCO0FBQ25CLGFBQUssU0FBTDtBQUNBLGFBQUssU0FBTCxDQUFlLFFBQWYsR0FBMEIsS0FBSyxLQUFMLENBQVcsS0FBSyxRQUFoQixDQUExQjtBQUNEO0FBQ0QsYUFBTyxLQUFLLFNBQVo7QUFDRDs7O2tDQUVhLE8sRUFBUyxJLEVBQU07QUFDM0IsV0FBSyxZQUFMO0FBQ0EsNEZBQW9CLE9BQXBCLEVBQTZCLElBQTdCO0FBQ0Q7Ozs0QkFFTyxPLEVBQVMsSSxFQUFNO0FBQ3JCLFdBQUssWUFBTDtBQUNBLHNGQUFjLE9BQWQsRUFBdUIsSUFBdkI7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7OztzQ0FheUIsWSxFQUFjLE0sRUFBUTtBQUM3QyxhQUFPLElBQUksWUFBSixDQUFpQjtBQUN0QixzQkFEc0I7QUFFdEIsb0JBQVksWUFGVTtBQUd0QixpQkFBUyxhQUFhO0FBSEEsT0FBakIsQ0FBUDtBQUtEOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzJCQStCYyxPLEVBQVM7QUFDckIsVUFBSSxDQUFDLFFBQVEsTUFBYixFQUFxQixNQUFNLElBQUksS0FBSixDQUFVLFdBQVcsVUFBWCxDQUFzQixhQUFoQyxDQUFOO0FBQ3JCLFVBQU0sYUFBYTtBQUNqQixrQkFBVSxRQUFRLFFBREQ7QUFFakIsc0JBQWMsUUFBUSxNQUFSLENBQWUsY0FBZixDQUE4QixRQUFRLFlBQXRDLENBRkc7QUFHakIsa0JBQVUsUUFBUSxRQUhEO0FBSWpCLGdCQUFRLFFBQVE7QUFKQyxPQUFuQjtBQU1BLFVBQUksV0FBVyxRQUFmLEVBQXlCO0FBQ3ZCLFlBQU0sT0FBTyxLQUFLLGVBQUwsQ0FBcUIsVUFBckIsQ0FBYjtBQUNBLFlBQUksSUFBSixFQUFVLE9BQU8sSUFBUDtBQUNYO0FBQ0QsYUFBTyxJQUFJLFlBQUosQ0FBaUIsVUFBakIsQ0FBUDtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7b0NBZXVCLE8sRUFBUztBQUM5QixVQUFJLFFBQVEsWUFBUixDQUFxQixPQUFyQixDQUE2QixRQUFRLE1BQVIsQ0FBZSxJQUE1QyxNQUFzRCxDQUFDLENBQTNELEVBQThEO0FBQzVELGdCQUFRLFlBQVIsQ0FBcUIsSUFBckIsQ0FBMEIsUUFBUSxNQUFSLENBQWUsSUFBekM7QUFDRDs7QUFFRCxVQUFNLG1CQUFtQixFQUF6QjtBQUNBLGNBQVEsWUFBUixDQUFxQixPQUFyQixDQUE2QixVQUFDLFdBQUQsRUFBaUI7QUFDNUMseUJBQWlCLFlBQVksRUFBN0IsSUFBbUMsV0FBbkM7QUFDRCxPQUZEOztBQUlBLFVBQU0sT0FBTyxRQUFRLE1BQVIsQ0FBZSxzQkFBZixDQUFzQyxpQkFBUztBQUMxRCxZQUFJLE1BQU0sUUFBTixJQUFrQixNQUFNLFlBQU4sQ0FBbUIsTUFBbkIsS0FBOEIsUUFBUSxZQUFSLENBQXFCLE1BQXpFLEVBQWlGO0FBQy9FLGVBQUssSUFBSSxRQUFRLENBQWpCLEVBQW9CLFFBQVEsTUFBTSxZQUFOLENBQW1CLE1BQS9DLEVBQXVELE9BQXZELEVBQWdFO0FBQzlELGdCQUFJLENBQUMsaUJBQWlCLE1BQU0sWUFBTixDQUFtQixLQUFuQixFQUEwQixFQUEzQyxDQUFMLEVBQXFELE9BQU8sS0FBUDtBQUN0RDtBQUNELGlCQUFPLElBQVA7QUFDRDtBQUNGLE9BUFksQ0FBYjs7QUFTQSxVQUFJLElBQUosRUFBVTtBQUNSLGFBQUssa0JBQUwsR0FBMEIsSUFBSSxVQUFKLENBQWU7QUFDdkMsa0JBQVEsSUFEK0I7QUFFdkMsa0JBQVEsQ0FBQyxRQUFRLFFBQVQsSUFBcUIsS0FBSyxlQUFMLENBQXFCLFFBQVEsUUFBN0IsRUFBdUMsS0FBSyxRQUE1QyxDQUFyQixHQUNOLGFBQWEsS0FEUCxHQUNlLGFBQWE7QUFIRyxTQUFmLEVBSXZCLG9CQUp1QixDQUExQjtBQUtBLGVBQU8sSUFBUDtBQUNEO0FBQ0Y7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7OzBDQVc2QixTLEVBQVc7QUFDdEMsYUFBTyxJQUFQO0FBQ0Q7Ozs7RUFwbUN3QixROztBQXVtQzNCOzs7Ozs7Ozs7OztBQVNBLGFBQWEsU0FBYixDQUF1QixZQUF2QixHQUFzQyxJQUF0Qzs7QUFFQTs7Ozs7QUFLQSxhQUFhLFNBQWIsQ0FBdUIsU0FBdkIsR0FBbUMsSUFBbkM7O0FBRUE7Ozs7O0FBS0EsYUFBYSxTQUFiLENBQXVCLFdBQXZCLEdBQXFDLENBQXJDOztBQUVBOzs7Ozs7Ozs7QUFTQSxhQUFhLFNBQWIsQ0FBdUIsUUFBdkIsR0FBa0MsSUFBbEM7O0FBRUE7Ozs7Ozs7QUFPQSxhQUFhLFNBQWIsQ0FBdUIsUUFBdkIsR0FBa0MsSUFBbEM7O0FBR0E7Ozs7Ozs7Ozs7Ozs7O0FBY0EsYUFBYSxTQUFiLENBQXVCLG9CQUF2QixHQUE4QyxJQUE5Qzs7QUFFQTs7Ozs7O0FBTUEsYUFBYSxTQUFiLENBQXVCLFdBQXZCLEdBQXFDLElBQXJDOztBQUVBOzs7OztBQUtBLGFBQWEsU0FBYixDQUF1QixTQUF2QixHQUFtQyxJQUFuQzs7QUFFQSxhQUFhLFdBQWIsR0FBMkIsZUFBM0I7O0FBRUE7Ozs7Ozs7Ozs7O0FBV0EsYUFBYSxTQUFiLENBQXVCLGtCQUF2QixHQUE0QyxJQUE1Qzs7QUFFQTs7Ozs7O0FBTUEsYUFBYSxVQUFiLEdBQTBCLHlCQUExQjs7QUFFQTs7Ozs7O0FBTUEsYUFBYSxpQkFBYixHQUFpQyxXQUFqQzs7QUFFQTs7Ozs7OztBQU9BLGFBQWEsT0FBYixHQUF1QixTQUF2Qjs7QUFFQTs7Ozs7Ozs7O0FBU0EsYUFBYSxLQUFiLEdBQXFCLE9BQXJCOztBQUVBOzs7Ozs7Ozs7OztBQVdBLGFBQWEsZ0NBQWIsR0FBZ0QsZUFBaEQ7O0FBRUEsYUFBYSxnQkFBYixHQUFnQzs7QUFJOUI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFtQkEsb0JBdkI4Qjs7QUF5QjlCOzs7Ozs7QUFNQSwwQkEvQjhCOztBQWlDOUI7Ozs7Ozs7O0FBUUEsc0JBekM4Qjs7QUEyQzlCOzs7Ozs7OztBQVFBLDRCQW5EOEI7O0FBcUQ5Qjs7Ozs7Ozs7QUFRQSxzQkE3RDhCOztBQStEOUI7Ozs7Ozs7Ozs7O0FBV0Esc0JBMUU4QixFQTBFTixNQTFFTSxDQTBFQyxTQUFTLGdCQTFFVixDQUFoQzs7QUE0RUEsS0FBSyxTQUFMLENBQWUsS0FBZixDQUFxQixZQUFyQixFQUFtQyxDQUFDLFlBQUQsRUFBZSxjQUFmLENBQW5DO0FBQ0EsU0FBUyxVQUFULENBQW9CLElBQXBCLENBQXlCLFlBQXpCO0FBQ0EsT0FBTyxPQUFQLEdBQWlCLFlBQWpCIiwiZmlsZSI6ImNvbnZlcnNhdGlvbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQSBDb252ZXJzYXRpb24gb2JqZWN0IHJlcHJlc2VudHMgYSBkaWFsb2cgYW1vbmdzdCBhIHNldFxuICogb2YgcGFydGljaXBhbnRzLlxuICpcbiAqIENyZWF0ZSBhIENvbnZlcnNhdGlvbiB1c2luZyB0aGUgY2xpZW50OlxuICpcbiAqICAgICAgdmFyIGNvbnZlcnNhdGlvbiA9IGNsaWVudC5jcmVhdGVDb252ZXJzYXRpb24oe1xuICogICAgICAgICAgcGFydGljaXBhbnRzOiBbJ2EnLCdiJ10sXG4gKiAgICAgICAgICBkaXN0aW5jdDogdHJ1ZVxuICogICAgICB9KTtcbiAqXG4gKiBOT1RFOiAgIERvIG5vdCBjcmVhdGUgYSBjb252ZXJzYXRpb24gd2l0aCBuZXcgbGF5ZXIuQ29udmVyc2F0aW9uKC4uLiksXG4gKiAgICAgICAgIFRoaXMgd2lsbCBmYWlsIHRvIGhhbmRsZSB0aGUgZGlzdGluY3QgcHJvcGVydHkgc2hvcnQgb2YgZ29pbmcgdG8gdGhlIHNlcnZlciBmb3IgZXZhbHVhdGlvbi5cbiAqXG4gKiBOT1RFOiAgIENyZWF0aW5nIGEgQ29udmVyc2F0aW9uIGlzIGEgbG9jYWwgYWN0aW9uLiAgQSBDb252ZXJzYXRpb24gd2lsbCBub3QgYmVcbiAqICAgICAgICAgc2VudCB0byB0aGUgc2VydmVyIHVudGlsIGVpdGhlcjpcbiAqXG4gKiAxLiBBIG1lc3NhZ2UgaXMgc2VudCBvbiB0aGF0IENvbnZlcnNhdGlvblxuICogMi4gYENvbnZlcnNhdGlvbi5zZW5kKClgIGlzIGNhbGxlZCAobm90IHJlY29tbWVuZGVkIGFzIG1vYmlsZSBjbGllbnRzXG4gKiAgICBleHBlY3QgYXQgbGVhc3Qgb25lIGxheWVyLk1lc3NhZ2UgaW4gYSBDb252ZXJzYXRpb24pXG4gKlxuICogS2V5IG1ldGhvZHMsIGV2ZW50cyBhbmQgcHJvcGVydGllcyBmb3IgZ2V0dGluZyBzdGFydGVkOlxuICpcbiAqIFByb3BlcnRpZXM6XG4gKlxuICogKiBsYXllci5Db252ZXJzYXRpb24uaWQ6IHRoaXMgcHJvcGVydHkgaXMgd29ydGggYmVpbmcgZmFtaWxpYXIgd2l0aDsgaXQgaWRlbnRpZmllcyB0aGVcbiAqICAgQ29udmVyc2F0aW9uIGFuZCBjYW4gYmUgdXNlZCBpbiBgY2xpZW50LmdldENvbnZlcnNhdGlvbihpZClgIHRvIHJldHJpZXZlIGl0LlxuICogKiBsYXllci5Db252ZXJzYXRpb24ubGFzdE1lc3NhZ2U6IFRoaXMgcHJvcGVydHkgbWFrZXMgaXQgZWFzeSB0byBzaG93IGluZm8gYWJvdXQgdGhlIG1vc3QgcmVjZW50IE1lc3NhZ2VcbiAqICAgIHdoZW4gcmVuZGVyaW5nIGEgbGlzdCBvZiBDb252ZXJzYXRpb25zLlxuICogKiBsYXllci5Db252ZXJzYXRpb24ubWV0YWRhdGE6IEN1c3RvbSBkYXRhIGZvciB5b3VyIENvbnZlcnNhdGlvbjsgY29tbW9ubHkgdXNlZCB0byBzdG9yZSBhICd0aXRsZScgcHJvcGVydHlcbiAqICAgIHRvIG5hbWUgeW91ciBDb252ZXJzYXRpb24uXG4gKlxuICogTWV0aG9kczpcbiAqXG4gKiAqIGxheWVyLkNvbnZlcnNhdGlvbi5hZGRQYXJ0aWNpcGFudHMgYW5kIGxheWVyLkNvbnZlcnNhdGlvbi5yZW1vdmVQYXJ0aWNpcGFudHM6IENoYW5nZSB0aGUgcGFydGljaXBhbnRzIG9mIHRoZSBDb252ZXJzYXRpb25cbiAqICogbGF5ZXIuQ29udmVyc2F0aW9uLnNldE1ldGFkYXRhUHJvcGVydGllczogU2V0IG1ldGFkYXRhLnRpdGxlIHRvICdNeSBDb252ZXJzYXRpb24gd2l0aCBMYXllciBTdXBwb3J0JyAodWggb2gpXG4gKiAqIGxheWVyLkNvbnZlcnNhdGlvbi5vbigpIGFuZCBsYXllci5Db252ZXJzYXRpb24ub2ZmKCk6IGV2ZW50IGxpc3RlbmVycyBidWlsdCBvbiB0b3Agb2YgdGhlIGBiYWNrYm9uZS1ldmVudHMtc3RhbmRhbG9uZWAgbnBtIHByb2plY3RcbiAqICogbGF5ZXIuQ29udmVyc2F0aW9uLmxlYXZlKCkgdG8gbGVhdmUgdGhlIENvbnZlcnNhdGlvblxuICogKiBsYXllci5Db252ZXJzYXRpb24uZGVsZXRlKCkgdG8gZGVsZXRlIHRoZSBDb252ZXJzYXRpb24gZm9yIGFsbCB1c2VycyAob3IgZm9yIGp1c3QgdGhpcyB1c2VyKVxuICpcbiAqIEV2ZW50czpcbiAqXG4gKiAqIGBjb252ZXJzYXRpb25zOmNoYW5nZWA6IFVzZWZ1bCBmb3Igb2JzZXJ2aW5nIGNoYW5nZXMgdG8gcGFydGljaXBhbnRzIGFuZCBtZXRhZGF0YVxuICogICBhbmQgdXBkYXRpbmcgcmVuZGVyaW5nIG9mIHlvdXIgb3BlbiBDb252ZXJzYXRpb25cbiAqXG4gKiBGaW5hbGx5LCB0byBhY2Nlc3MgYSBsaXN0IG9mIE1lc3NhZ2VzIGluIGEgQ29udmVyc2F0aW9uLCBzZWUgbGF5ZXIuUXVlcnkuXG4gKlxuICogQGNsYXNzICBsYXllci5Db252ZXJzYXRpb25cbiAqIEBleHRlbmRzIGxheWVyLlN5bmNhYmxlXG4gKiBAYXV0aG9yICBNaWNoYWVsIEthbnRvclxuICovXG5cbmNvbnN0IFN5bmNhYmxlID0gcmVxdWlyZSgnLi9zeW5jYWJsZScpO1xuY29uc3QgTWVzc2FnZSA9IHJlcXVpcmUoJy4vbWVzc2FnZScpO1xuY29uc3QgTGF5ZXJFcnJvciA9IHJlcXVpcmUoJy4vbGF5ZXItZXJyb3InKTtcbmNvbnN0IFV0aWwgPSByZXF1aXJlKCcuL2NsaWVudC11dGlscycpO1xuY29uc3QgQ29uc3RhbnRzID0gcmVxdWlyZSgnLi9jb25zdCcpO1xuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4vcm9vdCcpO1xuY29uc3QgTGF5ZXJFdmVudCA9IHJlcXVpcmUoJy4vbGF5ZXItZXZlbnQnKTtcblxuY2xhc3MgQ29udmVyc2F0aW9uIGV4dGVuZHMgU3luY2FibGUge1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgY29udmVyc2F0aW9uLlxuICAgKlxuICAgKiBUaGUgc3RhdGljIGBsYXllci5Db252ZXJzYXRpb24uY3JlYXRlKClgIG1ldGhvZFxuICAgKiB3aWxsIGNvcnJlY3RseSBsb29rdXAgZGlzdGluY3QgQ29udmVyc2F0aW9ucyBhbmRcbiAgICogcmV0dXJuIHRoZW07IGBuZXcgbGF5ZXIuQ29udmVyc2F0aW9uKClgIHdpbGwgbm90LlxuICAgKlxuICAgKiBEZXZlbG9wZXJzIHNob3VsZCB1c2UgYGxheWVyLkNvbnZlcnNhdGlvbi5jcmVhdGUoKWAuXG4gICAqXG4gICAqIEBtZXRob2QgY29uc3RydWN0b3JcbiAgICogQHByb3RlY3RlZFxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdGlvbnNcbiAgICogQHBhcmFtIHtzdHJpbmdbXS9sYXllci5JZGVudGl0eVtdfSBvcHRpb25zLnBhcnRpY2lwYW50cyAtIEFycmF5IG9mIFBhcnRpY2lwYW50IElEcyBvciBsYXllci5JZGVudGl0eSBpbnN0YW5jZXNcbiAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5kaXN0aW5jdD10cnVlXSAtIElzIHRoZSBjb252ZXJzYXRpb24gZGlzdGluY3RcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLm1ldGFkYXRhXSAtIEFuIG9iamVjdCBjb250YWluaW5nIENvbnZlcnNhdGlvbiBNZXRhZGF0YS5cbiAgICogQHJldHVybiB7bGF5ZXIuQ29udmVyc2F0aW9ufVxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gU2V0dXAgZGVmYXVsdCB2YWx1ZXNcbiAgICBpZiAoIW9wdGlvbnMucGFydGljaXBhbnRzKSBvcHRpb25zLnBhcnRpY2lwYW50cyA9IFtdO1xuICAgIGlmICghb3B0aW9ucy5tZXRhZGF0YSkgb3B0aW9ucy5tZXRhZGF0YSA9IHt9O1xuXG4gICAgLy8gTWFrZSBzdXJlIHRoZSBJRCBmcm9tIGhhbmRsZSBmcm9tU2VydmVyIHBhcmFtZXRlciBpcyB1c2VkIGJ5IHRoZSBSb290LmNvbnN0cnVjdG9yXG4gICAgaWYgKG9wdGlvbnMuZnJvbVNlcnZlcikgb3B0aW9ucy5pZCA9IG9wdGlvbnMuZnJvbVNlcnZlci5pZDtcblxuICAgIC8vIE1ha2Ugc3VyZSB3ZSBoYXZlIGFuIGNsaWVudElkIHByb3BlcnR5XG4gICAgaWYgKG9wdGlvbnMuY2xpZW50KSBvcHRpb25zLmNsaWVudElkID0gb3B0aW9ucy5jbGllbnQuYXBwSWQ7XG5cbiAgICBzdXBlcihvcHRpb25zKTtcblxuXG4gICAgdGhpcy5pc0luaXRpYWxpemluZyA9IHRydWU7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcblxuICAgIC8vIElmIHRoZSBvcHRpb25zIGNvbnRhaW5zIGEgZnVsbCBzZXJ2ZXIgZGVmaW5pdGlvbiBvZiB0aGUgb2JqZWN0LFxuICAgIC8vIGNvcHkgaXQgaW4gd2l0aCBfcG9wdWxhdGVGcm9tU2VydmVyOyB0aGlzIHdpbGwgYWRkIHRoZSBDb252ZXJzYXRpb25cbiAgICAvLyB0byB0aGUgQ2xpZW50IGFzIHdlbGwuXG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5mcm9tU2VydmVyKSB7XG4gICAgICB0aGlzLl9wb3B1bGF0ZUZyb21TZXJ2ZXIob3B0aW9ucy5mcm9tU2VydmVyKTtcbiAgICB9XG5cbiAgICAvLyBTZXR1cCBwYXJ0aWNpcGFudHNcbiAgICBlbHNlIHtcbiAgICAgIHRoaXMucGFydGljaXBhbnRzID0gY2xpZW50Ll9maXhJZGVudGl0aWVzKHRoaXMucGFydGljaXBhbnRzKTtcblxuICAgICAgaWYgKHRoaXMucGFydGljaXBhbnRzLmluZGV4T2YoY2xpZW50LnVzZXIpID09PSAtMSkge1xuICAgICAgICB0aGlzLnBhcnRpY2lwYW50cy5wdXNoKGNsaWVudC51c2VyKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuY3JlYXRlZEF0KSB7XG4gICAgICB0aGlzLmNyZWF0ZWRBdCA9IG5ldyBEYXRlKCk7XG4gICAgfVxuXG4gICAgY2xpZW50Ll9hZGRDb252ZXJzYXRpb24odGhpcyk7XG4gICAgdGhpcy5pc0luaXRpYWxpemluZyA9IGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIERlc3Ryb3kgdGhlIGxvY2FsIGNvcHkgb2YgdGhpcyBDb252ZXJzYXRpb24sIGNsZWFuaW5nIHVwIGFsbCByZXNvdXJjZXNcbiAgICogaXQgY29uc3VtZXMuXG4gICAqXG4gICAqIEBtZXRob2QgZGVzdHJveVxuICAgKi9cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmxhc3RNZXNzYWdlID0gbnVsbDtcblxuICAgIC8vIENsaWVudCBmaXJlcyAnY29udmVyc2F0aW9uczpyZW1vdmUnIGFuZCB0aGVuIHJlbW92ZXMgdGhlIENvbnZlcnNhdGlvbi5cbiAgICBpZiAodGhpcy5jbGllbnRJZCkgdGhpcy5nZXRDbGllbnQoKS5fcmVtb3ZlQ29udmVyc2F0aW9uKHRoaXMpO1xuXG4gICAgc3VwZXIuZGVzdHJveSgpO1xuXG4gICAgdGhpcy5wYXJ0aWNpcGFudHMgPSBudWxsO1xuICAgIHRoaXMubWV0YWRhdGEgPSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSB0aGlzIENvbnZlcnNhdGlvbiBvbiB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBPbiBjb21wbGV0aW9uLCB0aGlzIGluc3RhbmNlIHdpbGwgcmVjZWl2ZVxuICAgKiBhbiBpZCwgdXJsIGFuZCBjcmVhdGVkQXQuICBJdCBtYXkgYWxzbyByZWNlaXZlIG1ldGFkYXRhXG4gICAqIGlmIHRoZXJlIHdhcyBhIEZPVU5EX1dJVEhPVVRfUkVRVUVTVEVEX01FVEFEQVRBIHJlc3VsdC5cbiAgICpcbiAgICogTm90ZSB0aGF0IHRoZSBvcHRpb25hbCBNZXNzYWdlIHBhcmFtZXRlciBzaG91bGQgTk9UIGJlIHVzZWQgZXhjZXB0XG4gICAqIGJ5IHRoZSBsYXllci5NZXNzYWdlIGNsYXNzIGl0c2VsZi5cbiAgICpcbiAgICogTm90ZSB0aGF0IHJlY29tbWVuZGVkIHByYWN0aWNlIGlzIHRvIHNlbmQgdGhlIENvbnZlcnNhdGlvbiBieSBzZW5kaW5nIGEgTWVzc2FnZSBpbiB0aGUgQ29udmVyc2F0aW9uLFxuICAgKiBhbmQgTk9UIGJ5IGNhbGxpbmcgQ29udmVyc2F0aW9uLnNlbmQuXG4gICAqXG4gICAqICAgICAgY2xpZW50LmNyZWF0ZUNvbnZlcnNhdGlvbih7XG4gICAqICAgICAgICAgIHBhcnRpY2lwYW50czogWydhJywgJ2InXSxcbiAgICogICAgICAgICAgZGlzdGluY3Q6IGZhbHNlXG4gICAqICAgICAgfSlcbiAgICogICAgICAuc2VuZCgpXG4gICAqICAgICAgLm9uKCdjb252ZXJzYXRpb25zOnNlbnQnLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgICAgICAgYWxlcnQoJ0RvbmUnKTtcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogQG1ldGhvZCBzZW5kXG4gICAqIEBwYXJhbSB7bGF5ZXIuTWVzc2FnZX0gW21lc3NhZ2VdIFRlbGxzIHRoZSBDb252ZXJzYXRpb24gd2hhdCBpdHMgbGFzdF9tZXNzYWdlIHdpbGwgYmVcbiAgICogQHJldHVybiB7bGF5ZXIuQ29udmVyc2F0aW9ufSB0aGlzXG4gICAqL1xuICBzZW5kKG1lc3NhZ2UpIHtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIGlmICghY2xpZW50KSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmNsaWVudE1pc3NpbmcpO1xuXG4gICAgLy8gSWYgdGhpcyBpcyBwYXJ0IG9mIGEgY3JlYXRlKHtkaXN0aW5jdDp0cnVlfSkuc2VuZCgpIGNhbGwgd2hlcmVcbiAgICAvLyB0aGUgZGlzdGluY3QgY29udmVyc2F0aW9uIHdhcyBmb3VuZCwganVzdCB0cmlnZ2VyIHRoZSBjYWNoZWQgZXZlbnQgYW5kIGV4aXRcbiAgICBjb25zdCB3YXNMb2NhbERpc3RpbmN0ID0gQm9vbGVhbih0aGlzLl9zZW5kRGlzdGluY3RFdmVudCk7XG4gICAgaWYgKHRoaXMuX3NlbmREaXN0aW5jdEV2ZW50KSB0aGlzLl9oYW5kbGVMb2NhbERpc3RpbmN0Q29udmVyc2F0aW9uKCk7XG5cbiAgICAvLyBJZiBhIG1lc3NhZ2UgaXMgcGFzc2VkIGluLCB0aGVuIHRoYXQgbWVzc2FnZSBpcyBiZWluZyBzZW50LCBhbmQgaXMgb3VyXG4gICAgLy8gbmV3IGxhc3RNZXNzYWdlICh1bnRpbCB0aGUgd2Vic29ja2V0IHRlbGxzIHVzIG90aGVyd2lzZSlcbiAgICBpZiAobWVzc2FnZSkge1xuICAgICAgLy8gU2V0dGluZyBhIHBvc2l0aW9uIGlzIHJlcXVpcmVkIGlmIGl0cyBnb2luZyB0byBnZXQgc29ydGVkIGNvcnJlY3RseSBieSBxdWVyeS5cbiAgICAgIC8vIFRoZSBjb3JyZWN0IHBvc2l0aW9uIHdpbGwgYmUgd3JpdHRlbiBieSBfcG9wdWxhdGVGcm9tU2VydmVyIHdoZW4gdGhlIG9iamVjdFxuICAgICAgLy8gaXMgcmV0dXJuZWQgZnJvbSB0aGUgc2VydmVyLiAgV2UgaW5jcmVtZW50IHRoZSBwb3NpdGlvbiBieSB0aGUgdGltZSBzaW5jZSB0aGUgcHJpb3IgbGFzdE1lc3NhZ2Ugd2FzIHNlbnRcbiAgICAgIC8vIHNvIHRoYXQgaWYgbXVsdGlwbGUgdGFicyBhcmUgc2VuZGluZyBtZXNzYWdlcyBhbmQgd3JpdGluZyB0aGVtIHRvIGluZGV4ZWREQiwgdGhleSB3aWxsIGhhdmUgcG9zaXRpb25zIGluIGNvcnJlY3QgY2hyb25vbG9naWNhbCBvcmRlci5cbiAgICAgIC8vIFdBUk5JTkc6IFRoZSBxdWVyeSB3aWxsIE5PVCBiZSByZXNvcnRlZCB1c2luZyB0aGUgc2VydmVyJ3MgcG9zaXRpb24gdmFsdWUuXG4gICAgICBsZXQgcG9zaXRpb247XG4gICAgICBpZiAodGhpcy5sYXN0TWVzc2FnZSkge1xuICAgICAgICBwb3NpdGlvbiA9IHRoaXMubGFzdE1lc3NhZ2UucG9zaXRpb24gKyBEYXRlLm5vdygpIC0gdGhpcy5sYXN0TWVzc2FnZS5zZW50QXQuZ2V0VGltZSgpO1xuICAgICAgICBpZiAocG9zaXRpb24gPT09IHRoaXMubGFzdE1lc3NhZ2UucG9zaXRpb24pIHBvc2l0aW9uKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwb3NpdGlvbiA9IDA7XG4gICAgICB9XG4gICAgICBtZXNzYWdlLnBvc2l0aW9uID0gcG9zaXRpb247XG4gICAgICB0aGlzLmxhc3RNZXNzYWdlID0gbWVzc2FnZTtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGUgQ29udmVyc2F0aW9uIGlzIGFscmVhZHkgb24gdGhlIHNlcnZlciwgZG9uJ3Qgc2VuZC5cbiAgICBpZiAod2FzTG9jYWxEaXN0aW5jdCB8fCB0aGlzLnN5bmNTdGF0ZSAhPT0gQ29uc3RhbnRzLlNZTkNfU1RBVEUuTkVXKSByZXR1cm4gdGhpcztcblxuICAgIC8vIE1ha2Ugc3VyZSB0aGlzIHVzZXIgaXMgYSBwYXJ0aWNpcGFudCAoc2VydmVyIGRvZXMgdGhpcyBmb3IgdXMsIGJ1dFxuICAgIC8vIHRoaXMgaW5zdXJlcyB0aGUgbG9jYWwgY29weSBpcyBjb3JyZWN0IHVudGlsIHdlIGdldCBhIHJlc3BvbnNlIGZyb21cbiAgICAvLyB0aGUgc2VydmVyXG4gICAgaWYgKHRoaXMucGFydGljaXBhbnRzLmluZGV4T2YoY2xpZW50LnVzZXIpID09PSAtMSkge1xuICAgICAgdGhpcy5wYXJ0aWNpcGFudHMucHVzaChjbGllbnQudXNlcik7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlcmUgaXMgb25seSBvbmUgcGFydGljaXBhbnQsIGl0cyBjbGllbnQudXNlci51c2VySWQuICBOb3QgZW5vdWdoXG4gICAgLy8gZm9yIHVzIHRvIGhhdmUgYSBnb29kIENvbnZlcnNhdGlvbiBvbiB0aGUgc2VydmVyLiAgQWJvcnQuXG4gICAgaWYgKHRoaXMucGFydGljaXBhbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5tb3JlUGFydGljaXBhbnRzUmVxdWlyZWQpO1xuICAgIH1cblxuICAgIHRoaXMuY3JlYXRlZEF0ID0gbmV3IERhdGUoKTtcblxuICAgIC8vIFVwZGF0ZSB0aGUgc3luY1N0YXRlXG4gICAgdGhpcy5fc2V0U3luY2luZygpO1xuXG4gICAgY2xpZW50LnNlbmRTb2NrZXRSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgYm9keToge30sIC8vIHNlZSBfZ2V0U2VuZERhdGFcbiAgICAgIHN5bmM6IHtcbiAgICAgICAgZGVwZW5kczogdGhpcy5pZCxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLmlkLFxuICAgICAgfSxcbiAgICB9LCAocmVzdWx0KSA9PiB0aGlzLl9jcmVhdGVSZXN1bHQocmVzdWx0KSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlcyB0aGUgY2FzZSB3aGVyZSBhIERpc3RpbmN0IENyZWF0ZSBDb252ZXJzYXRpb24gZm91bmQgYSBsb2NhbCBtYXRjaC5cbiAgICpcbiAgICogV2hlbiBhbiBhcHAgY2FsbHMgY2xpZW50LmNyZWF0ZUNvbnZlcnNhdGlvbihbLi4uXSlcbiAgICogYW5kIHJlcXVlc3RzIGEgRGlzdGluY3QgQ29udmVyc2F0aW9uIChkZWZhdWx0IHNldHRpbmcpLFxuICAgKiBhbmQgdGhlIENvbnZlcnNhdGlvbiBhbHJlYWR5IGV4aXN0cywgd2hhdCBkbyB3ZSBkbyB0byBoZWxwXG4gICAqIHRoZW0gYWNjZXNzIGl0P1xuICAgKlxuICAgKiAgICAgIGNsaWVudC5jcmVhdGVDb252ZXJzYXRpb24oW1wiZnJlZFwiXSkub24oXCJjb252ZXJzYXRpb25zOnNlbnRcIiwgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgICAgICByZW5kZXIoKTtcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogVW5kZXIgbm9ybWFsIGNvbmRpdGlvbnMsIGNhbGxpbmcgYGMuc2VuZCgpYCBvbiBhIG1hdGNoaW5nIGRpc3RpbmN0IENvbnZlcnNhdGlvblxuICAgKiB3b3VsZCBlaXRoZXIgdGhyb3cgYW4gZXJyb3Igb3IganVzdCBiZSBhIG5vLW9wLiAgV2UgdXNlIHRoaXMgbWV0aG9kIHRvIHRyaWdnZXJcbiAgICogdGhlIGV4cGVjdGVkIFwiY29udmVyc2F0aW9uczpzZW50XCIgZXZlbnQgZXZlbiB0aG91Z2ggaXRzIGFscmVhZHkgYmVlbiBzZW50IGFuZFxuICAgKiB3ZSBkaWQgbm90aGluZy4gIFVzZSB0aGUgZXZ0LnJlc3VsdCBwcm9wZXJ0eSBpZiB5b3Ugd2FudCB0byBrbm93IHdoZXRoZXIgdGhlXG4gICAqIHJlc3VsdCB3YXMgYSBuZXcgY29udmVyc2F0aW9uIG9yIG1hdGNoaW5nIG9uZS5cbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlTG9jYWxEaXN0aW5jdENvbnZlcnNhdGlvblxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2hhbmRsZUxvY2FsRGlzdGluY3RDb252ZXJzYXRpb24oKSB7XG4gICAgY29uc3QgZXZ0ID0gdGhpcy5fc2VuZERpc3RpbmN0RXZlbnQ7XG4gICAgdGhpcy5fc2VuZERpc3RpbmN0RXZlbnQgPSBudWxsO1xuXG4gICAgLy8gZGVsYXkgc28gdGhlcmUgaXMgdGltZSB0byBzZXR1cCBhbiBldmVudCBsaXN0ZW5lciBvbiB0aGlzIGNvbnZlcnNhdGlvblxuICAgIHRoaXMuX3RyaWdnZXJBc3luYygnY29udmVyc2F0aW9uczpzZW50JywgZXZ0KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG5cbiAgLyoqXG4gICAqIEdldHMgdGhlIGRhdGEgZm9yIGEgQ3JlYXRlIHJlcXVlc3QuXG4gICAqXG4gICAqIFRoZSBsYXllci5TeW5jTWFuYWdlciBuZWVkcyBhIGNhbGxiYWNrIHRvIGNyZWF0ZSB0aGUgQ29udmVyc2F0aW9uIGFzIGl0XG4gICAqIGxvb2tzIE5PVywgbm90IGJhY2sgd2hlbiBgc2VuZCgpYCB3YXMgY2FsbGVkLiAgVGhpcyBtZXRob2QgaXMgY2FsbGVkXG4gICAqIGJ5IHRoZSBsYXllci5TeW5jTWFuYWdlciB0byBwb3B1bGF0ZSB0aGUgUE9TVCBkYXRhIG9mIHRoZSBjYWxsLlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRTZW5kRGF0YVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJuIHtPYmplY3R9IFdlYnNvY2tldCBkYXRhIGZvciB0aGUgcmVxdWVzdFxuICAgKi9cbiAgX2dldFNlbmREYXRhKGRhdGEpIHtcbiAgICBjb25zdCBpc01ldGFkYXRhRW1wdHkgPSBVdGlsLmlzRW1wdHkodGhpcy5tZXRhZGF0YSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIG1ldGhvZDogJ0NvbnZlcnNhdGlvbi5jcmVhdGUnLFxuICAgICAgZGF0YToge1xuICAgICAgICBwYXJ0aWNpcGFudHM6IHRoaXMucGFydGljaXBhbnRzLm1hcChpZGVudGl0eSA9PiBpZGVudGl0eS5pZCksXG4gICAgICAgIGRpc3RpbmN0OiB0aGlzLmRpc3RpbmN0LFxuICAgICAgICBtZXRhZGF0YTogaXNNZXRhZGF0YUVtcHR5ID8gbnVsbCA6IHRoaXMubWV0YWRhdGEsXG4gICAgICAgIGlkOiB0aGlzLmlkLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgcmVzdWx0IG9mIHNlbmQgbWV0aG9kLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgd2UgdXNlIF90cmlnZ2VyQXN5bmMgc28gdGhhdFxuICAgKiBldmVudHMgcmVwb3J0aW5nIGNoYW5nZXMgdG8gdGhlIGxheWVyLkNvbnZlcnNhdGlvbi5pZCBjYW5cbiAgICogYmUgYXBwbGllZCBiZWZvcmUgcmVwb3J0aW5nIG9uIGl0IGJlaW5nIHNlbnQuXG4gICAqXG4gICAqIEV4YW1wbGU6IFF1ZXJ5IHdpbGwgbm93IGhhdmUgdGhlIHJlc29sdmVkIERpc3RpbmN0IElEcyByYXRoZXIgdGhhbiB0aGUgcHJvcG9zZWQgSURcbiAgICogd2hlbiB0aGlzIGV2ZW50IGlzIHRyaWdnZXJlZC5cbiAgICpcbiAgICogQG1ldGhvZCBfY3JlYXRlUmVzdWx0XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gcmVzdWx0XG4gICAqL1xuICBfY3JlYXRlUmVzdWx0KHsgc3VjY2VzcywgZGF0YSB9KSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHJldHVybjtcbiAgICBpZiAoc3VjY2Vzcykge1xuICAgICAgdGhpcy5fY3JlYXRlU3VjY2VzcyhkYXRhKTtcbiAgICB9IGVsc2UgaWYgKGRhdGEuaWQgPT09ICdjb25mbGljdCcpIHtcbiAgICAgIHRoaXMuX3BvcHVsYXRlRnJvbVNlcnZlcihkYXRhLmRhdGEpO1xuICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdjb252ZXJzYXRpb25zOnNlbnQnLCB7XG4gICAgICAgIHJlc3VsdDogQ29udmVyc2F0aW9uLkZPVU5EX1dJVEhPVVRfUkVRVUVTVEVEX01FVEFEQVRBLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudHJpZ2dlcignY29udmVyc2F0aW9uczpzZW50LWVycm9yJywgeyBlcnJvcjogZGF0YSB9KTtcbiAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIHRoZSBzdWNjZXNzZnVsIHJlc3VsdCBvZiBhIGNyZWF0ZSBjYWxsXG4gICAqXG4gICAqIEBtZXRob2QgX2NyZWF0ZVN1Y2Nlc3NcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBkYXRhIFNlcnZlciBkZXNjcmlwdGlvbiBvZiBDb252ZXJzYXRpb25cbiAgICovXG4gIF9jcmVhdGVTdWNjZXNzKGRhdGEpIHtcbiAgICB0aGlzLl9wb3B1bGF0ZUZyb21TZXJ2ZXIoZGF0YSk7XG4gICAgaWYgKCF0aGlzLmRpc3RpbmN0KSB7XG4gICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2NvbnZlcnNhdGlvbnM6c2VudCcsIHtcbiAgICAgICAgcmVzdWx0OiBDb252ZXJzYXRpb24uQ1JFQVRFRCxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBDdXJyZW50bHkgdGhlIHdlYnNvY2tldCBkb2VzIG5vdCB0ZWxsIHVzIGlmIGl0c1xuICAgICAgLy8gcmV0dXJuaW5nIGFuIGV4aXN0aW5nIENvbnZlcnNhdGlvbi4gIFNvIGd1ZXNzLi4uXG4gICAgICAvLyBpZiB0aGVyZSBpcyBubyBsYXN0TWVzc2FnZSwgdGhlbiBtb3N0IGxpa2VseSwgdGhlcmUgd2FzXG4gICAgICAvLyBubyBleGlzdGluZyBDb252ZXJzYXRpb24uICBTYWRseSwgQVBJLTgzNDsgbGFzdF9tZXNzYWdlIGlzIGN1cnJlbnRseVxuICAgICAgLy8gYWx3YXlzIG51bGwuXG4gICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2NvbnZlcnNhdGlvbnM6c2VudCcsIHtcbiAgICAgICAgcmVzdWx0OiAhdGhpcy5sYXN0TWVzc2FnZSA/IENvbnZlcnNhdGlvbi5DUkVBVEVEIDogQ29udmVyc2F0aW9uLkZPVU5ELFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFBvcHVsYXRlcyB0aGlzIGluc3RhbmNlIHVzaW5nIHNlcnZlci1kYXRhLlxuICAgKlxuICAgKiBTaWRlIGVmZmVjdHMgYWRkIHRoaXMgdG8gdGhlIENsaWVudC5cbiAgICpcbiAgICogQG1ldGhvZCBfcG9wdWxhdGVGcm9tU2VydmVyXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gY29udmVyc2F0aW9uIC0gU2VydmVyIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBjb252ZXJzYXRpb25cbiAgICovXG4gIF9wb3B1bGF0ZUZyb21TZXJ2ZXIoY29udmVyc2F0aW9uKSB7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcblxuICAgIC8vIERpc2FibGUgZXZlbnRzIGlmIGNyZWF0aW5nIGEgbmV3IENvbnZlcnNhdGlvblxuICAgIC8vIFdlIHN0aWxsIHdhbnQgcHJvcGVydHkgY2hhbmdlIGV2ZW50cyBmb3IgYW55dGhpbmcgdGhhdCBET0VTIGNoYW5nZVxuICAgIHRoaXMuX2Rpc2FibGVFdmVudHMgPSAodGhpcy5zeW5jU3RhdGUgPT09IENvbnN0YW50cy5TWU5DX1NUQVRFLk5FVyk7XG5cbiAgICB0aGlzLl9zZXRTeW5jZWQoKTtcblxuICAgIGNvbnN0IGlkID0gdGhpcy5pZDtcbiAgICB0aGlzLmlkID0gY29udmVyc2F0aW9uLmlkO1xuXG4gICAgLy8gSURzIGNoYW5nZSBpZiB0aGUgc2VydmVyIHJldHVybnMgYSBtYXRjaGluZyBEaXN0aW5jdCBDb252ZXJzYXRpb25cbiAgICBpZiAoaWQgIT09IHRoaXMuaWQpIHtcbiAgICAgIGNsaWVudC5fdXBkYXRlQ29udmVyc2F0aW9uSWQodGhpcywgaWQpO1xuICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdjb252ZXJzYXRpb25zOmNoYW5nZScsIHtcbiAgICAgICAgb2xkVmFsdWU6IGlkLFxuICAgICAgICBuZXdWYWx1ZTogdGhpcy5pZCxcbiAgICAgICAgcHJvcGVydHk6ICdpZCcsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnVybCA9IGNvbnZlcnNhdGlvbi51cmw7XG4gICAgdGhpcy5wYXJ0aWNpcGFudHMgPSBjbGllbnQuX2ZpeElkZW50aXRpZXMoY29udmVyc2F0aW9uLnBhcnRpY2lwYW50cyk7XG4gICAgdGhpcy5kaXN0aW5jdCA9IGNvbnZlcnNhdGlvbi5kaXN0aW5jdDtcbiAgICB0aGlzLmNyZWF0ZWRBdCA9IG5ldyBEYXRlKGNvbnZlcnNhdGlvbi5jcmVhdGVkX2F0KTtcbiAgICB0aGlzLm1ldGFkYXRhID0gY29udmVyc2F0aW9uLm1ldGFkYXRhO1xuICAgIHRoaXMudW5yZWFkQ291bnQgPSBjb252ZXJzYXRpb24udW5yZWFkX21lc3NhZ2VfY291bnQ7XG4gICAgdGhpcy5pc0N1cnJlbnRQYXJ0aWNpcGFudCA9IHRoaXMucGFydGljaXBhbnRzLmluZGV4T2YoY2xpZW50LnVzZXIpICE9PSAtMTtcblxuICAgIGNsaWVudC5fYWRkQ29udmVyc2F0aW9uKHRoaXMpO1xuXG4gICAgaWYgKHR5cGVvZiBjb252ZXJzYXRpb24ubGFzdF9tZXNzYWdlID09PSAnc3RyaW5nJykge1xuICAgICAgdGhpcy5sYXN0TWVzc2FnZSA9IGNsaWVudC5nZXRNZXNzYWdlKGNvbnZlcnNhdGlvbi5sYXN0X21lc3NhZ2UpO1xuICAgIH0gZWxzZSBpZiAoY29udmVyc2F0aW9uLmxhc3RfbWVzc2FnZSkge1xuICAgICAgdGhpcy5sYXN0TWVzc2FnZSA9IGNsaWVudC5fY3JlYXRlT2JqZWN0KGNvbnZlcnNhdGlvbi5sYXN0X21lc3NhZ2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxhc3RNZXNzYWdlID0gbnVsbDtcbiAgICB9XG5cbiAgICB0aGlzLl9kaXNhYmxlRXZlbnRzID0gZmFsc2U7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBBZGQgYW4gYXJyYXkgb2YgcGFydGljaXBhbnQgaWRzIHRvIHRoZSBjb252ZXJzYXRpb24uXG4gICAqXG4gICAqICAgICAgY29udmVyc2F0aW9uLmFkZFBhcnRpY2lwYW50cyhbJ2EnLCAnYiddKTtcbiAgICpcbiAgICogTmV3IHBhcnRpY2lwYW50cyB3aWxsIGltbWVkaWF0ZWx5IHNob3cgdXAgaW4gdGhlIENvbnZlcnNhdGlvbixcbiAgICogYnV0IG1heSBub3QgaGF2ZSBzeW5jZWQgd2l0aCB0aGUgc2VydmVyIHlldC5cbiAgICpcbiAgICogVE9ETyBXRUItOTY3OiBSb2xsIHBhcnRpY2lwYW50cyBiYWNrIG9uIGdldHRpbmcgYSBzZXJ2ZXIgZXJyb3JcbiAgICpcbiAgICogQG1ldGhvZCBhZGRQYXJ0aWNpcGFudHNcbiAgICogQHBhcmFtICB7c3RyaW5nW10vbGF5ZXIuSWRlbnRpdHlbXX0gcGFydGljaXBhbnRzIC0gQXJyYXkgb2YgUGFydGljaXBhbnQgSURzIG9yIElkZW50aXR5IG9iamVjdHNcbiAgICogQHJldHVybnMge2xheWVyLkNvbnZlcnNhdGlvbn0gdGhpc1xuICAgKi9cbiAgYWRkUGFydGljaXBhbnRzKHBhcnRpY2lwYW50cykge1xuICAgIC8vIE9ubHkgYWRkIHRob3NlIHRoYXQgYXJlbid0IGFscmVhZHkgaW4gdGhlIGxpc3QuXG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcbiAgICBjb25zdCBpZGVudGl0aWVzID0gY2xpZW50Ll9maXhJZGVudGl0aWVzKHBhcnRpY2lwYW50cyk7XG4gICAgY29uc3QgYWRkaW5nID0gaWRlbnRpdGllcy5maWx0ZXIoaWRlbnRpdHkgPT4gdGhpcy5wYXJ0aWNpcGFudHMuaW5kZXhPZihpZGVudGl0eSkgPT09IC0xKTtcbiAgICB0aGlzLl9wYXRjaFBhcnRpY2lwYW50cyh7IGFkZDogYWRkaW5nLCByZW1vdmU6IFtdIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgYW4gYXJyYXkgb2YgcGFydGljaXBhbnQgaWRzIGZyb20gdGhlIGNvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogICAgICBjb252ZXJzYXRpb24ucmVtb3ZlUGFydGljaXBhbnRzKFsnYScsICdiJ10pO1xuICAgKlxuICAgKiBSZW1vdmVkIHBhcnRpY2lwYW50cyB3aWxsIGltbWVkaWF0ZWx5IGJlIHJlbW92ZWQgZnJvbSB0aGlzIENvbnZlcnNhdGlvbixcbiAgICogYnV0IG1heSBub3QgaGF2ZSBzeW5jZWQgd2l0aCB0aGUgc2VydmVyIHlldC5cbiAgICpcbiAgICogVGhyb3dzIGVycm9yIGlmIHlvdSBhdHRlbXB0IHRvIHJlbW92ZSBBTEwgcGFydGljaXBhbnRzLlxuICAgKlxuICAgKiBUT0RPICBXRUItOTY3OiBSb2xsIHBhcnRpY2lwYW50cyBiYWNrIG9uIGdldHRpbmcgYSBzZXJ2ZXIgZXJyb3JcbiAgICpcbiAgICogQG1ldGhvZCByZW1vdmVQYXJ0aWNpcGFudHNcbiAgICogQHBhcmFtICB7c3RyaW5nW10vbGF5ZXIuSWRlbnRpdHlbXX0gcGFydGljaXBhbnRzIC0gQXJyYXkgb2YgUGFydGljaXBhbnQgSURzIG9yIElkZW50aXR5IG9iamVjdHNcbiAgICogQHJldHVybnMge2xheWVyLkNvbnZlcnNhdGlvbn0gdGhpc1xuICAgKi9cbiAgcmVtb3ZlUGFydGljaXBhbnRzKHBhcnRpY2lwYW50cykge1xuICAgIGNvbnN0IGN1cnJlbnRQYXJ0aWNpcGFudHMgPSB7fTtcbiAgICB0aGlzLnBhcnRpY2lwYW50cy5mb3JFYWNoKHBhcnRpY2lwYW50ID0+IChjdXJyZW50UGFydGljaXBhbnRzW3BhcnRpY2lwYW50LmlkXSA9IHRydWUpKTtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIGNvbnN0IGlkZW50aXRpZXMgPSBjbGllbnQuX2ZpeElkZW50aXRpZXMocGFydGljaXBhbnRzKTtcblxuICAgIGNvbnN0IHJlbW92aW5nID0gaWRlbnRpdGllcy5maWx0ZXIocGFydGljaXBhbnQgPT4gY3VycmVudFBhcnRpY2lwYW50c1twYXJ0aWNpcGFudC5pZF0pO1xuICAgIGlmIChyZW1vdmluZy5sZW5ndGggPT09IDApIHJldHVybiB0aGlzO1xuICAgIGlmIChyZW1vdmluZy5sZW5ndGggPT09IHRoaXMucGFydGljaXBhbnRzLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5tb3JlUGFydGljaXBhbnRzUmVxdWlyZWQpO1xuICAgIH1cbiAgICB0aGlzLl9wYXRjaFBhcnRpY2lwYW50cyh7IGFkZDogW10sIHJlbW92ZTogcmVtb3ZpbmcgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVwbGFjZXMgYWxsIHBhcnRpY2lwYW50cyB3aXRoIGEgbmV3IGFycmF5IG9mIG9mIHBhcnRpY2lwYW50IGlkcy5cbiAgICpcbiAgICogICAgICBjb252ZXJzYXRpb24ucmVwbGFjZVBhcnRpY2lwYW50cyhbJ2EnLCAnYiddKTtcbiAgICpcbiAgICogQ2hhbmdlZCBwYXJ0aWNpcGFudHMgd2lsbCBpbW1lZGlhdGVseSBzaG93IHVwIGluIHRoZSBDb252ZXJzYXRpb24sXG4gICAqIGJ1dCBtYXkgbm90IGhhdmUgc3luY2VkIHdpdGggdGhlIHNlcnZlciB5ZXQuXG4gICAqXG4gICAqIFRPRE8gV0VCLTk2NzogUm9sbCBwYXJ0aWNpcGFudHMgYmFjayBvbiBnZXR0aW5nIGEgc2VydmVyIGVycm9yXG4gICAqXG4gICAqIEBtZXRob2QgcmVwbGFjZVBhcnRpY2lwYW50c1xuICAgKiBAcGFyYW0gIHtzdHJpbmdbXS9sYXllci5JZGVudGl0eVtdfSBwYXJ0aWNpcGFudHMgLSBBcnJheSBvZiBQYXJ0aWNpcGFudCBJRHMgb3IgSWRlbnRpdHkgb2JqZWN0c1xuICAgKiBAcmV0dXJucyB7bGF5ZXIuQ29udmVyc2F0aW9ufSB0aGlzXG4gICAqL1xuICByZXBsYWNlUGFydGljaXBhbnRzKHBhcnRpY2lwYW50cykge1xuICAgIGlmICghcGFydGljaXBhbnRzIHx8ICFwYXJ0aWNpcGFudHMubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5Lm1vcmVQYXJ0aWNpcGFudHNSZXF1aXJlZCk7XG4gICAgfVxuXG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcbiAgICBjb25zdCBpZGVudGl0aWVzID0gY2xpZW50Ll9maXhJZGVudGl0aWVzKHBhcnRpY2lwYW50cyk7XG5cbiAgICBjb25zdCBjaGFuZ2UgPSB0aGlzLl9nZXRQYXJ0aWNpcGFudENoYW5nZShpZGVudGl0aWVzLCB0aGlzLnBhcnRpY2lwYW50cyk7XG4gICAgdGhpcy5fcGF0Y2hQYXJ0aWNpcGFudHMoY2hhbmdlKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgdGhlIHNlcnZlciB3aXRoIHRoZSBuZXcgcGFydGljaXBhbnQgbGlzdC5cbiAgICpcbiAgICogRXhlY3V0ZXMgYXMgZm9sbG93czpcbiAgICpcbiAgICogMS4gVXBkYXRlcyB0aGUgcGFydGljaXBhbnRzIHByb3BlcnR5IG9mIHRoZSBsb2NhbCBvYmplY3RcbiAgICogMi4gVHJpZ2dlcnMgYSBjb252ZXJzYXRpb25zOmNoYW5nZSBldmVudFxuICAgKiAzLiBTdWJtaXRzIGEgcmVxdWVzdCB0byBiZSBzZW50IHRvIHRoZSBzZXJ2ZXIgdG8gdXBkYXRlIHRoZSBzZXJ2ZXIncyBvYmplY3RcbiAgICogNC4gSWYgdGhlcmUgaXMgYW4gZXJyb3IsIG5vIGVycm9ycyBhcmUgZmlyZWQgZXhjZXB0IGJ5IGxheWVyLlN5bmNNYW5hZ2VyLCBidXQgYW5vdGhlclxuICAgKiAgICBjb252ZXJzYXRpb25zOmNoYW5nZSBldmVudCBpcyBmaXJlZCBhcyB0aGUgY2hhbmdlIGlzIHJvbGxlZCBiYWNrLlxuICAgKlxuICAgKiBAbWV0aG9kIF9wYXRjaFBhcnRpY2lwYW50c1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3RbXX0gb3BlcmF0aW9ucyAtIEFycmF5IG9mIEpTT04gcGF0Y2ggb3BlcmF0aW9uXG4gICAqIEBwYXJhbSAge09iamVjdH0gZXZlbnREYXRhIC0gRGF0YSBkZXNjcmliaW5nIHRoZSBjaGFuZ2UgZm9yIHVzZSBpbiBhbiBldmVudFxuICAgKi9cbiAgX3BhdGNoUGFydGljaXBhbnRzKGNoYW5nZSkge1xuICAgIHRoaXMuX2FwcGx5UGFydGljaXBhbnRDaGFuZ2UoY2hhbmdlKTtcbiAgICB0aGlzLmlzQ3VycmVudFBhcnRpY2lwYW50ID0gdGhpcy5wYXJ0aWNpcGFudHMuaW5kZXhPZih0aGlzLmdldENsaWVudCgpLnVzZXIpICE9PSAtMTtcblxuICAgIGNvbnN0IG9wcyA9IFtdO1xuICAgIGNoYW5nZS5yZW1vdmUuZm9yRWFjaChwYXJ0aWNpcGFudCA9PiB7XG4gICAgICBvcHMucHVzaCh7XG4gICAgICAgIG9wZXJhdGlvbjogJ3JlbW92ZScsXG4gICAgICAgIHByb3BlcnR5OiAncGFydGljaXBhbnRzJyxcbiAgICAgICAgaWQ6IHBhcnRpY2lwYW50LmlkLFxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBjaGFuZ2UuYWRkLmZvckVhY2gocGFydGljaXBhbnQgPT4ge1xuICAgICAgb3BzLnB1c2goe1xuICAgICAgICBvcGVyYXRpb246ICdhZGQnLFxuICAgICAgICBwcm9wZXJ0eTogJ3BhcnRpY2lwYW50cycsXG4gICAgICAgIGlkOiBwYXJ0aWNpcGFudC5pZCxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdGhpcy5feGhyKHtcbiAgICAgIHVybDogJycsXG4gICAgICBtZXRob2Q6ICdQQVRDSCcsXG4gICAgICBkYXRhOiBKU09OLnN0cmluZ2lmeShvcHMpLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL3ZuZC5sYXllci1wYXRjaCtqc29uJyxcbiAgICAgIH0sXG4gICAgfSwgcmVzdWx0ID0+IHtcbiAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHRoaXMuX2xvYWQoKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnRlcm5hbGx5IHdlIHVzZSBge2FkZDogW10sIHJlbW92ZTogW119YCBpbnN0ZWFkIG9mIExheWVyT3BlcmF0aW9ucy5cbiAgICpcbiAgICogU28gY29udHJvbCBpcyBoYW5kZWQgb2ZmIHRvIHRoaXMgbWV0aG9kIHRvIGFjdHVhbGx5IGFwcGx5IHRoZSBjaGFuZ2VzXG4gICAqIHRvIHRoZSBwYXJ0aWNpcGFudHMgYXJyYXkuXG4gICAqXG4gICAqIEBtZXRob2QgX2FwcGx5UGFydGljaXBhbnRDaGFuZ2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBjaGFuZ2VcbiAgICogQHBhcmFtICB7bGF5ZXIuSWRlbnRpdHlbXX0gY2hhbmdlLmFkZCAtIEFycmF5IG9mIHVzZXJpZHMgdG8gYWRkXG4gICAqIEBwYXJhbSAge2xheWVyLklkZW50aXR5W119IGNoYW5nZS5yZW1vdmUgLSBBcnJheSBvZiB1c2VyaWRzIHRvIHJlbW92ZVxuICAgKi9cbiAgX2FwcGx5UGFydGljaXBhbnRDaGFuZ2UoY2hhbmdlKSB7XG4gICAgY29uc3QgcGFydGljaXBhbnRzID0gW10uY29uY2F0KHRoaXMucGFydGljaXBhbnRzKTtcbiAgICBjaGFuZ2UuYWRkLmZvckVhY2gocGFydGljaXBhbnQgPT4ge1xuICAgICAgaWYgKHBhcnRpY2lwYW50cy5pbmRleE9mKHBhcnRpY2lwYW50KSA9PT0gLTEpIHBhcnRpY2lwYW50cy5wdXNoKHBhcnRpY2lwYW50KTtcbiAgICB9KTtcbiAgICBjaGFuZ2UucmVtb3ZlLmZvckVhY2gocGFydGljaXBhbnQgPT4ge1xuICAgICAgY29uc3QgaW5kZXggPSBwYXJ0aWNpcGFudHMuaW5kZXhPZihwYXJ0aWNpcGFudCk7XG4gICAgICBpZiAoaW5kZXggIT09IC0xKSBwYXJ0aWNpcGFudHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICB9KTtcbiAgICB0aGlzLnBhcnRpY2lwYW50cyA9IHBhcnRpY2lwYW50cztcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWxldGUgdGhlIENvbnZlcnNhdGlvbiBmcm9tIHRoZSBzZXJ2ZXIgYW5kIHJlbW92ZXMgdGhpcyB1c2VyIGFzIGEgcGFydGljaXBhbnQuXG4gICAqXG4gICAqIEBtZXRob2QgbGVhdmVcbiAgICovXG4gIGxlYXZlKCkge1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkKSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmlzRGVzdHJveWVkKTtcbiAgICB0aGlzLl9kZWxldGUoYG1vZGU9JHtDb25zdGFudHMuREVMRVRJT05fTU9ERS5NWV9ERVZJQ0VTfSZsZWF2ZT10cnVlYCk7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIHRoZSBDb252ZXJzYXRpb24gZnJvbSB0aGUgc2VydmVyLCBidXQgZGVsZXRpb24gbW9kZSBtYXkgY2F1c2UgdXNlciB0byByZW1haW4gYSBwYXJ0aWNpcGFudC5cbiAgICpcbiAgICogVGhpcyBjYWxsIHdpbGwgc3VwcG9ydCB2YXJpb3VzIGRlbGV0aW9uIG1vZGVzLlxuICAgKlxuICAgKiBEZWxldGlvbiBNb2RlczpcbiAgICpcbiAgICogKiBsYXllci5Db25zdGFudHMuREVMRVRJT05fTU9ERS5BTEw6IFRoaXMgZGVsZXRlcyB0aGUgbG9jYWwgY29weSBpbW1lZGlhdGVseSwgYW5kIGF0dGVtcHRzIHRvIGFsc29cbiAgICogICBkZWxldGUgdGhlIHNlcnZlcidzIGNvcHkuXG4gICAqICogbGF5ZXIuQ29uc3RhbnRzLkRFTEVUSU9OX01PREUuTVlfREVWSUNFUzogRGVsZXRlcyB0aGUgbG9jYWwgY29weSBpbW1lZGlhdGVseSwgYW5kIGF0dGVtcHRzIHRvIGRlbGV0ZSBpdCBmcm9tIGFsbFxuICAgKiAgIG9mIG15IGRldmljZXMuICBPdGhlciB1c2VycyByZXRhaW4gYWNjZXNzLlxuICAgKiAqIHRydWU6IEZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSB0aGkgaXMgdGhlIHNhbWUgYXMgQUxMLlxuICAgKlxuICAgKiBNWV9ERVZJQ0VTIGRvZXMgbm90IHJlbW92ZSB0aGlzIHVzZXIgYXMgYSBwYXJ0aWNpcGFudC4gIFRoYXQgbWVhbnMgYSBuZXcgTWVzc2FnZSBvbiB0aGlzIENvbnZlcnNhdGlvbiB3aWxsIHJlY3JlYXRlIHRoZVxuICAgKiBDb252ZXJzYXRpb24gZm9yIHRoaXMgdXNlci4gIFNlZSBsYXllci5Db252ZXJzYXRpb24ubGVhdmUoKSBpbnN0ZWFkLlxuICAgKlxuICAgKiBFeGVjdXRlcyBhcyBmb2xsb3dzOlxuICAgKlxuICAgKiAxLiBTdWJtaXRzIGEgcmVxdWVzdCB0byBiZSBzZW50IHRvIHRoZSBzZXJ2ZXIgdG8gZGVsZXRlIHRoZSBzZXJ2ZXIncyBvYmplY3RcbiAgICogMi4gRGVsZXRlJ3MgdGhlIGxvY2FsIG9iamVjdFxuICAgKiAzLiBJZiB0aGVyZSBpcyBhbiBlcnJvciwgbm8gZXJyb3JzIGFyZSBmaXJlZCBleGNlcHQgYnkgbGF5ZXIuU3luY01hbmFnZXIsIGJ1dCB0aGUgQ29udmVyc2F0aW9uIHdpbGwgYmUgcmVsb2FkZWQgZnJvbSB0aGUgc2VydmVyLFxuICAgKiAgICB0cmlnZ2VyaW5nIGEgY29udmVyc2F0aW9uczphZGQgZXZlbnQuXG4gICAqXG4gICAqIEBtZXRob2QgZGVsZXRlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBkZWxldGlvbk1vZGVcbiAgICovXG4gIGRlbGV0ZShtb2RlKSB7XG4gICAgaWYgKHRoaXMuaXNEZXN0cm95ZWQpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuaXNEZXN0cm95ZWQpO1xuXG4gICAgbGV0IHF1ZXJ5U3RyO1xuICAgIHN3aXRjaCAobW9kZSkge1xuICAgICAgY2FzZSBDb25zdGFudHMuREVMRVRJT05fTU9ERS5BTEw6XG4gICAgICBjYXNlIHRydWU6XG4gICAgICAgIHF1ZXJ5U3RyID0gYG1vZGU9JHtDb25zdGFudHMuREVMRVRJT05fTU9ERS5BTEx9YDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIENvbnN0YW50cy5ERUxFVElPTl9NT0RFLk1ZX0RFVklDRVM6XG4gICAgICAgIHF1ZXJ5U3RyID0gYG1vZGU9JHtDb25zdGFudHMuREVMRVRJT05fTU9ERS5NWV9ERVZJQ0VTfSZsZWF2ZT1mYWxzZWA7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5kZWxldGlvbk1vZGVVbnN1cHBvcnRlZCk7XG4gICAgfVxuXG4gICAgdGhpcy5fZGVsZXRlKHF1ZXJ5U3RyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWxldGUgdGhlIENvbnZlcnNhdGlvbiBmcm9tIHRoZSBzZXJ2ZXIgKGludGVybmFsIHZlcnNpb24pLlxuICAgKlxuICAgKiBUaGlzIHZlcnNpb24gb2YgRGVsZXRlIHRha2VzIGEgUXVlcnkgU3RyaW5nIHRoYXQgaXMgcGFja2FnZWQgdXAgYnlcbiAgICogbGF5ZXIuQ29udmVyc2F0aW9uLmRlbGV0ZSBhbmQgbGF5ZXIuQ29udmVyc2F0aW9uLmxlYXZlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9kZWxldGVcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IHF1ZXJ5U3RyIC0gUXVlcnkgc3RyaW5nIGZvciB0aGUgREVMRVRFIHJlcXVlc3RcbiAgICovXG4gIF9kZWxldGUocXVlcnlTdHIpIHtcbiAgICBjb25zdCBpZCA9IHRoaXMuaWQ7XG4gICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcbiAgICB0aGlzLl94aHIoe1xuICAgICAgbWV0aG9kOiAnREVMRVRFJyxcbiAgICAgIHVybDogJz8nICsgcXVlcnlTdHIsXG4gICAgfSwgcmVzdWx0ID0+IHtcbiAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MgJiYgKCFyZXN1bHQuZGF0YSB8fCByZXN1bHQuZGF0YS5pZCAhPT0gJ25vdF9mb3VuZCcpKSBDb252ZXJzYXRpb24ubG9hZChpZCwgY2xpZW50KTtcbiAgICB9KTtcblxuICAgIHRoaXMuX2RlbGV0ZWQoKTtcbiAgICB0aGlzLmRlc3Ryb3koKTtcbiAgfVxuXG4gIF9oYW5kbGVXZWJzb2NrZXREZWxldGUoZGF0YSkge1xuICAgIGlmIChkYXRhLm1vZGUgPT09IENvbnN0YW50cy5ERUxFVElPTl9NT0RFLk1ZX0RFVklDRVMgJiYgZGF0YS5mcm9tX3Bvc2l0aW9uKSB7XG4gICAgICB0aGlzLmdldENsaWVudCgpLl9wdXJnZU1lc3NhZ2VzQnlQb3NpdGlvbih0aGlzLmlkLCBkYXRhLmZyb21fcG9zaXRpb24pO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdXBlci5faGFuZGxlV2Vic29ja2V0RGVsZXRlKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBsYXllci5NZXNzYWdlIGluc3RhbmNlIHdpdGhpbiB0aGlzIGNvbnZlcnNhdGlvblxuICAgKlxuICAgKiAgICAgIHZhciBtZXNzYWdlID0gY29udmVyc2F0aW9uLmNyZWF0ZU1lc3NhZ2UoJ2hlbGxvJyk7XG4gICAqXG4gICAqICAgICAgdmFyIG1lc3NhZ2UgPSBjb252ZXJzYXRpb24uY3JlYXRlTWVzc2FnZSh7XG4gICAqICAgICAgICAgIHBhcnRzOiBbbmV3IGxheWVyLk1lc3NhZ2VQYXJ0KHtcbiAgICogICAgICAgICAgICAgICAgICAgICAgYm9keTogJ2hlbGxvJyxcbiAgICogICAgICAgICAgICAgICAgICAgICAgbWltZVR5cGU6ICd0ZXh0L3BsYWluJ1xuICAgKiAgICAgICAgICAgICAgICAgIH0pXVxuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBTZWUgbGF5ZXIuTWVzc2FnZSBmb3IgbW9yZSBvcHRpb25zIGZvciBjcmVhdGluZyB0aGUgbWVzc2FnZS5cbiAgICpcbiAgICogQG1ldGhvZCBjcmVhdGVNZXNzYWdlXG4gICAqIEBwYXJhbSAge3N0cmluZ3xPYmplY3R9IG9wdGlvbnMgLSBJZiBpdHMgYSBzdHJpbmcsIGEgTWVzc2FnZVBhcnQgaXMgY3JlYXRlZCBhcm91bmQgdGhhdCBzdHJpbmcuXG4gICAqIEBwYXJhbSB7bGF5ZXIuTWVzc2FnZVBhcnRbXX0gb3B0aW9ucy5wYXJ0cyAtIEFuIGFycmF5IG9mIE1lc3NhZ2VQYXJ0cy4gIFRoZXJlIGlzIHNvbWUgdG9sZXJhbmNlIGZvclxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaXQgbm90IGJlaW5nIGFuIGFycmF5LCBvciBmb3IgaXQgYmVpbmcgYSBzdHJpbmcgdG8gYmUgdHVybmVkXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnRvIGEgTWVzc2FnZVBhcnQuXG4gICAqIEByZXR1cm4ge2xheWVyLk1lc3NhZ2V9XG4gICAqL1xuICBjcmVhdGVNZXNzYWdlKG9wdGlvbnMgPSB7fSkge1xuICAgIGNvbnN0IG1lc3NhZ2VDb25maWcgPSAodHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnKSA/IHtcbiAgICAgIHBhcnRzOiBbeyBib2R5OiBvcHRpb25zLCBtaW1lVHlwZTogJ3RleHQvcGxhaW4nIH1dLFxuICAgIH0gOiBvcHRpb25zO1xuICAgIG1lc3NhZ2VDb25maWcuY2xpZW50SWQgPSB0aGlzLmNsaWVudElkO1xuICAgIG1lc3NhZ2VDb25maWcuY29udmVyc2F0aW9uSWQgPSB0aGlzLmlkO1xuXG4gICAgcmV0dXJuIG5ldyBNZXNzYWdlKG1lc3NhZ2VDb25maWcpO1xuICB9XG5cbiAgLyoqXG4gICAqIExheWVyUGF0Y2ggd2lsbCBjYWxsIHRoaXMgYWZ0ZXIgY2hhbmdpbmcgYW55IHByb3BlcnRpZXMuXG4gICAqXG4gICAqIFRyaWdnZXIgYW55IGNsZWFudXAgb3IgZXZlbnRzIG5lZWRlZCBhZnRlciB0aGVzZSBjaGFuZ2VzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVQYXRjaEV2ZW50XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge01peGVkfSBuZXdWYWx1ZSAtIE5ldyB2YWx1ZSBvZiB0aGUgcHJvcGVydHlcbiAgICogQHBhcmFtICB7TWl4ZWR9IG9sZFZhbHVlIC0gUHJpb3IgdmFsdWUgb2YgdGhlIHByb3BlcnR5XG4gICAqIEBwYXJhbSAge3N0cmluZ1tdfSBwYXRocyAtIEFycmF5IG9mIHBhdGhzIHNwZWNpZmljYWxseSBtb2RpZmllZDogWydwYXJ0aWNpcGFudHMnXSwgWydtZXRhZGF0YS5rZXlBJywgJ21ldGFkYXRhLmtleUInXVxuICAgKi9cbiAgX2hhbmRsZVBhdGNoRXZlbnQobmV3VmFsdWUsIG9sZFZhbHVlLCBwYXRocykge1xuICAgIC8vIENlcnRhaW4gdHlwZXMgb2YgX191cGRhdGUgaGFuZGxlcnMgYXJlIGRpc2FibGVkIHdoaWxlIHZhbHVlcyBhcmUgYmVpbmcgc2V0IGJ5XG4gICAgLy8gbGF5ZXIgcGF0Y2ggcGFyc2VyIGJlY2F1c2UgdGhlIGRpZmZlcmVuY2UgYmV0d2VlbiBzZXR0aW5nIGEgdmFsdWUgKHRyaWdnZXJzIGFuIGV2ZW50KVxuICAgIC8vIGFuZCBjaGFuZ2UgYSBwcm9wZXJ0eSBvZiBhIHZhbHVlICh0cmlnZ2VycyBvbmx5IHRoaXMgY2FsbGJhY2spIHJlc3VsdCBpbiBpbmNvbnNpc3RlbnRcbiAgICAvLyBiZWhhdmlvcnMuICBFbmFibGUgdGhlbSBsb25nIGVub3VnaCB0byBhbGxvdyBfX3VwZGF0ZSBjYWxscyB0byBiZSBtYWRlXG4gICAgdGhpcy5faW5MYXllclBhcnNlciA9IGZhbHNlO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBldmVudHMgPSB0aGlzLl9kaXNhYmxlRXZlbnRzO1xuICAgICAgdGhpcy5fZGlzYWJsZUV2ZW50cyA9IGZhbHNlO1xuICAgICAgaWYgKHBhdGhzWzBdLmluZGV4T2YoJ21ldGFkYXRhJykgPT09IDApIHtcbiAgICAgICAgdGhpcy5fX3VwZGF0ZU1ldGFkYXRhKG5ld1ZhbHVlLCBvbGRWYWx1ZSwgcGF0aHMpO1xuICAgICAgfSBlbHNlIGlmIChwYXRoc1swXSA9PT0gJ3BhcnRpY2lwYW50cycpIHtcbiAgICAgICAgY29uc3QgY2xpZW50ID0gdGhpcy5nZXRDbGllbnQoKTtcbiAgICAgICAgLy8gb2xkVmFsdWUvbmV3VmFsdWUgY29tZSBhcyBhIEJhc2ljIElkZW50aXR5IFBPSk87IGxldHMgZGVsaXZlciBldmVudHMgd2l0aCBhY3R1YWwgaW5zdGFuY2VzXG4gICAgICAgIG9sZFZhbHVlID0gb2xkVmFsdWUubWFwKGlkZW50aXR5ID0+IGNsaWVudC5nZXRJZGVudGl0eShpZGVudGl0eS5pZCkpO1xuICAgICAgICBuZXdWYWx1ZSA9IG5ld1ZhbHVlLm1hcChpZGVudGl0eSA9PiBjbGllbnQuZ2V0SWRlbnRpdHkoaWRlbnRpdHkuaWQpKTtcbiAgICAgICAgdGhpcy5fX3VwZGF0ZVBhcnRpY2lwYW50cyhuZXdWYWx1ZSwgb2xkVmFsdWUpO1xuICAgICAgfVxuICAgICAgdGhpcy5fZGlzYWJsZUV2ZW50cyA9IGV2ZW50cztcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIC8vIGRvIG5vdGhpbmdcbiAgICB9XG4gICAgdGhpcy5faW5MYXllclBhcnNlciA9IHRydWU7XG4gIH1cblxuICAvKipcbiAgICogR2l2ZW4gdGhlIG9sZFZhbHVlIGFuZCBuZXdWYWx1ZSBmb3IgcGFydGljaXBhbnRzLFxuICAgKiBnZW5lcmF0ZSBhIGxpc3Qgb2Ygd2hvbSB3YXMgYWRkZWQgYW5kIHdob20gd2FzIHJlbW92ZWQuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldFBhcnRpY2lwYW50Q2hhbmdlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLklkZW50aXR5W119IG5ld1ZhbHVlXG4gICAqIEBwYXJhbSAge2xheWVyLklkZW50aXR5W119IG9sZFZhbHVlXG4gICAqIEByZXR1cm4ge09iamVjdH0gUmV0dXJucyBjaGFuZ2VzIGluIHRoZSBmb3JtIG9mIGB7YWRkOiBbLi4uXSwgcmVtb3ZlOiBbLi4uXX1gXG4gICAqL1xuICBfZ2V0UGFydGljaXBhbnRDaGFuZ2UobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgY29uc3QgY2hhbmdlID0ge307XG4gICAgY2hhbmdlLmFkZCA9IG5ld1ZhbHVlLmZpbHRlcihwYXJ0aWNpcGFudCA9PiBvbGRWYWx1ZS5pbmRleE9mKHBhcnRpY2lwYW50KSA9PT0gLTEpO1xuICAgIGNoYW5nZS5yZW1vdmUgPSBvbGRWYWx1ZS5maWx0ZXIocGFydGljaXBhbnQgPT4gbmV3VmFsdWUuaW5kZXhPZihwYXJ0aWNpcGFudCkgPT09IC0xKTtcbiAgICByZXR1cm4gY2hhbmdlO1xuICB9XG5cblxuXG4gIC8qKlxuICAgKiBVcGRhdGVzIHNwZWNpZmllZCBtZXRhZGF0YSBrZXlzLlxuICAgKlxuICAgKiBVcGRhdGVzIHRoZSBsb2NhbCBvYmplY3QncyBtZXRhZGF0YSBhbmQgc3luY3MgdGhlIGNoYW5nZSB0byB0aGUgc2VydmVyLlxuICAgKlxuICAgKiAgICAgIGNvbnZlcnNhdGlvbi5zZXRNZXRhZGF0YVByb3BlcnRpZXMoe1xuICAgKiAgICAgICAgICAndGl0bGUnOiAnSSBhbSBhIHRpdGxlJyxcbiAgICogICAgICAgICAgJ2NvbG9ycy5iYWNrZ3JvdW5kJzogJ3JlZCcsXG4gICAqICAgICAgICAgICdjb2xvcnMudGV4dCc6IHtcbiAgICogICAgICAgICAgICAgICdmaWxsJzogJ2JsdWUnLFxuICAgKiAgICAgICAgICAgICAgJ3NoYWRvdyc6ICdibGFjaydcbiAgICogICAgICAgICAgIH0sXG4gICAqICAgICAgICAgICAnY29sb3JzLnRpdGxlLmZpbGwnOiAncmVkJ1xuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBVc2Ugc2V0TWV0YWRhdGFQcm9wZXJ0aWVzIHRvIHNwZWNpZnkgdGhlIHBhdGggdG8gYSBwcm9wZXJ0eSwgYW5kIGEgbmV3IHZhbHVlIGZvciB0aGF0IHByb3BlcnR5LlxuICAgKiBNdWx0aXBsZSBwcm9wZXJ0aWVzIGNhbiBiZSBjaGFuZ2VkIHRoaXMgd2F5LiAgV2hhdGV2ZXIgdmFsdWUgd2FzIHRoZXJlIGJlZm9yZSBpc1xuICAgKiByZXBsYWNlZCB3aXRoIHRoZSBuZXcgdmFsdWU7IHNvIGluIHRoZSBhYm92ZSBleGFtcGxlLCB3aGF0ZXZlciBvdGhlciBrZXlzIG1heSBoYXZlXG4gICAqIGV4aXN0ZWQgdW5kZXIgYGNvbG9ycy50ZXh0YCBoYXZlIGJlZW4gcmVwbGFjZWQgYnkgdGhlIG5ldyBvYmplY3QgYHtmaWxsOiAnYmx1ZScsIHNoYWRvdzogJ2JsYWNrJ31gLlxuICAgKlxuICAgKiBOb3RlIGFsc28gdGhhdCBvbmx5IHN0cmluZyBhbmQgc3Vib2JqZWN0cyBhcmUgYWNjZXB0ZWQgYXMgdmFsdWVzLlxuICAgKlxuICAgKiBLZXlzIHdpdGggJy4nIHdpbGwgdXBkYXRlIGEgZmllbGQgb2YgYW4gb2JqZWN0IChhbmQgY3JlYXRlIGFuIG9iamVjdCBpZiBpdCB3YXNuJ3QgdGhlcmUpOlxuICAgKlxuICAgKiBJbml0aWFsIG1ldGFkYXRhOiB7fVxuICAgKlxuICAgKiAgICAgIGNvbnZlcnNhdGlvbi5zZXRNZXRhZGF0YVByb3BlcnRpZXMoe1xuICAgKiAgICAgICAgICAnY29sb3JzLmJhY2tncm91bmQnOiAncmVkJyxcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogTWV0YWRhdGEgaXMgbm93OiBge2NvbG9yczoge2JhY2tncm91bmQ6ICdyZWQnfX1gXG4gICAqXG4gICAqICAgICAgY29udmVyc2F0aW9uLnNldE1ldGFkYXRhUHJvcGVydGllcyh7XG4gICAqICAgICAgICAgICdjb2xvcnMuZm9yZWdyb3VuZCc6ICdibGFjaycsXG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIE1ldGFkYXRhIGlzIG5vdzogYHtjb2xvcnM6IHtiYWNrZ3JvdW5kOiAncmVkJywgZm9yZWdyb3VuZDogJ2JsYWNrJ319YFxuICAgKlxuICAgKiBFeGVjdXRlcyBhcyBmb2xsb3dzOlxuICAgKlxuICAgKiAxLiBVcGRhdGVzIHRoZSBtZXRhZGF0YSBwcm9wZXJ0eSBvZiB0aGUgbG9jYWwgb2JqZWN0XG4gICAqIDIuIFRyaWdnZXJzIGEgY29udmVyc2F0aW9uczpjaGFuZ2UgZXZlbnRcbiAgICogMy4gU3VibWl0cyBhIHJlcXVlc3QgdG8gYmUgc2VudCB0byB0aGUgc2VydmVyIHRvIHVwZGF0ZSB0aGUgc2VydmVyJ3Mgb2JqZWN0XG4gICAqIDQuIElmIHRoZXJlIGlzIGFuIGVycm9yLCBubyBlcnJvcnMgYXJlIGZpcmVkIGV4Y2VwdCBieSBsYXllci5TeW5jTWFuYWdlciwgYnV0IGFub3RoZXJcbiAgICogICAgY29udmVyc2F0aW9uczpjaGFuZ2UgZXZlbnQgaXMgZmlyZWQgYXMgdGhlIGNoYW5nZSBpcyByb2xsZWQgYmFjay5cbiAgICpcbiAgICogQG1ldGhvZCBzZXRNZXRhZGF0YVByb3BlcnRpZXNcbiAgICogQHBhcmFtICB7T2JqZWN0fSBwcm9wZXJ0aWVzXG4gICAqIEByZXR1cm4ge2xheWVyLkNvbnZlcnNhdGlvbn0gdGhpc1xuICAgKlxuICAgKi9cbiAgc2V0TWV0YWRhdGFQcm9wZXJ0aWVzKHByb3BzKSB7XG4gICAgY29uc3QgbGF5ZXJQYXRjaE9wZXJhdGlvbnMgPSBbXTtcbiAgICBPYmplY3Qua2V5cyhwcm9wcykuZm9yRWFjaChuYW1lID0+IHtcbiAgICAgIGxldCBmdWxsTmFtZSA9IG5hbWU7XG4gICAgICBpZiAobmFtZSkge1xuICAgICAgICBpZiAobmFtZSAhPT0gJ21ldGFkYXRhJyAmJiBuYW1lLmluZGV4T2YoJ21ldGFkYXRhLicpICE9PSAwKSB7XG4gICAgICAgICAgZnVsbE5hbWUgPSAnbWV0YWRhdGEuJyArIG5hbWU7XG4gICAgICAgIH1cbiAgICAgICAgbGF5ZXJQYXRjaE9wZXJhdGlvbnMucHVzaCh7XG4gICAgICAgICAgb3BlcmF0aW9uOiAnc2V0JyxcbiAgICAgICAgICBwcm9wZXJ0eTogZnVsbE5hbWUsXG4gICAgICAgICAgdmFsdWU6IHByb3BzW25hbWVdLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuX2luTGF5ZXJQYXJzZXIgPSB0cnVlO1xuXG4gICAgLy8gRG8gdGhpcyBiZWZvcmUgc2V0U3luY2luZyBhcyBpZiB0aGVyZSBhcmUgYW55IGVycm9ycywgd2Ugc2hvdWxkIG5ldmVyIGV2ZW5cbiAgICAvLyBzdGFydCBzZXR0aW5nIHVwIGEgcmVxdWVzdC5cbiAgICBVdGlsLmxheWVyUGFyc2Uoe1xuICAgICAgb2JqZWN0OiB0aGlzLFxuICAgICAgdHlwZTogJ0NvbnZlcnNhdGlvbicsXG4gICAgICBvcGVyYXRpb25zOiBsYXllclBhdGNoT3BlcmF0aW9ucyxcbiAgICAgIGNsaWVudDogdGhpcy5nZXRDbGllbnQoKSxcbiAgICB9KTtcbiAgICB0aGlzLl9pbkxheWVyUGFyc2VyID0gZmFsc2U7XG5cbiAgICB0aGlzLl94aHIoe1xuICAgICAgdXJsOiAnJyxcbiAgICAgIG1ldGhvZDogJ1BBVENIJyxcbiAgICAgIGRhdGE6IEpTT04uc3RyaW5naWZ5KGxheWVyUGF0Y2hPcGVyYXRpb25zKSxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ2NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi92bmQubGF5ZXItcGF0Y2granNvbicsXG4gICAgICB9LFxuICAgIH0sIHJlc3VsdCA9PiB7XG4gICAgICBpZiAoIXJlc3VsdC5zdWNjZXNzICYmICF0aGlzLmlzRGVzdHJveWVkKSB0aGlzLl9sb2FkKCk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG5cbiAgLyoqXG4gICAqIERlbGV0ZXMgc3BlY2lmaWVkIG1ldGFkYXRhIGtleXMuXG4gICAqXG4gICAqIFVwZGF0ZXMgdGhlIGxvY2FsIG9iamVjdCdzIG1ldGFkYXRhIGFuZCBzeW5jcyB0aGUgY2hhbmdlIHRvIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqICAgICAgY29udmVyc2F0aW9uLmRlbGV0ZU1ldGFkYXRhUHJvcGVydGllcyhcbiAgICogICAgICAgICAgWyd0aXRsZScsICdjb2xvcnMuYmFja2dyb3VuZCcsICdjb2xvcnMudGl0bGUuZmlsbCddXG4gICAqICAgICAgKTtcbiAgICpcbiAgICogVXNlIGRlbGV0ZU1ldGFkYXRhUHJvcGVydGllcyB0byBzcGVjaWZ5IHBhdGhzIHRvIHByb3BlcnRpZXMgdG8gYmUgZGVsZXRlZC5cbiAgICogTXVsdGlwbGUgcHJvcGVydGllcyBjYW4gYmUgZGVsZXRlZC5cbiAgICpcbiAgICogRXhlY3V0ZXMgYXMgZm9sbG93czpcbiAgICpcbiAgICogMS4gVXBkYXRlcyB0aGUgbWV0YWRhdGEgcHJvcGVydHkgb2YgdGhlIGxvY2FsIG9iamVjdFxuICAgKiAyLiBUcmlnZ2VycyBhIGNvbnZlcnNhdGlvbnM6Y2hhbmdlIGV2ZW50XG4gICAqIDMuIFN1Ym1pdHMgYSByZXF1ZXN0IHRvIGJlIHNlbnQgdG8gdGhlIHNlcnZlciB0byB1cGRhdGUgdGhlIHNlcnZlcidzIG9iamVjdFxuICAgKiA0LiBJZiB0aGVyZSBpcyBhbiBlcnJvciwgbm8gZXJyb3JzIGFyZSBmaXJlZCBleGNlcHQgYnkgbGF5ZXIuU3luY01hbmFnZXIsIGJ1dCBhbm90aGVyXG4gICAqICAgIGNvbnZlcnNhdGlvbnM6Y2hhbmdlIGV2ZW50IGlzIGZpcmVkIGFzIHRoZSBjaGFuZ2UgaXMgcm9sbGVkIGJhY2suXG4gICAqXG4gICAqIEBtZXRob2QgZGVsZXRlTWV0YWRhdGFQcm9wZXJ0aWVzXG4gICAqIEBwYXJhbSAge3N0cmluZ1tdfSBwcm9wZXJ0aWVzXG4gICAqIEByZXR1cm4ge2xheWVyLkNvbnZlcnNhdGlvbn0gdGhpc1xuICAgKi9cbiAgZGVsZXRlTWV0YWRhdGFQcm9wZXJ0aWVzKHByb3BzKSB7XG4gICAgY29uc3QgbGF5ZXJQYXRjaE9wZXJhdGlvbnMgPSBbXTtcbiAgICBwcm9wcy5mb3JFYWNoKHByb3BlcnR5ID0+IHtcbiAgICAgIGlmIChwcm9wZXJ0eSAhPT0gJ21ldGFkYXRhJyAmJiBwcm9wZXJ0eS5pbmRleE9mKCdtZXRhZGF0YS4nKSAhPT0gMCkge1xuICAgICAgICBwcm9wZXJ0eSA9ICdtZXRhZGF0YS4nICsgcHJvcGVydHk7XG4gICAgICB9XG4gICAgICBsYXllclBhdGNoT3BlcmF0aW9ucy5wdXNoKHtcbiAgICAgICAgb3BlcmF0aW9uOiAnZGVsZXRlJyxcbiAgICAgICAgcHJvcGVydHksXG4gICAgICB9KTtcbiAgICB9LCB0aGlzKTtcblxuICAgIHRoaXMuX2luTGF5ZXJQYXJzZXIgPSB0cnVlO1xuXG4gICAgLy8gRG8gdGhpcyBiZWZvcmUgc2V0U3luY2luZyBhcyBpZiB0aGVyZSBhcmUgYW55IGVycm9ycywgd2Ugc2hvdWxkIG5ldmVyIGV2ZW5cbiAgICAvLyBzdGFydCBzZXR0aW5nIHVwIGEgcmVxdWVzdC5cbiAgICBVdGlsLmxheWVyUGFyc2Uoe1xuICAgICAgb2JqZWN0OiB0aGlzLFxuICAgICAgdHlwZTogJ0NvbnZlcnNhdGlvbicsXG4gICAgICBvcGVyYXRpb25zOiBsYXllclBhdGNoT3BlcmF0aW9ucyxcbiAgICAgIGNsaWVudDogdGhpcy5nZXRDbGllbnQoKSxcbiAgICB9KTtcbiAgICB0aGlzLl9pbkxheWVyUGFyc2VyID0gZmFsc2U7XG5cbiAgICB0aGlzLl94aHIoe1xuICAgICAgdXJsOiAnJyxcbiAgICAgIG1ldGhvZDogJ1BBVENIJyxcbiAgICAgIGRhdGE6IEpTT04uc3RyaW5naWZ5KGxheWVyUGF0Y2hPcGVyYXRpb25zKSxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ2NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi92bmQubGF5ZXItcGF0Y2granNvbicsXG4gICAgICB9LFxuICAgIH0sIHJlc3VsdCA9PiB7XG4gICAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB0aGlzLl9sb2FkKCk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIF9nZXRVcmwodXJsKSB7XG4gICAgcmV0dXJuIHRoaXMudXJsICsgKHVybCB8fCAnJyk7XG4gIH1cblxuICBfbG9hZGVkKGRhdGEpIHtcbiAgICB0aGlzLmdldENsaWVudCgpLl9hZGRDb252ZXJzYXRpb24odGhpcyk7XG4gIH1cblxuICAvKipcbiAgICogU3RhbmRhcmQgYG9uKClgIHByb3ZpZGVkIGJ5IGxheWVyLlJvb3QuXG4gICAqXG4gICAqIEFkZHMgc29tZSBzcGVjaWFsIGhhbmRsaW5nIG9mICdjb252ZXJzYXRpb25zOmxvYWRlZCcgc28gdGhhdCBjYWxscyBzdWNoIGFzXG4gICAqXG4gICAqICAgICAgdmFyIGMgPSBjbGllbnQuZ2V0Q29udmVyc2F0aW9uKCdsYXllcjovLy9jb252ZXJzYXRpb25zLzEyMycsIHRydWUpXG4gICAqICAgICAgLm9uKCdjb252ZXJzYXRpb25zOmxvYWRlZCcsIGZ1bmN0aW9uKCkge1xuICAgKiAgICAgICAgICBteXJlcmVuZGVyKGMpO1xuICAgKiAgICAgIH0pO1xuICAgKiAgICAgIG15cmVuZGVyKGMpOyAvLyByZW5kZXIgYSBwbGFjZWhvbGRlciBmb3IgYyB1bnRpbCB0aGUgZGV0YWlscyBvZiBjIGhhdmUgbG9hZGVkXG4gICAqXG4gICAqIGNhbiBmaXJlIHRoZWlyIGNhbGxiYWNrIHJlZ2FyZGxlc3Mgb2Ygd2hldGhlciB0aGUgY2xpZW50IGxvYWRzIG9yIGhhc1xuICAgKiBhbHJlYWR5IGxvYWRlZCB0aGUgQ29udmVyc2F0aW9uLlxuICAgKlxuICAgKiBAbWV0aG9kIG9uXG4gICAqIEBwYXJhbSAge3N0cmluZ30gZXZlbnROYW1lXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0gIHtPYmplY3R9IGNvbnRleHRcbiAgICogQHJldHVybiB7bGF5ZXIuQ29udmVyc2F0aW9ufSB0aGlzXG4gICAqL1xuICBvbihuYW1lLCBjYWxsYmFjaywgY29udGV4dCkge1xuICAgIGNvbnN0IGhhc0xvYWRlZEV2dCA9IG5hbWUgPT09ICdjb252ZXJzYXRpb25zOmxvYWRlZCcgfHxcbiAgICAgIG5hbWUgJiYgdHlwZW9mIG5hbWUgPT09ICdvYmplY3QnICYmIG5hbWVbJ2NvbnZlcnNhdGlvbnM6bG9hZGVkJ107XG5cbiAgICBpZiAoaGFzTG9hZGVkRXZ0ICYmICF0aGlzLmlzTG9hZGluZykge1xuICAgICAgY29uc3QgY2FsbE5vdyA9IG5hbWUgPT09ICdjb252ZXJzYXRpb25zOmxvYWRlZCcgPyBjYWxsYmFjayA6IG5hbWVbJ2NvbnZlcnNhdGlvbnM6bG9hZGVkJ107XG4gICAgICBVdGlsLmRlZmVyKCgpID0+IGNhbGxOb3cuYXBwbHkoY29udGV4dCkpO1xuICAgIH1cbiAgICBzdXBlci5vbihuYW1lLCBjYWxsYmFjaywgY29udGV4dCk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qXG4gICAqIEluc3VyZSB0aGF0IGNvbnZlcnNhdGlvbi51bnJlYWRDb3VudC0tIGNhbiBuZXZlciByZWR1Y2UgdGhlIHZhbHVlIHRvIG5lZ2F0aXZlIHZhbHVlcy5cbiAgICovXG4gIF9fYWRqdXN0VW5yZWFkQ291bnQobmV3VmFsdWUpIHtcbiAgICBpZiAobmV3VmFsdWUgPCAwKSByZXR1cm4gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBfXyBNZXRob2RzIGFyZSBhdXRvbWF0aWNhbGx5IGNhbGxlZCBieSBwcm9wZXJ0eSBzZXR0ZXJzLlxuICAgKlxuICAgKiBBbnkgY2hhbmdlIGluIHRoZSB1bnJlYWRDb3VudCBwcm9wZXJ0eSB3aWxsIGNhbGwgdGhpcyBtZXRob2QgYW5kIGZpcmUgYVxuICAgKiBjaGFuZ2UgZXZlbnQuXG4gICAqXG4gICAqIEFueSB0cmlnZ2VyaW5nIG9mIHRoaXMgZnJvbSBhIHdlYnNvY2tldCBwYXRjaCB1bnJlYWRfbWVzc2FnZV9jb3VudCBzaG91bGQgd2FpdCBhIHNlY29uZCBiZWZvcmUgZmlyaW5nIGFueSBldmVudHNcbiAgICogc28gdGhhdCBpZiB0aGVyZSBhcmUgYSBzZXJpZXMgb2YgdGhlc2UgdXBkYXRlcywgd2UgZG9uJ3Qgc2VlIGEgbG90IG9mIGppdHRlci5cbiAgICpcbiAgICogTk9URTogX29sZFVucmVhZENvdW50IGlzIHVzZWQgdG8gcGFzcyBkYXRhIHRvIF91cGRhdGVVbnJlYWRDb3VudEV2ZW50IGJlY2F1c2UgdGhpcyBtZXRob2QgY2FuIGJlIGNhbGxlZCBtYW55IHRpbWVzXG4gICAqIGEgc2Vjb25kLCBhbmQgd2Ugb25seSB3YW50IHRvIHRyaWdnZXIgdGhpcyB3aXRoIGEgc3VtbWFyeSBvZiBjaGFuZ2VzIHJhdGhlciB0aGFuIGVhY2ggaW5kaXZpZHVhbCBjaGFuZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgX191cGRhdGVVbnJlYWRDb3VudFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtudW1iZXJ9IG5ld1ZhbHVlXG4gICAqIEBwYXJhbSAge251bWJlcn0gb2xkVmFsdWVcbiAgICovXG4gIF9fdXBkYXRlVW5yZWFkQ291bnQobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgaWYgKHRoaXMuX2luTGF5ZXJQYXJzZXIpIHtcbiAgICAgIGlmICh0aGlzLl9vbGRVbnJlYWRDb3VudCA9PT0gdW5kZWZpbmVkKSB0aGlzLl9vbGRVbnJlYWRDb3VudCA9IG9sZFZhbHVlO1xuICAgICAgaWYgKHRoaXMuX3VwZGF0ZVVucmVhZENvdW50VGltZW91dCkgY2xlYXJUaW1lb3V0KHRoaXMuX3VwZGF0ZVVucmVhZENvdW50VGltZW91dCk7XG4gICAgICB0aGlzLl91cGRhdGVVbnJlYWRDb3VudFRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHRoaXMuX3VwZGF0ZVVucmVhZENvdW50RXZlbnQoKSwgMTAwMCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3VwZGF0ZVVucmVhZENvdW50RXZlbnQoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRmlyZSBldmVudHMgcmVsYXRlZCB0byBjaGFuZ2VzIHRvIHVucmVhZENvdW50XG4gICAqXG4gICAqIEBtZXRob2QgX3VwZGF0ZVVucmVhZENvdW50RXZlbnRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF91cGRhdGVVbnJlYWRDb3VudEV2ZW50KCkge1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkKSByZXR1cm47XG4gICAgY29uc3Qgb2xkVmFsdWUgPSB0aGlzLl9vbGRVbnJlYWRDb3VudDtcbiAgICBjb25zdCBuZXdWYWx1ZSA9IHRoaXMuX191bnJlYWRDb3VudDtcbiAgICB0aGlzLl9vbGRVbnJlYWRDb3VudCA9IHVuZGVmaW5lZDtcblxuICAgIGlmIChuZXdWYWx1ZSA9PT0gb2xkVmFsdWUpIHJldHVybjtcbiAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2NvbnZlcnNhdGlvbnM6Y2hhbmdlJywge1xuICAgICAgbmV3VmFsdWUsXG4gICAgICBvbGRWYWx1ZSxcbiAgICAgIHByb3BlcnR5OiAndW5yZWFkQ291bnQnLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIF9fIE1ldGhvZHMgYXJlIGF1dG9tYXRpY2FsbHkgY2FsbGVkIGJ5IHByb3BlcnR5IHNldHRlcnMuXG4gICAqXG4gICAqIEFueSBjaGFuZ2UgaW4gdGhlIGxhc3RNZXNzYWdlIHBvaW50ZXIgd2lsbCBjYWxsIHRoaXMgbWV0aG9kIGFuZCBmaXJlIGFcbiAgICogY2hhbmdlIGV2ZW50LiAgQ2hhbmdlcyB0byBwcm9wZXJ0aWVzIHdpdGhpbiB0aGUgbGFzdE1lc3NhZ2Ugb2JqZWN0IHdpbGxcbiAgICogbm90IHRyaWdnZXIgdGhpcyBjYWxsLlxuICAgKlxuICAgKiBAbWV0aG9kIF9fdXBkYXRlTGFzdE1lc3NhZ2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bGF5ZXIuTWVzc2FnZX0gbmV3VmFsdWVcbiAgICogQHBhcmFtICB7bGF5ZXIuTWVzc2FnZX0gb2xkVmFsdWVcbiAgICovXG4gIF9fdXBkYXRlTGFzdE1lc3NhZ2UobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgaWYgKG5ld1ZhbHVlICYmIG9sZFZhbHVlICYmIG5ld1ZhbHVlLmlkID09PSBvbGRWYWx1ZS5pZCkgcmV0dXJuO1xuICAgIHRoaXMuX3RyaWdnZXJBc3luYygnY29udmVyc2F0aW9uczpjaGFuZ2UnLCB7XG4gICAgICBwcm9wZXJ0eTogJ2xhc3RNZXNzYWdlJyxcbiAgICAgIG5ld1ZhbHVlLFxuICAgICAgb2xkVmFsdWUsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogX18gTWV0aG9kcyBhcmUgYXV0b21hdGljYWxseSBjYWxsZWQgYnkgcHJvcGVydHkgc2V0dGVycy5cbiAgICpcbiAgICogQW55IGNoYW5nZSBpbiB0aGUgcGFydGljaXBhbnRzIHByb3BlcnR5IHdpbGwgY2FsbCB0aGlzIG1ldGhvZCBhbmQgZmlyZSBhXG4gICAqIGNoYW5nZSBldmVudC4gIENoYW5nZXMgdG8gdGhlIHBhcnRpY2lwYW50cyBhcnJheSB0aGF0IGRvbid0IHJlcGxhY2UgdGhlIGFycmF5XG4gICAqIHdpdGggYSBuZXcgYXJyYXkgd2lsbCByZXF1aXJlIGRpcmVjdGx5IGNhbGxpbmcgdGhpcyBtZXRob2QuXG4gICAqXG4gICAqIEBtZXRob2QgX191cGRhdGVQYXJ0aWNpcGFudHNcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7c3RyaW5nW119IG5ld1ZhbHVlXG4gICAqIEBwYXJhbSAge3N0cmluZ1tdfSBvbGRWYWx1ZVxuICAgKi9cbiAgX191cGRhdGVQYXJ0aWNpcGFudHMobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgaWYgKHRoaXMuX2luTGF5ZXJQYXJzZXIpIHJldHVybjtcbiAgICBjb25zdCBjaGFuZ2UgPSB0aGlzLl9nZXRQYXJ0aWNpcGFudENoYW5nZShuZXdWYWx1ZSwgb2xkVmFsdWUpO1xuICAgIGlmIChjaGFuZ2UuYWRkLmxlbmd0aCB8fCBjaGFuZ2UucmVtb3ZlLmxlbmd0aCkge1xuICAgICAgY2hhbmdlLnByb3BlcnR5ID0gJ3BhcnRpY2lwYW50cyc7XG4gICAgICBjaGFuZ2Uub2xkVmFsdWUgPSBvbGRWYWx1ZTtcbiAgICAgIGNoYW5nZS5uZXdWYWx1ZSA9IG5ld1ZhbHVlO1xuICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdjb252ZXJzYXRpb25zOmNoYW5nZScsIGNoYW5nZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIF9fIE1ldGhvZHMgYXJlIGF1dG9tYXRpY2FsbHkgY2FsbGVkIGJ5IHByb3BlcnR5IHNldHRlcnMuXG4gICAqXG4gICAqIEFueSBjaGFuZ2UgaW4gdGhlIG1ldGFkYXRhIHByb3BlcnR5IHdpbGwgY2FsbCB0aGlzIG1ldGhvZCBhbmQgZmlyZSBhXG4gICAqIGNoYW5nZSBldmVudC4gIENoYW5nZXMgdG8gdGhlIG1ldGFkYXRhIG9iamVjdCB0aGF0IGRvbid0IHJlcGxhY2UgdGhlIG9iamVjdFxuICAgKiB3aXRoIGEgbmV3IG9iamVjdCB3aWxsIHJlcXVpcmUgZGlyZWN0bHkgY2FsbGluZyB0aGlzIG1ldGhvZC5cbiAgICpcbiAgICogQG1ldGhvZCBfX3VwZGF0ZU1ldGFkYXRhXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gbmV3VmFsdWVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvbGRWYWx1ZVxuICAgKi9cbiAgX191cGRhdGVNZXRhZGF0YShuZXdWYWx1ZSwgb2xkVmFsdWUsIHBhdGhzKSB7XG4gICAgaWYgKHRoaXMuX2luTGF5ZXJQYXJzZXIpIHJldHVybjtcbiAgICBpZiAoSlNPTi5zdHJpbmdpZnkobmV3VmFsdWUpICE9PSBKU09OLnN0cmluZ2lmeShvbGRWYWx1ZSkpIHtcbiAgICAgIHRoaXMuX3RyaWdnZXJBc3luYygnY29udmVyc2F0aW9uczpjaGFuZ2UnLCB7XG4gICAgICAgIHByb3BlcnR5OiAnbWV0YWRhdGEnLFxuICAgICAgICBuZXdWYWx1ZSxcbiAgICAgICAgb2xkVmFsdWUsXG4gICAgICAgIHBhdGhzLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBwbGFpbiBvYmplY3QuXG4gICAqXG4gICAqIE9iamVjdCB3aWxsIGhhdmUgYWxsIHRoZSBzYW1lIHB1YmxpYyBwcm9wZXJ0aWVzIGFzIHRoaXNcbiAgICogQ29udmVyc2F0aW9uIGluc3RhbmNlLiAgTmV3IG9iamVjdCBpcyByZXR1cm5lZCBhbnkgdGltZVxuICAgKiBhbnkgb2YgdGhpcyBvYmplY3QncyBwcm9wZXJ0aWVzIGNoYW5nZS5cbiAgICpcbiAgICogQG1ldGhvZCB0b09iamVjdFxuICAgKiBAcmV0dXJuIHtPYmplY3R9IFBPSk8gdmVyc2lvbiBvZiB0aGlzLlxuICAgKi9cbiAgdG9PYmplY3QoKSB7XG4gICAgaWYgKCF0aGlzLl90b09iamVjdCkge1xuICAgICAgdGhpcy5fdG9PYmplY3QgPSBzdXBlci50b09iamVjdCgpO1xuICAgICAgdGhpcy5fdG9PYmplY3QubWV0YWRhdGEgPSBVdGlsLmNsb25lKHRoaXMubWV0YWRhdGEpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fdG9PYmplY3Q7XG4gIH1cblxuICBfdHJpZ2dlckFzeW5jKGV2dE5hbWUsIGFyZ3MpIHtcbiAgICB0aGlzLl9jbGVhck9iamVjdCgpO1xuICAgIHN1cGVyLl90cmlnZ2VyQXN5bmMoZXZ0TmFtZSwgYXJncyk7XG4gIH1cblxuICB0cmlnZ2VyKGV2dE5hbWUsIGFyZ3MpIHtcbiAgICB0aGlzLl9jbGVhck9iamVjdCgpO1xuICAgIHN1cGVyLnRyaWdnZXIoZXZ0TmFtZSwgYXJncyk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgY29udmVyc2F0aW9uIGluc3RhbmNlIGZyb20gYSBzZXJ2ZXIgcmVwcmVzZW50YXRpb24gb2YgdGhlIGNvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogSWYgdGhlIENvbnZlcnNhdGlvbiBhbHJlYWR5IGV4aXN0cywgd2lsbCB1cGRhdGUgdGhlIGV4aXN0aW5nIGNvcHkgd2l0aFxuICAgKiBwcmVzdW1hYmx5IG5ld2VyIHZhbHVlcy5cbiAgICpcbiAgICogQG1ldGhvZCBfY3JlYXRlRnJvbVNlcnZlclxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBzdGF0aWNcbiAgICogQHBhcmFtICB7T2JqZWN0fSBjb252ZXJzYXRpb24gLSBTZXJ2ZXIgcmVwcmVzZW50YXRpb24gb2YgYSBDb252ZXJzYXRpb25cbiAgICogQHBhcmFtICB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAgICogQHJldHVybiB7bGF5ZXIuQ29udmVyc2F0aW9ufVxuICAgKi9cbiAgc3RhdGljIF9jcmVhdGVGcm9tU2VydmVyKGNvbnZlcnNhdGlvbiwgY2xpZW50KSB7XG4gICAgcmV0dXJuIG5ldyBDb252ZXJzYXRpb24oe1xuICAgICAgY2xpZW50LFxuICAgICAgZnJvbVNlcnZlcjogY29udmVyc2F0aW9uLFxuICAgICAgX2Zyb21EQjogY29udmVyc2F0aW9uLl9mcm9tREIsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogRmluZCBvciBjcmVhdGUgYSBuZXcgY29udmVyYXRpb24uXG4gICAqXG4gICAqICAgICAgdmFyIGNvbnZlcnNhdGlvbiA9IGxheWVyLkNvbnZlcnNhdGlvbi5jcmVhdGUoe1xuICAgKiAgICAgICAgICBwYXJ0aWNpcGFudHM6IFsnYScsICdiJ10sXG4gICAqICAgICAgICAgIGRpc3RpbmN0OiB0cnVlLFxuICAgKiAgICAgICAgICBtZXRhZGF0YToge1xuICAgKiAgICAgICAgICAgICAgdGl0bGU6ICdJIGFtIG5vdCBhIHRpdGxlISdcbiAgICogICAgICAgICAgfSxcbiAgICogICAgICAgICAgY2xpZW50OiBjbGllbnQsXG4gICAqICAgICAgICAgICdjb252ZXJzYXRpb25zOmxvYWRlZCc6IGZ1bmN0aW9uKGV2dCkge1xuICAgKlxuICAgKiAgICAgICAgICB9XG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIE9ubHkgdHJpZXMgdG8gZmluZCBhIENvbnZlcnNhdGlvbiBpZiBpdHMgYSBEaXN0aW5jdCBDb252ZXJzYXRpb24uXG4gICAqIERpc3RpbmN0IGRlZmF1bHRzIHRvIHRydWUuXG4gICAqXG4gICAqIFJlY29tbWVuZCB1c2luZyBgY2xpZW50LmNyZWF0ZUNvbnZlcnNhdGlvbih7Li4ufSlgXG4gICAqIGluc3RlYWQgb2YgYENvbnZlcnNhdGlvbi5jcmVhdGUoey4uLn0pYC5cbiAgICpcbiAgICogQG1ldGhvZCBjcmVhdGVcbiAgICogQHN0YXRpY1xuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcGFyYW0gIHtsYXllci5DbGllbnR9IG9wdGlvbnMuY2xpZW50XG4gICAqIEBwYXJhbSAge3N0cmluZ1tdL2xheWVyLklkZW50aXR5W119IG9wdGlvbnMucGFydGljaXBhbnRzIC0gQXJyYXkgb2YgUGFydGljaXBhbnQgSURzIG9yIGxheWVyLklkZW50aXR5IG9iamVjdHMgdG8gY3JlYXRlIGEgY29udmVyc2F0aW9uIHdpdGguXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZGlzdGluY3Q9dHJ1ZV0gLSBDcmVhdGUgYSBkaXN0aW5jdCBjb252ZXJzYXRpb25cbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLm1ldGFkYXRhPXt9XSAtIEluaXRpYWwgbWV0YWRhdGEgZm9yIENvbnZlcnNhdGlvblxuICAgKiBAcmV0dXJuIHtsYXllci5Db252ZXJzYXRpb259XG4gICAqL1xuICBzdGF0aWMgY3JlYXRlKG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMuY2xpZW50KSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmNsaWVudE1pc3NpbmcpO1xuICAgIGNvbnN0IG5ld09wdGlvbnMgPSB7XG4gICAgICBkaXN0aW5jdDogb3B0aW9ucy5kaXN0aW5jdCxcbiAgICAgIHBhcnRpY2lwYW50czogb3B0aW9ucy5jbGllbnQuX2ZpeElkZW50aXRpZXMob3B0aW9ucy5wYXJ0aWNpcGFudHMpLFxuICAgICAgbWV0YWRhdGE6IG9wdGlvbnMubWV0YWRhdGEsXG4gICAgICBjbGllbnQ6IG9wdGlvbnMuY2xpZW50LFxuICAgIH07XG4gICAgaWYgKG5ld09wdGlvbnMuZGlzdGluY3QpIHtcbiAgICAgIGNvbnN0IGNvbnYgPSB0aGlzLl9jcmVhdGVEaXN0aW5jdChuZXdPcHRpb25zKTtcbiAgICAgIGlmIChjb252KSByZXR1cm4gY29udjtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBDb252ZXJzYXRpb24obmV3T3B0aW9ucyk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIG9yIEZpbmQgYSBEaXN0aW5jdCBDb252ZXJzYXRpb24uXG4gICAqXG4gICAqIElmIHRoZSBzdGF0aWMgQ29udmVyc2F0aW9uLmNyZWF0ZSBtZXRob2QgZ2V0cyBhIHJlcXVlc3QgZm9yIGEgRGlzdGluY3QgQ29udmVyc2F0aW9uLFxuICAgKiBzZWUgaWYgd2UgaGF2ZSBvbmUgY2FjaGVkLlxuICAgKlxuICAgKiBXaWxsIGZpcmUgdGhlICdjb252ZXJzYXRpb25zOmxvYWRlZCcgZXZlbnQgaWYgb25lIGlzIHByb3ZpZGVkIGluIHRoaXMgY2FsbCxcbiAgICogYW5kIGEgQ29udmVyc2F0aW9uIGlzIGZvdW5kLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVEaXN0aW5jdFxuICAgKiBAc3RhdGljXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9ucyAtIFNlZSBsYXllci5Db252ZXJzYXRpb24uY3JlYXRlIG9wdGlvbnM7IHBhcnRpY2lwYW50cyBtdXN0IGJlIGxheWVyLklkZW50aXR5W11cbiAgICogQHJldHVybiB7bGF5ZXIuQ29udmVyc2F0aW9ufVxuICAgKi9cbiAgc3RhdGljIF9jcmVhdGVEaXN0aW5jdChvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMucGFydGljaXBhbnRzLmluZGV4T2Yob3B0aW9ucy5jbGllbnQudXNlcikgPT09IC0xKSB7XG4gICAgICBvcHRpb25zLnBhcnRpY2lwYW50cy5wdXNoKG9wdGlvbnMuY2xpZW50LnVzZXIpO1xuICAgIH1cblxuICAgIGNvbnN0IHBhcnRpY2lwYW50c0hhc2ggPSB7fTtcbiAgICBvcHRpb25zLnBhcnRpY2lwYW50cy5mb3JFYWNoKChwYXJ0aWNpcGFudCkgPT4ge1xuICAgICAgcGFydGljaXBhbnRzSGFzaFtwYXJ0aWNpcGFudC5pZF0gPSBwYXJ0aWNpcGFudDtcbiAgICB9KTtcblxuICAgIGNvbnN0IGNvbnYgPSBvcHRpb25zLmNsaWVudC5maW5kQ2FjaGVkQ29udmVyc2F0aW9uKGFDb252ID0+IHtcbiAgICAgIGlmIChhQ29udi5kaXN0aW5jdCAmJiBhQ29udi5wYXJ0aWNpcGFudHMubGVuZ3RoID09PSBvcHRpb25zLnBhcnRpY2lwYW50cy5sZW5ndGgpIHtcbiAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IGFDb252LnBhcnRpY2lwYW50cy5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgICBpZiAoIXBhcnRpY2lwYW50c0hhc2hbYUNvbnYucGFydGljaXBhbnRzW2luZGV4XS5pZF0pIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChjb252KSB7XG4gICAgICBjb252Ll9zZW5kRGlzdGluY3RFdmVudCA9IG5ldyBMYXllckV2ZW50KHtcbiAgICAgICAgdGFyZ2V0OiBjb252LFxuICAgICAgICByZXN1bHQ6ICFvcHRpb25zLm1ldGFkYXRhIHx8IFV0aWwuZG9lc09iamVjdE1hdGNoKG9wdGlvbnMubWV0YWRhdGEsIGNvbnYubWV0YWRhdGEpID9cbiAgICAgICAgICBDb252ZXJzYXRpb24uRk9VTkQgOiBDb252ZXJzYXRpb24uRk9VTkRfV0lUSE9VVF9SRVFVRVNURURfTUVUQURBVEEsXG4gICAgICB9LCAnY29udmVyc2F0aW9uczpzZW50Jyk7XG4gICAgICByZXR1cm4gY29udjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSWRlbnRpZmllcyB3aGV0aGVyIGEgQ29udmVyc2F0aW9uIHJlY2VpdmluZyB0aGUgc3BlY2lmaWVkIHBhdGNoIGRhdGEgc2hvdWxkIGJlIGxvYWRlZCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEFueSBjaGFuZ2UgdG8gYSBDb252ZXJzYXRpb24gaW5kaWNhdGVzIHRoYXQgdGhlIENvbnZlcnNhdGlvbiBpcyBhY3RpdmUgYW5kIG9mIHBvdGVudGlhbCBpbnRlcmVzdDsgZ28gYWhlYWQgYW5kIGxvYWQgdGhhdFxuICAgKiBDb252ZXJzYXRpb24gaW4gY2FzZSB0aGUgYXBwIGhhcyBuZWVkIG9mIGl0LiAgSW4gdGhlIGZ1dHVyZSB3ZSBtYXkgaWdub3JlIGNoYW5nZXMgdG8gdW5yZWFkIGNvdW50LiAgT25seSByZWxldmFudFxuICAgKiB3aGVuIHdlIGdldCBXZWJzb2NrZXQgZXZlbnRzIGZvciBhIENvbnZlcnNhdGlvbiB0aGF0IGhhcyBub3QgYmVlbiBsb2FkZWQvY2FjaGVkIG9uIENsaWVudC5cbiAgICpcbiAgICogQG1ldGhvZCBfbG9hZFJlc291cmNlRm9yUGF0Y2hcbiAgICogQHN0YXRpY1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgc3RhdGljIF9sb2FkUmVzb3VyY2VGb3JQYXRjaChwYXRjaERhdGEpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuXG4vKipcbiAqIEFycmF5IG9mIHBhcnRpY2lwYW50IGlkcy5cbiAqXG4gKiBEbyBub3QgZGlyZWN0bHkgbWFuaXB1bGF0ZTtcbiAqIHVzZSBhZGRQYXJ0aWNpcGFudHMsIHJlbW92ZVBhcnRpY2lwYW50cyBhbmQgcmVwbGFjZVBhcnRpY2lwYW50c1xuICogdG8gbWFuaXB1bGF0ZSB0aGUgYXJyYXkuXG4gKlxuICogQHR5cGUge2xheWVyLklkZW50aXR5W119XG4gKi9cbkNvbnZlcnNhdGlvbi5wcm90b3R5cGUucGFydGljaXBhbnRzID0gbnVsbDtcblxuLyoqXG4gKiBUaW1lIHRoYXQgdGhlIGNvbnZlcnNhdGlvbiB3YXMgY3JlYXRlZCBvbiB0aGUgc2VydmVyLlxuICpcbiAqIEB0eXBlIHtEYXRlfVxuICovXG5Db252ZXJzYXRpb24ucHJvdG90eXBlLmNyZWF0ZWRBdCA9IG51bGw7XG5cbi8qKlxuICogTnVtYmVyIG9mIHVucmVhZCBtZXNzYWdlcyBpbiB0aGUgY29udmVyc2F0aW9uLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbkNvbnZlcnNhdGlvbi5wcm90b3R5cGUudW5yZWFkQ291bnQgPSAwO1xuXG4vKipcbiAqIFRoaXMgaXMgYSBEaXN0aW5jdCBDb252ZXJzYXRpb24uXG4gKlxuICogWW91IGNhbiBoYXZlIDEgZGlzdGluY3QgY29udmVyc2F0aW9uIGFtb25nIGEgc2V0IG9mIHBhcnRpY2lwYW50cy5cbiAqIFRoZXJlIGFyZSBubyBsaW1pdHMgdG8gaG93IG1hbnkgbm9uLWRpc3RpbmN0IENvbnZlcnNhdGlvbnMgeW91IGhhdmUgaGF2ZVxuICogYW1vbmcgYSBzZXQgb2YgcGFydGljaXBhbnRzLlxuICpcbiAqIEB0eXBlIHtib29sZWFufVxuICovXG5Db252ZXJzYXRpb24ucHJvdG90eXBlLmRpc3RpbmN0ID0gdHJ1ZTtcblxuLyoqXG4gKiBNZXRhZGF0YSBmb3IgdGhlIGNvbnZlcnNhdGlvbi5cbiAqXG4gKiBNZXRhZGF0YSB2YWx1ZXMgY2FuIGJlIHBsYWluIG9iamVjdHMgYW5kIHN0cmluZ3MsIGJ1dFxuICogbm8gYXJyYXlzLCBudW1iZXJzLCBib29sZWFucyBvciBkYXRlcy5cbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cbkNvbnZlcnNhdGlvbi5wcm90b3R5cGUubWV0YWRhdGEgPSBudWxsO1xuXG5cbi8qKlxuICogVGhlIGF1dGhlbnRpY2F0ZWQgdXNlciBpcyBhIGN1cnJlbnQgcGFydGljaXBhbnQgaW4gdGhpcyBDb252ZXJzYXRpb24uXG4gKlxuICogU2V0IHRvIGZhbHNlIGlmIHRoZSBhdXRoZW50aWNhdGVkIHVzZXIgaGFzIGJlZW4gcmVtb3ZlZCBmcm9tIHRoaXMgY29udmVyc2F0aW9uLlxuICpcbiAqIEEgcmVtb3ZlZCB1c2VyIGNhbiBzZWUgbWVzc2FnZXMgdXAgdG8gdGhlIHRpbWUgdGhleSB3ZXJlIHJlbW92ZWQsXG4gKiBidXQgY2FuIG5vIGxvbmdlciBpbnRlcmFjdCB3aXRoIHRoZSBjb252ZXJzYXRpb24uXG4gKlxuICogQSByZW1vdmVkIHVzZXIgY2FuIG5vIGxvbmdlciBzZWUgdGhlIHBhcnRpY2lwYW50IGxpc3QuXG4gKlxuICogUmVhZCBhbmQgRGVsaXZlcnkgcmVjZWlwdHMgd2lsbCBmYWlsIG9uIGFueSBNZXNzYWdlIGluIHN1Y2ggYSBDb252ZXJzYXRpb24uXG4gKlxuICogQHR5cGUge0Jvb2xlYW59XG4gKi9cbkNvbnZlcnNhdGlvbi5wcm90b3R5cGUuaXNDdXJyZW50UGFydGljaXBhbnQgPSB0cnVlO1xuXG4vKipcbiAqIFRoZSBsYXN0IGxheWVyLk1lc3NhZ2UgdG8gYmUgc2VudC9yZWNlaXZlZCBmb3IgdGhpcyBDb252ZXJzYXRpb24uXG4gKlxuICogVmFsdWUgbWF5IGJlIGEgTWVzc2FnZSB0aGF0IGhhcyBiZWVuIGxvY2FsbHkgY3JlYXRlZCBidXQgbm90IHlldCByZWNlaXZlZCBieSBzZXJ2ZXIuXG4gKiBAdHlwZSB7bGF5ZXIuTWVzc2FnZX1cbiAqL1xuQ29udmVyc2F0aW9uLnByb3RvdHlwZS5sYXN0TWVzc2FnZSA9IG51bGw7XG5cbi8qKlxuICogQ2FjaGVzIGxhc3QgcmVzdWx0IG9mIHRvT2JqZWN0KClcbiAqIEB0eXBlIHtPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG5Db252ZXJzYXRpb24ucHJvdG90eXBlLl90b09iamVjdCA9IG51bGw7XG5cbkNvbnZlcnNhdGlvbi5ldmVudFByZWZpeCA9ICdjb252ZXJzYXRpb25zJztcblxuLyoqXG4gKiBDYWNoZSdzIGEgRGlzdGluY3QgRXZlbnQuXG4gKlxuICogT24gY3JlYXRpbmcgYSBEaXN0aW5jdCBDb252ZXJzYXRpb24gdGhhdCBhbHJlYWR5IGV4aXN0cyxcbiAqIHdoZW4gdGhlIHNlbmQoKSBtZXRob2QgaXMgY2FsbGVkLCB3ZSBzaG91bGQgdHJpZ2dlclxuICogc3BlY2lmaWMgZXZlbnRzIGRldGFpbGluZyB0aGUgcmVzdWx0cy4gIFJlc3VsdHNcbiAqIG1heSBiZSBkZXRlcm1pbmVkIGxvY2FsbHkgb3Igb24gdGhlIHNlcnZlciwgYnV0IHNhbWUgRXZlbnQgbWF5IGJlIG5lZWRlZC5cbiAqXG4gKiBAdHlwZSB7bGF5ZXIuTGF5ZXJFdmVudH1cbiAqIEBwcml2YXRlXG4gKi9cbkNvbnZlcnNhdGlvbi5wcm90b3R5cGUuX3NlbmREaXN0aW5jdEV2ZW50ID0gbnVsbDtcblxuLyoqXG4gKiBQcmVmaXggdG8gdXNlIHdoZW4gZ2VuZXJhdGluZyBhbiBJRCBmb3IgaW5zdGFuY2VzIG9mIHRoaXMgY2xhc3NcbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAc3RhdGljXG4gKiBAcHJpdmF0ZVxuICovXG5Db252ZXJzYXRpb24ucHJlZml4VVVJRCA9ICdsYXllcjovLy9jb252ZXJzYXRpb25zLyc7XG5cbi8qKlxuICogUHJvcGVydHkgdG8gbG9vayBmb3Igd2hlbiBidWJibGluZyB1cCBldmVudHMuXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQHN0YXRpY1xuICogQHByaXZhdGVcbiAqL1xuQ29udmVyc2F0aW9uLmJ1YmJsZUV2ZW50UGFyZW50ID0gJ2dldENsaWVudCc7XG5cbi8qKlxuICogVGhlIENvbnZlcnNhdGlvbiB0aGF0IHdhcyByZXF1ZXN0ZWQgaGFzIGJlZW4gY3JlYXRlZC5cbiAqXG4gKiBVc2VkIGluIGBjb252ZXJzYXRpb25zOnNlbnRgIGV2ZW50cy5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAc3RhdGljXG4gKi9cbkNvbnZlcnNhdGlvbi5DUkVBVEVEID0gJ0NyZWF0ZWQnO1xuXG4vKipcbiAqIFRoZSBDb252ZXJzYXRpb24gdGhhdCB3YXMgcmVxdWVzdGVkIGhhcyBiZWVuIGZvdW5kLlxuICpcbiAqIFRoaXMgbWVhbnMgdGhhdCBpdCBkaWQgbm90IG5lZWQgdG8gYmUgY3JlYXRlZC5cbiAqXG4gKiBVc2VkIGluIGBjb252ZXJzYXRpb25zOnNlbnRgIGV2ZW50cy5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAc3RhdGljXG4gKi9cbkNvbnZlcnNhdGlvbi5GT1VORCA9ICdGb3VuZCc7XG5cbi8qKlxuICogVGhlIENvbnZlcnNhdGlvbiB0aGF0IHdhcyByZXF1ZXN0ZWQgaGFzIGJlZW4gZm91bmQsIGJ1dCB0aGVyZSB3YXMgYSBtaXNtYXRjaCBpbiBtZXRhZGF0YS5cbiAqXG4gKiBJZiB0aGUgY3JlYXRlQ29udmVyc2F0aW9uIHJlcXVlc3QgY29udGFpbmVkIG1ldGFkYXRhIGFuZCBpdCBkaWQgbm90IG1hdGNoIHRoZSBEaXN0aW5jdCBDb252ZXJzYXRpb25cbiAqIHRoYXQgbWF0Y2hlZCB0aGUgcmVxdWVzdGVkIHBhcnRpY2lwYW50cywgdGhlbiB0aGlzIHZhbHVlIGlzIHBhc3NlZCB0byBub3RpZnkgeW91ciBhcHAgdGhhdCB0aGUgQ29udmVyc2F0aW9uXG4gKiB3YXMgcmV0dXJuZWQgYnV0IGRvZXMgbm90IGV4YWN0bHkgbWF0Y2ggeW91ciByZXF1ZXN0LlxuICpcbiAqIFVzZWQgaW4gYGNvbnZlcnNhdGlvbnM6c2VudGAgZXZlbnRzLlxuICogQHR5cGUge1N0cmluZ31cbiAqIEBzdGF0aWNcbiAqL1xuQ29udmVyc2F0aW9uLkZPVU5EX1dJVEhPVVRfUkVRVUVTVEVEX01FVEFEQVRBID0gJ0ZvdW5kTWlzbWF0Y2gnO1xuXG5Db252ZXJzYXRpb24uX3N1cHBvcnRlZEV2ZW50cyA9IFtcblxuXG5cbiAgLyoqXG4gICAqIFRoZSBjb252ZXJzYXRpb24gaXMgbm93IG9uIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIENhbGxlZCBhZnRlciBzdWNjZXNzZnVsbHkgY3JlYXRpbmcgdGhlIGNvbnZlcnNhdGlvblxuICAgKiBvbiB0aGUgc2VydmVyLiAgVGhlIFJlc3VsdCBwcm9wZXJ0eSBpcyBvbmUgb2Y6XG4gICAqXG4gICAqICogQ29udmVyc2F0aW9uLkNSRUFURUQ6IEEgbmV3IENvbnZlcnNhdGlvbiBoYXMgYmVlbiBjcmVhdGVkXG4gICAqICogQ29udmVyc2F0aW9uLkZPVU5EOiBBIG1hdGNoaW5nIERpc3RpbmN0IENvbnZlcnNhdGlvbiBoYXMgYmVlbiBmb3VuZFxuICAgKiAqIENvbnZlcnNhdGlvbi5GT1VORF9XSVRIT1VUX1JFUVVFU1RFRF9NRVRBREFUQTogQSBtYXRjaGluZyBEaXN0aW5jdCBDb252ZXJzYXRpb24gaGFzIGJlZW4gZm91bmRcbiAgICogICAgICAgICAgICAgICAgICAgICAgIGJ1dCBub3RlIHRoYXQgdGhlIG1ldGFkYXRhIGlzIE5PVCB3aGF0IHlvdSByZXF1ZXN0ZWQuXG4gICAqXG4gICAqIEFsbCBvZiB0aGVzZSByZXN1bHRzIHdpbGwgYWxzbyBtZWFuIHRoYXQgdGhlIHVwZGF0ZWQgcHJvcGVydHkgdmFsdWVzIGhhdmUgYmVlblxuICAgKiBjb3BpZWQgaW50byB5b3VyIENvbnZlcnNhdGlvbiBvYmplY3QuICBUaGF0IG1lYW5zIHlvdXIgbWV0YWRhdGEgcHJvcGVydHkgbWF5IG5vXG4gICAqIGxvbmdlciBiZSBpdHMgaW5pdGlhbCB2YWx1ZTsgaXQgbWF5IGJlIHRoZSB2YWx1ZSBmb3VuZCBvbiB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldmVudFxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnQucmVzdWx0XG4gICAqL1xuICAnY29udmVyc2F0aW9uczpzZW50JyxcblxuICAvKipcbiAgICogQW4gYXR0ZW1wdCB0byBzZW5kIHRoaXMgY29udmVyc2F0aW9uIHRvIHRoZSBzZXJ2ZXIgaGFzIGZhaWxlZC5cbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckVycm9yfSBldmVudC5lcnJvclxuICAgKi9cbiAgJ2NvbnZlcnNhdGlvbnM6c2VudC1lcnJvcicsXG5cbiAgLyoqXG4gICAqIFRoZSBjb252ZXJzYXRpb24gaXMgbm93IGxvYWRlZCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIGlzIG9ubHkgdXNlZCBpbiByZXNwb25zZSB0byB0aGUgbGF5ZXIuQ29udmVyc2F0aW9uLmxvYWQoKSBtZXRob2QuXG4gICAqIGZyb20gdGhlIHNlcnZlci5cbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZlbnRcbiAgICovXG4gICdjb252ZXJzYXRpb25zOmxvYWRlZCcsXG5cbiAgLyoqXG4gICAqIEFuIGF0dGVtcHQgdG8gbG9hZCB0aGlzIGNvbnZlcnNhdGlvbiBmcm9tIHRoZSBzZXJ2ZXIgaGFzIGZhaWxlZC5cbiAgICpcbiAgICogTm90ZSB0aGF0IHRoaXMgaXMgb25seSB1c2VkIGluIHJlc3BvbnNlIHRvIHRoZSBsYXllci5Db252ZXJzYXRpb24ubG9hZCgpIG1ldGhvZC5cbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckVycm9yfSBldmVudC5lcnJvclxuICAgKi9cbiAgJ2NvbnZlcnNhdGlvbnM6bG9hZGVkLWVycm9yJyxcblxuICAvKipcbiAgICogVGhlIGNvbnZlcnNhdGlvbiBoYXMgYmVlbiBkZWxldGVkIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQ2F1c2VkIGJ5IGVpdGhlciBhIHN1Y2Nlc3NmdWwgY2FsbCB0byBkZWxldGUoKSBvbiB0aGlzIGluc3RhbmNlXG4gICAqIG9yIGJ5IGEgcmVtb3RlIHVzZXIuXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2ZW50XG4gICAqL1xuICAnY29udmVyc2F0aW9uczpkZWxldGUnLFxuXG4gIC8qKlxuICAgKiBUaGlzIGNvbnZlcnNhdGlvbiBoYXMgY2hhbmdlZC5cbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZlbnRcbiAgICogQHBhcmFtIHtPYmplY3RbXX0gZXZlbnQuY2hhbmdlcyAtIEFycmF5IG9mIGNoYW5nZXMgcmVwb3J0ZWQgYnkgdGhpcyBldmVudFxuICAgKiBAcGFyYW0ge01peGVkfSBldmVudC5jaGFuZ2VzLm5ld1ZhbHVlXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGV2ZW50LmNoYW5nZXMub2xkVmFsdWVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50LmNoYW5nZXMucHJvcGVydHkgLSBOYW1lIG9mIHRoZSBwcm9wZXJ0eSB0aGF0IGNoYW5nZWRcbiAgICogQHBhcmFtIHtsYXllci5Db252ZXJzYXRpb259IGV2ZW50LnRhcmdldFxuICAgKi9cbiAgJ2NvbnZlcnNhdGlvbnM6Y2hhbmdlJ10uY29uY2F0KFN5bmNhYmxlLl9zdXBwb3J0ZWRFdmVudHMpO1xuXG5Sb290LmluaXRDbGFzcy5hcHBseShDb252ZXJzYXRpb24sIFtDb252ZXJzYXRpb24sICdDb252ZXJzYXRpb24nXSk7XG5TeW5jYWJsZS5zdWJjbGFzc2VzLnB1c2goQ29udmVyc2F0aW9uKTtcbm1vZHVsZS5leHBvcnRzID0gQ29udmVyc2F0aW9uO1xuIl19
