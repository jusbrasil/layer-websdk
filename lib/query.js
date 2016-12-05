'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * There are two ways to instantiate this class:
 *
 *      // 1. Using a Query Builder
 *      var queryBuilder = QueryBuilder.conversations().sortBy('lastMessage');
 *      var query = client.createQuery(queryBuilder);
 *
 *      // 2. Passing properties directly
 *      var query = client.createQuery({
 *        client: client,
 *        model: layer.Query.Conversation,
 *        sortBy: [{'createdAt': 'desc'}]
 *      });
 *
 * You can change the data selected by your query any time you want using:
 *
 *      query.update({
 *        paginationWindow: 200
 *      });
 *
 *      query.update({
 *        predicate: 'conversation.id = "' + conv.id + "'"
 *      });
 *
 *     // Or use the Query Builder:
 *     queryBuilder.paginationWindow(200);
 *     query.update(queryBuilder);
 *
 * You can release Conversations and Messages held in memory by your queries when done with them:
 *
 *      query.destroy();
 *
 * #### predicate
 *
 * Note that the `predicate` property is only supported for Messages, and only supports
 * querying by Conversation: `conversation.id = 'layer:///conversations/UUIUD'`
 *
 * #### sortBy
 *
 * Note that the `sortBy` property is only supported for Conversations at this time and only
 * supports "createdAt" and "lastMessage.sentAt" as sort fields.
 *
 * #### dataType
 *
 * The layer.Query.dataType property lets you specify what type of data shows up in your results:
 *
 * ```javascript
 * var query = client.createQuery({
 *     model: layer.Query.Message,
 *     predicate: "conversation.id = 'layer:///conversations/uuid'",
 *     dataType: layer.Query.InstanceDataType
 * })
 *
 * var query = client.createQuery({
 *     model: layer.Query.Message,
 *     predicate: "conversation.id = 'layer:///conversations/uuid'",
 *     dataType: layer.Query.ObjectDataType
 * })
 * ```
 *
 * The property defaults to layer.Query.InstanceDataType.  Instances support methods and let you subscribe to events for direct notification
 * of changes to any of the results of your query:
 *
* ```javascript
 * query.data[0].on('messages:change', function(evt) {
 *     alert('The first message has had a property change; probably isRead or recipient_status!');
 * });
 * ```
 *
 * A value of layer.Query.ObjectDataType will cause the data to be an array of immutable objects rather than instances.  One can still get an instance from the POJO:
 *
 * ```javascript
 * var m = client.getMessage(query.data[0].id);
 * m.on('messages:change', function(evt) {
 *     alert('The first message has had a property change; probably isRead or recipient_status!');
 * });
 * ```
 *
 * ## Query Events
 *
 * Queries fire events whenever their data changes.  There are 5 types of events;
 * all events are received by subscribing to the `change` event.
 *
 * ### 1. Data Events
 *
 * The Data event is fired whenever a request is sent to the server for new query results.  This could happen when first creating the query, when paging for more data, or when changing the query's properties, resulting in a new request to the server.
 *
 * The Event object will have an `evt.data` array of all newly added results.  But frequently you may just want to use the `query.data` array and get ALL results.
 *
 * ```javascript
 * query.on('change', function(evt) {
 *   if (evt.type === 'data') {
 *      var newData = evt.data;
 *      var allData = query.data;
 *   }
 * });
 * ```
 *
 * Note that `query.on('change:data', function(evt) {}` is also supported.
 *
 * ### 2. Insert Events
 *
 * A new Conversation or Message was created. It may have been created locally by your user, or it may have been remotely created, received via websocket, and added to the Query's results.
 *
 * The layer.LayerEvent.target property contains the newly inserted object.
 *
 * ```javascript
 *  query.on('change', function(evt) {
 *    if (evt.type === 'insert') {
 *       var newItem = evt.target;
 *       var allData = query.data;
 *    }
 *  });
 * ```
 *
 * Note that `query.on('change:insert', function(evt) {}` is also supported.
 *
 * ### 3. Remove Events
 *
 * A Conversation or Message was deleted. This may have been deleted locally by your user, or it may have been remotely deleted, a notification received via websocket, and removed from the Query results.
 *
 * The layer.LayerEvent.target property contains the removed object.
 *
 * ```javascript
 * query.on('change', function(evt) {
 *   if (evt.type === 'remove') {
 *       var removedItem = evt.target;
 *       var allData = query.data;
 *   }
 * });
 * ```
 *
 * Note that `query.on('change:remove', function(evt) {}` is also supported.
 *
 * ### 4. Reset Events
 *
 * Any time your query's model or predicate properties have been changed
 * the query is reset, and a new request is sent to the server.  The reset event informs your UI that the current result set is empty, and that the reason its empty is that it was `reset`.  This helps differentiate it from a `data` event that returns an empty array.
 *
 * ```javascript
 * query.on('change', function(evt) {
 *   if (evt.type === 'reset') {
 *       var allData = query.data; // []
 *   }
 * });
 * ```
 *
 * Note that `query.on('change:reset', function(evt) {}` is also supported.
 *
 * ### 5. Property Events
 *
 * If any properties change in any of the objects listed in your layer.Query.data property, a `property` event will be fired.
 *
 * The layer.LayerEvent.target property contains object that was modified.
 *
 * See layer.LayerEvent.changes for details on how changes are reported.
 *
 * ```javascript
 * query.on('change', function(evt) {
 *   if (evt.type === 'property') {
 *       var changedItem = evt.target;
 *       var isReadChanges = evt.getChangesFor('isRead');
 *       var recipientStatusChanges = evt.getChangesFor('recipientStatus');
 *       if (isReadChanges.length) {
 *           ...
 *       }
 *
 *       if (recipientStatusChanges.length) {
 *           ...
 *       }
 *   }
 * });
 *```
 * Note that `query.on('change:property', function(evt) {}` is also supported.
 *
 * ### 6. Move Events
 *
 * Occasionally, a property change will cause an item to be sorted differently, causing a Move event.
 * The event will tell you what index the item was at, and where it has moved to in the Query results.
 * This is currently only supported for Conversations.
 *
 * ```javascript
 * query.on('change', function(evt) {
 *   if (evt.type === 'move') {
 *       var changedItem = evt.target;
 *       var oldIndex = evt.fromIndex;
 *       var newIndex = evt.newIndex;
 *       var moveNode = list.childNodes[oldIndex];
 *       list.removeChild(moveNode);
 *       list.insertBefore(moveNode, list.childNodes[newIndex]);
 *   }
 * });
 *```
 * Note that `query.on('change:move', function(evt) {}` is also supported.
 *
 * @class  layer.Query
 * @extends layer.Root
 *
 */
var Root = require('./root');
var LayerError = require('./layer-error');
var Util = require('./client-utils');
var Logger = require('./logger');

var _require = require('./const');

var SYNC_STATE = _require.SYNC_STATE;


var CONVERSATION = 'Conversation';
var MESSAGE = 'Message';
var ANNOUNCEMENT = 'Announcement';
var IDENTITY = 'Identity';
var findConvIdRegex = new RegExp(/^conversation.id\s*=\s*['"]((layer:\/\/\/conversations\/)?.{8}-.{4}-.{4}-.{4}-.{12})['"]$/);

var Query = function (_Root) {
  _inherits(Query, _Root);

  function Query() {
    _classCallCheck(this, Query);

    var options = void 0;

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    if (args.length === 2) {
      options = args[1].build();
      options.client = args[0];
    } else {
      options = args[0];
    }

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Query).call(this, options));

    _this.predicate = _this._fixPredicate(options.predicate || '');

    if ('paginationWindow' in options) {
      var paginationWindow = options.paginationWindow;
      _this.paginationWindow = Math.min(_this._getMaxPageSize(), options.paginationWindow);
      if (options.paginationWindow !== paginationWindow) {
        Logger.warn('paginationWindow value ' + paginationWindow + ' in Query constructor ' + ('excedes Query.MaxPageSize of ' + _this._getMaxPageSize()));
      }
    }

    _this.data = [];
    _this._initialPaginationWindow = _this.paginationWindow;
    if (!_this.client) throw new Error(LayerError.dictionary.clientMissing);
    _this.client.on('all', _this._handleChangeEvents, _this);

    if (!_this.client.isReady) {
      _this.client.once('ready', function () {
        return _this._run();
      }, _this);
    } else {
      _this._run();
    }
    return _this;
  }

  /**
   * Cleanup and remove this Query, its subscriptions and data.
   *
   * @method destroy
   */


  _createClass(Query, [{
    key: 'destroy',
    value: function destroy() {
      this.data = [];
      this._triggerChange({
        type: 'data',
        target: this.client,
        query: this,
        isChange: false,
        data: []
      });
      this.client.off(null, null, this);
      this.client._removeQuery(this);
      this.data = null;
      _get(Object.getPrototypeOf(Query.prototype), 'destroy', this).call(this);
    }

    /**
     * Get the maximum number of items allowed in a page
     *
     * @method _getMaxPageSize
     * @private
     * @returns {number}
     */

  }, {
    key: '_getMaxPageSize',
    value: function _getMaxPageSize() {
      return this.model === Query.Identity ? Query.MaxPageSizeIdentity : Query.MaxPageSize;
    }

    /**
     * Updates properties of the Query.
     *
     * Currently supports updating:
     *
     * * paginationWindow
     * * predicate
     * * model
     *
     * Any change to predicate or model results in clearing all data from the
     * query's results and triggering a change event with [] as the new data.
     *
     * @method update
     * @param  {Object} options
     * @param {string} [options.predicate] - A new predicate for the query
     * @param {string} [options.model] - A new model for the Query
     * @param {number} [paginationWindow] - Increase/decrease our result size to match this pagination window.
     * @return {layer.Query} this
     */

  }, {
    key: 'update',
    value: function update() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var needsRefresh = void 0,
          needsRecreate = void 0;

      var optionsBuilt = typeof options.build === 'function' ? options.build() : options;

      if ('paginationWindow' in optionsBuilt && this.paginationWindow !== optionsBuilt.paginationWindow) {
        this.paginationWindow = Math.min(this._getMaxPageSize() + this.size, optionsBuilt.paginationWindow);
        if (this.paginationWindow < optionsBuilt.paginationWindow) {
          Logger.warn('paginationWindow value ' + optionsBuilt.paginationWindow + ' in Query.update() ' + ('increases size greater than Query.MaxPageSize of ' + this._getMaxPageSize()));
        }
        needsRefresh = true;
      }
      if ('model' in optionsBuilt && this.model !== optionsBuilt.model) {
        this.model = optionsBuilt.model;
        needsRecreate = true;
      }

      if ('predicate' in optionsBuilt) {
        var predicate = this._fixPredicate(optionsBuilt.predicate || '');
        if (this.predicate !== predicate) {
          this.predicate = predicate;
          needsRecreate = true;
        }
      }
      if ('sortBy' in optionsBuilt && JSON.stringify(this.sortBy) !== JSON.stringify(optionsBuilt.sortBy)) {
        this.sortBy = optionsBuilt.sortBy;
        needsRecreate = true;
      }
      if (needsRecreate) {
        this._reset();
      }
      if (needsRecreate || needsRefresh) this._run();
      return this;
    }

    /**
     * Normalizes the predicate.
     *
     * @method _fixPredicate
     * @param {String} inValue
     * @private
     */

  }, {
    key: '_fixPredicate',
    value: function _fixPredicate(inValue) {
      if (inValue === '') return '';
      if (this.model === Query.Message) {
        var conversationId = inValue.match(findConvIdRegex) ? inValue.replace(findConvIdRegex, '$1') : null;
        if (!conversationId) throw new Error(LayerError.dictionary.invalidPredicate);
        if (conversationId.indexOf('layer:///conversations/') !== 0) conversationId = 'layer:///conversations/' + conversationId;
        return 'conversation.id = \'' + conversationId + '\'';
      } else {
        throw new Error(LayerError.dictionary.predicateNotSupported);
      }
    }

    /**
     * After redefining the query, reset it: remove all data/reset all state.
     *
     * @method _reset
     * @private
     */

  }, {
    key: '_reset',
    value: function _reset() {
      this.totalSize = 0;
      var data = this.data;
      this.data = [];
      this.client._checkAndPurgeCache(data);
      this.isFiring = false;
      this._predicate = null;
      this._nextDBFromId = '';
      this._nextServerFromId = '';
      this._isServerSyncing = false;
      this.pagedToEnd = false;
      this.paginationWindow = this._initialPaginationWindow;
      this._triggerChange({
        data: [],
        type: 'reset'
      });
    }

    /**
     * Reset your query to its initial state and then rerun it.
     *
     * @method reset
     */

  }, {
    key: 'reset',
    value: function reset() {
      if (this._isSyncingId) {
        clearTimeout(this._isSyncingId);
        this._isSyncingId = 0;
      }
      this._reset();
      this._run();
    }

    /**
     * Execute the query.
     *
     * No, don't murder it, just fire it.  No, don't make it unemployed,
     * just connect to the server and get the results.
     *
     * @method _run
     * @private
     */

  }, {
    key: '_run',
    value: function _run() {
      // Find the number of items we need to request.
      var pageSize = Math.min(this.paginationWindow - this.size, this._getMaxPageSize());

      // If there is a reduction in pagination window, then this variable will be negative, and we can shrink
      // the data.
      if (pageSize < 0) {
        var removedData = this.data.slice(this.paginationWindow);
        this.data = this.data.slice(0, this.paginationWindow);
        this.client._checkAndPurgeCache(removedData);
        this.pagedToEnd = false;
        this._triggerAsync('change', { data: [] });
      } else if (pageSize === 0 || this.pagedToEnd) {
        // No need to load 0 results.
      } else {
        switch (this.model) {
          case CONVERSATION:
            this._runConversation(pageSize);
            break;
          case MESSAGE:
            if (this.predicate) this._runMessage(pageSize);
            break;
          case ANNOUNCEMENT:
            this._runAnnouncement(pageSize);
            break;
          case IDENTITY:
            this._runIdentity(pageSize);
            break;
        }
      }
    }

    /**
     * Get Conversations from the server.
     *
     * @method _runConversation
     * @private
     * @param  {number} pageSize - Number of new results to request
     */

  }, {
    key: '_runConversation',
    value: function _runConversation(pageSize) {
      var _this2 = this;

      var sortBy = this._getSortField();

      this.client.dbManager.loadConversations(sortBy, this._nextDBFromId, pageSize, function (conversations) {
        if (conversations.length) _this2._appendResults({ data: conversations }, true);
      });

      var newRequest = 'conversations?sort_by=' + sortBy + '&page_size=' + pageSize + (this._nextServerFromId ? '&from_id=' + this._nextServerFromId : '');

      if (newRequest !== this._firingRequest) {
        this.isFiring = true;
        this._firingRequest = newRequest;
        this.client.xhr({
          url: this._firingRequest,
          method: 'GET',
          sync: false
        }, function (results) {
          return _this2._processRunResults(results, _this2._firingRequest, pageSize);
        });
      }
    }

    /**
     * Returns the sort field for the query.
     *
     * Returns One of:
     *
     * * 'position' (Messages only)
     * * 'last_message' (Conversations only)
     * * 'created_at' (Conversations only)
     * @method _getSortField
     * @private
     * @return {String} sort key used by server
     */

  }, {
    key: '_getSortField',
    value: function _getSortField() {
      if (this.model === MESSAGE || this.model === ANNOUNCEMENT) return 'position';
      if (this.sortBy && this.sortBy[0] && this.sortBy[0]['lastMessage.sentAt']) return 'last_message';
      return 'created_at';
    }

    /**
     * Get the Conversation UUID from the predicate property.
     *
     * Extract the Conversation's UUID from the predicate... or returned the cached value.
     *
     * @method _getConversationPredicateIds
     * @private
     */

  }, {
    key: '_getConversationPredicateIds',
    value: function _getConversationPredicateIds() {
      if (this.predicate.match(findConvIdRegex)) {
        var conversationId = this.predicate.replace(findConvIdRegex, '$1');

        // We will already have a this._predicate if we are paging; else we need to extract the UUID from
        // the conversationId.
        var uuid = (this._predicate || conversationId).replace(/^layer:\/\/\/conversations\//, '');
        if (uuid) {
          return {
            uuid: uuid,
            id: conversationId
          };
        }
      }
    }

    /**
     * Get Messages from the server.
     *
     * @method _runMessage
     * @private
     * @param  {number} pageSize - Number of new results to request
     */

  }, {
    key: '_runMessage',
    value: function _runMessage(pageSize) {
      var _this3 = this;

      var predicateIds = this._getConversationPredicateIds();

      // Do nothing if we don't have a conversation to query on
      if (predicateIds) {
        (function () {
          var conversationId = 'layer:///conversations/' + predicateIds.uuid;
          if (!_this3._predicate) _this3._predicate = predicateIds.id;
          var conversation = _this3.client.getConversation(conversationId);

          // Retrieve data from db cache in parallel with loading data from server
          _this3.client.dbManager.loadMessages(conversationId, _this3._nextDBFromId, pageSize, function (messages) {
            if (messages.length) _this3._appendResults({ data: messages }, true);
          });

          var newRequest = 'conversations/' + predicateIds.uuid + '/messages?page_size=' + pageSize + (_this3._nextServerFromId ? '&from_id=' + _this3._nextServerFromId : '');

          // Don't query on unsaved conversations, nor repeat still firing queries
          if ((!conversation || conversation.isSaved()) && newRequest !== _this3._firingRequest) {
            _this3.isFiring = true;
            _this3._firingRequest = newRequest;
            _this3.client.xhr({
              url: newRequest,
              method: 'GET',
              sync: false
            }, function (results) {
              return _this3._processRunResults(results, newRequest, pageSize);
            });
          }

          // If there are no results, then its a new query; automatically populate it with the Conversation's lastMessage.
          if (_this3.data.length === 0) {
            if (conversation && conversation.lastMessage) {
              _this3.data = [_this3._getData(conversation.lastMessage)];
              // Trigger the change event
              _this3._triggerChange({
                type: 'data',
                data: [_this3._getData(conversation.lastMessage)],
                query: _this3,
                target: _this3.client
              });
            }
          }
        })();
      } else if (!this.predicate.match(/['"]/)) {
        Logger.error('This query may need to quote its value');
      }
    }

    /**
     * Get Announcements from the server.
     *
     * @method _runAnnouncement
     * @private
     * @param  {number} pageSize - Number of new results to request
     */

  }, {
    key: '_runAnnouncement',
    value: function _runAnnouncement(pageSize) {
      var _this4 = this;

      // Retrieve data from db cache in parallel with loading data from server
      this.client.dbManager.loadAnnouncements(this._nextDBFromId, pageSize, function (messages) {
        if (messages.length) _this4._appendResults({ data: messages }, true);
      });

      var newRequest = 'announcements?page_size=' + pageSize + (this._nextServerFromId ? '&from_id=' + this._nextServerFromId : '');

      // Don't repeat still firing queries
      if (newRequest !== this._firingRequest) {
        this.isFiring = true;
        this._firingRequest = newRequest;
        this.client.xhr({
          url: newRequest,
          method: 'GET',
          sync: false
        }, function (results) {
          return _this4._processRunResults(results, newRequest, pageSize);
        });
      }
    }

    /**
     * Get Identities from the server.
     *
     * @method _runIdentities
     * @private
     * @param  {number} pageSize - Number of new results to request
     */

  }, {
    key: '_runIdentity',
    value: function _runIdentity(pageSize) {
      var _this5 = this;

      // There is not yet support for paging Identities;  as all identities are loaded,
      // if there is a _nextDBFromId, we no longer need to get any more from the database
      if (!this._nextDBFromId) {
        this.client.dbManager.loadIdentities(function (identities) {
          if (identities.length) _this5._appendResults({ data: identities }, true);
        });
      }

      var newRequest = 'identities?page_size=' + pageSize + (this._nextServerFromId ? '&from_id=' + this._nextServerFromId : '');

      // Don't repeat still firing queries
      if (newRequest !== this._firingRequest) {
        this.isFiring = true;
        this._firingRequest = newRequest;
        this.client.xhr({
          url: newRequest,
          method: 'GET',
          sync: false
        }, function (results) {
          return _this5._processRunResults(results, newRequest, pageSize);
        });
      }
    }

    /**
     * Process the results of the `_run` method; calls __appendResults.
     *
     * @method _processRunResults
     * @private
     * @param  {Object} results - Full xhr response object with server results
     * @param {Number} pageSize - Number of entries that were requested
     */

  }, {
    key: '_processRunResults',
    value: function _processRunResults(results, requestUrl, pageSize) {
      var _this6 = this;

      if (requestUrl !== this._firingRequest || this.isDestroyed) return;
      var isSyncing = results.xhr.getResponseHeader('Layer-Conversation-Is-Syncing') === 'true';

      // isFiring is false... unless we are still syncing
      this.isFiring = isSyncing;
      this._firingRequest = '';
      if (results.success) {
        if (isSyncing) {
          this._isSyncingId = setTimeout(function () {
            _this6._isSyncingId = 0;
            _this6._run();
          }, 1500);
        } else {
          this._isSyncingId = 0;
          this._appendResults(results, false);
          this.totalSize = Number(results.xhr.getResponseHeader('Layer-Count'));

          if (results.data.length < pageSize) this.pagedToEnd = true;
        }
      } else {
        this.trigger('error', { error: results.data });
      }
    }

    /**
     * Appends arrays of data to the Query results.
     *
     * @method  _appendResults
     * @private
     */

  }, {
    key: '_appendResults',
    value: function _appendResults(results, fromDb) {
      var _this7 = this;

      // For all results, register them with the client
      // If already registered with the client, properties will be updated as needed
      // Database results rather than server results will arrive already registered.
      results.data.forEach(function (item) {
        if (!(item instanceof Root)) _this7.client._createObject(item);
      });

      // Filter results to just the new results
      var newResults = results.data.filter(function (item) {
        return _this7._getIndex(item.id) === -1;
      });

      // Update the next ID to use in pagination
      var resultLength = results.data.length;
      if (resultLength) {
        if (fromDb) {
          this._nextDBFromId = results.data[resultLength - 1].id;
        } else {
          this._nextServerFromId = results.data[resultLength - 1].id;
        }
      }

      // Update this.data
      if (this.dataType === Query.ObjectDataType) {
        this.data = [].concat(this.data);
      }
      var data = this.data;

      // Insert the results... if the results are a match
      newResults.forEach(function (itemIn) {
        var index = void 0;
        var item = _this7.client._getObject(itemIn.id);
        switch (_this7.model) {
          case MESSAGE:
          case ANNOUNCEMENT:
            index = _this7._getInsertMessageIndex(item, data);
            break;
          case CONVERSATION:
            index = _this7._getInsertConversationIndex(item, data);
            break;
          case IDENTITY:
            index = data.length;
            break;
        }
        data.splice(index, 0, _this7._getData(item));
      });

      // Trigger the change event
      this._triggerChange({
        type: 'data',
        data: newResults.map(function (item) {
          return _this7._getData(_this7.client._getObject(item.id));
        }),
        query: this,
        target: this.client
      });
    }

    /**
     * Returns a correctly formatted object representing a result.
     *
     * Format is specified by the `dataType` property.
     *
     * @method _getData
     * @private
     * @param  {layer.Root} item - Conversation or Message instance
     * @return {Object} - Conversation or Message instance or Object
     */

  }, {
    key: '_getData',
    value: function _getData(item) {
      if (this.dataType === Query.ObjectDataType) {
        return item.toObject();
      }
      return item;
    }

    /**
     * Returns an instance regardless of whether the input is instance or object
     * @method _getInstance
     * @private
     * @param {layer.Root|Object} item - Conversation or Message object/instance
     * @return {layer.Root}
     */

  }, {
    key: '_getInstance',
    value: function _getInstance(item) {
      if (item instanceof Root) return item;
      return this.client._getObject(item.id);
    }

    /**
     * Ask the query for the item matching the ID.
     *
     * Returns undefined if the ID is not found.
     *
     * @method _getItem
     * @private
     * @param  {string} id
     * @return {Object} Conversation or Message object or instance
     */

  }, {
    key: '_getItem',
    value: function _getItem(id) {
      switch (Util.typeFromID(id)) {
        case 'announcements':
          if (this.model === ANNOUNCEMENT) {
            var index = this._getIndex(id);
            return index === -1 ? null : this.data[index];
          }
          break;
        case 'messages':
          if (this.model === MESSAGE) {
            var _index = this._getIndex(id);
            return _index === -1 ? null : this.data[_index];
          } else if (this.model === CONVERSATION) {
            for (var _index2 = 0; _index2 < this.data.length; _index2++) {
              var conversation = this.data[_index2];
              if (conversation.lastMessage && conversation.lastMessage.id === id) return conversation.lastMessage;
            }
            return null;
          }
          break;
        case 'conversations':
          if (this.model === CONVERSATION) {
            var _index3 = this._getIndex(id);
            return _index3 === -1 ? null : this.data[_index3];
          }
          break;
        case 'identities':
          if (this.model === IDENTITY) {
            var _index4 = this._getIndex(id);
            return _index4 === -1 ? null : this.data[_index4];
          }
          break;
      }
    }

    /**
     * Get the index of the item represented by the specified ID; or return -1.
     *
     * @method _getIndex
     * @private
     * @param  {string} id
     * @return {number}
     */

  }, {
    key: '_getIndex',
    value: function _getIndex(id) {
      for (var index = 0; index < this.data.length; index++) {
        if (this.data[index].id === id) return index;
      }
      return -1;
    }

    /**
     * Handle any change event received from the layer.Client.
     *
     * These can be caused by websocket events, as well as local
     * requests to create/delete/modify Conversations and Messages.
     *
     * The event does not necessarily apply to this Query, but the Query
     * must examine it to determine if it applies.
     *
     * @method _handleChangeEvents
     * @private
     * @param {string} eventName - "messages:add", "conversations:change"
     * @param {layer.LayerEvent} evt
     */

  }, {
    key: '_handleChangeEvents',
    value: function _handleChangeEvents(eventName, evt) {
      switch (this.model) {
        case CONVERSATION:
          this._handleConversationEvents(evt);
          break;
        case MESSAGE:
        case ANNOUNCEMENT:
          this._handleMessageEvents(evt);
          break;
        case IDENTITY:
          this._handleIdentityEvents(evt);
          break;
      }
    }
  }, {
    key: '_handleConversationEvents',
    value: function _handleConversationEvents(evt) {
      switch (evt.eventName) {

        // If a Conversation's property has changed, and the Conversation is in this
        // Query's data, then update it.
        case 'conversations:change':
          this._handleConversationChangeEvent(evt);
          break;

        // If a Conversation is added, and it isn't already in the Query,
        // add it and trigger an event
        case 'conversations:add':
          this._handleConversationAddEvent(evt);
          break;

        // If a Conversation is deleted, and its still in our data,
        // remove it and trigger an event.
        case 'conversations:remove':
          this._handleConversationRemoveEvent(evt);
          break;
      }
    }

    // TODO WEB-968: Refactor this into functions for instance, object, sortBy createdAt, sortBy lastMessage

  }, {
    key: '_handleConversationChangeEvent',
    value: function _handleConversationChangeEvent(evt) {
      var index = this._getIndex(evt.target.id);

      // If its an ID change (matching Distinct Conversation returned by server) make sure to update our data.
      // If dataType is an instance, its been updated for us.
      if (this.dataType === Query.ObjectDataType) {
        var idChanges = evt.getChangesFor('id');
        if (idChanges.length) {
          index = this._getIndex(idChanges[0].oldValue);
        }
      }

      // If dataType is "object" then update the object and our array;
      // else the object is already updated.
      // Ignore results that aren't already in our data; Results are added via
      // conversations:add events.  Websocket Manager automatically loads anything that receives an event
      // for which we have no object, so we'll get the add event at that time.
      if (index !== -1) {
        var sortField = this._getSortField();
        var reorder = evt.hasProperty('lastMessage') && sortField === 'last_message';
        var newIndex = void 0;

        if (this.dataType === Query.ObjectDataType) {
          if (!reorder) {
            // Replace the changed Conversation with a new immutable object
            this.data = [].concat(_toConsumableArray(this.data.slice(0, index)), [evt.target.toObject()], _toConsumableArray(this.data.slice(index + 1)));
          } else {
            newIndex = this._getInsertConversationIndex(evt.target, this.data);
            this.data.splice(index, 1);
            this.data.splice(newIndex, 0, this._getData(evt.target));
            this.data = this.data.concat([]);
          }
        }

        // Else dataType is instance not object
        else {
            if (reorder) {
              newIndex = this._getInsertConversationIndex(evt.target, this.data);
              if (newIndex !== index) {
                this.data.splice(index, 1);
                this.data.splice(newIndex, 0, evt.target);
              }
            }
          }

        // Trigger a 'property' event
        this._triggerChange({
          type: 'property',
          target: this._getData(evt.target),
          query: this,
          isChange: true,
          changes: evt.changes
        });

        if (reorder && newIndex !== index) {
          this._triggerChange({
            type: 'move',
            target: this._getData(evt.target),
            query: this,
            isChange: false,
            fromIndex: index,
            toIndex: newIndex
          });
        }
      }
    }
  }, {
    key: '_getInsertConversationIndex',
    value: function _getInsertConversationIndex(conversation, data) {
      if (!conversation.isSaved()) return 0;
      var sortField = this._getSortField();
      var index = void 0;
      if (sortField === 'created_at') {
        for (index = 0; index < data.length; index++) {
          var item = data[index];
          if (item.syncState === SYNC_STATE.NEW || item.syncState === SYNC_STATE.SAVING) continue;
          if (conversation.createdAt >= item.createdAt) break;
        }
        return index;
      } else {
        var oldIndex = -1;
        var d1 = conversation.lastMessage ? conversation.lastMessage.sentAt : conversation.createdAt;
        for (index = 0; index < data.length; index++) {
          var _item = data[index];
          if (_item.id === conversation.id) {
            oldIndex = index;
            continue;
          }
          if (_item.syncState === SYNC_STATE.NEW || _item.syncState === SYNC_STATE.SAVING) continue;
          var d2 = _item.lastMessage ? _item.lastMessage.sentAt : _item.createdAt;
          if (d1 >= d2) break;
        }
        return oldIndex === -1 || oldIndex > index ? index : index - 1;
      }
    }
  }, {
    key: '_getInsertMessageIndex',
    value: function _getInsertMessageIndex(message, data) {
      var index = void 0;
      for (index = 0; index < data.length; index++) {
        if (message.position > data[index].position) {
          break;
        }
      }
      return index;
    }
  }, {
    key: '_handleConversationAddEvent',
    value: function _handleConversationAddEvent(evt) {
      var _this8 = this;

      // Filter out any Conversations already in our data
      var list = evt.conversations.filter(function (conversation) {
        return _this8._getIndex(conversation.id) === -1;
      });

      if (list.length) {
        (function () {
          var data = _this8.data;
          list.forEach(function (conversation) {
            var newIndex = _this8._getInsertConversationIndex(conversation, data);
            data.splice(newIndex, 0, _this8._getData(conversation));
          });

          // Whether sorting by last_message or created_at, new results go at the top of the list
          if (_this8.dataType === Query.ObjectDataType) {
            _this8.data = [].concat(data);
          }
          _this8.totalSize += list.length;

          // Trigger an 'insert' event for each item added;
          // typically bulk inserts happen via _appendResults().
          list.forEach(function (conversation) {
            var item = _this8._getData(conversation);
            _this8._triggerChange({
              type: 'insert',
              index: _this8.data.indexOf(item),
              target: item,
              query: _this8
            });
          });
        })();
      }
    }
  }, {
    key: '_handleConversationRemoveEvent',
    value: function _handleConversationRemoveEvent(evt) {
      var _this9 = this;

      var removed = [];
      evt.conversations.forEach(function (conversation) {
        var index = _this9._getIndex(conversation.id);
        if (index !== -1) {
          if (conversation.id === _this9._nextDBFromId) _this9._nextDBFromId = _this9._updateNextFromId(index);
          if (conversation.id === _this9._nextServerFromId) _this9._nextServerFromId = _this9._updateNextFromId(index);
          removed.push({
            data: conversation,
            index: index
          });
          if (_this9.dataType === Query.ObjectDataType) {
            _this9.data = [].concat(_toConsumableArray(_this9.data.slice(0, index)), _toConsumableArray(_this9.data.slice(index + 1)));
          } else {
            _this9.data.splice(index, 1);
          }
        }
      });

      this.totalSize -= removed.length;
      removed.forEach(function (removedObj) {
        _this9._triggerChange({
          type: 'remove',
          index: removedObj.index,
          target: _this9._getData(removedObj.data),
          query: _this9
        });
      });
    }
  }, {
    key: '_handleMessageEvents',
    value: function _handleMessageEvents(evt) {
      switch (evt.eventName) {

        // If a Conversation's ID has changed, check our predicate, and update it automatically if needed.
        case 'conversations:change':
          if (this.model === MESSAGE) this._handleMessageConvIdChangeEvent(evt);
          break;

        // If a Message has changed and its in our result set, replace
        // it with a new immutable object
        case 'messages:change':
        case 'messages:read':
          this._handleMessageChangeEvent(evt);
          break;

        // If Messages are added, and they aren't already in our result set
        // add them.
        case 'messages:add':
          this._handleMessageAddEvent(evt);
          break;

        // If a Message is deleted and its in our result set, remove it
        // and trigger an event
        case 'messages:remove':
          this._handleMessageRemoveEvent(evt);
          break;
      }
    }

    /**
     * A Conversation ID changes if a matching Distinct Conversation was found on the server.
     *
     * If this Query's Conversation's ID has changed, update the predicate.
     *
     * @method _handleMessageConvIdChangeEvent
     * @param {layer.LayerEvent} evt - A Message Change Event
     * @private
     */

  }, {
    key: '_handleMessageConvIdChangeEvent',
    value: function _handleMessageConvIdChangeEvent(evt) {
      var cidChanges = evt.getChangesFor('id');
      if (cidChanges.length) {
        if (this._predicate === cidChanges[0].oldValue) {
          this._predicate = cidChanges[0].newValue;
          this.predicate = "conversation.id = '" + this._predicate + "'";
          this._run();
        }
      }
    }

    /**
     * If the ID of the message has changed, then the position property has likely changed as well.
     *
     * This method tests to see if changes to the position property have impacted the message's position in the
     * data array... and updates the array if it has.
     *
     * @method _handleMessagePositionChange
     * @private
     * @param {layer.LayerEvent} evt  A Message Change event
     * @param {number} index  Index of the message in the current data array
     * @return {boolean} True if a data was changed and a change event was emitted
     */

  }, {
    key: '_handleMessagePositionChange',
    value: function _handleMessagePositionChange(evt, index) {
      // If the message is not in the current data, then there is no change to our query results.
      if (index === -1) return false;

      // Create an array without our data item and then find out where the data item Should be inserted.
      // Note: we could just lookup the position in our current data array, but its too easy to introduce
      // errors where comparing this message to itself may yield index or index + 1.
      var newData = [].concat(_toConsumableArray(this.data.slice(0, index)), _toConsumableArray(this.data.slice(index + 1)));
      var newIndex = this._getInsertMessageIndex(evt.target, newData);

      // If the data item goes in the same index as before, then there is no change to be handled here;
      // else insert the item at the right index, update this.data and fire a change event
      if (newIndex !== index) {
        newData.splice(newIndex, 0, this._getData(evt.target));
        this.data = newData;
        this._triggerChange({
          type: 'property',
          target: this._getData(evt.target),
          query: this,
          isChange: true,
          changes: evt.changes
        });
        return true;
      }
      return false;
    }
  }, {
    key: '_handleMessageChangeEvent',
    value: function _handleMessageChangeEvent(evt) {
      var index = this._getIndex(evt.target.id);
      var positionChanges = evt.getChangesFor('position');

      // If there are position changes, handle them.  If all the changes are position changes,
      // exit when done.
      if (positionChanges.length) {
        if (this._handleMessagePositionChange(evt, index)) {
          if (positionChanges.length === evt.changes.length) return;
          index = this._getIndex(evt.target.id); // Get the updated position
        }
      }

      if (index !== -1) {
        if (this.dataType === Query.ObjectDataType) {
          this.data = [].concat(_toConsumableArray(this.data.slice(0, index)), [evt.target.toObject()], _toConsumableArray(this.data.slice(index + 1)));
        }
        this._triggerChange({
          type: 'property',
          target: this._getData(evt.target),
          query: this,
          isChange: true,
          changes: evt.changes
        });
      }
    }
  }, {
    key: '_handleMessageAddEvent',
    value: function _handleMessageAddEvent(evt) {
      var _this10 = this;

      // Only use added messages that are part of this Conversation
      // and not already in our result set
      var list = evt.messages
      // Filter so that we only see Messages if doing a Messages query or Announcements if doing an Announcements Query.
      .filter(function (message) {
        var type = Util.typeFromID(message.id);
        return type === 'messages' && _this10.model === MESSAGE || type === 'announcements' && _this10.model === ANNOUNCEMENT;
      })
      // Filter out Messages that aren't part of this Conversation
      .filter(function (message) {
        var type = Util.typeFromID(message.id);
        return type === 'announcements' || message.conversationId === _this10._predicate;
      })
      // Filter out Messages that are already in our data set
      .filter(function (message) {
        return _this10._getIndex(message.id) === -1;
      }).map(function (message) {
        return _this10._getData(message);
      });

      // Add them to our result set and trigger an event for each one
      if (list.length) {
        (function () {
          var data = _this10.data = _this10.dataType === Query.ObjectDataType ? [].concat(_this10.data) : _this10.data;
          list.forEach(function (item) {
            var index = _this10._getInsertMessageIndex(item, data);
            data.splice(index, 0, item);
          });

          _this10.totalSize += list.length;

          // Index calculated above may shift after additional insertions.  This has
          // to be done after the above insertions have completed.
          list.forEach(function (item) {
            _this10._triggerChange({
              type: 'insert',
              index: _this10.data.indexOf(item),
              target: item,
              query: _this10
            });
          });
        })();
      }
    }
  }, {
    key: '_handleMessageRemoveEvent',
    value: function _handleMessageRemoveEvent(evt) {
      var _this11 = this;

      var removed = [];
      evt.messages.forEach(function (message) {
        var index = _this11._getIndex(message.id);
        if (index !== -1) {
          if (message.id === _this11._nextDBFromId) _this11._nextDBFromId = _this11._updateNextFromId(index);
          if (message.id === _this11._nextServerFromId) _this11._nextServerFromId = _this11._updateNextFromId(index);
          removed.push({
            data: message,
            index: index
          });
          if (_this11.dataType === Query.ObjectDataType) {
            _this11.data = [].concat(_toConsumableArray(_this11.data.slice(0, index)), _toConsumableArray(_this11.data.slice(index + 1)));
          } else {
            _this11.data.splice(index, 1);
          }
        }
      });

      this.totalSize -= removed.length;
      removed.forEach(function (removedObj) {
        _this11._triggerChange({
          type: 'remove',
          target: _this11._getData(removedObj.data),
          index: removedObj.index,
          query: _this11
        });
      });
    }
  }, {
    key: '_handleIdentityEvents',
    value: function _handleIdentityEvents(evt) {
      switch (evt.eventName) {

        // If a Identity has changed and its in our result set, replace
        // it with a new immutable object
        case 'identities:change':
          this._handleIdentityChangeEvent(evt);
          break;

        // If Identities are added, and they aren't already in our result set
        // add them.
        case 'identities:add':
          this._handleIdentityAddEvent(evt);
          break;

        // If a Identity is deleted and its in our result set, remove it
        // and trigger an event
        case 'identities:remove':
          this._handleIdentityRemoveEvent(evt);
          break;
      }
    }
  }, {
    key: '_handleIdentityChangeEvent',
    value: function _handleIdentityChangeEvent(evt) {
      var index = this._getIndex(evt.target.id);

      if (index !== -1) {
        if (this.dataType === Query.ObjectDataType) {
          this.data = [].concat(_toConsumableArray(this.data.slice(0, index)), [evt.target.toObject()], _toConsumableArray(this.data.slice(index + 1)));
        }
        this._triggerChange({
          type: 'property',
          target: this._getData(evt.target),
          query: this,
          isChange: true,
          changes: evt.changes
        });
      }
    }
  }, {
    key: '_handleIdentityAddEvent',
    value: function _handleIdentityAddEvent(evt) {
      var _this12 = this;

      var list = evt.identities.filter(function (identity) {
        return _this12._getIndex(identity.id) === -1;
      }).map(function (identity) {
        return _this12._getData(identity);
      });

      // Add them to our result set and trigger an event for each one
      if (list.length) {
        (function () {
          var data = _this12.data = _this12.dataType === Query.ObjectDataType ? [].concat(_this12.data) : _this12.data;
          list.forEach(function (item) {
            return data.push(item);
          });

          _this12.totalSize += list.length;

          // Index calculated above may shift after additional insertions.  This has
          // to be done after the above insertions have completed.
          list.forEach(function (item) {
            _this12._triggerChange({
              type: 'insert',
              index: _this12.data.indexOf(item),
              target: item,
              query: _this12
            });
          });
        })();
      }
    }
  }, {
    key: '_handleIdentityRemoveEvent',
    value: function _handleIdentityRemoveEvent(evt) {
      var _this13 = this;

      var removed = [];
      evt.identities.forEach(function (identity) {
        var index = _this13._getIndex(identity.id);
        if (index !== -1) {
          if (identity.id === _this13._nextDBFromId) _this13._nextDBFromId = _this13._updateNextFromId(index);
          if (identity.id === _this13._nextServerFromId) _this13._nextServerFromId = _this13._updateNextFromId(index);
          removed.push({
            data: identity,
            index: index
          });
          if (_this13.dataType === Query.ObjectDataType) {
            _this13.data = [].concat(_toConsumableArray(_this13.data.slice(0, index)), _toConsumableArray(_this13.data.slice(index + 1)));
          } else {
            _this13.data.splice(index, 1);
          }
        }
      });

      this.totalSize -= removed.length;
      removed.forEach(function (removedObj) {
        _this13._triggerChange({
          type: 'remove',
          target: _this13._getData(removedObj.data),
          index: removedObj.index,
          query: _this13
        });
      });
    }

    /**
     * If the current next-id is removed from the list, get a new nextId.
     *
     * If the index is greater than 0, whatever is after that index may have come from
     * websockets or other sources, so decrement the index to get the next safe paging id.
     *
     * If the index if 0, even if there is data, that data did not come from paging and
     * can not be used safely as a paging id; return '';
     *
     * @method _updateNextFromId
     * @private
     * @param {number} index - Current index of the nextFromId
     * @returns {string} - Next ID or empty string
     */

  }, {
    key: '_updateNextFromId',
    value: function _updateNextFromId(index) {
      if (index > 0) return this.data[index - 1].id;else return '';
    }

    /*
     * If this is ever changed to be async, make sure that destroy() still triggers synchronous events
     */

  }, {
    key: '_triggerChange',
    value: function _triggerChange(evt) {
      this.trigger('change', evt);
      this.trigger('change:' + evt.type, evt);
    }
  }, {
    key: 'toString',
    value: function toString() {
      return this.id;
    }
  }]);

  return Query;
}(Root);

Query.prefixUUID = 'layer:///queries/';

/**
 * Query for Conversations.
 *
 * Use this value in the layer.Query.model property.
 * @type {string}
 * @static
 */
Query.Conversation = CONVERSATION;

/**
 * Query for Messages.
 *
 * Use this value in the layer.Query.model property.
 * @type {string}
 * @static
 */
Query.Message = MESSAGE;

/**
 * Query for Announcements.
 *
 * Use this value in the layer.Query.model property.
 * @type {string}
 * @static
 */
Query.Announcement = ANNOUNCEMENT;

/**
 * Query for Identities.
 *
 * Use this value in the layer.Query.model property.
 * @type {string}
 * @static
 */
Query.Identity = IDENTITY;

/**
 * Get data as POJOs/immutable objects.
 *
 * This value of layer.Query.dataType will cause your Query data and events to provide Messages/Conversations as immutable objects.
 *
 * @type {string}
 * @static
 */
Query.ObjectDataType = 'object';

/**
 * Get data as instances of layer.Message and layer.Conversation.
 *
 * This value of layer.Query.dataType will cause your Query data and events to provide Messages/Conversations as instances.
 *
 * @type {string}
 * @static
 */
Query.InstanceDataType = 'instance';

/**
 * Set the maximum page size for queries.
 *
 * @type {number}
 * @static
 */
Query.MaxPageSize = 100;

/**
 * Set the maximum page size for Identity queries.
 *
 * @type {number}
 * @static
 */
Query.MaxPageSizeIdentity = 500;

/**
 * Access the number of results currently loaded.
 *
 * @type {Number}
 * @readonly
 */
Object.defineProperty(Query.prototype, 'size', {
  enumerable: true,
  get: function get() {
    return !this.data ? 0 : this.data.length;
  }
});

/** Access the total number of results on the server.
 *
 * Will be 0 until the first query has successfully loaded results.
 *
 * @type {Number}
 * @readonly
 */
Query.prototype.totalSize = 0;

/**
 * Access to the client so it can listen to websocket and local events.
 *
 * @type {layer.Client}
 * @protected
 * @readonly
 */
Query.prototype.client = null;

/**
 * Query results.
 *
 * Array of data resulting from the Query; either a layer.Root subclass.
 *
 * or plain Objects
 * @type {Object[]}
 * @readonly
 */
Query.prototype.data = null;

/**
 * Specifies the type of data being queried for.
 *
 * Model is one of
 *
 * * layer.Query.Conversation
 * * layer.Query.Message
 * * layer.Query.Announcement
 * * layer.Query.Identity
 *
 * Value can be set via constructor and layer.Query.update().
 *
 * @type {String}
 * @readonly
 */
Query.prototype.model = '';

/**
 * What type of results to request of the server.
 *
 * Not yet supported; returnType is one of
 *
 * * object
 * * id
 * * count
 *
 *  Value set via constructor.
 + *
 * This Query API is designed only for use with 'object' at this time; waiting for updates to server for
 * this functionality.
 *
 * @type {String}
 * @readonly
 */
Query.prototype.returnType = 'object';

/**
 * Specify what kind of data array your application requires.
 *
 * Used to specify query dataType.  One of
 * * Query.ObjectDataType
 * * Query.InstanceDataType
 *
 * @type {String}
 * @readonly
 */
Query.prototype.dataType = Query.InstanceDataType;

/**
 * Number of results from the server to request/cache.
 *
 * The pagination window can be increased to download additional items, or decreased to purge results
 * from the data property.
 *
 *     query.update({
 *       paginationWindow: 150
 *     })
 *
 * This call will aim to achieve 150 results.  If it previously had 100,
 * then it will load 50 more. If it previously had 200, it will drop 50.
 *
 * Note that the server will only permit 100 at a time.
 *
 * @type {Number}
 * @readonly
 */
Query.prototype.paginationWindow = 100;

/**
 * Sorting criteria for Conversation Queries.
 *
 * Only supports an array of one field/element.
 * Only supports the following options:
 *
 *     [{'createdAt': 'desc'}]
 *     [{'lastMessage.sentAt': 'desc'}]
 *
 * Why such limitations? Why this structure?  The server will be exposing a Query API at which point the
 * above sort options will make a lot more sense, and full sorting will be provided.
 *
 * @type {String}
 * @readonly
 */
Query.prototype.sortBy = null;

/**
 * This value tells us what to reset the paginationWindow to when the query is redefined.
 *
 * @type {Number}
 * @private
 */
Query.prototype._initialPaginationWindow = 100;

/**
 * Your Query's WHERE clause.
 *
 * Currently, the only query supported is "conversation.id = 'layer:///conversations/uuid'"
 * Note that both ' and " are supported.
 *
 * Currently, the only query supported is `conversation.id = 'layer:///conversations/uuid'`
 *
 * @type {string}
 * @readonly
 */
Query.prototype.predicate = null;

/**
 * True if the Query is connecting to the server.
 *
 * It is not gaurenteed that every `update()` will fire a request to the server.
 * For example, updating a paginationWindow to be smaller,
 * Or changing a value to the existing value would cause the request not to fire.
 *
 * Recommended pattern is:
 *
 *      query.update({paginationWindow: 50});
 *      if (!query.isFiring) {
 *        alert("Done");
 *      } else {
 *          query.once("change", function(evt) {
 *            if (evt.type == "data") alert("Done");
 *          });
 *      }
 *
 * @type {Boolean}
 * @readonly
 */
Query.prototype.isFiring = false;

/**
 * True if we have reached the last result, and further paging will just return []
 *
 * @type {Boolean}
 * @readonly
 */
Query.prototype.pagedToEnd = false;

/**
 * The last request fired.
 *
 * If multiple requests are inflight, the response
 * matching this request is the ONLY response we will process.
 * @type {String}
 * @private
 */
Query.prototype._firingRequest = '';

/**
 * The ID to use in paging the server.
 *
 * Why not just use the ID of the last item in our result set?
 * Because as we receive websocket events, we insert and append items to our data.
 * That websocket event may not in fact deliver the NEXT item in our data, but simply an item, that sequentially
 * belongs at the end despite skipping over other items of data.  Paging should not be from this new item, but
 * only the last item pulled via this query from the server.
 *
 * @type {string}
 */
Query.prototype._nextServerFromId = '';

/**
 * The ID to use in paging the database.
 *
 * Why not just use the ID of the last item in our result set?
 * Because as we receive websocket events, we insert and append items to our data.
 * That websocket event may not in fact deliver the NEXT item in our data, but simply an item, that sequentially
 * belongs at the end despite skipping over other items of data.  Paging should not be from this new item, but
 * only the last item pulled via this query from the database.
 *
 * @type {string}
 */
Query.prototype._nextDBFromId = '';

Query._supportedEvents = [
/**
 * The query data has changed; any change event will cause this event to trigger.
 * @event change
 */
'change',

/**
 * A new page of data has been loaded from the server
 * @event 'change:data'
 */
'change:data',

/**
 * All data for this query has been reset due to a change in the Query predicate.
 * @event 'change:reset'
 */
'change:reset',

/**
 * An item of data within this Query has had a property change its value.
 * @event 'change:property'
 */
'change:property',

/**
 * A new item of data has been inserted into the Query. Not triggered by loading
 * a new page of data from the server, but is triggered by locally creating a matching
 * item of data, or receiving a new item of data via websocket.
 * @event 'change:insert'
 */
'change:insert',

/**
 * An item of data has been removed from the Query. Not triggered for every removal, but
 * is triggered by locally deleting a result, or receiving a report of deletion via websocket.
 * @event 'change:remove'
 */
'change:remove',

/**
 * The query data failed to load from the server.
 * @event error
 */
'error'].concat(Root._supportedEvents);

Root.initClass.apply(Query, [Query, 'Query']);

module.exports = Query;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9xdWVyeS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBdU1BLElBQU0sT0FBTyxRQUFRLFFBQVIsQ0FBYjtBQUNBLElBQU0sYUFBYSxRQUFRLGVBQVIsQ0FBbkI7QUFDQSxJQUFNLE9BQU8sUUFBUSxnQkFBUixDQUFiO0FBQ0EsSUFBTSxTQUFTLFFBQVEsVUFBUixDQUFmOztlQUN1QixRQUFRLFNBQVIsQzs7SUFBZixVLFlBQUEsVTs7O0FBRVIsSUFBTSxlQUFlLGNBQXJCO0FBQ0EsSUFBTSxVQUFVLFNBQWhCO0FBQ0EsSUFBTSxlQUFlLGNBQXJCO0FBQ0EsSUFBTSxXQUFXLFVBQWpCO0FBQ0EsSUFBTSxrQkFBa0IsSUFBSSxNQUFKLENBQ3RCLDJGQURzQixDQUF4Qjs7SUFHTSxLOzs7QUFFSixtQkFBcUI7QUFBQTs7QUFDbkIsUUFBSSxnQkFBSjs7QUFEbUIsc0NBQU4sSUFBTTtBQUFOLFVBQU07QUFBQTs7QUFFbkIsUUFBSSxLQUFLLE1BQUwsS0FBZ0IsQ0FBcEIsRUFBdUI7QUFDckIsZ0JBQVUsS0FBSyxDQUFMLEVBQVEsS0FBUixFQUFWO0FBQ0EsY0FBUSxNQUFSLEdBQWlCLEtBQUssQ0FBTCxDQUFqQjtBQUNELEtBSEQsTUFHTztBQUNMLGdCQUFVLEtBQUssQ0FBTCxDQUFWO0FBQ0Q7O0FBUGtCLHlGQVNiLE9BVGE7O0FBVW5CLFVBQUssU0FBTCxHQUFpQixNQUFLLGFBQUwsQ0FBbUIsUUFBUSxTQUFSLElBQXFCLEVBQXhDLENBQWpCOztBQUVB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QixDQThDaEIsS0FBSyxnQkE5Q1csQ0FBekI7O0FBZ0RBLEtBQUssU0FBTCxDQUFlLEtBQWYsQ0FBcUIsS0FBckIsRUFBNEIsQ0FBQyxLQUFELEVBQVEsT0FBUixDQUE1Qjs7QUFFQSxPQUFPLE9BQVAsR0FBaUIsS0FBakIiLCJmaWxlIjoicXVlcnkuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRoZXJlIGFyZSB0d28gd2F5cyB0byBpbnN0YW50aWF0ZSB0aGlzIGNsYXNzOlxuICpcbiAqICAgICAgLy8gMS4gVXNpbmcgYSBRdWVyeSBCdWlsZGVyXG4gKiAgICAgIHZhciBxdWVyeUJ1aWxkZXIgPSBRdWVyeUJ1aWxkZXIuY29udmVyc2F0aW9ucygpLnNvcnRCeSgnbGFzdE1lc3NhZ2UnKTtcbiAqICAgICAgdmFyIHF1ZXJ5ID0gY2xpZW50LmNyZWF0ZVF1ZXJ5KHF1ZXJ5QnVpbGRlcik7XG4gKlxuICogICAgICAvLyAyLiBQYXNzaW5nIHByb3BlcnRpZXMgZGlyZWN0bHlcbiAqICAgICAgdmFyIHF1ZXJ5ID0gY2xpZW50LmNyZWF0ZVF1ZXJ5KHtcbiAqICAgICAgICBjbGllbnQ6IGNsaWVudCxcbiAqICAgICAgICBtb2RlbDogbGF5ZXIuUXVlcnkuQ29udmVyc2F0aW9uLFxuICogICAgICAgIHNvcnRCeTogW3snY3JlYXRlZEF0JzogJ2Rlc2MnfV1cbiAqICAgICAgfSk7XG4gKlxuICogWW91IGNhbiBjaGFuZ2UgdGhlIGRhdGEgc2VsZWN0ZWQgYnkgeW91ciBxdWVyeSBhbnkgdGltZSB5b3Ugd2FudCB1c2luZzpcbiAqXG4gKiAgICAgIHF1ZXJ5LnVwZGF0ZSh7XG4gKiAgICAgICAgcGFnaW5hdGlvbldpbmRvdzogMjAwXG4gKiAgICAgIH0pO1xuICpcbiAqICAgICAgcXVlcnkudXBkYXRlKHtcbiAqICAgICAgICBwcmVkaWNhdGU6ICdjb252ZXJzYXRpb24uaWQgPSBcIicgKyBjb252LmlkICsgXCInXCJcbiAqICAgICAgfSk7XG4gKlxuICogICAgIC8vIE9yIHVzZSB0aGUgUXVlcnkgQnVpbGRlcjpcbiAqICAgICBxdWVyeUJ1aWxkZXIucGFnaW5hdGlvbldpbmRvdygyMDApO1xuICogICAgIHF1ZXJ5LnVwZGF0ZShxdWVyeUJ1aWxkZXIpO1xuICpcbiAqIFlvdSBjYW4gcmVsZWFzZSBDb252ZXJzYXRpb25zIGFuZCBNZXNzYWdlcyBoZWxkIGluIG1lbW9yeSBieSB5b3VyIHF1ZXJpZXMgd2hlbiBkb25lIHdpdGggdGhlbTpcbiAqXG4gKiAgICAgIHF1ZXJ5LmRlc3Ryb3koKTtcbiAqXG4gKiAjIyMjIHByZWRpY2F0ZVxuICpcbiAqIE5vdGUgdGhhdCB0aGUgYHByZWRpY2F0ZWAgcHJvcGVydHkgaXMgb25seSBzdXBwb3J0ZWQgZm9yIE1lc3NhZ2VzLCBhbmQgb25seSBzdXBwb3J0c1xuICogcXVlcnlpbmcgYnkgQ29udmVyc2F0aW9uOiBgY29udmVyc2F0aW9uLmlkID0gJ2xheWVyOi8vL2NvbnZlcnNhdGlvbnMvVVVJVUQnYFxuICpcbiAqICMjIyMgc29ydEJ5XG4gKlxuICogTm90ZSB0aGF0IHRoZSBgc29ydEJ5YCBwcm9wZXJ0eSBpcyBvbmx5IHN1cHBvcnRlZCBmb3IgQ29udmVyc2F0aW9ucyBhdCB0aGlzIHRpbWUgYW5kIG9ubHlcbiAqIHN1cHBvcnRzIFwiY3JlYXRlZEF0XCIgYW5kIFwibGFzdE1lc3NhZ2Uuc2VudEF0XCIgYXMgc29ydCBmaWVsZHMuXG4gKlxuICogIyMjIyBkYXRhVHlwZVxuICpcbiAqIFRoZSBsYXllci5RdWVyeS5kYXRhVHlwZSBwcm9wZXJ0eSBsZXRzIHlvdSBzcGVjaWZ5IHdoYXQgdHlwZSBvZiBkYXRhIHNob3dzIHVwIGluIHlvdXIgcmVzdWx0czpcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiB2YXIgcXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkoe1xuICogICAgIG1vZGVsOiBsYXllci5RdWVyeS5NZXNzYWdlLFxuICogICAgIHByZWRpY2F0ZTogXCJjb252ZXJzYXRpb24uaWQgPSAnbGF5ZXI6Ly8vY29udmVyc2F0aW9ucy91dWlkJ1wiLFxuICogICAgIGRhdGFUeXBlOiBsYXllci5RdWVyeS5JbnN0YW5jZURhdGFUeXBlXG4gKiB9KVxuICpcbiAqIHZhciBxdWVyeSA9IGNsaWVudC5jcmVhdGVRdWVyeSh7XG4gKiAgICAgbW9kZWw6IGxheWVyLlF1ZXJ5Lk1lc3NhZ2UsXG4gKiAgICAgcHJlZGljYXRlOiBcImNvbnZlcnNhdGlvbi5pZCA9ICdsYXllcjovLy9jb252ZXJzYXRpb25zL3V1aWQnXCIsXG4gKiAgICAgZGF0YVR5cGU6IGxheWVyLlF1ZXJ5Lk9iamVjdERhdGFUeXBlXG4gKiB9KVxuICogYGBgXG4gKlxuICogVGhlIHByb3BlcnR5IGRlZmF1bHRzIHRvIGxheWVyLlF1ZXJ5Lkluc3RhbmNlRGF0YVR5cGUuICBJbnN0YW5jZXMgc3VwcG9ydCBtZXRob2RzIGFuZCBsZXQgeW91IHN1YnNjcmliZSB0byBldmVudHMgZm9yIGRpcmVjdCBub3RpZmljYXRpb25cbiAqIG9mIGNoYW5nZXMgdG8gYW55IG9mIHRoZSByZXN1bHRzIG9mIHlvdXIgcXVlcnk6XG4gKlxuKiBgYGBqYXZhc2NyaXB0XG4gKiBxdWVyeS5kYXRhWzBdLm9uKCdtZXNzYWdlczpjaGFuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAqICAgICBhbGVydCgnVGhlIGZpcnN0IG1lc3NhZ2UgaGFzIGhhZCBhIHByb3BlcnR5IGNoYW5nZTsgcHJvYmFibHkgaXNSZWFkIG9yIHJlY2lwaWVudF9zdGF0dXMhJyk7XG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqIEEgdmFsdWUgb2YgbGF5ZXIuUXVlcnkuT2JqZWN0RGF0YVR5cGUgd2lsbCBjYXVzZSB0aGUgZGF0YSB0byBiZSBhbiBhcnJheSBvZiBpbW11dGFibGUgb2JqZWN0cyByYXRoZXIgdGhhbiBpbnN0YW5jZXMuICBPbmUgY2FuIHN0aWxsIGdldCBhbiBpbnN0YW5jZSBmcm9tIHRoZSBQT0pPOlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIHZhciBtID0gY2xpZW50LmdldE1lc3NhZ2UocXVlcnkuZGF0YVswXS5pZCk7XG4gKiBtLm9uKCdtZXNzYWdlczpjaGFuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAqICAgICBhbGVydCgnVGhlIGZpcnN0IG1lc3NhZ2UgaGFzIGhhZCBhIHByb3BlcnR5IGNoYW5nZTsgcHJvYmFibHkgaXNSZWFkIG9yIHJlY2lwaWVudF9zdGF0dXMhJyk7XG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqICMjIFF1ZXJ5IEV2ZW50c1xuICpcbiAqIFF1ZXJpZXMgZmlyZSBldmVudHMgd2hlbmV2ZXIgdGhlaXIgZGF0YSBjaGFuZ2VzLiAgVGhlcmUgYXJlIDUgdHlwZXMgb2YgZXZlbnRzO1xuICogYWxsIGV2ZW50cyBhcmUgcmVjZWl2ZWQgYnkgc3Vic2NyaWJpbmcgdG8gdGhlIGBjaGFuZ2VgIGV2ZW50LlxuICpcbiAqICMjIyAxLiBEYXRhIEV2ZW50c1xuICpcbiAqIFRoZSBEYXRhIGV2ZW50IGlzIGZpcmVkIHdoZW5ldmVyIGEgcmVxdWVzdCBpcyBzZW50IHRvIHRoZSBzZXJ2ZXIgZm9yIG5ldyBxdWVyeSByZXN1bHRzLiAgVGhpcyBjb3VsZCBoYXBwZW4gd2hlbiBmaXJzdCBjcmVhdGluZyB0aGUgcXVlcnksIHdoZW4gcGFnaW5nIGZvciBtb3JlIGRhdGEsIG9yIHdoZW4gY2hhbmdpbmcgdGhlIHF1ZXJ5J3MgcHJvcGVydGllcywgcmVzdWx0aW5nIGluIGEgbmV3IHJlcXVlc3QgdG8gdGhlIHNlcnZlci5cbiAqXG4gKiBUaGUgRXZlbnQgb2JqZWN0IHdpbGwgaGF2ZSBhbiBgZXZ0LmRhdGFgIGFycmF5IG9mIGFsbCBuZXdseSBhZGRlZCByZXN1bHRzLiAgQnV0IGZyZXF1ZW50bHkgeW91IG1heSBqdXN0IHdhbnQgdG8gdXNlIHRoZSBgcXVlcnkuZGF0YWAgYXJyYXkgYW5kIGdldCBBTEwgcmVzdWx0cy5cbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiBxdWVyeS5vbignY2hhbmdlJywgZnVuY3Rpb24oZXZ0KSB7XG4gKiAgIGlmIChldnQudHlwZSA9PT0gJ2RhdGEnKSB7XG4gKiAgICAgIHZhciBuZXdEYXRhID0gZXZ0LmRhdGE7XG4gKiAgICAgIHZhciBhbGxEYXRhID0gcXVlcnkuZGF0YTtcbiAqICAgfVxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBOb3RlIHRoYXQgYHF1ZXJ5Lm9uKCdjaGFuZ2U6ZGF0YScsIGZ1bmN0aW9uKGV2dCkge31gIGlzIGFsc28gc3VwcG9ydGVkLlxuICpcbiAqICMjIyAyLiBJbnNlcnQgRXZlbnRzXG4gKlxuICogQSBuZXcgQ29udmVyc2F0aW9uIG9yIE1lc3NhZ2Ugd2FzIGNyZWF0ZWQuIEl0IG1heSBoYXZlIGJlZW4gY3JlYXRlZCBsb2NhbGx5IGJ5IHlvdXIgdXNlciwgb3IgaXQgbWF5IGhhdmUgYmVlbiByZW1vdGVseSBjcmVhdGVkLCByZWNlaXZlZCB2aWEgd2Vic29ja2V0LCBhbmQgYWRkZWQgdG8gdGhlIFF1ZXJ5J3MgcmVzdWx0cy5cbiAqXG4gKiBUaGUgbGF5ZXIuTGF5ZXJFdmVudC50YXJnZXQgcHJvcGVydHkgY29udGFpbnMgdGhlIG5ld2x5IGluc2VydGVkIG9iamVjdC5cbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiAgcXVlcnkub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICogICAgaWYgKGV2dC50eXBlID09PSAnaW5zZXJ0Jykge1xuICogICAgICAgdmFyIG5ld0l0ZW0gPSBldnQudGFyZ2V0O1xuICogICAgICAgdmFyIGFsbERhdGEgPSBxdWVyeS5kYXRhO1xuICogICAgfVxuICogIH0pO1xuICogYGBgXG4gKlxuICogTm90ZSB0aGF0IGBxdWVyeS5vbignY2hhbmdlOmluc2VydCcsIGZ1bmN0aW9uKGV2dCkge31gIGlzIGFsc28gc3VwcG9ydGVkLlxuICpcbiAqICMjIyAzLiBSZW1vdmUgRXZlbnRzXG4gKlxuICogQSBDb252ZXJzYXRpb24gb3IgTWVzc2FnZSB3YXMgZGVsZXRlZC4gVGhpcyBtYXkgaGF2ZSBiZWVuIGRlbGV0ZWQgbG9jYWxseSBieSB5b3VyIHVzZXIsIG9yIGl0IG1heSBoYXZlIGJlZW4gcmVtb3RlbHkgZGVsZXRlZCwgYSBub3RpZmljYXRpb24gcmVjZWl2ZWQgdmlhIHdlYnNvY2tldCwgYW5kIHJlbW92ZWQgZnJvbSB0aGUgUXVlcnkgcmVzdWx0cy5cbiAqXG4gKiBUaGUgbGF5ZXIuTGF5ZXJFdmVudC50YXJnZXQgcHJvcGVydHkgY29udGFpbnMgdGhlIHJlbW92ZWQgb2JqZWN0LlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIHF1ZXJ5Lm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAqICAgaWYgKGV2dC50eXBlID09PSAncmVtb3ZlJykge1xuICogICAgICAgdmFyIHJlbW92ZWRJdGVtID0gZXZ0LnRhcmdldDtcbiAqICAgICAgIHZhciBhbGxEYXRhID0gcXVlcnkuZGF0YTtcbiAqICAgfVxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBOb3RlIHRoYXQgYHF1ZXJ5Lm9uKCdjaGFuZ2U6cmVtb3ZlJywgZnVuY3Rpb24oZXZ0KSB7fWAgaXMgYWxzbyBzdXBwb3J0ZWQuXG4gKlxuICogIyMjIDQuIFJlc2V0IEV2ZW50c1xuICpcbiAqIEFueSB0aW1lIHlvdXIgcXVlcnkncyBtb2RlbCBvciBwcmVkaWNhdGUgcHJvcGVydGllcyBoYXZlIGJlZW4gY2hhbmdlZFxuICogdGhlIHF1ZXJ5IGlzIHJlc2V0LCBhbmQgYSBuZXcgcmVxdWVzdCBpcyBzZW50IHRvIHRoZSBzZXJ2ZXIuICBUaGUgcmVzZXQgZXZlbnQgaW5mb3JtcyB5b3VyIFVJIHRoYXQgdGhlIGN1cnJlbnQgcmVzdWx0IHNldCBpcyBlbXB0eSwgYW5kIHRoYXQgdGhlIHJlYXNvbiBpdHMgZW1wdHkgaXMgdGhhdCBpdCB3YXMgYHJlc2V0YC4gIFRoaXMgaGVscHMgZGlmZmVyZW50aWF0ZSBpdCBmcm9tIGEgYGRhdGFgIGV2ZW50IHRoYXQgcmV0dXJucyBhbiBlbXB0eSBhcnJheS5cbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiBxdWVyeS5vbignY2hhbmdlJywgZnVuY3Rpb24oZXZ0KSB7XG4gKiAgIGlmIChldnQudHlwZSA9PT0gJ3Jlc2V0Jykge1xuICogICAgICAgdmFyIGFsbERhdGEgPSBxdWVyeS5kYXRhOyAvLyBbXVxuICogICB9XG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqIE5vdGUgdGhhdCBgcXVlcnkub24oJ2NoYW5nZTpyZXNldCcsIGZ1bmN0aW9uKGV2dCkge31gIGlzIGFsc28gc3VwcG9ydGVkLlxuICpcbiAqICMjIyA1LiBQcm9wZXJ0eSBFdmVudHNcbiAqXG4gKiBJZiBhbnkgcHJvcGVydGllcyBjaGFuZ2UgaW4gYW55IG9mIHRoZSBvYmplY3RzIGxpc3RlZCBpbiB5b3VyIGxheWVyLlF1ZXJ5LmRhdGEgcHJvcGVydHksIGEgYHByb3BlcnR5YCBldmVudCB3aWxsIGJlIGZpcmVkLlxuICpcbiAqIFRoZSBsYXllci5MYXllckV2ZW50LnRhcmdldCBwcm9wZXJ0eSBjb250YWlucyBvYmplY3QgdGhhdCB3YXMgbW9kaWZpZWQuXG4gKlxuICogU2VlIGxheWVyLkxheWVyRXZlbnQuY2hhbmdlcyBmb3IgZGV0YWlscyBvbiBob3cgY2hhbmdlcyBhcmUgcmVwb3J0ZWQuXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogcXVlcnkub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICogICBpZiAoZXZ0LnR5cGUgPT09ICdwcm9wZXJ0eScpIHtcbiAqICAgICAgIHZhciBjaGFuZ2VkSXRlbSA9IGV2dC50YXJnZXQ7XG4gKiAgICAgICB2YXIgaXNSZWFkQ2hhbmdlcyA9IGV2dC5nZXRDaGFuZ2VzRm9yKCdpc1JlYWQnKTtcbiAqICAgICAgIHZhciByZWNpcGllbnRTdGF0dXNDaGFuZ2VzID0gZXZ0LmdldENoYW5nZXNGb3IoJ3JlY2lwaWVudFN0YXR1cycpO1xuICogICAgICAgaWYgKGlzUmVhZENoYW5nZXMubGVuZ3RoKSB7XG4gKiAgICAgICAgICAgLi4uXG4gKiAgICAgICB9XG4gKlxuICogICAgICAgaWYgKHJlY2lwaWVudFN0YXR1c0NoYW5nZXMubGVuZ3RoKSB7XG4gKiAgICAgICAgICAgLi4uXG4gKiAgICAgICB9XG4gKiAgIH1cbiAqIH0pO1xuICpgYGBcbiAqIE5vdGUgdGhhdCBgcXVlcnkub24oJ2NoYW5nZTpwcm9wZXJ0eScsIGZ1bmN0aW9uKGV2dCkge31gIGlzIGFsc28gc3VwcG9ydGVkLlxuICpcbiAqICMjIyA2LiBNb3ZlIEV2ZW50c1xuICpcbiAqIE9jY2FzaW9uYWxseSwgYSBwcm9wZXJ0eSBjaGFuZ2Ugd2lsbCBjYXVzZSBhbiBpdGVtIHRvIGJlIHNvcnRlZCBkaWZmZXJlbnRseSwgY2F1c2luZyBhIE1vdmUgZXZlbnQuXG4gKiBUaGUgZXZlbnQgd2lsbCB0ZWxsIHlvdSB3aGF0IGluZGV4IHRoZSBpdGVtIHdhcyBhdCwgYW5kIHdoZXJlIGl0IGhhcyBtb3ZlZCB0byBpbiB0aGUgUXVlcnkgcmVzdWx0cy5cbiAqIFRoaXMgaXMgY3VycmVudGx5IG9ubHkgc3VwcG9ydGVkIGZvciBDb252ZXJzYXRpb25zLlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIHF1ZXJ5Lm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAqICAgaWYgKGV2dC50eXBlID09PSAnbW92ZScpIHtcbiAqICAgICAgIHZhciBjaGFuZ2VkSXRlbSA9IGV2dC50YXJnZXQ7XG4gKiAgICAgICB2YXIgb2xkSW5kZXggPSBldnQuZnJvbUluZGV4O1xuICogICAgICAgdmFyIG5ld0luZGV4ID0gZXZ0Lm5ld0luZGV4O1xuICogICAgICAgdmFyIG1vdmVOb2RlID0gbGlzdC5jaGlsZE5vZGVzW29sZEluZGV4XTtcbiAqICAgICAgIGxpc3QucmVtb3ZlQ2hpbGQobW92ZU5vZGUpO1xuICogICAgICAgbGlzdC5pbnNlcnRCZWZvcmUobW92ZU5vZGUsIGxpc3QuY2hpbGROb2Rlc1tuZXdJbmRleF0pO1xuICogICB9XG4gKiB9KTtcbiAqYGBgXG4gKiBOb3RlIHRoYXQgYHF1ZXJ5Lm9uKCdjaGFuZ2U6bW92ZScsIGZ1bmN0aW9uKGV2dCkge31gIGlzIGFsc28gc3VwcG9ydGVkLlxuICpcbiAqIEBjbGFzcyAgbGF5ZXIuUXVlcnlcbiAqIEBleHRlbmRzIGxheWVyLlJvb3RcbiAqXG4gKi9cbmNvbnN0IFJvb3QgPSByZXF1aXJlKCcuL3Jvb3QnKTtcbmNvbnN0IExheWVyRXJyb3IgPSByZXF1aXJlKCcuL2xheWVyLWVycm9yJyk7XG5jb25zdCBVdGlsID0gcmVxdWlyZSgnLi9jbGllbnQtdXRpbHMnKTtcbmNvbnN0IExvZ2dlciA9IHJlcXVpcmUoJy4vbG9nZ2VyJyk7XG5jb25zdCB7IFNZTkNfU1RBVEUgfSA9IHJlcXVpcmUoJy4vY29uc3QnKTtcblxuY29uc3QgQ09OVkVSU0FUSU9OID0gJ0NvbnZlcnNhdGlvbic7XG5jb25zdCBNRVNTQUdFID0gJ01lc3NhZ2UnO1xuY29uc3QgQU5OT1VOQ0VNRU5UID0gJ0Fubm91bmNlbWVudCc7XG5jb25zdCBJREVOVElUWSA9ICdJZGVudGl0eSc7XG5jb25zdCBmaW5kQ29udklkUmVnZXggPSBuZXcgUmVnRXhwKFxuICAvXmNvbnZlcnNhdGlvbi5pZFxccyo9XFxzKlsnXCJdKChsYXllcjpcXC9cXC9cXC9jb252ZXJzYXRpb25zXFwvKT8uezh9LS57NH0tLns0fS0uezR9LS57MTJ9KVsnXCJdJC8pO1xuXG5jbGFzcyBRdWVyeSBleHRlbmRzIFJvb3Qge1xuXG4gIGNvbnN0cnVjdG9yKC4uLmFyZ3MpIHtcbiAgICBsZXQgb3B0aW9ucztcbiAgICBpZiAoYXJncy5sZW5ndGggPT09IDIpIHtcbiAgICAgIG9wdGlvbnMgPSBhcmdzWzFdLmJ1aWxkKCk7XG4gICAgICBvcHRpb25zLmNsaWVudCA9IGFyZ3NbMF07XG4gICAgfSBlbHNlIHtcbiAgICAgIG9wdGlvbnMgPSBhcmdzWzBdO1xuICAgIH1cblxuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMucHJlZGljYXRlID0gdGhpcy5fZml4UHJlZGljYXRlKG9wdGlvbnMucHJlZGljYXRlIHx8ICcnKTtcblxuICAgIGlmICgncGFnaW5hdGlvbldpbmRvdycgaW4gb3B0aW9ucykge1xuICAgICAgY29uc3QgcGFnaW5hdGlvbldpbmRvdyA9IG9wdGlvbnMucGFnaW5hdGlvbldpbmRvdztcbiAgICAgIHRoaXMucGFnaW5hdGlvbldpbmRvdyA9IE1hdGgubWluKHRoaXMuX2dldE1heFBhZ2VTaXplKCksIG9wdGlvbnMucGFnaW5hdGlvbldpbmRvdyk7XG4gICAgICBpZiAob3B0aW9ucy5wYWdpbmF0aW9uV2luZG93ICE9PSBwYWdpbmF0aW9uV2luZG93KSB7XG4gICAgICAgIExvZ2dlci53YXJuKGBwYWdpbmF0aW9uV2luZG93IHZhbHVlICR7cGFnaW5hdGlvbldpbmRvd30gaW4gUXVlcnkgY29uc3RydWN0b3IgYCArXG4gICAgICAgICAgYGV4Y2VkZXMgUXVlcnkuTWF4UGFnZVNpemUgb2YgJHt0aGlzLl9nZXRNYXhQYWdlU2l6ZSgpfWApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuZGF0YSA9IFtdO1xuICAgIHRoaXMuX2luaXRpYWxQYWdpbmF0aW9uV2luZG93ID0gdGhpcy5wYWdpbmF0aW9uV2luZG93O1xuICAgIGlmICghdGhpcy5jbGllbnQpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuY2xpZW50TWlzc2luZyk7XG4gICAgdGhpcy5jbGllbnQub24oJ2FsbCcsIHRoaXMuX2hhbmRsZUNoYW5nZUV2ZW50cywgdGhpcyk7XG5cbiAgICBpZiAoIXRoaXMuY2xpZW50LmlzUmVhZHkpIHtcbiAgICAgIHRoaXMuY2xpZW50Lm9uY2UoJ3JlYWR5JywgKCkgPT4gdGhpcy5fcnVuKCksIHRoaXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9ydW4oKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2xlYW51cCBhbmQgcmVtb3ZlIHRoaXMgUXVlcnksIGl0cyBzdWJzY3JpcHRpb25zIGFuZCBkYXRhLlxuICAgKlxuICAgKiBAbWV0aG9kIGRlc3Ryb3lcbiAgICovXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5kYXRhID0gW107XG4gICAgdGhpcy5fdHJpZ2dlckNoYW5nZSh7XG4gICAgICB0eXBlOiAnZGF0YScsXG4gICAgICB0YXJnZXQ6IHRoaXMuY2xpZW50LFxuICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICBpc0NoYW5nZTogZmFsc2UsXG4gICAgICBkYXRhOiBbXSxcbiAgICB9KTtcbiAgICB0aGlzLmNsaWVudC5vZmYobnVsbCwgbnVsbCwgdGhpcyk7XG4gICAgdGhpcy5jbGllbnQuX3JlbW92ZVF1ZXJ5KHRoaXMpO1xuICAgIHRoaXMuZGF0YSA9IG51bGw7XG4gICAgc3VwZXIuZGVzdHJveSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgbWF4aW11bSBudW1iZXIgb2YgaXRlbXMgYWxsb3dlZCBpbiBhIHBhZ2VcbiAgICpcbiAgICogQG1ldGhvZCBfZ2V0TWF4UGFnZVNpemVcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybnMge251bWJlcn1cbiAgICovXG4gIF9nZXRNYXhQYWdlU2l6ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbCA9PT0gUXVlcnkuSWRlbnRpdHkgPyBRdWVyeS5NYXhQYWdlU2l6ZUlkZW50aXR5IDogUXVlcnkuTWF4UGFnZVNpemU7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlcyBwcm9wZXJ0aWVzIG9mIHRoZSBRdWVyeS5cbiAgICpcbiAgICogQ3VycmVudGx5IHN1cHBvcnRzIHVwZGF0aW5nOlxuICAgKlxuICAgKiAqIHBhZ2luYXRpb25XaW5kb3dcbiAgICogKiBwcmVkaWNhdGVcbiAgICogKiBtb2RlbFxuICAgKlxuICAgKiBBbnkgY2hhbmdlIHRvIHByZWRpY2F0ZSBvciBtb2RlbCByZXN1bHRzIGluIGNsZWFyaW5nIGFsbCBkYXRhIGZyb20gdGhlXG4gICAqIHF1ZXJ5J3MgcmVzdWx0cyBhbmQgdHJpZ2dlcmluZyBhIGNoYW5nZSBldmVudCB3aXRoIFtdIGFzIHRoZSBuZXcgZGF0YS5cbiAgICpcbiAgICogQG1ldGhvZCB1cGRhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5wcmVkaWNhdGVdIC0gQSBuZXcgcHJlZGljYXRlIGZvciB0aGUgcXVlcnlcbiAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLm1vZGVsXSAtIEEgbmV3IG1vZGVsIGZvciB0aGUgUXVlcnlcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtwYWdpbmF0aW9uV2luZG93XSAtIEluY3JlYXNlL2RlY3JlYXNlIG91ciByZXN1bHQgc2l6ZSB0byBtYXRjaCB0aGlzIHBhZ2luYXRpb24gd2luZG93LlxuICAgKiBAcmV0dXJuIHtsYXllci5RdWVyeX0gdGhpc1xuICAgKi9cbiAgdXBkYXRlKG9wdGlvbnMgPSB7fSkge1xuICAgIGxldCBuZWVkc1JlZnJlc2gsXG4gICAgICBuZWVkc1JlY3JlYXRlO1xuXG4gICAgY29uc3Qgb3B0aW9uc0J1aWx0ID0gKHR5cGVvZiBvcHRpb25zLmJ1aWxkID09PSAnZnVuY3Rpb24nKSA/IG9wdGlvbnMuYnVpbGQoKSA6IG9wdGlvbnM7XG5cbiAgICBpZiAoJ3BhZ2luYXRpb25XaW5kb3cnIGluIG9wdGlvbnNCdWlsdCAmJiB0aGlzLnBhZ2luYXRpb25XaW5kb3cgIT09IG9wdGlvbnNCdWlsdC5wYWdpbmF0aW9uV2luZG93KSB7XG4gICAgICB0aGlzLnBhZ2luYXRpb25XaW5kb3cgPSBNYXRoLm1pbih0aGlzLl9nZXRNYXhQYWdlU2l6ZSgpICsgdGhpcy5zaXplLCBvcHRpb25zQnVpbHQucGFnaW5hdGlvbldpbmRvdyk7XG4gICAgICBpZiAodGhpcy5wYWdpbmF0aW9uV2luZG93IDwgb3B0aW9uc0J1aWx0LnBhZ2luYXRpb25XaW5kb3cpIHtcbiAgICAgICAgTG9nZ2VyLndhcm4oYHBhZ2luYXRpb25XaW5kb3cgdmFsdWUgJHtvcHRpb25zQnVpbHQucGFnaW5hdGlvbldpbmRvd30gaW4gUXVlcnkudXBkYXRlKCkgYCArXG4gICAgICAgICAgYGluY3JlYXNlcyBzaXplIGdyZWF0ZXIgdGhhbiBRdWVyeS5NYXhQYWdlU2l6ZSBvZiAke3RoaXMuX2dldE1heFBhZ2VTaXplKCl9YCk7XG4gICAgICB9XG4gICAgICBuZWVkc1JlZnJlc2ggPSB0cnVlO1xuICAgIH1cbiAgICBpZiAoJ21vZGVsJyBpbiBvcHRpb25zQnVpbHQgJiYgdGhpcy5tb2RlbCAhPT0gb3B0aW9uc0J1aWx0Lm1vZGVsKSB7XG4gICAgICB0aGlzLm1vZGVsID0gb3B0aW9uc0J1aWx0Lm1vZGVsO1xuICAgICAgbmVlZHNSZWNyZWF0ZSA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKCdwcmVkaWNhdGUnIGluIG9wdGlvbnNCdWlsdCkge1xuICAgICAgY29uc3QgcHJlZGljYXRlID0gdGhpcy5fZml4UHJlZGljYXRlKG9wdGlvbnNCdWlsdC5wcmVkaWNhdGUgfHwgJycpO1xuICAgICAgaWYgKHRoaXMucHJlZGljYXRlICE9PSBwcmVkaWNhdGUpIHtcbiAgICAgICAgdGhpcy5wcmVkaWNhdGUgPSBwcmVkaWNhdGU7XG4gICAgICAgIG5lZWRzUmVjcmVhdGUgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoJ3NvcnRCeScgaW4gb3B0aW9uc0J1aWx0ICYmIEpTT04uc3RyaW5naWZ5KHRoaXMuc29ydEJ5KSAhPT0gSlNPTi5zdHJpbmdpZnkob3B0aW9uc0J1aWx0LnNvcnRCeSkpIHtcbiAgICAgIHRoaXMuc29ydEJ5ID0gb3B0aW9uc0J1aWx0LnNvcnRCeTtcbiAgICAgIG5lZWRzUmVjcmVhdGUgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAobmVlZHNSZWNyZWF0ZSkge1xuICAgICAgdGhpcy5fcmVzZXQoKTtcbiAgICB9XG4gICAgaWYgKG5lZWRzUmVjcmVhdGUgfHwgbmVlZHNSZWZyZXNoKSB0aGlzLl9ydW4oKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBOb3JtYWxpemVzIHRoZSBwcmVkaWNhdGUuXG4gICAqXG4gICAqIEBtZXRob2QgX2ZpeFByZWRpY2F0ZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gaW5WYWx1ZVxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2ZpeFByZWRpY2F0ZShpblZhbHVlKSB7XG4gICAgaWYgKGluVmFsdWUgPT09ICcnKSByZXR1cm4gJyc7XG4gICAgaWYgKHRoaXMubW9kZWwgPT09IFF1ZXJ5Lk1lc3NhZ2UpIHtcbiAgICAgIGxldCBjb252ZXJzYXRpb25JZCA9IGluVmFsdWUubWF0Y2goZmluZENvbnZJZFJlZ2V4KSA/IGluVmFsdWUucmVwbGFjZShmaW5kQ29udklkUmVnZXgsICckMScpIDogbnVsbDtcbiAgICAgIGlmICghY29udmVyc2F0aW9uSWQpIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkuaW52YWxpZFByZWRpY2F0ZSk7XG4gICAgICBpZiAoY29udmVyc2F0aW9uSWQuaW5kZXhPZignbGF5ZXI6Ly8vY29udmVyc2F0aW9ucy8nKSAhPT0gMCkgY29udmVyc2F0aW9uSWQgPSAnbGF5ZXI6Ly8vY29udmVyc2F0aW9ucy8nICsgY29udmVyc2F0aW9uSWQ7XG4gICAgICByZXR1cm4gYGNvbnZlcnNhdGlvbi5pZCA9ICcke2NvbnZlcnNhdGlvbklkfSdgO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LnByZWRpY2F0ZU5vdFN1cHBvcnRlZCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFmdGVyIHJlZGVmaW5pbmcgdGhlIHF1ZXJ5LCByZXNldCBpdDogcmVtb3ZlIGFsbCBkYXRhL3Jlc2V0IGFsbCBzdGF0ZS5cbiAgICpcbiAgICogQG1ldGhvZCBfcmVzZXRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9yZXNldCgpIHtcbiAgICB0aGlzLnRvdGFsU2l6ZSA9IDA7XG4gICAgY29uc3QgZGF0YSA9IHRoaXMuZGF0YTtcbiAgICB0aGlzLmRhdGEgPSBbXTtcbiAgICB0aGlzLmNsaWVudC5fY2hlY2tBbmRQdXJnZUNhY2hlKGRhdGEpO1xuICAgIHRoaXMuaXNGaXJpbmcgPSBmYWxzZTtcbiAgICB0aGlzLl9wcmVkaWNhdGUgPSBudWxsO1xuICAgIHRoaXMuX25leHREQkZyb21JZCA9ICcnO1xuICAgIHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgPSAnJztcbiAgICB0aGlzLl9pc1NlcnZlclN5bmNpbmcgPSBmYWxzZTtcbiAgICB0aGlzLnBhZ2VkVG9FbmQgPSBmYWxzZTtcbiAgICB0aGlzLnBhZ2luYXRpb25XaW5kb3cgPSB0aGlzLl9pbml0aWFsUGFnaW5hdGlvbldpbmRvdztcbiAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgIGRhdGE6IFtdLFxuICAgICAgdHlwZTogJ3Jlc2V0JyxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNldCB5b3VyIHF1ZXJ5IHRvIGl0cyBpbml0aWFsIHN0YXRlIGFuZCB0aGVuIHJlcnVuIGl0LlxuICAgKlxuICAgKiBAbWV0aG9kIHJlc2V0XG4gICAqL1xuICByZXNldCgpIHtcbiAgICBpZiAodGhpcy5faXNTeW5jaW5nSWQpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9pc1N5bmNpbmdJZCk7XG4gICAgICB0aGlzLl9pc1N5bmNpbmdJZCA9IDA7XG4gICAgfVxuICAgIHRoaXMuX3Jlc2V0KCk7XG4gICAgdGhpcy5fcnVuKCk7XG4gIH1cblxuICAvKipcbiAgICogRXhlY3V0ZSB0aGUgcXVlcnkuXG4gICAqXG4gICAqIE5vLCBkb24ndCBtdXJkZXIgaXQsIGp1c3QgZmlyZSBpdC4gIE5vLCBkb24ndCBtYWtlIGl0IHVuZW1wbG95ZWQsXG4gICAqIGp1c3QgY29ubmVjdCB0byB0aGUgc2VydmVyIGFuZCBnZXQgdGhlIHJlc3VsdHMuXG4gICAqXG4gICAqIEBtZXRob2QgX3J1blxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3J1bigpIHtcbiAgICAvLyBGaW5kIHRoZSBudW1iZXIgb2YgaXRlbXMgd2UgbmVlZCB0byByZXF1ZXN0LlxuICAgIGNvbnN0IHBhZ2VTaXplID0gTWF0aC5taW4odGhpcy5wYWdpbmF0aW9uV2luZG93IC0gdGhpcy5zaXplLCB0aGlzLl9nZXRNYXhQYWdlU2l6ZSgpKTtcblxuICAgIC8vIElmIHRoZXJlIGlzIGEgcmVkdWN0aW9uIGluIHBhZ2luYXRpb24gd2luZG93LCB0aGVuIHRoaXMgdmFyaWFibGUgd2lsbCBiZSBuZWdhdGl2ZSwgYW5kIHdlIGNhbiBzaHJpbmtcbiAgICAvLyB0aGUgZGF0YS5cbiAgICBpZiAocGFnZVNpemUgPCAwKSB7XG4gICAgICBjb25zdCByZW1vdmVkRGF0YSA9IHRoaXMuZGF0YS5zbGljZSh0aGlzLnBhZ2luYXRpb25XaW5kb3cpO1xuICAgICAgdGhpcy5kYXRhID0gdGhpcy5kYXRhLnNsaWNlKDAsIHRoaXMucGFnaW5hdGlvbldpbmRvdyk7XG4gICAgICB0aGlzLmNsaWVudC5fY2hlY2tBbmRQdXJnZUNhY2hlKHJlbW92ZWREYXRhKTtcbiAgICAgIHRoaXMucGFnZWRUb0VuZCA9IGZhbHNlO1xuICAgICAgdGhpcy5fdHJpZ2dlckFzeW5jKCdjaGFuZ2UnLCB7IGRhdGE6IFtdIH0pO1xuICAgIH0gZWxzZSBpZiAocGFnZVNpemUgPT09IDAgfHwgdGhpcy5wYWdlZFRvRW5kKSB7XG4gICAgICAvLyBObyBuZWVkIHRvIGxvYWQgMCByZXN1bHRzLlxuICAgIH0gZWxzZSB7XG4gICAgICBzd2l0Y2ggKHRoaXMubW9kZWwpIHtcbiAgICAgICAgY2FzZSBDT05WRVJTQVRJT046XG4gICAgICAgICAgdGhpcy5fcnVuQ29udmVyc2F0aW9uKHBhZ2VTaXplKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBNRVNTQUdFOlxuICAgICAgICAgIGlmICh0aGlzLnByZWRpY2F0ZSkgdGhpcy5fcnVuTWVzc2FnZShwYWdlU2l6ZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQU5OT1VOQ0VNRU5UOlxuICAgICAgICAgIHRoaXMuX3J1bkFubm91bmNlbWVudChwYWdlU2l6ZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgSURFTlRJVFk6XG4gICAgICAgICAgdGhpcy5fcnVuSWRlbnRpdHkocGFnZVNpemUpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgQ29udmVyc2F0aW9ucyBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEBtZXRob2QgX3J1bkNvbnZlcnNhdGlvblxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtudW1iZXJ9IHBhZ2VTaXplIC0gTnVtYmVyIG9mIG5ldyByZXN1bHRzIHRvIHJlcXVlc3RcbiAgICovXG4gIF9ydW5Db252ZXJzYXRpb24ocGFnZVNpemUpIHtcbiAgICBjb25zdCBzb3J0QnkgPSB0aGlzLl9nZXRTb3J0RmllbGQoKTtcblxuICAgIHRoaXMuY2xpZW50LmRiTWFuYWdlci5sb2FkQ29udmVyc2F0aW9ucyhzb3J0QnksIHRoaXMuX25leHREQkZyb21JZCwgcGFnZVNpemUsIChjb252ZXJzYXRpb25zKSA9PiB7XG4gICAgICBpZiAoY29udmVyc2F0aW9ucy5sZW5ndGgpIHRoaXMuX2FwcGVuZFJlc3VsdHMoeyBkYXRhOiBjb252ZXJzYXRpb25zIH0sIHRydWUpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgbmV3UmVxdWVzdCA9IGBjb252ZXJzYXRpb25zP3NvcnRfYnk9JHtzb3J0Qnl9JnBhZ2Vfc2l6ZT0ke3BhZ2VTaXplfWAgK1xuICAgICAgKHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgPyAnJmZyb21faWQ9JyArIHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgOiAnJyk7XG5cbiAgICBpZiAobmV3UmVxdWVzdCAhPT0gdGhpcy5fZmlyaW5nUmVxdWVzdCkge1xuICAgICAgdGhpcy5pc0ZpcmluZyA9IHRydWU7XG4gICAgICB0aGlzLl9maXJpbmdSZXF1ZXN0ID0gbmV3UmVxdWVzdDtcbiAgICAgIHRoaXMuY2xpZW50Lnhocih7XG4gICAgICAgIHVybDogdGhpcy5fZmlyaW5nUmVxdWVzdCxcbiAgICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgICAgc3luYzogZmFsc2UsXG4gICAgICB9LCByZXN1bHRzID0+IHRoaXMuX3Byb2Nlc3NSdW5SZXN1bHRzKHJlc3VsdHMsIHRoaXMuX2ZpcmluZ1JlcXVlc3QsIHBhZ2VTaXplKSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIHNvcnQgZmllbGQgZm9yIHRoZSBxdWVyeS5cbiAgICpcbiAgICogUmV0dXJucyBPbmUgb2Y6XG4gICAqXG4gICAqICogJ3Bvc2l0aW9uJyAoTWVzc2FnZXMgb25seSlcbiAgICogKiAnbGFzdF9tZXNzYWdlJyAoQ29udmVyc2F0aW9ucyBvbmx5KVxuICAgKiAqICdjcmVhdGVkX2F0JyAoQ29udmVyc2F0aW9ucyBvbmx5KVxuICAgKiBAbWV0aG9kIF9nZXRTb3J0RmllbGRcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybiB7U3RyaW5nfSBzb3J0IGtleSB1c2VkIGJ5IHNlcnZlclxuICAgKi9cbiAgX2dldFNvcnRGaWVsZCgpIHtcbiAgICBpZiAodGhpcy5tb2RlbCA9PT0gTUVTU0FHRSB8fCB0aGlzLm1vZGVsID09PSBBTk5PVU5DRU1FTlQpIHJldHVybiAncG9zaXRpb24nO1xuICAgIGlmICh0aGlzLnNvcnRCeSAmJiB0aGlzLnNvcnRCeVswXSAmJiB0aGlzLnNvcnRCeVswXVsnbGFzdE1lc3NhZ2Uuc2VudEF0J10pIHJldHVybiAnbGFzdF9tZXNzYWdlJztcbiAgICByZXR1cm4gJ2NyZWF0ZWRfYXQnO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgQ29udmVyc2F0aW9uIFVVSUQgZnJvbSB0aGUgcHJlZGljYXRlIHByb3BlcnR5LlxuICAgKlxuICAgKiBFeHRyYWN0IHRoZSBDb252ZXJzYXRpb24ncyBVVUlEIGZyb20gdGhlIHByZWRpY2F0ZS4uLiBvciByZXR1cm5lZCB0aGUgY2FjaGVkIHZhbHVlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRDb252ZXJzYXRpb25QcmVkaWNhdGVJZHNcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9nZXRDb252ZXJzYXRpb25QcmVkaWNhdGVJZHMoKSB7XG4gICAgaWYgKHRoaXMucHJlZGljYXRlLm1hdGNoKGZpbmRDb252SWRSZWdleCkpIHtcbiAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbklkID0gdGhpcy5wcmVkaWNhdGUucmVwbGFjZShmaW5kQ29udklkUmVnZXgsICckMScpO1xuXG4gICAgICAvLyBXZSB3aWxsIGFscmVhZHkgaGF2ZSBhIHRoaXMuX3ByZWRpY2F0ZSBpZiB3ZSBhcmUgcGFnaW5nOyBlbHNlIHdlIG5lZWQgdG8gZXh0cmFjdCB0aGUgVVVJRCBmcm9tXG4gICAgICAvLyB0aGUgY29udmVyc2F0aW9uSWQuXG4gICAgICBjb25zdCB1dWlkID0gKHRoaXMuX3ByZWRpY2F0ZSB8fCBjb252ZXJzYXRpb25JZCkucmVwbGFjZSgvXmxheWVyOlxcL1xcL1xcL2NvbnZlcnNhdGlvbnNcXC8vLCAnJyk7XG4gICAgICBpZiAodXVpZCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHV1aWQsXG4gICAgICAgICAgaWQ6IGNvbnZlcnNhdGlvbklkLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgTWVzc2FnZXMgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBAbWV0aG9kIF9ydW5NZXNzYWdlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge251bWJlcn0gcGFnZVNpemUgLSBOdW1iZXIgb2YgbmV3IHJlc3VsdHMgdG8gcmVxdWVzdFxuICAgKi9cbiAgX3J1bk1lc3NhZ2UocGFnZVNpemUpIHtcbiAgICBjb25zdCBwcmVkaWNhdGVJZHMgPSB0aGlzLl9nZXRDb252ZXJzYXRpb25QcmVkaWNhdGVJZHMoKTtcblxuICAgIC8vIERvIG5vdGhpbmcgaWYgd2UgZG9uJ3QgaGF2ZSBhIGNvbnZlcnNhdGlvbiB0byBxdWVyeSBvblxuICAgIGlmIChwcmVkaWNhdGVJZHMpIHtcbiAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbklkID0gJ2xheWVyOi8vL2NvbnZlcnNhdGlvbnMvJyArIHByZWRpY2F0ZUlkcy51dWlkO1xuICAgICAgaWYgKCF0aGlzLl9wcmVkaWNhdGUpIHRoaXMuX3ByZWRpY2F0ZSA9IHByZWRpY2F0ZUlkcy5pZDtcbiAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHRoaXMuY2xpZW50LmdldENvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZCk7XG5cbiAgICAgIC8vIFJldHJpZXZlIGRhdGEgZnJvbSBkYiBjYWNoZSBpbiBwYXJhbGxlbCB3aXRoIGxvYWRpbmcgZGF0YSBmcm9tIHNlcnZlclxuICAgICAgdGhpcy5jbGllbnQuZGJNYW5hZ2VyLmxvYWRNZXNzYWdlcyhjb252ZXJzYXRpb25JZCwgdGhpcy5fbmV4dERCRnJvbUlkLCBwYWdlU2l6ZSwgKG1lc3NhZ2VzKSA9PiB7XG4gICAgICAgIGlmIChtZXNzYWdlcy5sZW5ndGgpIHRoaXMuX2FwcGVuZFJlc3VsdHMoeyBkYXRhOiBtZXNzYWdlcyB9LCB0cnVlKTtcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBuZXdSZXF1ZXN0ID0gYGNvbnZlcnNhdGlvbnMvJHtwcmVkaWNhdGVJZHMudXVpZH0vbWVzc2FnZXM/cGFnZV9zaXplPSR7cGFnZVNpemV9YCArXG4gICAgICAgICh0aGlzLl9uZXh0U2VydmVyRnJvbUlkID8gJyZmcm9tX2lkPScgKyB0aGlzLl9uZXh0U2VydmVyRnJvbUlkIDogJycpO1xuXG4gICAgICAvLyBEb24ndCBxdWVyeSBvbiB1bnNhdmVkIGNvbnZlcnNhdGlvbnMsIG5vciByZXBlYXQgc3RpbGwgZmlyaW5nIHF1ZXJpZXNcbiAgICAgIGlmICgoIWNvbnZlcnNhdGlvbiB8fCBjb252ZXJzYXRpb24uaXNTYXZlZCgpKSAmJiBuZXdSZXF1ZXN0ICE9PSB0aGlzLl9maXJpbmdSZXF1ZXN0KSB7XG4gICAgICAgIHRoaXMuaXNGaXJpbmcgPSB0cnVlO1xuICAgICAgICB0aGlzLl9maXJpbmdSZXF1ZXN0ID0gbmV3UmVxdWVzdDtcbiAgICAgICAgdGhpcy5jbGllbnQueGhyKHtcbiAgICAgICAgICB1cmw6IG5ld1JlcXVlc3QsXG4gICAgICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgICAgICBzeW5jOiBmYWxzZSxcbiAgICAgICAgfSwgcmVzdWx0cyA9PiB0aGlzLl9wcm9jZXNzUnVuUmVzdWx0cyhyZXN1bHRzLCBuZXdSZXF1ZXN0LCBwYWdlU2l6ZSkpO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiB0aGVyZSBhcmUgbm8gcmVzdWx0cywgdGhlbiBpdHMgYSBuZXcgcXVlcnk7IGF1dG9tYXRpY2FsbHkgcG9wdWxhdGUgaXQgd2l0aCB0aGUgQ29udmVyc2F0aW9uJ3MgbGFzdE1lc3NhZ2UuXG4gICAgICBpZiAodGhpcy5kYXRhLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBpZiAoY29udmVyc2F0aW9uICYmIGNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZSkge1xuICAgICAgICAgIHRoaXMuZGF0YSA9IFt0aGlzLl9nZXREYXRhKGNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZSldO1xuICAgICAgICAgIC8vIFRyaWdnZXIgdGhlIGNoYW5nZSBldmVudFxuICAgICAgICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgICAgICAgdHlwZTogJ2RhdGEnLFxuICAgICAgICAgICAgZGF0YTogW3RoaXMuX2dldERhdGEoY29udmVyc2F0aW9uLmxhc3RNZXNzYWdlKV0sXG4gICAgICAgICAgICBxdWVyeTogdGhpcyxcbiAgICAgICAgICAgIHRhcmdldDogdGhpcy5jbGllbnQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKCF0aGlzLnByZWRpY2F0ZS5tYXRjaCgvWydcIl0vKSkge1xuICAgICAgTG9nZ2VyLmVycm9yKCdUaGlzIHF1ZXJ5IG1heSBuZWVkIHRvIHF1b3RlIGl0cyB2YWx1ZScpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgQW5ub3VuY2VtZW50cyBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEBtZXRob2QgX3J1bkFubm91bmNlbWVudFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtudW1iZXJ9IHBhZ2VTaXplIC0gTnVtYmVyIG9mIG5ldyByZXN1bHRzIHRvIHJlcXVlc3RcbiAgICovXG4gIF9ydW5Bbm5vdW5jZW1lbnQocGFnZVNpemUpIHtcbiAgICAvLyBSZXRyaWV2ZSBkYXRhIGZyb20gZGIgY2FjaGUgaW4gcGFyYWxsZWwgd2l0aCBsb2FkaW5nIGRhdGEgZnJvbSBzZXJ2ZXJcbiAgICB0aGlzLmNsaWVudC5kYk1hbmFnZXIubG9hZEFubm91bmNlbWVudHModGhpcy5fbmV4dERCRnJvbUlkLCBwYWdlU2l6ZSwgKG1lc3NhZ2VzKSA9PiB7XG4gICAgICBpZiAobWVzc2FnZXMubGVuZ3RoKSB0aGlzLl9hcHBlbmRSZXN1bHRzKHsgZGF0YTogbWVzc2FnZXMgfSwgdHJ1ZSk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBuZXdSZXF1ZXN0ID0gYGFubm91bmNlbWVudHM/cGFnZV9zaXplPSR7cGFnZVNpemV9YCArXG4gICAgICAodGhpcy5fbmV4dFNlcnZlckZyb21JZCA/ICcmZnJvbV9pZD0nICsgdGhpcy5fbmV4dFNlcnZlckZyb21JZCA6ICcnKTtcblxuICAgIC8vIERvbid0IHJlcGVhdCBzdGlsbCBmaXJpbmcgcXVlcmllc1xuICAgIGlmIChuZXdSZXF1ZXN0ICE9PSB0aGlzLl9maXJpbmdSZXF1ZXN0KSB7XG4gICAgICB0aGlzLmlzRmlyaW5nID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2ZpcmluZ1JlcXVlc3QgPSBuZXdSZXF1ZXN0O1xuICAgICAgdGhpcy5jbGllbnQueGhyKHtcbiAgICAgICAgdXJsOiBuZXdSZXF1ZXN0LFxuICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICBzeW5jOiBmYWxzZSxcbiAgICAgIH0sIHJlc3VsdHMgPT4gdGhpcy5fcHJvY2Vzc1J1blJlc3VsdHMocmVzdWx0cywgbmV3UmVxdWVzdCwgcGFnZVNpemUpKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IElkZW50aXRpZXMgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBAbWV0aG9kIF9ydW5JZGVudGl0aWVzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge251bWJlcn0gcGFnZVNpemUgLSBOdW1iZXIgb2YgbmV3IHJlc3VsdHMgdG8gcmVxdWVzdFxuICAgKi9cbiAgX3J1bklkZW50aXR5KHBhZ2VTaXplKSB7XG4gICAgLy8gVGhlcmUgaXMgbm90IHlldCBzdXBwb3J0IGZvciBwYWdpbmcgSWRlbnRpdGllczsgIGFzIGFsbCBpZGVudGl0aWVzIGFyZSBsb2FkZWQsXG4gICAgLy8gaWYgdGhlcmUgaXMgYSBfbmV4dERCRnJvbUlkLCB3ZSBubyBsb25nZXIgbmVlZCB0byBnZXQgYW55IG1vcmUgZnJvbSB0aGUgZGF0YWJhc2VcbiAgICBpZiAoIXRoaXMuX25leHREQkZyb21JZCkge1xuICAgICAgdGhpcy5jbGllbnQuZGJNYW5hZ2VyLmxvYWRJZGVudGl0aWVzKChpZGVudGl0aWVzKSA9PiB7XG4gICAgICAgIGlmIChpZGVudGl0aWVzLmxlbmd0aCkgdGhpcy5fYXBwZW5kUmVzdWx0cyh7IGRhdGE6IGlkZW50aXRpZXMgfSwgdHJ1ZSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBuZXdSZXF1ZXN0ID0gYGlkZW50aXRpZXM/cGFnZV9zaXplPSR7cGFnZVNpemV9YCArXG4gICAgICAodGhpcy5fbmV4dFNlcnZlckZyb21JZCA/ICcmZnJvbV9pZD0nICsgdGhpcy5fbmV4dFNlcnZlckZyb21JZCA6ICcnKTtcblxuICAgIC8vIERvbid0IHJlcGVhdCBzdGlsbCBmaXJpbmcgcXVlcmllc1xuICAgIGlmIChuZXdSZXF1ZXN0ICE9PSB0aGlzLl9maXJpbmdSZXF1ZXN0KSB7XG4gICAgICB0aGlzLmlzRmlyaW5nID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2ZpcmluZ1JlcXVlc3QgPSBuZXdSZXF1ZXN0O1xuICAgICAgdGhpcy5jbGllbnQueGhyKHtcbiAgICAgICAgdXJsOiBuZXdSZXF1ZXN0LFxuICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICBzeW5jOiBmYWxzZSxcbiAgICAgIH0sIHJlc3VsdHMgPT4gdGhpcy5fcHJvY2Vzc1J1blJlc3VsdHMocmVzdWx0cywgbmV3UmVxdWVzdCwgcGFnZVNpemUpKTtcbiAgICB9XG4gIH1cblxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIHRoZSByZXN1bHRzIG9mIHRoZSBgX3J1bmAgbWV0aG9kOyBjYWxscyBfX2FwcGVuZFJlc3VsdHMuXG4gICAqXG4gICAqIEBtZXRob2QgX3Byb2Nlc3NSdW5SZXN1bHRzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gcmVzdWx0cyAtIEZ1bGwgeGhyIHJlc3BvbnNlIG9iamVjdCB3aXRoIHNlcnZlciByZXN1bHRzXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBwYWdlU2l6ZSAtIE51bWJlciBvZiBlbnRyaWVzIHRoYXQgd2VyZSByZXF1ZXN0ZWRcbiAgICovXG4gIF9wcm9jZXNzUnVuUmVzdWx0cyhyZXN1bHRzLCByZXF1ZXN0VXJsLCBwYWdlU2l6ZSkge1xuICAgIGlmIChyZXF1ZXN0VXJsICE9PSB0aGlzLl9maXJpbmdSZXF1ZXN0IHx8IHRoaXMuaXNEZXN0cm95ZWQpIHJldHVybjtcbiAgICBjb25zdCBpc1N5bmNpbmcgPSByZXN1bHRzLnhoci5nZXRSZXNwb25zZUhlYWRlcignTGF5ZXItQ29udmVyc2F0aW9uLUlzLVN5bmNpbmcnKSA9PT0gJ3RydWUnO1xuXG5cbiAgICAvLyBpc0ZpcmluZyBpcyBmYWxzZS4uLiB1bmxlc3Mgd2UgYXJlIHN0aWxsIHN5bmNpbmdcbiAgICB0aGlzLmlzRmlyaW5nID0gaXNTeW5jaW5nO1xuICAgIHRoaXMuX2ZpcmluZ1JlcXVlc3QgPSAnJztcbiAgICBpZiAocmVzdWx0cy5zdWNjZXNzKSB7XG4gICAgICBpZiAoaXNTeW5jaW5nKSB7XG4gICAgICAgIHRoaXMuX2lzU3luY2luZ0lkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5faXNTeW5jaW5nSWQgPSAwO1xuICAgICAgICAgIHRoaXMuX3J1bigpXG4gICAgICAgIH0sIDE1MDApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5faXNTeW5jaW5nSWQgPSAwO1xuICAgICAgICB0aGlzLl9hcHBlbmRSZXN1bHRzKHJlc3VsdHMsIGZhbHNlKTtcbiAgICAgICAgdGhpcy50b3RhbFNpemUgPSBOdW1iZXIocmVzdWx0cy54aHIuZ2V0UmVzcG9uc2VIZWFkZXIoJ0xheWVyLUNvdW50JykpO1xuXG4gICAgICAgIGlmIChyZXN1bHRzLmRhdGEubGVuZ3RoIDwgcGFnZVNpemUpIHRoaXMucGFnZWRUb0VuZCA9IHRydWU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudHJpZ2dlcignZXJyb3InLCB7IGVycm9yOiByZXN1bHRzLmRhdGEgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFwcGVuZHMgYXJyYXlzIG9mIGRhdGEgdG8gdGhlIFF1ZXJ5IHJlc3VsdHMuXG4gICAqXG4gICAqIEBtZXRob2QgIF9hcHBlbmRSZXN1bHRzXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfYXBwZW5kUmVzdWx0cyhyZXN1bHRzLCBmcm9tRGIpIHtcbiAgICAvLyBGb3IgYWxsIHJlc3VsdHMsIHJlZ2lzdGVyIHRoZW0gd2l0aCB0aGUgY2xpZW50XG4gICAgLy8gSWYgYWxyZWFkeSByZWdpc3RlcmVkIHdpdGggdGhlIGNsaWVudCwgcHJvcGVydGllcyB3aWxsIGJlIHVwZGF0ZWQgYXMgbmVlZGVkXG4gICAgLy8gRGF0YWJhc2UgcmVzdWx0cyByYXRoZXIgdGhhbiBzZXJ2ZXIgcmVzdWx0cyB3aWxsIGFycml2ZSBhbHJlYWR5IHJlZ2lzdGVyZWQuXG4gICAgcmVzdWx0cy5kYXRhLmZvckVhY2goKGl0ZW0pID0+IHtcbiAgICAgIGlmICghKGl0ZW0gaW5zdGFuY2VvZiBSb290KSkgdGhpcy5jbGllbnQuX2NyZWF0ZU9iamVjdChpdGVtKTtcbiAgICB9KTtcblxuICAgIC8vIEZpbHRlciByZXN1bHRzIHRvIGp1c3QgdGhlIG5ldyByZXN1bHRzXG4gICAgY29uc3QgbmV3UmVzdWx0cyA9IHJlc3VsdHMuZGF0YS5maWx0ZXIoaXRlbSA9PiB0aGlzLl9nZXRJbmRleChpdGVtLmlkKSA9PT0gLTEpO1xuXG4gICAgLy8gVXBkYXRlIHRoZSBuZXh0IElEIHRvIHVzZSBpbiBwYWdpbmF0aW9uXG4gICAgY29uc3QgcmVzdWx0TGVuZ3RoID0gcmVzdWx0cy5kYXRhLmxlbmd0aDtcbiAgICBpZiAocmVzdWx0TGVuZ3RoKSB7XG4gICAgICBpZiAoZnJvbURiKSB7XG4gICAgICAgIHRoaXMuX25leHREQkZyb21JZCA9IHJlc3VsdHMuZGF0YVtyZXN1bHRMZW5ndGggLSAxXS5pZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgPSByZXN1bHRzLmRhdGFbcmVzdWx0TGVuZ3RoIC0gMV0uaWQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gVXBkYXRlIHRoaXMuZGF0YVxuICAgIGlmICh0aGlzLmRhdGFUeXBlID09PSBRdWVyeS5PYmplY3REYXRhVHlwZSkge1xuICAgICAgdGhpcy5kYXRhID0gW10uY29uY2F0KHRoaXMuZGF0YSk7XG4gICAgfVxuICAgIGNvbnN0IGRhdGEgPSB0aGlzLmRhdGE7XG5cbiAgICAvLyBJbnNlcnQgdGhlIHJlc3VsdHMuLi4gaWYgdGhlIHJlc3VsdHMgYXJlIGEgbWF0Y2hcbiAgICBuZXdSZXN1bHRzLmZvckVhY2goKGl0ZW1JbikgPT4ge1xuICAgICAgbGV0IGluZGV4O1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuY2xpZW50Ll9nZXRPYmplY3QoaXRlbUluLmlkKTtcbiAgICAgIHN3aXRjaCAodGhpcy5tb2RlbCkge1xuICAgICAgICBjYXNlIE1FU1NBR0U6XG4gICAgICAgIGNhc2UgQU5OT1VOQ0VNRU5UOlxuICAgICAgICAgIGluZGV4ID0gdGhpcy5fZ2V0SW5zZXJ0TWVzc2FnZUluZGV4KGl0ZW0sIGRhdGEpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIENPTlZFUlNBVElPTjpcbiAgICAgICAgICBpbmRleCA9IHRoaXMuX2dldEluc2VydENvbnZlcnNhdGlvbkluZGV4KGl0ZW0sIGRhdGEpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIElERU5USVRZOlxuICAgICAgICAgIGluZGV4ID0gZGF0YS5sZW5ndGg7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBkYXRhLnNwbGljZShpbmRleCwgMCwgdGhpcy5fZ2V0RGF0YShpdGVtKSk7XG4gICAgfSk7XG5cblxuICAgIC8vIFRyaWdnZXIgdGhlIGNoYW5nZSBldmVudFxuICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgdHlwZTogJ2RhdGEnLFxuICAgICAgZGF0YTogbmV3UmVzdWx0cy5tYXAoaXRlbSA9PiB0aGlzLl9nZXREYXRhKHRoaXMuY2xpZW50Ll9nZXRPYmplY3QoaXRlbS5pZCkpKSxcbiAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgdGFyZ2V0OiB0aGlzLmNsaWVudCxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgY29ycmVjdGx5IGZvcm1hdHRlZCBvYmplY3QgcmVwcmVzZW50aW5nIGEgcmVzdWx0LlxuICAgKlxuICAgKiBGb3JtYXQgaXMgc3BlY2lmaWVkIGJ5IHRoZSBgZGF0YVR5cGVgIHByb3BlcnR5LlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXREYXRhXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLlJvb3R9IGl0ZW0gLSBDb252ZXJzYXRpb24gb3IgTWVzc2FnZSBpbnN0YW5jZVxuICAgKiBAcmV0dXJuIHtPYmplY3R9IC0gQ29udmVyc2F0aW9uIG9yIE1lc3NhZ2UgaW5zdGFuY2Ugb3IgT2JqZWN0XG4gICAqL1xuICBfZ2V0RGF0YShpdGVtKSB7XG4gICAgaWYgKHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlKSB7XG4gICAgICByZXR1cm4gaXRlbS50b09iamVjdCgpO1xuICAgIH1cbiAgICByZXR1cm4gaXRlbTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGFuIGluc3RhbmNlIHJlZ2FyZGxlc3Mgb2Ygd2hldGhlciB0aGUgaW5wdXQgaXMgaW5zdGFuY2Ugb3Igb2JqZWN0XG4gICAqIEBtZXRob2QgX2dldEluc3RhbmNlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7bGF5ZXIuUm9vdHxPYmplY3R9IGl0ZW0gLSBDb252ZXJzYXRpb24gb3IgTWVzc2FnZSBvYmplY3QvaW5zdGFuY2VcbiAgICogQHJldHVybiB7bGF5ZXIuUm9vdH1cbiAgICovXG4gIF9nZXRJbnN0YW5jZShpdGVtKSB7XG4gICAgaWYgKGl0ZW0gaW5zdGFuY2VvZiBSb290KSByZXR1cm4gaXRlbTtcbiAgICByZXR1cm4gdGhpcy5jbGllbnQuX2dldE9iamVjdChpdGVtLmlkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc2sgdGhlIHF1ZXJ5IGZvciB0aGUgaXRlbSBtYXRjaGluZyB0aGUgSUQuXG4gICAqXG4gICAqIFJldHVybnMgdW5kZWZpbmVkIGlmIHRoZSBJRCBpcyBub3QgZm91bmQuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldEl0ZW1cbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7c3RyaW5nfSBpZFxuICAgKiBAcmV0dXJuIHtPYmplY3R9IENvbnZlcnNhdGlvbiBvciBNZXNzYWdlIG9iamVjdCBvciBpbnN0YW5jZVxuICAgKi9cbiAgX2dldEl0ZW0oaWQpIHtcbiAgICBzd2l0Y2ggKFV0aWwudHlwZUZyb21JRChpZCkpIHtcbiAgICAgIGNhc2UgJ2Fubm91bmNlbWVudHMnOlxuICAgICAgICBpZiAodGhpcy5tb2RlbCA9PT0gQU5OT1VOQ0VNRU5UKSB7XG4gICAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLl9nZXRJbmRleChpZCk7XG4gICAgICAgICAgcmV0dXJuIGluZGV4ID09PSAtMSA/IG51bGwgOiB0aGlzLmRhdGFbaW5kZXhdO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnbWVzc2FnZXMnOlxuICAgICAgICBpZiAodGhpcy5tb2RlbCA9PT0gTUVTU0FHRSkge1xuICAgICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5fZ2V0SW5kZXgoaWQpO1xuICAgICAgICAgIHJldHVybiBpbmRleCA9PT0gLTEgPyBudWxsIDogdGhpcy5kYXRhW2luZGV4XTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLm1vZGVsID09PSBDT05WRVJTQVRJT04pIHtcbiAgICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5kYXRhLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgY29uc3QgY29udmVyc2F0aW9uID0gdGhpcy5kYXRhW2luZGV4XTtcbiAgICAgICAgICAgIGlmIChjb252ZXJzYXRpb24ubGFzdE1lc3NhZ2UgJiYgY29udmVyc2F0aW9uLmxhc3RNZXNzYWdlLmlkID09PSBpZCkgcmV0dXJuIGNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdjb252ZXJzYXRpb25zJzpcbiAgICAgICAgaWYgKHRoaXMubW9kZWwgPT09IENPTlZFUlNBVElPTikge1xuICAgICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5fZ2V0SW5kZXgoaWQpO1xuICAgICAgICAgIHJldHVybiBpbmRleCA9PT0gLTEgPyBudWxsIDogdGhpcy5kYXRhW2luZGV4XTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2lkZW50aXRpZXMnOlxuICAgICAgICBpZiAodGhpcy5tb2RlbCA9PT0gSURFTlRJVFkpIHtcbiAgICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuX2dldEluZGV4KGlkKTtcbiAgICAgICAgICByZXR1cm4gaW5kZXggPT09IC0xID8gbnVsbCA6IHRoaXMuZGF0YVtpbmRleF07XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgaW5kZXggb2YgdGhlIGl0ZW0gcmVwcmVzZW50ZWQgYnkgdGhlIHNwZWNpZmllZCBJRDsgb3IgcmV0dXJuIC0xLlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRJbmRleFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkXG4gICAqIEByZXR1cm4ge251bWJlcn1cbiAgICovXG4gIF9nZXRJbmRleChpZCkge1xuICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLmRhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBpZiAodGhpcy5kYXRhW2luZGV4XS5pZCA9PT0gaWQpIHJldHVybiBpbmRleDtcbiAgICB9XG4gICAgcmV0dXJuIC0xO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSBhbnkgY2hhbmdlIGV2ZW50IHJlY2VpdmVkIGZyb20gdGhlIGxheWVyLkNsaWVudC5cbiAgICpcbiAgICogVGhlc2UgY2FuIGJlIGNhdXNlZCBieSB3ZWJzb2NrZXQgZXZlbnRzLCBhcyB3ZWxsIGFzIGxvY2FsXG4gICAqIHJlcXVlc3RzIHRvIGNyZWF0ZS9kZWxldGUvbW9kaWZ5IENvbnZlcnNhdGlvbnMgYW5kIE1lc3NhZ2VzLlxuICAgKlxuICAgKiBUaGUgZXZlbnQgZG9lcyBub3QgbmVjZXNzYXJpbHkgYXBwbHkgdG8gdGhpcyBRdWVyeSwgYnV0IHRoZSBRdWVyeVxuICAgKiBtdXN0IGV4YW1pbmUgaXQgdG8gZGV0ZXJtaW5lIGlmIGl0IGFwcGxpZXMuXG4gICAqXG4gICAqIEBtZXRob2QgX2hhbmRsZUNoYW5nZUV2ZW50c1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lIC0gXCJtZXNzYWdlczphZGRcIiwgXCJjb252ZXJzYXRpb25zOmNoYW5nZVwiXG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICBfaGFuZGxlQ2hhbmdlRXZlbnRzKGV2ZW50TmFtZSwgZXZ0KSB7XG4gICAgc3dpdGNoICh0aGlzLm1vZGVsKSB7XG4gICAgICBjYXNlIENPTlZFUlNBVElPTjpcbiAgICAgICAgdGhpcy5faGFuZGxlQ29udmVyc2F0aW9uRXZlbnRzKGV2dCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBNRVNTQUdFOlxuICAgICAgY2FzZSBBTk5PVU5DRU1FTlQ6XG4gICAgICAgIHRoaXMuX2hhbmRsZU1lc3NhZ2VFdmVudHMoZXZ0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIElERU5USVRZOlxuICAgICAgICB0aGlzLl9oYW5kbGVJZGVudGl0eUV2ZW50cyhldnQpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBfaGFuZGxlQ29udmVyc2F0aW9uRXZlbnRzKGV2dCkge1xuICAgIHN3aXRjaCAoZXZ0LmV2ZW50TmFtZSkge1xuXG4gICAgICAvLyBJZiBhIENvbnZlcnNhdGlvbidzIHByb3BlcnR5IGhhcyBjaGFuZ2VkLCBhbmQgdGhlIENvbnZlcnNhdGlvbiBpcyBpbiB0aGlzXG4gICAgICAvLyBRdWVyeSdzIGRhdGEsIHRoZW4gdXBkYXRlIGl0LlxuICAgICAgY2FzZSAnY29udmVyc2F0aW9uczpjaGFuZ2UnOlxuICAgICAgICB0aGlzLl9oYW5kbGVDb252ZXJzYXRpb25DaGFuZ2VFdmVudChldnQpO1xuICAgICAgICBicmVhaztcblxuICAgICAgLy8gSWYgYSBDb252ZXJzYXRpb24gaXMgYWRkZWQsIGFuZCBpdCBpc24ndCBhbHJlYWR5IGluIHRoZSBRdWVyeSxcbiAgICAgIC8vIGFkZCBpdCBhbmQgdHJpZ2dlciBhbiBldmVudFxuICAgICAgY2FzZSAnY29udmVyc2F0aW9uczphZGQnOlxuICAgICAgICB0aGlzLl9oYW5kbGVDb252ZXJzYXRpb25BZGRFdmVudChldnQpO1xuICAgICAgICBicmVhaztcblxuICAgICAgLy8gSWYgYSBDb252ZXJzYXRpb24gaXMgZGVsZXRlZCwgYW5kIGl0cyBzdGlsbCBpbiBvdXIgZGF0YSxcbiAgICAgIC8vIHJlbW92ZSBpdCBhbmQgdHJpZ2dlciBhbiBldmVudC5cbiAgICAgIGNhc2UgJ2NvbnZlcnNhdGlvbnM6cmVtb3ZlJzpcbiAgICAgICAgdGhpcy5faGFuZGxlQ29udmVyc2F0aW9uUmVtb3ZlRXZlbnQoZXZ0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLy8gVE9ETyBXRUItOTY4OiBSZWZhY3RvciB0aGlzIGludG8gZnVuY3Rpb25zIGZvciBpbnN0YW5jZSwgb2JqZWN0LCBzb3J0QnkgY3JlYXRlZEF0LCBzb3J0QnkgbGFzdE1lc3NhZ2VcbiAgX2hhbmRsZUNvbnZlcnNhdGlvbkNoYW5nZUV2ZW50KGV2dCkge1xuICAgIGxldCBpbmRleCA9IHRoaXMuX2dldEluZGV4KGV2dC50YXJnZXQuaWQpO1xuXG4gICAgLy8gSWYgaXRzIGFuIElEIGNoYW5nZSAobWF0Y2hpbmcgRGlzdGluY3QgQ29udmVyc2F0aW9uIHJldHVybmVkIGJ5IHNlcnZlcikgbWFrZSBzdXJlIHRvIHVwZGF0ZSBvdXIgZGF0YS5cbiAgICAvLyBJZiBkYXRhVHlwZSBpcyBhbiBpbnN0YW5jZSwgaXRzIGJlZW4gdXBkYXRlZCBmb3IgdXMuXG4gICAgaWYgKHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlKSB7XG4gICAgICBjb25zdCBpZENoYW5nZXMgPSBldnQuZ2V0Q2hhbmdlc0ZvcignaWQnKTtcbiAgICAgIGlmIChpZENoYW5nZXMubGVuZ3RoKSB7XG4gICAgICAgIGluZGV4ID0gdGhpcy5fZ2V0SW5kZXgoaWRDaGFuZ2VzWzBdLm9sZFZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiBkYXRhVHlwZSBpcyBcIm9iamVjdFwiIHRoZW4gdXBkYXRlIHRoZSBvYmplY3QgYW5kIG91ciBhcnJheTtcbiAgICAvLyBlbHNlIHRoZSBvYmplY3QgaXMgYWxyZWFkeSB1cGRhdGVkLlxuICAgIC8vIElnbm9yZSByZXN1bHRzIHRoYXQgYXJlbid0IGFscmVhZHkgaW4gb3VyIGRhdGE7IFJlc3VsdHMgYXJlIGFkZGVkIHZpYVxuICAgIC8vIGNvbnZlcnNhdGlvbnM6YWRkIGV2ZW50cy4gIFdlYnNvY2tldCBNYW5hZ2VyIGF1dG9tYXRpY2FsbHkgbG9hZHMgYW55dGhpbmcgdGhhdCByZWNlaXZlcyBhbiBldmVudFxuICAgIC8vIGZvciB3aGljaCB3ZSBoYXZlIG5vIG9iamVjdCwgc28gd2UnbGwgZ2V0IHRoZSBhZGQgZXZlbnQgYXQgdGhhdCB0aW1lLlxuICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgIGNvbnN0IHNvcnRGaWVsZCA9IHRoaXMuX2dldFNvcnRGaWVsZCgpO1xuICAgICAgY29uc3QgcmVvcmRlciA9IGV2dC5oYXNQcm9wZXJ0eSgnbGFzdE1lc3NhZ2UnKSAmJiBzb3J0RmllbGQgPT09ICdsYXN0X21lc3NhZ2UnO1xuICAgICAgbGV0IG5ld0luZGV4O1xuXG4gICAgICBpZiAodGhpcy5kYXRhVHlwZSA9PT0gUXVlcnkuT2JqZWN0RGF0YVR5cGUpIHtcbiAgICAgICAgaWYgKCFyZW9yZGVyKSB7XG4gICAgICAgICAgLy8gUmVwbGFjZSB0aGUgY2hhbmdlZCBDb252ZXJzYXRpb24gd2l0aCBhIG5ldyBpbW11dGFibGUgb2JqZWN0XG4gICAgICAgICAgdGhpcy5kYXRhID0gW1xuICAgICAgICAgICAgLi4udGhpcy5kYXRhLnNsaWNlKDAsIGluZGV4KSxcbiAgICAgICAgICAgIGV2dC50YXJnZXQudG9PYmplY3QoKSxcbiAgICAgICAgICAgIC4uLnRoaXMuZGF0YS5zbGljZShpbmRleCArIDEpLFxuICAgICAgICAgIF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3SW5kZXggPSB0aGlzLl9nZXRJbnNlcnRDb252ZXJzYXRpb25JbmRleChldnQudGFyZ2V0LCB0aGlzLmRhdGEpO1xuICAgICAgICAgIHRoaXMuZGF0YS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgIHRoaXMuZGF0YS5zcGxpY2UobmV3SW5kZXgsIDAsIHRoaXMuX2dldERhdGEoZXZ0LnRhcmdldCkpO1xuICAgICAgICAgIHRoaXMuZGF0YSA9IHRoaXMuZGF0YS5jb25jYXQoW10pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEVsc2UgZGF0YVR5cGUgaXMgaW5zdGFuY2Ugbm90IG9iamVjdFxuICAgICAgZWxzZSB7XG4gICAgICAgIGlmIChyZW9yZGVyKSB7XG4gICAgICAgICAgbmV3SW5kZXggPSB0aGlzLl9nZXRJbnNlcnRDb252ZXJzYXRpb25JbmRleChldnQudGFyZ2V0LCB0aGlzLmRhdGEpO1xuICAgICAgICAgIGlmIChuZXdJbmRleCAhPT0gaW5kZXgpIHtcbiAgICAgICAgICAgIHRoaXMuZGF0YS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgdGhpcy5kYXRhLnNwbGljZShuZXdJbmRleCwgMCwgZXZ0LnRhcmdldCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFRyaWdnZXIgYSAncHJvcGVydHknIGV2ZW50XG4gICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgdHlwZTogJ3Byb3BlcnR5JyxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLl9nZXREYXRhKGV2dC50YXJnZXQpLFxuICAgICAgICBxdWVyeTogdGhpcyxcbiAgICAgICAgaXNDaGFuZ2U6IHRydWUsXG4gICAgICAgIGNoYW5nZXM6IGV2dC5jaGFuZ2VzLFxuICAgICAgfSk7XG5cbiAgICAgIGlmIChyZW9yZGVyICYmIG5ld0luZGV4ICE9PSBpbmRleCkge1xuICAgICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgICB0eXBlOiAnbW92ZScsXG4gICAgICAgICAgdGFyZ2V0OiB0aGlzLl9nZXREYXRhKGV2dC50YXJnZXQpLFxuICAgICAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgICAgIGlzQ2hhbmdlOiBmYWxzZSxcbiAgICAgICAgICBmcm9tSW5kZXg6IGluZGV4LFxuICAgICAgICAgIHRvSW5kZXg6IG5ld0luZGV4XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9nZXRJbnNlcnRDb252ZXJzYXRpb25JbmRleChjb252ZXJzYXRpb24sIGRhdGEpIHtcbiAgICBpZiAoIWNvbnZlcnNhdGlvbi5pc1NhdmVkKCkpIHJldHVybiAwO1xuICAgIGNvbnN0IHNvcnRGaWVsZCA9IHRoaXMuX2dldFNvcnRGaWVsZCgpO1xuICAgIGxldCBpbmRleDtcbiAgICBpZiAoc29ydEZpZWxkID09PSAnY3JlYXRlZF9hdCcpIHtcbiAgICAgIGZvciAoaW5kZXggPSAwOyBpbmRleCA8IGRhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgIGNvbnN0IGl0ZW0gPSBkYXRhW2luZGV4XTtcbiAgICAgICAgaWYgKGl0ZW0uc3luY1N0YXRlID09PSBTWU5DX1NUQVRFLk5FVyB8fCBpdGVtLnN5bmNTdGF0ZSA9PT0gU1lOQ19TVEFURS5TQVZJTkcpIGNvbnRpbnVlO1xuICAgICAgICBpZiAoY29udmVyc2F0aW9uLmNyZWF0ZWRBdCA+PSBpdGVtLmNyZWF0ZWRBdCkgYnJlYWs7XG4gICAgICB9XG4gICAgICByZXR1cm4gaW5kZXg7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBvbGRJbmRleCA9IC0xO1xuICAgICAgY29uc3QgZDEgPSBjb252ZXJzYXRpb24ubGFzdE1lc3NhZ2UgPyBjb252ZXJzYXRpb24ubGFzdE1lc3NhZ2Uuc2VudEF0IDogY29udmVyc2F0aW9uLmNyZWF0ZWRBdDtcbiAgICAgIGZvciAoaW5kZXggPSAwOyBpbmRleCA8IGRhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgIGNvbnN0IGl0ZW0gPSBkYXRhW2luZGV4XTtcbiAgICAgICAgaWYgKGl0ZW0uaWQgPT09IGNvbnZlcnNhdGlvbi5pZCkge1xuICAgICAgICAgIG9sZEluZGV4ID0gaW5kZXg7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGl0ZW0uc3luY1N0YXRlID09PSBTWU5DX1NUQVRFLk5FVyB8fCBpdGVtLnN5bmNTdGF0ZSA9PT0gU1lOQ19TVEFURS5TQVZJTkcpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBkMiA9IGl0ZW0ubGFzdE1lc3NhZ2UgPyBpdGVtLmxhc3RNZXNzYWdlLnNlbnRBdCA6IGl0ZW0uY3JlYXRlZEF0O1xuICAgICAgICBpZiAoZDEgPj0gZDIpIGJyZWFrO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG9sZEluZGV4ID09PSAtMSB8fCBvbGRJbmRleCA+IGluZGV4ID8gaW5kZXggOiBpbmRleCAtIDE7XG4gICAgfVxuICB9XG5cbiAgX2dldEluc2VydE1lc3NhZ2VJbmRleChtZXNzYWdlLCBkYXRhKSB7XG4gICAgbGV0IGluZGV4O1xuICAgIGZvciAoaW5kZXggPSAwOyBpbmRleCA8IGRhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBpZiAobWVzc2FnZS5wb3NpdGlvbiA+IGRhdGFbaW5kZXhdLnBvc2l0aW9uKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaW5kZXg7XG4gIH1cblxuICBfaGFuZGxlQ29udmVyc2F0aW9uQWRkRXZlbnQoZXZ0KSB7XG4gICAgLy8gRmlsdGVyIG91dCBhbnkgQ29udmVyc2F0aW9ucyBhbHJlYWR5IGluIG91ciBkYXRhXG4gICAgY29uc3QgbGlzdCA9IGV2dC5jb252ZXJzYXRpb25zXG4gICAgICAgICAgICAgICAgICAuZmlsdGVyKGNvbnZlcnNhdGlvbiA9PiB0aGlzLl9nZXRJbmRleChjb252ZXJzYXRpb24uaWQpID09PSAtMSk7XG5cbiAgICBpZiAobGlzdC5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGRhdGEgPSB0aGlzLmRhdGE7XG4gICAgICBsaXN0LmZvckVhY2goKGNvbnZlcnNhdGlvbikgPT4ge1xuICAgICAgICBjb25zdCBuZXdJbmRleCA9IHRoaXMuX2dldEluc2VydENvbnZlcnNhdGlvbkluZGV4KGNvbnZlcnNhdGlvbiwgZGF0YSk7XG4gICAgICAgIGRhdGEuc3BsaWNlKG5ld0luZGV4LCAwLCB0aGlzLl9nZXREYXRhKGNvbnZlcnNhdGlvbikpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIFdoZXRoZXIgc29ydGluZyBieSBsYXN0X21lc3NhZ2Ugb3IgY3JlYXRlZF9hdCwgbmV3IHJlc3VsdHMgZ28gYXQgdGhlIHRvcCBvZiB0aGUgbGlzdFxuICAgICAgaWYgKHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlKSB7XG4gICAgICAgIHRoaXMuZGF0YSA9IFtdLmNvbmNhdChkYXRhKTtcbiAgICAgIH1cbiAgICAgIHRoaXMudG90YWxTaXplICs9IGxpc3QubGVuZ3RoO1xuXG4gICAgICAvLyBUcmlnZ2VyIGFuICdpbnNlcnQnIGV2ZW50IGZvciBlYWNoIGl0ZW0gYWRkZWQ7XG4gICAgICAvLyB0eXBpY2FsbHkgYnVsayBpbnNlcnRzIGhhcHBlbiB2aWEgX2FwcGVuZFJlc3VsdHMoKS5cbiAgICAgIGxpc3QuZm9yRWFjaCgoY29udmVyc2F0aW9uKSA9PiB7XG4gICAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl9nZXREYXRhKGNvbnZlcnNhdGlvbik7XG4gICAgICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgICAgIHR5cGU6ICdpbnNlcnQnLFxuICAgICAgICAgIGluZGV4OiB0aGlzLmRhdGEuaW5kZXhPZihpdGVtKSxcbiAgICAgICAgICB0YXJnZXQ6IGl0ZW0sXG4gICAgICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cblxuICBfaGFuZGxlQ29udmVyc2F0aW9uUmVtb3ZlRXZlbnQoZXZ0KSB7XG4gICAgY29uc3QgcmVtb3ZlZCA9IFtdO1xuICAgIGV2dC5jb252ZXJzYXRpb25zLmZvckVhY2goKGNvbnZlcnNhdGlvbikgPT4ge1xuICAgICAgY29uc3QgaW5kZXggPSB0aGlzLl9nZXRJbmRleChjb252ZXJzYXRpb24uaWQpO1xuICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICBpZiAoY29udmVyc2F0aW9uLmlkID09PSB0aGlzLl9uZXh0REJGcm9tSWQpIHRoaXMuX25leHREQkZyb21JZCA9IHRoaXMuX3VwZGF0ZU5leHRGcm9tSWQoaW5kZXgpO1xuICAgICAgICBpZiAoY29udmVyc2F0aW9uLmlkID09PSB0aGlzLl9uZXh0U2VydmVyRnJvbUlkKSB0aGlzLl9uZXh0U2VydmVyRnJvbUlkID0gdGhpcy5fdXBkYXRlTmV4dEZyb21JZChpbmRleCk7XG4gICAgICAgIHJlbW92ZWQucHVzaCh7XG4gICAgICAgICAgZGF0YTogY29udmVyc2F0aW9uLFxuICAgICAgICAgIGluZGV4LFxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlKSB7XG4gICAgICAgICAgdGhpcy5kYXRhID0gWy4uLnRoaXMuZGF0YS5zbGljZSgwLCBpbmRleCksIC4uLnRoaXMuZGF0YS5zbGljZShpbmRleCArIDEpXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmRhdGEuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy50b3RhbFNpemUgLT0gcmVtb3ZlZC5sZW5ndGg7XG4gICAgcmVtb3ZlZC5mb3JFYWNoKChyZW1vdmVkT2JqKSA9PiB7XG4gICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgdHlwZTogJ3JlbW92ZScsXG4gICAgICAgIGluZGV4OiByZW1vdmVkT2JqLmluZGV4LFxuICAgICAgICB0YXJnZXQ6IHRoaXMuX2dldERhdGEocmVtb3ZlZE9iai5kYXRhKSxcbiAgICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIF9oYW5kbGVNZXNzYWdlRXZlbnRzKGV2dCkge1xuICAgIHN3aXRjaCAoZXZ0LmV2ZW50TmFtZSkge1xuXG4gICAgICAvLyBJZiBhIENvbnZlcnNhdGlvbidzIElEIGhhcyBjaGFuZ2VkLCBjaGVjayBvdXIgcHJlZGljYXRlLCBhbmQgdXBkYXRlIGl0IGF1dG9tYXRpY2FsbHkgaWYgbmVlZGVkLlxuICAgICAgY2FzZSAnY29udmVyc2F0aW9uczpjaGFuZ2UnOlxuICAgICAgICBpZiAodGhpcy5tb2RlbCA9PT0gTUVTU0FHRSkgdGhpcy5faGFuZGxlTWVzc2FnZUNvbnZJZENoYW5nZUV2ZW50KGV2dCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAvLyBJZiBhIE1lc3NhZ2UgaGFzIGNoYW5nZWQgYW5kIGl0cyBpbiBvdXIgcmVzdWx0IHNldCwgcmVwbGFjZVxuICAgICAgLy8gaXQgd2l0aCBhIG5ldyBpbW11dGFibGUgb2JqZWN0XG4gICAgICBjYXNlICdtZXNzYWdlczpjaGFuZ2UnOlxuICAgICAgY2FzZSAnbWVzc2FnZXM6cmVhZCc6XG4gICAgICAgIHRoaXMuX2hhbmRsZU1lc3NhZ2VDaGFuZ2VFdmVudChldnQpO1xuICAgICAgICBicmVhaztcblxuICAgICAgLy8gSWYgTWVzc2FnZXMgYXJlIGFkZGVkLCBhbmQgdGhleSBhcmVuJ3QgYWxyZWFkeSBpbiBvdXIgcmVzdWx0IHNldFxuICAgICAgLy8gYWRkIHRoZW0uXG4gICAgICBjYXNlICdtZXNzYWdlczphZGQnOlxuICAgICAgICB0aGlzLl9oYW5kbGVNZXNzYWdlQWRkRXZlbnQoZXZ0KTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIC8vIElmIGEgTWVzc2FnZSBpcyBkZWxldGVkIGFuZCBpdHMgaW4gb3VyIHJlc3VsdCBzZXQsIHJlbW92ZSBpdFxuICAgICAgLy8gYW5kIHRyaWdnZXIgYW4gZXZlbnRcbiAgICAgIGNhc2UgJ21lc3NhZ2VzOnJlbW92ZSc6XG4gICAgICAgIHRoaXMuX2hhbmRsZU1lc3NhZ2VSZW1vdmVFdmVudChldnQpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQSBDb252ZXJzYXRpb24gSUQgY2hhbmdlcyBpZiBhIG1hdGNoaW5nIERpc3RpbmN0IENvbnZlcnNhdGlvbiB3YXMgZm91bmQgb24gdGhlIHNlcnZlci5cbiAgICpcbiAgICogSWYgdGhpcyBRdWVyeSdzIENvbnZlcnNhdGlvbidzIElEIGhhcyBjaGFuZ2VkLCB1cGRhdGUgdGhlIHByZWRpY2F0ZS5cbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlTWVzc2FnZUNvbnZJZENoYW5nZUV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0IC0gQSBNZXNzYWdlIENoYW5nZSBFdmVudFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2hhbmRsZU1lc3NhZ2VDb252SWRDaGFuZ2VFdmVudChldnQpIHtcbiAgICBjb25zdCBjaWRDaGFuZ2VzID0gZXZ0LmdldENoYW5nZXNGb3IoJ2lkJyk7XG4gICAgaWYgKGNpZENoYW5nZXMubGVuZ3RoKSB7XG4gICAgICBpZiAodGhpcy5fcHJlZGljYXRlID09PSBjaWRDaGFuZ2VzWzBdLm9sZFZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3ByZWRpY2F0ZSA9IGNpZENoYW5nZXNbMF0ubmV3VmFsdWU7XG4gICAgICAgIHRoaXMucHJlZGljYXRlID0gXCJjb252ZXJzYXRpb24uaWQgPSAnXCIgKyB0aGlzLl9wcmVkaWNhdGUgKyBcIidcIjtcbiAgICAgICAgdGhpcy5fcnVuKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIElmIHRoZSBJRCBvZiB0aGUgbWVzc2FnZSBoYXMgY2hhbmdlZCwgdGhlbiB0aGUgcG9zaXRpb24gcHJvcGVydHkgaGFzIGxpa2VseSBjaGFuZ2VkIGFzIHdlbGwuXG4gICAqXG4gICAqIFRoaXMgbWV0aG9kIHRlc3RzIHRvIHNlZSBpZiBjaGFuZ2VzIHRvIHRoZSBwb3NpdGlvbiBwcm9wZXJ0eSBoYXZlIGltcGFjdGVkIHRoZSBtZXNzYWdlJ3MgcG9zaXRpb24gaW4gdGhlXG4gICAqIGRhdGEgYXJyYXkuLi4gYW5kIHVwZGF0ZXMgdGhlIGFycmF5IGlmIGl0IGhhcy5cbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlTWVzc2FnZVBvc2l0aW9uQ2hhbmdlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0ICBBIE1lc3NhZ2UgQ2hhbmdlIGV2ZW50XG4gICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAgSW5kZXggb2YgdGhlIG1lc3NhZ2UgaW4gdGhlIGN1cnJlbnQgZGF0YSBhcnJheVxuICAgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIGlmIGEgZGF0YSB3YXMgY2hhbmdlZCBhbmQgYSBjaGFuZ2UgZXZlbnQgd2FzIGVtaXR0ZWRcbiAgICovXG4gIF9oYW5kbGVNZXNzYWdlUG9zaXRpb25DaGFuZ2UoZXZ0LCBpbmRleCkge1xuICAgIC8vIElmIHRoZSBtZXNzYWdlIGlzIG5vdCBpbiB0aGUgY3VycmVudCBkYXRhLCB0aGVuIHRoZXJlIGlzIG5vIGNoYW5nZSB0byBvdXIgcXVlcnkgcmVzdWx0cy5cbiAgICBpZiAoaW5kZXggPT09IC0xKSByZXR1cm4gZmFsc2U7XG5cbiAgICAvLyBDcmVhdGUgYW4gYXJyYXkgd2l0aG91dCBvdXIgZGF0YSBpdGVtIGFuZCB0aGVuIGZpbmQgb3V0IHdoZXJlIHRoZSBkYXRhIGl0ZW0gU2hvdWxkIGJlIGluc2VydGVkLlxuICAgIC8vIE5vdGU6IHdlIGNvdWxkIGp1c3QgbG9va3VwIHRoZSBwb3NpdGlvbiBpbiBvdXIgY3VycmVudCBkYXRhIGFycmF5LCBidXQgaXRzIHRvbyBlYXN5IHRvIGludHJvZHVjZVxuICAgIC8vIGVycm9ycyB3aGVyZSBjb21wYXJpbmcgdGhpcyBtZXNzYWdlIHRvIGl0c2VsZiBtYXkgeWllbGQgaW5kZXggb3IgaW5kZXggKyAxLlxuICAgIGNvbnN0IG5ld0RhdGEgPSBbXG4gICAgICAuLi50aGlzLmRhdGEuc2xpY2UoMCwgaW5kZXgpLFxuICAgICAgLi4udGhpcy5kYXRhLnNsaWNlKGluZGV4ICsgMSksXG4gICAgXTtcbiAgICBjb25zdCBuZXdJbmRleCA9IHRoaXMuX2dldEluc2VydE1lc3NhZ2VJbmRleChldnQudGFyZ2V0LCBuZXdEYXRhKTtcblxuICAgIC8vIElmIHRoZSBkYXRhIGl0ZW0gZ29lcyBpbiB0aGUgc2FtZSBpbmRleCBhcyBiZWZvcmUsIHRoZW4gdGhlcmUgaXMgbm8gY2hhbmdlIHRvIGJlIGhhbmRsZWQgaGVyZTtcbiAgICAvLyBlbHNlIGluc2VydCB0aGUgaXRlbSBhdCB0aGUgcmlnaHQgaW5kZXgsIHVwZGF0ZSB0aGlzLmRhdGEgYW5kIGZpcmUgYSBjaGFuZ2UgZXZlbnRcbiAgICBpZiAobmV3SW5kZXggIT09IGluZGV4KSB7XG4gICAgICBuZXdEYXRhLnNwbGljZShuZXdJbmRleCwgMCwgdGhpcy5fZ2V0RGF0YShldnQudGFyZ2V0KSk7XG4gICAgICB0aGlzLmRhdGEgPSBuZXdEYXRhO1xuICAgICAgdGhpcy5fdHJpZ2dlckNoYW5nZSh7XG4gICAgICAgIHR5cGU6ICdwcm9wZXJ0eScsXG4gICAgICAgIHRhcmdldDogdGhpcy5fZ2V0RGF0YShldnQudGFyZ2V0KSxcbiAgICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICAgIGlzQ2hhbmdlOiB0cnVlLFxuICAgICAgICBjaGFuZ2VzOiBldnQuY2hhbmdlcyxcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIF9oYW5kbGVNZXNzYWdlQ2hhbmdlRXZlbnQoZXZ0KSB7XG4gICAgbGV0IGluZGV4ID0gdGhpcy5fZ2V0SW5kZXgoZXZ0LnRhcmdldC5pZCk7XG4gICAgY29uc3QgcG9zaXRpb25DaGFuZ2VzID0gZXZ0LmdldENoYW5nZXNGb3IoJ3Bvc2l0aW9uJyk7XG5cbiAgICAvLyBJZiB0aGVyZSBhcmUgcG9zaXRpb24gY2hhbmdlcywgaGFuZGxlIHRoZW0uICBJZiBhbGwgdGhlIGNoYW5nZXMgYXJlIHBvc2l0aW9uIGNoYW5nZXMsXG4gICAgLy8gZXhpdCB3aGVuIGRvbmUuXG4gICAgaWYgKHBvc2l0aW9uQ2hhbmdlcy5sZW5ndGgpIHtcbiAgICAgIGlmICh0aGlzLl9oYW5kbGVNZXNzYWdlUG9zaXRpb25DaGFuZ2UoZXZ0LCBpbmRleCkpIHtcbiAgICAgICAgaWYgKHBvc2l0aW9uQ2hhbmdlcy5sZW5ndGggPT09IGV2dC5jaGFuZ2VzLmxlbmd0aCkgcmV0dXJuO1xuICAgICAgICBpbmRleCA9IHRoaXMuX2dldEluZGV4KGV2dC50YXJnZXQuaWQpOyAvLyBHZXQgdGhlIHVwZGF0ZWQgcG9zaXRpb25cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICBpZiAodGhpcy5kYXRhVHlwZSA9PT0gUXVlcnkuT2JqZWN0RGF0YVR5cGUpIHtcbiAgICAgICAgdGhpcy5kYXRhID0gW1xuICAgICAgICAgIC4uLnRoaXMuZGF0YS5zbGljZSgwLCBpbmRleCksXG4gICAgICAgICAgZXZ0LnRhcmdldC50b09iamVjdCgpLFxuICAgICAgICAgIC4uLnRoaXMuZGF0YS5zbGljZShpbmRleCArIDEpLFxuICAgICAgICBdO1xuICAgICAgfVxuICAgICAgdGhpcy5fdHJpZ2dlckNoYW5nZSh7XG4gICAgICAgIHR5cGU6ICdwcm9wZXJ0eScsXG4gICAgICAgIHRhcmdldDogdGhpcy5fZ2V0RGF0YShldnQudGFyZ2V0KSxcbiAgICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICAgIGlzQ2hhbmdlOiB0cnVlLFxuICAgICAgICBjaGFuZ2VzOiBldnQuY2hhbmdlcyxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIF9oYW5kbGVNZXNzYWdlQWRkRXZlbnQoZXZ0KSB7XG4gICAgLy8gT25seSB1c2UgYWRkZWQgbWVzc2FnZXMgdGhhdCBhcmUgcGFydCBvZiB0aGlzIENvbnZlcnNhdGlvblxuICAgIC8vIGFuZCBub3QgYWxyZWFkeSBpbiBvdXIgcmVzdWx0IHNldFxuICAgIGNvbnN0IGxpc3QgPSBldnQubWVzc2FnZXNcbiAgICAgIC8vIEZpbHRlciBzbyB0aGF0IHdlIG9ubHkgc2VlIE1lc3NhZ2VzIGlmIGRvaW5nIGEgTWVzc2FnZXMgcXVlcnkgb3IgQW5ub3VuY2VtZW50cyBpZiBkb2luZyBhbiBBbm5vdW5jZW1lbnRzIFF1ZXJ5LlxuICAgICAgLmZpbHRlcihtZXNzYWdlID0+IHtcbiAgICAgICAgY29uc3QgdHlwZSA9IFV0aWwudHlwZUZyb21JRChtZXNzYWdlLmlkKTtcbiAgICAgICAgcmV0dXJuIHR5cGUgPT09ICdtZXNzYWdlcycgJiYgdGhpcy5tb2RlbCA9PT0gTUVTU0FHRSB8fFxuICAgICAgICAgICAgICAgIHR5cGUgPT09ICdhbm5vdW5jZW1lbnRzJyAmJiB0aGlzLm1vZGVsID09PSBBTk5PVU5DRU1FTlQ7XG4gICAgICB9KVxuICAgICAgLy8gRmlsdGVyIG91dCBNZXNzYWdlcyB0aGF0IGFyZW4ndCBwYXJ0IG9mIHRoaXMgQ29udmVyc2F0aW9uXG4gICAgICAuZmlsdGVyKG1lc3NhZ2UgPT4ge1xuICAgICAgICBjb25zdCB0eXBlID0gVXRpbC50eXBlRnJvbUlEKG1lc3NhZ2UuaWQpO1xuICAgICAgICByZXR1cm4gdHlwZSA9PT0gJ2Fubm91bmNlbWVudHMnIHx8IG1lc3NhZ2UuY29udmVyc2F0aW9uSWQgPT09IHRoaXMuX3ByZWRpY2F0ZTtcbiAgICAgIH0pXG4gICAgICAvLyBGaWx0ZXIgb3V0IE1lc3NhZ2VzIHRoYXQgYXJlIGFscmVhZHkgaW4gb3VyIGRhdGEgc2V0XG4gICAgICAuZmlsdGVyKG1lc3NhZ2UgPT4gdGhpcy5fZ2V0SW5kZXgobWVzc2FnZS5pZCkgPT09IC0xKVxuICAgICAgLm1hcChtZXNzYWdlID0+IHRoaXMuX2dldERhdGEobWVzc2FnZSkpO1xuXG4gICAgLy8gQWRkIHRoZW0gdG8gb3VyIHJlc3VsdCBzZXQgYW5kIHRyaWdnZXIgYW4gZXZlbnQgZm9yIGVhY2ggb25lXG4gICAgaWYgKGxpc3QubGVuZ3RoKSB7XG4gICAgICBjb25zdCBkYXRhID0gdGhpcy5kYXRhID0gdGhpcy5kYXRhVHlwZSA9PT0gUXVlcnkuT2JqZWN0RGF0YVR5cGUgPyBbXS5jb25jYXQodGhpcy5kYXRhKSA6IHRoaXMuZGF0YTtcbiAgICAgIGxpc3QuZm9yRWFjaCgoaXRlbSkgPT4ge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuX2dldEluc2VydE1lc3NhZ2VJbmRleChpdGVtLCBkYXRhKTtcbiAgICAgICAgZGF0YS5zcGxpY2UoaW5kZXgsIDAsIGl0ZW0pO1xuICAgICAgfSk7XG5cbiAgICAgIHRoaXMudG90YWxTaXplICs9IGxpc3QubGVuZ3RoO1xuXG4gICAgICAvLyBJbmRleCBjYWxjdWxhdGVkIGFib3ZlIG1heSBzaGlmdCBhZnRlciBhZGRpdGlvbmFsIGluc2VydGlvbnMuICBUaGlzIGhhc1xuICAgICAgLy8gdG8gYmUgZG9uZSBhZnRlciB0aGUgYWJvdmUgaW5zZXJ0aW9ucyBoYXZlIGNvbXBsZXRlZC5cbiAgICAgIGxpc3QuZm9yRWFjaCgoaXRlbSkgPT4ge1xuICAgICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgICB0eXBlOiAnaW5zZXJ0JyxcbiAgICAgICAgICBpbmRleDogdGhpcy5kYXRhLmluZGV4T2YoaXRlbSksXG4gICAgICAgICAgdGFyZ2V0OiBpdGVtLFxuICAgICAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIF9oYW5kbGVNZXNzYWdlUmVtb3ZlRXZlbnQoZXZ0KSB7XG4gICAgY29uc3QgcmVtb3ZlZCA9IFtdO1xuICAgIGV2dC5tZXNzYWdlcy5mb3JFYWNoKChtZXNzYWdlKSA9PiB7XG4gICAgICBjb25zdCBpbmRleCA9IHRoaXMuX2dldEluZGV4KG1lc3NhZ2UuaWQpO1xuICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICBpZiAobWVzc2FnZS5pZCA9PT0gdGhpcy5fbmV4dERCRnJvbUlkKSB0aGlzLl9uZXh0REJGcm9tSWQgPSB0aGlzLl91cGRhdGVOZXh0RnJvbUlkKGluZGV4KTtcbiAgICAgICAgaWYgKG1lc3NhZ2UuaWQgPT09IHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQpIHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgPSB0aGlzLl91cGRhdGVOZXh0RnJvbUlkKGluZGV4KTtcbiAgICAgICAgcmVtb3ZlZC5wdXNoKHtcbiAgICAgICAgICBkYXRhOiBtZXNzYWdlLFxuICAgICAgICAgIGluZGV4LFxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlKSB7XG4gICAgICAgICAgdGhpcy5kYXRhID0gW1xuICAgICAgICAgICAgLi4udGhpcy5kYXRhLnNsaWNlKDAsIGluZGV4KSxcbiAgICAgICAgICAgIC4uLnRoaXMuZGF0YS5zbGljZShpbmRleCArIDEpLFxuICAgICAgICAgIF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5kYXRhLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMudG90YWxTaXplIC09IHJlbW92ZWQubGVuZ3RoO1xuICAgIHJlbW92ZWQuZm9yRWFjaCgocmVtb3ZlZE9iaikgPT4ge1xuICAgICAgdGhpcy5fdHJpZ2dlckNoYW5nZSh7XG4gICAgICAgIHR5cGU6ICdyZW1vdmUnLFxuICAgICAgICB0YXJnZXQ6IHRoaXMuX2dldERhdGEocmVtb3ZlZE9iai5kYXRhKSxcbiAgICAgICAgaW5kZXg6IHJlbW92ZWRPYmouaW5kZXgsXG4gICAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBfaGFuZGxlSWRlbnRpdHlFdmVudHMoZXZ0KSB7XG4gICAgc3dpdGNoIChldnQuZXZlbnROYW1lKSB7XG5cbiAgICAgIC8vIElmIGEgSWRlbnRpdHkgaGFzIGNoYW5nZWQgYW5kIGl0cyBpbiBvdXIgcmVzdWx0IHNldCwgcmVwbGFjZVxuICAgICAgLy8gaXQgd2l0aCBhIG5ldyBpbW11dGFibGUgb2JqZWN0XG4gICAgICBjYXNlICdpZGVudGl0aWVzOmNoYW5nZSc6XG4gICAgICAgIHRoaXMuX2hhbmRsZUlkZW50aXR5Q2hhbmdlRXZlbnQoZXZ0KTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIC8vIElmIElkZW50aXRpZXMgYXJlIGFkZGVkLCBhbmQgdGhleSBhcmVuJ3QgYWxyZWFkeSBpbiBvdXIgcmVzdWx0IHNldFxuICAgICAgLy8gYWRkIHRoZW0uXG4gICAgICBjYXNlICdpZGVudGl0aWVzOmFkZCc6XG4gICAgICAgIHRoaXMuX2hhbmRsZUlkZW50aXR5QWRkRXZlbnQoZXZ0KTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIC8vIElmIGEgSWRlbnRpdHkgaXMgZGVsZXRlZCBhbmQgaXRzIGluIG91ciByZXN1bHQgc2V0LCByZW1vdmUgaXRcbiAgICAgIC8vIGFuZCB0cmlnZ2VyIGFuIGV2ZW50XG4gICAgICBjYXNlICdpZGVudGl0aWVzOnJlbW92ZSc6XG4gICAgICAgIHRoaXMuX2hhbmRsZUlkZW50aXR5UmVtb3ZlRXZlbnQoZXZ0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cblxuICBfaGFuZGxlSWRlbnRpdHlDaGFuZ2VFdmVudChldnQpIHtcbiAgICBjb25zdCBpbmRleCA9IHRoaXMuX2dldEluZGV4KGV2dC50YXJnZXQuaWQpO1xuXG4gICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgaWYgKHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlKSB7XG4gICAgICAgIHRoaXMuZGF0YSA9IFtcbiAgICAgICAgICAuLi50aGlzLmRhdGEuc2xpY2UoMCwgaW5kZXgpLFxuICAgICAgICAgIGV2dC50YXJnZXQudG9PYmplY3QoKSxcbiAgICAgICAgICAuLi50aGlzLmRhdGEuc2xpY2UoaW5kZXggKyAxKSxcbiAgICAgICAgXTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgICB0eXBlOiAncHJvcGVydHknLFxuICAgICAgICB0YXJnZXQ6IHRoaXMuX2dldERhdGEoZXZ0LnRhcmdldCksXG4gICAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgICBpc0NoYW5nZTogdHJ1ZSxcbiAgICAgICAgY2hhbmdlczogZXZ0LmNoYW5nZXMsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBfaGFuZGxlSWRlbnRpdHlBZGRFdmVudChldnQpIHtcbiAgICBjb25zdCBsaXN0ID0gZXZ0LmlkZW50aXRpZXNcbiAgICAgIC5maWx0ZXIoaWRlbnRpdHkgPT4gdGhpcy5fZ2V0SW5kZXgoaWRlbnRpdHkuaWQpID09PSAtMSlcbiAgICAgIC5tYXAoaWRlbnRpdHkgPT4gdGhpcy5fZ2V0RGF0YShpZGVudGl0eSkpO1xuXG4gICAgLy8gQWRkIHRoZW0gdG8gb3VyIHJlc3VsdCBzZXQgYW5kIHRyaWdnZXIgYW4gZXZlbnQgZm9yIGVhY2ggb25lXG4gICAgaWYgKGxpc3QubGVuZ3RoKSB7XG4gICAgICBjb25zdCBkYXRhID0gdGhpcy5kYXRhID0gdGhpcy5kYXRhVHlwZSA9PT0gUXVlcnkuT2JqZWN0RGF0YVR5cGUgPyBbXS5jb25jYXQodGhpcy5kYXRhKSA6IHRoaXMuZGF0YTtcbiAgICAgIGxpc3QuZm9yRWFjaChpdGVtID0+IGRhdGEucHVzaChpdGVtKSk7XG5cbiAgICAgIHRoaXMudG90YWxTaXplICs9IGxpc3QubGVuZ3RoO1xuXG4gICAgICAvLyBJbmRleCBjYWxjdWxhdGVkIGFib3ZlIG1heSBzaGlmdCBhZnRlciBhZGRpdGlvbmFsIGluc2VydGlvbnMuICBUaGlzIGhhc1xuICAgICAgLy8gdG8gYmUgZG9uZSBhZnRlciB0aGUgYWJvdmUgaW5zZXJ0aW9ucyBoYXZlIGNvbXBsZXRlZC5cbiAgICAgIGxpc3QuZm9yRWFjaCgoaXRlbSkgPT4ge1xuICAgICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgICB0eXBlOiAnaW5zZXJ0JyxcbiAgICAgICAgICBpbmRleDogdGhpcy5kYXRhLmluZGV4T2YoaXRlbSksXG4gICAgICAgICAgdGFyZ2V0OiBpdGVtLFxuICAgICAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIF9oYW5kbGVJZGVudGl0eVJlbW92ZUV2ZW50KGV2dCkge1xuICAgIGNvbnN0IHJlbW92ZWQgPSBbXTtcbiAgICBldnQuaWRlbnRpdGllcy5mb3JFYWNoKChpZGVudGl0eSkgPT4ge1xuICAgICAgY29uc3QgaW5kZXggPSB0aGlzLl9nZXRJbmRleChpZGVudGl0eS5pZCk7XG4gICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgIGlmIChpZGVudGl0eS5pZCA9PT0gdGhpcy5fbmV4dERCRnJvbUlkKSB0aGlzLl9uZXh0REJGcm9tSWQgPSB0aGlzLl91cGRhdGVOZXh0RnJvbUlkKGluZGV4KTtcbiAgICAgICAgaWYgKGlkZW50aXR5LmlkID09PSB0aGlzLl9uZXh0U2VydmVyRnJvbUlkKSB0aGlzLl9uZXh0U2VydmVyRnJvbUlkID0gdGhpcy5fdXBkYXRlTmV4dEZyb21JZChpbmRleCk7XG4gICAgICAgIHJlbW92ZWQucHVzaCh7XG4gICAgICAgICAgZGF0YTogaWRlbnRpdHksXG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAodGhpcy5kYXRhVHlwZSA9PT0gUXVlcnkuT2JqZWN0RGF0YVR5cGUpIHtcbiAgICAgICAgICB0aGlzLmRhdGEgPSBbXG4gICAgICAgICAgICAuLi50aGlzLmRhdGEuc2xpY2UoMCwgaW5kZXgpLFxuICAgICAgICAgICAgLi4udGhpcy5kYXRhLnNsaWNlKGluZGV4ICsgMSksXG4gICAgICAgICAgXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmRhdGEuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy50b3RhbFNpemUgLT0gcmVtb3ZlZC5sZW5ndGg7XG4gICAgcmVtb3ZlZC5mb3JFYWNoKChyZW1vdmVkT2JqKSA9PiB7XG4gICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgdHlwZTogJ3JlbW92ZScsXG4gICAgICAgIHRhcmdldDogdGhpcy5fZ2V0RGF0YShyZW1vdmVkT2JqLmRhdGEpLFxuICAgICAgICBpbmRleDogcmVtb3ZlZE9iai5pbmRleCxcbiAgICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJZiB0aGUgY3VycmVudCBuZXh0LWlkIGlzIHJlbW92ZWQgZnJvbSB0aGUgbGlzdCwgZ2V0IGEgbmV3IG5leHRJZC5cbiAgICpcbiAgICogSWYgdGhlIGluZGV4IGlzIGdyZWF0ZXIgdGhhbiAwLCB3aGF0ZXZlciBpcyBhZnRlciB0aGF0IGluZGV4IG1heSBoYXZlIGNvbWUgZnJvbVxuICAgKiB3ZWJzb2NrZXRzIG9yIG90aGVyIHNvdXJjZXMsIHNvIGRlY3JlbWVudCB0aGUgaW5kZXggdG8gZ2V0IHRoZSBuZXh0IHNhZmUgcGFnaW5nIGlkLlxuICAgKlxuICAgKiBJZiB0aGUgaW5kZXggaWYgMCwgZXZlbiBpZiB0aGVyZSBpcyBkYXRhLCB0aGF0IGRhdGEgZGlkIG5vdCBjb21lIGZyb20gcGFnaW5nIGFuZFxuICAgKiBjYW4gbm90IGJlIHVzZWQgc2FmZWx5IGFzIGEgcGFnaW5nIGlkOyByZXR1cm4gJyc7XG4gICAqXG4gICAqIEBtZXRob2QgX3VwZGF0ZU5leHRGcm9tSWRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IC0gQ3VycmVudCBpbmRleCBvZiB0aGUgbmV4dEZyb21JZFxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSAtIE5leHQgSUQgb3IgZW1wdHkgc3RyaW5nXG4gICAqL1xuICBfdXBkYXRlTmV4dEZyb21JZChpbmRleCkge1xuICAgIGlmIChpbmRleCA+IDApIHJldHVybiB0aGlzLmRhdGFbaW5kZXggLSAxXS5pZDtcbiAgICBlbHNlIHJldHVybiAnJztcbiAgfVxuXG4gIC8qXG4gICAqIElmIHRoaXMgaXMgZXZlciBjaGFuZ2VkIHRvIGJlIGFzeW5jLCBtYWtlIHN1cmUgdGhhdCBkZXN0cm95KCkgc3RpbGwgdHJpZ2dlcnMgc3luY2hyb25vdXMgZXZlbnRzXG4gICAqL1xuICBfdHJpZ2dlckNoYW5nZShldnQpIHtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZScsIGV2dCk7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2U6JyArIGV2dC50eXBlLCBldnQpO1xuICB9XG5cbiAgdG9TdHJpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuaWQ7XG4gIH1cbn1cblxuXG5RdWVyeS5wcmVmaXhVVUlEID0gJ2xheWVyOi8vL3F1ZXJpZXMvJztcblxuLyoqXG4gKiBRdWVyeSBmb3IgQ29udmVyc2F0aW9ucy5cbiAqXG4gKiBVc2UgdGhpcyB2YWx1ZSBpbiB0aGUgbGF5ZXIuUXVlcnkubW9kZWwgcHJvcGVydHkuXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQHN0YXRpY1xuICovXG5RdWVyeS5Db252ZXJzYXRpb24gPSBDT05WRVJTQVRJT047XG5cbi8qKlxuICogUXVlcnkgZm9yIE1lc3NhZ2VzLlxuICpcbiAqIFVzZSB0aGlzIHZhbHVlIGluIHRoZSBsYXllci5RdWVyeS5tb2RlbCBwcm9wZXJ0eS5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAc3RhdGljXG4gKi9cblF1ZXJ5Lk1lc3NhZ2UgPSBNRVNTQUdFO1xuXG4vKipcbiAqIFF1ZXJ5IGZvciBBbm5vdW5jZW1lbnRzLlxuICpcbiAqIFVzZSB0aGlzIHZhbHVlIGluIHRoZSBsYXllci5RdWVyeS5tb2RlbCBwcm9wZXJ0eS5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAc3RhdGljXG4gKi9cblF1ZXJ5LkFubm91bmNlbWVudCA9IEFOTk9VTkNFTUVOVDtcblxuLyoqXG4gKiBRdWVyeSBmb3IgSWRlbnRpdGllcy5cbiAqXG4gKiBVc2UgdGhpcyB2YWx1ZSBpbiB0aGUgbGF5ZXIuUXVlcnkubW9kZWwgcHJvcGVydHkuXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQHN0YXRpY1xuICovXG5RdWVyeS5JZGVudGl0eSA9IElERU5USVRZO1xuXG4vKipcbiAqIEdldCBkYXRhIGFzIFBPSk9zL2ltbXV0YWJsZSBvYmplY3RzLlxuICpcbiAqIFRoaXMgdmFsdWUgb2YgbGF5ZXIuUXVlcnkuZGF0YVR5cGUgd2lsbCBjYXVzZSB5b3VyIFF1ZXJ5IGRhdGEgYW5kIGV2ZW50cyB0byBwcm92aWRlIE1lc3NhZ2VzL0NvbnZlcnNhdGlvbnMgYXMgaW1tdXRhYmxlIG9iamVjdHMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBzdGF0aWNcbiAqL1xuUXVlcnkuT2JqZWN0RGF0YVR5cGUgPSAnb2JqZWN0JztcblxuLyoqXG4gKiBHZXQgZGF0YSBhcyBpbnN0YW5jZXMgb2YgbGF5ZXIuTWVzc2FnZSBhbmQgbGF5ZXIuQ29udmVyc2F0aW9uLlxuICpcbiAqIFRoaXMgdmFsdWUgb2YgbGF5ZXIuUXVlcnkuZGF0YVR5cGUgd2lsbCBjYXVzZSB5b3VyIFF1ZXJ5IGRhdGEgYW5kIGV2ZW50cyB0byBwcm92aWRlIE1lc3NhZ2VzL0NvbnZlcnNhdGlvbnMgYXMgaW5zdGFuY2VzLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAc3RhdGljXG4gKi9cblF1ZXJ5Lkluc3RhbmNlRGF0YVR5cGUgPSAnaW5zdGFuY2UnO1xuXG4vKipcbiAqIFNldCB0aGUgbWF4aW11bSBwYWdlIHNpemUgZm9yIHF1ZXJpZXMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBzdGF0aWNcbiAqL1xuUXVlcnkuTWF4UGFnZVNpemUgPSAxMDA7XG5cbi8qKlxuICogU2V0IHRoZSBtYXhpbXVtIHBhZ2Ugc2l6ZSBmb3IgSWRlbnRpdHkgcXVlcmllcy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQHN0YXRpY1xuICovXG5RdWVyeS5NYXhQYWdlU2l6ZUlkZW50aXR5ID0gNTAwO1xuXG4vKipcbiAqIEFjY2VzcyB0aGUgbnVtYmVyIG9mIHJlc3VsdHMgY3VycmVudGx5IGxvYWRlZC5cbiAqXG4gKiBAdHlwZSB7TnVtYmVyfVxuICogQHJlYWRvbmx5XG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShRdWVyeS5wcm90b3R5cGUsICdzaXplJywge1xuICBlbnVtZXJhYmxlOiB0cnVlLFxuICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICByZXR1cm4gIXRoaXMuZGF0YSA/IDAgOiB0aGlzLmRhdGEubGVuZ3RoO1xuICB9LFxufSk7XG5cbi8qKiBBY2Nlc3MgdGhlIHRvdGFsIG51bWJlciBvZiByZXN1bHRzIG9uIHRoZSBzZXJ2ZXIuXG4gKlxuICogV2lsbCBiZSAwIHVudGlsIHRoZSBmaXJzdCBxdWVyeSBoYXMgc3VjY2Vzc2Z1bGx5IGxvYWRlZCByZXN1bHRzLlxuICpcbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKiBAcmVhZG9ubHlcbiAqL1xuUXVlcnkucHJvdG90eXBlLnRvdGFsU2l6ZSA9IDA7XG5cblxuLyoqXG4gKiBBY2Nlc3MgdG8gdGhlIGNsaWVudCBzbyBpdCBjYW4gbGlzdGVuIHRvIHdlYnNvY2tldCBhbmQgbG9jYWwgZXZlbnRzLlxuICpcbiAqIEB0eXBlIHtsYXllci5DbGllbnR9XG4gKiBAcHJvdGVjdGVkXG4gKiBAcmVhZG9ubHlcbiAqL1xuUXVlcnkucHJvdG90eXBlLmNsaWVudCA9IG51bGw7XG5cbi8qKlxuICogUXVlcnkgcmVzdWx0cy5cbiAqXG4gKiBBcnJheSBvZiBkYXRhIHJlc3VsdGluZyBmcm9tIHRoZSBRdWVyeTsgZWl0aGVyIGEgbGF5ZXIuUm9vdCBzdWJjbGFzcy5cbiAqXG4gKiBvciBwbGFpbiBPYmplY3RzXG4gKiBAdHlwZSB7T2JqZWN0W119XG4gKiBAcmVhZG9ubHlcbiAqL1xuUXVlcnkucHJvdG90eXBlLmRhdGEgPSBudWxsO1xuXG4vKipcbiAqIFNwZWNpZmllcyB0aGUgdHlwZSBvZiBkYXRhIGJlaW5nIHF1ZXJpZWQgZm9yLlxuICpcbiAqIE1vZGVsIGlzIG9uZSBvZlxuICpcbiAqICogbGF5ZXIuUXVlcnkuQ29udmVyc2F0aW9uXG4gKiAqIGxheWVyLlF1ZXJ5Lk1lc3NhZ2VcbiAqICogbGF5ZXIuUXVlcnkuQW5ub3VuY2VtZW50XG4gKiAqIGxheWVyLlF1ZXJ5LklkZW50aXR5XG4gKlxuICogVmFsdWUgY2FuIGJlIHNldCB2aWEgY29uc3RydWN0b3IgYW5kIGxheWVyLlF1ZXJ5LnVwZGF0ZSgpLlxuICpcbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAcmVhZG9ubHlcbiAqL1xuUXVlcnkucHJvdG90eXBlLm1vZGVsID0gJyc7XG5cbi8qKlxuICogV2hhdCB0eXBlIG9mIHJlc3VsdHMgdG8gcmVxdWVzdCBvZiB0aGUgc2VydmVyLlxuICpcbiAqIE5vdCB5ZXQgc3VwcG9ydGVkOyByZXR1cm5UeXBlIGlzIG9uZSBvZlxuICpcbiAqICogb2JqZWN0XG4gKiAqIGlkXG4gKiAqIGNvdW50XG4gKlxuICogIFZhbHVlIHNldCB2aWEgY29uc3RydWN0b3IuXG4gKyAqXG4gKiBUaGlzIFF1ZXJ5IEFQSSBpcyBkZXNpZ25lZCBvbmx5IGZvciB1c2Ugd2l0aCAnb2JqZWN0JyBhdCB0aGlzIHRpbWU7IHdhaXRpbmcgZm9yIHVwZGF0ZXMgdG8gc2VydmVyIGZvclxuICogdGhpcyBmdW5jdGlvbmFsaXR5LlxuICpcbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAcmVhZG9ubHlcbiAqL1xuUXVlcnkucHJvdG90eXBlLnJldHVyblR5cGUgPSAnb2JqZWN0JztcblxuLyoqXG4gKiBTcGVjaWZ5IHdoYXQga2luZCBvZiBkYXRhIGFycmF5IHlvdXIgYXBwbGljYXRpb24gcmVxdWlyZXMuXG4gKlxuICogVXNlZCB0byBzcGVjaWZ5IHF1ZXJ5IGRhdGFUeXBlLiAgT25lIG9mXG4gKiAqIFF1ZXJ5Lk9iamVjdERhdGFUeXBlXG4gKiAqIFF1ZXJ5Lkluc3RhbmNlRGF0YVR5cGVcbiAqXG4gKiBAdHlwZSB7U3RyaW5nfVxuICogQHJlYWRvbmx5XG4gKi9cblF1ZXJ5LnByb3RvdHlwZS5kYXRhVHlwZSA9IFF1ZXJ5Lkluc3RhbmNlRGF0YVR5cGU7XG5cbi8qKlxuICogTnVtYmVyIG9mIHJlc3VsdHMgZnJvbSB0aGUgc2VydmVyIHRvIHJlcXVlc3QvY2FjaGUuXG4gKlxuICogVGhlIHBhZ2luYXRpb24gd2luZG93IGNhbiBiZSBpbmNyZWFzZWQgdG8gZG93bmxvYWQgYWRkaXRpb25hbCBpdGVtcywgb3IgZGVjcmVhc2VkIHRvIHB1cmdlIHJlc3VsdHNcbiAqIGZyb20gdGhlIGRhdGEgcHJvcGVydHkuXG4gKlxuICogICAgIHF1ZXJ5LnVwZGF0ZSh7XG4gKiAgICAgICBwYWdpbmF0aW9uV2luZG93OiAxNTBcbiAqICAgICB9KVxuICpcbiAqIFRoaXMgY2FsbCB3aWxsIGFpbSB0byBhY2hpZXZlIDE1MCByZXN1bHRzLiAgSWYgaXQgcHJldmlvdXNseSBoYWQgMTAwLFxuICogdGhlbiBpdCB3aWxsIGxvYWQgNTAgbW9yZS4gSWYgaXQgcHJldmlvdXNseSBoYWQgMjAwLCBpdCB3aWxsIGRyb3AgNTAuXG4gKlxuICogTm90ZSB0aGF0IHRoZSBzZXJ2ZXIgd2lsbCBvbmx5IHBlcm1pdCAxMDAgYXQgYSB0aW1lLlxuICpcbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKiBAcmVhZG9ubHlcbiAqL1xuUXVlcnkucHJvdG90eXBlLnBhZ2luYXRpb25XaW5kb3cgPSAxMDA7XG5cbi8qKlxuICogU29ydGluZyBjcml0ZXJpYSBmb3IgQ29udmVyc2F0aW9uIFF1ZXJpZXMuXG4gKlxuICogT25seSBzdXBwb3J0cyBhbiBhcnJheSBvZiBvbmUgZmllbGQvZWxlbWVudC5cbiAqIE9ubHkgc3VwcG9ydHMgdGhlIGZvbGxvd2luZyBvcHRpb25zOlxuICpcbiAqICAgICBbeydjcmVhdGVkQXQnOiAnZGVzYyd9XVxuICogICAgIFt7J2xhc3RNZXNzYWdlLnNlbnRBdCc6ICdkZXNjJ31dXG4gKlxuICogV2h5IHN1Y2ggbGltaXRhdGlvbnM/IFdoeSB0aGlzIHN0cnVjdHVyZT8gIFRoZSBzZXJ2ZXIgd2lsbCBiZSBleHBvc2luZyBhIFF1ZXJ5IEFQSSBhdCB3aGljaCBwb2ludCB0aGVcbiAqIGFib3ZlIHNvcnQgb3B0aW9ucyB3aWxsIG1ha2UgYSBsb3QgbW9yZSBzZW5zZSwgYW5kIGZ1bGwgc29ydGluZyB3aWxsIGJlIHByb3ZpZGVkLlxuICpcbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAcmVhZG9ubHlcbiAqL1xuUXVlcnkucHJvdG90eXBlLnNvcnRCeSA9IG51bGw7XG5cbi8qKlxuICogVGhpcyB2YWx1ZSB0ZWxscyB1cyB3aGF0IHRvIHJlc2V0IHRoZSBwYWdpbmF0aW9uV2luZG93IHRvIHdoZW4gdGhlIHF1ZXJ5IGlzIHJlZGVmaW5lZC5cbiAqXG4gKiBAdHlwZSB7TnVtYmVyfVxuICogQHByaXZhdGVcbiAqL1xuUXVlcnkucHJvdG90eXBlLl9pbml0aWFsUGFnaW5hdGlvbldpbmRvdyA9IDEwMDtcblxuLyoqXG4gKiBZb3VyIFF1ZXJ5J3MgV0hFUkUgY2xhdXNlLlxuICpcbiAqIEN1cnJlbnRseSwgdGhlIG9ubHkgcXVlcnkgc3VwcG9ydGVkIGlzIFwiY29udmVyc2F0aW9uLmlkID0gJ2xheWVyOi8vL2NvbnZlcnNhdGlvbnMvdXVpZCdcIlxuICogTm90ZSB0aGF0IGJvdGggJyBhbmQgXCIgYXJlIHN1cHBvcnRlZC5cbiAqXG4gKiBDdXJyZW50bHksIHRoZSBvbmx5IHF1ZXJ5IHN1cHBvcnRlZCBpcyBgY29udmVyc2F0aW9uLmlkID0gJ2xheWVyOi8vL2NvbnZlcnNhdGlvbnMvdXVpZCdgXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEByZWFkb25seVxuICovXG5RdWVyeS5wcm90b3R5cGUucHJlZGljYXRlID0gbnVsbDtcblxuLyoqXG4gKiBUcnVlIGlmIHRoZSBRdWVyeSBpcyBjb25uZWN0aW5nIHRvIHRoZSBzZXJ2ZXIuXG4gKlxuICogSXQgaXMgbm90IGdhdXJlbnRlZWQgdGhhdCBldmVyeSBgdXBkYXRlKClgIHdpbGwgZmlyZSBhIHJlcXVlc3QgdG8gdGhlIHNlcnZlci5cbiAqIEZvciBleGFtcGxlLCB1cGRhdGluZyBhIHBhZ2luYXRpb25XaW5kb3cgdG8gYmUgc21hbGxlcixcbiAqIE9yIGNoYW5naW5nIGEgdmFsdWUgdG8gdGhlIGV4aXN0aW5nIHZhbHVlIHdvdWxkIGNhdXNlIHRoZSByZXF1ZXN0IG5vdCB0byBmaXJlLlxuICpcbiAqIFJlY29tbWVuZGVkIHBhdHRlcm4gaXM6XG4gKlxuICogICAgICBxdWVyeS51cGRhdGUoe3BhZ2luYXRpb25XaW5kb3c6IDUwfSk7XG4gKiAgICAgIGlmICghcXVlcnkuaXNGaXJpbmcpIHtcbiAqICAgICAgICBhbGVydChcIkRvbmVcIik7XG4gKiAgICAgIH0gZWxzZSB7XG4gKiAgICAgICAgICBxdWVyeS5vbmNlKFwiY2hhbmdlXCIsIGZ1bmN0aW9uKGV2dCkge1xuICogICAgICAgICAgICBpZiAoZXZ0LnR5cGUgPT0gXCJkYXRhXCIpIGFsZXJ0KFwiRG9uZVwiKTtcbiAqICAgICAgICAgIH0pO1xuICogICAgICB9XG4gKlxuICogQHR5cGUge0Jvb2xlYW59XG4gKiBAcmVhZG9ubHlcbiAqL1xuUXVlcnkucHJvdG90eXBlLmlzRmlyaW5nID0gZmFsc2U7XG5cbi8qKlxuICogVHJ1ZSBpZiB3ZSBoYXZlIHJlYWNoZWQgdGhlIGxhc3QgcmVzdWx0LCBhbmQgZnVydGhlciBwYWdpbmcgd2lsbCBqdXN0IHJldHVybiBbXVxuICpcbiAqIEB0eXBlIHtCb29sZWFufVxuICogQHJlYWRvbmx5XG4gKi9cblF1ZXJ5LnByb3RvdHlwZS5wYWdlZFRvRW5kID0gZmFsc2U7XG5cbi8qKlxuICogVGhlIGxhc3QgcmVxdWVzdCBmaXJlZC5cbiAqXG4gKiBJZiBtdWx0aXBsZSByZXF1ZXN0cyBhcmUgaW5mbGlnaHQsIHRoZSByZXNwb25zZVxuICogbWF0Y2hpbmcgdGhpcyByZXF1ZXN0IGlzIHRoZSBPTkxZIHJlc3BvbnNlIHdlIHdpbGwgcHJvY2Vzcy5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAcHJpdmF0ZVxuICovXG5RdWVyeS5wcm90b3R5cGUuX2ZpcmluZ1JlcXVlc3QgPSAnJztcblxuLyoqXG4gKiBUaGUgSUQgdG8gdXNlIGluIHBhZ2luZyB0aGUgc2VydmVyLlxuICpcbiAqIFdoeSBub3QganVzdCB1c2UgdGhlIElEIG9mIHRoZSBsYXN0IGl0ZW0gaW4gb3VyIHJlc3VsdCBzZXQ/XG4gKiBCZWNhdXNlIGFzIHdlIHJlY2VpdmUgd2Vic29ja2V0IGV2ZW50cywgd2UgaW5zZXJ0IGFuZCBhcHBlbmQgaXRlbXMgdG8gb3VyIGRhdGEuXG4gKiBUaGF0IHdlYnNvY2tldCBldmVudCBtYXkgbm90IGluIGZhY3QgZGVsaXZlciB0aGUgTkVYVCBpdGVtIGluIG91ciBkYXRhLCBidXQgc2ltcGx5IGFuIGl0ZW0sIHRoYXQgc2VxdWVudGlhbGx5XG4gKiBiZWxvbmdzIGF0IHRoZSBlbmQgZGVzcGl0ZSBza2lwcGluZyBvdmVyIG90aGVyIGl0ZW1zIG9mIGRhdGEuICBQYWdpbmcgc2hvdWxkIG5vdCBiZSBmcm9tIHRoaXMgbmV3IGl0ZW0sIGJ1dFxuICogb25seSB0aGUgbGFzdCBpdGVtIHB1bGxlZCB2aWEgdGhpcyBxdWVyeSBmcm9tIHRoZSBzZXJ2ZXIuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuUXVlcnkucHJvdG90eXBlLl9uZXh0U2VydmVyRnJvbUlkID0gJyc7XG5cbi8qKlxuICogVGhlIElEIHRvIHVzZSBpbiBwYWdpbmcgdGhlIGRhdGFiYXNlLlxuICpcbiAqIFdoeSBub3QganVzdCB1c2UgdGhlIElEIG9mIHRoZSBsYXN0IGl0ZW0gaW4gb3VyIHJlc3VsdCBzZXQ/XG4gKiBCZWNhdXNlIGFzIHdlIHJlY2VpdmUgd2Vic29ja2V0IGV2ZW50cywgd2UgaW5zZXJ0IGFuZCBhcHBlbmQgaXRlbXMgdG8gb3VyIGRhdGEuXG4gKiBUaGF0IHdlYnNvY2tldCBldmVudCBtYXkgbm90IGluIGZhY3QgZGVsaXZlciB0aGUgTkVYVCBpdGVtIGluIG91ciBkYXRhLCBidXQgc2ltcGx5IGFuIGl0ZW0sIHRoYXQgc2VxdWVudGlhbGx5XG4gKiBiZWxvbmdzIGF0IHRoZSBlbmQgZGVzcGl0ZSBza2lwcGluZyBvdmVyIG90aGVyIGl0ZW1zIG9mIGRhdGEuICBQYWdpbmcgc2hvdWxkIG5vdCBiZSBmcm9tIHRoaXMgbmV3IGl0ZW0sIGJ1dFxuICogb25seSB0aGUgbGFzdCBpdGVtIHB1bGxlZCB2aWEgdGhpcyBxdWVyeSBmcm9tIHRoZSBkYXRhYmFzZS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5RdWVyeS5wcm90b3R5cGUuX25leHREQkZyb21JZCA9ICcnO1xuXG5cblF1ZXJ5Ll9zdXBwb3J0ZWRFdmVudHMgPSBbXG4gIC8qKlxuICAgKiBUaGUgcXVlcnkgZGF0YSBoYXMgY2hhbmdlZDsgYW55IGNoYW5nZSBldmVudCB3aWxsIGNhdXNlIHRoaXMgZXZlbnQgdG8gdHJpZ2dlci5cbiAgICogQGV2ZW50IGNoYW5nZVxuICAgKi9cbiAgJ2NoYW5nZScsXG5cbiAgLyoqXG4gICAqIEEgbmV3IHBhZ2Ugb2YgZGF0YSBoYXMgYmVlbiBsb2FkZWQgZnJvbSB0aGUgc2VydmVyXG4gICAqIEBldmVudCAnY2hhbmdlOmRhdGEnXG4gICAqL1xuICAnY2hhbmdlOmRhdGEnLFxuXG4gIC8qKlxuICAgKiBBbGwgZGF0YSBmb3IgdGhpcyBxdWVyeSBoYXMgYmVlbiByZXNldCBkdWUgdG8gYSBjaGFuZ2UgaW4gdGhlIFF1ZXJ5IHByZWRpY2F0ZS5cbiAgICogQGV2ZW50ICdjaGFuZ2U6cmVzZXQnXG4gICAqL1xuICAnY2hhbmdlOnJlc2V0JyxcblxuICAvKipcbiAgICogQW4gaXRlbSBvZiBkYXRhIHdpdGhpbiB0aGlzIFF1ZXJ5IGhhcyBoYWQgYSBwcm9wZXJ0eSBjaGFuZ2UgaXRzIHZhbHVlLlxuICAgKiBAZXZlbnQgJ2NoYW5nZTpwcm9wZXJ0eSdcbiAgICovXG4gICdjaGFuZ2U6cHJvcGVydHknLFxuXG4gIC8qKlxuICAgKiBBIG5ldyBpdGVtIG9mIGRhdGEgaGFzIGJlZW4gaW5zZXJ0ZWQgaW50byB0aGUgUXVlcnkuIE5vdCB0cmlnZ2VyZWQgYnkgbG9hZGluZ1xuICAgKiBhIG5ldyBwYWdlIG9mIGRhdGEgZnJvbSB0aGUgc2VydmVyLCBidXQgaXMgdHJpZ2dlcmVkIGJ5IGxvY2FsbHkgY3JlYXRpbmcgYSBtYXRjaGluZ1xuICAgKiBpdGVtIG9mIGRhdGEsIG9yIHJlY2VpdmluZyBhIG5ldyBpdGVtIG9mIGRhdGEgdmlhIHdlYnNvY2tldC5cbiAgICogQGV2ZW50ICdjaGFuZ2U6aW5zZXJ0J1xuICAgKi9cbiAgJ2NoYW5nZTppbnNlcnQnLFxuXG4gIC8qKlxuICAgKiBBbiBpdGVtIG9mIGRhdGEgaGFzIGJlZW4gcmVtb3ZlZCBmcm9tIHRoZSBRdWVyeS4gTm90IHRyaWdnZXJlZCBmb3IgZXZlcnkgcmVtb3ZhbCwgYnV0XG4gICAqIGlzIHRyaWdnZXJlZCBieSBsb2NhbGx5IGRlbGV0aW5nIGEgcmVzdWx0LCBvciByZWNlaXZpbmcgYSByZXBvcnQgb2YgZGVsZXRpb24gdmlhIHdlYnNvY2tldC5cbiAgICogQGV2ZW50ICdjaGFuZ2U6cmVtb3ZlJ1xuICAgKi9cbiAgJ2NoYW5nZTpyZW1vdmUnLFxuXG4gIC8qKlxuICAgKiBUaGUgcXVlcnkgZGF0YSBmYWlsZWQgdG8gbG9hZCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqIEBldmVudCBlcnJvclxuICAgKi9cbiAgJ2Vycm9yJyxcblxuXS5jb25jYXQoUm9vdC5fc3VwcG9ydGVkRXZlbnRzKTtcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoUXVlcnksIFtRdWVyeSwgJ1F1ZXJ5J10pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFF1ZXJ5O1xuIl19
