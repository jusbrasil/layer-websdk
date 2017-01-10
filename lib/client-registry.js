"use strict";

/**
 * Allows all components to have a clientId instead of a client pointer.
 * Allows an app to have multiple Clients, each with its own appId.
 * Provides a global utility that can be required by all modules for accessing
 * the client.
 *
 * @class  layer.ClientRegistry
 * @private
 */

var registry = {};

/**
 * Register a new Client; will destroy any previous client with the same appId.
 *
 * @method register
 * @param  {layer.Client} client
 */
function register(client) {
  var appId = client.appId;
  if (registry[appId] && !registry[appId].isDestroyed) {
    registry[appId].destroy();
  }
  registry[appId] = client;
}

/**
 * Removes a Client.
 *
 * @method unregister
 * @param  {layer.Client} client
 */
function unregister(client) {
  if (registry[client.appId]) delete registry[client.appId];
}

/**
 * Get a Client by appId
 *
 * @method get
 * @param  {string} appId
 * @return {layer.Client}
 */
function get(appId) {
  return registry[appId] || null;
}

function getAll() {
  return Object.keys(registry).map(function (key) {
    return registry[key];
  });
}

module.exports = {
  get: get,
  getAll: getAll,
  register: register,
  unregister: unregister
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGllbnQtcmVnaXN0cnkuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Ozs7Ozs7OztBQVVBLElBQU0sV0FBVyxFQUFqQjs7QUFFQTs7Ozs7O0FBTUEsU0FBUyxRQUFULENBQWtCLE1BQWxCLEVBQTBCO0FBQ3hCLE1BQU0sUUFBUSxPQUFPLEtBQXJCO0FBQ0EsTUFBSSxTQUFTLEtBQVQsS0FBbUIsQ0FBQyxTQUFTLEtBQVQsRUFBZ0IsV0FBeEMsRUFBcUQ7QUFDbkQsYUFBUyxLQUFULEVBQWdCLE9BQWhCO0FBQ0Q7QUFDRCxXQUFTLEtBQVQsSUFBa0IsTUFBbEI7QUFDRDs7QUFFRDs7Ozs7O0FBTUEsU0FBUyxVQUFULENBQW9CLE1BQXBCLEVBQTRCO0FBQzFCLE1BQUksU0FBUyxPQUFPLEtBQWhCLENBQUosRUFBNEIsT0FBTyxTQUFTLE9BQU8sS0FBaEIsQ0FBUDtBQUM3Qjs7QUFFRDs7Ozs7OztBQU9BLFNBQVMsR0FBVCxDQUFhLEtBQWIsRUFBb0I7QUFDbEIsU0FBTyxTQUFTLEtBQVQsS0FBbUIsSUFBMUI7QUFDRDs7QUFFRCxTQUFTLE1BQVQsR0FBa0I7QUFDaEIsU0FBTyxPQUFPLElBQVAsQ0FBWSxRQUFaLEVBQXNCLEdBQXRCLENBQTBCO0FBQUEsV0FBTyxTQUFTLEdBQVQsQ0FBUDtBQUFBLEdBQTFCLENBQVA7QUFDRDs7QUFFRCxPQUFPLE9BQVAsR0FBaUI7QUFDZixVQURlO0FBRWYsZ0JBRmU7QUFHZixvQkFIZTtBQUlmO0FBSmUsQ0FBakIiLCJmaWxlIjoiY2xpZW50LXJlZ2lzdHJ5LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBbGxvd3MgYWxsIGNvbXBvbmVudHMgdG8gaGF2ZSBhIGNsaWVudElkIGluc3RlYWQgb2YgYSBjbGllbnQgcG9pbnRlci5cbiAqIEFsbG93cyBhbiBhcHAgdG8gaGF2ZSBtdWx0aXBsZSBDbGllbnRzLCBlYWNoIHdpdGggaXRzIG93biBhcHBJZC5cbiAqIFByb3ZpZGVzIGEgZ2xvYmFsIHV0aWxpdHkgdGhhdCBjYW4gYmUgcmVxdWlyZWQgYnkgYWxsIG1vZHVsZXMgZm9yIGFjY2Vzc2luZ1xuICogdGhlIGNsaWVudC5cbiAqXG4gKiBAY2xhc3MgIGxheWVyLkNsaWVudFJlZ2lzdHJ5XG4gKiBAcHJpdmF0ZVxuICovXG5cbmNvbnN0IHJlZ2lzdHJ5ID0ge307XG5cbi8qKlxuICogUmVnaXN0ZXIgYSBuZXcgQ2xpZW50OyB3aWxsIGRlc3Ryb3kgYW55IHByZXZpb3VzIGNsaWVudCB3aXRoIHRoZSBzYW1lIGFwcElkLlxuICpcbiAqIEBtZXRob2QgcmVnaXN0ZXJcbiAqIEBwYXJhbSAge2xheWVyLkNsaWVudH0gY2xpZW50XG4gKi9cbmZ1bmN0aW9uIHJlZ2lzdGVyKGNsaWVudCkge1xuICBjb25zdCBhcHBJZCA9IGNsaWVudC5hcHBJZDtcbiAgaWYgKHJlZ2lzdHJ5W2FwcElkXSAmJiAhcmVnaXN0cnlbYXBwSWRdLmlzRGVzdHJveWVkKSB7XG4gICAgcmVnaXN0cnlbYXBwSWRdLmRlc3Ryb3koKTtcbiAgfVxuICByZWdpc3RyeVthcHBJZF0gPSBjbGllbnQ7XG59XG5cbi8qKlxuICogUmVtb3ZlcyBhIENsaWVudC5cbiAqXG4gKiBAbWV0aG9kIHVucmVnaXN0ZXJcbiAqIEBwYXJhbSAge2xheWVyLkNsaWVudH0gY2xpZW50XG4gKi9cbmZ1bmN0aW9uIHVucmVnaXN0ZXIoY2xpZW50KSB7XG4gIGlmIChyZWdpc3RyeVtjbGllbnQuYXBwSWRdKSBkZWxldGUgcmVnaXN0cnlbY2xpZW50LmFwcElkXTtcbn1cblxuLyoqXG4gKiBHZXQgYSBDbGllbnQgYnkgYXBwSWRcbiAqXG4gKiBAbWV0aG9kIGdldFxuICogQHBhcmFtICB7c3RyaW5nfSBhcHBJZFxuICogQHJldHVybiB7bGF5ZXIuQ2xpZW50fVxuICovXG5mdW5jdGlvbiBnZXQoYXBwSWQpIHtcbiAgcmV0dXJuIHJlZ2lzdHJ5W2FwcElkXSB8fCBudWxsO1xufVxuXG5mdW5jdGlvbiBnZXRBbGwoKSB7XG4gIHJldHVybiBPYmplY3Qua2V5cyhyZWdpc3RyeSkubWFwKGtleSA9PiByZWdpc3RyeVtrZXldKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGdldCxcbiAgZ2V0QWxsLFxuICByZWdpc3RlcixcbiAgdW5yZWdpc3Rlcixcbn07XG4iXX0=
