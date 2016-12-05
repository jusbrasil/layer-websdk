'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * @class  layer.Websockets.ChangeManager
 * @private
 *
 * This class listens for `change` events from the websocket server,
 * and processes them.
 */
var Utils = require('../client-utils');
var logger = require('../logger');
var Message = require('../message');
var Conversation = require('../conversation');

var WebsocketChangeManager = function () {
  /**
   * Create a new websocket change manager
   *
   *      var websocketChangeManager = new layer.Websockets.ChangeManager({
   *          client: client,
   *          socketManager: client.Websockets.SocketManager
   *      });
   *
   * @method
   * @param  {Object} options
   * @param {layer.Client} client
   * @param {layer.Websockets.SocketManager} socketManager
   * @returns {layer.Websockets.ChangeManager}
   */
  function WebsocketChangeManager(options) {
    _classCallCheck(this, WebsocketChangeManager);

    this.client = options.client;
    options.socketManager.on('message', this._handleChange, this);
  }

  /**
   * Handles a Change packet from the server.
   *
   * @method _handleChange
   * @private
   * @param  {layer.LayerEvent} evt
   */


  _createClass(WebsocketChangeManager, [{
    key: '_handleChange',
    value: function _handleChange(evt) {
      if (evt.data.type === 'change') {
        var msg = evt.data.body;
        switch (msg.operation) {
          case 'create':
            logger.info('Websocket Change Event: Create ' + msg.object.type + ' ' + msg.object.id);
            logger.debug(msg.data);
            this._handleCreate(msg);
            break;
          case 'delete':
            logger.info('Websocket Change Event: Delete ' + msg.object.type + ' ' + msg.object.id);
            logger.debug(msg.data);
            this._handleDelete(msg);
            break;
          case 'update':
            logger.info('Websocket Change Event: Patch ' + msg.object.type + ' ' + msg.object.id + ': ' + msg.data.map(function (op) {
              return op.property;
            }).join(', '));
            logger.debug(msg.data);
            this._handlePatch(msg);
            break;
        }
      }
    }

    /**
     * Process a create object message from the server
     *
     * @method _handleCreate
     * @private
     * @param  {Object} msg
     */

  }, {
    key: '_handleCreate',
    value: function _handleCreate(msg) {
      msg.data.fromWebsocket = true;
      this.client._createObject(msg.data);
    }

    /**
     * Handles delete object messages from the server.
     * All objects that can be deleted from the server should
     * provide a _deleted() method to be called prior to destroy().
     *
     * @method _handleDelete
     * @private
     * @param  {Object} msg
     */

  }, {
    key: '_handleDelete',
    value: function _handleDelete(msg) {
      var entity = this._getObject(msg);
      if (entity) {
        entity._handleWebsocketDelete(msg.data);
      }
    }

    /**
     * On receiving an update/patch message from the server
     * run the LayerParser on the data.
     *
     * @method _handlePatch
     * @private
     * @param  {Object} msg
     */

  }, {
    key: '_handlePatch',
    value: function _handlePatch(msg) {
      // Can only patch a cached object
      var entity = this._getObject(msg);
      if (entity) {
        try {
          entity._inLayerParser = true;
          Utils.layerParse({
            object: entity,
            type: msg.object.type,
            operations: msg.data,
            client: this.client
          });
          entity._inLayerParser = false;
        } catch (err) {
          logger.error('websocket-manager: Failed to handle event', msg.data);
        }
      } else {
        switch (Utils.typeFromID(msg.object.id)) {
          case 'conversations':
            if (Conversation._loadResourceForPatch(msg.data)) this.client.getConversation(msg.object.id, true);
            break;
          case 'messages':
            if (Message._loadResourceForPatch(msg.data)) this.client.getMessage(msg.object.id, true);
            break;
          case 'announcements':
            break;
        }
      }
    }

    /**
     * Get the object specified by the `object` property of the websocket packet.
     *
     * @method _getObject
     * @private
     * @param  {Object} msg
     * @return {layer.Root}
     */

  }, {
    key: '_getObject',
    value: function _getObject(msg) {
      return this.client._getObject(msg.object.id);
    }

    /**
     * Not required, but destroy is best practice
     * @method destroy
     */

  }, {
    key: 'destroy',
    value: function destroy() {
      this.client = null;
    }
  }]);

  return WebsocketChangeManager;
}();

/**
 * The Client that owns this.
 * @type {layer.Client}
 */


WebsocketChangeManager.prototype.client = null;

module.exports = WebsocketChangeManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy93ZWJzb2NrZXRzL2NoYW5nZS1tYW5hZ2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBOzs7Ozs7O0FBT0EsSUFBTSxRQUFRLFFBQVEsaUJBQVIsQ0FBZDtBQUNBLElBQU0sU0FBUyxRQUFRLFdBQVIsQ0FBZjtBQUNBLElBQU0sVUFBVSxRQUFRLFlBQVIsQ0FBaEI7QUFDQSxJQUFNLGVBQWUsUUFBUSxpQkFBUixDQUFyQjs7SUFHTSxzQjtBQUNKOzs7Ozs7Ozs7Ozs7OztBQWNBLGtDQUFZLE9BQVosRUFBcUI7QUFBQTs7QUFDbkIsU0FBSyxNQUFMLEdBQWMsUUFBUSxNQUF0QjtBQUNBLFlBQVEsYUFBUixDQUFzQixFQUF0QixDQUF5QixTQUF6QixFQUFvQyxLQUFLLGFBQXpDLEVBQXdELElBQXhEO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7O2tDQU9jLEcsRUFBSztBQUNqQixVQUFJLElBQUksSUFBSixDQUFTLElBQVQsS0FBa0IsUUFBdEIsRUFBZ0M7QUFDOUIsWUFBTSxNQUFNLElBQUksSUFBSixDQUFTLElBQXJCO0FBQ0EsZ0JBQVEsSUFBSSxTQUFaO0FBQ0UsZUFBSyxRQUFMO0FBQ0UsbUJBQU8sSUFBUCxxQ0FBOEMsSUFBSSxNQUFKLENBQVcsSUFBekQsU0FBaUUsSUFBSSxNQUFKLENBQVcsRUFBNUU7QUFDQSxtQkFBTyxLQUFQLENBQWEsSUFBSSxJQUFqQjtBQUNBLGlCQUFLLGFBQUwsQ0FBbUIsR0FBbkI7QUFDQTtBQUNGLGVBQUssUUFBTDtBQUNFLG1CQUFPLElBQVAscUNBQThDLElBQUksTUFBSixDQUFXLElBQXpELFNBQWlFLElBQUksTUFBSixDQUFXLEVBQTVFO0FBQ0EsbUJBQU8sS0FBUCxDQUFhLElBQUksSUFBakI7QUFDQSxpQkFBSyxhQUFMLENBQW1CLEdBQW5CO0FBQ0E7QUFDRixlQUFLLFFBQUw7QUFDRSxtQkFBTyxJQUFQLG9DQUE2QyxJQUFJLE1BQUosQ0FBVyxJQUF4RCxTQUFnRSxJQUFJLE1BQUosQ0FBVyxFQUEzRSxVQUFrRixJQUFJLElBQUosQ0FBUyxHQUFULENBQWE7QUFBQSxxQkFBTSxHQUFHLFFBQVQ7QUFBQSxhQUFiLEVBQWdDLElBQWhDLENBQXFDLElBQXJDLENBQWxGO0FBQ0EsbUJBQU8sS0FBUCxDQUFhLElBQUksSUFBakI7QUFDQSxpQkFBSyxZQUFMLENBQWtCLEdBQWxCO0FBQ0E7QUFmSjtBQWlCRDtBQUNGOztBQUVEOzs7Ozs7Ozs7O2tDQU9jLEcsRUFBSztBQUNqQixVQUFJLElBQUosQ0FBUyxhQUFULEdBQXlCLElBQXpCO0FBQ0EsV0FBSyxNQUFMLENBQVksYUFBWixDQUEwQixJQUFJLElBQTlCO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7OztrQ0FTYyxHLEVBQUs7QUFDakIsVUFBTSxTQUFTLEtBQUssVUFBTCxDQUFnQixHQUFoQixDQUFmO0FBQ0EsVUFBSSxNQUFKLEVBQVk7QUFDVixlQUFPLHNCQUFQLENBQThCLElBQUksSUFBbEM7QUFDRDtBQUNGOztBQUVEOzs7Ozs7Ozs7OztpQ0FRYSxHLEVBQUs7QUFDaEI7QUFDQSxVQUFNLFNBQVMsS0FBSyxVQUFMLENBQWdCLEdBQWhCLENBQWY7QUFDQSxVQUFJLE1BQUosRUFBWTtBQUNWLFlBQUk7QUFDRixpQkFBTyxjQUFQLEdBQXdCLElBQXhCO0FBQ0EsZ0JBQU0sVUFBTixDQUFpQjtBQUNmLG9CQUFRLE1BRE87QUFFZixrQkFBTSxJQUFJLE1BQUosQ0FBVyxJQUZGO0FBR2Ysd0JBQVksSUFBSSxJQUhEO0FBSWYsb0JBQVEsS0FBSztBQUpFLFdBQWpCO0FBTUEsaUJBQU8sY0FBUCxHQUF3QixLQUF4QjtBQUNELFNBVEQsQ0FTRSxPQUFPLEdBQVAsRUFBWTtBQUNaLGlCQUFPLEtBQVAsQ0FBYSwyQ0FBYixFQUEwRCxJQUFJLElBQTlEO0FBQ0Q7QUFDRixPQWJELE1BYU87QUFDTCxnQkFBUSxNQUFNLFVBQU4sQ0FBaUIsSUFBSSxNQUFKLENBQVcsRUFBNUIsQ0FBUjtBQUNFLGVBQUssZUFBTDtBQUNFLGdCQUFJLGFBQWEscUJBQWIsQ0FBbUMsSUFBSSxJQUF2QyxDQUFKLEVBQWtELEtBQUssTUFBTCxDQUFZLGVBQVosQ0FBNEIsSUFBSSxNQUFKLENBQVcsRUFBdkMsRUFBMkMsSUFBM0M7QUFDbEQ7QUFDRixlQUFLLFVBQUw7QUFDRSxnQkFBSSxRQUFRLHFCQUFSLENBQThCLElBQUksSUFBbEMsQ0FBSixFQUE2QyxLQUFLLE1BQUwsQ0FBWSxVQUFaLENBQXVCLElBQUksTUFBSixDQUFXLEVBQWxDLEVBQXNDLElBQXRDO0FBQzdDO0FBQ0YsZUFBSyxlQUFMO0FBQ0U7QUFSSjtBQVVEO0FBQ0Y7O0FBRUQ7Ozs7Ozs7Ozs7OytCQVFXLEcsRUFBSztBQUNkLGFBQU8sS0FBSyxNQUFMLENBQVksVUFBWixDQUF1QixJQUFJLE1BQUosQ0FBVyxFQUFsQyxDQUFQO0FBQ0Q7O0FBRUQ7Ozs7Ozs7OEJBSVU7QUFDUixXQUFLLE1BQUwsR0FBYyxJQUFkO0FBQ0Q7Ozs7OztBQUdIOzs7Ozs7QUFJQSx1QkFBdUIsU0FBdkIsQ0FBaUMsTUFBakMsR0FBMEMsSUFBMUM7O0FBRUEsT0FBTyxPQUFQLEdBQWlCLHNCQUFqQiIsImZpbGUiOiJjaGFuZ2UtbWFuYWdlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGNsYXNzICBsYXllci5XZWJzb2NrZXRzLkNoYW5nZU1hbmFnZXJcbiAqIEBwcml2YXRlXG4gKlxuICogVGhpcyBjbGFzcyBsaXN0ZW5zIGZvciBgY2hhbmdlYCBldmVudHMgZnJvbSB0aGUgd2Vic29ja2V0IHNlcnZlcixcbiAqIGFuZCBwcm9jZXNzZXMgdGhlbS5cbiAqL1xuY29uc3QgVXRpbHMgPSByZXF1aXJlKCcuLi9jbGllbnQtdXRpbHMnKTtcbmNvbnN0IGxvZ2dlciA9IHJlcXVpcmUoJy4uL2xvZ2dlcicpO1xuY29uc3QgTWVzc2FnZSA9IHJlcXVpcmUoJy4uL21lc3NhZ2UnKTtcbmNvbnN0IENvbnZlcnNhdGlvbiA9IHJlcXVpcmUoJy4uL2NvbnZlcnNhdGlvbicpO1xuXG5cbmNsYXNzIFdlYnNvY2tldENoYW5nZU1hbmFnZXIge1xuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IHdlYnNvY2tldCBjaGFuZ2UgbWFuYWdlclxuICAgKlxuICAgKiAgICAgIHZhciB3ZWJzb2NrZXRDaGFuZ2VNYW5hZ2VyID0gbmV3IGxheWVyLldlYnNvY2tldHMuQ2hhbmdlTWFuYWdlcih7XG4gICAqICAgICAgICAgIGNsaWVudDogY2xpZW50LFxuICAgKiAgICAgICAgICBzb2NrZXRNYW5hZ2VyOiBjbGllbnQuV2Vic29ja2V0cy5Tb2NrZXRNYW5hZ2VyXG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBtZXRob2RcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAgICogQHBhcmFtIHtsYXllci5XZWJzb2NrZXRzLlNvY2tldE1hbmFnZXJ9IHNvY2tldE1hbmFnZXJcbiAgICogQHJldHVybnMge2xheWVyLldlYnNvY2tldHMuQ2hhbmdlTWFuYWdlcn1cbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICB0aGlzLmNsaWVudCA9IG9wdGlvbnMuY2xpZW50O1xuICAgIG9wdGlvbnMuc29ja2V0TWFuYWdlci5vbignbWVzc2FnZScsIHRoaXMuX2hhbmRsZUNoYW5nZSwgdGhpcyk7XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlcyBhIENoYW5nZSBwYWNrZXQgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVDaGFuZ2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICBfaGFuZGxlQ2hhbmdlKGV2dCkge1xuICAgIGlmIChldnQuZGF0YS50eXBlID09PSAnY2hhbmdlJykge1xuICAgICAgY29uc3QgbXNnID0gZXZ0LmRhdGEuYm9keTtcbiAgICAgIHN3aXRjaCAobXNnLm9wZXJhdGlvbikge1xuICAgICAgICBjYXNlICdjcmVhdGUnOlxuICAgICAgICAgIGxvZ2dlci5pbmZvKGBXZWJzb2NrZXQgQ2hhbmdlIEV2ZW50OiBDcmVhdGUgJHttc2cub2JqZWN0LnR5cGV9ICR7bXNnLm9iamVjdC5pZH1gKTtcbiAgICAgICAgICBsb2dnZXIuZGVidWcobXNnLmRhdGEpO1xuICAgICAgICAgIHRoaXMuX2hhbmRsZUNyZWF0ZShtc2cpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdkZWxldGUnOlxuICAgICAgICAgIGxvZ2dlci5pbmZvKGBXZWJzb2NrZXQgQ2hhbmdlIEV2ZW50OiBEZWxldGUgJHttc2cub2JqZWN0LnR5cGV9ICR7bXNnLm9iamVjdC5pZH1gKTtcbiAgICAgICAgICBsb2dnZXIuZGVidWcobXNnLmRhdGEpO1xuICAgICAgICAgIHRoaXMuX2hhbmRsZURlbGV0ZShtc2cpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICd1cGRhdGUnOlxuICAgICAgICAgIGxvZ2dlci5pbmZvKGBXZWJzb2NrZXQgQ2hhbmdlIEV2ZW50OiBQYXRjaCAke21zZy5vYmplY3QudHlwZX0gJHttc2cub2JqZWN0LmlkfTogJHttc2cuZGF0YS5tYXAob3AgPT4gb3AucHJvcGVydHkpLmpvaW4oJywgJyl9YCk7XG4gICAgICAgICAgbG9nZ2VyLmRlYnVnKG1zZy5kYXRhKTtcbiAgICAgICAgICB0aGlzLl9oYW5kbGVQYXRjaChtc2cpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIGEgY3JlYXRlIG9iamVjdCBtZXNzYWdlIGZyb20gdGhlIHNlcnZlclxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVDcmVhdGVcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBtc2dcbiAgICovXG4gIF9oYW5kbGVDcmVhdGUobXNnKSB7XG4gICAgbXNnLmRhdGEuZnJvbVdlYnNvY2tldCA9IHRydWU7XG4gICAgdGhpcy5jbGllbnQuX2NyZWF0ZU9iamVjdChtc2cuZGF0YSk7XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlcyBkZWxldGUgb2JqZWN0IG1lc3NhZ2VzIGZyb20gdGhlIHNlcnZlci5cbiAgICogQWxsIG9iamVjdHMgdGhhdCBjYW4gYmUgZGVsZXRlZCBmcm9tIHRoZSBzZXJ2ZXIgc2hvdWxkXG4gICAqIHByb3ZpZGUgYSBfZGVsZXRlZCgpIG1ldGhvZCB0byBiZSBjYWxsZWQgcHJpb3IgdG8gZGVzdHJveSgpLlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVEZWxldGVcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBtc2dcbiAgICovXG4gIF9oYW5kbGVEZWxldGUobXNnKSB7XG4gICAgY29uc3QgZW50aXR5ID0gdGhpcy5fZ2V0T2JqZWN0KG1zZyk7XG4gICAgaWYgKGVudGl0eSkge1xuICAgICAgZW50aXR5Ll9oYW5kbGVXZWJzb2NrZXREZWxldGUobXNnLmRhdGEpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBPbiByZWNlaXZpbmcgYW4gdXBkYXRlL3BhdGNoIG1lc3NhZ2UgZnJvbSB0aGUgc2VydmVyXG4gICAqIHJ1biB0aGUgTGF5ZXJQYXJzZXIgb24gdGhlIGRhdGEuXG4gICAqXG4gICAqIEBtZXRob2QgX2hhbmRsZVBhdGNoXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gbXNnXG4gICAqL1xuICBfaGFuZGxlUGF0Y2gobXNnKSB7XG4gICAgLy8gQ2FuIG9ubHkgcGF0Y2ggYSBjYWNoZWQgb2JqZWN0XG4gICAgY29uc3QgZW50aXR5ID0gdGhpcy5fZ2V0T2JqZWN0KG1zZyk7XG4gICAgaWYgKGVudGl0eSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgZW50aXR5Ll9pbkxheWVyUGFyc2VyID0gdHJ1ZTtcbiAgICAgICAgVXRpbHMubGF5ZXJQYXJzZSh7XG4gICAgICAgICAgb2JqZWN0OiBlbnRpdHksXG4gICAgICAgICAgdHlwZTogbXNnLm9iamVjdC50eXBlLFxuICAgICAgICAgIG9wZXJhdGlvbnM6IG1zZy5kYXRhLFxuICAgICAgICAgIGNsaWVudDogdGhpcy5jbGllbnQsXG4gICAgICAgIH0pO1xuICAgICAgICBlbnRpdHkuX2luTGF5ZXJQYXJzZXIgPSBmYWxzZTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBsb2dnZXIuZXJyb3IoJ3dlYnNvY2tldC1tYW5hZ2VyOiBGYWlsZWQgdG8gaGFuZGxlIGV2ZW50JywgbXNnLmRhdGEpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzd2l0Y2ggKFV0aWxzLnR5cGVGcm9tSUQobXNnLm9iamVjdC5pZCkpIHtcbiAgICAgICAgY2FzZSAnY29udmVyc2F0aW9ucyc6XG4gICAgICAgICAgaWYgKENvbnZlcnNhdGlvbi5fbG9hZFJlc291cmNlRm9yUGF0Y2gobXNnLmRhdGEpKSB0aGlzLmNsaWVudC5nZXRDb252ZXJzYXRpb24obXNnLm9iamVjdC5pZCwgdHJ1ZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ21lc3NhZ2VzJzpcbiAgICAgICAgICBpZiAoTWVzc2FnZS5fbG9hZFJlc291cmNlRm9yUGF0Y2gobXNnLmRhdGEpKSB0aGlzLmNsaWVudC5nZXRNZXNzYWdlKG1zZy5vYmplY3QuaWQsIHRydWUpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdhbm5vdW5jZW1lbnRzJzpcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBvYmplY3Qgc3BlY2lmaWVkIGJ5IHRoZSBgb2JqZWN0YCBwcm9wZXJ0eSBvZiB0aGUgd2Vic29ja2V0IHBhY2tldC5cbiAgICpcbiAgICogQG1ldGhvZCBfZ2V0T2JqZWN0XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gbXNnXG4gICAqIEByZXR1cm4ge2xheWVyLlJvb3R9XG4gICAqL1xuICBfZ2V0T2JqZWN0KG1zZykge1xuICAgIHJldHVybiB0aGlzLmNsaWVudC5fZ2V0T2JqZWN0KG1zZy5vYmplY3QuaWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIE5vdCByZXF1aXJlZCwgYnV0IGRlc3Ryb3kgaXMgYmVzdCBwcmFjdGljZVxuICAgKiBAbWV0aG9kIGRlc3Ryb3lcbiAgICovXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5jbGllbnQgPSBudWxsO1xuICB9XG59XG5cbi8qKlxuICogVGhlIENsaWVudCB0aGF0IG93bnMgdGhpcy5cbiAqIEB0eXBlIHtsYXllci5DbGllbnR9XG4gKi9cbldlYnNvY2tldENoYW5nZU1hbmFnZXIucHJvdG90eXBlLmNsaWVudCA9IG51bGw7XG5cbm1vZHVsZS5leHBvcnRzID0gV2Vic29ja2V0Q2hhbmdlTWFuYWdlcjtcbiJdfQ==
