'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The Content class represents Rich Content.
 *
 * Note that instances of this class will automatically be
 * generated for developers based on whether their message parts
 * require it.
 *
 * That means for the most part, you should never need to
 * instantiate one of these directly.
 *
 *      var content = new layer.Content({
 *          id: 'layer:///content/8c839735-5f95-439a-a867-30903c0133f2'
 *      });
 *
 * @class  layer.Content
 * @private
 * @extends layer.Root
 * @author Michael Kantor
 */

var Root = require('./root');
var xhr = require('./xhr');

var Content = function (_Root) {
  _inherits(Content, _Root);

  /**
   * Constructor
   *
   * @method constructor
   * @param  {Object} options
   * @param  {string} options.id - Identifier for the content
   * @param  {string} [options.downloadUrl=null] - Url to download the content from
   * @param  {Date} [options.expiration] - Expiration date for the url
   * @param  {string} [options.refreshUrl] - Url to access to get a new downloadUrl after it has expired
   *
   * @return {layer.Content}
   */
  function Content(options) {
    _classCallCheck(this, Content);

    if (typeof options === 'string') {
      options = { id: options };
    }
    return _possibleConstructorReturn(this, Object.getPrototypeOf(Content).call(this, options));
  }

  /**
   * Loads the data from google's cloud storage.
   *
   * Data is provided via callback.
   *
   * Note that typically one should use layer.MessagePart.fetchContent() rather than layer.Content.loadContent()
   *
   * @method loadContent
   * @param {string} mimeType - Mime type for the Blob
   * @param {Function} callback
   * @param {Blob} callback.data - A Blob instance representing the data downloaded.  If Blob object is not available, then may use other format.
   */


  _createClass(Content, [{
    key: 'loadContent',
    value: function loadContent(mimeType, callback) {
      xhr({
        url: this.downloadUrl,
        responseType: 'arraybuffer'
      }, function (result) {
        if (result.success) {
          if (typeof Blob !== 'undefined') {
            var blob = new Blob([result.data], { type: mimeType });
            callback(null, blob);
          } else {
            // If the blob class isn't defined (nodejs) then just return the result as is
            callback(null, result.data);
          }
        } else {
          callback(result.data, null);
        }
      });
    }

    /**
     * Refreshes the URL, which updates the URL and resets the expiration time for the URL
     *
     * @method refreshContent
     * @param {layer.Client} client
     * @param {Function} [callback]
     */

  }, {
    key: 'refreshContent',
    value: function refreshContent(client, callback) {
      var _this2 = this;

      client.xhr({
        url: this.refreshUrl,
        method: 'GET',
        sync: false
      }, function (result) {
        var data = result.data;

        _this2.expiration = new Date(data.expiration);
        _this2.downloadUrl = data.download_url;
        if (callback) callback(_this2.downloadUrl);
      });
    }

    /**
     * Is the download url expired or about to expire?
     * We can't be sure of the state of the device's internal clock,
     * so if its within 10 minutes of expiring, just treat it as expired.
     *
     * @method isExpired
     * @returns {Boolean}
     */

  }, {
    key: 'isExpired',
    value: function isExpired() {
      var expirationLeeway = 10 * 60 * 1000;
      return this.expiration.getTime() - expirationLeeway < Date.now();
    }

    /**
     * Creates a MessagePart from a server representation of the part
     *
     * @method _createFromServer
     * @private
     * @static
     * @param  {Object} part - Server representation of a part
     */

  }], [{
    key: '_createFromServer',
    value: function _createFromServer(part) {
      return new Content({
        id: part.id,
        downloadUrl: part.download_url,
        expiration: new Date(part.expiration),
        refreshUrl: part.refresh_url
      });
    }
  }]);

  return Content;
}(Root);

/**
 * Server generated identifier
 * @type {string}
 */


Content.prototype.id = '';

Content.prototype.blob = null;

/**
 * Server generated url for downloading the content
 * @type {string}
 */
Content.prototype.downloadUrl = '';

/**
 * Url for refreshing the downloadUrl after it has expired
 * @type {string}
 */
Content.prototype.refreshUrl = '';

/**
 * Size of the content.
 *
 * This property only has a value when in the process
 * of Creating the rich content and sending the Message.
 *
 * @type {number}
 */
Content.prototype.size = 0;

/**
 * Expiration date for the downloadUrl
 * @type {Date}
 */
Content.prototype.expiration = null;

Root.initClass.apply(Content, [Content, 'Content']);
module.exports = Content;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jb250ZW50LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFvQkEsSUFBTSxPQUFPLFFBQVEsUUFBUixDQUFiO0FBQ0EsSUFBTSxNQUFNLFFBQVEsT0FBUixDQUFaOztJQUVNLE87OztBQUVKOzs7Ozs7Ozs7Ozs7QUFZQSxtQkFBWSxPQUFaLEVBQXFCO0FBQUE7O0FBQ25CLFFBQUksT0FBTyxPQUFQLEtBQW1CLFFBQXZCLEVBQWlDO0FBQy9CLGdCQUFVLEVBQUUsSUFBSSxPQUFOLEVBQVY7QUFDRDtBQUhrQixzRkFJYixPQUphO0FBS3BCOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7O2dDQVlZLFEsRUFBVSxRLEVBQVU7QUFDOUIsVUFBSTtBQUNGLGFBQUssS0FBSyxXQURSO0FBRUYsc0JBQWM7QUFGWixPQUFKLEVBR0csa0JBQVU7QUFDWCxZQUFJLE9BQU8sT0FBWCxFQUFvQjtBQUNsQixjQUFJLE9BQU8sSUFBUCxLQUFnQixXQUFwQixFQUFpQztBQUMvQixnQkFBTSxPQUFPLElBQUksSUFBSixDQUFTLENBQUMsT0FBTyxJQUFSLENBQVQsRUFBd0IsRUFBRSxNQUFNLFFBQVIsRUFBeEIsQ0FBYjtBQUNBLHFCQUFTLElBQVQsRUFBZSxJQUFmO0FBQ0QsV0FIRCxNQUdPO0FBQ0w7QUFDQSxxQkFBUyxJQUFULEVBQWUsT0FBTyxJQUF0QjtBQUNEO0FBQ0YsU0FSRCxNQVFPO0FBQ0wsbUJBQVMsT0FBTyxJQUFoQixFQUFzQixJQUF0QjtBQUNEO0FBQ0YsT0FmRDtBQWdCRDs7QUFFRDs7Ozs7Ozs7OzttQ0FPZSxNLEVBQVEsUSxFQUFVO0FBQUE7O0FBQy9CLGFBQU8sR0FBUCxDQUFXO0FBQ1QsYUFBSyxLQUFLLFVBREQ7QUFFVCxnQkFBUSxLQUZDO0FBR1QsY0FBTTtBQUhHLE9BQVgsRUFJRyxrQkFBVTtBQUFBLFlBQ0gsSUFERyxHQUNNLE1BRE4sQ0FDSCxJQURHOztBQUVYLGVBQUssVUFBTCxHQUFrQixJQUFJLElBQUosQ0FBUyxLQUFLLFVBQWQsQ0FBbEI7QUFDQSxlQUFLLFdBQUwsR0FBbUIsS0FBSyxZQUF4QjtBQUNBLFlBQUksUUFBSixFQUFjLFNBQVMsT0FBSyxXQUFkO0FBQ2YsT0FURDtBQVVEOztBQUVEOzs7Ozs7Ozs7OztnQ0FRWTtBQUNWLFVBQU0sbUJBQW1CLEtBQUssRUFBTCxHQUFVLElBQW5DO0FBQ0EsYUFBUSxLQUFLLFVBQUwsQ0FBZ0IsT0FBaEIsS0FBNEIsZ0JBQTVCLEdBQStDLEtBQUssR0FBTCxFQUF2RDtBQUNEOztBQUVEOzs7Ozs7Ozs7OztzQ0FReUIsSSxFQUFNO0FBQzdCLGFBQU8sSUFBSSxPQUFKLENBQVk7QUFDakIsWUFBSSxLQUFLLEVBRFE7QUFFakIscUJBQWEsS0FBSyxZQUZEO0FBR2pCLG9CQUFZLElBQUksSUFBSixDQUFTLEtBQUssVUFBZCxDQUhLO0FBSWpCLG9CQUFZLEtBQUs7QUFKQSxPQUFaLENBQVA7QUFNRDs7OztFQXBHbUIsSTs7QUF1R3RCOzs7Ozs7QUFJQSxRQUFRLFNBQVIsQ0FBa0IsRUFBbEIsR0FBdUIsRUFBdkI7O0FBRUEsUUFBUSxTQUFSLENBQWtCLElBQWxCLEdBQXlCLElBQXpCOztBQUVBOzs7O0FBSUEsUUFBUSxTQUFSLENBQWtCLFdBQWxCLEdBQWdDLEVBQWhDOztBQUVBOzs7O0FBSUEsUUFBUSxTQUFSLENBQWtCLFVBQWxCLEdBQStCLEVBQS9COztBQUVBOzs7Ozs7OztBQVFBLFFBQVEsU0FBUixDQUFrQixJQUFsQixHQUF5QixDQUF6Qjs7QUFFQTs7OztBQUlBLFFBQVEsU0FBUixDQUFrQixVQUFsQixHQUErQixJQUEvQjs7QUFFQSxLQUFLLFNBQUwsQ0FBZSxLQUFmLENBQXFCLE9BQXJCLEVBQThCLENBQUMsT0FBRCxFQUFVLFNBQVYsQ0FBOUI7QUFDQSxPQUFPLE9BQVAsR0FBaUIsT0FBakIiLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVGhlIENvbnRlbnQgY2xhc3MgcmVwcmVzZW50cyBSaWNoIENvbnRlbnQuXG4gKlxuICogTm90ZSB0aGF0IGluc3RhbmNlcyBvZiB0aGlzIGNsYXNzIHdpbGwgYXV0b21hdGljYWxseSBiZVxuICogZ2VuZXJhdGVkIGZvciBkZXZlbG9wZXJzIGJhc2VkIG9uIHdoZXRoZXIgdGhlaXIgbWVzc2FnZSBwYXJ0c1xuICogcmVxdWlyZSBpdC5cbiAqXG4gKiBUaGF0IG1lYW5zIGZvciB0aGUgbW9zdCBwYXJ0LCB5b3Ugc2hvdWxkIG5ldmVyIG5lZWQgdG9cbiAqIGluc3RhbnRpYXRlIG9uZSBvZiB0aGVzZSBkaXJlY3RseS5cbiAqXG4gKiAgICAgIHZhciBjb250ZW50ID0gbmV3IGxheWVyLkNvbnRlbnQoe1xuICogICAgICAgICAgaWQ6ICdsYXllcjovLy9jb250ZW50LzhjODM5NzM1LTVmOTUtNDM5YS1hODY3LTMwOTAzYzAxMzNmMidcbiAqICAgICAgfSk7XG4gKlxuICogQGNsYXNzICBsYXllci5Db250ZW50XG4gKiBAcHJpdmF0ZVxuICogQGV4dGVuZHMgbGF5ZXIuUm9vdFxuICogQGF1dGhvciBNaWNoYWVsIEthbnRvclxuICovXG5cbmNvbnN0IFJvb3QgPSByZXF1aXJlKCcuL3Jvb3QnKTtcbmNvbnN0IHhociA9IHJlcXVpcmUoJy4veGhyJyk7XG5cbmNsYXNzIENvbnRlbnQgZXh0ZW5kcyBSb290IHtcblxuICAvKipcbiAgICogQ29uc3RydWN0b3JcbiAgICpcbiAgICogQG1ldGhvZCBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdGlvbnNcbiAgICogQHBhcmFtICB7c3RyaW5nfSBvcHRpb25zLmlkIC0gSWRlbnRpZmllciBmb3IgdGhlIGNvbnRlbnRcbiAgICogQHBhcmFtICB7c3RyaW5nfSBbb3B0aW9ucy5kb3dubG9hZFVybD1udWxsXSAtIFVybCB0byBkb3dubG9hZCB0aGUgY29udGVudCBmcm9tXG4gICAqIEBwYXJhbSAge0RhdGV9IFtvcHRpb25zLmV4cGlyYXRpb25dIC0gRXhwaXJhdGlvbiBkYXRlIGZvciB0aGUgdXJsXG4gICAqIEBwYXJhbSAge3N0cmluZ30gW29wdGlvbnMucmVmcmVzaFVybF0gLSBVcmwgdG8gYWNjZXNzIHRvIGdldCBhIG5ldyBkb3dubG9hZFVybCBhZnRlciBpdCBoYXMgZXhwaXJlZFxuICAgKlxuICAgKiBAcmV0dXJuIHtsYXllci5Db250ZW50fVxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIG9wdGlvbnMgPSB7IGlkOiBvcHRpb25zIH07XG4gICAgfVxuICAgIHN1cGVyKG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIExvYWRzIHRoZSBkYXRhIGZyb20gZ29vZ2xlJ3MgY2xvdWQgc3RvcmFnZS5cbiAgICpcbiAgICogRGF0YSBpcyBwcm92aWRlZCB2aWEgY2FsbGJhY2suXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0eXBpY2FsbHkgb25lIHNob3VsZCB1c2UgbGF5ZXIuTWVzc2FnZVBhcnQuZmV0Y2hDb250ZW50KCkgcmF0aGVyIHRoYW4gbGF5ZXIuQ29udGVudC5sb2FkQ29udGVudCgpXG4gICAqXG4gICAqIEBtZXRob2QgbG9hZENvbnRlbnRcbiAgICogQHBhcmFtIHtzdHJpbmd9IG1pbWVUeXBlIC0gTWltZSB0eXBlIGZvciB0aGUgQmxvYlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0ge0Jsb2J9IGNhbGxiYWNrLmRhdGEgLSBBIEJsb2IgaW5zdGFuY2UgcmVwcmVzZW50aW5nIHRoZSBkYXRhIGRvd25sb2FkZWQuICBJZiBCbG9iIG9iamVjdCBpcyBub3QgYXZhaWxhYmxlLCB0aGVuIG1heSB1c2Ugb3RoZXIgZm9ybWF0LlxuICAgKi9cbiAgbG9hZENvbnRlbnQobWltZVR5cGUsIGNhbGxiYWNrKSB7XG4gICAgeGhyKHtcbiAgICAgIHVybDogdGhpcy5kb3dubG9hZFVybCxcbiAgICAgIHJlc3BvbnNlVHlwZTogJ2FycmF5YnVmZmVyJyxcbiAgICB9LCByZXN1bHQgPT4ge1xuICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgIGlmICh0eXBlb2YgQmxvYiAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICBjb25zdCBibG9iID0gbmV3IEJsb2IoW3Jlc3VsdC5kYXRhXSwgeyB0eXBlOiBtaW1lVHlwZSB9KTtcbiAgICAgICAgICBjYWxsYmFjayhudWxsLCBibG9iKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBJZiB0aGUgYmxvYiBjbGFzcyBpc24ndCBkZWZpbmVkIChub2RlanMpIHRoZW4ganVzdCByZXR1cm4gdGhlIHJlc3VsdCBhcyBpc1xuICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdC5kYXRhKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2FsbGJhY2socmVzdWx0LmRhdGEsIG51bGwpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZnJlc2hlcyB0aGUgVVJMLCB3aGljaCB1cGRhdGVzIHRoZSBVUkwgYW5kIHJlc2V0cyB0aGUgZXhwaXJhdGlvbiB0aW1lIGZvciB0aGUgVVJMXG4gICAqXG4gICAqIEBtZXRob2QgcmVmcmVzaENvbnRlbnRcbiAgICogQHBhcmFtIHtsYXllci5DbGllbnR9IGNsaWVudFxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdXG4gICAqL1xuICByZWZyZXNoQ29udGVudChjbGllbnQsIGNhbGxiYWNrKSB7XG4gICAgY2xpZW50Lnhocih7XG4gICAgICB1cmw6IHRoaXMucmVmcmVzaFVybCxcbiAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICBzeW5jOiBmYWxzZSxcbiAgICB9LCByZXN1bHQgPT4ge1xuICAgICAgY29uc3QgeyBkYXRhIH0gPSByZXN1bHQ7XG4gICAgICB0aGlzLmV4cGlyYXRpb24gPSBuZXcgRGF0ZShkYXRhLmV4cGlyYXRpb24pO1xuICAgICAgdGhpcy5kb3dubG9hZFVybCA9IGRhdGEuZG93bmxvYWRfdXJsO1xuICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayh0aGlzLmRvd25sb2FkVXJsKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJcyB0aGUgZG93bmxvYWQgdXJsIGV4cGlyZWQgb3IgYWJvdXQgdG8gZXhwaXJlP1xuICAgKiBXZSBjYW4ndCBiZSBzdXJlIG9mIHRoZSBzdGF0ZSBvZiB0aGUgZGV2aWNlJ3MgaW50ZXJuYWwgY2xvY2ssXG4gICAqIHNvIGlmIGl0cyB3aXRoaW4gMTAgbWludXRlcyBvZiBleHBpcmluZywganVzdCB0cmVhdCBpdCBhcyBleHBpcmVkLlxuICAgKlxuICAgKiBAbWV0aG9kIGlzRXhwaXJlZFxuICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAgICovXG4gIGlzRXhwaXJlZCgpIHtcbiAgICBjb25zdCBleHBpcmF0aW9uTGVld2F5ID0gMTAgKiA2MCAqIDEwMDA7XG4gICAgcmV0dXJuICh0aGlzLmV4cGlyYXRpb24uZ2V0VGltZSgpIC0gZXhwaXJhdGlvbkxlZXdheSA8IERhdGUubm93KCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBNZXNzYWdlUGFydCBmcm9tIGEgc2VydmVyIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBwYXJ0XG4gICAqXG4gICAqIEBtZXRob2QgX2NyZWF0ZUZyb21TZXJ2ZXJcbiAgICogQHByaXZhdGVcbiAgICogQHN0YXRpY1xuICAgKiBAcGFyYW0gIHtPYmplY3R9IHBhcnQgLSBTZXJ2ZXIgcmVwcmVzZW50YXRpb24gb2YgYSBwYXJ0XG4gICAqL1xuICBzdGF0aWMgX2NyZWF0ZUZyb21TZXJ2ZXIocGFydCkge1xuICAgIHJldHVybiBuZXcgQ29udGVudCh7XG4gICAgICBpZDogcGFydC5pZCxcbiAgICAgIGRvd25sb2FkVXJsOiBwYXJ0LmRvd25sb2FkX3VybCxcbiAgICAgIGV4cGlyYXRpb246IG5ldyBEYXRlKHBhcnQuZXhwaXJhdGlvbiksXG4gICAgICByZWZyZXNoVXJsOiBwYXJ0LnJlZnJlc2hfdXJsLFxuICAgIH0pO1xuICB9XG59XG5cbi8qKlxuICogU2VydmVyIGdlbmVyYXRlZCBpZGVudGlmaWVyXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5Db250ZW50LnByb3RvdHlwZS5pZCA9ICcnO1xuXG5Db250ZW50LnByb3RvdHlwZS5ibG9iID0gbnVsbDtcblxuLyoqXG4gKiBTZXJ2ZXIgZ2VuZXJhdGVkIHVybCBmb3IgZG93bmxvYWRpbmcgdGhlIGNvbnRlbnRcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbkNvbnRlbnQucHJvdG90eXBlLmRvd25sb2FkVXJsID0gJyc7XG5cbi8qKlxuICogVXJsIGZvciByZWZyZXNoaW5nIHRoZSBkb3dubG9hZFVybCBhZnRlciBpdCBoYXMgZXhwaXJlZFxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuQ29udGVudC5wcm90b3R5cGUucmVmcmVzaFVybCA9ICcnO1xuXG4vKipcbiAqIFNpemUgb2YgdGhlIGNvbnRlbnQuXG4gKlxuICogVGhpcyBwcm9wZXJ0eSBvbmx5IGhhcyBhIHZhbHVlIHdoZW4gaW4gdGhlIHByb2Nlc3NcbiAqIG9mIENyZWF0aW5nIHRoZSByaWNoIGNvbnRlbnQgYW5kIHNlbmRpbmcgdGhlIE1lc3NhZ2UuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuQ29udGVudC5wcm90b3R5cGUuc2l6ZSA9IDA7XG5cbi8qKlxuICogRXhwaXJhdGlvbiBkYXRlIGZvciB0aGUgZG93bmxvYWRVcmxcbiAqIEB0eXBlIHtEYXRlfVxuICovXG5Db250ZW50LnByb3RvdHlwZS5leHBpcmF0aW9uID0gbnVsbDtcblxuUm9vdC5pbml0Q2xhc3MuYXBwbHkoQ29udGVudCwgW0NvbnRlbnQsICdDb250ZW50J10pO1xubW9kdWxlLmV4cG9ydHMgPSBDb250ZW50O1xuIl19
