'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * The TypingPublisher's job is:
 *
 *  1. Send state changes to the server
 *  2. Insure that the server is not flooded with repeated state changes of the same value
 *  3. Automatically transition states when no new states or old states are requested.
 *
 * Who is the Typing Publisher for?  Its used by the layer.TypingIndicators.TypingListener; if your using
 * the TypingListener, you don't need this.  If you want to provide your own logic for when to send typing
 * states, then you need the TypingPublisher.
 *
 * Create an instance using:
 *
 *        var publisher = client.createTypingPublisher();
 *
 * To tell the Publisher which Conversation its reporting activity on, use:
 *
 *        publisher.setConversation(mySelectedConversation);
 *
 * To then use the instance:
 *
 *        publisher.setState(layer.TypingIndicators.STARTED);
 *        publisher.setState(layer.TypingIndicators.PAUSED);
 *        publisher.setState(layer.TypingIndicators.FINISHED);
 *
 * Note that the `STARTED` state only lasts for 2.5 seconds, so you
 * must repeatedly call setState for as long as this state should continue.
 * This is typically done by simply calling `setState(STARTED)` every time a user hits
 * a key.
 *
 * A few rules for how the *publisher* works internally:
 *
 *  - it maintains an indicator state for the current conversation
 *  - if app calls  `setState(layer.TypingIndicators.STARTED);` publisher sends the event immediately
 *  - if app calls the same method under _2.5 seconds_ with the same typing indicator state (`started`), publisher waits
 *    for those 2.5 seconds to pass and then publishes the ephemeral event
 *  - if app calls the same methods multiple times within _2.5 seconds_ with the same value,
 *    publisher waits until end of 2.5 second period and sends the state only once.
 *  - if app calls the same method under _2.5 seconds_ with a different typing indicator state (say `paused`),
 *    publisher immediately sends the event
 *  - if 2.5 seconds passes without any events, state transitions from 'started' to 'paused'
 *  - if 2.5 seconds passes without any events, state transitions from 'paused' to 'finished'
 *
 * @class layer.TypingIndicators.TypingPublisher
 * @protected
 */

var INTERVAL = 500;

var _require = require('./typing-indicators');

var STARTED = _require.STARTED;
var PAUSED = _require.PAUSED;
var FINISHED = _require.FINISHED;

var ClientRegistry = require('../client-registry');

var TypingPublisher = function () {

  /**
   * Create a Typing Publisher.  See layer.Client.createTypingPublisher.
   *
   * The TypingPublisher needs
   * to know what Conversation its publishing changes for...
   * but it does not require that parameter during initialization.
   *
   * @method constructor
   * @param {Object} args
   * @param {string} clientId - The ID for the client from which we will get access to the websocket
   * @param {Object} [conversation=null] - The Conversation Object or Instance that messages are being typed to.
   */
  function TypingPublisher(args) {
    _classCallCheck(this, TypingPublisher);

    this.clientId = args.clientId;
    if (args.conversation) this.conversation = this._getClient().getConversation(args.conversation.id);
    this.state = FINISHED;
    this._lastMessageTime = 0;
  }

  /**
   * Set which Conversation we are reporting on state changes for.
   *
   * If this instance managed a previous Conversation,
   * its state is immediately transitioned to "finished".
   *
   * @method setConversation
   * @param  {Object} conv - Conversation Object or Instance
   */


  _createClass(TypingPublisher, [{
    key: 'setConversation',
    value: function setConversation(conv) {
      this.setState(FINISHED);
      this.conversation = conv ? this._getClient().getConversation(conv.id) : null;
      this.state = FINISHED;
    }

    /**
     * Sets the state and either sends the state to the server or schedules it to be sent.
     *
     * @method setState
     * @param  {string} state - One of
     * * layer.TypingIndicators.STARTED
     * * layer.TypingIndicators.PAUSED
     * * layer.TypingIndicators.FINISHED
     */

  }, {
    key: 'setState',
    value: function setState(state) {
      // We have a fresh state; whatever our pauseLoop was doing
      // can be canceled... and restarted later.
      if (this._pauseLoopId) {
        clearInterval(this._pauseLoopId);
        this._pauseLoopId = 0;
      }
      if (!this.conversation) return;

      // If its a new state, send it immediately.
      if (this.state !== state) {
        this.state = state;
        this._send(state);
      }

      // No need to resend 'finished' state
      else if (state === FINISHED) {
          return;
        }

        // If its an existing state that hasn't been sent in the
        // last 2.5 seconds, send it immediately.
        else if (Date.now() > this._lastMessageTime + INTERVAL) {
            this._send(state);
          }

          // Else schedule it to be sent.
          else {
              this._scheduleNextMessage(state);
            }

      // Start test to automatically transition if 2.5 seconds without any setState calls
      if (this.state !== FINISHED) this._startPauseLoop();
    }

    /**
     * Start loop to automatically change to next state.
     *
     * Any time we are set to 'started' or 'paused' we should transition
     * to the next state after 2.5 seconds of no setState calls.
     *
     * The 2.5 second setTimeout is canceled/restarted every call to setState()
     *
     * @method _startPauseLoop
     * @private
     */

  }, {
    key: '_startPauseLoop',
    value: function _startPauseLoop() {
      var _this = this;

      if (this._pauseLoopId) return;

      // Note that this interval is canceled every call to setState.
      this._pauseLoopId = window.setInterval(function () {
        if (_this.state === PAUSED) {
          _this.setState(FINISHED);
        } else if (_this.state === STARTED) {
          _this.setState(PAUSED);
        }
      }, INTERVAL * 5);
    }

    /**
     * Schedule the next state refresh message.
     *
     * It should be at least INTERVAL ms after
     * the last state message of the same state
     *
     * @method _scheduleNextMessage
     * @private
     * @param  {string} state - One of
     * * layer.TypingIndicators.STARTED
     * * layer.TypingIndicators.PAUSED
     * * layer.TypingIndicators.FINISHED
     */

  }, {
    key: '_scheduleNextMessage',
    value: function _scheduleNextMessage(state) {
      var _this2 = this;

      if (this._scheduleId) clearTimeout(this._scheduleId);
      var delay = INTERVAL - Math.min(Date.now() - this._lastMessageTime, INTERVAL);
      this._scheduleId = setTimeout(function () {
        _this2._scheduleId = 0;
        // If the state didn't change while waiting...
        if (_this2.state === state) _this2._send(state);
      }, delay);
    }

    /**
     * Send a state change to the server.
     *
     * @method send
     * @private
     * @param  {string} state - One of
     * * layer.TypingIndicators.STARTED
     * * layer.TypingIndicators.PAUSED
     * * layer.TypingIndicators.FINISHED
     */

  }, {
    key: '_send',
    value: function _send(state) {
      if (!this.conversation.isSaved()) return;
      this._lastMessageTime = Date.now();
      var ws = this._getClient().socketManager;
      ws.sendSignal({
        'type': 'typing_indicator',
        'object': {
          'id': this.conversation.id
        },
        'data': {
          'action': state
        }
      });
    }

    /**
     * Get the Client associated with this layer.Message.
     *
     * Uses the clientId property.
     *
     * @method getClient
     * @return {layer.Client}
     */

  }, {
    key: '_getClient',
    value: function _getClient() {
      return ClientRegistry.get(this.clientId);
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      delete this.conversation;
      this.isDestroyed = true;
      clearTimeout(this._scheduleId);
      clearInterval(this._pauseLoopId);
    }
  }]);

  return TypingPublisher;
}();

module.exports = TypingPublisher;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy90eXBpbmctaW5kaWNhdG9ycy90eXBpbmctcHVibGlzaGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQStDQSxJQUFNLFdBQVcsR0FBakI7O2VBQ3NDLFFBQVEscUJBQVIsQzs7SUFBOUIsTyxZQUFBLE87SUFBUyxNLFlBQUEsTTtJQUFRLFEsWUFBQSxROztBQUN6QixJQUFNLGlCQUFpQixRQUFRLG9CQUFSLENBQXZCOztJQUVNLGU7O0FBR0o7Ozs7Ozs7Ozs7OztBQVlBLDJCQUFZLElBQVosRUFBa0I7QUFBQTs7QUFDaEIsU0FBSyxRQUFMLEdBQWdCLEtBQUssUUFBckI7QUFDQSxRQUFJLEtBQUssWUFBVCxFQUF1QixLQUFLLFlBQUwsR0FBb0IsS0FBSyxVQUFMLEdBQWtCLGVBQWxCLENBQWtDLEtBQUssWUFBTCxDQUFrQixFQUFwRCxDQUFwQjtBQUN2QixTQUFLLEtBQUwsR0FBYSxRQUFiO0FBQ0EsU0FBSyxnQkFBTCxHQUF3QixDQUF4QjtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7O29DQVNnQixJLEVBQU07QUFDcEIsV0FBSyxRQUFMLENBQWMsUUFBZDtBQUNBLFdBQUssWUFBTCxHQUFvQixPQUFPLEtBQUssVUFBTCxHQUFrQixlQUFsQixDQUFrQyxLQUFLLEVBQXZDLENBQVAsR0FBb0QsSUFBeEU7QUFDQSxXQUFLLEtBQUwsR0FBYSxRQUFiO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7Ozs2QkFTUyxLLEVBQU87QUFDZDtBQUNBO0FBQ0EsVUFBSSxLQUFLLFlBQVQsRUFBdUI7QUFDckIsc0JBQWMsS0FBSyxZQUFuQjtBQUNBLGFBQUssWUFBTCxHQUFvQixDQUFwQjtBQUNEO0FBQ0QsVUFBSSxDQUFDLEtBQUssWUFBVixFQUF3Qjs7QUFFeEI7QUFDQSxVQUFJLEtBQUssS0FBTCxLQUFlLEtBQW5CLEVBQTBCO0FBQ3hCLGFBQUssS0FBTCxHQUFhLEtBQWI7QUFDQSxhQUFLLEtBQUwsQ0FBVyxLQUFYO0FBQ0Q7O0FBRUQ7QUFMQSxXQU1LLElBQUksVUFBVSxRQUFkLEVBQXdCO0FBQzNCO0FBQ0Q7O0FBRUQ7QUFDQTtBQUxLLGFBTUEsSUFBSSxLQUFLLEdBQUwsS0FBYSxLQUFLLGdCQUFMLEdBQXdCLFFBQXpDLEVBQW1EO0FBQ3RELGlCQUFLLEtBQUwsQ0FBVyxLQUFYO0FBQ0Q7O0FBRUQ7QUFKSyxlQUtBO0FBQ0gsbUJBQUssb0JBQUwsQ0FBMEIsS0FBMUI7QUFDRDs7QUFFRDtBQUNBLFVBQUksS0FBSyxLQUFMLEtBQWUsUUFBbkIsRUFBNkIsS0FBSyxlQUFMO0FBQzlCOztBQUVEOzs7Ozs7Ozs7Ozs7OztzQ0FXa0I7QUFBQTs7QUFDaEIsVUFBSSxLQUFLLFlBQVQsRUFBdUI7O0FBRXZCO0FBQ0EsV0FBSyxZQUFMLEdBQW9CLE9BQU8sV0FBUCxDQUFtQixZQUFNO0FBQzNDLFlBQUksTUFBSyxLQUFMLEtBQWUsTUFBbkIsRUFBMkI7QUFDekIsZ0JBQUssUUFBTCxDQUFjLFFBQWQ7QUFDRCxTQUZELE1BRU8sSUFBSSxNQUFLLEtBQUwsS0FBZSxPQUFuQixFQUE0QjtBQUNqQyxnQkFBSyxRQUFMLENBQWMsTUFBZDtBQUNEO0FBQ0YsT0FObUIsRUFNakIsV0FBVyxDQU5NLENBQXBCO0FBT0Q7O0FBR0Q7Ozs7Ozs7Ozs7Ozs7Ozs7eUNBYXFCLEssRUFBTztBQUFBOztBQUMxQixVQUFJLEtBQUssV0FBVCxFQUFzQixhQUFhLEtBQUssV0FBbEI7QUFDdEIsVUFBTSxRQUFRLFdBQVcsS0FBSyxHQUFMLENBQVMsS0FBSyxHQUFMLEtBQWEsS0FBSyxnQkFBM0IsRUFBNkMsUUFBN0MsQ0FBekI7QUFDQSxXQUFLLFdBQUwsR0FBbUIsV0FBVyxZQUFNO0FBQ2xDLGVBQUssV0FBTCxHQUFtQixDQUFuQjtBQUNBO0FBQ0EsWUFBSSxPQUFLLEtBQUwsS0FBZSxLQUFuQixFQUEwQixPQUFLLEtBQUwsQ0FBVyxLQUFYO0FBQzNCLE9BSmtCLEVBSWhCLEtBSmdCLENBQW5CO0FBS0Q7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7MEJBVU0sSyxFQUFPO0FBQ1gsVUFBSSxDQUFDLEtBQUssWUFBTCxDQUFrQixPQUFsQixFQUFMLEVBQWtDO0FBQ2xDLFdBQUssZ0JBQUwsR0FBd0IsS0FBSyxHQUFMLEVBQXhCO0FBQ0EsVUFBTSxLQUFLLEtBQUssVUFBTCxHQUFrQixhQUE3QjtBQUNBLFNBQUcsVUFBSCxDQUFjO0FBQ1osZ0JBQVEsa0JBREk7QUFFWixrQkFBVTtBQUNSLGdCQUFNLEtBQUssWUFBTCxDQUFrQjtBQURoQixTQUZFO0FBS1osZ0JBQVE7QUFDTixvQkFBVTtBQURKO0FBTEksT0FBZDtBQVNEOztBQUVEOzs7Ozs7Ozs7OztpQ0FRYTtBQUNYLGFBQU8sZUFBZSxHQUFmLENBQW1CLEtBQUssUUFBeEIsQ0FBUDtBQUNEOzs7OEJBRVM7QUFDUixhQUFPLEtBQUssWUFBWjtBQUNBLFdBQUssV0FBTCxHQUFtQixJQUFuQjtBQUNBLG1CQUFhLEtBQUssV0FBbEI7QUFDQSxvQkFBYyxLQUFLLFlBQW5CO0FBQ0Q7Ozs7OztBQUVILE9BQU8sT0FBUCxHQUFpQixlQUFqQiIsImZpbGUiOiJ0eXBpbmctcHVibGlzaGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUaGUgVHlwaW5nUHVibGlzaGVyJ3Mgam9iIGlzOlxuICpcbiAqICAxLiBTZW5kIHN0YXRlIGNoYW5nZXMgdG8gdGhlIHNlcnZlclxuICogIDIuIEluc3VyZSB0aGF0IHRoZSBzZXJ2ZXIgaXMgbm90IGZsb29kZWQgd2l0aCByZXBlYXRlZCBzdGF0ZSBjaGFuZ2VzIG9mIHRoZSBzYW1lIHZhbHVlXG4gKiAgMy4gQXV0b21hdGljYWxseSB0cmFuc2l0aW9uIHN0YXRlcyB3aGVuIG5vIG5ldyBzdGF0ZXMgb3Igb2xkIHN0YXRlcyBhcmUgcmVxdWVzdGVkLlxuICpcbiAqIFdobyBpcyB0aGUgVHlwaW5nIFB1Ymxpc2hlciBmb3I/ICBJdHMgdXNlZCBieSB0aGUgbGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5UeXBpbmdMaXN0ZW5lcjsgaWYgeW91ciB1c2luZ1xuICogdGhlIFR5cGluZ0xpc3RlbmVyLCB5b3UgZG9uJ3QgbmVlZCB0aGlzLiAgSWYgeW91IHdhbnQgdG8gcHJvdmlkZSB5b3VyIG93biBsb2dpYyBmb3Igd2hlbiB0byBzZW5kIHR5cGluZ1xuICogc3RhdGVzLCB0aGVuIHlvdSBuZWVkIHRoZSBUeXBpbmdQdWJsaXNoZXIuXG4gKlxuICogQ3JlYXRlIGFuIGluc3RhbmNlIHVzaW5nOlxuICpcbiAqICAgICAgICB2YXIgcHVibGlzaGVyID0gY2xpZW50LmNyZWF0ZVR5cGluZ1B1Ymxpc2hlcigpO1xuICpcbiAqIFRvIHRlbGwgdGhlIFB1Ymxpc2hlciB3aGljaCBDb252ZXJzYXRpb24gaXRzIHJlcG9ydGluZyBhY3Rpdml0eSBvbiwgdXNlOlxuICpcbiAqICAgICAgICBwdWJsaXNoZXIuc2V0Q29udmVyc2F0aW9uKG15U2VsZWN0ZWRDb252ZXJzYXRpb24pO1xuICpcbiAqIFRvIHRoZW4gdXNlIHRoZSBpbnN0YW5jZTpcbiAqXG4gKiAgICAgICAgcHVibGlzaGVyLnNldFN0YXRlKGxheWVyLlR5cGluZ0luZGljYXRvcnMuU1RBUlRFRCk7XG4gKiAgICAgICAgcHVibGlzaGVyLnNldFN0YXRlKGxheWVyLlR5cGluZ0luZGljYXRvcnMuUEFVU0VEKTtcbiAqICAgICAgICBwdWJsaXNoZXIuc2V0U3RhdGUobGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5GSU5JU0hFRCk7XG4gKlxuICogTm90ZSB0aGF0IHRoZSBgU1RBUlRFRGAgc3RhdGUgb25seSBsYXN0cyBmb3IgMi41IHNlY29uZHMsIHNvIHlvdVxuICogbXVzdCByZXBlYXRlZGx5IGNhbGwgc2V0U3RhdGUgZm9yIGFzIGxvbmcgYXMgdGhpcyBzdGF0ZSBzaG91bGQgY29udGludWUuXG4gKiBUaGlzIGlzIHR5cGljYWxseSBkb25lIGJ5IHNpbXBseSBjYWxsaW5nIGBzZXRTdGF0ZShTVEFSVEVEKWAgZXZlcnkgdGltZSBhIHVzZXIgaGl0c1xuICogYSBrZXkuXG4gKlxuICogQSBmZXcgcnVsZXMgZm9yIGhvdyB0aGUgKnB1Ymxpc2hlciogd29ya3MgaW50ZXJuYWxseTpcbiAqXG4gKiAgLSBpdCBtYWludGFpbnMgYW4gaW5kaWNhdG9yIHN0YXRlIGZvciB0aGUgY3VycmVudCBjb252ZXJzYXRpb25cbiAqICAtIGlmIGFwcCBjYWxscyAgYHNldFN0YXRlKGxheWVyLlR5cGluZ0luZGljYXRvcnMuU1RBUlRFRCk7YCBwdWJsaXNoZXIgc2VuZHMgdGhlIGV2ZW50IGltbWVkaWF0ZWx5XG4gKiAgLSBpZiBhcHAgY2FsbHMgdGhlIHNhbWUgbWV0aG9kIHVuZGVyIF8yLjUgc2Vjb25kc18gd2l0aCB0aGUgc2FtZSB0eXBpbmcgaW5kaWNhdG9yIHN0YXRlIChgc3RhcnRlZGApLCBwdWJsaXNoZXIgd2FpdHNcbiAqICAgIGZvciB0aG9zZSAyLjUgc2Vjb25kcyB0byBwYXNzIGFuZCB0aGVuIHB1Ymxpc2hlcyB0aGUgZXBoZW1lcmFsIGV2ZW50XG4gKiAgLSBpZiBhcHAgY2FsbHMgdGhlIHNhbWUgbWV0aG9kcyBtdWx0aXBsZSB0aW1lcyB3aXRoaW4gXzIuNSBzZWNvbmRzXyB3aXRoIHRoZSBzYW1lIHZhbHVlLFxuICogICAgcHVibGlzaGVyIHdhaXRzIHVudGlsIGVuZCBvZiAyLjUgc2Vjb25kIHBlcmlvZCBhbmQgc2VuZHMgdGhlIHN0YXRlIG9ubHkgb25jZS5cbiAqICAtIGlmIGFwcCBjYWxscyB0aGUgc2FtZSBtZXRob2QgdW5kZXIgXzIuNSBzZWNvbmRzXyB3aXRoIGEgZGlmZmVyZW50IHR5cGluZyBpbmRpY2F0b3Igc3RhdGUgKHNheSBgcGF1c2VkYCksXG4gKiAgICBwdWJsaXNoZXIgaW1tZWRpYXRlbHkgc2VuZHMgdGhlIGV2ZW50XG4gKiAgLSBpZiAyLjUgc2Vjb25kcyBwYXNzZXMgd2l0aG91dCBhbnkgZXZlbnRzLCBzdGF0ZSB0cmFuc2l0aW9ucyBmcm9tICdzdGFydGVkJyB0byAncGF1c2VkJ1xuICogIC0gaWYgMi41IHNlY29uZHMgcGFzc2VzIHdpdGhvdXQgYW55IGV2ZW50cywgc3RhdGUgdHJhbnNpdGlvbnMgZnJvbSAncGF1c2VkJyB0byAnZmluaXNoZWQnXG4gKlxuICogQGNsYXNzIGxheWVyLlR5cGluZ0luZGljYXRvcnMuVHlwaW5nUHVibGlzaGVyXG4gKiBAcHJvdGVjdGVkXG4gKi9cblxuY29uc3QgSU5URVJWQUwgPSA1MDA7XG5jb25zdCB7IFNUQVJURUQsIFBBVVNFRCwgRklOSVNIRUQgfSA9IHJlcXVpcmUoJy4vdHlwaW5nLWluZGljYXRvcnMnKTtcbmNvbnN0IENsaWVudFJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi4vY2xpZW50LXJlZ2lzdHJ5Jyk7XG5cbmNsYXNzIFR5cGluZ1B1Ymxpc2hlciB7XG5cblxuICAvKipcbiAgICogQ3JlYXRlIGEgVHlwaW5nIFB1Ymxpc2hlci4gIFNlZSBsYXllci5DbGllbnQuY3JlYXRlVHlwaW5nUHVibGlzaGVyLlxuICAgKlxuICAgKiBUaGUgVHlwaW5nUHVibGlzaGVyIG5lZWRzXG4gICAqIHRvIGtub3cgd2hhdCBDb252ZXJzYXRpb24gaXRzIHB1Ymxpc2hpbmcgY2hhbmdlcyBmb3IuLi5cbiAgICogYnV0IGl0IGRvZXMgbm90IHJlcXVpcmUgdGhhdCBwYXJhbWV0ZXIgZHVyaW5nIGluaXRpYWxpemF0aW9uLlxuICAgKlxuICAgKiBAbWV0aG9kIGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBhcmdzXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBjbGllbnRJZCAtIFRoZSBJRCBmb3IgdGhlIGNsaWVudCBmcm9tIHdoaWNoIHdlIHdpbGwgZ2V0IGFjY2VzcyB0byB0aGUgd2Vic29ja2V0XG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbY29udmVyc2F0aW9uPW51bGxdIC0gVGhlIENvbnZlcnNhdGlvbiBPYmplY3Qgb3IgSW5zdGFuY2UgdGhhdCBtZXNzYWdlcyBhcmUgYmVpbmcgdHlwZWQgdG8uXG4gICAqL1xuICBjb25zdHJ1Y3RvcihhcmdzKSB7XG4gICAgdGhpcy5jbGllbnRJZCA9IGFyZ3MuY2xpZW50SWQ7XG4gICAgaWYgKGFyZ3MuY29udmVyc2F0aW9uKSB0aGlzLmNvbnZlcnNhdGlvbiA9IHRoaXMuX2dldENsaWVudCgpLmdldENvbnZlcnNhdGlvbihhcmdzLmNvbnZlcnNhdGlvbi5pZCk7XG4gICAgdGhpcy5zdGF0ZSA9IEZJTklTSEVEO1xuICAgIHRoaXMuX2xhc3RNZXNzYWdlVGltZSA9IDA7XG4gIH1cblxuICAvKipcbiAgICogU2V0IHdoaWNoIENvbnZlcnNhdGlvbiB3ZSBhcmUgcmVwb3J0aW5nIG9uIHN0YXRlIGNoYW5nZXMgZm9yLlxuICAgKlxuICAgKiBJZiB0aGlzIGluc3RhbmNlIG1hbmFnZWQgYSBwcmV2aW91cyBDb252ZXJzYXRpb24sXG4gICAqIGl0cyBzdGF0ZSBpcyBpbW1lZGlhdGVseSB0cmFuc2l0aW9uZWQgdG8gXCJmaW5pc2hlZFwiLlxuICAgKlxuICAgKiBAbWV0aG9kIHNldENvbnZlcnNhdGlvblxuICAgKiBAcGFyYW0gIHtPYmplY3R9IGNvbnYgLSBDb252ZXJzYXRpb24gT2JqZWN0IG9yIEluc3RhbmNlXG4gICAqL1xuICBzZXRDb252ZXJzYXRpb24oY29udikge1xuICAgIHRoaXMuc2V0U3RhdGUoRklOSVNIRUQpO1xuICAgIHRoaXMuY29udmVyc2F0aW9uID0gY29udiA/IHRoaXMuX2dldENsaWVudCgpLmdldENvbnZlcnNhdGlvbihjb252LmlkKSA6IG51bGw7XG4gICAgdGhpcy5zdGF0ZSA9IEZJTklTSEVEO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIHN0YXRlIGFuZCBlaXRoZXIgc2VuZHMgdGhlIHN0YXRlIHRvIHRoZSBzZXJ2ZXIgb3Igc2NoZWR1bGVzIGl0IHRvIGJlIHNlbnQuXG4gICAqXG4gICAqIEBtZXRob2Qgc2V0U3RhdGVcbiAgICogQHBhcmFtICB7c3RyaW5nfSBzdGF0ZSAtIE9uZSBvZlxuICAgKiAqIGxheWVyLlR5cGluZ0luZGljYXRvcnMuU1RBUlRFRFxuICAgKiAqIGxheWVyLlR5cGluZ0luZGljYXRvcnMuUEFVU0VEXG4gICAqICogbGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5GSU5JU0hFRFxuICAgKi9cbiAgc2V0U3RhdGUoc3RhdGUpIHtcbiAgICAvLyBXZSBoYXZlIGEgZnJlc2ggc3RhdGU7IHdoYXRldmVyIG91ciBwYXVzZUxvb3Agd2FzIGRvaW5nXG4gICAgLy8gY2FuIGJlIGNhbmNlbGVkLi4uIGFuZCByZXN0YXJ0ZWQgbGF0ZXIuXG4gICAgaWYgKHRoaXMuX3BhdXNlTG9vcElkKSB7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMuX3BhdXNlTG9vcElkKTtcbiAgICAgIHRoaXMuX3BhdXNlTG9vcElkID0gMDtcbiAgICB9XG4gICAgaWYgKCF0aGlzLmNvbnZlcnNhdGlvbikgcmV0dXJuO1xuXG4gICAgLy8gSWYgaXRzIGEgbmV3IHN0YXRlLCBzZW5kIGl0IGltbWVkaWF0ZWx5LlxuICAgIGlmICh0aGlzLnN0YXRlICE9PSBzdGF0ZSkge1xuICAgICAgdGhpcy5zdGF0ZSA9IHN0YXRlO1xuICAgICAgdGhpcy5fc2VuZChzdGF0ZSk7XG4gICAgfVxuXG4gICAgLy8gTm8gbmVlZCB0byByZXNlbmQgJ2ZpbmlzaGVkJyBzdGF0ZVxuICAgIGVsc2UgaWYgKHN0YXRlID09PSBGSU5JU0hFRCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIElmIGl0cyBhbiBleGlzdGluZyBzdGF0ZSB0aGF0IGhhc24ndCBiZWVuIHNlbnQgaW4gdGhlXG4gICAgLy8gbGFzdCAyLjUgc2Vjb25kcywgc2VuZCBpdCBpbW1lZGlhdGVseS5cbiAgICBlbHNlIGlmIChEYXRlLm5vdygpID4gdGhpcy5fbGFzdE1lc3NhZ2VUaW1lICsgSU5URVJWQUwpIHtcbiAgICAgIHRoaXMuX3NlbmQoc3RhdGUpO1xuICAgIH1cblxuICAgIC8vIEVsc2Ugc2NoZWR1bGUgaXQgdG8gYmUgc2VudC5cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMuX3NjaGVkdWxlTmV4dE1lc3NhZ2Uoc3RhdGUpO1xuICAgIH1cblxuICAgIC8vIFN0YXJ0IHRlc3QgdG8gYXV0b21hdGljYWxseSB0cmFuc2l0aW9uIGlmIDIuNSBzZWNvbmRzIHdpdGhvdXQgYW55IHNldFN0YXRlIGNhbGxzXG4gICAgaWYgKHRoaXMuc3RhdGUgIT09IEZJTklTSEVEKSB0aGlzLl9zdGFydFBhdXNlTG9vcCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIFN0YXJ0IGxvb3AgdG8gYXV0b21hdGljYWxseSBjaGFuZ2UgdG8gbmV4dCBzdGF0ZS5cbiAgICpcbiAgICogQW55IHRpbWUgd2UgYXJlIHNldCB0byAnc3RhcnRlZCcgb3IgJ3BhdXNlZCcgd2Ugc2hvdWxkIHRyYW5zaXRpb25cbiAgICogdG8gdGhlIG5leHQgc3RhdGUgYWZ0ZXIgMi41IHNlY29uZHMgb2Ygbm8gc2V0U3RhdGUgY2FsbHMuXG4gICAqXG4gICAqIFRoZSAyLjUgc2Vjb25kIHNldFRpbWVvdXQgaXMgY2FuY2VsZWQvcmVzdGFydGVkIGV2ZXJ5IGNhbGwgdG8gc2V0U3RhdGUoKVxuICAgKlxuICAgKiBAbWV0aG9kIF9zdGFydFBhdXNlTG9vcFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3N0YXJ0UGF1c2VMb29wKCkge1xuICAgIGlmICh0aGlzLl9wYXVzZUxvb3BJZCkgcmV0dXJuO1xuXG4gICAgLy8gTm90ZSB0aGF0IHRoaXMgaW50ZXJ2YWwgaXMgY2FuY2VsZWQgZXZlcnkgY2FsbCB0byBzZXRTdGF0ZS5cbiAgICB0aGlzLl9wYXVzZUxvb3BJZCA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5zdGF0ZSA9PT0gUEFVU0VEKSB7XG4gICAgICAgIHRoaXMuc2V0U3RhdGUoRklOSVNIRUQpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLnN0YXRlID09PSBTVEFSVEVEKSB7XG4gICAgICAgIHRoaXMuc2V0U3RhdGUoUEFVU0VEKTtcbiAgICAgIH1cbiAgICB9LCBJTlRFUlZBTCAqIDUpO1xuICB9XG5cblxuICAvKipcbiAgICogU2NoZWR1bGUgdGhlIG5leHQgc3RhdGUgcmVmcmVzaCBtZXNzYWdlLlxuICAgKlxuICAgKiBJdCBzaG91bGQgYmUgYXQgbGVhc3QgSU5URVJWQUwgbXMgYWZ0ZXJcbiAgICogdGhlIGxhc3Qgc3RhdGUgbWVzc2FnZSBvZiB0aGUgc2FtZSBzdGF0ZVxuICAgKlxuICAgKiBAbWV0aG9kIF9zY2hlZHVsZU5leHRNZXNzYWdlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge3N0cmluZ30gc3RhdGUgLSBPbmUgb2ZcbiAgICogKiBsYXllci5UeXBpbmdJbmRpY2F0b3JzLlNUQVJURURcbiAgICogKiBsYXllci5UeXBpbmdJbmRpY2F0b3JzLlBBVVNFRFxuICAgKiAqIGxheWVyLlR5cGluZ0luZGljYXRvcnMuRklOSVNIRURcbiAgICovXG4gIF9zY2hlZHVsZU5leHRNZXNzYWdlKHN0YXRlKSB7XG4gICAgaWYgKHRoaXMuX3NjaGVkdWxlSWQpIGNsZWFyVGltZW91dCh0aGlzLl9zY2hlZHVsZUlkKTtcbiAgICBjb25zdCBkZWxheSA9IElOVEVSVkFMIC0gTWF0aC5taW4oRGF0ZS5ub3coKSAtIHRoaXMuX2xhc3RNZXNzYWdlVGltZSwgSU5URVJWQUwpO1xuICAgIHRoaXMuX3NjaGVkdWxlSWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMuX3NjaGVkdWxlSWQgPSAwO1xuICAgICAgLy8gSWYgdGhlIHN0YXRlIGRpZG4ndCBjaGFuZ2Ugd2hpbGUgd2FpdGluZy4uLlxuICAgICAgaWYgKHRoaXMuc3RhdGUgPT09IHN0YXRlKSB0aGlzLl9zZW5kKHN0YXRlKTtcbiAgICB9LCBkZWxheSk7XG4gIH1cblxuICAvKipcbiAgICogU2VuZCBhIHN0YXRlIGNoYW5nZSB0byB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBAbWV0aG9kIHNlbmRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7c3RyaW5nfSBzdGF0ZSAtIE9uZSBvZlxuICAgKiAqIGxheWVyLlR5cGluZ0luZGljYXRvcnMuU1RBUlRFRFxuICAgKiAqIGxheWVyLlR5cGluZ0luZGljYXRvcnMuUEFVU0VEXG4gICAqICogbGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5GSU5JU0hFRFxuICAgKi9cbiAgX3NlbmQoc3RhdGUpIHtcbiAgICBpZiAoIXRoaXMuY29udmVyc2F0aW9uLmlzU2F2ZWQoKSkgcmV0dXJuO1xuICAgIHRoaXMuX2xhc3RNZXNzYWdlVGltZSA9IERhdGUubm93KCk7XG4gICAgY29uc3Qgd3MgPSB0aGlzLl9nZXRDbGllbnQoKS5zb2NrZXRNYW5hZ2VyO1xuICAgIHdzLnNlbmRTaWduYWwoe1xuICAgICAgJ3R5cGUnOiAndHlwaW5nX2luZGljYXRvcicsXG4gICAgICAnb2JqZWN0Jzoge1xuICAgICAgICAnaWQnOiB0aGlzLmNvbnZlcnNhdGlvbi5pZCxcbiAgICAgIH0sXG4gICAgICAnZGF0YSc6IHtcbiAgICAgICAgJ2FjdGlvbic6IHN0YXRlLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIENsaWVudCBhc3NvY2lhdGVkIHdpdGggdGhpcyBsYXllci5NZXNzYWdlLlxuICAgKlxuICAgKiBVc2VzIHRoZSBjbGllbnRJZCBwcm9wZXJ0eS5cbiAgICpcbiAgICogQG1ldGhvZCBnZXRDbGllbnRcbiAgICogQHJldHVybiB7bGF5ZXIuQ2xpZW50fVxuICAgKi9cbiAgX2dldENsaWVudCgpIHtcbiAgICByZXR1cm4gQ2xpZW50UmVnaXN0cnkuZ2V0KHRoaXMuY2xpZW50SWQpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBkZWxldGUgdGhpcy5jb252ZXJzYXRpb247XG4gICAgdGhpcy5pc0Rlc3Ryb3llZCA9IHRydWU7XG4gICAgY2xlYXJUaW1lb3V0KHRoaXMuX3NjaGVkdWxlSWQpO1xuICAgIGNsZWFySW50ZXJ2YWwodGhpcy5fcGF1c2VMb29wSWQpO1xuICB9XG59XG5tb2R1bGUuZXhwb3J0cyA9IFR5cGluZ1B1Ymxpc2hlcjtcbiJdfQ==
