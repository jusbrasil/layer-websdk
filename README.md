# Layer Web SDK

[![Build Status](http://img.shields.io/travis/layerhq/layer-websdk.svg)](https://travis-ci.org/layerhq/layer-websdk)
[![npm version](http://img.shields.io/npm/v/layer-websdk.svg)](https://npmjs.org/package/layer-websdk)

The Layer Web SDK is a JavaScript library for adding chat services to your web application. For detailed documentation, tutorials and guides please visit our [Web SDK documentation](https://developer.layer.com/docs/websdk).

## Supported Browsers

* IE 11 and Edge
* Safari 7
* Chrome 42 and up
* Firefox 40 and up

Older versions of Chrome and Firefox will likely work.

## Installation

All examples below assume your using the CDN installation method; adapting instructions to other methods should be straightforward.

### CDN

Simplest approach to install the Web SDK is to add the following script tag:

```html
<script src='//cdn.layer.com/sdk/1.1/layer-websdk.min.js'></script>
```

* For stricter code control, use `//cdn.layer.com/sdk/1.1.0/layer-websdk.min.js` instead.

All classes can then be accessed via the `layer` namespace:

```javascript
var client = new layer.Client({
    appId: LAYER_APP_ID
});
```

### NPM

    npm install layer-websdk@beta --save

All classes can then be accessed via the layer module:

```javascript
var layer = require('layer-websdk');

var client = new layer.Client({
    appId: LAYER_APP_ID
});
```

### From source

**This section does not apply to beta!**

Download the latest SDK release [Source code](https://github.com/layerhq/layer-websdk/releases/latest) archive, extract the files and run the following commands from the extracted project folder:

    > npm install
    > grunt build

A `build/` folder will be generated that contains `client.min.js` file.

Other build commands:

* `grunt debug`: Generates `build/client.debug.js` which provides source-mapped files if you need to step through the Web SDK.
* `grunt docs`: Generates `docs/index.html` which you can open to view the API documentation.
* `grunt test`: Run the unit tests

## About this README

This README contains everything you need to get started.  But is NOT an exhaustive source of documentation.  For the full documentation, or for any topics that are missing here, go to the [Web SDK documentation](https://developer.layer.com/docs/websdk).

## Getting Started

To start using Layer's Web SDK, you need to

1. Initialize a layer.Client
2. Setup event handlers
3. Connect to Layer

### 1. Initializing a Client

Initialize a client with your Layer Application ID which can be found in the [Developer Dashboard](https://developer.layer.com/projects/keys).

```javascript
var client = new layer.Client({
    appId: LAYER_APP_ID
});
```
### 2. Setup Event handlers

The client requires two event handlers to get started:

* `challenge`: Performs an authentication challenge requiring your application to provide an Identity Token
* `ready`: The client is authenticated and is ready for your UI

```javascript
client.on('challenge', function(evt) {
    getIdentityToken(evt.nonce, function(identityToken) {
        evt.callback(identityToken);
    })
});

client.on('ready', function() {
    renderMyUI(client);
});
```

The following shorthand is also acceptable:

```javascript
var client = new layer.Client({
    appId: LAYER_APP_ID,
    challenge: function(evt) {
        getIdentityToken(evt.nonce, function(identityToken) {
            evt.callback(identityToken);
        })
    },
    ready: function() {
        renderMyUI(client);
    }
});
```

`getIdentityToken()` is a method you provide for accessing your Identity Provider, and is covered in the [Authentication](#authentication) section.

### 3. Connect to Layer

To start the client, you will call the `connect` method with the userId of the user you are authenticating as:

```javascript
client.connect('Frodo_the_Dodo');
```

This call will start the authentication process.  If using the `layer.Client.isTrustedDevice` property, it may try to restore your last Session Token and skip authentication.


### Accessing Data

Data is accessed via layer.Query instances.  Some notes about queries before going into details:

* The `update()` method lets you change properties of the Query and then fetches updated results.
* Results of Queries will update as new Conversations or Messages are created locally or remotely.
* Results are accessed via the query's `data` property.
* Events are triggered whenever there is a change to the query's results.
* Queries can be used to retrieve the following types of data:
    * Conversations: model is `layer.Query.Conversation`
    * Messages: model is `layer.Query.Message`
    * Announcements: model is `layer.Query.Announcement`
    * Identities: model is `layer.Query.Identity`

#### Conversation Query

```javascript
var query = client.createQuery({
    model: layer.Query.Conversation
});

query.on('change', function(evt) {
    var conversations = query.data;
    myConversationListRenderer(conversations);
});
```

At this time, no predicates are supported for filtering results.

Conversations can be sorted by `lastMessage.sentAt` or `createdAt`; the default sort is `createdAt`; only Descending sorts are supported at this time.

```javascript
var query = client.createQuery({
    model: layer.Query.Conversation,
    sortBy: [{'lastMessage.sentAt': 'desc'}]
});
```

Improved support for sorting and predicates will ship once the Layer's [Client APIs](https://developer.layer.com/docs/client) adds a Query API.

#### Message Query

```javascript
var query = client.createQuery({
    model: layer.Query.Message,
    predicate: 'conversation.id = "layer:///conversations/uuid"'
});

query.on('change', function(evt) {
    var messages = query.data;
    myMessageListRenderer(messages);
});
```

The Message query only accepts a predicate/filter of the form:

```javascript
 'predicate': 'conversation.id = "' + myConversation.id + '"'
```

Notes:

* Single and double quotes are both supported for this predicate.
* No sorting options are currently supported on Message queries.  They are always sorted by Message `position` property in descending order.

#### Query Update

Any time you want to change properties of your query, you can call the `update()` method:

_Page the Query:_

```javascript
query.update({
    paginationWindow: query.paginationWindow + 50
});
```

Paging the query will fire a request to the server and append additional data to the results.  In this case, the next 50 results will be downloaded.

_Change the Query:_

```javascript
query.update({
    predicate: 'conversation.id = "' + conversation.id + '"'
});
```
Changing the predicate:

* clears the query's data
* resets its paginationWindow
* triggers a reset event
* fires a request to the server
* sets the data to the results from the server
* triggers a data event

A common pattern is to use a single `layer.Query` bound to your MessageListView, changing the predicate as the user moves from Conversation to Conversation.

An alternate pattern of creating a new `layer.Query` each time the user navigates to a new Conversation also works; however, you **must** destroy each query when done with it:

```javascript
query.destroy();
```

#### The Query Builder

There is a `layer.QueryBuilder` class that simplifies assembling of Queries:

```javascript
var builder = QueryBuilder
  .messages()
  .forConversation(conversationOne.id)
  .paginationWindow(50);

var query = client.createQuery(builder);

query.update(builder.forConversation(conversationTwo.id));
```

The QueryBuilder may suit some developer styles better.

#### Query Results

Any change to the Query results are announced via a `change` event.  The simplest pattern for using a `change` event is to grab the query's data:

```javascript
query.on('change', function(evt) {
  renderCurrentMessages(query.data);
});
```

To get more granular details about the different types of `change` events and how to access just the data within the results that have changed, see the [Query API](http://static.layer.com/sdk/docs-1.1/#!/api/layer.Query).

## Authentication

Authentication requires that:

* you have set up an Identity Service
* your client sends a request to your identity service to get an Identity Token
* your client provides that identity token to the Layer Web SDK

Some of these concepts are explained in more detail in the [Authentication Guide](https://developer.layer.com/docs/websdk/guides#authentication); concepts specific to the Layer Web SDK are described here.

Assuming that you have an [Identity Provider](https://developer.layer.com/docs/websdk/guides#authentication), your javascript application will need to provide some method (`getIdentityToken()` in the example below) that gets the identity token.

```javascript
function getIdentityToken(nonce, callback) {
    xhr({
        url: 'https://myservice.com/identity',
        method: 'POST',
        data: {
            nonce: nonce
        }
    }, function(result) {
        callback(result.identity_token);
    });
}
```

Presumably, before you try to initialize a Layer Client, the user has already logged into your application, and you already have a session validating who this user is for your server.  Your server just needs to take this nonce and create and Identity Token.

The full sequence may look like:

```javascript
var client = new layer.Client({
    appId: LAYER_APP_ID,
    isTrustedDevice: false
});

client.on('challenge', function(evt) {
    getIdentityToken(evt.nonce, function(identityToken) {
        evt.callback(identityToken);
    })
});
```

Note that `evt.callback` must be called to provide the Layer Client with the identity token and procede with authorization.

### Reusing the previous Authorization?

If the client receives the `isTrustedDevice` property, then it will store your user's last Session Token in localStorage.

When reloading a web page, the framework will try to restore the last session.  However, it will only do this if:

1. `isTrustedDevice` is true
2. A `userId` property is provided to the `connect()` method
3. The `userId` property matches the userId of the last user to login

```javascript
var client = new layer.Client({
    appId: LAYER_APP_ID,
    isTrustedDevice: true
});
client.connect('Frodo_the_Dodo');
```

* If there is no session cached for `Frodo_the_Dodo`, then your `challenge` event handler will be called.
* If there is a session but its expired, then your `challenge` event handler will be called.
* If there is a session and its valid, then your `ready` event handler will be called.

## Creating a Conversation

```javascript
var conversation = client.createConversation({
    participants: ['layer:///identities/a','layer:///identities/b'],
    distinct: false,
    metadata: {
        title: 'My conversation title'
    }
});
```

The above Conversation will not be sent to the server until you send a message with it.

## Creating and Sending a Message

```javascript
// Shorthand
var message = conversation.createMessage('Hello World').send();

// Complete version
var message = conversation.createMessage({
    parts: [{
        body: 'Hello World',
        mimeType: 'text/plain'
    })]
}).send({
    title: 'New Message from World',
    text: 'World Says "Hello World"; its a very self involved planet',
    sound: 'ding.aiff'
});
```

Note that creation of a Message is separate from sending it. This allows you to add additional MessageParts to your message after creating it:

```javascript
var message = conversation.createMessage('Hello World');
message.addPart({
    body: 'Farewell World',
    mimeType: 'text/plain'
});
message.send();
```

Also note that the send method takes an optional parameter for push notifications; without that parameter there will be no new message notification for mobile device users:

```javascript
message.send({
    title: 'New Message from World',
    text: 'World Says "Hello World"; its a very self involved planet',
    sound: 'ding.aiff'
});
```

## Retrieving a Conversation

A Conversation can be retrieved by ID using:

```javascript
var conversation = client.getConversation('layer:///conversations/uuid');
```

A Conversation can be retrieved by ID from cache OR from the server if not cached using:

```javascript
var conversation = client.getConversation('layer:///conversations/uuid', true);
```

If you need the Conversation's details to be loaded from the server, use the 'conversations:loaded' event to be notified when its ready:

```javascript
var conversation = client.getConversation('layer:///conversations/uuid', true);
conversation.once('conversations:loaded', function() {
    renderMyUI(conversation);
});
```

The `conversations:loaded` event will be called immediately if its already loaded.

## Retrieving a Message

A Message can be retrieved by ID using:

```javascript
var Message = client.getMessage('layer:///messages/uuid');
```

A Message can be retrieved by ID from cache OR from the server if not cached using:

```javascript
var Message = client.getMessage("layer:///messages/uuid", true);
```

If you need the Message's details to be loaded from the server, use the "messages:loaded" event.

```javascript
var message = client.getMessage("layer:///messages/uuid", true);
message.once("messages:loaded", function() {
    renderMyUI(message);
});
```
The `messages:loaded` event will be called immediately if its already loaded.

## Identity

Identity is a key concept for working with Layer's Web SDK;

* Your Conversations have a `participants` property that consists of an array of layer.Identity objects
* Each message has a `sender` property that is a layer.Identity object
* Your layer.Client has a `user` property that is a layer.Identity object

Any method for operating upon the `participants` of a Conversation will either expect an Identity object, or an Identity ID.  An Identity ID can be derived from a User ID in your own User Management system using:

```javascript
var identityId = 'layer:///identities/' + encodeURIComponent(userId);
```

The Identity object insures that any time you receive an object from Layer, it comes with enough information to know who a user is and how to render that user. In previous versions, you would have to Query your own server to gather this data.  Each Identity comes with:

* `userId`: Allows you to map the Identity to a user in your own User Management system
* `id`: Allows you to identify the user to any of Layer's APIs
* `displayName` & `avatarUrl`: Helps you to render the user within your UI

Note that in order to populate `displayName` and `avatarUrl` with values, you must either

* Embed this information into the [Identity Token](https://developer.layer.com/docs/websdk/guides#authentication) generated for your user
* Set this information using the [Platform API](https://developer.layer.com/docs/platform)

### Retrieving Identities

Sometimes it can be useful to load the Identities of people your user interacts with.  The list of users that is retreived via a Query is the list of people where:

* They have at some point shared a Conversation with your user
* Your user called `client.followIdentity(Identity ID)` on them
* Your server has used the [Platform API](https://developer.layer.com/docs/platform) to make these users follow one another

This list is useful for generating a list of people to create a Conversation with, and providing both information for rendering them, as well as profile information to show your users.

```javascript
var query = client.createQuery({
    model: layer.Query.Identity
});

query.on('change', function(evt) {
    var identities = query.data;
    myUserSelectionListRenderer(identities);
});
```

## Persistence

Options exist to cache data in the browser.  All of these capabilities are protected by the `isTrustedDevice` property.  If the device is not trusted, no data will be stored.  This is the default state.  But if you set `isTrustedState` to true, then data can be saved.

```javascript
var client = new layer.Client({
  appId: LAYER_APP_ID,
  isTrustedDevice: true
});
```

By default, `isTrustedDevice` will enable the following types of data to be stored:

* Conversations
* Messages
* Announcements
* Identity data for the people this user chats with
* Server Requests that have not yet completed
* The Session Token

Applications can configure which of these tables are used by using the `persistenceFeatures` property:

```javascript
var client = new layer.Client({
  appId: LAYER_APP_ID,
  isTrustedDevice: true,
  persistenceFeatures: {
    messages: false,
    conversations: true,
    identities: false,
    syncQueue: true,
    sessionToken: true
  }
});
```

Cordova and other installed apps would typically just have everything set to `true` (i.e. just use `isTrustedDevice` and use the default `persistenceFeatures`).  Below are discussions of why you should/should not store various types of data.

### Persisting Messages

Even if this is a trusted device, if your Messages contain credit card numbers, illicit liasons, etc... it may be best not to store this data in the browser.  Storing Messages allows the client to display messages within Conversations without waiting for any server connection, which has many advantages in performance and ability to operate without a connection.

### Persisting Conversations

While this is generally safer than storing Messages,

1. If your Conversation's `metadata` property contains sensitive information, you should consider whether it should be stored
2. Apps where user ids in Conversations are easily mapped to real users would potentially expose who a person is talking to.

Storing these allows a user to quickly see their Conversation list even without a connection.  That Conversation list is the starting point for many applications, and any performance improvement in rendering that list is preferred.

### Identities

Identities are used to help render information about people in Conversations or who you may want to start a Conversation with.  Storing identities allows this data to be quickly available and easily kept in sync.  You control what goes in the Identity from your servers via [Platform API](https://developer.layer.com/docs/platform/users#managing-identity).  If your writing phone numbers, email addresses, or other information that may be sensitive, consider whether this data is a potential security flaw even when `isTrustedDevice` has been set to `true`.

### Server Requests

The `syncQueue` property, if true, allows any unsent request to be written to persistent memory and completed when the app is next relaunched.  If `messages` or `conversations` are disabled, then so is caching of Server Requests.

### Session Token

Typically if a device is trusted, then you'd expect it to be easy to re-login.  If this is not the case, you can change this to false.  If false, a new Session Token will be generated each time the browser tab is reloaded.

## Change Events

The Layer Web SDK provides not just a set of APIs for letting you create, retrieve and control Conversations and Messages, but also a websocket connection that keeps your objects up-to-date and in sync with everyone else.  Changes, regardless of whether they are generated by websocket data or changes you have made programatically, will all result in Events being triggered.

### Commonly Used Events

There are a lot of available events, but only a few that are really necessary for building applications:

* layer.Query Events
    * `change` - Any change to the Query results

* layer.Message Events:
    * `messages:sent` - A Message you were sending is now sent
    * `messages:change` - A Message property has changed

* layer.Conversation Events:
    * `conversations:sent` - A Conversation has been sent to the server
    * `conversations:change` - A Conversation property has changed

* layer.Client Events: Receives all of the above events as well as:
    * `ready` - The client is connected, authenticated and ready for use
    * `challenge` - The client requires an identity token
    * `messages:notify` - A Message has been added to the messages cache

### Event Arguments

Event callbacks are called with an `event` argument that is an instance of layer.LayerEvent.  This contains a `target` property identifying the object changed, along with any information about what changed.  The `target` allows an application to write:

```javascript
client.on('conversation:change', function(event) {
    var changedItem = event.target;
    alert((changedItem.toString() + ' has changed');
});
```

Change events get some special handling; any event name that matches 'xxxx:change' will come with a `changes` property containing an array of properties that have changed:

```javascript
[{
  oldValue: 5,
  newValue: 10,
  property: 'unreadCount'
}]
```

Change events also come with a `getChangesFor` method for extracting all changes to a specific property:

```javascript
client.on('conversation:change', function(event) {
    var changedItem = event.target;
    var participantChanges = event.getChangesFor('participants');
    var metadataChanges    = event.getChangesFor('metadata');

    participantChanges.forEach(function(change) {
        alert(changedItem.toString() + ' old value is ' + change.oldValue +
          '; new value is ' + change.newValue);
    });

    metadataChanges.forEach(function(change) {
        alert(changedItem.toString() + ' old value is ' + change.oldValue +
          '; new value is ' + change.newValue);
    });
}, this);
```

The Event system is built on top of the backbone.js events. This accepts:

```javascript
object.on(eventName, callback, context);

object.on('eventName1 eventName2', callback, context);

object.on({
    eventName1: callback,
    eventName2: callback,
    eventName3: callback
}, context);

object.off(eventName, null, null);
object.off(null, callback, null);
object.off(null, null, context);
```

## Websockets

The layer.Client manages a websocket connection to the server.  If the connection is lost, it will attempt to reconnect when able, and will catchup on missed events. Typically, all management of this connection should be left to the Layer Web SDK.  After an extended period of disconnect (> 1 day)
the Client may simply refire all Queries and refresh its data instead of trying to catch up on missed events.

## Testing

To run unit tests use the following command:

    npm test

## Contributing

Layer Web SDK is an Open Source project maintained by Layer, inc. Feedback and contributions are always welcome and the maintainers try to process patches as quickly as possible. Feel free to open up a Pull Request or Issue on Github.

## Contact

Layer Web SDK was developed in San Francisco by the Layer team. If you have any technical questions or concerns about this project feel free to reach out to [Layer Support](mailto:support@layer.com).
