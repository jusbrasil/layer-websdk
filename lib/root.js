'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Utils = require('./client-utils');
var LayerEvent = require('./layer-event');
var LayerError = require('./layer-error');
var Events = require('backbone-events-standalone/backbone-events-standalone');
var Logger = require('./logger');

/*
 * Provides a system bus that can be accessed by all components of the system.
 * Currently used to listen to messages sent via postMessage, but envisioned to
 * do far more.
 */
function EventClass() {}
EventClass.prototype = Events;

var SystemBus = new EventClass();
if (typeof postMessage === 'function') {
  addEventListener('message', function (event) {
    if (event.data.type === 'layer-delayed-event') {
      SystemBus.trigger(event.data.internalId + '-delayed-event');
    }
  });
}

// Used to generate a unique internalId for every Root instance
var uniqueIds = {};

// Regex for splitting an event string such as obj.on('evtName1 evtName2 evtName3')
var eventSplitter = /\s+/;

/**
 * The root class of all layer objects. Provides the following utilities
 *
 * 1. Mixes in the Backbone event model
 *
 *        var person = new Person();
 *        person.on('destroy', function() {
 *            console.log('I have been destroyed!');
 *        });
 *
 *        // Fire the console log handler:
 *        person.trigger('destroy');
 *
 *        // Unsubscribe
 *        person.off('destroy');
 *
 * 2. Adds a subscriptions object so that any event handlers on an object can be quickly found and removed
 *
 *        var person1 = new Person();
 *        var person2 = new Person();
 *        person2.on('destroy', function() {
 *            console.log('I have been destroyed!');
 *        }, person1);
 *
 *        // Pointers to person1 held onto by person2 are removed
 *        person1.destroy();
 *
 * 3. Adds support for event listeners in the constructor
 *    Any event handler can be passed into the constructor
 *    just as though it were a property.
 *
 *        var person = new Person({
 *            age: 150,
 *            destroy: function() {
 *                console.log('I have been destroyed!');
 *            }
 *        });
 *
 * 4. A _disableEvents property
 *
 *        myMethod() {
 *          if (this.isInitializing) {
 *              this._disableEvents = true;
 *
 *              // Event only received if _disableEvents = false
 *              this.trigger('destroy');
 *              this._disableEvents = false;
 *          }
 *        }
 *
 * 5. A _supportedEvents static property for each class
 *
 *     This property defines which events can be triggered.
 *
 *     * Any attempt to trigger
 *       an event not in _supportedEvents will log an error.
 *     * Any attempt to register a listener for an event not in _supportedEvents will
 *     *throw* an error.
 *
 *     This allows us to insure developers only subscribe to valid events.
 *
 *     This allows us to control what events can be fired and which ones blocked.
 *
 * 6. Adds an internalId property
 *
 *        var person = new Person();
 *        console.log(person.internalId); // -> 'Person1'
 *
 * 7. Adds a toObject method to create a simplified Plain Old Javacript Object from your object
 *
 *        var person = new Person();
 *        var simplePerson = person.toObject();
 *
 * 8. Provides __adjustProperty method support
 *
 *     For any property of a class, an `__adjustProperty` method can be defined.  If its defined,
 *     it will be called prior to setting that property, allowing:
 *
 *     A. Modification of the value that is actually set
 *     B. Validation of the value; throwing errors if invalid.
 *
 * 9. Provides __udpateProperty method support
 *
 *     After setting any property for which there is an `__updateProperty` method defined,
 *     the method will be called, allowing the new property to be applied.
 *
 *     Typically used for
 *
 *     A. Triggering events
 *     B. Firing XHR requests
 *     C. Updating the UI to match the new property value
 *
 *
 * @class layer.Root
 * @abstract
 * @author Michael Kantor
 */

var Root = function (_EventClass) {
  _inherits(Root, _EventClass);

  /**
   * Superclass constructor handles copying in properties and registering event handlers.
   *
   * @method constructor
   * @param  {Object} options - a hash of properties and event handlers
   * @return {layer.Root}
   */
  function Root() {
    var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Root);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Root).call(this));

    _this._layerEventSubscriptions = [];
    _this._delayedTriggers = [];
    _this._lastDelayedTrigger = Date.now();
    _this._events = {};

    // Generate an internalId
    var name = _this.constructor.name;
    if (!uniqueIds[name]) uniqueIds[name] = 0;
    _this.internalId = name + uniqueIds[name]++;

    // Every component listens to the SystemBus for postMessage (triggerAsync) events
    SystemBus.on(_this.internalId + '-delayed-event', _this._processDelayedTriggers, _this);

    // Generate a temporary id if there isn't an id
    if (!_this.id && !options.id && _this.constructor.prefixUUID) {
      _this.id = _this.constructor.prefixUUID + Utils.generateUUID();
    }

    // Copy in all properties; setup all event handlers
    var key = void 0;
    for (key in options) {
      if (_this.constructor._supportedEvents.indexOf(key) !== -1) {
        _this.on(key, options[key]);
      } else if (key in _this && typeof _this[key] !== 'function') {
        _this[key] = options[key];
      }
    }
    _this.isInitializing = false;
    return _this;
  }

  /**
   * Destroys the object.
   *
   * Cleans up all events / subscriptions
   * and marks the object as isDestroyed.
   *
   * @method destroy
   */


  _createClass(Root, [{
    key: 'destroy',
    value: function destroy() {
      var _this2 = this;

      if (this.isDestroyed) throw new Error(LayerError.dictionary.alreadyDestroyed);

      // If anyone is listening, notify them
      this.trigger('destroy');

      // Cleanup pointers to SystemBus. Failure to call destroy
      // will have very serious consequences...
      SystemBus.off(this.internalId + '-delayed-event', null, this);

      // Remove all events, and all pointers passed to this object by other objects
      this.off();

      // Find all of the objects that this object has passed itself to in the form
      // of event handlers and remove all references to itself.
      this._layerEventSubscriptions.forEach(function (item) {
        return item.off(null, null, _this2);
      });

      this._layerEventSubscriptions = null;
      this._delayedTriggers = null;
      this.isDestroyed = true;
    }
  }, {
    key: 'toObject',


    /**
     * Convert class instance to Plain Javascript Object.
     *
     * Strips out all private members, and insures no datastructure loops.
     * Recursively converting all subobjects using calls to toObject.
     *
     *      console.dir(myobj.toObject());
     *
     * Note: While it would be tempting to have noChildren default to true,
     * this would result in Message.toObject() not outputing its MessageParts.
     *
     * Private data (_ prefixed properties) will not be output.
     *
     * @method toObject
     * @param  {boolean} [noChildren=false] Don't output sub-components
     * @return {Object}
     */
    value: function toObject() {
      var _this3 = this;

      var noChildren = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];

      this.__inToObject = true;
      var obj = {};

      // Iterate over all formally defined properties
      try {
        var keys = [];
        for (var key in this.constructor.prototype) {
          if (!(key in Root.prototype)) keys.push(key);
        }keys.forEach(function (key) {
          var v = _this3[key];

          // Ignore private/protected properties and functions
          if (key.indexOf('_') === 0) return;
          if (typeof v === 'function') return;

          // Generate arrays...
          if (Array.isArray(v)) {
            obj[key] = [];
            v.forEach(function (item) {
              if (item instanceof Root) {
                if (noChildren) {
                  delete obj[key];
                } else if (!item.__inToObject) {
                  obj[key].push(item.toObject());
                }
              } else {
                obj[key].push(item);
              }
            });
          }

          // Generate subcomponents
          else if (v instanceof Root) {
              if (!v.__inToObject && !noChildren) {
                obj[key] = v.toObject();
              }
            }

            // Generate dates (creates a copy to separate it from the source object)
            else if (v instanceof Date) {
                obj[key] = new Date(v);
              }

              // Generate simple properties
              else {
                  obj[key] = v;
                }
        });
      } catch (e) {
        // no-op
      }
      this.__inToObject = false;
      return obj;
    }

    /**
     * Log a warning for attempts to subscribe to unsupported events.
     *
     * @method _warnForEvent
     * @private
     */

  }, {
    key: '_warnForEvent',
    value: function _warnForEvent(eventName) {
      if (!Utils.includes(this.constructor._supportedEvents, eventName)) {
        throw new Error('Event ' + eventName + ' not defined for ' + this.toString());
      }
    }

    /**
     * Prepare for processing an event subscription call.
     *
     * If context is a Root class, add this object to the context's subscriptions.
     *
     * @method _prepareOn
     * @private
     */

  }, {
    key: '_prepareOn',
    value: function _prepareOn(name, handler, context) {
      var _this4 = this;

      if (context) {
        if (context instanceof Root) {
          if (context.isDestroyed) {
            throw new Error(LayerError.dictionary.isDestroyed);
          }
        }
        if (context._layerEventSubscriptions) {
          context._layerEventSubscriptions.push(this);
        }
      }
      if (typeof name === 'string' && name !== 'all') {
        if (eventSplitter.test(name)) {
          var names = name.split(eventSplitter);
          names.forEach(function (n) {
            return _this4._warnForEvent(n);
          });
        } else {
          this._warnForEvent(name);
        }
      } else if (name && (typeof name === 'undefined' ? 'undefined' : _typeof(name)) === 'object') {
        Object.keys(name).forEach(function (keyName) {
          return _this4._warnForEvent(keyName);
        });
      }
    }

    /**
     * Subscribe to events.
     *
     * Note that the context parameter serves double importance here:
     *
     * 1. It determines the context in which to execute the event handler
     * 2. Create a backlink so that if either subscriber or subscribee is destroyed,
     *    all pointers between them can be found and removed.
     *
     * ```
     * obj.on('someEventName someOtherEventName', mycallback, mycontext);
     * ```
     *
     * ```
     * obj.on({
     *    eventName1: callback1,
     *    eventName2: callback2
     * }, mycontext);
     * ```
     *
     * @method on
     * @param  {String} name - Name of the event
     * @param  {Function} handler - Event handler
     * @param  {layer.LayerEvent} handler.event - Event object delivered to the handler
     * @param  {Object} context - This pointer AND link to help with cleanup
     * @return {layer.Root} this
     */

  }, {
    key: 'on',
    value: function on(name, handler, context) {
      this._prepareOn(name, handler, context);
      Events.on.apply(this, [name, handler, context]);
      return this;
    }

    /**
     * Subscribe to the first occurance of the specified event.
     *
     * @method once
     * @return {layer.Root} this
     */

  }, {
    key: 'once',
    value: function once(name, handler, context) {
      this._prepareOn(name, handler, context);
      Events.once.apply(this, [name, handler, context]);
      return this;
    }

    /**
     * Unsubscribe from events.
     *
     * ```
     * // Removes all event handlers for this event:
     * obj.off('someEventName');
     *
     * // Removes all event handlers using this function pointer as callback
     * obj.off(null, f, null);
     *
     * // Removes all event handlers that `this` has subscribed to; requires
     * // obj.on to be called with `this` as its `context` parameter.
     * obj.off(null, null, this);
     * ```
     *
     * @method off
     * @param  {String} name - Name of the event; null for all event names
     * @param  {Function} handler - Event handler; null for all functions
     * @param  {Object} context - The context from the `on()` call to search for; null for all contexts
     * @return {layer.Root} this
     */

    /**
     * Trigger an event for any event listeners.
     *
     * Events triggered this way will be blocked if _disableEvents = true
     *
     * @method trigger
     * @param {string} eventName    Name of the event that one should subscribe to in order to receive this event
     * @param {Mixed} arg           Values that will be placed within a layer.LayerEvent
     * @return {layer.Root} this
     */

  }, {
    key: 'trigger',
    value: function trigger() {
      if (this._disableEvents) return this;
      return this._trigger.apply(this, arguments);
    }

    /**
     * Triggers an event.
     *
     * @method trigger
     * @private
     * @param {string} eventName    Name of the event that one should subscribe to in order to receive this event
     * @param {Mixed} arg           Values that will be placed within a layer.LayerEvent
     */

  }, {
    key: '_trigger',
    value: function _trigger() {
      if (!Utils.includes(this.constructor._supportedEvents, arguments.length <= 0 ? undefined : arguments[0])) {
        if (!Utils.includes(this.constructor._ignoredEvents, arguments.length <= 0 ? undefined : arguments[0])) {
          Logger.error(this.toString() + ' ignored ' + (arguments.length <= 0 ? undefined : arguments[0]));
        }
        return;
      }

      var computedArgs = this._getTriggerArgs.apply(this, arguments);

      Events.trigger.apply(this, computedArgs);

      var parentProp = this.constructor.bubbleEventParent;
      if (parentProp) {
        var _parentValue;

        var parentValue = this[parentProp];
        parentValue = typeof parentValue === 'function' ? parentValue.apply(this) : parentValue;
        if (parentValue) (_parentValue = parentValue).trigger.apply(_parentValue, _toConsumableArray(computedArgs));
      }
    }

    /**
     * Generates a layer.LayerEvent from a trigger call's arguments.
     *
     * * If parameter is already a layer.LayerEvent, we're done.
     * * If parameter is an object, a `target` property is added to that object and its delivered to all subscribers
     * * If the parameter is non-object value, it is added to an object with a `target` property, and the value is put in
     *   the `data` property.
     *
     * @method _getTriggerArgs
     * @private
     * @return {Mixed[]} - First element of array is eventName, second element is layer.LayerEvent.
     */

  }, {
    key: '_getTriggerArgs',
    value: function _getTriggerArgs() {
      var _this5 = this;

      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      var computedArgs = Array.prototype.slice.call(args);

      if (args[1]) {
        (function () {
          var newArg = { target: _this5 };

          if (computedArgs[1] instanceof LayerEvent) {
            // A LayerEvent will be an argument when bubbling events up; these args can be used as-is
          } else {
            if (_typeof(computedArgs[1]) === 'object') {
              Object.keys(computedArgs[1]).forEach(function (name) {
                newArg[name] = computedArgs[1][name];
              });
            } else {
              newArg.data = computedArgs[1];
            }
            computedArgs[1] = new LayerEvent(newArg, computedArgs[0]);
          }
        })();
      } else {
        computedArgs[1] = new LayerEvent({ target: this }, computedArgs[0]);
      }

      return computedArgs;
    }

    /**
     * Same as _trigger() method, but delays briefly before firing.
     *
     * When would you want to delay an event?
     *
     * 1. There is an event rollup that may be needed for the event;
     *    this requires the framework to be able to see ALL events that have been
     *    generated, roll them up, and THEN fire them.
     * 2. The event is intended for UI rendering... which should not hold up the rest of
     *    this framework's execution.
     *
     * When NOT to delay an event?
     *
     * 1. Lifecycle events frequently require response at the time the event has fired
     *
     * @method _triggerAsync
     * @private
     * @param {string} eventName    Name of the event that one should subscribe to in order to receive this event
     * @param {Mixed} arg           Values that will be placed within a layer.LayerEvent
     * @return {layer.Root} this
     */

  }, {
    key: '_triggerAsync',
    value: function _triggerAsync() {
      var _this6 = this;

      var computedArgs = this._getTriggerArgs.apply(this, arguments);
      this._delayedTriggers.push(computedArgs);

      // NOTE: It is unclear at this time how it happens, but on very rare occasions, we see processDelayedTriggers
      // fail to get called when length = 1, and after that length just continuously grows.  So we add
      // the _lastDelayedTrigger test to insure that it will still run.
      var shouldScheduleTrigger = this._delayedTriggers.length === 1 || this._delayedTriggers.length && this._lastDelayedTrigger + 500 < Date.now();
      if (shouldScheduleTrigger) {
        this._lastDelayedTrigger = Date.now();
        if (typeof postMessage === 'function' && typeof jasmine === 'undefined') {
          var messageData = {
            type: 'layer-delayed-event',
            internalId: this.internalId
          };
          if (typeof document !== 'undefined') {
            window.postMessage(messageData, '*');
          } else {
            // React Native reportedly lacks a document, and throws errors on the second parameter
            window.postMessage(messageData);
          }
        } else {
          setTimeout(function () {
            return _this6._processDelayedTriggers();
          }, 0);
        }
      }
    }

    /**
     * Combines a set of events into a single event.
     *
     * Given an event structure of
     * ```
     *      {
     *          customName: [value1]
     *      }
     *      {
     *          customName: [value2]
     *      }
     *      {
     *          customName: [value3]
     *      }
     * ```
     *
     * Merge them into
     *
     * ```
     *      {
     *          customName: [value1, value2, value3]
     *      }
     * ```
     *
     * @method _foldEvents
     * @private
     * @param  {layer.LayerEvent[]} events
     * @param  {string} name      Name of the property (i.e. 'customName')
     * @param  {layer.Root}    newTarget Value of the target for the folded resulting event
     */

  }, {
    key: '_foldEvents',
    value: function _foldEvents(events, name, newTarget) {
      var _this7 = this;

      var firstEvt = events.length ? events[0][1] : null;
      var firstEvtProp = firstEvt ? firstEvt[name] : null;
      events.forEach(function (evt, i) {
        if (i > 0) {
          firstEvtProp.push(evt[1][name][0]);
          _this7._delayedTriggers.splice(_this7._delayedTriggers.indexOf(evt), 1);
        }
      });
      if (events.length && newTarget) events[0][1].target = newTarget;
    }

    /**
     * Fold a set of Change events into a single Change event.
     *
     * Given a set change events on this component,
     * fold all change events into a single event via
     * the layer.LayerEvent's changes array.
     *
     * @method _foldChangeEvents
     * @private
     */

  }, {
    key: '_foldChangeEvents',
    value: function _foldChangeEvents() {
      var _this8 = this;

      var events = this._delayedTriggers.filter(function (evt) {
        return evt[1].isChange;
      });
      events.forEach(function (evt, i) {
        if (i > 0) {
          events[0][1]._mergeChanges(evt[1]);
          _this8._delayedTriggers.splice(_this8._delayedTriggers.indexOf(evt), 1);
        }
      });
    }

    /**
     * Execute all delayed events for this compoennt.
     *
     * @method _processDelayedTriggers
     * @private
     */

  }, {
    key: '_processDelayedTriggers',
    value: function _processDelayedTriggers() {
      if (this.isDestroyed) return;
      this._foldChangeEvents();

      this._delayedTriggers.forEach(function (evt) {
        this.trigger.apply(this, _toConsumableArray(evt));
      }, this);
      this._delayedTriggers = [];
    }

    /**
     * Returns a string representation of the class that is nicer than `[Object]`.
     *
     * @method toString
     * @return {String}
     */

  }, {
    key: 'toString',
    value: function toString() {
      return this.internalId;
    }
  }], [{
    key: 'isValidId',
    value: function isValidId(id) {
      return id.indexOf(this.prefixUUID) === 0;
    }
  }]);

  return Root;
}(EventClass);

function defineProperty(newClass, propertyName) {
  var pKey = '__' + propertyName;
  var camel = propertyName.substring(0, 1).toUpperCase() + propertyName.substring(1);

  var hasDefinitions = newClass.prototype['__adjust' + camel] || newClass.prototype['__update' + camel] || newClass.prototype['__get' + camel];
  if (hasDefinitions) {
    // set default value
    newClass.prototype[pKey] = newClass.prototype[propertyName];

    Object.defineProperty(newClass.prototype, propertyName, {
      enumerable: true,
      get: function get() {
        return this['__get' + camel] ? this['__get' + camel](pKey) : this[pKey];
      },
      set: function set(inValue) {
        if (this.isDestroyed) return;
        var initial = this[pKey];
        if (inValue !== initial) {
          if (this['__adjust' + camel]) {
            var result = this['__adjust' + camel](inValue);
            if (result !== undefined) inValue = result;
          }
          this[pKey] = inValue;
        }
        if (inValue !== initial) {
          if (!this.isInitializing && this['__update' + camel]) {
            this['__update' + camel](inValue, initial);
          }
        }
      }
    });
  }
}

function initClass(newClass, className) {
  // Make sure our new class has a name property
  if (!newClass.name) newClass.name = className;

  // Make sure our new class has a _supportedEvents, _ignoredEvents, _inObjectIgnore and EVENTS properties
  if (!newClass._supportedEvents) newClass._supportedEvents = Root._supportedEvents;
  if (!newClass._ignoredEvents) newClass._ignoredEvents = Root._ignoredEvents;

  // Generate a list of properties for this class; we don't include any
  // properties from layer.Root
  var keys = Object.keys(newClass.prototype).filter(function (key) {
    return newClass.prototype.hasOwnProperty(key) && !Root.prototype.hasOwnProperty(key) && typeof newClass.prototype[key] !== 'function';
  });

  // Define getters/setters for any property that has __adjust or __update methods defined
  keys.forEach(function (name) {
    return defineProperty(newClass, name);
  });
}

/**
 * Set to true once destroy() has been called.
 *
 * A destroyed object will likely cause errors in any attempt
 * to call methods on it, and will no longer trigger events.
 *
 * @type {boolean}
 * @readonly
 */
Root.prototype.isDestroyed = false;

/**
 * Every instance has its own internal ID.
 *
 * This ID is distinct from any IDs assigned by the server.
 * The internal ID is gaurenteed not to change within the lifetime of the Object/session;
 * it is possible, on creating a new object, for its `id` property to change.
 *
 * @type {string}
 * @readonly
 */
Root.prototype.internalId = '';

/**
 * True while we are in the constructor.
 *
 * @type {boolean}
 * @readonly
 */
Root.prototype.isInitializing = true;

/**
 * Objects that this object is listening for events from.
 *
 * @type {layer.Root[]}
 * @private
 */
Root.prototype._layerEventSubscriptions = null;

/**
 * Disable all events triggered on this object.
 * @type {boolean}
 * @private
 */
Root.prototype._disableEvents = false;

Root._supportedEvents = ['destroy', 'all'];
Root._ignoredEvents = [];
module.exports = Root;
module.exports.initClass = initClass;
//# sourceMappingURL=data:application/json;base64,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LENBQW1CLGNBQW5CLENBQWtDLEdBQWxDLEtBQ0EsQ0FBQyxLQUFLLFNBQUwsQ0FBZSxjQUFmLENBQThCLEdBQTlCLENBREQsSUFFQSxPQUFPLFNBQVMsU0FBVCxDQUFtQixHQUFuQixDQUFQLEtBQW1DLFVBSGU7QUFBQSxHQUF2QyxDQUFiOztBQU1BO0FBQ0EsT0FBSyxPQUFMLENBQWE7QUFBQSxXQUFRLGVBQWUsUUFBZixFQUF5QixJQUF6QixDQUFSO0FBQUEsR0FBYjtBQUNEOztBQUVEOzs7Ozs7Ozs7QUFTQSxLQUFLLFNBQUwsQ0FBZSxXQUFmLEdBQTZCLEtBQTdCOztBQUVBOzs7Ozs7Ozs7O0FBVUEsS0FBSyxTQUFMLENBQWUsVUFBZixHQUE0QixFQUE1Qjs7QUFFQTs7Ozs7O0FBTUEsS0FBSyxTQUFMLENBQWUsY0FBZixHQUFnQyxJQUFoQzs7QUFFQTs7Ozs7O0FBTUEsS0FBSyxTQUFMLENBQWUsd0JBQWYsR0FBMEMsSUFBMUM7O0FBRUE7Ozs7O0FBS0EsS0FBSyxTQUFMLENBQWUsY0FBZixHQUFnQyxLQUFoQzs7QUFHQSxLQUFLLGdCQUFMLEdBQXdCLENBQUMsU0FBRCxFQUFZLEtBQVosQ0FBeEI7QUFDQSxLQUFLLGNBQUwsR0FBc0IsRUFBdEI7QUFDQSxPQUFPLE9BQVAsR0FBaUIsSUFBakI7QUFDQSxPQUFPLE9BQVAsQ0FBZSxTQUFmLEdBQTJCLFNBQTNCIiwiZmlsZSI6InJvb3QuanMiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBVdGlscyA9IHJlcXVpcmUoJy4vY2xpZW50LXV0aWxzJyk7XG5jb25zdCBMYXllckV2ZW50ID0gcmVxdWlyZSgnLi9sYXllci1ldmVudCcpO1xuY29uc3QgTGF5ZXJFcnJvciA9IHJlcXVpcmUoJy4vbGF5ZXItZXJyb3InKTtcbmNvbnN0IEV2ZW50cyA9IHJlcXVpcmUoJ2JhY2tib25lLWV2ZW50cy1zdGFuZGFsb25lL2JhY2tib25lLWV2ZW50cy1zdGFuZGFsb25lJyk7XG5jb25zdCBMb2dnZXIgPSByZXF1aXJlKCcuL2xvZ2dlcicpO1xuXG4vKlxuICogUHJvdmlkZXMgYSBzeXN0ZW0gYnVzIHRoYXQgY2FuIGJlIGFjY2Vzc2VkIGJ5IGFsbCBjb21wb25lbnRzIG9mIHRoZSBzeXN0ZW0uXG4gKiBDdXJyZW50bHkgdXNlZCB0byBsaXN0ZW4gdG8gbWVzc2FnZXMgc2VudCB2aWEgcG9zdE1lc3NhZ2UsIGJ1dCBlbnZpc2lvbmVkIHRvXG4gKiBkbyBmYXIgbW9yZS5cbiAqL1xuZnVuY3Rpb24gRXZlbnRDbGFzcygpIHsgfVxuRXZlbnRDbGFzcy5wcm90b3R5cGUgPSBFdmVudHM7XG5cbmNvbnN0IFN5c3RlbUJ1cyA9IG5ldyBFdmVudENsYXNzKCk7XG5pZiAodHlwZW9mIHBvc3RNZXNzYWdlID09PSAnZnVuY3Rpb24nKSB7XG4gIGFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCAoZXZlbnQpID0+IHtcbiAgICBpZiAoZXZlbnQuZGF0YS50eXBlID09PSAnbGF5ZXItZGVsYXllZC1ldmVudCcpIHtcbiAgICAgIFN5c3RlbUJ1cy50cmlnZ2VyKGV2ZW50LmRhdGEuaW50ZXJuYWxJZCArICctZGVsYXllZC1ldmVudCcpO1xuICAgIH1cbiAgfSk7XG59XG5cbi8vIFVzZWQgdG8gZ2VuZXJhdGUgYSB1bmlxdWUgaW50ZXJuYWxJZCBmb3IgZXZlcnkgUm9vdCBpbnN0YW5jZVxuY29uc3QgdW5pcXVlSWRzID0ge307XG5cbi8vIFJlZ2V4IGZvciBzcGxpdHRpbmcgYW4gZXZlbnQgc3RyaW5nIHN1Y2ggYXMgb2JqLm9uKCdldnROYW1lMSBldnROYW1lMiBldnROYW1lMycpXG5jb25zdCBldmVudFNwbGl0dGVyID0gL1xccysvO1xuXG4vKipcbiAqIFRoZSByb290IGNsYXNzIG9mIGFsbCBsYXllciBvYmplY3RzLiBQcm92aWRlcyB0aGUgZm9sbG93aW5nIHV0aWxpdGllc1xuICpcbiAqIDEuIE1peGVzIGluIHRoZSBCYWNrYm9uZSBldmVudCBtb2RlbFxuICpcbiAqICAgICAgICB2YXIgcGVyc29uID0gbmV3IFBlcnNvbigpO1xuICogICAgICAgIHBlcnNvbi5vbignZGVzdHJveScsIGZ1bmN0aW9uKCkge1xuICogICAgICAgICAgICBjb25zb2xlLmxvZygnSSBoYXZlIGJlZW4gZGVzdHJveWVkIScpO1xuICogICAgICAgIH0pO1xuICpcbiAqICAgICAgICAvLyBGaXJlIHRoZSBjb25zb2xlIGxvZyBoYW5kbGVyOlxuICogICAgICAgIHBlcnNvbi50cmlnZ2VyKCdkZXN0cm95Jyk7XG4gKlxuICogICAgICAgIC8vIFVuc3Vic2NyaWJlXG4gKiAgICAgICAgcGVyc29uLm9mZignZGVzdHJveScpO1xuICpcbiAqIDIuIEFkZHMgYSBzdWJzY3JpcHRpb25zIG9iamVjdCBzbyB0aGF0IGFueSBldmVudCBoYW5kbGVycyBvbiBhbiBvYmplY3QgY2FuIGJlIHF1aWNrbHkgZm91bmQgYW5kIHJlbW92ZWRcbiAqXG4gKiAgICAgICAgdmFyIHBlcnNvbjEgPSBuZXcgUGVyc29uKCk7XG4gKiAgICAgICAgdmFyIHBlcnNvbjIgPSBuZXcgUGVyc29uKCk7XG4gKiAgICAgICAgcGVyc29uMi5vbignZGVzdHJveScsIGZ1bmN0aW9uKCkge1xuICogICAgICAgICAgICBjb25zb2xlLmxvZygnSSBoYXZlIGJlZW4gZGVzdHJveWVkIScpO1xuICogICAgICAgIH0sIHBlcnNvbjEpO1xuICpcbiAqICAgICAgICAvLyBQb2ludGVycyB0byBwZXJzb24xIGhlbGQgb250byBieSBwZXJzb24yIGFyZSByZW1vdmVkXG4gKiAgICAgICAgcGVyc29uMS5kZXN0cm95KCk7XG4gKlxuICogMy4gQWRkcyBzdXBwb3J0IGZvciBldmVudCBsaXN0ZW5lcnMgaW4gdGhlIGNvbnN0cnVjdG9yXG4gKiAgICBBbnkgZXZlbnQgaGFuZGxlciBjYW4gYmUgcGFzc2VkIGludG8gdGhlIGNvbnN0cnVjdG9yXG4gKiAgICBqdXN0IGFzIHRob3VnaCBpdCB3ZXJlIGEgcHJvcGVydHkuXG4gKlxuICogICAgICAgIHZhciBwZXJzb24gPSBuZXcgUGVyc29uKHtcbiAqICAgICAgICAgICAgYWdlOiAxNTAsXG4gKiAgICAgICAgICAgIGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuICogICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0kgaGF2ZSBiZWVuIGRlc3Ryb3llZCEnKTtcbiAqICAgICAgICAgICAgfVxuICogICAgICAgIH0pO1xuICpcbiAqIDQuIEEgX2Rpc2FibGVFdmVudHMgcHJvcGVydHlcbiAqXG4gKiAgICAgICAgbXlNZXRob2QoKSB7XG4gKiAgICAgICAgICBpZiAodGhpcy5pc0luaXRpYWxpemluZykge1xuICogICAgICAgICAgICAgIHRoaXMuX2Rpc2FibGVFdmVudHMgPSB0cnVlO1xuICpcbiAqICAgICAgICAgICAgICAvLyBFdmVudCBvbmx5IHJlY2VpdmVkIGlmIF9kaXNhYmxlRXZlbnRzID0gZmFsc2VcbiAqICAgICAgICAgICAgICB0aGlzLnRyaWdnZXIoJ2Rlc3Ryb3knKTtcbiAqICAgICAgICAgICAgICB0aGlzLl9kaXNhYmxlRXZlbnRzID0gZmFsc2U7XG4gKiAgICAgICAgICB9XG4gKiAgICAgICAgfVxuICpcbiAqIDUuIEEgX3N1cHBvcnRlZEV2ZW50cyBzdGF0aWMgcHJvcGVydHkgZm9yIGVhY2ggY2xhc3NcbiAqXG4gKiAgICAgVGhpcyBwcm9wZXJ0eSBkZWZpbmVzIHdoaWNoIGV2ZW50cyBjYW4gYmUgdHJpZ2dlcmVkLlxuICpcbiAqICAgICAqIEFueSBhdHRlbXB0IHRvIHRyaWdnZXJcbiAqICAgICAgIGFuIGV2ZW50IG5vdCBpbiBfc3VwcG9ydGVkRXZlbnRzIHdpbGwgbG9nIGFuIGVycm9yLlxuICogICAgICogQW55IGF0dGVtcHQgdG8gcmVnaXN0ZXIgYSBsaXN0ZW5lciBmb3IgYW4gZXZlbnQgbm90IGluIF9zdXBwb3J0ZWRFdmVudHMgd2lsbFxuICogICAgICp0aHJvdyogYW4gZXJyb3IuXG4gKlxuICogICAgIFRoaXMgYWxsb3dzIHVzIHRvIGluc3VyZSBkZXZlbG9wZXJzIG9ubHkgc3Vic2NyaWJlIHRvIHZhbGlkIGV2ZW50cy5cbiAqXG4gKiAgICAgVGhpcyBhbGxvd3MgdXMgdG8gY29udHJvbCB3aGF0IGV2ZW50cyBjYW4gYmUgZmlyZWQgYW5kIHdoaWNoIG9uZXMgYmxvY2tlZC5cbiAqXG4gKiA2LiBBZGRzIGFuIGludGVybmFsSWQgcHJvcGVydHlcbiAqXG4gKiAgICAgICAgdmFyIHBlcnNvbiA9IG5ldyBQZXJzb24oKTtcbiAqICAgICAgICBjb25zb2xlLmxvZyhwZXJzb24uaW50ZXJuYWxJZCk7IC8vIC0+ICdQZXJzb24xJ1xuICpcbiAqIDcuIEFkZHMgYSB0b09iamVjdCBtZXRob2QgdG8gY3JlYXRlIGEgc2ltcGxpZmllZCBQbGFpbiBPbGQgSmF2YWNyaXB0IE9iamVjdCBmcm9tIHlvdXIgb2JqZWN0XG4gKlxuICogICAgICAgIHZhciBwZXJzb24gPSBuZXcgUGVyc29uKCk7XG4gKiAgICAgICAgdmFyIHNpbXBsZVBlcnNvbiA9IHBlcnNvbi50b09iamVjdCgpO1xuICpcbiAqIDguIFByb3ZpZGVzIF9fYWRqdXN0UHJvcGVydHkgbWV0aG9kIHN1cHBvcnRcbiAqXG4gKiAgICAgRm9yIGFueSBwcm9wZXJ0eSBvZiBhIGNsYXNzLCBhbiBgX19hZGp1c3RQcm9wZXJ0eWAgbWV0aG9kIGNhbiBiZSBkZWZpbmVkLiAgSWYgaXRzIGRlZmluZWQsXG4gKiAgICAgaXQgd2lsbCBiZSBjYWxsZWQgcHJpb3IgdG8gc2V0dGluZyB0aGF0IHByb3BlcnR5LCBhbGxvd2luZzpcbiAqXG4gKiAgICAgQS4gTW9kaWZpY2F0aW9uIG9mIHRoZSB2YWx1ZSB0aGF0IGlzIGFjdHVhbGx5IHNldFxuICogICAgIEIuIFZhbGlkYXRpb24gb2YgdGhlIHZhbHVlOyB0aHJvd2luZyBlcnJvcnMgaWYgaW52YWxpZC5cbiAqXG4gKiA5LiBQcm92aWRlcyBfX3VkcGF0ZVByb3BlcnR5IG1ldGhvZCBzdXBwb3J0XG4gKlxuICogICAgIEFmdGVyIHNldHRpbmcgYW55IHByb3BlcnR5IGZvciB3aGljaCB0aGVyZSBpcyBhbiBgX191cGRhdGVQcm9wZXJ0eWAgbWV0aG9kIGRlZmluZWQsXG4gKiAgICAgdGhlIG1ldGhvZCB3aWxsIGJlIGNhbGxlZCwgYWxsb3dpbmcgdGhlIG5ldyBwcm9wZXJ0eSB0byBiZSBhcHBsaWVkLlxuICpcbiAqICAgICBUeXBpY2FsbHkgdXNlZCBmb3JcbiAqXG4gKiAgICAgQS4gVHJpZ2dlcmluZyBldmVudHNcbiAqICAgICBCLiBGaXJpbmcgWEhSIHJlcXVlc3RzXG4gKiAgICAgQy4gVXBkYXRpbmcgdGhlIFVJIHRvIG1hdGNoIHRoZSBuZXcgcHJvcGVydHkgdmFsdWVcbiAqXG4gKlxuICogQGNsYXNzIGxheWVyLlJvb3RcbiAqIEBhYnN0cmFjdFxuICogQGF1dGhvciBNaWNoYWVsIEthbnRvclxuICovXG5jbGFzcyBSb290IGV4dGVuZHMgRXZlbnRDbGFzcyB7XG5cbiAgLyoqXG4gICAqIFN1cGVyY2xhc3MgY29uc3RydWN0b3IgaGFuZGxlcyBjb3B5aW5nIGluIHByb3BlcnRpZXMgYW5kIHJlZ2lzdGVyaW5nIGV2ZW50IGhhbmRsZXJzLlxuICAgKlxuICAgKiBAbWV0aG9kIGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9ucyAtIGEgaGFzaCBvZiBwcm9wZXJ0aWVzIGFuZCBldmVudCBoYW5kbGVyc1xuICAgKiBAcmV0dXJuIHtsYXllci5Sb290fVxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9sYXllckV2ZW50U3Vic2NyaXB0aW9ucyA9IFtdO1xuICAgIHRoaXMuX2RlbGF5ZWRUcmlnZ2VycyA9IFtdO1xuICAgIHRoaXMuX2xhc3REZWxheWVkVHJpZ2dlciA9IERhdGUubm93KCk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgICAvLyBHZW5lcmF0ZSBhbiBpbnRlcm5hbElkXG4gICAgY29uc3QgbmFtZSA9IHRoaXMuY29uc3RydWN0b3IubmFtZTtcbiAgICBpZiAoIXVuaXF1ZUlkc1tuYW1lXSkgdW5pcXVlSWRzW25hbWVdID0gMDtcbiAgICB0aGlzLmludGVybmFsSWQgPSBuYW1lICsgdW5pcXVlSWRzW25hbWVdKys7XG5cbiAgICAvLyBFdmVyeSBjb21wb25lbnQgbGlzdGVucyB0byB0aGUgU3lzdGVtQnVzIGZvciBwb3N0TWVzc2FnZSAodHJpZ2dlckFzeW5jKSBldmVudHNcbiAgICBTeXN0ZW1CdXMub24odGhpcy5pbnRlcm5hbElkICsgJy1kZWxheWVkLWV2ZW50JywgdGhpcy5fcHJvY2Vzc0RlbGF5ZWRUcmlnZ2VycywgdGhpcyk7XG5cbiAgICAvLyBHZW5lcmF0ZSBhIHRlbXBvcmFyeSBpZCBpZiB0aGVyZSBpc24ndCBhbiBpZFxuICAgIGlmICghdGhpcy5pZCAmJiAhb3B0aW9ucy5pZCAmJiB0aGlzLmNvbnN0cnVjdG9yLnByZWZpeFVVSUQpIHtcbiAgICAgIHRoaXMuaWQgPSB0aGlzLmNvbnN0cnVjdG9yLnByZWZpeFVVSUQgKyBVdGlscy5nZW5lcmF0ZVVVSUQoKTtcbiAgICB9XG5cbiAgICAvLyBDb3B5IGluIGFsbCBwcm9wZXJ0aWVzOyBzZXR1cCBhbGwgZXZlbnQgaGFuZGxlcnNcbiAgICBsZXQga2V5O1xuICAgIGZvciAoa2V5IGluIG9wdGlvbnMpIHtcbiAgICAgIGlmICh0aGlzLmNvbnN0cnVjdG9yLl9zdXBwb3J0ZWRFdmVudHMuaW5kZXhPZihrZXkpICE9PSAtMSkge1xuICAgICAgICB0aGlzLm9uKGtleSwgb3B0aW9uc1trZXldKTtcbiAgICAgIH0gZWxzZSBpZiAoa2V5IGluIHRoaXMgJiYgdHlwZW9mIHRoaXNba2V5XSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aGlzW2tleV0gPSBvcHRpb25zW2tleV07XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuaXNJbml0aWFsaXppbmcgPSBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXN0cm95cyB0aGUgb2JqZWN0LlxuICAgKlxuICAgKiBDbGVhbnMgdXAgYWxsIGV2ZW50cyAvIHN1YnNjcmlwdGlvbnNcbiAgICogYW5kIG1hcmtzIHRoZSBvYmplY3QgYXMgaXNEZXN0cm95ZWQuXG4gICAqXG4gICAqIEBtZXRob2QgZGVzdHJveVxuICAgKi9cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5hbHJlYWR5RGVzdHJveWVkKTtcblxuICAgIC8vIElmIGFueW9uZSBpcyBsaXN0ZW5pbmcsIG5vdGlmeSB0aGVtXG4gICAgdGhpcy50cmlnZ2VyKCdkZXN0cm95Jyk7XG5cbiAgICAvLyBDbGVhbnVwIHBvaW50ZXJzIHRvIFN5c3RlbUJ1cy4gRmFpbHVyZSB0byBjYWxsIGRlc3Ryb3lcbiAgICAvLyB3aWxsIGhhdmUgdmVyeSBzZXJpb3VzIGNvbnNlcXVlbmNlcy4uLlxuICAgIFN5c3RlbUJ1cy5vZmYodGhpcy5pbnRlcm5hbElkICsgJy1kZWxheWVkLWV2ZW50JywgbnVsbCwgdGhpcyk7XG5cbiAgICAvLyBSZW1vdmUgYWxsIGV2ZW50cywgYW5kIGFsbCBwb2ludGVycyBwYXNzZWQgdG8gdGhpcyBvYmplY3QgYnkgb3RoZXIgb2JqZWN0c1xuICAgIHRoaXMub2ZmKCk7XG5cbiAgICAvLyBGaW5kIGFsbCBvZiB0aGUgb2JqZWN0cyB0aGF0IHRoaXMgb2JqZWN0IGhhcyBwYXNzZWQgaXRzZWxmIHRvIGluIHRoZSBmb3JtXG4gICAgLy8gb2YgZXZlbnQgaGFuZGxlcnMgYW5kIHJlbW92ZSBhbGwgcmVmZXJlbmNlcyB0byBpdHNlbGYuXG4gICAgdGhpcy5fbGF5ZXJFdmVudFN1YnNjcmlwdGlvbnMuZm9yRWFjaChpdGVtID0+IGl0ZW0ub2ZmKG51bGwsIG51bGwsIHRoaXMpKTtcblxuICAgIHRoaXMuX2xheWVyRXZlbnRTdWJzY3JpcHRpb25zID0gbnVsbDtcbiAgICB0aGlzLl9kZWxheWVkVHJpZ2dlcnMgPSBudWxsO1xuICAgIHRoaXMuaXNEZXN0cm95ZWQgPSB0cnVlO1xuICB9XG5cbiAgc3RhdGljIGlzVmFsaWRJZChpZCkge1xuICAgIHJldHVybiBpZC5pbmRleE9mKHRoaXMucHJlZml4VVVJRCkgPT09IDA7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydCBjbGFzcyBpbnN0YW5jZSB0byBQbGFpbiBKYXZhc2NyaXB0IE9iamVjdC5cbiAgICpcbiAgICogU3RyaXBzIG91dCBhbGwgcHJpdmF0ZSBtZW1iZXJzLCBhbmQgaW5zdXJlcyBubyBkYXRhc3RydWN0dXJlIGxvb3BzLlxuICAgKiBSZWN1cnNpdmVseSBjb252ZXJ0aW5nIGFsbCBzdWJvYmplY3RzIHVzaW5nIGNhbGxzIHRvIHRvT2JqZWN0LlxuICAgKlxuICAgKiAgICAgIGNvbnNvbGUuZGlyKG15b2JqLnRvT2JqZWN0KCkpO1xuICAgKlxuICAgKiBOb3RlOiBXaGlsZSBpdCB3b3VsZCBiZSB0ZW1wdGluZyB0byBoYXZlIG5vQ2hpbGRyZW4gZGVmYXVsdCB0byB0cnVlLFxuICAgKiB0aGlzIHdvdWxkIHJlc3VsdCBpbiBNZXNzYWdlLnRvT2JqZWN0KCkgbm90IG91dHB1dGluZyBpdHMgTWVzc2FnZVBhcnRzLlxuICAgKlxuICAgKiBQcml2YXRlIGRhdGEgKF8gcHJlZml4ZWQgcHJvcGVydGllcykgd2lsbCBub3QgYmUgb3V0cHV0LlxuICAgKlxuICAgKiBAbWV0aG9kIHRvT2JqZWN0XG4gICAqIEBwYXJhbSAge2Jvb2xlYW59IFtub0NoaWxkcmVuPWZhbHNlXSBEb24ndCBvdXRwdXQgc3ViLWNvbXBvbmVudHNcbiAgICogQHJldHVybiB7T2JqZWN0fVxuICAgKi9cbiAgdG9PYmplY3Qobm9DaGlsZHJlbiA9IGZhbHNlKSB7XG4gICAgdGhpcy5fX2luVG9PYmplY3QgPSB0cnVlO1xuICAgIGNvbnN0IG9iaiA9IHt9O1xuXG4gICAgLy8gSXRlcmF0ZSBvdmVyIGFsbCBmb3JtYWxseSBkZWZpbmVkIHByb3BlcnRpZXNcbiAgICB0cnkge1xuICAgICAgY29uc3Qga2V5cyA9IFtdO1xuICAgICAgZm9yIChsZXQga2V5IGluIHRoaXMuY29uc3RydWN0b3IucHJvdG90eXBlKSBpZiAoIShrZXkgaW4gUm9vdC5wcm90b3R5cGUpKSBrZXlzLnB1c2goa2V5KTtcblxuICAgICAga2V5cy5mb3JFYWNoKGtleSA9PiB7XG4gICAgICAgIGNvbnN0IHYgPSB0aGlzW2tleV07XG5cbiAgICAgICAgLy8gSWdub3JlIHByaXZhdGUvcHJvdGVjdGVkIHByb3BlcnRpZXMgYW5kIGZ1bmN0aW9uc1xuICAgICAgICBpZiAoa2V5LmluZGV4T2YoJ18nKSA9PT0gMCkgcmV0dXJuO1xuICAgICAgICBpZiAodHlwZW9mIHYgPT09ICdmdW5jdGlvbicpIHJldHVybjtcblxuICAgICAgICAvLyBHZW5lcmF0ZSBhcnJheXMuLi5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodikpIHtcbiAgICAgICAgICBvYmpba2V5XSA9IFtdO1xuICAgICAgICAgIHYuZm9yRWFjaChpdGVtID0+IHtcbiAgICAgICAgICAgIGlmIChpdGVtIGluc3RhbmNlb2YgUm9vdCkge1xuICAgICAgICAgICAgICBpZiAobm9DaGlsZHJlbikge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBvYmpba2V5XTtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmICghaXRlbS5fX2luVG9PYmplY3QpIHtcbiAgICAgICAgICAgICAgICBvYmpba2V5XS5wdXNoKGl0ZW0udG9PYmplY3QoKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG9ialtrZXldLnB1c2goaXRlbSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBHZW5lcmF0ZSBzdWJjb21wb25lbnRzXG4gICAgICAgIGVsc2UgaWYgKHYgaW5zdGFuY2VvZiBSb290KSB7XG4gICAgICAgICAgaWYgKCF2Ll9faW5Ub09iamVjdCAmJiAhbm9DaGlsZHJlbikge1xuICAgICAgICAgICAgb2JqW2tleV0gPSB2LnRvT2JqZWN0KCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gR2VuZXJhdGUgZGF0ZXMgKGNyZWF0ZXMgYSBjb3B5IHRvIHNlcGFyYXRlIGl0IGZyb20gdGhlIHNvdXJjZSBvYmplY3QpXG4gICAgICAgIGVsc2UgaWYgKHYgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICAgICAgb2JqW2tleV0gPSBuZXcgRGF0ZSh2KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEdlbmVyYXRlIHNpbXBsZSBwcm9wZXJ0aWVzXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIG9ialtrZXldID0gdjtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gbm8tb3BcbiAgICB9XG4gICAgdGhpcy5fX2luVG9PYmplY3QgPSBmYWxzZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG5cbiAgLyoqXG4gICAqIExvZyBhIHdhcm5pbmcgZm9yIGF0dGVtcHRzIHRvIHN1YnNjcmliZSB0byB1bnN1cHBvcnRlZCBldmVudHMuXG4gICAqXG4gICAqIEBtZXRob2QgX3dhcm5Gb3JFdmVudFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3dhcm5Gb3JFdmVudChldmVudE5hbWUpIHtcbiAgICBpZiAoIVV0aWxzLmluY2x1ZGVzKHRoaXMuY29uc3RydWN0b3IuX3N1cHBvcnRlZEV2ZW50cywgZXZlbnROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdFdmVudCAnICsgZXZlbnROYW1lICsgJyBub3QgZGVmaW5lZCBmb3IgJyArIHRoaXMudG9TdHJpbmcoKSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFByZXBhcmUgZm9yIHByb2Nlc3NpbmcgYW4gZXZlbnQgc3Vic2NyaXB0aW9uIGNhbGwuXG4gICAqXG4gICAqIElmIGNvbnRleHQgaXMgYSBSb290IGNsYXNzLCBhZGQgdGhpcyBvYmplY3QgdG8gdGhlIGNvbnRleHQncyBzdWJzY3JpcHRpb25zLlxuICAgKlxuICAgKiBAbWV0aG9kIF9wcmVwYXJlT25cbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9wcmVwYXJlT24obmFtZSwgaGFuZGxlciwgY29udGV4dCkge1xuICAgIGlmIChjb250ZXh0KSB7XG4gICAgICBpZiAoY29udGV4dCBpbnN0YW5jZW9mIFJvb3QpIHtcbiAgICAgICAgaWYgKGNvbnRleHQuaXNEZXN0cm95ZWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmlzRGVzdHJveWVkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGNvbnRleHQuX2xheWVyRXZlbnRTdWJzY3JpcHRpb25zKSB7XG4gICAgICAgIGNvbnRleHQuX2xheWVyRXZlbnRTdWJzY3JpcHRpb25zLnB1c2godGhpcyk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gJ3N0cmluZycgJiYgbmFtZSAhPT0gJ2FsbCcpIHtcbiAgICAgIGlmIChldmVudFNwbGl0dGVyLnRlc3QobmFtZSkpIHtcbiAgICAgICAgY29uc3QgbmFtZXMgPSBuYW1lLnNwbGl0KGV2ZW50U3BsaXR0ZXIpO1xuICAgICAgICBuYW1lcy5mb3JFYWNoKG4gPT4gdGhpcy5fd2FybkZvckV2ZW50KG4pKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3dhcm5Gb3JFdmVudChuYW1lKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG5hbWUgJiYgdHlwZW9mIG5hbWUgPT09ICdvYmplY3QnKSB7XG4gICAgICBPYmplY3Qua2V5cyhuYW1lKS5mb3JFYWNoKGtleU5hbWUgPT4gdGhpcy5fd2FybkZvckV2ZW50KGtleU5hbWUpKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3Vic2NyaWJlIHRvIGV2ZW50cy5cbiAgICpcbiAgICogTm90ZSB0aGF0IHRoZSBjb250ZXh0IHBhcmFtZXRlciBzZXJ2ZXMgZG91YmxlIGltcG9ydGFuY2UgaGVyZTpcbiAgICpcbiAgICogMS4gSXQgZGV0ZXJtaW5lcyB0aGUgY29udGV4dCBpbiB3aGljaCB0byBleGVjdXRlIHRoZSBldmVudCBoYW5kbGVyXG4gICAqIDIuIENyZWF0ZSBhIGJhY2tsaW5rIHNvIHRoYXQgaWYgZWl0aGVyIHN1YnNjcmliZXIgb3Igc3Vic2NyaWJlZSBpcyBkZXN0cm95ZWQsXG4gICAqICAgIGFsbCBwb2ludGVycyBiZXR3ZWVuIHRoZW0gY2FuIGJlIGZvdW5kIGFuZCByZW1vdmVkLlxuICAgKlxuICAgKiBgYGBcbiAgICogb2JqLm9uKCdzb21lRXZlbnROYW1lIHNvbWVPdGhlckV2ZW50TmFtZScsIG15Y2FsbGJhY2ssIG15Y29udGV4dCk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBgYGBcbiAgICogb2JqLm9uKHtcbiAgICogICAgZXZlbnROYW1lMTogY2FsbGJhY2sxLFxuICAgKiAgICBldmVudE5hbWUyOiBjYWxsYmFjazJcbiAgICogfSwgbXljb250ZXh0KTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBtZXRob2Qgb25cbiAgICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIC0gTmFtZSBvZiB0aGUgZXZlbnRcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGhhbmRsZXIgLSBFdmVudCBoYW5kbGVyXG4gICAqIEBwYXJhbSAge2xheWVyLkxheWVyRXZlbnR9IGhhbmRsZXIuZXZlbnQgLSBFdmVudCBvYmplY3QgZGVsaXZlcmVkIHRvIHRoZSBoYW5kbGVyXG4gICAqIEBwYXJhbSAge09iamVjdH0gY29udGV4dCAtIFRoaXMgcG9pbnRlciBBTkQgbGluayB0byBoZWxwIHdpdGggY2xlYW51cFxuICAgKiBAcmV0dXJuIHtsYXllci5Sb290fSB0aGlzXG4gICAqL1xuICBvbihuYW1lLCBoYW5kbGVyLCBjb250ZXh0KSB7XG4gICAgdGhpcy5fcHJlcGFyZU9uKG5hbWUsIGhhbmRsZXIsIGNvbnRleHQpO1xuICAgIEV2ZW50cy5vbi5hcHBseSh0aGlzLCBbbmFtZSwgaGFuZGxlciwgY29udGV4dF0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFN1YnNjcmliZSB0byB0aGUgZmlyc3Qgb2NjdXJhbmNlIG9mIHRoZSBzcGVjaWZpZWQgZXZlbnQuXG4gICAqXG4gICAqIEBtZXRob2Qgb25jZVxuICAgKiBAcmV0dXJuIHtsYXllci5Sb290fSB0aGlzXG4gICAqL1xuICBvbmNlKG5hbWUsIGhhbmRsZXIsIGNvbnRleHQpIHtcbiAgICB0aGlzLl9wcmVwYXJlT24obmFtZSwgaGFuZGxlciwgY29udGV4dCk7XG4gICAgRXZlbnRzLm9uY2UuYXBwbHkodGhpcywgW25hbWUsIGhhbmRsZXIsIGNvbnRleHRdKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBVbnN1YnNjcmliZSBmcm9tIGV2ZW50cy5cbiAgICpcbiAgICogYGBgXG4gICAqIC8vIFJlbW92ZXMgYWxsIGV2ZW50IGhhbmRsZXJzIGZvciB0aGlzIGV2ZW50OlxuICAgKiBvYmoub2ZmKCdzb21lRXZlbnROYW1lJyk7XG4gICAqXG4gICAqIC8vIFJlbW92ZXMgYWxsIGV2ZW50IGhhbmRsZXJzIHVzaW5nIHRoaXMgZnVuY3Rpb24gcG9pbnRlciBhcyBjYWxsYmFja1xuICAgKiBvYmoub2ZmKG51bGwsIGYsIG51bGwpO1xuICAgKlxuICAgKiAvLyBSZW1vdmVzIGFsbCBldmVudCBoYW5kbGVycyB0aGF0IGB0aGlzYCBoYXMgc3Vic2NyaWJlZCB0bzsgcmVxdWlyZXNcbiAgICogLy8gb2JqLm9uIHRvIGJlIGNhbGxlZCB3aXRoIGB0aGlzYCBhcyBpdHMgYGNvbnRleHRgIHBhcmFtZXRlci5cbiAgICogb2JqLm9mZihudWxsLCBudWxsLCB0aGlzKTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBtZXRob2Qgb2ZmXG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSAtIE5hbWUgb2YgdGhlIGV2ZW50OyBudWxsIGZvciBhbGwgZXZlbnQgbmFtZXNcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGhhbmRsZXIgLSBFdmVudCBoYW5kbGVyOyBudWxsIGZvciBhbGwgZnVuY3Rpb25zXG4gICAqIEBwYXJhbSAge09iamVjdH0gY29udGV4dCAtIFRoZSBjb250ZXh0IGZyb20gdGhlIGBvbigpYCBjYWxsIHRvIHNlYXJjaCBmb3I7IG51bGwgZm9yIGFsbCBjb250ZXh0c1xuICAgKiBAcmV0dXJuIHtsYXllci5Sb290fSB0aGlzXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIFRyaWdnZXIgYW4gZXZlbnQgZm9yIGFueSBldmVudCBsaXN0ZW5lcnMuXG4gICAqXG4gICAqIEV2ZW50cyB0cmlnZ2VyZWQgdGhpcyB3YXkgd2lsbCBiZSBibG9ja2VkIGlmIF9kaXNhYmxlRXZlbnRzID0gdHJ1ZVxuICAgKlxuICAgKiBAbWV0aG9kIHRyaWdnZXJcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50TmFtZSAgICBOYW1lIG9mIHRoZSBldmVudCB0aGF0IG9uZSBzaG91bGQgc3Vic2NyaWJlIHRvIGluIG9yZGVyIHRvIHJlY2VpdmUgdGhpcyBldmVudFxuICAgKiBAcGFyYW0ge01peGVkfSBhcmcgICAgICAgICAgIFZhbHVlcyB0aGF0IHdpbGwgYmUgcGxhY2VkIHdpdGhpbiBhIGxheWVyLkxheWVyRXZlbnRcbiAgICogQHJldHVybiB7bGF5ZXIuUm9vdH0gdGhpc1xuICAgKi9cbiAgdHJpZ2dlciguLi5hcmdzKSB7XG4gICAgaWYgKHRoaXMuX2Rpc2FibGVFdmVudHMpIHJldHVybiB0aGlzO1xuICAgIHJldHVybiB0aGlzLl90cmlnZ2VyKC4uLmFyZ3MpO1xuICB9XG5cbiAgLyoqXG4gICAqIFRyaWdnZXJzIGFuIGV2ZW50LlxuICAgKlxuICAgKiBAbWV0aG9kIHRyaWdnZXJcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50TmFtZSAgICBOYW1lIG9mIHRoZSBldmVudCB0aGF0IG9uZSBzaG91bGQgc3Vic2NyaWJlIHRvIGluIG9yZGVyIHRvIHJlY2VpdmUgdGhpcyBldmVudFxuICAgKiBAcGFyYW0ge01peGVkfSBhcmcgICAgICAgICAgIFZhbHVlcyB0aGF0IHdpbGwgYmUgcGxhY2VkIHdpdGhpbiBhIGxheWVyLkxheWVyRXZlbnRcbiAgICovXG4gIF90cmlnZ2VyKC4uLmFyZ3MpIHtcbiAgICBpZiAoIVV0aWxzLmluY2x1ZGVzKHRoaXMuY29uc3RydWN0b3IuX3N1cHBvcnRlZEV2ZW50cywgYXJnc1swXSkpIHtcbiAgICAgIGlmICghVXRpbHMuaW5jbHVkZXModGhpcy5jb25zdHJ1Y3Rvci5faWdub3JlZEV2ZW50cywgYXJnc1swXSkpIHtcbiAgICAgICAgTG9nZ2VyLmVycm9yKHRoaXMudG9TdHJpbmcoKSArICcgaWdub3JlZCAnICsgYXJnc1swXSk7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgY29tcHV0ZWRBcmdzID0gdGhpcy5fZ2V0VHJpZ2dlckFyZ3MoLi4uYXJncyk7XG5cbiAgICBFdmVudHMudHJpZ2dlci5hcHBseSh0aGlzLCBjb21wdXRlZEFyZ3MpO1xuXG4gICAgY29uc3QgcGFyZW50UHJvcCA9IHRoaXMuY29uc3RydWN0b3IuYnViYmxlRXZlbnRQYXJlbnQ7XG4gICAgaWYgKHBhcmVudFByb3ApIHtcbiAgICAgIGxldCBwYXJlbnRWYWx1ZSA9IHRoaXNbcGFyZW50UHJvcF07XG4gICAgICBwYXJlbnRWYWx1ZSA9ICh0eXBlb2YgcGFyZW50VmFsdWUgPT09ICdmdW5jdGlvbicpID8gcGFyZW50VmFsdWUuYXBwbHkodGhpcykgOiBwYXJlbnRWYWx1ZTtcbiAgICAgIGlmIChwYXJlbnRWYWx1ZSkgcGFyZW50VmFsdWUudHJpZ2dlciguLi5jb21wdXRlZEFyZ3MpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZXMgYSBsYXllci5MYXllckV2ZW50IGZyb20gYSB0cmlnZ2VyIGNhbGwncyBhcmd1bWVudHMuXG4gICAqXG4gICAqICogSWYgcGFyYW1ldGVyIGlzIGFscmVhZHkgYSBsYXllci5MYXllckV2ZW50LCB3ZSdyZSBkb25lLlxuICAgKiAqIElmIHBhcmFtZXRlciBpcyBhbiBvYmplY3QsIGEgYHRhcmdldGAgcHJvcGVydHkgaXMgYWRkZWQgdG8gdGhhdCBvYmplY3QgYW5kIGl0cyBkZWxpdmVyZWQgdG8gYWxsIHN1YnNjcmliZXJzXG4gICAqICogSWYgdGhlIHBhcmFtZXRlciBpcyBub24tb2JqZWN0IHZhbHVlLCBpdCBpcyBhZGRlZCB0byBhbiBvYmplY3Qgd2l0aCBhIGB0YXJnZXRgIHByb3BlcnR5LCBhbmQgdGhlIHZhbHVlIGlzIHB1dCBpblxuICAgKiAgIHRoZSBgZGF0YWAgcHJvcGVydHkuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldFRyaWdnZXJBcmdzXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm4ge01peGVkW119IC0gRmlyc3QgZWxlbWVudCBvZiBhcnJheSBpcyBldmVudE5hbWUsIHNlY29uZCBlbGVtZW50IGlzIGxheWVyLkxheWVyRXZlbnQuXG4gICAqL1xuICBfZ2V0VHJpZ2dlckFyZ3MoLi4uYXJncykge1xuICAgIGNvbnN0IGNvbXB1dGVkQXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3MpO1xuXG4gICAgaWYgKGFyZ3NbMV0pIHtcbiAgICAgIGNvbnN0IG5ld0FyZyA9IHsgdGFyZ2V0OiB0aGlzIH07XG5cbiAgICAgIGlmIChjb21wdXRlZEFyZ3NbMV0gaW5zdGFuY2VvZiBMYXllckV2ZW50KSB7XG4gICAgICAgIC8vIEEgTGF5ZXJFdmVudCB3aWxsIGJlIGFuIGFyZ3VtZW50IHdoZW4gYnViYmxpbmcgZXZlbnRzIHVwOyB0aGVzZSBhcmdzIGNhbiBiZSB1c2VkIGFzLWlzXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodHlwZW9mIGNvbXB1dGVkQXJnc1sxXSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICBPYmplY3Qua2V5cyhjb21wdXRlZEFyZ3NbMV0pLmZvckVhY2gobmFtZSA9PiB7bmV3QXJnW25hbWVdID0gY29tcHV0ZWRBcmdzWzFdW25hbWVdO30pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG5ld0FyZy5kYXRhID0gY29tcHV0ZWRBcmdzWzFdO1xuICAgICAgICB9XG4gICAgICAgIGNvbXB1dGVkQXJnc1sxXSA9IG5ldyBMYXllckV2ZW50KG5ld0FyZywgY29tcHV0ZWRBcmdzWzBdKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29tcHV0ZWRBcmdzWzFdID0gbmV3IExheWVyRXZlbnQoeyB0YXJnZXQ6IHRoaXMgfSwgY29tcHV0ZWRBcmdzWzBdKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29tcHV0ZWRBcmdzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNhbWUgYXMgX3RyaWdnZXIoKSBtZXRob2QsIGJ1dCBkZWxheXMgYnJpZWZseSBiZWZvcmUgZmlyaW5nLlxuICAgKlxuICAgKiBXaGVuIHdvdWxkIHlvdSB3YW50IHRvIGRlbGF5IGFuIGV2ZW50P1xuICAgKlxuICAgKiAxLiBUaGVyZSBpcyBhbiBldmVudCByb2xsdXAgdGhhdCBtYXkgYmUgbmVlZGVkIGZvciB0aGUgZXZlbnQ7XG4gICAqICAgIHRoaXMgcmVxdWlyZXMgdGhlIGZyYW1ld29yayB0byBiZSBhYmxlIHRvIHNlZSBBTEwgZXZlbnRzIHRoYXQgaGF2ZSBiZWVuXG4gICAqICAgIGdlbmVyYXRlZCwgcm9sbCB0aGVtIHVwLCBhbmQgVEhFTiBmaXJlIHRoZW0uXG4gICAqIDIuIFRoZSBldmVudCBpcyBpbnRlbmRlZCBmb3IgVUkgcmVuZGVyaW5nLi4uIHdoaWNoIHNob3VsZCBub3QgaG9sZCB1cCB0aGUgcmVzdCBvZlxuICAgKiAgICB0aGlzIGZyYW1ld29yaydzIGV4ZWN1dGlvbi5cbiAgICpcbiAgICogV2hlbiBOT1QgdG8gZGVsYXkgYW4gZXZlbnQ/XG4gICAqXG4gICAqIDEuIExpZmVjeWNsZSBldmVudHMgZnJlcXVlbnRseSByZXF1aXJlIHJlc3BvbnNlIGF0IHRoZSB0aW1lIHRoZSBldmVudCBoYXMgZmlyZWRcbiAgICpcbiAgICogQG1ldGhvZCBfdHJpZ2dlckFzeW5jXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudE5hbWUgICAgTmFtZSBvZiB0aGUgZXZlbnQgdGhhdCBvbmUgc2hvdWxkIHN1YnNjcmliZSB0byBpbiBvcmRlciB0byByZWNlaXZlIHRoaXMgZXZlbnRcbiAgICogQHBhcmFtIHtNaXhlZH0gYXJnICAgICAgICAgICBWYWx1ZXMgdGhhdCB3aWxsIGJlIHBsYWNlZCB3aXRoaW4gYSBsYXllci5MYXllckV2ZW50XG4gICAqIEByZXR1cm4ge2xheWVyLlJvb3R9IHRoaXNcbiAgICovXG4gIF90cmlnZ2VyQXN5bmMoLi4uYXJncykge1xuICAgIGNvbnN0IGNvbXB1dGVkQXJncyA9IHRoaXMuX2dldFRyaWdnZXJBcmdzKC4uLmFyZ3MpO1xuICAgIHRoaXMuX2RlbGF5ZWRUcmlnZ2Vycy5wdXNoKGNvbXB1dGVkQXJncyk7XG5cbiAgICAvLyBOT1RFOiBJdCBpcyB1bmNsZWFyIGF0IHRoaXMgdGltZSBob3cgaXQgaGFwcGVucywgYnV0IG9uIHZlcnkgcmFyZSBvY2Nhc2lvbnMsIHdlIHNlZSBwcm9jZXNzRGVsYXllZFRyaWdnZXJzXG4gICAgLy8gZmFpbCB0byBnZXQgY2FsbGVkIHdoZW4gbGVuZ3RoID0gMSwgYW5kIGFmdGVyIHRoYXQgbGVuZ3RoIGp1c3QgY29udGludW91c2x5IGdyb3dzLiAgU28gd2UgYWRkXG4gICAgLy8gdGhlIF9sYXN0RGVsYXllZFRyaWdnZXIgdGVzdCB0byBpbnN1cmUgdGhhdCBpdCB3aWxsIHN0aWxsIHJ1bi5cbiAgICBjb25zdCBzaG91bGRTY2hlZHVsZVRyaWdnZXIgPSB0aGlzLl9kZWxheWVkVHJpZ2dlcnMubGVuZ3RoID09PSAxIHx8XG4gICAgICB0aGlzLl9kZWxheWVkVHJpZ2dlcnMubGVuZ3RoICYmIHRoaXMuX2xhc3REZWxheWVkVHJpZ2dlciArIDUwMCA8IERhdGUubm93KCk7XG4gICAgaWYgKHNob3VsZFNjaGVkdWxlVHJpZ2dlcikge1xuICAgICAgdGhpcy5fbGFzdERlbGF5ZWRUcmlnZ2VyID0gRGF0ZS5ub3coKTtcbiAgICAgIGlmICh0eXBlb2YgcG9zdE1lc3NhZ2UgPT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIGphc21pbmUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHZhciBtZXNzYWdlRGF0YSA9IHtcbiAgICAgICAgICB0eXBlOiAnbGF5ZXItZGVsYXllZC1ldmVudCcsXG4gICAgICAgICAgaW50ZXJuYWxJZDogdGhpcy5pbnRlcm5hbElkLFxuICAgICAgICB9O1xuICAgICAgICBpZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIHdpbmRvdy5wb3N0TWVzc2FnZShtZXNzYWdlRGF0YSwgJyonKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBSZWFjdCBOYXRpdmUgcmVwb3J0ZWRseSBsYWNrcyBhIGRvY3VtZW50LCBhbmQgdGhyb3dzIGVycm9ycyBvbiB0aGUgc2Vjb25kIHBhcmFtZXRlclxuICAgICAgICAgIHdpbmRvdy5wb3N0TWVzc2FnZShtZXNzYWdlRGF0YSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5fcHJvY2Vzc0RlbGF5ZWRUcmlnZ2VycygpLCAwKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ29tYmluZXMgYSBzZXQgb2YgZXZlbnRzIGludG8gYSBzaW5nbGUgZXZlbnQuXG4gICAqXG4gICAqIEdpdmVuIGFuIGV2ZW50IHN0cnVjdHVyZSBvZlxuICAgKiBgYGBcbiAgICogICAgICB7XG4gICAqICAgICAgICAgIGN1c3RvbU5hbWU6IFt2YWx1ZTFdXG4gICAqICAgICAgfVxuICAgKiAgICAgIHtcbiAgICogICAgICAgICAgY3VzdG9tTmFtZTogW3ZhbHVlMl1cbiAgICogICAgICB9XG4gICAqICAgICAge1xuICAgKiAgICAgICAgICBjdXN0b21OYW1lOiBbdmFsdWUzXVxuICAgKiAgICAgIH1cbiAgICogYGBgXG4gICAqXG4gICAqIE1lcmdlIHRoZW0gaW50b1xuICAgKlxuICAgKiBgYGBcbiAgICogICAgICB7XG4gICAqICAgICAgICAgIGN1c3RvbU5hbWU6IFt2YWx1ZTEsIHZhbHVlMiwgdmFsdWUzXVxuICAgKiAgICAgIH1cbiAgICogYGBgXG4gICAqXG4gICAqIEBtZXRob2QgX2ZvbGRFdmVudHNcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bGF5ZXIuTGF5ZXJFdmVudFtdfSBldmVudHNcbiAgICogQHBhcmFtICB7c3RyaW5nfSBuYW1lICAgICAgTmFtZSBvZiB0aGUgcHJvcGVydHkgKGkuZS4gJ2N1c3RvbU5hbWUnKVxuICAgKiBAcGFyYW0gIHtsYXllci5Sb290fSAgICBuZXdUYXJnZXQgVmFsdWUgb2YgdGhlIHRhcmdldCBmb3IgdGhlIGZvbGRlZCByZXN1bHRpbmcgZXZlbnRcbiAgICovXG4gIF9mb2xkRXZlbnRzKGV2ZW50cywgbmFtZSwgbmV3VGFyZ2V0KSB7XG4gICAgY29uc3QgZmlyc3RFdnQgPSBldmVudHMubGVuZ3RoID8gZXZlbnRzWzBdWzFdIDogbnVsbDtcbiAgICBjb25zdCBmaXJzdEV2dFByb3AgPSBmaXJzdEV2dCA/IGZpcnN0RXZ0W25hbWVdIDogbnVsbDtcbiAgICBldmVudHMuZm9yRWFjaCgoZXZ0LCBpKSA9PiB7XG4gICAgICBpZiAoaSA+IDApIHtcbiAgICAgICAgZmlyc3RFdnRQcm9wLnB1c2goZXZ0WzFdW25hbWVdWzBdKTtcbiAgICAgICAgdGhpcy5fZGVsYXllZFRyaWdnZXJzLnNwbGljZSh0aGlzLl9kZWxheWVkVHJpZ2dlcnMuaW5kZXhPZihldnQpLCAxKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoZXZlbnRzLmxlbmd0aCAmJiBuZXdUYXJnZXQpIGV2ZW50c1swXVsxXS50YXJnZXQgPSBuZXdUYXJnZXQ7XG4gIH1cblxuICAvKipcbiAgICogRm9sZCBhIHNldCBvZiBDaGFuZ2UgZXZlbnRzIGludG8gYSBzaW5nbGUgQ2hhbmdlIGV2ZW50LlxuICAgKlxuICAgKiBHaXZlbiBhIHNldCBjaGFuZ2UgZXZlbnRzIG9uIHRoaXMgY29tcG9uZW50LFxuICAgKiBmb2xkIGFsbCBjaGFuZ2UgZXZlbnRzIGludG8gYSBzaW5nbGUgZXZlbnQgdmlhXG4gICAqIHRoZSBsYXllci5MYXllckV2ZW50J3MgY2hhbmdlcyBhcnJheS5cbiAgICpcbiAgICogQG1ldGhvZCBfZm9sZENoYW5nZUV2ZW50c1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2ZvbGRDaGFuZ2VFdmVudHMoKSB7XG4gICAgY29uc3QgZXZlbnRzID0gdGhpcy5fZGVsYXllZFRyaWdnZXJzLmZpbHRlcihldnQgPT4gZXZ0WzFdLmlzQ2hhbmdlKTtcbiAgICBldmVudHMuZm9yRWFjaCgoZXZ0LCBpKSA9PiB7XG4gICAgICBpZiAoaSA+IDApIHtcbiAgICAgICAgZXZlbnRzWzBdWzFdLl9tZXJnZUNoYW5nZXMoZXZ0WzFdKTtcbiAgICAgICAgdGhpcy5fZGVsYXllZFRyaWdnZXJzLnNwbGljZSh0aGlzLl9kZWxheWVkVHJpZ2dlcnMuaW5kZXhPZihldnQpLCAxKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGVjdXRlIGFsbCBkZWxheWVkIGV2ZW50cyBmb3IgdGhpcyBjb21wb2VubnQuXG4gICAqXG4gICAqIEBtZXRob2QgX3Byb2Nlc3NEZWxheWVkVHJpZ2dlcnNcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9wcm9jZXNzRGVsYXllZFRyaWdnZXJzKCkge1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkKSByZXR1cm47XG4gICAgdGhpcy5fZm9sZENoYW5nZUV2ZW50cygpO1xuXG4gICAgdGhpcy5fZGVsYXllZFRyaWdnZXJzLmZvckVhY2goZnVuY3Rpb24gKGV2dCkge1xuICAgICAgdGhpcy50cmlnZ2VyKC4uLmV2dCk7XG4gICAgfSwgdGhpcyk7XG4gICAgdGhpcy5fZGVsYXllZFRyaWdnZXJzID0gW107XG4gIH1cblxuXG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIGNsYXNzIHRoYXQgaXMgbmljZXIgdGhhbiBgW09iamVjdF1gLlxuICAgKlxuICAgKiBAbWV0aG9kIHRvU3RyaW5nXG4gICAqIEByZXR1cm4ge1N0cmluZ31cbiAgICovXG4gIHRvU3RyaW5nKCkge1xuICAgIHJldHVybiB0aGlzLmludGVybmFsSWQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gZGVmaW5lUHJvcGVydHkobmV3Q2xhc3MsIHByb3BlcnR5TmFtZSkge1xuICBjb25zdCBwS2V5ID0gJ19fJyArIHByb3BlcnR5TmFtZTtcbiAgY29uc3QgY2FtZWwgPSBwcm9wZXJ0eU5hbWUuc3Vic3RyaW5nKDAsIDEpLnRvVXBwZXJDYXNlKCkgKyBwcm9wZXJ0eU5hbWUuc3Vic3RyaW5nKDEpO1xuXG4gIGNvbnN0IGhhc0RlZmluaXRpb25zID0gbmV3Q2xhc3MucHJvdG90eXBlWydfX2FkanVzdCcgKyBjYW1lbF0gfHwgbmV3Q2xhc3MucHJvdG90eXBlWydfX3VwZGF0ZScgKyBjYW1lbF0gfHxcbiAgICBuZXdDbGFzcy5wcm90b3R5cGVbJ19fZ2V0JyArIGNhbWVsXTtcbiAgaWYgKGhhc0RlZmluaXRpb25zKSB7XG4gICAgLy8gc2V0IGRlZmF1bHQgdmFsdWVcbiAgICBuZXdDbGFzcy5wcm90b3R5cGVbcEtleV0gPSBuZXdDbGFzcy5wcm90b3R5cGVbcHJvcGVydHlOYW1lXTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShuZXdDbGFzcy5wcm90b3R5cGUsIHByb3BlcnR5TmFtZSwge1xuICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpc1snX19nZXQnICsgY2FtZWxdID8gdGhpc1snX19nZXQnICsgY2FtZWxdKHBLZXkpIDogdGhpc1twS2V5XTtcbiAgICAgIH0sXG4gICAgICBzZXQ6IGZ1bmN0aW9uIHNldChpblZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLmlzRGVzdHJveWVkKSByZXR1cm47XG4gICAgICAgIGNvbnN0IGluaXRpYWwgPSB0aGlzW3BLZXldO1xuICAgICAgICBpZiAoaW5WYWx1ZSAhPT0gaW5pdGlhbCkge1xuICAgICAgICAgIGlmICh0aGlzWydfX2FkanVzdCcgKyBjYW1lbF0pIHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXNbJ19fYWRqdXN0JyArIGNhbWVsXShpblZhbHVlKTtcbiAgICAgICAgICAgIGlmIChyZXN1bHQgIT09IHVuZGVmaW5lZCkgaW5WYWx1ZSA9IHJlc3VsdDtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpc1twS2V5XSA9IGluVmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGluVmFsdWUgIT09IGluaXRpYWwpIHtcbiAgICAgICAgICBpZiAoIXRoaXMuaXNJbml0aWFsaXppbmcgJiYgdGhpc1snX191cGRhdGUnICsgY2FtZWxdKSB7XG4gICAgICAgICAgICB0aGlzWydfX3VwZGF0ZScgKyBjYW1lbF0oaW5WYWx1ZSwgaW5pdGlhbCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGluaXRDbGFzcyhuZXdDbGFzcywgY2xhc3NOYW1lKSB7XG4gIC8vIE1ha2Ugc3VyZSBvdXIgbmV3IGNsYXNzIGhhcyBhIG5hbWUgcHJvcGVydHlcbiAgaWYgKCFuZXdDbGFzcy5uYW1lKSBuZXdDbGFzcy5uYW1lID0gY2xhc3NOYW1lO1xuXG4gIC8vIE1ha2Ugc3VyZSBvdXIgbmV3IGNsYXNzIGhhcyBhIF9zdXBwb3J0ZWRFdmVudHMsIF9pZ25vcmVkRXZlbnRzLCBfaW5PYmplY3RJZ25vcmUgYW5kIEVWRU5UUyBwcm9wZXJ0aWVzXG4gIGlmICghbmV3Q2xhc3MuX3N1cHBvcnRlZEV2ZW50cykgbmV3Q2xhc3MuX3N1cHBvcnRlZEV2ZW50cyA9IFJvb3QuX3N1cHBvcnRlZEV2ZW50cztcbiAgaWYgKCFuZXdDbGFzcy5faWdub3JlZEV2ZW50cykgbmV3Q2xhc3MuX2lnbm9yZWRFdmVudHMgPSBSb290Ll9pZ25vcmVkRXZlbnRzO1xuXG4gIC8vIEdlbmVyYXRlIGEgbGlzdCBvZiBwcm9wZXJ0aWVzIGZvciB0aGlzIGNsYXNzOyB3ZSBkb24ndCBpbmNsdWRlIGFueVxuICAvLyBwcm9wZXJ0aWVzIGZyb20gbGF5ZXIuUm9vdFxuICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMobmV3Q2xhc3MucHJvdG90eXBlKS5maWx0ZXIoa2V5ID0+XG4gICAgbmV3Q2xhc3MucHJvdG90eXBlLmhhc093blByb3BlcnR5KGtleSkgJiZcbiAgICAhUm9vdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkoa2V5KSAmJlxuICAgIHR5cGVvZiBuZXdDbGFzcy5wcm90b3R5cGVba2V5XSAhPT0gJ2Z1bmN0aW9uJ1xuICApO1xuXG4gIC8vIERlZmluZSBnZXR0ZXJzL3NldHRlcnMgZm9yIGFueSBwcm9wZXJ0eSB0aGF0IGhhcyBfX2FkanVzdCBvciBfX3VwZGF0ZSBtZXRob2RzIGRlZmluZWRcbiAga2V5cy5mb3JFYWNoKG5hbWUgPT4gZGVmaW5lUHJvcGVydHkobmV3Q2xhc3MsIG5hbWUpKTtcbn1cblxuLyoqXG4gKiBTZXQgdG8gdHJ1ZSBvbmNlIGRlc3Ryb3koKSBoYXMgYmVlbiBjYWxsZWQuXG4gKlxuICogQSBkZXN0cm95ZWQgb2JqZWN0IHdpbGwgbGlrZWx5IGNhdXNlIGVycm9ycyBpbiBhbnkgYXR0ZW1wdFxuICogdG8gY2FsbCBtZXRob2RzIG9uIGl0LCBhbmQgd2lsbCBubyBsb25nZXIgdHJpZ2dlciBldmVudHMuXG4gKlxuICogQHR5cGUge2Jvb2xlYW59XG4gKiBAcmVhZG9ubHlcbiAqL1xuUm9vdC5wcm90b3R5cGUuaXNEZXN0cm95ZWQgPSBmYWxzZTtcblxuLyoqXG4gKiBFdmVyeSBpbnN0YW5jZSBoYXMgaXRzIG93biBpbnRlcm5hbCBJRC5cbiAqXG4gKiBUaGlzIElEIGlzIGRpc3RpbmN0IGZyb20gYW55IElEcyBhc3NpZ25lZCBieSB0aGUgc2VydmVyLlxuICogVGhlIGludGVybmFsIElEIGlzIGdhdXJlbnRlZWQgbm90IHRvIGNoYW5nZSB3aXRoaW4gdGhlIGxpZmV0aW1lIG9mIHRoZSBPYmplY3Qvc2Vzc2lvbjtcbiAqIGl0IGlzIHBvc3NpYmxlLCBvbiBjcmVhdGluZyBhIG5ldyBvYmplY3QsIGZvciBpdHMgYGlkYCBwcm9wZXJ0eSB0byBjaGFuZ2UuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEByZWFkb25seVxuICovXG5Sb290LnByb3RvdHlwZS5pbnRlcm5hbElkID0gJyc7XG5cbi8qKlxuICogVHJ1ZSB3aGlsZSB3ZSBhcmUgaW4gdGhlIGNvbnN0cnVjdG9yLlxuICpcbiAqIEB0eXBlIHtib29sZWFufVxuICogQHJlYWRvbmx5XG4gKi9cblJvb3QucHJvdG90eXBlLmlzSW5pdGlhbGl6aW5nID0gdHJ1ZTtcblxuLyoqXG4gKiBPYmplY3RzIHRoYXQgdGhpcyBvYmplY3QgaXMgbGlzdGVuaW5nIGZvciBldmVudHMgZnJvbS5cbiAqXG4gKiBAdHlwZSB7bGF5ZXIuUm9vdFtdfVxuICogQHByaXZhdGVcbiAqL1xuUm9vdC5wcm90b3R5cGUuX2xheWVyRXZlbnRTdWJzY3JpcHRpb25zID0gbnVsbDtcblxuLyoqXG4gKiBEaXNhYmxlIGFsbCBldmVudHMgdHJpZ2dlcmVkIG9uIHRoaXMgb2JqZWN0LlxuICogQHR5cGUge2Jvb2xlYW59XG4gKiBAcHJpdmF0ZVxuICovXG5Sb290LnByb3RvdHlwZS5fZGlzYWJsZUV2ZW50cyA9IGZhbHNlO1xuXG5cblJvb3QuX3N1cHBvcnRlZEV2ZW50cyA9IFsnZGVzdHJveScsICdhbGwnXTtcblJvb3QuX2lnbm9yZWRFdmVudHMgPSBbXTtcbm1vZHVsZS5leHBvcnRzID0gUm9vdDtcbm1vZHVsZS5leHBvcnRzLmluaXRDbGFzcyA9IGluaXRDbGFzcztcbiJdfQ==
