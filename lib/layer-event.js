'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * This class represents a Layer Event, and is used as the parameter for all event handlers.
 *
 * Calls to
 *
 *      obj.trigger('eventName2', {hey: 'ho'});
 *
 * results in:
 *
 *      obj.on('eventName2', function(layerEvent) {
 *          alert(layerEvent.target.toString() + ' has fired a value of ' + layerEvent.hey);
 *      });
 *
 * Change events (events ending in ':change') get special handling:
 *
 *      obj.trigger('obj:change', {
 *          newValue: 55,
 *          oldValue: 25,
 *          property: 'hey'
 *      });
 *
 * results in your event data being wrapped in a `changes` array:
 *
 *      obj.on('obj:change', function(layerEvent) {
 *          layerEvent.changes.forEach(function(change) {
 *              alert(layerEvent.target.toString() + ' changed ' +
 *                    change.property + ' from ' + change.oldValue +
 *                    ' to ' + change.newValue);
 *          });
 *      });
 *
 * The `layer.LayerEvent.getChangesFor()` and `layer.LayerEvent.hasProperty()` methods
 * simplify working with xxx:change events so you don't need
 * to iterate over the `changes` array.
 *
 * @class layer.LayerEvent
 */

var LayerEvent = function () {
  /**
   * Constructor for LayerEvent.
   *
   * @method
   * @param  {Object} args - Properties to mixin to the event
   * @param  {string} eventName - Name of the event that generated this LayerEvent.
   * @return {layer.LayerEvent}
   */
  function LayerEvent(args, eventName) {
    var _this = this;

    _classCallCheck(this, LayerEvent);

    var ptr = this;

    // Is it a change event?  if so, setup the change properties.
    if (eventName.match(/:change$/)) {
      this.changes = [{}];
      // All args get copied into the changes object instead of this
      ptr = this.changes[0];
      this.isChange = true;
    } else {
      this.isChange = false;
    }

    // Copy the args into either this Event object... or into the change object.
    // Wouldn't be needed if this inherited from Root.
    Object.keys(args).forEach(function (name) {
      // Even if we are copying properties into the change object, target remains
      // a property of LayerEvent.
      if (ptr !== _this && name === 'target') {
        _this.target = args.target;
      } else {
        ptr[name] = args[name];
      }
    });
    this.eventName = eventName;
  }

  /**
   * Returns true if the specified property was changed.
   *
   * Returns false if this is not a change event.
   *
   *      if (layerEvent.hasProperty('age')) {
   *          handleAgeChange(obj.age);
   *      }
   *
   * @method hasProperty
   * @param  {string}  name - Name of the property
   * @return {Boolean}
   */


  _createClass(LayerEvent, [{
    key: 'hasProperty',
    value: function hasProperty(name) {
      if (!this.isChange) return false;
      return Boolean(this.changes.filter(function (change) {
        return change.property === name;
      }).length);
    }

    /**
     * Get all changes to the property.
     *
     * Returns an array of changes.
     * If this is not a change event, will return []
     * Changes are typically of the form:
     *
     *      layerEvent.getChangesFor('age');
     *      > [{
     *          oldValue: 10,
     *          newValue: 5,
     *          property: 'age'
     *      }]
     *
     * @method getChangesFor
     * @param  {string} name - Name of the property whose changes are of interest
     * @return {Object[]}
     */

  }, {
    key: 'getChangesFor',
    value: function getChangesFor(name) {
      if (!this.isChange) return [];
      return this.changes.filter(function (change) {
        return change.property === name;
      });
    }

    /**
     * Merge changes into a single changes array.
     *
     * The other event will need to be deleted.
     *
     * @method _mergeChanges
     * @protected
     * @param  {layer.LayerEvent} evt
     */

  }, {
    key: '_mergeChanges',
    value: function _mergeChanges(evt) {
      this.changes = this.changes.concat(evt.changes);
    }
  }]);

  return LayerEvent;
}();

/**
 * Indicates that this is a change event.
 *
 * If the event name ends with ':change' then
 * it is treated as a change event;  such
 * events are assumed to come with `newValue`, `oldValue` and `property` in the layer.LayerEvent.changes property.
 * @type {Boolean}
 */


LayerEvent.prototype.isChange = false;

/**
 * Array of changes (Change Events only).
 *
 * If its a Change Event, then the changes property contains an array of change objects
 * which each contain:
 *
 * * oldValue
 * * newValue
 * * property
 *
 * @type {Object[]}
 */
LayerEvent.prototype.changes = null;

/**
 * Component that was the source of the change.
 *
 * If one calls
 *
 *      obj.trigger('event');
 *
 * then obj will be the target.
 * @type {layer.Root}
 */
LayerEvent.prototype.target = null;

/**
 * The name of the event that created this instance.
 *
 * If one calls
 *
 *      obj.trigger('myevent');
 *
 * then eventName = 'myevent'
 *
 * @type {String}
 */
LayerEvent.prototype.eventName = '';

module.exports = LayerEvent;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9sYXllci1ldmVudC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFzQ00sVTtBQUNKOzs7Ozs7OztBQVFBLHNCQUFZLElBQVosRUFBa0IsU0FBbEIsRUFBNkI7QUFBQTs7QUFBQTs7QUFDM0IsUUFBSSxNQUFNLElBQVY7O0FBRUE7QUFDQSxRQUFJLFVBQVUsS0FBVixDQUFnQixVQUFoQixDQUFKLEVBQWlDO0FBQy9CLFdBQUssT0FBTCxHQUFlLENBQUMsRUFBRCxDQUFmO0FBQ0E7QUFDQSxZQUFNLEtBQUssT0FBTCxDQUFhLENBQWIsQ0FBTjtBQUNBLFdBQUssUUFBTCxHQUFnQixJQUFoQjtBQUNELEtBTEQsTUFLTztBQUNMLFdBQUssUUFBTCxHQUFnQixLQUFoQjtBQUNEOztBQUVEO0FBQ0E7QUFDQSxXQUFPLElBQVAsQ0FBWSxJQUFaLEVBQWtCLE9BQWxCLENBQTBCLGdCQUFRO0FBQ2hDO0FBQ0E7QUFDQSxVQUFJLGlCQUFnQixTQUFTLFFBQTdCLEVBQXVDO0FBQ3JDLGNBQUssTUFBTCxHQUFjLEtBQUssTUFBbkI7QUFDRCxPQUZELE1BRU87QUFDTCxZQUFJLElBQUosSUFBWSxLQUFLLElBQUwsQ0FBWjtBQUNEO0FBQ0YsS0FSRDtBQVNBLFNBQUssU0FBTCxHQUFpQixTQUFqQjtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7OztnQ0FhWSxJLEVBQU07QUFDaEIsVUFBSSxDQUFDLEtBQUssUUFBVixFQUFvQixPQUFPLEtBQVA7QUFDcEIsYUFBTyxRQUFRLEtBQUssT0FBTCxDQUFhLE1BQWIsQ0FBb0I7QUFBQSxlQUFVLE9BQU8sUUFBUCxLQUFvQixJQUE5QjtBQUFBLE9BQXBCLEVBQXdELE1BQWhFLENBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O2tDQWtCYyxJLEVBQU07QUFDbEIsVUFBSSxDQUFDLEtBQUssUUFBVixFQUFvQixPQUFPLEVBQVA7QUFDcEIsYUFBTyxLQUFLLE9BQUwsQ0FBYSxNQUFiLENBQW9CO0FBQUEsZUFBVSxPQUFPLFFBQVAsS0FBb0IsSUFBOUI7QUFBQSxPQUFwQixDQUFQO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7OztrQ0FTYyxHLEVBQUs7QUFDakIsV0FBSyxPQUFMLEdBQWUsS0FBSyxPQUFMLENBQWEsTUFBYixDQUFvQixJQUFJLE9BQXhCLENBQWY7QUFDRDs7Ozs7O0FBR0g7Ozs7Ozs7Ozs7QUFRQSxXQUFXLFNBQVgsQ0FBcUIsUUFBckIsR0FBZ0MsS0FBaEM7O0FBRUE7Ozs7Ozs7Ozs7OztBQVlBLFdBQVcsU0FBWCxDQUFxQixPQUFyQixHQUErQixJQUEvQjs7QUFFQTs7Ozs7Ozs7OztBQVVBLFdBQVcsU0FBWCxDQUFxQixNQUFyQixHQUE4QixJQUE5Qjs7QUFFQTs7Ozs7Ozs7Ozs7QUFXQSxXQUFXLFNBQVgsQ0FBcUIsU0FBckIsR0FBaUMsRUFBakM7O0FBRUEsT0FBTyxPQUFQLEdBQWlCLFVBQWpCIiwiZmlsZSI6ImxheWVyLWV2ZW50LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUaGlzIGNsYXNzIHJlcHJlc2VudHMgYSBMYXllciBFdmVudCwgYW5kIGlzIHVzZWQgYXMgdGhlIHBhcmFtZXRlciBmb3IgYWxsIGV2ZW50IGhhbmRsZXJzLlxuICpcbiAqIENhbGxzIHRvXG4gKlxuICogICAgICBvYmoudHJpZ2dlcignZXZlbnROYW1lMicsIHtoZXk6ICdobyd9KTtcbiAqXG4gKiByZXN1bHRzIGluOlxuICpcbiAqICAgICAgb2JqLm9uKCdldmVudE5hbWUyJywgZnVuY3Rpb24obGF5ZXJFdmVudCkge1xuICogICAgICAgICAgYWxlcnQobGF5ZXJFdmVudC50YXJnZXQudG9TdHJpbmcoKSArICcgaGFzIGZpcmVkIGEgdmFsdWUgb2YgJyArIGxheWVyRXZlbnQuaGV5KTtcbiAqICAgICAgfSk7XG4gKlxuICogQ2hhbmdlIGV2ZW50cyAoZXZlbnRzIGVuZGluZyBpbiAnOmNoYW5nZScpIGdldCBzcGVjaWFsIGhhbmRsaW5nOlxuICpcbiAqICAgICAgb2JqLnRyaWdnZXIoJ29iajpjaGFuZ2UnLCB7XG4gKiAgICAgICAgICBuZXdWYWx1ZTogNTUsXG4gKiAgICAgICAgICBvbGRWYWx1ZTogMjUsXG4gKiAgICAgICAgICBwcm9wZXJ0eTogJ2hleSdcbiAqICAgICAgfSk7XG4gKlxuICogcmVzdWx0cyBpbiB5b3VyIGV2ZW50IGRhdGEgYmVpbmcgd3JhcHBlZCBpbiBhIGBjaGFuZ2VzYCBhcnJheTpcbiAqXG4gKiAgICAgIG9iai5vbignb2JqOmNoYW5nZScsIGZ1bmN0aW9uKGxheWVyRXZlbnQpIHtcbiAqICAgICAgICAgIGxheWVyRXZlbnQuY2hhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uKGNoYW5nZSkge1xuICogICAgICAgICAgICAgIGFsZXJ0KGxheWVyRXZlbnQudGFyZ2V0LnRvU3RyaW5nKCkgKyAnIGNoYW5nZWQgJyArXG4gKiAgICAgICAgICAgICAgICAgICAgY2hhbmdlLnByb3BlcnR5ICsgJyBmcm9tICcgKyBjaGFuZ2Uub2xkVmFsdWUgK1xuICogICAgICAgICAgICAgICAgICAgICcgdG8gJyArIGNoYW5nZS5uZXdWYWx1ZSk7XG4gKiAgICAgICAgICB9KTtcbiAqICAgICAgfSk7XG4gKlxuICogVGhlIGBsYXllci5MYXllckV2ZW50LmdldENoYW5nZXNGb3IoKWAgYW5kIGBsYXllci5MYXllckV2ZW50Lmhhc1Byb3BlcnR5KClgIG1ldGhvZHNcbiAqIHNpbXBsaWZ5IHdvcmtpbmcgd2l0aCB4eHg6Y2hhbmdlIGV2ZW50cyBzbyB5b3UgZG9uJ3QgbmVlZFxuICogdG8gaXRlcmF0ZSBvdmVyIHRoZSBgY2hhbmdlc2AgYXJyYXkuXG4gKlxuICogQGNsYXNzIGxheWVyLkxheWVyRXZlbnRcbiAqL1xuXG5jbGFzcyBMYXllckV2ZW50IHtcbiAgLyoqXG4gICAqIENvbnN0cnVjdG9yIGZvciBMYXllckV2ZW50LlxuICAgKlxuICAgKiBAbWV0aG9kXG4gICAqIEBwYXJhbSAge09iamVjdH0gYXJncyAtIFByb3BlcnRpZXMgdG8gbWl4aW4gdG8gdGhlIGV2ZW50XG4gICAqIEBwYXJhbSAge3N0cmluZ30gZXZlbnROYW1lIC0gTmFtZSBvZiB0aGUgZXZlbnQgdGhhdCBnZW5lcmF0ZWQgdGhpcyBMYXllckV2ZW50LlxuICAgKiBAcmV0dXJuIHtsYXllci5MYXllckV2ZW50fVxuICAgKi9cbiAgY29uc3RydWN0b3IoYXJncywgZXZlbnROYW1lKSB7XG4gICAgbGV0IHB0ciA9IHRoaXM7XG5cbiAgICAvLyBJcyBpdCBhIGNoYW5nZSBldmVudD8gIGlmIHNvLCBzZXR1cCB0aGUgY2hhbmdlIHByb3BlcnRpZXMuXG4gICAgaWYgKGV2ZW50TmFtZS5tYXRjaCgvOmNoYW5nZSQvKSkge1xuICAgICAgdGhpcy5jaGFuZ2VzID0gW3t9XTtcbiAgICAgIC8vIEFsbCBhcmdzIGdldCBjb3BpZWQgaW50byB0aGUgY2hhbmdlcyBvYmplY3QgaW5zdGVhZCBvZiB0aGlzXG4gICAgICBwdHIgPSB0aGlzLmNoYW5nZXNbMF07XG4gICAgICB0aGlzLmlzQ2hhbmdlID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5pc0NoYW5nZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8vIENvcHkgdGhlIGFyZ3MgaW50byBlaXRoZXIgdGhpcyBFdmVudCBvYmplY3QuLi4gb3IgaW50byB0aGUgY2hhbmdlIG9iamVjdC5cbiAgICAvLyBXb3VsZG4ndCBiZSBuZWVkZWQgaWYgdGhpcyBpbmhlcml0ZWQgZnJvbSBSb290LlxuICAgIE9iamVjdC5rZXlzKGFyZ3MpLmZvckVhY2gobmFtZSA9PiB7XG4gICAgICAvLyBFdmVuIGlmIHdlIGFyZSBjb3B5aW5nIHByb3BlcnRpZXMgaW50byB0aGUgY2hhbmdlIG9iamVjdCwgdGFyZ2V0IHJlbWFpbnNcbiAgICAgIC8vIGEgcHJvcGVydHkgb2YgTGF5ZXJFdmVudC5cbiAgICAgIGlmIChwdHIgIT09IHRoaXMgJiYgbmFtZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgICAgdGhpcy50YXJnZXQgPSBhcmdzLnRhcmdldDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHB0cltuYW1lXSA9IGFyZ3NbbmFtZV07XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5ldmVudE5hbWUgPSBldmVudE5hbWU7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBzcGVjaWZpZWQgcHJvcGVydHkgd2FzIGNoYW5nZWQuXG4gICAqXG4gICAqIFJldHVybnMgZmFsc2UgaWYgdGhpcyBpcyBub3QgYSBjaGFuZ2UgZXZlbnQuXG4gICAqXG4gICAqICAgICAgaWYgKGxheWVyRXZlbnQuaGFzUHJvcGVydHkoJ2FnZScpKSB7XG4gICAqICAgICAgICAgIGhhbmRsZUFnZUNoYW5nZShvYmouYWdlKTtcbiAgICogICAgICB9XG4gICAqXG4gICAqIEBtZXRob2QgaGFzUHJvcGVydHlcbiAgICogQHBhcmFtICB7c3RyaW5nfSAgbmFtZSAtIE5hbWUgb2YgdGhlIHByb3BlcnR5XG4gICAqIEByZXR1cm4ge0Jvb2xlYW59XG4gICAqL1xuICBoYXNQcm9wZXJ0eShuYW1lKSB7XG4gICAgaWYgKCF0aGlzLmlzQ2hhbmdlKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIEJvb2xlYW4odGhpcy5jaGFuZ2VzLmZpbHRlcihjaGFuZ2UgPT4gY2hhbmdlLnByb3BlcnR5ID09PSBuYW1lKS5sZW5ndGgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhbGwgY2hhbmdlcyB0byB0aGUgcHJvcGVydHkuXG4gICAqXG4gICAqIFJldHVybnMgYW4gYXJyYXkgb2YgY2hhbmdlcy5cbiAgICogSWYgdGhpcyBpcyBub3QgYSBjaGFuZ2UgZXZlbnQsIHdpbGwgcmV0dXJuIFtdXG4gICAqIENoYW5nZXMgYXJlIHR5cGljYWxseSBvZiB0aGUgZm9ybTpcbiAgICpcbiAgICogICAgICBsYXllckV2ZW50LmdldENoYW5nZXNGb3IoJ2FnZScpO1xuICAgKiAgICAgID4gW3tcbiAgICogICAgICAgICAgb2xkVmFsdWU6IDEwLFxuICAgKiAgICAgICAgICBuZXdWYWx1ZTogNSxcbiAgICogICAgICAgICAgcHJvcGVydHk6ICdhZ2UnXG4gICAqICAgICAgfV1cbiAgICpcbiAgICogQG1ldGhvZCBnZXRDaGFuZ2VzRm9yXG4gICAqIEBwYXJhbSAge3N0cmluZ30gbmFtZSAtIE5hbWUgb2YgdGhlIHByb3BlcnR5IHdob3NlIGNoYW5nZXMgYXJlIG9mIGludGVyZXN0XG4gICAqIEByZXR1cm4ge09iamVjdFtdfVxuICAgKi9cbiAgZ2V0Q2hhbmdlc0ZvcihuYW1lKSB7XG4gICAgaWYgKCF0aGlzLmlzQ2hhbmdlKSByZXR1cm4gW107XG4gICAgcmV0dXJuIHRoaXMuY2hhbmdlcy5maWx0ZXIoY2hhbmdlID0+IGNoYW5nZS5wcm9wZXJ0eSA9PT0gbmFtZSk7XG4gIH1cblxuICAvKipcbiAgICogTWVyZ2UgY2hhbmdlcyBpbnRvIGEgc2luZ2xlIGNoYW5nZXMgYXJyYXkuXG4gICAqXG4gICAqIFRoZSBvdGhlciBldmVudCB3aWxsIG5lZWQgdG8gYmUgZGVsZXRlZC5cbiAgICpcbiAgICogQG1ldGhvZCBfbWVyZ2VDaGFuZ2VzXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtICB7bGF5ZXIuTGF5ZXJFdmVudH0gZXZ0XG4gICAqL1xuICBfbWVyZ2VDaGFuZ2VzKGV2dCkge1xuICAgIHRoaXMuY2hhbmdlcyA9IHRoaXMuY2hhbmdlcy5jb25jYXQoZXZ0LmNoYW5nZXMpO1xuICB9XG59XG5cbi8qKlxuICogSW5kaWNhdGVzIHRoYXQgdGhpcyBpcyBhIGNoYW5nZSBldmVudC5cbiAqXG4gKiBJZiB0aGUgZXZlbnQgbmFtZSBlbmRzIHdpdGggJzpjaGFuZ2UnIHRoZW5cbiAqIGl0IGlzIHRyZWF0ZWQgYXMgYSBjaGFuZ2UgZXZlbnQ7ICBzdWNoXG4gKiBldmVudHMgYXJlIGFzc3VtZWQgdG8gY29tZSB3aXRoIGBuZXdWYWx1ZWAsIGBvbGRWYWx1ZWAgYW5kIGBwcm9wZXJ0eWAgaW4gdGhlIGxheWVyLkxheWVyRXZlbnQuY2hhbmdlcyBwcm9wZXJ0eS5cbiAqIEB0eXBlIHtCb29sZWFufVxuICovXG5MYXllckV2ZW50LnByb3RvdHlwZS5pc0NoYW5nZSA9IGZhbHNlO1xuXG4vKipcbiAqIEFycmF5IG9mIGNoYW5nZXMgKENoYW5nZSBFdmVudHMgb25seSkuXG4gKlxuICogSWYgaXRzIGEgQ2hhbmdlIEV2ZW50LCB0aGVuIHRoZSBjaGFuZ2VzIHByb3BlcnR5IGNvbnRhaW5zIGFuIGFycmF5IG9mIGNoYW5nZSBvYmplY3RzXG4gKiB3aGljaCBlYWNoIGNvbnRhaW46XG4gKlxuICogKiBvbGRWYWx1ZVxuICogKiBuZXdWYWx1ZVxuICogKiBwcm9wZXJ0eVxuICpcbiAqIEB0eXBlIHtPYmplY3RbXX1cbiAqL1xuTGF5ZXJFdmVudC5wcm90b3R5cGUuY2hhbmdlcyA9IG51bGw7XG5cbi8qKlxuICogQ29tcG9uZW50IHRoYXQgd2FzIHRoZSBzb3VyY2Ugb2YgdGhlIGNoYW5nZS5cbiAqXG4gKiBJZiBvbmUgY2FsbHNcbiAqXG4gKiAgICAgIG9iai50cmlnZ2VyKCdldmVudCcpO1xuICpcbiAqIHRoZW4gb2JqIHdpbGwgYmUgdGhlIHRhcmdldC5cbiAqIEB0eXBlIHtsYXllci5Sb290fVxuICovXG5MYXllckV2ZW50LnByb3RvdHlwZS50YXJnZXQgPSBudWxsO1xuXG4vKipcbiAqIFRoZSBuYW1lIG9mIHRoZSBldmVudCB0aGF0IGNyZWF0ZWQgdGhpcyBpbnN0YW5jZS5cbiAqXG4gKiBJZiBvbmUgY2FsbHNcbiAqXG4gKiAgICAgIG9iai50cmlnZ2VyKCdteWV2ZW50Jyk7XG4gKlxuICogdGhlbiBldmVudE5hbWUgPSAnbXlldmVudCdcbiAqXG4gKiBAdHlwZSB7U3RyaW5nfVxuICovXG5MYXllckV2ZW50LnByb3RvdHlwZS5ldmVudE5hbWUgPSAnJztcblxubW9kdWxlLmV4cG9ydHMgPSBMYXllckV2ZW50O1xuIl19
