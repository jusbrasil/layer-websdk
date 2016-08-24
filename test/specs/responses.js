/* eslint-disable no-undef */
var messageTemplate = {
    "id": "layer:///messages/940de862-3c96-11e4-baad-164230d1df67",
    "url": "https://doh.com/messages/940de862-3c96-11e4-baad-164230d1df67",
    "position": 15032697020,
    "conversation": {
        "id": "layer:///conversations/f3cc7b32-3c92-11e4-baad-164230d1df67",
        "url": "https://doh.com/conversations/f3cc7b32-3c92-11e4-baad-164230d1df67"
    },
    "parts": [
        {
            "id": "layer:///messages/940de862-3c96-11e4-baad-164230d1df67/parts/0",
            "mime_type": "text/plain",
            "body": "This is the message.",
            "size": 20
        },
        {
            "id": "layer:///messages/940de862-3c96-11e4-baad-164230d1df67/parts/1",
            "mime_type": "image/png",
            "content": {
                download_url: "https://storage.googleapis.com/content-prod1/9ec30af8-5591-11e4-af9e-f7a201004a3b/9326d2b7-e34a-4659-a1d9-656290e7a346/ade53880-e00f-11e5-b2ae-0242ac110090?GoogleAccessId=562313368749-gcg5vvavqprdhpnp8udipdnablc4o3hp@developer.gserviceaccount.com&Expires=1456882972&Signature=R3mnrP9OC4uCgKcZf62afC%2BTS1oLLdBs6BC0rTZc2sK8ohaczs9qkzd55xK%2BKaqSc%2FDW%2FNmXDJJs4aM0Pl3BfEI8G7ds%2BkQ3%2F4Bo6kcKavcdVVIO1cEsnI2m4JCPicQUflAlFM7H1wYbLqN%2B3dug0eL1QOin5uDqmnNbDXqKt1w%3D",
                expiration: "2016-03-02T01:42:52.290Z",
                id: "layer:///content/ade53880-e00f-11e5-b2ae-0242ac110090",
                refresh_url: "https://api.layer.com/content/ade53880-e00f-11e5-b2ae-0242ac110090",
                size: 95602,
                upload_url: null
            }
        }
    ],
    "sent_at": "2014-09-09T04:44:47+00:00",
    "sender": {
        "user_id": "12345",
        "display_name": "One through Five",
    },
    "is_unread": true,
    "recipient_status": {
        "777": "sent",
        "999": "read",
        "111": "delivered"
    }
};
var sampleMessage1 = JSON.parse(JSON.stringify(messageTemplate));
var sampleMessage2 = JSON.parse(JSON.stringify(messageTemplate));
var sampleMessage3 = JSON.parse(JSON.stringify(messageTemplate));
sampleMessage2.id += "2";
sampleMessage2.parts.forEach(function(part) {part.id = part.id.replace(/\/parts/, "2/parts")});
sampleMessage3.id += "3";
sampleMessage3.parts.forEach(function(part) {part.id = part.id.replace(/\/parts/, "3/parts")});

sampleMessage2.parts[0].body += "2";
sampleMessage3.parts[0].body += "3";
sampleMessage2.recipient_status["777"] = "delivered";
sampleMessage3.recipient_status["777"] = "read";
responses = {
    error1: {
        "message": "Body cannot be blank.",
        "data": {
            "property": "body"
        },
        "type": "missing",
        "code": 401,
        "id": "you-are-frelled",
        "url": "https://doh.com"
    },

    conversation1: {
        "id": "layer:///conversations/f3cc7b32-3c92-11e4-baad-164230d1df67",
        "url": "https://doh.com/conversations/f3cc7b32-3c92-11e4-baad-164230d1df67",
        "created_at": "2014-09-15T04:44:47+00:00",
        "last_message": sampleMessage1,
        "participants": ["1234", "5678"],
        "distinct": true,
        "unread_message_count": 3,
        "metadata": {
            "favorite": "true",
            "background_color": "#3c3c3c"
        }
    },
    conversation2: {
        "id": "layer:///conversations/f3cc7b32-3c92-11e4-baad-164230d1df68",
        "url": "https://doh.com/conversations/f3cc7b32-3c92-11e4-baad-164230d1df68",
        "created_at": "2014-09-15T04:44:47+00:00",
        "last_message": sampleMessage2,
        "participants": ["777", "999", "111"],
        "distinct": true,
        "unread_message_count": 3,
        "metadata": {
            "favorite": "true",
            "background_color": "#3c3c3c"
        }
    },
    message1: sampleMessage2,
    message2: sampleMessage3,
    announcement: {
       "id": "layer:///announcements/b40de862-3c96-11e4-baad-164230d1df67",
      "url": "https://doh.com/announcements/b40de862-3c96-11e4-baad-164230d1df67",
      "position": 15032697020,
      "parts": [
          {
              "id": "layer:///announcements/b40de862-3c96-11e4-baad-164230d1df67/parts/0",
              "mime_type": "text/plain",
              "body": "This is the message.",
              "size": 20
          }
      ],
      "sent_at": "2014-09-09T04:44:47+00:00",
      "sender": {
        "user_id": "admin",
        "display_name": "Lord Master the Admin",
      },
      "is_unread": true,
      "recipient_status": {
          "777": "sent"
      }
    }
};

var mostRecentEqualityTest =  function(a, b) {
    if (a && a.constructor.toString().match(/FakeXMLHttpRequest\(\)/)) {
        if (a.url != b.url) {
            debugger;
            return false;
        }
        if (b.data && a.params != JSON.stringify(b.data)) {
            debugger;
            return false;
        }
        var ha = JSON.parse(JSON.stringify(a.requestHeaders));
        var hb = b.headers || b.requestHeaders;
        if (!hb.accept) delete ha.accept;
        if (hb && !compareObj(ha, hb)) {
            debugger;
            return false;
        }
        if (b.method && a.method != b.method) {
            debugger;
            return false;
        }
        return true;
    }
};

var compareObj = function(a, b) {
    var aKeys = Object.keys(a).sort();
    var bKeys = Object.keys(b).sort();
    if (aKeys.join(",") != bKeys.join(",")) return false;
    var aObj = {}, bObj = {};
    aKeys.forEach(function(k) { aObj[k] = a[k];});
    bKeys.forEach(function(k) { bObj[k] = b[k];});
    return JSON.stringify(aObj) == JSON.stringify(bObj);
}

var responseTest =  function(a, b) {
        if (a instanceof layer.LayerError && b instanceof layer.LayerError) {
            if (a.code != b.code) {
                debugger;
                return false;
            }
            if (a.httpStatus != b.httpStatus) {
                debugger;
                return false;
            }
            if (a.errType != b.errType) {
                debugger;
                return false;
            }
            if (b.message instanceof RegExp) {
                if (!b.message.test(a.message)) {
                    debugger;
                    return false;
                }
            } else if (b.message) {
                if (a.message != b.message) {
                    debugger;
                    return false;
                }
            } else {
                if (!a.message) {
                    debugger;
                    return false;
                }
            }
            if (b.url instanceof RegExp) {
                if (!b.url.test(a.url)) {
                    debugger;
                    return false;
                }
            } else if (b.url) {
                if (a.url != b.url) {
                    debugger;
                    return false;
                }
            } else {
                if (!a.url.match(/http\:\/\/.+/)) {
                    debugger;
                    return false;
                }
            }
            if (b.data && JSON.stringify(a.data) != JSON.stringify(b.data)) {
                debugger;
                return false;
            }

            return true;
        }
};