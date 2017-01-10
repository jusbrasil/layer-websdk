'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

/**
 * Basic XHR Library with some notions hardcoded in
 * of what the Layer server expects/returns.
 *
    layer.xhr({
      url: 'http://my.com/mydata',
      data: {hey: 'ho', there: 'folk'},
      method: 'GET',
      format: 'json',
      headers: {'fred': 'Joe'},
      timeout: 50000
    }, function(result) {
      if (!result.success) {
        errorHandler(result.data, result.headers, result.status);
      } else {
        successHandler(result.data, result.headers, result.xhr);
      }
    });
 *
 * @class layer.xhr
 * @private
 */

/**
 * Send a Request.
 *
 * @method  xhr
 * @param {Object} options
 * @param {string} options.url
 * @param {Mixed} [options.data=null]
 * @param {string} [options.format=''] - set to 'json' to get result parsed as json (in case there is no obvious Content-Type in the response)
 * @param {Object} [options.headers={}] - Name value pairs for  headers and their values
 * @param {number} [options.timeout=0] - When does the request expire/timeout in miliseconds.
 * @param {Function} callback
 * @param {Object} callback.result
 * @param {number} callback.result.status - http status code
 * @param {boolean} callback.result.success - true if it was a successful response
 * @param {XMLHttpRequest} callback.result.xhr - The XHR object used for the request
 * @param {Object} callback.result.data -  The parsed response body
 *
 * TODO:
 *
 * 1. Make this a subclass of Root and make it a singleton so it can inherit a proper event system
 * 2. Result should be a layer.ServerResponse instance
 * 3. Should only access link headers if requested; annoying having it throw errors every other time.
 */

// Don't set xhr to window.XMLHttpRequest as it will bypass jasmine's
// ajax library
var Xhr = typeof window === 'undefined' ? require('xhr2') : null;

function parseLinkHeaders(linkHeader) {
  if (!linkHeader) return {};

  // Split parts by comma
  var parts = linkHeader.split(',');
  var links = {};

  // Parse each part into a named link
  parts.forEach(function (part) {
    var section = part.split(';');
    if (section.length !== 2) return;
    var url = section[0].replace(/<(.*)>/, '$1').trim();
    var name = section[1].replace(/rel='?(.*)'?/, '$1').trim();
    links[name] = url;
  });

  return links;
}

module.exports = function (request, callback) {
  var req = Xhr ? new Xhr() : new XMLHttpRequest();
  var method = (request.method || 'GET').toUpperCase();

  var onload = function onload() {
    var headers = {
      'content-type': this.getResponseHeader('content-type')
    };

    var result = {
      status: this.status,
      success: this.status && this.status < 300,
      xhr: this
    };
    var isJSON = String(headers['content-type']).split(/;/)[0].match(/^application\/json/) || request.format === 'json';

    if (this.responseType === 'blob' || this.responseType === 'arraybuffer') {
      if (this.status === 0) {
        result.data = new Error('Connection Failed');
      } else {
        // Damnit, this.response is a function if using jasmine test framework.
        result.data = typeof this.response === 'function' ? this.responseText : this.response;
      }
    } else {
      if (isJSON && this.responseText) {
        try {
          result.data = JSON.parse(this.responseText);
        } catch (err) {
          result.data = {
            code: 999,
            message: 'Invalid JSON from server',
            response: this.responseText
          };
          result.status = 999;
        }
      } else {
        result.data = this.responseText;
      }

      module.exports.trigger({
        target: this,
        status: !this.responseText && !this.status ? 'connection:error' : 'connection:success'
      });

      if (!this.responseText && !this.status) {
        result.status = 408;
        result.data = {
          id: 'request_timeout',
          message: 'The server is not responding please try again in a few minutes',
          url: 'https://docs.layer.com/reference/client_api/errors',
          code: 0,
          status: 408,
          httpStatus: 408
        };
      } else if (this.status === 404 && _typeof(result.data) !== 'object') {
        result.data = {
          id: 'operation_not_found',
          message: 'Endpoint ' + (request.method || 'GET') + ' ' + request.url + ' does not exist',
          status: this.status,
          httpStatus: 404,
          code: 106,
          url: 'https://docs.layer.com/reference/client_api/errors'
        };
      } else if (typeof result.data === 'string' && this.status >= 400) {
        result.data = {
          id: 'unknown_error',
          message: result.data,
          status: this.status,
          httpStatus: this.status,
          code: 0,
          url: 'https://www.google.com/search?q=doh!'
        };
      }
    }

    if (request.headers && (request.headers.accept || '').match(/application\/vnd.layer\+json/)) {
      var links = this.getResponseHeader('link');
      if (links) result.Links = parseLinkHeaders(links);
    }
    result.xhr = this;

    if (callback) callback(result);
  };

  req.onload = onload;

  // UNTESTED!!!
  req.onerror = req.ontimeout = onload;

  // Replace all headers in arbitrary case with all lower case
  // for easy matching.
  var headersList = Object.keys(request.headers || {});
  var headers = {};
  headersList.forEach(function (header) {
    if (header.toLowerCase() === 'content-type') {
      headers['content-type'] = request.headers[header];
    } else {
      headers[header.toLowerCase()] = request.headers[header];
    }
  });
  request.headers = headers;

  var data = '';
  if (request.data) {
    if (typeof Blob !== 'undefined' && request.data instanceof Blob) {
      data = request.data;
    } else if (request.headers && (String(request.headers['content-type']).match(/^application\/json/) || String(request.headers['content-type']) === 'application/vnd.layer-patch+json')) {
      data = typeof request.data === 'string' ? request.data : JSON.stringify(request.data);
    } else if (request.data && _typeof(request.data) === 'object') {
      Object.keys(request.data).forEach(function (name) {
        if (data) data += '&';
        data += name + '=' + request.data[name];
      });
    } else {
      data = request.data; // Some form of raw string/data
    }
  }
  if (data) {
    if (method === 'GET') {
      request.url += '?' + data;
    }
  }

  req.open(method, request.url, true);
  if (request.timeout) req.timeout = request.timeout;
  if (request.withCredentials) req.withCredentials = true;
  if (request.responseType) req.responseType = request.responseType;

  if (request.headers) {
    Object.keys(request.headers).forEach(function (headerName) {
      return req.setRequestHeader(headerName, request.headers[headerName]);
    });
  }

  try {
    if (method === 'GET') {
      req.send();
    } else {
      req.send(data);
    }
  } catch (e) {
    // do nothing
  }
};

var listeners = [];
module.exports.addConnectionListener = function (func) {
  return listeners.push(func);
};

module.exports.trigger = function (evt) {
  listeners.forEach(function (func) {
    func(evt);
  });
};
//# sourceMappingURL=data:application/json;base64,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bEI7QUFDQSxPQUFPLE9BQVAsQ0FBZSxxQkFBZixHQUF1QztBQUFBLFNBQVEsVUFBVSxJQUFWLENBQWUsSUFBZixDQUFSO0FBQUEsQ0FBdkM7O0FBRUEsT0FBTyxPQUFQLENBQWUsT0FBZixHQUF5QixVQUFDLEdBQUQsRUFBUztBQUNoQyxZQUFVLE9BQVYsQ0FBa0IsZ0JBQVE7QUFDeEIsU0FBSyxHQUFMO0FBQ0QsR0FGRDtBQUdELENBSkQiLCJmaWxlIjoieGhyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBCYXNpYyBYSFIgTGlicmFyeSB3aXRoIHNvbWUgbm90aW9ucyBoYXJkY29kZWQgaW5cbiAqIG9mIHdoYXQgdGhlIExheWVyIHNlcnZlciBleHBlY3RzL3JldHVybnMuXG4gKlxuICAgIGxheWVyLnhocih7XG4gICAgICB1cmw6ICdodHRwOi8vbXkuY29tL215ZGF0YScsXG4gICAgICBkYXRhOiB7aGV5OiAnaG8nLCB0aGVyZTogJ2ZvbGsnfSxcbiAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICBmb3JtYXQ6ICdqc29uJyxcbiAgICAgIGhlYWRlcnM6IHsnZnJlZCc6ICdKb2UnfSxcbiAgICAgIHRpbWVvdXQ6IDUwMDAwXG4gICAgfSwgZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgIGVycm9ySGFuZGxlcihyZXN1bHQuZGF0YSwgcmVzdWx0LmhlYWRlcnMsIHJlc3VsdC5zdGF0dXMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3VjY2Vzc0hhbmRsZXIocmVzdWx0LmRhdGEsIHJlc3VsdC5oZWFkZXJzLCByZXN1bHQueGhyKTtcbiAgICAgIH1cbiAgICB9KTtcbiAqXG4gKiBAY2xhc3MgbGF5ZXIueGhyXG4gKiBAcHJpdmF0ZVxuICovXG5cbi8qKlxuICogU2VuZCBhIFJlcXVlc3QuXG4gKlxuICogQG1ldGhvZCAgeGhyXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHBhcmFtIHtzdHJpbmd9IG9wdGlvbnMudXJsXG4gKiBAcGFyYW0ge01peGVkfSBbb3B0aW9ucy5kYXRhPW51bGxdXG4gKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuZm9ybWF0PScnXSAtIHNldCB0byAnanNvbicgdG8gZ2V0IHJlc3VsdCBwYXJzZWQgYXMganNvbiAoaW4gY2FzZSB0aGVyZSBpcyBubyBvYnZpb3VzIENvbnRlbnQtVHlwZSBpbiB0aGUgcmVzcG9uc2UpXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMuaGVhZGVycz17fV0gLSBOYW1lIHZhbHVlIHBhaXJzIGZvciAgaGVhZGVycyBhbmQgdGhlaXIgdmFsdWVzXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMudGltZW91dD0wXSAtIFdoZW4gZG9lcyB0aGUgcmVxdWVzdCBleHBpcmUvdGltZW91dCBpbiBtaWxpc2Vjb25kcy5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKiBAcGFyYW0ge09iamVjdH0gY2FsbGJhY2sucmVzdWx0XG4gKiBAcGFyYW0ge251bWJlcn0gY2FsbGJhY2sucmVzdWx0LnN0YXR1cyAtIGh0dHAgc3RhdHVzIGNvZGVcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gY2FsbGJhY2sucmVzdWx0LnN1Y2Nlc3MgLSB0cnVlIGlmIGl0IHdhcyBhIHN1Y2Nlc3NmdWwgcmVzcG9uc2VcbiAqIEBwYXJhbSB7WE1MSHR0cFJlcXVlc3R9IGNhbGxiYWNrLnJlc3VsdC54aHIgLSBUaGUgWEhSIG9iamVjdCB1c2VkIGZvciB0aGUgcmVxdWVzdFxuICogQHBhcmFtIHtPYmplY3R9IGNhbGxiYWNrLnJlc3VsdC5kYXRhIC0gIFRoZSBwYXJzZWQgcmVzcG9uc2UgYm9keVxuICpcbiAqIFRPRE86XG4gKlxuICogMS4gTWFrZSB0aGlzIGEgc3ViY2xhc3Mgb2YgUm9vdCBhbmQgbWFrZSBpdCBhIHNpbmdsZXRvbiBzbyBpdCBjYW4gaW5oZXJpdCBhIHByb3BlciBldmVudCBzeXN0ZW1cbiAqIDIuIFJlc3VsdCBzaG91bGQgYmUgYSBsYXllci5TZXJ2ZXJSZXNwb25zZSBpbnN0YW5jZVxuICogMy4gU2hvdWxkIG9ubHkgYWNjZXNzIGxpbmsgaGVhZGVycyBpZiByZXF1ZXN0ZWQ7IGFubm95aW5nIGhhdmluZyBpdCB0aHJvdyBlcnJvcnMgZXZlcnkgb3RoZXIgdGltZS5cbiAqL1xuXG4vLyBEb24ndCBzZXQgeGhyIHRvIHdpbmRvdy5YTUxIdHRwUmVxdWVzdCBhcyBpdCB3aWxsIGJ5cGFzcyBqYXNtaW5lJ3Ncbi8vIGFqYXggbGlicmFyeVxuY29uc3QgWGhyID0gKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSA/IHJlcXVpcmUoJ3hocjInKSA6IG51bGw7XG5cbmZ1bmN0aW9uIHBhcnNlTGlua0hlYWRlcnMobGlua0hlYWRlcikge1xuICBpZiAoIWxpbmtIZWFkZXIpIHJldHVybiB7fTtcblxuICAvLyBTcGxpdCBwYXJ0cyBieSBjb21tYVxuICBjb25zdCBwYXJ0cyA9IGxpbmtIZWFkZXIuc3BsaXQoJywnKTtcbiAgY29uc3QgbGlua3MgPSB7fTtcblxuICAvLyBQYXJzZSBlYWNoIHBhcnQgaW50byBhIG5hbWVkIGxpbmtcbiAgcGFydHMuZm9yRWFjaChwYXJ0ID0+IHtcbiAgICBjb25zdCBzZWN0aW9uID0gcGFydC5zcGxpdCgnOycpO1xuICAgIGlmIChzZWN0aW9uLmxlbmd0aCAhPT0gMikgcmV0dXJuO1xuICAgIGNvbnN0IHVybCA9IHNlY3Rpb25bMF0ucmVwbGFjZSgvPCguKik+LywgJyQxJykudHJpbSgpO1xuICAgIGNvbnN0IG5hbWUgPSBzZWN0aW9uWzFdLnJlcGxhY2UoL3JlbD0nPyguKiknPy8sICckMScpLnRyaW0oKTtcbiAgICBsaW5rc1tuYW1lXSA9IHVybDtcbiAgfSk7XG5cbiAgcmV0dXJuIGxpbmtzO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IChyZXF1ZXN0LCBjYWxsYmFjaykgPT4ge1xuICBjb25zdCByZXEgPSBYaHIgPyBuZXcgWGhyKCkgOiBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgY29uc3QgbWV0aG9kID0gKHJlcXVlc3QubWV0aG9kIHx8ICdHRVQnKS50b1VwcGVyQ2FzZSgpO1xuXG4gIGNvbnN0IG9ubG9hZCA9IGZ1bmN0aW9uIG9ubG9hZCgpIHtcbiAgICBjb25zdCBoZWFkZXJzID0ge1xuICAgICAgJ2NvbnRlbnQtdHlwZSc6IHRoaXMuZ2V0UmVzcG9uc2VIZWFkZXIoJ2NvbnRlbnQtdHlwZScpLFxuICAgIH07XG5cbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBzdGF0dXM6IHRoaXMuc3RhdHVzLFxuICAgICAgc3VjY2VzczogdGhpcy5zdGF0dXMgJiYgdGhpcy5zdGF0dXMgPCAzMDAsXG4gICAgICB4aHI6IHRoaXMsXG4gICAgfTtcbiAgICBjb25zdCBpc0pTT04gPSAoU3RyaW5nKGhlYWRlcnNbJ2NvbnRlbnQtdHlwZSddKS5zcGxpdCgvOy8pWzBdLm1hdGNoKC9eYXBwbGljYXRpb25cXC9qc29uLykgfHxcbiAgICAgICAgICAgcmVxdWVzdC5mb3JtYXQgPT09ICdqc29uJyk7XG5cbiAgICBpZiAodGhpcy5yZXNwb25zZVR5cGUgPT09ICdibG9iJyB8fCB0aGlzLnJlc3BvbnNlVHlwZSA9PT0gJ2FycmF5YnVmZmVyJykge1xuICAgICAgaWYgKHRoaXMuc3RhdHVzID09PSAwKSB7XG4gICAgICAgIHJlc3VsdC5kYXRhID0gbmV3IEVycm9yKCdDb25uZWN0aW9uIEZhaWxlZCcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRGFtbml0LCB0aGlzLnJlc3BvbnNlIGlzIGEgZnVuY3Rpb24gaWYgdXNpbmcgamFzbWluZSB0ZXN0IGZyYW1ld29yay5cbiAgICAgICAgcmVzdWx0LmRhdGEgPSB0eXBlb2YgdGhpcy5yZXNwb25zZSA9PT0gJ2Z1bmN0aW9uJyA/IHRoaXMucmVzcG9uc2VUZXh0IDogdGhpcy5yZXNwb25zZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGlzSlNPTiAmJiB0aGlzLnJlc3BvbnNlVGV4dCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHJlc3VsdC5kYXRhID0gSlNPTi5wYXJzZSh0aGlzLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIHJlc3VsdC5kYXRhID0ge1xuICAgICAgICAgICAgY29kZTogOTk5LFxuICAgICAgICAgICAgbWVzc2FnZTogJ0ludmFsaWQgSlNPTiBmcm9tIHNlcnZlcicsXG4gICAgICAgICAgICByZXNwb25zZTogdGhpcy5yZXNwb25zZVRleHQsXG4gICAgICAgICAgfTtcbiAgICAgICAgICByZXN1bHQuc3RhdHVzID0gOTk5O1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQuZGF0YSA9IHRoaXMucmVzcG9uc2VUZXh0O1xuICAgICAgfVxuXG5cbiAgICAgIG1vZHVsZS5leHBvcnRzLnRyaWdnZXIoe1xuICAgICAgICB0YXJnZXQ6IHRoaXMsXG4gICAgICAgIHN0YXR1czogIXRoaXMucmVzcG9uc2VUZXh0ICYmICF0aGlzLnN0YXR1cyA/ICdjb25uZWN0aW9uOmVycm9yJyA6ICdjb25uZWN0aW9uOnN1Y2Nlc3MnLFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghdGhpcy5yZXNwb25zZVRleHQgJiYgIXRoaXMuc3RhdHVzKSB7XG4gICAgICAgIHJlc3VsdC5zdGF0dXMgPSA0MDg7XG4gICAgICAgIHJlc3VsdC5kYXRhID0ge1xuICAgICAgICAgIGlkOiAncmVxdWVzdF90aW1lb3V0JyxcbiAgICAgICAgICBtZXNzYWdlOiAnVGhlIHNlcnZlciBpcyBub3QgcmVzcG9uZGluZyBwbGVhc2UgdHJ5IGFnYWluIGluIGEgZmV3IG1pbnV0ZXMnLFxuICAgICAgICAgIHVybDogJ2h0dHBzOi8vZG9jcy5sYXllci5jb20vcmVmZXJlbmNlL2NsaWVudF9hcGkvZXJyb3JzJyxcbiAgICAgICAgICBjb2RlOiAwLFxuICAgICAgICAgIHN0YXR1czogNDA4LFxuICAgICAgICAgIGh0dHBTdGF0dXM6IDQwOCxcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5zdGF0dXMgPT09IDQwNCAmJiB0eXBlb2YgcmVzdWx0LmRhdGEgIT09ICdvYmplY3QnKSB7XG4gICAgICAgIHJlc3VsdC5kYXRhID0ge1xuICAgICAgICAgIGlkOiAnb3BlcmF0aW9uX25vdF9mb3VuZCcsXG4gICAgICAgICAgbWVzc2FnZTogJ0VuZHBvaW50ICcgKyAocmVxdWVzdC5tZXRob2QgfHwgJ0dFVCcpICsgJyAnICsgcmVxdWVzdC51cmwgKyAnIGRvZXMgbm90IGV4aXN0JyxcbiAgICAgICAgICBzdGF0dXM6IHRoaXMuc3RhdHVzLFxuICAgICAgICAgIGh0dHBTdGF0dXM6IDQwNCxcbiAgICAgICAgICBjb2RlOiAxMDYsXG4gICAgICAgICAgdXJsOiAnaHR0cHM6Ly9kb2NzLmxheWVyLmNvbS9yZWZlcmVuY2UvY2xpZW50X2FwaS9lcnJvcnMnLFxuICAgICAgICB9O1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgcmVzdWx0LmRhdGEgPT09ICdzdHJpbmcnICYmIHRoaXMuc3RhdHVzID49IDQwMCkge1xuICAgICAgICByZXN1bHQuZGF0YSA9IHtcbiAgICAgICAgICBpZDogJ3Vua25vd25fZXJyb3InLFxuICAgICAgICAgIG1lc3NhZ2U6IHJlc3VsdC5kYXRhLFxuICAgICAgICAgIHN0YXR1czogdGhpcy5zdGF0dXMsXG4gICAgICAgICAgaHR0cFN0YXR1czogdGhpcy5zdGF0dXMsXG4gICAgICAgICAgY29kZTogMCxcbiAgICAgICAgICB1cmw6ICdodHRwczovL3d3dy5nb29nbGUuY29tL3NlYXJjaD9xPWRvaCEnLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChyZXF1ZXN0LmhlYWRlcnMgJiYgKHJlcXVlc3QuaGVhZGVycy5hY2NlcHQgfHwgJycpLm1hdGNoKC9hcHBsaWNhdGlvblxcL3ZuZC5sYXllclxcK2pzb24vKSkge1xuICAgICAgY29uc3QgbGlua3MgPSB0aGlzLmdldFJlc3BvbnNlSGVhZGVyKCdsaW5rJyk7XG4gICAgICBpZiAobGlua3MpIHJlc3VsdC5MaW5rcyA9IHBhcnNlTGlua0hlYWRlcnMobGlua3MpO1xuICAgIH1cbiAgICByZXN1bHQueGhyID0gdGhpcztcblxuICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2socmVzdWx0KTtcbiAgfTtcblxuICByZXEub25sb2FkID0gb25sb2FkO1xuXG4gIC8vIFVOVEVTVEVEISEhXG4gIHJlcS5vbmVycm9yID0gcmVxLm9udGltZW91dCA9IG9ubG9hZDtcblxuICAvLyBSZXBsYWNlIGFsbCBoZWFkZXJzIGluIGFyYml0cmFyeSBjYXNlIHdpdGggYWxsIGxvd2VyIGNhc2VcbiAgLy8gZm9yIGVhc3kgbWF0Y2hpbmcuXG4gIGNvbnN0IGhlYWRlcnNMaXN0ID0gT2JqZWN0LmtleXMocmVxdWVzdC5oZWFkZXJzIHx8IHt9KTtcbiAgY29uc3QgaGVhZGVycyA9IHt9O1xuICBoZWFkZXJzTGlzdC5mb3JFYWNoKGhlYWRlciA9PiB7XG4gICAgaWYgKGhlYWRlci50b0xvd2VyQ2FzZSgpID09PSAnY29udGVudC10eXBlJykge1xuICAgICAgaGVhZGVyc1snY29udGVudC10eXBlJ10gPSByZXF1ZXN0LmhlYWRlcnNbaGVhZGVyXTtcbiAgICB9IGVsc2Uge1xuICAgICAgaGVhZGVyc1toZWFkZXIudG9Mb3dlckNhc2UoKV0gPSByZXF1ZXN0LmhlYWRlcnNbaGVhZGVyXTtcbiAgICB9XG4gIH0pO1xuICByZXF1ZXN0LmhlYWRlcnMgPSBoZWFkZXJzO1xuXG4gIGxldCBkYXRhID0gJyc7XG4gIGlmIChyZXF1ZXN0LmRhdGEpIHtcbiAgICBpZiAodHlwZW9mIEJsb2IgIT09ICd1bmRlZmluZWQnICYmIHJlcXVlc3QuZGF0YSBpbnN0YW5jZW9mIEJsb2IpIHtcbiAgICAgIGRhdGEgPSByZXF1ZXN0LmRhdGE7XG4gICAgfSBlbHNlIGlmIChyZXF1ZXN0LmhlYWRlcnMgJiYgKFxuICAgICAgICBTdHJpbmcocmVxdWVzdC5oZWFkZXJzWydjb250ZW50LXR5cGUnXSkubWF0Y2goL15hcHBsaWNhdGlvblxcL2pzb24vKSB8fFxuICAgICAgICBTdHJpbmcocmVxdWVzdC5oZWFkZXJzWydjb250ZW50LXR5cGUnXSkgPT09ICdhcHBsaWNhdGlvbi92bmQubGF5ZXItcGF0Y2granNvbicpXG4gICAgKSB7XG4gICAgICBkYXRhID0gdHlwZW9mIHJlcXVlc3QuZGF0YSA9PT0gJ3N0cmluZycgPyByZXF1ZXN0LmRhdGEgOiBKU09OLnN0cmluZ2lmeShyZXF1ZXN0LmRhdGEpO1xuICAgIH0gZWxzZSBpZiAocmVxdWVzdC5kYXRhICYmIHR5cGVvZiByZXF1ZXN0LmRhdGEgPT09ICdvYmplY3QnKSB7XG4gICAgICBPYmplY3Qua2V5cyhyZXF1ZXN0LmRhdGEpLmZvckVhY2gobmFtZSA9PiB7XG4gICAgICAgIGlmIChkYXRhKSBkYXRhICs9ICcmJztcbiAgICAgICAgZGF0YSArPSBuYW1lICsgJz0nICsgcmVxdWVzdC5kYXRhW25hbWVdO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRhdGEgPSByZXF1ZXN0LmRhdGE7IC8vIFNvbWUgZm9ybSBvZiByYXcgc3RyaW5nL2RhdGFcbiAgICB9XG4gIH1cbiAgaWYgKGRhdGEpIHtcbiAgICBpZiAobWV0aG9kID09PSAnR0VUJykge1xuICAgICAgcmVxdWVzdC51cmwgKz0gJz8nICsgZGF0YTtcbiAgICB9XG4gIH1cblxuICByZXEub3BlbihtZXRob2QsIHJlcXVlc3QudXJsLCB0cnVlKTtcbiAgaWYgKHJlcXVlc3QudGltZW91dCkgcmVxLnRpbWVvdXQgPSByZXF1ZXN0LnRpbWVvdXQ7XG4gIGlmIChyZXF1ZXN0LndpdGhDcmVkZW50aWFscykgcmVxLndpdGhDcmVkZW50aWFscyA9IHRydWU7XG4gIGlmIChyZXF1ZXN0LnJlc3BvbnNlVHlwZSkgcmVxLnJlc3BvbnNlVHlwZSA9IHJlcXVlc3QucmVzcG9uc2VUeXBlO1xuXG4gIGlmIChyZXF1ZXN0LmhlYWRlcnMpIHtcbiAgICBPYmplY3Qua2V5cyhyZXF1ZXN0LmhlYWRlcnMpLmZvckVhY2goaGVhZGVyTmFtZSA9PiByZXEuc2V0UmVxdWVzdEhlYWRlcihoZWFkZXJOYW1lLCByZXF1ZXN0LmhlYWRlcnNbaGVhZGVyTmFtZV0pKTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgaWYgKG1ldGhvZCA9PT0gJ0dFVCcpIHtcbiAgICAgIHJlcS5zZW5kKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlcS5zZW5kKGRhdGEpO1xuICAgIH1cbiAgfSBjYXRjaCAoZSkge1xuICAgIC8vIGRvIG5vdGhpbmdcbiAgfVxufTtcblxuY29uc3QgbGlzdGVuZXJzID0gW107XG5tb2R1bGUuZXhwb3J0cy5hZGRDb25uZWN0aW9uTGlzdGVuZXIgPSBmdW5jID0+IGxpc3RlbmVycy5wdXNoKGZ1bmMpO1xuXG5tb2R1bGUuZXhwb3J0cy50cmlnZ2VyID0gKGV2dCkgPT4ge1xuICBsaXN0ZW5lcnMuZm9yRWFjaChmdW5jID0+IHtcbiAgICBmdW5jKGV2dCk7XG4gIH0pO1xufTtcbiJdfQ==
