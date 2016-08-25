# Web SDK Change Log

## 1.1.0

#### Breaking Changes

##### 1. Authentication Changes

Previously you could instantiate a layer.Client with a userId and it would automatically authenticate.
This is no longer supported; now you create a layer.Client, and when you are ready, you call `client.connect(userId)`.

```javascript
var client = new layer.Client({
    appId: "layer:///apps/staging/YOUR-APP-ID",
    isTrustedDevice: false
});

client.connect('Frodo-the-Dodo');
```

An optiona also exists to provide a session token that you have obtained yourself:

```
client.connectWithSession('Frodo-the-Dodo', mySessionToken);
```

Neither `sessionToken` nor `userId` are supported in the layer.Client constructor.

Furthermore, note that the `client.login()` method is removed. User `client.connect()` instead.

##### 2. Create Conversation

Previously, the following shorthand was supported:

```javascript
client.createConversation([participant1, participant2, etc...]);
```

This is no longer supported; only the longhand format is supported:

```javascript
client.createConversation({
    participants: [participant1, participant2, etc...]
});
```

##### 3. MessageParts Strings, Blobs and Base64 Encoding

The encoding property has been removed from layer.MessagePart.  If the server tells us that a MessagePart is base64 encoded, it will be turned into a Blob before your application sees it.  Any place your code expected a base64 string will now receive a Blob.

You can control which MIME Types are turned into Strings, and which are turned into Blobs using the new `layer.MessagePart.TextualMimeTypes` static property, which defaults to treating any MIME Type matching `text/*` or `application/json` as string and everything else as a Blob.  The following example adds a new type to be treated as a String:

```javascript
layer.MessagePart.TextualMimeTypes.push('application/location');
```

This change means that when you receive an Image, you no longer need to write code that handles both the case of it being a small enough image to be sent as a base64 encoded `body` string that you have to decode AND the case of it being Rich Content, downloaded, and delivered as a Blob.  Now data is delivered in a consistent manner.

##### 4. layer.Query no longer defaults to a model of Conversation

This was an oversight that has been corrected; if you created a Query with:

```javascript
var conversationQuery = client.createQuery({});
```
You will need to update to:
```javascript
var conversationQuery = client.createQuery({
  model: layer.Query.Conversation
});
```

##### 5. layer.User has been removed

This class was deprecated in `v1.0`.  Now its gone.  `v2.0` will introduce `layer.Identity`.

#### Major new Features

* Announcements
  * Introduces the `layer.Announcement` class
  * You can now Query for Announcements sent to your users
* Persistence (this is still considered experimental and must be explicitly enabled)
  * IndexedDB can store all Conversations, Messages and Announcements if the `layer.Client.isTrustedDevice` property is set to `true`, and `layer.Client.isPersistenceEnabled` is set to `true`.
  * Applications can now run entirely offline, populating `layer.Query` data using IndexedDB databases.
* Deleting Messages and Conversations from my devices, but not from other users devices:
  * In addition to calling `conversation.delete(layer.Constants.DELETION_MODE.ALL)` and `message.delete(layer.Constants.DELETION_MODE.ALL)`, you can now delete Messages and Conversation from your user's devices Only using `layer.Constants.DELETION_MODE.MY_DEVICES`.
  * `layer.Conversation.leave()` can be called to remove yourself as a participant and remove the Conversation from your devices.

#### Minor Changes

* No more `temp_layer:///` IDs, no more ID change events
  * Sending a Message will no longer result in a `messages:change` event that contains a change to the Message ID; the Message ID that is assigned when creating the Message will be accepted by the server.
  * Conversations may still get an ID change event in the case where a Distinct Conversation is created, and a matching Distinct Conversation is found on the server.
* Deduplication
  * If a response is not received to a request to create a Conversation or Message, it will be retried with deduplication support to insure that if it was created before, a duplicate is not created on retry.
* layer.Message
  * `layer.Message.getConversation()` now supports a boolean parameter to load from server if Conversation is not cached.
* layer.Client Authentication Changes
  * Client initialization no longer takes a `userId` parameter, and no longer immediately begins the authentication process
  * Client initialization no longer takes a `sessionToken` parameter
  * `layer.Client.connect` is now called to start authentication
  * `layer.Client.connectWithSession` can also be used to startup the client, if you already have a Session Token.
  * `layer.Client.login` has been removed; see `layer.Client.connect` instead
  * `layer.Client.logout(callback)` now takes a callback so that you can wait for all async activities to complete before navigating away.
* layer.MessagePart has changed in the following ways:
  * The encoding property is removed
  * `MessagePart.body` will always be either a String or a Blob; it will never be base64 encoded.  Base64 encoded data will be transformed to string or Blob before your application receives it.
  * Adds static property `layer.MessagePart.TextualMimeTypes` which stores an array of strings and regular expressions used to test if a MIME Type represents textual data.
  * Any textual MessagePart will have a `body` that is `null` (Rich Content which hasn't been fetched via `part.fetchContent()`) or a String.
  * Any non-textual MessagePart will have a `body` that is `null` (Rich Content which hasn't been fetched via `part.fetchContent()`) or a Blob)
  * Note that these rules apply regardless of whether the MessagePart size is less than or greater than 2KB, and regardless of whether its transmitted
    as base64 data.  This means any renderer has only to test for `null` or a value to handle its content.
* layer.OnlineStateManager: Now starts managing isOnline state as soon as `client.connect()` or `client.connectWithSession()` are called.

#### Bug Fixes

* Caching Fixes
  * Updates Caching to uncache any Messages and Conversations that aren't part of any Query's results 10 minutes (configurable) after websocket event announces their arrival.
  * Removes Conversation.lastMessage from cache once its no longer a query result.
  * Fixes cache cleanup on deleting a Query.

## 1.0.12

* JSDuck fixes

## 1.0.11

* Fixes bug in Query retry when server is syncing
* Adds `server-syncing-state` event to layer.Query to notify app when Query is waiting for more data, and when it is done getting more data.

## 1.0.10

* Destroying a Query now notifies any view using it that its data has been cleared. (WEB-1106)
* Websocket URL can now be customized via client.websocketUrl property

## 1.0.9

* Uses new server side support to retry any Query for Messages on a Conversation that is still syncing,
and is delivering fewer than the requested number of Messages. (WEB-1053)

## 1.0.8

* Disable Query Retry by default

## 1.0.7

* Improves logic around reconnecting websockets to validate that the session is still valid.
* Removes tests for Message `ffffffff....` which were used to validate the session is still valid.

## 1.0.6

* Query will retry when no data is detected in case the server has not yet received data for this user.

## 1.0.5

* Fixes bug in layer.Content.refreshContent where expiration is improperly set
* Fixes bug in layer.Query when `dataType` is layer.Query.ObjectDataType which fails to update data for a `messages:read` event

## 1.0.4

* Fixes parsing of Identity Token to handle URL Encoded strings

## 1.0.3

* Fixes support for Query.dataType == layer.Query.InstanceDataType in handling Message ID change events.

## 1.0.2

* Fixes support for the `sessionToken` in the constructor; broken with the introduction of the `isTrustedDevice` property. This is used as part of the [Alternate Authentication Process](https://developer.layer.com/docs/websdk#the-alternate-authentication-process).


## 1.0.1

* Adds isTrustedDevice property to layer.Client which defaults to false. If this is false, session tokens will NOT be written to localStorage, and will not be restored next time the page reloads.
  * Support for Deletion with either layer.Constants.DELETION_MODE.MY_DEVICES or .Constants.DELETION_MODE.ALL (delete for all users or just for me).  Note that deleting for just me doesn't remove me as a participant, which means that new Messages will cause the Conversation to reappear.
  * The `messages:read` event has been removed. Please use the `messages:change` event instead.

## 1.0.0

* Updated version number and language from beta to GA

## 0.9.3

* Minor bug fix to layer.Query

## 0.9.2

#### Public API Changes

* layer.Conversation
  * The `delete` method now requires a layer.Constant.DELETION_MODE argument and no longer supports Boolean arguments.
* Adds `isNew` `isSaving`, `isSynced` and `isSaved` methods; these will show up as properties when calling toObject().
* layer.Message
  * The `recipientStatus` property now returns layer.RECEIPT_STATE.PENDING for any recipient to whom the Message has not yet been sent
  * The `getImageURLs` method has been removed.
  * The `delete` method now requires a layer.Constant.DELETION_MODE argument and no longer supports Boolean arguments.
  * Adds `isNew` `isSaving`, `isSynced` and `isSaved` methods; these will show up as properties when calling toObject().
  * Removes the `isSending` property; use `isSaving` instead; `isSaving` will show up as a property for immutable objects.
* layer.MessagePart
  * The `fetchContent` method now triggers an `content-loaded-error` event if it fails to load the Content (content has expired for example, and must be refreshed)
* layer.Query
  * Now runs query as soon as client is ready (for queries created prior to Ready).
* layer.TypingIndicators.TypingListener
  * Now has a setInput method that can be used to change what input the Listener is monitoring when sending
    typing indicators to other users.
* layer.Client
  * Adds registerIOSPushToken() method for push notification support in hybrid apps
  * Adds registerAndroidPushToken() method for push notification support in hybrid apps
  * Adds unregisterPushToken() method
* layer.User
  * Flagged as a private class; it is recommended that you not use this until `v1.1` which will have Identity Management.

#### Bug Fixes

* A round of memory leak fixes

## 0.9.1

#### Bug Fixes

* layer.MessagePart now loads new Rich Content downloadUrl and expiration dates whenever Query reloads the Message.

#### Public API Changes

* layer.Query
  * The `dataType` property is now set with static properties, either layer.Query.InstanceDataType or layer.Query.ObjectDataType
  * A `paginationWindow` property larger than the maximum page size that then automatically loads multiple pages is no longer supported.  A paginationWindow larger than the maximum page size will be automatically adjusted to the maximum page size (a value of 500 will be changed to `query.data.length + 100` if its too large)
  * There is now a `totalSize` property reporting on the total number of results of the query there are on the server.
  * There is now a `size` property reporting on the total number of results of the query have been loaded from the server.
  * Previously you subscribe to `change` event and check the `evt.type` for values of `data`, `insert`, `remove`, `reset` and `property`.
    This still works, but now you can *also* choose to subscribe to `change:data`, `change:insert`, `change:remove`, `change:reset` and `change:property`.
* layer.TypingIndicators.TypingListener
  * Change to constructor parameters.  If using `client.createTypingListener` then it does not affect you
* layer.TypingIndicators.TypingPublisher
  * Change to constructor parameters.  If using `client.createTypingPublisher` then it does not affect you

#### Fixes

* Fixes issues with websocket reconnect logic

## 0.9.0 Public Beta Launch

#### Public API Changes

* layer.Client.createConversation now defaults to creating Distinct Conversations.


## 0.1.4

#### Public API Changes

* layer.Client
  * Now has an `online` event for reporting on whether it is or is not connected to the server.
  * Now clears all queries and reloads their data from the server if disconnected more than 30 hours

## 0.1.3

#### Public API Changes

* layer.Message
  * Now has an `isSending` property
  * Removes the `isLoaded` method
  * Adds the `isLoading` property
* layer.Conversation
  * Removes the `isLoaded` method
  * Adds the `isLoading` property
* layer.Client
  * Now supports a logLevel property with enhanced logging support
  * Adds `messages:notify` event which can be used to help drive desktop notifications more reliably than the `messages:add` event.

#### Fixes

* Fixes to error handling in websocket requests that timeout

## 0.1.2

#### Public API Changes

* layer.MessagePart
   * Now has a `hasContent` property
   * `loadContent()` method has been renamed to fetchContent
   * `fetchContent` now triggers a messages:change event on completion.
   * `content` property has been removed; this is now a private property
   * layer.MessagePart now has a `url` property; returns "" if url has expired.
   * `url` will be set asynchronously by calling `fetchContent()`
     This url will be to a resource cached in the browser.
   * `url` will be set asynchronously by calling `layer.MessagePart.fetchStream()`.
      This url will point to a remote resource, but this is an expiring URL.
   * The expiring url will be cleared when it has expired, requiring another
   call to fetchStream():
```
   function render(part) {}
    if (part.url) {
      return "<img src='{part.url}' />";
    } else {
      part.fetchStream(() => this.rerender());
      return "<img src='' />";
    }
  }
```
* layer.Client now provides a layer.Client.getMessagePart(id) method

#### Fixes

* Fixes to read receipts; no longer sends read receipt if already marked as read
* Fixes to Websocket reconnect logic insures that missed events are requested

## 0.1.1

#### Public API Changes

* `authenticated-expired` event has been replaced with `deauthenticated` event.
* layer.Query and layer.QueryBuilder now support a `sortBy` property which allows for sorting by `lastMessage.sentAt` or `createdAt`.
* Removes option to use XHR instead of websocket for sending messages and conversations
* `message.sendReceipt('read')` now sets the `isRead` property.
* Websocket PATCH events will load the object from the server if it isn't already cached; patch events are not emitted locally but the conversations:add/messages:add event will trigger showing the current state of the newly loaded object.
* Message.sentBy will now always have a value, even if the message is not yet sent.
* Message.isSending property has been added
* Fixes to layer.Query enable Message Queries to populate with the Conversation's lastMessage while waiting for the rest of the messages to load.
* Fixes to layer.Query now ignore any response but the most recent response (occurs when quickly changing between query predicates)


## 0.1.0

#### Public API Changes

* `client.getObject()` is now a protected method; use `client.getConversation()` or `client.getMessage()` instead
* `client.getConversation(id)` no longer loads the Conversation from the server if its not cached; `client.getConversation(id, true)` WILL load the Conversation from the server if its not cached.
* `client.getMessage(id)` no longer loads the Message from the server if its not cached; `client.getMessage(id, true)` WILL load the Message from the server if its not cached.
