'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The Announcement class represents a type of Message sent by a server.
 *
 * Announcements can not be sent using the WebSDK, only received.
 *
 * You should never need to instantiate an Announcement; they should only be
 * delivered via `messages:add` events when an Announcement is provided via
 * websocket to the client, and `change` events on an Announcements Query.
 *
 * @class  layer.Announcement
 * @extends layer.Message
 */

var Message = require('./message');
var Syncable = require('./syncable');
var Root = require('./root');
var LayerError = require('./layer-error');

var Announcement = function (_Message) {
  _inherits(Announcement, _Message);

  function Announcement() {
    _classCallCheck(this, Announcement);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Announcement).apply(this, arguments));
  }

  _createClass(Announcement, [{
    key: 'send',
    value: function send() {}
  }, {
    key: 'getConversation',
    value: function getConversation() {}
  }, {
    key: '_sendReceipt',
    value: function _sendReceipt() {}
  }, {
    key: '_loaded',
    value: function _loaded(data) {
      this.getClient()._addMessage(this);
    }

    /**
     * Delete the Announcement from the server.
     *
     * @method delete
     */

  }, {
    key: 'delete',
    value: function _delete() {
      if (this.isDestroyed) throw new Error(LayerError.dictionary.isDestroyed);

      var id = this.id;
      var client = this.getClient();
      this._xhr({
        url: '',
        method: 'DELETE'
      }, function (result) {
        if (!result.success && (!result.data || result.data.id !== 'not_found')) Syncable.load(id, client);
      });

      this._deleted();
      this.destroy();
    }

    /**
     * Creates an Announcement from the server's representation of an Announcement.
     *
     * Similar to _populateFromServer, however, this method takes a
     * message description and returns a new message instance using _populateFromServer
     * to setup the values.
     *
     * @method _createFromServer
     * @protected
     * @static
     * @param  {Object} message - Server's representation of the announcement
     * @return {layer.Announcement}
     */

  }], [{
    key: '_createFromServer',
    value: function _createFromServer(message, client) {
      var fromWebsocket = message.fromWebsocket;
      return new Announcement({
        fromServer: message,
        clientId: client.appId,
        _notify: fromWebsocket && message.is_unread
      });
    }
  }]);

  return Announcement;
}(Message);

Announcement.prefixUUID = 'layer:///announcements/';

Announcement.inObjectIgnore = Message.inObjectIgnore;

Announcement.bubbleEventParent = 'getClient';

Announcement._supportedEvents = [].concat(Message._supportedEvents);

Root.initClass.apply(Announcement, [Announcement, 'Announcement']);
Syncable.subclasses.push(Announcement);
module.exports = Announcement;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9hbm5vdW5jZW1lbnQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUNBOzs7Ozs7Ozs7Ozs7O0FBYUEsSUFBTSxVQUFVLFFBQVEsV0FBUixDQUFoQjtBQUNBLElBQU0sV0FBVyxRQUFRLFlBQVIsQ0FBakI7QUFDQSxJQUFNLE9BQU8sUUFBUSxRQUFSLENBQWI7QUFDQSxJQUFNLGFBQWEsUUFBUSxlQUFSLENBQW5COztJQUdNLFk7Ozs7Ozs7Ozs7OzJCQUNHLENBQUU7OztzQ0FDUyxDQUFFOzs7bUNBRUwsQ0FBRTs7OzRCQUVULEksRUFBTTtBQUNaLFdBQUssU0FBTCxHQUFpQixXQUFqQixDQUE2QixJQUE3QjtBQUNEOztBQUVEOzs7Ozs7Ozs4QkFLUztBQUNQLFVBQUksS0FBSyxXQUFULEVBQXNCLE1BQU0sSUFBSSxLQUFKLENBQVUsV0FBVyxVQUFYLENBQXNCLFdBQWhDLENBQU47O0FBRXRCLFVBQU0sS0FBSyxLQUFLLEVBQWhCO0FBQ0EsVUFBTSxTQUFTLEtBQUssU0FBTCxFQUFmO0FBQ0EsV0FBSyxJQUFMLENBQVU7QUFDUixhQUFLLEVBREc7QUFFUixnQkFBUTtBQUZBLE9BQVYsRUFHRyxrQkFBVTtBQUNYLFlBQUksQ0FBQyxPQUFPLE9BQVIsS0FBb0IsQ0FBQyxPQUFPLElBQVIsSUFBZ0IsT0FBTyxJQUFQLENBQVksRUFBWixLQUFtQixXQUF2RCxDQUFKLEVBQXlFLFNBQVMsSUFBVCxDQUFjLEVBQWQsRUFBa0IsTUFBbEI7QUFDMUUsT0FMRDs7QUFPQSxXQUFLLFFBQUw7QUFDQSxXQUFLLE9BQUw7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7OztzQ0FheUIsTyxFQUFTLE0sRUFBUTtBQUN4QyxVQUFNLGdCQUFnQixRQUFRLGFBQTlCO0FBQ0EsYUFBTyxJQUFJLFlBQUosQ0FBaUI7QUFDdEIsb0JBQVksT0FEVTtBQUV0QixrQkFBVSxPQUFPLEtBRks7QUFHdEIsaUJBQVMsaUJBQWlCLFFBQVE7QUFIWixPQUFqQixDQUFQO0FBS0Q7Ozs7RUFuRHdCLE87O0FBc0QzQixhQUFhLFVBQWIsR0FBMEIseUJBQTFCOztBQUVBLGFBQWEsY0FBYixHQUE4QixRQUFRLGNBQXRDOztBQUVBLGFBQWEsaUJBQWIsR0FBaUMsV0FBakM7O0FBRUEsYUFBYSxnQkFBYixHQUFnQyxHQUFHLE1BQUgsQ0FBVSxRQUFRLGdCQUFsQixDQUFoQzs7QUFFQSxLQUFLLFNBQUwsQ0FBZSxLQUFmLENBQXFCLFlBQXJCLEVBQW1DLENBQUMsWUFBRCxFQUFlLGNBQWYsQ0FBbkM7QUFDQSxTQUFTLFVBQVQsQ0FBb0IsSUFBcEIsQ0FBeUIsWUFBekI7QUFDQSxPQUFPLE9BQVAsR0FBaUIsWUFBakIiLCJmaWxlIjoiYW5ub3VuY2VtZW50LmpzIiwic291cmNlc0NvbnRlbnQiOlsiXG4vKipcbiAqIFRoZSBBbm5vdW5jZW1lbnQgY2xhc3MgcmVwcmVzZW50cyBhIHR5cGUgb2YgTWVzc2FnZSBzZW50IGJ5IGEgc2VydmVyLlxuICpcbiAqIEFubm91bmNlbWVudHMgY2FuIG5vdCBiZSBzZW50IHVzaW5nIHRoZSBXZWJTREssIG9ubHkgcmVjZWl2ZWQuXG4gKlxuICogWW91IHNob3VsZCBuZXZlciBuZWVkIHRvIGluc3RhbnRpYXRlIGFuIEFubm91bmNlbWVudDsgdGhleSBzaG91bGQgb25seSBiZVxuICogZGVsaXZlcmVkIHZpYSBgbWVzc2FnZXM6YWRkYCBldmVudHMgd2hlbiBhbiBBbm5vdW5jZW1lbnQgaXMgcHJvdmlkZWQgdmlhXG4gKiB3ZWJzb2NrZXQgdG8gdGhlIGNsaWVudCwgYW5kIGBjaGFuZ2VgIGV2ZW50cyBvbiBhbiBBbm5vdW5jZW1lbnRzIFF1ZXJ5LlxuICpcbiAqIEBjbGFzcyAgbGF5ZXIuQW5ub3VuY2VtZW50XG4gKiBAZXh0ZW5kcyBsYXllci5NZXNzYWdlXG4gKi9cblxuY29uc3QgTWVzc2FnZSA9IHJlcXVpcmUoJy4vbWVzc2FnZScpO1xuY29uc3QgU3luY2FibGUgPSByZXF1aXJlKCcuL3N5bmNhYmxlJyk7XG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi9yb290Jyk7XG5jb25zdCBMYXllckVycm9yID0gcmVxdWlyZSgnLi9sYXllci1lcnJvcicpO1xuXG5cbmNsYXNzIEFubm91bmNlbWVudCBleHRlbmRzIE1lc3NhZ2Uge1xuICBzZW5kKCkge31cbiAgZ2V0Q29udmVyc2F0aW9uKCkge31cblxuICBfc2VuZFJlY2VpcHQoKSB7fVxuXG4gIF9sb2FkZWQoZGF0YSkge1xuICAgIHRoaXMuZ2V0Q2xpZW50KCkuX2FkZE1lc3NhZ2UodGhpcyk7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIHRoZSBBbm5vdW5jZW1lbnQgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBAbWV0aG9kIGRlbGV0ZVxuICAgKi9cbiAgZGVsZXRlKCkge1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkKSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmlzRGVzdHJveWVkKTtcblxuICAgIGNvbnN0IGlkID0gdGhpcy5pZDtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLmdldENsaWVudCgpO1xuICAgIHRoaXMuX3hocih7XG4gICAgICB1cmw6ICcnLFxuICAgICAgbWV0aG9kOiAnREVMRVRFJyxcbiAgICB9LCByZXN1bHQgPT4ge1xuICAgICAgaWYgKCFyZXN1bHQuc3VjY2VzcyAmJiAoIXJlc3VsdC5kYXRhIHx8IHJlc3VsdC5kYXRhLmlkICE9PSAnbm90X2ZvdW5kJykpIFN5bmNhYmxlLmxvYWQoaWQsIGNsaWVudCk7XG4gICAgfSk7XG5cbiAgICB0aGlzLl9kZWxldGVkKCk7XG4gICAgdGhpcy5kZXN0cm95KCk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBBbm5vdW5jZW1lbnQgZnJvbSB0aGUgc2VydmVyJ3MgcmVwcmVzZW50YXRpb24gb2YgYW4gQW5ub3VuY2VtZW50LlxuICAgKlxuICAgKiBTaW1pbGFyIHRvIF9wb3B1bGF0ZUZyb21TZXJ2ZXIsIGhvd2V2ZXIsIHRoaXMgbWV0aG9kIHRha2VzIGFcbiAgICogbWVzc2FnZSBkZXNjcmlwdGlvbiBhbmQgcmV0dXJucyBhIG5ldyBtZXNzYWdlIGluc3RhbmNlIHVzaW5nIF9wb3B1bGF0ZUZyb21TZXJ2ZXJcbiAgICogdG8gc2V0dXAgdGhlIHZhbHVlcy5cbiAgICpcbiAgICogQG1ldGhvZCBfY3JlYXRlRnJvbVNlcnZlclxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBzdGF0aWNcbiAgICogQHBhcmFtICB7T2JqZWN0fSBtZXNzYWdlIC0gU2VydmVyJ3MgcmVwcmVzZW50YXRpb24gb2YgdGhlIGFubm91bmNlbWVudFxuICAgKiBAcmV0dXJuIHtsYXllci5Bbm5vdW5jZW1lbnR9XG4gICAqL1xuICBzdGF0aWMgX2NyZWF0ZUZyb21TZXJ2ZXIobWVzc2FnZSwgY2xpZW50KSB7XG4gICAgY29uc3QgZnJvbVdlYnNvY2tldCA9IG1lc3NhZ2UuZnJvbVdlYnNvY2tldDtcbiAgICByZXR1cm4gbmV3IEFubm91bmNlbWVudCh7XG4gICAgICBmcm9tU2VydmVyOiBtZXNzYWdlLFxuICAgICAgY2xpZW50SWQ6IGNsaWVudC5hcHBJZCxcbiAgICAgIF9ub3RpZnk6IGZyb21XZWJzb2NrZXQgJiYgbWVzc2FnZS5pc191bnJlYWQsXG4gICAgfSk7XG4gIH1cbn1cblxuQW5ub3VuY2VtZW50LnByZWZpeFVVSUQgPSAnbGF5ZXI6Ly8vYW5ub3VuY2VtZW50cy8nO1xuXG5Bbm5vdW5jZW1lbnQuaW5PYmplY3RJZ25vcmUgPSBNZXNzYWdlLmluT2JqZWN0SWdub3JlO1xuXG5Bbm5vdW5jZW1lbnQuYnViYmxlRXZlbnRQYXJlbnQgPSAnZ2V0Q2xpZW50JztcblxuQW5ub3VuY2VtZW50Ll9zdXBwb3J0ZWRFdmVudHMgPSBbXS5jb25jYXQoTWVzc2FnZS5fc3VwcG9ydGVkRXZlbnRzKTtcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoQW5ub3VuY2VtZW50LCBbQW5ub3VuY2VtZW50LCAnQW5ub3VuY2VtZW50J10pO1xuU3luY2FibGUuc3ViY2xhc3Nlcy5wdXNoKEFubm91bmNlbWVudCk7XG5tb2R1bGUuZXhwb3J0cyA9IEFubm91bmNlbWVudDtcbiJdfQ==
