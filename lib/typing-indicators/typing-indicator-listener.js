'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The TypingIndicatorListener receives Typing Indicator state
 * for other users via a websocket, and notifies
 * the client of the updated state.  Typical applications
 * do not access this component directly, but DO subscribe
 * to events produced by this component:
 *
 *      client.on('typing-indicator-change', function(evt) {
 *        if (evt.conversationId == conversationICareAbout) {
 *          console.log('The following users are typing: ' + evt.typing.join(', '));
 *          console.log('The following users are paused: ' + evt.paused.join(', '));
 *        }
 *      });
 *
 * @class layer.TypingIndicators.TypingIndicatorListener
 * @extends {layer.Root}
 */

var Root = require('../root');
var ClientRegistry = require('../client-registry');

var _require = require('./typing-indicators');

var STARTED = _require.STARTED;
var PAUSED = _require.PAUSED;
var FINISHED = _require.FINISHED;

var TypingIndicatorListener = function (_Root) {
  _inherits(TypingIndicatorListener, _Root);

  /**
   * Creates a Typing Indicator Listener for this Client.
   *
   * @method constructor
   * @protected
   * @param  {Object} args
   * @param {string} args.clientId - ID of the client this belongs to
   */
  function TypingIndicatorListener(args) {
    _classCallCheck(this, TypingIndicatorListener);

    /**
     * Stores the state of all Conversations, indicating who is typing and who is paused.
     *
     * People who are stopped are removed from this state.
     * @property {Object} state
     */
    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(TypingIndicatorListener).call(this, args));

    _this.state = {};
    _this._pollId = 0;
    var client = _this._getClient();
    client.on('ready', function () {
      return _this._clientReady();
    });
    return _this;
  }

  /**
   * Called when the client is ready
   *
   * @method _clientReady
   * @private
   */


  _createClass(TypingIndicatorListener, [{
    key: '_clientReady',
    value: function _clientReady() {
      var client = this._getClient();
      this.user = client.user;
      var ws = client.socketManager;
      ws.on('message', this._handleSocketEvent, this);
      this._startPolling();
    }

    /**
     * Determines if this event is relevant to report on.
     * Must be a typing indicator signal that is reporting on
     * someone other than this user.
     *
     * @method _isRelevantEvent
     * @private
     * @param  {Object}  Websocket event data
     * @return {Boolean}
     */

  }, {
    key: '_isRelevantEvent',
    value: function _isRelevantEvent(evt) {
      return evt.type === 'signal' && evt.body.type === 'typing_indicator' && evt.body.data.sender.id !== this.user.id;
    }

    /**
     * This method receives websocket events and
     * if they are typing indicator events, updates its state.
     *
     * @method _handleSocketEvent
     * @private
     * @param {layer.LayerEvent} evtIn - All websocket events
     */

  }, {
    key: '_handleSocketEvent',
    value: function _handleSocketEvent(evtIn) {
      var _this2 = this;

      var evt = evtIn.data;

      if (this._isRelevantEvent(evt)) {
        (function () {
          // Could just do _createObject() but for ephemeral events, going through _createObject and updating
          // objects for every typing indicator seems a bit much.  Try getIdentity and only create if needed.
          var identity = _this2._getClient().getIdentity(evt.body.data.sender.id) || _this2._getClient()._createObject(evt.body.data.sender);
          var state = evt.body.data.action;
          var conversationId = evt.body.object.id;
          var stateEntry = _this2.state[conversationId];
          if (!stateEntry) {
            stateEntry = _this2.state[conversationId] = {
              users: {},
              typing: [],
              paused: []
            };
          }
          stateEntry.users[identity.id] = {
            startTime: Date.now(),
            state: state,
            identity: identity
          };
          if (stateEntry.users[identity.id].state === FINISHED) {
            delete stateEntry.users[identity.id];
          }

          _this2._updateState(stateEntry, state, identity.id);

          _this2.trigger('typing-indicator-change', {
            conversationId: conversationId,
            typing: stateEntry.typing.map(function (id) {
              return stateEntry.users[id].identity.toObject();
            }),
            paused: stateEntry.paused.map(function (id) {
              return stateEntry.users[id].identity.toObject();
            })
          });
        })();
      }
    }

    /**
     * Get the current typing indicator state of a specified Conversation.
     *
     * Typically used to see if anyone is currently typing when first opening a Conversation.
     * Typically accessed via `client.getTypingState(conversationId)`
     *
     * @method getState
     * @param {String} conversationId
     */

  }, {
    key: 'getState',
    value: function getState(conversationId) {
      var stateEntry = this.state[conversationId];
      if (stateEntry) {
        return {
          typing: stateEntry.typing.map(function (id) {
            return stateEntry.users[id].identity.toObject();
          }),
          paused: stateEntry.paused.map(function (id) {
            return stateEntry.users[id].identity.toObject();
          })
        };
      } else {
        return {
          typing: [],
          paused: []
        };
      }
    }

    /**
     * Updates the state of a single stateEntry; a stateEntry
     * represents a single Conversation's typing indicator data.
     *
     * Updates typing and paused arrays following immutable strategies
     * in hope that this will help Flex based architectures.
     *
     * @method _updateState
     * @private
     * @param  {Object} stateEntry - A Conversation's typing indicator state
     * @param  {string} newState   - started, paused or finished
     * @param  {string} identityId     - ID of the user whose state has changed
     */

  }, {
    key: '_updateState',
    value: function _updateState(stateEntry, newState, identityId) {
      var typingIndex = stateEntry.typing.indexOf(identityId);
      if (newState !== STARTED && typingIndex !== -1) {
        stateEntry.typing = [].concat(_toConsumableArray(stateEntry.typing.slice(0, typingIndex)), _toConsumableArray(stateEntry.typing.slice(typingIndex + 1)));
      }
      var pausedIndex = stateEntry.paused.indexOf(identityId);
      if (newState !== PAUSED && pausedIndex !== -1) {
        stateEntry.paused = [].concat(_toConsumableArray(stateEntry.paused.slice(0, pausedIndex)), _toConsumableArray(stateEntry.paused.slice(pausedIndex + 1)));
      }

      if (newState === STARTED && typingIndex === -1) {
        stateEntry.typing = [].concat(_toConsumableArray(stateEntry.typing), [identityId]);
      } else if (newState === PAUSED && pausedIndex === -1) {
        stateEntry.paused = [].concat(_toConsumableArray(stateEntry.paused), [identityId]);
      }
    }

    /**
     * Any time a state change becomes more than 6 seconds stale,
     * assume that the user is 'finished'.
     *
     * In theory, we should
     * receive a new event every 2.5 seconds.  If the current user
     * has gone offline, lack of this code would cause the people
     * currently flagged as typing as still typing hours from now.
     *
     * For this first pass, we just mark the user as 'finished'
     * but a future pass may move from 'started' to 'paused'
     * and 'paused to 'finished'
     *
     * @method _startPolling
     * @private
     */

  }, {
    key: '_startPolling',
    value: function _startPolling() {
      var _this3 = this;

      if (this._pollId) return;
      this._pollId = setInterval(function () {
        return _this3._poll();
      }, 5000);
    }
  }, {
    key: '_poll',
    value: function _poll() {
      var _this4 = this;

      var conversationIds = Object.keys(this.state);

      conversationIds.forEach(function (id) {
        var state = _this4.state[id];
        Object.keys(state.users).forEach(function (identityId) {
          if (Date.now() >= state.users[identityId].startTime + 6000) {
            _this4._updateState(state, FINISHED, identityId);
            delete state.users[identityId];
            _this4.trigger('typing-indicator-change', {
              conversationId: id,
              typing: state.typing.map(function (aIdentityId) {
                return state.users[aIdentityId].identity.toObject();
              }),
              paused: state.paused.map(function (aIdentityId) {
                return state.users[aIdentityId].identity.toObject();
              })
            });
          }
        });
      });
    }

    /**
     * Get the Client associated with this class.  Uses the clientId
     * property.
     *
     * @method _getClient
     * @protected
     * @return {layer.Client}
     */

  }, {
    key: '_getClient',
    value: function _getClient() {
      return ClientRegistry.get(this.clientId);
    }
  }]);

  return TypingIndicatorListener;
}(Root);

/**
 * setTimeout ID for polling for states to transition
 * @type {Number}
 * @private
 */


TypingIndicatorListener.prototype._pollId = 0;

/**
 * ID of the client this instance is associated with
 * @type {String}
 */
TypingIndicatorListener.prototype.clientId = '';

TypingIndicatorListener.bubbleEventParent = '_getClient';

TypingIndicatorListener._supportedEvents = [
/**
 * There has been a change in typing indicator state of other users.
 * @event change
 * @param {layer.LayerEvent} evt
 * @param {layer.Identity[]} evt.typing - Array of Identities of people who are typing
 * @param {layer.Identity[]} evt.paused - Array of Identities of people who are paused
 * @param {string} evt.conversationId - ID of the Converation that has changed typing indicator state
 */
'typing-indicator-change'].concat(Root._supportedEvents);

Root.initClass.apply(TypingIndicatorListener, [TypingIndicatorListener, 'TypingIndicatorListener']);
module.exports = TypingIndicatorListener;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy90eXBpbmctaW5kaWNhdG9ycy90eXBpbmctaW5kaWNhdG9yLWxpc3RlbmVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFrQkEsSUFBTSxPQUFPLFFBQVEsU0FBUixDQUFiO0FBQ0EsSUFBTSxpQkFBaUIsUUFBUSxvQkFBUixDQUF2Qjs7ZUFFc0MsUUFBUSxxQkFBUixDOztJQUE5QixPLFlBQUEsTztJQUFTLE0sWUFBQSxNO0lBQVEsUSxZQUFBLFE7O0lBQ25CLHVCOzs7QUFFSjs7Ozs7Ozs7QUFRQSxtQ0FBWSxJQUFaLEVBQWtCO0FBQUE7O0FBR2hCOzs7Ozs7QUFIZ0IsMkdBQ1YsSUFEVTs7QUFTaEIsVUFBSyxLQUFMLEdBQWEsRUFBYjtBQUNBLFVBQUssT0FBTCxHQUFlLENBQWY7QUFDQSxRQUFNLFNBQVMsTUFBSyxVQUFMLEVBQWY7QUFDQSxXQUFPLEVBQVAsQ0FBVSxPQUFWLEVBQW1CO0FBQUEsYUFBTSxNQUFLLFlBQUwsRUFBTjtBQUFBLEtBQW5CO0FBWmdCO0FBYWpCOztBQUVEOzs7Ozs7Ozs7O21DQU1lO0FBQ2IsVUFBTSxTQUFTLEtBQUssVUFBTCxFQUFmO0FBQ0EsV0FBSyxJQUFMLEdBQVksT0FBTyxJQUFuQjtBQUNBLFVBQU0sS0FBSyxPQUFPLGFBQWxCO0FBQ0EsU0FBRyxFQUFILENBQU0sU0FBTixFQUFpQixLQUFLLGtCQUF0QixFQUEwQyxJQUExQztBQUNBLFdBQUssYUFBTDtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7O3FDQVVpQixHLEVBQUs7QUFDcEIsYUFBTyxJQUFJLElBQUosS0FBYSxRQUFiLElBQ0wsSUFBSSxJQUFKLENBQVMsSUFBVCxLQUFrQixrQkFEYixJQUVMLElBQUksSUFBSixDQUFTLElBQVQsQ0FBYyxNQUFkLENBQXFCLEVBQXJCLEtBQTRCLEtBQUssSUFBTCxDQUFVLEVBRnhDO0FBR0Q7O0FBRUQ7Ozs7Ozs7Ozs7O3VDQVFtQixLLEVB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QXpCLEVBQW1DLFVBQW5DO0FBQ0EsbUJBQU8sTUFBTSxLQUFOLENBQVksVUFBWixDQUFQO0FBQ0EsbUJBQUssT0FBTCxDQUFhLHlCQUFiLEVBQXdDO0FBQ3RDLDhCQUFnQixFQURzQjtBQUV0QyxzQkFBUSxNQUFNLE1BQU4sQ0FBYSxHQUFiLENBQWlCO0FBQUEsdUJBQWUsTUFBTSxLQUFOLENBQVksV0FBWixFQUF5QixRQUF6QixDQUFrQyxRQUFsQyxFQUFmO0FBQUEsZUFBakIsQ0FGOEI7QUFHdEMsc0JBQVEsTUFBTSxNQUFOLENBQWEsR0FBYixDQUFpQjtBQUFBLHVCQUFlLE1BQU0sS0FBTixDQUFZLFdBQVosRUFBeUIsUUFBekIsQ0FBa0MsUUFBbEMsRUFBZjtBQUFBLGVBQWpCO0FBSDhCLGFBQXhDO0FBS0Q7QUFDRixTQVhIO0FBWUQsT0FkRDtBQWVEOztBQUVEOzs7Ozs7Ozs7OztpQ0FRYTtBQUNYLGFBQU8sZUFBZSxHQUFmLENBQW1CLEtBQUssUUFBeEIsQ0FBUDtBQUNEOzs7O0VBcE5tQyxJOztBQXVOdEM7Ozs7Ozs7QUFLQSx3QkFBd0IsU0FBeEIsQ0FBa0MsT0FBbEMsR0FBNEMsQ0FBNUM7O0FBRUE7Ozs7QUFJQSx3QkFBd0IsU0FBeEIsQ0FBa0MsUUFBbEMsR0FBNkMsRUFBN0M7O0FBRUEsd0JBQXdCLGlCQUF4QixHQUE0QyxZQUE1Qzs7QUFHQSx3QkFBd0IsZ0JBQXhCLEdBQTJDO0FBQ3pDOzs7Ozs7OztBQVFBLHlCQVR5QyxFQVV6QyxNQVZ5QyxDQVVsQyxLQUFLLGdCQVY2QixDQUEzQzs7QUFZQSxLQUFLLFNBQUwsQ0FBZSxLQUFmLENBQXFCLHVCQUFyQixFQUE4QyxDQUFDLHVCQUFELEVBQTBCLHlCQUExQixDQUE5QztBQUNBLE9BQU8sT0FBUCxHQUFpQix1QkFBakIiLCJmaWxlIjoidHlwaW5nLWluZGljYXRvci1saXN0ZW5lci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVGhlIFR5cGluZ0luZGljYXRvckxpc3RlbmVyIHJlY2VpdmVzIFR5cGluZyBJbmRpY2F0b3Igc3RhdGVcbiAqIGZvciBvdGhlciB1c2VycyB2aWEgYSB3ZWJzb2NrZXQsIGFuZCBub3RpZmllc1xuICogdGhlIGNsaWVudCBvZiB0aGUgdXBkYXRlZCBzdGF0ZS4gIFR5cGljYWwgYXBwbGljYXRpb25zXG4gKiBkbyBub3QgYWNjZXNzIHRoaXMgY29tcG9uZW50IGRpcmVjdGx5LCBidXQgRE8gc3Vic2NyaWJlXG4gKiB0byBldmVudHMgcHJvZHVjZWQgYnkgdGhpcyBjb21wb25lbnQ6XG4gKlxuICogICAgICBjbGllbnQub24oJ3R5cGluZy1pbmRpY2F0b3ItY2hhbmdlJywgZnVuY3Rpb24oZXZ0KSB7XG4gKiAgICAgICAgaWYgKGV2dC5jb252ZXJzYXRpb25JZCA9PSBjb252ZXJzYXRpb25JQ2FyZUFib3V0KSB7XG4gKiAgICAgICAgICBjb25zb2xlLmxvZygnVGhlIGZvbGxvd2luZyB1c2VycyBhcmUgdHlwaW5nOiAnICsgZXZ0LnR5cGluZy5qb2luKCcsICcpKTtcbiAqICAgICAgICAgIGNvbnNvbGUubG9nKCdUaGUgZm9sbG93aW5nIHVzZXJzIGFyZSBwYXVzZWQ6ICcgKyBldnQucGF1c2VkLmpvaW4oJywgJykpO1xuICogICAgICAgIH1cbiAqICAgICAgfSk7XG4gKlxuICogQGNsYXNzIGxheWVyLlR5cGluZ0luZGljYXRvcnMuVHlwaW5nSW5kaWNhdG9yTGlzdGVuZXJcbiAqIEBleHRlbmRzIHtsYXllci5Sb290fVxuICovXG5cbmNvbnN0IFJvb3QgPSByZXF1aXJlKCcuLi9yb290Jyk7XG5jb25zdCBDbGllbnRSZWdpc3RyeSA9IHJlcXVpcmUoJy4uL2NsaWVudC1yZWdpc3RyeScpO1xuXG5jb25zdCB7IFNUQVJURUQsIFBBVVNFRCwgRklOSVNIRUQgfSA9IHJlcXVpcmUoJy4vdHlwaW5nLWluZGljYXRvcnMnKTtcbmNsYXNzIFR5cGluZ0luZGljYXRvckxpc3RlbmVyIGV4dGVuZHMgUm9vdCB7XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBUeXBpbmcgSW5kaWNhdG9yIExpc3RlbmVyIGZvciB0aGlzIENsaWVudC5cbiAgICpcbiAgICogQG1ldGhvZCBjb25zdHJ1Y3RvclxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSAge09iamVjdH0gYXJnc1xuICAgKiBAcGFyYW0ge3N0cmluZ30gYXJncy5jbGllbnRJZCAtIElEIG9mIHRoZSBjbGllbnQgdGhpcyBiZWxvbmdzIHRvXG4gICAqL1xuICBjb25zdHJ1Y3RvcihhcmdzKSB7XG4gICAgc3VwZXIoYXJncyk7XG5cbiAgICAvKipcbiAgICAgKiBTdG9yZXMgdGhlIHN0YXRlIG9mIGFsbCBDb252ZXJzYXRpb25zLCBpbmRpY2F0aW5nIHdobyBpcyB0eXBpbmcgYW5kIHdobyBpcyBwYXVzZWQuXG4gICAgICpcbiAgICAgKiBQZW9wbGUgd2hvIGFyZSBzdG9wcGVkIGFyZSByZW1vdmVkIGZyb20gdGhpcyBzdGF0ZS5cbiAgICAgKiBAcHJvcGVydHkge09iamVjdH0gc3RhdGVcbiAgICAgKi9cbiAgICB0aGlzLnN0YXRlID0ge307XG4gICAgdGhpcy5fcG9sbElkID0gMDtcbiAgICBjb25zdCBjbGllbnQgPSB0aGlzLl9nZXRDbGllbnQoKTtcbiAgICBjbGllbnQub24oJ3JlYWR5JywgKCkgPT4gdGhpcy5fY2xpZW50UmVhZHkoKSk7XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGVkIHdoZW4gdGhlIGNsaWVudCBpcyByZWFkeVxuICAgKlxuICAgKiBAbWV0aG9kIF9jbGllbnRSZWFkeVxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2NsaWVudFJlYWR5KCkge1xuICAgIGNvbnN0IGNsaWVudCA9IHRoaXMuX2dldENsaWVudCgpO1xuICAgIHRoaXMudXNlciA9IGNsaWVudC51c2VyO1xuICAgIGNvbnN0IHdzID0gY2xpZW50LnNvY2tldE1hbmFnZXI7XG4gICAgd3Mub24oJ21lc3NhZ2UnLCB0aGlzLl9oYW5kbGVTb2NrZXRFdmVudCwgdGhpcyk7XG4gICAgdGhpcy5fc3RhcnRQb2xsaW5nKCk7XG4gIH1cblxuICAvKipcbiAgICogRGV0ZXJtaW5lcyBpZiB0aGlzIGV2ZW50IGlzIHJlbGV2YW50IHRvIHJlcG9ydCBvbi5cbiAgICogTXVzdCBiZSBhIHR5cGluZyBpbmRpY2F0b3Igc2lnbmFsIHRoYXQgaXMgcmVwb3J0aW5nIG9uXG4gICAqIHNvbWVvbmUgb3RoZXIgdGhhbiB0aGlzIHVzZXIuXG4gICAqXG4gICAqIEBtZXRob2QgX2lzUmVsZXZhbnRFdmVudFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICBXZWJzb2NrZXQgZXZlbnQgZGF0YVxuICAgKiBAcmV0dXJuIHtCb29sZWFufVxuICAgKi9cbiAgX2lzUmVsZXZhbnRFdmVudChldnQpIHtcbiAgICByZXR1cm4gZXZ0LnR5cGUgPT09ICdzaWduYWwnICYmXG4gICAgICBldnQuYm9keS50eXBlID09PSAndHlwaW5nX2luZGljYXRvcicgJiZcbiAgICAgIGV2dC5ib2R5LmRhdGEuc2VuZGVyLmlkICE9PSB0aGlzLnVzZXIuaWQ7XG4gIH1cblxuICAvKipcbiAgICogVGhpcyBtZXRob2QgcmVjZWl2ZXMgd2Vic29ja2V0IGV2ZW50cyBhbmRcbiAgICogaWYgdGhleSBhcmUgdHlwaW5nIGluZGljYXRvciBldmVudHMsIHVwZGF0ZXMgaXRzIHN0YXRlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVTb2NrZXRFdmVudFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXZlbnR9IGV2dEluIC0gQWxsIHdlYnNvY2tldCBldmVudHNcbiAgICovXG4gIF9oYW5kbGVTb2NrZXRFdmVudChldnRJbikge1xuICAgIGNvbnN0IGV2dCA9IGV2dEluLmRhdGE7XG5cbiAgICBpZiAodGhpcy5faXNSZWxldmFudEV2ZW50KGV2dCkpIHtcbiAgICAgIC8vIENvdWxkIGp1c3QgZG8gX2NyZWF0ZU9iamVjdCgpIGJ1dCBmb3IgZXBoZW1lcmFsIGV2ZW50cywgZ29pbmcgdGhyb3VnaCBfY3JlYXRlT2JqZWN0IGFuZCB1cGRhdGluZ1xuICAgICAgLy8gb2JqZWN0cyBmb3IgZXZlcnkgdHlwaW5nIGluZGljYXRvciBzZWVtcyBhIGJpdCBtdWNoLiAgVHJ5IGdldElkZW50aXR5IGFuZCBvbmx5IGNyZWF0ZSBpZiBuZWVkZWQuXG4gICAgICBjb25zdCBpZGVudGl0eSA9IHRoaXMuX2dldENsaWVudCgpLmdldElkZW50aXR5KGV2dC5ib2R5LmRhdGEuc2VuZGVyLmlkKSB8fFxuICAgICAgICB0aGlzLl9nZXRDbGllbnQoKS5fY3JlYXRlT2JqZWN0KGV2dC5ib2R5LmRhdGEuc2VuZGVyKTtcbiAgICAgIGNvbnN0IHN0YXRlID0gZXZ0LmJvZHkuZGF0YS5hY3Rpb247XG4gICAgICBjb25zdCBjb252ZXJzYXRpb25JZCA9IGV2dC5ib2R5Lm9iamVjdC5pZDtcbiAgICAgIGxldCBzdGF0ZUVudHJ5ID0gdGhpcy5zdGF0ZVtjb252ZXJzYXRpb25JZF07XG4gICAgICBpZiAoIXN0YXRlRW50cnkpIHtcbiAgICAgICAgc3RhdGVFbnRyeSA9IHRoaXMuc3RhdGVbY29udmVyc2F0aW9uSWRdID0ge1xuICAgICAgICAgIHVzZXJzOiB7fSxcbiAgICAgICAgICB0eXBpbmc6IFtdLFxuICAgICAgICAgIHBhdXNlZDogW10sXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBzdGF0ZUVudHJ5LnVzZXJzW2lkZW50aXR5LmlkXSA9IHtcbiAgICAgICAgc3RhcnRUaW1lOiBEYXRlLm5vdygpLFxuICAgICAgICBzdGF0ZSxcbiAgICAgICAgaWRlbnRpdHksXG4gICAgICB9O1xuICAgICAgaWYgKHN0YXRlRW50cnkudXNlcnNbaWRlbnRpdHkuaWRdLnN0YXRlID09PSBGSU5JU0hFRCkge1xuICAgICAgICBkZWxldGUgc3RhdGVFbnRyeS51c2Vyc1tpZGVudGl0eS5pZF07XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX3VwZGF0ZVN0YXRlKHN0YXRlRW50cnksIHN0YXRlLCBpZGVudGl0eS5pZCk7XG5cbiAgICAgIHRoaXMudHJpZ2dlcigndHlwaW5nLWluZGljYXRvci1jaGFuZ2UnLCB7XG4gICAgICAgIGNvbnZlcnNhdGlvbklkLFxuICAgICAgICB0eXBpbmc6IHN0YXRlRW50cnkudHlwaW5nLm1hcChpZCA9PiBzdGF0ZUVudHJ5LnVzZXJzW2lkXS5pZGVudGl0eS50b09iamVjdCgpKSxcbiAgICAgICAgcGF1c2VkOiBzdGF0ZUVudHJ5LnBhdXNlZC5tYXAoaWQgPT4gc3RhdGVFbnRyeS51c2Vyc1tpZF0uaWRlbnRpdHkudG9PYmplY3QoKSksXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBjdXJyZW50IHR5cGluZyBpbmRpY2F0b3Igc3RhdGUgb2YgYSBzcGVjaWZpZWQgQ29udmVyc2F0aW9uLlxuICAgKlxuICAgKiBUeXBpY2FsbHkgdXNlZCB0byBzZWUgaWYgYW55b25lIGlzIGN1cnJlbnRseSB0eXBpbmcgd2hlbiBmaXJzdCBvcGVuaW5nIGEgQ29udmVyc2F0aW9uLlxuICAgKiBUeXBpY2FsbHkgYWNjZXNzZWQgdmlhIGBjbGllbnQuZ2V0VHlwaW5nU3RhdGUoY29udmVyc2F0aW9uSWQpYFxuICAgKlxuICAgKiBAbWV0aG9kIGdldFN0YXRlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBjb252ZXJzYXRpb25JZFxuICAgKi9cbiAgZ2V0U3RhdGUoY29udmVyc2F0aW9uSWQpIHtcbiAgICBjb25zdCBzdGF0ZUVudHJ5ID0gdGhpcy5zdGF0ZVtjb252ZXJzYXRpb25JZF07XG4gICAgaWYgKHN0YXRlRW50cnkpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGluZzogc3RhdGVFbnRyeS50eXBpbmcubWFwKGlkID0+IHN0YXRlRW50cnkudXNlcnNbaWRdLmlkZW50aXR5LnRvT2JqZWN0KCkpLFxuICAgICAgICBwYXVzZWQ6IHN0YXRlRW50cnkucGF1c2VkLm1hcChpZCA9PiBzdGF0ZUVudHJ5LnVzZXJzW2lkXS5pZGVudGl0eS50b09iamVjdCgpKVxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwaW5nOiBbXSxcbiAgICAgICAgcGF1c2VkOiBbXSxcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZXMgdGhlIHN0YXRlIG9mIGEgc2luZ2xlIHN0YXRlRW50cnk7IGEgc3RhdGVFbnRyeVxuICAgKiByZXByZXNlbnRzIGEgc2luZ2xlIENvbnZlcnNhdGlvbidzIHR5cGluZyBpbmRpY2F0b3IgZGF0YS5cbiAgICpcbiAgICogVXBkYXRlcyB0eXBpbmcgYW5kIHBhdXNlZCBhcnJheXMgZm9sbG93aW5nIGltbXV0YWJsZSBzdHJhdGVnaWVzXG4gICAqIGluIGhvcGUgdGhhdCB0aGlzIHdpbGwgaGVscCBGbGV4IGJhc2VkIGFyY2hpdGVjdHVyZXMuXG4gICAqXG4gICAqIEBtZXRob2QgX3VwZGF0ZVN0YXRlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gc3RhdGVFbnRyeSAtIEEgQ29udmVyc2F0aW9uJ3MgdHlwaW5nIGluZGljYXRvciBzdGF0ZVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IG5ld1N0YXRlICAgLSBzdGFydGVkLCBwYXVzZWQgb3IgZmluaXNoZWRcbiAgICogQHBhcmFtICB7c3RyaW5nfSBpZGVudGl0eUlkICAgICAtIElEIG9mIHRoZSB1c2VyIHdob3NlIHN0YXRlIGhhcyBjaGFuZ2VkXG4gICAqL1xuICBfdXBkYXRlU3RhdGUoc3RhdGVFbnRyeSwgbmV3U3RhdGUsIGlkZW50aXR5SWQpIHtcbiAgICBjb25zdCB0eXBpbmdJbmRleCA9IHN0YXRlRW50cnkudHlwaW5nLmluZGV4T2YoaWRlbnRpdHlJZCk7XG4gICAgaWYgKG5ld1N0YXRlICE9PSBTVEFSVEVEICYmIHR5cGluZ0luZGV4ICE9PSAtMSkge1xuICAgICAgc3RhdGVFbnRyeS50eXBpbmcgPSBbXG4gICAgICAgIC4uLnN0YXRlRW50cnkudHlwaW5nLnNsaWNlKDAsIHR5cGluZ0luZGV4KSxcbiAgICAgICAgLi4uc3RhdGVFbnRyeS50eXBpbmcuc2xpY2UodHlwaW5nSW5kZXggKyAxKSxcbiAgICAgIF07XG4gICAgfVxuICAgIGNvbnN0IHBhdXNlZEluZGV4ID0gc3RhdGVFbnRyeS5wYXVzZWQuaW5kZXhPZihpZGVudGl0eUlkKTtcbiAgICBpZiAobmV3U3RhdGUgIT09IFBBVVNFRCAmJiBwYXVzZWRJbmRleCAhPT0gLTEpIHtcbiAgICAgIHN0YXRlRW50cnkucGF1c2VkID0gW1xuICAgICAgICAuLi5zdGF0ZUVudHJ5LnBhdXNlZC5zbGljZSgwLCBwYXVzZWRJbmRleCksXG4gICAgICAgIC4uLnN0YXRlRW50cnkucGF1c2VkLnNsaWNlKHBhdXNlZEluZGV4ICsgMSksXG4gICAgICBdO1xuICAgIH1cblxuXG4gICAgaWYgKG5ld1N0YXRlID09PSBTVEFSVEVEICYmIHR5cGluZ0luZGV4ID09PSAtMSkge1xuICAgICAgc3RhdGVFbnRyeS50eXBpbmcgPSBbLi4uc3RhdGVFbnRyeS50eXBpbmcsIGlkZW50aXR5SWRdO1xuICAgIH0gZWxzZSBpZiAobmV3U3RhdGUgPT09IFBBVVNFRCAmJiBwYXVzZWRJbmRleCA9PT0gLTEpIHtcbiAgICAgIHN0YXRlRW50cnkucGF1c2VkID0gWy4uLnN0YXRlRW50cnkucGF1c2VkLCBpZGVudGl0eUlkXTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQW55IHRpbWUgYSBzdGF0ZSBjaGFuZ2UgYmVjb21lcyBtb3JlIHRoYW4gNiBzZWNvbmRzIHN0YWxlLFxuICAgKiBhc3N1bWUgdGhhdCB0aGUgdXNlciBpcyAnZmluaXNoZWQnLlxuICAgKlxuICAgKiBJbiB0aGVvcnksIHdlIHNob3VsZFxuICAgKiByZWNlaXZlIGEgbmV3IGV2ZW50IGV2ZXJ5IDIuNSBzZWNvbmRzLiAgSWYgdGhlIGN1cnJlbnQgdXNlclxuICAgKiBoYXMgZ29uZSBvZmZsaW5lLCBsYWNrIG9mIHRoaXMgY29kZSB3b3VsZCBjYXVzZSB0aGUgcGVvcGxlXG4gICAqIGN1cnJlbnRseSBmbGFnZ2VkIGFzIHR5cGluZyBhcyBzdGlsbCB0eXBpbmcgaG91cnMgZnJvbSBub3cuXG4gICAqXG4gICAqIEZvciB0aGlzIGZpcnN0IHBhc3MsIHdlIGp1c3QgbWFyayB0aGUgdXNlciBhcyAnZmluaXNoZWQnXG4gICAqIGJ1dCBhIGZ1dHVyZSBwYXNzIG1heSBtb3ZlIGZyb20gJ3N0YXJ0ZWQnIHRvICdwYXVzZWQnXG4gICAqIGFuZCAncGF1c2VkIHRvICdmaW5pc2hlZCdcbiAgICpcbiAgICogQG1ldGhvZCBfc3RhcnRQb2xsaW5nXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfc3RhcnRQb2xsaW5nKCkge1xuICAgIGlmICh0aGlzLl9wb2xsSWQpIHJldHVybjtcbiAgICB0aGlzLl9wb2xsSWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB0aGlzLl9wb2xsKCksIDUwMDApO1xuICB9XG5cbiAgX3BvbGwoKSB7XG4gICAgY29uc3QgY29udmVyc2F0aW9uSWRzID0gT2JqZWN0LmtleXModGhpcy5zdGF0ZSk7XG5cbiAgICBjb252ZXJzYXRpb25JZHMuZm9yRWFjaChpZCA9PiB7XG4gICAgICBjb25zdCBzdGF0ZSA9IHRoaXMuc3RhdGVbaWRdO1xuICAgICAgT2JqZWN0LmtleXMoc3RhdGUudXNlcnMpXG4gICAgICAgIC5mb3JFYWNoKChpZGVudGl0eUlkKSA9PiB7XG4gICAgICAgICAgaWYgKERhdGUubm93KCkgPj0gc3RhdGUudXNlcnNbaWRlbnRpdHlJZF0uc3RhcnRUaW1lICsgNjAwMCkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlU3RhdGUoc3RhdGUsIEZJTklTSEVELCBpZGVudGl0eUlkKTtcbiAgICAgICAgICAgIGRlbGV0ZSBzdGF0ZS51c2Vyc1tpZGVudGl0eUlkXTtcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcigndHlwaW5nLWluZGljYXRvci1jaGFuZ2UnLCB7XG4gICAgICAgICAgICAgIGNvbnZlcnNhdGlvbklkOiBpZCxcbiAgICAgICAgICAgICAgdHlwaW5nOiBzdGF0ZS50eXBpbmcubWFwKGFJZGVudGl0eUlkID0+IHN0YXRlLnVzZXJzW2FJZGVudGl0eUlkXS5pZGVudGl0eS50b09iamVjdCgpKSxcbiAgICAgICAgICAgICAgcGF1c2VkOiBzdGF0ZS5wYXVzZWQubWFwKGFJZGVudGl0eUlkID0+IHN0YXRlLnVzZXJzW2FJZGVudGl0eUlkXS5pZGVudGl0eS50b09iamVjdCgpKSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBDbGllbnQgYXNzb2NpYXRlZCB3aXRoIHRoaXMgY2xhc3MuICBVc2VzIHRoZSBjbGllbnRJZFxuICAgKiBwcm9wZXJ0eS5cbiAgICpcbiAgICogQG1ldGhvZCBfZ2V0Q2xpZW50XG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHJldHVybiB7bGF5ZXIuQ2xpZW50fVxuICAgKi9cbiAgX2dldENsaWVudCgpIHtcbiAgICByZXR1cm4gQ2xpZW50UmVnaXN0cnkuZ2V0KHRoaXMuY2xpZW50SWQpO1xuICB9XG59XG5cbi8qKlxuICogc2V0VGltZW91dCBJRCBmb3IgcG9sbGluZyBmb3Igc3RhdGVzIHRvIHRyYW5zaXRpb25cbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKiBAcHJpdmF0ZVxuICovXG5UeXBpbmdJbmRpY2F0b3JMaXN0ZW5lci5wcm90b3R5cGUuX3BvbGxJZCA9IDA7XG5cbi8qKlxuICogSUQgb2YgdGhlIGNsaWVudCB0aGlzIGluc3RhbmNlIGlzIGFzc29jaWF0ZWQgd2l0aFxuICogQHR5cGUge1N0cmluZ31cbiAqL1xuVHlwaW5nSW5kaWNhdG9yTGlzdGVuZXIucHJvdG90eXBlLmNsaWVudElkID0gJyc7XG5cblR5cGluZ0luZGljYXRvckxpc3RlbmVyLmJ1YmJsZUV2ZW50UGFyZW50ID0gJ19nZXRDbGllbnQnO1xuXG5cblR5cGluZ0luZGljYXRvckxpc3RlbmVyLl9zdXBwb3J0ZWRFdmVudHMgPSBbXG4gIC8qKlxuICAgKiBUaGVyZSBoYXMgYmVlbiBhIGNoYW5nZSBpbiB0eXBpbmcgaW5kaWNhdG9yIHN0YXRlIG9mIG90aGVyIHVzZXJzLlxuICAgKiBAZXZlbnQgY2hhbmdlXG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqIEBwYXJhbSB7bGF5ZXIuSWRlbnRpdHlbXX0gZXZ0LnR5cGluZyAtIEFycmF5IG9mIElkZW50aXRpZXMgb2YgcGVvcGxlIHdobyBhcmUgdHlwaW5nXG4gICAqIEBwYXJhbSB7bGF5ZXIuSWRlbnRpdHlbXX0gZXZ0LnBhdXNlZCAtIEFycmF5IG9mIElkZW50aXRpZXMgb2YgcGVvcGxlIHdobyBhcmUgcGF1c2VkXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldnQuY29udmVyc2F0aW9uSWQgLSBJRCBvZiB0aGUgQ29udmVyYXRpb24gdGhhdCBoYXMgY2hhbmdlZCB0eXBpbmcgaW5kaWNhdG9yIHN0YXRlXG4gICAqL1xuICAndHlwaW5nLWluZGljYXRvci1jaGFuZ2UnLFxuXS5jb25jYXQoUm9vdC5fc3VwcG9ydGVkRXZlbnRzKTtcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoVHlwaW5nSW5kaWNhdG9yTGlzdGVuZXIsIFtUeXBpbmdJbmRpY2F0b3JMaXN0ZW5lciwgJ1R5cGluZ0luZGljYXRvckxpc3RlbmVyJ10pO1xubW9kdWxlLmV4cG9ydHMgPSBUeXBpbmdJbmRpY2F0b3JMaXN0ZW5lcjtcbiJdfQ==
