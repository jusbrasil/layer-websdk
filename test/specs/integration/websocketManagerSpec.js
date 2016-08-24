/* eslint-disable */
describe("Websocket tests", function() {
    var userId = "Frodo";
    var convId1 = layer.Conversation.prefixUUID + layer.Util.generateUUID();
    var convId2 = layer.Conversation.prefixUUID + layer.Util.generateUUID();
    var convId3 = layer.Conversation.prefixUUID + layer.Util.generateUUID();
    var messId1 = layer.Message.prefixUUID + layer.Util.generateUUID();
    var messId2 = layer.Message.prefixUUID + layer.Util.generateUUID();
    var messId3 = layer.Message.prefixUUID + layer.Util.generateUUID();
    var sampleConv = {
      "type": "change",
      "counter": 1,
      "timestamp": "2014-09-15T04:45:00+00:00",
      "body": {
          "operation": "create",
          "object": {
              "type": "Conversation",
              "id": convId1,
              "url": layer.Client.prototype.url + convId1.replace(/layer\:\/\//, "")
          },
          "data": {
            "id": convId1,
            "created_at": "2014-09-15T04:44:47+00:00",
            "last_message": responses.message2,
            "participants": ["1234", "5678"],
            "metadata": {
                "name" : "My Conversation",
                "_starred": true
            }
          }
      }
    };

    var sampleMess = {
      "type": "change",
      counter: 2,
      "timestamp": "2015-01-19T09:15:43+00:00",
      "body": {
          "operation": "create",
          "object": {
              "type": "Message",
              id: messId2,
              "url": layer.Client.prototype.url + messId2.replace(/layer\:\/\//, "")
          },
          "data": {
            "position": 15032697020,
            "conversation": {
                "id": convId1
            },
            "parts": [
                {
                    "mime_type": "text/plain",
                    "body": "This is the message.",
                    "size": 20
                },
                {
                    "mime_type": "image/png",
                    "body": " ... base-64 encoded data ...",
                    "size": 17211
                }
            ],
            "sent_at": "2014-09-09T04:44:47+00:00",
            "sender": {
                "id": "layer:///identities/12345",
                "name": null
            },
            "recipient_status": {
                "layer:///identities/12345": "sent",
                "layer:///identities/999": "read",
                "layer:///identities/111": "delivered"
            }
          }
      }
    };

    var client, socket, m1, m2, c1, c2;
    beforeEach(function() {
        jasmine.Ajax.install();
        requests = jasmine.Ajax.requests;
        jasmine.clock().install();

        client = new layer.Client({
            appId: "Client1"
        });

        client.user = {userId: userId};

        client._clientAuthenticated();
        socket = client.socketManager;
        socket._socket = {
            close: function() {},
            send: function() {},
            removeEventListener: function() {},
            readyState: typeof WebSocket != "undefined" ? WebSocket.CONNECTING : 2
        };
        c1 = client.createConversation({
            participants: ["a", "b", "c"],
            distinct: false
        }).send();
        c2 = client.createConversation({
            participants: ["a", "d"],
            metadata: {
                winner: "sauran",
                loser: "frodo"
            }
        }).send();
        m1 = c1.createMessage({
            parts: ["Hello"],
            id: messId1,
            recipientStatus: {
                "a": "read",
                "b": "delivered",
                "c": "sent"
            }
        }).send();

        m2 = c1.createMessage({
            parts: ["Goodbye"],
            id: messId2,
            metadata: {
                winner: "sauran",
                loser: "voldemort",
                dead: ["you", "me", "everyone else"]
            }
        }).send();
        requests.reset();
        jasmine.clock().tick(1);
        client.syncManager.queue = [];
    });

    afterEach(function() {
        client.destroy();
        jasmine.clock().uninstall();
    });

    afterAll(function() {
        layer.Client.destroyAllClients();
    });

    describe("Should route events to the right handler", function() {
        it("Should call _handleCreate", function() {
            // Setup
            spyOn(client.socketChangeManager, "_handleCreate");

            // Run
            socket._onMessage({data: JSON.stringify({
                "type": "change",
                body: {
                    "operation": "create",
                    "object": {
                        "type": "Conversation",
                        "id": convId1
                    }
                }
            })});

            // Posttest
            expect(client.socketChangeManager._handleCreate).toHaveBeenCalled();
        });

        it("Should call _handleDelete", function() {
            // Setup
            spyOn(client.socketChangeManager, "_handleDelete");

            // Run
            socket._onMessage({data: JSON.stringify({
                "type": "change",
                body: {
                    "operation": "delete",
                    "object": {
                        "type": "Conversation",
                        "id": convId1
                    },
                    data: {
                      mode: "all_participants"
                    }
                }
            })});

            // Posttest
            expect(client.socketChangeManager._handleDelete).toHaveBeenCalled();
        });

        it("Should call _handlePatch", function() {
            // Setup
            spyOn(client.socketChangeManager, "_handlePatch");

            // Run
            socket._onMessage({data: JSON.stringify({
                "type": "change",
                body: {
                    "operation": "patch",
                    "object": {
                        "type": "Conversation",
                        "id": c1.id
                    },
                    data: [{operation: "set", property: "metadata.doh", value: "hey"}]
                }
            })});

            // Posttest
            expect(client.socketChangeManager._handlePatch).toHaveBeenCalled();
        });
    });


    describe("Websocket Conversation tests", function() {
        it("Should delete a conversation", function() {
            // Pretest
            expect(Boolean(client.getConversation(c2.id, false))).toEqual(true);

            // Run
            client.socketChangeManager._handleDelete({
                "type": "change",
                "operation": "delete",
                "object": {
                    "type": "Conversation",
                    "id": c2.id
                },
                data: {
                  mode: "all_participants"
                },
                "timestamp": "2015-01-19T09:15:43+00:00"
            });

            // Posttest
            expect(Boolean(client.getConversation(c2.id, false))).toEqual(false);
        });

        it("Should create a conversation", function() {
            // Setup
            var conv = JSON.parse(JSON.stringify((sampleConv)));
            conv.body.data.id = conv.body.object.id = c1.id;
            client._removeConversation(client.getConversation(c1.id, false));

            // Pretest
            expect(Boolean(client.getConversation(c1.id, false))).toEqual(false);

            // Run
            client.socketChangeManager._handleCreate(conv.body);

            // Posttest
            expect(Boolean(client.getConversation(c1.id, false))).toEqual(true);
        });

        describe("Patching Metadata", function() {

            it("Should add and remove metadata", function() {
                // Setup
                var conv = client.getConversation(c2.id, false);

                // Pretest
                expect(conv.metadata).toEqual({
                    winner: "sauran",
                    loser: "frodo"
                });

                // Run
                client.socketChangeManager._handlePatch({
                    "operation": "patch",
                    "object": {
                        "type": "Conversation",
                        id: c2.id
                    },
                    "data": [{
                        "operation": "set",
                        "property": "metadata.a",
                        "value": {}
                    },{
                        "operation": "set",
                        "property": "metadata.a.b",
                        "value": {}
                    }, {
                        "operation": "set",
                        "property": "metadata.a.b.c",
                        "value": "d"
                    }, {
                        "operation": "delete",
                        "property": "metadata.loser"
                    }]
                });

                // Posttest
                expect(conv.metadata).toEqual({
                    winner: "sauran",
                    a: {
                        b: {
                            c: "d"
                        }
                    }
                });
            });
        });
    });

    describe("Message Tests", function() {

        it("Should create a message", function() {

            // Setup
            var messageDef = JSON.parse(JSON.stringify(sampleMess));
            messageDef.body.data.id = messageDef.body.object.id = messId3;
            messageDef.body.data.url = messageDef.body.object.url = client.url + messId3.replace(/layer\:\/\//, "");
            messageDef.body.data.conversation.url = c1.url;
            messageDef.body.data.conversation.id = c1.id;

            // Pretest
            expect(Boolean(client.getMessage(messageDef.body.object.id))).toEqual(false);

            // Run
            client.socketChangeManager._handleCreate(messageDef.body);
            jasmine.clock().tick(1);

            // Posttest
            expect(Boolean(client.getMessage(messageDef.body.object.id))).toEqual(true);
        });


        it("Should delete a message", function() {
            // Setup
            var m = new layer.Message({
                fromServer: {
                    sender: {user_id: "a"},
                    id: messId1,
                    position: 10,
                    parts: [{mime_type: "text/plain", body: "hello"}],
                    conversation: {
                        id: c1.id,
                        url: c1.url
                    }
                },
                client: client
            });

            // Pretest
            expect(Boolean(client.getMessage(m.id))).toEqual(true);

            // Run
            client.socketChangeManager._handleDelete({
                "operation": "delete",
                "object": {
                    "type": "Message",
                    "url": client.url + m.id.replace(/layer\:\/\//,""),
                    id: m.id
                },
                data: {
                  mode: "all_participants"
                }
            });

            // Posttest
            expect(Boolean(client.getMessage(m.id))).toEqual(false);
        });

        it("Should apply recipientStatus patches", function() {
            // Setup
            c1.participants = ["a", "b", "c", "Frodo"];
            m1.conversationId = c1.id;
            m1.recipientStatus = {
                "a": "read",
                "b": "delivered",
                "c": "sent",
                "Frodo": "read"
            };
            expect(m1.readStatus).toEqual(layer.Constants.RECIPIENT_STATE.SOME);

            // Run
            client.socketChangeManager._handlePatch({
                "operation": "patch",
                "object": {
                    "type": "Message",
                    "id": m1.id
                },
                "data": [{
                    "operation": "set",
                    "property": "recipient_status.b",
                    "value": "read"
                },{
                    "operation": "set",
                    "property": "recipient_status.c",
                    "value": "read"
                }]
            });


            // Posttest
            expect(m1.recipientStatus).toEqual({
                "a": "read",
                "b": "read",
                "c": "read",
                "Frodo": "read"
            });
            expect(m1.readStatus).toEqual(layer.Constants.RECIPIENT_STATE.ALL);
        });
    });

    describe("Should handle misc events", function() {
        it("Should handle unread_message_count changes", function() {
            // Setup
            spyOn(c2, "_triggerAsync");

            // Run
            client.socketChangeManager._handlePatch({
                "operation": "patch",
                "object": {
                    "type": "Conversation",
                    "id": c2.id
                },
                "data": [{
                    "operation": "set",
                    "property": "unread_message_count",
                    "value": 999
                }]
            });
            jasmine.clock().tick(1001);

            // Posttest
            expect(c2.unreadCount).toEqual(999);
            expect(c2._triggerAsync).toHaveBeenCalledWith("conversations:change", jasmine.objectContaining({
                oldValue: 0,
                newValue: 999,
                property: "unreadCount"
            }));
        });

        it("Should handle last_message changes", function() {
            // Setup
            c1.lastMessage = null;
            c2.lastMessage = null;
            jasmine.clock().tick(1);
            spyOn(c2, "_trigger");

            // Run
            client.socketChangeManager._handlePatch({
                "operation": "patch",
                "object": {
                    "type": "Conversation",
                    "id": c2.id
                },
                "data": [{
                    "operation": "set",
                    "property": "last_message",
                    "id": m2.id
                }]
            });
            jasmine.clock().tick(1);

            // Posttest
            expect(c2.lastMessage.id).toEqual(messId2);
            expect(c2._trigger).toHaveBeenCalledWith("conversations:change", jasmine.objectContaining({
                changes: [{
                    property: "lastMessage",
                    oldValue: null,
                    newValue: m2
                }],
                eventName: "conversations:change",
                isChange: true,
                target: c2
            }));
        });

        it("Should set last_message to null if last_message only gets an id instead of an object", function() {
            // Setup
            c2.lastMessage = m1;
            jasmine.clock().tick(1);
            spyOn(c2, "trigger");


            // Run
            client.socketChangeManager._handlePatch({
                "operation": "patch",
                "object": {
                    "type": "Conversation",
                    "id": c2.id
                },
                "data": [{
                    "operation": "set",
                    "property": "last_message",
                    "id": "layer:///messages/doh!"
                }]
            });
            jasmine.clock().tick(1);

            // Posttest
            expect(c2.lastMessage).toBe(null);
            expect(c2.trigger).toHaveBeenCalledWith("conversations:change", jasmine.objectContaining({
                changes: [{
                    property: "lastMessage",
                    oldValue: m1,
                    newValue: null
                }],
                target: c2,
                eventName: "conversations:change",
                isChange: true
            }));
        });
    });

    describe("Handling unneccessary events", function() {

        it("Should not add a conversation that already exists", function() {

            // Setup
            if (client.getConversation(c1.id, false)) {
                client.getConversation(c1.id, false).destroy();
            }

            var c = new layer.Conversation({
                fromServer: {
                    id: c1.id,
                    participants: [{user_id: "a", id: "layer:///identities/a"}, {user_id: "b", id: "layer:///identities/b"}]
                },
                client: client
            });

            // Run
            socket._onMessage({
                data: JSON.stringify({
                  "type": "change",
                  "body": {
                    "operation": "create",
                    "object": {
                        "type": "Conversation",
                        "id": "layer:///12345",
                        id: c1.id
                    },
                    "timestamp": "2014-09-15T04:45:00+00:00",
                    "data": {
                      id: c1.id,
                      "created_at": "2014-09-15T04:44:47+00:00",
                      "last_message": responses.message2,
                      "participants": ["1234", "5678"],
                      "metadata": {
                          "name" : "My Conversation",
                          "_starred": true
                      }
                    }
                  }
                })
            });
            jasmine.clock().tick(1);

            // Post test
            // If c is still the object in the client, then no new object was added
            // to replace it
            expect(c).toBe(client.getConversation(c1.id, false));
        });

        it("Should update a conversation that already exists", function() {

            // Setup
            if (client.getConversation(c1.id, false)) {
                client.getConversation(c1.id, false).destroy();
            }

            var c = new layer.Conversation({
                fromServer: {
                    id: c1.id,
                    participants: ["a", "b"],
                },
                client: client
            });

            // Run
            socket._onMessage({
                data: JSON.stringify({
                  "type": "change",
                  "body": {
                      "operation": "create",
                      "object": {
                          "type": "Conversation",
                          id: c1.id
                      },
                      "timestamp": "2014-09-15T04:45:00+00:00",
                      "data": {
                        "id": c1.id,
                        "created_at": "2014-09-15T04:44:47+00:00",
                        "last_message": responses.message2,
                        "participants": ["1234", "5678"],
                        "metadata": {
                            "name" : "My Conversationzz",
                            "_starred": true
                        }
                      }
                  }
                })
            });
            jasmine.clock().tick(1);

            // Post test
            // If c is still the object in the client, then no new object was added
            // to replace it
            expect(c.participants).toEqual(["1234", "5678"]);
            expect(c.metadata).toEqual({
                "name" : "My Conversationzz",
                "_starred": true
            });
        });

        it("Should update a conversation.last_message", function() {

            // Setup
            if (client.getConversation(c1.id, false)) {
                client.getConversation(c1.id, false).destroy();
            }

            var c = new layer.Conversation({
                fromServer: {
                    id: c1.id,
                    participants: ["a", "b"],
                },
                client: client
            });

            var m = new layer.Message({
                fromServer: {
                    conversation: {
                        id: c.id,
                        url: c.url
                    },
                    sender: {user_id: "a"},
                    parts: [{body: "hello", mime_type: "text/plain"}],
                    id: m1.id,
                    sent_at: new Date().toISOString()
                },
                client: client
            });


            c.__lastMessage = m;

            var sample = JSON.parse(JSON.stringify(sampleConv));
            sample.body.object.id = c1.id;
            sample.body.data.last_message.id = m.id;

            // Run
            socket._onMessage({
                data: JSON.stringify({
                  "type": "change",
                  "body": {
                      "operation": "create",
                      "object": {
                          "type": "Conversation",
                          "id": "layer:///12345",
                          id: c1.id
                      },
                      "timestamp": "2014-09-15T04:45:00+00:00",
                      "data": {
                        id: c1.id,
                        "created_at": "2014-09-15T04:44:47+00:00",
                        "last_message": responses.message2,
                        "participants": ["1234", "5678"],
                        "metadata": {
                            "name" : "My Conversationzz",
                            "_starred": true
                        }
                      }
                  }
                })
            });
            jasmine.clock().tick(1);

            // Post test
            expect(c.lastMessage.id).toEqual(responses.message2.id);

        });

        it("Should not add a message that already exists", function() {

            var m = c1.createMessage({
                parts: "hello"
            }).send();

            var sample = JSON.parse(JSON.stringify(sampleConv));
            sample.body.data.id = sample.body.object.id = c1.id;
            sample.body.data.last_message.id = m.id;

            // Run
            socket._onMessage({
                data: JSON.stringify(sample)
            });

            // Posttest
            expect(m).toBe(client.getMessage(m.id));
        });

        it("Should update a last_message that already exists", function() {

            var m = c1.createMessage({
                parts: "hello"
            }).send();

            expect(m.recipientStatus).toEqual({
              "a": "pending",
              "b": "pending",
              "c": "pending",
              "Frodo": "read"
            });

            var sample = JSON.parse(JSON.stringify(sampleConv));
            sample.body.object.id = c1.id;
            sample.body.data.id = c1.id;
            sample.body.data.last_message.id = m.id;

            // Run
            socket._onMessage({
                data: JSON.stringify(sample)
            });

            // Posttest
            expect(m.recipientStatus).toEqual({
              "1234": "pending",
              "5678": "pending",
              "111": "delivered",
              "777": "read",
              "999": "read"
            });
        });

        it("Should update a message that already exists", function() {


            var m = c1.createMessage({
                parts: "hello"
            }).send();

            expect(m.recipientStatus).toEqual({
              "a": "pending",
              "b": "pending",
              "c": "pending",
              "Frodo": "read"
            });

            var sample = JSON.parse(JSON.stringify(sampleMess));
            sample.body.object.id = m.id;
            sample.body.data.id = m.id;

            // Run
            socket._onMessage({
                data: JSON.stringify(sample)
            });

            // Posttest
            expect(m.recipientStatus).not.toBe({});
        });

    });
});