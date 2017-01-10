'use strict';

/**
 * Static properties here only needed if your directly using
 * the layer.TypingIndicators.TypingPublisher (not needed if
 * you are using the layer.TypingIndicators.TypingListener).
 *
 *      typingPublisher.setState(layer.TypingIndicators.STARTED);
 *
 * @class  layer.TypingIndicators
 * @static
 */
module.exports = {
  /**
   * Typing has started/resumed
   * @type {String}
   * @static
   */
  STARTED: 'started',

  /**
   * Typing has paused
   * @type {String}
   * @static
   */
  PAUSED: 'paused',

  /**
   * Typing has finished
   * @type {String}
   * @static
   */
  FINISHED: 'finished'
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy90eXBpbmctaW5kaWNhdG9ycy90eXBpbmctaW5kaWNhdG9ycy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7Ozs7O0FBVUEsT0FBTyxPQUFQLEdBQWlCO0FBQ2Y7Ozs7O0FBS0EsV0FBUyxTQU5NOztBQVFmOzs7OztBQUtBLFVBQVEsUUFiTzs7QUFlZjs7Ozs7QUFLQSxZQUFVO0FBcEJLLENBQWpCIiwiZmlsZSI6InR5cGluZy1pbmRpY2F0b3JzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBTdGF0aWMgcHJvcGVydGllcyBoZXJlIG9ubHkgbmVlZGVkIGlmIHlvdXIgZGlyZWN0bHkgdXNpbmdcbiAqIHRoZSBsYXllci5UeXBpbmdJbmRpY2F0b3JzLlR5cGluZ1B1Ymxpc2hlciAobm90IG5lZWRlZCBpZlxuICogeW91IGFyZSB1c2luZyB0aGUgbGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5UeXBpbmdMaXN0ZW5lcikuXG4gKlxuICogICAgICB0eXBpbmdQdWJsaXNoZXIuc2V0U3RhdGUobGF5ZXIuVHlwaW5nSW5kaWNhdG9ycy5TVEFSVEVEKTtcbiAqXG4gKiBAY2xhc3MgIGxheWVyLlR5cGluZ0luZGljYXRvcnNcbiAqIEBzdGF0aWNcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSB7XG4gIC8qKlxuICAgKiBUeXBpbmcgaGFzIHN0YXJ0ZWQvcmVzdW1lZFxuICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgKiBAc3RhdGljXG4gICAqL1xuICBTVEFSVEVEOiAnc3RhcnRlZCcsXG5cbiAgLyoqXG4gICAqIFR5cGluZyBoYXMgcGF1c2VkXG4gICAqIEB0eXBlIHtTdHJpbmd9XG4gICAqIEBzdGF0aWNcbiAgICovXG4gIFBBVVNFRDogJ3BhdXNlZCcsXG5cbiAgLyoqXG4gICAqIFR5cGluZyBoYXMgZmluaXNoZWRcbiAgICogQHR5cGUge1N0cmluZ31cbiAgICogQHN0YXRpY1xuICAgKi9cbiAgRklOSVNIRUQ6ICdmaW5pc2hlZCcsXG59O1xuIl19
