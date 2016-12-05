'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Persistence manager.
 *
 * This class manages all indexedDB access.  It is not responsible for any localStorage access, though it may
 * receive configurations related to data stored in localStorage.  It will simply ignore those configurations.
 *
 * Rich Content will be written to IndexedDB as long as its small; see layer.DbManager.MaxPartSize for more info.
 *
 * TODO:
 * 0. Redesign this so that knowledge of the data is not hard-coded in
 * @class layer.DbManager
 * @protected
 */

var Root = require('./root');
var logger = require('./logger');
var SyncEvent = require('./sync-event');
var Constants = require('./const');
var Util = require('./client-utils');

var DB_VERSION = 2;
var MAX_SAFE_INTEGER = 9007199254740991;
var SYNC_NEW = Constants.SYNC_STATE.NEW;

function getDate(inDate) {
  return inDate ? inDate.toISOString() : null;
}

var TABLES = [{
  name: 'conversations',
  indexes: {
    created_at: ['created_at'],
    last_message_sent: ['last_message_sent']
  }
}, {
  name: 'messages',
  indexes: {
    conversation: ['conversation', 'position']
  }
}, {
  name: 'identities',
  indexes: {}
}, {
  name: 'syncQueue',
  indexes: {}
}];

var DbManager = function (_Root) {
  _inherits(DbManager, _Root);

  /**
   * Create the DB Manager
   *
   * Key configuration is the layer.DbManager.persistenceFeatures property.
   *
   * @method constructor
   * @param {Object} options
   * @param {layer.Client} options.client
   * @param {Object} options.persistenceFeatures
   * @return {layer.DbManager} this
   */
  function DbManager(options) {
    _classCallCheck(this, DbManager);

    // If no indexedDB, treat everything as disabled.
    /* istanbul ignore next */
    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(DbManager).call(this, options));

    if (!window.indexedDB) {
      options.tables = {};
    } else {
      // Test if Arrays as keys supported, disable persistence if not
      var enabled = true;
      try {
        window.IDBKeyRange.bound(['announcement', 0], ['announcement', MAX_SAFE_INTEGER]);
      } catch (e) {
        options.tables = {};
        enabled = false;
      }

      // If Client is a layer.ClientAuthenticator, it won't support these events; this affects Unit Tests
      if (enabled && _this.client.constructor._supportedEvents.indexOf('conversations:add') !== -1) {
        _this.client.on('conversations:add', function (evt) {
          return _this.writeConversations(evt.conversations);
        });

        _this.client.on('conversations:change', function (evt) {
          return _this._updateConversation(evt.target, evt.changes);
        });
        _this.client.on('conversations:delete conversations:sent-error', function (evt) {
          return _this.deleteObjects('conversations', [evt.target]);
        });

        _this.client.on('messages:add', function (evt) {
          return _this.writeMessages(evt.messages);
        });
        _this.client.on('messages:change', function (evt) {
          return _this.writeMessages([evt.target]);
        });
        _this.client.on('messages:delete messages:sent-error', function (evt) {
          return _this.deleteObjects('messages', [evt.target]);
        });

        _this.client.on('identities:add', function (evt) {
          return _this.writeIdentities(evt.identities);
        });
        _this.client.on('identities:change', function (evt) {
          return _this.writeIdentities([evt.target]);
        });
        _this.client.on('identities:unfollow', function (evt) {
          return _this.deleteObjects('identities', [evt.target]);
        });
      }

      // Sync Queue only really works properly if we have the Messages and Conversations written to the DB; turn it off
      // if that won't be the case.
      if (!options.tables.conversations || !options.tables.messages) {
        options.tables.syncQueue = false;
      }
    }

    TABLES.forEach(function (tableDef) {
      _this['_permission_' + tableDef.name] = Boolean(options.tables[tableDef.name]);
    });
    _this._open(false);
    return _this;
  }

  _createClass(DbManager, [{
    key: '_getDbName',
    value: function _getDbName() {
      return 'LayerWebSDK_' + this.client.appId;
    }

    /**
     * Open the Database Connection.
     *
     * This is only called by the constructor.
     * @method _open
     * @param {Boolean} retry
     * @private
     */

  }, {
    key: '_open',
    value: function _open(retry) {
      var _this2 = this;

      if (this.db) {
        this.db.close();
        delete this.db;
      }

      // Abort if all tables are disabled
      var enabledTables = TABLES.filter(function (tableDef) {
        return _this2['_permission_' + tableDef.name];
      });
      if (enabledTables.length === 0) {
        this._isOpenError = true;
        this.trigger('error', { error: 'Persistence is disabled by application' });
        return;
      }

      // Open the database
      var client = this.client;
      var request = window.indexedDB.open(this._getDbName(), DB_VERSION);

      try {
        request.onerror = function (evt) {
          if (!retry) {
            _this2.deleteTables(function () {
              return _this2._open(true);
            });
          }

          // Triggered by Firefox private browsing window
          /* istanbul ignore next */
          else {
              _this2._isOpenError = true;
              logger.warn('Database Unable to Open (common cause: private browsing window)', evt.target.error);
              _this2.trigger('error', { error: evt });
            }
        };

        request.onupgradeneeded = function (evt) {
          return _this2._onUpgradeNeeded(evt);
        };
        request.onsuccess = function (evt) {
          _this2.db = evt.target.result;
          _this2.isOpen = true;
          _this2.trigger('open');

          _this2.db.onversionchange = function () {
            _this2.db.close();
            _this2.isOpen = false;
          };

          _this2.db.onerror = function (err) {
            return logger.error('db-manager Error: ', err);
          };
        };
      }

      /* istanbul ignore next */
      catch (err) {
        // Safari Private Browsing window will fail on request.onerror
        this._isOpenError = true;
        logger.error('Database Unable to Open: ', err);
        this.trigger('error', { error: err });
      }
    }

    /**
     * Use this to setup a call to happen as soon as the database is open.
     *
     * Typically, this call will immediately, synchronously call your callback.
     * But if the DB is not open yet, your callback will be called once its open.
     * @method onOpen
     * @param {Function} callback
     */

  }, {
    key: 'onOpen',
    value: function onOpen(callback) {
      if (this.isOpen || this._isOpenError) callback();else this.once('open error', callback);
    }

    /**
     * The onUpgradeNeeded function is called by IndexedDB any time DB_VERSION is incremented.
     *
     * This invocation is part of the built-in lifecycle of IndexedDB.
     *
     * @method _onUpgradeNeeded
     * @param {IDBVersionChangeEvent} event
     * @private
     */
    /* istanbul ignore next */

  }, {
    key: '_onUpgradeNeeded',
    value: function _onUpgradeNeeded(event) {
      var _this3 = this;

      var db = event.target.result;
      var isComplete = false;

      // This appears to only get called once; its presumed this is because we're creating but not using a lot of transactions.
      var onComplete = function onComplete(evt) {
        if (!isComplete) {
          _this3.db = db;
          _this3.isComplete = true;
          _this3.isOpen = true;
          _this3.trigger('open');
        }
      };

      var currentTables = Array.prototype.slice.call(db.objectStoreNames);
      TABLES.forEach(function (tableDef) {
        try {
          if (currentTables.indexOf(tableDef.name) !== -1) db.deleteObjectStore(tableDef.name);
        } catch (e) {
          // Noop
        }
        try {
          (function () {
            var store = db.createObjectStore(tableDef.name, { keyPath: 'id' });
            Object.keys(tableDef.indexes).forEach(function (indexName) {
              return store.createIndex(indexName, tableDef.indexes[indexName], { unique: false });
            });
            store.transaction.oncomplete = onComplete;
          })();
        } catch (e) {
          // Noop
          logger.error('Failed to create object store ' + tableDef.name, e);
        }
      });
    }

    /**
     * Convert array of Conversation instances into Conversation DB Entries.
     *
     * A Conversation DB entry looks a lot like the server representation, but
     * includes a sync_state property, and `last_message` contains a message ID not
     * a Message object.
     *
     * @method _getConversationData
     * @private
     * @param {layer.Conversation[]} conversations
     * @return {Object[]} conversations
     */

  }, {
    key: '_getConversationData',
    value: function _getConversationData(conversations) {
      var _this4 = this;

      return conversations.filter(function (conversation) {
        if (conversation._fromDB) {
          conversation._fromDB = false;
          return false;
        } else if (conversation.isLoading || conversation.syncState === SYNC_NEW) {
          return false;
        } else {
          return true;
        }
      }).map(function (conversation) {
        var item = {
          id: conversation.id,
          url: conversation.url,
          participants: _this4._getIdentityData(conversation.participants, true),
          distinct: conversation.distinct,
          created_at: getDate(conversation.createdAt),
          metadata: conversation.metadata,
          unread_message_count: conversation.unreadCount,
          last_message: conversation.lastMessage ? conversation.lastMessage.id : '',
          last_message_sent: conversation.lastMessage ? getDate(conversation.lastMessage.sentAt) : getDate(conversation.createdAt),
          sync_state: conversation.syncState
        };
        return item;
      });
    }
  }, {
    key: '_updateConversation',
    value: function _updateConversation(conversation, changes) {
      var _this5 = this;

      var idChanges = changes.filter(function (item) {
        return item.property === 'id';
      });
      if (idChanges.length) {
        this.deleteObjects('conversations', [{ id: idChanges[0].oldValue }], function () {
          _this5.writeConversations([conversation]);
        });
      } else {
        this.writeConversations([conversation]);
      }
    }

    /**
     * Writes an array of Conversations to the Database.
     *
     * @method writeConversations
     * @param {layer.Conversation[]} conversations - Array of Conversations to write
     * @param {Function} [callback]
     */

  }, {
    key: 'writeConversations',
    value: function writeConversations(conversations, callback) {
      this._writeObjects('conversations', this._getConversationData(conversations.filter(function (conversation) {
        return !conversation.isDestroyed;
      })), callback);
    }

    /**
     * Convert array of Identity instances into Identity DB Entries.
     *
     * @method _getIdentityData
     * @private
     * @param {layer.Identity[]} identities
     * @param {boolean} writeBasicIdentity - Forces output as a Basic Identity
     * @return {Object[]} identities
     */

  }, {
    key: '_getIdentityData',
    value: function _getIdentityData(identities, writeBasicIdentity) {
      return identities.filter(function (identity) {
        if (identity.isDestroyed || !identity.isFullIdentity && !writeBasicIdentity) return false;

        if (identity._fromDB) {
          identity._fromDB = false;
          return false;
        } else if (identity.isLoading) {
          return false;
        } else {
          return true;
        }
      }).map(function (identity) {
        if (identity.isFullIdentity && !writeBasicIdentity) {
          return {
            id: identity.id,
            url: identity.url,
            user_id: identity.userId,
            first_name: identity.firstName,
            last_name: identity.lastName,
            display_name: identity.displayName,
            avatar_url: identity.avatarUrl,
            metadata: identity.metadata,
            public_key: identity.publicKey,
            phone_number: identity.phoneNumber,
            email_address: identity.emailAddress,
            sync_state: identity.syncState,
            type: identity.type
          };
        } else {
          return {
            id: identity.id,
            url: identity.url,
            user_id: identity.userId,
            display_name: identity.displayName,
            avatar_url: identity.avatarUrl
          };
        }
      });
    }

    /**
     * Writes an array of Identities to the Database.
     *
     * @method writeIdentities
     * @param {layer.Identity[]} identities - Array of Identities to write
     * @param {Function} [callback]
     */

  }, {
    key: 'writeIdentities',
    value: function writeIdentities(identities, callback) {
      this._writeObjects('identities', this._getIdentityData(identities), callback);
    }

    /**
     * Convert array of Message instances into Message DB Entries.
     *
     * A Message DB entry looks a lot like the server representation, but
     * includes a sync_state property.
     *
     * @method _getMessageData
     * @private
     * @param {layer.Message[]} messages
     * @param {Function} callback
     * @return {Object[]} messages
     */

  }, {
    key: '_getMessageData',
    value: function _getMessageData(messages, callback) {
      var _this6 = this;

      var dbMessages = messages.filter(function (message) {
        if (message._fromDB) {
          message._fromDB = false;
          return false;
        } else if (message.syncState === Constants.SYNC_STATE.LOADING) {
          return false;
        } else {
          return true;
        }
      }).map(function (message) {
        return {
          id: message.id,
          url: message.url,
          parts: message.parts.map(function (part) {
            var body = Util.isBlob(part.body) && part.body.size > DbManager.MaxPartSize ? null : part.body;
            return {
              body: body,
              id: part.id,
              encoding: part.encoding,
              mime_type: part.mimeType,
              content: !part._content ? null : {
                id: part._content.id,
                download_url: part._content.downloadUrl,
                expiration: part._content.expiration,
                refresh_url: part._content.refreshUrl,
                size: part._content.size
              }
            };
          }),
          position: message.position,
          sender: _this6._getIdentityData([message.sender], true)[0],
          recipient_status: message.recipientStatus,
          sent_at: getDate(message.sentAt),
          received_at: getDate(message.receivedAt),
          conversation: message.constructor.prefixUUID === 'layer:///announcements/' ? 'announcement' : message.conversationId,
          sync_state: message.syncState,
          is_unread: message.isUnread
        };
      });

      // Find all blobs and convert them to base64... because Safari 9.1 doesn't support writing blobs those Frelling Smurfs.
      var count = 0;
      var parts = [];
      dbMessages.forEach(function (message) {
        message.parts.forEach(function (part) {
          if (Util.isBlob(part.body)) parts.push(part);
        });
      });
      if (parts.length === 0) {
        callback(dbMessages);
      } else {
        parts.forEach(function (part) {
          Util.blobToBase64(part.body, function (base64) {
            part.body = base64;
            part.useBlob = true;
            count++;
            if (count === parts.length) callback(dbMessages);
          });
        });
      }
    }

    /**
     * Writes an array of Messages to the Database.
     *
     * @method writeMessages
     * @param {layer.Message[]} messages - Array of Messages to write
     * @param {Function} [callback]
     */

  }, {
    key: 'writeMessages',
    value: function writeMessages(messages, callback) {
      var _this7 = this;

      this._getMessageData(messages.filter(function (message) {
        return !message.isDestroyed;
      }), function (dbMessageData) {
        return _this7._writeObjects('messages', dbMessageData, callback);
      });
    }

    /**
     * Convert array of SyncEvent instances into SyncEvent DB Entries.
     *
     * @method _getSyncEventData
     * @param {layer.SyncEvent[]} syncEvents
     * @return {Object[]} syncEvents
     * @private
     */

  }, {
    key: '_getSyncEventData',
    value: function _getSyncEventData(syncEvents) {
      return syncEvents.filter(function (syncEvt) {
        if (syncEvt.fromDB) {
          syncEvt.fromDB = false;
          return false;
        } else {
          return true;
        }
      }).map(function (syncEvent) {
        var item = {
          id: syncEvent.id,
          target: syncEvent.target,
          depends: syncEvent.depends,
          isWebsocket: syncEvent instanceof SyncEvent.WebsocketSyncEvent,
          operation: syncEvent.operation,
          data: syncEvent.data,
          url: syncEvent.url || '',
          headers: syncEvent.headers || null,
          method: syncEvent.method || null,
          created_at: syncEvent.createdAt
        };
        return item;
      });
    }

    /**
     * Writes an array of SyncEvent to the Database.
     *
     * @method writeSyncEvents
     * @param {layer.SyncEvent[]} syncEvents - Array of Sync Events to write
     * @param {Function} [callback]
     */

  }, {
    key: 'writeSyncEvents',
    value: function writeSyncEvents(syncEvents, callback) {
      this._writeObjects('syncQueue', this._getSyncEventData(syncEvents), callback);
    }

    /**
     * Write an array of data to the specified Database table.
     *
     * @method _writeObjects
     * @param {string} tableName - The name of the table to write to
     * @param {Object[]} data - Array of POJO data to write
     * @param {Function} [callback] - Called when all data is written
     * @protected
     */

  }, {
    key: '_writeObjects',
    value: function _writeObjects(tableName, data, callback) {
      var _this8 = this;

      if (!this['_permission_' + tableName] || this._isOpenError) return callback ? callback() : null;

      // Just quit if no data to write
      if (!data.length) {
        if (callback) callback();
        return;
      }

      // PUT (udpate) or ADD (insert) each item of data one at a time, but all as part of one large transaction.
      this.onOpen(function () {
        _this8.getObjects(tableName, data.map(function (item) {
          return item.id;
        }), function (foundItems) {
          var updateIds = {};
          foundItems.forEach(function (item) {
            updateIds[item.id] = item;
          });

          var transaction = _this8.db.transaction([tableName], 'readwrite');
          var store = transaction.objectStore(tableName);
          transaction.oncomplete = transaction.onerror = callback;

          data.forEach(function (item) {
            try {
              if (updateIds[item.id]) {
                store.put(item);
              } else {
                store.add(item);
              }
            } catch (e) {
              // Safari throws an error rather than use the onerror event.
              logger.error(e);
            }
          });
        });
      });
    }

    /**
     * Load all conversations from the database.
     *
     * @method loadConversations
     * @param {string} sortBy       - One of 'last_message' or 'created_at'; always sorts in DESC order
     * @param {string} [fromId=]    - For pagination, provide the conversationId to get Conversations after
     * @param {number} [pageSize=]  - To limit the number of results, provide a number for how many results to return.
     * @param {Function} [callback]  - Callback for getting results
     * @param {layer.Conversation[]} callback.result
     */

  }, {
    key: 'loadConversations',
    value: function loadConversations(sortBy, fromId, pageSize, callback) {
      var _this9 = this;

      try {
        var sortIndex = void 0,
            range = null;
        var fromConversation = fromId ? this.client.getConversation(fromId) : null;
        if (sortBy === 'last_message') {
          sortIndex = 'last_message_sent';
          if (fromConversation) {
            range = window.IDBKeyRange.upperBound([fromConversation.lastMessage ? getDate(fromConversation.lastMessage.sentAt) : getDate(fromConversation.createdAt)]);
          }
        } else {
          sortIndex = 'created_at';
          if (fromConversation) {
            range = window.IDBKeyRange.upperBound([getDate(fromConversation.createdAt)]);
          }
        }

        // Step 1: Get all Conversations
        this._loadByIndex('conversations', sortIndex, range, Boolean(fromId), pageSize, function (data) {
          // Step 2: Gather all Message IDs needed to initialize these Conversation's lastMessage properties.
          var messagesToLoad = data.map(function (item) {
            return item.last_message;
          }).filter(function (messageId) {
            return messageId && !_this9.client.getMessage(messageId);
          });

          // Step 3: Load all Messages needed to initialize these Conversation's lastMessage properties.
          _this9.getObjects('messages', messagesToLoad, function (messages) {
            _this9._loadConversationsResult(data, messages, callback);
          });
        });
      } catch (e) {
        // Noop -- handle browsers like IE that don't like these IDBKeyRanges
      }
    }

    /**
     * Assemble all LastMessages and Conversation POJOs into layer.Message and layer.Conversation instances.
     *
     * @method _loadConversationsResult
     * @private
     * @param {Object[]} conversations
     * @param {Object[]} messages
     * @param {Function} callback
     * @param {layer.Conversation[]} callback.result
     */

  }, {
    key: '_loadConversationsResult',
    value: function _loadConversationsResult(conversations, messages, callback) {
      var _this10 = this;

      // Instantiate and Register each Message
      messages.forEach(function (message) {
        return _this10._createMessage(message);
      });

      // Instantiate and Register each Conversation; will find any lastMessage that was registered.
      var newData = conversations.map(function (conversation) {
        return _this10._createConversation(conversation) || _this10.client.getConversation(conversation.id);
      }).filter(function (conversation) {
        return conversation;
      });

      // Return the data
      if (callback) callback(newData);
    }

    /**
     * Load all messages for a given Conversation ID from the database.
     *
     * Use _loadAll if loading All Messages rather than all Messages for a Conversation.
     *
     * @method loadMessages
     * @param {string} conversationId - ID of the Conversation whose Messages are of interest.
     * @param {string} [fromId=]    - For pagination, provide the messageId to get Messages after
     * @param {number} [pageSize=]  - To limit the number of results, provide a number for how many results to return.
     * @param {Function} [callback]   - Callback for getting results
     * @param {layer.Message[]} callback.result
     */

  }, {
    key: 'loadMessages',
    value: function loadMessages(conversationId, fromId, pageSize, callback) {
      var _this11 = this;

      try {
        var fromMessage = fromId ? this.client.getMessage(fromId) : null;
        var query = window.IDBKeyRange.bound([conversationId, 0], [conversationId, fromMessage ? fromMessage.position : MAX_SAFE_INTEGER]);
        this._loadByIndex('messages', 'conversation', query, Boolean(fromId), pageSize, function (data) {
          _this11._loadMessagesResult(data, callback);
        });
      } catch (e) {
        // Noop -- handle browsers like IE that don't like these IDBKeyRanges
      }
    }

    /**
     * Load all Announcements from the database.
     *
     * @method loadAnnouncements
     * @param {string} [fromId=]    - For pagination, provide the messageId to get Announcements after
     * @param {number} [pageSize=]  - To limit the number of results, provide a number for how many results to return.
     * @param {Function} [callback]
     * @param {layer.Announcement[]} callback.result
     */

  }, {
    key: 'loadAnnouncements',
    value: function loadAnnouncements(fromId, pageSize, callback) {
      var _this12 = this;

      try {
        var fromMessage = fromId ? this.client.getMessage(fromId) : null;
        var query = window.IDBKeyRange.bound(['announcement', 0], ['announcement', fromMessage ? fromMessage.position : MAX_SAFE_INTEGER]);
        this._loadByIndex('messages', 'conversation', query, Boolean(fromId), pageSize, function (data) {
          _this12._loadMessagesResult(data, callback);
        });
      } catch (e) {
        // Noop -- handle browsers like IE that don't like these IDBKeyRanges
      }
    }
  }, {
    key: '_blobifyPart',
    value: function _blobifyPart(part) {
      if (part.useBlob) {
        part.body = Util.base64ToBlob(part.body);
        delete part.useBlob;
        part.encoding = null;
      }
    }

    /**
     * Registers and sorts the message objects from the database.
     *
     * TODO: Encode limits on this, else we are sorting tens of thousands
     * of messages in javascript.
     *
     * @method _loadMessagesResult
     * @private
     * @param {Object[]} Message objects from the database.
     * @param {Function} callback
     * @param {layer.Message} callback.result - Message instances created from the database
     */

  }, {
    key: '_loadMessagesResult',
    value: function _loadMessagesResult(messages, callback) {
      var _this13 = this;

      // Convert base64 to blob before sending it along...
      messages.forEach(function (message) {
        return message.parts.forEach(function (part) {
          return _this13._blobifyPart(part);
        });
      });

      // Instantiate and Register each Message
      var newData = messages.map(function (message) {
        return _this13._createMessage(message) || _this13.client.getMessage(message.id);
      }).filter(function (message) {
        return message;
      });

      // Return the results
      if (callback) callback(newData);
    }

    /**
     * Load all Identities from the database.
     *
     * @method loadIdentities
     * @param {Function} callback
     * @param {layer.Identity[]} callback.result
     */

  }, {
    key: 'loadIdentities',
    value: function loadIdentities(callback) {
      var _this14 = this;

      this._loadAll('identities', function (data) {
        _this14._loadIdentitiesResult(data, callback);
      });
    }

    /**
     * Assemble all LastMessages and Identityy POJOs into layer.Message and layer.Identityy instances.
     *
     * @method _loadIdentitiesResult
     * @private
     * @param {Object[]} identities
     * @param {Function} callback
     * @param {layer.Identity[]} callback.result
     */

  }, {
    key: '_loadIdentitiesResult',
    value: function _loadIdentitiesResult(identities, callback) {
      var _this15 = this;

      // Instantiate and Register each Identity.
      var newData = identities.map(function (identity) {
        return _this15._createIdentity(identity) || _this15.client.getIdentity(identity.id);
      }).filter(function (identity) {
        return identity;
      });

      // Return the data
      if (callback) callback(newData);
    }

    /**
     * Instantiate and Register the Conversation from a conversation DB Entry.
     *
     * If the layer.Conversation already exists, then its presumed that whatever is in
     * javascript cache is more up to date than whats in IndexedDB cache.
     *
     * Attempts to assign the lastMessage property to refer to appropriate Message.  If it fails,
     * it will be set to null.
     *
     * @method _createConversation
     * @private
     * @param {Object} conversation
     * @returns {layer.Conversation}
     */

  }, {
    key: '_createConversation',
    value: function _createConversation(conversation) {
      if (!this.client.getConversation(conversation.id)) {
        conversation._fromDB = true;
        var newConversation = this.client._createObject(conversation);
        newConversation.syncState = conversation.sync_state;
        return newConversation;
      }
    }

    /**
     * Instantiate and Register the Message from a message DB Entry.
     *
     * If the layer.Message already exists, then its presumed that whatever is in
     * javascript cache is more up to date than whats in IndexedDB cache.
     *
     * @method _createMessage
     * @private
     * @param {Object} message
     * @returns {layer.Message}
     */

  }, {
    key: '_createMessage',
    value: function _createMessage(message) {
      if (!this.client.getMessage(message.id)) {
        message._fromDB = true;
        message.conversation = { id: message.conversation };
        var newMessage = this.client._createObject(message);
        newMessage.syncState = message.sync_state;
        return newMessage;
      }
    }

    /**
     * Instantiate and Register the Identity from an identities DB Entry.
     *
     * If the layer.Identity already exists, then its presumed that whatever is in
     * javascript cache is more up to date than whats in IndexedDB cache.
     *
     * @method _createIdentity
     * @param {Object} identity
     * @returns {layer.Identity}
     */

  }, {
    key: '_createIdentity',
    value: function _createIdentity(identity) {
      if (!this.client.getIdentity(identity.id)) {
        identity._fromDB = true;
        var newidentity = this.client._createObject(identity);
        newidentity.syncState = identity.sync_state;
        return newidentity;
      }
    }

    /**
     * Load all Sync Events from the database.
     *
     * @method loadSyncQueue
     * @param {Function} callback
     * @param {layer.SyncEvent[]} callback.result
     */

  }, {
    key: 'loadSyncQueue',
    value: function loadSyncQueue(callback) {
      var _this16 = this;

      this._loadAll('syncQueue', function (syncEvents) {
        return _this16._loadSyncEventRelatedData(syncEvents, callback);
      });
    }

    /**
     * Validate that we have appropriate data for each SyncEvent and instantiate it.
     *
     * Any operation that is not a DELETE must have a valid target found in the database or javascript cache,
     * otherwise it can not be executed.
     *
     * TODO: Need to cleanup sync entries that have invalid targets
     *
     * @method _loadSyncEventRelatedData
     * @private
     * @param {Object[]} syncEvents
     * @param {Function} callback
     * @param {layer.SyncEvent[]} callback.result
     */

  }, {
    key: '_loadSyncEventRelatedData',
    value: function _loadSyncEventRelatedData(syncEvents, callback) {
      var _this17 = this;

      // Gather all Message IDs that are targets of operations.
      var messageIds = syncEvents.filter(function (item) {
        return item.operation !== 'DELETE' && item.target && item.target.match(/messages/);
      }).map(function (item) {
        return item.target;
      });

      // Gather all Conversation IDs that are targets of operations.
      var conversationIds = syncEvents.filter(function (item) {
        return item.operation !== 'DELETE' && item.target && item.target.match(/conversations/);
      }).map(function (item) {
        return item.target;
      });

      var identityIds = syncEvents.filter(function (item) {
        return item.operation !== 'DELETE' && item.target && item.target.match(/identities/);
      }).map(function (item) {
        return item.target;
      });

      // Load any Messages/Conversations that are targets of operations.
      // Call _createMessage or _createConversation on all targets found.
      var counter = 0;
      var maxCounter = 3;
      this.getObjects('messages', messageIds, function (messages) {
        messages.forEach(function (message) {
          return _this17._createMessage(message);
        });
        counter++;
        if (counter === maxCounter) _this17._loadSyncEventResults(syncEvents, callback);
      });
      this.getObjects('conversations', conversationIds, function (conversations) {
        conversations.forEach(function (conversation) {
          return _this17._createConversation(conversation);
        });
        counter++;
        if (counter === maxCounter) _this17._loadSyncEventResults(syncEvents, callback);
      });
      this.getObjects('identities', identityIds, function (identities) {
        identities.forEach(function (identity) {
          return _this17._createIdentity(identity);
        });
        counter++;
        if (counter === maxCounter) _this17._loadSyncEventResults(syncEvents, callback);
      });
    }

    /**
     * Turn an array of Sync Event DB Entries into an array of layer.SyncEvent.
     *
     * @method _loadSyncEventResults
     * @private
     * @param {Object[]} syncEvents
     * @param {Function} callback
     * @param {layer.SyncEvent[]} callback.result
     */

  }, {
    key: '_loadSyncEventResults',
    value: function _loadSyncEventResults(syncEvents, callback) {
      var _this18 = this;

      // If the target is present in the sync event, but does not exist in the system,
      // do NOT attempt to instantiate this event... unless its a DELETE operation.
      var newData = syncEvents.filter(function (syncEvent) {
        var hasTarget = Boolean(syncEvent.target && _this18.client._getObject(syncEvent.target));
        return syncEvent.operation === 'DELETE' || hasTarget;
      }).map(function (syncEvent) {
        if (syncEvent.isWebsocket) {
          return new SyncEvent.WebsocketSyncEvent({
            target: syncEvent.target,
            depends: syncEvent.depends,
            operation: syncEvent.operation,
            id: syncEvent.id,
            data: syncEvent.data,
            fromDB: true,
            createdAt: syncEvent.created_at
          });
        } else {
          return new SyncEvent.XHRSyncEvent({
            target: syncEvent.target,
            depends: syncEvent.depends,
            operation: syncEvent.operation,
            id: syncEvent.id,
            data: syncEvent.data,
            method: syncEvent.method,
            headers: syncEvent.headers,
            url: syncEvent.url,
            fromDB: true,
            createdAt: syncEvent.created_at
          });
        }
      });

      // Sort the results and then return them.
      // TODO: Query results should come back sorted by database with proper Index
      Util.sortBy(newData, function (item) {
        return item.createdAt;
      });
      callback(newData);
    }

    /**
     * Load all data from the specified table.
     *
     * @method _loadAll
     * @protected
     * @param {String} tableName
     * @param {Function} callback
     * @param {Object[]} callback.result
     */

  }, {
    key: '_loadAll',
    value: function _loadAll(tableName, callback) {
      var _this19 = this;

      if (!this['_permission_' + tableName] || this._isOpenError) return callback([]);
      this.onOpen(function () {
        var data = [];
        _this19.db.transaction([tableName], 'readonly').objectStore(tableName).openCursor().onsuccess = function (evt) {
          var cursor = evt.target.result;
          if (cursor) {
            data.push(cursor.value);
            cursor.continue();
          } else if (!_this19.isDestroyed) {
            callback(data);
          }
        };
      });
    }

    /**
     * Load all data from the specified table and with the specified index value.
     *
     * Results are always sorted in DESC order at this time.
     *
     * @method _loadByIndex
     * @protected
     * @param {String} tableName - 'messages', 'conversations', 'identities'
     * @param {String} indexName - Name of the index to query on
     * @param {IDBKeyRange} range - Range to Query for (null ok)
     * @param {Boolean} isFromId - If querying for results after a specified ID, then we want to skip the first result (which will be that ID) ("" is OK)
     * @param {number} pageSize - If a value is provided, return at most that number of results; else return all results.
     * @param {Function} callback
     * @param {Object[]} callback.result
     */

  }, {
    key: '_loadByIndex',
    value: function _loadByIndex(tableName, indexName, range, isFromId, pageSize, callback) {
      var _this20 = this;

      if (!this['_permission_' + tableName] || this._isOpenError) return callback([]);
      var shouldSkipNext = isFromId;
      this.onOpen(function () {
        var data = [];
        _this20.db.transaction([tableName], 'readonly').objectStore(tableName).index(indexName).openCursor(range, 'prev').onsuccess = function (evt) {
          var cursor = evt.target.result;
          if (cursor) {
            if (shouldSkipNext) {
              shouldSkipNext = false;
            } else {
              data.push(cursor.value);
            }
            if (pageSize && data.length >= pageSize) {
              callback(data);
            } else {
              cursor.continue();
            }
          } else if (!_this20.isDestroyed) {
            callback(data);
          }
        };
      });
    }

    /**
     * Deletes the specified objects from the specified table.
     *
     * Currently takes an array of data to delete rather than an array of IDs;
     * If you only have an ID, [{id: myId}] should work.
     *
     * @method deleteObjects
     * @param {String} tableName
     * @param {Object[]} data
     * @param {Function} [callback]
     */

  }, {
    key: 'deleteObjects',
    value: function deleteObjects(tableName, data, callback) {
      var _this21 = this;

      if (!this['_permission_' + tableName] || this._isOpenError) return callback ? callback() : null;
      this.onOpen(function () {
        var transaction = _this21.db.transaction([tableName], 'readwrite');
        var store = transaction.objectStore(tableName);
        transaction.oncomplete = callback;
        data.forEach(function (item) {
          return store.delete(item.id);
        });
      });
    }

    /**
     * Retrieve the identified objects from the specified database table.
     *
     * Turning these into instances is the responsibility of the caller.
     *
     * Inspired by http://www.codeproject.com/Articles/744986/How-to-do-some-magic-with-indexedDB
     *
     * @method getObjects
     * @param {String} tableName
     * @param {String[]} ids
     * @param {Function} callback
     * @param {Object[]} callback.result
     */

  }, {
    key: 'getObjects',
    value: function getObjects(tableName, ids, callback) {
      var _this22 = this;

      if (!this['_permission_' + tableName] || this._isOpenError) return callback([]);
      var data = [];

      // Gather, sort, and filter replica IDs
      var sortedIds = ids.sort();
      for (var i = sortedIds.length - 1; i > 0; i--) {
        if (sortedIds[i] === sortedIds[i - 1]) sortedIds.splice(i, 1);
      }
      var index = 0;

      // Iterate over the table searching for the specified IDs
      this.onOpen(function () {
        _this22.db.transaction([tableName], 'readonly').objectStore(tableName).openCursor().onsuccess = function (evt) {
          var cursor = evt.target.result;
          if (!cursor) {
            callback(data);
            return;
          }
          var key = cursor.key;

          // The cursor has passed beyond this key. Check next.
          while (key > sortedIds[index]) {
            index++;
          } // The cursor is pointing at one of our IDs, get it and check next.
          if (key === sortedIds[index]) {
            data.push(cursor.value);
            index++;
          }

          // Done or check next
          if (index === sortedIds.length) {
            if (!_this22.isDestroyed) callback(data);
          } else {
            cursor.continue(sortedIds[index]);
          }
        };
      });
    }

    /**
     * A simplified getObjects() method that gets a single object, and also gets its related objects.
     *
     * @method getObject
     * @param {string} tableName
     * @param {string} id
     * @param {Function} callback
     * @param {Object} callback.data
     */

  }, {
    key: 'getObject',
    value: function getObject(tableName, id, callback) {
      var _this23 = this;

      if (!this['_permission_' + tableName] || this._isOpenError) return callback();

      this.onOpen(function () {
        _this23.db.transaction([tableName], 'readonly').objectStore(tableName).openCursor(window.IDBKeyRange.only(id)).onsuccess = function (evt) {
          var cursor = evt.target.result;
          if (!cursor) return callback(null);

          switch (tableName) {
            case 'messages':
              cursor.value.conversation = {
                id: cursor.value.conversation
              };
              // Convert base64 to blob before sending it along...
              cursor.value.parts.forEach(function (part) {
                return _this23._blobifyPart(part);
              });
              return callback(cursor.value);
            case 'identities':
              return callback(cursor.value);
            case 'conversations':
              if (cursor.value.last_message && !_this23.client.getMessage(cursor.value.last_message)) {
                return _this23.getObject('messages', cursor.value.last_message, function (message) {
                  cursor.value.last_message = message;
                  callback(cursor.value);
                });
              } else {
                return callback(cursor.value);
              }
          }
        };
      });
    }

    /**
     * Claim a Sync Event.
     *
     * A sync event is claimed by locking the table,  validating that it is still in the table... and then deleting it from the table.
     *
     * @method claimSyncEvent
     * @param {layer.SyncEvent} syncEvent
     * @param {Function} callback
     * @param {Boolean} callback.result
     */

  }, {
    key: 'claimSyncEvent',
    value: function claimSyncEvent(syncEvent, callback) {
      var _this24 = this;

      if (!this._permission_syncQueue || this._isOpenError) return callback(true);
      this.onOpen(function () {
        var transaction = _this24.db.transaction(['syncQueue'], 'readwrite');
        var store = transaction.objectStore('syncQueue');
        store.get(syncEvent.id).onsuccess = function (evt) {
          return callback(Boolean(evt.target.result));
        };
        store.delete(syncEvent.id);
      });
    }

    /**
     * Delete all data from all tables.
     *
     * This should be called from layer.Client.logout()
     *
     * @method deleteTables
     * @param {Function} [calllback]
     */

  }, {
    key: 'deleteTables',
    value: function deleteTables() {
      var callback = arguments.length <= 0 || arguments[0] === undefined ? function () {} : arguments[0];

      try {
        var request = window.indexedDB.deleteDatabase(this._getDbName());
        request.onsuccess = request.onerror = callback;
        delete this.db;
      } catch (e) {
        logger.error('Failed to delete database', e);
        if (callback) callback(e);
      }
    }
  }]);

  return DbManager;
}(Root);

/**
 * @type {layer.Client} Layer Client instance
 */


DbManager.prototype.client = null;

/**
 * @type {boolean} is the db connection open
 */
DbManager.prototype.isOpen = false;

/**
 * @type {boolean} is the db connection will not open
 * @private
 */
DbManager.prototype._isOpenError = false;

/**
 * @type {boolean} Is reading/writing messages allowed?
 * @private
 */
DbManager.prototype._permission_messages = false;

/**
 * @type {boolean} Is reading/writing conversations allowed?
 * @private
 */
DbManager.prototype._permission_conversations = false;

/**
 * @type {boolean} Is reading/writing identities allowed?
 * @private
 */
DbManager.prototype._permission_identities = false;

/**
 * @type {boolean} Is reading/writing unsent server requests allowed?
 * @private
 */
DbManager.prototype._permission_syncQueue = false;

/**
 * @type IDBDatabase
 */
DbManager.prototype.db = null;

/**
 * Rich Content may be written to indexeddb and persisted... if its size is less than this number of bytes.
 *
 * This value can be customized; this example only writes Rich Content that is less than 5000 bytes
 *
 *    layer.DbManager.MaxPartSize = 5000;
 *
 * @static
 * @type {Number}
 */
DbManager.MaxPartSize = 250000;

DbManager._supportedEvents = ['open', 'error'].concat(Root._supportedEvents);

Root.initClass.apply(DbManager, [DbManager, 'DbManager']);
module.exports = DbManager;
//# sourceMappingURL=data:application/json;base64,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QUVBLFVBQVUsZ0JBQVYsR0FBNkIsQ0FDM0IsTUFEMkIsRUFDbkIsT0FEbUIsRUFFM0IsTUFGMkIsQ0FFcEIsS0FBSyxnQkFGZSxDQUE3Qjs7QUFJQSxLQUFLLFNBQUwsQ0FBZSxLQUFmLENBQXFCLFNBQXJCLEVBQWdDLENBQUMsU0FBRCxFQUFZLFdBQVosQ0FBaEM7QUFDQSxPQUFPLE9BQVAsR0FBaUIsU0FBakIiLCJmaWxlIjoiZGItbWFuYWdlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUGVyc2lzdGVuY2UgbWFuYWdlci5cbiAqXG4gKiBUaGlzIGNsYXNzIG1hbmFnZXMgYWxsIGluZGV4ZWREQiBhY2Nlc3MuICBJdCBpcyBub3QgcmVzcG9uc2libGUgZm9yIGFueSBsb2NhbFN0b3JhZ2UgYWNjZXNzLCB0aG91Z2ggaXQgbWF5XG4gKiByZWNlaXZlIGNvbmZpZ3VyYXRpb25zIHJlbGF0ZWQgdG8gZGF0YSBzdG9yZWQgaW4gbG9jYWxTdG9yYWdlLiAgSXQgd2lsbCBzaW1wbHkgaWdub3JlIHRob3NlIGNvbmZpZ3VyYXRpb25zLlxuICpcbiAqIFJpY2ggQ29udGVudCB3aWxsIGJlIHdyaXR0ZW4gdG8gSW5kZXhlZERCIGFzIGxvbmcgYXMgaXRzIHNtYWxsOyBzZWUgbGF5ZXIuRGJNYW5hZ2VyLk1heFBhcnRTaXplIGZvciBtb3JlIGluZm8uXG4gKlxuICogVE9ETzpcbiAqIDAuIFJlZGVzaWduIHRoaXMgc28gdGhhdCBrbm93bGVkZ2Ugb2YgdGhlIGRhdGEgaXMgbm90IGhhcmQtY29kZWQgaW5cbiAqIEBjbGFzcyBsYXllci5EYk1hbmFnZXJcbiAqIEBwcm90ZWN0ZWRcbiAqL1xuXG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi9yb290Jyk7XG5jb25zdCBsb2dnZXIgPSByZXF1aXJlKCcuL2xvZ2dlcicpO1xuY29uc3QgU3luY0V2ZW50ID0gcmVxdWlyZSgnLi9zeW5jLWV2ZW50Jyk7XG5jb25zdCBDb25zdGFudHMgPSByZXF1aXJlKCcuL2NvbnN0Jyk7XG5jb25zdCBVdGlsID0gcmVxdWlyZSgnLi9jbGllbnQtdXRpbHMnKTtcblxuY29uc3QgREJfVkVSU0lPTiA9IDI7XG5jb25zdCBNQVhfU0FGRV9JTlRFR0VSID0gOTAwNzE5OTI1NDc0MDk5MTtcbmNvbnN0IFNZTkNfTkVXID0gQ29uc3RhbnRzLlNZTkNfU1RBVEUuTkVXO1xuXG5mdW5jdGlvbiBnZXREYXRlKGluRGF0ZSkge1xuICByZXR1cm4gaW5EYXRlID8gaW5EYXRlLnRvSVNPU3RyaW5nKCkgOiBudWxsO1xufVxuXG5jb25zdCBUQUJMRVMgPSBbXG4gIHtcbiAgICBuYW1lOiAnY29udmVyc2F0aW9ucycsXG4gICAgaW5kZXhlczoge1xuICAgICAgY3JlYXRlZF9hdDogWydjcmVhdGVkX2F0J10sXG4gICAgICBsYXN0X21lc3NhZ2Vfc2VudDogWydsYXN0X21lc3NhZ2Vfc2VudCddXG4gICAgfSxcbiAgfSxcbiAge1xuICAgIG5hbWU6ICdtZXNzYWdlcycsXG4gICAgaW5kZXhlczoge1xuICAgICAgY29udmVyc2F0aW9uOiBbJ2NvbnZlcnNhdGlvbicsICdwb3NpdGlvbiddXG4gICAgfSxcbiAgfSxcbiAge1xuICAgIG5hbWU6ICdpZGVudGl0aWVzJyxcbiAgICBpbmRleGVzOiB7fSxcbiAgfSxcbiAge1xuICAgIG5hbWU6ICdzeW5jUXVldWUnLFxuICAgIGluZGV4ZXM6IHt9LFxuICB9LFxuXTtcblxuY2xhc3MgRGJNYW5hZ2VyIGV4dGVuZHMgUm9vdCB7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSB0aGUgREIgTWFuYWdlclxuICAgKlxuICAgKiBLZXkgY29uZmlndXJhdGlvbiBpcyB0aGUgbGF5ZXIuRGJNYW5hZ2VyLnBlcnNpc3RlbmNlRmVhdHVyZXMgcHJvcGVydHkuXG4gICAqXG4gICAqIEBtZXRob2QgY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAgICogQHBhcmFtIHtsYXllci5DbGllbnR9IG9wdGlvbnMuY2xpZW50XG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zLnBlcnNpc3RlbmNlRmVhdHVyZXNcbiAgICogQHJldHVybiB7bGF5ZXIuRGJNYW5hZ2VyfSB0aGlzXG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICAvLyBJZiBubyBpbmRleGVkREIsIHRyZWF0IGV2ZXJ5dGhpbmcgYXMgZGlzYWJsZWQuXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICBpZiAoIXdpbmRvdy5pbmRleGVkREIpIHtcbiAgICAgIG9wdGlvbnMudGFibGVzID0ge307XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRlc3QgaWYgQXJyYXlzIGFzIGtleXMgc3VwcG9ydGVkLCBkaXNhYmxlIHBlcnNpc3RlbmNlIGlmIG5vdFxuICAgICAgbGV0IGVuYWJsZWQgPSB0cnVlO1xuICAgICAgdHJ5IHtcbiAgICAgICAgd2luZG93LklEQktleVJhbmdlLmJvdW5kKFsnYW5ub3VuY2VtZW50JywgMF0sIFsnYW5ub3VuY2VtZW50JywgTUFYX1NBRkVfSU5URUdFUl0pO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIG9wdGlvbnMudGFibGVzID0ge307XG4gICAgICAgIGVuYWJsZWQgPSBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgLy8gSWYgQ2xpZW50IGlzIGEgbGF5ZXIuQ2xpZW50QXV0aGVudGljYXRvciwgaXQgd29uJ3Qgc3VwcG9ydCB0aGVzZSBldmVudHM7IHRoaXMgYWZmZWN0cyBVbml0IFRlc3RzXG4gICAgICBpZiAoZW5hYmxlZCAmJiB0aGlzLmNsaWVudC5jb25zdHJ1Y3Rvci5fc3VwcG9ydGVkRXZlbnRzLmluZGV4T2YoJ2NvbnZlcnNhdGlvbnM6YWRkJykgIT09IC0xKSB7XG4gICAgICAgIHRoaXMuY2xpZW50Lm9uKCdjb252ZXJzYXRpb25zOmFkZCcsIGV2dCA9PiB0aGlzLndyaXRlQ29udmVyc2F0aW9ucyhldnQuY29udmVyc2F0aW9ucykpO1xuXG4gICAgICAgIHRoaXMuY2xpZW50Lm9uKCdjb252ZXJzYXRpb25zOmNoYW5nZScsIGV2dCA9PiB0aGlzLl91cGRhdGVDb252ZXJzYXRpb24oZXZ0LnRhcmdldCwgZXZ0LmNoYW5nZXMpKTtcbiAgICAgICAgdGhpcy5jbGllbnQub24oJ2NvbnZlcnNhdGlvbnM6ZGVsZXRlIGNvbnZlcnNhdGlvbnM6c2VudC1lcnJvcicsIGV2dCA9PiB0aGlzLmRlbGV0ZU9iamVjdHMoJ2NvbnZlcnNhdGlvbnMnLCBbZXZ0LnRhcmdldF0pKTtcblxuICAgICAgICB0aGlzLmNsaWVudC5vbignbWVzc2FnZXM6YWRkJywgZXZ0ID0+IHRoaXMud3JpdGVNZXNzYWdlcyhldnQubWVzc2FnZXMpKTtcbiAgICAgICAgdGhpcy5jbGllbnQub24oJ21lc3NhZ2VzOmNoYW5nZScsIGV2dCA9PiB0aGlzLndyaXRlTWVzc2FnZXMoW2V2dC50YXJnZXRdKSk7XG4gICAgICAgIHRoaXMuY2xpZW50Lm9uKCdtZXNzYWdlczpkZWxldGUgbWVzc2FnZXM6c2VudC1lcnJvcicsIGV2dCA9PiB0aGlzLmRlbGV0ZU9iamVjdHMoJ21lc3NhZ2VzJywgW2V2dC50YXJnZXRdKSk7XG5cbiAgICAgICAgdGhpcy5jbGllbnQub24oJ2lkZW50aXRpZXM6YWRkJywgZXZ0ID0+IHRoaXMud3JpdGVJZGVudGl0aWVzKGV2dC5pZGVudGl0aWVzKSk7XG4gICAgICAgIHRoaXMuY2xpZW50Lm9uKCdpZGVudGl0aWVzOmNoYW5nZScsIGV2dCA9PiB0aGlzLndyaXRlSWRlbnRpdGllcyhbZXZ0LnRhcmdldF0pKTtcbiAgICAgICAgdGhpcy5jbGllbnQub24oJ2lkZW50aXRpZXM6dW5mb2xsb3cnLCBldnQgPT4gdGhpcy5kZWxldGVPYmplY3RzKCdpZGVudGl0aWVzJywgW2V2dC50YXJnZXRdKSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFN5bmMgUXVldWUgb25seSByZWFsbHkgd29ya3MgcHJvcGVybHkgaWYgd2UgaGF2ZSB0aGUgTWVzc2FnZXMgYW5kIENvbnZlcnNhdGlvbnMgd3JpdHRlbiB0byB0aGUgREI7IHR1cm4gaXQgb2ZmXG4gICAgICAvLyBpZiB0aGF0IHdvbid0IGJlIHRoZSBjYXNlLlxuICAgICAgaWYgKCFvcHRpb25zLnRhYmxlcy5jb252ZXJzYXRpb25zIHx8ICFvcHRpb25zLnRhYmxlcy5tZXNzYWdlcykge1xuICAgICAgICBvcHRpb25zLnRhYmxlcy5zeW5jUXVldWUgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBUQUJMRVMuZm9yRWFjaCgodGFibGVEZWYpID0+IHtcbiAgICAgIHRoaXNbJ19wZXJtaXNzaW9uXycgKyB0YWJsZURlZi5uYW1lXSA9IEJvb2xlYW4ob3B0aW9ucy50YWJsZXNbdGFibGVEZWYubmFtZV0pO1xuICAgIH0pO1xuICAgIHRoaXMuX29wZW4oZmFsc2UpO1xuICB9XG5cbiAgX2dldERiTmFtZSgpIHtcbiAgICByZXR1cm4gJ0xheWVyV2ViU0RLXycgKyB0aGlzLmNsaWVudC5hcHBJZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBPcGVuIHRoZSBEYXRhYmFzZSBDb25uZWN0aW9uLlxuICAgKlxuICAgKiBUaGlzIGlzIG9ubHkgY2FsbGVkIGJ5IHRoZSBjb25zdHJ1Y3Rvci5cbiAgICogQG1ldGhvZCBfb3BlblxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IHJldHJ5XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfb3BlbihyZXRyeSkge1xuICAgIGlmICh0aGlzLmRiKSB7XG4gICAgICB0aGlzLmRiLmNsb3NlKCk7XG4gICAgICBkZWxldGUgdGhpcy5kYjtcbiAgICB9XG5cbiAgICAvLyBBYm9ydCBpZiBhbGwgdGFibGVzIGFyZSBkaXNhYmxlZFxuICAgIGNvbnN0IGVuYWJsZWRUYWJsZXMgPSBUQUJMRVMuZmlsdGVyKHRhYmxlRGVmID0+IHRoaXNbJ19wZXJtaXNzaW9uXycgKyB0YWJsZURlZi5uYW1lXSk7XG4gICAgaWYgKGVuYWJsZWRUYWJsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLl9pc09wZW5FcnJvciA9IHRydWU7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2Vycm9yJywgeyBlcnJvcjogJ1BlcnNpc3RlbmNlIGlzIGRpc2FibGVkIGJ5IGFwcGxpY2F0aW9uJyB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBPcGVuIHRoZSBkYXRhYmFzZVxuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuY2xpZW50O1xuICAgIGNvbnN0IHJlcXVlc3QgPSB3aW5kb3cuaW5kZXhlZERCLm9wZW4odGhpcy5fZ2V0RGJOYW1lKCksIERCX1ZFUlNJT04pO1xuXG4gICAgdHJ5IHtcbiAgICAgIHJlcXVlc3Qub25lcnJvciA9IChldnQpID0+IHtcbiAgICAgICAgaWYgKCFyZXRyeSkge1xuICAgICAgICAgIHRoaXMuZGVsZXRlVGFibGVzKCgpID0+IHRoaXMuX29wZW4odHJ1ZSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVHJpZ2dlcmVkIGJ5IEZpcmVmb3ggcHJpdmF0ZSBicm93c2luZyB3aW5kb3dcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdGhpcy5faXNPcGVuRXJyb3IgPSB0cnVlO1xuICAgICAgICAgIGxvZ2dlci53YXJuKCdEYXRhYmFzZSBVbmFibGUgdG8gT3BlbiAoY29tbW9uIGNhdXNlOiBwcml2YXRlIGJyb3dzaW5nIHdpbmRvdyknLCBldnQudGFyZ2V0LmVycm9yKTtcbiAgICAgICAgICB0aGlzLnRyaWdnZXIoJ2Vycm9yJywgeyBlcnJvcjogZXZ0IH0pO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICByZXF1ZXN0Lm9udXBncmFkZW5lZWRlZCA9IChldnQpID0+IHRoaXMuX29uVXBncmFkZU5lZWRlZChldnQpO1xuICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSAoZXZ0KSA9PiB7XG4gICAgICAgIHRoaXMuZGIgPSBldnQudGFyZ2V0LnJlc3VsdDtcbiAgICAgICAgdGhpcy5pc09wZW4gPSB0cnVlO1xuICAgICAgICB0aGlzLnRyaWdnZXIoJ29wZW4nKTtcblxuICAgICAgICB0aGlzLmRiLm9udmVyc2lvbmNoYW5nZSA9ICgpID0+IHtcbiAgICAgICAgICB0aGlzLmRiLmNsb3NlKCk7XG4gICAgICAgICAgdGhpcy5pc09wZW4gPSBmYWxzZTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmRiLm9uZXJyb3IgPSBlcnIgPT4gbG9nZ2VyLmVycm9yKCdkYi1tYW5hZ2VyIEVycm9yOiAnLCBlcnIpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGNhdGNoKGVycikge1xuICAgICAgLy8gU2FmYXJpIFByaXZhdGUgQnJvd3Npbmcgd2luZG93IHdpbGwgZmFpbCBvbiByZXF1ZXN0Lm9uZXJyb3JcbiAgICAgIHRoaXMuX2lzT3BlbkVycm9yID0gdHJ1ZTtcbiAgICAgIGxvZ2dlci5lcnJvcignRGF0YWJhc2UgVW5hYmxlIHRvIE9wZW46ICcsIGVycik7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2Vycm9yJywgeyBlcnJvcjogZXJyIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBVc2UgdGhpcyB0byBzZXR1cCBhIGNhbGwgdG8gaGFwcGVuIGFzIHNvb24gYXMgdGhlIGRhdGFiYXNlIGlzIG9wZW4uXG4gICAqXG4gICAqIFR5cGljYWxseSwgdGhpcyBjYWxsIHdpbGwgaW1tZWRpYXRlbHksIHN5bmNocm9ub3VzbHkgY2FsbCB5b3VyIGNhbGxiYWNrLlxuICAgKiBCdXQgaWYgdGhlIERCIGlzIG5vdCBvcGVuIHlldCwgeW91ciBjYWxsYmFjayB3aWxsIGJlIGNhbGxlZCBvbmNlIGl0cyBvcGVuLlxuICAgKiBAbWV0aG9kIG9uT3BlblxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKi9cbiAgb25PcGVuKGNhbGxiYWNrKSB7XG4gICAgaWYgKHRoaXMuaXNPcGVuIHx8IHRoaXMuX2lzT3BlbkVycm9yKSBjYWxsYmFjaygpO1xuICAgIGVsc2UgdGhpcy5vbmNlKCdvcGVuIGVycm9yJywgY2FsbGJhY2spO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBvblVwZ3JhZGVOZWVkZWQgZnVuY3Rpb24gaXMgY2FsbGVkIGJ5IEluZGV4ZWREQiBhbnkgdGltZSBEQl9WRVJTSU9OIGlzIGluY3JlbWVudGVkLlxuICAgKlxuICAgKiBUaGlzIGludm9jYXRpb24gaXMgcGFydCBvZiB0aGUgYnVpbHQtaW4gbGlmZWN5Y2xlIG9mIEluZGV4ZWREQi5cbiAgICpcbiAgICogQG1ldGhvZCBfb25VcGdyYWRlTmVlZGVkXG4gICAqIEBwYXJhbSB7SURCVmVyc2lvbkNoYW5nZUV2ZW50fSBldmVudFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgX29uVXBncmFkZU5lZWRlZChldmVudCkge1xuICAgIGNvbnN0IGRiID0gZXZlbnQudGFyZ2V0LnJlc3VsdDtcbiAgICBsZXQgaXNDb21wbGV0ZSA9IGZhbHNlO1xuXG4gICAgLy8gVGhpcyBhcHBlYXJzIHRvIG9ubHkgZ2V0IGNhbGxlZCBvbmNlOyBpdHMgcHJlc3VtZWQgdGhpcyBpcyBiZWNhdXNlIHdlJ3JlIGNyZWF0aW5nIGJ1dCBub3QgdXNpbmcgYSBsb3Qgb2YgdHJhbnNhY3Rpb25zLlxuICAgIHZhciBvbkNvbXBsZXRlID0gKGV2dCkgPT4ge1xuICAgICAgaWYgKCFpc0NvbXBsZXRlKSB7XG4gICAgICAgIHRoaXMuZGIgPSBkYjtcbiAgICAgICAgdGhpcy5pc0NvbXBsZXRlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5pc09wZW4gPSB0cnVlO1xuICAgICAgICB0aGlzLnRyaWdnZXIoJ29wZW4nKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgY29uc3QgY3VycmVudFRhYmxlcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGRiLm9iamVjdFN0b3JlTmFtZXMpO1xuICAgIFRBQkxFUy5mb3JFYWNoKCh0YWJsZURlZikgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgaWYgKGN1cnJlbnRUYWJsZXMuaW5kZXhPZih0YWJsZURlZi5uYW1lKSAhPT0gLTEpIGRiLmRlbGV0ZU9iamVjdFN0b3JlKHRhYmxlRGVmLm5hbWUpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBOb29wXG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBzdG9yZSA9IGRiLmNyZWF0ZU9iamVjdFN0b3JlKHRhYmxlRGVmLm5hbWUsIHsga2V5UGF0aDogJ2lkJyB9KTtcbiAgICAgICAgT2JqZWN0LmtleXModGFibGVEZWYuaW5kZXhlcylcbiAgICAgICAgICAuZm9yRWFjaChpbmRleE5hbWUgPT4gc3RvcmUuY3JlYXRlSW5kZXgoaW5kZXhOYW1lLCB0YWJsZURlZi5pbmRleGVzW2luZGV4TmFtZV0sIHsgdW5pcXVlOiBmYWxzZSB9KSk7XG4gICAgICAgIHN0b3JlLnRyYW5zYWN0aW9uLm9uY29tcGxldGUgPSBvbkNvbXBsZXRlO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBOb29wXG4gICAgICAgIGxvZ2dlci5lcnJvcihgRmFpbGVkIHRvIGNyZWF0ZSBvYmplY3Qgc3RvcmUgJHt0YWJsZURlZi5uYW1lfWAsIGUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgYXJyYXkgb2YgQ29udmVyc2F0aW9uIGluc3RhbmNlcyBpbnRvIENvbnZlcnNhdGlvbiBEQiBFbnRyaWVzLlxuICAgKlxuICAgKiBBIENvbnZlcnNhdGlvbiBEQiBlbnRyeSBsb29rcyBhIGxvdCBsaWtlIHRoZSBzZXJ2ZXIgcmVwcmVzZW50YXRpb24sIGJ1dFxuICAgKiBpbmNsdWRlcyBhIHN5bmNfc3RhdGUgcHJvcGVydHksIGFuZCBgbGFzdF9tZXNzYWdlYCBjb250YWlucyBhIG1lc3NhZ2UgSUQgbm90XG4gICAqIGEgTWVzc2FnZSBvYmplY3QuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldENvbnZlcnNhdGlvbkRhdGFcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5Db252ZXJzYXRpb25bXX0gY29udmVyc2F0aW9uc1xuICAgKiBAcmV0dXJuIHtPYmplY3RbXX0gY29udmVyc2F0aW9uc1xuICAgKi9cbiAgX2dldENvbnZlcnNhdGlvbkRhdGEoY29udmVyc2F0aW9ucykge1xuICAgIHJldHVybiBjb252ZXJzYXRpb25zLmZpbHRlcihjb252ZXJzYXRpb24gPT4ge1xuICAgICAgaWYgKGNvbnZlcnNhdGlvbi5fZnJvbURCKSB7XG4gICAgICAgIGNvbnZlcnNhdGlvbi5fZnJvbURCID0gZmFsc2U7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0gZWxzZSBpZiAoY29udmVyc2F0aW9uLmlzTG9hZGluZyB8fCBjb252ZXJzYXRpb24uc3luY1N0YXRlID09PSBTWU5DX05FVykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KS5tYXAoY29udmVyc2F0aW9uID0+IHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB7XG4gICAgICAgIGlkOiBjb252ZXJzYXRpb24uaWQsXG4gICAgICAgIHVybDogY29udmVyc2F0aW9uLnVybCxcbiAgICAgICAgcGFydGljaXBhbnRzOiB0aGlzLl9nZXRJZGVudGl0eURhdGEoY29udmVyc2F0aW9uLnBhcnRpY2lwYW50cywgdHJ1ZSksXG4gICAgICAgIGRpc3RpbmN0OiBjb252ZXJzYXRpb24uZGlzdGluY3QsXG4gICAgICAgIGNyZWF0ZWRfYXQ6IGdldERhdGUoY29udmVyc2F0aW9uLmNyZWF0ZWRBdCksXG4gICAgICAgIG1ldGFkYXRhOiBjb252ZXJzYXRpb24ubWV0YWRhdGEsXG4gICAgICAgIHVucmVhZF9tZXNzYWdlX2NvdW50OiBjb252ZXJzYXRpb24udW5yZWFkQ291bnQsXG4gICAgICAgIGxhc3RfbWVzc2FnZTogY29udmVyc2F0aW9uLmxhc3RNZXNzYWdlID8gY29udmVyc2F0aW9uLmxhc3RNZXNzYWdlLmlkIDogJycsXG4gICAgICAgIGxhc3RfbWVzc2FnZV9zZW50OiBjb252ZXJzYXRpb24ubGFzdE1lc3NhZ2UgPyBnZXREYXRlKGNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZS5zZW50QXQpIDogZ2V0RGF0ZShjb252ZXJzYXRpb24uY3JlYXRlZEF0KSxcbiAgICAgICAgc3luY19zdGF0ZTogY29udmVyc2F0aW9uLnN5bmNTdGF0ZSxcbiAgICAgIH07XG4gICAgICByZXR1cm4gaXRlbTtcbiAgICB9KTtcbiAgfVxuXG4gIF91cGRhdGVDb252ZXJzYXRpb24oY29udmVyc2F0aW9uLCBjaGFuZ2VzKSB7XG4gICAgdmFyIGlkQ2hhbmdlcyA9IGNoYW5nZXMuZmlsdGVyKGl0ZW0gPT4gaXRlbS5wcm9wZXJ0eSA9PT0gJ2lkJyk7XG4gICAgaWYgKGlkQ2hhbmdlcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuZGVsZXRlT2JqZWN0cygnY29udmVyc2F0aW9ucycsIFt7aWQ6IGlkQ2hhbmdlc1swXS5vbGRWYWx1ZX1dLCAoKSA9PiB7XG4gICAgICAgIHRoaXMud3JpdGVDb252ZXJzYXRpb25zKFtjb252ZXJzYXRpb25dKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLndyaXRlQ29udmVyc2F0aW9ucyhbY29udmVyc2F0aW9uXSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFdyaXRlcyBhbiBhcnJheSBvZiBDb252ZXJzYXRpb25zIHRvIHRoZSBEYXRhYmFzZS5cbiAgICpcbiAgICogQG1ldGhvZCB3cml0ZUNvbnZlcnNhdGlvbnNcbiAgICogQHBhcmFtIHtsYXllci5Db252ZXJzYXRpb25bXX0gY29udmVyc2F0aW9ucyAtIEFycmF5IG9mIENvbnZlcnNhdGlvbnMgdG8gd3JpdGVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXVxuICAgKi9cbiAgd3JpdGVDb252ZXJzYXRpb25zKGNvbnZlcnNhdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5fd3JpdGVPYmplY3RzKCdjb252ZXJzYXRpb25zJyxcbiAgICAgIHRoaXMuX2dldENvbnZlcnNhdGlvbkRhdGEoY29udmVyc2F0aW9ucy5maWx0ZXIoY29udmVyc2F0aW9uID0+ICFjb252ZXJzYXRpb24uaXNEZXN0cm95ZWQpKSwgY2FsbGJhY2spO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgYXJyYXkgb2YgSWRlbnRpdHkgaW5zdGFuY2VzIGludG8gSWRlbnRpdHkgREIgRW50cmllcy5cbiAgICpcbiAgICogQG1ldGhvZCBfZ2V0SWRlbnRpdHlEYXRhXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7bGF5ZXIuSWRlbnRpdHlbXX0gaWRlbnRpdGllc1xuICAgKiBAcGFyYW0ge2Jvb2xlYW59IHdyaXRlQmFzaWNJZGVudGl0eSAtIEZvcmNlcyBvdXRwdXQgYXMgYSBCYXNpYyBJZGVudGl0eVxuICAgKiBAcmV0dXJuIHtPYmplY3RbXX0gaWRlbnRpdGllc1xuICAgKi9cbiAgX2dldElkZW50aXR5RGF0YShpZGVudGl0aWVzLCB3cml0ZUJhc2ljSWRlbnRpdHkpIHtcbiAgICByZXR1cm4gaWRlbnRpdGllcy5maWx0ZXIoKGlkZW50aXR5KSA9PiB7XG4gICAgICBpZiAoaWRlbnRpdHkuaXNEZXN0cm95ZWQgfHwgIWlkZW50aXR5LmlzRnVsbElkZW50aXR5ICYmICF3cml0ZUJhc2ljSWRlbnRpdHkpIHJldHVybiBmYWxzZTtcblxuICAgICAgaWYgKGlkZW50aXR5Ll9mcm9tREIpIHtcbiAgICAgICAgaWRlbnRpdHkuX2Zyb21EQiA9IGZhbHNlO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGVsc2UgaWYgKGlkZW50aXR5LmlzTG9hZGluZykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KS5tYXAoKGlkZW50aXR5KSA9PiB7XG4gICAgICBpZiAoaWRlbnRpdHkuaXNGdWxsSWRlbnRpdHkgJiYgIXdyaXRlQmFzaWNJZGVudGl0eSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGlkOiBpZGVudGl0eS5pZCxcbiAgICAgICAgICB1cmw6IGlkZW50aXR5LnVybCxcbiAgICAgICAgICB1c2VyX2lkOiBpZGVudGl0eS51c2VySWQsXG4gICAgICAgICAgZmlyc3RfbmFtZTogaWRlbnRpdHkuZmlyc3ROYW1lLFxuICAgICAgICAgIGxhc3RfbmFtZTogaWRlbnRpdHkubGFzdE5hbWUsXG4gICAgICAgICAgZGlzcGxheV9uYW1lOiBpZGVudGl0eS5kaXNwbGF5TmFtZSxcbiAgICAgICAgICBhdmF0YXJfdXJsOiBpZGVudGl0eS5hdmF0YXJVcmwsXG4gICAgICAgICAgbWV0YWRhdGE6IGlkZW50aXR5Lm1ldGFkYXRhLFxuICAgICAgICAgIHB1YmxpY19rZXk6IGlkZW50aXR5LnB1YmxpY0tleSxcbiAgICAgICAgICBwaG9uZV9udW1iZXI6IGlkZW50aXR5LnBob25lTnVtYmVyLFxuICAgICAgICAgIGVtYWlsX2FkZHJlc3M6IGlkZW50aXR5LmVtYWlsQWRkcmVzcyxcbiAgICAgICAgICBzeW5jX3N0YXRlOiBpZGVudGl0eS5zeW5jU3RhdGUsXG4gICAgICAgICAgdHlwZTogaWRlbnRpdHkudHlwZSxcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgaWQ6IGlkZW50aXR5LmlkLFxuICAgICAgICAgIHVybDogaWRlbnRpdHkudXJsLFxuICAgICAgICAgIHVzZXJfaWQ6IGlkZW50aXR5LnVzZXJJZCxcbiAgICAgICAgICBkaXNwbGF5X25hbWU6IGlkZW50aXR5LmRpc3BsYXlOYW1lLFxuICAgICAgICAgIGF2YXRhcl91cmw6IGlkZW50aXR5LmF2YXRhclVybCxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBXcml0ZXMgYW4gYXJyYXkgb2YgSWRlbnRpdGllcyB0byB0aGUgRGF0YWJhc2UuXG4gICAqXG4gICAqIEBtZXRob2Qgd3JpdGVJZGVudGl0aWVzXG4gICAqIEBwYXJhbSB7bGF5ZXIuSWRlbnRpdHlbXX0gaWRlbnRpdGllcyAtIEFycmF5IG9mIElkZW50aXRpZXMgdG8gd3JpdGVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXVxuICAgKi9cbiAgd3JpdGVJZGVudGl0aWVzKGlkZW50aXRpZXMsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5fd3JpdGVPYmplY3RzKCdpZGVudGl0aWVzJyxcbiAgICAgIHRoaXMuX2dldElkZW50aXR5RGF0YShpZGVudGl0aWVzKSwgY2FsbGJhY2spO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgYXJyYXkgb2YgTWVzc2FnZSBpbnN0YW5jZXMgaW50byBNZXNzYWdlIERCIEVudHJpZXMuXG4gICAqXG4gICAqIEEgTWVzc2FnZSBEQiBlbnRyeSBsb29rcyBhIGxvdCBsaWtlIHRoZSBzZXJ2ZXIgcmVwcmVzZW50YXRpb24sIGJ1dFxuICAgKiBpbmNsdWRlcyBhIHN5bmNfc3RhdGUgcHJvcGVydHkuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldE1lc3NhZ2VEYXRhXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7bGF5ZXIuTWVzc2FnZVtdfSBtZXNzYWdlc1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcmV0dXJuIHtPYmplY3RbXX0gbWVzc2FnZXNcbiAgICovXG4gIF9nZXRNZXNzYWdlRGF0YShtZXNzYWdlcywgY2FsbGJhY2spIHtcbiAgICBjb25zdCBkYk1lc3NhZ2VzID0gbWVzc2FnZXMuZmlsdGVyKG1lc3NhZ2UgPT4ge1xuICAgICAgaWYgKG1lc3NhZ2UuX2Zyb21EQikge1xuICAgICAgICBtZXNzYWdlLl9mcm9tREIgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSBlbHNlIGlmIChtZXNzYWdlLnN5bmNTdGF0ZSA9PT0gQ29uc3RhbnRzLlNZTkNfU1RBVEUuTE9BRElORykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KS5tYXAobWVzc2FnZSA9PiAoe1xuICAgICAgaWQ6IG1lc3NhZ2UuaWQsXG4gICAgICB1cmw6IG1lc3NhZ2UudXJsLFxuICAgICAgcGFydHM6IG1lc3NhZ2UucGFydHMubWFwKHBhcnQgPT4ge1xuICAgICAgICBjb25zdCBib2R5ID0gVXRpbC5pc0Jsb2IocGFydC5ib2R5KSAmJiBwYXJ0LmJvZHkuc2l6ZSA+IERiTWFuYWdlci5NYXhQYXJ0U2l6ZSA/IG51bGwgOiBwYXJ0LmJvZHk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgYm9keSxcbiAgICAgICAgICBpZDogcGFydC5pZCxcbiAgICAgICAgICBlbmNvZGluZzogcGFydC5lbmNvZGluZyxcbiAgICAgICAgICBtaW1lX3R5cGU6IHBhcnQubWltZVR5cGUsXG4gICAgICAgICAgY29udGVudDogIXBhcnQuX2NvbnRlbnQgPyBudWxsIDoge1xuICAgICAgICAgICAgaWQ6IHBhcnQuX2NvbnRlbnQuaWQsXG4gICAgICAgICAgICBkb3dubG9hZF91cmw6IHBhcnQuX2NvbnRlbnQuZG93bmxvYWRVcmwsXG4gICAgICAgICAgICBleHBpcmF0aW9uOiBwYXJ0Ll9jb250ZW50LmV4cGlyYXRpb24sXG4gICAgICAgICAgICByZWZyZXNoX3VybDogcGFydC5fY29udGVudC5yZWZyZXNoVXJsLFxuICAgICAgICAgICAgc2l6ZTogcGFydC5fY29udGVudC5zaXplLFxuICAgICAgICAgIH0sXG4gICAgICAgIH07XG4gICAgICB9KSxcbiAgICAgIHBvc2l0aW9uOiBtZXNzYWdlLnBvc2l0aW9uLFxuICAgICAgc2VuZGVyOiB0aGlzLl9nZXRJZGVudGl0eURhdGEoW21lc3NhZ2Uuc2VuZGVyXSwgdHJ1ZSlbMF0sXG4gICAgICByZWNpcGllbnRfc3RhdHVzOiBtZXNzYWdlLnJlY2lwaWVudFN0YXR1cyxcbiAgICAgIHNlbnRfYXQ6IGdldERhdGUobWVzc2FnZS5zZW50QXQpLFxuICAgICAgcmVjZWl2ZWRfYXQ6IGdldERhdGUobWVzc2FnZS5yZWNlaXZlZEF0KSxcbiAgICAgIGNvbnZlcnNhdGlvbjogbWVzc2FnZS5jb25zdHJ1Y3Rvci5wcmVmaXhVVUlEID09PSAnbGF5ZXI6Ly8vYW5ub3VuY2VtZW50cy8nID8gJ2Fubm91bmNlbWVudCcgOiBtZXNzYWdlLmNvbnZlcnNhdGlvbklkLFxuICAgICAgc3luY19zdGF0ZTogbWVzc2FnZS5zeW5jU3RhdGUsXG4gICAgICBpc191bnJlYWQ6IG1lc3NhZ2UuaXNVbnJlYWQsXG4gICAgfSkpO1xuXG4gICAgLy8gRmluZCBhbGwgYmxvYnMgYW5kIGNvbnZlcnQgdGhlbSB0byBiYXNlNjQuLi4gYmVjYXVzZSBTYWZhcmkgOS4xIGRvZXNuJ3Qgc3VwcG9ydCB3cml0aW5nIGJsb2JzIHRob3NlIEZyZWxsaW5nIFNtdXJmcy5cbiAgICBsZXQgY291bnQgPSAwO1xuICAgIGNvbnN0IHBhcnRzID0gW107XG4gICAgZGJNZXNzYWdlcy5mb3JFYWNoKChtZXNzYWdlKSA9PiB7XG4gICAgICBtZXNzYWdlLnBhcnRzLmZvckVhY2goKHBhcnQpID0+IHtcbiAgICAgICAgaWYgKFV0aWwuaXNCbG9iKHBhcnQuYm9keSkpIHBhcnRzLnB1c2gocGFydCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBpZiAocGFydHMubGVuZ3RoID09PSAwKSB7XG4gICAgICBjYWxsYmFjayhkYk1lc3NhZ2VzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGFydHMuZm9yRWFjaCgocGFydCkgPT4ge1xuICAgICAgICBVdGlsLmJsb2JUb0Jhc2U2NChwYXJ0LmJvZHksIChiYXNlNjQpID0+IHtcbiAgICAgICAgICBwYXJ0LmJvZHkgPSBiYXNlNjQ7XG4gICAgICAgICAgcGFydC51c2VCbG9iID0gdHJ1ZTtcbiAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgIGlmIChjb3VudCA9PT0gcGFydHMubGVuZ3RoKSBjYWxsYmFjayhkYk1lc3NhZ2VzKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogV3JpdGVzIGFuIGFycmF5IG9mIE1lc3NhZ2VzIHRvIHRoZSBEYXRhYmFzZS5cbiAgICpcbiAgICogQG1ldGhvZCB3cml0ZU1lc3NhZ2VzXG4gICAqIEBwYXJhbSB7bGF5ZXIuTWVzc2FnZVtdfSBtZXNzYWdlcyAtIEFycmF5IG9mIE1lc3NhZ2VzIHRvIHdyaXRlXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja11cbiAgICovXG4gIHdyaXRlTWVzc2FnZXMobWVzc2FnZXMsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5fZ2V0TWVzc2FnZURhdGEoXG4gICAgICBtZXNzYWdlcy5maWx0ZXIobWVzc2FnZSA9PiAhbWVzc2FnZS5pc0Rlc3Ryb3llZCksXG4gICAgICBkYk1lc3NhZ2VEYXRhID0+IHRoaXMuX3dyaXRlT2JqZWN0cygnbWVzc2FnZXMnLCBkYk1lc3NhZ2VEYXRhLCBjYWxsYmFjaylcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgYXJyYXkgb2YgU3luY0V2ZW50IGluc3RhbmNlcyBpbnRvIFN5bmNFdmVudCBEQiBFbnRyaWVzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRTeW5jRXZlbnREYXRhXG4gICAqIEBwYXJhbSB7bGF5ZXIuU3luY0V2ZW50W119IHN5bmNFdmVudHNcbiAgICogQHJldHVybiB7T2JqZWN0W119IHN5bmNFdmVudHNcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9nZXRTeW5jRXZlbnREYXRhKHN5bmNFdmVudHMpIHtcbiAgICByZXR1cm4gc3luY0V2ZW50cy5maWx0ZXIoc3luY0V2dCA9PiB7XG4gICAgICBpZiAoc3luY0V2dC5mcm9tREIpIHtcbiAgICAgICAgc3luY0V2dC5mcm9tREIgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfSkubWFwKHN5bmNFdmVudCA9PiB7XG4gICAgICBjb25zdCBpdGVtID0ge1xuICAgICAgICBpZDogc3luY0V2ZW50LmlkLFxuICAgICAgICB0YXJnZXQ6IHN5bmNFdmVudC50YXJnZXQsXG4gICAgICAgIGRlcGVuZHM6IHN5bmNFdmVudC5kZXBlbmRzLFxuICAgICAgICBpc1dlYnNvY2tldDogc3luY0V2ZW50IGluc3RhbmNlb2YgU3luY0V2ZW50LldlYnNvY2tldFN5bmNFdmVudCxcbiAgICAgICAgb3BlcmF0aW9uOiBzeW5jRXZlbnQub3BlcmF0aW9uLFxuICAgICAgICBkYXRhOiBzeW5jRXZlbnQuZGF0YSxcbiAgICAgICAgdXJsOiBzeW5jRXZlbnQudXJsIHx8ICcnLFxuICAgICAgICBoZWFkZXJzOiBzeW5jRXZlbnQuaGVhZGVycyB8fCBudWxsLFxuICAgICAgICBtZXRob2Q6IHN5bmNFdmVudC5tZXRob2QgfHwgbnVsbCxcbiAgICAgICAgY3JlYXRlZF9hdDogc3luY0V2ZW50LmNyZWF0ZWRBdCxcbiAgICAgIH07XG4gICAgICByZXR1cm4gaXRlbTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBXcml0ZXMgYW4gYXJyYXkgb2YgU3luY0V2ZW50IHRvIHRoZSBEYXRhYmFzZS5cbiAgICpcbiAgICogQG1ldGhvZCB3cml0ZVN5bmNFdmVudHNcbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnRbXX0gc3luY0V2ZW50cyAtIEFycmF5IG9mIFN5bmMgRXZlbnRzIHRvIHdyaXRlXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja11cbiAgICovXG4gIHdyaXRlU3luY0V2ZW50cyhzeW5jRXZlbnRzLCBjYWxsYmFjaykge1xuICAgIHRoaXMuX3dyaXRlT2JqZWN0cygnc3luY1F1ZXVlJywgdGhpcy5fZ2V0U3luY0V2ZW50RGF0YShzeW5jRXZlbnRzKSwgY2FsbGJhY2spO1xuICB9XG5cblxuICAvKipcbiAgICogV3JpdGUgYW4gYXJyYXkgb2YgZGF0YSB0byB0aGUgc3BlY2lmaWVkIERhdGFiYXNlIHRhYmxlLlxuICAgKlxuICAgKiBAbWV0aG9kIF93cml0ZU9iamVjdHNcbiAgICogQHBhcmFtIHtzdHJpbmd9IHRhYmxlTmFtZSAtIFRoZSBuYW1lIG9mIHRoZSB0YWJsZSB0byB3cml0ZSB0b1xuICAgKiBAcGFyYW0ge09iamVjdFtdfSBkYXRhIC0gQXJyYXkgb2YgUE9KTyBkYXRhIHRvIHdyaXRlXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja10gLSBDYWxsZWQgd2hlbiBhbGwgZGF0YSBpcyB3cml0dGVuXG4gICAqIEBwcm90ZWN0ZWRcbiAgICovXG4gIF93cml0ZU9iamVjdHModGFibGVOYW1lLCBkYXRhLCBjYWxsYmFjaykge1xuICAgIGlmICghdGhpc1snX3Blcm1pc3Npb25fJyArIHRhYmxlTmFtZV0gfHwgdGhpcy5faXNPcGVuRXJyb3IpIHJldHVybiBjYWxsYmFjayA/IGNhbGxiYWNrKCkgOiBudWxsO1xuXG4gICAgLy8gSnVzdCBxdWl0IGlmIG5vIGRhdGEgdG8gd3JpdGVcbiAgICBpZiAoIWRhdGEubGVuZ3RoKSB7XG4gICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gUFVUICh1ZHBhdGUpIG9yIEFERCAoaW5zZXJ0KSBlYWNoIGl0ZW0gb2YgZGF0YSBvbmUgYXQgYSB0aW1lLCBidXQgYWxsIGFzIHBhcnQgb2Ygb25lIGxhcmdlIHRyYW5zYWN0aW9uLlxuICAgIHRoaXMub25PcGVuKCgpID0+IHtcbiAgICAgIHRoaXMuZ2V0T2JqZWN0cyh0YWJsZU5hbWUsIGRhdGEubWFwKGl0ZW0gPT4gaXRlbS5pZCksIChmb3VuZEl0ZW1zKSA9PiB7XG4gICAgICAgIGNvbnN0IHVwZGF0ZUlkcyA9IHt9O1xuICAgICAgICBmb3VuZEl0ZW1zLmZvckVhY2goaXRlbSA9PiB7IHVwZGF0ZUlkc1tpdGVtLmlkXSA9IGl0ZW07IH0pO1xuXG4gICAgICAgIGNvbnN0IHRyYW5zYWN0aW9uID0gdGhpcy5kYi50cmFuc2FjdGlvbihbdGFibGVOYW1lXSwgJ3JlYWR3cml0ZScpO1xuICAgICAgICBjb25zdCBzdG9yZSA9IHRyYW5zYWN0aW9uLm9iamVjdFN0b3JlKHRhYmxlTmFtZSk7XG4gICAgICAgIHRyYW5zYWN0aW9uLm9uY29tcGxldGUgPSB0cmFuc2FjdGlvbi5vbmVycm9yID0gY2FsbGJhY2s7XG5cbiAgICAgICAgZGF0YS5mb3JFYWNoKGl0ZW0gPT4ge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAodXBkYXRlSWRzW2l0ZW0uaWRdKSB7XG4gICAgICAgICAgICAgIHN0b3JlLnB1dChpdGVtKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHN0b3JlLmFkZChpdGVtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAvLyBTYWZhcmkgdGhyb3dzIGFuIGVycm9yIHJhdGhlciB0aGFuIHVzZSB0aGUgb25lcnJvciBldmVudC5cbiAgICAgICAgICAgIGxvZ2dlci5lcnJvcihlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogTG9hZCBhbGwgY29udmVyc2F0aW9ucyBmcm9tIHRoZSBkYXRhYmFzZS5cbiAgICpcbiAgICogQG1ldGhvZCBsb2FkQ29udmVyc2F0aW9uc1xuICAgKiBAcGFyYW0ge3N0cmluZ30gc29ydEJ5ICAgICAgIC0gT25lIG9mICdsYXN0X21lc3NhZ2UnIG9yICdjcmVhdGVkX2F0JzsgYWx3YXlzIHNvcnRzIGluIERFU0Mgb3JkZXJcbiAgICogQHBhcmFtIHtzdHJpbmd9IFtmcm9tSWQ9XSAgICAtIEZvciBwYWdpbmF0aW9uLCBwcm92aWRlIHRoZSBjb252ZXJzYXRpb25JZCB0byBnZXQgQ29udmVyc2F0aW9ucyBhZnRlclxuICAgKiBAcGFyYW0ge251bWJlcn0gW3BhZ2VTaXplPV0gIC0gVG8gbGltaXQgdGhlIG51bWJlciBvZiByZXN1bHRzLCBwcm92aWRlIGEgbnVtYmVyIGZvciBob3cgbWFueSByZXN1bHRzIHRvIHJldHVybi5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSAgLSBDYWxsYmFjayBmb3IgZ2V0dGluZyByZXN1bHRzXG4gICAqIEBwYXJhbSB7bGF5ZXIuQ29udmVyc2F0aW9uW119IGNhbGxiYWNrLnJlc3VsdFxuICAgKi9cbiAgbG9hZENvbnZlcnNhdGlvbnMoc29ydEJ5LCBmcm9tSWQsIHBhZ2VTaXplLCBjYWxsYmFjaykge1xuICAgIHRyeSB7XG4gICAgICBsZXQgc29ydEluZGV4LFxuICAgICAgICByYW5nZSA9IG51bGw7XG4gICAgICBjb25zdCBmcm9tQ29udmVyc2F0aW9uID0gZnJvbUlkID8gdGhpcy5jbGllbnQuZ2V0Q29udmVyc2F0aW9uKGZyb21JZCkgOiBudWxsO1xuICAgICAgaWYgKHNvcnRCeSA9PT0gJ2xhc3RfbWVzc2FnZScpIHtcbiAgICAgICAgc29ydEluZGV4ID0gJ2xhc3RfbWVzc2FnZV9zZW50JztcbiAgICAgICAgaWYgKGZyb21Db252ZXJzYXRpb24pIHtcbiAgICAgICAgICByYW5nZSA9IHdpbmRvdy5JREJLZXlSYW5nZS51cHBlckJvdW5kKFtmcm9tQ29udmVyc2F0aW9uLmxhc3RNZXNzYWdlID9cbiAgICAgICAgICAgIGdldERhdGUoZnJvbUNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZS5zZW50QXQpIDogZ2V0RGF0ZShmcm9tQ29udmVyc2F0aW9uLmNyZWF0ZWRBdCldKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc29ydEluZGV4ID0gJ2NyZWF0ZWRfYXQnO1xuICAgICAgICBpZiAoZnJvbUNvbnZlcnNhdGlvbikge1xuICAgICAgICAgIHJhbmdlID0gd2luZG93LklEQktleVJhbmdlLnVwcGVyQm91bmQoW2dldERhdGUoZnJvbUNvbnZlcnNhdGlvbi5jcmVhdGVkQXQpXSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gU3RlcCAxOiBHZXQgYWxsIENvbnZlcnNhdGlvbnNcbiAgICAgIHRoaXMuX2xvYWRCeUluZGV4KCdjb252ZXJzYXRpb25zJywgc29ydEluZGV4LCByYW5nZSwgQm9vbGVhbihmcm9tSWQpLCBwYWdlU2l6ZSwgKGRhdGEpID0+IHtcbiAgICAgICAgLy8gU3RlcCAyOiBHYXRoZXIgYWxsIE1lc3NhZ2UgSURzIG5lZWRlZCB0byBpbml0aWFsaXplIHRoZXNlIENvbnZlcnNhdGlvbidzIGxhc3RNZXNzYWdlIHByb3BlcnRpZXMuXG4gICAgICAgIGNvbnN0IG1lc3NhZ2VzVG9Mb2FkID0gZGF0YVxuICAgICAgICAgIC5tYXAoaXRlbSA9PiBpdGVtLmxhc3RfbWVzc2FnZSlcbiAgICAgICAgICAuZmlsdGVyKG1lc3NhZ2VJZCA9PiBtZXNzYWdlSWQgJiYgIXRoaXMuY2xpZW50LmdldE1lc3NhZ2UobWVzc2FnZUlkKSk7XG5cbiAgICAgICAgLy8gU3RlcCAzOiBMb2FkIGFsbCBNZXNzYWdlcyBuZWVkZWQgdG8gaW5pdGlhbGl6ZSB0aGVzZSBDb252ZXJzYXRpb24ncyBsYXN0TWVzc2FnZSBwcm9wZXJ0aWVzLlxuICAgICAgICB0aGlzLmdldE9iamVjdHMoJ21lc3NhZ2VzJywgbWVzc2FnZXNUb0xvYWQsIChtZXNzYWdlcykgPT4ge1xuICAgICAgICAgIHRoaXMuX2xvYWRDb252ZXJzYXRpb25zUmVzdWx0KGRhdGEsIG1lc3NhZ2VzLCBjYWxsYmFjayk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gTm9vcCAtLSBoYW5kbGUgYnJvd3NlcnMgbGlrZSBJRSB0aGF0IGRvbid0IGxpa2UgdGhlc2UgSURCS2V5UmFuZ2VzXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFzc2VtYmxlIGFsbCBMYXN0TWVzc2FnZXMgYW5kIENvbnZlcnNhdGlvbiBQT0pPcyBpbnRvIGxheWVyLk1lc3NhZ2UgYW5kIGxheWVyLkNvbnZlcnNhdGlvbiBpbnN0YW5jZXMuXG4gICAqXG4gICAqIEBtZXRob2QgX2xvYWRDb252ZXJzYXRpb25zUmVzdWx0XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7T2JqZWN0W119IGNvbnZlcnNhdGlvbnNcbiAgICogQHBhcmFtIHtPYmplY3RbXX0gbWVzc2FnZXNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtIHtsYXllci5Db252ZXJzYXRpb25bXX0gY2FsbGJhY2sucmVzdWx0XG4gICAqL1xuICBfbG9hZENvbnZlcnNhdGlvbnNSZXN1bHQoY29udmVyc2F0aW9ucywgbWVzc2FnZXMsIGNhbGxiYWNrKSB7XG4gICAgLy8gSW5zdGFudGlhdGUgYW5kIFJlZ2lzdGVyIGVhY2ggTWVzc2FnZVxuICAgIG1lc3NhZ2VzLmZvckVhY2gobWVzc2FnZSA9PiB0aGlzLl9jcmVhdGVNZXNzYWdlKG1lc3NhZ2UpKTtcblxuICAgIC8vIEluc3RhbnRpYXRlIGFuZCBSZWdpc3RlciBlYWNoIENvbnZlcnNhdGlvbjsgd2lsbCBmaW5kIGFueSBsYXN0TWVzc2FnZSB0aGF0IHdhcyByZWdpc3RlcmVkLlxuICAgIGNvbnN0IG5ld0RhdGEgPSBjb252ZXJzYXRpb25zXG4gICAgICAubWFwKGNvbnZlcnNhdGlvbiA9PiB0aGlzLl9jcmVhdGVDb252ZXJzYXRpb24oY29udmVyc2F0aW9uKSB8fCB0aGlzLmNsaWVudC5nZXRDb252ZXJzYXRpb24oY29udmVyc2F0aW9uLmlkKSlcbiAgICAgIC5maWx0ZXIoY29udmVyc2F0aW9uID0+IGNvbnZlcnNhdGlvbik7XG5cbiAgICAvLyBSZXR1cm4gdGhlIGRhdGFcbiAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG5ld0RhdGEpO1xuICB9XG5cbiAgLyoqXG4gICAqIExvYWQgYWxsIG1lc3NhZ2VzIGZvciBhIGdpdmVuIENvbnZlcnNhdGlvbiBJRCBmcm9tIHRoZSBkYXRhYmFzZS5cbiAgICpcbiAgICogVXNlIF9sb2FkQWxsIGlmIGxvYWRpbmcgQWxsIE1lc3NhZ2VzIHJhdGhlciB0aGFuIGFsbCBNZXNzYWdlcyBmb3IgYSBDb252ZXJzYXRpb24uXG4gICAqXG4gICAqIEBtZXRob2QgbG9hZE1lc3NhZ2VzXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBjb252ZXJzYXRpb25JZCAtIElEIG9mIHRoZSBDb252ZXJzYXRpb24gd2hvc2UgTWVzc2FnZXMgYXJlIG9mIGludGVyZXN0LlxuICAgKiBAcGFyYW0ge3N0cmluZ30gW2Zyb21JZD1dICAgIC0gRm9yIHBhZ2luYXRpb24sIHByb3ZpZGUgdGhlIG1lc3NhZ2VJZCB0byBnZXQgTWVzc2FnZXMgYWZ0ZXJcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtwYWdlU2l6ZT1dICAtIFRvIGxpbWl0IHRoZSBudW1iZXIgb2YgcmVzdWx0cywgcHJvdmlkZSBhIG51bWJlciBmb3IgaG93IG1hbnkgcmVzdWx0cyB0byByZXR1cm4uXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja10gICAtIENhbGxiYWNrIGZvciBnZXR0aW5nIHJlc3VsdHNcbiAgICogQHBhcmFtIHtsYXllci5NZXNzYWdlW119IGNhbGxiYWNrLnJlc3VsdFxuICAgKi9cbiAgbG9hZE1lc3NhZ2VzKGNvbnZlcnNhdGlvbklkLCBmcm9tSWQsIHBhZ2VTaXplLCBjYWxsYmFjaykge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBmcm9tTWVzc2FnZSA9IGZyb21JZCA/IHRoaXMuY2xpZW50LmdldE1lc3NhZ2UoZnJvbUlkKSA6IG51bGw7XG4gICAgICBjb25zdCBxdWVyeSA9IHdpbmRvdy5JREJLZXlSYW5nZS5ib3VuZChbY29udmVyc2F0aW9uSWQsIDBdLFxuICAgICAgICBbY29udmVyc2F0aW9uSWQsIGZyb21NZXNzYWdlID8gZnJvbU1lc3NhZ2UucG9zaXRpb24gOiBNQVhfU0FGRV9JTlRFR0VSXSk7XG4gICAgICB0aGlzLl9sb2FkQnlJbmRleCgnbWVzc2FnZXMnLCAnY29udmVyc2F0aW9uJywgcXVlcnksIEJvb2xlYW4oZnJvbUlkKSwgcGFnZVNpemUsIChkYXRhKSA9PiB7XG4gICAgICAgIHRoaXMuX2xvYWRNZXNzYWdlc1Jlc3VsdChkYXRhLCBjYWxsYmFjayk7XG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBOb29wIC0tIGhhbmRsZSBicm93c2VycyBsaWtlIElFIHRoYXQgZG9uJ3QgbGlrZSB0aGVzZSBJREJLZXlSYW5nZXNcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTG9hZCBhbGwgQW5ub3VuY2VtZW50cyBmcm9tIHRoZSBkYXRhYmFzZS5cbiAgICpcbiAgICogQG1ldGhvZCBsb2FkQW5ub3VuY2VtZW50c1xuICAgKiBAcGFyYW0ge3N0cmluZ30gW2Zyb21JZD1dICAgIC0gRm9yIHBhZ2luYXRpb24sIHByb3ZpZGUgdGhlIG1lc3NhZ2VJZCB0byBnZXQgQW5ub3VuY2VtZW50cyBhZnRlclxuICAgKiBAcGFyYW0ge251bWJlcn0gW3BhZ2VTaXplPV0gIC0gVG8gbGltaXQgdGhlIG51bWJlciBvZiByZXN1bHRzLCBwcm92aWRlIGEgbnVtYmVyIGZvciBob3cgbWFueSByZXN1bHRzIHRvIHJldHVybi5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXVxuICAgKiBAcGFyYW0ge2xheWVyLkFubm91bmNlbWVudFtdfSBjYWxsYmFjay5yZXN1bHRcbiAgICovXG4gIGxvYWRBbm5vdW5jZW1lbnRzKGZyb21JZCwgcGFnZVNpemUsIGNhbGxiYWNrKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGZyb21NZXNzYWdlID0gZnJvbUlkID8gdGhpcy5jbGllbnQuZ2V0TWVzc2FnZShmcm9tSWQpIDogbnVsbDtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gd2luZG93LklEQktleVJhbmdlLmJvdW5kKFsnYW5ub3VuY2VtZW50JywgMF0sXG4gICAgICAgIFsnYW5ub3VuY2VtZW50JywgZnJvbU1lc3NhZ2UgPyBmcm9tTWVzc2FnZS5wb3NpdGlvbiA6IE1BWF9TQUZFX0lOVEVHRVJdKTtcbiAgICAgIHRoaXMuX2xvYWRCeUluZGV4KCdtZXNzYWdlcycsICdjb252ZXJzYXRpb24nLCBxdWVyeSwgQm9vbGVhbihmcm9tSWQpLCBwYWdlU2l6ZSwgKGRhdGEpID0+IHtcbiAgICAgICAgdGhpcy5fbG9hZE1lc3NhZ2VzUmVzdWx0KGRhdGEsIGNhbGxiYWNrKTtcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIE5vb3AgLS0gaGFuZGxlIGJyb3dzZXJzIGxpa2UgSUUgdGhhdCBkb24ndCBsaWtlIHRoZXNlIElEQktleVJhbmdlc1xuICAgIH1cbiAgfVxuXG4gIF9ibG9iaWZ5UGFydChwYXJ0KSB7XG4gICAgaWYgKHBhcnQudXNlQmxvYikge1xuICAgICAgcGFydC5ib2R5ID0gVXRpbC5iYXNlNjRUb0Jsb2IocGFydC5ib2R5KTtcbiAgICAgIGRlbGV0ZSBwYXJ0LnVzZUJsb2I7XG4gICAgICBwYXJ0LmVuY29kaW5nID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXJzIGFuZCBzb3J0cyB0aGUgbWVzc2FnZSBvYmplY3RzIGZyb20gdGhlIGRhdGFiYXNlLlxuICAgKlxuICAgKiBUT0RPOiBFbmNvZGUgbGltaXRzIG9uIHRoaXMsIGVsc2Ugd2UgYXJlIHNvcnRpbmcgdGVucyBvZiB0aG91c2FuZHNcbiAgICogb2YgbWVzc2FnZXMgaW4gamF2YXNjcmlwdC5cbiAgICpcbiAgICogQG1ldGhvZCBfbG9hZE1lc3NhZ2VzUmVzdWx0XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7T2JqZWN0W119IE1lc3NhZ2Ugb2JqZWN0cyBmcm9tIHRoZSBkYXRhYmFzZS5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtIHtsYXllci5NZXNzYWdlfSBjYWxsYmFjay5yZXN1bHQgLSBNZXNzYWdlIGluc3RhbmNlcyBjcmVhdGVkIGZyb20gdGhlIGRhdGFiYXNlXG4gICAqL1xuICBfbG9hZE1lc3NhZ2VzUmVzdWx0KG1lc3NhZ2VzLCBjYWxsYmFjaykge1xuICAgIC8vIENvbnZlcnQgYmFzZTY0IHRvIGJsb2IgYmVmb3JlIHNlbmRpbmcgaXQgYWxvbmcuLi5cbiAgICBtZXNzYWdlcy5mb3JFYWNoKG1lc3NhZ2UgPT4gbWVzc2FnZS5wYXJ0cy5mb3JFYWNoKHBhcnQgPT4gdGhpcy5fYmxvYmlmeVBhcnQocGFydCkpKTtcblxuICAgIC8vIEluc3RhbnRpYXRlIGFuZCBSZWdpc3RlciBlYWNoIE1lc3NhZ2VcbiAgICBjb25zdCBuZXdEYXRhID0gbWVzc2FnZXNcbiAgICAgIC5tYXAobWVzc2FnZSA9PiB0aGlzLl9jcmVhdGVNZXNzYWdlKG1lc3NhZ2UpIHx8IHRoaXMuY2xpZW50LmdldE1lc3NhZ2UobWVzc2FnZS5pZCkpXG4gICAgICAuZmlsdGVyKG1lc3NhZ2UgPT4gbWVzc2FnZSk7XG5cbiAgICAvLyBSZXR1cm4gdGhlIHJlc3VsdHNcbiAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG5ld0RhdGEpO1xuICB9XG5cblxuICAvKipcbiAgICogTG9hZCBhbGwgSWRlbnRpdGllcyBmcm9tIHRoZSBkYXRhYmFzZS5cbiAgICpcbiAgICogQG1ldGhvZCBsb2FkSWRlbnRpdGllc1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0ge2xheWVyLklkZW50aXR5W119IGNhbGxiYWNrLnJlc3VsdFxuICAgKi9cbiAgbG9hZElkZW50aXRpZXMoY2FsbGJhY2spIHtcbiAgICB0aGlzLl9sb2FkQWxsKCdpZGVudGl0aWVzJywgKGRhdGEpID0+IHtcbiAgICAgIHRoaXMuX2xvYWRJZGVudGl0aWVzUmVzdWx0KGRhdGEsIGNhbGxiYWNrKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3NlbWJsZSBhbGwgTGFzdE1lc3NhZ2VzIGFuZCBJZGVudGl0eXkgUE9KT3MgaW50byBsYXllci5NZXNzYWdlIGFuZCBsYXllci5JZGVudGl0eXkgaW5zdGFuY2VzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9sb2FkSWRlbnRpdGllc1Jlc3VsdFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge09iamVjdFtdfSBpZGVudGl0aWVzXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7bGF5ZXIuSWRlbnRpdHlbXX0gY2FsbGJhY2sucmVzdWx0XG4gICAqL1xuICBfbG9hZElkZW50aXRpZXNSZXN1bHQoaWRlbnRpdGllcywgY2FsbGJhY2spIHtcbiAgICAvLyBJbnN0YW50aWF0ZSBhbmQgUmVnaXN0ZXIgZWFjaCBJZGVudGl0eS5cbiAgICBjb25zdCBuZXdEYXRhID0gaWRlbnRpdGllc1xuICAgICAgLm1hcChpZGVudGl0eSA9PiB0aGlzLl9jcmVhdGVJZGVudGl0eShpZGVudGl0eSkgfHwgdGhpcy5jbGllbnQuZ2V0SWRlbnRpdHkoaWRlbnRpdHkuaWQpKVxuICAgICAgLmZpbHRlcihpZGVudGl0eSA9PiBpZGVudGl0eSk7XG5cbiAgICAvLyBSZXR1cm4gdGhlIGRhdGFcbiAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG5ld0RhdGEpO1xuICB9XG5cbiAgLyoqXG4gICAqIEluc3RhbnRpYXRlIGFuZCBSZWdpc3RlciB0aGUgQ29udmVyc2F0aW9uIGZyb20gYSBjb252ZXJzYXRpb24gREIgRW50cnkuXG4gICAqXG4gICAqIElmIHRoZSBsYXllci5Db252ZXJzYXRpb24gYWxyZWFkeSBleGlzdHMsIHRoZW4gaXRzIHByZXN1bWVkIHRoYXQgd2hhdGV2ZXIgaXMgaW5cbiAgICogamF2YXNjcmlwdCBjYWNoZSBpcyBtb3JlIHVwIHRvIGRhdGUgdGhhbiB3aGF0cyBpbiBJbmRleGVkREIgY2FjaGUuXG4gICAqXG4gICAqIEF0dGVtcHRzIHRvIGFzc2lnbiB0aGUgbGFzdE1lc3NhZ2UgcHJvcGVydHkgdG8gcmVmZXIgdG8gYXBwcm9wcmlhdGUgTWVzc2FnZS4gIElmIGl0IGZhaWxzLFxuICAgKiBpdCB3aWxsIGJlIHNldCB0byBudWxsLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVDb252ZXJzYXRpb25cbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtPYmplY3R9IGNvbnZlcnNhdGlvblxuICAgKiBAcmV0dXJucyB7bGF5ZXIuQ29udmVyc2F0aW9ufVxuICAgKi9cbiAgX2NyZWF0ZUNvbnZlcnNhdGlvbihjb252ZXJzYXRpb24pIHtcbiAgICBpZiAoIXRoaXMuY2xpZW50LmdldENvbnZlcnNhdGlvbihjb252ZXJzYXRpb24uaWQpKSB7XG4gICAgICBjb252ZXJzYXRpb24uX2Zyb21EQiA9IHRydWU7XG4gICAgICBjb25zdCBuZXdDb252ZXJzYXRpb24gPSB0aGlzLmNsaWVudC5fY3JlYXRlT2JqZWN0KGNvbnZlcnNhdGlvbik7XG4gICAgICBuZXdDb252ZXJzYXRpb24uc3luY1N0YXRlID0gY29udmVyc2F0aW9uLnN5bmNfc3RhdGU7XG4gICAgICByZXR1cm4gbmV3Q29udmVyc2F0aW9uO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbnN0YW50aWF0ZSBhbmQgUmVnaXN0ZXIgdGhlIE1lc3NhZ2UgZnJvbSBhIG1lc3NhZ2UgREIgRW50cnkuXG4gICAqXG4gICAqIElmIHRoZSBsYXllci5NZXNzYWdlIGFscmVhZHkgZXhpc3RzLCB0aGVuIGl0cyBwcmVzdW1lZCB0aGF0IHdoYXRldmVyIGlzIGluXG4gICAqIGphdmFzY3JpcHQgY2FjaGUgaXMgbW9yZSB1cCB0byBkYXRlIHRoYW4gd2hhdHMgaW4gSW5kZXhlZERCIGNhY2hlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9jcmVhdGVNZXNzYWdlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBtZXNzYWdlXG4gICAqIEByZXR1cm5zIHtsYXllci5NZXNzYWdlfVxuICAgKi9cbiAgX2NyZWF0ZU1lc3NhZ2UobWVzc2FnZSkge1xuICAgIGlmICghdGhpcy5jbGllbnQuZ2V0TWVzc2FnZShtZXNzYWdlLmlkKSkge1xuICAgICAgbWVzc2FnZS5fZnJvbURCID0gdHJ1ZTtcbiAgICAgIG1lc3NhZ2UuY29udmVyc2F0aW9uID0geyBpZDogbWVzc2FnZS5jb252ZXJzYXRpb24gfTtcbiAgICAgIGNvbnN0IG5ld01lc3NhZ2UgPSB0aGlzLmNsaWVudC5fY3JlYXRlT2JqZWN0KG1lc3NhZ2UpO1xuICAgICAgbmV3TWVzc2FnZS5zeW5jU3RhdGUgPSBtZXNzYWdlLnN5bmNfc3RhdGU7XG4gICAgICByZXR1cm4gbmV3TWVzc2FnZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW5zdGFudGlhdGUgYW5kIFJlZ2lzdGVyIHRoZSBJZGVudGl0eSBmcm9tIGFuIGlkZW50aXRpZXMgREIgRW50cnkuXG4gICAqXG4gICAqIElmIHRoZSBsYXllci5JZGVudGl0eSBhbHJlYWR5IGV4aXN0cywgdGhlbiBpdHMgcHJlc3VtZWQgdGhhdCB3aGF0ZXZlciBpcyBpblxuICAgKiBqYXZhc2NyaXB0IGNhY2hlIGlzIG1vcmUgdXAgdG8gZGF0ZSB0aGFuIHdoYXRzIGluIEluZGV4ZWREQiBjYWNoZS5cbiAgICpcbiAgICogQG1ldGhvZCBfY3JlYXRlSWRlbnRpdHlcbiAgICogQHBhcmFtIHtPYmplY3R9IGlkZW50aXR5XG4gICAqIEByZXR1cm5zIHtsYXllci5JZGVudGl0eX1cbiAgICovXG4gIF9jcmVhdGVJZGVudGl0eShpZGVudGl0eSkge1xuICAgIGlmICghdGhpcy5jbGllbnQuZ2V0SWRlbnRpdHkoaWRlbnRpdHkuaWQpKSB7XG4gICAgICBpZGVudGl0eS5fZnJvbURCID0gdHJ1ZTtcbiAgICAgIGNvbnN0IG5ld2lkZW50aXR5ID0gdGhpcy5jbGllbnQuX2NyZWF0ZU9iamVjdChpZGVudGl0eSk7XG4gICAgICBuZXdpZGVudGl0eS5zeW5jU3RhdGUgPSBpZGVudGl0eS5zeW5jX3N0YXRlO1xuICAgICAgcmV0dXJuIG5ld2lkZW50aXR5O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBMb2FkIGFsbCBTeW5jIEV2ZW50cyBmcm9tIHRoZSBkYXRhYmFzZS5cbiAgICpcbiAgICogQG1ldGhvZCBsb2FkU3luY1F1ZXVlXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7bGF5ZXIuU3luY0V2ZW50W119IGNhbGxiYWNrLnJlc3VsdFxuICAgKi9cbiAgbG9hZFN5bmNRdWV1ZShjYWxsYmFjaykge1xuICAgIHRoaXMuX2xvYWRBbGwoJ3N5bmNRdWV1ZScsIHN5bmNFdmVudHMgPT4gdGhpcy5fbG9hZFN5bmNFdmVudFJlbGF0ZWREYXRhKHN5bmNFdmVudHMsIGNhbGxiYWNrKSk7XG4gIH1cblxuICAvKipcbiAgICogVmFsaWRhdGUgdGhhdCB3ZSBoYXZlIGFwcHJvcHJpYXRlIGRhdGEgZm9yIGVhY2ggU3luY0V2ZW50IGFuZCBpbnN0YW50aWF0ZSBpdC5cbiAgICpcbiAgICogQW55IG9wZXJhdGlvbiB0aGF0IGlzIG5vdCBhIERFTEVURSBtdXN0IGhhdmUgYSB2YWxpZCB0YXJnZXQgZm91bmQgaW4gdGhlIGRhdGFiYXNlIG9yIGphdmFzY3JpcHQgY2FjaGUsXG4gICAqIG90aGVyd2lzZSBpdCBjYW4gbm90IGJlIGV4ZWN1dGVkLlxuICAgKlxuICAgKiBUT0RPOiBOZWVkIHRvIGNsZWFudXAgc3luYyBlbnRyaWVzIHRoYXQgaGF2ZSBpbnZhbGlkIHRhcmdldHNcbiAgICpcbiAgICogQG1ldGhvZCBfbG9hZFN5bmNFdmVudFJlbGF0ZWREYXRhXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7T2JqZWN0W119IHN5bmNFdmVudHNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnRbXX0gY2FsbGJhY2sucmVzdWx0XG4gICAqL1xuICBfbG9hZFN5bmNFdmVudFJlbGF0ZWREYXRhKHN5bmNFdmVudHMsIGNhbGxiYWNrKSB7XG4gICAgLy8gR2F0aGVyIGFsbCBNZXNzYWdlIElEcyB0aGF0IGFyZSB0YXJnZXRzIG9mIG9wZXJhdGlvbnMuXG4gICAgY29uc3QgbWVzc2FnZUlkcyA9IHN5bmNFdmVudHNcbiAgICAgIC5maWx0ZXIoaXRlbSA9PiBpdGVtLm9wZXJhdGlvbiAhPT0gJ0RFTEVURScgJiYgaXRlbS50YXJnZXQgJiYgaXRlbS50YXJnZXQubWF0Y2goL21lc3NhZ2VzLykpXG4gICAgICAubWFwKGl0ZW0gPT4gaXRlbS50YXJnZXQpO1xuXG4gICAgLy8gR2F0aGVyIGFsbCBDb252ZXJzYXRpb24gSURzIHRoYXQgYXJlIHRhcmdldHMgb2Ygb3BlcmF0aW9ucy5cbiAgICBjb25zdCBjb252ZXJzYXRpb25JZHMgPSBzeW5jRXZlbnRzXG4gICAgICAuZmlsdGVyKGl0ZW0gPT4gaXRlbS5vcGVyYXRpb24gIT09ICdERUxFVEUnICYmIGl0ZW0udGFyZ2V0ICYmIGl0ZW0udGFyZ2V0Lm1hdGNoKC9jb252ZXJzYXRpb25zLykpXG4gICAgICAubWFwKGl0ZW0gPT4gaXRlbS50YXJnZXQpO1xuXG4gICAgY29uc3QgaWRlbnRpdHlJZHMgPSBzeW5jRXZlbnRzXG4gICAgICAuZmlsdGVyKGl0ZW0gPT4gaXRlbS5vcGVyYXRpb24gIT09ICdERUxFVEUnICYmIGl0ZW0udGFyZ2V0ICYmIGl0ZW0udGFyZ2V0Lm1hdGNoKC9pZGVudGl0aWVzLykpXG4gICAgICAubWFwKGl0ZW0gPT4gaXRlbS50YXJnZXQpO1xuXG4gICAgLy8gTG9hZCBhbnkgTWVzc2FnZXMvQ29udmVyc2F0aW9ucyB0aGF0IGFyZSB0YXJnZXRzIG9mIG9wZXJhdGlvbnMuXG4gICAgLy8gQ2FsbCBfY3JlYXRlTWVzc2FnZSBvciBfY3JlYXRlQ29udmVyc2F0aW9uIG9uIGFsbCB0YXJnZXRzIGZvdW5kLlxuICAgIGxldCBjb3VudGVyID0gMDtcbiAgICBjb25zdCBtYXhDb3VudGVyID0gMztcbiAgICB0aGlzLmdldE9iamVjdHMoJ21lc3NhZ2VzJywgbWVzc2FnZUlkcywgKG1lc3NhZ2VzKSA9PiB7XG4gICAgICBtZXNzYWdlcy5mb3JFYWNoKG1lc3NhZ2UgPT4gdGhpcy5fY3JlYXRlTWVzc2FnZShtZXNzYWdlKSk7XG4gICAgICBjb3VudGVyKys7XG4gICAgICBpZiAoY291bnRlciA9PT0gbWF4Q291bnRlcikgdGhpcy5fbG9hZFN5bmNFdmVudFJlc3VsdHMoc3luY0V2ZW50cywgY2FsbGJhY2spO1xuICAgIH0pO1xuICAgIHRoaXMuZ2V0T2JqZWN0cygnY29udmVyc2F0aW9ucycsIGNvbnZlcnNhdGlvbklkcywgKGNvbnZlcnNhdGlvbnMpID0+IHtcbiAgICAgIGNvbnZlcnNhdGlvbnMuZm9yRWFjaChjb252ZXJzYXRpb24gPT4gdGhpcy5fY3JlYXRlQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbikpO1xuICAgICAgY291bnRlcisrO1xuICAgICAgaWYgKGNvdW50ZXIgPT09IG1heENvdW50ZXIpIHRoaXMuX2xvYWRTeW5jRXZlbnRSZXN1bHRzKHN5bmNFdmVudHMsIGNhbGxiYWNrKTtcbiAgICB9KTtcbiAgICB0aGlzLmdldE9iamVjdHMoJ2lkZW50aXRpZXMnLCBpZGVudGl0eUlkcywgKGlkZW50aXRpZXMpID0+IHtcbiAgICAgIGlkZW50aXRpZXMuZm9yRWFjaChpZGVudGl0eSA9PiB0aGlzLl9jcmVhdGVJZGVudGl0eShpZGVudGl0eSkpO1xuICAgICAgY291bnRlcisrO1xuICAgICAgaWYgKGNvdW50ZXIgPT09IG1heENvdW50ZXIpIHRoaXMuX2xvYWRTeW5jRXZlbnRSZXN1bHRzKHN5bmNFdmVudHMsIGNhbGxiYWNrKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUdXJuIGFuIGFycmF5IG9mIFN5bmMgRXZlbnQgREIgRW50cmllcyBpbnRvIGFuIGFycmF5IG9mIGxheWVyLlN5bmNFdmVudC5cbiAgICpcbiAgICogQG1ldGhvZCBfbG9hZFN5bmNFdmVudFJlc3VsdHNcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtPYmplY3RbXX0gc3luY0V2ZW50c1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0ge2xheWVyLlN5bmNFdmVudFtdfSBjYWxsYmFjay5yZXN1bHRcbiAgICovXG4gIF9sb2FkU3luY0V2ZW50UmVzdWx0cyhzeW5jRXZlbnRzLCBjYWxsYmFjaykge1xuICAgIC8vIElmIHRoZSB0YXJnZXQgaXMgcHJlc2VudCBpbiB0aGUgc3luYyBldmVudCwgYnV0IGRvZXMgbm90IGV4aXN0IGluIHRoZSBzeXN0ZW0sXG4gICAgLy8gZG8gTk9UIGF0dGVtcHQgdG8gaW5zdGFudGlhdGUgdGhpcyBldmVudC4uLiB1bmxlc3MgaXRzIGEgREVMRVRFIG9wZXJhdGlvbi5cbiAgICBjb25zdCBuZXdEYXRhID0gc3luY0V2ZW50c1xuICAgIC5maWx0ZXIoKHN5bmNFdmVudCkgPT4ge1xuICAgICAgY29uc3QgaGFzVGFyZ2V0ID0gQm9vbGVhbihzeW5jRXZlbnQudGFyZ2V0ICYmIHRoaXMuY2xpZW50Ll9nZXRPYmplY3Qoc3luY0V2ZW50LnRhcmdldCkpO1xuICAgICAgcmV0dXJuIHN5bmNFdmVudC5vcGVyYXRpb24gPT09ICdERUxFVEUnIHx8IGhhc1RhcmdldDtcbiAgICB9KVxuICAgIC5tYXAoKHN5bmNFdmVudCkgPT4ge1xuICAgICAgaWYgKHN5bmNFdmVudC5pc1dlYnNvY2tldCkge1xuICAgICAgICByZXR1cm4gbmV3IFN5bmNFdmVudC5XZWJzb2NrZXRTeW5jRXZlbnQoe1xuICAgICAgICAgIHRhcmdldDogc3luY0V2ZW50LnRhcmdldCxcbiAgICAgICAgICBkZXBlbmRzOiBzeW5jRXZlbnQuZGVwZW5kcyxcbiAgICAgICAgICBvcGVyYXRpb246IHN5bmNFdmVudC5vcGVyYXRpb24sXG4gICAgICAgICAgaWQ6IHN5bmNFdmVudC5pZCxcbiAgICAgICAgICBkYXRhOiBzeW5jRXZlbnQuZGF0YSxcbiAgICAgICAgICBmcm9tREI6IHRydWUsXG4gICAgICAgICAgY3JlYXRlZEF0OiBzeW5jRXZlbnQuY3JlYXRlZF9hdCxcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbmV3IFN5bmNFdmVudC5YSFJTeW5jRXZlbnQoe1xuICAgICAgICAgIHRhcmdldDogc3luY0V2ZW50LnRhcmdldCxcbiAgICAgICAgICBkZXBlbmRzOiBzeW5jRXZlbnQuZGVwZW5kcyxcbiAgICAgICAgICBvcGVyYXRpb246IHN5bmNFdmVudC5vcGVyYXRpb24sXG4gICAgICAgICAgaWQ6IHN5bmNFdmVudC5pZCxcbiAgICAgICAgICBkYXRhOiBzeW5jRXZlbnQuZGF0YSxcbiAgICAgICAgICBtZXRob2Q6IHN5bmNFdmVudC5tZXRob2QsXG4gICAgICAgICAgaGVhZGVyczogc3luY0V2ZW50LmhlYWRlcnMsXG4gICAgICAgICAgdXJsOiBzeW5jRXZlbnQudXJsLFxuICAgICAgICAgIGZyb21EQjogdHJ1ZSxcbiAgICAgICAgICBjcmVhdGVkQXQ6IHN5bmNFdmVudC5jcmVhdGVkX2F0LFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFNvcnQgdGhlIHJlc3VsdHMgYW5kIHRoZW4gcmV0dXJuIHRoZW0uXG4gICAgLy8gVE9ETzogUXVlcnkgcmVzdWx0cyBzaG91bGQgY29tZSBiYWNrIHNvcnRlZCBieSBkYXRhYmFzZSB3aXRoIHByb3BlciBJbmRleFxuICAgIFV0aWwuc29ydEJ5KG5ld0RhdGEsIGl0ZW0gPT4gaXRlbS5jcmVhdGVkQXQpO1xuICAgIGNhbGxiYWNrKG5ld0RhdGEpO1xuICB9XG5cbiAgLyoqXG4gICAqIExvYWQgYWxsIGRhdGEgZnJvbSB0aGUgc3BlY2lmaWVkIHRhYmxlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9sb2FkQWxsXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRhYmxlTmFtZVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0ge09iamVjdFtdfSBjYWxsYmFjay5yZXN1bHRcbiAgICovXG4gIF9sb2FkQWxsKHRhYmxlTmFtZSwgY2FsbGJhY2spIHtcbiAgICBpZiAoIXRoaXNbJ19wZXJtaXNzaW9uXycgKyB0YWJsZU5hbWVdIHx8IHRoaXMuX2lzT3BlbkVycm9yKSByZXR1cm4gY2FsbGJhY2soW10pO1xuICAgIHRoaXMub25PcGVuKCgpID0+IHtcbiAgICAgIGNvbnN0IGRhdGEgPSBbXTtcbiAgICAgIHRoaXMuZGIudHJhbnNhY3Rpb24oW3RhYmxlTmFtZV0sICdyZWFkb25seScpLm9iamVjdFN0b3JlKHRhYmxlTmFtZSkub3BlbkN1cnNvcigpLm9uc3VjY2VzcyA9IChldnQpID0+IHtcbiAgICAgICAgY29uc3QgY3Vyc29yID0gZXZ0LnRhcmdldC5yZXN1bHQ7XG4gICAgICAgIGlmIChjdXJzb3IpIHtcbiAgICAgICAgICBkYXRhLnB1c2goY3Vyc29yLnZhbHVlKTtcbiAgICAgICAgICBjdXJzb3IuY29udGludWUoKTtcbiAgICAgICAgfSBlbHNlIGlmICghdGhpcy5pc0Rlc3Ryb3llZCkge1xuICAgICAgICAgIGNhbGxiYWNrKGRhdGEpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIExvYWQgYWxsIGRhdGEgZnJvbSB0aGUgc3BlY2lmaWVkIHRhYmxlIGFuZCB3aXRoIHRoZSBzcGVjaWZpZWQgaW5kZXggdmFsdWUuXG4gICAqXG4gICAqIFJlc3VsdHMgYXJlIGFsd2F5cyBzb3J0ZWQgaW4gREVTQyBvcmRlciBhdCB0aGlzIHRpbWUuXG4gICAqXG4gICAqIEBtZXRob2QgX2xvYWRCeUluZGV4XG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRhYmxlTmFtZSAtICdtZXNzYWdlcycsICdjb252ZXJzYXRpb25zJywgJ2lkZW50aXRpZXMnXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBpbmRleE5hbWUgLSBOYW1lIG9mIHRoZSBpbmRleCB0byBxdWVyeSBvblxuICAgKiBAcGFyYW0ge0lEQktleVJhbmdlfSByYW5nZSAtIFJhbmdlIHRvIFF1ZXJ5IGZvciAobnVsbCBvaylcbiAgICogQHBhcmFtIHtCb29sZWFufSBpc0Zyb21JZCAtIElmIHF1ZXJ5aW5nIGZvciByZXN1bHRzIGFmdGVyIGEgc3BlY2lmaWVkIElELCB0aGVuIHdlIHdhbnQgdG8gc2tpcCB0aGUgZmlyc3QgcmVzdWx0ICh3aGljaCB3aWxsIGJlIHRoYXQgSUQpIChcIlwiIGlzIE9LKVxuICAgKiBAcGFyYW0ge251bWJlcn0gcGFnZVNpemUgLSBJZiBhIHZhbHVlIGlzIHByb3ZpZGVkLCByZXR1cm4gYXQgbW9zdCB0aGF0IG51bWJlciBvZiByZXN1bHRzOyBlbHNlIHJldHVybiBhbGwgcmVzdWx0cy5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtIHtPYmplY3RbXX0gY2FsbGJhY2sucmVzdWx0XG4gICAqL1xuICBfbG9hZEJ5SW5kZXgodGFibGVOYW1lLCBpbmRleE5hbWUsIHJhbmdlLCBpc0Zyb21JZCwgcGFnZVNpemUsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCF0aGlzWydfcGVybWlzc2lvbl8nICsgdGFibGVOYW1lXSB8fCB0aGlzLl9pc09wZW5FcnJvcikgcmV0dXJuIGNhbGxiYWNrKFtdKTtcbiAgICBsZXQgc2hvdWxkU2tpcE5leHQgPSBpc0Zyb21JZDtcbiAgICB0aGlzLm9uT3BlbigoKSA9PiB7XG4gICAgICBjb25zdCBkYXRhID0gW107XG4gICAgICB0aGlzLmRiLnRyYW5zYWN0aW9uKFt0YWJsZU5hbWVdLCAncmVhZG9ubHknKVxuICAgICAgICAgIC5vYmplY3RTdG9yZSh0YWJsZU5hbWUpXG4gICAgICAgICAgLmluZGV4KGluZGV4TmFtZSlcbiAgICAgICAgICAub3BlbkN1cnNvcihyYW5nZSwgJ3ByZXYnKVxuICAgICAgICAgIC5vbnN1Y2Nlc3MgPSAoZXZ0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBjdXJzb3IgPSBldnQudGFyZ2V0LnJlc3VsdDtcbiAgICAgICAgICAgIGlmIChjdXJzb3IpIHtcbiAgICAgICAgICAgICAgaWYgKHNob3VsZFNraXBOZXh0KSB7XG4gICAgICAgICAgICAgICAgc2hvdWxkU2tpcE5leHQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkYXRhLnB1c2goY3Vyc29yLnZhbHVlKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAocGFnZVNpemUgJiYgZGF0YS5sZW5ndGggPj0gcGFnZVNpemUpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhkYXRhKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjdXJzb3IuY29udGludWUoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICghdGhpcy5pc0Rlc3Ryb3llZCkge1xuICAgICAgICAgICAgICBjYWxsYmFjayhkYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZXMgdGhlIHNwZWNpZmllZCBvYmplY3RzIGZyb20gdGhlIHNwZWNpZmllZCB0YWJsZS5cbiAgICpcbiAgICogQ3VycmVudGx5IHRha2VzIGFuIGFycmF5IG9mIGRhdGEgdG8gZGVsZXRlIHJhdGhlciB0aGFuIGFuIGFycmF5IG9mIElEcztcbiAgICogSWYgeW91IG9ubHkgaGF2ZSBhbiBJRCwgW3tpZDogbXlJZH1dIHNob3VsZCB3b3JrLlxuICAgKlxuICAgKiBAbWV0aG9kIGRlbGV0ZU9iamVjdHNcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRhYmxlTmFtZVxuICAgKiBAcGFyYW0ge09iamVjdFtdfSBkYXRhXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja11cbiAgICovXG4gIGRlbGV0ZU9iamVjdHModGFibGVOYW1lLCBkYXRhLCBjYWxsYmFjaykge1xuICAgIGlmICghdGhpc1snX3Blcm1pc3Npb25fJyArIHRhYmxlTmFtZV0gfHwgdGhpcy5faXNPcGVuRXJyb3IpIHJldHVybiBjYWxsYmFjayA/IGNhbGxiYWNrKCkgOiBudWxsO1xuICAgIHRoaXMub25PcGVuKCgpID0+IHtcbiAgICAgIGNvbnN0IHRyYW5zYWN0aW9uID0gdGhpcy5kYi50cmFuc2FjdGlvbihbdGFibGVOYW1lXSwgJ3JlYWR3cml0ZScpO1xuICAgICAgY29uc3Qgc3RvcmUgPSB0cmFuc2FjdGlvbi5vYmplY3RTdG9yZSh0YWJsZU5hbWUpO1xuICAgICAgdHJhbnNhY3Rpb24ub25jb21wbGV0ZSA9IGNhbGxiYWNrO1xuICAgICAgZGF0YS5mb3JFYWNoKGl0ZW0gPT4gc3RvcmUuZGVsZXRlKGl0ZW0uaWQpKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSB0aGUgaWRlbnRpZmllZCBvYmplY3RzIGZyb20gdGhlIHNwZWNpZmllZCBkYXRhYmFzZSB0YWJsZS5cbiAgICpcbiAgICogVHVybmluZyB0aGVzZSBpbnRvIGluc3RhbmNlcyBpcyB0aGUgcmVzcG9uc2liaWxpdHkgb2YgdGhlIGNhbGxlci5cbiAgICpcbiAgICogSW5zcGlyZWQgYnkgaHR0cDovL3d3dy5jb2RlcHJvamVjdC5jb20vQXJ0aWNsZXMvNzQ0OTg2L0hvdy10by1kby1zb21lLW1hZ2ljLXdpdGgtaW5kZXhlZERCXG4gICAqXG4gICAqIEBtZXRob2QgZ2V0T2JqZWN0c1xuICAgKiBAcGFyYW0ge1N0cmluZ30gdGFibGVOYW1lXG4gICAqIEBwYXJhbSB7U3RyaW5nW119IGlkc1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0ge09iamVjdFtdfSBjYWxsYmFjay5yZXN1bHRcbiAgICovXG4gIGdldE9iamVjdHModGFibGVOYW1lLCBpZHMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCF0aGlzWydfcGVybWlzc2lvbl8nICsgdGFibGVOYW1lXSB8fCB0aGlzLl9pc09wZW5FcnJvcikgcmV0dXJuIGNhbGxiYWNrKFtdKTtcbiAgICBjb25zdCBkYXRhID0gW107XG5cbiAgICAvLyBHYXRoZXIsIHNvcnQsIGFuZCBmaWx0ZXIgcmVwbGljYSBJRHNcbiAgICBjb25zdCBzb3J0ZWRJZHMgPSBpZHMuc29ydCgpO1xuICAgIGZvciAobGV0IGkgPSBzb3J0ZWRJZHMubGVuZ3RoIC0gMTsgaSA+IDA7IGktLSkge1xuICAgICAgaWYgKHNvcnRlZElkc1tpXSA9PT0gc29ydGVkSWRzW2kgLSAxXSkgc29ydGVkSWRzLnNwbGljZShpLCAxKTtcbiAgICB9XG4gICAgbGV0IGluZGV4ID0gMDtcblxuICAgIC8vIEl0ZXJhdGUgb3ZlciB0aGUgdGFibGUgc2VhcmNoaW5nIGZvciB0aGUgc3BlY2lmaWVkIElEc1xuICAgIHRoaXMub25PcGVuKCgpID0+IHtcbiAgICAgIHRoaXMuZGIudHJhbnNhY3Rpb24oW3RhYmxlTmFtZV0sICdyZWFkb25seScpXG4gICAgICAgIC5vYmplY3RTdG9yZSh0YWJsZU5hbWUpXG4gICAgICAgIC5vcGVuQ3Vyc29yKCkub25zdWNjZXNzID0gKGV2dCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGN1cnNvciA9IGV2dC50YXJnZXQucmVzdWx0O1xuICAgICAgICAgIGlmICghY3Vyc29yKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhkYXRhKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3Qga2V5ID0gY3Vyc29yLmtleTtcblxuICAgICAgICAgIC8vIFRoZSBjdXJzb3IgaGFzIHBhc3NlZCBiZXlvbmQgdGhpcyBrZXkuIENoZWNrIG5leHQuXG4gICAgICAgICAgd2hpbGUgKGtleSA+IHNvcnRlZElkc1tpbmRleF0pIGluZGV4Kys7XG5cbiAgICAgICAgICAvLyBUaGUgY3Vyc29yIGlzIHBvaW50aW5nIGF0IG9uZSBvZiBvdXIgSURzLCBnZXQgaXQgYW5kIGNoZWNrIG5leHQuXG4gICAgICAgICAgaWYgKGtleSA9PT0gc29ydGVkSWRzW2luZGV4XSkge1xuICAgICAgICAgICAgZGF0YS5wdXNoKGN1cnNvci52YWx1ZSk7XG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIERvbmUgb3IgY2hlY2sgbmV4dFxuICAgICAgICAgIGlmIChpbmRleCA9PT0gc29ydGVkSWRzLmxlbmd0aCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmlzRGVzdHJveWVkKSBjYWxsYmFjayhkYXRhKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY3Vyc29yLmNvbnRpbnVlKHNvcnRlZElkc1tpbmRleF0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBIHNpbXBsaWZpZWQgZ2V0T2JqZWN0cygpIG1ldGhvZCB0aGF0IGdldHMgYSBzaW5nbGUgb2JqZWN0LCBhbmQgYWxzbyBnZXRzIGl0cyByZWxhdGVkIG9iamVjdHMuXG4gICAqXG4gICAqIEBtZXRob2QgZ2V0T2JqZWN0XG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0YWJsZU5hbWVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGlkXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBjYWxsYmFjay5kYXRhXG4gICAqL1xuICBnZXRPYmplY3QodGFibGVOYW1lLCBpZCwgY2FsbGJhY2spIHtcbiAgICBpZiAoIXRoaXNbJ19wZXJtaXNzaW9uXycgKyB0YWJsZU5hbWVdIHx8IHRoaXMuX2lzT3BlbkVycm9yKSByZXR1cm4gY2FsbGJhY2soKTtcblxuICAgIHRoaXMub25PcGVuKCgpID0+IHtcbiAgICAgIHRoaXMuZGIudHJhbnNhY3Rpb24oW3RhYmxlTmFtZV0sICdyZWFkb25seScpXG4gICAgICAgIC5vYmplY3RTdG9yZSh0YWJsZU5hbWUpXG4gICAgICAgIC5vcGVuQ3Vyc29yKHdpbmRvdy5JREJLZXlSYW5nZS5vbmx5KGlkKSkub25zdWNjZXNzID0gKGV2dCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGN1cnNvciA9IGV2dC50YXJnZXQucmVzdWx0O1xuICAgICAgICAgIGlmICghY3Vyc29yKSByZXR1cm4gY2FsbGJhY2sobnVsbCk7XG5cbiAgICAgICAgICBzd2l0Y2ggKHRhYmxlTmFtZSkge1xuICAgICAgICAgICAgY2FzZSAnbWVzc2FnZXMnOlxuICAgICAgICAgICAgICBjdXJzb3IudmFsdWUuY29udmVyc2F0aW9uID0ge1xuICAgICAgICAgICAgICAgIGlkOiBjdXJzb3IudmFsdWUuY29udmVyc2F0aW9uLFxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAvLyBDb252ZXJ0IGJhc2U2NCB0byBibG9iIGJlZm9yZSBzZW5kaW5nIGl0IGFsb25nLi4uXG4gICAgICAgICAgICAgIGN1cnNvci52YWx1ZS5wYXJ0cy5mb3JFYWNoKHBhcnQgPT4gdGhpcy5fYmxvYmlmeVBhcnQocGFydCkpO1xuICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soY3Vyc29yLnZhbHVlKTtcbiAgICAgICAgICAgIGNhc2UgJ2lkZW50aXRpZXMnOlxuICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soY3Vyc29yLnZhbHVlKTtcbiAgICAgICAgICAgIGNhc2UgJ2NvbnZlcnNhdGlvbnMnOlxuICAgICAgICAgICAgICBpZiAoY3Vyc29yLnZhbHVlLmxhc3RfbWVzc2FnZSAmJiAhdGhpcy5jbGllbnQuZ2V0TWVzc2FnZShjdXJzb3IudmFsdWUubGFzdF9tZXNzYWdlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmdldE9iamVjdCgnbWVzc2FnZXMnLCBjdXJzb3IudmFsdWUubGFzdF9tZXNzYWdlLCAobWVzc2FnZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgY3Vyc29yLnZhbHVlLmxhc3RfbWVzc2FnZSA9IG1lc3NhZ2U7XG4gICAgICAgICAgICAgICAgICBjYWxsYmFjayhjdXJzb3IudmFsdWUpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhjdXJzb3IudmFsdWUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENsYWltIGEgU3luYyBFdmVudC5cbiAgICpcbiAgICogQSBzeW5jIGV2ZW50IGlzIGNsYWltZWQgYnkgbG9ja2luZyB0aGUgdGFibGUsICB2YWxpZGF0aW5nIHRoYXQgaXQgaXMgc3RpbGwgaW4gdGhlIHRhYmxlLi4uIGFuZCB0aGVuIGRlbGV0aW5nIGl0IGZyb20gdGhlIHRhYmxlLlxuICAgKlxuICAgKiBAbWV0aG9kIGNsYWltU3luY0V2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuU3luY0V2ZW50fSBzeW5jRXZlbnRcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtIHtCb29sZWFufSBjYWxsYmFjay5yZXN1bHRcbiAgICovXG4gIGNsYWltU3luY0V2ZW50KHN5bmNFdmVudCwgY2FsbGJhY2spIHtcbiAgICBpZiAoIXRoaXMuX3Blcm1pc3Npb25fc3luY1F1ZXVlIHx8IHRoaXMuX2lzT3BlbkVycm9yKSByZXR1cm4gY2FsbGJhY2sodHJ1ZSk7XG4gICAgdGhpcy5vbk9wZW4oKCkgPT4ge1xuICAgICAgY29uc3QgdHJhbnNhY3Rpb24gPSB0aGlzLmRiLnRyYW5zYWN0aW9uKFsnc3luY1F1ZXVlJ10sICdyZWFkd3JpdGUnKTtcbiAgICAgIGNvbnN0IHN0b3JlID0gdHJhbnNhY3Rpb24ub2JqZWN0U3RvcmUoJ3N5bmNRdWV1ZScpO1xuICAgICAgc3RvcmUuZ2V0KHN5bmNFdmVudC5pZCkub25zdWNjZXNzID0gZXZ0ID0+IGNhbGxiYWNrKEJvb2xlYW4oZXZ0LnRhcmdldC5yZXN1bHQpKTtcbiAgICAgIHN0b3JlLmRlbGV0ZShzeW5jRXZlbnQuaWQpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZSBhbGwgZGF0YSBmcm9tIGFsbCB0YWJsZXMuXG4gICAqXG4gICAqIFRoaXMgc2hvdWxkIGJlIGNhbGxlZCBmcm9tIGxheWVyLkNsaWVudC5sb2dvdXQoKVxuICAgKlxuICAgKiBAbWV0aG9kIGRlbGV0ZVRhYmxlc1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGxiYWNrXVxuICAgKi9cbiAgZGVsZXRlVGFibGVzKGNhbGxiYWNrID0gZnVuY3Rpb24oKSB7fSkge1xuICAgIHRyeSB7XG4gICAgICB2YXIgcmVxdWVzdCA9IHdpbmRvdy5pbmRleGVkREIuZGVsZXRlRGF0YWJhc2UodGhpcy5fZ2V0RGJOYW1lKCkpO1xuICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSByZXF1ZXN0Lm9uZXJyb3IgPSBjYWxsYmFjaztcbiAgICAgIGRlbGV0ZSB0aGlzLmRiO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGxvZ2dlci5lcnJvcignRmFpbGVkIHRvIGRlbGV0ZSBkYXRhYmFzZScsIGUpO1xuICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBAdHlwZSB7bGF5ZXIuQ2xpZW50fSBMYXllciBDbGllbnQgaW5zdGFuY2VcbiAqL1xuRGJNYW5hZ2VyLnByb3RvdHlwZS5jbGllbnQgPSBudWxsO1xuXG4vKipcbiAqIEB0eXBlIHtib29sZWFufSBpcyB0aGUgZGIgY29ubmVjdGlvbiBvcGVuXG4gKi9cbkRiTWFuYWdlci5wcm90b3R5cGUuaXNPcGVuID0gZmFsc2U7XG5cbi8qKlxuICogQHR5cGUge2Jvb2xlYW59IGlzIHRoZSBkYiBjb25uZWN0aW9uIHdpbGwgbm90IG9wZW5cbiAqIEBwcml2YXRlXG4gKi9cbkRiTWFuYWdlci5wcm90b3R5cGUuX2lzT3BlbkVycm9yID0gZmFsc2U7XG5cbi8qKlxuICogQHR5cGUge2Jvb2xlYW59IElzIHJlYWRpbmcvd3JpdGluZyBtZXNzYWdlcyBhbGxvd2VkP1xuICogQHByaXZhdGVcbiAqL1xuRGJNYW5hZ2VyLnByb3RvdHlwZS5fcGVybWlzc2lvbl9tZXNzYWdlcyA9IGZhbHNlO1xuXG4vKipcbiAqIEB0eXBlIHtib29sZWFufSBJcyByZWFkaW5nL3dyaXRpbmcgY29udmVyc2F0aW9ucyBhbGxvd2VkP1xuICogQHByaXZhdGVcbiAqL1xuRGJNYW5hZ2VyLnByb3RvdHlwZS5fcGVybWlzc2lvbl9jb252ZXJzYXRpb25zID0gZmFsc2U7XG5cbi8qKlxuICogQHR5cGUge2Jvb2xlYW59IElzIHJlYWRpbmcvd3JpdGluZyBpZGVudGl0aWVzIGFsbG93ZWQ/XG4gKiBAcHJpdmF0ZVxuICovXG5EYk1hbmFnZXIucHJvdG90eXBlLl9wZXJtaXNzaW9uX2lkZW50aXRpZXMgPSBmYWxzZTtcblxuLyoqXG4gKiBAdHlwZSB7Ym9vbGVhbn0gSXMgcmVhZGluZy93cml0aW5nIHVuc2VudCBzZXJ2ZXIgcmVxdWVzdHMgYWxsb3dlZD9cbiAqIEBwcml2YXRlXG4gKi9cbkRiTWFuYWdlci5wcm90b3R5cGUuX3Blcm1pc3Npb25fc3luY1F1ZXVlID0gZmFsc2U7XG5cbi8qKlxuICogQHR5cGUgSURCRGF0YWJhc2VcbiAqL1xuRGJNYW5hZ2VyLnByb3RvdHlwZS5kYiA9IG51bGw7XG5cbi8qKlxuICogUmljaCBDb250ZW50IG1heSBiZSB3cml0dGVuIHRvIGluZGV4ZWRkYiBhbmQgcGVyc2lzdGVkLi4uIGlmIGl0cyBzaXplIGlzIGxlc3MgdGhhbiB0aGlzIG51bWJlciBvZiBieXRlcy5cbiAqXG4gKiBUaGlzIHZhbHVlIGNhbiBiZSBjdXN0b21pemVkOyB0aGlzIGV4YW1wbGUgb25seSB3cml0ZXMgUmljaCBDb250ZW50IHRoYXQgaXMgbGVzcyB0aGFuIDUwMDAgYnl0ZXNcbiAqXG4gKiAgICBsYXllci5EYk1hbmFnZXIuTWF4UGFydFNpemUgPSA1MDAwO1xuICpcbiAqIEBzdGF0aWNcbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKi9cbkRiTWFuYWdlci5NYXhQYXJ0U2l6ZSA9IDI1MDAwMDtcblxuRGJNYW5hZ2VyLl9zdXBwb3J0ZWRFdmVudHMgPSBbXG4gICdvcGVuJywgJ2Vycm9yJyxcbl0uY29uY2F0KFJvb3QuX3N1cHBvcnRlZEV2ZW50cyk7XG5cblJvb3QuaW5pdENsYXNzLmFwcGx5KERiTWFuYWdlciwgW0RiTWFuYWdlciwgJ0RiTWFuYWdlciddKTtcbm1vZHVsZS5leHBvcnRzID0gRGJNYW5hZ2VyO1xuIl19
