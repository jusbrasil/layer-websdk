'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Query = require('./query');
var LayerError = require('./layer-error');

/**
 * Query builder class generating queries for a set of messages.
 * Used in Creating and Updating layer.Query instances.
 *
 * Using the Query Builder, we should be able to instantiate a Query
 *
 *      var qBuilder = QueryBuilder
 *       .messages()
 *       .forConversation('layer:///conversations/ffffffff-ffff-ffff-ffff-ffffffffffff')
 *       .paginationWindow(100);
 *      var query = client.createQuery(qBuilder);
 *
 *
 * You can then create additional builders and update the query:
 *
 *      var qBuilder2 = QueryBuilder
 *       .messages()
 *       .forConversation('layer:///conversations/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
 *       .paginationWindow(200);
 *      query.update(qBuilder);
 *
 * @class layer.QueryBuilder.MessagesQuery
 */

var MessagesQuery = function () {

  /**
   * Creates a new query builder for a set of messages.
   *
   * Standard use is without any arguments.
   *
   * @method constructor
   * @param  {Object} [query=null]
   */
  function MessagesQuery(query) {
    _classCallCheck(this, MessagesQuery);

    if (query) {
      this._query = {
        model: query.model,
        returnType: query.returnType,
        dataType: query.dataType,
        paginationWindow: query.paginationWindow
      };
    } else {
      this._query = {
        model: Query.Message,
        returnType: 'object',
        dataType: 'object',
        paginationWindow: Query.prototype.paginationWindow
      };
    }

    // TODO remove when messages can be fetched via query API rather than `GET /messages`
    this._conversationIdSet = false;
  }

  /**
   * Query for messages in this Conversation.
   *
   * @method forConversation
   * @param  {String} conversationId
   */


  _createClass(MessagesQuery, [{
    key: 'forConversation',
    value: function forConversation(conversationId) {
      if (conversationId) {
        this._query.predicate = 'conversation.id = \'' + conversationId + '\'';
        this._conversationIdSet = true;
      } else {
        this._query.predicate = '';
        this._conversationIdSet = false;
      }
      return this;
    }

    /**
     * Sets the pagination window/number of messages to fetch from the local cache or server.
     *
     * Currently only positive integers are supported.
     *
     * @method paginationWindow
     * @param  {number} win
     */

  }, {
    key: 'paginationWindow',
    value: function paginationWindow(win) {
      this._query.paginationWindow = win;
      return this;
    }

    /**
     * Returns the built query object to send to the server.
     *
     * Called by layer.QueryBuilder. You should not need to call this.
     *
     * @method build
     */

  }, {
    key: 'build',
    value: function build() {
      return this._query;
    }
  }]);

  return MessagesQuery;
}();

/**
 * Query builder class generating queries for a set of Announcements.
 *
 * To get started:
 *
 *      var qBuilder = QueryBuilder
 *       .announcements()
 *       .paginationWindow(100);
 *      var query = client.createQuery(qBuilder);
 *
 * @class layer.QueryBuilder.AnnouncementsQuery
 * @extends layer.QueryBuilder.MessagesQuery
 */


var AnnouncementsQuery = function (_MessagesQuery) {
  _inherits(AnnouncementsQuery, _MessagesQuery);

  function AnnouncementsQuery(options) {
    _classCallCheck(this, AnnouncementsQuery);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(AnnouncementsQuery).call(this, options));

    _this._query.model = Query.Announcement;
    return _this;
  }

  _createClass(AnnouncementsQuery, [{
    key: 'build',
    value: function build() {
      return this._query;
    }
  }]);

  return AnnouncementsQuery;
}(MessagesQuery);

/**
 * Query builder class generating queries for a set of Conversations.
 *
 * Used in Creating and Updating layer.Query instances.
 *
 * To get started:
 *
 *      var qBuilder = QueryBuilder
 *       .conversations()
 *       .paginationWindow(100);
 *      var query = client.createQuery(qBuilder);
 *
 * You can then create additional builders and update the query:
 *
 *      var qBuilder2 = QueryBuilder
 *       .conversations()
 *       .paginationWindow(200);
 *      query.update(qBuilder);
 *
 * @class layer.QueryBuilder.ConversationsQuery
 */


var ConversationsQuery = function () {

  /**
   * Creates a new query builder for a set of conversations.
   *
   * Standard use is without any arguments.
   *
   * @method constructor
   * @param  {Object} [query=null]
   */
  function ConversationsQuery(query) {
    _classCallCheck(this, ConversationsQuery);

    if (query) {
      this._query = {
        model: query.model,
        returnType: query.returnType,
        dataType: query.dataType,
        paginationWindow: query.paginationWindow,
        sortBy: query.sortBy
      };
    } else {
      this._query = {
        model: Query.Conversation,
        returnType: 'object',
        dataType: 'object',
        paginationWindow: Query.prototype.paginationWindow,
        sortBy: null
      };
    }
  }

  /**
   * Sets the pagination window/number of messages to fetch from the local cache or server.
   *
   * Currently only positive integers are supported.
   *
   * @method paginationWindow
   * @param  {number} win
   * @return {layer.QueryBuilder} this
   */


  _createClass(ConversationsQuery, [{
    key: 'paginationWindow',
    value: function paginationWindow(win) {
      this._query.paginationWindow = win;
      return this;
    }

    /**
     * Sets the sorting options for the Conversation.
     *
     * Currently only supports descending order
     * Currently only supports fieldNames of "createdAt" and "lastMessage.sentAt"
     *
     * @method sortBy
     * @param  {string} fieldName  - field to sort by
     * @param  {boolean} asc - Is an ascending sort?
     * @return {layer.QueryBuilder} this
     */

  }, {
    key: 'sortBy',
    value: function sortBy(fieldName) {
      var asc = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];

      this._query.sortBy = [_defineProperty({}, fieldName, asc ? 'asc' : 'desc')];
      return this;
    }

    /**
     * Returns the built query object to send to the server.
     *
     * Called by layer.QueryBuilder. You should not need to call this.
     *
     * @method build
     */

  }, {
    key: 'build',
    value: function build() {
      return this._query;
    }
  }]);

  return ConversationsQuery;
}();

/**
 * Query builder class generating queries for a set of Identities followed by this user.
 *
 * Used in Creating and Updating layer.Query instances.
 *
 * To get started:
 *
 *      var qBuilder = QueryBuilder
 *       .identities()
 *       .paginationWindow(100);
 *      var query = client.createQuery(qBuilder);
 *
 * @class layer.QueryBuilder.IdentitiesQuery
 */


var IdentitiesQuery = function () {

  /**
   * Creates a new query builder for a set of conversations.
   *
   * Standard use is without any arguments.
   *
   * @method constructor
   * @param  {Object} [query=null]
   */
  function IdentitiesQuery(query) {
    _classCallCheck(this, IdentitiesQuery);

    if (query) {
      this._query = {
        model: query.model,
        returnType: query.returnType,
        dataType: query.dataType,
        paginationWindow: query.paginationWindow
      };
    } else {
      this._query = {
        model: Query.Identity,
        returnType: 'object',
        dataType: 'object',
        paginationWindow: Query.prototype.paginationWindow
      };
    }
  }

  /**
   * Sets the pagination window/number of messages to fetch from the local cache or server.
   *
   * Currently only positive integers are supported.
   *
   * @method paginationWindow
   * @param  {number} win
   * @return {layer.QueryBuilder} this
   */


  _createClass(IdentitiesQuery, [{
    key: 'paginationWindow',
    value: function paginationWindow(win) {
      this._query.paginationWindow = win;
      return this;
    }

    /**
     * Returns the built query object to send to the server.
     *
     * Called by layer.QueryBuilder. You should not need to call this.
     *
     * @method build
     */

  }, {
    key: 'build',
    value: function build() {
      return this._query;
    }
  }]);

  return IdentitiesQuery;
}();

/**
 * Query builder class. Used with layer.Query to specify what local/remote
 * data changes to subscribe to.  For examples, see layer.QueryBuilder.MessagesQuery
 * and layer.QueryBuilder.ConversationsQuery.  This static class is used to instantiate
 * MessagesQuery and ConversationsQuery Builder instances:
 *
 *      var conversationsQueryBuilder = QueryBuilder.conversations();
 *      var messagesQueryBuidler = QueryBuilder.messages();
 *
 * Should you use these instead of directly using the layer.Query class?
 * That is a matter of programming style and preference, there is no
 * correct answer.
 *
 * @class layer.QueryBuilder
 */


var QueryBuilder = {

  /**
   * Create a new layer.MessagesQuery instance.
   *
   * @method messages
   * @static
   * @returns {layer.QueryBuilder.MessagesQuery}
   */
  messages: function messages() {
    return new MessagesQuery();
  },


  /**
   * Create a new layer.AnnouncementsQuery instance.
   *
   * @method announcements
   * @returns {layer.QueryBuilder.AnnouncementsQuery}
   */
  announcements: function announcements() {
    return new AnnouncementsQuery();
  },


  /**
   * Create a new layer.ConversationsQuery instance.
   *
   * @method conversations
   * @static
   * @returns {layer.QueryBuilder.ConversationsQuery}
   */
  conversations: function conversations() {
    return new ConversationsQuery();
  },


  /**
   * Create a new layer.IdentitiesQuery instance.
   *
   * @method identities
   * @returns {layer.QueryBuilder.IdentitiesQuery}
   */
  identities: function identities() {
    return new IdentitiesQuery();
  },


  /**
   * Takes the return value of QueryBuilder.prototype.build and creates a
   * new QueryBuilder.
   *
   * Used within layer.Query.prototype.toBuilder.
   *
   * @method fromQueryObject
   * @private
   * @param {Object} obj
   * @static
   */
  fromQueryObject: function fromQueryObject(obj) {
    switch (obj.model) {
      case Query.Message:
        return new MessagesQuery(obj);
      case Query.Announcement:
        return new AnnouncementsQuery(obj);
      case Query.Conversation:
        return new ConversationsQuery(obj);
      case Query.Identity:
        return new IdentitiesQuery(obj);
      default:
        return null;
    }
  }
};

module.exports = QueryBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9xdWVyeS1idWlsZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBLElBQU0sUUFBUSxRQUFRLFNBQVIsQ0FBZDtBQUNBLElBQU0sYUFBYSxRQUFRLGVBQVIsQ0FBbkI7O0FBRUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQXVCTSxhOztBQUVKOzs7Ozs7OztBQVFBLHlCQUFZLEtBQVosRUFBbUI7QUFBQTs7QUFDakIsUUFBSSxLQUFKLEVBQVc7QUFDVCxXQUFLLE1BQUwsR0FBYztBQUNaLGVBQU8sTUFBTSxLQUREO0FBRVosb0JBQVksTUFBTSxVQUZOO0FBR1osa0JBQVUsTUFBTSxRQUhKO0FBSVosMEJBQWtCLE1BQU07QUFKWixPQUFkO0FBTUQsS0FQRCxNQU9PO0FBQ0wsV0FBSyxNQUFMLEdBQWM7QUFDWixlQUFPLE1BQU0sT0FERDtBQUVaLG9CQUFZLFFBRkE7QUFHWixrQkFBVSxRQUhFO0FBSVosMEJBQWtCLE1BQU0sU0FBTixDQUFnQjtBQUp0QixPQUFkO0FBTUQ7O0FBRUQ7QUFDQSxTQUFLLGtCQUFMLEdBQTBCLEtBQTFCO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7b0NBTWdCLGMsRUFBZ0I7QUFDOUIsVUFBSSxjQUFKLEVBQW9CO0FBQ2xCLGFBQUssTUFBTCxDQUFZLFNBQVosNEJBQThDLGNBQTlDO0FBQ0EsYUFBSyxrQkFBTCxHQUEwQixJQUExQjtBQUNELE9BSEQsTUFHTztBQUNMLGFBQUssTUFBTCxDQUFZLFNBQVosR0FBd0IsRUFBeEI7QUFDQSxhQUFLLGtCQUFMLEdBQTBCLEtBQTFCO0FBQ0Q7QUFDRCxhQUFPLElBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7cUNBUWlCLEcsRUFBSztBQUNwQixXQUFLLE1BQUwsQ0FBWSxnQkFBWixHQUErQixHQUEvQjtBQUNBLGFBQU8sSUFBUDtBQUNEOztBQUVEOzs7Ozs7Ozs7OzRCQU9RO0FBQ04sYUFBTyxLQUFLLE1BQVo7QUFDRDs7Ozs7O0FBR0g7Ozs7Ozs7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QkFBSixDQUF1QixHQUF2QixDQUFQO0FBQ0YsV0FBSyxNQUFNLFlBQVg7QUFDRSxlQUFPLElBQUksa0JBQUosQ0FBdUIsR0FBdkIsQ0FBUDtBQUNGLFdBQUssTUFBTSxRQUFYO0FBQ0UsZUFBTyxJQUFJLGVBQUosQ0FBb0IsR0FBcEIsQ0FBUDtBQUNGO0FBQ0UsZUFBTyxJQUFQO0FBVko7QUFZRDtBQXBFa0IsQ0FBckI7O0FBdUVBLE9BQU8sT0FBUCxHQUFpQixZQUFqQiIsImZpbGUiOiJxdWVyeS1idWlsZGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgUXVlcnkgPSByZXF1aXJlKCcuL3F1ZXJ5Jyk7XG5jb25zdCBMYXllckVycm9yID0gcmVxdWlyZSgnLi9sYXllci1lcnJvcicpO1xuXG4vKipcbiAqIFF1ZXJ5IGJ1aWxkZXIgY2xhc3MgZ2VuZXJhdGluZyBxdWVyaWVzIGZvciBhIHNldCBvZiBtZXNzYWdlcy5cbiAqIFVzZWQgaW4gQ3JlYXRpbmcgYW5kIFVwZGF0aW5nIGxheWVyLlF1ZXJ5IGluc3RhbmNlcy5cbiAqXG4gKiBVc2luZyB0aGUgUXVlcnkgQnVpbGRlciwgd2Ugc2hvdWxkIGJlIGFibGUgdG8gaW5zdGFudGlhdGUgYSBRdWVyeVxuICpcbiAqICAgICAgdmFyIHFCdWlsZGVyID0gUXVlcnlCdWlsZGVyXG4gKiAgICAgICAubWVzc2FnZXMoKVxuICogICAgICAgLmZvckNvbnZlcnNhdGlvbignbGF5ZXI6Ly8vY29udmVyc2F0aW9ucy9mZmZmZmZmZi1mZmZmLWZmZmYtZmZmZi1mZmZmZmZmZmZmZmYnKVxuICogICAgICAgLnBhZ2luYXRpb25XaW5kb3coMTAwKTtcbiAqICAgICAgdmFyIHF1ZXJ5ID0gY2xpZW50LmNyZWF0ZVF1ZXJ5KHFCdWlsZGVyKTtcbiAqXG4gKlxuICogWW91IGNhbiB0aGVuIGNyZWF0ZSBhZGRpdGlvbmFsIGJ1aWxkZXJzIGFuZCB1cGRhdGUgdGhlIHF1ZXJ5OlxuICpcbiAqICAgICAgdmFyIHFCdWlsZGVyMiA9IFF1ZXJ5QnVpbGRlclxuICogICAgICAgLm1lc3NhZ2VzKClcbiAqICAgICAgIC5mb3JDb252ZXJzYXRpb24oJ2xheWVyOi8vL2NvbnZlcnNhdGlvbnMvYmJiYmJiYmItYmJiYi1iYmJiLWJiYmItYmJiYmJiYmJiYmJiJylcbiAqICAgICAgIC5wYWdpbmF0aW9uV2luZG93KDIwMCk7XG4gKiAgICAgIHF1ZXJ5LnVwZGF0ZShxQnVpbGRlcik7XG4gKlxuICogQGNsYXNzIGxheWVyLlF1ZXJ5QnVpbGRlci5NZXNzYWdlc1F1ZXJ5XG4gKi9cbmNsYXNzIE1lc3NhZ2VzUXVlcnkge1xuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IHF1ZXJ5IGJ1aWxkZXIgZm9yIGEgc2V0IG9mIG1lc3NhZ2VzLlxuICAgKlxuICAgKiBTdGFuZGFyZCB1c2UgaXMgd2l0aG91dCBhbnkgYXJndW1lbnRzLlxuICAgKlxuICAgKiBAbWV0aG9kIGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSAge09iamVjdH0gW3F1ZXJ5PW51bGxdXG4gICAqL1xuICBjb25zdHJ1Y3RvcihxdWVyeSkge1xuICAgIGlmIChxdWVyeSkge1xuICAgICAgdGhpcy5fcXVlcnkgPSB7XG4gICAgICAgIG1vZGVsOiBxdWVyeS5tb2RlbCxcbiAgICAgICAgcmV0dXJuVHlwZTogcXVlcnkucmV0dXJuVHlwZSxcbiAgICAgICAgZGF0YVR5cGU6IHF1ZXJ5LmRhdGFUeXBlLFxuICAgICAgICBwYWdpbmF0aW9uV2luZG93OiBxdWVyeS5wYWdpbmF0aW9uV2luZG93LFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcXVlcnkgPSB7XG4gICAgICAgIG1vZGVsOiBRdWVyeS5NZXNzYWdlLFxuICAgICAgICByZXR1cm5UeXBlOiAnb2JqZWN0JyxcbiAgICAgICAgZGF0YVR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwYWdpbmF0aW9uV2luZG93OiBRdWVyeS5wcm90b3R5cGUucGFnaW5hdGlvbldpbmRvdyxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gVE9ETyByZW1vdmUgd2hlbiBtZXNzYWdlcyBjYW4gYmUgZmV0Y2hlZCB2aWEgcXVlcnkgQVBJIHJhdGhlciB0aGFuIGBHRVQgL21lc3NhZ2VzYFxuICAgIHRoaXMuX2NvbnZlcnNhdGlvbklkU2V0ID0gZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogUXVlcnkgZm9yIG1lc3NhZ2VzIGluIHRoaXMgQ29udmVyc2F0aW9uLlxuICAgKlxuICAgKiBAbWV0aG9kIGZvckNvbnZlcnNhdGlvblxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IGNvbnZlcnNhdGlvbklkXG4gICAqL1xuICBmb3JDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQpIHtcbiAgICBpZiAoY29udmVyc2F0aW9uSWQpIHtcbiAgICAgIHRoaXMuX3F1ZXJ5LnByZWRpY2F0ZSA9IGBjb252ZXJzYXRpb24uaWQgPSAnJHtjb252ZXJzYXRpb25JZH0nYDtcbiAgICAgIHRoaXMuX2NvbnZlcnNhdGlvbklkU2V0ID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcXVlcnkucHJlZGljYXRlID0gJyc7XG4gICAgICB0aGlzLl9jb252ZXJzYXRpb25JZFNldCA9IGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBwYWdpbmF0aW9uIHdpbmRvdy9udW1iZXIgb2YgbWVzc2FnZXMgdG8gZmV0Y2ggZnJvbSB0aGUgbG9jYWwgY2FjaGUgb3Igc2VydmVyLlxuICAgKlxuICAgKiBDdXJyZW50bHkgb25seSBwb3NpdGl2ZSBpbnRlZ2VycyBhcmUgc3VwcG9ydGVkLlxuICAgKlxuICAgKiBAbWV0aG9kIHBhZ2luYXRpb25XaW5kb3dcbiAgICogQHBhcmFtICB7bnVtYmVyfSB3aW5cbiAgICovXG4gIHBhZ2luYXRpb25XaW5kb3cod2luKSB7XG4gICAgdGhpcy5fcXVlcnkucGFnaW5hdGlvbldpbmRvdyA9IHdpbjtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBidWlsdCBxdWVyeSBvYmplY3QgdG8gc2VuZCB0byB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBDYWxsZWQgYnkgbGF5ZXIuUXVlcnlCdWlsZGVyLiBZb3Ugc2hvdWxkIG5vdCBuZWVkIHRvIGNhbGwgdGhpcy5cbiAgICpcbiAgICogQG1ldGhvZCBidWlsZFxuICAgKi9cbiAgYnVpbGQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3F1ZXJ5O1xuICB9XG59XG5cbi8qKlxuICogUXVlcnkgYnVpbGRlciBjbGFzcyBnZW5lcmF0aW5nIHF1ZXJpZXMgZm9yIGEgc2V0IG9mIEFubm91bmNlbWVudHMuXG4gKlxuICogVG8gZ2V0IHN0YXJ0ZWQ6XG4gKlxuICogICAgICB2YXIgcUJ1aWxkZXIgPSBRdWVyeUJ1aWxkZXJcbiAqICAgICAgIC5hbm5vdW5jZW1lbnRzKClcbiAqICAgICAgIC5wYWdpbmF0aW9uV2luZG93KDEwMCk7XG4gKiAgICAgIHZhciBxdWVyeSA9IGNsaWVudC5jcmVhdGVRdWVyeShxQnVpbGRlcik7XG4gKlxuICogQGNsYXNzIGxheWVyLlF1ZXJ5QnVpbGRlci5Bbm5vdW5jZW1lbnRzUXVlcnlcbiAqIEBleHRlbmRzIGxheWVyLlF1ZXJ5QnVpbGRlci5NZXNzYWdlc1F1ZXJ5XG4gKi9cbmNsYXNzIEFubm91bmNlbWVudHNRdWVyeSBleHRlbmRzIE1lc3NhZ2VzUXVlcnkge1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fcXVlcnkubW9kZWwgPSBRdWVyeS5Bbm5vdW5jZW1lbnQ7XG4gIH1cbiAgYnVpbGQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3F1ZXJ5O1xuICB9XG59XG5cbi8qKlxuICogUXVlcnkgYnVpbGRlciBjbGFzcyBnZW5lcmF0aW5nIHF1ZXJpZXMgZm9yIGEgc2V0IG9mIENvbnZlcnNhdGlvbnMuXG4gKlxuICogVXNlZCBpbiBDcmVhdGluZyBhbmQgVXBkYXRpbmcgbGF5ZXIuUXVlcnkgaW5zdGFuY2VzLlxuICpcbiAqIFRvIGdldCBzdGFydGVkOlxuICpcbiAqICAgICAgdmFyIHFCdWlsZGVyID0gUXVlcnlCdWlsZGVyXG4gKiAgICAgICAuY29udmVyc2F0aW9ucygpXG4gKiAgICAgICAucGFnaW5hdGlvbldpbmRvdygxMDApO1xuICogICAgICB2YXIgcXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkocUJ1aWxkZXIpO1xuICpcbiAqIFlvdSBjYW4gdGhlbiBjcmVhdGUgYWRkaXRpb25hbCBidWlsZGVycyBhbmQgdXBkYXRlIHRoZSBxdWVyeTpcbiAqXG4gKiAgICAgIHZhciBxQnVpbGRlcjIgPSBRdWVyeUJ1aWxkZXJcbiAqICAgICAgIC5jb252ZXJzYXRpb25zKClcbiAqICAgICAgIC5wYWdpbmF0aW9uV2luZG93KDIwMCk7XG4gKiAgICAgIHF1ZXJ5LnVwZGF0ZShxQnVpbGRlcik7XG4gKlxuICogQGNsYXNzIGxheWVyLlF1ZXJ5QnVpbGRlci5Db252ZXJzYXRpb25zUXVlcnlcbiAqL1xuY2xhc3MgQ29udmVyc2F0aW9uc1F1ZXJ5IHtcblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBxdWVyeSBidWlsZGVyIGZvciBhIHNldCBvZiBjb252ZXJzYXRpb25zLlxuICAgKlxuICAgKiBTdGFuZGFyZCB1c2UgaXMgd2l0aG91dCBhbnkgYXJndW1lbnRzLlxuICAgKlxuICAgKiBAbWV0aG9kIGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSAge09iamVjdH0gW3F1ZXJ5PW51bGxdXG4gICAqL1xuICBjb25zdHJ1Y3RvcihxdWVyeSkge1xuICAgIGlmIChxdWVyeSkge1xuICAgICAgdGhpcy5fcXVlcnkgPSB7XG4gICAgICAgIG1vZGVsOiBxdWVyeS5tb2RlbCxcbiAgICAgICAgcmV0dXJuVHlwZTogcXVlcnkucmV0dXJuVHlwZSxcbiAgICAgICAgZGF0YVR5cGU6IHF1ZXJ5LmRhdGFUeXBlLFxuICAgICAgICBwYWdpbmF0aW9uV2luZG93OiBxdWVyeS5wYWdpbmF0aW9uV2luZG93LFxuICAgICAgICBzb3J0Qnk6IHF1ZXJ5LnNvcnRCeSxcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3F1ZXJ5ID0ge1xuICAgICAgICBtb2RlbDogUXVlcnkuQ29udmVyc2F0aW9uLFxuICAgICAgICByZXR1cm5UeXBlOiAnb2JqZWN0JyxcbiAgICAgICAgZGF0YVR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwYWdpbmF0aW9uV2luZG93OiBRdWVyeS5wcm90b3R5cGUucGFnaW5hdGlvbldpbmRvdyxcbiAgICAgICAgc29ydEJ5OiBudWxsLFxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgcGFnaW5hdGlvbiB3aW5kb3cvbnVtYmVyIG9mIG1lc3NhZ2VzIHRvIGZldGNoIGZyb20gdGhlIGxvY2FsIGNhY2hlIG9yIHNlcnZlci5cbiAgICpcbiAgICogQ3VycmVudGx5IG9ubHkgcG9zaXRpdmUgaW50ZWdlcnMgYXJlIHN1cHBvcnRlZC5cbiAgICpcbiAgICogQG1ldGhvZCBwYWdpbmF0aW9uV2luZG93XG4gICAqIEBwYXJhbSAge251bWJlcn0gd2luXG4gICAqIEByZXR1cm4ge2xheWVyLlF1ZXJ5QnVpbGRlcn0gdGhpc1xuICAgKi9cbiAgcGFnaW5hdGlvbldpbmRvdyh3aW4pIHtcbiAgICB0aGlzLl9xdWVyeS5wYWdpbmF0aW9uV2luZG93ID0gd2luO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIHNvcnRpbmcgb3B0aW9ucyBmb3IgdGhlIENvbnZlcnNhdGlvbi5cbiAgICpcbiAgICogQ3VycmVudGx5IG9ubHkgc3VwcG9ydHMgZGVzY2VuZGluZyBvcmRlclxuICAgKiBDdXJyZW50bHkgb25seSBzdXBwb3J0cyBmaWVsZE5hbWVzIG9mIFwiY3JlYXRlZEF0XCIgYW5kIFwibGFzdE1lc3NhZ2Uuc2VudEF0XCJcbiAgICpcbiAgICogQG1ldGhvZCBzb3J0QnlcbiAgICogQHBhcmFtICB7c3RyaW5nfSBmaWVsZE5hbWUgIC0gZmllbGQgdG8gc29ydCBieVxuICAgKiBAcGFyYW0gIHtib29sZWFufSBhc2MgLSBJcyBhbiBhc2NlbmRpbmcgc29ydD9cbiAgICogQHJldHVybiB7bGF5ZXIuUXVlcnlCdWlsZGVyfSB0aGlzXG4gICAqL1xuICBzb3J0QnkoZmllbGROYW1lLCBhc2MgPSBmYWxzZSkge1xuICAgIHRoaXMuX3F1ZXJ5LnNvcnRCeSA9IFt7IFtmaWVsZE5hbWVdOiBhc2MgPyAnYXNjJyA6ICdkZXNjJyB9XTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBidWlsdCBxdWVyeSBvYmplY3QgdG8gc2VuZCB0byB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBDYWxsZWQgYnkgbGF5ZXIuUXVlcnlCdWlsZGVyLiBZb3Ugc2hvdWxkIG5vdCBuZWVkIHRvIGNhbGwgdGhpcy5cbiAgICpcbiAgICogQG1ldGhvZCBidWlsZFxuICAgKi9cbiAgYnVpbGQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3F1ZXJ5O1xuICB9XG59XG5cblxuLyoqXG4gKiBRdWVyeSBidWlsZGVyIGNsYXNzIGdlbmVyYXRpbmcgcXVlcmllcyBmb3IgYSBzZXQgb2YgSWRlbnRpdGllcyBmb2xsb3dlZCBieSB0aGlzIHVzZXIuXG4gKlxuICogVXNlZCBpbiBDcmVhdGluZyBhbmQgVXBkYXRpbmcgbGF5ZXIuUXVlcnkgaW5zdGFuY2VzLlxuICpcbiAqIFRvIGdldCBzdGFydGVkOlxuICpcbiAqICAgICAgdmFyIHFCdWlsZGVyID0gUXVlcnlCdWlsZGVyXG4gKiAgICAgICAuaWRlbnRpdGllcygpXG4gKiAgICAgICAucGFnaW5hdGlvbldpbmRvdygxMDApO1xuICogICAgICB2YXIgcXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkocUJ1aWxkZXIpO1xuICpcbiAqIEBjbGFzcyBsYXllci5RdWVyeUJ1aWxkZXIuSWRlbnRpdGllc1F1ZXJ5XG4gKi9cbmNsYXNzIElkZW50aXRpZXNRdWVyeSB7XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgcXVlcnkgYnVpbGRlciBmb3IgYSBzZXQgb2YgY29udmVyc2F0aW9ucy5cbiAgICpcbiAgICogU3RhbmRhcmQgdXNlIGlzIHdpdGhvdXQgYW55IGFyZ3VtZW50cy5cbiAgICpcbiAgICogQG1ldGhvZCBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0gIHtPYmplY3R9IFtxdWVyeT1udWxsXVxuICAgKi9cbiAgY29uc3RydWN0b3IocXVlcnkpIHtcbiAgICBpZiAocXVlcnkpIHtcbiAgICAgIHRoaXMuX3F1ZXJ5ID0ge1xuICAgICAgICBtb2RlbDogcXVlcnkubW9kZWwsXG4gICAgICAgIHJldHVyblR5cGU6IHF1ZXJ5LnJldHVyblR5cGUsXG4gICAgICAgIGRhdGFUeXBlOiBxdWVyeS5kYXRhVHlwZSxcbiAgICAgICAgcGFnaW5hdGlvbldpbmRvdzogcXVlcnkucGFnaW5hdGlvbldpbmRvdyxcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3F1ZXJ5ID0ge1xuICAgICAgICBtb2RlbDogUXVlcnkuSWRlbnRpdHksXG4gICAgICAgIHJldHVyblR5cGU6ICdvYmplY3QnLFxuICAgICAgICBkYXRhVHlwZTogJ29iamVjdCcsXG4gICAgICAgIHBhZ2luYXRpb25XaW5kb3c6IFF1ZXJ5LnByb3RvdHlwZS5wYWdpbmF0aW9uV2luZG93LFxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgcGFnaW5hdGlvbiB3aW5kb3cvbnVtYmVyIG9mIG1lc3NhZ2VzIHRvIGZldGNoIGZyb20gdGhlIGxvY2FsIGNhY2hlIG9yIHNlcnZlci5cbiAgICpcbiAgICogQ3VycmVudGx5IG9ubHkgcG9zaXRpdmUgaW50ZWdlcnMgYXJlIHN1cHBvcnRlZC5cbiAgICpcbiAgICogQG1ldGhvZCBwYWdpbmF0aW9uV2luZG93XG4gICAqIEBwYXJhbSAge251bWJlcn0gd2luXG4gICAqIEByZXR1cm4ge2xheWVyLlF1ZXJ5QnVpbGRlcn0gdGhpc1xuICAgKi9cbiAgcGFnaW5hdGlvbldpbmRvdyh3aW4pIHtcbiAgICB0aGlzLl9xdWVyeS5wYWdpbmF0aW9uV2luZG93ID0gd2luO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIGJ1aWx0IHF1ZXJ5IG9iamVjdCB0byBzZW5kIHRvIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIENhbGxlZCBieSBsYXllci5RdWVyeUJ1aWxkZXIuIFlvdSBzaG91bGQgbm90IG5lZWQgdG8gY2FsbCB0aGlzLlxuICAgKlxuICAgKiBAbWV0aG9kIGJ1aWxkXG4gICAqL1xuICBidWlsZCgpIHtcbiAgICByZXR1cm4gdGhpcy5fcXVlcnk7XG4gIH1cbn1cblxuLyoqXG4gKiBRdWVyeSBidWlsZGVyIGNsYXNzLiBVc2VkIHdpdGggbGF5ZXIuUXVlcnkgdG8gc3BlY2lmeSB3aGF0IGxvY2FsL3JlbW90ZVxuICogZGF0YSBjaGFuZ2VzIHRvIHN1YnNjcmliZSB0by4gIEZvciBleGFtcGxlcywgc2VlIGxheWVyLlF1ZXJ5QnVpbGRlci5NZXNzYWdlc1F1ZXJ5XG4gKiBhbmQgbGF5ZXIuUXVlcnlCdWlsZGVyLkNvbnZlcnNhdGlvbnNRdWVyeS4gIFRoaXMgc3RhdGljIGNsYXNzIGlzIHVzZWQgdG8gaW5zdGFudGlhdGVcbiAqIE1lc3NhZ2VzUXVlcnkgYW5kIENvbnZlcnNhdGlvbnNRdWVyeSBCdWlsZGVyIGluc3RhbmNlczpcbiAqXG4gKiAgICAgIHZhciBjb252ZXJzYXRpb25zUXVlcnlCdWlsZGVyID0gUXVlcnlCdWlsZGVyLmNvbnZlcnNhdGlvbnMoKTtcbiAqICAgICAgdmFyIG1lc3NhZ2VzUXVlcnlCdWlkbGVyID0gUXVlcnlCdWlsZGVyLm1lc3NhZ2VzKCk7XG4gKlxuICogU2hvdWxkIHlvdSB1c2UgdGhlc2UgaW5zdGVhZCBvZiBkaXJlY3RseSB1c2luZyB0aGUgbGF5ZXIuUXVlcnkgY2xhc3M/XG4gKiBUaGF0IGlzIGEgbWF0dGVyIG9mIHByb2dyYW1taW5nIHN0eWxlIGFuZCBwcmVmZXJlbmNlLCB0aGVyZSBpcyBub1xuICogY29ycmVjdCBhbnN3ZXIuXG4gKlxuICogQGNsYXNzIGxheWVyLlF1ZXJ5QnVpbGRlclxuICovXG5jb25zdCBRdWVyeUJ1aWxkZXIgPSB7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBsYXllci5NZXNzYWdlc1F1ZXJ5IGluc3RhbmNlLlxuICAgKlxuICAgKiBAbWV0aG9kIG1lc3NhZ2VzXG4gICAqIEBzdGF0aWNcbiAgICogQHJldHVybnMge2xheWVyLlF1ZXJ5QnVpbGRlci5NZXNzYWdlc1F1ZXJ5fVxuICAgKi9cbiAgbWVzc2FnZXMoKSB7XG4gICAgcmV0dXJuIG5ldyBNZXNzYWdlc1F1ZXJ5KCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBsYXllci5Bbm5vdW5jZW1lbnRzUXVlcnkgaW5zdGFuY2UuXG4gICAqXG4gICAqIEBtZXRob2QgYW5ub3VuY2VtZW50c1xuICAgKiBAcmV0dXJucyB7bGF5ZXIuUXVlcnlCdWlsZGVyLkFubm91bmNlbWVudHNRdWVyeX1cbiAgICovXG4gIGFubm91bmNlbWVudHMoKSB7XG4gICAgcmV0dXJuIG5ldyBBbm5vdW5jZW1lbnRzUXVlcnkoKTtcbiAgfSxcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGxheWVyLkNvbnZlcnNhdGlvbnNRdWVyeSBpbnN0YW5jZS5cbiAgICpcbiAgICogQG1ldGhvZCBjb252ZXJzYXRpb25zXG4gICAqIEBzdGF0aWNcbiAgICogQHJldHVybnMge2xheWVyLlF1ZXJ5QnVpbGRlci5Db252ZXJzYXRpb25zUXVlcnl9XG4gICAqL1xuICBjb252ZXJzYXRpb25zKCkge1xuICAgIHJldHVybiBuZXcgQ29udmVyc2F0aW9uc1F1ZXJ5KCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBsYXllci5JZGVudGl0aWVzUXVlcnkgaW5zdGFuY2UuXG4gICAqXG4gICAqIEBtZXRob2QgaWRlbnRpdGllc1xuICAgKiBAcmV0dXJucyB7bGF5ZXIuUXVlcnlCdWlsZGVyLklkZW50aXRpZXNRdWVyeX1cbiAgICovXG4gIGlkZW50aXRpZXMoKSB7XG4gICAgcmV0dXJuIG5ldyBJZGVudGl0aWVzUXVlcnkoKTtcbiAgfSxcblxuICAvKipcbiAgICogVGFrZXMgdGhlIHJldHVybiB2YWx1ZSBvZiBRdWVyeUJ1aWxkZXIucHJvdG90eXBlLmJ1aWxkIGFuZCBjcmVhdGVzIGFcbiAgICogbmV3IFF1ZXJ5QnVpbGRlci5cbiAgICpcbiAgICogVXNlZCB3aXRoaW4gbGF5ZXIuUXVlcnkucHJvdG90eXBlLnRvQnVpbGRlci5cbiAgICpcbiAgICogQG1ldGhvZCBmcm9tUXVlcnlPYmplY3RcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtPYmplY3R9IG9ialxuICAgKiBAc3RhdGljXG4gICAqL1xuICBmcm9tUXVlcnlPYmplY3Qob2JqKSB7XG4gICAgc3dpdGNoIChvYmoubW9kZWwpIHtcbiAgICAgIGNhc2UgUXVlcnkuTWVzc2FnZTpcbiAgICAgICAgcmV0dXJuIG5ldyBNZXNzYWdlc1F1ZXJ5KG9iaik7XG4gICAgICBjYXNlIFF1ZXJ5LkFubm91bmNlbWVudDpcbiAgICAgICAgcmV0dXJuIG5ldyBBbm5vdW5jZW1lbnRzUXVlcnkob2JqKTtcbiAgICAgIGNhc2UgUXVlcnkuQ29udmVyc2F0aW9uOlxuICAgICAgICByZXR1cm4gbmV3IENvbnZlcnNhdGlvbnNRdWVyeShvYmopO1xuICAgICAgY2FzZSBRdWVyeS5JZGVudGl0eTpcbiAgICAgICAgcmV0dXJuIG5ldyBJZGVudGl0aWVzUXVlcnkob2JqKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfSxcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUXVlcnlCdWlsZGVyO1xuXG4iXX0=
